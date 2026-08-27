import { AimOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { Cartesian2, Cartesian3, Cartographic, Color, CustomDataSource, Entity, Math as CesiumMath, ScreenSpaceEventHandler, ScreenSpaceEventType, UrlTemplateImageryProvider, Viewer } from 'cesium';

import { CesiumAnnotationGeometryManager, type CesiumPolygonOverlay, type CesiumRouteOverlay } from '../utils/cesium/CesiumAnnotationGeometryManager';
import { Draw } from '../utils/cesium/Draw';
import { getCameraHeight } from '../utils/cesium/cameraHeight';
import { createStandardViewer } from '../utils/cesium/viewer';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { mapConfig } from '../config';
import type { CalculationResponse, FormValues, MultiCameraObservation, MultiCameraResponse, ProjectedGeometry } from '../types';

type HoverLocation = { longitude: number; latitude: number; viewHeightM: number | null };
const EMPTY_GEOMETRIES: ProjectedGeometry[] = [];
const HOVER_UPDATE_INTERVAL_MS = 80;

function flyToCameraPose(instance: Viewer, values: FormValues) {
  if (![values.longitude, values.latitude, values.absoluteElevationM, values.azimuthDeg, values.pitchDeg, values.rollDeg].every(Number.isFinite)) return;
  instance.camera.flyTo({
    destination: Cartesian3.fromDegrees(values.longitude, values.latitude, Math.max(1, values.absoluteElevationM)),
    orientation: {
      heading: CesiumMath.toRadians(values.azimuthDeg),
      pitch: CesiumMath.toRadians(values.pitchDeg),
      roll: CesiumMath.toRadians(values.rollDeg),
    },
    duration: 0.8,
  });
}

function pickHoverLocation(instance: Viewer, position: { x: number; y: number }): HoverLocation | null {
  const screenPosition = new Cartesian2(position.x, position.y);
  const ray = instance.camera.getPickRay(screenPosition);
  const terrainPosition = ray ? instance.scene.globe.pick(ray, instance.scene) : undefined;
  const fallback = terrainPosition ?? instance.camera.pickEllipsoid(screenPosition, instance.scene.globe.ellipsoid);
  if (!fallback) return null;
  const cartographic = Cartographic.fromCartesian(fallback);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    viewHeightM: getCameraHeight(instance),
  };
}

type MultiCameraOverlay = { observations: MultiCameraObservation[]; result: MultiCameraResponse | null };

export function MapCanvas({ values, result, geometries = EMPTY_GEOMETRIES, cameraPoseRequestId = 0, multiCamera }: { values: FormValues; result: CalculationResponse | null; geometries?: ProjectedGeometry[]; cameraPoseRequestId?: number; multiCamera?: MultiCameraOverlay }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer>();
  const annotationManager = useRef<CesiumAnnotationGeometryManager>();
  const pointDrawer = useRef<Draw>();
  const observedCameraPoseRequestId = useRef<number | null>(null);
  const [hoverLocation, setHoverLocation] = useState<HoverLocation | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const instance = createStandardViewer(host.current);
    instance.imageryLayers.removeAll();
    instance.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url: mapConfig.imageryUrl }));
    const terrainRoot = mapConfig.terrainUrl.replace(/layer\.json(?:[?#].*)?$/i, '');
    void import('cesium').then(({ CesiumTerrainProvider }) => CesiumTerrainProvider.fromUrl(terrainRoot).then((terrain) => { instance.terrainProvider = terrain; }).catch(() => undefined));

    const annotationSource = new CustomDataSource('firepoint-projected-geometries');
    const pointSource = new CustomDataSource('firepoint-projected-points');
    instance.dataSources.add(annotationSource);
    instance.dataSources.add(pointSource);
    annotationManager.current = new CesiumAnnotationGeometryManager(annotationSource, instance);
    pointDrawer.current = new Draw(instance, { dataSource: pointSource });
    viewer.current = instance;
    const pointerHandler = new ScreenSpaceEventHandler(instance.canvas);
    let hoverUpdateTimer: number | undefined;
    let cameraInteractionTimer: number | undefined;
    let lastHoverUpdateAt = 0;
    let latestPointerPosition: Cartesian2 | null = null;
    let cameraInteractionActive = false;

    const publishHoverLocation = () => {
      hoverUpdateTimer = undefined;
      if (cameraInteractionActive || !latestPointerPosition) return;
      const nextLocation = pickHoverLocation(instance, latestPointerPosition);
      setHoverLocation((currentLocation) => (
        currentLocation?.longitude === nextLocation?.longitude
        && currentLocation?.latitude === nextLocation?.latitude
        && currentLocation?.viewHeightM === nextLocation?.viewHeightM
          ? currentLocation
          : nextLocation
      ));
      lastHoverUpdateAt = window.performance.now();
    };

    const scheduleHoverLocation = (immediately = false) => {
      if (cameraInteractionActive || !latestPointerPosition) return;
      if (immediately) {
        if (hoverUpdateTimer !== undefined) window.clearTimeout(hoverUpdateTimer);
        publishHoverLocation();
        return;
      }
      if (hoverUpdateTimer !== undefined) return;
      const delay = Math.max(0, HOVER_UPDATE_INTERVAL_MS - (window.performance.now() - lastHoverUpdateAt));
      hoverUpdateTimer = window.setTimeout(publishHoverLocation, delay);
    };

    const beginCameraInteraction = () => {
      cameraInteractionActive = true;
      if (hoverUpdateTimer !== undefined) {
        window.clearTimeout(hoverUpdateTimer);
        hoverUpdateTimer = undefined;
      }
    };

    const endCameraInteraction = () => {
      cameraInteractionActive = false;
      scheduleHoverLocation(true);
    };

    const pauseForWheel = () => {
      beginCameraInteraction();
      if (cameraInteractionTimer !== undefined) window.clearTimeout(cameraInteractionTimer);
      cameraInteractionTimer = window.setTimeout(endCameraInteraction, HOVER_UPDATE_INTERVAL_MS);
    };

    const clearHoverLocation = () => {
      latestPointerPosition = null;
      if (hoverUpdateTimer !== undefined) {
        window.clearTimeout(hoverUpdateTimer);
        hoverUpdateTimer = undefined;
      }
      setHoverLocation(null);
    };

    pointerHandler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
      latestPointerPosition = new Cartesian2(movement.endPosition.x, movement.endPosition.y);
      scheduleHoverLocation();
    }, ScreenSpaceEventType.MOUSE_MOVE);
    pointerHandler.setInputAction(beginCameraInteraction, ScreenSpaceEventType.LEFT_DOWN);
    pointerHandler.setInputAction(endCameraInteraction, ScreenSpaceEventType.LEFT_UP);
    pointerHandler.setInputAction(beginCameraInteraction, ScreenSpaceEventType.MIDDLE_DOWN);
    pointerHandler.setInputAction(endCameraInteraction, ScreenSpaceEventType.MIDDLE_UP);
    pointerHandler.setInputAction(beginCameraInteraction, ScreenSpaceEventType.RIGHT_DOWN);
    pointerHandler.setInputAction(endCameraInteraction, ScreenSpaceEventType.RIGHT_UP);
    pointerHandler.setInputAction(beginCameraInteraction, ScreenSpaceEventType.PINCH_START);
    pointerHandler.setInputAction(endCameraInteraction, ScreenSpaceEventType.PINCH_END);
    pointerHandler.setInputAction(pauseForWheel, ScreenSpaceEventType.WHEEL);
    instance.canvas.addEventListener('mouseleave', clearHoverLocation);

    return () => {
      if (hoverUpdateTimer !== undefined) window.clearTimeout(hoverUpdateTimer);
      if (cameraInteractionTimer !== undefined) window.clearTimeout(cameraInteractionTimer);
      instance.canvas.removeEventListener('mouseleave', clearHoverLocation);
      pointerHandler.destroy();
      annotationManager.current?.destroy();
      pointDrawer.current?.destroy();
      annotationManager.current = undefined;
      pointDrawer.current = undefined;
      instance.dataSources.remove(annotationSource, true);
      instance.destroy();
    };
  }, []);

  useEffect(() => {
    const instance = viewer.current;
    const manager = annotationManager.current;
    const drawer = pointDrawer.current;
    if (!instance || !manager || !drawer) return;

    instance.entities.removeAll();
    drawer.clear();
    if (multiCamera?.observations.length) {
      multiCamera.observations.forEach((observation, index) => {
        const camera = Cartesian3.fromDegrees(observation.values.longitude, observation.values.latitude, observation.values.absoluteElevationM);
        instance.entities.add(new Entity({ position: camera, point: { pixelSize: 11, color: index % 2 ? Color.LIME : Color.CYAN }, label: { text: observation.name } }));
      });
    } else {
      const camera = Cartesian3.fromDegrees(values.longitude, values.latitude, values.absoluteElevationM);
      instance.entities.add(new Entity({ position: camera, point: { pixelSize: 11, color: Color.CYAN }, label: { text: '相机' } }));
    }

    const routes: CesiumRouteOverlay[] = [];
    const polygons: CesiumPolygonOverlay[] = [];
    geometries.forEach((geometry, index) => {
      const points = geometry.coordinates.map((coordinate) => ({ lng: coordinate.longitude, lat: coordinate.latitude, alt: coordinate.elevationM }));
      const id = `projected-${index}`;
      if (geometry.geometryType === 'point' && points[0]) {
        drawer.drawPoint(points[0], { color: '#ff7a45', outlineColor: '#ffffff', point: { pixelSize: 14, outlineWidth: 2 } });
      } else if (geometry.geometryType === 'line') {
        routes.push({ id, points, color: '#31c9f0', width: 4, showVertexHandles: true });
      } else if (geometry.geometryType === 'polygon') {
        polygons.push({ id, points, color: '#31c9f0', opacity: 0.25, outlineWidth: 3, showVertexHandles: true });
      }
    });
    manager.sync({ routes, polygons });

    const point = result?.location;
    if (point) {
      drawer.drawPoint({ lng: point.longitude, lat: point.latitude, height: point.elevationM }, { color: '#ff4d4f', outlineColor: '#ffffff', point: { pixelSize: 16, outlineWidth: 3 } });
    }
    const intersection = multiCamera?.result?.location;
    if (intersection) {
      const target = Cartesian3.fromDegrees(intersection.longitude, intersection.latitude, intersection.elevationM);
      multiCamera.observations.forEach((observation, index) => {
        const camera = Cartesian3.fromDegrees(observation.values.longitude, observation.values.latitude, observation.values.absoluteElevationM);
        instance.entities.add(new Entity({ polyline: { positions: [camera, target], width: 3, material: index % 2 ? Color.LIME.withAlpha(0.9) : Color.CYAN.withAlpha(0.9) } }));
      });
      drawer.drawPoint({ lng: intersection.longitude, lat: intersection.latitude, height: intersection.elevationM }, { color: '#ff4d4f', outlineColor: '#ffffff', point: { pixelSize: 16, outlineWidth: 3 } });
      instance.entities.add(new Entity({ position: target, ellipse: { semiMajorAxis: Math.max(1, intersection.horizontalUncertaintyM), semiMinorAxis: Math.max(1, intersection.horizontalUncertaintyM), material: Color.RED.withAlpha(0.18), outline: true, outlineColor: Color.RED } }));
    }
  }, [values, result, geometries, multiCamera]);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    if (observedCameraPoseRequestId.current === null) {
      observedCameraPoseRequestId.current = cameraPoseRequestId;
      return;
    }
    if (cameraPoseRequestId === 0 || cameraPoseRequestId === observedCameraPoseRequestId.current) return;
    flyToCameraPose(instance, values);
    observedCameraPoseRequestId.current = cameraPoseRequestId;
  }, [cameraPoseRequestId, values]);

  return (
    <div className="map-canvas" ref={host} aria-label="火点定位三维地图">
      <button className="map-camera-recall" type="button" aria-label="定位回相机视角" title="定位回相机视角" onClick={() => { if (viewer.current) flyToCameraPose(viewer.current, values); }}><AimOutlined /></button>
      <div className="map-hover-info" aria-live="polite">
        {hoverLocation ? <><span>经度 {hoverLocation.longitude.toFixed(6)}°</span><span>纬度 {hoverLocation.latitude.toFixed(6)}°</span><span>视角高 {hoverLocation.viewHeightM === null ? '--' : `${hoverLocation.viewHeightM.toFixed(1)} m`}</span></> : <span>移动鼠标查看坐标与视角高度</span>}
      </div>
    </div>
  );
}
