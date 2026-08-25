import type { CSSProperties } from 'react';

/** 指北针/比例尺等叠加控件相对地图容器的像素定位（与 MapToolRail positionPx 用法一致） */
export type MapNavControlPositionPx = {
  top?: number | 'unset';
  right?: number | 'unset';
  bottom?: number | 'unset';
  left?: number | 'unset';
};

export function mapNavPositionToStyle(px?: MapNavControlPositionPx): CSSProperties | undefined {
  if (!px) {
    return undefined;
  }
  const s: CSSProperties = {};
  if (px.right !== undefined) s.right = px.right;
  if (px.left !== undefined) s.left = px.left;
  if (px.top !== undefined) s.top = px.top;
  if (px.bottom !== undefined) s.bottom = px.bottom;
  return Object.keys(s).length ? s : undefined;
}

/** cesium-navigation-es6 比例尺挂载层样式（相对地图舞台绝对定位） */
export function getDistanceLegendMountStyle(
  distanceLegendPositionPx?: MapNavControlPositionPx,
): CSSProperties {
  const pos = mapNavPositionToStyle({ left: 16, bottom: 16, ...distanceLegendPositionPx }) ?? {};
  return {
    position: 'absolute',
    zIndex: 6,
    pointerEvents: 'none',
    width: 140,
    minHeight: 48,
    ...pos,
  };
}
