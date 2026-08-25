import type { WaylinePoint } from '@/utils/wayline';

export const GROUND_PROJECTION_PICK_DELAY_MS = 180;

export type ActiveWaypointSegment = {
  key: 'previous' | 'next';
  start: WaylinePoint;
  end: WaylinePoint;
};

export function formatWaylineAltitude(height: number | undefined) {
  const normalizedHeight = Number.isFinite(height) ? Number(height) : 0;
  const displayHeight = Number.isInteger(normalizedHeight)
    ? normalizedHeight.toFixed(0)
    : normalizedHeight.toFixed(1);
  return `ALT: ${displayHeight} m`;
}

export function formatWaylineDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '0 m';
  if (distanceMeters < 1000) return `${distanceMeters.toFixed(1)} m`;
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

export function getHorizontalDistanceMeters(
  a: Pick<WaylinePoint, 'lat' | 'lng'>,
  b: Pick<WaylinePoint, 'lat' | 'lng'>,
) {
  const earthRadiusMeters = 6378137;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversineValue =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

export function getActiveWaypointSegments(
  points: WaylinePoint[],
  selectedPointIndex: number | null,
): ActiveWaypointSegment[] {
  if (
    selectedPointIndex === null ||
    selectedPointIndex < 0 ||
    selectedPointIndex >= points.length
  ) {
    return [];
  }

  const selectedPoint = points[selectedPointIndex];
  const segments: ActiveWaypointSegment[] = [];
  const previousPoint = points[selectedPointIndex - 1];
  const nextPoint = points[selectedPointIndex + 1];
  if (previousPoint) {
    segments.push({
      key: 'previous',
      start: previousPoint,
      end: selectedPoint,
    });
  }
  if (nextPoint) {
    segments.push({
      key: 'next',
      start: selectedPoint,
      end: nextPoint,
    });
  }
  return segments;
}

export function shouldShowEditorVehicleGroundProjection(
  point: WaylinePoint | null,
  hasModelUri: boolean,
) {
  return Boolean(point && hasModelUri);
}

export function pickGroundProjectionPoint<T>(candidates: {
  model: T | null;
  terrain: T | null;
  ellipsoid: T;
}) {
  return candidates.model ?? candidates.terrain ?? candidates.ellipsoid;
}

export function getGroundProjectionOrigin<T>(
  modelPosition: T | null | undefined,
  fallbackPosition: T,
) {
  return modelPosition ?? fallbackPosition;
}

export function getGroundProjectionPoint<T>(options: {
  projectionKey: string;
  cachedProjectionKey: string;
  cachedPoint: T | null;
  fallbackPoint: T;
}) {
  const { projectionKey, cachedProjectionKey, cachedPoint, fallbackPoint } =
    options;
  return projectionKey === cachedProjectionKey && cachedPoint
    ? cachedPoint
    : fallbackPoint;
}

export function getAltitudeRelativeToTakeoff(
  absoluteHeight: number | undefined,
  takeoffReferenceHeight: number | undefined,
) {
  const height = Number.isFinite(absoluteHeight) ? Number(absoluteHeight) : 0;
  const referenceHeight = Number.isFinite(takeoffReferenceHeight)
    ? Number(takeoffReferenceHeight)
    : 0;
  return Number((height - referenceHeight).toFixed(6));
}
