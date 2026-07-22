import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionSelect } from './FactionSelect';

describe('FactionSelect', () => {
  it('groups active factions into alignment sections with counts', () => {
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Imperium/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chaos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xenos/ })).toBeInTheDocument();
  });

  it('opens the first group by default when nothing is selected', () => {
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    const imperiumHeader = screen.getByRole('button', { name: /Imperium/ });
    expect(imperiumHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listitem', { name: /Blood Angels/ })).toBeInTheDocument();
  });

  it('opens the group containing the selected faction, collapsing the rest', () => {
    render(<FactionSelect selectedRosterName="Necrons" onSelectRoster={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Xenos/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Imperium/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('listitem', { name: /Necrons/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('accordion: opening one group closes the previously open one', async () => {
    const user = userEvent.setup();
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Imperium/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Xenos/ }));

    expect(screen.getByRole('button', { name: /Xenos/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Imperium/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('calls onSelectRoster with the faction name when a faction card is clicked', async () => {
    const user = userEvent.setup();
    const onSelectRoster = vi.fn();
    render(<FactionSelect selectedRosterName="Necrons" onSelectRoster={onSelectRoster} />);

    await user.click(screen.getByRole('listitem', { name: /Necrons/ }));

    expect(onSelectRoster).toHaveBeenCalledWith('Necrons');
  });

  it('marks only the currently selected roster as pressed within its group', () => {
    render(<FactionSelect selectedRosterName="Aeldari" onSelectRoster={vi.fn()} />);

    expect(screen.getByRole('listitem', { name: /Aeldari/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('listitem', { name: /Necrons/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('tries .png first for the faction icon', () => {
    render(<FactionSelect selectedRosterName="Necrons" onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    const icon = necronsRow.querySelector('img') as HTMLImageElement;
    expect(icon.getAttribute('src')).toBe('/assets/factions/necrons/icon.png');
  });

  it('falls back to .webp if .png fails to load', () => {
    render(<FactionSelect selectedRosterName="Necrons" onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    const icon = necronsRow.querySelector('img') as HTMLImageElement;

    fireEvent.error(icon);

    const updated = necronsRow.querySelector('img') as HTMLImageElement;
    expect(updated.getAttribute('src')).toBe('/assets/factions/necrons/icon.webp');
  });

  it('hides gracefully (renders nothing) if both .png and .webp fail', () => {
    render(<FactionSelect selectedRosterName="Necrons" onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    fireEvent.error(necronsRow.querySelector('img')!); // .png fails
    fireEvent.error(necronsRow.querySelector('img')!); // .webp fails too

    expect(necronsRow.querySelector('img')).not.toBeInTheDocument();
  });
});