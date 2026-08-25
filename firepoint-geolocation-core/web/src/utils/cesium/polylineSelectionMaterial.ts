import {
  Color,
  ColorMaterialProperty,
  PolylineOutlineMaterialProperty,
  type MaterialProperty,
} from 'cesium';

export const SELECTED_POLYLINE_OUTLINE_WIDTH = 2;

/**
 * 使用单条 Cesium Polyline 输出“白色外沿 + 图元颜色中心线”的选中效果。
 */
export function createPolylineSelectionMaterial(
  color: Color,
  highlighted: boolean,
): MaterialProperty {
  return highlighted
    ? new PolylineOutlineMaterialProperty({
        color,
        outlineColor: Color.WHITE,
        outlineWidth: SELECTED_POLYLINE_OUTLINE_WIDTH,
      })
    : new ColorMaterialProperty(color);
}

/** 保持中心色线宽不变，选中时仅为同一条线增加两侧白色外沿。 */
export function getPolylineSelectionWidth(width: number, highlighted: boolean) {
  return highlighted ? width + SELECTED_POLYLINE_OUTLINE_WIDTH * 2 : width;
}
