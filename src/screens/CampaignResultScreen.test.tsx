import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignResultScreen, type CampaignResultScreenProps } from './CampaignResultScreen';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';
import { getObtainableUnitIds } from '../data/collectionProgress';
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

/** Renders CampaignResultScreen with sensible defaults for every prop (no victory modal, all handlers spies) - individual tests only need to override what they actually care about. */
function renderScreen(overrides: Partial<CampaignResultScreenProps> = {}) {
  const props: CampaignResultScreenProps = {
    onContinue: vi.fn(),
    victoryModalKind: null,
    onStartNewRun: vi.fn(),
    onReturnToTitle: vi.fn(),
    onDismissVictoryModal: vi.fn(),
    onReinforceRival: vi.fn(),
    ...overrides,
  };
  render(<CampaignResultScreen {...props} />);
  return props;
}

beforeEach(() => {
  useGameStore.getState().reset();
  useCampaignStore.getState().resetCampaign();
  localStorage.clear();
});

describe('CampaignResultScreen', () => {
  it('shows a fallback message when there is no finished game', () => {
    renderScreen();
    expect(screen.getByText('No finished match to show.')).toBeInTheDocument();
  });

  it("announces the winner, same as ResultScreen's own wording", () => {
    useGameStore.setState({ game: finishedGame({ winner: 'blue' }) });
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Blue Wins!' })).toBeInTheDocument();
  });

  it('announces a draw', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Draw' })).toBeInTheDocument();
  });

  it('shows the board-control score for both sides', () => {
    useGameStore.setState({ game: finishedGame() });
    renderScreen();
    expect(screen.getByText('Blue: 2 cards')).toBeInTheDocument();
    expect(screen.getByText('Red: 1 card')).toBeInTheDocument();
  });

  it('shows no points row when winCondition is "cards" (the default)', () => {
    useGameStore.setState({ game: finishedGame() });
    renderScreen();
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
    renderScreen();

    expect(screen.getByText('Decided by total points')).toBeInTheDocument();
    expect(screen.getByText('Blue: 150 pts')).toBeInTheDocument();
    expect(screen.getByText('Red: 300 pts')).toBeInTheDocument();
    expect(screen.getByText('Blue: 2 cards')).toBeInTheDocument();
    expect(screen.getByText('Red: 1 card')).toBeInTheDocument();
  });

  it('shows "No captures this match." by default (fresh gameStore, nothing tallied)', () => {
    useGameStore.setState({ game: finishedGame() });
    renderScreen();
    expect(screen.getByText('No captures this match.')).toBeInTheDocument();
  });

  it('shows the real capture breakdown from gameStore when there is one', () => {
    useGameStore.setState({
      game: finishedGame(),
      matchBlueCaptureBreakdown: { base: 2, same: 1, plus: 0, chain: 0 },
      matchRedCaptureBreakdown: { base: 0, same: 0, plus: 1, chain: 0 },
    });
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Captures' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No captures this match.')).not.toBeInTheDocument();
  });

  it('shows the real named trade transfer list (via the shared TradeTransferList component)', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'blue', ruleSet: { ...DEFAULT_RULE_SET, tradeRule: 'one' } }),
    });
    renderScreen();

    expect(screen.getByText('Trade Rule: One')).toBeInTheDocument();
    expect(screen.getByText('Lychguard moves from red to blue')).toBeInTheDocument();
  });

  it('shows no trade section at all on a draw (no winner/loser to trade between)', () => {
    useGameStore.setState({ game: finishedGame({ winner: 'draw' }) });
    renderScreen();
    expect(screen.queryByText(/Trade Rule:/)).not.toBeInTheDocument();
  });

  it('shows the current campaign win/loss/draw record', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useGameStore.setState({ game: finishedGame() });

    renderScreen();

    expect(screen.getByText('2 wins')).toBeInTheDocument();
    expect(screen.getByText('1 losses')).toBeInTheDocument();
    expect(screen.getByText('0 draws')).toBeInTheDocument();
  });

  it('shows collector numbers as unique units currently owned out of the currently-OBTAINABLE total (not the full 1075-unit catalog, most of which is behind inactive factions - see data/collectionProgress.ts)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);
    useGameStore.setState({ game: finishedGame() });

    renderScreen();

    expect(
      screen.getByText(`Collection: 2 / ${getObtainableUnitIds().size}`),
    ).toBeInTheDocument();
  });

  it('counts a duplicate-owned unit only once toward the collector total (unique ids, not raw count)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    renderScreen();

    expect(
      screen.getByText(`Collection: 1 / ${getObtainableUnitIds().size}`),
    ).toBeInTheDocument();
  });

  it('shows a per-faction completion badge for each active faction', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    renderScreen();

    // At least Necrons and Blood Angels should show up (both active
    // factions), each with an owned-count fraction.
    expect(screen.getByText(/Necrons: 1\//)).toBeInTheDocument();
    expect(screen.getByText(/Blood Angels: 0\//)).toBeInTheDocument();
  });

  it('calls onContinue when the Continue button is clicked', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ game: finishedGame() });
    const { onContinue } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('does not offer a Sudden Death button, unlike ResultScreen (see file header)', () => {
    useGameStore.setState({
      game: finishedGame({ winner: 'draw', ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true } }),
    });
    renderScreen();

    expect(screen.queryByRole('button', { name: /Sudden Death/ })).not.toBeInTheDocument();
  });
});

describe('CampaignResultScreen victory modal', () => {
  it('renders no victory modal when victoryModalKind is null', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    renderScreen({ victoryModalKind: null });

    expect(screen.queryByRole('heading', { name: 'Collection Complete!' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rival Vanquished!' })).not.toBeInTheDocument();
  });

  it("renders the Collection Complete modal with the right achievement and real progress numbers when victoryModalKind is 'collection-complete'", () => {
    const everyObtainableUnit = Array.from(getObtainableUnitIds());
    useCampaignStore.getState().startCampaign(everyObtainableUnit);
    useGameStore.setState({ game: finishedGame() });

    renderScreen({ victoryModalKind: 'collection-complete' });

    expect(screen.getByRole('heading', { name: 'Collection Complete!' })).toBeInTheDocument();
    expect(screen.getByText('Complete Collection')).toBeInTheDocument();
    expect(
      screen.getByText(
        `You now own ${everyObtainableUnit.length} / ${everyObtainableUnit.length} units - one of everything currently obtainable.`,
      ),
    ).toBeInTheDocument();
    // No reinforcements button for this milestone - onReinforce isn't passed.
    expect(
      screen.queryByRole('button', { name: 'Continue with AI Reinforcements' }),
    ).not.toBeInTheDocument();
  });

  it("renders the Rival Vanquished modal with the right achievement and a reinforcements button when victoryModalKind is 'rival-vanquished'", () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    renderScreen({ victoryModalKind: 'rival-vanquished' });

    expect(screen.getByRole('heading', { name: 'Rival Vanquished!' })).toBeInTheDocument();
    expect(screen.getByText('Rival Vanquished')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with AI Reinforcements' }),
    ).toBeInTheDocument();
  });

  it('calls onReinforceRival when "Continue with AI Reinforcements" is clicked', async () => {
    const user = userEvent.setup();
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    const { onReinforceRival } = renderScreen({ victoryModalKind: 'rival-vanquished' });

    await user.click(screen.getByRole('button', { name: 'Continue with AI Reinforcements' }));

    expect(onReinforceRival).toHaveBeenCalledOnce();
  });

  it('wires the modal callbacks through to the props passed to this screen', async () => {
    const user = userEvent.setup();
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useGameStore.setState({ game: finishedGame() });

    const { onReturnToTitle } = renderScreen({ victoryModalKind: 'collection-complete' });

    await user.click(screen.getByRole('button', { name: 'Return to Title' }));

    expect(onReturnToTitle).toHaveBeenCalledOnce();
  });
});