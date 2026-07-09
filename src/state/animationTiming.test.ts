import { describe, it, expect } from 'vitest';
import {
  computeMoveAnimationDurationMs,
  CAPTURE_FLIP_DURATION_MS,
  CAPTURE_FLIP_STAGGER_MS,
  MOVE_SETTLE_BUFFER_MS,
} from './animationTiming';

describe('computeMoveAnimationDurationMs', () => {
  it('returns just the settle buffer for a move that captured nothing', () => {
    expect(computeMoveAnimationDurationMs(0)).toBe(MOVE_SETTLE_BUFFER_MS);
  });

  it('returns buffer + one full flip duration for a single-card capture', () => {
    expect(computeMoveAnimationDurationMs(1)).toBe(
      MOVE_SETTLE_BUFFER_MS + CAPTURE_FLIP_DURATION_MS,
    );
  });

  it('accounts for stagger delay on the last card in a multi-card combo', () => {
    // 3 cards: the 3rd card doesn't start flipping until 2 stagger
    // intervals have elapsed, then takes its own full flip duration.
    const expected = MOVE_SETTLE_BUFFER_MS + 2 * CAPTURE_FLIP_STAGGER_MS + CAPTURE_FLIP_DURATION_MS;
    expect(computeMoveAnimationDurationMs(3)).toBe(expected);
  });

  it('increases monotonically with capture count', () => {
    const durations = [0, 1, 2, 3, 4].map(computeMoveAnimationDurationMs);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThan(durations[i - 1]);
    }
  });
});