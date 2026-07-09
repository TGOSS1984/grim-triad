import { describe, it, expect } from 'vitest';
import { pickRandomBackground } from './backgroundUtils';

describe('pickRandomBackground', () => {
  it('returns undefined for an empty pool', () => {
    expect(pickRandomBackground([])).toBeUndefined();
  });

  it('returns the only item when the pool has exactly one', () => {
    expect(pickRandomBackground(['only.jpg'])).toBe('only.jpg');
  });

  it('always returns an item from the pool', () => {
    const pool = ['a.jpg', 'b.jpg', 'c.jpg'];
    for (let i = 0; i < 20; i++) {
      expect(pool).toContain(pickRandomBackground(pool));
    }
  });
});