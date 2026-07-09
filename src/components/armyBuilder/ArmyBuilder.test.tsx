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

function addUnitByName(name: string) {
  const row = screen.getByText(name).closest('li')!;
  const addButton = row.querySelector('button')!;
  return addButton;
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

    const row = screen.getByText(CAPTAIN).closest('li')!;
    await user.click(row.querySelector('button')!); // Add
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(1);

    await user.click(row.querySelector('button')!); // now Remove
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