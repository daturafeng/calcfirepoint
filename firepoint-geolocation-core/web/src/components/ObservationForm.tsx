import { InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Form, Input, InputNumber, Space, Tag, Tooltip, Upload } from 'antd';
import type { Dispatch, SetStateAction } from 'react';

import { TargetImagePreview } from './TargetImagePreview';
import type { FormValues, ImageMetadata } from '../types';

interface Props {
  values: FormValues;
  setValues: Dispatch<SetStateAction<FormValues>>;
  file: File | null;
  preview: string | null;
  metadata: ImageMetadata | null;
  metadataStatus: string | null;
  imageSize: { width: number; height: number };
  onFile: (file: File) => void;
  onCalculate: () => void;
  busy: boolean;
}

const poseFields: Array<[keyof FormValues, string, number]> = [
  ['longitude', '经度', 0.000001], ['latitude', '纬度', 0.000001], ['absoluteElevationM', '相机绝对高程 (m)', 0.1],
  ['azimuthDeg', '方位角 (°)', 0.1], ['pitchDeg', '俯仰角 (°)', 0.1], ['rollDeg', '横滚角 (°)', 0.1],
];
const targetFields: Array<[keyof FormValues, string, number]> = [
  ['horizontalFovDeg', '水平视场角 (°)', 0.1], ['verticalFovDeg', '垂直视场角 (°)', 0.1], ['x', '框 X', 1],
  ['y', '框 Y', 1], ['width', '框宽', 1], ['height', '框高', 1],
];

export function ObservationForm({ values, setValues, file, preview, metadata, metadataStatus, imageSize, onFile, onCalculate, busy }: Props) {
  const update = (key: keyof FormValues, value: number | string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };
  const renderField = ([key, label, step]: [keyof FormValues, string, number]) => (
    <Form.Item key={key} label={label}>
      <InputNumber value={values[key] as number} step={step} controls={false} onChange={(value) => typeof value === 'number' && update(key, value)} />
    </Form.Item>
  );

  return (
    <aside className="control-panel" aria-label="观测输入">
      <div className="panel-heading"><div><span className="eyebrow">OBSERVATION</span><h2>观测输入</h2></div><Space size={6}><Tag color="cyan">显式输入优先</Tag><Tooltip title="选择图片后自动尝试读取 DJI 元数据；未读取到的字段保留当前默认值。"><span className="inline-help" tabIndex={0} aria-label="图片元数据说明"><InfoCircleOutlined /></span></Tooltip></Space></div>
      <div className="image-picker">
        <Upload accept="image/jpeg,image/tiff" maxCount={1} showUploadList={false} beforeUpload={(next) => { onFile(next); return false; }}>
          <Button icon={<UploadOutlined />}>{file ? '更换图片' : '选择图片'}</Button>
        </Upload>
        <div><strong>{file?.name ?? '未选择报警图片'}</strong></div>
      </div>
      {preview && <TargetImagePreview src={preview} imageSize={imageSize} target={values} onApplyTarget={(target) => setValues((current) => ({ ...current, ...target }))} />}
      {metadataStatus && <Tooltip title={metadataStatus}><Tag className="metadata-status" color={metadata ? 'success' : 'default'}>{metadata ? '元数据已读取' : '元数据提示'}</Tag></Tooltip>}
      {metadata && <Collapse className="metadata-panel" size="small" items={[{ key: 'metadata', label: '已发现图片元数据候选', children: <pre>{JSON.stringify(metadata, null, 2)}</pre> }]} />}

      <Form className="observation-form" layout="vertical" requiredMark={false} onFinish={onCalculate}>
        <Card className="input-card" size="small" title={<><b>01</b> 相机与姿态</>}>
          <Form.Item label="采集时间"><Input type="datetime-local" value={values.capturedAt.slice(0, 16)} onChange={(event) => update('capturedAt', `${event.target.value}:00+08:00`)} /></Form.Item>
          <div className="form-grid">{poseFields.map(renderField)}</div>
        </Card>
        <Card className="input-card" size="small" title={<><b>02</b> 成像与目标框</>}>
          <div className="form-grid">{targetFields.map(renderField)}</div>
        </Card>
        <Button className="calculate" type="primary" htmlType="submit" loading={busy} block>{busy ? '正在反投影…' : '计算火点位置'}</Button>
      </Form>
    </aside>
  );
}
