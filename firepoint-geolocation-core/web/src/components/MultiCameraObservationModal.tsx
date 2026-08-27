import { InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Modal, Space, Tag, Tooltip, Upload } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { inspectImage } from '../api';
import { applyImageMetadata } from '../imageMetadata';
import type { FormValues, ImageMetadata, MultiCameraObservation } from '../types';
import { TargetImagePreview } from './TargetImagePreview';

interface Props {
  open: boolean;
  observation: MultiCameraObservation | null;
  defaultValues: FormValues;
  nextIndex: number;
  onCancel: () => void;
  onSave: (observation: MultiCameraObservation) => void;
}

const poseFields: Array<[keyof FormValues, string, number]> = [
  ['longitude', '经度', 0.000001], ['latitude', '纬度', 0.000001], ['absoluteElevationM', '相机绝对高程 (m)', 0.1],
  ['azimuthDeg', '方位角 (°)', 0.1], ['pitchDeg', '俯仰角 (°)', 0.1], ['rollDeg', '横滚角 (°)', 0.1],
];
const calibrationFields: Array<[keyof FormValues, string, number]> = [
  ['horizontalFovDeg', '水平视场角 (°)', 0.1], ['verticalFovDeg', '垂直视场角 (°)', 0.1],
  ['x', '框 X', 1], ['y', '框 Y', 1], ['width', '框宽', 1], ['height', '框高', 1],
];

export function MultiCameraObservationModal({ open, observation, defaultValues, nextIndex, onCancel, onSave }: Props) {
  const [name, setName] = useState('');
  const [values, setValues] = useState<FormValues>(defaultValues);
  const [file, setFile] = useState<File | null>(null);
  const [imageSize, setImageSize] = useState({ width: 4032, height: 3024 });
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!open) return;
    setName(observation?.name ?? `观测 ${nextIndex}`);
    setValues(observation?.values ?? defaultValues);
    setFile(observation?.file ?? null);
    setImageSize(observation?.imageSize ?? { width: 4032, height: 3024 });
    setMetadata(observation?.metadata ?? null);
    setMetadataStatus(observation?.metadataStatus ?? null);
  }, [defaultValues, nextIndex, observation, open]);

  const update = (key: keyof FormValues, value: number | string) => setValues((current) => ({ ...current, [key]: value }));
  const selectImage = async (next: File) => {
    setFile(next);
    setMetadata(null);
    setMetadataStatus('正在读取图片元数据…');
    const decoded = new Image();
    decoded.onload = () => {
      setImageSize({ width: decoded.naturalWidth, height: decoded.naturalHeight });
      URL.revokeObjectURL(decoded.src);
    };
    decoded.src = URL.createObjectURL(next);
    try {
      const discovered = await inspectImage(next);
      const hydrated = applyImageMetadata(values, discovered);
      setMetadata(discovered);
      setValues(hydrated.values);
      setMetadataStatus(hydrated.appliedKeys.length ? `已从图片元数据回填：${hydrated.appliedKeys.join('、')}` : '未发现可用定位元数据，已保留当前输入值。');
    } catch {
      setMetadataStatus('未能读取图片元数据，已保留当前输入值。');
    }
  };
  const save = () => {
    if (!file || !name.trim()) return;
    onSave({
      id: observation?.id ?? crypto.randomUUID(),
      name: name.trim(),
      file,
      imageSize,
      values,
      metadata,
      metadataStatus,
    });
  };
  const renderField = ([key, label, step]: [keyof FormValues, string, number]) => (
    <Form.Item key={key} label={label}>
      <InputNumber value={values[key] as number} step={step} controls={false} onChange={(value) => { if (typeof value === 'number') update(key, value); }} />
    </Form.Item>
  );

  return (
    <Modal className="multicamera-observation-modal" title={observation ? '编辑相机观测' : '新增相机观测'} open={open} onCancel={onCancel} width="min(1080px, 94vw)" footer={<Space><Button onClick={onCancel}>取消</Button><Button type="primary" disabled={!file || !name.trim()} onClick={save}>保存观测</Button></Space>} destroyOnHidden>
      <div className="multicamera-modal-grid">
        <section className="multicamera-modal-form" aria-label="相机观测参数">
          <Form layout="vertical" requiredMark={false}>
            <Card className="input-card" size="small" title={<><b>01</b> 图片与观测</>}>
              <Form.Item label="观测名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Form.Item>
              <Upload accept="image/jpeg,image/tiff" maxCount={1} showUploadList={false} beforeUpload={(next) => { void selectImage(next); return false; }}>
                <Button icon={<UploadOutlined />}>{file ? '更换图片' : '选择图片'}</Button>
              </Upload>
              <p className="multicamera-file-name">{file?.name ?? '请选择该相机对应的图片'}</p>
              {metadataStatus && <Tooltip title={metadataStatus}><Tag color={metadata ? 'success' : 'default'}>{metadata ? '元数据已读取' : '元数据提示'}</Tag></Tooltip>}
              {metadata && <Collapse className="metadata-panel" size="small" items={[{ key: 'metadata', label: '已发现图片元数据候选', children: <pre>{JSON.stringify(metadata, null, 2)}</pre> }]} />}
            </Card>
            <Card className="input-card" size="small" title={<><b>02</b> 相机位置与云台姿态</>}>
              <Form.Item label="采集时间"><Input type="datetime-local" value={values.capturedAt.slice(0, 16)} onChange={(event) => update('capturedAt', `${event.target.value}:00+08:00`)} /></Form.Item>
              <div className="form-grid">{poseFields.map(renderField)}</div>
            </Card>
            <Card className="input-card" size="small" title={<><b>03</b> 标定与目标框</>}>
              <div className="form-grid">{calibrationFields.map(renderField)}</div>
            </Card>
          </Form>
        </section>
        <section className="multicamera-modal-preview" aria-label="图片目标框选">
          <div className="multicamera-preview-heading"><div><span className="eyebrow">TARGET SELECTION</span><h3>点击图片预览绘制目标矩形</h3></div><Tooltip title="框选同一个地面火点或烟羽底部；保存前可以手动修改像素值。"><InfoCircleOutlined /></Tooltip></div>
          {preview ? <TargetImagePreview src={preview} imageSize={imageSize} target={values} onApplyTarget={(target) => setValues((current) => ({ ...current, ...target }))} /> : <Alert type="info" showIcon message="选择图片后可预览并框选目标区域" />}
        </section>
      </div>
    </Modal>
  );
}
