import { describe, it, expect } from 'vitest';
import { buildRivalRosterFromPool } from './campaignRivalMatchSetup';
import { getUnitById, getUnitsForRoster } from '../data/activeFactions';

// Real generated unit ids (see src/data/units.generated.json), sorted by
// points ascending: lokhust-destroyers (35) is the cheapest Necron unit.
const ALL_NECRON_IDS = getUnitsForRoster('Necrons').map((u) => u.id);

describe('buildRivalRosterFromPool', () => {
  it('only ever returns unit ids present in the given pool', () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 500);
    for (const id of roster) {
      expect(ALL_NECRON_IDS).toContain(id);
    }
  });

  it('never exceeds the given points cap', () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 500);
    const totalPoints = roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
    expect(totalPoints).toBeLessThanOrEqual(500);
  });

  it('reaches the minimum roster size when the pool has enough affordable units', () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 500, 5);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('every returned unit id resolves to a real unit', () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 1000);
    for (const id of roster) {
      expect(getUnitById(id)).toBeDefined();
    }
  });

  it('can build a roster from a pool restricted to a single faction, without needing the rest of the catalog', () => {
    // Only Necron ids in the pool at all - if this succeeds, the function
    // is correctly drawing from the POOL, not silently falling back to
    // the full active-faction catalog the way buildRandomAIRoster does.
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 500, 5);
    for (const id of roster) {
      expect(id.startsWith('necrons-')).toBe(true);
    }
  });

  it('throws when the pool has too few DISTINCT candidate units to ever reach minUnits, regardless of points cap', () => {
    const tinyPool = ['necrons-lokhust-destroyers', 'necrons-canoptek-scarab-swarms'];
    expect(() => buildRivalRosterFromPool(tinyPool, 2000, 5)).toThrow(
      "Could not build a rival roster of at least 5 units within 2000 points from the AI's remaining pool of 2 unique units",
    );
  });

  it('throws when the pool has enough units by count but they are too expensive for the points cap', () => {
    // The 5 most expensive Necron units, at a cap only large enough for one of them.
    const priciestFive = [...getUnitsForRoster('Necrons')]
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((u) => u.id);
    const cheapestOfThose = Math.min(
      ...priciestFive.map((id) => getUnitById(id)!.points),
    );

    expect(() => buildRivalRosterFromPool(priciestFive, cheapestOfThose, 5)).toThrow(
      /Could not build a rival roster/,
    );
  });

  it('a pool containing a duplicate id does not let the roster field that id twice (deduplicated, matches army-building rules elsewhere)', () => {
    const poolWithDuplicate = [
      'necrons-lokhust-destroyers',
      'necrons-lokhust-destroyers',
      'necrons-canoptek-scarab-swarms',
      'necrons-royal-warden',
      'necrons-canoptek-tomb-crawlers',
      'necrons-lokhust-heavy-destroyers',
    ];
    const roster = buildRivalRosterFromPool(poolWithDuplicate, 2000, 5);

    const occurrences = roster.filter((id) => id === 'necrons-lokhust-destroyers').length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it("with strategy 'greedy', still respects the pool constraint", () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 500, 5, 'greedy');
    for (const id of roster) {
      expect(ALL_NECRON_IDS).toContain(id);
    }
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it("with strategy 'greedy', never exceeds the given points cap", () => {
    const roster = buildRivalRosterFromPool(ALL_NECRON_IDS, 1000, 5, 'greedy');
    const totalPoints = roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
    expect(totalPoints).toBeLessThanOrEqual(1000);
  });
});