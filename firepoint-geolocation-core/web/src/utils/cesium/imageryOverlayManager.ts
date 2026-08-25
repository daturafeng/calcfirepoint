import {
  Color,
  Entity,
  HeadingPitchRange,
  ImageryLayer,
  Rectangle,
  Viewer,
} from 'cesium';

import { createConfiguredImageryProvider } from './imagery';

export interface CesiumImageryOverlayConfig {
  id: string;
  url: string;
  providerType?: string;
  providerOptions?: Record<string, unknown>;
  minimumLevel?: number;
  maximumLevel?: number;
  alpha?: number;
  brightness?: number;
  contrast?: number;
  hue?: number;
  saturation?: number;
  gamma?: number;
  focusBbox?: [number, number, number, number];
  focusEntityId?: string;
  focusRange?: number;
}

type ImageryOverlayEntry = {
  overlay: CesiumImageryOverlayConfig;
  layer?: ImageryLayer;
  rectangle?: Rectangle;
  loadingPromise?: Promise<void>;
  abortController?: AbortController;
  focusEntity?: Entity;
  focusEntityPromise?: Promise<void>;
};

export interface CesiumImageryOverlayFocusOptions {
  duration?: number;
}

const DIRECTORY_LINK_RE = /href="([^"]+)"/gi;
const TILE_TEMPLATE_SEGMENT = '/{z}/{x}/{y}';

function tileXToLongitude(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}

function tileYToLatitude(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function extractHrefNames(html: string) {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = DIRECTORY_LINK_RE.exec(html))) {
    const href = match[1];
    if (href === '../') {
      continue;
    }
    names.push(href);
  }
  return names;
}

async function readDirectoryListing(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`目录读取失败: ${url}`);
  }
  return response.text();
}

async function readNumericDirectoryNames(url: string, signal?: AbortSignal) {
  const html = await readDirectoryListing(url, signal);
  const names = extractHrefNames(html);
  return names
    .filter((name) => name.endsWith('/'))
    .map((name) => Number(name.split('/').join('')))
    .filter((value) => Number.isFinite(value));
}

async function readNumericFileNames(url: string, signal?: AbortSignal) {
  const html = await readDirectoryListing(url, signal);
  const names = extractHrefNames(html);
  return names
    .map((name) => Number(name.replace(/\.[^.]+$/, '')))
    .filter((value) => Number.isFinite(value));
}

function resolveTileRootUrl(url: string) {
  const markerIndex = url.indexOf(TILE_TEMPLATE_SEGMENT);
  if (markerIndex < 0) {
    return undefined;
  }
  return url.slice(0, markerIndex + 1);
}

async function resolveImageryRectangleFromTemplateUrl(
  url: string,
  signal?: AbortSignal,
) {
  const rootUrl = resolveTileRootUrl(url);
  if (!rootUrl) {
    return undefined;
  }

  const zoomLevels = await readNumericDirectoryNames(rootUrl, signal);
  if (!zoomLevels.length) {
    return undefined;
  }

  const level = Math.min(...zoomLevels);
  const xValues = await readNumericDirectoryNames(
    `${rootUrl}${level}/`,
    signal,
  );
  if (!xValues.length) {
    return undefined;
  }

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const xValue of xValues) {
    const yValues = await readNumericFileNames(
      `${rootUrl}${level}/${xValue}/`,
      signal,
    );
    if (!yValues.length) {
      continue;
    }
    minY = Math.min(minY, ...yValues);
    maxY = Math.max(maxY, ...yValues);
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return undefined;
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  return Rectangle.fromDegrees(
    tileXToLongitude(minX, level),
    tileYToLatitude(maxY + 1, level),
    tileXToLongitude(maxX + 1, level),
    tileYToLatitude(minY, level),
  );
}

export class CesiumImageryOverlayManager {
  private readonly viewer: Viewer;

  private readonly getEntityById?: (entityId: string) => Entity | undefined;

  private readonly entryMap: Record<string, ImageryOverlayEntry> = {};

  private readonly pendingFocusIds = new Set<string>();

  private readonly errorReportedIds = new Set<string>();

  private readonly tileWarningReportedIds = new Set<string>();

  private readonly onLoadError?: (overlayId: string, error: unknown) => void;

  private desiredOrder: string[] = [];

  private destroyed = false;

  constructor(
    viewer: Viewer,
    getEntityById?: (entityId: string) => Entity | undefined,
    onLoadError?: (overlayId: string, error: unknown) => void,
  ) {
    this.viewer = viewer;
    this.getEntityById = getEntityById;
    this.onLoadError = onLoadError;
  }

  sync(overlays: CesiumImageryOverlayConfig[]) {
    if (this.destroyed || this.viewer.isDestroyed()) {
      return;
    }

    const desiredIds = new Set(overlays.map((item) => item.id));
    this.desiredOrder = overlays.map((item) => item.id);
    Object.keys(this.entryMap).forEach((id) => {
      if (!desiredIds.has(id)) {
        this.removeEntry(id);
      }
    });

    overlays.forEach((overlay) => {
      const currentEntry = this.entryMap[overlay.id];
      const minimumLevel = overlay.minimumLevel ?? 0;
      const maxLevel =
        overlay.maximumLevel ??
        (overlay.providerType === undefined || overlay.providerType === 'xyz'
          ? 20
          : undefined);
      const alpha = overlay.alpha ?? 1;
      const focusBboxSignature = JSON.stringify(overlay.focusBbox ?? null);
      const providerSignature = JSON.stringify({
        providerType: overlay.providerType ?? 'xyz',
        providerOptions: overlay.providerOptions ?? {},
      });
      if (
        currentEntry &&
        currentEntry.overlay.url === overlay.url &&
        (currentEntry.overlay.minimumLevel ?? 0) === minimumLevel &&
        (currentEntry.overlay.maximumLevel ??
          (currentEntry.overlay.providerType === undefined ||
          currentEntry.overlay.providerType === 'xyz'
            ? 20
            : undefined)) === maxLevel &&
        (currentEntry.overlay.alpha ?? 1) === alpha &&
        JSON.stringify(currentEntry.overlay.focusBbox ?? null) ===
          focusBboxSignature &&
        JSON.stringify({
          providerType: currentEntry.overlay.providerType ?? 'xyz',
          providerOptions: currentEntry.overlay.providerOptions ?? {},
        }) === providerSignature
      ) {
        currentEntry.overlay = overlay;
        if (currentEntry.layer) {
          this.applyPresentation(currentEntry.layer, overlay);
          this.ensureFocusEntity(overlay.id, currentEntry);
        }
        return;
      }

      if (currentEntry) {
        this.removeEntry(overlay.id);
      }

      const abortController = new AbortController();
      const entry: ImageryOverlayEntry = {
        overlay,
        abortController,
      };
      this.entryMap[overlay.id] = entry;

      const loadingPromise = this.resolveOverlayRectangle(
        overlay,
        abortController.signal,
      )
        .then((rectangle) => {
          if (
            this.destroyed ||
            this.viewer.isDestroyed() ||
            this.entryMap[overlay.id] !== entry
          ) {
            return;
          }
          if (
            minimumLevel > 0 &&
            !rectangle &&
            (overlay.providerType === undefined ||
              overlay.providerType === 'xyz')
          ) {
            throw new Error('局部影像目录中未解析到有效瓦片范围');
          }

          const provider = createConfiguredImageryProvider({
            url: overlay.url,
            providerType: overlay.providerType ?? 'xyz',
            loadOptions: {
              ...overlay.providerOptions,
              minimumLevel,
              maximumLevel: maxLevel,
            },
            rectangle,
          });
          provider.errorEvent.addEventListener((error) => {
            if (
              this.entryMap[overlay.id] === entry &&
              !this.tileWarningReportedIds.has(overlay.id)
            ) {
              this.tileWarningReportedIds.add(overlay.id);
              // 局部稀疏影像边缘允许缺少单个瓦片，不能据此判定整层加载失败。
              // eslint-disable-next-line no-console
              console.warn(
                '[CesiumImageryOverlayManager] 局部影像存在缺失瓦片，已跳过该瓦片',
                {
                  overlayId: overlay.id,
                  url: overlay.url,
                  error,
                },
              );
            }
          });
          const layer = this.viewer.imageryLayers.addImageryProvider(provider);
          if (
            this.destroyed ||
            this.viewer.isDestroyed() ||
            this.entryMap[overlay.id] !== entry
          ) {
            this.detachLayer(layer);
            return;
          }
          this.applyPresentation(layer, overlay);
          entry.layer = layer;
          entry.rectangle = rectangle;
          this.reorderLayers();
          this.ensureFocusEntity(overlay.id, entry);

          if (this.pendingFocusIds.has(overlay.id)) {
            this.focusEntry(entry, 0.75);
          }
        })
        .catch((error) => {
          if (
            abortController.signal.aborted ||
            this.destroyed ||
            this.entryMap[overlay.id] !== entry
          ) {
            return;
          }
          // 单条资源失败不得阻断同一场景内的其他影像资源。
          // eslint-disable-next-line no-console
          console.error('[CesiumImageryOverlayManager] 影像资源加载失败', {
            overlayId: overlay.id,
            url: overlay.url,
            error,
          });
          this.reportLoadError(overlay.id, error);
        })
        .finally(() => {
          if (this.entryMap[overlay.id] === entry) {
            entry.loadingPromise = undefined;
            entry.abortController = undefined;
          }
        });

      entry.loadingPromise = loadingPromise;
    });
  }

  focus(overlayId: string, options?: CesiumImageryOverlayFocusOptions) {
    if (this.destroyed || this.viewer.isDestroyed() || !overlayId) {
      return;
    }

    const entry = this.entryMap[overlayId];
    if (entry) {
      if (entry.loadingPromise) {
        this.pendingFocusIds.add(overlayId);
        return;
      }
      this.focusEntry(entry, options?.duration ?? 0.75);
      return;
    }

    this.pendingFocusIds.add(overlayId);
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
    this.tileWarningReportedIds.clear();
    this.desiredOrder = [];
  }

  private removeEntry(id: string) {
    const entry = this.entryMap[id];
    if (!entry) {
      return;
    }
    entry.abortController?.abort();
    this.detachFocusEntity(entry.focusEntity);
    this.detachLayer(entry.layer);
    delete this.entryMap[id];
    this.pendingFocusIds.delete(id);
    this.errorReportedIds.delete(id);
    this.tileWarningReportedIds.delete(id);
  }

  private reportLoadError(overlayId: string, error: unknown) {
    if (this.errorReportedIds.has(overlayId)) {
      return;
    }
    this.errorReportedIds.add(overlayId);
    this.onLoadError?.(overlayId, error);
  }

  /**
   * 影像范围解析是异步的，不能用完成先后决定 Cesium 图层顺序。
   * 每次有图层就绪后按服务端 sortOrder 对应的 sync 入参顺序重新排列。
   */
  private reorderLayers() {
    if (this.viewer.isDestroyed()) return;
    this.desiredOrder.forEach((id) => {
      const layer = this.entryMap[id]?.layer;
      if (layer) this.viewer.imageryLayers.raiseToTop(layer);
    });
  }

  private detachLayer(layer?: ImageryLayer) {
    if (!layer || this.viewer.isDestroyed()) {
      return;
    }
    this.viewer.imageryLayers.remove(layer, true);
  }

  private applyPresentation(
    layer: ImageryLayer,
    overlay: CesiumImageryOverlayConfig,
  ) {
    layer.alpha = overlay.alpha ?? 1;
    layer.brightness = overlay.brightness ?? 1;
    layer.contrast = overlay.contrast ?? 1;
    layer.hue = overlay.hue ?? 0;
    layer.saturation = overlay.saturation ?? 1;
    layer.gamma = overlay.gamma ?? 1;
    this.viewer.scene.requestRender();
  }

  private focusEntry(entry: ImageryOverlayEntry, duration: number) {
    if (!entry.layer) {
      this.pendingFocusIds.add(entry.overlay.id);
      return;
    }
    if (entry.focusEntity) {
      void this.viewer.flyTo(entry.focusEntity, {
        duration,
      });
      this.pendingFocusIds.delete(entry.overlay.id);
      return;
    }

    if (entry.focusEntityPromise) {
      this.pendingFocusIds.add(entry.overlay.id);
      return;
    }

    const focusEntityId = entry.overlay.focusEntityId;
    if (focusEntityId) {
      const entity = this.getEntityById?.(focusEntityId);
      if (entity) {
        void this.viewer.flyTo(entity, {
          duration,
          offset: new HeadingPitchRange(
            0,
            -0.62,
            entry.overlay.focusRange ?? 2500,
          ),
        });
        return;
      }
    }

    void this.viewer.flyTo(entry.layer, {
      duration,
    });
    this.pendingFocusIds.delete(entry.overlay.id);
  }

  private ensureFocusEntity(overlayId: string, entry: ImageryOverlayEntry) {
    if (!entry.layer || entry.focusEntity || entry.focusEntityPromise) {
      return;
    }

    const focusEntityPromise = this.createFocusEntity(
      entry.overlay,
      entry.rectangle,
    )
      .then((focusEntity) => {
        const latestEntry = this.entryMap[overlayId];
        if (latestEntry !== entry) {
          this.detachFocusEntity(focusEntity);
          return;
        }

        latestEntry.focusEntity = focusEntity;
        this.viewer.scene.requestRender();
      })
      .catch(() => {})
      .finally(() => {
        const latestEntry = this.entryMap[overlayId];
        if (latestEntry?.focusEntityPromise === focusEntityPromise) {
          latestEntry.focusEntityPromise = undefined;
        }
        if (latestEntry && this.pendingFocusIds.has(overlayId)) {
          this.focusEntry(latestEntry, 0.75);
        }
      });

    entry.focusEntityPromise = focusEntityPromise;
  }

  private async createFocusEntity(
    overlay: CesiumImageryOverlayConfig,
    resolvedRectangle?: Rectangle,
  ) {
    const rectangle =
      resolvedRectangle ||
      (await resolveImageryRectangleFromTemplateUrl(overlay.url));
    if (!rectangle || this.destroyed || this.viewer.isDestroyed()) {
      return undefined;
    }

    return this.viewer.entities.add({
      id: `imagery-overlay-focus-${overlay.id}`,
      rectangle: {
        coordinates: rectangle,
        material: Color.WHITE.withAlpha(0.001),
        outline: false,
      },
    });
  }

  private detachFocusEntity(entity?: Entity) {
    if (!entity || this.viewer.isDestroyed()) {
      return;
    }
    this.viewer.entities.remove(entity);
  }

  private resolveOverlayRectangle(
    overlay: CesiumImageryOverlayConfig,
    signal: AbortSignal,
  ) {
    const bbox = overlay.focusBbox;
    if (
      bbox &&
      bbox.length === 4 &&
      bbox.every((value) => Number.isFinite(value))
    ) {
      return Promise.resolve(
        Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
      );
    }
    if (overlay.providerType && overlay.providerType !== 'xyz') {
      return Promise.resolve<Rectangle | undefined>(undefined);
    }
    if ((overlay.minimumLevel ?? 0) <= 0) {
      return Promise.resolve<Rectangle | undefined>(undefined);
    }
    return resolveImageryRectangleFromTemplateUrl(overlay.url, signal);
  }
}
