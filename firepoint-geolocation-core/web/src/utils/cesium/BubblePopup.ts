export type BubblePopupMode = 'single' | 'multiple';

export type BubblePopupVisibility = {
  /** 相机高度下限（米），小于该值隐藏 */
  minCameraHeight?: number;
  /** 相机高度上限（米），大于该值隐藏 */
  maxCameraHeight?: number;
};

export type BubblePopupScaleWithCamera = {
  /** 默认开启；显式传 false 则不启用缩放 */
  enabled?: boolean;
  /** 超过 farHeight 时隐藏（display:none） */
  hideWhenFar?: boolean;
  /** 最近时的缩放下限（最小缩放倍数） */
  minScale?: number;
  /** 最近时的缩放上限（最大缩放倍数） */
  maxScale?: number;
  /** 近距离阈值（相机高度，米）：高度 <= nearHeight 时采用 maxScale */
  nearHeight?: number;
  /** 远距离阈值（相机高度，米）：高度 >= farHeight 时采用 minScale */
  farHeight?: number;
};

export type BubblePopupPlacement = 'top_center' | 'bottom_center';

export type BubblePopupOffsetPx = {
  x?: number;
  y?: number;
};

export type LngLatHeightLike = {
  lon: number | string;
  lat: number | string;
  alt?: number | string;
  height?: number | string;
  // 兼容历史字段
  het?: number | string;
};

type Cartesian3Like = object;
type Cartesian2Like = object;
type WindowCoordinates = { x: number; y: number };
type CesiumPickedLike = unknown;
type UnknownRecord = Record<string, unknown>;
type BivariantMethod<Args extends unknown[], ReturnValue> = {
  bivarianceHack(...args: Args): ReturnValue;
}['bivarianceHack'];

type CesiumLike = {
  Cartesian3: {
    new (...args: unknown[]): Cartesian3Like;
    fromDegrees: (lon: number, lat: number, height?: number) => Cartesian3Like;
    distance: (left: Cartesian3Like, right: Cartesian3Like) => number;
  };
  Cartesian2: new () => Cartesian2Like;
  ScreenSpaceEventHandler: new (canvas: unknown) => {
    setInputAction: (
      cb: (movement: { position: unknown }) => void,
      type: unknown,
    ) => void;
    destroy: () => void;
  };
  ScreenSpaceEventType: {
    LEFT_CLICK: unknown;
    RIGHT_CLICK: unknown;
  };
  SceneTransforms?: {
    wgs84ToWindowCoordinates?: (
      scene: unknown,
      position: Cartesian3Like,
    ) => WindowCoordinates | null;
  };
  createGuid?: () => string;
};

type CesiumEntityLike = {
  id?: unknown;
  position?: unknown;
};

type CesiumViewerLike = {
  clock: { currentTime: unknown };
  camera: {
    position: Cartesian3Like;
    positionCartographic?: { height: number };
  };
  entities: {
    getById: (id: string) => CesiumEntityLike | null | undefined;
  };
  scene: {
    canvas: unknown;
    pick: BivariantMethod<
      [position: unknown, width?: number, height?: number],
      CesiumPickedLike
    >;
    postRender: {
      addEventListener: (cb: () => void) => () => void;
    };
    globe: {
      ellipsoid: {
        cartesianToCartographic: BivariantMethod<
          [position: Cartesian3Like],
          { height: number }
        >;
        maximumRadius: number;
      };
    };
    cartesianToCanvasCoordinates?: unknown;
  };
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isLngLatHeightLike(value: unknown): value is LngLatHeightLike {
  return (
    isRecord(value) &&
    'lon' in value &&
    'lat' in value &&
    (typeof value.lon === 'number' || typeof value.lon === 'string') &&
    (typeof value.lat === 'number' || typeof value.lat === 'string')
  );
}

function isCesiumEntityLike(value: unknown): value is CesiumEntityLike {
  return isRecord(value) && ('id' in value || 'position' in value);
}

function isCartesianToCanvasCoordinates(
  value: unknown,
): value is (
  position: Cartesian3Like,
  result: Cartesian2Like,
) => WindowCoordinates | null {
  return typeof value === 'function';
}

function isPositionValueGetter(
  value: unknown,
): value is { getValue: (time: unknown) => unknown } {
  return isRecord(value) && typeof value.getValue === 'function';
}

function getPositionValue(
  position: unknown,
  time: unknown,
): Cartesian3Like | null {
  if (!isPositionValueGetter(position)) {
    return null;
  }
  const value = position.getValue(time);
  return isRecord(value) ? value : null;
}

export type BubblePopupCtorArgs = {
  viewer: CesiumViewerLike;
  Cesium: CesiumLike;
  popupMode?: BubblePopupMode;
  /** 弹窗挂载容器：HTMLElement 或选择器（默认 '#cesiumContainer'） */
  container?: HTMLElement | string;
};

export type BubblePopupBaseOpenParams = {
  id: string;
  boxId?: string | number;
  wrapperClassName?: string;
  title?: string;
  content?: string;
  contentDom?: string | HTMLElement;
  closeClassName?: string;
  onClose?: () => void;
  /** 根据相机高度控制弹窗显隐 */
  visibility?: BubblePopupVisibility;
  /** 远小近大：随相机高度缩放弹窗（仅视觉缩放） */
  scaleWithCamera?: BubblePopupScaleWithCamera;
  /** 弹窗相对点位的位置（默认 bottom_center：尖角在底部，对准点位） */
  placement?: BubblePopupPlacement;
  /** 像素偏移：以点位锚点为基准微调 */
  offsetPx?: BubblePopupOffsetPx;
};

export type BubblePopupOpenAtPositionParams = BubblePopupBaseOpenParams & {
  position: LngLatHeightLike | Cartesian3Like;
};

export type BubblePopupOpenForEntityParams = BubblePopupBaseOpenParams & {
  entity: CesiumEntityLike;
};

export type BubblePopupEnableEntityClickPopupParams = {
  targetId?: string | number;
  title?: string;
  closeClassName?: string;
  idBuilder?: (entity: CesiumEntityLike) => string;
  content?: string | ((entity: CesiumEntityLike) => string);
};

export type BubblePopupUpdateContentParams = {
  id: string;
  content?: string;
  contentDom?: string | HTMLElement;
  closeClassName?: string;
  onClose?: () => void;
  visibility?: BubblePopupVisibility;
  scaleWithCamera?: BubblePopupScaleWithCamera;
  placement?: BubblePopupPlacement;
  offsetPx?: BubblePopupOffsetPx;
};

type PopupRecord = {
  wrapper: HTMLDivElement;
  element: HTMLDivElement;
  removePostRender: () => void;
  state: {
    visibility?: BubblePopupVisibility;
    scaleWithCamera?: BubblePopupScaleWithCamera;
    placement: BubblePopupPlacement;
    offsetPx?: BubblePopupOffsetPx;
  };
};

type PopupContentElement = HTMLElement & {
  __dockUnmount__?: () => void;
};

export class BubblePopup {
  private viewer: CesiumViewerLike;
  private Cesium: CesiumLike;
  private popups: Map<string, PopupRecord>;
  private pickHandler: null | { destroy: () => void };
  private popupMode: BubblePopupMode;
  private container: HTMLElement | string;

  constructor(arg: BubblePopupCtorArgs) {
    this.viewer = arg.viewer;
    this.Cesium = arg.Cesium;
    this.popups = new Map(); // id -> { element, removePostRender }
    this.pickHandler = null;
    // 弹窗模式：single | multiple（默认 multiple）
    this.popupMode = arg?.popupMode === 'single' ? 'single' : 'multiple';
    this.container = arg.container ?? '#cesiumContainer';
  }

  private _query(selector: string) {
    return window.document.querySelector(selector);
  }

  private _resolveContainerElement(): HTMLElement | null {
    const c = this.container;
    if (!c) return null;
    if (typeof c === 'string') {
      return (this._query(c) as HTMLElement | null) ?? null;
    }
    return c;
  }

  private _ensureRelativeContainer(container: HTMLElement) {
    const style = window.getComputedStyle(container);
    if (style.position === 'static' || !style.position) {
      container.style.position = 'relative';
    }
  }

  private _getEntityPosition(entity: CesiumEntityLike): Cartesian3Like | null {
    if (!entity?.position) return null;
    try {
      const position = entity.position;
      const value = getPositionValue(position, this.viewer.clock.currentTime);
      if (value) {
        return value;
      }
    } catch (_) {
      // ignore
    }
    return isRecord(entity.position) ? entity.position : null;
  }

  private _toCartesian(
    position: BubblePopupOpenAtPositionParams['position'] | null | undefined,
  ): Cartesian3Like | null {
    const Cesium = this.Cesium;
    if (!position) return null;
    if (position instanceof Cesium.Cartesian3) return position;

    if (!isLngLatHeightLike(position)) return null;
    const lon = Number(position.lon);
    const lat = Number(position.lat);
    const alt = Number(position.alt ?? position.height ?? position.het) || 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  }

  private _resolvePickedEntity(
    picked: CesiumPickedLike,
  ): CesiumEntityLike | null {
    if (!picked) return null;
    if (!isRecord(picked)) return null;
    const primitive = isRecord(picked.primitive) ? picked.primitive : null;
    const candidate = picked.id ?? primitive?.id ?? null;
    if (!candidate) return null;

    if (isCesiumEntityLike(candidate) && candidate.position) return candidate;

    if (isCesiumEntityLike(candidate) && typeof candidate.id === 'string') {
      const wrapped = this.viewer.entities.getById(candidate.id);
      if (wrapped) return wrapped;
    }

    if (typeof candidate === 'string') {
      return this.viewer.entities.getById(candidate) || null;
    }

    return null;
  }

  private _buildPopupElement(params: BubblePopupBaseOpenParams) {
    const id = params.id;
    const wrapper = document.createElement('div');
    wrapper.className = `${id}-popup3d-box popup3d-box ${
      params.wrapperClassName || ''
    }`.trim();
    wrapper.dataset.popupId = String(id);
    wrapper.id = params.boxId ? String(params.boxId) : `popup3d-box-${id}`;
    this._setPopupContent(wrapper, params.content, params.contentDom);
    return wrapper;
  }

  private _cleanupPopupContent(wrapper: HTMLDivElement) {
    const children = Array.from(wrapper.children) as PopupContentElement[];
    children.forEach((child) => {
      if (typeof child.__dockUnmount__ === 'function') {
        child.__dockUnmount__();
        delete child.__dockUnmount__;
      }
    });
    wrapper.innerHTML = '';
  }

  private _setPopupContent(
    wrapper: HTMLDivElement,
    content?: string,
    contentDom?: string | HTMLElement,
  ) {
    if (!wrapper) return;

    // 外部内容完全接管：DOM 优先，其次字符串
    if (contentDom instanceof HTMLElement) {
      if (contentDom.parentElement === wrapper) {
        return;
      }
      this._cleanupPopupContent(wrapper);
      wrapper.appendChild(contentDom);
      return;
    }
    this._cleanupPopupContent(wrapper);
    if (typeof contentDom === 'string') {
      const domNode = document.createElement('div');
      domNode.innerHTML = contentDom;
      wrapper.appendChild(domNode);
      return;
    }

    const node = document.createElement('div');
    node.innerHTML = content || '';
    wrapper.appendChild(node);
  }

  private _setPopupScreenPosition(
    popupEl: HTMLDivElement,
    winPos: { x: number; y: number },
    containerEl: HTMLElement | null,
  ) {
    if (!popupEl || !winPos) return;
    if (containerEl) {
      this._ensureRelativeContainer(containerEl);
      popupEl.style.position = 'absolute';
      popupEl.style.left = `${winPos.x}px`;
      popupEl.style.top = `${winPos.y}px`;
      return;
    }
    // fallback：无法确定容器时，用视口坐标系
    popupEl.style.position = 'fixed';
    popupEl.style.left = `${winPos.x}px`;
    popupEl.style.top = `${winPos.y}px`;
  }

  private _toClassSelector(className?: string) {
    if (typeof className !== 'string') return '.popup3d-close';
    const normalized = className.replace(/\./g, ' ').trim();
    if (!normalized) return '.popup3d-close';
    const classList = normalized.split(/\s+/).filter(Boolean);
    if (!classList.length) return '.popup3d-close';
    return `.${classList.join('.')}`;
  }

  private _bindCloseAction(
    popupEl: HTMLDivElement,
    id: string,
    closeClassName?: string,
    onClose?: () => void,
  ) {
    const closeSelector = this._toClassSelector(closeClassName);
    const closeEl = (popupEl.querySelector(closeSelector) ||
      popupEl.querySelector('.popup3d-close')) as HTMLElement | null;
    const stopPointerPropagation = (event: PointerEvent) => {
      event.stopPropagation();
    };
    if (closeEl) {
      closeEl.onpointerdown = stopPointerPropagation;
      closeEl.onpointerup = stopPointerPropagation;
      closeEl.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          onClose?.();
        } finally {
          // 无论外部状态回调是否报错，都必须移除当前标牌，避免残留在地图上。
          this.close(id);
        }
        return false;
      };
    }
    // 事件委托兜底：关闭按钮由 React 等异步渲染，直接绑定时机可能早于内容挂载，
    // 或按钮 DOM 在后续重渲染中被替换导致 onclick 丢失。委托不依赖按钮的存活状态。
    // 直接绑定成功时 onclick 已 stopPropagation，点击不会冒泡到这里，因此不会重复关闭。
    if (!popupEl.dataset.dockCloseDelegateBound) {
      popupEl.dataset.dockCloseDelegateBound = '1';
      popupEl.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
          return;
        }
        if (
          !target.closest?.(closeSelector) &&
          !target.closest?.('.popup3d-close')
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
          onClose?.();
        } finally {
          this.close(id);
        }
      });
    }
  }

  private _toCanvasPosition(
    cartesian: Cartesian3Like,
  ): { x: number; y: number } | null {
    if (!cartesian) return null;

    const Cesium = this.Cesium;
    const scene = this.viewer.scene;
    if (!scene) return null;

    if (isCartesianToCanvasCoordinates(scene.cartesianToCanvasCoordinates)) {
      return scene.cartesianToCanvasCoordinates(
        cartesian,
        new Cesium.Cartesian2(),
      );
    }

    if (
      Cesium.SceneTransforms &&
      typeof Cesium.SceneTransforms.wgs84ToWindowCoordinates === 'function'
    ) {
      return Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, cartesian);
    }

    return null;
  }

  private _openWithPositionGetter(
    params: BubblePopupBaseOpenParams & {
      getCartesian: () => Cartesian3Like | null;
    },
  ) {
    const id = params?.id;
    if (!id || typeof params.getCartesian !== 'function') return;

    if (this.popupMode === 'single') {
      this.clear();
    }
    this.close(id);

    const wrapper = this._buildPopupElement(params);
    const container = this._resolveContainerElement();
    if (!container) return;
    this._ensureRelativeContainer(container);
    container.appendChild(wrapper);

    const popupEl = wrapper;
    if (!popupEl) return;

    const Cesium = this.Cesium;
    const viewer = this.viewer;
    const state: PopupRecord['state'] = {
      visibility: params.visibility,
      scaleWithCamera: params.scaleWithCamera,
      placement: params.placement || 'bottom_center',
      offsetPx: params.offsetPx,
    };

    let lastWinPos: { x: number; y: number } | null = null;
    const removePostRender = viewer.scene.postRender.addEventListener(() => {
      const cartesian = params.getCartesian();
      if (!cartesian) {
        popupEl.style.display = 'none';
        return;
      }

      const camera = viewer.camera.position;
      const cameraHeight =
        viewer.camera.positionCartographic?.height ??
        viewer.scene.globe.ellipsoid.cartesianToCartographic(camera).height;
      let maxDistance = cameraHeight;
      maxDistance += viewer.scene.globe.ellipsoid.maximumRadius;

      const visibility = state.visibility;
      if (
        visibility &&
        ((visibility.minCameraHeight !== null &&
          visibility.minCameraHeight !== undefined) ||
          (visibility.maxCameraHeight !== null &&
            visibility.maxCameraHeight !== undefined))
      ) {
        const minH = visibility.minCameraHeight;
        const maxH = visibility.maxCameraHeight;
        if (
          (minH !== null && minH !== undefined && cameraHeight < minH) ||
          (maxH !== null && maxH !== undefined && cameraHeight > maxH)
        ) {
          popupEl.style.display = 'none';
          return;
        }
      }

      const scaleCfg = state.scaleWithCamera;
      // 默认由 CSS 变量接管缩放，避免覆盖定位 transform
      popupEl.style.setProperty('--dock-bubble-scale', '1');
      if (scaleCfg && scaleCfg.enabled !== false) {
        const nearH = Number(scaleCfg.nearHeight);
        const farH = Number(scaleCfg.farHeight);
        const minS = Number(scaleCfg.minScale);
        const maxS = Number(scaleCfg.maxScale);
        if (
          scaleCfg.hideWhenFar === true &&
          Number.isFinite(farH) &&
          cameraHeight > farH
        ) {
          popupEl.style.display = 'none';
          return;
        }
        if (Number.isFinite(nearH) && Number.isFinite(farH) && farH > nearH) {
          const lo = Number.isFinite(minS) && minS > 0 ? minS : 0.6;
          const hi = Number.isFinite(maxS) && maxS > 0 ? maxS : 1.2;
          const minScale = Math.min(lo, hi);
          const maxScale = Math.max(lo, hi);

          const t = Math.min(
            1,
            Math.max(0, (cameraHeight - nearH) / (farH - nearH)),
          );
          const scale = maxScale + (minScale - maxScale) * t;
          popupEl.style.setProperty('--dock-bubble-scale', String(scale));
        }
      }

      if (Cesium.Cartesian3.distance(camera, cartesian) > maxDistance) {
        popupEl.style.display = 'none';
        return;
      }

      const winPos = this._toCanvasPosition(cartesian);
      if (!winPos) {
        popupEl.style.display = 'none';
        return;
      }

      const placement: BubblePopupPlacement =
        state.placement || 'bottom_center';
      popupEl.dataset.placement = placement;
      const offset = state.offsetPx || {};
      const offsetX = Number(offset.x) || 0;
      const offsetY = Number(offset.y) || 0;
      // 以点位为锚点（left/top 指向锚点），通过 translate 让三角尖角对准锚点
      this._setPopupScreenPosition(
        popupEl,
        { x: winPos.x + offsetX, y: winPos.y + offsetY },
        container,
      );

      popupEl.style.display = 'block';
      if (
        !lastWinPos ||
        lastWinPos.x !== winPos.x ||
        lastWinPos.y !== winPos.y
      ) {
        lastWinPos = winPos;
      }
    });

    this._bindCloseAction(popupEl, id, params.closeClassName, params.onClose);

    this.popups.set(id, {
      wrapper,
      element: popupEl,
      removePostRender,
      state,
    });
  }

  // 通过经纬高打开弹窗
  openAtPosition(params: BubblePopupOpenAtPositionParams) {
    if (!params?.id) return;
    const cartesian = this._toCartesian(params.position);
    if (!cartesian) return;
    this._openWithPositionGetter({
      id: params.id,
      boxId: params.boxId,
      wrapperClassName: params.wrapperClassName,
      title: params.title,
      content: params.content,
      contentDom: params.contentDom,
      closeClassName: params.closeClassName,
      visibility: params.visibility,
      scaleWithCamera: params.scaleWithCamera,
      placement: params.placement,
      offsetPx: params.offsetPx,
      getCartesian: () => cartesian,
    });
  }

  // 绑定实体（动态位置）弹窗
  openForEntity(params: BubblePopupOpenForEntityParams) {
    if (!params?.id || !params?.entity) return;
    this._openWithPositionGetter({
      id: params.id,
      boxId: params.boxId,
      wrapperClassName: params.wrapperClassName,
      title: params.title,
      content: params.content,
      contentDom: params.contentDom,
      closeClassName: params.closeClassName,
      visibility: params.visibility,
      scaleWithCamera: params.scaleWithCamera,
      placement: params.placement,
      offsetPx: params.offsetPx,
      getCartesian: () => this._getEntityPosition(params.entity),
    });
  }

  // 开启点击实体弹窗
  enableEntityClickPopup(params: BubblePopupEnableEntityClickPopupParams = {}) {
    const Cesium = this.Cesium;
    const viewer = this.viewer;
    this.disableEntityClickPopup();

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.pickHandler = handler;

    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (!picked) return;

      const entity = this._resolvePickedEntity(picked);
      if (!entity) return;

      const targetId = params.targetId;
      if (targetId && String(entity.id) !== String(targetId)) return;

      const popupId =
        typeof params.idBuilder === 'function'
          ? params.idBuilder(entity)
          : `entity_${
              entity.id ||
              (Cesium.createGuid ? Cesium.createGuid() : String(Date.now()))
            }`;

      const content =
        typeof params.content === 'function'
          ? params.content(entity)
          : params.content || '这是一个内容';

      this.openForEntity({
        id: popupId,
        entity,
        title: params.title,
        content,
        closeClassName: params.closeClassName,
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      this.disableEntityClickPopup();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  // 更新弹窗内容
  updateContent(params: BubblePopupUpdateContentParams) {
    if (!params?.id) return;
    const record = this.popups.get(params.id);
    if (!record?.wrapper) return;
    if (params.contentDom !== undefined || params.content !== undefined) {
      this._setPopupContent(
        record.wrapper,
        params.content || '',
        params.contentDom,
      );
      this._bindCloseAction(
        record.wrapper,
        params.id,
        params.closeClassName,
        params.onClose,
      );
    }
    if (params.visibility !== undefined)
      record.state.visibility = params.visibility;
    if (params.scaleWithCamera !== undefined)
      record.state.scaleWithCamera = params.scaleWithCamera;
    if (params.placement) record.state.placement = params.placement;
    if (params.offsetPx !== undefined) record.state.offsetPx = params.offsetPx;
  }

  has(id: string) {
    return this.popups.has(id);
  }

  // 关闭指定弹窗
  close(id: string) {
    if (!id) return;
    let popupIdToClose = id;
    let record = this.popups.get(id);
    if (!record) {
      for (const [popupId, item] of this.popups.entries()) {
        if (item?.wrapper?.id === String(id)) {
          record = item;
          popupIdToClose = popupId;
          break;
        }
      }
    }
    if (!record) return;
    if (typeof record.removePostRender === 'function')
      record.removePostRender();
    this._cleanupPopupContent(record.wrapper);
    if (record.wrapper?.parentNode) {
      record.wrapper.parentNode.removeChild(record.wrapper);
    } else if (record.element?.parentNode) {
      record.element.parentNode.removeChild(record.element);
    }
    this.popups.delete(popupIdToClose);
  }

  // 清空所有弹窗
  clear() {
    const ids = Array.from(this.popups.keys());
    for (let i = 0; i < ids.length; i++) {
      this.close(ids[i]);
    }
  }

  // 关闭点击拾取
  disableEntityClickPopup() {
    if (this.pickHandler) {
      this.pickHandler.destroy();
      this.pickHandler = null;
    }
  }

  // 销毁
  destroy() {
    this.clear();
    this.disableEntityClickPopup();
  }
}
