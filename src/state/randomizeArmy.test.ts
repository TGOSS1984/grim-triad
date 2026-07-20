import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomizeArmySelection } from './randomizeArmy';
import type { RandomizableUnit } from './randomizeArmy';

function makeUnits(count: number, pointsEach = 100): RandomizableUnit[] {
  return Array.from({ length: count }, (_, i) => ({ id: `unit-${i}`, points: pointsEach }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('randomizeArmySelection - exact size target', () => {
  it('returns exactly the requested count when feasible', () => {
    const units = makeUnits(20, 100);
    const result = randomizeArmySelection(units, 1000, { exact: 10 });
    expect(result).toHaveLength(10);
  });

  it('never exceeds the points cap', () => {
    const units = makeUnits(20, 100);
    const result = randomizeArmySelection(units, 1000, { exact: 10 });
    const spent = result.reduce((sum, id) => sum + (units.find((u) => u.id === id)?.points ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(1000);
  });

  it('never selects the same unit twice', () => {
    const units = makeUnits(20, 100);
    const result = randomizeArmySelection(units, 1000, { exact: 10 });
    expect(new Set(result).size).toBe(result.length);
  });

  it('produces different results across calls (genuinely random, not deterministic)', () => {
    const units = makeUnits(30, 50);
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(randomizeArmySelection(units, 1000, { exact: 10 }).sort().join(','));
    }
    // Not asserting a specific count (randomness could coincidentally
    // repeat), just that it isn't ALWAYS the exact same result.
    expect(results.size).toBeGreaterThan(1);
  });

  it('always reaches the exact count while respecting the cap, even in a tight scenario where most shuffle orders would fail (relies on either a lucky shuffle or the deterministic fallback)', () => {
    // One very expensive unit plus exactly enough cheap ones to hit the
    // cap precisely - the expensive unit can never coexist with all 10
    // cheap ones under this cap. Whether a lucky shuffle happens to place
    // it last (after the 10 cheap units already filled the target) or
    // every one of the 100 random attempts fails and the deterministic
    // cheapest-first fallback kicks in, the OUTCOME must be the same
    // either way - this asserts that outcome, not which path produced it.
    const units = [{ id: 'expensive', points: 901 }, ...makeUnits(10, 100)];
    const result = randomizeArmySelection(units, 1000, { exact: 10 });
    expect(result).toHaveLength(10);
    expect(result).not.toContain('expensive');
  });

  it('returns whatever the deterministic fallback can manage when the target is genuinely infeasible, without throwing', () => {
    const units = makeUnits(5, 100); // only 5 units exist at all
    const result = randomizeArmySelection(units, 1000, { exact: 10 }); // asking for 10
    // Can't possibly reach 10 - the deterministic fallback returns
    // whatever it could fit (all 5), not a partial/random guess.
    expect(result).toHaveLength(5);
  });

  it('respects isBlocked - never includes a unit the predicate vetoes', () => {
    const units = makeUnits(20, 100);
    const result = randomizeArmySelection(units, 1000, { exact: 10 }, (id) => id === 'unit-0');
    expect(result).not.toContain('unit-0');
    expect(result).toHaveLength(10); // still reaches the target using the other 19 units
  });

  it('isBlocked receives the selection built so far, not just the candidate id (supports stateful caps like a power-unit limit)', () => {
    const units = makeUnits(20, 100);
    const blockedIds: string[] = [];
    // Block anything once 3 units are already selected - simulates a cap.
    randomizeArmySelection(units, 1000, { exact: 10 }, (id, current) => {
      if (current.length >= 3) {
        blockedIds.push(id);
        return true;
      }
      return false;
    });
    expect(blockedIds.length).toBeGreaterThan(0);
  });
});

describe('randomizeArmySelection - open-ended (atLeast) target', () => {
  it('spends as much of the cap as reasonably fits, not just the bare minimum', () => {
    const units = makeUnits(30, 50); // 30 units at 50pts each = 1500 total possible
    const result = randomizeArmySelection(units, 1000, { atLeast: 5 });
    // Should fit close to the full cap (1000 / 50 = 20 units), not just 5.
    expect(result.length).toBeGreaterThan(5);
  });

  it('never exceeds the points cap', () => {
    const units = makeUnits(30, 50);
    const result = randomizeArmySelection(units, 1000, { atLeast: 5 });
    const spent = result.reduce((sum, id) => sum + (units.find((u) => u.id === id)?.points ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(1000);
  });

  it('falls back to cheapest-first if a random shuffle order fails to reach the minimum', () => {
    const units = [{ id: 'cheap', points: 50 }, { id: 'expensive', points: 5000 }];
    const result = randomizeArmySelection(units, 100, { atLeast: 1 });
    expect(result).toContain('cheap');
    expect(result).not.toContain('expensive');
  });

  it('respects isBlocked for the open-ended case too', () => {
    const units = makeUnits(10, 100);
    const result = randomizeArmySelection(units, 1000, { atLeast: 1 }, (id) => id === 'unit-0');
    expect(result).not.toContain('unit-0');
  });
});

describe('randomizeArmySelection - edge cases', () => {
  it('returns an empty array when no units are available at all', () => {
    expect(randomizeArmySelection([], 1000, { atLeast: 5 })).toEqual([]);
    expect(randomizeArmySelection([], 1000, { exact: 5 })).toEqual([]);
  });

  it('returns an empty array when the points cap is too low to afford anything', () => {
    const units = makeUnits(5, 500);
    expect(randomizeArmySelection(units, 10, { atLeast: 1 })).toEqual([]);
  });
});