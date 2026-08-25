import type { WaylinePoint } from '@/utils/wayline';
import { describe, expect, it } from 'vitest';

import {
  GROUND_PROJECTION_PICK_DELAY_MS,
  formatWaylineAltitude,
  formatWaylineDistance,
  getActiveWaypointSegments,
  getAltitudeRelativeToTakeoff,
  getGroundProjectionOrigin,
  getGroundProjectionPoint,
  getHorizontalDistanceMeters,
  pickGroundProjectionPoint,
  shouldShowEditorVehicleGroundProjection,
} from './waylineEditorVisuals';

const points: WaylinePoint[] = [
  { lat: 30, lng: 120, height: 60, speed: 5 },
  { lat: 30, lng: 120.001, height: 70, speed: 5 },
  { lat: 30, lng: 120.002, height: 80, speed: 5 },
];

describe('航线编辑地图辅助信息', () => {
  it('模型表面拾取使用 180ms 尾随节流', () => {
    expect(GROUND_PROJECTION_PICK_DELAY_MS).toBe(180);
  });
  it('以 ALT 格式显示整数与小数高度', () => {
    expect(formatWaylineAltitude(60)).toBe('ALT: 60 m');
    expect(formatWaylineAltitude(60.25)).toBe('ALT: 60.3 m');
  });

  it('只返回激活航点实际存在的前后航段', () => {
    expect(
      getActiveWaypointSegments(points, 0).map((segment) => segment.key),
    ).toEqual(['next']);
    expect(
      getActiveWaypointSegments(points, 1).map((segment) => segment.key),
    ).toEqual(['previous', 'next']);
    expect(
      getActiveWaypointSegments(points, 2).map((segment) => segment.key),
    ).toEqual(['previous']);
    expect(getActiveWaypointSegments(points, null)).toEqual([]);
  });

  it('距离使用水平测地距离且支持千米展示', () => {
    const distance = getHorizontalDistanceMeters(points[0], points[1]);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(100);
    expect(formatWaylineDistance(distance)).toMatch(/ m$/);
    expect(formatWaylineDistance(1234)).toBe('1.23 km');
  });

  it('仅在虚拟机模和模型资源都存在时显示地面投影', () => {
    expect(shouldShowEditorVehicleGroundProjection(points[0], true)).toBe(true);
    expect(shouldShowEditorVehicleGroundProjection(null, true)).toBe(false);
    expect(shouldShowEditorVehicleGroundProjection(points[0], false)).toBe(
      false,
    );
  });

  it('落点按模型、地形、椭球面的优先级选择', () => {
    expect(
      pickGroundProjectionPoint({
        model: '模型表面',
        terrain: '地形表面',
        ellipsoid: '椭球面',
      }),
    ).toBe('模型表面');
    expect(
      pickGroundProjectionPoint({
        model: null,
        terrain: '地形表面',
        ellipsoid: '椭球面',
      }),
    ).toBe('地形表面');
    expect(
      pickGroundProjectionPoint({
        model: null,
        terrain: null,
        ellipsoid: '椭球面',
      }),
    ).toBe('椭球面');
  });

  it('投影起点优先使用当前机模实体位置', () => {
    expect(getGroundProjectionOrigin({ height: 85 }, { height: 60 })).toEqual({
      height: 85,
    });
    expect(getGroundProjectionOrigin(null, { height: 60 })).toEqual({
      height: 60,
    });
  });

  it('同一机模位置复用已解析的地面落点', () => {
    expect(
      getGroundProjectionPoint({
        projectionKey: '模型位置-1',
        cachedProjectionKey: '模型位置-1',
        cachedPoint: '模型表面',
        fallbackPoint: '地形表面',
      }),
    ).toBe('模型表面');
    expect(
      getGroundProjectionPoint({
        projectionKey: '模型位置-2',
        cachedProjectionKey: '模型位置-1',
        cachedPoint: '模型表面',
        fallbackPoint: '地形表面',
      }),
    ).toBe('地形表面');
  });

  it('ALT 按参考起飞点海拔计算相对高度', () => {
    expect(getAltitudeRelativeToTakeoff(360, 300)).toBe(60);
    expect(getAltitudeRelativeToTakeoff(60, undefined)).toBe(60);
  });
});
