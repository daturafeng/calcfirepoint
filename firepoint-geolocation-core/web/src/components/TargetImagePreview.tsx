import { AimOutlined } from '@ant-design/icons';
import { Badge, Tooltip } from 'antd';
import { useState } from 'react';

import { TargetGeometryEditor } from './TargetGeometryEditor';
import type { TargetBox } from './targetGeometry';

interface Props {
  src: string;
  imageSize: { width: number; height: number };
  target: { x: number; y: number; width: number; height: number };
  onApplyTarget: (target: TargetBox) => void;
}

export function TargetImagePreview({ src, imageSize, target, onApplyTarget }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const centreX = target.x + target.width / 2;
  const centreY = target.y + target.height / 2;

  return (
    <>
      <Tooltip title="点击或按 Enter 绘制并应用目标框">
      <figure className="target-preview" role="button" tabIndex={0} aria-label="打开报警图片标绘弹窗" onClick={() => setEditorOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setEditorOpen(true); }}>
        <svg viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} role="img" aria-label="报警图片与当前目标框中心点">
          <image href={src} width={imageSize.width} height={imageSize.height} />
          <rect className="target-box" x={target.x} y={target.y} width={target.width} height={target.height} />
          <circle className="target-centre-halo" cx={centreX} cy={centreY} r="20" />
          <circle className="target-centre" cx={centreX} cy={centreY} r="8" />
          <path className="target-cross" d={`M ${centreX - 28} ${centreY} H ${centreX + 28}`} />
        </svg>
        <figcaption><Badge status="processing" /><AimOutlined /> 当前反算点：({centreX.toFixed(1)}, {centreY.toFixed(1)})</figcaption>
      </figure>
      </Tooltip>
      <TargetGeometryEditor open={editorOpen} src={src} imageSize={imageSize} onCancel={() => setEditorOpen(false)} onApply={onApplyTarget} />
    </>
  );
}
