import { describe, expect, it, vi } from 'vitest';

vi.mock('cesium', () => {
  class MockCartesian2 {
    constructor(readonly x: number, readonly y: number) {}
  }

  class MockCartesian3 {
    constructor(readonly x: number, readonly y: number, readonly z = 0) {}

    static fromDegrees(lng: number, lat: number, alt = 0) {
      return new MockCartesian3(lng, lat, alt);
    }

    static fromRadians(lng: number, lat: number) {
      return new MockCartesian3(lng, lat);
    }

    equals(other: MockCartesian3) {
      return this.x === other.x && this.y === other.y && this.z === other.z;
    }
  }

  class MockColor {
    static readonly WHITE = new MockColor('#fff');

    constructor(readonly value: string, readonly alpha = 1) {}

    static fromCssColorString(value: string) {
      return new MockColor(value);
    }

    withAlpha(alpha: number) {
      return new MockColor(this.value, alpha);
    }
  }

  class MockProperty {
    constructor(readonly value: unknown) {}
  }

  class MockGraphics {
    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options);
    }
  }

  class MockEntityCollection {
    readonly values: Array<Record<string, any>> = [];

    getById(id: string) {
      return this.values.find((entity) => entity.id === id);
    }

    add(entity: Record<string, any>) {
      this.values.push(entity);
      return entity;
    }

    remove(entity: Record<string, any>) {
      const index = this.values.indexOf(entity);
      if (index < 0) {
        return false;
      }
      this.values.splice(index, 1);
      return true;
    }
  }

  class MockCustomDataSource {
    readonly entities = new MockEntityCollection();

    constructor(readonly name?: string) {}
  }

  return {
    Cartesian2: MockCartesian2,
    Cartesian3: MockCartesian3,
    Cartographic: { fromDegrees: vi.fn() },
    Color: MockColor,
    ColorMaterialProperty: MockProperty,
    ConstantPositionProperty: MockProperty,
    ConstantProperty: MockProperty,
    CustomDataSource: MockCustomDataSource,
    EllipsoidTerrainProvider: class {},
    HeightReference: { CLAMP_TO_GROUND: 'clamp-to-ground' },
    HorizontalOrigin: { CENTER: 'center' },
    LabelGraphics: MockGraphics,
    PolygonGraphics: MockGraphics,
    PolygonHierarchy: MockGraphics,
    PolylineDashMaterialProperty: MockGraphics,
    PolylineGraphics: MockGraphics,
    PolylineOutlineMaterialProperty: MockGraphics,
    sampleTerrainMostDetailed: vi.fn(),
    VerticalOrigin: { BOTTOM: 'bottom' },
    Viewer: class {},
  };
});

import { CustomDataSource } from 'cesium';

import {
  CesiumAnnotationGeometryManager,
  type CesiumCircleOverlay,
  type CesiumManagedGeometry,
} from './CesiumAnnotationGeometryManager';

const airportCircleOverlay = (radiusMeters = 500): CesiumCircleOverlay => ({
  id: 'airport-001',
  lon: 106.55,
  lat: 29.56,
  radiusMeters,
  transparentFill: true,
});

const airportCircle = (radiusMeters = 500): CesiumManagedGeometry => ({
  kind: 'circle',
  overlay: airportCircleOverlay(radiusMeters),
});

describe('CesiumAnnotationGeometryManager', () => {
  it('相同内容重复同步时保留机场范围圆的实体和属性实例', () => {
    const dataSource = new CustomDataSource('geometry-test');
    const manager = new CesiumAnnotationGeometryManager(dataSource);

    manager.sync({ circles: [airportCircleOverlay()] });
    const entity = dataSource.entities.getById('geometry-circle-airport-001');
    const hierarchy = entity?.polygon?.hierarchy;
    const positions = entity?.polyline?.positions;
    const material = entity?.polyline?.material;

    manager.sync({ circles: [airportCircleOverlay()] });

    expect(dataSource.entities.getById('geometry-circle-airport-001')).toBe(
      entity,
    );
    expect(entity?.polygon?.hierarchy).toBe(hierarchy);
    expect(entity?.polyline?.positions).toBe(positions);
    expect(entity?.polyline?.material).toBe(material);
  });

  it('参数变化时使用相同实体原位更新机场范围圆', () => {
    const dataSource = new CustomDataSource('geometry-test');
    const manager = new CesiumAnnotationGeometryManager(dataSource);

    manager.create(airportCircle());
    const entity = dataSource.entities.getById('geometry-circle-airport-001');
    const hierarchy = entity?.polygon?.hierarchy;

    manager.update(airportCircle(800));

    expect(dataSource.entities.getById('geometry-circle-airport-001')).toBe(
      entity,
    );
    expect(entity?.polygon?.hierarchy).not.toBe(hierarchy);
  });

  it('批量创建和批量删除会完整处理面填充及独立描边', () => {
    const dataSource = new CustomDataSource('geometry-test');
    const manager = new CesiumAnnotationGeometryManager(dataSource);
    const polygon: CesiumManagedGeometry = {
      kind: 'polygon',
      overlay: {
        id: 'zone-001',
        color: '#2F9BFF',
        points: [
          { lng: 106.5, lat: 29.5 },
          { lng: 106.6, lat: 29.5 },
          { lng: 106.6, lat: 29.6 },
        ],
      },
    };

    manager.createMany([airportCircle(), polygon]);

    expect(
      dataSource.entities.getById('polygon-overlay-zone-001'),
    ).toBeTruthy();
    expect(
      dataSource.entities.getById('polygon-overlay-zone-001-outline'),
    ).toBeTruthy();

    manager.removeMany([polygon, airportCircle()]);

    expect(dataSource.entities.values).toHaveLength(0);
  });

  it('空间编辑态创建顶点辅助实体，并在同步移除后不残留', () => {
    const dataSource = new CustomDataSource('geometry-test');
    const manager = new CesiumAnnotationGeometryManager(dataSource);
    manager.sync({
      routes: [
        {
          id: '18',
          points: [
            { lng: 106.5, lat: 29.5, alt: 200 },
            { lng: 106.6, lat: 29.6, alt: 210 },
          ],
          terrainPoints: [
            { lng: 106.5, lat: 29.5, alt: 100 },
            { lng: 106.6, lat: 29.6, alt: 110 },
          ],
          showVertexHandles: true,
          selectedVertexIndex: 1,
        },
      ],
    });

    expect(dataSource.entities.getById('annotation-vertex-18-1')).toBeTruthy();
    expect(dataSource.entities.getById('annotation-guide-route:18-0')).toBeTruthy();
    expect(dataSource.entities.getById('annotation-edge-route:18-0')).toBeTruthy();

    manager.sync({ routes: [] });

    expect(dataSource.entities.values).toHaveLength(0);
  });

  it('按标签开关同步折线、面和圆形标签', () => {
    const dataSource = new CustomDataSource('geometry-test');
    const manager = new CesiumAnnotationGeometryManager(dataSource);

    manager.sync({
      routes: [
        {
          id: 'line-001',
          color: '#2F9BFF',
          label: '折线标签',
          showLabel: false,
          points: [
            { lng: 106.5, lat: 29.5 },
            { lng: 106.6, lat: 29.6 },
          ],
        },
      ],
      polygons: [
        {
          id: 'polygon-001',
          color: '#2F9BFF',
          label: '面标签',
          showLabel: true,
          points: [
            { lng: 106.5, lat: 29.5 },
            { lng: 106.6, lat: 29.5 },
            { lng: 106.6, lat: 29.6 },
            { lng: 106.5, lat: 29.6 },
          ],
        },
      ],
      circles: [
        { ...airportCircleOverlay(), label: '圆形标签', showLabel: true },
      ],
    });

    expect(dataSource.entities.getById('route-overlay-line-001')?.label).toBe(
      undefined,
    );
    expect(
      dataSource.entities.getById('polygon-overlay-polygon-001')?.label,
    ).toBeTruthy();
    const polygonLabelPosition = dataSource.entities.getById(
      'polygon-overlay-polygon-001',
    )?.position as unknown as { x: number; y: number };
    expect(polygonLabelPosition.x).toBeCloseTo(106.55);
    expect(polygonLabelPosition.y).toBeCloseTo(29.55);
    expect(
      dataSource.entities.getById('geometry-circle-airport-001')?.label,
    ).toBeTruthy();
  });
});
