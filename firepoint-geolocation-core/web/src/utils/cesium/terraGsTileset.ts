import { Cesium3DTileset, GaussianSplat3DTileset, type Resource } from 'cesium';

export type CesiumTilesetFormat = 'auto' | '3dtiles' | 'terrags';

export type TerraGsErrorCode =
  | 'TERRAGS_RUNTIME_UNAVAILABLE'
  | 'TERRAGS_ENTRY_INVALID'
  | 'TERRAGS_METADATA_MISSING'
  | 'TERRAGS_LOAD_FAILED';

export class TerraGsTilesetError extends Error {
  readonly code: TerraGsErrorCode;

  readonly cause?: unknown;

  constructor(code: TerraGsErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'TerraGsTilesetError';
    this.code = code;
    this.cause = cause;
  }
}

export interface CesiumTilesetLoadOptions
  extends Cesium3DTileset.ConstructorOptions {
  format?: CesiumTilesetFormat;
  maximumSplatCount?: number;
  /** 沿成果局部 Up 轴抬升模型，必须在 TerraGS 创建包围盒前写入清单。 */
  heightOffset?: number;
}

const DEFAULT_MAXIMUM_SPLAT_COUNT = 6_000_000;
const MINIMUM_SPLAT_COUNT = 100_000;
const MAXIMUM_SPLAT_COUNT = 14_000_000;
const TERRAGS_GLTF_EXTENSION = 'TERRA_gaussian_splatting';

type TerraGsContent = {
  uri?: string;
  url?: string;
};

type TerraGsTile = {
  content?: TerraGsContent;
  contents?: TerraGsContent[];
  children?: TerraGsTile[];
  transform?: number[];
};

type TerraGsManifest = {
  extensions?: Record<
    string,
    { extensionsRequired?: string[]; extensionsUsed?: string[] }
  >;
  root?: TerraGsTile;
};

function pathExtension(url: string) {
  const cleanUrl = String(url || '')
    .split(/[?#]/, 1)[0]
    .toLowerCase();
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  return match?.[1] ?? '';
}

export function isTerraGsTilesetUrl(
  url: string,
  format: CesiumTilesetFormat = 'auto',
) {
  return (
    format === 'terrags' ||
    (format === 'auto' && pathExtension(url) === 'terrags')
  );
}

function resolveTilesetFormat(url: string, format: CesiumTilesetFormat) {
  if (format !== 'auto') return format;
  const extension = pathExtension(url);
  if (extension === 'terrags') return 'terrags';
  if (extension === 'tgs' || extension === 'glb' || extension === 'gltf') {
    throw new TerraGsTilesetError(
      'TERRAGS_ENTRY_INVALID',
      `三维模型入口格式无效：${extension} 文件不能作为 Tileset 入口，请选择 tileset.terrags 或 tileset.json。`,
    );
  }
  return '3dtiles';
}

function normalizeMaximumSplatCount(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAXIMUM_SPLAT_COUNT;
  return Math.min(
    MAXIMUM_SPLAT_COUNT,
    Math.max(MINIMUM_SPLAT_COUNT, Math.floor(value as number)),
  );
}

function absoluteUrl(value: string, manifestUrl: string) {
  return new URL(value, manifestUrl).href;
}

function absolutizeContentUris(tile: TerraGsTile, manifestUrl: string) {
  const absolutizeContent = (content?: TerraGsContent) => {
    if (!content) return;
    if (content.uri) content.uri = absoluteUrl(content.uri, manifestUrl);
    if (content.url) content.url = absoluteUrl(content.url, manifestUrl);
  };

  absolutizeContent(tile.content);
  tile.contents?.forEach(absolutizeContent);
  tile.children?.forEach((child) => absolutizeContentUris(child, manifestUrl));
}

function hasTerraGsMetadata(manifest: TerraGsManifest) {
  const gltfExtension = manifest.extensions?.['3DTILES_content_gltf'];
  return (
    gltfExtension?.extensionsRequired?.includes(TERRAGS_GLTF_EXTENSION) ||
    gltfExtension?.extensionsUsed?.includes(TERRAGS_GLTF_EXTENSION)
  );
}

function applyManifestHeightOffset(
  manifest: TerraGsManifest,
  heightOffset?: number,
) {
  const offset = Number.isFinite(heightOffset) ? (heightOffset as number) : 0;
  const transform = manifest.root?.transform;
  if (!transform || transform.length !== 16 || Math.abs(offset) < 0.01) {
    return;
  }

  // 3D Tiles 矩阵按列存储，索引 8/9/10 是成果局部 Up 轴在 ECEF 中的方向。
  // 在创建 Tileset 前修改平移量，可让包围盒、LOD 和相机定位保持一致。
  transform[12] += transform[8] * offset;
  transform[13] += transform[9] * offset;
  transform[14] += transform[10] * offset;
}

async function createTerraGsManifestUrl(
  sourceUrl: string,
  heightOffset?: number,
) {
  const manifestUrl = absoluteUrl(sourceUrl, window.location.href);
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`TerraGS 清单请求失败（HTTP ${response.status}）`);
  }

  const manifest = (await response.json()) as TerraGsManifest;
  if (!manifest.root) {
    throw new TerraGsTilesetError(
      'TERRAGS_ENTRY_INVALID',
      '所选 TerraGS 清单缺少 root 节点。',
    );
  }
  if (!hasTerraGsMetadata(manifest)) {
    throw new TerraGsTilesetError(
      'TERRAGS_METADATA_MISSING',
      '所选文件不是有效的 DJI TerraGS 成果：缺少 TERRA_gaussian_splatting 元数据。',
    );
  }

  absolutizeContentUris(manifest.root, manifestUrl);
  applyManifestHeightOffset(manifest, heightOffset);
  return URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
  );
}

export async function loadCesiumTileset(
  url: string | Resource,
  options: CesiumTilesetLoadOptions,
): Promise<Cesium3DTileset> {
  const {
    format = 'auto',
    maximumSplatCount,
    heightOffset,
    ...cesiumOptions
  } = options;
  const urlText = typeof url === 'string' ? url : url.url;
  const resolvedFormat = resolveTilesetFormat(urlText, format);
  if (resolvedFormat === '3dtiles') {
    return Cesium3DTileset.fromUrl(url, cesiumOptions);
  }

  if (typeof GaussianSplat3DTileset?.fromUrl !== 'function') {
    throw new TerraGsTilesetError(
      'TERRAGS_RUNTIME_UNAVAILABLE',
      '当前 Cesium 运行时未提供 TerraGS 加载能力。',
    );
  }

  let tileset: GaussianSplat3DTileset | undefined;
  let preparedManifestUrl: string | undefined;
  try {
    // TerraGS 1.130 的加载器从 Blob 清单加载时无法自动推导相对瓦片路径，
    // 因此先把瓦片地址绝对化；高度也必须在创建包围盒之前写入 root.transform。
    preparedManifestUrl = await createTerraGsManifestUrl(urlText, heightOffset);
    tileset = await GaussianSplat3DTileset.fromUrl(
      preparedManifestUrl,
      cesiumOptions,
    );
    if (!tileset.isGltfExtensionRequired(TERRAGS_GLTF_EXTENSION)) {
      throw new TerraGsTilesetError(
        'TERRAGS_METADATA_MISSING',
        '所选文件不是有效的 DJI TerraGS 成果：缺少 TERRA_gaussian_splatting 元数据。',
      );
    }
    const maximumCount = normalizeMaximumSplatCount(maximumSplatCount);
    // TerraGS 1.130 的 setMaxSplatCount 首次调用会把 _MAXCOUNT 设为传入值的 1/4。
    // 这里与官方示例一致，显式设置当前预算和上限，避免千万点成果初始阶段不出图。
    tileset.setMaxSplatCount(maximumCount, maximumCount);
    tileset._MAXCOUNT = maximumCount;
    tileset.MAXCOUNT = maximumCount;
    return tileset;
  } catch (error) {
    if (tileset && !tileset.isDestroyed()) {
      tileset.destroy();
    }
    if (error instanceof TerraGsTilesetError) {
      throw error;
    }
    throw new TerraGsTilesetError(
      'TERRAGS_LOAD_FAILED',
      'DJI TerraGS 模型加载失败，请检查成果文件、网络地址和跨域配置。',
      error,
    );
  } finally {
    if (preparedManifestUrl) {
      URL.revokeObjectURL(preparedManifestUrl);
    }
  }
}
