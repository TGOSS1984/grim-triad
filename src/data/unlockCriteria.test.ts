import { describe, it, expect } from 'vitest';
import { ACTIVE_FACTIONS } from './activeFactions';
import {
  UNLOCK_TIERS,
  getTierForPoints,
  getFactionsContainingUnit,
  isUnitUnlocked,
  getUnitUnlockProgress,
  getNewlyUnlockedBatches,
  getTierUnlockCounts,
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

  it('a shared generic Space Marine unit belongs to every active chapter that includes the generic pool', () => {
    // Ultramarines used to be deliberately excluded from this assertion:
    // its units were modeled with faction: 'Ultramarines' directly rather
    // than faction: 'Space Marines', subfaction: 'Ultramarines', a real
    // data-pipeline gap (see scripts/parseCatalogue.ts's CHAPTER_ROLLUP)
    // fixed once more Space Marine chapters were activated and this
    // asymmetry became visible in the actual army builder, not just a
    // theoretical inconsistency. Ultramarines now behaves the same as
    // every other chapter here.
    const factions = getFactionsContainingUnit('space-marines-thunderhawk-gunship');
    expect(factions).toContain('Black Templars');
    expect(factions).toContain('Blood Angels');
    expect(factions).toContain('Dark Angels');
    expect(factions).toContain('Space Wolves');
    expect(factions).toContain('Ultramarines');
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

describe('tier-200-250 getProgress', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-200-250')!;

  it('reports current/target/label for partial progress', () => {
    const progress = tier.getProgress(snapshot({ totalWins: 6 }), { factionsContainingUnit: [] });
    expect(progress).toEqual({ current: 6, target: 10, label: 'games won' });
  });

  it('clamps current at target, never showing more than the goal', () => {
    const progress = tier.getProgress(snapshot({ totalWins: 15 }), {
      factionsContainingUnit: [],
    });
    expect(progress.current).toBe(10);
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

describe('tier-250-300 getProgress (shows whichever path is closer)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-250-300')!;
  const ctx = { factionsContainingUnit: [] };

  it('shows win progress when wins are proportionally closer to their target than combos', () => {
    // 10/20 = 50% vs 3/15 = 20% - wins is closer.
    const progress = tier.getProgress(snapshot({ totalWins: 10, sameOrPlusComboCount: 3 }), ctx);
    expect(progress).toEqual({ current: 10, target: 20, label: 'games won' });
  });

  it('shows combo progress when combos are proportionally closer to their target than wins', () => {
    // 2/20 = 10% vs 9/15 = 60% - combos is closer.
    const progress = tier.getProgress(snapshot({ totalWins: 2, sameOrPlusComboCount: 9 }), ctx);
    expect(progress).toEqual({ current: 9, target: 15, label: 'Same/Plus combos' });
  });

  it('breaks an exact tie in favor of wins', () => {
    // 10/20 = 50% exactly equals 7.5/15 = 50% is impossible with integers,
    // but a clean tie IS possible: 4/20 = 20% vs 3/15 = 20%.
    const progress = tier.getProgress(snapshot({ totalWins: 4, sameOrPlusComboCount: 3 }), ctx);
    expect(progress.label).toBe('games won');
  });

  it('clamps each path at its own target', () => {
    const progress = tier.getProgress(
      snapshot({ totalWins: 30, sameOrPlusComboCount: 0 }),
      ctx,
    );
    expect(progress.current).toBe(20);
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

describe('tier-300-400 getProgress (shows the closest faction among factionsContainingUnit)', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-300-400')!;

  it('reports progress for a single-faction unit', () => {
    const context = { factionsContainingUnit: ['Necrons'] };
    const progress = tier.getProgress(snapshot({ winsByFaction: { Necrons: 4 } }), context);
    expect(progress).toEqual({ current: 4, target: 10, label: 'wins with Necrons' });
  });

  it('picks the faction with the MOST wins among a shared unit\'s factions, not the first-listed one', () => {
    const context = { factionsContainingUnit: ['Blood Angels', 'Dark Angels', 'Ultramarines'] };
    const winsByFaction = { 'Blood Angels': 2, 'Dark Angels': 7, Ultramarines: 1 };
    const progress = tier.getProgress(snapshot({ winsByFaction }), context);
    expect(progress).toEqual({ current: 7, target: 10, label: 'wins with Dark Angels' });
  });

  it('treats a faction with zero recorded wins as 0, not a crash', () => {
    const context = { factionsContainingUnit: ['Necrons'] };
    const progress = tier.getProgress(snapshot(), context);
    expect(progress.current).toBe(0);
  });

  it('falls back gracefully if somehow given no factions at all (defensive, should not normally happen)', () => {
    const progress = tier.getProgress(snapshot(), { factionsContainingUnit: [] });
    expect(progress.current).toBe(0);
    expect(progress.target).toBe(10);
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

describe('tier-400-500 getProgress', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-400-500')!;

  it('counts distinct factions with at least one win, not total wins', () => {
    const winsByFaction = { Necrons: 20, Orks: 1, Aeldari: 1 };
    const progress = tier.getProgress(snapshot({ winsByFaction }), {
      factionsContainingUnit: [],
    });
    expect(progress).toEqual({ current: 3, target: 5, label: 'factions won with' });
  });

  it('does not count a faction with zero wins toward the distinct count', () => {
    const winsByFaction = { Necrons: 5, Orks: 0 };
    const progress = tier.getProgress(snapshot({ winsByFaction }), {
      factionsContainingUnit: [],
    });
    expect(progress.current).toBe(1);
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

describe('tier-500-plus getProgress', () => {
  const tier = UNLOCK_TIERS.find((t) => t.id === 'tier-500-plus')!;

  it('counts distinct flawless-win factions', () => {
    const progress = tier.getProgress(snapshot({ flawlessWinFactions: ['Necrons'] }), {
      factionsContainingUnit: [],
    });
    expect(progress).toEqual({ current: 1, target: 3, label: 'flawless-win factions' });
  });
});

describe('getUnitUnlockProgress (integration, real unit data)', () => {
  it('returns null for a unit under 200pts - always available, nothing to show progress toward', () => {
    expect(getUnitUnlockProgress('necrons-annihilation-barge', 105, snapshot())).toBeNull();
  });

  it('returns null once a unit\'s tier is already unlocked - nothing left to track', () => {
    const progress = getUnitUnlockProgress(
      'necrons-doom-scythe',
      230,
      snapshot({ totalWins: 10 }),
    );
    expect(progress).toBeNull();
  });

  it('returns live progress for a unit that is still locked', () => {
    const progress = getUnitUnlockProgress(
      'necrons-doom-scythe',
      230,
      snapshot({ totalWins: 6 }),
    );
    expect(progress).toEqual({ current: 6, target: 10, label: 'games won' });
  });

  it('a chapter-exclusive 300-400 unit reports progress against its own faction by name', () => {
    const progress = getUnitUnlockProgress(
      'dark-angels-lion-el-jonson',
      315,
      snapshot({ winsByFaction: { 'Dark Angels': 3 } }),
    );
    expect(progress).toEqual({ current: 3, target: 10, label: 'wins with Dark Angels' });
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

describe('getNewlyUnlockedBatches', () => {
  it('returns an empty array when nothing newly unlocked', () => {
    const before = snapshot({ totalWins: 5 });
    const after = snapshot({ totalWins: 9 }); // still short of the 200-250 tier's 10
    expect(getNewlyUnlockedBatches(before, after)).toEqual([]);
  });

  it('returns an empty array when progress went backward (should never happen in practice, but never reports a "newly unlocked" unit that was already unlocked before)', () => {
    const before = snapshot({ totalWins: 10 });
    const after = snapshot({ totalWins: 5 });
    expect(getNewlyUnlockedBatches(before, after)).toEqual([]);
  });

  it('crossing the 10-win threshold produces exactly one batch, for the 200-250 tier, with every one of its units', () => {
    const before = snapshot({ totalWins: 9 });
    const after = snapshot({ totalWins: 10 });

    const batches = getNewlyUnlockedBatches(before, after);

    expect(batches).toHaveLength(1);
    expect(batches[0].tier.id).toBe('tier-200-250');
    const expectedTierUnitCount = 34; // see unlockCriteria.ts's own header - real data as of this writing
    expect(batches[0].units).toHaveLength(expectedTierUnitCount);
  });

  it('the batch\'s units are sorted MOST EXPENSIVE FIRST - units[0] is the intended hero card', () => {
    const before = snapshot({ totalWins: 9 });
    const after = snapshot({ totalWins: 10 });

    const [{ units }] = getNewlyUnlockedBatches(before, after);

    for (let i = 1; i < units.length; i++) {
      expect(units[i - 1].points).toBeGreaterThanOrEqual(units[i].points);
    }
  });

  it('only includes a unit ONCE, in the batch matching its OWN tier, even though every tier below 500+ is also crossed by a single huge win/streak jump', () => {
    // A snapshot this generous crosses every tier's threshold at once -
    // confirms each unit lands in exactly its own tier's batch, not
    // duplicated across multiple.
    const before = snapshot();
    const after = snapshot({
      totalWins: 50,
      sameOrPlusComboCount: 50,
      winsByFaction: { Necrons: 50, Orks: 50, Aeldari: 50, Ultramarines: 50, 'Dark Angels': 50 },
      flawlessWinFactions: ['Necrons', 'Orks', 'Aeldari'],
    });

    const batches = getNewlyUnlockedBatches(before, after);
    const tierIds = batches.map((b) => b.tier.id);

    expect(tierIds).toEqual([
      'tier-200-250',
      'tier-250-300',
      'tier-300-400',
      'tier-400-500',
      'tier-500-plus',
    ]);
    const allUnitIds = batches.flatMap((b) => b.units.map((u) => u.id));
    expect(new Set(allUnitIds).size).toBe(allUnitIds.length); // no duplicates across batches
  });

  it('a per-faction tier-300-400 crossing for ONE faction does not include another faction\'s exclusive 300-400 units', () => {
    const before = snapshot({ winsByFaction: { 'Dark Angels': 9 } });
    const after = snapshot({ winsByFaction: { 'Dark Angels': 10 } });

    const batches = getNewlyUnlockedBatches(before, after);
    const tier300to400 = batches.find((b) => b.tier.id === 'tier-300-400');

    expect(tier300to400).toBeDefined();
    const unitIds = tier300to400!.units.map((u) => u.id);
    expect(unitIds).toContain('dark-angels-lion-el-jonson');
    // Space Wolves' own 300-400 exclusive shouldn't appear from a
    // Dark Angels win alone.
    expect(unitIds).not.toContain('space-wolves-stormfang-gunship');
  });
});

describe('getTierUnlockCounts', () => {
  it('returns all five tiers, in ascending order, even with zero progress', () => {
    const counts = getTierUnlockCounts(snapshot());
    expect(counts.map((c) => c.tier.id)).toEqual([
      'tier-200-250',
      'tier-250-300',
      'tier-300-400',
      'tier-400-500',
      'tier-500-plus',
    ]);
  });

  it('reports 0 unlocked (but a nonzero total) for every tier with no progress', () => {
    const counts = getTierUnlockCounts(snapshot());
    for (const { unlocked, total } of counts) {
      expect(unlocked).toBe(0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("each tier's total matches the real data - see unlockCriteria.ts's own header for the source numbers", () => {
    const counts = getTierUnlockCounts(snapshot());
    const totalsByTierId = Object.fromEntries(counts.map((c) => [c.tier.id, c.total]));
    expect(totalsByTierId).toEqual({
      'tier-200-250': 34,
      'tier-250-300': 23,
      'tier-300-400': 16,
      'tier-400-500': 9,
      'tier-500-plus': 10,
    });
  });

  it('reports every unit unlocked once every tier is fully crossed', () => {
    // tier-300-400 requires 10 wins with THAT UNIT'S OWN faction - a
    // handful of factions isn't enough to unlock every 300-400 unit, only
    // wins across EVERY active faction genuinely clears it (any exclusive
    // unit belonging to a faction left out would still be locked).
    const winsByFaction = Object.fromEntries(ACTIVE_FACTIONS.map((f) => [f.name, 50]));
    const generous = snapshot({
      totalWins: 50,
      sameOrPlusComboCount: 50,
      winsByFaction,
      flawlessWinFactions: ['Necrons', 'Orks', 'Aeldari'],
    });

    const counts = getTierUnlockCounts(generous);

    for (const { unlocked, total } of counts) {
      expect(unlocked).toBe(total);
    }
  });

  it('a 300-400 (per-faction) count reflects only units unlockable via the factions actually played, not the whole tier', () => {
    // Winning only with Dark Angels shouldn't unlock every 300-400 unit,
    // just the ones reachable through Dark Angels (directly, or via a
    // shared generic pool it belongs to).
    const counts = getTierUnlockCounts(snapshot({ winsByFaction: { 'Dark Angels': 10 } }));
    const tier300to400 = counts.find((c) => c.tier.id === 'tier-300-400')!;

    expect(tier300to400.unlocked).toBeGreaterThan(0);
    expect(tier300to400.unlocked).toBeLessThan(tier300to400.total);
  });

  it('counts increase monotonically as progress increases (never decreases for more progress)', () => {
    const low = getTierUnlockCounts(snapshot({ totalWins: 5 }));
    const high = getTierUnlockCounts(snapshot({ totalWins: 15 }));

    const lowTier1 = low.find((c) => c.tier.id === 'tier-200-250')!;
    const highTier1 = high.find((c) => c.tier.id === 'tier-200-250')!;
    expect(highTier1.unlocked).toBeGreaterThanOrEqual(lowTier1.unlocked);
  });
});