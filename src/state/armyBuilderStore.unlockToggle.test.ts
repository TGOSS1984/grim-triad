import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocking './unlockStore' before anything imports armyBuilderStore.ts is
// what lets this override ENABLE_CARD_UNLOCKS - vi.mock calls are hoisted
// above imports by Vitest, so this takes effect before
// armyBuilderStore.ts's own `import { ENABLE_CARD_UNLOCKS } from
// './unlockStore'` resolves. Kept in its own file (rather than mixed into
// armyBuilderStore.test.ts) specifically so this mock doesn't affect that
// file's many other tests, which need the real, on-by-default toggle.
vi.mock('./unlockStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./unlockStore')>();
  return { ...actual, ENABLE_CARD_UNLOCKS: false };
});

import { useArmyBuilderStore } from './armyBuilderStore';

beforeEach(() => {
  useArmyBuilderStore.getState().reset();
});

describe('armyBuilderStore with ENABLE_CARD_UNLOCKS off', () => {
  it('isUnitLocked always returns false, even for an expensive unit with zero unlock progress', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');

    // 240pts - would be locked under the real tier-200-250 rule with no
    // progress (see armyBuilderStore.test.ts's own unlock-gating tests) -
    // this confirms the switch actually bypasses that, not just in theory.
    expect(store.isUnitLocked('space-marines-land-raider')).toBe(false);
  });

  it('addUnit succeeds for that same expensive unit with zero unlock progress', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);

    const added = store.addUnit('space-marines-land-raider');

    expect(added).toBe(true);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual(['space-marines-land-raider']);
  });
});