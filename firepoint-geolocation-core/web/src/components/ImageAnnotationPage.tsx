import { AimOutlined, ClearOutlined, DeleteOutlined, EditOutlined, InfoCircleOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { inspectImage, projectGeometry } from '../api';
import { applyImageMetadata } from '../imageMetadata';
import { AnnotationMetadataForm } from './AnnotationMetadataForm';
import { ImageAnnotationCanvas, type ImageGeometryDraft, type ImageGeometryMode, type ImagePixel } from './ImageAnnotationCanvas';
import { MapCanvas } from './MapCanvas';
import { ProjectionResultPanel } from './ProjectionResultPanel';
import type { FormValues, ImageMetadata, ProjectedGeometry } from '../types';

export function ImageAnnotationPage({ values, imageSize }: { values: FormValues; imageSize: { width: number; height: number } }) {
  const [annotationValues, setAnnotationValues] = useState<FormValues>(() => ({ ...values }));
  const [annotationImageSize, setAnnotationImageSize] = useState(imageSize);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<ImageGeometryMode>('point');
  const [draft, setDraft] = useState<ImagePixel[]>([]);
  const [items, setItems] = useState<ImageGeometryDraft[]>([]);
  const [geometries, setGeometries] = useState<ProjectedGeometry[]>([]);
  const [lastProjection, setLastProjection] = useState<ProjectedGeometry | null>(null);
  const [message, setMessage] = useState('选择影像后，在中间 Fabric 画布中绘制点、线或面。');
  const [projecting, setProjecting] = useState(false);
  const [cameraPoseRequestId, setCameraPoseRequestId] = useState(0);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const selectImage = async (next: File) => {
    setFile(next); setMetadata(null); setMetadataStatus('正在读取图片元数据…');
    setDraft([]); setItems([]); setGeometries([]); setLastProjection(null);
    const decoded = new Image();
    decoded.onload = () => { setAnnotationImageSize({ width: decoded.naturalWidth, height: decoded.naturalHeight }); URL.revokeObjectURL(decoded.src); };
    decoded.src = URL.createObjectURL(next);
    try {
      const discovered = await inspectImage(next);
      const summary = applyImageMetadata(annotationValues, discovered);
      setMetadata(discovered);
      setAnnotationValues((current) => applyImageMetadata(current, discovered).values);
      setCameraPoseRequestId((current) => current + 1);
      setMetadataStatus(summary.appliedKeys.length ? `已从图片元数据回填：${summary.appliedKeys.join('、')}` : '未发现可用定位元数据，已保留本页默认输入值。');
      setMessage(`已加载 ${next.name}，请确认左侧相机与姿态参数后开始标绘。`);
    } catch {
      setMetadataStatus('未能读取图片元数据，已保留本页默认输入值。');
      setMessage(`已加载 ${next.name}，请手动填写左侧投影参数。`);
    }
  };

  const submit = async (pixels: ImagePixel[], geometryType: ImageGeometryMode) => {
    if (projecting) return;
    setProjecting(true);
    try {
      const geometry = await projectGeometry(annotationValues, annotationImageSize, geometryType, pixels);
      setGeometries((current) => [...current, geometry]);
      setItems((current) => [...current, { mode: geometryType, pixels }]);
      setLastProjection(geometry);
      setDraft([]);
      setMessage('定位完成：已将影像像素投影至三维地图。');
    } catch {
      setMessage('投影失败：请检查左侧相机姿态、相机参数和 DEM 配置。');
    } finally {
      setProjecting(false);
    }
  };

  const addPixel = (pixel: ImagePixel) => {
    if (mode === 'point') { setDraft([pixel]); void submit([pixel], 'point'); return; }
    setDraft((current) => [...current, pixel]);
  };
  const minimumVertices = mode === 'polygon' ? 3 : 2;
  const confirm = () => { if (draft.length >= minimumVertices) void submit(draft, mode); };
  const reset = () => { setDraft([]); setItems([]); setGeometries([]); setLastProjection(null); setMessage('已清空当前影像标绘。'); };

  return (
    <section className="annotation-page">
      <div className="annot-toolbar">
        <Space.Compact>
          <Button type={mode === 'point' ? 'primary' : 'default'} icon={<AimOutlined />} onClick={() => { setMode('point'); setDraft([]); }}>点</Button>
          <Button type={mode === 'line' ? 'primary' : 'default'} icon={<NodeIndexOutlined />} onClick={() => { setMode('line'); setDraft([]); }}>线</Button>
          <Button type={mode === 'polygon' ? 'primary' : 'default'} icon={<EditOutlined />} onClick={() => { setMode('polygon'); setDraft([]); }}>面</Button>
        </Space.Compact>
        <Button type="primary" disabled={draft.length < minimumVertices || projecting} loading={projecting} onClick={confirm}>确认投影</Button>
        <Button icon={<DeleteOutlined />} disabled={!draft.length} onClick={() => setDraft((current) => current.slice(0, -1))}>撤销</Button>
        <Button icon={<ClearOutlined />} onClick={reset}>清空</Button>
        <Tooltip title={message}><Button type="text" icon={<InfoCircleOutlined />} aria-label="标绘操作说明" /></Tooltip>
      </div>
      {message.startsWith('投影失败') && <Alert className="annot-status" type="error" showIcon title={message} />}
      <div className="annot-grid annot-grid-three">
        <AnnotationMetadataForm values={annotationValues} setValues={setAnnotationValues} file={file} metadata={metadata} metadataStatus={metadataStatus} onFile={(next) => { void selectImage(next); }} />
        <div className="annot-image"><ImageAnnotationCanvas imageUrl={preview ?? undefined} imageSize={annotationImageSize} mode={mode} draft={draft} items={items} onPixel={addPixel} />{!preview && <Tooltip title="请先在左侧选择影像；然后在此画布中绘制点、线或面。"><span className="annotation-empty-help" tabIndex={0} aria-label="影像标绘说明"><InfoCircleOutlined /></span></Tooltip>}</div>
        <div className="map-shell"><MapCanvas values={annotationValues} result={null} geometries={geometries} cameraPoseRequestId={cameraPoseRequestId} /><ProjectionResultPanel geometry={lastProjection} /></div>
      </div>
    </section>
  );
}
