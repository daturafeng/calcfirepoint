import { describe, expect, it } from 'vitest';

import { haeToAsl, parseEgm96Pgm } from './egm96Geoid';

function createGrid() {
  const header = new TextEncoder().encode(
    'P5\n# Offset 0\n# Scale 0.01\n2 2\n65535\n',
  );
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  [100, 200, 300, 400].forEach((value, index) =>
    view.setUint16(index * 2, value, false),
  );
  const result = new Uint8Array(header.length + data.length);
  result.set(header);
  result.set(data, header.length);
  return result.buffer;
}

describe('EGM96 大地水准面网格', () => {
  it('解析 PGM 网格并双线性插值', () => {
    const sampler = parseEgm96Pgm(createGrid());
    expect(sampler.undulationAt(90, 0)).toBeCloseTo(2.25);
  });

  it('将 Cesium HAE 转换为编辑区 ASL', () => {
    expect(haeToAsl(100, 31.2)).toBeCloseTo(68.8);
  });
});
