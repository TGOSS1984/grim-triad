import { describe, it, expect } from 'vitest';
import {
  ALL_UNITS,
  ALL_FACTIONS,
  ACTIVE_FACTIONS,
  getUnitsForRoster,
  getFactionBySlug,
} from './activeFactions';

describe('generated data loading + validation', () => {
  it('loads and validates a large number of units without throwing', () => {
    expect(ALL_UNITS.length).toBeGreaterThan(700);
  });

  it('loads and validates all 29 generated rosters', () => {
    expect(ALL_FACTIONS.length).toBe(29);
  });

  it('every loaded unit has stats that sum to its statBudget', () => {
    for (const unit of ALL_UNITS) {
      const sum = unit.stats.top + unit.stats.bottom + unit.stats.left + unit.stats.right;
      expect(sum).toBe(unit.statBudget);
    }
  });
});

describe('ACTIVE_FACTIONS', () => {
  it('contains exactly the 4 configured v1 rosters', () => {
    const names = ACTIVE_FACTIONS.map((f) => f.name).sort();
    expect(names).toEqual(['Aeldari', 'Blood Angels', 'Necrons', 'Tyranids']);
  });

  it('each active roster has a non-trivial unit pool', () => {
    for (const faction of ACTIVE_FACTIONS) {
      expect(faction.unitCount).toBeGreaterThan(10);
    }
  });
});

describe('getUnitsForRoster', () => {
  it('returns only Blood Angels chapter-unique units for "Blood Angels"', () => {
    const units = getUnitsForRoster('Blood Angels');
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.subfaction).toBe('Blood Angels');
    }
  });

  it('returns Necrons units for "Necrons" (no subfaction involved)', () => {
    const units = getUnitsForRoster('Necrons');
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.faction).toBe('Necrons');
    }
  });

  it('returns an empty array for an unknown roster name', () => {
    expect(getUnitsForRoster('Not A Real Faction')).toEqual([]);
  });
});

describe('getFactionBySlug', () => {
  it('finds a known faction by slug', () => {
    const faction = getFactionBySlug('necrons');
    expect(faction?.name).toBe('Necrons');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getFactionBySlug('not-a-real-slug')).toBeUndefined();
  });
});