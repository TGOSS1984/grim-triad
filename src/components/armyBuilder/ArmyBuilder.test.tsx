import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArmyBuilder } from './ArmyBuilder';
import { useArmyBuilderStore } from '../../state/armyBuilderStore';
import { useUnlockStore } from '../../state/unlockStore';

// Real generated Blood Angels units (see src/data/units.generated.json).
const CAPTAIN = 'Blood Angels Captain'; // 80pts
const DEATH_COMPANY = 'Death Company Marines'; // 85pts
const SANGUINARY_PRIEST = 'Sanguinary Priest'; // 90pts
const ASTORATH = 'Astorath'; // 105pts
const LEMARTES = 'Lemartes'; // 110pts
// Power units (>150pts, the campaign power-unit threshold) - from the
// shared generic Space Marine pool, cheapest-first.
const POWER_UNIT_1 = 'Stormhawk Interceptor'; // 155pts
const POWER_UNIT_2 = 'Brutalis Dreadnought'; // 160pts
const POWER_UNIT_3 = 'Gladiator Lancer'; // 160pts
const POWER_UNIT_4 = 'Gladiator Reaper'; // 160pts
const POWER_UNIT_5 = 'Gladiator Valiant'; // 160pts
const POWER_UNIT_6 = 'Stormtalon Gunship'; // 165pts

beforeEach(() => {
  useArmyBuilderStore.getState().reset();
  useUnlockStore.getState().resetProgress();
});

/**
 * Finds a row's Add/Remove/thumbnail buttons by accessible text, not just
 * "the/first button in the row" - the row's thumbnail is also a real
 * <button> now (see UnitPicker.tsx's hover-zoom/lightbox), and it comes
 * before Add/Remove in DOM order.
 */
function getRowActionButton(name: string) {
  // getAllByText, not getByText: the unit name now appears twice per row -
  // once inside the row's real Card (its own name plate) and once in
  // UnitPicker's own info panel next to it. Either match's closest li is
  // the same row, so just take the first.
  const row = screen.getAllByText(name)[0].closest('li')!;
  return Array.from(row.querySelectorAll('button')).find(
    (button) => button.textContent === 'Add' || button.textContent === 'Remove',
  )!;
}

function addUnitByName(name: string) {
  return getRowActionButton(name);
}

describe('ArmyBuilder', () => {
  it('only shows the points cap step after a faction is chosen', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);

    expect(screen.queryByText('Choose Points Limit')).not.toBeInTheDocument();

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.getByText('Choose Points Limit')).toBeInTheDocument();
  });

  it('only shows the unit picker after both faction and points cap are chosen', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    expect(screen.queryByText('Build Your Army')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '500 pts' }));
    expect(screen.getByText('Build Your Army')).toBeInTheDocument();
  });

  it('adding a unit updates the live points tally', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));

    expect(screen.getByText('0 / 500 pts')).toBeInTheDocument();

    await user.click(addUnitByName(CAPTAIN));

    expect(screen.getByText('80 / 500 pts')).toBeInTheDocument();
    expect(screen.getByText('420 remaining')).toBeInTheDocument();
  });

  it('the Continue button is disabled below the minimum army size and enables at 5 units', async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    render(<ArmyBuilder onReady={onReady} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));

    expect(screen.getByRole('button', { name: /Select at least 5 units/ })).toBeDisabled();

    for (const unitName of [CAPTAIN, DEATH_COMPANY, SANGUINARY_PRIEST, ASTORATH, LEMARTES]) {
      await user.click(addUnitByName(unitName));
    }

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();

    await user.click(continueButton);
    expect(onReady.mock.calls[0][0]).toHaveLength(5);
  });

  it('removing a unit via its row button updates the store', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));

    await user.click(getRowActionButton(CAPTAIN)); // Add
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(1);

    await user.click(getRowActionButton(CAPTAIN)); // now Remove
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(0);
  });

  it('switching factions clears any previously selected units', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));
    await user.click(addUnitByName(CAPTAIN));
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(1);

    await user.click(screen.getByRole('listitem', { name: /Necrons/ }));

    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(0);
  });
});

describe('ArmyBuilder with forcedPointsCap (campaign mode)', () => {
  it('does not show the manual points-cap picker when a cap is forced', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={1000} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.queryByText('Choose Points Limit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1000 pts' })).not.toBeInTheDocument();
  });

  it('goes straight to the unit picker once a faction is chosen, with the forced cap already applied', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={1000} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.getByText('Build Your Army')).toBeInTheDocument();
    expect(screen.getByText('0 / 1000 pts')).toBeInTheDocument();
  });

  it('still enforces the forced cap when adding units', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={1000} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(addUnitByName(CAPTAIN));

    expect(screen.getByText('80 / 1000 pts')).toBeInTheDocument();
  });
});

describe('ArmyBuilder with requiredArmySize (series mode)', () => {
  it('Continue stays disabled below AND requires exactly the required size, not just "at least"', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={3} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));

    expect(
      screen.getByRole('button', { name: /Select exactly 3 units/ }),
    ).toBeDisabled();

    await user.click(addUnitByName(CAPTAIN));
    await user.click(addUnitByName(DEATH_COMPANY));
    expect(
      screen.getByRole('button', { name: /Select exactly 3 units \(2\/3\)/ }),
    ).toBeDisabled();

    await user.click(addUnitByName(SANGUINARY_PRIEST));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('cannot select MORE than requiredArmySize, unlike single-match mode', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={2} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));
    await user.click(addUnitByName(CAPTAIN));
    await user.click(addUnitByName(DEATH_COMPANY));

    // A third, perfectly affordable unit should now be un-addable.
    expect(getRowActionButton(SANGUINARY_PRIEST)).toBeDisabled();
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(2);
  });

  it('onReady receives exactly requiredArmySize unit ids when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    render(<ArmyBuilder onReady={onReady} requiredArmySize={2} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));
    await user.click(addUnitByName(CAPTAIN));
    await user.click(addUnitByName(DEATH_COMPANY));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onReady.mock.calls[0][0]).toHaveLength(2);
  });
});

describe('ArmyBuilder errorMessage', () => {
  it('shows no error banner by default', () => {
    render(<ArmyBuilder onReady={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the given error message as an alert when provided', () => {
    render(<ArmyBuilder onReady={vi.fn()} errorMessage="Something went wrong, try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong, try again.');
  });

  it('preserves the current selection when an error is shown (does not reset the builder)', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} errorMessage="Try a smaller pool." />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '500 pts' }));
    await user.click(addUnitByName(CAPTAIN));

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([
      'blood-angels-blood-angels-captain',
    ]);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('ArmyBuilder with enforcePowerCap (campaign mode)', () => {
  it('does not show the power-unit tally when enforcePowerCap is false (default)', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.queryByText(/Power units/)).not.toBeInTheDocument();
  });

  it('shows a live power-unit tally starting at 0', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} enforcePowerCap />);

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.getByText('Power units (over 150pts): 0/5')).toBeInTheDocument();
  });

  it('the tally increments as power units (>150pts) are added, but not for regular units', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} enforcePowerCap />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    await user.click(addUnitByName(CAPTAIN)); // 80pts - not a power unit
    expect(screen.getByText('Power units (over 150pts): 0/5')).toBeInTheDocument();

    await user.click(addUnitByName(POWER_UNIT_1)); // 155pts - a power unit
    expect(screen.getByText('Power units (over 150pts): 1/5')).toBeInTheDocument();
  });

  it('disables Add for a 6th power unit once the 5-power-unit cap is reached, even though it is otherwise affordable', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} enforcePowerCap />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    for (const name of [POWER_UNIT_1, POWER_UNIT_2, POWER_UNIT_3, POWER_UNIT_4, POWER_UNIT_5]) {
      await user.click(addUnitByName(name));
    }
    expect(screen.getByText('Power units (over 150pts): 5/5')).toBeInTheDocument();

    expect(getRowActionButton(POWER_UNIT_6)).toBeDisabled();
  });

  it('still allows adding a REGULAR (non-power) unit even once the power-unit cap is maxed out', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} enforcePowerCap />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    for (const name of [POWER_UNIT_1, POWER_UNIT_2, POWER_UNIT_3, POWER_UNIT_4, POWER_UNIT_5]) {
      await user.click(addUnitByName(name));
    }

    // A regular, affordable, non-power unit should still be addable -
    // the cap only blocks MORE power units, not the whole roster.
    expect(getRowActionButton(CAPTAIN)).toBeEnabled();
    await user.click(addUnitByName(CAPTAIN));
    expect(useArmyBuilderStore.getState().selectedUnitIds).toContain(
      'blood-angels-blood-angels-captain',
    );
  });

  it('removing a power unit frees up a slot under the cap again', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} enforcePowerCap />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    for (const name of [POWER_UNIT_1, POWER_UNIT_2, POWER_UNIT_3, POWER_UNIT_4, POWER_UNIT_5]) {
      await user.click(addUnitByName(name));
    }
    expect(getRowActionButton(POWER_UNIT_6)).toBeDisabled();

    await user.click(getRowActionButton(POWER_UNIT_1)); // now Remove
    expect(screen.getByText('Power units (over 150pts): 4/5')).toBeInTheDocument();
    expect(getRowActionButton(POWER_UNIT_6)).toBeEnabled();
  });
});

describe('ArmyBuilder List/Carousel view toggle', () => {
  it('defaults to List View', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.getByRole('button', { name: 'List View', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Available units' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Unit carousel' })).not.toBeInTheDocument();
  });

  it('switches to Carousel View and back, preserving the existing selection either way', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(addUnitByName(CAPTAIN));

    await user.click(screen.getByRole('button', { name: 'Carousel View' }));

    expect(screen.getByRole('group', { name: 'Unit carousel' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Available units' })).not.toBeInTheDocument();
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([
      'blood-angels-blood-angels-captain',
    ]);

    await user.click(screen.getByRole('button', { name: 'List View' }));
    expect(screen.getByRole('list', { name: 'Available units' })).toBeInTheDocument();
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([
      'blood-angels-blood-angels-captain',
    ]);
  });

  it('adding a unit via the Carousel view actually updates the store, same as the List view', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: 'Carousel View' }));

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(useArmyBuilderStore.getState().selectedUnitIds.length).toBe(1);
  });
});

describe('ArmyBuilder Randomize Army button', () => {
  it('single-match mode (open-ended, at least 5): fills a legal army within the points cap', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '1000 pts' }));

    await user.click(screen.getByRole('button', { name: 'Randomize Army' }));

    const { selectedUnitIds } = useArmyBuilderStore.getState();
    expect(selectedUnitIds.length).toBeGreaterThanOrEqual(5);
    expect(useArmyBuilderStore.getState().totalPoints()).toBeLessThanOrEqual(1000);
    expect(new Set(selectedUnitIds).size).toBe(selectedUnitIds.length); // no duplicates
  });

  it('series mode (exact size): fills exactly the required pool size', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={15} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    await user.click(screen.getByRole('button', { name: 'Randomize Army' }));

    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(15);
    expect(useArmyBuilderStore.getState().totalPoints()).toBeLessThanOrEqual(2000);
  });

  it('campaign mode: fills exactly the required size while respecting the live power-unit cap', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={15} forcedPointsCap={1500} enforcePowerCap />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    await user.click(screen.getByRole('button', { name: 'Randomize Army' }));

    const { selectedUnitIds } = useArmyBuilderStore.getState();
    expect(selectedUnitIds).toHaveLength(15);
    expect(useArmyBuilderStore.getState().totalPoints()).toBeLessThanOrEqual(1500);
    // The live power-cap tally should reflect a legal roster - never over the 5-unit cap.
    expect(screen.getByText(/Power units \(over 150pts\): [0-5]\/5/)).toBeInTheDocument();
  });

  it('Randomize Army still fills the exact required size when unlock progress is zero (locked units correctly excluded from candidates, not just rejected after the fact)', async () => {
    // Real regression: with zero unlock progress, every 200+pt unit is
    // locked (see data/unlockCriteria.ts). If the randomizer picked from
    // ALL units and only found out a pick was locked when addUnit later
    // refused it, an { exact: 15 } target could come up short (this
    // genuinely happened - 14 instead of 15 - before handleRandomize's
    // isBlocked predicate was updated to exclude locked candidates up
    // front, the same way it already did for campaign's power-unit cap).
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={15} forcedPointsCap={1500} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    await user.click(screen.getByRole('button', { name: 'Randomize Army' }));

    const store = useArmyBuilderStore.getState();
    expect(store.selectedUnitIds).toHaveLength(15);
    for (const unitId of store.selectedUnitIds) {
      expect(store.isUnitLocked(unitId)).toBe(false);
    }
  });

  it('replaces the current selection entirely, rather than adding on top of it', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(addUnitByName(CAPTAIN));
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([
      'blood-angels-blood-angels-captain',
    ]);

    await user.click(screen.getByRole('button', { name: 'Randomize Army' }));

    // Manually-picked selection is gone, replaced by a fresh random one -
    // not just added to (which would risk exceeding a series/campaign's
    // exact target size).
    const { selectedUnitIds } = useArmyBuilderStore.getState();
    expect(selectedUnitIds.length).toBeGreaterThanOrEqual(5);
  });

  it('clicking it again produces a genuinely different random selection (not cached/frozen)', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} requiredArmySize={15} forcedPointsCap={2000} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    const results = new Set<string>();
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: 'Randomize Army' }));
      results.add([...useArmyBuilderStore.getState().selectedUnitIds].sort().join(','));
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it('does nothing (no crash) if clicked before a points cap has been chosen', async () => {
    const user = userEvent.setup();
    render(<ArmyBuilder onReady={vi.fn()} />);
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    // Points cap picker is showing, nothing chosen yet - the Randomize
    // button isn't even rendered at this point (same section gate as the
    // rest of "Build Your Army"), confirming that rather than clicking
    // something that doesn't exist.
    expect(screen.queryByRole('button', { name: 'Randomize Army' })).not.toBeInTheDocument();
  });
});