import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    stats: { top: 5, bottom: 5, left: 5, right: 5 },
    portraitPath: 'assets/factions/necrons/units/test-unit.png',
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

  it("renders each unit's portrait thumbnail with a root-relative src", () => {
    const units = [makeUnit({ id: 'a', portraitPath: 'assets/factions/necrons/units/a.png' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const row = screen.getAllByRole('listitem')[0];
    const thumbnail = row.querySelector('img') as HTMLImageElement;
    expect(thumbnail.getAttribute('src')).toBe('/assets/factions/necrons/units/a.png');
  });

  it('falls back to a same-named .webp if the original (.png) fails to load', () => {
    const units = [makeUnit({ id: 'a', portraitPath: 'assets/factions/necrons/units/a.png' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const row = screen.getAllByRole('listitem')[0];
    fireEvent.error(row.querySelector('img')!);

    const updated = row.querySelector('img') as HTMLImageElement;
    expect(updated.getAttribute('src')).toBe('/assets/factions/necrons/units/a.webp');
  });

  it('falls back to a placeholder block if both the original and .webp fail to load', () => {
    const units = [makeUnit({ id: 'a' })];
    render(<UnitPicker units={units} selectedIds={[]} remainingPoints={500} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const row = screen.getAllByRole('listitem')[0];
    fireEvent.error(row.querySelector('img')!); // original fails
    fireEvent.error(row.querySelector('img')!); // .webp fails too

    expect(row.querySelector('img')).not.toBeInTheDocument();
    expect(row.querySelector('[class*="thumbnailPlaceholder"]')).toBeInTheDocument();
  });
});