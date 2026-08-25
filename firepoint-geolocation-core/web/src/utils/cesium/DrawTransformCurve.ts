import uavMinGlbUrl from './models/uav_edit.gltf';
import type { Entity, HeadingPitchRoll, Viewer } from 'cesium';
import {
  Cartesian3,
  JulianDate,
  Quaternion,
  SampledPositionProperty,
  VelocityOrientationProperty,
} from 'cesium';

const uavEditModelUrl = uavMinGlbUrl;

/** Cesium 模块命名空间（与 `import * as Cesium from 'cesium'` 运行时一致） */
export type CesiumNamespace = typeof import('cesium');

/** 经纬高输入：高度字段兼容 alt / het / height */
export interface DrawTransformGeoInput {
  lon: number;
  lat: number;
  alt?: number;
  het?: number;
  height?: number;
}

/** 归一化后的经纬高（内部高度字段为 height，单位米） */
export interface DrawTransformGeoNormalized {
  lon: number;
  lat: number;
  height: number;
}

/** 经纬高输出（与 Cartesian 互转时使用 alt） */
export interface DrawTransformGeoPoint {
  lon: number;
  lat: number;
  alt: number;
}

/** 模型朝向（度） */
export interface DrawTransformRotates {
  heading?: number;
  pitch?: number;
  roll?: number;
}

/** 已解析的朝向（三轴均为确定数值，单位度） */
export interface DrawTransformRotatesResolved {
  heading: number;
  pitch: number;
  roll: number;
}

export interface DrawTransformModelConfig {
  initialHeadingDeg?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  sourceSizeMeters?: number;
  targetPixelSize?: number;
  minScale?: number;
  maxScale?: number;
}

export interface DrawTransformCurveCtorOptions {
  viewer: Viewer;
  Cesium: CesiumNamespace;
  /** 毫秒（ms），内部换算为秒 */
  defaultSmoothDurationSec?: number;
}

/** 折线样式与平滑参数 */
export interface DrawTransformPolylineStyleParams {
  color?: string;
  width?: number;
  smooth?: boolean;
  smoothSamplesPerSegment?: number;
  /** 与实现内字段 smoothTailRawPoints 对应 */
  smoothTailRawPoints?: number;
}

export interface DrawTransformSetSpeedMpsParams {
  id: string;
  speedMps: number;
}

export interface DrawTransformAddEntityParams {
  id: string;
  position: DrawTransformGeoInput;
  rotates?: DrawTransformRotates;
  url?: string;
  modelConfig?: DrawTransformModelConfig;
  minSize?: number;
  maxScale?: number;
  maxSize?: number;
  MaxSize?: number;
}

export interface DrawTransformAddPolylineParams
  extends DrawTransformPolylineStyleParams {
  id: string;
  position: DrawTransformGeoInput;
}

export interface DrawTransformAddPolylineByCartesianParams
  extends DrawTransformPolylineStyleParams {
  id: string;
  cartesian: Cartesian3;
}

export type DrawTransformTrackInterpMode = 'linear' | 'smooth';

export interface DrawTransformFlyByTrackParams extends DrawTransformAddEntityParams {
  points: DrawTransformGeoInput[];
  speedMps: number;
  loop?: boolean;
  drawRefLine?: boolean;
  refLineColor?: string;
  refLineWidth?: number;
  interpMode?: DrawTransformTrackInterpMode;
}

export interface DrawTransformStartTransformEntParams
  extends DrawTransformAddEntityParams,
    DrawTransformPolylineStyleParams {
  ifDrawLine?: boolean;
  lineStepMeters?: number;
  simplifyTolerance?: number;
  /** 平滑时长（秒） */
  smoothDurationSec?: number;
  smoothMove?: boolean;
  useVelocityOrientation?: boolean;
  enableTailHeadingHold?: boolean;
  minTailSpeedMps?: number;
  minHeadSpeedMps?: number;
  headHoldSec?: number;
  orientationSampleDtSec?: number;
}

/** 实时航迹：position 可选；其余与 {@link DrawTransformStartTransformEntParams} 一致 */
export type DrawTransformStartRealtimeTrackParams = Omit<
  DrawTransformStartTransformEntParams,
  'position'
> &
  DrawTransformPolylineStyleParams & {
    position?: DrawTransformGeoInput;
    routePoints?: DrawTransformGeoInput[];
    ended?: boolean;
    fallbackSpeedMps?: number;
    snapToRoute?: boolean;
    allowBacktrack?: boolean;
    drawRouteLine?: boolean;
    refLineColor?: string;
    refLineWidth?: number;
  };

export interface DrawTransformRotateEntParams {
  id: string;
  rotates?: DrawTransformRotates;
}

export interface DrawTransformLockEntityOptions {
  viewFrom?: Cartesian3;
}

/** 航迹折线缓存（投影与按里程采样） */
export interface DrawTransformRouteCache {
  points: Array<{ lon: number; lat: number; alt: number }>;
  carts: Cartesian3[];
  distances: number[];
  totalLength: number;
}

/** 内部：折线平滑配置 */
export interface DrawTransformPolylineSmoothCfg {
  enabled: boolean;
  samplesPerSegment: number;
  keepTailRawPoints?: number;
}

/** 内部：平滑移动采样段 */
export interface DrawTransformLineSegment {
  startTime: JulianDate;
  targetTime: JulianDate;
  startCartesian: Cartesian3;
  targetCartesian: Cartesian3;
}

export interface DrawTransformLineSegmentState {
  pendingSegments: DrawTransformLineSegment[];
}

export interface DrawTransformSmoothSampleInfo {
  startTime: JulianDate;
  targetTime: JulianDate;
  fromCartesian: Cartesian3;
  targetCartesian: Cartesian3;
}

export interface DrawTransformOrientationHoldState {
  headLockUntil: JulianDate | null;
  headUnlocked: boolean;
}

/** 内部：沿航迹实时状态 */
export interface DrawTransformRealtimeRouteState {
  routeCache?: DrawTransformRouteCache;
  ended?: boolean;
  lastUpdateSeconds?: number;
  lastRealtimeSeconds?: number;
  lastRealtimeProgress?: number;
  lastRenderProgress?: number;
  lastSpeedMps?: number;
  lastVelocityCartesian?: Cartesian3;
  lastRealtimeCartesian?: Cartesian3;
  lastInputCartesian?: Cartesian3;
  lastInputSeconds?: number;
  lastInputSpeedMps?: number;
  lastInputDirection?: Cartesian3;
  lastInputRotates?: DrawTransformRotates;
  lastAcceptedCartesian?: Cartesian3;
  lastAcceptedSeconds?: number;
  lastAcceptedSpeedMps?: number;
  lastAcceptedDirection?: Cartesian3;
  gapExtrapolationActive?: boolean;
  gapStartSeconds?: number;
  gapAnchorCartesian?: Cartesian3;
  gapDirection?: Cartesian3;
  gapSpeedMps?: number;
  gapLastTargetCartesian?: Cartesian3;
}

export interface DrawTransformLockCameraSnapshot {
  destination: Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
}

export interface DrawTransformLockState {
  prevTrackedEntity: Entity | undefined;
  lockedId: string;
  camera: DrawTransformLockCameraSnapshot;
}

export interface DrawTransformScratchVectors {
  routeSegment: Cartesian3;
  routeRelative: Cartesian3;
  routeProjected: Cartesian3;
  routeScaled: Cartesian3;
  dpsAb: Cartesian3;
  dpsAp: Cartesian3;
  dpsProj: Cartesian3;
  dpsScaled: Cartesian3;
}

export interface DrawTransformAutoRotateArg {
  id: string;
  prevCartesian: Cartesian3 | null;
  currCartesian: Cartesian3;
}

export interface DrawTransformAddSmoothSampleArg {
  id: string;
  cartesian: Cartesian3;
  durationSec?: number;
}

export interface DrawTransformStableVelocityOrientationArg {
  id: string;
  spp: SampledPositionProperty;
  minTailSpeedMps?: number;
  minHeadSpeedMps?: number;
  headHoldSec?: number;
  orientationSampleDtSec?: number;
}

export interface DrawTransformUpdateRefPolylineArg {
  id: string;
  carts: Cartesian3[];
  show?: boolean;
  color?: string;
  width?: number;
}

export interface DrawTransformSyncRouteLineArg {
  id: string;
  routeCache?: DrawTransformRouteCache;
  drawRouteLine?: boolean;
  refLineColor?: string;
  refLineWidth?: number;
}

/** 与 Cesium 运行时赋值行为一致（官方 Entity 对 graphics 字段类型偏严） */
type EntityGraphicsCompat = {
  position?: unknown;
  orientation?: unknown;
  viewFrom?: unknown;
};

function asEntityCompat(entity: Entity): EntityGraphicsCompat {
  return entity as unknown as EntityGraphicsCompat;
}

/**
 * 绘制移动实体并生成轨迹线。
 * - 维护实体、轨迹点数组、轨迹折线实体等缓存，按 id 管理。
 */
export class DrawTransformCurve {
  viewer!: Viewer;
  Cesium!: CesiumNamespace;
  private _defaultSmoothDurationSec!: number;
  private _positionsd: Record<string, Cartesian3[]> = {};
  private _polyLine: Record<string, Entity | undefined> = {};
  private _entitys: Record<string, Entity> = {};
  private _lastAutoRotates: Record<string, DrawTransformRotatesResolved> = {};
  private _polylineSmoothCfg: Record<string, DrawTransformPolylineSmoothCfg> =
    {};
  private _sampledPositions: Record<string, SampledPositionProperty> = {};
  private _lastSampleTime: Record<string, JulianDate | null | undefined> = {};
  private _modelConfig: Record<string, DrawTransformModelConfig | null> = {};
  private _modelScale: Record<string, number> = {};
  private _velocityOrientationProp: Record<
    string,
    VelocityOrientationProperty
  > = {};
  private _velocityOrientationSpp: Record<string, SampledPositionProperty> = {};
  private _lastStableOrientation: Record<string, Quaternion> = {};
  private _orientationHoldState: Record<
    string,
    DrawTransformOrientationHoldState
  > = {};
  private _lockState: DrawTransformLockState | null = null;
  private _flightBaseSpeedMps: Record<string, number> = {};
  private _refPolyline: Record<string, Entity | undefined> = {};
  private _realtimeRouteState: Record<string, DrawTransformRealtimeRouteState> =
    {};
  private _lineSegmentState: Record<string, DrawTransformLineSegmentState> = {};
  private readonly _scratch: DrawTransformScratchVectors;

  /**
   * @param arg.defaultSmoothDurationSec 传入毫秒（ms），内部会换算成秒
   */
  constructor(arg: DrawTransformCurveCtorOptions) {
    const CesiumNs = arg.Cesium;
    this.viewer = arg.viewer;
    this.Cesium = arg.Cesium;
    const defaultSmoothDuration = Number(arg?.defaultSmoothDurationSec);
    this._defaultSmoothDurationSec =
      defaultSmoothDuration > 0 ? defaultSmoothDuration / 1000 : 1.0;
    this._scratch = {
      routeSegment: new CesiumNs.Cartesian3(),
      routeRelative: new CesiumNs.Cartesian3(),
      routeProjected: new CesiumNs.Cartesian3(),
      routeScaled: new CesiumNs.Cartesian3(),
      dpsAb: new CesiumNs.Cartesian3(),
      dpsAp: new CesiumNs.Cartesian3(),
      dpsProj: new CesiumNs.Cartesian3(),
      dpsScaled: new CesiumNs.Cartesian3(),
    };
  }

  /**
   * 解析模型平滑时长；优先使用单次调用参数，其次使用实例默认值。
   * @param {number | undefined} durationSec
   * @param {number} [fallbackSec=1]
   * @returns {number}
   */
  _resolveSmoothDurationSec(
    durationSec: number | undefined,
    fallbackSec = 1,
  ): number {
    const inputDuration = Number(durationSec);
    if (inputDuration > 0) return inputDuration;

    const defaultDuration = Number(this._defaultSmoothDurationSec);
    if (defaultDuration > 0) return defaultDuration;

    return fallbackSec;
  }

  /**
   * 尝试从 entity.position 取出当前 Cartesian3（兼容 ConstantPositionProperty）。
   * @param {Cesium.Entity} entity
   * @returns {Cesium.Cartesian3 | null}
   */
  _getEntityCartesian(entity: Entity | undefined): Cartesian3 | null {
    if (!entity || !entity.position) return null;
    try {
      if (typeof entity.position.getValue === 'function') {
        return entity.position.getValue(this.viewer.clock.currentTime) || null;
      }
    } catch (_) {
      // ignore
    }
    return (entity.position as unknown as Cartesian3 | undefined) || null;
  }

  /**
   * 根据两点（WGS84）推算 heading（弧度，北为 0，顺时针为正）。
   * @param {Cesium.Cartesian3} fromCartesian
   * @param {Cesium.Cartesian3} toCartesian
   * @returns {number | null}
   */
  _computeHeadingRadians(
    fromCartesian: Cartesian3,
    toCartesian: Cartesian3,
  ): number | null {
    const Cesium = this.Cesium;
    if (!fromCartesian || !toCartesian) return null;

    const from = Cesium.Cartographic.fromCartesian(fromCartesian);
    const to = Cesium.Cartographic.fromCartesian(toCartesian);

    const dLon = to.longitude - from.longitude;
    const y = Math.sin(dLon) * Math.cos(to.latitude);
    const x =
      Math.cos(from.latitude) * Math.sin(to.latitude) -
      Math.sin(from.latitude) * Math.cos(to.latitude) * Math.cos(dLon);

    // from/to 太接近时，atan2 会抖动；交给上层做距离阈值判断
    const heading = Math.atan2(y, x);
    return Cesium.Math.zeroToTwoPi(heading);
  }

  /**
   * 根据两点计算 rotates（单位：度），用于沿原始输入点位稳定朝向。
   * @param {Cesium.Cartesian3} fromCartesian
   * @param {Cesium.Cartesian3} toCartesian
   * @param {{heading?:number,pitch?:number,roll?:number}} [fallback]
   * @returns {{heading:number,pitch:number,roll:number} | null}
   */
  _computeRotatesFromPair(
    fromCartesian: Cartesian3,
    toCartesian: Cartesian3,
    fallback?: DrawTransformRotates | DrawTransformRotatesResolved | null,
  ): DrawTransformRotatesResolved | null {
    const Cesium = this.Cesium;
    const asResolved = (
      r?: DrawTransformRotates | DrawTransformRotatesResolved | null,
    ): DrawTransformRotatesResolved | null => {
      if (r === null || r === undefined) return null;
      return {
        heading: Number(r.heading) || 0,
        pitch: Number(r.pitch) || 0,
        roll: Number(r.roll) || 0,
      };
    };
    if (!fromCartesian || !toCartesian) return asResolved(fallback);

    const dist3d = Cesium.Cartesian3.distance(fromCartesian, toCartesian);
    if (!(dist3d > 0.2)) return asResolved(fallback);

    const from = Cesium.Cartographic.fromCartesian(fromCartesian);
    const to = Cesium.Cartographic.fromCartesian(toCartesian);
    if (!from || !to) return asResolved(fallback);

    let headingDeg = fallback?.heading ?? 0;
    const headingRad = this._computeHeadingRadians(fromCartesian, toCartesian);
    if (headingRad !== null) headingDeg = Cesium.Math.toDegrees(headingRad);

    let pitchDeg = fallback?.pitch ?? 0;
    const geodesic = new Cesium.EllipsoidGeodesic(from, to);
    const horizontal = geodesic.surfaceDistance || 0;
    if (horizontal > 0.2) {
      const dh = (to.height || 0) - (from.height || 0);
      pitchDeg = Cesium.Math.toDegrees(Math.atan2(dh, horizontal));
    }

    return {
      heading: headingDeg,
      pitch: pitchDeg,
      roll: fallback?.roll ?? 0,
    };
  }

  /**
   * 未传 rotates 时：根据前后两点自动推算 heading + pitch（用于俯仰：由高度差计算）。
   * - heading: 两点方位角（北为 0，顺时针为正）
   * - pitch: atan2(Δh, 水平距离)，上升为正
   * - 结果会缓存，位移过小则沿用上一次
   * @param {{id:string, prevCartesian:Cesium.Cartesian3|null, currCartesian:Cesium.Cartesian3}} arg
   */
  _autoRotateFromMovement(arg: DrawTransformAutoRotateArg): void {
    const Cesium = this.Cesium;
    const { id, prevCartesian, currCartesian } = arg || {};
    if (!id || !currCartesian) return;

    const eps3dMeters = 0.2; // 3D 位移太小就不更新，避免抖动
    const cached = this._lastAutoRotates[id];
    if (!prevCartesian) {
      if (cached) this.rotateEnt({ id, rotates: cached });
      return;
    }

    const dist3d = Cesium.Cartesian3.distance(prevCartesian, currCartesian);
    if (!(dist3d > eps3dMeters)) {
      if (cached) this.rotateEnt({ id, rotates: cached });
      return;
    }

    const rotates = this._computeRotatesFromPair(
      prevCartesian,
      currCartesian,
      cached,
    );
    if (!rotates) return;
    this._lastAutoRotates[id] = rotates;
    this.rotateEnt({ id, rotates });
  }

  /**
   * 追加真实轨迹点；重复点会被忽略。
   * @param {string} id
   * @param {Cesium.Cartesian3} cartesian
   * @param {number} [epsilonMeters=0.01]
   */
  _pushUniquePolylinePoint(
    id: string,
    cartesian: Cartesian3,
    epsilonMeters = 0.01,
  ): void {
    const Cesium = this.Cesium;
    if (!id || !cartesian) return;

    if (!Array.isArray(this._positionsd[id])) this._positionsd[id] = [];
    const positions = this._positionsd[id];
    const last = positions[positions.length - 1];
    if (last && Cesium.Cartesian3.distance(last, cartesian) <= epsilonMeters)
      return;

    positions.push(Cesium.Cartesian3.clone(cartesian));
  }

  /**
   * 把已完成的平滑航段落成真实点，移除临时插值段。
   * @param {string} id
   * @param {Cesium.JulianDate} [time]
   */
  _flushCompletedLineSegments(id: string, time?: JulianDate): void {
    const Cesium = this.Cesium;
    const segmentState = this._lineSegmentState[id];
    if (!segmentState?.pendingSegments?.length) return;

    const currentTime = time
      ? Cesium.JulianDate.clone(time)
      : Cesium.JulianDate.clone(this.viewer.clock.currentTime);

    while (segmentState.pendingSegments.length > 0) {
      const segment = segmentState.pendingSegments[0];
      if (
        !segment?.targetTime ||
        Cesium.JulianDate.greaterThan(segment.targetTime, currentTime)
      )
        break;
      this._pushUniquePolylinePoint(id, segment.targetCartesian);
      segmentState.pendingSegments.shift();
    }
  }

  /**
   * 返回轨迹线当前应显示的点位。
   * - 历史段只保留真实传入点
   * - 当前进行中的航段按实体当前平滑位置同步展开
   * @param {string} id
   * @param {Cesium.Cartesian3[]} rawPositions
   * @returns {Cesium.Cartesian3[]}
   */
  _getRenderedPolylinePositions(
    id: string,
    rawPositions: Cartesian3[],
  ): Cartesian3[] {
    const Cesium = this.Cesium;
    if (!Array.isArray(rawPositions) || rawPositions.length === 0)
      return rawPositions || [];

    const currentTime = Cesium.JulianDate.clone(this.viewer.clock.currentTime);
    this._flushCompletedLineSegments(id, currentTime);

    const result = rawPositions.slice();
    const segmentState = this._lineSegmentState[id];
    const activeSegment = segmentState?.pendingSegments?.[0];
    if (!activeSegment?.startTime || !activeSegment?.targetTime) return result;
    if (Cesium.JulianDate.lessThan(currentTime, activeSegment.startTime))
      return result;

    const spp = this._sampledPositions[id];
    if (!spp) return result;

    const cfg = this._polylineSmoothCfg[id] || {
      enabled: true,
      samplesPerSegment: 10,
    };
    const sampleCount = Math.max(2, Math.floor(cfg.samplesPerSegment || 10));
    const endTime = Cesium.JulianDate.lessThan(
      currentTime,
      activeSegment.targetTime,
    )
      ? currentTime
      : activeSegment.targetTime;
    const totalSeconds = Math.max(
      0.001,
      Cesium.JulianDate.secondsDifference(
        activeSegment.targetTime,
        activeSegment.startTime,
      ),
    );
    const elapsedSeconds = Math.max(
      0,
      Cesium.JulianDate.secondsDifference(endTime, activeSegment.startTime),
    );
    const progress = Cesium.Math.clamp(elapsedSeconds / totalSeconds, 0, 1);
    const steps = Math.max(1, Math.ceil(sampleCount * progress));

    for (let i = 1; i <= steps; i++) {
      const sampleSeconds = (elapsedSeconds * i) / steps;
      const sampleTime = Cesium.JulianDate.addSeconds(
        activeSegment.startTime,
        sampleSeconds,
        new Cesium.JulianDate(),
      );
      const sampleCartesian = spp.getValue(sampleTime);
      if (sampleCartesian) result.push(sampleCartesian);
    }

    return result;
  }

  /**
   * 获取/创建平滑移动用的 SampledPositionProperty，并配置插值。
   * @param {string} id
   * @returns {Cesium.SampledPositionProperty}
   */
  _getOrCreateSampledPositionProperty(id: string): SampledPositionProperty {
    const Cesium = this.Cesium;
    if (this._sampledPositions[id]) return this._sampledPositions[id];

    const spp = new Cesium.SampledPositionProperty();
    spp.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    });
    // 断采样或时钟回拨时保持位置，避免实体瞬间消失
    spp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
    spp.backwardExtrapolationDuration = 3600;
    spp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
    spp.forwardExtrapolationDuration = 3600;

    this._sampledPositions[id] = spp;
    return spp;
  }

  /**
   * 获取当前时间戳（秒），用于实时数据插值/外推。
   * @returns {number}
   */
  _getNowSeconds(): number {
    if (
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      return performance.now() / 1000;
    }
    return Date.now() / 1000;
  }

  /**
   * 判断经纬高点位是否有效。
   * @param {{lon:number,lat:number,alt?:number,het?:number,height?:number}} point
   * @returns {boolean}
   */
  _isValidGeoPoint(point: unknown): boolean {
    if (!point || typeof point !== 'object') return false;
    const o = point as Record<string, unknown>;
    const lon = Number(o.lon);
    const lat = Number(o.lat);
    return Number.isFinite(lon) && Number.isFinite(lat);
  }

  /**
   * 统一归一化经纬高对象（内部统一用 height 字段）。
   * @param {{lon:number,lat:number,alt?:number,het?:number,height?:number}} point
   * @returns {{lon:number,lat:number,height:number} | null}
   */
  _normalizeGeoPoint(
    point: Partial<DrawTransformGeoInput>,
  ): DrawTransformGeoNormalized | null {
    if (!this._isValidGeoPoint(point)) return null;
    return {
      lon: Number(point.lon),
      lat: Number(point.lat),
      height: Number(point.alt ?? point.het ?? point.height) || 0,
    };
  }

  /**
   * 统一构建 HeadingPitchRoll，避免重复角度转换。
   * @param {{heading?:number,pitch?:number,roll?:number}} rotates
   * @returns {Cesium.HeadingPitchRoll}
   */
  _toHeadingPitchRoll(rotates?: DrawTransformRotates): HeadingPitchRoll {
    const Cesium = this.Cesium;
    const r = rotates || {};
    return new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(Number(r.heading) || 0),
      Cesium.Math.toRadians(Number(r.pitch) || 0),
      Cesium.Math.toRadians(Number(r.roll) || 0),
    );
  }

  _normalizeHeadingAngle(angle: number): number {
    let normalized = angle;
    while (normalized > 180) {
      normalized -= 360;
    }
    while (normalized < -180) {
      normalized += 360;
    }
    return Number(normalized.toFixed(6));
  }

  _resolveModelConfig(
    params?: Partial<
      DrawTransformAddEntityParams & DrawTransformStartTransformEntParams
    >,
  ): DrawTransformModelConfig | null {
    if (!params) {
      return null;
    }
    const legacyMaxScale =
      params.maxScale ?? params.maxSize ?? params.MaxSize ?? undefined;
    const nextConfig: DrawTransformModelConfig = {
      initialHeadingDeg: params.modelConfig?.initialHeadingDeg,
      minimumPixelSize:
        params.modelConfig?.minimumPixelSize ?? params.minSize ?? undefined,
      maximumScale:
        params.modelConfig?.maximumScale ?? legacyMaxScale ?? undefined,
      sourceSizeMeters: params.modelConfig?.sourceSizeMeters,
      targetPixelSize: params.modelConfig?.targetPixelSize,
      minScale: params.modelConfig?.minScale,
      maxScale: params.modelConfig?.maxScale ?? legacyMaxScale ?? undefined,
    };
    return Object.values(nextConfig).some((value) => value !== undefined)
      ? nextConfig
      : null;
  }

  _normalizeRotatesByModelConfig(
    rotates?: DrawTransformRotates,
    modelConfig?: DrawTransformModelConfig | null,
  ): DrawTransformRotates | undefined {
    if (!rotates) {
      return rotates;
    }
    return {
      heading: this._normalizeHeadingAngle(
        (Number(rotates.heading) || 0) -
          (Number(modelConfig?.initialHeadingDeg) || 0),
      ),
      pitch: Number(rotates.pitch) || 0,
      roll: Number(rotates.roll) || 0,
    };
  }

  _createModelScaleProperty(id: string) {
    const Cesium = this.Cesium;
    return new Cesium.CallbackProperty(() => this._getModelScale(id), false);
  }

  _getModelScale(id: string): number {
    const Cesium = this.Cesium;
    const config = this._modelConfig[id];
    const entity = this._entitys[id];
    const position = this._getEntityCartesian(entity);
    if (!config || !position) {
      return 1;
    }

    const frustum = this.viewer.camera.frustum as { fovy?: number };
    const fovy = frustum.fovy;
    const canvasHeight =
      this.viewer.scene.canvas?.clientHeight ||
      this.viewer.canvas?.clientHeight ||
      0;
    const distance = Cesium.Cartesian3.distance(
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
      return this._modelScale[id] ?? minScale;
    }

    const metersPerPixel =
      (2 * distance * Math.tan((fovy as number) / 2)) / canvasHeight;
    const nextScale = (metersPerPixel * targetPixelSize) / sourceSizeMeters;
    const clampedScale = Math.min(maxScale, Math.max(minScale, nextScale));
    this._modelScale[id] = clampedScale;
    return clampedScale;
  }

  /**
   * 统一把经纬高点位转成 Cartesian3。
   * @param {{lon:number,lat:number,alt?:number,het?:number,height?:number}} point
   * @returns {Cesium.Cartesian3 | null}
   */
  _pointToCartesian(point: Partial<DrawTransformGeoInput>): Cartesian3 | null {
    const Cesium = this.Cesium;
    const normalized = this._normalizeGeoPoint(point);
    if (!normalized) return null;
    return Cesium.Cartesian3.fromDegrees(
      normalized.lon,
      normalized.lat,
      normalized.height,
    );
  }

  /**
   * Cartesian3 转回经纬高对象。
   * @param {Cesium.Cartesian3} cartesian
   * @returns {{lon:number,lat:number,alt:number} | null}
   */
  _cartesianToPoint(cartesian: Cartesian3): DrawTransformGeoPoint | null {
    const Cesium = this.Cesium;
    if (!cartesian) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    if (!cartographic) return null;
    return {
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      alt: cartographic.height || 0,
    };
  }

  /**
   * 构建固定航迹缓存，便于投影与按里程采样。
   * @param {{lon:number,lat:number,alt?:number}[]} points
   * @returns {{points:Object[], carts:Cesium.Cartesian3[], distances:number[], totalLength:number} | null}
   */
  _buildRouteCache(
    points: DrawTransformGeoInput[],
  ): DrawTransformRouteCache | null {
    const Cesium = this.Cesium;
    if (!Array.isArray(points) || points.length < 2) return null;

    const normalizedPoints = [];
    const carts = [];
    for (const point of points) {
      const normalized = this._normalizeGeoPoint(point);
      if (!normalized) continue;

      const cartesian = Cesium.Cartesian3.fromDegrees(
        normalized.lon,
        normalized.lat,
        normalized.height,
      );
      if (!cartesian) continue;
      normalizedPoints.push({
        lon: normalized.lon,
        lat: normalized.lat,
        alt: normalized.height,
      });
      carts.push(cartesian);
    }

    if (carts.length < 2) return null;

    const distances = [0];
    let totalLength = 0;
    for (let i = 1; i < carts.length; i++) {
      totalLength += Cesium.Cartesian3.distance(carts[i - 1], carts[i]);
      distances.push(totalLength);
    }

    return {
      points: normalizedPoints,
      carts,
      distances,
      totalLength,
    };
  }

  /**
   * 把任意点投影到固定航迹上，得到最接近的航迹里程。
   * @param {Cesium.Cartesian3} cartesian
   * @param {{carts:Cesium.Cartesian3[], distances:number[]}} routeCache
   * @returns {{cartesian:Cesium.Cartesian3, progress:number} | null}
   */
  _projectCartesianToRoute(
    cartesian: Cartesian3,
    routeCache: DrawTransformRouteCache,
  ): { cartesian: Cartesian3; progress: number } | null {
    const Cesium = this.Cesium;
    if (!cartesian || !routeCache?.carts?.length) return null;
    const s = this._scratch;

    let bestDistanceSq = Infinity;
    let bestProgress = 0;
    const bestCartesian = new Cesium.Cartesian3();
    let hasBest = false;
    for (let i = 1; i < routeCache.carts.length; i++) {
      const start = routeCache.carts[i - 1];
      const end = routeCache.carts[i];
      const segment = Cesium.Cartesian3.subtract(end, start, s.routeSegment);
      const relative = Cesium.Cartesian3.subtract(
        cartesian,
        start,
        s.routeRelative,
      );
      const segLenSq = Cesium.Cartesian3.magnitudeSquared(segment);
      const t =
        segLenSq > 0
          ? Cesium.Math.clamp(
              Cesium.Cartesian3.dot(relative, segment) / segLenSq,
              0,
              1,
            )
          : 0;
      const projected = Cesium.Cartesian3.add(
        start,
        Cesium.Cartesian3.multiplyByScalar(segment, t, s.routeScaled),
        s.routeProjected,
      );
      const distanceSq = Cesium.Cartesian3.distanceSquared(
        cartesian,
        projected,
      );
      const progress =
        routeCache.distances[i - 1] +
        (routeCache.distances[i] - routeCache.distances[i - 1]) * t;

      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestProgress = progress;
        Cesium.Cartesian3.clone(projected, bestCartesian);
        hasBest = true;
      }
    }

    return hasBest
      ? { cartesian: bestCartesian, progress: bestProgress }
      : null;
  }

  /**
   * 根据航迹里程采样目标点。
   * @param {{carts:Cesium.Cartesian3[], distances:number[], totalLength:number}} routeCache
   * @param {number} progress
   * @returns {{cartesian:Cesium.Cartesian3, progress:number, finished:boolean} | null}
   */
  _sampleRouteByProgress(
    routeCache: DrawTransformRouteCache,
    progress: number,
  ): { cartesian: Cartesian3; progress: number; finished: boolean } | null {
    const Cesium = this.Cesium;
    if (!routeCache?.carts?.length) return null;

    const clampedProgress = Cesium.Math.clamp(
      Number(progress) || 0,
      0,
      routeCache.totalLength || 0,
    );
    if (routeCache.carts.length === 1 || (routeCache.totalLength || 0) <= 0) {
      return {
        cartesian: routeCache.carts[0],
        progress: 0,
        finished: true,
      };
    }

    for (let i = 1; i < routeCache.distances.length; i++) {
      if (clampedProgress <= routeCache.distances[i]) {
        const start = routeCache.carts[i - 1];
        const end = routeCache.carts[i];
        const startDistance = routeCache.distances[i - 1];
        const segmentDistance = routeCache.distances[i] - startDistance;
        const t =
          segmentDistance > 0
            ? (clampedProgress - startDistance) / segmentDistance
            : 0;
        return {
          cartesian: Cesium.Cartesian3.lerp(
            start,
            end,
            t,
            new Cesium.Cartesian3(),
          ),
          progress: clampedProgress,
          finished: clampedProgress >= routeCache.totalLength,
        };
      }
    }

    return {
      cartesian: routeCache.carts[routeCache.carts.length - 1],
      progress: routeCache.totalLength,
      finished: true,
    };
  }

  /**
   * 创建或更新参考航迹线。
   * @param {{id:string, carts:Cesium.Cartesian3[], show?:boolean, color?:string, width?:number}} arg
   */
  _updateRefPolyline(arg: DrawTransformUpdateRefPolylineArg): void {
    const Cesium = this.Cesium;
    const viewer = this.viewer;
    const { id, carts, show, color, width } = arg || {};
    if (!id) return;

    if (!show) {
      if (this._refPolyline[id]) {
        viewer.entities.remove(this._refPolyline[id]);
        this._refPolyline[id] = undefined;
      }
      return;
    }

    if (!Array.isArray(carts) || carts.length < 2) return;

    const existing = this._refPolyline[id];
    if (existing?.polyline) {
      const pl = existing.polyline as unknown as Record<string, unknown>;
      pl.show = true;
      pl.positions = carts;
      pl.material = Cesium.Color.fromCssColorString(
        color || 'rgba(0,255,0,0.8)',
      );
      pl.width = width ?? 4;
      return;
    }

    this._refPolyline[id] = viewer.entities.add({
      id: `${id}_ref_polyline`,
      polyline: {
        show: true,
        positions: carts,
        material: Cesium.Color.fromCssColorString(color || 'rgba(0,255,0,0.8)'),
        width: width ?? 4,
      } as unknown as Entity['polyline'],
    });
  }

  /**
   * 追加轨迹点（内部统一入口），并确保折线实体只创建一次。
   * @param {string} id
   * @param {Cesium.Cartesian3} point
   * @param {{color?:string,width?:number,smooth?:boolean,smoothSamplesPerSegment?:number,smoothTailRawPoints?:number}} params
   */
  _appendPolylineCartesian(
    id: string,
    point: Cartesian3,
    params?: DrawTransformPolylineStyleParams,
  ): void {
    const Cesium = this.Cesium;
    const viewer = this.viewer;
    if (!id || !point) return;

    this._pushUniquePolylinePoint(id, point);

    if (!this._polylineSmoothCfg[id]) {
      this._polylineSmoothCfg[id] = {
        enabled: params?.smooth ?? true,
        samplesPerSegment: params?.smoothSamplesPerSegment ?? 10,
        keepTailRawPoints: params?.smoothTailRawPoints ?? 2,
      };
    }

    if (!Cesium.defined(this._polyLine[id])) {
      const positionsRef = this._positionsd[id];
      this._polyLine[id] = viewer.entities.add({
        id: `${id}_polyline`,
        polyline: {
          show: true,
          positions: new Cesium.CallbackProperty(
            () => this._getRenderedPolylinePositions(id, positionsRef),
            false,
          ),
          material: params?.color
            ? Cesium.Color.fromCssColorString(params.color)
            : Cesium.Color.RED,
          width: params?.width ?? 5,
        } as unknown as Entity['polyline'],
      });
    }
  }

  /**
   * 当显式传入 drawRouteLine 时，同步参考航迹线显隐与样式。
   * @param {{id:string, routeCache?:{carts:Cesium.Cartesian3[]}, drawRouteLine?:boolean, refLineColor?:string, refLineWidth?:number}} arg
   */
  _syncRouteLineByParam(arg: DrawTransformSyncRouteLineArg): void {
    const { id, routeCache, drawRouteLine, refLineColor, refLineWidth } =
      arg || {};
    if (
      !id ||
      !routeCache ||
      !Object.prototype.hasOwnProperty.call(arg || {}, 'drawRouteLine')
    )
      return;
    this._updateRefPolyline({
      id,
      carts: routeCache.carts,
      show: !!drawRouteLine,
      color: refLineColor,
      width: refLineWidth,
    });
  }

  /**
   * 设置（动态）飞行速度，单位 m/s。
   * - 通过调节 viewer.clock.multiplier 实现实时变速（不重建采样）
   * @param {{id:string, speedMps:number}} params
   */
  setSpeedMps(params: DrawTransformSetSpeedMpsParams): void {
    const { id, speedMps } = params || {};
    if (!id) return;
    const base = this._flightBaseSpeedMps[id];
    if (!base || !(base > 0)) return;
    const s = Number(speedMps);
    if (!(s > 0)) return;
    this.viewer.clock.multiplier = s / base;
  }

  /**
   * 通过一组航迹点位，让模型沿轨迹平滑飞行。
   * @param {{
   *   id: string,
   *   points: {lon:number,lat:number,alt?:number}[],
   *   speedMps: number,
   *   loop?: boolean,
   *   drawRefLine?: boolean,
   *   refLineColor?: string,
   *   refLineWidth?: number,
   *   interpMode?: 'linear'|'smooth',
   *   url?: string,
   *   minSize?: number,
   *   maxScale?: number,
   *   maxSize?: number,
   *   MaxSize?: number
   * }} params
   */
  flyByTrackPoints(params: DrawTransformFlyByTrackParams): void {
    const Cesium = this.Cesium;
    const viewer = this.viewer;
    const id = params?.id;
    const points = params?.points;
    const speedMps = Number(params?.speedMps);
    if (!id || !Array.isArray(points) || points.length < 2) return;
    if (!(speedMps > 0)) return;

    // 确保实体存在：若不存在，按第一个点创建
    if (!this._entitys[id]) {
      this.addEntity({
        ...params,
        id,
        position: points[0],
      });
    }
    const entity = this._entitys[id];

    const carts = points
      .map((p) => this._pointToCartesian(p))
      .filter((p) => !!p);
    if (carts.length < 2) return;

    this._updateRefPolyline({
      id,
      carts,
      show: !!params.drawRefLine,
      color: params.refLineColor,
      width: params.refLineWidth,
    });

    // 生成 SampledPositionProperty 采样（一次性写入整条轨迹）
    const spp = this._getOrCreateSampledPositionProperty(id);
    const sppClear = spp as SampledPositionProperty & {
      removeAllSamples?: () => void;
    };
    if (typeof sppClear.removeAllSamples === 'function')
      sppClear.removeAllSamples();
    this._lastSampleTime[id] = null;

    // 插值模式：默认 linear（更贴近折线）；smooth 更圆滑
    const interpMode = params?.interpMode || 'linear';
    if (interpMode === 'smooth') {
      spp.setInterpolationOptions({
        interpolationDegree: 2,
        interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
      });
    } else {
      spp.setInterpolationOptions({
        interpolationDegree: 1,
        interpolationAlgorithm: Cesium.LinearApproximation,
      });
    }

    const minDt = 0.05; // 秒，避免 0 dt
    let t = Cesium.JulianDate.clone(viewer.clock.currentTime);
    spp.addSample(t, carts[0]);

    for (let i = 1; i < carts.length; i++) {
      const dist = Cesium.Cartesian3.distance(carts[i - 1], carts[i]);
      const dt = Math.max(minDt, dist / speedMps);
      t = Cesium.JulianDate.addSeconds(t, dt, new Cesium.JulianDate());
      spp.addSample(t, carts[i]);
    }

    // 位置 + 朝向
    entity.position = spp;
    entity.orientation = new Cesium.VelocityOrientationProperty(spp);

    // clock 播放区间
    viewer.clock.startTime = Cesium.JulianDate.clone(viewer.clock.currentTime);
    viewer.clock.stopTime = Cesium.JulianDate.clone(t);
    viewer.clock.currentTime = Cesium.JulianDate.clone(viewer.clock.startTime);
    viewer.clock.clockRange = params.loop
      ? Cesium.ClockRange.LOOP_STOP
      : Cesium.ClockRange.CLAMPED;
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = true;

    // 速度基准，供滑块实时变速
    this._flightBaseSpeedMps[id] = speedMps;
  }

  /**
   * 往 SampledPositionProperty 添加“当前点 -> 目标点”的过渡采样。
   * - 通过 future sample 让实体在指定时长内平滑飞向目标点，避免点到点瞬移
   * @param {{id:string, cartesian:Cesium.Cartesian3, durationSec?:number}} arg
   */
  _addSmoothPositionSample(
    arg: DrawTransformAddSmoothSampleArg,
  ): DrawTransformSmoothSampleInfo | null {
    const Cesium = this.Cesium;
    const { id, cartesian } = arg || {};
    if (!id || !cartesian) return null;

    const spp = this._getOrCreateSampledPositionProperty(id);
    const durationSec = Math.max(
      0.05,
      this._resolveSmoothDurationSec(arg?.durationSec, 1.0),
    );

    let now = Cesium.JulianDate.clone(this.viewer.clock.currentTime);
    const lastT = this._lastSampleTime[id];
    if (lastT && Cesium.JulianDate.lessThanOrEquals(now, lastT)) {
      // 极端情况下（同一帧多次调用）保证递增
      now = Cesium.JulianDate.addSeconds(lastT, 0.001, new Cesium.JulianDate());
    }

    // 起点采用当前可见位置，避免收到新点时出现“回拉”
    let fromCartesian = null;
    try {
      fromCartesian = spp.getValue(now) || null;
    } catch (_) {
      // ignore
    }
    if (!fromCartesian) {
      const entity = this._entitys[id];
      fromCartesian = this._getEntityCartesian(entity);
    }
    if (!fromCartesian) fromCartesian = cartesian;

    spp.addSample(now, fromCartesian);

    let targetTime = Cesium.JulianDate.addSeconds(
      now,
      durationSec,
      new Cesium.JulianDate(),
    );
    if (Cesium.JulianDate.lessThanOrEquals(targetTime, now)) {
      targetTime = Cesium.JulianDate.addSeconds(
        now,
        0.05,
        new Cesium.JulianDate(),
      );
    }

    spp.addSample(targetTime, cartesian);
    this._lastSampleTime[id] = targetTime;
    return {
      startTime: Cesium.JulianDate.clone(now),
      targetTime: Cesium.JulianDate.clone(targetTime),
      fromCartesian: Cesium.Cartesian3.clone(fromCartesian),
      targetCartesian: Cesium.Cartesian3.clone(cartesian),
    };
  }

  /**
   * 设置稳定速度朝向：段头和段尾低速时保持上一有效朝向，避免抖动。
   * @param {{id:string, spp:Cesium.SampledPositionProperty, minTailSpeedMps?:number, minHeadSpeedMps?:number, headHoldSec?:number, orientationSampleDtSec?:number}} arg
   */
  _setStableVelocityOrientation(
    arg: DrawTransformStableVelocityOrientationArg,
  ): void {
    const Cesium = this.Cesium;
    const { id, spp } = arg || {};
    if (!id || !spp) return;

    const minTailSpeedMps = Math.max(0, Number(arg.minTailSpeedMps) || 2.2);
    const minHeadSpeedMps = Math.max(
      minTailSpeedMps,
      Number(arg.minHeadSpeedMps) || 4.2,
    );
    const headHoldSec = Math.max(0, Number(arg.headHoldSec) || 0.28);
    const orientationSampleDtSec = Math.max(
      0.02,
      Number(arg.orientationSampleDtSec) || 0.1,
    );

    if (
      !this._velocityOrientationProp[id] ||
      this._velocityOrientationSpp[id] !== spp
    ) {
      this._velocityOrientationProp[id] =
        new Cesium.VelocityOrientationProperty(spp);
      this._velocityOrientationSpp[id] = spp;
    }

    const now = Cesium.JulianDate.clone(this.viewer.clock.currentTime);
    this._orientationHoldState[id] = {
      headLockUntil: Cesium.JulianDate.addSeconds(
        now,
        headHoldSec,
        new Cesium.JulianDate(),
      ),
      headUnlocked: false,
    };

    const vop = this._velocityOrientationProp[id];
    const entity = this._entitys[id];
    if (!entity) return;
    const t1Scratch = new Cesium.JulianDate();
    const velScratch = new Cesium.Cartesian3();

    asEntityCompat(entity).orientation = new Cesium.CallbackProperty((time) => {
      if (!time) return this._lastStableOrientation[id];
      const holdState = this._orientationHoldState[id] || {
        headLockUntil: null,
        headUnlocked: true,
      };
      const p0 = spp.getValue(time);
      const qNow = vop.getValue(time);
      if (!p0) return this._lastStableOrientation[id] || qNow;

      const t1 = Cesium.JulianDate.addSeconds(
        time,
        orientationSampleDtSec,
        t1Scratch,
      );
      const p1 = spp.getValue(t1);
      if (!p1) return this._lastStableOrientation[id] || qNow;

      const vel = Cesium.Cartesian3.subtract(p1, p0, velScratch);
      const speed = Cesium.Cartesian3.magnitude(vel) / orientationSampleDtSec;

      const inHeadWindow =
        holdState.headLockUntil &&
        Cesium.JulianDate.lessThan(time, holdState.headLockUntil);
      if (!holdState.headUnlocked) {
        if (speed >= minHeadSpeedMps) {
          holdState.headUnlocked = true;
        } else if (inHeadWindow) {
          return this._lastStableOrientation[id] || qNow;
        } else {
          holdState.headUnlocked = true;
        }
      }

      if (speed >= minTailSpeedMps && qNow) {
        this._lastStableOrientation[id] = Cesium.Quaternion.clone(
          qNow,
          new Cesium.Quaternion(),
        );
        return qNow;
      }

      return this._lastStableOrientation[id] || qNow;
    }, false);
  }

  /**
   * 添加模型实体。
   * @param {{
   *   id: string,
   *   position: {lon:number, lat:number, alt?:number, het?:number, height?:number},
   *   rotates?: {heading?:number, pitch?:number, roll?:number},
   *   url?: string,
   *   minSize?: number,
   *   maxScale?: number,
   *   maxSize?: number,
   *   MaxSize?: number
   * }} params
   */
  addEntity(params: DrawTransformAddEntityParams): void {
    const Cesium = this.Cesium;
    const normalized = this._normalizeGeoPoint(params.position || {});
    if (!normalized) return;

    const modelConfig = this._resolveModelConfig(params);
    const cartesian = Cesium.Cartesian3.fromDegrees(
      normalized.lon,
      normalized.lat,
      normalized.height,
    );
    const hpr = this._toHeadingPitchRoll(
      this._normalizeRotatesByModelConfig(params.rotates, modelConfig),
    );

    const entity = this.viewer.entities.add({
      id: params.id,
      position: cartesian,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(cartesian, hpr),
      model: {
        uri: params.url || uavEditModelUrl,
        scale:
          modelConfig?.sourceSizeMeters ||
          modelConfig?.targetPixelSize ||
          modelConfig?.minScale !== undefined ||
          modelConfig?.maxScale !== undefined
            ? this._createModelScaleProperty(params.id)
            : undefined,
        minimumPixelSize:
          modelConfig?.minimumPixelSize ??
          (modelConfig ? 0 : params.minSize ?? 128), // 最小的模型像素
        maximumScale:
          modelConfig?.maximumScale ??
          params.maxScale ??
          params.maxSize ??
          params.MaxSize ??
          10000, // 最大缩放倍数（不是像素）
      },
    });

    this._entitys[params.id] = entity;
    this._modelConfig[params.id] = modelConfig;
  }

  /**
   * 追加一段轨迹点，并在首次调用时创建折线实体。
   * @param {{
   *   id: string,
   *   position: {lon:number, lat:number, alt?:number, het?:number, height?:number},
   *   color?: string,
   *   width?: number
   * }} params
   */
  addtransPolyLine(params: DrawTransformAddPolylineParams): void {
    const id = params.id;
    if (!id) return;

    const point = this._pointToCartesian(params.position || {});
    if (!point) return;
    this._appendPolylineCartesian(id, point, params);
  }

  /**
   * 追加轨迹点（Cartesian3 版本）。
   * @param {{id:string, cartesian:Cesium.Cartesian3, color?:string, width?:number, smooth?:boolean, smoothSamplesPerSegment?:number}} params
   */
  addtransPolyLineByCartesian(
    params: DrawTransformAddPolylineByCartesianParams,
  ): void {
    const cartesian = params?.cartesian;
    if (!params?.id || !cartesian) return;
    this._appendPolylineCartesian(params.id, cartesian, params);
  }

  /**
   * 沿固定航迹接收实时点位，并在断点时按航迹外推下一个位置。
   * - 首次调用可传 routePoints 初始化，后续不传则沿用缓存
   * - 有实时点时默认使用真实点位；仅 snapToRoute=true 时才吸附到航迹
   * - 无实时点且未结束时，按上一速度方向惯性外推
   * - ended=true 后停止外推，等待下一次明确数据/重置
   * @param {{
   *   id:string,
   *   position?: {lon:number,lat:number,alt?:number,het?:number,height?:number},
   *   routePoints?: {lon:number,lat:number,alt?:number,het?:number,height?:number}[],
   *   ended?: boolean,
   *   fallbackSpeedMps?: number,
   *   snapToRoute?: boolean,
   *   allowBacktrack?: boolean,
   *   drawRouteLine?: boolean,
   *   refLineColor?: string,
   *   refLineWidth?: number,
   *   ifDrawLine?: boolean,
   *   smoothMove?: boolean,
   *   smoothDurationSec?: number,
   *   smooth?: boolean,
   *   smoothSamplesPerSegment?: number,
   *   rotates?: {heading?:number,pitch?:number,roll?:number},
   *   url?: string,
   *   minSize?: number,
   *   maxScale?: number,
   *   maxSize?: number,
   *   MaxSize?: number
   * }} params
   */
  startRealtimeTrackByPath(
    params: DrawTransformStartRealtimeTrackParams,
  ): void {
    const Cesium = this.Cesium;
    const id = params?.id;
    if (!id) return;

    const hasRoutePoints =
      Array.isArray(params.routePoints) && params.routePoints.length >= 2;
    if (hasRoutePoints) {
      const routeCache = this._buildRouteCache(
        params.routePoints as DrawTransformGeoInput[],
      );
      if (!routeCache) return;
      const prevState = this._realtimeRouteState[id] || {};
      this._realtimeRouteState[id] = {
        ...prevState,
        routeCache,
        ended: false,
      };

      this._syncRouteLineByParam({
        id,
        routeCache,
        drawRouteLine: params.drawRouteLine,
        refLineColor: params.refLineColor,
        refLineWidth: params.refLineWidth,
      });
    }

    if (!this._realtimeRouteState[id]) this._realtimeRouteState[id] = {};
    const state = this._realtimeRouteState[id];

    this._syncRouteLineByParam({
      id,
      routeCache: state.routeCache,
      drawRouteLine: params.drawRouteLine,
      refLineColor: params.refLineColor,
      refLineWidth: params.refLineWidth,
    });

    state.ended = !!params.ended;

    const nowSeconds = this._getNowSeconds();
    const fallbackSpeedMps = Number(params.fallbackSpeedMps);
    let targetCartesian: Cartesian3 | null = null;
    const currentEntityCartesian = this._getEntityCartesian(this._entitys[id]);

    // 实时模式默认更快收敛，避免“目标点持续在前方”造成拖尾感
    let realtimeSmoothDurationSec = Number(params.smoothDurationSec);
    if (!(realtimeSmoothDurationSec > 0)) {
      const defaultDuration = Number(this._defaultSmoothDurationSec);
      if (defaultDuration > 0) {
        realtimeSmoothDurationSec = defaultDuration;
      } else {
        const lu = state.lastUpdateSeconds;
        const refSeconds = Number.isFinite(lu)
          ? (lu as number)
          : nowSeconds - 1.0;
        const delta = Math.max(0.05, nowSeconds - refSeconds);
        // 时长尽量贴近数据到达间隔，避免每段结束出现“停顿->转头”
        realtimeSmoothDurationSec = Cesium.Math.clamp(delta * 0.95, 0.12, 1.5);
      }
    }

    const posArg = params.position;
    if (
      posArg !== null &&
      posArg !== undefined &&
      this._isValidGeoPoint(posArg)
    ) {
      // 实时点恢复：结束空值外推会话，避免沿用旧状态导致折返
      state.gapExtrapolationActive = false;
      state.gapStartSeconds = undefined;
      state.gapAnchorCartesian = undefined;
      state.gapDirection = undefined;
      state.gapSpeedMps = undefined;
      state.gapLastTargetCartesian = undefined;

      const realtimeCartesian = this._pointToCartesian(posArg);
      if (!realtimeCartesian) return;
      const followRoute = params.snapToRoute === true;
      const referenceSeconds = Number.isFinite(state.lastRealtimeSeconds)
        ? state.lastRealtimeSeconds
        : state.lastUpdateSeconds;

      // 原始输入点位速度/方向缓存：用于方向与空值外推（不使用平滑轨迹）
      const prevInputCartesian = state.lastInputCartesian;
      const prevInputSeconds = state.lastInputSeconds;
      if (
        prevInputCartesian &&
        prevInputSeconds !== null &&
        prevInputSeconds !== undefined &&
        Number.isFinite(prevInputSeconds)
      ) {
        const dtInput = Math.max(0.001, nowSeconds - prevInputSeconds);
        const deltaInput = Cesium.Cartesian3.subtract(
          realtimeCartesian,
          prevInputCartesian,
          new Cesium.Cartesian3(),
        );
        const distInput = Cesium.Cartesian3.magnitude(deltaInput);
        if (distInput > 0.01) {
          state.lastInputSpeedMps = distInput / dtInput;
          state.lastInputDirection = Cesium.Cartesian3.normalize(
            deltaInput,
            new Cesium.Cartesian3(),
          );
          const inputRotates = this._computeRotatesFromPair(
            prevInputCartesian,
            realtimeCartesian,
            state.lastInputRotates,
          );
          if (inputRotates) state.lastInputRotates = inputRotates;
        }
      }
      state.lastInputCartesian = Cesium.Cartesian3.clone(realtimeCartesian);
      state.lastInputSeconds = nowSeconds;

      if (followRoute && state.routeCache) {
        const projected = this._projectCartesianToRoute(
          realtimeCartesian,
          state.routeCache,
        );
        if (!projected) return;

        let nextProgress = projected.progress;
        if (
          !(params.allowBacktrack ?? false) &&
          state.lastRenderProgress !== null &&
          state.lastRenderProgress !== undefined &&
          Number.isFinite(state.lastRenderProgress)
        ) {
          nextProgress = Math.max(nextProgress, state.lastRenderProgress);
        }

        const snapped = this._sampleRouteByProgress(
          state.routeCache,
          nextProgress,
        );
        if (!snapped) return;

        state.lastRealtimeProgress = nextProgress;
        state.lastRenderProgress = nextProgress;
        targetCartesian = snapped.cartesian;
      } else {
        // 默认：严格使用实时上报位置，不做贴航迹修正
        if (state.routeCache) {
          const projected = this._projectCartesianToRoute(
            realtimeCartesian,
            state.routeCache,
          );
          if (projected) {
            state.lastRealtimeProgress = projected.progress;
            state.lastRenderProgress = projected.progress;
          }
        }

        targetCartesian = realtimeCartesian;
      }

      // 空点期间已做惯性外推时，实时点恢复可能落在后方；默认禁止回拉
      const forbidBacktrack = !(params.allowBacktrack ?? false);
      const velocity = state.lastVelocityCartesian;
      const refCartesian =
        currentEntityCartesian || state.lastRealtimeCartesian;
      if (
        forbidBacktrack &&
        targetCartesian &&
        refCartesian &&
        velocity &&
        Cesium.Cartesian3.magnitudeSquared(velocity) > 1e-6
      ) {
        const moveVec = Cesium.Cartesian3.subtract(
          targetCartesian,
          refCartesian,
          new Cesium.Cartesian3(),
        );
        if (Cesium.Cartesian3.dot(moveVec, velocity) < 0) {
          targetCartesian = Cesium.Cartesian3.clone(refCartesian);
        }
      }

      const prevAcceptedCartesian = state.lastAcceptedCartesian;
      const prevAcceptedSeconds = state.lastAcceptedSeconds;
      if (
        prevAcceptedCartesian &&
        prevAcceptedSeconds !== null &&
        prevAcceptedSeconds !== undefined &&
        Number.isFinite(prevAcceptedSeconds) &&
        targetCartesian
      ) {
        const dtAccepted = Math.max(0.001, nowSeconds - prevAcceptedSeconds);
        const deltaAccepted = Cesium.Cartesian3.subtract(
          targetCartesian,
          prevAcceptedCartesian,
          new Cesium.Cartesian3(),
        );
        const distAccepted = Cesium.Cartesian3.magnitude(deltaAccepted);
        if (distAccepted > 0.01) {
          state.lastAcceptedSpeedMps = distAccepted / dtAccepted;
          state.lastAcceptedDirection = Cesium.Cartesian3.normalize(
            deltaAccepted,
            new Cesium.Cartesian3(),
          );
        }
      }

      const prevRealtimeCartesian = state.lastRealtimeCartesian;
      if (
        prevRealtimeCartesian &&
        referenceSeconds !== null &&
        referenceSeconds !== undefined &&
        Number.isFinite(referenceSeconds) &&
        targetCartesian
      ) {
        const deltaSeconds = Math.max(0.001, nowSeconds - referenceSeconds);
        const deltaVec = Cesium.Cartesian3.subtract(
          targetCartesian,
          prevRealtimeCartesian,
          new Cesium.Cartesian3(),
        );
        const deltaDist = Cesium.Cartesian3.magnitude(deltaVec);
        if (deltaDist > 0.01) {
          state.lastSpeedMps = deltaDist / deltaSeconds;
          state.lastVelocityCartesian = Cesium.Cartesian3.multiplyByScalar(
            deltaVec,
            1 / deltaSeconds,
            new Cesium.Cartesian3(),
          );
        }
      } else if (fallbackSpeedMps > 0 && !((state.lastSpeedMps ?? 0) > 0)) {
        state.lastSpeedMps = fallbackSpeedMps;
      }

      state.lastRealtimeSeconds = nowSeconds;
      if (targetCartesian) {
        state.lastRealtimeCartesian = Cesium.Cartesian3.clone(targetCartesian);
        state.lastAcceptedSeconds = nowSeconds;
        state.lastAcceptedCartesian = Cesium.Cartesian3.clone(targetCartesian);
      }
    } else if (!state.ended) {
      // 空点时：按“固定起点+固定方向+固定速度”连续外推，避免每帧重算引发回退/转弯
      const baseCartesian =
        state.lastRealtimeCartesian || currentEntityCartesian;
      if (!baseCartesian) {
        state.lastUpdateSeconds = nowSeconds;
        return;
      }

      let direction =
        state.gapDirection ||
        state.lastInputDirection ||
        state.lastAcceptedDirection;
      if (
        !direction &&
        state.lastVelocityCartesian &&
        Cesium.Cartesian3.magnitudeSquared(state.lastVelocityCartesian) > 1e-6
      ) {
        direction = Cesium.Cartesian3.normalize(
          state.lastVelocityCartesian,
          new Cesium.Cartesian3(),
        );
      }

      const gsp = state.gapSpeedMps ?? 0;
      const lis = state.lastInputSpeedMps ?? 0;
      const las = state.lastAcceptedSpeedMps ?? 0;
      const lsm = state.lastSpeedMps ?? 0;
      const speedMps =
        gsp > 0
          ? gsp
          : lis > 0
          ? lis
          : las > 0
          ? las
          : lsm > 0
          ? lsm
          : fallbackSpeedMps > 0
          ? fallbackSpeedMps
          : 0;

      if (direction && speedMps > 0) {
        if (!state.gapExtrapolationActive) {
          state.gapExtrapolationActive = true;
          state.gapStartSeconds = nowSeconds;
          state.gapAnchorCartesian = Cesium.Cartesian3.clone(baseCartesian);
          state.gapDirection = Cesium.Cartesian3.clone(direction);
          state.gapSpeedMps = speedMps;
          state.gapLastTargetCartesian = Cesium.Cartesian3.clone(baseCartesian);
        }

        const activeDirection = state.gapDirection as Cartesian3;
        const activeSpeedMps = state.gapSpeedMps as number;
        const gapAnchor = state.gapAnchorCartesian as Cartesian3;
        const elapsed = Math.max(
          0,
          nowSeconds - (state.gapStartSeconds ?? nowSeconds),
        );
        const offsetMeters = activeSpeedMps * elapsed;

        targetCartesian = Cesium.Cartesian3.add(
          gapAnchor,
          Cesium.Cartesian3.multiplyByScalar(
            activeDirection,
            offsetMeters,
            new Cesium.Cartesian3(),
          ),
          new Cesium.Cartesian3(),
        );

        const prevGapTarget = state.gapLastTargetCartesian;
        if (prevGapTarget && targetCartesian) {
          const advance = Cesium.Cartesian3.subtract(
            targetCartesian,
            prevGapTarget,
            new Cesium.Cartesian3(),
          );
          if (Cesium.Cartesian3.dot(advance, activeDirection) < 0) {
            targetCartesian = Cesium.Cartesian3.clone(prevGapTarget);
          }
        }

        if (targetCartesian) {
          state.gapLastTargetCartesian =
            Cesium.Cartesian3.clone(targetCartesian);
          state.lastRealtimeCartesian =
            Cesium.Cartesian3.clone(targetCartesian);
          state.lastVelocityCartesian = Cesium.Cartesian3.multiplyByScalar(
            activeDirection,
            activeSpeedMps,
            new Cesium.Cartesian3(),
          );
        }
      } else {
        // 没有有效速度向量时保持当前位置，等待下一条实时点
        targetCartesian = state.gapLastTargetCartesian || baseCartesian;
      }

      state.lastRealtimeSeconds = nowSeconds;
    } else {
      // 结束信号：收尾定格到最后目标位姿，停止继续采样追加，减少末段抖动
      const entity = this._entitys[id];
      const finalCartesian =
        state.lastRealtimeCartesian || this._getEntityCartesian(entity);
      if (entity && finalCartesian) {
        const ent = asEntityCompat(entity);
        ent.position = Cesium.Cartesian3.clone(finalCartesian);
        const stableOrientation = this._lastStableOrientation[id];
        if (stableOrientation) {
          ent.orientation = Cesium.Quaternion.clone(
            stableOrientation,
            new Cesium.Quaternion(),
          );
        }

        // 收尾时补一个最终轨迹点，随后关闭 tick 追随写线
        if (params.ifDrawLine) {
          this.addtransPolyLineByCartesian({
            id,
            cartesian: finalCartesian,
            color: params.color,
            width: params.width,
            smooth: params.smooth,
            smoothSamplesPerSegment: params.smoothSamplesPerSegment,
          });
        }
      }

      this._flushCompletedLineSegments(id);
      if (this._lineSegmentState[id]?.pendingSegments) {
        this._lineSegmentState[id].pendingSegments.length = 0;
      }
      state.lastUpdateSeconds = nowSeconds;
      state.gapExtrapolationActive = false;
      return;
    }

    const targetPosition = this._cartesianToPoint(targetCartesian);
    if (!targetPosition) return;

    state.lastUpdateSeconds = nowSeconds;

    this.startTransfromEnt({
      ...params,
      position: targetPosition,
      // 方向优先使用定时器传入的原始点位计算结果，避免受平滑轨迹影响
      rotates: params.rotates ?? state.lastInputRotates,
      smoothMove: params.smoothMove ?? true,
      smoothDurationSec: realtimeSmoothDurationSec,
    });
  }

  /**
   * 更新（或创建）移动模型，并根据参数决定是否绘制轨迹线与朝向。
   * @param {{
   *   id: string,
   *   position: {lon:number, lat:number, alt?:number, het?:number, height?:number},
   *   rotates?: {heading?:number, pitch?:number, roll?:number},
   *   ifDrawLine?: boolean,
   *   lineStepMeters?: number,
   *   simplifyTolerance?: number,
   *   smoothDurationSec?: number,
   *   useVelocityOrientation?: boolean,
   *   enableTailHeadingHold?: boolean,
   *   minTailSpeedMps?: number,
   *   minHeadSpeedMps?: number,
   *   headHoldSec?: number,
   *   orientationSampleDtSec?: number,
   *   url?: string,
   *   minSize?: number,
   *   maxScale?: number,
   *   maxSize?: number,
   *   MaxSize?: number
   * }} params
   */
  startTransfromEnt(params: DrawTransformStartTransformEntParams): void {
    const Cesium = this.Cesium;
    const id = params.id;
    const modelConfig = this._resolveModelConfig(params);

    if (!this._entitys[id]) this.addEntity(params);

    const entity = this._entitys[id];
    if (modelConfig) {
      this._modelConfig[id] = modelConfig;
      const modelGraphic = (entity as any)?.model;
      if (modelGraphic) {
        modelGraphic.minimumPixelSize =
          modelConfig.minimumPixelSize ??
          (modelConfig ? 0 : params.minSize ?? 128);
        modelGraphic.maximumScale =
          modelConfig.maximumScale ??
          params.maxScale ??
          params.maxSize ??
          params.MaxSize ??
          10000;
        if (
          modelConfig.sourceSizeMeters ||
          modelConfig.targetPixelSize ||
          modelConfig.minScale !== undefined ||
          modelConfig.maxScale !== undefined
        ) {
          modelGraphic.scale = this._createModelScaleProperty(id);
        }
      }
    }
    const prevCartesian = this._getEntityCartesian(entity);

    const normalized = this._normalizeGeoPoint(params.position || {});
    if (!normalized) return;
    const cartesian = Cesium.Cartesian3.fromDegrees(
      normalized.lon,
      normalized.lat,
      normalized.height,
    );

    let segmentState = null;
    if (params.ifDrawLine) {
      segmentState = this._lineSegmentState[id] || {
        pendingSegments: [],
      };
      this._lineSegmentState[id] = segmentState;

      this._flushCompletedLineSegments(id);
      // 先保证折线实体存在，避免“飞行中无轨迹，结束后才出现”
      this._appendPolylineCartesian(id, prevCartesian || cartesian, params);
    } else {
      delete this._lineSegmentState[id];
    }

    // 模型移动平滑：默认开启（可传 smoothMove:false 关闭）
    let smoothSampleInfo = null;
    const useVelocityOrientation = params.useVelocityOrientation ?? true;
    const enableTailHeadingHold = params.enableTailHeadingHold ?? true;
    if (params.smoothMove ?? true) {
      // SampledPositionProperty 依赖 clock.currentTime 前进；停机坪等页面可能默认不走时钟，导致模型“钉住不动”
      if (!this.viewer.clock.shouldAnimate) {
        this.viewer.clock.shouldAnimate = true;
      }
      if (!(this.viewer.clock.multiplier > 0)) {
        this.viewer.clock.multiplier = 1;
      }
      smoothSampleInfo = this._addSmoothPositionSample({
        id,
        cartesian,
        durationSec: params.smoothDurationSec,
      });
      const spp = this._getOrCreateSampledPositionProperty(id);
      asEntityCompat(entity).position = spp;
      // 锁定跟随场景下，速度驱动朝向比每段手工算角更连续，能显著减少抖动
      if (!params.rotates && useVelocityOrientation) {
        if (enableTailHeadingHold) {
          this._setStableVelocityOrientation({
            id,
            spp,
            minTailSpeedMps: params.minTailSpeedMps,
            minHeadSpeedMps: params.minHeadSpeedMps,
            headHoldSec: params.headHoldSec,
            orientationSampleDtSec: params.orientationSampleDtSec,
          });
        } else {
          asEntityCompat(entity).orientation =
            new Cesium.VelocityOrientationProperty(spp);
        }
      }
    } else {
      asEntityCompat(entity).position = cartesian;
    }

    if (params.ifDrawLine && segmentState) {
      if (smoothSampleInfo?.targetTime && smoothSampleInfo?.startTime) {
        segmentState.pendingSegments.push({
          startTime: Cesium.JulianDate.clone(smoothSampleInfo.startTime),
          targetTime: Cesium.JulianDate.clone(smoothSampleInfo.targetTime),
          startCartesian: Cesium.Cartesian3.clone(
            smoothSampleInfo.fromCartesian,
          ),
          targetCartesian: Cesium.Cartesian3.clone(
            smoothSampleInfo.targetCartesian,
          ),
        });
      } else {
        this._appendPolylineCartesian(id, cartesian, params);
      }
    }

    if (params.rotates) {
      this.rotateEnt(params);
    } else {
      if ((params.smoothMove ?? true) && useVelocityOrientation) {
        return;
      }
      // 未显式传 rotates 时：尝试用轨迹点自动推算朝向（需要至少 2 个点）
      this._autoRotateFromMovement({
        id,
        prevCartesian,
        currCartesian: cartesian,
      });
    }
  }
  /**
   * 更新模型朝向（Heading/Pitch/Roll）。
   * @param {{id: string, rotates: {heading?:number, pitch?:number, roll?:number}}} params
   */
  rotateEnt(params: DrawTransformRotateEntParams): void {
    const Cesium = this.Cesium;
    const entity = this._entitys[params.id];
    if (!entity) return;

    const hpr = this._toHeadingPitchRoll(
      this._normalizeRotatesByModelConfig(
        params.rotates,
        this._modelConfig[params.id],
      ),
    );

    const posProp = entity.position;
    const position = posProp?.getValue
      ? posProp.getValue(this.viewer.clock.currentTime)
      : (posProp as unknown as Cartesian3 | undefined);
    if (!position) return;

    asEntityCompat(entity).orientation =
      Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
  }

  /**
   * 锁定（跟随）某个实体。
   * - 通过 viewer.trackedEntity 实现跟随
   * - 首次锁定会保存当前相机视角，便于 unlock 恢复
   * @param {string} id
   * @param {{viewFrom?: Cesium.Cartesian3}} [options]
   */
  lockEntity(id: string, options?: DrawTransformLockEntityOptions): void {
    const Cesium = this.Cesium;
    const viewer = this.viewer;
    if (!viewer || !id) return;

    const entity = this._entitys[id] || viewer.entities.getById(id);
    if (!entity) return;

    // 保存当前相机状态（仅在第一次进入锁定时保存）
    if (!this._lockState) {
      const camera = viewer.camera;
      this._lockState = {
        prevTrackedEntity: viewer.trackedEntity,
        lockedId: id,
        camera: {
          destination: Cesium.Cartesian3.clone(camera.positionWC),
          heading: camera.heading,
          pitch: camera.pitch,
          roll: camera.roll,
        },
      };
    } else {
      this._lockState.lockedId = id;
    }

    // 可选：设置跟随视角偏移（在实体参考系下）
    const ent = asEntityCompat(entity);
    if (options?.viewFrom) {
      ent.viewFrom = options.viewFrom;
    } else if (!entity.viewFrom) {
      ent.viewFrom = new Cesium.Cartesian3(-200.0, 0.0, 80.0);
    }

    viewer.trackedEntity = entity;
  }

  /**
   * 解除锁定（停止跟随）。
   * - 恢复 lock 前的 trackedEntity
   * - 若之前没有 trackedEntity，则恢复 lock 前相机视角
   */
  unlockEntity(): void {
    const viewer = this.viewer;
    if (!viewer) return;

    const state = this._lockState;
    if (!state) {
      viewer.trackedEntity = undefined;
      return;
    }

    viewer.trackedEntity = state.prevTrackedEntity;

    // 如果之前也没跟随任何实体，则恢复相机位置/姿态
    if (!state.prevTrackedEntity && state.camera?.destination) {
      viewer.camera.setView({
        destination: state.camera.destination,
        orientation: {
          heading: state.camera.heading,
          pitch: state.camera.pitch,
          roll: state.camera.roll,
        },
      });
    }

    this._lockState = null;
  }

  /**
   * 清空所有已创建的实体与轨迹数据。
   */
  clear(): void {
    const cacheMaps = [
      this._entitys,
      this._polyLine,
      this._positionsd,
      this._lastAutoRotates,
      this._polylineSmoothCfg,
      this._sampledPositions,
      this._lastSampleTime,
      this._modelConfig,
      this._modelScale,
      this._velocityOrientationProp,
      this._velocityOrientationSpp,
      this._lastStableOrientation,
      this._orientationHoldState,
      this._realtimeRouteState,
      this._lineSegmentState,
      this._flightBaseSpeedMps,
    ];

    for (const id in this._entitys) {
      if (!Object.prototype.hasOwnProperty.call(this._entitys, id)) continue;
      const entity = this._entitys[id];
      const polyline = this._polyLine[id];

      if (entity) this.viewer.entities.remove(entity);
      if (polyline) this.viewer.entities.remove(polyline);

      for (let i = 0; i < cacheMaps.length; i++) {
        delete cacheMaps[i][id];
      }
    }

    for (const id in this._refPolyline) {
      if (!Object.prototype.hasOwnProperty.call(this._refPolyline, id))
        continue;
      const ref = this._refPolyline[id];
      if (ref) this.viewer.entities.remove(ref);
      delete this._refPolyline[id];
    }

    // 清空时也解除锁定
    this._lockState = null;
    this.viewer.trackedEntity = undefined;
  }

  /**
   * 销毁：清空数据并断开引用（便于 GC）。
   */
  destroy(): void {
    this.clear();
    this.viewer = null as unknown as Viewer;
    this.Cesium = null as unknown as CesiumNamespace;
  }
}
