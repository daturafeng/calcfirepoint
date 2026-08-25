import type { ImagePixel } from './ImageAnnotationCanvas';

export type TargetBox = { x: number; y: number; width: number; height: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function targetBoxFromPixels(pixels: ImagePixel[], imageSize: { width: number; height: number }): TargetBox | null {
  if (!pixels.length || imageSize.width <= 0 || imageSize.height <= 0) return null;

  const minX = Math.min(...pixels.map((point) => point.x));
  const maxX = Math.max(...pixels.map((point) => point.x));
  const minY = Math.min(...pixels.map((point) => point.y));
  const maxY = Math.max(...pixels.map((point) => point.y));
  const x = clamp(Math.floor(minX), 0, imageSize.width - 1);
  const y = clamp(Math.floor(minY), 0, imageSize.height - 1);
  const right = Math.max(x + 1, clamp(Math.ceil(maxX), 0, imageSize.width));
  const bottom = Math.max(y + 1, clamp(Math.ceil(maxY), 0, imageSize.height));

  return { x, y, width: right - x, height: bottom - y };
}
