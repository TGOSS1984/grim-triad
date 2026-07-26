import { describe, it, expect, beforeEach } from 'vitest';
import { useUnlockStore } from './unlockStore';

beforeEach(() => {
  useUnlockStore.getState().resetProgress();
  localStorage.clear();
});

describe('unlockStore initial state', () => {
  it('starts at zero across every counter, with no factions recorded', () => {
    const state = useUnlockStore.getState();
    expect(state.totalWins).toBe(0);
    expect(state.winsByFaction).toEqual({});
    expect(state.sameOrPlusComboCount).toBe(0);
    expect(state.chainReactionCount).toBe(0);
    expect(state.flawlessWinFactions).toEqual([]);
  });
});

describe('unlockStore recordSameOrPlusCombo / recordChainReaction', () => {
  it('increments sameOrPlusComboCount by 1 per call', () => {
    useUnlockStore.getState().recordSameOrPlusCombo();
    useUnlockStore.getState().recordSameOrPlusCombo();
    useUnlockStore.getState().recordSameOrPlusCombo();

    expect(useUnlockStore.getState().sameOrPlusComboCount).toBe(3);
  });

  it('increments chainReactionCount by 1 per call, independently of combo count', () => {
    useUnlockStore.getState().recordSameOrPlusCombo();
    useUnlockStore.getState().recordChainReaction();
    useUnlockStore.getState().recordChainReaction();

    expect(useUnlockStore.getState().sameOrPlusComboCount).toBe(1);
    expect(useUnlockStore.getState().chainReactionCount).toBe(2);
  });

  it('accepts a batch count in one call - the actual way App.tsx flushes gameStore\'s per-match tally', () => {
    useUnlockStore.getState().recordSameOrPlusCombo(4);
    useUnlockStore.getState().recordChainReaction(2);

    expect(useUnlockStore.getState().sameOrPlusComboCount).toBe(4);
    expect(useUnlockStore.getState().chainReactionCount).toBe(2);
  });

  it('a batch call adds to, rather than replaces, any existing count', () => {
    useUnlockStore.getState().recordSameOrPlusCombo();
    useUnlockStore.getState().recordSameOrPlusCombo(3);

    expect(useUnlockStore.getState().sameOrPlusComboCount).toBe(4);
  });

  it('a batch count of 0 is a safe no-op', () => {
    useUnlockStore.getState().recordSameOrPlusCombo(0);
    expect(useUnlockStore.getState().sameOrPlusComboCount).toBe(0);
  });
});

describe('unlockStore recordMatchOutcome', () => {
  it('increments totalWins on a win', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    expect(useUnlockStore.getState().totalWins).toBe(1);
  });

  it('does NOT increment totalWins on a loss or draw', () => {
    useUnlockStore.getState().recordMatchOutcome('loss', 'Necrons', false);
    useUnlockStore.getState().recordMatchOutcome('draw', 'Necrons', false);
    expect(useUnlockStore.getState().totalWins).toBe(0);
  });

  it('tracks wins per faction independently', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    useUnlockStore.getState().recordMatchOutcome('win', 'Orks', false);

    const state = useUnlockStore.getState();
    expect(state.winsByFaction).toEqual({ Necrons: 2, Orks: 1 });
    expect(state.totalWins).toBe(3);
  });

  it('a win with no resolvable faction still counts toward totalWins but not winsByFaction', () => {
    useUnlockStore.getState().recordMatchOutcome('win', undefined, false);

    const state = useUnlockStore.getState();
    expect(state.totalWins).toBe(1);
    expect(state.winsByFaction).toEqual({});
  });

  it('records a flawless win into flawlessWinFactions', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', true);
    expect(useUnlockStore.getState().flawlessWinFactions).toEqual(['Necrons']);
  });

  it('does NOT record a non-flawless win into flawlessWinFactions', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    expect(useUnlockStore.getState().flawlessWinFactions).toEqual([]);
  });

  it('ignores wasFlawless on a loss or draw (only meaningful on a win)', () => {
    useUnlockStore.getState().recordMatchOutcome('loss', 'Necrons', true);
    useUnlockStore.getState().recordMatchOutcome('draw', 'Orks', true);
    expect(useUnlockStore.getState().flawlessWinFactions).toEqual([]);
  });

  it('does not add the same faction to flawlessWinFactions twice', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', true);
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', true);

    expect(useUnlockStore.getState().flawlessWinFactions).toEqual(['Necrons']);
  });

  it('a flawless win with no resolvable faction is not recorded into flawlessWinFactions', () => {
    useUnlockStore.getState().recordMatchOutcome('win', undefined, true);
    expect(useUnlockStore.getState().flawlessWinFactions).toEqual([]);
  });

  it('tracks flawless wins across multiple different factions', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', true);
    useUnlockStore.getState().recordMatchOutcome('win', 'Orks', true);
    useUnlockStore.getState().recordMatchOutcome('win', 'Aeldari', true);

    expect(useUnlockStore.getState().flawlessWinFactions.sort()).toEqual([
      'Aeldari',
      'Necrons',
      'Orks',
    ]);
  });
});

describe('unlockStore resetProgress', () => {
  it('wipes every counter and set back to the initial state', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', true);
    useUnlockStore.getState().recordSameOrPlusCombo();
    useUnlockStore.getState().recordChainReaction();

    useUnlockStore.getState().resetProgress();

    const state = useUnlockStore.getState();
    expect(state.totalWins).toBe(0);
    expect(state.winsByFaction).toEqual({});
    expect(state.sameOrPlusComboCount).toBe(0);
    expect(state.chainReactionCount).toBe(0);
    expect(state.flawlessWinFactions).toEqual([]);
  });
});

describe('unlockStore persistence', () => {
  it('auto-persists to localStorage on every state change, with no explicit save action', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);

    const raw = localStorage.getItem('grim-triad-unlocks');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.totalWins).toBe(1);
    expect(parsed.state.winsByFaction).toEqual({ Necrons: 1 });
  });
});