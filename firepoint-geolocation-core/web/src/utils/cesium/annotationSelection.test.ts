import { describe, expect, it } from 'vitest';

import { resolveAnnotationOverlayId } from './annotationSelection';

describe('地图标注实体选择', () => {
  it.each([
    ['route-overlay-101', '101'],
    ['polygon-overlay-102', '102'],
    ['polygon-overlay-102-outline', '102'],
    ['geometry-circle-103', '103'],
  ])('解析已完成覆盖物实体 %s', (entityId, annotationId) => {
    expect(resolveAnnotationOverlayId(entityId)).toBe(annotationId);
  });

  it('忽略顶点和其他非标注实体', () => {
    expect(resolveAnnotationOverlayId('annotation-vertex-101-0')).toBeUndefined();
    expect(resolveAnnotationOverlayId('device-DOCK3TEST001')).toBeUndefined();
  });
});
