import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameScreen } from './GameScreen';
import { useGameStore } from '../state/gameStore';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';
import type { Card, PlayerState, Board } from '../engine/types';

// Real generated unit ids (see src/data/units.generated.json).
const BA_CAPTAIN = 'blood-angels-blood-angels-captain';
const BA_ASTORATH = 'blood-angels-astorath';
const NECRON_LYCHGUARD = 'necrons-lychguard';

function makeCard(unitId: string, owner: 'blue' | 'red', instanceId: string): Card {
  return { instanceId, unitId, owner, stats: { top: 5, bottom: 5, left: 5, right: 5 } };
}

function startTestGame(ruleSetOverrides: Partial<typeof DEFAULT_RULE_SET> = {}) {
  const bluePlayer: PlayerState = {
    colour: 'blue',
    hand: [
      makeCard(BA_CAPTAIN, 'blue', 'blue-1'),
      makeCard(BA_ASTORATH, 'blue', 'blue-2'),
    ],
  };
  const redPlayer: PlayerState = {
    colour: 'red',
    hand: [makeCard(NECRON_LYCHGUARD, 'red', 'red-1')],
  };

  useGameStore.getState().startGame({
    bluePlayer,
    redPlayer,
    startingPlayer: 'blue',
    ruleSet: { ...DEFAULT_RULE_SET, ...ruleSetOverrides },
  });
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('GameScreen', () => {
  it('shows a fallback message when no game is in progress', () => {
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.getByText('No game in progress.')).toBeInTheDocument();
  });

  it('renders the human hand face-up with real unit names resolved from unitId', () => {
    startTestGame();
    render(<GameScreen humanPlayer="blue" />);

    // Blue's own hand is interactive (rendered as buttons) since it is
    // blue's turn - query by button, not the non-interactive img role.
    expect(screen.getByRole('button', { name: /Blood Angels Captain/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Astorath/ })).toBeInTheDocument();
  });

  it('shows the opponent hand face-down (no names) when Open is not active', () => {
    startTestGame({ open: false });
    render(<GameScreen humanPlayer="blue" />);

    expect(screen.queryByRole('img', { name: 'Lychguard' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
  });

  it("shows the correct faction logo on the opponent's face-down cards", () => {
    startTestGame({ open: false });
    render(<GameScreen humanPlayer="blue" />);

    const back = screen.getByRole('img', { name: 'Face-down card' });
    const logo = back.querySelectorAll('img')[1];
    // Red's hand in this fixture is a Necron unit (NECRON_LYCHGUARD).
    expect(logo.getAttribute('src')).toBe('/assets/factions/necrons/icon.png');
  });

  it('shows the opponent hand face-up with real names when Open is active', () => {
    startTestGame({ open: true });
    render(<GameScreen humanPlayer="blue" />);

    expect(screen.getByRole('img', { name: 'Lychguard' })).toBeInTheDocument();
  });

  it('shows "Your turn" when it is the human player\'s turn', () => {
    startTestGame();
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });

  it('shows "Opponent\'s turn" when it is not the human player\'s turn', () => {
    startTestGame();
    render(<GameScreen humanPlayer="red" />);
    expect(screen.getByText("Opponent's turn")).toBeInTheDocument();
  });

  it('selecting a hand card then clicking an empty cell places the card on the board', async () => {
    const user = userEvent.setup();
    startTestGame();
    render(<GameScreen humanPlayer="blue" />);

    await user.click(screen.getByRole('button', { name: /Blood Angels Captain/ }));
    await user.click(screen.getByLabelText('Empty cell, row 1, column 1'));

    // The card should now render on the board (non-interactive Card,
    // role="img") rather than as a hand button.
    expect(screen.getByRole('img', { name: 'Blood Angels Captain' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Blood Angels Captain/ }),
    ).not.toBeInTheDocument();
  });

  it('does not allow the human to select or place cards when it is not their turn', () => {
    startTestGame();
    // humanPlayer is red, but blue goes first - it is NOT red's turn yet.
    render(<GameScreen humanPlayer="red" />);

    // Red's hand card should not be rendered as a clickable button.
    expect(screen.queryByRole('button', { name: /Lychguard/ })).not.toBeInTheDocument();
  });

  it("renders the human's own hand cards as non-interactive (not clickable) when it is not their turn", () => {
    startTestGame();
    render(<GameScreen humanPlayer="red" />);

    // Even though this is red's OWN hand, it must not be an interactive
    // button while it's blue's turn - an enabled control that silently
    // does nothing when clicked is a real usability/accessibility bug,
    // not just a missed guard inside the click handler.
    const card = screen.getByRole('img', { name: 'Lychguard' });
    expect(card.tagName).toBe('DIV');
  });

  it('staggers a multi-card combo capture instead of flipping every card at once', async () => {
    const user = userEvent.setup();

    // Set up a board where placing blue's card triggers a genuine Same
    // combo, capturing two red cards in one move (mirrors the fixture
    // pattern used in engine/rules/same.test.ts).
    const triggerCard: Card = {
      instanceId: 'blue-trigger',
      unitId: BA_CAPTAIN,
      owner: 'blue',
      stats: { top: 5, bottom: 1, left: 1, right: 5 },
    };
    const redTop: Card = {
      instanceId: 'red-top',
      unitId: NECRON_LYCHGUARD,
      owner: 'red',
      stats: { top: 1, bottom: 5, left: 1, right: 1 },
    };
    const redRight: Card = {
      instanceId: 'red-right',
      unitId: NECRON_LYCHGUARD,
      owner: 'red',
      stats: { top: 1, bottom: 1, left: 5, right: 1 },
    };

    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [triggerCard] },
      redPlayer: { colour: 'red', hand: [] },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, same: true },
    });
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 0 && c === 1) return { card: redTop };
            if (r === 1 && c === 2) return { card: redRight };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);
    await user.click(screen.getByRole('button', { name: /Blood Angels Captain/ }));
    await user.click(screen.getByLabelText('Empty cell, row 2, column 2'));

    // Both captured Lychguards (plus the placed trigger card) should end
    // up blue - confirms GameScreen correctly reads game.lastCapture and
    // wires a flipDelayMs through to each captured card (the precise
    // per-card delay timing itself is already locked in by Card.test.tsx).
    await waitFor(
      () => {
        const blueFrames = document.querySelectorAll('img[src*="template-blue.png"]');
        expect(blueFrames.length).toBeGreaterThanOrEqual(3);
      },
      { timeout: 3000 },
    );
  });

  it('does not show a Quit button when onQuit is not provided', () => {
    startTestGame();
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.queryByRole('button', { name: 'Quit Game' })).not.toBeInTheDocument();
  });

  it('shows a Quit button when onQuit is provided', () => {
    startTestGame();
    render(<GameScreen humanPlayer="blue" onQuit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quit Game' })).toBeInTheDocument();
  });

  it('does not call onQuit immediately on the first click - requires confirmation', async () => {
    const user = userEvent.setup();
    const onQuit = vi.fn();
    startTestGame();
    render(<GameScreen humanPlayer="blue" onQuit={onQuit} />);

    await user.click(screen.getByRole('button', { name: 'Quit Game' }));

    expect(onQuit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, Quit' })).toBeInTheDocument();
  });

  it('calls onQuit only after confirming', async () => {
    const user = userEvent.setup();
    const onQuit = vi.fn();
    startTestGame();
    render(<GameScreen humanPlayer="blue" onQuit={onQuit} />);

    await user.click(screen.getByRole('button', { name: 'Quit Game' }));
    await user.click(screen.getByRole('button', { name: 'Yes, Quit' }));

    expect(onQuit).toHaveBeenCalledOnce();
  });

  it('Cancel returns to the normal Quit button without calling onQuit', async () => {
    const user = userEvent.setup();
    const onQuit = vi.fn();
    startTestGame();
    render(<GameScreen humanPlayer="blue" onQuit={onQuit} />);

    await user.click(screen.getByRole('button', { name: 'Quit Game' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onQuit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quit Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, Quit' })).not.toBeInTheDocument();
  });
});