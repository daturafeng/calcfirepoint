import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  CustomDataSource,
  HeadingPitchRange,
  PerspectiveFrustum,
  Viewer,
} from 'cesium';

import { getCameraHeight as readCameraHeight } from './cameraHeight';
import { Draw } from './Draw';
import {
  CesiumImageryOverlayManager,
  type CesiumImageryOverlayConfig,
  type CesiumImageryOverlayFocusOptions,
} from './imageryOverlayManager';
import {
  applyCesiumMapToolbarZoomAndBase,
  type CesiumMapToolbarCommand,
} from './mapToolbarCamera';
import {
  CesiumTilesetOverlayManager,
  type CesiumTilesetOverlayConfig,
  type CesiumTilesetOverlayFocusOptions,
} from './tilesetOverlayManager';
import { createStandardViewer } from './viewer';

export interface CesiumMapEngineOptions {
  container: HTMLElement;
  dataSourceId?: string;
  drawDataSourceId?: string;
  onResourceLoadError?: (
    resourceType: 'imagery' | '3dtileset',
    resourceId: string,
    error: unknown,
  ) => void;
}

export interface CesiumCameraPoint {
  lng: number;
  lat: number;
  height?: number;
}

export type CesiumCameraCommand =
  | {
      type: 'fly-to';
      lng: number;
      lat: number;
      height: number;
      duration?: number;
      minHeight?: number;
    }
  | {
      type: 'focus-point';
      point: CesiumCameraPoint;
      cameraHeight?: number;
      duration?: number;
    }
  | {
      type: 'fit-points';
      points: CesiumCameraPoint[];
      duration?: number;
      pitch?: number;
      heading?: number;
      minRange?: number;
      rangeScale?: number;
      /** 按经纬度外接范围匹配有效视区，避免不规则多边形按包围球半径定位过近。 */
      fitToViewport?: boolean;
      viewportPadding?: {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
      };
      fallbackView?: {
        lng: number;
        lat: number;
        height: number;
      };
    };

export interface CesiumMapEngine {
  viewer: Viewer;
  dataSource: CustomDataSource;
  draw: Draw;
  executeToolbarCommand: (command: CesiumMapToolbarCommand) => void;
  executeCameraCommand: (command: CesiumCameraCommand) => void;
  syncImageryOverlays: (overlays: CesiumImageryOverlayConfig[]) => void;
  focusImageryOverlay: (
    overlayId: string,
    options?: CesiumImageryOverlayFocusOptions,
  ) => void;
  syncTilesetOverlays: (overlays: CesiumTilesetOverlayConfig[]) => void;
  focusTilesetOverlay: (
    overlayId: string,
    options?: CesiumTilesetOverlayFocusOptions,
  ) => void;
  pickLngLatFromCanvasPosition: (
    screenPosition?: { x: number; y: number } | null,
  ) => { lng: number; lat: number } | null;
  pickLngLatFromGlobe: (
    screenPosition?: { x: number; y: number } | null,
  ) => { lng: number; lat: number } | null;
  /** 获取当前相机相对椭球面的视角高度；高度不可用时返回空值。 */
  getCameraHeight: () => number | null;
  destroy: () => void;
}

export function createCesiumMapEngine(
  options: CesiumMapEngineOptions,
): CesiumMapEngine {
  const viewer = createStandardViewer(options.container);
  const dataSource = new CustomDataSource(
    options.dataSourceId ?? 'cesium-map-engine',
  );
  viewer.dataSources.add(dataSource);

  const draw = new Draw(viewer, {
    dataSourceId: options.drawDataSourceId,
  });
  const imageryOverlayManager = new CesiumImageryOverlayManager(
    viewer,
    (entityId) =>
      (dataSource.entities.getById(entityId) as any) ||
      (viewer.entities.getById(entityId) as any),
    (resourceId, error) =>
      options.onResourceLoadError?.('imagery', resourceId, error),
  );
  const tilesetOverlayManager = new CesiumTilesetOverlayManager(
    viewer,
    (resourceId, error) =>
      options.onResourceLoadError?.('3dtileset', resourceId, error),
  );

  const executeToolbarCommand = (command: CesiumMapToolbarCommand) => {
    applyCesiumMapToolbarZoomAndBase(viewer, command);
  };

  const executeCameraCommand = (command: CesiumCameraCommand) => {
    if (command.type === 'fly-to') {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          command.lng,
          command.lat,
          Math.max(command.minHeight ?? 1, command.height),
        ),
        duration: command.duration ?? 0.6,
      });
      return;
    }

    if (command.type === 'focus-point') {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          command.point.lng,
          command.point.lat,
          command.cameraHeight ?? command.point.height ?? 3800,
        ),
        duration: command.duration ?? 0.6,
      });
      return;
    }

    if (command.points.length === 0) {
      if (command.fallbackView) {
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            command.fallbackView.lng,
            command.fallbackView.lat,
            command.fallbackView.height,
          ),
          duration: command.duration ?? 0.6,
        });
      }
      return;
    }

    const cartesianPoints = command.points.map((point) =>
      Cartesian3.fromDegrees(point.lng, point.lat, point.height ?? 0),
    );
    const sphere = BoundingSphere.fromPoints(cartesianPoints);
    const viewportPadding = command.viewportPadding;
    const canvasWidth = viewer.canvas.clientWidth;
    const canvasHeight = viewer.canvas.clientHeight;
    const leftPadding = viewportPadding?.left || 0;
    const rightPadding = viewportPadding?.right || 0;
    const topPadding = viewportPadding?.top || 0;
    const bottomPadding = viewportPadding?.bottom || 0;
    const effectiveWidth = Math.max(
      1,
      canvasWidth - leftPadding - rightPadding,
    );
    const effectiveHeight = Math.max(
      1,
      canvasHeight - topPadding - bottomPadding,
    );
    const frustum = viewer.camera.frustum;
    const fovy =
      frustum instanceof PerspectiveFrustum ? frustum.fovy : undefined;
    const viewportFitView = () => {
      if (!command.fitToViewport || typeof fovy !== 'number') return null;
      const points = cartesianPoints.map((point) =>
        Cartographic.fromCartesian(point),
      );
      const minLatitude = Math.min(...points.map((point) => point.latitude));
      const maxLatitude = Math.max(...points.map((point) => point.latitude));
      const minLongitude = Math.min(...points.map((point) => point.longitude));
      const maxLongitude = Math.max(...points.map((point) => point.longitude));
      const centerLatitude = (minLatitude + maxLatitude) / 2;
      const latitudeMeters = (maxLatitude - minLatitude) * 6_378_137;
      const longitudeMeters =
        (maxLongitude - minLongitude) *
        6_378_137 *
        Math.max(0.01, Math.cos(centerLatitude));
      const verticalViewMeters = 2 * Math.tan(fovy / 2);
      const horizontalViewMeters =
        verticalViewMeters * (effectiveWidth / effectiveHeight);
      // 外接范围最多占有效视区约三分之二，保证细长/不规则面也有稳定留白。
      const height = Math.max(
        command.minRange ?? 5000,
        (latitudeMeters * 1.5) / verticalViewMeters,
        (longitudeMeters * 1.5) / horizontalViewMeters,
      );
      return {
        lng: ((minLongitude + maxLongitude) / 2) * (180 / Math.PI),
        lat: ((minLatitude + maxLatitude) / 2) * (180 / Math.PI),
        height,
      };
    };
    const applyViewportPadding = () => {
      if (!viewportPadding) return;
      const height = viewer.camera.positionCartographic.height;
      if (typeof fovy !== 'number' || !Number.isFinite(fovy)) return;
      if (!canvasHeight || !Number.isFinite(height) || height <= 0) {
        return;
      }
      const pixelsPerMeter = canvasHeight / (2 * height * Math.tan(fovy / 2));
      if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return;
      const horizontalOffset = (leftPadding - rightPadding) / 2;
      const verticalOffset = (topPadding - bottomPadding) / 2;
      if (horizontalOffset) {
        viewer.camera.moveRight(-horizontalOffset / pixelsPerMeter);
      }
      if (verticalOffset) {
        viewer.camera.moveUp(verticalOffset / pixelsPerMeter);
      }
    };

    const fittedView = viewportFitView();
    if (fittedView) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          fittedView.lng,
          fittedView.lat,
          fittedView.height,
        ),
        orientation: {
          heading: command.heading ?? 0,
          pitch: command.pitch ?? -0.62,
          roll: 0,
        },
        duration: command.duration ?? 0.6,
        complete: applyViewportPadding,
      });
      return;
    }

    viewer.camera.flyToBoundingSphere(sphere, {
      duration: command.duration ?? 0.6,
      offset: new HeadingPitchRange(
        command.heading ?? 0,
        command.pitch ?? -0.62,
        Math.max(
          command.minRange ?? 5000,
          sphere.radius * (command.rangeScale ?? 2),
        ),
      ),
      complete: applyViewportPadding,
    });
  };

  const pickLngLatFromCanvasPosition = (
    screenPosition?: { x: number; y: number } | null,
  ) => {
    if (!screenPosition) {
      return null;
    }
    const cartesian2 = new Cartesian2(screenPosition.x, screenPosition.y);
    const pickedPosition = viewer.scene.pickPositionSupported
      ? viewer.scene.pickPosition(cartesian2)
      : undefined;
    const cartesian =
      pickedPosition ||
      viewer.camera.pickEllipsoid(cartesian2, viewer.scene.globe.ellipsoid);
    if (!cartesian) {
      return null;
    }
    const cartographic = Cartographic.fromCartesian(cartesian);
    return {
      lng: (cartographic.longitude * 180) / Math.PI,
      lat: (cartographic.latitude * 180) / Math.PI,
    };
  };

  const pickLngLatFromGlobe = (
    screenPosition?: { x: number; y: number } | null,
  ) => {
    if (!screenPosition) {
      return null;
    }
    const cartesian2 = new Cartesian2(screenPosition.x, screenPosition.y);
    const ray = viewer.camera.getPickRay(cartesian2);
    if (!ray) {
      return null;
    }
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) {
      return null;
    }
    const cartographic = Cartographic.fromCartesian(cartesian);
    if (!cartographic) {
      return null;
    }
    return {
      lng: (cartographic.longitude * 180) / Math.PI,
      lat: (cartographic.latitude * 180) / Math.PI,
    };
  };

  const getCameraHeight = () => readCameraHeight(viewer);

  const destroy = () => {
    imageryOverlayManager.destroy();
    tilesetOverlayManager.destroy();
    draw.destroy();
    dataSource.entities.removeAll();
    viewer.dataSources.remove(dataSource);
    viewer.destroy();
  };

  return {
    viewer,
    dataSource,
    draw,
    executeToolbarCommand,
    executeCameraCommand,
    syncImageryOverlays(overlays) {
      imageryOverlayManager.sync(overlays);
    },
    focusImageryOverlay(overlayId, options) {
      imageryOverlayManager.focus(overlayId, options);
    },
    syncTilesetOverlays(overlays) {
      tilesetOverlayManager.sync(overlays);
    },
    focusTilesetOverlay(overlayId, options) {
      tilesetOverlayManager.focus(overlayId, options);
    },
    pickLngLatFromCanvasPosition,
    pickLngLatFromGlobe,
    getCameraHeight,
    destroy,
  };
}
