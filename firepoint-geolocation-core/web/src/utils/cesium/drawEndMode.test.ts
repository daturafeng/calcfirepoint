import { describe, expect, it } from 'vitest';

import {
  shouldFinishOnRightClick,
  supportsKeyboardFinish,
  supportsManualFinish,
} from './drawEndMode';

describe('地图绘制结束模式', () => {
  it('仅在显式模式下允许折线和多边形右键完成', () => {
    expect(shouldFinishOnRightClick('line', 'enter-or-rightclick')).toBe(
      true,
    );
    expect(shouldFinishOnRightClick('polygon', 'enter-or-rightclick')).toBe(
      true,
    );
    expect(shouldFinishOnRightClick('line', 'enter')).toBe(false);
    expect(shouldFinishOnRightClick('rectangle', 'enter-or-rightclick')).toBe(
      false,
    );
  });

  it('显式模式仍保留 Enter 完成与手动完成能力', () => {
    expect(supportsKeyboardFinish('enter-or-rightclick')).toBe(true);
    expect(supportsManualFinish('enter-or-rightclick')).toBe(true);
  });
});
