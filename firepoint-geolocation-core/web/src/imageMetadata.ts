import type { FormValues, ImageMetadata } from './types';

const numericMetadataKeys: Array<keyof Pick<FormValues, 'longitude' | 'latitude' | 'absoluteElevationM' | 'azimuthDeg' | 'pitchDeg' | 'rollDeg'>> = [
  'longitude', 'latitude', 'absoluteElevationM', 'azimuthDeg', 'pitchDeg', 'rollDeg',
];

export function applyImageMetadata(values: FormValues, metadata: ImageMetadata): { values: FormValues; appliedKeys: string[] } {
  const next = { ...values };
  const appliedKeys: string[] = [];
  const captureTime = metadata.capturedAt;
  if (typeof captureTime === 'string' && Number.isFinite(Date.parse(captureTime))) {
    next.capturedAt = captureTime;
    appliedKeys.push('capturedAt');
  }
  numericMetadataKeys.forEach((key) => {
    const raw = metadata[key];
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
    if (Number.isFinite(value)) {
      next[key] = value;
      appliedKeys.push(key);
    }
  });
  return { values: next, appliedKeys };
}
