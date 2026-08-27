export type ImageMetadata = Record<string, unknown>;

export interface LocationResult {
  longitude: number;
  latitude: number;
  elevationM: number;
  slantDistanceM: number;
  horizontalUncertaintyM: number;
  targetPixel: { x: number; y: number };
  capturedAt: string;
}

export interface CalculationResponse {
  status: 'ready' | 'not_ready';
  checks: Array<{ name: string; status: string; reason?: string }>;
  location: LocationResult | null;
  provenance?: { metadataCandidates?: ImageMetadata };
}

export interface FormValues {
  capturedAt: string;
  longitude: number;
  latitude: number;
  absoluteElevationM: number;
  azimuthDeg: number;
  pitchDeg: number;
  rollDeg: number;
  horizontalFovDeg: number;
  verticalFovDeg: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectedCoordinate {
  longitude: number;
  latitude: number;
  elevationM: number;
  slantDistanceM: number;
  horizontalUncertaintyM: number;
}

export interface ProjectedGeometry {
  geometryType: 'point' | 'line' | 'polygon';
  coordinates: ProjectedCoordinate[];
}

export interface MultiCameraObservation {
  id: string;
  name: string;
  file: File | null;
  imageSize: { width: number; height: number };
  values: FormValues;
  metadata: ImageMetadata | null;
  metadataStatus: string | null;
}

export interface MultiCameraContribution {
  id: string;
  name: string;
  slantDistanceM: number;
  residualM: number;
  targetPixel: { x: number; y: number };
}

export interface MultiCameraLocation {
  longitude: number;
  latitude: number;
  elevationM: number;
  horizontalUncertaintyM: number;
  quality: 'high' | 'medium' | 'low';
  minRayAngleDeg: number;
  observations: MultiCameraContribution[];
}

export interface MultiCameraResponse {
  status: 'ready' | 'not_ready';
  checks: Array<{ name: string; status: string; reason?: string }>;
  location: MultiCameraLocation | null;
  quality?: { minRayAngleDeg?: number | null; observations: MultiCameraContribution[] };
}
