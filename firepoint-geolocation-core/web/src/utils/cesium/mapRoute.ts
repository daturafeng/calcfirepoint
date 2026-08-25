import { useLocation } from '@umijs/max';
import { useMemo } from 'react';

export const MAP_DISABLE_SEARCH_KEY = 'mapdisable';

export function isMapDisabledBySearch(search?: string | null) {
  const searchParams = new URLSearchParams(search || '');
  return searchParams.get(MAP_DISABLE_SEARCH_KEY) === '1';
}

export function useMapDisabledByRoute() {
  const location = useLocation();

  return useMemo(
    () => isMapDisabledBySearch(location.search),
    [location.search],
  );
}
