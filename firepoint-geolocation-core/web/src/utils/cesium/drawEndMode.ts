export type DrawEndKind =
  | 'point'
  | 'line'
  | 'polygon'
  | 'rectangle'
  | 'circle';

export type EndMode =
  | 'dblclick'
  | 'rightclick'
  | 'enter'
  | 'enter-or-rightclick'
  | 'manual';

export function supportsManualFinish(endMode: EndMode) {
  return ['manual', 'enter', 'enter-or-rightclick'].includes(endMode);
}

export function supportsKeyboardFinish(endMode: EndMode) {
  return ['enter', 'enter-or-rightclick'].includes(endMode);
}

export function shouldFinishOnRightClick(
  kind: DrawEndKind,
  endMode: EndMode,
) {
  if (endMode === 'rightclick') {
    return kind === 'polygon';
  }
  return (
    endMode === 'enter-or-rightclick' &&
    (kind === 'line' || kind === 'polygon')
  );
}
