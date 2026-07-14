import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitCarousel } from './UnitCarousel';
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

describe('UnitCarousel', () => {
  it('shows the cheapest unit first', () => {
    const units = [
      makeUnit({ id: 'a', name: 'Expensive', points: 300 }),
      makeUnit({ id: 'b', name: 'Cheap', points: 50 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('Cheap')).toBeInTheDocument();
    expect(screen.queryByText('Expensive')).not.toBeInTheDocument();
  });

  it('shows a position indicator', () => {
    const units = [makeUnit({ id: 'a' }), makeUnit({ id: 'b' }), makeUnit({ id: 'c' })];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('Next advances to the next unit, wrapping back to the first after the last', async () => {
    const user = userEvent.setup();
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByText('Second')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('Previous goes back, wrapping to the last unit from the first', async () => {
    const user = userEvent.setup();
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Previous unit' }));
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('supports arrow-key navigation', () => {
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole('group', { name: 'Unit carousel' }), { key: 'ArrowRight' });
    expect(screen.getByText('Second')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('group', { name: 'Unit carousel' }), { key: 'ArrowLeft' });
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('supports swipe navigation via touch events', () => {
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const carousel = screen.getByRole('group', { name: 'Unit carousel' });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] }); // swiped left -> next

    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('a short touch movement below the swipe threshold does not navigate', () => {
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const carousel = screen.getByRole('group', { name: 'Unit carousel' });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 190 }] }); // only 10px - below threshold

    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('shows the running selected-unit count and pluralizes correctly', () => {
    const units = [makeUnit({ id: 'a' })];
    const { rerender } = render(
      <UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('0 units selected')).toBeInTheDocument();

    rerender(
      <UnitCarousel units={units} selectedIds={['a']} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('1 unit selected')).toBeInTheDocument();
  });

  it('shows remaining points when a cap is set, and omits it when there is none', () => {
    const units = [makeUnit({ id: 'a' })];
    const { rerender } = render(
      <UnitCarousel units={units} selectedIds={[]} remainingPoints={350} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('350 pts remaining')).toBeInTheDocument();

    rerender(
      <UnitCarousel units={units} selectedIds={[]} remainingPoints={null} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.queryByText(/pts remaining/)).not.toBeInTheDocument();
  });

  it('shows Remove for an already-selected unit and calls onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const units = [makeUnit({ id: 'a' })];
    render(
      <UnitCarousel units={units} selectedIds={['a']} remainingPoints={500} onAdd={vi.fn()} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('shows Add for an unselected unit and calls onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const units = [makeUnit({ id: 'a' })];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={onAdd} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('a');
  });

  it('disables Add when the unit is unaffordable', () => {
    const units = [makeUnit({ id: 'a', points: 400 })];
    render(<UnitCarousel units={units} selectedIds={[]} remainingPoints={100} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('disables Add when atCapacity is true', () => {
    const units = [makeUnit({ id: 'a', points: 10 })];
    render(
      <UnitCarousel units={units} selectedIds={[]} remainingPoints={500} atCapacity onAdd={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('disables Add when isDisabledExtra blocks the current unit (power-cap parity with UnitPicker)', () => {
    const units = [makeUnit({ id: 'a', points: 10 })];
    render(
      <UnitCarousel
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

  it('shows a fallback message for an empty unit list rather than crashing', () => {
    render(<UnitCarousel units={[]} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('No units available.')).toBeInTheDocument();
  });

  it('clamps back into range if the units list shrinks below the current index', () => {
    const units = [
      makeUnit({ id: 'a', name: 'First', points: 10 }),
      makeUnit({ id: 'b', name: 'Second', points: 20 }),
    ];
    const { rerender } = render(
      <UnitCarousel units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByText('Second')).toBeInTheDocument();

    // Units list shrinks to just the first one - index 1 no longer exists.
    rerender(
      <UnitCarousel
        units={[units[0]]}
        selectedIds={[]}
        remainingPoints={500}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});