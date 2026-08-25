import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  EllipsoidTerrainProvider,
  HeightReference,
  HorizontalOrigin,
  LabelGraphics,
  PolygonGraphics,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  PolylineGraphics,
  sampleTerrainMostDetailed,
  VerticalOrigin,
  Viewer,
  type Entity,
  type MaterialProperty,
} from 'cesium';

import {
  createPolylineSelectionMaterial,
  getPolylineSelectionWidth,
} from './polylineSelectionMaterial';

const EARTH_RADIUS_METERS = 6_371_008.8;
const CIRCLE_SEGMENT_COUNT = 128;

export interface CesiumGeometryPoint {
  lng: number;
  lat: number;
  alt?: number;
}

export interface CesiumRouteOverlay {
  id: string;
  points: CesiumGeometryPoint[];
  color?: string;
  width?: number;
  dashed?: boolean;
  dashLength?: number;
  relativeToStartTerrain?: boolean;
  clampToGround?: boolean;
  label?: string;
  showLabel?: boolean;
  highlighted?: boolean;
  /** 空间编辑时每个顶点对应的裸地椭球高，用于垂线和顶点句柄。 */
  terrainPoints?: CesiumGeometryPoint[];
  showVertexHandles?: boolean;
  selectedVertexIndex?: number;
}

export interface CesiumPolygonOverlay {
  id: string;
  points: CesiumGeometryPoint[];
  color: string;
  opacity?: number;
  outlineWidth?: number;
  label?: string;
  showLabel?: boolean;
  highlighted?: boolean;
  transparentFill?: boolean;
  terrainPoints?: CesiumGeometryPoint[];
  showVertexHandles?: boolean;
  selectedVertexIndex?: number;
}

/** Cesium 地图中以米为单位绘制的圆形覆盖物。 */
export interface CesiumCircleOverlay {
  id: string;
  lon: number;
  lat: number;
  /** Cesium 使用 WGS84 椭球高；未传时按贴地圆形处理。 */
  alt?: number;
  radiusMeters: number;
  color?: string;
  opacity?: number;
  outlineWidth?: number;
  label?: string;
  showLabel?: boolean;
  highlighted?: boolean;
  transparentFill?: boolean;
}

export type CesiumManagedGeometry =
  | { kind: 'route'; overlay: CesiumRouteOverlay }
  | { kind: 'polygon'; overlay: CesiumPolygonOverlay }
  | { kind: 'circle'; overlay: CesiumCircleOverlay };

export interface CesiumGeometryCollection {
  routes?: CesiumRouteOverlay[];
  polygons?: CesiumPolygonOverlay[];
  circles?: CesiumCircleOverlay[];
}

function createGeometryLabel(name: string, spatial = false) {
  return new LabelGraphics({
    text: name || '',
    font: '12px PingFang SC, Microsoft YaHei, sans-serif',
    horizontalOrigin: HorizontalOrigin.CENTER,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(0, -24),
    fillColor: Color.WHITE,
    showBackground: true,
    backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.62)'),
    heightReference: spatial ? HeightReference.NONE : HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
}

function polygonLabelPosition(points: CesiumGeometryPoint[]) {
  const longitudes = points.map((point) => point.lng);
  const latitudes = points.map((point) => point.lat);
  return Cartesian3.fromDegrees(
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    points.some((point) => Number.isFinite(point.alt))
      ? points.reduce((sum, point) => sum + Number(point.alt || 0), 0) /
        points.length
      : 0,
  );
}

function shouldShowGeometryLabel(
  label: string | undefined,
  showLabel: boolean | undefined,
) {
  return Boolean(label) && showLabel !== false;
}

function validPoint(point: CesiumGeometryPoint) {
  return (
    Number.isFinite(point?.lng) &&
    Number.isFinite(point?.lat) &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    point.lat >= -90 &&
    point.lat <= 90
  );
}

function signatureOf(value: unknown) {
  return JSON.stringify(value);
}

/**
 * 统一维护已完成几何的 Cesium 实体生命周期。
 *
 * `Draw` 只负责交互会话；业务常态图元通过本管理器差异同步。相同内容签名
 * 会直接跳过 Cesium Property 赋值，避免实时页面重渲染带动未变化图元闪烁。
 */
export class CesiumAnnotationGeometryManager {
  private readonly signatures = new Map<string, string>();

  private readonly managedKeys = new Set<string>();

  private readonly terrainHeightCache = new Map<string, number>();

  private readonly terrainHeightRequests = new Map<string, Promise<number>>();

  private readonly extraEntityIds = new Map<string, string[]>();

  private destroyed = false;

  constructor(
    private readonly dataSource: CustomDataSource,
    private readonly viewer?: Viewer,
  ) {}

  create(geometry: CesiumManagedGeometry) {
    return this.upsert(geometry);
  }

  createMany(geometries: CesiumManagedGeometry[]) {
    geometries.forEach((geometry) => this.upsert(geometry));
  }

  update(geometry: CesiumManagedGeometry) {
    return this.upsert(geometry);
  }

  sync(collection: CesiumGeometryCollection) {
    if (this.destroyed) {
      return;
    }
    const desiredKeys = new Set<string>();
    const geometries: CesiumManagedGeometry[] = [
      ...(collection.routes || []).map(
        (overlay): CesiumManagedGeometry => ({ kind: 'route', overlay }),
      ),
      ...(collection.polygons || []).map(
        (overlay): CesiumManagedGeometry => ({ kind: 'polygon', overlay }),
      ),
      ...(collection.circles || []).map(
        (overlay): CesiumManagedGeometry => ({ kind: 'circle', overlay }),
      ),
    ];

    geometries.forEach((geometry) => {
      const key = this.getKey(geometry);
      if (!key || !this.isValid(geometry)) {
        return;
      }
      desiredKeys.add(key);
      this.upsert(geometry);
    });

    [...this.managedKeys].forEach((key) => {
      if (!desiredKeys.has(key)) {
        this.remove(key);
      }
    });
    this.requestRender();
  }

  remove(geometryOrKey: CesiumManagedGeometry | string) {
    const key =
      typeof geometryOrKey === 'string'
        ? geometryOrKey
        : this.getKey(geometryOrKey);
    if (!key) {
      return false;
    }
    const removed = [...this.entityIdsForKey(key), ...(this.extraEntityIds.get(key) || [])].reduce((changed, entityId) => {
      const entity = this.dataSource.entities.getById(entityId);
      return entity
        ? this.dataSource.entities.remove(entity) || changed
        : changed;
    }, false);
    this.signatures.delete(key);
    this.managedKeys.delete(key);
    this.extraEntityIds.delete(key);
    return removed;
  }

  removeMany(geometriesOrKeys: Array<CesiumManagedGeometry | string>) {
    geometriesOrKeys.forEach((geometryOrKey) => this.remove(geometryOrKey));
    this.requestRender();
  }

  clear() {
    this.removeMany([...this.managedKeys]);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.clear();
    this.destroyed = true;
    this.terrainHeightCache.clear();
    this.terrainHeightRequests.clear();
  }

  private upsert(geometry: CesiumManagedGeometry) {
    if (this.destroyed || !this.isValid(geometry)) {
      return false;
    }
    const key = this.getKey(geometry);
    const signature = signatureOf(geometry);
    this.managedKeys.add(key);
    if (this.signatures.get(key) === signature) {
      return false;
    }
    this.signatures.set(key, signature);

    if (geometry.kind === 'route') {
      this.upsertRoute(key, geometry.overlay);
      this.syncSpatialGuides(key, geometry.overlay, geometry.overlay.points);
    } else if (geometry.kind === 'polygon') {
      this.upsertPolygon(key, geometry.overlay);
      this.syncSpatialGuides(key, geometry.overlay, geometry.overlay.points);
    } else {
      this.upsertCircle(key, geometry.overlay);
    }
    this.requestRender();
    return true;
  }

  private getKey(geometry: CesiumManagedGeometry) {
    return `${geometry.kind}:${geometry.overlay.id}`;
  }

  private isValid(geometry: CesiumManagedGeometry) {
    if (!geometry.overlay.id) {
      return false;
    }
    if (geometry.kind === 'route') {
      return geometry.overlay.points.filter(validPoint).length >= 2;
    }
    if (geometry.kind === 'polygon') {
      return geometry.overlay.points.filter(validPoint).length >= 3;
    }
    const circle = geometry.overlay;
    return (
      validPoint({ lng: circle.lon, lat: circle.lat }) &&
      Number.isFinite(circle.radiusMeters) &&
      circle.radiusMeters > 0
    );
  }

  private entityIdsForKey(key: string) {
    const separatorIndex = key.indexOf(':');
    const kind = key.slice(0, separatorIndex);
    const id = key.slice(separatorIndex + 1);
    if (kind === 'route') {
      return [`route-overlay-${id}`];
    }
    if (kind === 'polygon') {
      const entityId = `polygon-overlay-${id}`;
      return [entityId, `${entityId}-outline`];
    }
    return [`geometry-circle-${id}`];
  }

  private upsertRoute(key: string, overlay: CesiumRouteOverlay) {
    const points = overlay.points.filter(validPoint);
    const entityId = this.entityIdsForKey(key)[0];
    const terrainStartPoint = overlay.relativeToStartTerrain
      ? points[0]
      : undefined;
    const terrainCacheKey = terrainStartPoint
      ? `${terrainStartPoint.lng.toFixed(7)},${terrainStartPoint.lat.toFixed(
          7,
        )}`
      : undefined;
    const cachedTerrainHeight = terrainCacheKey
      ? this.terrainHeightCache.get(terrainCacheKey)
      : undefined;
    const terrainReady =
      !overlay.relativeToStartTerrain ||
      typeof cachedTerrainHeight === 'number';
    const positions = this.routePositions(points, overlay, cachedTerrainHeight);
    const color = Color.fromCssColorString(overlay.color || '#ffc53d');
    const material = overlay.highlighted
      ? createPolylineSelectionMaterial(color, true)
      : overlay.dashed
      ? new PolylineDashMaterialProperty({
          color,
          dashLength: overlay.dashLength || 16,
        })
      : new ColorMaterialProperty(color);
    const width = getPolylineSelectionWidth(
      overlay.width || 2,
      Boolean(overlay.highlighted),
    );
    const clampToGround = Boolean(overlay.clampToGround);
    const existing = this.dataSource.entities.getById(entityId);
    const labelPosition = positions[Math.floor(positions.length / 2)];
    const label = shouldShowGeometryLabel(overlay.label, overlay.showLabel)
      ? createGeometryLabel(overlay.label || '', !clampToGround)
      : undefined;
    if (existing?.polyline) {
      this.updateRoutePolyline(
        existing,
        positions,
        width,
        material,
        terrainReady,
        clampToGround,
      );
      existing.position = new ConstantPositionProperty(labelPosition);
      existing.label = label;
    } else {
      if (existing) {
        this.dataSource.entities.remove(existing);
      }
      this.dataSource.entities.add({
        id: entityId,
        position: labelPosition,
        polyline: {
          positions,
          width,
          material,
          show: terrainReady,
          clampToGround,
          zIndex: 0,
        },
        label,
      });
    }

    if (
      overlay.relativeToStartTerrain &&
      terrainStartPoint &&
      terrainCacheKey &&
      !terrainReady &&
      this.viewer
    ) {
      const requestedSignature = this.signatures.get(key);
      void this.getTerrainHeight(
        terrainCacheKey,
        terrainStartPoint.lng,
        terrainStartPoint.lat,
      ).then((terrainHeight) => {
        if (this.destroyed || this.signatures.get(key) !== requestedSignature) {
          return;
        }
        const activeEntity = this.dataSource.entities.getById(entityId);
        if (!activeEntity?.polyline || !this.managedKeys.has(key)) {
          return;
        }
        this.updateRoutePolyline(
          activeEntity,
          this.routePositions(points, overlay, terrainHeight),
          width,
          material,
          true,
          clampToGround,
        );
        this.requestRender();
      });
    }
  }

  private upsertPolygon(key: string, overlay: CesiumPolygonOverlay) {
    const points = overlay.points.filter(validPoint);
    const [entityId, outlineEntityId] = this.entityIdsForKey(key);
    const positions = points.map((point) =>
      Cartesian3.fromDegrees(point.lng, point.lat, point.alt || 0),
    );
    const spatial = points.some((point) => Number.isFinite(point.alt));
    const color = Color.fromCssColorString(overlay.color).withAlpha(
      overlay.transparentFill
        ? 0
        : Math.max(0, Math.min(1, overlay.opacity ?? 0.35)),
    );
    const existing = this.dataSource.entities.getById(entityId);
    const labelPosition = polygonLabelPosition(points);
    if (existing?.polygon) {
      existing.polygon.hierarchy = new ConstantProperty(
        new PolygonHierarchy(positions),
      );
      existing.polygon.material = new ColorMaterialProperty(color);
      existing.polygon.outline = new ConstantProperty(false);
      existing.polygon.perPositionHeight = new ConstantProperty(spatial);
      existing.position = new ConstantPositionProperty(labelPosition);
      existing.label = shouldShowGeometryLabel(overlay.label, overlay.showLabel)
        ? createGeometryLabel(overlay.label || '', spatial)
        : undefined;
    } else {
      if (existing) {
        this.dataSource.entities.remove(existing);
      }
      this.dataSource.entities.add({
        id: entityId,
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: color,
          outline: false,
          perPositionHeight: spatial,
        },
        position: labelPosition,
        label: shouldShowGeometryLabel(overlay.label, overlay.showLabel)
          ? createGeometryLabel(overlay.label || '', spatial)
          : undefined,
      });
    }

    const closedPositions = positions[0].equals(positions[positions.length - 1])
      ? positions
      : [...positions, positions[0]];
    const outlineColor = Color.fromCssColorString(overlay.color);
    const outlineWidth = getPolylineSelectionWidth(
      overlay.outlineWidth || 2,
      Boolean(overlay.highlighted),
    );
    const outlineMaterial = createPolylineSelectionMaterial(
      outlineColor,
      Boolean(overlay.highlighted),
    );
    const existingOutline = this.dataSource.entities.getById(outlineEntityId);
    if (existingOutline?.polyline) {
      existingOutline.polyline.positions = new ConstantProperty(
        closedPositions,
      );
      existingOutline.polyline.width = new ConstantProperty(outlineWidth);
      existingOutline.polyline.material = outlineMaterial;
      existingOutline.polyline.clampToGround = new ConstantProperty(!spatial);
      existingOutline.polyline.zIndex = new ConstantProperty(0);
    } else {
      if (existingOutline) {
        this.dataSource.entities.remove(existingOutline);
      }
      this.dataSource.entities.add({
        id: outlineEntityId,
        polyline: {
          positions: closedPositions,
          width: outlineWidth,
          material: outlineMaterial,
          clampToGround: !spatial,
          zIndex: 0,
        },
      });
    }
  }

  private upsertCircle(key: string, circle: CesiumCircleOverlay) {
    const entityId = this.entityIdsForKey(key)[0];
    const positions = this.circlePositions(circle);
    const spatial = Number.isFinite(circle.alt);
    const center = Cartesian3.fromDegrees(circle.lon, circle.lat, circle.alt || 0);
    const color = Color.fromCssColorString(circle.color || '#fadb14');
    const baseOutlineWidth = circle.outlineWidth || 2;
    const outlineWidth = getPolylineSelectionWidth(
      baseOutlineWidth,
      Boolean(circle.highlighted),
    );
    const outlineMaterial = createPolylineSelectionMaterial(
      color,
      Boolean(circle.highlighted),
    );
    const fillMaterial = new ColorMaterialProperty(
      color.withAlpha(circle.transparentFill ? 0 : circle.opacity ?? 0.2),
    );
    const existing = this.dataSource.entities.getById(entityId);
    if (existing?.polygon && existing.polyline) {
      existing.position = new ConstantPositionProperty(center);
      existing.polygon.hierarchy = new ConstantProperty(
        new PolygonHierarchy(positions),
      );
      existing.polygon.material = fillMaterial;
      existing.polygon.outline = new ConstantProperty(false);
      existing.polygon.perPositionHeight = new ConstantProperty(spatial);
      existing.polyline.positions = new ConstantProperty(positions);
      existing.polyline.clampToGround = new ConstantProperty(!spatial);
      existing.polyline.width = new ConstantProperty(outlineWidth);
      existing.polyline.material = outlineMaterial;
      existing.polyline.zIndex = new ConstantProperty(0);
      existing.label = shouldShowGeometryLabel(circle.label, circle.showLabel)
        ? createGeometryLabel(circle.label || '', spatial)
        : undefined;
      return;
    }
    if (existing) {
      this.dataSource.entities.remove(existing);
    }
    this.dataSource.entities.add({
      id: entityId,
      position: center,
      polygon: new PolygonGraphics({
        hierarchy: new PolygonHierarchy(positions),
        material: fillMaterial,
        outline: false,
        perPositionHeight: spatial,
      }),
      polyline: new PolylineGraphics({
        positions,
        clampToGround: !spatial,
        width: outlineWidth,
        material: outlineMaterial,
        zIndex: 0,
      }),
      label: shouldShowGeometryLabel(circle.label, circle.showLabel)
        ? createGeometryLabel(circle.label || '', spatial)
        : undefined,
    });
  }

  /** 为处于空间编辑态的线/面补充垂线、地面锚点、顶点句柄和边长标签。 */
  private syncSpatialGuides(
    key: string,
    overlay: CesiumRouteOverlay | CesiumPolygonOverlay,
    points: CesiumGeometryPoint[],
  ) {
    const previousIds = this.extraEntityIds.get(key) || [];
    previousIds.forEach((entityId) => {
      const entity = this.dataSource.entities.getById(entityId);
      if (entity) this.dataSource.entities.remove(entity);
    });
    this.extraEntityIds.delete(key);

    if (
      !overlay.showVertexHandles ||
      !overlay.terrainPoints ||
      overlay.terrainPoints.length !== points.length ||
      !points.every((point) => Number.isFinite(point.alt)) ||
      !overlay.terrainPoints.every((point) => Number.isFinite(point.alt))
    ) {
      return;
    }

    const entityIds: string[] = [];
    const add = (entity: Entity.ConstructorOptions) => {
      this.dataSource.entities.add(entity);
      entityIds.push(String(entity.id));
    };
    points.forEach((point, index) => {
      const terrainPoint = overlay.terrainPoints![index];
      const top = Cartesian3.fromDegrees(point.lng, point.lat, Number(point.alt));
      const ground = Cartesian3.fromDegrees(
        terrainPoint.lng,
        terrainPoint.lat,
        Number(terrainPoint.alt),
      );
      const active = overlay.selectedVertexIndex === index;
      add({
        id: `annotation-guide-${key}-${index}`,
        polyline: {
          positions: [ground, top],
          width: active ? 2 : 1,
          material: active ? Color.fromCssColorString('#ff4d4f') : Color.WHITE.withAlpha(0.82),
          clampToGround: false,
        },
      });
      add({
        id: `annotation-ground-${key}-${index}`,
        position: ground,
        point: {
          pixelSize: active ? 7 : 5,
          color: Color.WHITE.withAlpha(0.9),
          outlineColor: Color.fromCssColorString('#30343b'),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      add({
        id: `annotation-vertex-${overlay.id}-${index}`,
        position: top,
        point: {
          pixelSize: active ? 12 : 10,
          color: active ? Color.fromCssColorString('#ff4d4f') : Color.WHITE,
          outlineColor: active ? Color.WHITE : Color.fromCssColorString('#30343b'),
          outlineWidth: active ? 2 : 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    });

    const closed = key.startsWith('polygon:');
    const edgeCount = closed ? points.length : Math.max(0, points.length - 1);
    for (let index = 0; index < edgeCount; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      const length = this.horizontalDistanceMeters(from, to);
      const mid = Cartesian3.fromDegrees(
        (from.lng + to.lng) / 2,
        (from.lat + to.lat) / 2,
        (Number(from.alt) + Number(to.alt)) / 2,
      );
      add({
        id: `annotation-edge-${key}-${index}`,
        position: mid,
        label: new LabelGraphics({
          text: length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${length.toFixed(1)} m`,
          font: '12px PingFang SC, Microsoft YaHei, sans-serif',
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.62)'),
          pixelOffset: new Cartesian2(0, -14),
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      });
    }
    this.extraEntityIds.set(key, entityIds);
  }

  private horizontalDistanceMeters(
    from: CesiumGeometryPoint,
    to: CesiumGeometryPoint,
  ) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLat = toRadians(to.lat - from.lat);
    const deltaLng = toRadians(to.lng - from.lng);
    const value =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(from.lat)) *
        Math.cos(toRadians(to.lat)) *
        Math.sin(deltaLng / 2) ** 2;
    return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private circlePositions(circle: CesiumCircleOverlay) {
    const centerLongitude = (circle.lon * Math.PI) / 180;
    const centerLatitude = (circle.lat * Math.PI) / 180;
    const angularDistance = circle.radiusMeters / EARTH_RADIUS_METERS;
    const positions: Cartesian3[] = [];
    for (let index = 0; index <= CIRCLE_SEGMENT_COUNT; index += 1) {
      const bearing = (index / CIRCLE_SEGMENT_COUNT) * Math.PI * 2;
      const latitude = Math.asin(
        Math.sin(centerLatitude) * Math.cos(angularDistance) +
          Math.cos(centerLatitude) *
            Math.sin(angularDistance) *
            Math.cos(bearing),
      );
      const longitude =
        centerLongitude +
        Math.atan2(
          Math.sin(bearing) *
            Math.sin(angularDistance) *
            Math.cos(centerLatitude),
          Math.cos(angularDistance) -
            Math.sin(centerLatitude) * Math.sin(latitude),
        );
      positions.push(Cartesian3.fromRadians(longitude, latitude, circle.alt || 0));
    }
    return positions;
  }

  private routePositions(
    points: CesiumGeometryPoint[],
    overlay: CesiumRouteOverlay,
    terrainHeight?: number,
  ) {
    return points.map((point) =>
      overlay.relativeToStartTerrain && typeof terrainHeight === 'number'
        ? Cartesian3.fromDegrees(
            point.lng,
            point.lat,
            terrainHeight +
              (Number.isFinite(point.alt) ? Number(point.alt) : 0),
          )
        : Cartesian3.fromDegrees(
            point.lng,
            point.lat,
            Number.isFinite(point.alt) ? Number(point.alt) : 0,
          ),
    );
  }

  private updateRoutePolyline(
    entity: Entity,
    positions: Cartesian3[],
    width: number,
    material: MaterialProperty,
    visible: boolean,
    clampToGround: boolean,
  ) {
    if (!entity.polyline) {
      return;
    }
    entity.polyline.positions = new ConstantProperty(positions);
    entity.polyline.width = new ConstantProperty(width);
    entity.polyline.material = material;
    entity.polyline.show = new ConstantProperty(visible);
    entity.polyline.clampToGround = new ConstantProperty(clampToGround);
  }

  private getTerrainHeight(key: string, lng: number, lat: number) {
    const cached = this.terrainHeightCache.get(key);
    if (typeof cached === 'number') {
      return Promise.resolve(cached);
    }
    const pending = this.terrainHeightRequests.get(key);
    if (pending) {
      return pending;
    }
    const request = this.sampleTerrainHeight(lng, lat).then((height) => {
      this.terrainHeightCache.set(key, height);
      this.terrainHeightRequests.delete(key);
      return height;
    });
    this.terrainHeightRequests.set(key, request);
    return request;
  }

  private async sampleTerrainHeight(lng: number, lat: number) {
    if (
      !this.viewer ||
      this.viewer.terrainProvider instanceof EllipsoidTerrainProvider
    ) {
      return 0;
    }
    const cartographic = Cartographic.fromDegrees(lng, lat);
    try {
      const [sampledPosition] = await sampleTerrainMostDetailed(
        this.viewer.terrainProvider,
        [cartographic],
      );
      const sampledHeight = Number(sampledPosition?.height);
      if (Number.isFinite(sampledHeight)) {
        return sampledHeight;
      }
    } catch (_error) {
      // 地形瓦片尚未就绪时继续读取当前 Globe 已加载的高程。
    }
    const loadedHeight = Number(
      this.viewer.scene.globe.getHeight(cartographic),
    );
    return Number.isFinite(loadedHeight) ? loadedHeight : 0;
  }

  private requestRender() {
    this.viewer?.scene.requestRender();
  }
}
