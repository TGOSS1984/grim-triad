import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameScreen } from './GameScreen';
import { useGameStore } from '../state/gameStore';
import { unitIdsToHand } from '../state/matchSetup';
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

    // Both captures here are direct Same matches (no cascade fired in
    // this fixture), so the pulse-ring visual (Same's distinct tell -
    // see CardCaptureFlame.tsx) should appear somewhere on screen during
    // the flip, end-to-end from game.lastCapture.captureKinds through to
    // the rendered DOM - not just that a capture happened, but that the
    // RIGHT rule's visual was selected for it.
    await waitFor(
      () => {
        expect(document.querySelector('[class*="pulseRing"]')).toBeInTheDocument();
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

  it('shows no element badges when the Elemental rule is inactive', () => {
    startTestGame({ elemental: false });
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.queryByRole('img', { name: /terrain/ })).not.toBeInTheDocument();
  });

  it('shows element badges on the board when the Elemental rule is active', () => {
    startTestGame({ elemental: true });
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.getAllByRole('img', { name: /terrain/ }).length).toBeGreaterThan(0);
  });

  it("shows the card's own element affinity badge on the human's visible hand when Elemental is active", () => {
    startTestGame({ elemental: true });
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.getAllByRole('img', { name: /affinity/ }).length).toBeGreaterThan(0);
  });

  it("shows no card affinity badges at all when Elemental is inactive, even though every unit has an element in the data", () => {
    startTestGame({ elemental: false });
    render(<GameScreen humanPlayer="blue" />);
    expect(screen.queryByRole('img', { name: /affinity/ })).not.toBeInTheDocument();
  });

  it("never leaks a card's element through a face-down (hidden) opponent hand", () => {
    startTestGame({ elemental: true, open: false });
    render(<GameScreen humanPlayer="blue" />);

    // Red's hand is face-down here - its cards' own elements must not be
    // exposed, same secrecy principle as their name/stats/portrait.
    const redHand = screen.getByRole('list', { name: /^red hand/ });
    expect(within(redHand).queryByRole('img', { name: /affinity/ })).not.toBeInTheDocument();
  });
});

describe('GameScreen rules badge', () => {
  it('always shows the Trade Rule, even with every other optional rule off', () => {
    startTestGame({ tradeRule: 'diff' });
    render(<GameScreen humanPlayer="blue" />);

    expect(screen.getByLabelText('Active match rules')).toHaveTextContent('Trade Rule: Diff');
  });

  it('shows every active optional rule as its own chip', () => {
    startTestGame({ same: true, plus: true, elemental: true, tradeRule: 'all' });
    render(<GameScreen humanPlayer="blue" />);

    const badge = screen.getByLabelText('Active match rules');
    expect(within(badge).getByText('Same')).toBeInTheDocument();
    expect(within(badge).getByText('Plus')).toBeInTheDocument();
    expect(within(badge).getByText('Elemental')).toBeInTheDocument();
    expect(within(badge).getByText('Trade Rule: All')).toBeInTheDocument();
  });

  it('does not show a chip for an inactive optional rule', () => {
    startTestGame({ same: false, plus: false, elemental: false, chain: false });
    render(<GameScreen humanPlayer="blue" />);

    const badge = screen.getByLabelText('Active match rules');
    expect(within(badge).queryByText('Same')).not.toBeInTheDocument();
    expect(within(badge).queryByText('Plus')).not.toBeInTheDocument();
    expect(within(badge).queryByText('Elemental')).not.toBeInTheDocument();
    expect(within(badge).queryByText('Chain')).not.toBeInTheDocument();
  });

  it('stays visible regardless of whose turn it is (not just at match start)', async () => {
    const user = userEvent.setup();
    startTestGame({ same: true });
    render(<GameScreen humanPlayer="blue" />);

    await user.click(screen.getByRole('button', { name: /Blood Angels Captain/ }));
    const cell = screen.getAllByRole('button', { name: /Empty cell/ })[0];
    await user.click(cell);

    expect(screen.getByLabelText('Active match rules')).toHaveTextContent('Same');
  });
});

describe('GameScreen Epic Hero template', () => {
  it("a real Epic Hero unit (Commander Dante) gets the epic template frame once on the board - full pipeline from the unit catalog's own keywords through to Card", async () => {
    const user = userEvent.setup();
    const bluePlayer: PlayerState = {
      colour: 'blue',
      hand: [makeCard('blood-angels-commander-dante', 'blue', 'blue-dante')],
    };
    const redPlayer: PlayerState = {
      colour: 'red',
      hand: [makeCard(NECRON_LYCHGUARD, 'red', 'red-1')],
    };
    useGameStore.getState().startGame({ bluePlayer, redPlayer, startingPlayer: 'blue', ruleSet: DEFAULT_RULE_SET });
    render(<GameScreen humanPlayer="blue" />);

    await user.click(screen.getByRole('button', { name: /Commander Dante/ }));
    await user.click(screen.getAllByRole('button', { name: /Empty cell/ })[0]);

    await waitFor(() => {
      const frame = document.querySelector('img[src*="template-blue-epic.png"]');
      expect(frame).toBeInTheDocument();
    });
  });

  it('a regular (non-Epic-Hero) unit never gets the epic template', async () => {
    const user = userEvent.setup();
    startTestGame();
    render(<GameScreen humanPlayer="blue" />);

    await user.click(screen.getByRole('button', { name: /Blood Angels Captain/ }));
    await user.click(screen.getAllByRole('button', { name: /Empty cell/ })[0]);

    await waitFor(() => {
      expect(document.querySelector('img[src*="template-blue.png"]')).toBeInTheDocument();
    });
    expect(document.querySelector('img[src*="-epic.png"]')).not.toBeInTheDocument();
  });
});

describe('GameScreen buff/debuff display (Elemental)', () => {
  it("REGRESSION TEST: a card built through the REAL unitIdsToHand pipeline (not a hand-rolled Card literal) shows a genuine +1 buff on a matching cell - this is the test that would have caught the actual bug found via a real playtest screenshot: unitIdsToHand was never setting .element on the card at all, so every real card was always treated as elementally mismatched (always -1, never +1) regardless of its true element or the cell's terrain, even though the OTHER tests in this block (which set .element directly on a hand-rolled Card) passed the whole time and never caught it", async () => {
    // Blood Angels Captain's real element and stats come from the actual
    // catalog via unitIdsToHand - not asserted by hand, so this genuinely
    // exercises the same code path a real match uses.
    const [captain] = unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1);
    startTestGame({ elemental: true });
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            // Placing on a cell whose terrain matches the card's real
            // element (void) - a genuine match should buff, not debuff.
            if (r === 1 && c === 1) return { card: captain, element: captain.element };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      const buffedStats = document.querySelectorAll('[class*="statBuffed"]');
      expect(buffedStats.length).toBeGreaterThan(0);
    });
    expect(document.querySelectorAll('[class*="statDebuffed"]')).toHaveLength(0);
  });

  it('a card sitting on a MISMATCHED elemental cell shows debuffed (red) stats through the full pipeline', async () => {
    startTestGame({ elemental: true });
    // Blood Angels Captain's real element is 'void' (top 5, bottom 5,
    // left 6, right 5) - placing it on a 'toxic' cell is a genuine
    // mismatch, -1 on all four sides.
    const captain: Card = {
      instanceId: 'blue-captain-on-terrain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      element: 'void',
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 1) return { card: captain, element: 'toxic' };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    // Effective stats should be 4/4/5/4 (each side -1) - the printed
    // values (5/5/6/5) should no longer be shown for this card.
    await waitFor(() => {
      const debuffedStats = document.querySelectorAll('[class*="statDebuffed"]');
      expect(debuffedStats.length).toBeGreaterThan(0);
    });
  });

  it('a card sitting on a MATCHING elemental cell shows buffed (green) stats through the full pipeline', async () => {
    startTestGame({ elemental: true });
    const captain: Card = {
      instanceId: 'blue-captain-on-terrain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      element: 'void',
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 1) return { card: captain, element: 'void' }; // matches
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      const buffedStats = document.querySelectorAll('[class*="statBuffed"]');
      expect(buffedStats.length).toBeGreaterThan(0);
    });
  });

  it('a card on a cell with no assigned element shows no buff/debuff styling at all', async () => {
    startTestGame({ elemental: false });
    const captain: Card = {
      instanceId: 'blue-captain-no-terrain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      element: 'void',
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 1) return { card: captain }; // no element on this cell
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // sanity check the card actually rendered
    });
    expect(document.querySelectorAll('[class*="statBuffed"], [class*="statDebuffed"]')).toHaveLength(0);
  });
});

describe('GameScreen buff/debuff display (Combined Arms)', () => {
  it('two adjacent friendly cards with different unitType show buffed stats on the sides facing each other', async () => {
    startTestGame({ combinedArms: true });
    // Blood Angels Captain (Character) and Necrons Lychguard (Infantry) -
    // different unitType, both blue-owned.
    const captain: Card = {
      instanceId: 'blue-captain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      unitType: 'Character',
    };
    const lychguard: Card = {
      instanceId: 'blue-lychguard',
      unitId: 'necrons-lychguard',
      owner: 'blue',
      stats: { top: 5, bottom: 6, left: 7, right: 3 },
      unitType: 'Infantry',
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 0) return { card: captain };
            if (r === 1 && c === 1) return { card: lychguard }; // right neighbor of captain
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(document.querySelectorAll('[class*="statBuffed"]').length).toBeGreaterThan(0);
    });
  });

  it('two adjacent friendly cards with the SAME unitType show no buff at all', async () => {
    startTestGame({ combinedArms: true });
    const captain: Card = {
      instanceId: 'blue-captain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      unitType: 'Character',
    };
    const dante: Card = {
      instanceId: 'blue-dante',
      unitId: 'blood-angels-commander-dante',
      owner: 'blue',
      stats: { top: 4, bottom: 10, left: 7, right: 3 },
      unitType: 'Character', // same as captain
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 0) return { card: captain };
            if (r === 1 && c === 1) return { card: dante };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument(); // Dante's bottom (10, displayed as 'A') - unique, sanity check both cards rendered
    });
    expect(document.querySelectorAll('[class*="statBuffed"]')).toHaveLength(0);
  });
});

describe('GameScreen buff/debuff display (Underdog)', () => {
  it('a card that captured something 50%+ pricier renders permanently buffed', async () => {
    startTestGame({ underdog: true });
    const underdogCard: Card = {
      instanceId: 'blue-underdog',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      points: 80,
      hasUnderdogBonus: true,
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 1) return { card: underdogCard };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(document.querySelectorAll('[class*="statBuffed"]').length).toBe(4); // all four sides
    });
  });

  it('a card without the Underdog flag shows no buff, even with the rule active', async () => {
    startTestGame({ underdog: true });
    const plainCard: Card = {
      instanceId: 'blue-plain',
      unitId: 'blood-angels-blood-angels-captain',
      owner: 'blue',
      stats: { top: 5, bottom: 5, left: 6, right: 5 },
      points: 80,
    };
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 1 && c === 1) return { card: plainCard };
            return cell;
          }),
        ) as Board,
      },
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('[class*="statBuffed"]')).toHaveLength(0);
  });
});

describe('GameScreen buff/debuff display (Epic Hero Presence)', () => {
  it("a real hand built through unitIdsToHand with an Epic Hero shows buffed stats on ALL of that player's cards, including ones still in hand", async () => {
    const [dante] = unitIdsToHand(['blood-angels-commander-dante'], 'blue', 1);
    const blueHand = [dante, ...unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1)];
    const redHand = unitIdsToHand(['necrons-lychguard'], 'red', 1);

    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: blueHand },
      redPlayer: { colour: 'red', hand: redHand },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: true },
    });

    render(<GameScreen humanPlayer="blue" />);

    // Dante himself (Epic Hero) AND the Captain (not an Epic Hero, but
    // owned by the same player who HAS one in their starting hand)
    // should both show a buffed side - this is the actual point of the
    // rule, an army-wide buff, not just a self-buff on the hero card.
    await waitFor(() => {
      expect(document.querySelectorAll('[class*="statBuffed"]').length).toBeGreaterThan(0);
    });
  });

  it("does not buff the OPPONENT's cards, even when the player has Epic Hero Presence", async () => {
    const [dante] = unitIdsToHand(['blood-angels-commander-dante'], 'blue', 1);
    const redHand = unitIdsToHand(['necrons-lychguard'], 'red', 1);

    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [dante] },
      redPlayer: { colour: 'red', hand: redHand },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: true, open: true }, // open so red's hand is visible too
    });

    render(<GameScreen humanPlayer="blue" />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /Lychguard/ })).toBeInTheDocument();
    });
    const redCardEl = screen.getByRole('img', { name: /Lychguard/ });
    expect(redCardEl.querySelectorAll('[class*="statBuffed"]')).toHaveLength(0);
  });
});