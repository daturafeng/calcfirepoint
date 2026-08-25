import {
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  Matrix4,
  Rectangle,
  Viewer,
} from 'cesium';

export interface CesiumTilesetOverlayConfig {
  id: string;
  url: string;
  maximumScreenSpaceError?: number;
  dynamicScreenSpaceError?: boolean;
  skipLevelOfDetail?: boolean;
  immediatelyLoadDesiredLevelOfDetail?: boolean;
  loadSiblings?: boolean;
  cullRequestsWhileMoving?: boolean;
  foveatedScreenSpaceError?: boolean;
  cacheBytes?: number;
  maximumCacheOverflowBytes?: number;
  heightOffset?: number;
  focusBbox?: [number, number, number, number];
}

export interface CesiumTilesetOverlayFocusOptions {
  duration?: number;
}

type TilesetEntry = {
  overlay: CesiumTilesetOverlayConfig;
  signature: string;
  tileset?: Cesium3DTileset;
  loading?: Promise<void>;
};

type TilesetWithHeightOffset = Cesium3DTileset & {
  __engineHeightOffset?: number;
};

export class CesiumTilesetOverlayManager {
  private readonly entries = new Map<string, TilesetEntry>();
  private readonly pendingFocusIds = new Set<string>();
  private readonly failedIds = new Set<string>();
  private destroyed = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly onLoadError?: (overlayId: string, error: unknown) => void,
  ) {}

  sync(overlays: CesiumTilesetOverlayConfig[]) {
    if (this.destroyed || this.viewer.isDestroyed()) return;
    const desiredIds = new Set(overlays.map((overlay) => overlay.id));
    [...this.entries.keys()].forEach((id) => {
      if (!desiredIds.has(id)) this.remove(id);
    });
    overlays.forEach((overlay) => this.syncOne(overlay));
  }

  focus(overlayId: string, options?: CesiumTilesetOverlayFocusOptions) {
    const entry = this.entries.get(overlayId);
    if (!entry || this.destroyed || this.viewer.isDestroyed()) return;
    if (!entry.tileset || entry.tileset.isDestroyed()) {
      this.pendingFocusIds.add(overlayId);
      return;
    }
    this.focusEntry(entry, options?.duration ?? 0.75);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    [...this.entries.keys()].forEach((id) => this.remove(id));
    this.pendingFocusIds.clear();
    this.failedIds.clear();
  }

  private syncOne(overlay: CesiumTilesetOverlayConfig) {
    const signature = JSON.stringify(overlay);
    const current = this.entries.get(overlay.id);
    if (current?.signature === signature) {
      current.overlay = overlay;
      if (current.tileset && !current.tileset.isDestroyed()) {
        current.tileset.show = true;
        this.applyHeightOffset(current.tileset, overlay.heightOffset ?? 0);
      }
      return;
    }
    if (current) this.remove(overlay.id);
    const entry: TilesetEntry = { overlay, signature };
    this.entries.set(overlay.id, entry);
    this.failedIds.delete(overlay.id);
    entry.loading = Cesium3DTileset.fromUrl(overlay.url, {
      maximumScreenSpaceError: overlay.maximumScreenSpaceError ?? 2,
      dynamicScreenSpaceError: overlay.dynamicScreenSpaceError ?? false,
      skipLevelOfDetail: overlay.skipLevelOfDetail ?? false,
      immediatelyLoadDesiredLevelOfDetail:
        overlay.immediatelyLoadDesiredLevelOfDetail ?? true,
      loadSiblings: overlay.loadSiblings ?? true,
      cullRequestsWhileMoving: overlay.cullRequestsWhileMoving ?? false,
      foveatedScreenSpaceError: overlay.foveatedScreenSpaceError ?? false,
      cacheBytes: overlay.cacheBytes ?? 512 * 1024 * 1024,
      maximumCacheOverflowBytes:
        overlay.maximumCacheOverflowBytes ?? 1024 * 1024 * 1024,
    })
      .then((tileset) => {
        if (this.destroyed || this.viewer.isDestroyed() || this.entries.get(overlay.id) !== entry) {
          if (!tileset.isDestroyed()) tileset.destroy();
          return;
        }
        tileset.show = true;
        this.applyHeightOffset(tileset, overlay.heightOffset ?? 0);
        entry.tileset = this.viewer.scene.primitives.add(tileset);
        this.viewer.scene.requestRender();
        if (this.pendingFocusIds.delete(overlay.id)) this.focusEntry(entry, 0.75);
      })
      .catch((error) => this.reportError(overlay.id, error))
      .finally(() => {
        if (this.entries.get(overlay.id) === entry) entry.loading = undefined;
      });
  }

  private focusEntry(entry: TilesetEntry, duration: number) {
    const tileset = entry.tileset;
    if (!tileset || tileset.isDestroyed()) return;
    const bbox = entry.overlay.focusBbox;
    if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
      this.viewer.camera.flyTo({
        destination: Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
        duration,
      });
      return;
    }
    void this.viewer.flyTo(tileset, { duration });
  }

  private remove(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.tileset && !entry.tileset.isDestroyed()) {
      const removed = this.viewer.isDestroyed()
        ? false
        : this.viewer.scene.primitives.remove(entry.tileset);
      if (!removed && !entry.tileset.isDestroyed()) entry.tileset.destroy();
    }
    this.entries.delete(id);
    this.pendingFocusIds.delete(id);
    this.failedIds.delete(id);
  }

  private reportError(id: string, error: unknown) {
    if (this.destroyed || this.failedIds.has(id)) return;
    this.failedIds.add(id);
    this.onLoadError?.(id, error);
  }

  private applyHeightOffset(tileset: Cesium3DTileset, heightOffset: number) {
    const nextOffset = Number.isFinite(heightOffset) ? heightOffset : 0;
    const placed = tileset as TilesetWithHeightOffset;
    const delta = nextOffset - (placed.__engineHeightOffset ?? 0);
    if (Math.abs(delta) < 0.01) return;
    const center = Cartographic.fromCartesian(tileset.boundingSphere.center);
    if (!center) return;
    const from = Cartesian3.fromRadians(center.longitude, center.latitude, center.height);
    const to = Cartesian3.fromRadians(center.longitude, center.latitude, center.height + delta);
    const translation = Cartesian3.subtract(to, from, new Cartesian3());
    tileset.modelMatrix = Matrix4.multiply(
      Matrix4.fromTranslation(translation),
      tileset.modelMatrix,
      new Matrix4(),
    );
    placed.__engineHeightOffset = nextOffset;
  }
}
