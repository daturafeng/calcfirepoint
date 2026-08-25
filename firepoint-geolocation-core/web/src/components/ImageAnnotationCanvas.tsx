import { Canvas, Circle, Line, Polygon, Polyline, Rect } from 'fabric';
import { useEffect, useRef, useState } from 'react';

import { targetBoxFromPixels, type TargetBox } from './targetGeometry';

export type ImagePixel = { x: number; y: number };
export type ImageGeometryMode = 'point' | 'line' | 'polygon';
export type ImageGeometryDraft = { mode: ImageGeometryMode; pixels: ImagePixel[] };
export type RectangleSelection = { target: TargetBox; anchor: ImagePixel | null };

interface Props {
  imageUrl?: string;
  imageSize: { width: number; height: number };
  draft: ImagePixel[];
  mode: ImageGeometryMode;
  items: ImageGeometryDraft[];
  onPixel: (pixel: ImagePixel) => void;
  rectangleSelection?: RectangleSelection | null;
  onRectangleSelection?: (selection: RectangleSelection) => void;
}

type Viewport = { width: number; height: number };

function fitImage(containerWidth: number, containerHeight: number, imageSize: Props['imageSize']): Viewport {
  const scale = Math.min(containerWidth / imageSize.width, containerHeight / imageSize.height);
  return { width: Math.max(1, Math.round(imageSize.width * scale)), height: Math.max(1, Math.round(imageSize.height * scale)) };
}

function locked<T extends { set: (properties: object) => T }>(object: T) {
  object.set({ selectable: false, evented: false, excludeFromExport: true });
  return object;
}

export function ImageAnnotationCanvas({ imageUrl, imageSize, draft, mode, items, onPixel, rectangleSelection, onRectangleSelection }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<Canvas>();
  const onPixelRef = useRef(onPixel);
  const onRectangleSelectionRef = useRef(onRectangleSelection);
  const imageRef = useRef(imageUrl);
  const sizeRef = useRef(imageSize);
  const rectangleStart = useRef<ImagePixel | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 1, height: 1 });

  useEffect(() => { onPixelRef.current = onPixel; }, [onPixel]);
  useEffect(() => { onRectangleSelectionRef.current = onRectangleSelection; }, [onRectangleSelection]);
  useEffect(() => { if (!rectangleSelection) rectangleStart.current = null; }, [rectangleSelection]);
  useEffect(() => { imageRef.current = imageUrl; }, [imageUrl]);
  useEffect(() => { sizeRef.current = imageSize; }, [imageSize]);

  useEffect(() => {
    const hostElement = host.current;
    if (!hostElement) return;
    const updateViewport = () => {
      const { width, height } = hostElement.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport(fitImage(width, height, imageSize));
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(hostElement);
    return () => observer.disconnect();
  }, [imageSize]);

  useEffect(() => {
    if (!element.current) return;
    const instance = new Canvas(element.current, { selection: false, preserveObjectStacking: true, backgroundColor: 'transparent' });
    canvas.current = instance;
    const toImagePixel = (event: { e: Parameters<Canvas['getScenePoint']>[0] }) => {
      const point = instance.getScenePoint(event.e);
      const size = sizeRef.current;
      const canvasWidth = Math.max(1, instance.getWidth());
      const canvasHeight = Math.max(1, instance.getHeight());
      return {
        x: Math.round(Math.max(0, Math.min(size.width, point.x * size.width / canvasWidth))),
        y: Math.round(Math.max(0, Math.min(size.height, point.y * size.height / canvasHeight)),),
      };
    };
    const updateRectangle = (end: ImagePixel, complete = false) => {
      const start = rectangleStart.current;
      if (!start) return;
      const target = targetBoxFromPixels([start, end], sizeRef.current);
      if (target) onRectangleSelectionRef.current?.({ target, anchor: complete ? null : start });
    };
    instance.on('mouse:down', (event) => {
      if (!imageRef.current) return;
      const pixel = toImagePixel(event);
      if (onRectangleSelectionRef.current) {
        if (rectangleStart.current) {
          updateRectangle(pixel, true);
          rectangleStart.current = null;
          return;
        }
        rectangleStart.current = pixel;
        updateRectangle(pixel);
        return;
      }
      onPixelRef.current(pixel);
    });
    instance.on('mouse:move', (event) => { if (rectangleStart.current) updateRectangle(toImagePixel(event)); });
    return () => { instance.dispose(); canvas.current = undefined; };
  }, []);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance) return;
    instance.clear();
    instance.setDimensions({ width: viewport.width, height: viewport.height });
    if (!imageUrl) return;
    const scaleX = viewport.width / imageSize.width;
    const scaleY = viewport.height / imageSize.height;
    if (rectangleSelection) addTargetBox(instance, rectangleSelection.target, scaleX, scaleY);
    else {
      items.forEach((item) => addGeometry(instance, item.mode, item.pixels, scaleX, scaleY, '#31c9f0', 'rgba(49,201,240,0.2)'));
      if (draft.length) addGeometry(instance, mode, draft, scaleX, scaleY, '#ffd166', 'rgba(255,209,102,0.16)');
    }
    if (rectangleSelection?.anchor) addRectangleAnchor(instance, rectangleSelection.anchor, scaleX, scaleY);
    instance.requestRenderAll();
  }, [draft, imageSize, imageUrl, items, mode, rectangleSelection, viewport]);

  return (
    <div ref={host} className="fabric-annotation" style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div
        style={{
          width: viewport.width,
          height: viewport.height,
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        }}
      >
        <canvas ref={element} />
      </div>
    </div>
  );
}

function addTargetBox(canvas: Canvas, target: TargetBox, scaleX: number, scaleY: number) {
  canvas.add(locked(new Rect({
    left: target.x * scaleX,
    top: target.y * scaleY,
    originX: 'left',
    originY: 'top',
    width: target.width * scaleX,
    height: target.height * scaleY,
    fill: 'rgba(255, 122, 72, 0.18)',
    stroke: '#ff865c',
    strokeWidth: 3,
  })));
}

function addRectangleAnchor(canvas: Canvas, anchor: ImagePixel, scaleX: number, scaleY: number) {
  const x = anchor.x * scaleX;
  const y = anchor.y * scaleY;
  canvas.add(locked(new Circle({ left: x, top: y, originX: 'center', originY: 'center', radius: 6, fill: '#ffd166', stroke: '#ffffff', strokeWidth: 2 })));
}

function addGeometry(canvas: Canvas, mode: ImageGeometryMode, pixels: ImagePixel[], scaleX: number, scaleY: number, stroke: string, fill: string) {
  const scaledPixels = pixels.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
  if (mode === 'point' && scaledPixels[0]) {
    const point = scaledPixels[0];
    canvas.add(locked(new Circle({ left: point.x, top: point.y, originX: 'center', originY: 'center', radius: 9, fill: '#ff7657', stroke: '#ffffff', strokeWidth: 3 })));
    canvas.add(locked(new Line([point.x - 18, point.y, point.x + 18, point.y], { stroke: '#ffffff', strokeWidth: 2 })));
    canvas.add(locked(new Line([point.x, point.y - 18, point.x, point.y + 18], { stroke: '#ffffff', strokeWidth: 2 })));
    return;
  }
  if (mode === 'polygon' && scaledPixels.length >= 3) canvas.add(locked(new Polygon(scaledPixels, { fill, stroke, strokeWidth: 4 })));
  else if (scaledPixels.length >= 2) canvas.add(locked(new Polyline(scaledPixels, { fill: 'transparent', stroke, strokeWidth: 4 })));
  scaledPixels.forEach((point) => canvas.add(locked(new Circle({ left: point.x, top: point.y, originX: 'center', originY: 'center', radius: 6, fill: stroke, stroke: '#ffffff', strokeWidth: 2 }))));
}
