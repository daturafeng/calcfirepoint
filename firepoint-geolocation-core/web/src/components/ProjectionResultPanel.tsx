import { CheckCircleOutlined } from '@ant-design/icons';
import { Alert, Descriptions } from 'antd';

import type { ProjectedGeometry } from '../types';

export function ProjectionResultPanel({ geometry }: { geometry: ProjectedGeometry | null }) {
  if (!geometry?.coordinates.length) return null;
  const point = geometry.coordinates[0];
  const title = geometry.geometryType === 'point' ? '定位完成' : `标绘投影完成（${geometry.coordinates.length} 个顶点）`;
  return (
    <section className="result-card projection-result" aria-live="polite">
      <Alert showIcon type="success" icon={<CheckCircleOutlined />} title={title} />
      <Descriptions size="small" column={2} items={[
        { key: 'coordinate', label: '经纬度', children: `${point.longitude.toFixed(7)}, ${point.latitude.toFixed(7)}` },
        { key: 'elevation', label: '地表高程', children: `${point.elevationM.toFixed(1)} m` },
        { key: 'distance', label: '视线距离', children: `${point.slantDistanceM.toFixed(1)} m` },
        { key: 'uncertainty', label: '估计误差', children: `± ${point.horizontalUncertaintyM.toFixed(1)} m` },
      ]} />
    </section>
  );
}
