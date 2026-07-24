import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignResultScreen } from './CampaignResultScreen';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';
import { getObtainableUnitIds } from '../data/collectionProgress';
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
  useCampaignStore.getState().resetCampaign();
  localStorage.clear();
});

describe('CampaignResultScreen', () => {
  it('shows a fallback message when there is no finished game', () => {
    render(<CampaignResultScreen onContinue={vi.fn()} />);
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it("announces the winner, same as ResultScreen's own wording", () => {
    useGameStore.setState({ game: finishedGame({ winner: 'blue' }) });
    render(<CampaignResultScreen onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Blue Wins!' })).toBeInTheDocument();
  });

  it('announces a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<CampaignResultScreen onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Draw' })).toBeInTheDocument();
  });

  it('shows the board-control score for both sides', () => {
    useGameStore.setState({ game: finishedGame() });
    render(<CampaignResultScreen onContinue={vi.fn()} />);
    expect(screen.getByText('Blue: 2')).toBeInTheDocument();
    expect(screen.getByText('Red: 1')).toBeInTheDocument();
  });

  it('shows the real named trade transfer list (via the shared TradeTransferList component)', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'blue', ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'one' } }),
    });
    render(<CampaignResultScreen onContinue={vi.fn()} />);

    expect(screen.getByText('Trade Rule: One')).toBeInTheDocument();
    expect(screen.getByText('Lychguard moves from red to blue')).toBeInTheDocument();
  });

  it('shows no trade section at all on a draw (no winner/loser to trade between)', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    render(<CampaignResultScreen onContinue={vi.fn()} />);
    expect(screen.queryByText(/Trade Rule:/)).not.toBeInTheDocument();
  });

  it('shows the current campaign win/loss/draw record', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useGameStore.setState({ game: finishedGame() });

    render(<CampaignResultScreen onContinue={vi.fn()} />);

    expect(screen.getByText('2 wins')).toBeInTheDocument();
    expect(screen.getByText('1 losses')).toBeInTheDocument();
    expect(screen.getByText('0 draws')).toBeInTheDocument();
  });

  it('shows collector numbers as unique units currently owned out of the currently-OBTAINABLE total (not the full 1075-unit catalog, most of which is behind inactive factions - see data/collectionProgress.ts)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);
    useGameStore.setState({ game: finishedGame() });

    render(<CampaignResultScreen onContinue={vi.fn()} />);

    expect(
      screen.getByText(`Collection: 2 / ${getObtainableUnitIds().size}`),
    ).toBeInTheDocument();
  });

  it('counts a duplicate-owned unit only once toward the collector total (unique ids, not raw count)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    render(<CampaignResultScreen onContinue={vi.fn()} />);

    expect(
      screen.getByText(`Collection: 1 / ${getObtainableUnitIds().size}`),
    ).toBeInTheDocument();
  });

  it('shows a per-faction completion badge for each active faction', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    render(<CampaignResultScreen onContinue={vi.fn()} />);

    // At least Necrons and Blood Angels should show up (both active
    // factions), each with an owned-count fraction.
    expect(screen.getByText(/Necrons: 1\//)).toBeInTheDocument();
    expect(screen.getByText(/Blood Angels: 0\//)).toBeInTheDocument();
  });

  it('calls onContinue when the Continue button is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    useGameStore.setState({ game: finishedGame() });
    render(<CampaignResultScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('does not offer a Sudden Death button, unlike ResultScreen (see file header)', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    render(<CampaignResultScreen onContinue={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Sudden Death/ })).not.toBeInTheDocument();
  });
});