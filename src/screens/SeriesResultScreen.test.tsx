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
        onNewGame={vi.fn()}
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
        onNewGame={vi.fn()}
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
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText('1 round played')).toBeInTheDocument();

    render(
      <SeriesResultScreen
        seriesWinner="red"
        blueWins={1}
        redWins={3}
        roundsPlayed={4}
        onNewGame={vi.fn()}
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
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText('Blue: 3')).toBeInTheDocument();
    expect(screen.getByText('Red: 2')).toBeInTheDocument();
  });

  it('calls onNewGame when New Game is clicked', async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    render(
      <SeriesResultScreen
        seriesWinner="blue"
        blueWins={3}
        redWins={1}
        roundsPlayed={4}
        onNewGame={onNewGame}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(onNewGame).toHaveBeenCalledOnce();
  });
});