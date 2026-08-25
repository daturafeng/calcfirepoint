import invertedTriangleUrl from '@/utils/cesium/png/inverted-triangle.png';
import {
  GROUND_PROJECTION_PICK_DELAY_MS,
  formatWaylineAltitude,
  formatWaylineDistance,
  getActiveWaypointSegments,
  getGroundProjectionOrigin,
  getGroundProjectionPoint,
  getHorizontalDistanceMeters,
  pickGroundProjectionPoint,
  shouldShowEditorVehicleGroundProjection,
} from '@/utils/cesium/waylineEditorVisuals';
import {
  buildWaypointTurnPreview,
  type PolygonCameraConfig,
  type WaylinePoint,
  type WaylineReferencePoint,
  type WaypointTurnType,
} from '@/utils/wayline';
import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Color,
  ConstantProperty,
  CustomDataSource,
  Entity,
  HeadingPitchRoll,
  HorizontalOrigin,
  IntersectionTests,
  LabelStyle,
  Matrix4,
  PolygonHierarchy,
  PolylineArrowMaterialProperty,
  PolylineDashMaterialProperty,
  Quaternion,
  Ray,
  Rectangle,
  Transforms,
  VerticalOrigin,
  type Viewer,
} from 'cesium';

type CurrentPointModelConfig = {
  uri: string;
  initialHeadingDeg?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  sourceSizeMeters?: number;
  targetPixelSize?: number;
  minScale?: number;
  maxScale?: number;
};

type FrustumCameraConfig = Pick<
  PolygonCameraConfig,
  'sensorWidth' | 'sensorHeight' | 'focalLength'
>;

type MostDetailedRayPickResult = { position?: Cartesian3 } | undefined;

type SceneWithMostDetailedRayPick = {
  pickFromRayMostDetailed?: (
    ray: Ray,
    objectsToExclude?: unknown[],
  ) => Promise<MostDetailedRayPickResult>;
};

export interface WaylineFitToPointsOptions {
  paddingRatio?: number;
  minPaddingDegrees?: number;
  duration?: number;
}

export const WAYLINE_ROUTE_FIT_OPTIONS: Readonly<WaylineFitToPointsOptions> = {
  paddingRatio: 0.36,
  minPaddingDegrees: 0.0018,
};

const ACTIVE_POINT_FRUSTUM_LENGTH_METERS = 180;
const CAMERA_EQUIVALENT_SENSOR_WIDTH_MM = 36;
const CAMERA_EQUIVALENT_SENSOR_HEIGHT_MM = 24;
const CAMERA_BASE_EQUIVALENT_FOCAL_LENGTH_MM = 24;
const CAMERA_MAX_EQUIVALENT_FOCAL_LENGTH_MM =
  112 * CAMERA_BASE_EQUIVALENT_FOCAL_LENGTH_MM;

type PreviewDragState = {
  index: number;
  lng: number;
  lat: number;
} | null;

function toCartesianFlatArray(points: WaylinePoint[]) {
  return points.flatMap((point) => [point.lng, point.lat, point.height || 0]);
}

function formatAreaSquareMeters(areaSquareMeters: number) {
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0)
    return '0 m²';
  if (areaSquareMeters < 1_000_000) return `${areaSquareMeters.toFixed(1)} m²`;
  return `${(areaSquareMeters / 1_000_000).toFixed(2)} km²`;
}

function polygonAreaSquareMeters(points: Pick<WaylinePoint, 'lat' | 'lng'>[]) {
  if (points.length < 3) return 0;
  const R = 6378137;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const origin = points[0];
  const originLat = toRad(origin.lat);
  const proj = points.map((p) => {
    const x = ((p.lng - origin.lng) * Math.PI * R * Math.cos(originLat)) / 180;
    const y = ((p.lat - origin.lat) * Math.PI * R) / 180;
    return { x, y };
  });
  let area = 0;
  for (let i = 0; i < proj.length; i += 1) {
    const j = (i + 1) % proj.length;
    area += proj[i].x * proj[j].y - proj[j].x * proj[i].y;
  }
  return Math.abs(area / 2);
}

function polygonCentroid(points: Pick<WaylinePoint, 'lat' | 'lng'>[]) {
  if (!points.length) return { lng: 0, lat: 0 };
  const sum = points.reduce(
    (acc, p) => {
      acc.lng += p.lng;
      acc.lat += p.lat;
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return { lng: sum.lng / points.length, lat: sum.lat / points.length };
}

function normalizeHeadingAngle(angle: number) {
  let normalized = angle;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return Number(normalized.toFixed(6));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPositiveNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function getPointFocalLengthMm(
  point: WaylinePoint,
  cameraConfig?: FrustumCameraConfig | null,
) {
  const rawZoomFactor = point.zoomFactor ?? 1;
  const baseFocalLengthMm = getPositiveNumber(
    cameraConfig?.focalLength,
    CAMERA_BASE_EQUIVALENT_FOCAL_LENGTH_MM,
  );
  if (!Number.isFinite(rawZoomFactor) || rawZoomFactor <= 0) {
    return baseFocalLengthMm;
  }
  const focalLengthMm = point.zoomUseFocalFactor
    ? rawZoomFactor
    : rawZoomFactor * baseFocalLengthMm;
  return clampNumber(
    focalLengthMm,
    baseFocalLengthMm,
    Math.max(
      baseFocalLengthMm,
      baseFocalLengthMm * 112,
      CAMERA_MAX_EQUIVALENT_FOCAL_LENGTH_MM,
    ),
  );
}

function getPointCameraHalfFov(
  point: WaylinePoint,
  cameraConfig?: FrustumCameraConfig | null,
) {
  const sensorWidthMm = getPositiveNumber(
    cameraConfig?.sensorWidth,
    CAMERA_EQUIVALENT_SENSOR_WIDTH_MM,
  );
  const sensorHeightMm = getPositiveNumber(
    cameraConfig?.sensorHeight,
    CAMERA_EQUIVALENT_SENSOR_HEIGHT_MM,
  );
  const focalLengthMm = getPointFocalLengthMm(point, cameraConfig);
  return {
    horizontalHalfAngleRad: Math.atan(sensorWidthMm / (2 * focalLengthMm)),
    verticalHalfAngleRad: Math.atan(sensorHeightMm / (2 * focalLengthMm)),
  };
}

/**
 * 航线编辑器地图渲染控制器：管理边界点/扫描线实体，以及“相邻两点距离”标签。
 * 设计目标：把 WaylineEditor/CesiumMap.tsx 的业务渲染逻辑抽离为可复用的 class。
 */
export class WaylineEditorMap {
  private viewer: Viewer;
  private dataSource: CustomDataSource;
  private showSegmentDistances: boolean;
  private showAreaLabel: boolean;

  private boundaryPoints: WaylinePoint[] = [];
  private normalPolylinePoints: WaylinePoint[] = [];
  private scanPathPoints: WaylinePoint[] = [];
  private takeoffTransitionPoints: WaylinePoint[] = [];
  private takeoffReferencePoint: WaylineReferencePoint | null = null;
  private isPatrolMode = false;
  private waypointTurnType: WaypointTurnType = 'stopAndTurn';
  private enableWaypointRouteFeatures = false;
  private selectedPointIndex: number | null = null;
  private selectedPointAltitude: number | null = null;
  private editorVehiclePoint: WaylinePoint | null = null;
  private dragHeightPreview: { index: number; height: number } | null = null;

  private previewDrag: PreviewDragState = null;
  private prevBoundaryPointCount = 0;
  private pointPositionMap: Record<string, Cartesian3> = {};
  private pointOrientationMap: Record<string, Quaternion> = {};
  private pointScaleMap: Record<string, number> = {};
  private polylinePositionsMap: Record<string, Cartesian3[]> = {};
  private polygonHierarchyMap: Record<string, PolygonHierarchy> = {};
  private currentPointModel: CurrentPointModelConfig | null;
  private currentPointCamera: FrustumCameraConfig | null;
  private editorVehicleGroundProjectionRequestVersion = 0;
  private editorVehicleGroundProjectionKey = '';
  private editorVehicleGroundProjectionPoint: Cartesian3 | null = null;
  private editorVehicleGroundProjectionTimer: number | null = null;

  constructor(
    viewer: Viewer,
    opts?: {
      dataSource?: CustomDataSource;
      dataSourceId?: string;
      showSegmentDistances?: boolean;
      showAreaLabel?: boolean;
      currentPointModel?: CurrentPointModelConfig;
      currentPointCamera?: FrustumCameraConfig | null;
      enableWaypointRouteFeatures?: boolean;
    },
  ) {
    this.viewer = viewer;
    this.dataSource =
      opts?.dataSource ??
      new CustomDataSource(opts?.dataSourceId ?? 'wayline-editor-layer');
    this.showSegmentDistances = opts?.showSegmentDistances ?? true;
    this.showAreaLabel = opts?.showAreaLabel ?? false;
    this.currentPointModel = opts?.currentPointModel ?? null;
    this.currentPointCamera = opts?.currentPointCamera ?? null;
    this.enableWaypointRouteFeatures =
      opts?.enableWaypointRouteFeatures ?? false;
    if (!opts?.dataSource) {
      this.viewer.dataSources.add(this.dataSource);
    }
  }

  setShowSegmentDistances(next: boolean) {
    this.showSegmentDistances = next;
    this.sync();
  }

  setShowAreaLabel(next: boolean) {
    this.showAreaLabel = next;
    this.sync();
  }

  setCurrentPointCamera(next: FrustumCameraConfig | null) {
    this.currentPointCamera = next;
    this.sync();
  }

  destroy() {
    this.dataSource.entities.removeAll();
    try {
      this.viewer.dataSources.remove(this.dataSource);
    } catch {
      /* ignore */
    }
  }

  setDragPreview(preview: PreviewDragState) {
    this.previewDrag = preview;
    this.sync();
  }

  setData(input: {
    boundaryPoints: WaylinePoint[];
    normalPolylinePoints: WaylinePoint[];
    scanPathPoints: WaylinePoint[];
    takeoffTransitionPoints?: WaylinePoint[];
    takeoffReferencePoint?: WaylineReferencePoint | null;
    enableWaypointRouteFeatures?: boolean;
    isPatrolMode: boolean;
    waypointTurnType?: WaypointTurnType;
    selectedPointIndex: number | null;
    selectedPointAltitude?: number | null;
    editorVehiclePoint?: WaylinePoint | null;
    dragHeightPreview?: { index: number; height: number } | null;
  }) {
    this.boundaryPoints = input.boundaryPoints;
    this.normalPolylinePoints = input.normalPolylinePoints;
    this.scanPathPoints = input.scanPathPoints;
    this.takeoffTransitionPoints = input.takeoffTransitionPoints || [];
    this.takeoffReferencePoint = input.takeoffReferencePoint ?? null;
    this.enableWaypointRouteFeatures =
      input.enableWaypointRouteFeatures ?? false;
    this.isPatrolMode = input.isPatrolMode;
    this.waypointTurnType = input.waypointTurnType ?? 'stopAndTurn';
    this.selectedPointIndex = input.selectedPointIndex;
    this.selectedPointAltitude = input.selectedPointAltitude ?? null;
    this.editorVehiclePoint = input.editorVehiclePoint ?? null;
    this.dragHeightPreview = input.dragHeightPreview ?? null;
    this.sync();
  }

  /** 适配显示航线：俯视（pitch=-90°），避免斜视。 */
  fitToPoints(
    points: Array<Pick<WaylineReferencePoint, 'lat' | 'lng' | 'height'>>,
    options?: WaylineFitToPointsOptions,
  ) {
    if (!points || points.length === 0) {
      return;
    }
    if (points.length === 1) {
      const [singlePoint] = points;
      if (!singlePoint) {
        return;
      }
      const pointHeight =
        Number.isFinite(singlePoint.height) && singlePoint.height !== undefined
          ? singlePoint.height
          : 0;
      const cameraHeight = Math.max(pointHeight + 180, pointHeight * 1.35, 520);
      this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          singlePoint.lng,
          singlePoint.lat,
          cameraHeight,
        ),
        duration: options?.duration ?? 0.6,
        orientation: {
          heading: 0,
          pitch: -Math.PI / 2,
          roll: 0,
        },
      });
      return;
    }
    // 用四向范围拟合（比 BoundingSphere 在俯视时更稳，避免部分点被裁切）
    let west = Number.POSITIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      if (!p) continue;
      if (p.lng < west) west = p.lng;
      if (p.lng > east) east = p.lng;
      if (p.lat < south) south = p.lat;
      if (p.lat > north) north = p.lat;
    }
    if (
      !Number.isFinite(west) ||
      !Number.isFinite(south) ||
      !Number.isFinite(east) ||
      !Number.isFinite(north)
    ) {
      return;
    }

    // 预留边缘留白（按经纬度跨度比例扩展；跨度过小时给一个最小值）
    const padRatio = options?.paddingRatio ?? 0.12;
    const minPadDeg = options?.minPaddingDegrees ?? 0.0008; // ~90m
    const lngSpan = Math.max(east - west, minPadDeg);
    const latSpan = Math.max(north - south, minPadDeg);
    const padLng = Math.max(minPadDeg, lngSpan * padRatio);
    const padLat = Math.max(minPadDeg, latSpan * padRatio);

    const rect = Rectangle.fromDegrees(
      west - padLng,
      south - padLat,
      east + padLng,
      north + padLat,
    );
    this.viewer.camera.flyTo({
      destination: rect,
      duration: options?.duration ?? 0.6,
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
    });
  }

  private getPreviewBoundaryPoints() {
    const points = this.boundaryPoints;
    const p = this.previewDrag;
    if (!p || !points[p.index]) {
      return points;
    }
    return points.map((pt, idx) =>
      idx === p.index ? { ...pt, lng: p.lng, lat: p.lat } : pt,
    );
  }

  private syncTakeoffReferencePoint() {
    const id = 'takeoff-reference-point';
    const posId = 'takeoff-reference-point-pos';
    const point = this.takeoffReferencePoint;
    if (!point) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[posId];
      return;
    }

    this.pointPositionMap[posId] = Cartesian3.fromDegrees(
      point.lng,
      point.lat,
      point.height || 0,
    );
    const existed = this.dataSource.entities.getById(id);
    if (existed) {
      return;
    }

    this.dataSource.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[posId],
        false,
      ),
      point: {
        pixelSize: 16,
        color: Color.fromCssColorString('#13c2c2'),
        outlineColor: Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '参考起飞点',
        font: '600 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, Arial',
        pixelOffset: new Cartesian2(14, -10),
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.BOTTOM,
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('rgba(19,194,194,0.88)'),
        outlineColor: Color.fromCssColorString('rgba(0,0,0,0.88)'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        backgroundPadding: new Cartesian2(10, 6),
      },
    });
  }

  private syncTakeoffTransitionLine() {
    const id = 'takeoff-transition-line';
    if (this.takeoffTransitionPoints.length < 2) {
      this.dataSource.entities.removeById(id);
      delete this.polylinePositionsMap[id];
      return;
    }

    this.polylinePositionsMap[id] = Cartesian3.fromDegreesArrayHeights(
      toCartesianFlatArray(this.takeoffTransitionPoints),
    );
    const existed = this.dataSource.entities.getById(id);
    if (existed) {
      return;
    }

    this.dataSource.entities.add({
      id,
      polyline: {
        positions: new CallbackProperty(
          () => this.polylinePositionsMap[id],
          false,
        ),
        material: new PolylineDashMaterialProperty({
          color: Color.fromCssColorString('#13c2c2'),
          dashLength: 14,
        }),
        depthFailMaterial: Color.fromCssColorString('#13c2c2'),
        width: 3,
      },
    });
  }

  private syncBoundaryPoint(index: number) {
    const id = `boundary-point-${index}`;
    const target = this.getPreviewBoundaryPoints()[index];
    if (!target) return;
    this.pointPositionMap[id] = Cartesian3.fromDegrees(
      target.lng,
      target.lat,
      target.height || 0,
    );
    const isSelected = this.selectedPointIndex === index;
    const showWaypointBadge = this.enableWaypointRouteFeatures && isSelected;
    let existed = this.dataSource.entities.getById(id);

    delete this.pointOrientationMap[id];
    delete this.pointScaleMap[id];
    if (existed) {
      if (existed.point) {
        existed.point.show = new ConstantProperty(!showWaypointBadge);
        existed.point.pixelSize = new ConstantProperty(isSelected ? 18 : 14);
        existed.point.color = new ConstantProperty(
          isSelected ? Color.fromCssColorString('#faad14') : Color.RED,
        );
      }
      if (existed.billboard) {
        existed.billboard.show = new ConstantProperty(showWaypointBadge);
      }
      if (existed.label) {
        existed.label.text = new ConstantProperty(`${index + 1}`);
        existed.label.font = new ConstantProperty(
          showWaypointBadge ? '600 12px sans-serif' : '14px sans-serif',
        );
        existed.label.verticalOrigin = new ConstantProperty(
          showWaypointBadge ? VerticalOrigin.CENTER : VerticalOrigin.BOTTOM,
        );
        existed.label.pixelOffset = new ConstantProperty(
          showWaypointBadge ? new Cartesian2(0, -16) : new Cartesian2(0, -20),
        );
        existed.label.showBackground = new ConstantProperty(false);
        existed.label.backgroundColor = new ConstantProperty(Color.TRANSPARENT);
        existed.label.backgroundPadding = new ConstantProperty(
          new Cartesian2(0, 0),
        );
        existed.label.outlineWidth = new ConstantProperty(2);
      }
      return;
    }

    this.dataSource.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[id],
        false,
      ),
      point: {
        show: !showWaypointBadge,
        pixelSize: isSelected ? 18 : 14,
        color: isSelected ? Color.fromCssColorString('#faad14') : Color.RED,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      billboard: {
        show: showWaypointBadge,
        image: invertedTriangleUrl,
        width: 26,
        height: 20,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        pixelOffset: new Cartesian2(0, -6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${index + 1}`,
        font: showWaypointBadge ? '600 12px sans-serif' : '14px sans-serif',
        pixelOffset: showWaypointBadge
          ? new Cartesian2(0, -16)
          : new Cartesian2(0, -20),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: showWaypointBadge
          ? VerticalOrigin.CENTER
          : VerticalOrigin.BOTTOM,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: false,
        backgroundColor: Color.TRANSPARENT,
        backgroundPadding: new Cartesian2(0, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  private syncEditorVehiclePoint() {
    const id = 'editor-vehicle-point';
    const point = this.editorVehiclePoint;
    if (!point || !this.currentPointModel?.uri) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[id];
      delete this.pointOrientationMap[id];
      delete this.pointScaleMap[id];
      return;
    }

    this.pointPositionMap[id] = Cartesian3.fromDegrees(
      point.lng,
      point.lat,
      point.height || 0,
    );
    const orientation = this.createBoundaryPointOrientation(
      id,
      point.aircraftHeading,
    );
    const existed = this.dataSource.entities.getById(id);
    if (existed) {
      existed.orientation = new ConstantProperty(orientation);
      existed.label = undefined;
      return;
    }

    this.dataSource.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[id],
        false,
      ),
      orientation,
      model: {
        uri: this.currentPointModel.uri,
        scale: this.createBoundaryPointScale(id),
        minimumPixelSize: this.currentPointModel.minimumPixelSize ?? 0,
        maximumScale: this.currentPointModel.maximumScale,
      },
    });
  }

  private syncDragHeightPreview() {
    const id = 'boundary-point-height-preview';
    const preview = this.dragHeightPreview;
    if (!preview) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[id];
      return;
    }
    const target =
      preview.index === this.selectedPointIndex && this.editorVehiclePoint
        ? this.editorVehiclePoint
        : this.getPreviewBoundaryPoints()[preview.index];
    if (!target) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[id];
      return;
    }

    this.pointPositionMap[id] = Cartesian3.fromDegrees(
      target.lng,
      target.lat,
      preview.height,
    );
    const existed = this.dataSource.entities.getById(id);
    const labelText = `${preview.height.toFixed(1)} m`;
    if (existed) {
      if (existed.label) {
        existed.label.text = new ConstantProperty(labelText);
      }
      return;
    }

    this.dataSource.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[id],
        false,
      ),
      label: {
        text: labelText,
        font: '600 12px sans-serif',
        pixelOffset: new Cartesian2(0, -44),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.72)'),
        backgroundPadding: new Cartesian2(8, 6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  private getActiveWaypointVisualPoints() {
    const points = this.getPreviewBoundaryPoints();
    const preview = this.dragHeightPreview;
    if (
      !preview ||
      preview.index !== this.selectedPointIndex ||
      !points[preview.index]
    ) {
      return points;
    }
    return points.map((point, index) =>
      index === preview.index ? { ...point, height: preview.height } : point,
    );
  }

  private removeActiveWaypointVisuals() {
    ['altitude', 'previous-distance', 'next-distance'].forEach((suffix) => {
      const id = `active-waypoint-${suffix}`;
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[`${id}-position`];
    });
  }

  private syncWaypointVisualLabel(
    id: string,
    position: Cartesian3,
    text: string,
    pixelOffset: Cartesian2,
  ) {
    const positionId = `${id}-position`;
    this.pointPositionMap[positionId] = position;
    const existed = this.dataSource.entities.getById(id) as Entity | undefined;
    if (existed?.label) {
      existed.label.text = new ConstantProperty(text);
      return;
    }
    this.dataSource.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[positionId],
        false,
      ),
      label: {
        text,
        font: '600 12px Microsoft YaHei',
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.72)'),
        backgroundPadding: new Cartesian2(8, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  private syncActiveWaypointVisuals() {
    if (
      !this.enableWaypointRouteFeatures ||
      this.isPatrolMode ||
      this.selectedPointIndex === null
    ) {
      this.removeActiveWaypointVisuals();
      return;
    }

    const points = this.getActiveWaypointVisualPoints();
    const selectedPoint = points[this.selectedPointIndex];
    if (!selectedPoint) {
      this.removeActiveWaypointVisuals();
      return;
    }

    this.syncWaypointVisualLabel(
      'active-waypoint-altitude',
      Cartesian3.fromDegrees(
        selectedPoint.lng,
        selectedPoint.lat,
        selectedPoint.height ?? 0,
      ),
      formatWaylineAltitude(this.selectedPointAltitude ?? selectedPoint.height),
      new Cartesian2(0, -44),
    );

    const activeSegmentKeys = new Set(
      getActiveWaypointSegments(points, this.selectedPointIndex).map(
        (segment) => segment.key,
      ),
    );
    (['previous', 'next'] as const).forEach((key) => {
      if (!activeSegmentKeys.has(key)) {
        const id = `active-waypoint-${key}-distance`;
        this.dataSource.entities.removeById(id);
        delete this.pointPositionMap[`${id}-position`];
      }
    });
    getActiveWaypointSegments(points, this.selectedPointIndex).forEach(
      (segment) => {
        const id = `active-waypoint-${segment.key}-distance`;
        this.syncWaypointVisualLabel(
          id,
          Cartesian3.fromDegrees(
            (segment.start.lng + segment.end.lng) / 2,
            (segment.start.lat + segment.end.lat) / 2,
            ((segment.start.height ?? 0) + (segment.end.height ?? 0)) / 2,
          ),
          formatWaylineDistance(
            getHorizontalDistanceMeters(segment.start, segment.end),
          ),
          new Cartesian2(0, -8),
        );
      },
    );
  }

  private removeEditorVehicleGroundProjection() {
    if (this.editorVehicleGroundProjectionTimer !== null) {
      window.clearTimeout(this.editorVehicleGroundProjectionTimer);
      this.editorVehicleGroundProjectionTimer = null;
    }
    this.editorVehicleGroundProjectionRequestVersion += 1;
    this.editorVehicleGroundProjectionKey = '';
    this.editorVehicleGroundProjectionPoint = null;
    this.dataSource.entities.removeById('editor-vehicle-ground-line');
    this.dataSource.entities.removeById('editor-vehicle-ground-origin');
    delete this.polylinePositionsMap['editor-vehicle-ground-line'];
    delete this.pointPositionMap['editor-vehicle-ground-origin'];
  }

  private getDownwardGroundRay(origin: Cartesian3) {
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const downwardDirection = Cartesian3.negate(
      ellipsoid.geodeticSurfaceNormal(origin, new Cartesian3()),
      new Cartesian3(),
    );
    return new Ray(origin, downwardDirection);
  }

  private getTerrainOrEllipsoidGroundPoint(ray: Ray, origin: Cartesian3) {
    const terrainHit = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    const ellipsoidInterval = IntersectionTests.rayEllipsoid(
      ray,
      this.viewer.scene.globe.ellipsoid,
    );
    const ellipsoidHit =
      ellipsoidInterval?.start !== undefined &&
      Number.isFinite(ellipsoidInterval.start)
        ? Ray.getPoint(ray, ellipsoidInterval.start, new Cartesian3())
        : Cartesian3.clone(origin);
    return pickGroundProjectionPoint({
      model: null,
      terrain: terrainHit ?? null,
      ellipsoid: ellipsoidHit,
    });
  }

  private pickEditorVehicleModelGroundPoint(ray: Ray) {
    // TerraGS 运行时支持最精细射线拾取，但现有类型声明未暴露该方法。
    const scene = this.viewer.scene as unknown as SceneWithMostDetailedRayPick;
    if (!scene.pickFromRayMostDetailed) {
      return Promise.resolve<Cartesian3 | null>(null);
    }
    return scene
      .pickFromRayMostDetailed(ray, this.dataSource.entities.values)
      .then((result) => result?.position ?? null)
      .catch(() => null);
  }

  private syncEditorVehicleGroundProjectionEntities(
    origin: Cartesian3,
    groundPoint: Cartesian3,
  ) {
    const lineId = 'editor-vehicle-ground-line';
    this.polylinePositionsMap[lineId] = [origin, groundPoint];
    if (!this.dataSource.entities.getById(lineId)) {
      this.dataSource.entities.add({
        id: lineId,
        polyline: {
          positions: new CallbackProperty(
            () => this.polylinePositionsMap[lineId],
            false,
          ),
          material: Color.fromCssColorString('#fadb14'),
          depthFailMaterial: Color.fromCssColorString('#fadb14'),
          width: 2,
        },
      });
    }

    const originId = 'editor-vehicle-ground-origin';
    this.pointPositionMap[originId] = groundPoint;
    if (this.dataSource.entities.getById(originId)) {
      return;
    }
    this.dataSource.entities.add({
      id: originId,
      position: new CallbackPositionProperty(
        () => this.pointPositionMap[originId],
        false,
      ),
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString('#fadb14'),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  private syncEditorVehicleGroundProjection() {
    const point = this.editorVehiclePoint;
    if (
      !point ||
      !shouldShowEditorVehicleGroundProjection(
        point,
        Boolean(this.currentPointModel?.uri),
      )
    ) {
      this.removeEditorVehicleGroundProjection();
      return;
    }

    const fallbackOrigin = Cartesian3.fromDegrees(
      point.lng,
      point.lat,
      point.height ?? 0,
    );
    const modelEntity = this.dataSource.entities.getById(
      'editor-vehicle-point',
    );
    const origin = getGroundProjectionOrigin(
      modelEntity?.position?.getValue(this.viewer.clock.currentTime),
      fallbackOrigin,
    );
    const projectionKey = `${origin.x.toFixed(2)},${origin.y.toFixed(
      2,
    )},${origin.z.toFixed(2)}`;
    const ray = this.getDownwardGroundRay(origin);
    const fallbackGroundPoint = this.getTerrainOrEllipsoidGroundPoint(
      ray,
      origin,
    );
    this.syncEditorVehicleGroundProjectionEntities(
      origin,
      getGroundProjectionPoint({
        projectionKey,
        cachedProjectionKey: this.editorVehicleGroundProjectionKey,
        cachedPoint: this.editorVehicleGroundProjectionPoint,
        fallbackPoint: fallbackGroundPoint,
      }),
    );
    if (
      projectionKey === this.editorVehicleGroundProjectionKey &&
      this.editorVehicleGroundProjectionPoint
    ) {
      return;
    }
    this.editorVehicleGroundProjectionKey = projectionKey;
    this.editorVehicleGroundProjectionPoint = fallbackGroundPoint;
    const requestVersion = ++this.editorVehicleGroundProjectionRequestVersion;
    if (this.editorVehicleGroundProjectionTimer !== null) {
      window.clearTimeout(this.editorVehicleGroundProjectionTimer);
    }
    this.editorVehicleGroundProjectionTimer = window.setTimeout(() => {
      this.editorVehicleGroundProjectionTimer = null;
      void this.pickEditorVehicleModelGroundPoint(ray).then(
        (modelGroundPoint) => {
          if (
            requestVersion !==
              this.editorVehicleGroundProjectionRequestVersion ||
            projectionKey !== this.editorVehicleGroundProjectionKey ||
            !modelGroundPoint ||
            Cartesian3.dot(
              Cartesian3.subtract(modelGroundPoint, origin, new Cartesian3()),
              ray.direction,
            ) <= 0
          ) {
            return;
          }
          const groundPoint = pickGroundProjectionPoint({
            model: modelGroundPoint,
            terrain: null,
            ellipsoid: this.getTerrainOrEllipsoidGroundPoint(ray, origin),
          });
          this.editorVehicleGroundProjectionPoint = groundPoint;
          this.syncEditorVehicleGroundProjectionEntities(origin, groundPoint);
        },
      );
    }, GROUND_PROJECTION_PICK_DELAY_MS);
  }

  private getActivePointFrustumOutlineIds() {
    return [
      'active-point-frustum-ray-0',
      'active-point-frustum-ray-1',
      'active-point-frustum-ray-2',
      'active-point-frustum-ray-3',
      'active-point-frustum-base',
      'active-point-frustum-center-line',
    ];
  }

  private getActivePointFrustumGroundIds() {
    return ['active-point-frustum-ground-polygon'];
  }

  private getActivePointFrustumFaceIds() {
    return [
      'active-point-frustum-face-0',
      'active-point-frustum-face-1',
      'active-point-frustum-face-2',
      'active-point-frustum-face-3',
    ];
  }

  private clearActivePointFrustum() {
    const ids = [
      ...this.getActivePointFrustumOutlineIds(),
      ...this.getActivePointFrustumFaceIds(),
      ...this.getActivePointFrustumGroundIds(),
    ];
    ids.forEach((id) => {
      this.dataSource.entities.removeById(id);
      delete this.polylinePositionsMap[id];
      delete this.polygonHierarchyMap[id];
    });
  }

  private getActivePointFrustumGeometry(point: WaylinePoint) {
    const origin = Cartesian3.fromDegrees(
      point.lng,
      point.lat,
      point.height || 0,
    );
    const headingRad = CesiumMath.toRadians(point.aircraftHeading ?? 0);
    const pitchRad = CesiumMath.toRadians(point.gimbalPitchRotateAngle ?? 0);
    const frustumLength = ACTIVE_POINT_FRUSTUM_LENGTH_METERS;
    const { horizontalHalfAngleRad, verticalHalfAngleRad } =
      getPointCameraHalfFov(point, this.currentPointCamera);

    const localForward = Cartesian3.normalize(
      new Cartesian3(
        Math.sin(headingRad) * Math.cos(pitchRad),
        Math.cos(headingRad) * Math.cos(pitchRad),
        Math.sin(pitchRad),
      ),
      new Cartesian3(),
    );
    const localRight = Cartesian3.normalize(
      new Cartesian3(Math.cos(headingRad), -Math.sin(headingRad), 0),
      new Cartesian3(),
    );
    const localUp = Cartesian3.normalize(
      Cartesian3.cross(localRight, localForward, new Cartesian3()),
      new Cartesian3(),
    );
    const farCenterLocal = Cartesian3.multiplyByScalar(
      localForward,
      frustumLength,
      new Cartesian3(),
    );
    const halfWidth = Math.tan(horizontalHalfAngleRad) * frustumLength;
    const halfHeight = Math.tan(verticalHalfAngleRad) * frustumLength;

    const transform = Transforms.eastNorthUpToFixedFrame(origin);
    const toWorldPoint = (localPoint: Cartesian3) =>
      Matrix4.multiplyByPoint(transform, localPoint, new Cartesian3());
    const toWorldVector = (localVector: Cartesian3) =>
      Cartesian3.normalize(
        Matrix4.multiplyByPointAsVector(
          transform,
          localVector,
          new Cartesian3(),
        ),
        new Cartesian3(),
      );
    const localCornerA = Cartesian3.add(
      Cartesian3.add(
        farCenterLocal,
        Cartesian3.multiplyByScalar(localRight, -halfWidth, new Cartesian3()),
        new Cartesian3(),
      ),
      Cartesian3.multiplyByScalar(localUp, halfHeight, new Cartesian3()),
      new Cartesian3(),
    );
    const localCornerB = Cartesian3.add(
      Cartesian3.add(
        farCenterLocal,
        Cartesian3.multiplyByScalar(localRight, halfWidth, new Cartesian3()),
        new Cartesian3(),
      ),
      Cartesian3.multiplyByScalar(localUp, halfHeight, new Cartesian3()),
      new Cartesian3(),
    );
    const localCornerC = Cartesian3.add(
      Cartesian3.add(
        farCenterLocal,
        Cartesian3.multiplyByScalar(localRight, halfWidth, new Cartesian3()),
        new Cartesian3(),
      ),
      Cartesian3.multiplyByScalar(localUp, -halfHeight, new Cartesian3()),
      new Cartesian3(),
    );
    const localCornerD = Cartesian3.add(
      Cartesian3.add(
        farCenterLocal,
        Cartesian3.multiplyByScalar(localRight, -halfWidth, new Cartesian3()),
        new Cartesian3(),
      ),
      Cartesian3.multiplyByScalar(localUp, -halfHeight, new Cartesian3()),
      new Cartesian3(),
    );

    return {
      origin,
      forwardDirection: toWorldVector(localForward),
      farCenter: toWorldPoint(farCenterLocal),
      corners: [
        toWorldPoint(localCornerA),
        toWorldPoint(localCornerB),
        toWorldPoint(localCornerC),
        toWorldPoint(localCornerD),
      ] as [Cartesian3, Cartesian3, Cartesian3, Cartesian3],
    };
  }

  private getFrustumCenterGroundPoint(
    origin: Cartesian3,
    forwardDirection: Cartesian3,
    fallbackPoint: Cartesian3,
  ) {
    const ray = new Ray(origin, forwardDirection);
    const maxDistance = Cartesian3.distance(origin, fallbackPoint);
    const terrainHit = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (terrainHit && Cartesian3.distance(origin, terrainHit) <= maxDistance) {
      return terrainHit;
    }

    const ellipsoidInterval = IntersectionTests.rayEllipsoid(
      ray,
      this.viewer.scene.globe.ellipsoid,
    );
    if (
      ellipsoidInterval?.start !== undefined &&
      Number.isFinite(ellipsoidInterval.start) &&
      ellipsoidInterval.start <= maxDistance
    ) {
      return Ray.getPoint(ray, ellipsoidInterval.start, new Cartesian3());
    }

    return fallbackPoint;
  }

  private getFrustumGroundHitPoint(
    origin: Cartesian3,
    targetPoint: Cartesian3,
  ) {
    const direction = Cartesian3.normalize(
      Cartesian3.subtract(targetPoint, origin, new Cartesian3()),
      new Cartesian3(),
    );
    const ray = new Ray(origin, direction);
    const maxDistance = Cartesian3.distance(origin, targetPoint);
    const terrainHit = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (terrainHit && Cartesian3.distance(origin, terrainHit) <= maxDistance) {
      return terrainHit;
    }

    const ellipsoidInterval = IntersectionTests.rayEllipsoid(
      ray,
      this.viewer.scene.globe.ellipsoid,
    );
    if (
      ellipsoidInterval?.start !== undefined &&
      Number.isFinite(ellipsoidInterval.start) &&
      ellipsoidInterval.start <= maxDistance
    ) {
      return Ray.getPoint(ray, ellipsoidInterval.start, new Cartesian3());
    }

    return null;
  }

  private syncActivePointFrustum() {
    if (!this.enableWaypointRouteFeatures || !this.currentPointModel?.uri) {
      this.clearActivePointFrustum();
      return;
    }

    const point =
      this.editorVehiclePoint ??
      (this.selectedPointIndex === null
        ? null
        : this.getPreviewBoundaryPoints()[this.selectedPointIndex]);
    if (!point) {
      this.clearActivePointFrustum();
      return;
    }

    const { origin, corners, forwardDirection, farCenter } =
      this.getActivePointFrustumGeometry(point);
    const outlineIds = this.getActivePointFrustumOutlineIds();
    const faceIds = this.getActivePointFrustumFaceIds();
    const groundIds = this.getActivePointFrustumGroundIds();
    const frustumColor = Color.fromCssColorString('#9eea4d');
    const frustumFillColor = Color.fromCssColorString('rgba(126,214,60,0.28)');
    const frustumGroundFillColor = Color.fromCssColorString(
      'rgba(126,214,60,0.2)',
    );
    const frustumCenterLineColor = Color.fromCssColorString('#b7ff4a');
    const frustumCenterLineMaterial = new PolylineArrowMaterialProperty(
      frustumCenterLineColor,
    );
    const rayTargets = corners.map((corner) => [origin, corner]);
    const baseLoop = [
      corners[0],
      corners[1],
      corners[2],
      corners[3],
      corners[0],
    ];
    const centerGroundPoint = this.getFrustumCenterGroundPoint(
      origin,
      forwardDirection,
      farCenter,
    );
    const groundCorners = corners.map((corner) =>
      this.getFrustumGroundHitPoint(origin, corner),
    );

    outlineIds.slice(0, 4).forEach((id, index) => {
      this.polylinePositionsMap[id] = rayTargets[index];
      if (this.dataSource.entities.getById(id)) {
        return;
      }
      this.dataSource.entities.add({
        id,
        polyline: {
          positions: new CallbackProperty(
            () => this.polylinePositionsMap[id],
            false,
          ),
          width: 2,
          material: frustumColor,
          depthFailMaterial: frustumColor,
        },
      });
    });

    this.polylinePositionsMap[outlineIds[4]] = baseLoop;
    if (!this.dataSource.entities.getById(outlineIds[4])) {
      this.dataSource.entities.add({
        id: outlineIds[4],
        polyline: {
          positions: new CallbackProperty(
            () => this.polylinePositionsMap[outlineIds[4]],
            false,
          ),
          width: 2,
          material: frustumColor,
          depthFailMaterial: frustumColor,
        },
      });
    }

    this.polylinePositionsMap[outlineIds[5]] = [origin, centerGroundPoint];
    if (!this.dataSource.entities.getById(outlineIds[5])) {
      this.dataSource.entities.add({
        id: outlineIds[5],
        polyline: {
          positions: new CallbackProperty(
            () => this.polylinePositionsMap[outlineIds[5]],
            false,
          ),
          width: 10,
          material: frustumCenterLineMaterial,
          depthFailMaterial: frustumCenterLineMaterial,
        },
      });
    }

    const facePoints = [
      [origin, corners[0], corners[1]],
      [origin, corners[1], corners[2]],
      [origin, corners[2], corners[3]],
      [origin, corners[3], corners[0]],
    ];

    faceIds.forEach((id, index) => {
      this.polygonHierarchyMap[id] = new PolygonHierarchy(facePoints[index]);
      if (this.dataSource.entities.getById(id)) {
        return;
      }
      this.dataSource.entities.add({
        id,
        polygon: {
          hierarchy: new CallbackProperty(
            () => this.polygonHierarchyMap[id],
            false,
          ),
          perPositionHeight: true,
          outline: false,
          material: frustumFillColor,
        },
      });
    });

    const hasFullGroundFootprint = groundCorners.every((corner) => corner);
    if (hasFullGroundFootprint) {
      this.polygonHierarchyMap[groundIds[0]] = new PolygonHierarchy(
        groundCorners as Cartesian3[],
      );
      if (!this.dataSource.entities.getById(groundIds[0])) {
        this.dataSource.entities.add({
          id: groundIds[0],
          polygon: {
            hierarchy: new CallbackProperty(
              () => this.polygonHierarchyMap[groundIds[0]],
              false,
            ),
            perPositionHeight: true,
            outline: true,
            outlineColor: frustumColor,
            material: frustumGroundFillColor,
          },
        });
      }
      return;
    }

    this.dataSource.entities.removeById(groundIds[0]);
    delete this.polygonHierarchyMap[groundIds[0]];
  }

  private createBoundaryPointOrientation(
    id: string,
    heading: number | undefined,
  ) {
    const position = this.pointPositionMap[id];
    const correctedHeading = normalizeHeadingAngle(
      (heading ?? 0) - (this.currentPointModel?.initialHeadingDeg ?? 0),
    );
    const hpr = new HeadingPitchRoll(
      CesiumMath.toRadians(correctedHeading),
      0,
      0,
    );
    this.pointOrientationMap[id] = Transforms.headingPitchRollQuaternion(
      position,
      hpr,
    );
    return this.pointOrientationMap[id];
  }

  private createBoundaryPointScale(id: string) {
    return new CallbackProperty(() => this.getBoundaryPointScale(id), false);
  }

  private getBoundaryPointScale(id: string) {
    const config = this.currentPointModel;
    const position = this.pointPositionMap[id];
    if (!config || !position) {
      return 1;
    }

    const frustum = this.viewer.camera.frustum as { fovy?: number };
    const fovy = frustum.fovy;
    const canvasHeight =
      this.viewer.scene.canvas?.clientHeight ||
      this.viewer.canvas?.clientHeight ||
      0;
    const distance = Cartesian3.distance(
      this.viewer.camera.positionWC,
      position,
    );
    const sourceSizeMeters = config.sourceSizeMeters ?? 1;
    const targetPixelSize = config.targetPixelSize ?? 56;
    const minScale = config.minScale ?? 0.001;
    const maxScale = config.maxScale ?? Number.POSITIVE_INFINITY;

    if (
      !Number.isFinite(fovy) ||
      !Number.isFinite(distance) ||
      distance <= 0 ||
      canvasHeight <= 0
    ) {
      return this.pointScaleMap[id] ?? minScale;
    }

    // 让模型尺寸按相机距离线性补偿，保持近似固定的屏幕像素大小。
    const metersPerPixel =
      (2 * distance * Math.tan((fovy as number) / 2)) / canvasHeight; // 每像素对应的实际距离（米/像素）
    const nextScale = (metersPerPixel * targetPixelSize) / sourceSizeMeters; // 期望的模型缩放比例
    const clampedScale = Math.min(maxScale, Math.max(minScale, nextScale));
    this.pointScaleMap[id] = clampedScale;
    return clampedScale;
  }

  private syncSegmentLabel(index: number, a: WaylinePoint, b: WaylinePoint) {
    const id = `boundary-seg-label-${index}`;
    const posId = `boundary-seg-pos-${index}`;
    const labelText = formatWaylineDistance(getHorizontalDistanceMeters(a, b));
    const aHeight = a.height ?? 0;
    const bHeight = b.height ?? 0;
    const labelHeight = (aHeight + bHeight) / 2;
    this.pointPositionMap[posId] = Cartesian3.fromDegrees(
      (a.lng + b.lng) / 2,
      (a.lat + b.lat) / 2,
      labelHeight,
    );
    const existed = this.dataSource.entities.getById(id) as Entity | undefined;
    if (!existed) {
      this.dataSource.entities.add({
        id,
        position: new CallbackPositionProperty(
          () => this.pointPositionMap[posId],
          false,
        ),
        label: {
          text: labelText,
          font: '600 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, Arial',
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -8),
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('rgba(0,0,0,0.68)'),
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Color.fromCssColorString('rgba(0,0,0,0.92)'),
          outlineWidth: 3,
          // 避免被折线/面状填充遮挡：禁用深度测试（一直显示在最上层）
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          // 轻微抬升渲染层级（对某些显卡/叠加层更稳）
          eyeOffset: new Cartesian3(0, 0, -10),
          // 增加可读性：更大的背景留白
          backgroundPadding: new Cartesian2(8, 6),
        },
      });
      return;
    }
    if (existed.label) {
      existed.label.text = new ConstantProperty(labelText);
    }
  }

  private syncLinesAndLabels() {
    // 用 normalPolylinePoints 展示航线折线（含闭合），距离标签也以此为准
    const linePts = this.normalPolylinePoints?.length
      ? this.normalPolylinePoints
      : this.boundaryPoints;
    const previewPts = this.getPreviewBoundaryPoints();
    const previewLinePts =
      linePts === this.boundaryPoints ? previewPts : linePts; // 仅当线直接引用 boundary 时，才用预览

    const renderedLinePts = this.isPatrolMode
      ? previewLinePts
      : buildWaypointTurnPreview(previewLinePts, this.waypointTurnType);

    // polyline
    const polylineId = 'normal-polyline';
    const existedLine = this.dataSource.entities.getById(polylineId);
    if (renderedLinePts.length > 1) {
      this.polylinePositionsMap[polylineId] =
        Cartesian3.fromDegreesArrayHeights(
          toCartesianFlatArray(renderedLinePts),
        );
      if (!existedLine) {
        this.dataSource.entities.add({
          id: polylineId,
          polyline: {
            positions: new CallbackProperty(
              () => this.polylinePositionsMap[polylineId],
              false,
            ),
            material: Color.fromCssColorString('#1677ff'),
            depthFailMaterial: Color.fromCssColorString('#1677ff'),
            width: 3,
          },
        });
      }
    } else {
      if (existedLine) {
        this.dataSource.entities.removeById(polylineId);
      }
      delete this.polylinePositionsMap[polylineId];
    }

    // segment distance labels
    if (!this.showSegmentDistances) {
      // 关闭时清理全部段距离标签
      for (let i = 0; i < 500; i += 1) {
        const id = `boundary-seg-label-${i}`;
        if (!this.dataSource.entities.getById(id)) break;
        this.dataSource.entities.removeById(id);
        delete this.pointPositionMap[`boundary-seg-pos-${i}`];
      }
      return;
    }

    // 先清理多余 label
    const segCount = Math.max(0, previewLinePts.length - 1);
    for (let i = segCount; i < 500; i += 1) {
      const id = `boundary-seg-label-${i}`;
      if (!this.dataSource.entities.getById(id)) break;
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[`boundary-seg-pos-${i}`];
    }
    for (let i = 0; i < segCount; i += 1) {
      const a = previewLinePts[i];
      const b = previewLinePts[i + 1];
      if (!a || !b) continue;
      this.syncSegmentLabel(i, a, b);
    }
  }

  private syncScanPath() {
    const id = 'scan-path-line';
    if (this.isPatrolMode && this.scanPathPoints.length > 1) {
      this.polylinePositionsMap[id] = Cartesian3.fromDegreesArrayHeights(
        toCartesianFlatArray(this.scanPathPoints),
      );
      const existed = this.dataSource.entities.getById(id);
      if (!existed) {
        this.dataSource.entities.add({
          id,
          polyline: {
            positions: new CallbackProperty(
              () => this.polylinePositionsMap[id],
              false,
            ),
            material: Color.fromCssColorString('#fa8c16'),
            depthFailMaterial: Color.fromCssColorString('#fa8c16'),
            width: 3,
          },
        });
      }
      return;
    }
    this.dataSource.entities.removeById(id);
    delete this.polylinePositionsMap[id];
  }

  private syncAreaLabel() {
    const id = 'boundary-area-label';
    const posId = 'boundary-area-pos';

    if (!this.showAreaLabel || !this.isPatrolMode) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[posId];
      return;
    }

    const pts = this.getPreviewBoundaryPoints();
    if (pts.length < 3) {
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[posId];
      return;
    }

    const area = polygonAreaSquareMeters(pts);
    const text = `面积：${formatAreaSquareMeters(area)}`;
    const center = polygonCentroid(pts);
    this.pointPositionMap[posId] = Cartesian3.fromDegrees(
      center.lng,
      center.lat,
      0,
    );

    const existed = this.dataSource.entities.getById(id) as Entity | undefined;
    if (!existed) {
      this.dataSource.entities.add({
        id,
        position: new CallbackPositionProperty(
          () => this.pointPositionMap[posId],
          false,
        ),
        label: {
          text,
          font: '600 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, Arial',
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, 0),
          fillColor: Color.WHITE,
          showBackground: true,
          // 与线长度 label 区分：使用蓝色调背景
          backgroundColor: Color.fromCssColorString('rgba(22,119,255,0.52)'),
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Color.fromCssColorString('rgba(0,0,0,0.92)'),
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          backgroundPadding: new Cartesian2(10, 7),
        },
      });
      return;
    }
    if (existed.label) {
      existed.label.text = new ConstantProperty(text);
    }
  }

  /** 同步当前数据到 Cesium Entity（可重复调用） */
  sync() {
    this.syncTakeoffReferencePoint();
    this.syncTakeoffTransitionLine();

    // points
    this.boundaryPoints.forEach((_p, idx) => this.syncBoundaryPoint(idx));
    for (
      let idx = this.boundaryPoints.length;
      idx < this.prevBoundaryPointCount;
      idx += 1
    ) {
      const id = `boundary-point-${idx}`;
      this.dataSource.entities.removeById(id);
      delete this.pointPositionMap[id];
      delete this.pointOrientationMap[id];
      delete this.pointScaleMap[id];
    }
    this.prevBoundaryPointCount = this.boundaryPoints.length;
    this.syncEditorVehiclePoint();
    this.syncEditorVehicleGroundProjection();
    this.syncDragHeightPreview();
    this.syncActiveWaypointVisuals();
    this.syncActivePointFrustum();

    // polygon
    if (this.isPatrolMode && this.boundaryPoints.length >= 3) {
      // 简化：直接重建/刷新 polygon hierarchy
      const polyId = 'boundary-polygon';
      this.polygonHierarchyMap[polyId] = new PolygonHierarchy(
        Cartesian3.fromDegreesArray(
          this.getPreviewBoundaryPoints().flatMap((point) => [
            point.lng,
            point.lat,
          ]),
        ),
      );
      if (!this.dataSource.entities.getById(polyId)) {
        this.dataSource.entities.add({
          id: polyId,
          polygon: {
            hierarchy: new CallbackProperty(
              () => this.polygonHierarchyMap[polyId],
              false,
            ),
            material: Color.fromCssColorString('#3498db').withAlpha(0.25),
            outline: true,
            outlineColor: Color.fromCssColorString('#3498db'),
          },
        });
      }
    } else {
      this.dataSource.entities.removeById('boundary-polygon');
      delete this.polygonHierarchyMap['boundary-polygon'];
    }

    this.syncLinesAndLabels();
    this.syncAreaLabel();
    this.syncScanPath();
  }
}
