import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildRandomAIRoster,
  unitIdsToHand,
  _resetInstanceCounterForTests,
} from './matchSetup';
import { getUnitById } from '../data/activeFactions';

beforeEach(() => {
  _resetInstanceCounterForTests();
});

describe('buildRandomAIRoster', () => {
  it('produces at least the minimum army size within a 500pt cap', () => {
    const roster = buildRandomAIRoster(500);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('produces at least the minimum army size within a 1000pt cap', () => {
    const roster = buildRandomAIRoster(1000);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('produces at least the minimum army size within a 2000pt cap', () => {
    const roster = buildRandomAIRoster(2000);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('never exceeds the given points cap', () => {
    const roster = buildRandomAIRoster(500);
    const totalPoints = roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
    expect(totalPoints).toBeLessThanOrEqual(500);
  });

  it('every returned unit id resolves to a real unit', () => {
    const roster = buildRandomAIRoster(1000);
    for (const id of roster) {
      expect(getUnitById(id)).toBeDefined();
    }
  });

  it('respects a custom minUnits threshold', () => {
    const roster = buildRandomAIRoster(2000, 10);
    expect(roster.length).toBeGreaterThanOrEqual(10);
  });

  it('reliably builds a 25-unit series pool within 2000 points (regression: real crash found in play)', () => {
    // This exact combination (2000pts, 25 units) threw "Could not build an
    // AI roster of at least 25 units within 2000 points" before the fix -
    // random-order greedy fill is only budget-efficient by chance, and for
    // a roster averaging ~120pts/unit it essentially never reaches 25
    // units in a 2000pt budget (confirmed empirically: 100% failure rate
    // across 500 trials). Run many times since the faction/shuffle order
    // is randomized each call - the fix must hold up consistently, not
    // just on a lucky roll.
    for (let i = 0; i < 30; i++) {
      const roster = buildRandomAIRoster(2000, 25);
      expect(roster.length).toBeGreaterThanOrEqual(25);
    }
  });

  it('reliably builds larger series pools up to the real achievable ceiling (27 units at 2000pts)', () => {
    for (let i = 0; i < 10; i++) {
      const roster = buildRandomAIRoster(2000, 27);
      expect(roster.length).toBeGreaterThanOrEqual(27);
    }
  });

  it('throws a clear, catchable error for a realistic infeasible combination (large pool, low points cap)', () => {
    // Real data ceiling: 500pts can never field more than 10 units
    // (confirmed empirically), so a 25-card pool at 500pts is a genuine
    // combination a user could reach through completely normal UI
    // interaction (pool size and points cap are chosen in separate
    // steps) - not a contrived edge case. App.tsx must catch this rather
    // than let it crash (see the try/catch around this call).
    expect(() => buildRandomAIRoster(500, 25)).toThrow(
      'Could not build an AI roster of at least 25 units within 500 points',
    );
  });

  it("with strategy 'greedy', still produces at least the minimum army size", () => {
    const roster = buildRandomAIRoster(500, 5, 'greedy');
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it("with strategy 'greedy', never exceeds the given points cap", () => {
    const roster = buildRandomAIRoster(1000, 5, 'greedy');
    const totalPoints = roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
    expect(totalPoints).toBeLessThanOrEqual(1000);
  });

  it("with strategy 'greedy', falls back to the balanced two-pass and still reaches minUnits even when a pure most-expensive-first fill can't", () => {
    // A high minUnits target at a modest cap is exactly the case where a
    // few-strongest-units fill runs out of room before reaching minUnits -
    // the balanced fallback must still kick in rather than throwing.
    for (let i = 0; i < 10; i++) {
      const roster = buildRandomAIRoster(2000, 25, 'greedy');
      expect(roster.length).toBeGreaterThanOrEqual(25);
    }
  });

  it("with strategy 'greedy', tends toward a higher average points-per-unit than 'balanced' (Hard should field stronger units)", () => {
    // Statistical, not exact - average over many trials of each to avoid
    // flakiness from any single faction/shuffle roll. Uses a 2000pt cap
    // (itself a real points-cap option, not test-only) rather than 1000:
    // at 1000pts, greedy's advantage gets diluted away almost entirely
    // for Space Marine chapter rosters specifically, since those rosters
    // now include the large shared generic-unit pool (see
    // activeFactions.ts's getUnitsForRoster) and a 1000pt budget doesn't
    // leave room for greedy to pick more than 1-2 genuinely expensive
    // units before needing cheap filler to reach minUnits, converging
    // toward roughly the same average as balanced. At 2000pts there's
    // enough headroom for greedy's advantage to show clearly and
    // consistently (empirically ~115 vs ~245 avg points/unit).
    function averagePointsPerUnit(strategy: 'balanced' | 'greedy'): number {
      let totalPoints = 0;
      let totalUnits = 0;
      for (let i = 0; i < 150; i++) {
        const roster = buildRandomAIRoster(2000, 5, strategy);
        totalPoints += roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
        totalUnits += roster.length;
      }
      return totalPoints / totalUnits;
    }

    expect(averagePointsPerUnit('greedy')).toBeGreaterThan(averagePointsPerUnit('balanced'));
  });
});

describe('unitIdsToHand', () => {
  it('produces exactly handSize cards when the roster is larger', () => {
    const roster = buildRandomAIRoster(2000); // typically well over 5 units
    const hand = unitIdsToHand(roster, 'blue', 5);
    expect(hand).toHaveLength(5);
  });

  it('uses the whole roster if it is smaller than handSize', () => {
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain', 'necrons-lychguard'], 'red', 5);
    expect(hand).toHaveLength(2);
  });

  it('assigns the given owner to every card', () => {
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'red', 1);
    expect(hand[0].owner).toBe('red');
  });

  it("copies each unit's real stats onto the card", () => {
    const unit = getUnitById('blood-angels-blood-angels-captain')!;
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1);
    expect(hand[0].stats).toEqual(unit.stats);
  });

  it("copies each unit's real keywords onto the card, for keyword-gated rules (Psyker/Epic Hero)", () => {
    const unit = getUnitById('blood-angels-blood-angels-captain')!;
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1);
    expect(hand[0].keywords).toEqual(unit.keywords);
    expect(hand[0].keywords).toContain('Character');
  });

  it("copies each unit's real element onto the card - REGRESSION TEST: this was previously missing entirely, meaning every real card's element was always undefined, so Elemental treated every single card as mismatched regardless of its true element or the cell's terrain, always applying the -1 debuff and never the +1 buff in actual gameplay", () => {
    const unit = getUnitById('blood-angels-blood-angels-captain')!;
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1);
    expect(hand[0].element).toBe(unit.element);
    expect(hand[0].element).toBeDefined();
  });

  it('assigns unique instanceIds even for the same unit id repeated', () => {
    const hand = unitIdsToHand(
      ['blood-angels-blood-angels-captain', 'blood-angels-blood-angels-captain'],
      'blue',
      2,
    );
    expect(hand[0].instanceId).not.toBe(hand[1].instanceId);
  });

  it('throws for an unknown unit id', () => {
    expect(() => unitIdsToHand(['not-a-real-id'], 'blue', 1)).toThrow('Unknown unit id');
  });
});