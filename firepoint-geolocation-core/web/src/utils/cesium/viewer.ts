import { CESIUM_DEBUG_SHOW_FPS, DEFAULT_CESIUM_BASE_URL } from '../../constants/config';
import {
  CameraEventType,
  Cartesian3,
  Rectangle,
  Viewer,
  buildModuleUrl,
} from 'cesium';


export const DEFAULT_VIEWER_OPTIONS = {
  animation: false,
  baseLayer: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  scene3DOnly: true,
  vrButton: false,
  skyAtmosphere: false,
  shouldAnimate: true,
  maximumScreenSpaceError: 16,
} as const;

// 交互最大 pitch 限制为 -15°，避免视角贴近地平线后继续露出天空。
export const DEFAULT_MAX_INTERACTION_CAMERA_PITCH = (-15 * Math.PI) / 180;
export const DEFAULT_MAX_CAMERA_TILT_ANGLE =
  Math.PI / 2 + DEFAULT_MAX_INTERACTION_CAMERA_PITCH;

export type StandardViewerOptions = Record<string, never>;

/**
 * TerraGS 补丁运行时在 buildModuleUrl 上提供 setBaseUrl，但 Cesium 的公开声明未暴露该扩展。
 */
interface CesiumModuleUrlAdapter {
  (relativeUrl: string): string;
  setBaseUrl?: (baseUrl: string) => void;
}

/**
 * 部分 Cesium 运行时未声明 tiltEventTypes；字段不存在时保持默认倾斜交互。
 */
type CesiumCameraEventTypes = CameraEventType | CameraEventType[] | undefined;

interface CesiumCameraControllerAdapter {
  rotateEventTypes: CesiumCameraEventTypes;
  zoomEventTypes: CesiumCameraEventTypes;
  tiltEventTypes?: CesiumCameraEventTypes;
}

export function configureCesiumBaseUrl() {
  const cesiumBaseUrl = DEFAULT_CESIUM_BASE_URL;
  const win = window as Window & { CESIUM_BASE_URL?: string };
  win.CESIUM_BASE_URL = cesiumBaseUrl;
  const moduleUrl: CesiumModuleUrlAdapter = buildModuleUrl;
  moduleUrl.setBaseUrl?.(cesiumBaseUrl);
}

export function hideViewerCreditContainer(viewer: Viewer) {
  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
}

/**
 * 限制相机最大缩远距离：最多缩到刚好可见全国范围，避免地图缩得过小。
 */
export function limitCameraZoomOutToChina(viewer: Viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  const chinaBounds = Rectangle.fromDegrees(73.4, 18.1, 135.1, 53.6);
  const destination = viewer.camera.getRectangleCameraCoordinates(chinaBounds);
  const fallbackDistance = 9_000_000;

  controller.maximumZoomDistance = destination
    ? Cartesian3.magnitude(destination) * 0.3
    : fallbackDistance;
}

/**
 * 限制用户交互时的最大俯仰角，避免右键倾斜、双指倾斜或导航插件把镜头翻到天空。
 */
export function limitCameraTiltToGround(viewer: Viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.maximumTiltAngle = DEFAULT_MAX_CAMERA_TILT_ANGLE;
  let isCorrecting = false;

  viewer.scene.preRender.addEventListener(() => {
    if (
      isCorrecting ||
      viewer.isDestroyed() ||
      !controller.enableInputs ||
      viewer.camera.pitch <= DEFAULT_MAX_INTERACTION_CAMERA_PITCH
    ) {
      return;
    }

    isCorrecting = true;
    viewer.camera.setView({
      orientation: {
        heading: viewer.camera.heading,
        pitch: DEFAULT_MAX_INTERACTION_CAMERA_PITCH,
        roll: viewer.camera.roll,
      },
    });
    viewer.scene.requestRender();
    isCorrecting = false;
  });
}

/**
 * 配置 BaseUrl、创建 Viewer、隐藏版权信息、加载标准底图与 overlay。
 * Workspace 等页面可在返回后继续 `imageryLayers.addImageryProvider`。
 */
export function createStandardViewer(
  container: HTMLElement,
) {
  configureCesiumBaseUrl();
  const viewer = new Viewer(container, {
    ...DEFAULT_VIEWER_OPTIONS,
  });
  viewer.scene.debugShowFramesPerSecond = CESIUM_DEBUG_SHOW_FPS;
  viewer.scene.globe.depthTestAgainstTerrain = false;
  hideViewerCreditContainer(viewer);
  limitCameraZoomOutToChina(viewer);
  limitCameraTiltToGround(viewer);

  try {
    const controller = viewer.scene.screenSpaceCameraController;
    const cameraController: CesiumCameraControllerAdapter = controller;
    cameraController.rotateEventTypes = [CameraEventType.LEFT_DRAG];
    cameraController.zoomEventTypes = [
      CameraEventType.WHEEL,
      CameraEventType.PINCH,
      CameraEventType.MIDDLE_DRAG,
    ];
    if ('tiltEventTypes' in cameraController) {
      cameraController.tiltEventTypes = [
        CameraEventType.RIGHT_DRAG,
        CameraEventType.PINCH,
      ];
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Cesium] swap middle/right camera event types failed', e);
  }
  return viewer;
}
