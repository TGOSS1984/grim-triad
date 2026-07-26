import { describe, it, expect } from 'vitest';
import {
  UNLOCK_TIERS,
  getTierForPoints,
  getFactionsContainingUnit,
  isUnitUnlocked,
  type UnlockProgressSnapshot,
} from './unlockCriteria';

function snapshot(overrides: Partial<UnlockProgressSnapshot> = {}): UnlockProgressSnapshot {
  return {
    totalWins: 0,
    winsByFaction: {},
    sameOrPlusComboCount: 0,
    chainReactionCount: 0,
    flawlessWinFactions: [],
    ...overrides,
  };
}

describe('UNLOCK_TIERS', () => {
  it('are contiguous and non-overlapping, in ascending order', () => {
    for (let i = 1; i < UNLOCK_TIERS.length; i++) {
      expect(UNLOCK_TIERS[i].minPoints).toBe(UNLOCK_TIERS[i - 1].maxPoints);
    }
  });

  it('the top tier has no upper bound', () => {
    expect(UNLOCK_TIERS[UNLOCK_TIERS.length - 1].maxPoints).toBeNull();
  });

  it('every tier before the last one has a real upper bound', () => {
    for (const tier of UNLOCK_TIERS.slice(0, -1)) {
      expect(tier.maxPoints).not.toBeNull();
    }
  });
});

describe('getTierForPoints', () => {
  it('returns null for anything under the lowest tier (always available)', () => {
    expect(getTierForPoints(0)).toBeNull();
    expect(getTierForPoints(199)).toBeNull();
  });

  it('is inclusive of a tier\'s lower bound', () => {
    expect(getTierForPoints(200)?.id).toBe('tier-200-250');
    expect(getTierForPoints(300)?.id).toBe('tier-300-400');
    expect(getTierForPoints(500)?.id).toBe('tier-500-plus');
  });

  it('is exclusive of a tier\'s upper bound (that value belongs to the NEXT tier)', () => {
    expect(getTierForPoints(250)?.id).toBe('tier-250-300');
    expect(getTierForPoints(249)?.id).toBe('tier-200-250');
  });

  it('the top tier matches an arbitrarily large value', () => {
    expect(getTierForPoints(3500)?.id).toBe('tier-500-plus');
  });
});

describe('getFactionsContainingUnit (real data)', () => {
  it('a chapter-exclusive unit belongs to exactly one active faction', () => {
    expect(getFactionsContainingUnit('dark-angels-lion-el-jonson')).toEqual(['Dark Angels']);
  });

  it('a shared generic Space Marine unit belongs to every active CHAPTER that includes the generic pool', () => {
    // Ultramarines is deliberately excluded from this assertion: unlike
    // Black Templars/Blood Angels/Dark Angels/Space Wolves, its units are
    // modeled with faction: 'Ultramarines' directly rather than
    // faction: 'Space Marines', subfaction: 'Ultramarines' - so
    // getUnitsForRoster's chapter-detection correctly does NOT merge the
    // generic pool into it. Confirmed against the real generated data,
    // not an oversight in either the fixture or the code under test.
    const factions = getFactionsContainingUnit('space-marines-thunderhawk-gunship');
    expect(factions).toContain('Black Templars');
    expect(factions).toContain('Blood Angels');
    expect(factions).toContain('Dark Angels');
    expect(factions).toContain('Space Wolves');
    expect(factions).not.toContain('Ultramarines');
  });

  it('a Necrons-only unit belongs to exactly Necrons', () => {
    expect(getFactionsContainingUnit('necrons-doom-scythe')).toEqual(['Necrons']);
  });

  it('returns an empty array for an unrecognized unit id, never throws', () => {
    expect(getFactionsContainingUnit('not-a-real-unit-id')).toEqual([]);
  });
});

describe('tier-200-250 isUnlocked (universal: 10 total wins)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-200-250')!;

  it('locked with fewer than 10 wins', () => {
    expect(tier.isUnlocked(snapshot({ totalWins: 9 }), { factionsContainingUnit: [] })).toBe(
      false,
    );
  });

  it('unlocked at exactly 10 wins', () => {
    expect(tier.isUnlocked(snapshot({ totalWins: 10 }), { factionsContainingUnit: [] })).toBe(
      true,
    );
  });
});

describe('tier-250-300 isUnlocked (20 wins OR 15 combos)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-250-300')!;

  it('locked with neither condition met', () => {
    expect(
      tier.isUnlocked(snapshot({ totalWins: 19, sameOrPlusComboCount: 14 }), {
        factionsContainingUnit: [],
      }),
    ).toBe(false);
  });

  it('unlocked via 20 wins alone, even with zero combos', () => {
    expect(
      tier.isUnlocked(snapshot({ totalWins: 20, sameOrPlusComboCount: 0 }), {
        factionsContainingUnit: [],
      }),
    ).toBe(true);
  });

  it('unlocked via 15 combos alone, even with zero wins', () => {
    expect(
      tier.isUnlocked(snapshot({ totalWins: 0, sameOrPlusComboCount: 15 }), {
        factionsContainingUnit: [],
      }),
    ).toBe(true);
  });
});

describe('tier-300-400 isUnlocked (10 wins with the unit\'s OWN faction)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-300-400')!;

  it('locked if the player has 10+ wins with a DIFFERENT faction only', () => {
    const context = { factionsContainingUnit: ['Necrons'] };
    expect(tier.isUnlocked(snapshot({ winsByFaction: { Orks: 10 } }), context)).toBe(false);
  });

  it('unlocked once the player has 10+ wins with the unit\'s own faction', () => {
    const context = { factionsContainingUnit: ['Necrons'] };
    expect(tier.isUnlocked(snapshot({ winsByFaction: { Necrons: 10 } }), context)).toBe(true);
  });

  it('a shared unit (multiple factionsContainingUnit) unlocks via ANY one of them reaching 10 wins', () => {
    const context = { factionsContainingUnit: ['Blood Angels', 'Dark Angels', 'Ultramarines'] };
    expect(
      tier.isUnlocked(snapshot({ winsByFaction: { 'Dark Angels': 10 } }), context),
    ).toBe(true);
  });
});

describe('tier-400-500 isUnlocked (5 different factions, >=1 win each)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-400-500')!;

  it('locked with only 4 distinct factions won with, regardless of total win count', () => {
    const winsByFaction = { Necrons: 50, Orks: 1, Aeldari: 1, Ultramarines: 1 };
    expect(tier.isUnlocked(snapshot({ winsByFaction }), { factionsContainingUnit: [] })).toBe(
      false,
    );
  });

  it('unlocked with exactly 5 distinct factions, even with just 1 win each', () => {
    const winsByFaction = { Necrons: 1, Orks: 1, Aeldari: 1, Ultramarines: 1, 'Dark Angels': 1 };
    expect(tier.isUnlocked(snapshot({ winsByFaction }), { factionsContainingUnit: [] })).toBe(
      true,
    );
  });
});

describe('tier-500-plus isUnlocked (3 flawless wins, 3 different factions)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-500-plus')!;

  it('locked with only 2 flawless-win factions', () => {
    expect(
      tier.isUnlocked(snapshot({ flawlessWinFactions: ['Necrons', 'Orks'] }), {
        factionsContainingUnit: [],
      }),
    ).toBe(false);
  });

  it('unlocked with 3 flawless-win factions', () => {
    expect(
      tier.isUnlocked(snapshot({ flawlessWinFactions: ['Necrons', 'Orks', 'Aeldari'] }), {
        factionsContainingUnit: [],
      }),
    ).toBe(true);
  });
});

describe('isUnitUnlocked (integration, real unit data)', () => {
  it('a unit under 200 points is always unlocked, regardless of progress', () => {
    expect(isUnitUnlocked('necrons-annihilation-barge', 105, snapshot())).toBe(true);
  });

  it('a 200-250 unit is locked with no progress', () => {
    expect(isUnitUnlocked('necrons-doom-scythe', 230, snapshot())).toBe(false);
  });

  it('a 200-250 unit unlocks once totalWins reaches 10', () => {
    expect(isUnitUnlocked('necrons-doom-scythe', 230, snapshot({ totalWins: 10 }))).toBe(true);
  });

  it("a 300-400 chapter-exclusive unit only unlocks via THAT chapter's own wins", () => {
    expect(
      isUnitUnlocked(
        'dark-angels-lion-el-jonson',
        315,
        snapshot({ winsByFaction: { Ultramarines: 50 } }),
      ),
    ).toBe(false);
    expect(
      isUnitUnlocked(
        'dark-angels-lion-el-jonson',
        315,
        snapshot({ winsByFaction: { 'Dark Angels': 10 } }),
      ),
    ).toBe(true);
  });

  it('a shared generic unit in the 500+ tier unlocks via the universal flawless-win condition, independent of which chapter', () => {
    const progress = snapshot({ flawlessWinFactions: ['Blood Angels', 'Space Wolves', 'Ultramarines'] });
    expect(isUnitUnlocked('space-marines-thunderhawk-gunship', 840, progress)).toBe(true);
  });
});