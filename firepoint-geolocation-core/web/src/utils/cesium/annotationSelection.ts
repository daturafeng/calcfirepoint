const ANNOTATION_OVERLAY_ENTITY_ID =
  /^(?:route-overlay|polygon-overlay|geometry-circle)-(.+?)(?:-outline)?$/;

/** 从已完成标注覆盖物的 Cesium 实体 id 中解析业务标注 id。 */
export function resolveAnnotationOverlayId(entityId?: string) {
  if (!entityId) return undefined;
  return entityId.match(ANNOTATION_OVERLAY_ENTITY_ID)?.[1];
}
