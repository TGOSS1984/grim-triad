import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeriesResultScreen } from './SeriesResultScreen';

describe('SeriesResultScreen', () => {
  it('announces the series winner', () => {
    render(
      <SeriesResultScreen
        seriesWinner="blue"
        blueWins={3}
        redWins={1}
        roundsPlayed={4}
        onPlayAgain={vi.fn()}
        onReturnToMenu={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Blue Wins the Series' })).toBeInTheDocument();
  });

  it('announces a series draw', () => {
    render(
      <SeriesResultScreen
        seriesWinner="draw"
        blueWins={2}
        redWins={2}
        roundsPlayed={4}
        onPlayAgain={vi.fn()}
        onReturnToMenu={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Series Draw' })).toBeInTheDocument();
  });

  it('shows the correct round count with pluralization', () => {
    render(
      <SeriesResultScreen
        seriesWinner="red"
        blueWins={0}
        redWins={1}
        roundsPlayed={1}
        onPlayAgain={vi.fn()}
        onReturnToMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('1 round played')).toBeInTheDocument();

    render(
      <SeriesResultScreen
        seriesWinner="red"
        blueWins={1}
        redWins={3}
        roundsPlayed={4}
        onPlayAgain={vi.fn()}
        onReturnToMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('4 rounds played')).toBeInTheDocument();
  });

  it('shows the final win tally for both sides', () => {
    render(
      <SeriesResultScreen
        seriesWinner="blue"
        blueWins={3}
        redWins={2}
        roundsPlayed={5}
        onPlayAgain={vi.fn()}
        onReturnToMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('Blue: 3')).toBeInTheDocument();
    expect(screen.getByText('Red: 2')).toBeInTheDocument();
  });

  it('calls onPlayAgain when Play Again is clicked', async () => {
    const user = userEvent.setup();
    const onPlayAgain = vi.fn();
    render(
      <SeriesResultScreen
        seriesWinner="blue"
        blueWins={3}
        redWins={1}
        roundsPlayed={4}
        onPlayAgain={onPlayAgain}
        onReturnToMenu={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play Again' }));

    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('calls onReturnToMenu when Return to Menu is clicked', async () => {
    const user = userEvent.setup();
    const onReturnToMenu = vi.fn();
    render(
      <SeriesResultScreen
        seriesWinner="blue"
        blueWins={3}
        redWins={1}
        roundsPlayed={4}
        onPlayAgain={vi.fn()}
        onReturnToMenu={onReturnToMenu}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to Menu' }));

    expect(onReturnToMenu).toHaveBeenCalledOnce();
  });
});