import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  HorizontalOrigin,
  HeightReference,
  LabelStyle,
  PolygonHierarchy,
  VerticalOrigin,
  PolylineDashMaterialProperty,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  type MaterialProperty,
} from 'cesium';
import {
  shouldFinishOnRightClick,
  supportsKeyboardFinish,
  supportsManualFinish,
  type DrawEndKind,
  type EndMode,
} from './drawEndMode';

export type DrawKind = DrawEndKind;
export type { EndMode } from './drawEndMode';

export type LngLatHeight = {
  lng: number;
  lat: number;
  height?: number;
};

export type CssColor = string | Color;

export interface DrawMaterials {
  /**
   * 折线（polyline）推荐使用 Cesium 的 `MaterialProperty`。
   * 例如：`new PolylineDashMaterialProperty({ color, dashLength: 12 })`
   */
  polyline?: MaterialProperty;
  polygon?: MaterialProperty;
  rectangle?: MaterialProperty;
  ellipse?: MaterialProperty;
}

export interface DrawPointLabelOptions {
  enabled?: boolean;
  /**
   * 可组合的展示类型：
   * - `index`: 顶点序号（1,2,3...）
   * - `custom`: 由 formatter 决定每个顶点显示内容
   * - `length`: 仅用于线段长度标签（绘制完成后）
   * - `area`: 仅用于面/矩形面积标签（绘制完成后）
   */
  mode?: 'index' | 'custom' | 'length' | 'area' | Array<'index' | 'custom' | 'length' | 'area'>;
  formatter?: (ctx: {
    kind: DrawKind;
    index?: number;
    lengthMeters?: number;
    areaSquareMeters?: number;
    lngLat?: LngLatHeight;
  }) => string;
}

export interface DrawStyle {
  color?: CssColor;
  /**
   * 线宽（line/polyline）
   */
  lineWidth?: number;
  /**
   * 填充颜色（polygon/rectangle/circle）
   */
  fill?: boolean;
  fillColor?: CssColor;
  /**
   * 描边开关（polygon/rectangle/circle）
   */
  outline?: boolean;
  outlineColor?: CssColor;
  /**
   * 描边宽度（polygon/rectangle/circle），单位为像素。
   */
  outlineWidth?: number;
  /**
   * 虚线样式（仅作用于 line）
   */
  dashed?: boolean | { dashLength?: number };
  /**
   * 允许你传入自定义 Cesium MaterialProperty（可选）
   */
  materials?: DrawMaterials;
  /**
   * 点的样式（point）
   */
  point?: {
    pixelSize?: number;
    outlineWidth?: number;
  };
  /**
   * 标签样式（point/vertex + length/area）
   */
  label?: DrawPointLabelOptions;
  /**
   * 高度策略：通常建议贴地。默认：CLAMP_TO_GROUND
   */
  heightReference?: HeightReference;
}

export type DrawResult =
  | { kind: 'point'; position: LngLatHeight; id: string }
  | { kind: 'line'; positions: LngLatHeight[]; id: string }
  | { kind: 'polygon'; positions: LngLatHeight[]; id: string }
  | { kind: 'rectangle'; west: number; south: number; east: number; north: number; id: string }
  | { kind: 'circle'; center: LngLatHeight; radiusMeters: number; id: string };

export type InteractiveDrawResult = DrawResult & {
  session: DrawSessionSnapshot;
};

export type InteractiveOptions = {
  kind: DrawKind;
  style?: DrawStyle;
  endMode?: EndMode;
  /**
   * 开始绘制前是否清空当前图层内容
   */
  clearBefore?: boolean;
  /**
   * 结束后回调（只有成功生成图形才会调用）
   */
  onComplete?: (result: InteractiveDrawResult) => void;
  onCancel?: () => void;
  /**
   * 手动结束时，外部可通过调用本类实例的 `finish()` 来结束。
   */
  onPreviewUpdate?: (preview: unknown) => void;
};

export type DrawSessionSnapshot = {
  /** 本次绘制在 Cesium 数据源中创建的最终实体标识。 */
  entityIds: string[];
};

const EARTH_RADIUS_M = 6378137;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeColor(color?: CssColor, fallback: Color = Color.WHITE): Color {
  if (!color) return fallback;
  if (typeof color === 'string') return Color.fromCssColorString(color);
  return color;
}

function formatVertexIndex(index: number) {
  return `${index + 1}`;
}

function normalizeLabelModes(mode: DrawPointLabelOptions['mode']): Array<'index' | 'custom' | 'length' | 'area'> {
  if (!mode) return [];
  return Array.isArray(mode) ? mode : [mode];
}

function getLngLatHeightFromCartesian(cartesian: Cartesian3): LngLatHeight | null {
  try {
    const carto = Cartographic.fromCartesian(cartesian);
    return {
      lng: toDeg(carto.longitude),
      lat: toDeg(carto.latitude),
      height: carto.height,
    };
  } catch {
    return null;
  }
}

function lngLatHeightToCartesian(position: LngLatHeight, useHeight = true) {
  const height = useHeight ? position.height ?? 0 : 0;
  return Cartesian3.fromDegrees(position.lng, position.lat, height);
}

function getCircleOutlinePositions(center: LngLatHeight, radiusMeters: number, segments = 96) {
  const angularDistance = radiusMeters / EARTH_RADIUS_M;
  const centerLat = toRad(center.lat);
  const centerLng = toRad(center.lng);

  return Array.from({ length: segments + 1 }, (_, index) => {
    const bearing = (index / segments) * Math.PI * 2;
    const lat = Math.asin(
      Math.sin(centerLat) * Math.cos(angularDistance) +
        Math.cos(centerLat) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lng =
      centerLng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLat),
        Math.cos(angularDistance) - Math.sin(centerLat) * Math.sin(lat),
      );
    return { lng: toDeg(lng), lat: toDeg(lat), height: 0 };
  });
}

function getPathLengthMeters(points: Pick<LngLatHeight, 'lat' | 'lng'>[]) {
  if (points.length < 2) return 0;
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    length += EARTH_RADIUS_M * c;
  }
  return length;
}

function getSurfaceDistanceMeters(
  start: Pick<LngLatHeight, 'lat' | 'lng'>,
  end: Pick<LngLatHeight, 'lat' | 'lng'>,
) {
  return getPathLengthMeters([start, end]);
}

function getPolygonAreaSquareMeters(points: Pick<LngLatHeight, 'lat' | 'lng'>[]) {
  if (points.length < 3) return 0;
  const origin = points[0];
  const projected = points.map((point) => ({
    x: ((point.lng - origin.lng) * Math.PI * EARTH_RADIUS_M * Math.cos(toRad(origin.lat))) / 180,
    y: ((point.lat - origin.lat) * Math.PI * EARTH_RADIUS_M) / 180,
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const next = (i + 1) % projected.length;
    area += projected[i].x * projected[next].y;
    area -= projected[next].x * projected[i].y;
  }
  return Math.abs(area / 2);
}

function getLngLatCentroid(points: LngLatHeight[]): LngLatHeight {
  if (!points.length) return { lng: 0, lat: 0, height: 0 };
  const sum = points.reduce(
    (acc, p) => {
      acc.lng += p.lng;
      acc.lat += p.lat;
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return { lng: sum.lng / points.length, lat: sum.lat / points.length, height: 0 };
}

function isValidLngLat(point: LngLatHeight) {
  return Number.isFinite(point.lng) && Number.isFinite(point.lat) &&
    point.lng >= -180 && point.lng <= 180 && point.lat >= -90 && point.lat <= 90;
}

function distinctPositionCount(points: LngLatHeight[]) {
  return new Set(points.filter(isValidLngLat).map((point) => `${point.lng.toFixed(10)},${point.lat.toFixed(10)}`)).size;
}

function pickPositionFromMouse(viewer: Viewer, movementPosition: { x: number; y: number } | undefined) {
  if (!movementPosition) return null;
  const ray = viewer.camera.getPickRay(new Cartesian2(movementPosition.x, movementPosition.y));
  if (!ray) return null;
  const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
  if (!cartesian) return null;
  return getLngLatHeightFromCartesian(cartesian);
}

function getStyleDefaults(kind: DrawKind, style?: DrawStyle): Required<DrawStyle> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const base = (style || {}) as DrawStyle;
  const color = normalizeColor(base.color, normalizeColor(base.outlineColor, Color.WHITE));
  const outlineColor = normalizeColor(base.outlineColor ?? base.color, Color.WHITE);
  const fillColor = normalizeColor(base.fillColor ?? base.color ?? base.outlineColor, color).withAlpha(0.25);
  return {
    color,
    lineWidth: base.lineWidth ?? 2,
    fill: base.fill ?? true,
    fillColor: fillColor,
    outline: base.outline ?? true,
    outlineColor,
    outlineWidth: base.outlineWidth ?? base.lineWidth ?? 2,
    dashed: base.dashed ?? false,
    materials: base.materials ?? {},
    point: {
      pixelSize: base.point?.pixelSize ?? (kind === 'point' ? 10 : 8),
      outlineWidth: base.point?.outlineWidth ?? 2,
    },
    label: base.label ?? { enabled: false, mode: 'index' },
    heightReference: base.heightReference ?? HeightReference.CLAMP_TO_GROUND,
  } as Required<DrawStyle>;
}
function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '0 m';
  if (distanceMeters < 1000) return `${distanceMeters.toFixed(1)} m`;
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatArea(areaSquareMeters: number) {
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0) return '0 m²';
  if (areaSquareMeters < 1_000_000) return `${areaSquareMeters.toFixed(1)} m²`;
  return `${(areaSquareMeters / 1_000_000).toFixed(2)} km²`;
}

export class Draw {
  private viewer: Viewer;
  private dataSource: CustomDataSource;
  private handler: ScreenSpaceEventHandler | null = null;
  private idSeq = 1;

  private active = false;
  private session:
    | (InteractiveOptions & {
        style: Required<DrawStyle>;
        endMode: EndMode;
        createdIds: string[];
        previewIds: string[];
        // 多边形顶点 / 矩形对角点 / 线段端点 / 圆心+边界点
        vertices: LngLatHeight[];
        startPoint?: LngLatHeight;
        circleRadiusMeters?: number;
        // callback 预览状态
        previewLineId?: string;
        previewLineHover?: LngLatHeight | null;
        previewRectangleId?: string;
        previewRectangleHover?: LngLatHeight | null;
        previewCircleId?: string;
        previewCircleEdge?: LngLatHeight | null;
        previewPolygonOutlineId?: string;
        previewPolygonFillId?: string;
        previewPolygonHover?: LngLatHeight | null;
        // 用于 Enter 结束绘制（polygon）
        onKeyDown?: (e: KeyboardEvent) => void;
      })
    | undefined;

  constructor(viewer: Viewer, opts?: { dataSource?: CustomDataSource; dataSourceId?: string }) {
    this.viewer = viewer;
    this.dataSource = opts?.dataSource ?? new CustomDataSource(opts?.dataSourceId ?? 'cesium-draw');
    if (!opts?.dataSource) {
      this.viewer.dataSources.add(this.dataSource);
    }
  }

  get isActive() {
    return this.active;
  }

  clear() {
    this.dataSource.entities.removeAll();
  }

  /**
   * 清理一次已经完成的绘制结果。页面可用它在保存、取消或重绘时精准移除
   * 临时图元，避免影响业务图层或其他标绘会话。
   */
  removeEntities(entityIds: string[]) {
    entityIds.forEach((id) => {
      this.removeEntityById(id);
      this.removeEntityById(`${id}-outline`);
      this.removeEntityById(`${id}-label`);
    });
  }

  destroy() {
    this.cancel();
    this.dataSource.entities.removeAll();
    try {
      this.viewer.dataSources.remove(this.dataSource);
    } catch {
      // 忽略错误
    }
  }

  private nextId(prefix: string) {
    const id = `${prefix}-${this.idSeq}`;
    this.idSeq += 1;
    return id;
  }

  // -------- 编程式 API --------

  drawPoint(position: LngLatHeight, style?: DrawStyle): string {
    const s = getStyleDefaults('point', style);
    const id = this.nextId('draw-point');

    const pointColor = normalizeColor(s.color);
    const outlineColor = normalizeColor(s.outlineColor);

    this.dataSource.entities.add({
      id,
      position: lngLatHeightToCartesian(position, false),
      point: {
        pixelSize: s.point.pixelSize,
        color: pointColor,
        outlineColor,
        outlineWidth: s.point.outlineWidth,
        heightReference: s.heightReference,
      },
    });

    // point label if needed (index/length/area 都依赖交互，此处不做强制)
    if (s.label?.enabled && normalizeLabelModes(s.label.mode).includes('custom') && s.label.formatter) {
      const text = s.label.formatter({ kind: 'point', lngLat: position });
      this.dataSource.entities.add({
        id: `${id}-label`,
        position: lngLatHeightToCartesian(position, false),
        label: this.buildLabelGraphic(text),
      });
    }

    return id;
  }

  drawLine(positions: LngLatHeight[], style?: DrawStyle): string {
    const s = getStyleDefaults('line', style);
    const id = this.nextId('draw-line');

    const cartesianPositions = positions.map((p) => lngLatHeightToCartesian(p, false));

    this.dataSource.entities.add({
      id,
      polyline: {
        positions: cartesianPositions,
        width: s.lineWidth,
        material: this.buildPolylineMaterial(s),
        clampToGround: true,
      },
    });

    if (s.label?.enabled && normalizeLabelModes(s.label.mode).includes('length')) {
      const lengthMeters = getPathLengthMeters(positions);
      const text = s.label.formatter
        ? s.label.formatter({ kind: 'line', lengthMeters })
        : `${formatDistance(lengthMeters)}`;
      const mid = { lng: (positions[0].lng + positions[positions.length - 1].lng) / 2, lat: (positions[0].lat + positions[positions.length - 1].lat) / 2, height: 0 };
      this.dataSource.entities.add({
        id: `${id}-label`,
        position: lngLatHeightToCartesian(mid, false),
        label: this.buildLabelGraphic(text),
      });
    }

    return id;
  }

  drawPolygon(positions: LngLatHeight[], style?: DrawStyle): string {
    const s = getStyleDefaults('polygon', style);
    const id = this.nextId('draw-polygon');

    const cartesianPositions = positions.map((p) => lngLatHeightToCartesian(p, false));
    this.dataSource.entities.add({
      id,
      polygon: {
        hierarchy: cartesianPositions,
        material: this.buildPolygonMaterial(s),
        outline: s.outline,
        outlineColor: normalizeColor(s.outlineColor),
        outlineWidth: s.outlineWidth,
        heightReference: s.heightReference,
      },
    });
    this.addGroundOutline(id, [...positions, positions[0]], s);

    if (s.label?.enabled && normalizeLabelModes(s.label.mode).includes('area')) {
      const areaSquareMeters = getPolygonAreaSquareMeters(positions);
      const text = s.label.formatter
        ? s.label.formatter({ kind: 'polygon', areaSquareMeters })
        : `${formatArea(areaSquareMeters)}`;
      const center = getLngLatCentroid(positions);
      this.dataSource.entities.add({
        id: `${id}-label`,
        position: lngLatHeightToCartesian(center, false),
        label: this.buildLabelGraphic(text),
      });
    }

    return id;
  }

  drawRectangle(cornerA: LngLatHeight, cornerB: LngLatHeight, style?: DrawStyle): string {
    const s = getStyleDefaults('rectangle', style);
    const id = this.nextId('draw-rectangle');

    const west = Math.min(cornerA.lng, cornerB.lng);
    const east = Math.max(cornerA.lng, cornerB.lng);
    const south = Math.min(cornerA.lat, cornerB.lat);
    const north = Math.max(cornerA.lat, cornerB.lat);

    const hierarchy = [
      { lng: west, lat: south, height: 0 },
      { lng: east, lat: south, height: 0 },
      { lng: east, lat: north, height: 0 },
      { lng: west, lat: north, height: 0 },
    ];

    this.dataSource.entities.add({
      id,
      rectangle: {
        coordinates: Rectangle.fromDegrees(west, south, east, north),
        material: this.buildPolygonMaterial(s, s.materials?.rectangle),
        outline: s.outline,
        outlineColor: normalizeColor(s.outlineColor),
        outlineWidth: s.outlineWidth,
      },
    });
    this.addGroundOutline(id, [...hierarchy, hierarchy[0]], s);

    if (s.label?.enabled && normalizeLabelModes(s.label.mode).includes('area')) {
      const areaSquareMeters = getPolygonAreaSquareMeters(hierarchy);
      const text = s.label.formatter
        ? s.label.formatter({ kind: 'rectangle', areaSquareMeters })
        : `${formatArea(areaSquareMeters)}`;
      const center: LngLatHeight = { lng: (west + east) / 2, lat: (south + north) / 2, height: 0 };
      this.dataSource.entities.add({
        id: `${id}-label`,
        position: lngLatHeightToCartesian(center, false),
        label: this.buildLabelGraphic(text),
      });
    }

    return id;
  }

  drawCircle(center: LngLatHeight, radiusMeters: number, style?: DrawStyle): string {
    const s = getStyleDefaults('circle', style);
    const id = this.nextId('draw-circle');
    const circlePoints = getCircleOutlinePositions(center, radiusMeters);

    this.dataSource.entities.add({
      id,
      polygon: {
        hierarchy: new PolygonHierarchy(
          circlePoints.map((point) => lngLatHeightToCartesian(point, false)),
        ),
        material: s.fill
          ? this.buildPolygonMaterial(s, s.materials?.polygon)
          : Color.TRANSPARENT,
        outline: false,
        heightReference: s.heightReference,
      },
    });
    this.addGroundOutline(id, circlePoints, s);

    if (s.label?.enabled && normalizeLabelModes(s.label.mode).includes('area')) {
      const areaSquareMeters = Math.PI * radiusMeters * radiusMeters;
      const text = s.label.formatter
        ? s.label.formatter({ kind: 'circle', areaSquareMeters })
        : `${formatArea(areaSquareMeters)}`;
      this.dataSource.entities.add({
        id: `${id}-label`,
        position: lngLatHeightToCartesian(center, false),
        label: this.buildLabelGraphic(text),
      });
    }

    return id;
  }

  // -------- 交互式 API --------

  startInteractiveDraw(options: InteractiveOptions) {
    if (this.active) {
      this.cancel();
    }
    const style = getStyleDefaults(options.kind, options.style);
    const endMode = options.endMode ?? 'dblclick';

    if (options.clearBefore) {
      this.clear();
    }

    this.active = true;
    this.session = {
      ...options,
      style,
      endMode,
      vertices: [],
      createdIds: [],
      previewIds: [],
    };

    const { handler, onKeyDown } = this.createHandler(endMode);
    this.handler = handler;
    if (onKeyDown) {
      this.session.onKeyDown = onKeyDown;
      window.addEventListener('keydown', onKeyDown);
    }

    this.bindHandlersForKind(options.kind);
  }

  cancel() {
    if (!this.active) return;
    const onCancel = this.session?.onCancel;
    if (this.session?.onKeyDown) {
      window.removeEventListener('keydown', this.session.onKeyDown);
    }
    this.session?.previewIds.forEach((id) => this.removeEntityById(id));
    this.session?.createdIds.forEach((id) => this.removeEntityById(id));
    this.session = undefined;

    if (this.handler) {
      this.handler.destroy();
    }
    this.handler = null;
    this.active = false;
    try {
      onCancel?.();
    } catch {
      // 忽略错误
    }
  }

  /**
   * 只在 `endMode: 'manual'` 时生效。
   * 用于结束 polygon / 其他需要你手动确认的场景。
   */
  finish() {
    if (!this.active || !this.session) return;
    if (!supportsManualFinish(this.session.endMode)) return;
    if (this.session.kind === 'line') {
      this.finishLine();
      return;
    }
    if (this.session.kind === 'polygon') {
      this.finishPolygon();
      return;
    }
    // 其他类型默认会在点击够点数后自动结束
  }

  private createHandler(endMode: EndMode) {
    const handler = new ScreenSpaceEventHandler(this.viewer.canvas);
    let onKeyDown: ((e: KeyboardEvent) => void) | undefined;
    if (supportsKeyboardFinish(endMode)) {
      onKeyDown = (e) => {
        if (!this.active || !this.session) return;
        if (e.key === 'Enter') {
          // 结束连续线或多边形
          if (this.session.kind === 'line') {
            this.finishLine();
            return;
          }
          if (this.session.kind === 'polygon') {
            this.finishPolygon();
            return;
          }
        }
        if (e.key === 'Escape') {
          this.cancel();
        }
      };
    }
    return { handler, onKeyDown };
  }

  private bindHandlersForKind(kind: DrawKind) {
    if (!this.handler || !this.session) return;
    const { style } = this.session;

    this.handler.setInputAction((movement: { position?: { x: number; y: number } }) => {
      if (!this.active || !this.session) return;
      const pos = pickPositionFromMouse(this.viewer, movement.position);
      if (!pos) return;

      if (kind === 'point') {
        const id = this.drawPoint(pos, this.session.style);
        this.session.createdIds.push(id);
        this.complete({ kind: 'point', position: { lng: pos.lng, lat: pos.lat, height: 0 }, id });
        return;
      }

      if (kind === 'line') {
        if (this.session.vertices.length === 0) {
          this.session.vertices.push(pos);
          this.session.previewIds = this.session.previewIds.filter(Boolean);
          return;
        }
        this.session.vertices.push(pos);
        if (this.session.vertices.length >= 2) {
          this.updateLinePreview(this.session.vertices, pos, style);
        }
        return;
      }

      if (kind === 'rectangle') {
        if (this.session.vertices.length === 0) {
          this.session.vertices.push(pos);
          return;
        }
        if (this.session.vertices.length === 1) {
          const [a] = this.session.vertices;
          const id = this.drawRectangle(a, pos, this.session.style);
          this.removePreviewEntities();
          this.session.createdIds.push(id);
          this.complete({ kind: 'rectangle', west: Math.min(a.lng, pos.lng), south: Math.min(a.lat, pos.lat), east: Math.max(a.lng, pos.lng), north: Math.max(a.lat, pos.lat), id });
        }
        return;
      }

      if (kind === 'circle') {
        if (this.session.vertices.length === 0) {
          this.session.vertices.push(pos); // 圆心
          return;
        }
        if (this.session.vertices.length === 1) {
          const center = this.session.vertices[0];
          const radiusMeters = getSurfaceDistanceMeters(center, pos);
          if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
            return;
          }
          const id = this.drawCircle(center, radiusMeters, this.session.style);
          this.removePreviewEntities();
          this.session.createdIds.push(id);
          this.complete({ kind: 'circle', center, radiusMeters, id });
        }
        return;
      }

      if (kind === 'polygon') {
        if (this.session.vertices.length === 0) {
          // 只要开始画 polygon，就初始化顶点预览
        }
        this.session.vertices.push(pos);
        // 为每个顶点创建实体（可选显示编号/自定义文字）
        const vertexId = this.drawVertexEntity(this.session.vertices.length - 1, pos, this.session.style);
        this.session.createdIds.push(vertexId);
        // 边界折线在 mouse move 才创建会导致“点第2个点后不移动鼠标看不到边框”。
        // 这里在点到至少 2 个顶点后，立即触发一次预览更新（用当前点击点作为 hover）。
        if (this.session.vertices.length >= 2) {
          this.updatePolygonPreview(this.session.vertices, pos, style);
        }
        return;
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction(() => {
      if (!this.active || !this.session) return;
      if (shouldFinishOnRightClick(this.session.kind, this.session.endMode)) {
        if (this.session.kind === 'line') {
          this.finishLine();
          return;
        }
        this.finishPolygon();
        return;
      }
      this.cancel();
    }, ScreenSpaceEventType.RIGHT_CLICK);

    // 默认：双击用于结束 polygon
    this.handler.setInputAction(() => {
      if (!this.active || !this.session) return;
      if (this.session.kind === 'polygon' && this.session.endMode === 'dblclick') {
        this.finishPolygon();
      }
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // 鼠标移动预览
    this.handler.setInputAction((movement: { endPosition?: { x: number; y: number } } & { position?: { x: number; y: number } }) => {
      if (!this.active || !this.session) return;
      const rawPos = (movement as any)?.endPosition ?? (movement as any)?.position;
      const pos = pickPositionFromMouse(this.viewer, rawPos);
      if (!pos) return;

      if (kind === 'line') {
        if (this.session.vertices.length < 1) return;
        this.updateLinePreview(this.session.vertices, pos, style);
        return;
      }

      if (kind === 'rectangle') {
        if (this.session.vertices.length !== 1) return;
        this.updateRectanglePreview(this.session.vertices[0], pos, style);
        return;
      }

      if (kind === 'circle') {
        if (this.session.vertices.length !== 1) return;
        this.updateCirclePreview(this.session.vertices[0], pos, style);
        return;
      }

      if (kind === 'polygon') {
        if (this.session.vertices.length < 1) return;
        this.updatePolygonPreview(this.session.vertices, pos, style);
        return;
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
  }

  private complete(result: DrawResult) {
    if (!this.active || !this.session) return;
    const cb = this.session.onComplete;
    const createdIds = [...this.session.createdIds];
    const previewIds = this.session.previewIds;
    this.active = false;

    // 移除尚未结束前的预览图形
    previewIds.forEach((id) => this.removeEntityById(id));
    if (this.handler) {
      this.handler.destroy();
    }
    this.handler = null;

    if (this.session.onKeyDown) {
      window.removeEventListener('keydown', this.session.onKeyDown);
    }

    this.session = undefined;
    cb?.({ ...result, session: { entityIds: createdIds } });
  }

  private removeEntityById(id: string) {
    const entity = this.dataSource.entities.getById(id);
    if (entity) {
      this.dataSource.entities.remove(entity);
    }
  }

  private removePreviewEntities() {
    if (!this.session) return;
    this.session.previewIds.forEach((id) => this.removeEntityById(id));
    this.session.previewIds = [];
    this.session.previewLineId = undefined;
    this.session.previewLineHover = null;
    this.session.previewRectangleId = undefined;
    this.session.previewRectangleHover = null;
    this.session.previewCircleId = undefined;
    this.session.previewCircleEdge = null;
    this.session.previewPolygonOutlineId = undefined;
    this.session.previewPolygonFillId = undefined;
    this.session.previewPolygonHover = null;
  }

  private buildLabelGraphic(text: string) {
    return {
      text,
      font: '14px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, Arial',
      pixelOffset: new Cartesian2(0, -18),
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.BOTTOM,
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.55)'),
      style: LabelStyle.FILL_AND_OUTLINE,
    } as any;
  }

  private buildPolylineMaterial(s: Required<DrawStyle>) {
    if (s.dashed) {
      const dashLength = typeof s.dashed === 'object' ? s.dashed.dashLength ?? 12 : 12;
      const dashColor = normalizeColor(s.color, Color.WHITE);
      // 该材质用于实现虚线折线效果
      return new PolylineDashMaterialProperty({
        color: dashColor,
        dashLength,
      });
    }

    // 若用户提供了自定义折线材质，则优先使用
    if (s.materials?.polyline) return s.materials.polyline;

    return normalizeColor(s.color, Color.WHITE);
  }

  private buildPolygonMaterial(s: Required<DrawStyle>, materialOverride?: MaterialProperty) {
    const custom = materialOverride ?? s.materials?.polygon;
    if (custom) return custom;
    // Cesium 的材质允许直接传入 `Color`
    if (!s.fill) return Color.TRANSPARENT;
    return normalizeColor(s.fillColor, Color.TRANSPARENT);
  }

  /**
   * 原生区域 outline 在贴地渲染时可能被地形遮挡，额外绘制贴地折线以保证边框可见。
   */
  private addGroundOutline(id: string, positions: LngLatHeight[], style: Required<DrawStyle>) {
    this.dataSource.entities.add({
      id: `${id}-outline`,
      polyline: {
        positions: positions.map((position) => lngLatHeightToCartesian(position, false)),
        width: style.outlineWidth,
        material: normalizeColor(style.outlineColor),
        clampToGround: true,
        show: style.outline,
      },
    });
  }

  private drawVertexEntity(index: number, pos: LngLatHeight, style: Required<DrawStyle>) {
    const id = this.nextId('draw-vertex');
    const color = normalizeColor(style.color, Color.RED);
    const outlineColor = normalizeColor(style.outlineColor, Color.WHITE);
    this.dataSource.entities.add({
      id,
      position: lngLatHeightToCartesian(pos, false),
      point: {
        pixelSize: style.point.pixelSize,
        color,
        outlineColor,
        outlineWidth: style.point.outlineWidth,
        heightReference: style.heightReference,
      },
    });

    if (style.label?.enabled) {
      const modes = normalizeLabelModes(style.label.mode);
      let text = '';
      if (modes.includes('custom') && style.label.formatter) {
        text = style.label.formatter({ kind: 'polygon', index, lngLat: pos });
      } else if (modes.includes('index')) {
        text = formatVertexIndex(index);
      }
      if (text) {
        this.dataSource.entities.add({
          id: `${id}-label`,
          position: lngLatHeightToCartesian(pos, false),
          label: {
            text,
            font: '14px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, Arial',
            pixelOffset: new Cartesian2(0, -20),
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.BOTTOM,
            fillColor: Color.WHITE,
            showBackground: true,
            backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.55)'),
            style: LabelStyle.FILL_AND_OUTLINE,
          } as any,
        });
      }
    }
    return id;
  }

  private updateLinePreview(vertices: LngLatHeight[], end: LngLatHeight, style: Required<DrawStyle>) {
    if (!this.session) return;
    this.session.previewLineHover = end;

    if (this.session.previewLineId) {
      return;
    }

    const id = this.nextId('preview-line');
    this.dataSource.entities.add({
      id,
      polyline: {
        positions: new CallbackProperty(() => {
          const hover = this.session?.previewLineHover;
          const points = this.session?.vertices ?? vertices;
          if (!hover) return points.map((point) => lngLatHeightToCartesian(point, false));
          return [...points, hover].map((point) => lngLatHeightToCartesian(point, false));
        }, false),
        width: style.lineWidth,
        material: this.buildPolylineMaterial(style),
        clampToGround: true,
      },
    });
    this.session.previewLineId = id;
    this.session.previewIds.push(id);
  }

  private updateRectanglePreview(a: LngLatHeight, b: LngLatHeight, style: Required<DrawStyle>) {
    if (!this.session) return;
    this.session.previewRectangleHover = b;
    if (this.session.previewRectangleId) {
      return;
    }

    const id = this.nextId('preview-rectangle');
    this.dataSource.entities.add({
      id,
      rectangle: {
        coordinates: new CallbackProperty(() => {
          const hover = this.session?.previewRectangleHover;
          const rb = hover ?? a;
          const west = Math.min(a.lng, rb.lng);
          const east = Math.max(a.lng, rb.lng);
          const south = Math.min(a.lat, rb.lat);
          const north = Math.max(a.lat, rb.lat);
          return Rectangle.fromDegrees(west, south, east, north);
        }, false),
        material: style.fill
          ? this.buildPolygonMaterial(style, style.materials?.rectangle)
          : Color.TRANSPARENT,
        outline: style.outline,
        outlineColor: normalizeColor(style.outlineColor),
        outlineWidth: style.outlineWidth,
      },
    });
    this.dataSource.entities.add({
      id: `${id}-outline`,
      polyline: {
        positions: new CallbackProperty(() => {
          const hover = this.session?.previewRectangleHover ?? a;
          const west = Math.min(a.lng, hover.lng);
          const east = Math.max(a.lng, hover.lng);
          const south = Math.min(a.lat, hover.lat);
          const north = Math.max(a.lat, hover.lat);
          return [
            { lng: west, lat: south },
            { lng: east, lat: south },
            { lng: east, lat: north },
            { lng: west, lat: north },
            { lng: west, lat: south },
          ].map((position) => lngLatHeightToCartesian(position, false));
        }, false),
        width: style.outlineWidth,
        material: normalizeColor(style.outlineColor),
        clampToGround: true,
        show: style.outline,
      },
    });
    this.session.previewRectangleId = id;
    this.session.previewIds.push(id);
    this.session.previewIds.push(`${id}-outline`);
  }

  private updateCirclePreview(center: LngLatHeight, edge: LngLatHeight, style: Required<DrawStyle>) {
    if (!this.session) return;
    this.session.previewCircleEdge = edge;
    if (this.session.previewCircleId) {
      return;
    }

    const id = this.nextId('preview-circle');
    this.dataSource.entities.add({
      id,
      polygon: {
        hierarchy: new CallbackProperty(() => {
          const currentEdge = this.session?.previewCircleEdge;
          if (!currentEdge) return new PolygonHierarchy([]);
          const radius = getSurfaceDistanceMeters(center, currentEdge);
          if (!Number.isFinite(radius) || radius <= 0) {
            return new PolygonHierarchy([]);
          }
          return new PolygonHierarchy(
            getCircleOutlinePositions(center, radius).map((point) =>
              lngLatHeightToCartesian(point, false),
            ),
          );
        }, false),
        material: style.fill
          ? this.buildPolygonMaterial(style, style.materials?.polygon)
          : Color.TRANSPARENT,
        outline: false,
        heightReference: style.heightReference,
      },
    });
    this.dataSource.entities.add({
      id: `${id}-outline`,
      polyline: {
        positions: new CallbackProperty(() => {
          const currentEdge = this.session?.previewCircleEdge;
          if (!currentEdge) return [];
          const radius = getSurfaceDistanceMeters(center, currentEdge);
          if (!Number.isFinite(radius) || radius <= 0) return [];
          return getCircleOutlinePositions(center, radius).map((position) =>
            lngLatHeightToCartesian(position, false),
          );
        }, false),
        width: style.outlineWidth,
        material: normalizeColor(style.outlineColor),
        clampToGround: true,
        show: style.outline,
      },
    });
    this.session.previewCircleId = id;
    this.session.previewIds.push(id);
    this.session.previewIds.push(`${id}-outline`);
  }

  private updatePolygonPreview(vertices: LngLatHeight[], hover: LngLatHeight, style: Required<DrawStyle>) {
    if (!this.session) return;
    this.session.previewPolygonHover = hover;

    const ensureFill = () => {
      if (this.session?.previewPolygonFillId) return;
      const id = this.nextId('preview-polygon-fill');
      this.dataSource.entities.add({
        id,
        polygon: {
          hierarchy: new CallbackProperty(() => {
            try {
              const v = this.session?.vertices ?? [];
              const h = this.session?.previewPolygonHover;
              if (v.length < 3 || !h) {
                return new PolygonHierarchy([]);
              }
              const points = [...v, h];
              const positions = points
                .map((p) => lngLatHeightToCartesian(p, false))
                .filter((p) => !!p);
              return new PolygonHierarchy(positions);
            } catch {
              return new PolygonHierarchy([]);
            }
          }, false),
          material: style.fill ? this.buildPolygonMaterial(style, style.materials?.polygon) : Color.TRANSPARENT,
          outline: style.outline,
          outlineColor: normalizeColor(style.outlineColor),
          outlineWidth: style.outlineWidth,
          heightReference: style.heightReference,
          // 只在点数足够且有 hover 时显示
          show: new CallbackProperty(() => {
            const v = this.session?.vertices ?? [];
            return v.length >= 3 && !!this.session?.previewPolygonHover;
          }, false),
        },
      });
      this.session!.previewPolygonFillId = id;
      this.session!.previewIds.push(id);
    };
    const ensureOutline = () => {
      if (this.session?.previewPolygonOutlineId) return;
      const id = this.nextId('preview-polygon-outline');
      this.dataSource.entities.add({
        id,
        polyline: {
          positions: new CallbackProperty(() => {
            const points = [...(this.session?.vertices ?? [])];
            const currentHover = this.session?.previewPolygonHover;
            if (currentHover) points.push(currentHover);
            if (points.length < 2) return [];
            return [...points, points[0]].map((position) => lngLatHeightToCartesian(position, false));
          }, false),
          width: style.outlineWidth,
          material: normalizeColor(style.outlineColor),
          clampToGround: true,
          show: style.outline,
        },
      });
      this.session!.previewPolygonOutlineId = id;
      this.session!.previewIds.push(id);
    };
    ensureFill();
    ensureOutline();
  }

  private finishPolygon() {
    if (!this.active || !this.session) return;
    if (this.session.kind !== 'polygon') return;
    if (this.session.vertices.length < 3 || distinctPositionCount(this.session.vertices) < 3 ||
        getPolygonAreaSquareMeters(this.session.vertices) <= 0.01) {
      // 点数不足以构成面
      this.cancel();
      return;
    }

    this.removePreviewEntities();
    const positions = [...this.session.vertices];
    const id = this.drawPolygon(positions, this.session.style);

    // 顶点实体 id 已在交互阶段创建并加入 createdIds
    // 面实体 id 由 drawPolygon 返回，并且面积标签会在 drawPolygon 内部生成
    this.session.createdIds.push(id);

    this.complete({
      kind: 'polygon',
      positions,
      id,
    });
  }

  private finishLine() {
    if (!this.active || !this.session || this.session.kind !== 'line') return;
    if (this.session.vertices.length < 2 || distinctPositionCount(this.session.vertices) < 2 ||
        getPathLengthMeters(this.session.vertices) <= 0.01) {
      this.cancel();
      return;
    }
    this.removePreviewEntities();
    const positions = [...this.session.vertices];
    const id = this.drawLine(positions, this.session.style);
    this.session.createdIds.push(id);
    this.complete({ kind: 'line', positions, id });
  }
}
