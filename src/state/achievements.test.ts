import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  getCurrentlyUnlockedAchievementIds,
  type AchievementContext,
} from './achievements';
import { ACTIVE_FACTIONS, getUnitsForRoster } from '../data/activeFactions';
import { getObtainableUnitIds } from '../data/collectionProgress';

function ctx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return { collection: [], wins: 0, losses: 0, draws: 0, bestWinStreak: 0, ...overrides };
}

describe('ACHIEVEMENTS', () => {
  it('has a unique id for every achievement', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('win-count achievements', () => {
  it('First Blood unlocks at exactly 1 win, not before', () => {
    const firstBlood = ACHIEVEMENTS.find((a) => a.id === 'first-blood')!;
    expect(firstBlood.isUnlocked(ctx({ wins: 0 }))).toBe(false);
    expect(firstBlood.isUnlocked(ctx({ wins: 1 }))).toBe(true);
  });

  it('Blooded Veteran requires 10 wins', () => {
    const veteran = ACHIEVEMENTS.find((a) => a.id === 'blooded-veteran')!;
    expect(veteran.isUnlocked(ctx({ wins: 9 }))).toBe(false);
    expect(veteran.isUnlocked(ctx({ wins: 10 }))).toBe(true);
  });

  it('Grand Champion requires 25 wins', () => {
    const champion = ACHIEVEMENTS.find((a) => a.id === 'grand-champion')!;
    expect(champion.isUnlocked(ctx({ wins: 24 }))).toBe(false);
    expect(champion.isUnlocked(ctx({ wins: 25 }))).toBe(true);
  });
});

describe('collector achievements', () => {
  it('counts UNIQUE units, not raw collection size (a multiset with duplicates)', () => {
    const recruit = ACHIEVEMENTS.find((a) => a.id === 'collector-recruit')!;
    // 25 entries but only 3 unique ids - should NOT unlock.
    const duplicateHeavy = Array.from({ length: 25 }, (_, i) => `unit-${i % 3}`);
    expect(recruit.isUnlocked(ctx({ collection: duplicateHeavy }))).toBe(false);
  });

  it('Recruit Collector requires 25 unique units', () => {
    const recruit = ACHIEVEMENTS.find((a) => a.id === 'collector-recruit')!;
    const twentyFour = Array.from({ length: 24 }, (_, i) => `unit-${i}`);
    const twentyFive = Array.from({ length: 25 }, (_, i) => `unit-${i}`);
    expect(recruit.isUnlocked(ctx({ collection: twentyFour }))).toBe(false);
    expect(recruit.isUnlocked(ctx({ collection: twentyFive }))).toBe(true);
  });

  it('Hoarder requires 100 unique units', () => {
    const hoarder = ACHIEVEMENTS.find((a) => a.id === 'collector-hoarder')!;
    const ninetyNine = Array.from({ length: 99 }, (_, i) => `unit-${i}`);
    const oneHundred = Array.from({ length: 100 }, (_, i) => `unit-${i}`);
    expect(hoarder.isUnlocked(ctx({ collection: ninetyNine }))).toBe(false);
    expect(hoarder.isUnlocked(ctx({ collection: oneHundred }))).toBe(true);
  });

  it('Archivist requires 250 unique units', () => {
    const archivist = ACHIEVEMENTS.find((a) => a.id === 'collector-archivist')!;
    const twoFortyNine = Array.from({ length: 249 }, (_, i) => `unit-${i}`);
    const twoFifty = Array.from({ length: 250 }, (_, i) => `unit-${i}`);
    expect(archivist.isUnlocked(ctx({ collection: twoFortyNine }))).toBe(false);
    expect(archivist.isUnlocked(ctx({ collection: twoFifty }))).toBe(true);
  });
});

describe('Full Muster', () => {
  const fullMuster = ACHIEVEMENTS.find((a) => a.id === 'full-muster')!;
  // Necrons is the smallest active faction (52 units, no subfaction/
  // generic-pool union to worry about) - a clean real fixture.
  const necronRosterIds = getUnitsForRoster('Necrons').map((u) => u.id);

  it('does not unlock with a large but incomplete collection', () => {
    expect(fullMuster.isUnlocked(ctx({ collection: necronRosterIds.slice(0, -1) }))).toBe(false);
  });

  it('unlocks once every unit in a real active faction roster is owned', () => {
    expect(fullMuster.isUnlocked(ctx({ collection: necronRosterIds }))).toBe(true);
  });

  it('still unlocks with extra unrelated units mixed in (owning MORE than just that roster is fine)', () => {
    expect(
      fullMuster.isUnlocked(ctx({ collection: [...necronRosterIds, 'blood-angels-astorath'] })),
    ).toBe(true);
  });
});

describe('per-faction Master achievements', () => {
  it('generates exactly one Master achievement per active faction', () => {
    const masterIds = ACHIEVEMENTS.filter((a) => a.id.startsWith('master-of-')).map((a) => a.id);
    const expectedIds = ACTIVE_FACTIONS.map((f) => `master-of-${f.slug}`);

    expect(masterIds.sort()).toEqual(expectedIds.sort());
  });

  it("Necrons' Master achievement does not unlock with an incomplete roster", () => {
    const masterOfNecrons = ACHIEVEMENTS.find((a) => a.id === 'master-of-necrons')!;
    const necronRosterIds = getUnitsForRoster('Necrons').map((u) => u.id);

    expect(masterOfNecrons.isUnlocked(ctx({ collection: necronRosterIds.slice(0, -1) }))).toBe(
      false,
    );
  });

  it("Necrons' Master achievement unlocks once every Necrons unit is owned", () => {
    const masterOfNecrons = ACHIEVEMENTS.find((a) => a.id === 'master-of-necrons')!;
    const necronRosterIds = getUnitsForRoster('Necrons').map((u) => u.id);

    expect(masterOfNecrons.isUnlocked(ctx({ collection: necronRosterIds }))).toBe(true);
  });

  it('completing one faction only unlocks THAT faction\'s Master achievement, not another faction\'s', () => {
    const masterOfNecrons = ACHIEVEMENTS.find((a) => a.id === 'master-of-necrons')!;
    const masterOfOrks = ACHIEVEMENTS.find((a) => a.id === 'master-of-orks')!;
    const necronRosterIds = getUnitsForRoster('Necrons').map((u) => u.id);

    const context = ctx({ collection: necronRosterIds });
    expect(masterOfNecrons.isUnlocked(context)).toBe(true);
    expect(masterOfOrks.isUnlocked(context)).toBe(false);
  });
});

describe('Complete Collection', () => {
  const completeCollection = ACHIEVEMENTS.find((a) => a.id === 'complete-collection')!;

  it('does not unlock with a large but incomplete collection', () => {
    const almostEverything = Array.from(getObtainableUnitIds()).slice(0, -1);
    expect(completeCollection.isUnlocked(ctx({ collection: almostEverything }))).toBe(false);
  });

  it('unlocks once the collection owns one of every currently-obtainable unit', () => {
    const everyObtainableUnit = Array.from(getObtainableUnitIds());
    expect(completeCollection.isUnlocked(ctx({ collection: everyObtainableUnit }))).toBe(true);
  });
});

describe('grim-determination', () => {
  it('requires 10 losses', () => {
    const grim = ACHIEVEMENTS.find((a) => a.id === 'grim-determination')!;
    expect(grim.isUnlocked(ctx({ losses: 9 }))).toBe(false);
    expect(grim.isUnlocked(ctx({ losses: 10 }))).toBe(true);
  });
});

describe('on-a-roll', () => {
  it('requires a best win streak of 5', () => {
    const roll = ACHIEVEMENTS.find((a) => a.id === 'on-a-roll')!;
    expect(roll.isUnlocked(ctx({ bestWinStreak: 4 }))).toBe(false);
    expect(roll.isUnlocked(ctx({ bestWinStreak: 5 }))).toBe(true);
  });
});

describe('getCurrentlyUnlockedAchievementIds', () => {
  it('returns an empty array for a fresh context', () => {
    expect(getCurrentlyUnlockedAchievementIds(ctx())).toEqual([]);
  });

  it('returns every achievement id whose condition is currently met', () => {
    const unlocked = getCurrentlyUnlockedAchievementIds(ctx({ wins: 10, losses: 10 }));
    expect(unlocked).toEqual(
      expect.arrayContaining(['first-blood', 'blooded-veteran', 'grim-determination']),
    );
    expect(unlocked).not.toContain('grand-champion');
  });
});