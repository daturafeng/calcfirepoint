import { AimOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { Cartesian2, Cartesian3, Cartographic, Color, CustomDataSource, Entity, Math as CesiumMath, ScreenSpaceEventHandler, ScreenSpaceEventType, UrlTemplateImageryProvider, Viewer } from 'cesium';

import { CesiumAnnotationGeometryManager, type CesiumPolygonOverlay, type CesiumRouteOverlay } from '../utils/cesium/CesiumAnnotationGeometryManager';
import { Draw } from '../utils/cesium/Draw';
import { createStandardViewer } from '../utils/cesium/viewer';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { mapConfig } from '../config';
import type { CalculationResponse, FormValues, ProjectedGeometry } from '../types';

type HoverLocation = { longitude: number; latitude: number; viewHeightM: number };
const EMPTY_GEOMETRIES: ProjectedGeometry[] = [];

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
  const cartesian = instance.scene.pickPositionSupported
    ? instance.scene.pickPosition(screenPosition)
    : undefined;
  const fallback = cartesian ?? instance.camera.pickEllipsoid(screenPosition, instance.scene.globe.ellipsoid);
  if (!fallback) return null;
  const cartographic = Cartographic.fromCartesian(fallback);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    viewHeightM: instance.camera.positionCartographic.height,
  };
}

export function MapCanvas({ values, result, geometries = EMPTY_GEOMETRIES, cameraPoseRequestId = 0 }: { values: FormValues; result: CalculationResponse | null; geometries?: ProjectedGeometry[]; cameraPoseRequestId?: number }) {
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
    pointerHandler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
      setHoverLocation(pickHoverLocation(instance, movement.endPosition));
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
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
    const camera = Cartesian3.fromDegrees(values.longitude, values.latitude, values.absoluteElevationM);
    instance.entities.add(new Entity({ position: camera, point: { pixelSize: 11, color: Color.CYAN }, label: { text: '相机' } }));

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
  }, [values, result, geometries]);

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
        {hoverLocation ? <><span>经度 {hoverLocation.longitude.toFixed(6)}°</span><span>纬度 {hoverLocation.latitude.toFixed(6)}°</span><span>视角高 {hoverLocation.viewHeightM.toFixed(1)} m</span></> : <span>移动鼠标查看坐标与视角高度</span>}
      </div>
    </div>
  );
}
