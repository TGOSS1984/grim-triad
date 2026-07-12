import { describe, it, expect } from 'vitest';
import {
  isPowerUnit,
  countPowerUnits,
  totalPoints,
  canAddToCampaignRoster,
  validateCampaignStartingRoster,
  CAMPAIGN_POWER_THRESHOLD_POINTS,
} from './campaignBalance';

// Real generated unit ids/points (see src/data/units.generated.json):
const CHEAP = 'necrons-canoptek-scarab-swarms'; // 40pts
const MID = 'necrons-lychguard'; // 85pts
const POWERFUL = 'necrons-monolith'; // 400pts, well over the 150pt threshold
const POWERFUL_2 = 'necrons-obelisk'; // 300pts
const POWERFUL_3 = 'necrons-doom-scythe'; // 230pts
const POWERFUL_4 = 'necrons-tesseract-vault'; // 425pts

describe('isPowerUnit', () => {
  it('is false for a unit at or below the threshold', () => {
    expect(isPowerUnit(MID)).toBe(false); // 85pts
  });

  it('is true for a unit above the threshold', () => {
    expect(isPowerUnit(POWERFUL)).toBe(true); // 400pts
    expect(CAMPAIGN_POWER_THRESHOLD_POINTS).toBeLessThan(400);
  });

  it('is false (not true) for an unresolvable unit id', () => {
    expect(isPowerUnit('not-a-real-id')).toBe(false);
  });
});

describe('countPowerUnits / totalPoints', () => {
  it('counts only the power units in a mixed roster', () => {
    expect(countPowerUnits([CHEAP, MID, POWERFUL])).toBe(1);
  });

  it('sums points correctly, treating an unresolvable id as 0', () => {
    expect(totalPoints([CHEAP, MID])).toBe(125); // 40 + 85
    expect(totalPoints([CHEAP, 'not-a-real-id'])).toBe(40);
  });
});

describe('canAddToCampaignRoster', () => {
  it('allows adding a unit when under every cap', () => {
    const result = canAddToCampaignRoster([CHEAP], MID, { poolSize: 15, pointsCap: 1000, maxPowerUnits: 3 });
    expect(result.allowed).toBe(true);
  });

  it('disallows adding a unit already in the roster', () => {
    const result = canAddToCampaignRoster([MID], MID);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already in your roster/);
  });

  it('disallows adding once the pool size is full', () => {
    const full = Array.from({ length: 3 }, (_, i) => `${CHEAP}-${i}`);
    const result = canAddToCampaignRoster(full, MID, { poolSize: 3 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already full/);
  });

  it('disallows adding a unit that would exceed the points cap', () => {
    const result = canAddToCampaignRoster([], POWERFUL, { pointsCap: 300 }); // Monolith is 400
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/exceed the 300pt limit/);
  });

  it('disallows adding a power unit once the power-unit cap is reached', () => {
    const result = canAddToCampaignRoster([POWERFUL, POWERFUL_2], POWERFUL_3, {
      pointsCap: 10000,
      maxPowerUnits: 2,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/maximum 2 units over 150pts/);
  });

  it('still allows adding a NON-power unit even when the power-unit cap is already reached', () => {
    const result = canAddToCampaignRoster([POWERFUL, POWERFUL_2], CHEAP, {
      pointsCap: 10000,
      maxPowerUnits: 2,
    });
    expect(result.allowed).toBe(true);
  });
});

describe('validateCampaignStartingRoster', () => {
  it('is valid for a roster meeting every rule exactly', () => {
    const roster = [CHEAP, MID, POWERFUL];
    const result = validateCampaignStartingRoster(roster, {
      poolSize: 3,
      pointsCap: 1000,
      maxPowerUnits: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('reports a wrong roster size', () => {
    const result = validateCampaignStartingRoster([CHEAP], { poolSize: 3 });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('exactly 3 units'))).toBe(true);
  });

  it('reports exceeding the points cap', () => {
    const result = validateCampaignStartingRoster([POWERFUL, POWERFUL_2], {
      poolSize: 2,
      pointsCap: 500,
      maxPowerUnits: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('over the 500pt limit'))).toBe(true);
  });

  it('reports exceeding the power-unit cap', () => {
    const result = validateCampaignStartingRoster([POWERFUL, POWERFUL_2, POWERFUL_3], {
      poolSize: 3,
      pointsCap: 10000,
      maxPowerUnits: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('only 2 allowed'))).toBe(true);
  });

  it('reports every violated rule at once, not just the first', () => {
    const result = validateCampaignStartingRoster([POWERFUL, POWERFUL_2, POWERFUL_3, POWERFUL_4], {
      poolSize: 15,
      pointsCap: 500,
      maxPowerUnits: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3); // size, points, AND power-unit count
  });

  it('uses the real default constants when no overrides are given', () => {
    // The actual cheapest 15 units in the Necrons faction (verified
    // against the generated data, sorted ascending by points) comfortably
    // fit under the real 1000pt default cap with room to spare, and have
    // no power units at all - sanity-checks the module's own defaults
    // are actually usable, not just internally consistent.
    const cheapNecronIds = [
      'necrons-lokhust-destroyers', // 35pts
      'necrons-canoptek-scarab-swarms', // 40pts
      'necrons-royal-warden', // 50pts
      'necrons-canoptek-tomb-crawlers', // 50pts
      'necrons-lokhust-heavy-destroyers', // 55pts
      'necrons-psychomancer', // 55pts
      'necrons-convergence-of-dominion', // 60pts
      'necrons-flayed-ones', // 60pts
      'necrons-plasmancer', // 60pts
      'necrons-cryptothralls', // 60pts
      'necrons-chronomancer', // 65pts
      'necrons-deathmarks', // 65pts
      'necrons-immortals', // 70pts
      'necrons-canoptek-macrocytes', // 70pts
      'necrons-canoptek-reanimator', // 75pts - total: 870pts
    ];
    const result = validateCampaignStartingRoster(cheapNecronIds);
    expect(result.valid).toBe(true);
  });
});