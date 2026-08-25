import type { Viewer } from 'cesium';

/** 将 Cesium 相机高度统一为调用方可安全消费的值。 */
export function normalizeCameraHeight(height: number): number | null {
  return Number.isFinite(height) ? height : null;
}

/** 获取 Viewer 当前相对椭球面的视角高度；高度不可用时返回空值。 */
export function getCameraHeight(viewer: Viewer): number | null {
  return normalizeCameraHeight(viewer.camera.positionCartographic.height);
}
