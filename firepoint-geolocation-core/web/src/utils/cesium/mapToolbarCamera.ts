import type { Viewer } from 'cesium';

/** 工具条触发的地图导航与图层切换指令。 */
export type CesiumMapToolbarCommand = 'zoom-in' | 'zoom-out';

/** @deprecated 使用 `CesiumMapToolbarCommand`。 */
export type CesiumMapToolbarZoomOrBaseCommand = CesiumMapToolbarCommand;

export function isCesiumMapToolbarZoomOrBaseCommand(
  cmd: string,
): cmd is CesiumMapToolbarCommand {
  return cmd === 'zoom-in' || cmd === 'zoom-out';
}

export function applyCesiumMapToolbarZoomAndBase(
  viewer: Viewer,
  cmd: CesiumMapToolbarCommand,
) {
  if (cmd === 'zoom-in') {
    const amount = Math.max(
      600,
      viewer.camera.positionCartographic.height * 0.18,
    );
    viewer.camera.zoomIn(amount);
    return;
  }
  if (cmd === 'zoom-out') {
    const amount = Math.max(
      900,
      viewer.camera.positionCartographic.height * 0.22,
    );
    viewer.camera.zoomOut(amount);
    return;
  }
}
