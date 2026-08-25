import {
  Color,
  ColorMaterialProperty,
  PolylineOutlineMaterialProperty,
} from 'cesium';
import { describe, expect, it, vi } from 'vitest';

vi.mock('cesium', () => {
  class MockColor {
    static readonly BLUE = new MockColor('blue');
    static readonly WHITE = new MockColor('white');

    constructor(readonly value: string) {}
  }
  class MockColorMaterialProperty {
    constructor(readonly color: MockColor) {}
  }
  class MockPolylineOutlineMaterialProperty {
    constructor(readonly options: unknown) {}
  }
  return {
    Color: MockColor,
    ColorMaterialProperty: MockColorMaterialProperty,
    PolylineOutlineMaterialProperty: MockPolylineOutlineMaterialProperty,
  };
});

import {
  createPolylineSelectionMaterial,
  getPolylineSelectionWidth,
  SELECTED_POLYLINE_OUTLINE_WIDTH,
} from './polylineSelectionMaterial';

describe('polylineSelectionMaterial', () => {
  it('选中时使用单个 Outline 材质并保留中心线宽', () => {
    const material = createPolylineSelectionMaterial(Color.BLUE, true);

    expect(material).toBeInstanceOf(PolylineOutlineMaterialProperty);
    expect(getPolylineSelectionWidth(3, true)).toBe(
      3 + SELECTED_POLYLINE_OUTLINE_WIDTH * 2,
    );
  });

  it('未选中时继续使用普通颜色材质和原始线宽', () => {
    expect(createPolylineSelectionMaterial(Color.BLUE, false)).toBeInstanceOf(
      ColorMaterialProperty,
    );
    expect(getPolylineSelectionWidth(3, false)).toBe(3);
  });
});
