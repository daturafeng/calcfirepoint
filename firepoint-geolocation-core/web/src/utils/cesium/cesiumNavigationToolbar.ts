import type { Viewer } from 'cesium';
import CesiumNavigation from 'cesium-navigation-es6';

/** 官方 typings 未声明运行时成员，这里补齐最小实例结构。 */
export type CesiumToolbarNavigation = {
  destroy(): void;
  navigationDiv?: HTMLDivElement;
  distanceLegendDiv?: HTMLDivElement;
};

export type CesiumNavigationToolbarOptions = NonNullable<
  ConstructorParameters<typeof CesiumNavigation>[1]
>;

// 统一地图指北针视觉，业务页面无需逐个传入 SVG。
const DEFAULT_COMPASS_OUTER_RING_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">
  <defs>
    <linearGradient id="dock-compass-ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.96)" />
      <stop offset="100%" stop-color="rgba(170,220,255,0.92)" />
    </linearGradient>
    <linearGradient id="dock-compass-north" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#ff8a7a" />
      <stop offset="100%" stop-color="#ff5d5d" />
    </linearGradient>
  </defs>
  <circle cx="48" cy="48" r="24.5" fill="rgba(6,20,38,0.4)" stroke="url(#dock-compass-ring)" stroke-width="1.9" />
  <circle cx="48" cy="48" r="18.2" fill="none" stroke="rgba(168,223,255,0.34)" stroke-width="1" stroke-dasharray="1.7 3.6" />
  <circle cx="48" cy="48" r="28.8" fill="none" stroke="rgba(168,223,255,0.18)" stroke-width="0.95" />
  <g stroke-linecap="round">
    <line x1="48" y1="18" x2="48" y2="23.6" stroke="rgba(255,255,255,0.98)" stroke-width="2.15" />
    <line x1="48" y1="72.4" x2="48" y2="78" stroke="rgba(255,255,255,0.8)" stroke-width="1.8" />
    <line x1="18" y1="48" x2="23.6" y2="48" stroke="rgba(255,255,255,0.8)" stroke-width="1.8" />
    <line x1="72.4" y1="48" x2="78" y2="48" stroke="rgba(255,255,255,0.8)" stroke-width="1.8" />
    <line x1="26.3" y1="26.3" x2="30" y2="30" stroke="rgba(168,223,255,0.58)" stroke-width="1.35" />
    <line x1="66" y1="66" x2="69.7" y2="69.7" stroke="rgba(168,223,255,0.42)" stroke-width="1.35" />
    <line x1="26.3" y1="69.7" x2="30" y2="66" stroke="rgba(168,223,255,0.42)" stroke-width="1.35" />
    <line x1="66" y1="30" x2="69.7" y2="26.3" stroke="rgba(168,223,255,0.58)" stroke-width="1.35" />
  </g>
  <g text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#04101c" stroke-linejoin="round" stroke-width="1.45">
    <text x="48" y="11" font-size="10.1" font-weight="800" fill="#ff6f61" letter-spacing="0.15">N</text>
    <text x="48" y="86.8" font-size="10.1" font-weight="800" fill="#f5fbff" letter-spacing="0.15">S</text>
    <text x="11.2" y="49" font-size="10.1" font-weight="800" fill="#f5fbff" letter-spacing="0.15">W</text>
    <text x="84.8" y="49" font-size="10.1" font-weight="800" fill="#f5fbff" letter-spacing="0.15">E</text>
  </g>
  <g text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#061521" stroke-linejoin="round" stroke-width="1.1">
    <text x="23.5" y="22.3" font-size="7.3" font-weight="700" fill="#d8f2ff" letter-spacing="0.15">WN</text>
    <text x="72.5" y="22.3" font-size="7.3" font-weight="700" fill="#d8f2ff" letter-spacing="0.15">EN</text>
    <text x="23.5" y="73.7" font-size="7.3" font-weight="700" fill="#d8f2ff" letter-spacing="0.15">WS</text>
    <text x="72.5" y="73.7" font-size="7.3" font-weight="700" fill="#d8f2ff" letter-spacing="0.15">ES</text>
  </g>
  <polygon points="48,20 51.7,27.6 48,25.8 44.3,27.6" fill="url(#dock-compass-north)" />
  <circle cx="48" cy="48" r="2.3" fill="rgba(255,255,255,0.95)" />
</svg>`;

const DEFAULT_COMPASS_ROTATION_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">
  <defs>
    <radialGradient id="dock-compass-rotate-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(100,203,255,0.55)" />
      <stop offset="100%" stop-color="rgba(100,203,255,0)" />
    </radialGradient>
  </defs>
  <path d="M48 17 A31 31 0 0 1 69.9 26.1 L66.8 29.3 A25.5 25.5 0 0 0 48 22.5 Z" />
  <circle cx="48" cy="48" r="24" fill="none" stroke="url(#dock-compass-rotate-glow)" stroke-width="1.9" stroke-dasharray="29 142" stroke-linecap="round" />
</svg>`;

const DEFAULT_COMPASS_GYRO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">
  <circle cx="48" cy="48" r="8.8" fill="rgba(7,18,34,0.82)" stroke="rgba(255,255,255,0.18)" stroke-width="0.95" />
  <path d="M48 35 L53.4 48 L48 46 L42.6 48 Z" />
  <path d="M48 61 L42.6 48 L48 50 L53.4 48 Z" opacity="0.42" />
  <circle cx="48" cy="48" r="2.35" fill="rgba(255,255,255,0.95)" />
</svg>`;

/**
 * 创建与 Workspace 地图一致的导航工具（指北针 + 比例尺；缩放由 MapToolRail 负责，所以关闭插件内缩放）。
 */
export function createCesiumNavigationToolbar(
  viewer: Viewer,
  partial?: Partial<CesiumNavigationToolbarOptions>,
): CesiumToolbarNavigation {
  const merged: CesiumNavigationToolbarOptions = {
    enableZoomControls: false,
    enableCompass: true,
    enableDistanceLegend: true,
    resetTooltip: '重置视图',
    zoomInTooltip: '放大',
    zoomOutTooltip: '缩小',
    compassOuterRingSvg: DEFAULT_COMPASS_OUTER_RING_SVG,
    compassRotationMarkerSvg: DEFAULT_COMPASS_ROTATION_MARKER_SVG,
    compassGyroSvg: DEFAULT_COMPASS_GYRO_SVG,
    ...partial,
  };

  merged.enableZoomControls = false;
  return new CesiumNavigation(viewer, merged) as unknown as CesiumToolbarNavigation;
}
