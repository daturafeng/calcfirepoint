import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, Descriptions, Tag } from 'antd';

import type { MultiCameraResponse } from '../types';

export function MultiCameraResultPanel({ result, error }: { result: MultiCameraResponse | null; error: string | null }) {
  if (error) return <section className="result-card" role="alert"><Alert showIcon type="error" icon={<ExclamationCircleOutlined />} title="交会请求失败" description={error} /></section>;
  if (!result) return null;
  if (!result.location) return <section className="result-card" role="alert"><Alert showIcon type="warning" title="交会未就绪" description={result.checks.map((item) => `${item.name}: ${item.reason ?? item.status}`).join('；')} /></section>;
  const point = result.location;
  const quality = point.quality === 'high' ? '高' : point.quality === 'medium' ? '中' : '低';
  return <section className="result-card multicamera-result" aria-live="polite">
    <Alert showIcon type="success" icon={<CheckCircleOutlined />} title="多相机交会完成" description={<span>质量 <Tag color={point.quality === 'high' ? 'success' : point.quality === 'medium' ? 'warning' : 'default'}>{quality}</Tag> · 最小夹角 {point.minRayAngleDeg.toFixed(1)}°</span>} />
    <Descriptions size="small" column={2} items={[
      { key: 'coordinate', label: '经纬度', children: `${point.longitude.toFixed(7)}, ${point.latitude.toFixed(7)}` },
      { key: 'elevation', label: '地表高程', children: `${point.elevationM.toFixed(1)} m` },
      { key: 'uncertainty', label: '估计误差', children: `± ${point.horizontalUncertaintyM.toFixed(1)} m` },
      { key: 'count', label: '参与相机', children: `${point.observations.length} 路` },
    ]} />
    <div className="multicamera-residuals">{point.observations.map((item) => <span key={item.id}>{item.name}：残差 {item.residualM.toFixed(1)} m</span>)}</div>
  </section>;
}
