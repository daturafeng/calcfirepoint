import { DeleteOutlined } from '@ant-design/icons';
import { Button, Descriptions, Modal } from 'antd';
import { useEffect, useState } from 'react';

import { ImageAnnotationCanvas, type ImageGeometryDraft, type ImagePixel, type RectangleSelection } from './ImageAnnotationCanvas';
import type { TargetBox } from './targetGeometry';

interface Props {
  open: boolean;
  src: string;
  imageSize: { width: number; height: number };
  onCancel: () => void;
  onApply: (target: TargetBox) => void;
}

const EMPTY_ITEMS: ImageGeometryDraft[] = [];
const EMPTY_PIXELS: ImagePixel[] = [];
const ignorePixel = () => undefined;

export function TargetGeometryEditor({ open, src, imageSize, onCancel, onApply }: Props) {
  const [selection, setSelection] = useState<RectangleSelection | null>(null);
  const target = selection?.target ?? null;

  useEffect(() => {
    if (!open) return;
    setSelection(null);
  }, [open, src]);

  const apply = () => {
    if (!target) return;
    onApply(target);
    onCancel();
  };

  return (
    <Modal className="source-image-modal target-geometry-modal" title="绘制目标框" open={open} onCancel={onCancel} footer={null} width="88vw" destroyOnHidden>
      <div className="target-geometry-editor">
        <div className="target-geometry-canvas">
          <ImageAnnotationCanvas imageUrl={src} imageSize={imageSize} mode="point" draft={EMPTY_PIXELS} items={EMPTY_ITEMS} onPixel={ignorePixel} rectangleSelection={selection} onRectangleSelection={setSelection} />
        </div>
        <aside className="target-geometry-side" aria-label="目标框像素参数">
          <span className="eyebrow">TARGET BOX</span>
          <h3>框选参数</h3>
          <Descriptions className="target-geometry-values" size="small" column={1} items={target ? [
            { key: 'x', label: '框 X', children: target.x },
            { key: 'y', label: '框 Y', children: target.y },
            { key: 'width', label: '框宽', children: target.width },
            { key: 'height', label: '框高', children: target.height },
          ] : []} />
          <div className="target-geometry-actions">
            <Button icon={<DeleteOutlined />} disabled={!target} onClick={() => setSelection(null)}>清空矩形</Button>
            <Button type="primary" disabled={!target} onClick={apply}>应用到左侧栏</Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
