import { InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Card, Collapse, Form, Input, InputNumber, Tag, Tooltip, Typography, Upload } from 'antd';
import type { Dispatch, SetStateAction } from 'react';

import type { FormValues, ImageMetadata } from '../types';

interface Props {
  values: FormValues;
  setValues: Dispatch<SetStateAction<FormValues>>;
  file: File | null;
  metadata: ImageMetadata | null;
  metadataStatus: string | null;
  onFile: (file: File) => void;
}

const fields: Array<[keyof FormValues, string, number]> = [
  ['longitude', '经度', 0.000001], ['latitude', '纬度', 0.000001], ['absoluteElevationM', '相机绝对高程 (m)', 0.1],
  ['azimuthDeg', '方位角 (°)', 0.1], ['pitchDeg', '俯仰角 (°)', 0.1], ['rollDeg', '横滚角 (°)', 0.1],
  ['horizontalFovDeg', '水平视场角 (°)', 0.1], ['verticalFovDeg', '垂直视场角 (°)', 0.1],
];

export function AnnotationMetadataForm({ values, setValues, file, metadata, metadataStatus, onFile }: Props) {
  const update = (key: keyof FormValues, value: number | string) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <aside className="annotation-metadata" aria-label="标绘元数据输入">
      <div className="annotation-heading"><div><span className="eyebrow">METADATA</span><h2>相机与姿态</h2></div><span><Tag color="cyan">投影参数</Tag><Tooltip title="选择影像后自动回填可用元数据；可在下方直接修正投影参数。"><span className="inline-help" tabIndex={0} aria-label="影像元数据说明"><InfoCircleOutlined /></span></Tooltip></span></div>
      <Upload accept="image/jpeg,image/tiff" maxCount={1} showUploadList={false} beforeUpload={(next) => { onFile(next); return false; }}>
        <Typography.Link><UploadOutlined /> {file ? '更换影像' : '选择影像'}</Typography.Link>
      </Upload>
      <Typography.Text className="annotation-file-name">{file?.name ?? '尚未选择影像'}</Typography.Text>
      {metadataStatus && <Tooltip title={metadataStatus}><Tag className="metadata-status" color={metadata ? 'success' : 'default'}>{metadata ? '元数据已读取' : '元数据提示'}</Tag></Tooltip>}
      <Form className="annotation-form" layout="vertical" requiredMark={false}>
        <Card size="small" title="采集信息">
          <Form.Item label="采集时间"><Input type="datetime-local" value={values.capturedAt.slice(0, 16)} onChange={(event) => update('capturedAt', `${event.target.value}:00+08:00`)} /></Form.Item>
        </Card>
        <Card size="small" title="相机位置与云台姿态">
          <div className="annotation-form-grid">{fields.slice(0, 6).map(([key, label, step]) => <Form.Item key={key} label={label}><InputNumber value={values[key] as number} step={step} controls={false} onChange={(value) => typeof value === 'number' && update(key, value)} /></Form.Item>)}</div>
        </Card>
        <Card size="small" title="相机参数">
          <div className="annotation-form-grid">{fields.slice(6).map(([key, label, step]) => <Form.Item key={key} label={label}><InputNumber value={values[key] as number} step={step} controls={false} onChange={(value) => typeof value === 'number' && update(key, value)} /></Form.Item>)}</div>
        </Card>
      </Form>
      {metadata && <Collapse size="small" items={[{ key: 'metadata', label: '查看已读取元数据', children: <pre>{JSON.stringify(metadata, null, 2)}</pre> }]} />}
    </aside>
  );
}
