import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, Descriptions } from 'antd';

import type { CalculationResponse } from '../types';

export function ResultPanel({ result, error }: { result: CalculationResponse | null; error: string | null }) {
  if (error) return <section className="result-card" role="alert"><Alert showIcon type="error" icon={<ExclamationCircleOutlined />} title="请求失败" description={error} /></section>;
  if (!result) return null;
  if (!result.location) return <section className="result-card" role="alert"><Alert showIcon type="warning" title="数据未就绪" description={result.checks.map((check) => `${check.name}: ${check.reason ?? check.status}`).join('；')} /></section>;

  const point = result.location;
  return (
    <section className="result-card" aria-live="polite">
      <Alert className="result-alert" showIcon type="success" icon={<CheckCircleOutlined />} title="定位完成" description="DEM 射线交点" />
      <Descriptions size="small" column={2} items={[
        { key: 'coordinate', label: '经纬度', children: `${point.longitude.toFixed(7)}, ${point.latitude.toFixed(7)}` },
        { key: 'elevation', label: '地表高程', children: `${point.elevationM.toFixed(1)} m` },
        { key: 'distance', label: '视线距离', children: `${point.slantDistanceM.toFixed(1)} m` },
        { key: 'uncertainty', label: '估计误差', children: `± ${point.horizontalUncertaintyM.toFixed(1)} m` },
      ]} />
    </section>
  );
}
