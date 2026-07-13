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

function makeCard(unitId: string, owner: 'blue' | 'red', instanceId: string): Card {
  return { instanceId, unitId, owner, stats: { top: 5, bottom: 5, left: 5, right: 5 } };
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
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it('shows a fallback message when the game exists but is not finished', () => {
    useGameStore.setState({ game: { ...finishedGame(), phase: 'playing' } });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it('announces the winner', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'blue' }) });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Blue Wins!' })).toBeInTheDocument();
  });

  it('announces a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Draw' })).toBeInTheDocument();
  });

  it('shows the correct final card counts per side', () => {
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByText('Blue: 2')).toBeInTheDocument();
    expect(screen.getByText('Red: 1')).toBeInTheDocument();
  });

  it('resolves the Trade Rule with real unit names for a One-rule win', () => {
    useGameStore.setState({
      game: finishedGame({ ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'one' } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByText('Trade Rule: One')).toBeInTheDocument();
    expect(screen.getByText(/Lychguard moves from red to blue/)).toBeInTheDocument();
  });

  it('shows "no cards changed hands" for the Direct trade rule', () => {
    useGameStore.setState({
      game: finishedGame({ ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'direct' } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);

    expect(screen.getByText('No cards changed hands.')).toBeInTheDocument();
  });

  it('does not show a Trade Rule section for a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByText(/Trade Rule:/)).not.toBeInTheDocument();
  });

  it('shows the Sudden Death button only on a draw with the rule active', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sudden Death Rematch' })).toBeInTheDocument();
  });

  it('does not show the Sudden Death button on a draw when the rule is inactive', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: false } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sudden Death Rematch' })).not.toBeInTheDocument();
  });

  it('does not show the Sudden Death button on a win, even with the rule active', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'blue', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sudden Death Rematch' })).not.toBeInTheDocument();
  });

  it('calls onSuddenDeath when Sudden Death Rematch is clicked - does NOT mutate the store itself anymore', async () => {
    const user = userEvent.setup();
    const onSuddenDeath = vi.fn();
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<ResultScreen onNewGame={vi.fn()} onSuddenDeath={onSuddenDeath} />);

    await user.click(screen.getByRole('button', { name: 'Sudden Death Rematch' }));

    expect(onSuddenDeath).toHaveBeenCalledOnce();
    // Deliberately NOT asserting on useGameStore here - see this
    // component's own doc comment on onSuddenDeath for why that
    // responsibility moved to App.tsx (a real navigation bug: this
    // screen mutating the store directly left App.tsx's `step` stuck at
    // 'result', so a rematch had no board to actually play on).
  });

  it('calls onNewGame when New Game is clicked', async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    useGameStore.setState({ game: finishedGame() });
    render(<ResultScreen onNewGame={onNewGame} onSuddenDeath={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(onNewGame).toHaveBeenCalledOnce();
  });
});