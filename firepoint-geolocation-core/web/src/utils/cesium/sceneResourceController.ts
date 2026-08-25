import { LOCAL_STORAGE_KEYS } from '@/constants/auth';
import {
  getGisRuntimeScene,
  type GisRuntimeLayer,
  type GisRuntimeOverlayGroup,
  type GisRuntimeSceneSnapshot,
} from '@/services/cloud/gisRuntimeScenes';
import {
  getMapSceneKey,
  type MapScenePageKey,
} from '@/services/cloud/mapSceneRegistry';
import {
  CesiumTerrainProvider,
  Color,
  EllipsoidTerrainProvider,
  GeoJsonDataSource,
  ImageryLayer,
  Rectangle,
  Terrain,
  type Viewer,
} from 'cesium';

import { createConfiguredImageryProvider } from './imagery';
import { CesiumImageryOverlayManager } from './imageryOverlayManager';
import {
  toCesiumImageryOverlay,
  toCesiumTilesetOverlay,
  type MapLayerDescriptor,
} from './mapLayerDescriptor';
import { CesiumTilesetOverlayManager } from './tilesetOverlayManager';

export type SceneResourceLoadErrorType =
  | 'scene'
  | 'imagery'
  | 'geojson'
  | '3dtileset'
  | 'terrain';

export interface SceneLayerToolOption {
  id: string;
  name: string;
  thumbnailUrl?: string;
  presentationMode: GisRuntimeLayer['presentationMode'];
  selectable: boolean;
}

export interface SceneOverlayGroupState {
  groupKey: string;
  name: string;
  selectionMode: 'single' | 'multiple';
  layers: SceneLayerToolOption[];
  activeLayerIds: string[];
}

export interface SceneResourceLayerState {
  sceneKey: string;
  configVersion: string;
  baseMaps: SceneLayerToolOption[];
  activeBaseMapId?: string;
  terrains: SceneLayerToolOption[];
  activeTerrainId?: string;
  terrainEnabled: boolean;
  models3d: SceneLayerToolOption[];
  activeModel3dIds: string[];
  overlayGroups: SceneOverlayGroupState[];
}

export interface CesiumSceneResourceController {
  reload: (force?: boolean) => Promise<void>;
  selectBaseMap: (layerId: string) => void;
  selectTerrain: (layerId: string) => void;
  setTerrainEnabled: (enabled: boolean) => void;
  setModel3dEnabled: (layerId: string, enabled: boolean) => void;
  setOverlayEnabled: (
    groupKey: string,
    layerId: string,
    enabled: boolean,
  ) => void;
  getLayerState: () => SceneResourceLayerState;
  destroy: () => void;
}

export interface CesiumSceneResourceControllerOptions {
  onLayerStateChange?: (state: SceneResourceLayerState) => void;
}

const EMPTY_LAYER_STATE: SceneResourceLayerState = {
  sceneKey: '',
  configVersion: '',
  baseMaps: [],
  terrains: [],
  terrainEnabled: false,
  models3d: [],
  activeModel3dIds: [],
  overlayGroups: [],
};

interface SceneLayerPreference {
  configVersion: string;
  updatedAt: number;
  activeBaseMapId?: string;
  activeTerrainId?: string;
  terrainEnabled: boolean;
  activeModel3dIds: string[];
  knownModel3dIds: string[];
  overlayGroups: Record<
    string,
    { activeLayerIds: string[]; knownLayerIds: string[] }
  >;
}

const PREFERENCE_KEY_PREFIX = 'dock:scene-layer-preference';

function preferencePrefix(sceneKey: string) {
  const userId =
    localStorage.getItem(LOCAL_STORAGE_KEYS.userId) ||
    localStorage.getItem(LOCAL_STORAGE_KEYS.username) ||
    'anonymous';
  return `${PREFERENCE_KEY_PREFIX}:${encodeURIComponent(
    userId,
  )}:${encodeURIComponent(sceneKey)}:`;
}

function readLatestPreference(sceneKey: string) {
  if (typeof localStorage === 'undefined') return undefined;
  const prefix = preferencePrefix(sceneKey);
  const preferences: SceneLayerPreference[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value && typeof value === 'object') {
        preferences.push(value as SceneLayerPreference);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
  return preferences.sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function clearPreferences(sceneKey: string) {
  if (typeof localStorage === 'undefined') return;
  const prefix = preferencePrefix(sceneKey);
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function toolOption(layer: GisRuntimeLayer): SceneLayerToolOption {
  return {
    id: layer.layerId,
    name: layer.name,
    thumbnailUrl: layer.thumbnailUrl,
    presentationMode: layer.presentationMode,
    selectable: layer.selectable,
  };
}

function descriptor(layer: GisRuntimeLayer): MapLayerDescriptor {
  const spatialExtent = layer.resource.spatialExtent;
  const rawBbox = Array.isArray(spatialExtent)
    ? spatialExtent
    : spatialExtent && typeof spatialExtent === 'object'
    ? (spatialExtent as { bbox?: unknown }).bbox
    : undefined;
  const bboxValues =
    Array.isArray(rawBbox) && [4, 6].includes(rawBbox.length)
      ? rawBbox.length === 6
        ? [rawBbox[0], rawBbox[1], rawBbox[3], rawBbox[4]]
        : rawBbox.slice(0, 4)
      : [];
  const bbox =
    bboxValues.length === 4 &&
    bboxValues.every((value) => Number.isFinite(Number(value)))
      ? (bboxValues.map(Number) as [number, number, number, number])
      : undefined;
  return {
    id: layer.layerId,
    sourceDomain: 'gis',
    layerType: layer.resource.resourceType,
    providerType: layer.resource.providerType,
    url: layer.resource.url,
    name: layer.name,
    opacity: layer.opacity,
    loadOptions: { ...layer.resource.loadOptions },
    focus: bbox ? { bbox } : undefined,
  };
}

const PRESENTATION_OPTION_KEYS = [
  'brightness',
  'contrast',
  'hue',
  'saturation',
  'gamma',
] as const;

type PresentationOptionKey = (typeof PRESENTATION_OPTION_KEYS)[number];
type ImageryPresentationOptions = Record<PresentationOptionKey, number>;

function presentationOptions(layer: GisRuntimeLayer) {
  return Object.fromEntries(
    PRESENTATION_OPTION_KEYS.flatMap((key) => {
      const value = layer.renderOptions[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? [[key, value]]
        : [];
    }),
  ) as Partial<ImageryPresentationOptions>;
}

function imageryPresentationOptions(
  layer: GisRuntimeLayer,
): ImageryPresentationOptions {
  const options = presentationOptions(layer);
  const darkTone = layer.presentationMode === 'darkTone';
  return {
    brightness: options.brightness ?? (darkTone ? 0.52 : 1),
    contrast: options.contrast ?? (darkTone ? 1.18 : 1),
    hue: options.hue ?? 0,
    saturation: options.saturation ?? (darkTone ? 0.72 : 1),
    gamma: options.gamma ?? (darkTone ? 0.88 : 1),
  };
}

function configuredLayers(layers: GisRuntimeLayer[]) {
  return layers.filter((layer) => layer.showInLayerTool);
}

function numberOption(options: Record<string, unknown>, key: string) {
  const value = options[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanOption(options: Record<string, unknown>, key: string) {
  const value = options[key];
  return typeof value === 'boolean' ? value : undefined;
}

function colorOption(options: Record<string, unknown>, key: string) {
  const value = options[key];
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return Color.fromCssColorString(value.trim());
}

function geoJsonPresentationOptions(layer: GisRuntimeLayer) {
  const options = layer.resource.loadOptions;
  const strokeWidth = numberOption(options, 'strokeWidth');
  return {
    clampToGround: booleanOption(options, 'clampToGround') ?? false,
    stroke: colorOption(options, 'stroke'),
    fill: colorOption(options, 'fill'),
    strokeWidth:
      strokeWidth !== undefined && strokeWidth >= 0 ? strokeWidth : undefined,
  };
}

function normalizeTerrainRootUrl(url: string) {
  const normalized = url.trim();
  const match = normalized.match(/^(.*\/)layer\.json([?#].*)?$/i);
  return match ? `${match[1]}${match[2] ?? ''}` : normalized;
}

function initialOverlaySelection(group: GisRuntimeOverlayGroup) {
  const selected = group.layers
    .filter((layer) => layer.visibleByDefault)
    .map((layer) => layer.layerId);
  return group.exclusive ? selected.slice(0, 1) : selected;
}

export function createSceneResourceController(
  viewer: Viewer,
  pageKey: MapScenePageKey,
  onError?: (
    resourceType: SceneResourceLoadErrorType,
    resourceId: string,
    error: unknown,
  ) => void,
  options: CesiumSceneResourceControllerOptions = {},
): CesiumSceneResourceController {
  const sceneKey = getMapSceneKey(pageKey);
  let destroyed = false;
  let generation = 0;
  let terrainGeneration = 0;
  let geoJsonGeneration = 0;
  let snapshot: GisRuntimeSceneSnapshot | undefined;
  let activeBaseMapId: string | undefined;
  let activeTerrainId: string | undefined;
  let terrainEnabled = false;
  let activeModel3dIds = new Set<string>();
  let activeOverlayIds = new Map<string, Set<string>>();
  let geoJsonDataSources: GeoJsonDataSource[] = [];
  let baseImageryLayer: ImageryLayer | undefined;
  let baseImagerySignature = '';

  const persistPreference = () => {
    if (!snapshot || typeof localStorage === 'undefined') return;
    const preference: SceneLayerPreference = {
      configVersion: snapshot.configVersion,
      updatedAt: Date.now(),
      activeBaseMapId,
      activeTerrainId,
      terrainEnabled,
      activeModel3dIds: [...activeModel3dIds],
      knownModel3dIds: snapshot.models3d.map((layer) => layer.layerId),
      overlayGroups: Object.fromEntries(
        snapshot.overlayGroups.map((group) => [
          group.groupKey,
          {
            activeLayerIds: [...(activeOverlayIds.get(group.groupKey) ?? [])],
            knownLayerIds: group.layers.map((layer) => layer.layerId),
          },
        ]),
      ),
    };
    const key = `${preferencePrefix(sceneKey)}${encodeURIComponent(
      snapshot.configVersion,
    )}`;
    clearPreferences(sceneKey);
    try {
      localStorage.setItem(key, JSON.stringify(preference));
    } catch {
      // 存储空间受限时不影响地图正常使用。
    }
  };

  const imageryManager = new CesiumImageryOverlayManager(
    viewer,
    () => undefined,
    (resourceId, error) => onError?.('imagery', resourceId, error),
  );
  const tilesetManager = new CesiumTilesetOverlayManager(
    viewer,
    (resourceId, error) => onError?.('3dtileset', resourceId, error),
  );

  const findLayer = (layers: GisRuntimeLayer[], layerId?: string) =>
    layerId ? layers.find((layer) => layer.layerId === layerId) : undefined;

  const getLayerState = (): SceneResourceLayerState => {
    if (!snapshot) return { ...EMPTY_LAYER_STATE, sceneKey };
    return {
      sceneKey,
      configVersion: snapshot.configVersion,
      baseMaps: configuredLayers(snapshot.baseMaps).map(toolOption),
      activeBaseMapId,
      terrains: configuredLayers(snapshot.terrains).map(toolOption),
      activeTerrainId,
      terrainEnabled: Boolean(activeTerrainId && terrainEnabled),
      models3d: configuredLayers(snapshot.models3d).map(toolOption),
      activeModel3dIds: [...activeModel3dIds],
      overlayGroups: snapshot.overlayGroups
        .map((group) => ({
          groupKey: group.groupKey,
          name: group.groupKey,
          selectionMode: group.exclusive
            ? ('single' as const)
            : ('multiple' as const),
          layers: configuredLayers(group.layers).map(toolOption),
          activeLayerIds: [...(activeOverlayIds.get(group.groupKey) ?? [])],
        }))
        .filter((group) => group.layers.length > 0),
    };
  };

  const notify = () => options.onLayerStateChange?.(getLayerState());

  const clearGeoJson = () => {
    geoJsonGeneration += 1;
    const sources = geoJsonDataSources;
    geoJsonDataSources = [];
    if (viewer.isDestroyed()) return;
    sources.forEach((source) => viewer.dataSources.remove(source, true));
  };

  const activeOverlayLayers = () =>
    snapshot?.overlayGroups.flatMap((group) => {
      const selected = activeOverlayIds.get(group.groupKey) ?? new Set();
      return group.layers.filter((layer) => selected.has(layer.layerId));
    }) ?? [];

  const syncBaseMap = () => {
    const layer = snapshot && findLayer(snapshot.baseMaps, activeBaseMapId);
    if (!layer) return;
    if (layer.resource.resourceType !== 'imagery') {
      onError?.(
        'imagery',
        layer.layerId,
        new Error('基础底图资源类型必须为 imagery'),
      );
      return;
    }
    const layerDescriptor = descriptor(layer);
    const imagery = toCesiumImageryOverlay(layerDescriptor);
    const signature = JSON.stringify({
      ...imagery,
      presentationMode: layer.presentationMode,
      renderOptions: presentationOptions(layer),
    });
    if (baseImageryLayer && baseImagerySignature === signature) return;
    try {
      const provider = createConfiguredImageryProvider({
        url: imagery.url,
        providerType: layer.resource.providerType,
        loadOptions: layer.resource.loadOptions,
        rectangle: layerDescriptor.focus?.bbox
          ? Rectangle.fromDegrees(...layerDescriptor.focus.bbox)
          : undefined,
      });
      provider.errorEvent.addEventListener((error) => {
        // 局部瓦片错误只告警，不清空已成功显示的底图。
        // eslint-disable-next-line no-console
        console.warn('[地图配置] 基础底图存在局部瓦片失败', {
          layerId: layer.layerId,
          error,
        });
      });
      const next = viewer.imageryLayers.addImageryProvider(provider, 0);
      next.alpha = imagery.alpha ?? 1;
      const renderOptions = imageryPresentationOptions(layer);
      next.brightness = renderOptions.brightness;
      next.contrast = renderOptions.contrast;
      next.hue = renderOptions.hue;
      next.saturation = renderOptions.saturation;
      next.gamma = renderOptions.gamma;
      if (baseImageryLayer) viewer.imageryLayers.remove(baseImageryLayer, true);
      baseImageryLayer = next;
      baseImagerySignature = signature;
      viewer.scene.requestRender();
    } catch (error) {
      onError?.('imagery', layer.layerId, error);
    }
  };

  const applyTerrain = async () => {
    const currentGeneration = ++terrainGeneration;
    const layer =
      snapshot && terrainEnabled
        ? findLayer(snapshot.terrains, activeTerrainId)
        : undefined;
    const ellipsoid = () => {
      if (
        destroyed ||
        viewer.isDestroyed() ||
        currentGeneration !== terrainGeneration
      )
        return;
      viewer.scene.setTerrain(
        new Terrain(Promise.resolve(new EllipsoidTerrainProvider())),
      );
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.requestRender();
    };
    if (!layer) {
      ellipsoid();
      return;
    }
    if (
      layer.resource.resourceType !== 'terrain' ||
      layer.resource.providerType !== 'cesiumTerrain'
    ) {
      ellipsoid();
      onError?.(
        'terrain',
        layer.layerId,
        new Error('地形资源 Provider 配置不正确'),
      );
      return;
    }
    try {
      const loadOptions = descriptor(layer).loadOptions ?? {};
      const provider = await CesiumTerrainProvider.fromUrl(
        normalizeTerrainRootUrl(layer.resource.url),
        {
          requestVertexNormals:
            typeof loadOptions.requestVertexNormals === 'boolean'
              ? loadOptions.requestVertexNormals
              : undefined,
          requestWaterMask:
            typeof loadOptions.requestWaterMask === 'boolean'
              ? loadOptions.requestWaterMask
              : undefined,
        },
      );
      if (
        destroyed ||
        viewer.isDestroyed() ||
        currentGeneration !== terrainGeneration ||
        !terrainEnabled
      )
        return;
      provider.errorEvent.addEventListener((error) => {
        // eslint-disable-next-line no-console
        console.warn('[地图配置] 地形存在局部瓦片失败', {
          layerId: layer.layerId,
          error,
        });
      });
      viewer.scene.setTerrain(new Terrain(Promise.resolve(provider)));
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.requestRender();
    } catch (error) {
      ellipsoid();
      terrainEnabled = false;
      notify();
      onError?.('terrain', layer.layerId, error);
    }
  };

  const syncNonBaseLayers = (currentGeneration: number) => {
    if (!snapshot) return;
    const layers = [
      ...snapshot.models3d.filter((layer) =>
        activeModel3dIds.has(layer.layerId),
      ),
      ...activeOverlayLayers(),
    ];
    imageryManager.sync(
      layers
        .filter((layer) => layer.resource.resourceType === 'imagery')
        .map((layer) => ({
          ...toCesiumImageryOverlay(descriptor(layer)),
          ...imageryPresentationOptions(layer),
        })),
    );
    tilesetManager.sync(
      layers
        .filter((layer) => layer.resource.resourceType === '3dtileset')
        .map((layer) => toCesiumTilesetOverlay(descriptor(layer))),
    );
    clearGeoJson();
    const currentGeoJsonGeneration = geoJsonGeneration;
    const geoJsonLayers = layers
      .filter((layer) => layer.resource.resourceType === 'geojson')
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          (left.layerId === right.layerId
            ? 0
            : left.layerId < right.layerId
            ? -1
            : 1),
      );
    void (async () => {
      for (const layer of geoJsonLayers) {
        try {
          const source = await GeoJsonDataSource.load(
            layer.resource.url,
            geoJsonPresentationOptions(layer),
          );
          if (
            destroyed ||
            viewer.isDestroyed() ||
            generation !== currentGeneration ||
            geoJsonGeneration !== currentGeoJsonGeneration
          )
            return;
          await viewer.dataSources.add(source);
          if (
            destroyed ||
            viewer.isDestroyed() ||
            generation !== currentGeneration ||
            geoJsonGeneration !== currentGeoJsonGeneration
          ) {
            if (!viewer.isDestroyed()) viewer.dataSources.remove(source, true);
            return;
          }
          geoJsonDataSources.push(source);
        } catch (error) {
          if (
            !destroyed &&
            !viewer.isDestroyed() &&
            generation === currentGeneration &&
            geoJsonGeneration === currentGeoJsonGeneration
          ) {
            onError?.('geojson', layer.layerId, error);
          }
        }
      }
      if (!destroyed && !viewer.isDestroyed()) viewer.scene.requestRender();
    })();
  };

  const reconcileSelection = (next: GisRuntimeSceneSnapshot) => {
    const latestPreference = readLatestPreference(sceneKey);
    // 本地或字典配置版本变化后先采用新默认值；同一版本内恢复用户上次选择。
    const shouldResetPreference = Boolean(
      latestPreference && latestPreference.configVersion !== next.configVersion,
    );
    const preference = shouldResetPreference ? undefined : latestPreference;
    if (shouldResetPreference) clearPreferences(sceneKey);
    const baseIds = new Set(next.baseMaps.map((layer) => layer.layerId));
    activeBaseMapId =
      preference?.activeBaseMapId && baseIds.has(preference.activeBaseMapId)
        ? preference.activeBaseMapId
        : next.defaults.baseMapLayerId;
    const terrainIds = new Set(next.terrains.map((layer) => layer.layerId));
    activeTerrainId =
      preference?.activeTerrainId && terrainIds.has(preference.activeTerrainId)
        ? preference.activeTerrainId
        : next.defaults.terrainLayerId;
    terrainEnabled =
      (preference ? preference.terrainEnabled : next.defaults.terrainEnabled) &&
      Boolean(activeTerrainId);
    const knownModelIds = new Set(preference?.knownModel3dIds ?? []);
    const preferredModelIds = new Set(preference?.activeModel3dIds ?? []);
    activeModel3dIds = new Set(
      next.models3d
        .filter(
          (layer) =>
            preferredModelIds.has(layer.layerId) ||
            (!knownModelIds.has(layer.layerId) &&
              next.defaults.visibleModelLayerIds.includes(layer.layerId)),
        )
        .map((layer) => layer.layerId),
    );
    const nextOverlayIds = new Map<string, Set<string>>();
    next.overlayGroups.forEach((group) => {
      const available = new Set(group.layers.map((layer) => layer.layerId));
      const groupPreference = preference?.overlayGroups?.[group.groupKey];
      const knownIds = new Set(groupPreference?.knownLayerIds ?? []);
      let selected = group.layers
        .filter(
          (layer) =>
            groupPreference?.activeLayerIds?.includes(layer.layerId) ||
            (!knownIds.has(layer.layerId) && layer.visibleByDefault),
        )
        .map((layer) => layer.layerId)
        .filter((id) => available.has(id));
      if (!groupPreference) selected = initialOverlaySelection(group);
      if (group.exclusive) selected = selected.slice(0, 1);
      nextOverlayIds.set(group.groupKey, new Set(selected));
    });
    activeOverlayIds = nextOverlayIds;
    snapshot = next;
  };

  const reload = async (force = false) => {
    const currentGeneration = ++generation;
    try {
      const next = await getGisRuntimeScene(sceneKey, force);
      if (destroyed || viewer.isDestroyed() || currentGeneration !== generation)
        return;
      reconcileSelection(next);
      persistPreference();
      syncBaseMap();
      void applyTerrain();
      syncNonBaseLayers(currentGeneration);
      notify();
    } catch (error) {
      if (!destroyed && currentGeneration === generation) {
        onError?.('scene', sceneKey, error);
      }
      throw error;
    }
  };

  void reload().catch(() => undefined);
  return {
    reload,
    selectBaseMap(layerId) {
      const layer = snapshot && findLayer(snapshot.baseMaps, layerId);
      if (!layer || !layer.selectable || activeBaseMapId === layerId) return;
      activeBaseMapId = layerId;
      syncBaseMap();
      persistPreference();
      notify();
    },
    selectTerrain(layerId) {
      const layer = snapshot && findLayer(snapshot.terrains, layerId);
      if (!layer || !layer.selectable || activeTerrainId === layerId) return;
      activeTerrainId = layerId;
      if (terrainEnabled) void applyTerrain();
      persistPreference();
      notify();
    },
    setTerrainEnabled(enabled) {
      const next = Boolean(enabled && activeTerrainId);
      if (terrainEnabled === next) return;
      terrainEnabled = next;
      void applyTerrain();
      persistPreference();
      notify();
    },
    setModel3dEnabled(layerId, enabled) {
      const layer = snapshot && findLayer(snapshot.models3d, layerId);
      if (!layer || !layer.selectable) return;
      if (enabled) activeModel3dIds.add(layerId);
      else activeModel3dIds.delete(layerId);
      syncNonBaseLayers(generation);
      persistPreference();
      notify();
    },
    setOverlayEnabled(groupKey, layerId, enabled) {
      const group = snapshot?.overlayGroups.find(
        (item) => item.groupKey === groupKey,
      );
      const layer = group && findLayer(group.layers, layerId);
      if (!group || !layer || !layer.selectable) return;
      const selected = activeOverlayIds.get(groupKey) ?? new Set<string>();
      if (group.exclusive) {
        selected.clear();
        if (enabled) selected.add(layerId);
      } else if (enabled) selected.add(layerId);
      else selected.delete(layerId);
      activeOverlayIds.set(groupKey, selected);
      syncNonBaseLayers(generation);
      persistPreference();
      notify();
    },
    getLayerState,
    destroy() {
      destroyed = true;
      generation += 1;
      terrainGeneration += 1;
      snapshot = undefined;
      activeModel3dIds.clear();
      activeOverlayIds.clear();
      clearGeoJson();
      if (baseImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(baseImageryLayer, true);
      }
      baseImageryLayer = undefined;
      imageryManager.destroy();
      tilesetManager.destroy();
    },
  };
}
