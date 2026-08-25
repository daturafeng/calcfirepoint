/** EGM96 PGM 网格解析与双线性插值。PGM 像素代表 Offset + Scale * unsignedShort。 */
export interface GeoidUndulationSampler {
  undulationAt(lng: number, lat: number): number;
}

function readHeaderToken(bytes: Uint8Array, cursor: { value: number }) {
  while (cursor.value < bytes.length) {
    const value = bytes[cursor.value];
    if (value === 35) {
      while (cursor.value < bytes.length && bytes[cursor.value] !== 10) cursor.value += 1;
    } else if (value <= 32) {
      cursor.value += 1;
    } else {
      break;
    }
  }
  const start = cursor.value;
  while (cursor.value < bytes.length && bytes[cursor.value] > 32) cursor.value += 1;
  return new TextDecoder().decode(bytes.slice(start, cursor.value));
}

export function parseEgm96Pgm(buffer: ArrayBuffer): GeoidUndulationSampler {
  const bytes = new Uint8Array(buffer);
  const cursor = { value: 0 };
  if (readHeaderToken(bytes, cursor) !== 'P5') {
    throw new Error('EGM96 网格文件格式不正确');
  }
  const width = Number(readHeaderToken(bytes, cursor));
  const height = Number(readHeaderToken(bytes, cursor));
  const maxValue = Number(readHeaderToken(bytes, cursor));
  if (!Number.isInteger(width) || !Number.isInteger(height) || maxValue !== 65535) {
    throw new Error('EGM96 网格头信息不正确');
  }
  const headerText = new TextDecoder().decode(bytes.slice(0, cursor.value));
  const offset = Number(headerText.match(/Offset\s+([-+\d.]+)/i)?.[1]);
  const scale = Number(headerText.match(/Scale\s+([-+\d.]+)/i)?.[1]);
  if (!Number.isFinite(offset) || !Number.isFinite(scale)) {
    throw new Error('EGM96 网格缺少 Offset 或 Scale');
  }
  // maxValue 后仅消费 PGM 头与二进制数据之间的换行；栅格首字节可能恰好为
  // 0x00/0x0A，不能按“所有空白”跳过，否则会错位读取高度。
  if (bytes[cursor.value] === 13) cursor.value += 1;
  if (bytes[cursor.value] === 10) cursor.value += 1;
  if (bytes.length - cursor.value < width * height * 2) {
    throw new Error('EGM96 网格数据不完整');
  }
  const values = new DataView(buffer, cursor.value, width * height * 2);
  const valueAt = (row: number, column: number) =>
    offset + scale * values.getUint16((row * width + column) * 2, false);

  return {
    undulationAt(lng, lat) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error('经纬度超出 EGM96 网格范围');
      }
      const longitude = ((lng % 360) + 360) % 360;
      const rowValue = ((90 - lat) / 180) * (height - 1);
      const columnValue = (longitude / 360) * (width - 1);
      const row = Math.min(height - 2, Math.max(0, Math.floor(rowValue)));
      const column = Math.min(width - 2, Math.max(0, Math.floor(columnValue)));
      const rowRatio = rowValue - row;
      const columnRatio = columnValue - column;
      const top = valueAt(row, column) * (1 - columnRatio) + valueAt(row, column + 1) * columnRatio;
      const bottom = valueAt(row + 1, column) * (1 - columnRatio) + valueAt(row + 1, column + 1) * columnRatio;
      return top * (1 - rowRatio) + bottom * rowRatio;
    },
  };
}

let samplerRequest: Promise<GeoidUndulationSampler> | undefined;

export function loadEgm96Geoid(url: string) {
  if (!url) return Promise.reject(new Error('未配置 EGM96 网格资源地址'));
  samplerRequest ||= fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error('EGM96 网格加载失败');
      return response.arrayBuffer();
    })
    .then(parseEgm96Pgm)
    .catch((error) => {
      samplerRequest = undefined;
      throw error;
    });
  return samplerRequest;
}

export function haeToAsl(haeMeters: number, geoidUndulationMeters: number) {
  return haeMeters - geoidUndulationMeters;
}
