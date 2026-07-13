import { describe, it, expect, beforeEach } from 'vitest';
import { useCampaignStore } from './campaignStore';

const STORAGE_KEY = 'grim-triad-campaign';

beforeEach(() => {
  useCampaignStore.getState().resetCampaign();
  // resetCampaign() deliberately does NOT clear unlockedAchievementIds or
  // bestWinStreak in production (both are meant to survive across runs) -
  // tests need a clean slate regardless, so this bypasses that via a
  // direct setState rather than the public action.
  useCampaignStore.setState({ unlockedAchievementIds: [], bestWinStreak: 0 });
  localStorage.clear();
});

describe('campaignStore', () => {
  it('starts inactive with an empty collection, zeroed record, no achievements, and no streak', () => {
    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.collection).toEqual([]);
    expect(state.wins).toBe(0);
    expect(state.losses).toBe(0);
    expect(state.draws).toBe(0);
    expect(state.unlockedAchievementIds).toEqual([]);
    expect(state.currentStreakType).toBe('none');
    expect(state.currentStreakCount).toBe(0);
    expect(state.bestWinStreak).toBe(0);
  });

  it('startCampaign seeds the collection and marks the run active', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);

    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('startCampaign resets any prior win/loss/draw record', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().wins).toBe(1);

    useCampaignStore.getState().startCampaign(['b']);
    expect(useCampaignStore.getState().wins).toBe(0);
  });

  it('recordMatchResult increments the correct counter for win/loss/draw', () => {
    useCampaignStore.getState().startCampaign([]);

    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('draw', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    const state = useCampaignStore.getState();
    expect(state.wins).toBe(2);
    expect(state.losses).toBe(1);
    expect(state.draws).toBe(1);
  });

  it('recordMatchResult adds gained units to the collection', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-immortals'], []);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('recordMatchResult removes lost units from the collection', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-immortals']);
  });

  it('removes exactly ONE matching entry per lost id, not every copy (multiset, not a set)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-lychguard', 'necrons-immortals']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard']);

    // Still has one Lychguard left - only one copy should have been removed.
    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('a lost id not present in the collection is simply a no-op, not a crash', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['not-actually-owned']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard']);
  });

  it('handles simultaneous gains and losses correctly in one call', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore
      .getState()
      .recordMatchResult('win', ['necrons-overlord', 'necrons-immortals'], ['necrons-lychguard']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-overlord', 'necrons-immortals']);
  });

  it('resetCampaign clears the collection, record, and current streak back to the initial state', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-overlord'], []);

    useCampaignStore.getState().resetCampaign();

    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.collection).toEqual([]);
    expect(state.wins).toBe(0);
    expect(state.losses).toBe(0);
    expect(state.draws).toBe(0);
    expect(state.currentStreakType).toBe('none');
    expect(state.currentStreakCount).toBe(0);
  });

  it('auto-persists to localStorage on every state change, with no explicit save action', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-overlord'], []);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.state.collection).toEqual(['necrons-lychguard', 'necrons-overlord']);
    expect(parsed.state.wins).toBe(1);
    expect(parsed.state.isActive).toBe(true);
  });
});

describe('campaignStore achievements', () => {
  it('unlocks First Blood after the first recorded win', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    expect(useCampaignStore.getState().unlockedAchievementIds).not.toContain('first-blood');

    useCampaignStore.getState().recordMatchResult('win', [], []);

    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('first-blood');
  });

  it('unlocks Grim Determination after 10 losses, not before', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    for (let i = 0; i < 9; i++) {
      useCampaignStore.getState().recordMatchResult('loss', [], []);
    }
    expect(useCampaignStore.getState().unlockedAchievementIds).not.toContain('grim-determination');

    useCampaignStore.getState().recordMatchResult('loss', [], []);

    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('grim-determination');
  });

  it('does NOT unlock an achievement it does not yet qualify for', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    // 1 win unlocks First Blood but not Blooded Veteran (needs 10).
    expect(useCampaignStore.getState().unlockedAchievementIds).not.toContain('blooded-veteran');
  });

  it('an achievement stays unlocked even if the collection later shrinks back below the threshold', () => {
    const twentyFive = Array.from({ length: 25 }, (_, i) => `unit-${i}`);
    useCampaignStore.getState().startCampaign(twentyFive);
    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('collector-recruit');

    // Lose 20 of the 25 units - well below the 25-unique threshold now.
    useCampaignStore.getState().recordMatchResult('loss', [], twentyFive.slice(0, 20));
    expect(useCampaignStore.getState().collection).toHaveLength(5);

    // Still unlocked - achievements are permanent once earned.
    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('collector-recruit');
  });

  it('resetCampaign does NOT clear unlockedAchievementIds - achievements survive across runs', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('first-blood');

    useCampaignStore.getState().resetCampaign();

    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('first-blood');
  });

  it('a fresh run of the standard 15-unit starting size does not spuriously unlock the 25-unit collector achievement', () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => `unit-${i}`);
    useCampaignStore.getState().startCampaign(fifteen);

    expect(useCampaignStore.getState().unlockedAchievementIds).not.toContain('collector-recruit');
  });
});

describe('campaignStore streaks', () => {
  it('extends the current streak on consecutive wins', () => {
    useCampaignStore.getState().startCampaign(['a']);

    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().currentStreakType).toBe('win');
    expect(useCampaignStore.getState().currentStreakCount).toBe(1);

    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().currentStreakCount).toBe(2);

    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().currentStreakCount).toBe(3);
  });

  it('extends the current streak on consecutive losses too, independently from wins', () => {
    useCampaignStore.getState().startCampaign(['a']);

    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);

    expect(useCampaignStore.getState().currentStreakType).toBe('loss');
    expect(useCampaignStore.getState().currentStreakCount).toBe(2);
  });

  it('a draw breaks any streak back to none/0', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    useCampaignStore.getState().recordMatchResult('draw', [], []);

    expect(useCampaignStore.getState().currentStreakType).toBe('none');
    expect(useCampaignStore.getState().currentStreakCount).toBe(0);
  });

  it('switching from a win streak to a loss starts a fresh streak of 1, not a continuation', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    useCampaignStore.getState().recordMatchResult('loss', [], []);

    expect(useCampaignStore.getState().currentStreakType).toBe('loss');
    expect(useCampaignStore.getState().currentStreakCount).toBe(1);
  });

  it('bestWinStreak tracks the highest win streak ever reached, not just the most recent one', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().bestWinStreak).toBe(3);

    // Break the streak and start a smaller one - best should NOT drop.
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    expect(useCampaignStore.getState().currentStreakCount).toBe(1);
    expect(useCampaignStore.getState().bestWinStreak).toBe(3);
  });

  it('a loss streak never counts toward bestWinStreak', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);

    expect(useCampaignStore.getState().bestWinStreak).toBe(0);
  });

  it('resetCampaign clears the CURRENT streak but bestWinStreak survives - permanent, like achievements', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().bestWinStreak).toBe(2);

    useCampaignStore.getState().resetCampaign();

    expect(useCampaignStore.getState().currentStreakType).toBe('none');
    expect(useCampaignStore.getState().currentStreakCount).toBe(0);
    expect(useCampaignStore.getState().bestWinStreak).toBe(2);
  });

  it('unlocks the On a Roll achievement at a 5-win streak', () => {
    useCampaignStore.getState().startCampaign(['a']);
    for (let i = 0; i < 4; i++) {
      useCampaignStore.getState().recordMatchResult('win', [], []);
    }
    expect(useCampaignStore.getState().unlockedAchievementIds).not.toContain('on-a-roll');

    useCampaignStore.getState().recordMatchResult('win', [], []);

    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('on-a-roll');
  });
});