import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});