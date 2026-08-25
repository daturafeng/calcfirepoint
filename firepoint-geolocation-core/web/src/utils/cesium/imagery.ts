import {
  GeographicTilingScheme,
  ImageryLayer,
  Rectangle,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
} from 'cesium';

type TileBlueFilterOptions = {
  invertColor?: boolean;
  filterRGB?: [number, number, number];
};

type LayerTextureState = {
  image?: TileImage;
};

type ImageryLayerWithBlueFilterPatch = ImageryLayer & {
  __dockBlueFilterPatched?: boolean;
  _createTexture?: (context: unknown, imagery: LayerTextureState) => void;
};

type RequestImageResult = ReturnType<
  UrlTemplateImageryProvider['requestImage']
>;
type TileImage = Awaited<NonNullable<RequestImageResult>>;

const DEFAULT_TILE_BLUE_FILTER: Required<TileBlueFilterOptions> = {
  invertColor: true,
  filterRGB: [0, 72, 168],
};

function getCanvasImageSize(image: CanvasImageSource) {
  const sizedImage = image as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };

  if (sizedImage.naturalWidth && sizedImage.naturalHeight) {
    return { width: sizedImage.naturalWidth, height: sizedImage.naturalHeight };
  }

  if (sizedImage.videoWidth && sizedImage.videoHeight) {
    return { width: sizedImage.videoWidth, height: sizedImage.videoHeight };
  }

  if (sizedImage.width && sizedImage.height) {
    return { width: sizedImage.width, height: sizedImage.height };
  }

  return undefined;
}

function toCanvas(image: CanvasImageSource) {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const size = getCanvasImageSize(image);
  const width = size?.width;
  const height = size?.height;

  if (!width || !height) {
    return undefined;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return undefined;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.translate(0, height);
  context.scale(1, -1);
  context.drawImage(image, 0, 0);
  return { canvas, context, width, height };
}

function applyBlueFilterToTile(
  image: TileImage,
  options: Required<TileBlueFilterOptions>,
) {
  const canvasState = toCanvas(image);
  if (!canvasState) {
    return image;
  }

  const { canvas, context, width, height } = canvasState;

  try {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const [filterRed, filterGreen, filterBlue] = options.filterRGB;

    for (let index = 0; index < data.length; index += 4) {
      let red = data[index];
      let green = data[index + 1];
      let blue = data[index + 2];

      if (options.invertColor) {
        red = 255 - red;
        green = 255 - green;
        blue = 255 - blue;
      }

      data[index] = (red * filterRed) / 255;
      data[index + 1] = (green * filterGreen) / 255;
      data[index + 2] = (blue * filterBlue) / 255;
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
  } catch {
    return image;
  }
}

function patchLayerWithBlueFilter(
  layer: ImageryLayer,
  options?: TileBlueFilterOptions,
) {
  const patchedLayer = layer as ImageryLayerWithBlueFilterPatch;
  if (patchedLayer.__dockBlueFilterPatched || !patchedLayer._createTexture) {
    return layer;
  }

  const filter = { ...DEFAULT_TILE_BLUE_FILTER, ...options };
  const originalCreateTexture = patchedLayer._createTexture.bind(layer);

  patchedLayer._createTexture = (
    context: unknown,
    imagery: LayerTextureState,
  ) => {
    if (imagery.image) {
      imagery.image = applyBlueFilterToTile(imagery.image, filter);
    }
    originalCreateTexture(context, imagery);
  };

  patchedLayer.__dockBlueFilterPatched = true;
  return layer;
}

export function createUrlTemplateImageryProvider(
  url: string,
  options?: {
    minimumLevel?: number;
    maximumLevel?: number;
    rectangle?: Rectangle;
    blueFilterOptions?: TileBlueFilterOptions;
  },
) {
  return new UrlTemplateImageryProvider({
    url,
    minimumLevel: options?.minimumLevel ?? 0,
    maximumLevel: options?.maximumLevel ?? 19,
    rectangle: options?.rectangle,
    tilingScheme: new WebMercatorTilingScheme(),
  });
}

function stringArrayOption(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

function numberOption(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function createConfiguredImageryProvider(options: {
  url: string;
  providerType: string;
  loadOptions?: Record<string, unknown>;
  rectangle?: Rectangle;
}) {
  const loadOptions = options.loadOptions ?? {};
  const tilingScheme =
    loadOptions.tilingScheme === 'geographic'
      ? new GeographicTilingScheme()
      : new WebMercatorTilingScheme();
  const subdomains = stringArrayOption(loadOptions.subdomains);
  const minimumLevel = numberOption(loadOptions.minimumLevel);
  const maximumLevel = numberOption(loadOptions.maximumLevel);
  const credit =
    typeof loadOptions.credit === 'string' && loadOptions.credit.trim()
      ? loadOptions.credit.trim()
      : undefined;
  if (options.providerType === 'wmts') {
    const layer = String(loadOptions.layer || '').trim();
    const tileMatrixSetID = String(
      loadOptions.tileMatrixSetID || loadOptions.tileMatrixSetId || '',
    ).trim();
    if (!layer || !tileMatrixSetID) {
      throw new Error('WMTS 缺少 layer 或 tileMatrixSetID 配置');
    }
    return new WebMapTileServiceImageryProvider({
      url: options.url,
      layer,
      style: String(loadOptions.style || 'default'),
      format: String(loadOptions.format || 'image/png'),
      tileMatrixSetID,
      tileMatrixLabels: stringArrayOption(loadOptions.tileMatrixLabels),
      subdomains,
      tilingScheme,
      rectangle: options.rectangle,
      minimumLevel,
      maximumLevel,
      credit,
    });
  }
  if (options.providerType !== 'xyz') {
    throw new Error(`暂不支持影像 Provider：${options.providerType}`);
  }
  return new UrlTemplateImageryProvider({
    url: options.url,
    minimumLevel: minimumLevel ?? 0,
    maximumLevel: maximumLevel ?? 19,
    rectangle: options.rectangle,
    subdomains,
    tilingScheme,
    credit,
  });
}

/** 清空影像；三期地图底图由 V2 场景控制器异步加载。 */
export function addStandardImageryLayers(
  viewer: Viewer,
  isBlueFilter: boolean = false,
) {
  viewer.imageryLayers.removeAll();
  void isBlueFilter;
}

// export default function modifyMap(
//   viewer: Viewer,
//   targetLayer: number | ImageryLayer = 0,
//   options?: LayerFilterOptions,
// ) {
//   if (viewer.imageryLayers.length < 1) {
//     return;
//   }

//   const layer =
//     typeof targetLayer === 'number'
//       ? viewer.imageryLayers.length > targetLayer && targetLayer >= 0
//         ? viewer.imageryLayers.get(targetLayer)
//         : undefined
//       : targetLayer;

//   if (!layer) {
//     return;
//   }

//   const filter = { ...DEFAULT_LAYER_FILTER, ...options };

//   // 图层级参数只做细调，真正的深蓝效果由底图 provider 的像素处理完成。
//   layer.brightness = filter.brightness;
//   layer.contrast = filter.contrast;
//   layer.hue = filter.hue;
//   layer.saturation = filter.saturation;
//   layer.gamma = filter.gamma;
//   layer.alpha = filter.alpha;
// }

/** 仅替换最底层影像（index 0），保留其上的叠加层 */
export function replaceBaseImageryLayer(
  viewer: Viewer,
  url: string,
  isBlueFilter: boolean = false,
) {
  if (!url) {
    return;
  }
  const layers = viewer.imageryLayers;
  if (layers.length < 1) {
    return;
  }
  const bottom = layers.get(0);
  layers.remove(bottom, true);
  const nextBaseLayer = layers.addImageryProvider(
    createUrlTemplateImageryProvider(url),
    0,
  );
  if (isBlueFilter) {
    patchLayerWithBlueFilter(nextBaseLayer);
  }
  // modifyMap(viewer, nextBaseLayer);
}
