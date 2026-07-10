import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArmyBuilder } from './ArmyBuilder';
import { useArmyBuilderStore } from '../../state/armyBuilderStore';

// Real generated Blood Angels units (see src/data/units.generated.json).
const CAPTAIN = 'Blood Angels Captain'; // 80pts
const DEATH_COMPANY = 'Death Company Marines'; // 85pts
const SANGUINARY_PRIEST = 'Sanguinary Priest'; // 90pts
const ASTORATH = 'Astorath'; // 105pts
const LEMARTES = 'Lemartes'; // 110pts

beforeEach(() => {
  useArmyBuilderStore.getState().reset();
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