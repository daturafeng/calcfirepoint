import {
  DEFAULT_MAP_CENTER,
  getConfiguredMapCenter,
} from '@/services/cloud/mapConfig';

/** @deprecated 请使用 getMapCenter() 读取运行时地图中心点配置。 */
export const CHONGQING_CENTER = DEFAULT_MAP_CENTER;

/** 读取地图配置中的中心点；未配置时回退到默认中心点。 */
export const getMapCenter = getConfiguredMapCenter;
