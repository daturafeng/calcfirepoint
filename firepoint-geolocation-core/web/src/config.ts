export const mapConfig = {
  imageryUrl: import.meta.env.VITE_CESIUM_IMAGERY_URL ?? 'http://10.100.51.15:18080/tiles/tianditu/{z}/{x}/{y}.jpg',
  terrainUrl: import.meta.env.VITE_CESIUM_TERRAIN_URL ?? 'http://10.100.51.15/tiles/dem/layer.json',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
};
