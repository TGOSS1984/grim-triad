import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  pointsToBudget,
  budgetToSides,
  shapeForUnit,
  deriveCardStats,
} from './statCurve';

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pointsToBudget', () => {
  it('matches the worked examples from ROADMAP.md Section 4.1', () => {
    expect(pointsToBudget(20)).toBe(11);
    expect(pointsToBudget(800)).toBe(37);
  });

  it('produces increasing budgets for increasing points (monotonic)', () => {
    const points = [20, 50, 95, 150, 250, 400, 480, 800];
    const budgets = points.map(pointsToBudget);
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
    }
  });

  it('compresses the long tail: an equal absolute points increase moves the budget more at the low end than the high end', () => {
    const lowDelta = pointsToBudget(100) - pointsToBudget(20);
    const highDelta = pointsToBudget(480) - pointsToBudget(400);
    expect(highDelta).toBeLessThan(lowDelta);
  });

  it('clamps points below the fitted range to the minimum budget', () => {
    expect(pointsToBudget(5)).toBe(11);
  });

  it('clamps points above the fitted range to the maximum budget', () => {
    expect(pointsToBudget(5000)).toBe(37);
  });
});

describe('budgetToSides: basic invariants', () => {
  it('always sums to exactly the requested budget', () => {
    for (const budget of [11, 15, 20, 22, 25, 29, 32, 37]) {
      for (const archetype of ['signature', 'pair', 'balanced'] as const) {
        const stats = budgetToSides(budget, archetype);
        const sum = stats.top + stats.bottom + stats.left + stats.right;
        expect(sum).toBe(budget);
      }
    }
  });

  it('never produces a side below 1 or above 10', () => {
    for (const budget of [11, 15, 20, 22, 25, 29, 32, 37]) {
      for (const archetype of ['signature', 'pair', 'balanced'] as const) {
        const stats = budgetToSides(budget, archetype);
        for (const value of Object.values(stats)) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe('budgetToSides: fairness across sides (the actual bug being fixed)', () => {
  // The original implementation hard-coded specific sides per shape (top
  // for Character, top+bottom for Vehicle, top+left for Beast), so across
  // the whole roster top/bottom were structurally stronger than left/right
  // and right was never favoured by anything - exactly what playtesting
  // surfaced. These tests verify, statistically, that no side is now
  // systematically favoured over any other.

  it('a signature archetype picks each of the 4 sides roughly equally often over many cards', () => {
    const counts: Record<string, number> = { top: 0, bottom: 0, left: 0, right: 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const stats = budgetToSides(24, 'signature');
      const maxVal = Math.max(stats.top, stats.bottom, stats.left, stats.right);
      const winner = SIDES.find((s) => stats[s] === maxVal)!;
      counts[winner]++;
    }
    for (const side of SIDES) {
      const fraction = counts[side] / N;
      // Expect ~25% each; generous tolerance keeps this robust against
      // the inherent randomness while still catching a real bias (e.g.
      // the old bug would have put ~0% on "right").
      expect(fraction).toBeGreaterThan(0.15);
      expect(fraction).toBeLessThan(0.35);
    }
  });

  it('a pair archetype can land on every one of the 6 possible side combinations, including left+right', () => {
    const seenCombos = new Set<string>();
    const N = 1500;
    for (let i = 0; i < N; i++) {
      const stats = budgetToSides(28, 'pair');
      const sorted = [...SIDES].sort((a, b) => stats[b] - stats[a]);
      const topTwo = [sorted[0], sorted[1]].sort().join('+');
      seenCombos.add(topTwo);
    }
    // left+right specifically must be reachable - this exact combo was
    // impossible under the old hard-coded shapes.
    expect(seenCombos.has('left+right')).toBe(true);
  });

  it('top and bottom are not systematically stronger than left and right across many mixed-archetype cards', () => {
    let topBottomTotal = 0;
    let leftRightTotal = 0;
    const N = 3000;
    const archetypes = ['signature', 'pair', 'balanced'] as const;
    for (let i = 0; i < N; i++) {
      const archetype = archetypes[i % archetypes.length];
      const stats = budgetToSides(24, archetype);
      topBottomTotal += stats.top + stats.bottom;
      leftRightTotal += stats.left + stats.right;
    }
    const ratio = topBottomTotal / leftRightTotal;
    // Should be close to 1.0 (no side pairing systematically favoured);
    // generous tolerance for randomness.
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe('budgetToSides: intentional weak sides and spikiness', () => {
  it('a signature archetype can produce a genuinely weak (low) side, not just a mild lean', () => {
    // Over many trials at least one card should have a side at or near
    // the minimum, confirming real risk/reward spikiness rather than the
    // old mild, evenly-cushioned distribution.
    let sawGenuinelyWeakSide = false;
    for (let i = 0; i < 200; i++) {
      const stats = budgetToSides(24, 'signature');
      if (Math.min(stats.top, stats.bottom, stats.left, stats.right) <= 2) {
        sawGenuinelyWeakSide = true;
        break;
      }
    }
    expect(sawGenuinelyWeakSide).toBe(true);
  });
});

describe('budgetToSides: rare double-max bonus at high budgets', () => {
  it('never produces two maxed (10) sides at the minimum budget', () => {
    for (let i = 0; i < 300; i++) {
      const stats = budgetToSides(11, 'signature');
      const maxedCount = SIDES.filter((s) => stats[s] === 10).length;
      expect(maxedCount).toBeLessThanOrEqual(1);
    }
  });

  it('rarely produces two maxed sides at a representative high (but not extreme) budget', () => {
    // Budget 28 (~roughly 250pt-equivalent): the strong side reliably
    // hits 10, but the remaining budget split across 3 sides still has
    // real headroom (~6 average), so a second maxed side happening at all
    // should be attributable to the deliberate rare bonus, not just
    // mathematical inevitability - see the note below on why budget 37
    // isn't a fair test of the bonus specifically.
    let doubleMaxCount = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const stats = budgetToSides(28, 'signature');
      const maxedCount = SIDES.filter((s) => stats[s] === 10).length;
      if (maxedCount >= 2) doubleMaxCount++;
    }
    expect(doubleMaxCount).toBeGreaterThan(0);
    expect(doubleMaxCount).toBeLessThan(N * 0.35);
  });

  it('is common (not a bug) at the absolute budget ceiling, since so little headroom remains for any side to stay low', () => {
    // At budget 37 (out of an absolute max of 40 across 4 sides), simple
    // arithmetic means the weakest possible side is already at least 7 if
    // the other three are maxed - genuine multi-max here is a natural
    // consequence of being this close to the ceiling, not something the
    // "sparingly" design is meant to suppress. In the real dataset only
    // one unit (the 800pt Ork Stompa) ever reaches this budget, so this
    // being common has no broader "every high-cost card looks the same"
    // effect on the roster.
    let doubleMaxCount = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const stats = budgetToSides(37, 'signature');
      const maxedCount = SIDES.filter((s) => stats[s] === 10).length;
      if (maxedCount >= 2) doubleMaxCount++;
    }
    expect(doubleMaxCount).toBeGreaterThan(N * 0.5);
  });
});

describe('shapeForUnit', () => {
  it('favours signature (spiky) for an Epic Hero when the roll lands in that range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // well within character's 0.65 signature odds
    const shape = shapeForUnit({
      battlefieldRole: 'Infantry / Other',
      unitType: 'Infantry',
      keywords: ['Epic Hero', 'Infantry'],
    });
    expect(shape).toBe('signature');
  });

  it('favours pair for a Vehicle when the roll lands in that range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // within vehicle's pair band (0.2-0.85)
    const shape = shapeForUnit({
      battlefieldRole: 'Vehicle / Support',
      unitType: 'Vehicle',
      keywords: [],
    });
    expect(shape).toBe('pair');
  });

  it('defaults plain Infantry toward balanced most of the time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // within default's balanced band (0.45-1.0)
    const shape = shapeForUnit({
      battlefieldRole: 'Battleline',
      unitType: 'Infantry',
      keywords: [],
    });
    expect(shape).toBe('balanced');
  });
});

describe('deriveCardStats', () => {
  it('combines budget and archetype into final stats matching the points curve', () => {
    const result = deriveCardStats({
      points: 190,
      battlefieldRole: 'Character',
      unitType: 'Infantry',
      keywords: ['Epic Hero'],
    });
    expect(result.statBudget).toBe(pointsToBudget(190));
    const sum = result.stats.top + result.stats.bottom + result.stats.left + result.stats.right;
    expect(sum).toBe(result.statBudget);
  });

  it('accepts an injectable rng for fully deterministic output', () => {
    const fixedRng = () => 0.5;
    const a = deriveCardStats({ points: 100, battlefieldRole: 'Infantry', unitType: 'Infantry', keywords: [] }, fixedRng);
    const b = deriveCardStats({ points: 100, battlefieldRole: 'Infantry', unitType: 'Infantry', keywords: [] }, fixedRng);
    expect(a).toEqual(b);
  });
});