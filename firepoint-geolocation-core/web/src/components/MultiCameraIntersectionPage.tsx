import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Table, Tag } from 'antd';
import { useState } from 'react';
import type { ColumnsType } from 'antd/es/table';

import { intersectCameraObservations } from '../api';
import type { FormValues, MultiCameraObservation, MultiCameraResponse } from '../types';
import { MapCanvas } from './MapCanvas';
import { MultiCameraObservationModal } from './MultiCameraObservationModal';
import { MultiCameraResultPanel } from './MultiCameraResultPanel';
import './multicamera.css';

export function MultiCameraIntersectionPage({ initialValues }: { initialValues: FormValues }) {
  const [observations, setObservations] = useState<MultiCameraObservation[]>([]);
  const [editing, setEditing] = useState<MultiCameraObservation | null | undefined>(undefined);
  const [result, setResult] = useState<MultiCameraResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const columns: ColumnsType<MultiCameraObservation> = [
    { title: '观测', dataIndex: 'name', render: (name: string, item) => <div><strong>{name}</strong><br /><small>{item.file?.name ?? '未选择图片'}</small></div> },
    { title: '相机位置', render: (_, item) => `${item.values.longitude.toFixed(6)}, ${item.values.latitude.toFixed(6)} · ${item.values.absoluteElevationM.toFixed(1)} m` },
    { title: '云台姿态', render: (_, item) => `方位 ${item.values.azimuthDeg.toFixed(1)}° / 俯仰 ${item.values.pitchDeg.toFixed(1)}°` },
    { title: '目标框', render: (_, item) => item.values.width > 0 && item.values.height > 0 ? <Tag color="success">已框选</Tag> : <Tag>未完成</Tag> },
    { title: '操作', render: (_, item) => <Button.Group><Button aria-label={`编辑${item.name}`} icon={<EditOutlined />} onClick={() => setEditing(item)}>编辑</Button><Popconfirm title="移除这路观测？" onConfirm={() => { setObservations((current) => current.filter((entry) => entry.id !== item.id)); setResult(null); }}><Button danger aria-label={`移除${item.name}`} icon={<DeleteOutlined />}>移除</Button></Popconfirm></Button.Group> },
  ];
  const saveObservation = (next: MultiCameraObservation) => {
    setObservations((current) => {
      const existing = current.findIndex((item) => item.id === next.id);
      return existing < 0 ? [...current, next] : current.map((item) => item.id === next.id ? next : item);
    });
    setResult(null);
    setError(null);
    setEditing(undefined);
  };
  const calculate = async () => {
    setBusy(true);
    setError(null);
    try { setResult(await intersectCameraObservations(observations)); }
    catch { setResult(null); setError('交会请求失败，请检查 API 服务与 DEM 配置。'); }
    finally { setBusy(false); }
  };
  const mapValues = observations[0]?.values ?? initialValues;
  return <section className="multicamera-page" aria-label="多相机交会工作区">
    <header className="multicamera-toolbar"><div><span className="eyebrow">MULTI-CAMERA INTERSECTION</span><h2>多相机交会</h2><p>为同一火点添加至少两路相机观测，框选目标后计算交会位置。</p></div><div className="multicamera-actions">{observations.length < 2 && <span className="multicamera-guidance" role="status">还需 {2 - observations.length} 路观测</span>}<Button icon={<PlusOutlined />} onClick={() => setEditing(null)}>新增相机观测</Button><Button type="primary" loading={busy} disabled={observations.length < 2} onClick={() => { void calculate(); }}>{busy ? '正在交会…' : `计算交会（${observations.length} 路）`}</Button></div></header>
    <div className="multicamera-layout">
      <section className="multicamera-table-panel"><Table rowKey="id" size="middle" columns={columns} dataSource={observations} pagination={false} locale={{ emptyText: '还没有相机观测，点击“新增相机观测”开始。' }} /></section>
      <section className="map-shell multicamera-map-shell"><div className="map-header"><span><i className="map-indicator" aria-hidden="true" />交会三维视图</span><Tag color="cyan">南岸区 DEM</Tag></div><MapCanvas values={mapValues} result={null} multiCamera={{ observations, result }} /><MultiCameraResultPanel result={result} error={error} /></section>
    </div>
    <MultiCameraObservationModal open={editing !== undefined} observation={editing ?? null} defaultValues={initialValues} nextIndex={observations.length + 1} onCancel={() => setEditing(undefined)} onSave={saveObservation} />
  </section>;
}
