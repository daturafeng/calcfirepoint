import {
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  Matrix4,
  Rectangle,
  Viewer,
} from 'cesium';
import {
  type CesiumTilesetFormat,
  isTerraGsTilesetUrl,
  loadCesiumTileset,
} from './terraGsTileset';

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
  format?: CesiumTilesetFormat;
  maximumSplatCount?: number;
  heightOffset?: number;
  useBrowserRecommendedResolution?: boolean;
  depthTestAgainstTerrain?: boolean;
  /** 是否允许地图根据实时帧率降低画布分辨率；明确质量方案默认关闭。 */
  adaptiveResolution?: boolean;
  focusBbox?: [number, number, number, number];
}

type CesiumTilesetOverlayEntry = {
  overlay: CesiumTilesetOverlayConfig;
  /** 仅包含必须在构造阶段传给 Cesium 的参数。 */
  constructorSignature: string;
  isTerraGs: boolean;
  tileset?: Cesium3DTileset;
  loadingPromise?: Promise<void>;
};

type CesiumTilesetWithDockOffset = Cesium3DTileset & {
  __dockAppliedHeightOffset?: number;
};

export interface CesiumTilesetOverlayFocusOptions {
  duration?: number;
}

export class CesiumTilesetOverlayManager {
  private readonly viewer: Viewer;

  private readonly entryMap: Record<string, CesiumTilesetOverlayEntry> = {};

  private readonly pendingFocusIds = new Set<string>();

  private readonly errorReportedIds = new Set<string>();

  private readonly onLoadError?: (overlayId: string, error: unknown) => void;

  private destroyed = false;

  constructor(
    viewer: Viewer,
    onLoadError?: (overlayId: string, error: unknown) => void,
  ) {
    this.viewer = viewer;
    this.onLoadError = onLoadError;
  }

  sync(overlays: CesiumTilesetOverlayConfig[]) {
    if (this.destroyed || this.viewer.isDestroyed()) {
      return;
    }

    const desiredIds = new Set(overlays.map((item) => item.id));
    Object.keys(this.entryMap).forEach((id) => {
      if (!desiredIds.has(id)) {
        this.removeEntry(id);
      }
    });

    overlays.forEach((overlay) => {
      const constructorSignature = this.createConstructorSignature(overlay);
      const currentEntry = this.entryMap[overlay.id];
      if (
        currentEntry &&
        currentEntry.constructorSignature === constructorSignature
      ) {
        currentEntry.overlay = overlay;
        if (currentEntry.tileset && !currentEntry.tileset.isDestroyed()) {
          currentEntry.tileset.show = true;
          if (!currentEntry.isTerraGs) {
            this.applyHeightOffset(
              currentEntry.tileset,
              overlay.heightOffset ?? 0,
            );
          }
        } else if (!currentEntry.loadingPromise) {
          this.startLoading(currentEntry);
        }
        return;
      }

      // 构造参数变化（包括同 URL 的加载策略变化）必须创建新 entry。
      // 异步回调通过 entry identity 校验，旧请求即使稍后完成也不会挂入场景。
      if (currentEntry) {
        this.removeEntry(overlay.id);
      }

      const entry: CesiumTilesetOverlayEntry = {
        overlay,
        constructorSignature,
        isTerraGs: isTerraGsTilesetUrl(overlay.url, overlay.format ?? 'auto'),
      };
      this.entryMap[overlay.id] = entry;
      this.errorReportedIds.delete(overlay.id);
      this.startLoading(entry);
    });
  }

  private startLoading(entry: CesiumTilesetOverlayEntry) {
    const overlay = entry.overlay;
    this.errorReportedIds.delete(overlay.id);
    const maximumScreenSpaceError =
      overlay.maximumScreenSpaceError ?? (entry.isTerraGs ? 4 : 2);
    const skipLevelOfDetail =
      overlay.skipLevelOfDetail ?? (entry.isTerraGs ? true : false);
    const loadingPromise = loadCesiumTileset(overlay.url, {
      format: overlay.format ?? 'auto',
      maximumSplatCount: overlay.maximumSplatCount,
      heightOffset: entry.isTerraGs ? overlay.heightOffset : undefined,
      maximumScreenSpaceError,
      dynamicScreenSpaceError: overlay.dynamicScreenSpaceError ?? false,
      skipLevelOfDetail,
      baseScreenSpaceError: entry.isTerraGs ? 1024 : undefined,
      skipScreenSpaceErrorFactor: entry.isTerraGs ? 16 : undefined,
      skipLevels: entry.isTerraGs ? 1 : undefined,
      immediatelyLoadDesiredLevelOfDetail:
        overlay.immediatelyLoadDesiredLevelOfDetail ?? true,
      loadSiblings: overlay.loadSiblings ?? !entry.isTerraGs,
      cullRequestsWhileMoving: overlay.cullRequestsWhileMoving ?? false,
      cullWithChildrenBounds: entry.isTerraGs ? true : undefined,
      foveatedScreenSpaceError: overlay.foveatedScreenSpaceError ?? false,
      cacheBytes:
        overlay.cacheBytes ?? (entry.isTerraGs ? 2 ** 31 : 512 * 1024 * 1024),
      maximumCacheOverflowBytes:
        overlay.maximumCacheOverflowBytes ??
        (entry.isTerraGs ? 2 ** 31 : 1024 * 1024 * 1024),
    })
        .then((nextTileset) => {
          if (this.destroyed || this.viewer.isDestroyed()) {
            if (!nextTileset.isDestroyed()) {
              nextTileset.destroy();
            }
            return;
          }

          if (this.entryMap[overlay.id] !== entry) {
            if (!nextTileset.isDestroyed()) {
              nextTileset.destroy();
            }
            return;
          }

          nextTileset.tileFailed.addEventListener((error) => {
            // eslint-disable-next-line no-console
            console.warn(
              '[CesiumTilesetOverlayManager] 3D Tiles 局部瓦片加载失败',
              {
                overlayId: overlay.id,
                url: overlay.url,
                error,
              },
            );
          });

          nextTileset.show = true;
          if (!entry.isTerraGs) {
            this.applyHeightOffset(nextTileset, overlay.heightOffset ?? 0);
          }
          entry.tileset = this.viewer.scene.primitives.add(nextTileset);
          this.viewer.scene.requestRender();

          if (this.pendingFocusIds.has(overlay.id)) {
            this.pendingFocusIds.delete(overlay.id);
            this.focusEntry(entry, 0.75);
          }
        })
        .catch((error) => {
          if (this.entryMap[overlay.id] !== entry || this.destroyed) {
            return;
          }
          // eslint-disable-next-line no-console
          console.error('[CesiumTilesetOverlayManager] 3D Tiles 初始化失败', {
            overlayId: overlay.id,
            url: overlay.url,
            error,
          });
          this.reportLoadError(overlay.id, error);
        })
        .finally(() => {
          if (
            this.entryMap[overlay.id] === entry &&
            entry.loadingPromise === loadingPromise
          ) {
            entry.loadingPromise = undefined;
          }
        });
    entry.loadingPromise = loadingPromise;
  }

  focus(overlayId: string, options?: CesiumTilesetOverlayFocusOptions) {
    if (this.destroyed || this.viewer.isDestroyed() || !overlayId) {
      return;
    }

    const entry = this.entryMap[overlayId];
    if (entry?.tileset && !entry.tileset.isDestroyed()) {
      this.focusEntry(entry, options?.duration ?? 0.75);
      return;
    }

    this.pendingFocusIds.add(overlayId);
  }

  hasVisibleTerraGs(options?: { adaptiveOnly?: boolean }) {
    return Object.values(this.entryMap).some(
      (entry) =>
        entry.isTerraGs &&
        (!options?.adaptiveOnly || entry.overlay.adaptiveResolution === true) &&
        entry.tileset &&
        !entry.tileset.isDestroyed() &&
        entry.tileset.show &&
        (
          entry.tileset.root as typeof entry.tileset.root & {
            isVisible?: boolean;
          }
        )?.isVisible === true,
    );
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    Object.keys(this.entryMap).forEach((id) => {
      this.removeEntry(id);
    });
    this.pendingFocusIds.clear();
    this.errorReportedIds.clear();
  }

  private removeEntry(id: string) {
    const entry = this.entryMap[id];
    if (!entry) {
      return;
    }
    if (entry.tileset && !entry.tileset.isDestroyed()) {
      this.detachTileset(entry.tileset);
    }
    delete this.entryMap[id];
    this.errorReportedIds.delete(id);
  }

  private reportLoadError(overlayId: string, error: unknown) {
    if (this.errorReportedIds.has(overlayId)) {
      return;
    }
    this.errorReportedIds.add(overlayId);
    this.onLoadError?.(overlayId, error);
  }

  private focusEntry(entry: CesiumTilesetOverlayEntry, duration: number) {
    if (!entry.tileset || entry.tileset.isDestroyed()) return;
    const bbox = entry.overlay.focusBbox;
    if (
      bbox &&
      bbox.length === 4 &&
      bbox.every((value) => Number.isFinite(value))
    ) {
      this.viewer.camera.flyTo({
        destination: Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
        duration,
      });
      return;
    }
    void this.viewer.flyTo(entry.tileset, { duration });
  }

  private createConstructorSignature(overlay: CesiumTilesetOverlayConfig) {
    const isTerraGs = isTerraGsTilesetUrl(
      overlay.url,
      overlay.format ?? 'auto',
    );
    return JSON.stringify({
      url: overlay.url,
      format: overlay.format ?? 'auto',
      maximumSplatCount: isTerraGs
        ? overlay.maximumSplatCount ?? 6_000_000
        : undefined,
      heightOffset: isTerraGs ? overlay.heightOffset ?? 0 : undefined,
      maximumScreenSpaceError:
        overlay.maximumScreenSpaceError ?? (isTerraGs ? 4 : 2),
      dynamicScreenSpaceError: overlay.dynamicScreenSpaceError ?? false,
      skipLevelOfDetail: overlay.skipLevelOfDetail ?? isTerraGs,
      immediatelyLoadDesiredLevelOfDetail:
        overlay.immediatelyLoadDesiredLevelOfDetail ?? true,
      loadSiblings: overlay.loadSiblings ?? !isTerraGs,
      cullRequestsWhileMoving: overlay.cullRequestsWhileMoving ?? false,
      foveatedScreenSpaceError: overlay.foveatedScreenSpaceError ?? false,
      cacheBytes:
        overlay.cacheBytes ??
        (isTerraGs ? 2 ** 31 : 512 * 1024 * 1024),
      maximumCacheOverflowBytes:
        overlay.maximumCacheOverflowBytes ??
        (isTerraGs ? 2 ** 31 : 1024 * 1024 * 1024),
    });
  }

  private detachTileset(tileset: Cesium3DTileset) {
    if (this.viewer.isDestroyed()) {
      if (!tileset.isDestroyed()) {
        tileset.destroy();
      }
      return;
    }
    const removed = this.viewer.scene.primitives.remove(tileset);
    if (!removed && !tileset.isDestroyed()) {
      tileset.destroy();
    }
  }

  private applyHeightOffset(tileset: Cesium3DTileset, heightOffset: number) {
    const nextHeightOffset = Number.isFinite(heightOffset) ? heightOffset : 0;
    const placedTileset = tileset as CesiumTilesetWithDockOffset;
    const currentHeightOffset = placedTileset.__dockAppliedHeightOffset ?? 0;
    const deltaHeight = nextHeightOffset - currentHeightOffset;
    if (Math.abs(deltaHeight) < 0.01) {
      return;
    }

    const centerCartographic = Cartographic.fromCartesian(
      tileset.boundingSphere.center,
    );
    if (!centerCartographic) {
      return;
    }

    const fromPosition = Cartesian3.fromRadians(
      centerCartographic.longitude,
      centerCartographic.latitude,
      centerCartographic.height,
    );
    const toPosition = Cartesian3.fromRadians(
      centerCartographic.longitude,
      centerCartographic.latitude,
      centerCartographic.height + deltaHeight,
    );
    const translation = Cartesian3.subtract(
      toPosition,
      fromPosition,
      new Cartesian3(),
    );
    const translationMatrix = Matrix4.fromTranslation(translation);
    tileset.modelMatrix = Matrix4.multiply(
      translationMatrix,
      tileset.modelMatrix,
      new Matrix4(),
    );
    placedTileset.__dockAppliedHeightOffset = nextHeightOffset;
  }
}
