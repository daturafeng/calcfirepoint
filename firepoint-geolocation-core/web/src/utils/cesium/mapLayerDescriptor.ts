/** 本地地图配置和航测成果共享的 Cesium 渲染描述，不包含业务状态。 */
export interface MapLayerDescriptor {
  id: string;
  sourceDomain: 'gis' | 'survey';
  layerType: 'imagery' | 'geojson' | 'terrain' | '3dtileset';
  providerType: string;
  url: string;
  name: string;
  opacity?: number;
  loadOptions?: Record<string, unknown>;
  focus?: {
    bbox?: [number, number, number, number];
    longitude?: number;
    latitude?: number;
    height?: number;
  };
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

function tilesetFormatOption(
  options: Record<string, unknown>,
): 'auto' | '3dtiles' | 'terrags' | undefined {
  const value = options.format;
  return value === 'terrags' || value === '3dtiles' || value === 'auto'
    ? value
    : undefined;
}

/** 公共影像加载器入参，GIS 与航测成果统一从描述协议转换。 */
export function toCesiumImageryOverlay(descriptor: MapLayerDescriptor) {
  const options = descriptor.loadOptions ?? {};
  return {
    id: descriptor.id,
    url: descriptor.url,
    providerType: descriptor.providerType,
    providerOptions: options,
    minimumLevel: numberOption(options, 'minimumLevel'),
    maximumLevel: numberOption(options, 'maximumLevel'),
    alpha: descriptor.opacity ?? numberOption(options, 'alpha'),
    focusBbox: descriptor.focus?.bbox,
  };
}

/** 公共 3D Tiles 加载器入参，GIS 与航测成果统一从描述协议转换。 */
export function toCesiumTilesetOverlay(descriptor: MapLayerDescriptor) {
  const options = descriptor.loadOptions ?? {};
  return {
    id: descriptor.id,
    url: descriptor.url,
    heightOffset: numberOption(options, 'heightOffset'),
    maximumScreenSpaceError: numberOption(options, 'maximumScreenSpaceError'),
    dynamicScreenSpaceError: booleanOption(options, 'dynamicScreenSpaceError'),
    skipLevelOfDetail: booleanOption(options, 'skipLevelOfDetail'),
    immediatelyLoadDesiredLevelOfDetail: booleanOption(
      options,
      'immediatelyLoadDesiredLevelOfDetail',
    ),
    loadSiblings: booleanOption(options, 'loadSiblings'),
    cullRequestsWhileMoving: booleanOption(options, 'cullRequestsWhileMoving'),
    foveatedScreenSpaceError: booleanOption(
      options,
      'foveatedScreenSpaceError',
    ),
    cacheBytes: numberOption(options, 'cacheBytes'),
    maximumCacheOverflowBytes: numberOption(
      options,
      'maximumCacheOverflowBytes',
    ),
    format: tilesetFormatOption(options),
    maximumSplatCount: numberOption(options, 'maximumSplatCount'),
    useBrowserRecommendedResolution: booleanOption(
      options,
      'useBrowserRecommendedResolution',
    ),
    depthTestAgainstTerrain: booleanOption(
      options,
      'depthTestAgainstTerrain',
    ),
    adaptiveResolution: booleanOption(options, 'adaptiveResolution'),
    focusBbox: descriptor.focus?.bbox,
  };
}
