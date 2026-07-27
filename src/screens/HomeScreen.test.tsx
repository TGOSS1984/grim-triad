import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';

function renderScreen(overrides: Partial<Parameters<typeof HomeScreen>[0]> = {}) {
  const onNewGame = vi.fn();
  const onViewProgress = vi.fn();
  const onShowHowToPlay = vi.fn();
  render(
    <HomeScreen
      onNewGame={onNewGame}
      onViewProgress={onViewProgress}
      onShowHowToPlay={onShowHowToPlay}
      {...overrides}
    />,
  );
  return { onNewGame, onViewProgress, onShowHowToPlay };
}

describe('HomeScreen', () => {
  it('renders the game title', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
  });

  it('calls onNewGame when the New Game button is clicked', async () => {
    const user = userEvent.setup();
    const { onNewGame } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onViewProgress when the Progress & Achievements button is clicked', async () => {
    const user = userEvent.setup();
    const { onViewProgress } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Progress & Achievements' }));

    expect(onViewProgress).toHaveBeenCalledOnce();
  });

  it('calls onShowHowToPlay when the How to Play button is clicked', async () => {
    const user = userEvent.setup();
    const { onShowHowToPlay } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'How to Play' }));

    expect(onShowHowToPlay).toHaveBeenCalledOnce();
  });
});