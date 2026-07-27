import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('renders the game title', () => {
    render(<HomeScreen onNewGame={vi.fn()} onViewProgress={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
  });

  it('calls onNewGame when the New Game button is clicked', async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    render(<HomeScreen onNewGame={onNewGame} onViewProgress={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onViewProgress when the Progress & Achievements button is clicked', async () => {
    const user = userEvent.setup();
    const onViewProgress = vi.fn();
    render(<HomeScreen onNewGame={vi.fn()} onViewProgress={onViewProgress} />);

    await user.click(screen.getByRole('button', { name: 'Progress & Achievements' }));

    expect(onViewProgress).toHaveBeenCalledOnce();
  });
});