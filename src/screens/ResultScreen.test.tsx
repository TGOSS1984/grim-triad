import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultScreen } from './ResultScreen';
import { useGameStore } from '../state/gameStore';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';
import type { Card, GameState } from '../engine/types';
import { createEmptyBoard } from '../engine/board';

// Real generated unit ids (see src/data/units.generated.json).
const BA_CAPTAIN = 'blood-angels-blood-angels-captain'; // "Blood Angels Captain"
const NECRON_LYCHGUARD = 'necrons-lychguard'; // "Lychguard"

function makeCard(unitId: string, owner: 'blue' | 'red', instanceId: string, points?: number): Card {
  return { instanceId, unitId, owner, stats: { top: 5, bottom: 5, left: 5, right: 5 }, points };
}

/** Builds a finished GameState directly (bypassing full play) for screen-level testing. */
function finishedGame(overrides: Partial<GameState> = {}): GameState {
  const board = createEmptyBoard();
  board[0][0].card = makeCard(BA_CAPTAIN, 'blue', 'blue-1');
  board[0][1].card = makeCard(BA_CAPTAIN, 'blue', 'blue-2');
  board[1][0].card = makeCard(NECRON_LYCHGUARD, 'red', 'red-1');

  return {
    board,
    players: {
      blue: { colour: 'blue', hand: [] },
      red: { colour: 'red', hand: [] },
    },
    activePlayer: 'blue',
    ruleSet: DEFAULT_RULE_SET,
    phase: 'finished',
    winner: 'blue',
    history: [{ player: 'blue', card: makeCard(BA_CAPTAIN, 'blue', 'blue-1'), position: { row: 0, col: 0 } }],
    ...overrides,
  };
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('ResultScreen', () => {
  it('shows a fallback message when there is no game', () => {
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it('shows a fallback message when the game exists but is not finished', () => {
    useGameStore.setState({ game: { ...finishedGame(), phase: 'playing' } });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it('announces the winner', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'blue' }) });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Blue Wins!' })).toBeInTheDocument();
  });

  it('announces a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Draw' })).toBeInTheDocument();
  });

  it('shows the correct final card counts per side', () => {
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('Blue: 2 cards')).toBeInTheDocument();
    expect(screen.getByText('Red: 1 card')).toBeInTheDocument();
  });

  it('shows no points row when winCondition is "cards" (the default)', () => {
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByText('Decided by total points')).not.toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it('shows a points row with the real totals and a "decided by" caption when winCondition is "points"', () => {
    const board = createEmptyBoard();
    board[0][0].card = makeCard(BA_CAPTAIN, 'blue', 'blue-1', 100);
    board[0][1].card = makeCard(BA_CAPTAIN, 'blue', 'blue-2', 50);
    board[1][0].card = makeCard(NECRON_LYCHGUARD, 'red', 'red-1', 300);

    useGameStore.setState({
      game: finishedGame({
        board,
        winner: 'red',
        ruleSet: { ...DEFAULT_RULE_SET, winCondition: 'points' },
      }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByText('Decided by total points')).toBeInTheDocument();
    expect(screen.getByText('Blue: 150 pts')).toBeInTheDocument();
    expect(screen.getByText('Red: 300 pts')).toBeInTheDocument();
    // Card counts still shown too - points is additive, not a replacement.
    expect(screen.getByText('Blue: 2 cards')).toBeInTheDocument();
    expect(screen.getByText('Red: 1 card')).toBeInTheDocument();
  });

  it('shows "No captures this match." by default (fresh gameStore, nothing tallied)', () => {
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('No captures this match.')).toBeInTheDocument();
  });

  it('shows the real capture breakdown from gameStore when there is one', () => {
    useGameStore.setState({
      game: finishedGame(),
      matchBlueCaptureBreakdown: { base: 2, same: 1, plus: 0, chain: 0 },
      matchRedCaptureBreakdown: { base: 0, same: 0, plus: 1, chain: 0 },
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Captures' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No captures this match.')).not.toBeInTheDocument();
  });

  it('resolves the Trade Rule with real unit names for a One-rule win', () => {
    useGameStore.setState({
      game: finishedGame({ ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'one' } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByText('Trade Rule: One')).toBeInTheDocument();
    expect(screen.getByText(/Lychguard moves from red to blue/)).toBeInTheDocument();
  });

  it('shows "no cards changed hands" for the Direct trade rule', () => {
    useGameStore.setState({
      game: finishedGame({ ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'direct' } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByText('No cards changed hands.')).toBeInTheDocument();
  });

  it('does not show a Trade Rule section for a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByText(/Trade Rule:/)).not.toBeInTheDocument();
  });

  it('shows the Sudden Death button only on a draw with the rule active', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sudden Death Rematch' })).toBeInTheDocument();
  });

  it('does not show the Sudden Death button on a draw when the rule is inactive', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: false } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sudden Death Rematch' })).not.toBeInTheDocument();
  });

  it('does not show the Sudden Death button on a win, even with the rule active', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'blue', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sudden Death Rematch' })).not.toBeInTheDocument();
  });

  it('calls onSuddenDeath when Sudden Death Rematch is clicked - does NOT mutate the store itself anymore', async () => {
    const user = userEvent.setup();
    const onSuddenDeath = vi.fn();
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={vi.fn()} onSuddenDeath={onSuddenDeath} />);

    await user.click(screen.getByRole('button', { name: 'Sudden Death Rematch' }));

    expect(onSuddenDeath).toHaveBeenCalledOnce();
    // Deliberately NOT asserting on useGameStore here - see this
    // component's own doc comment on onSuddenDeath for why that
    // responsibility moved to App.tsx (a real navigation bug: this
    // screen mutating the store directly left App.tsx's `step` stuck at
    // 'result', so a rematch had no board to actually play on).
  });

  it('calls onPlayAgain when Play Again is clicked', async () => {
    const user = userEvent.setup();
    const onPlayAgain = vi.fn();
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onPlayAgain={onPlayAgain} onReturnToMenu={vi.fn()} onSuddenDeath={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Play Again' }));

    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('calls onReturnToMenu when Return to Menu is clicked', async () => {
    const user = userEvent.setup();
    const onReturnToMenu = vi.fn();
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onPlayAgain={vi.fn()} onReturnToMenu={onReturnToMenu} onSuddenDeath={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Return to Menu' }));

    expect(onReturnToMenu).toHaveBeenCalledOnce();
  });
});