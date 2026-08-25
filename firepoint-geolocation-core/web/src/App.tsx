import { AimOutlined, EditOutlined } from '@ant-design/icons';
import { ConfigProvider, Tabs, Tag, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { calculateLocation, inspectImage } from './api';
import { applyImageMetadata } from './imageMetadata';
import { ImageAnnotationPage } from './components/ImageAnnotationPage';
import { MapCanvas } from './components/MapCanvas';
import { ObservationForm } from './components/ObservationForm';
import { ResultPanel } from './components/ResultPanel';
import type { CalculationResponse, FormValues, ImageMetadata } from './types';

const initialValues: FormValues = {
  capturedAt: '2026-06-22T03:11:26+08:00', longitude: 106.586110015, latitude: 29.595824927, absoluteElevationM: 348.71,
  azimuthDeg: -45.2, pitchDeg: -45, rollDeg: 0, horizontalFovDeg: 84, verticalFovDeg: 65.5, x: 1966, y: 1462, width: 100, height: 100,
};
type WorkspacePage = 'single' | 'annotation';

export default function App() {
  const [page, setPage] = useState<WorkspacePage>('single');
  const [values, setValues] = useState<FormValues>(initialValues);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState({ width: 4032, height: 3024 });
  const [cameraPoseRequestId, setCameraPoseRequestId] = useState(0);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onFile = async (next: File) => {
    setFile(next); setResult(null); setError(null); setMetadataStatus('正在读取图片元数据…');
    const image = new Image();
    image.onload = () => { setSize({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(image.src); };
    image.src = URL.createObjectURL(next);
    try {
      const discovered = await inspectImage(next);
      const hydrated = applyImageMetadata(values, discovered);
      setMetadata(discovered);
      setValues(hydrated.values);
      setCameraPoseRequestId((current) => current + 1);
      setMetadataStatus(hydrated.appliedKeys.length ? `已从图片元数据回填：${hydrated.appliedKeys.join('、')}` : '未发现可用定位元数据，已保留默认输入值。');
    } catch {
      setMetadata(null);
      setMetadataStatus('未能读取图片元数据，已保留默认输入值。');
    }
  };

  const onCalculate = async () => {
    setBusy(true); setError(null);
    try { setResult(await calculateLocation(file, values, size)); }
    catch { setResult(null); setError('计算请求失败，请检查 API 服务与网络连接。'); }
    finally { setBusy(false); }
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#51d7cc', colorInfo: '#51d7cc', colorBgBase: '#07171c', colorBgContainer: '#0b2930', colorBorder: '#28575a', borderRadius: 10, fontFamily: 'Inter, Microsoft YaHei, sans-serif' } }}>
      <main className="workspace">
        <header className="app-header">
          <div className="brand-block"><p>FIREPOINT / GEOLOCATION</p><div className="brand-title"><h1>火点定位工作台</h1><span>影像 · 姿态 · 地形反算</span></div></div>
          <Tabs className="page-tabs" activeKey={page} onChange={(key) => setPage(key as WorkspacePage)} items={[
            { key: 'single', label: <span><AimOutlined /> 单点定位</span> },
            { key: 'annotation', label: <span><EditOutlined /> 影像标绘</span> },
          ]} />
        </header>
        {page === 'annotation' ? <ImageAnnotationPage values={values} imageSize={size} /> : (
          <section className="content" aria-label="单点定位工作区">
            <ObservationForm values={values} setValues={setValues} file={file} preview={preview} metadata={metadata} metadataStatus={metadataStatus} imageSize={size} onFile={onFile} onCalculate={onCalculate} busy={busy} />
            <div className="map-shell">
              <div className="map-header"><span><i className="map-indicator" aria-hidden="true" />三维地形视图</span><Tag color="cyan">南岸区 DEM</Tag></div>
              <MapCanvas values={values} result={result} cameraPoseRequestId={cameraPoseRequestId} />
              <ResultPanel result={result} error={error} />
            </div>
          </section>
        )}
      </main>
    </ConfigProvider>
  );
}
