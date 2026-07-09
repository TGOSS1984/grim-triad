import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionSelect } from './FactionSelect';

describe('FactionSelect', () => {
  it('renders a button for each active roster', () => {
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    expect(screen.getByRole('listitem', { name: /Blood Angels/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Tyranids/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Necrons/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Aeldari/ })).toBeInTheDocument();
  });

  it('calls onSelectRoster with the faction name when clicked', async () => {
    const user = userEvent.setup();
    const onSelectRoster = vi.fn();
    render(<FactionSelect selectedRosterName={null} onSelectRoster={onSelectRoster} />);

    await user.click(screen.getByRole('listitem', { name: /Necrons/ }));

    expect(onSelectRoster).toHaveBeenCalledWith('Necrons');
  });

  it('marks only the currently selected roster as pressed', () => {
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
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    const icon = necronsRow.querySelector('img') as HTMLImageElement;
    expect(icon.getAttribute('src')).toBe('/assets/factions/necrons/icon.png');
  });

  it('falls back to .webp if .png fails to load', () => {
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    const icon = necronsRow.querySelector('img') as HTMLImageElement;

    fireEvent.error(icon);

    const updated = necronsRow.querySelector('img') as HTMLImageElement;
    expect(updated.getAttribute('src')).toBe('/assets/factions/necrons/icon.webp');
  });

  it('hides gracefully (renders nothing) if both .png and .webp fail', () => {
    render(<FactionSelect selectedRosterName={null} onSelectRoster={vi.fn()} />);

    const necronsRow = screen.getByRole('listitem', { name: /Necrons/ });
    fireEvent.error(necronsRow.querySelector('img')!); // .png fails
    fireEvent.error(necronsRow.querySelector('img')!); // .webp fails too

    expect(necronsRow.querySelector('img')).not.toBeInTheDocument();
  });
});