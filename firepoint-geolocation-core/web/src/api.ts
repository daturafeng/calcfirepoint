import { mapConfig } from './config';
import type { CalculationResponse, FormValues, ImageMetadata, ProjectedGeometry } from './types';

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok && response.status !== 422) throw new Error('服务暂不可用，请检查 API 与 DEM 配置。');
  return body;
}

export async function inspectImage(file: File): Promise<ImageMetadata> {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`${mapConfig.apiBaseUrl}/api/v1/images/inspect`, { method: 'POST', body: form });
  const body = await readResponse<{ metadata: ImageMetadata }>(response);
  return body.metadata;
}

export async function calculateLocation(file: File | null, values: FormValues, imageSize: { width: number; height: number }): Promise<CalculationResponse> {
  const payload = {
    demSourceId: 'chongqing-nanan',
    observation: { id: crypto.randomUUID(), capturedAt: values.capturedAt, imageryType: 'visible', image: imageSize, targetBox: { x: values.x, y: values.y, width: values.width, height: values.height }, targetPixelStrategy: 'bbox_center' },
    camera: { longitude: values.longitude, latitude: values.latitude, absoluteElevationM: values.absoluteElevationM, horizontalCrs: 'WGS84', verticalDatum: 'unknown' },
    pose: { azimuthDeg: values.azimuthDeg, pitchDeg: values.pitchDeg, rollDeg: values.rollDeg },
    calibration: { horizontalFovDeg: values.horizontalFovDeg, verticalFovDeg: values.verticalFovDeg },
    calculation: { maxDistanceM: 20000, stepM: 5, positionErrorM: 2, angleErrorDeg: 0.5, demVerticalErrorM: 5 },
  };
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  if (file) form.append('image', file);
  const response = await fetch(`${mapConfig.apiBaseUrl}/api/v1/geolocations/calculate`, { method: 'POST', body: form });
  return readResponse<CalculationResponse>(response);
}

export async function projectGeometry(values: FormValues, imageSize: { width: number; height: number }, geometryType: string, pixels: Array<{x:number;y:number}>): Promise<ProjectedGeometry> {
  const data = { demSourceId:'chongqing-nanan', geometryType, pixels, observation:{id:crypto.randomUUID(),capturedAt:values.capturedAt,image:imageSize}, camera:{longitude:values.longitude,latitude:values.latitude,absoluteElevationM:values.absoluteElevationM,horizontalCrs:'WGS84',verticalDatum:'unknown'}, pose:{azimuthDeg:values.azimuthDeg,pitchDeg:values.pitchDeg,rollDeg:values.rollDeg}, calibration:{horizontalFovDeg:values.horizontalFovDeg,verticalFovDeg:values.verticalFovDeg} };
  const form=new FormData(); form.append('payload',JSON.stringify(data));
  return readResponse<ProjectedGeometry>(await fetch(`${mapConfig.apiBaseUrl}/api/v1/geometries/project`,{method:'POST',body:form}));
}
