import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitPicker } from './UnitPicker';
import type { Unit } from '../../data/schema';

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    name: 'Test Unit',
    faction: 'Necrons',
    battlefieldRole: 'Infantry',
    unitType: 'Infantry',
    keywords: [],
    points: 100,
    statBudget: 20,
    stats: { top: 5, bottom: 6, left: 7, right: 8 },
    portraitPath: 'assets/factions/necrons/units/test-unit.png',
    element: 'void',
    ...overrides,
  };
}

describe('UnitPicker', () => {
  it('renders every unit, sorted cheapest-first', () => {
    const units = [
      makeUnit({ id: 'a', name: 'Expensive', points: 300 }),
      makeUnit({ id: 'b', name: 'Cheap', points: 50 }),
    ];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Cheap');
    expect(rows[1]).toHaveTextContent('Expensive');
  });

  it('shows an Add button for an unselected, affordable unit', () => {
    const units = [makeUnit({ id: 'a', points: 100 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={200} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('disables Add when the unit costs more than remainingPoints', () => {
    const units = [makeUnit({ id: 'a', points: 300 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={100} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('shows a Remove button instead of Add for an already-selected unit', () => {
    const units = [makeUnit({ id: 'a' })];
    render(<UnitPicker units={units} selectedIds={['a']} remainingPoints={0} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it('calls onAdd with the unit id when Add is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const units = [makeUnit({ id: 'unit-xyz', points: 50 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={100} onAdd={onAdd} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith('unit-xyz');
  });

  it('calls onRemove with the unit id when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const units = [makeUnit({ id: 'unit-xyz' })];
    render(
      <UnitPicker units={units} selectedIds={['unit-xyz']} remainingPoints={0} onAdd={vi.fn()} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).toHaveBeenCalledWith('unit-xyz');
  });

  it('disables Add for every unit when remainingPoints is null (no cap chosen yet)', () => {
    const units = [makeUnit({ id: 'a', points: 1 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={null} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('disables Add for an affordable, unselected unit when atCapacity is true', () => {
    const units = [makeUnit({ id: 'a', points: 1 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        atCapacity
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('still allows Remove on an already-selected unit even when atCapacity is true', () => {
    const units = [makeUnit({ id: 'a' })];
    render(
      <UnitPicker
        units={units}
        selectedIds={['a']}
        remainingPoints={0}
        atCapacity
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it("renders each row as a real Card showing the unit's own name and stats, not a flat portrait image", () => {
    const units = [makeUnit({ id: 'a', name: 'Dante', stats: { top: 8, bottom: 5, left: 6, right: 4 } })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    // The Card itself (non-interactive, role="img") is nested inside the
    // row's clickable preview button - its accessible name is the unit
    // name, same as Hand/Board render it.
    expect(screen.getByRole('img', { name: 'Dante' })).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows a floating zoom preview Card on hover', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Dante' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getAllByRole('img', { name: 'Dante' })).toHaveLength(1);
    await user.hover(screen.getByRole('button', { name: 'View larger card for Dante' }));

    // Two Cards now exist for the same unit: the small row card plus the
    // floating preview portalled to document.body. The preview itself is
    // aria-hidden (it's a decorative duplicate - the row card is already
    // reachable), so `hidden: true` is needed here to include it in the
    // query at all; that's intentional and correct, not a workaround.
    expect(screen.getAllByRole('img', { name: 'Dante', hidden: true })).toHaveLength(2);
  });

  it('hides the zoom preview again on unhover', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Dante' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'View larger card for Dante' });
    await user.hover(button);
    await user.unhover(button);

    expect(screen.getAllByRole('img', { name: 'Dante', hidden: true })).toHaveLength(1);
  });

  it('opens a lightbox with a full-size Card (same name/stats) when the row card is clicked', async () => {
    const user = userEvent.setup();
    const units = [
      makeUnit({ id: 'a', name: 'Dante', stats: { top: 8, bottom: 5, left: 6, right: 4 } }),
    ];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'View larger card for Dante' }));

    expect(screen.getAllByRole('img', { name: 'Dante' })).toHaveLength(2); // row card + lightbox card
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
  });

  it('closes the lightbox when the close button is clicked', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Dante' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'View larger card for Dante' }));
    await user.click(screen.getByRole('button', { name: 'Close image' }));

    expect(screen.getAllByRole('img', { name: 'Dante' })).toHaveLength(1); // only the row card remains
  });

  it('closes the lightbox on Escape', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Dante' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'View larger card for Dante' }));
    await user.keyboard('{Escape}');

    expect(screen.getAllByRole('img', { name: 'Dante' })).toHaveLength(1);
  });

  it("always shows a unit's element badge, regardless of whether any match rule set is in play (roster is a catalog view, not a live match)", () => {
    const units = [makeUnit({ id: 'a', name: 'Dante', element: 'warp' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByTitle('Warp affinity')).toBeInTheDocument();
  });

  it('disables Add for a unit specifically blocked by isDisabledExtra, even though it is otherwise affordable and not at capacity', () => {
    const units = [makeUnit({ id: 'a', points: 1 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isDisabledExtra={(id) => id === 'a'}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('isDisabledExtra only blocks the SPECIFIC unit it applies to, not every row uniformly', () => {
    const units = [
      makeUnit({ id: 'a', name: 'Blocked Unit', points: 1 }),
      makeUnit({ id: 'b', name: 'Allowed Unit', points: 1 }),
    ];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isDisabledExtra={(id) => id === 'a'}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    const blockedRow = rows.find((r) => r.textContent?.includes('Blocked Unit'))!;
    const allowedRow = rows.find((r) => r.textContent?.includes('Allowed Unit'))!;
    expect(within(blockedRow).getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(within(allowedRow).getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('still allows Remove on an already-selected unit even when isDisabledExtra would block adding it', () => {
    const units = [makeUnit({ id: 'a' })];
    render(
      <UnitPicker
        units={units}
        selectedIds={['a']}
        remainingPoints={500}
        isDisabledExtra={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it('with no isDisabledExtra given, Add is unaffected (defaults to never blocking)', () => {
    const units = [makeUnit({ id: 'a', points: 1 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });
});

describe('UnitPicker locked units', () => {
  it('with no isLocked given, every unit behaves as unlocked (defaults to never locking)', () => {
    const units = [makeUnit({ id: 'a', points: 300 })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('shows "Locked" instead of "Add", disabled, for a locked unit even if otherwise affordable', () => {
    const units = [makeUnit({ id: 'a', points: 100 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const lockedButton = screen.getByRole('button', { name: 'Locked' });
    expect(lockedButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('clicking a locked unit\'s card does not call onAdd - locking blocks the Add button, not just relabels it', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const units = [makeUnit({ id: 'a', points: 100 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Locked' }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows the unlock tier description in place of the ordinary role/type meta line', () => {
    // 240pts falls into unlockCriteria.ts's tier-200-250 ("Win 10 games").
    const units = [makeUnit({ id: 'a', points: 240, battlefieldRole: 'Vehicle' })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(/Win 10 games/)).toBeInTheDocument();
    expect(screen.queryByText('Vehicle')).not.toBeInTheDocument();
  });

  it('prefers LIVE progress from getUnlockProgress over the static tier description, when provided', () => {
    const units = [makeUnit({ id: 'a', points: 240, battlefieldRole: 'Vehicle' })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        getUnlockProgress={() => ({ current: 6, target: 10, label: 'games won' })}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(/6\/10 games won/)).toBeInTheDocument();
    expect(screen.queryByText(/Win 10 games/)).not.toBeInTheDocument();
  });

  it('falls back to the static tier description if getUnlockProgress returns null despite the unit being locked', () => {
    const units = [makeUnit({ id: 'a', points: 240 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        getUnlockProgress={() => null}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(/Win 10 games/)).toBeInTheDocument();
  });

  it('shows live progress in the Lightbox caption too, not just the row', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Progress Unit', points: 240 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        getUnlockProgress={() => ({ current: 3, target: 10, label: 'wins with Necrons' })}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /View larger card for locked unit Progress Unit/ }));

    expect(screen.getByText('Locked - 3/10 wins with Necrons')).toBeInTheDocument();
  });

  it('a locked unit still opens its card in the Lightbox when clicked - browsing what you could unlock is allowed', async () => {
    const user = userEvent.setup();
    const units = [makeUnit({ id: 'a', name: 'Mystery Titan', points: 600 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={500}
        isLocked={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /View larger card for locked unit Mystery Titan/ }));

    expect(screen.getAllByText('Mystery Titan').length).toBeGreaterThan(0);
  });

  it('an already-selected unit shows Remove (not Locked), even if isLocked would return true for it', () => {
    // Once genuinely in the army, a unit is never re-locked out from under
    // the player - isLocked only ever gates ADDING a new unit.
    const units = [makeUnit({ id: 'a', points: 600 })];
    render(
      <UnitPicker
        units={units}
        selectedIds={['a']}
        remainingPoints={500}
        isLocked={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Locked' })).not.toBeInTheDocument();
  });

  it('locking is per-unit, not all-or-nothing across the whole list', () => {
    const units = [
      makeUnit({ id: 'cheap', name: 'Cheap Unit', points: 50 }),
      makeUnit({ id: 'pricey', name: 'Pricey Unit', points: 600 }),
    ];
    render(
      <UnitPicker
        units={units}
        selectedIds={[]}
        remainingPoints={1000}
        isLocked={(unitId) => unitId === 'pricey'}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByRole('button', { name: 'Add' })).toBeEnabled();
    expect(within(rows[1]).getByRole('button', { name: 'Locked' })).toBeDisabled();
  });
});