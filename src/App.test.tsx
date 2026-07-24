import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';
import { useSeriesStore } from './state/seriesStore';
import { useCampaignStore } from './state/campaignStore';

// Real generated Blood Angels units (see src/data/units.generated.json),
// cheapest-first - used to build a valid 5-card single-match army, and as
// a starting point for series mode's larger pools below.
const BA_UNITS_TO_ADD = [
  'Blood Angels Captain',
  'Death Company Marines',
  'Sanguinary Priest',
  'Astorath',
  'Lemartes',
];

// Additional cheap Blood Angels units for series mode's larger pools.
const BA_UNITS_EXTRA = [
  'Commander Dante',
  'Death Company Marines with Jump Packs',
  'Sanguinary Guard',
  'Baal Predator',
  'Chief Librarian Mephiston',
];

beforeEach(() => {
  useGameStore.getState().reset();
  useArmyBuilderStore.getState().reset();
  useSeriesStore.getState().reset();
  useCampaignStore.getState().resetCampaign();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function addUnitsByName(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const unitName of names) {
    // getAllByText, not getByText: the unit name now appears twice per row
    // (the row's real Card plus UnitPicker's own info panel) - either
    // match's closest li is the same row, so take the first.
    const row = screen.getAllByText(unitName)[0].closest('li')!;
    // Query by accessible name, not just "the first button in the row" -
    // the row's thumbnail is also a real <button> now (see UnitPicker.tsx's
    // hover-zoom/lightbox), and it comes before Add/Remove in DOM order.
    const addButton = Array.from(row.querySelectorAll('button')).find(
      (button) => button.textContent === 'Add',
    )!;
    await user.click(addButton);
  }
}

/** Home -> New Game -> Mode Select (Single Match) -> Army Builder (5-card army) -> Rule Select screen visible. */
async function buildSingleMatchArmy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New Game' }));
  await user.click(screen.getByRole('button', { name: /Single Match/ }));
  await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
  await user.click(screen.getByRole('button', { name: '500 pts' }));
  await addUnitsByName(user, BA_UNITS_TO_ADD);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

/** Home -> New Game -> Mode Select (Series, given a valid preset pool size) -> Army Builder (exact pool) -> Series Intro screen visible. */
async function buildSeriesArmy(user: ReturnType<typeof userEvent.setup>, poolSize: 10 | 15 | 20 | 25) {
  await user.click(screen.getByRole('button', { name: 'New Game' }));
  await user.click(screen.getByRole('button', { name: /^Series/ }));
  await user.click(screen.getByRole('button', { name: String(poolSize) }));
  await user.click(screen.getByRole('button', { name: 'Start Series' }));

  await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
  await user.click(screen.getByRole('button', { name: '2000 pts' }));
  const names = [...BA_UNITS_TO_ADD, ...BA_UNITS_EXTRA].slice(0, poolSize);
  await addUnitsByName(user, names);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

/** Home -> New Game -> Mode Select (Campaign) -> Campaign Home (no active run) -> Army Builder (15-card starting roster, forced 1500pt cap) -> a live game after the coin flip. */
async function buildCampaignArmy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New Game' }));
  await user.click(screen.getByRole('button', { name: /^Campaign/ }));
  await user.click(screen.getByRole('button', { name: 'Start New Run' }));

  await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
  // 15 real, cheap Blood Angels/generic units - well under the 1500pt
  // cap (895pts total) and with zero units over the 150pt power
  // threshold, so this always passes validateCampaignStartingRoster.
  await addUnitsByName(user, [
    'Bladeguard Ancient',
    'Lieutenant In Reiver Armour',
    'Ancient',
    'Apothecary',
    'Lieutenant in Phobos Armour',
    'Techmarine',
    'Chaplain',
    'Invader ATV',
    'Librarian',
    'Lieutenant',
    'Ancient In Terminator Armour',
    'Death Company Captain',
    'Apothecary Biologis',
    'Captain in Phobos Armour',
    'Judiciar',
  ]);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('App (single-match flow integration)', () => {
  it('starts on the Home screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
  });

  it('navigates Home -> Mode Select on New Game', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(screen.getByRole('heading', { name: 'Choose Your Battle' })).toBeInTheDocument();
  });

  it('navigates Mode Select -> Army Builder when Single Match is chosen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));

    await user.click(screen.getByRole('button', { name: /Single Match/ }));

    expect(screen.getByText('Choose Your Faction')).toBeInTheDocument();
  });

  it('navigates Army Builder -> Rule Select once an army is built', async () => {
    const user = userEvent.setup();
    render(<App />);

    await buildSingleMatchArmy(user);

    expect(screen.getByText('Match Rules')).toBeInTheDocument();
  });

  it('navigates Rule Select -> Coin Flip on Continue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'Flip Coin' })).toBeInTheDocument();
  });

  it('starts a live game with the human hand showing the real chosen units, after the coin flip', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await screen.findByText('Your turn', {}, { timeout: 3000 });

    expect(screen.getByRole('button', { name: /Blood Angels Captain/ })).toBeInTheDocument();
  });

  it('warns before leaving the page while a live match is in progress', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT warn before leaving the page on other screens (e.g. still in Army Builder)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    // Still on Rule Select, not yet in a live game.

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('stops warning once the match ends and the app has moved past the game step', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('Sudden Death Rematch actually returns to a live, playable game - real bug fix, not a stuck blank screen', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game: liveGame } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...liveGame!,
        phase: 'finished',
        winner: 'draw',
        ruleSet: { ...liveGame!.ruleSet, suddenDeath: true },
      },
    });
    await screen.findByRole('heading', { name: 'Draw' }, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Sudden Death Rematch' }));

    // The actual bug: this used to leave the app stuck showing "No
    // finished match to show." with the rematch mutating the store
    // invisibly behind it, no board rendered to play it on. The real fix
    // is that GameScreen is genuinely back and interactive.
    expect(screen.queryByText('No finished match to show.')).not.toBeInTheDocument();
    expect(useGameStore.getState().game?.phase).not.toBe('finished');
    expect(screen.getAllByRole('button', { name: /Empty cell/ }).length).toBeGreaterThan(0);
  });

  it('the live game state actually reflects the chosen ruleSet (Open makes the AI hand visible)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);

    await user.click(screen.getByRole('checkbox', { name: /^Open/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await screen.findByText('Your turn', {}, { timeout: 3000 });

    expect(screen.queryByRole('img', { name: 'Face-down card' })).not.toBeInTheDocument();
  });

  it('Quit Game (after confirming) returns to the Home screen and clears state', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Quit Game' }));
    await user.click(screen.getByRole('button', { name: 'Yes, Quit' }));

    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
    expect(useGameStore.getState().game).toBeNull();
    expect(useArmyBuilderStore.getState().rosterName).toBeNull();
  });

  it('Play Again skips Army Builder entirely and starts a fresh match with the SAME army', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });

    const originalArmy = [...useArmyBuilderStore.getState().selectedUnitIds];
    await user.click(screen.getByRole('button', { name: 'Play Again' }));

    // Straight to Rule Select, not back through Army Builder.
    expect(screen.getByRole('heading', { name: 'Match Rules' })).toBeInTheDocument();
    expect(screen.queryByText('Choose Your Faction')).not.toBeInTheDocument();
    // The roster itself is untouched - same units as before.
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual(originalArmy);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // The new match's hand shows the same real chosen unit as before.
    expect(screen.getByRole('button', { name: /Blood Angels Captain/ })).toBeInTheDocument();
  });

  it('Return to Menu still fully resets back to Home (unchanged behavior from before Play Again existed)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSingleMatchArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Return to Menu' }));

    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
    expect(useGameStore.getState().game).toBeNull();
    expect(useArmyBuilderStore.getState().rosterName).toBeNull();
  });
});

describe('App (series mode flow integration)', () => {
  it('Army Builder requires the exact chosen pool size, not just "at least 5"', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: /^Series/ }));
    await user.click(screen.getByRole('button', { name: '10' }));
    await user.click(screen.getByRole('button', { name: 'Start Series' }));
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
    await user.click(screen.getByRole('button', { name: '2000 pts' }));
    await addUnitsByName(user, BA_UNITS_TO_ADD); // only 5 of the required 10

    expect(
      screen.getByRole('button', { name: /Select exactly 10 units \(5\/10\)/ }),
    ).toBeDisabled();
  });

  it('navigates Army Builder -> Series Intro (not Rule Select) once the exact pool is built', async () => {
    const user = userEvent.setup();
    render(<App />);

    await buildSeriesArmy(user, 10);

    expect(screen.getByRole('heading', { name: 'Series Begins' })).toBeInTheDocument();
    expect(screen.queryByText('Match Rules')).not.toBeInTheDocument();
  });

  it('initializes the series store with the real chosen pool once army building completes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await buildSeriesArmy(user, 10);

    const state = useSeriesStore.getState();
    expect(state.poolSize).toBe(10);
    expect(state.bluePool).toHaveLength(10);
    expect(state.redPool).toHaveLength(10); // AI pool generated to match
  });

  it('reaches a live game after Series Intro -> Coin Flip, with hands drawn from the series pool', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSeriesArmy(user, 10);

    await user.click(screen.getByRole('button', { name: 'Start Round 1' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // The series pool should have shrunk by exactly 5 (this round's draw).
    expect(useSeriesStore.getState().bluePool).toHaveLength(5);
    // A real hand should be showing - one of the pool's units, as a live
    // interactive card (it's blue's turn).
    const handButtons = screen.getAllByRole('button', { name: /:/ });
    expect(handButtons.length).toBeGreaterThan(0);
  });

  it('a decisive round with the series still able to continue transitions to Round Summary, not Series Result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSeriesArmy(user, 10); // 10-card pool = 2 rounds before exhaustion
    await user.click(screen.getByRole('button', { name: 'Start Round 1' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // Force the live match straight to a decisive, non-draw finish rather
    // than simulating an entire unpredictable match through real clicks -
    // same pattern already used successfully in ResultScreen.test.tsx and
    // GameScreen.test.tsx for exercising post-game transitions reliably.
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: { ...game!, phase: 'finished', winner: 'blue' },
    });

    await screen.findByRole('heading', { name: /Round 1: Blue Wins/ }, { timeout: 3000 });

    const seriesState = useSeriesStore.getState();
    expect(seriesState.seriesWinner).toBeNull(); // series continues
    expect(seriesState.blueWins).toBe(1);
  });

  it('a round that exhausts a pool ends the series and shows Series Result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    // The smallest possible series (10-card pool = exactly 2 rounds) -
    // after round 1's draw, each pool has exactly 5 left, so round 1
    // itself does NOT end the series; we jump straight to simulating
    // round 1's decisive finish and confirm it correctly does NOT end the
    // series yet (pools still have exactly 5, enough for one more round).
    await buildSeriesArmy(user, 10);
    await user.click(screen.getByRole('button', { name: 'Start Round 1' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: /Round 1: Blue Wins/ }, { timeout: 3000 });

    // Continue into round 2, the pool-exhausting round.
    await user.click(screen.getByRole('button', { name: 'Continue to Round 2' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game: round2Game } = useGameStore.getState();
    useGameStore.setState({
      game: { ...round2Game!, phase: 'finished', winner: 'blue' },
    });

    await screen.findByRole('heading', { name: /Wins the Series/ }, { timeout: 3000 });
    expect(useSeriesStore.getState().seriesWinner).toBe('blue');
  });

  it('Play Again on a finished series starts a fresh series with the SAME starting pool, skipping Army Builder', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);
    await buildSeriesArmy(user, 10);
    await user.click(screen.getByRole('button', { name: 'Start Round 1' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: /Round 1: Blue Wins/ }, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Continue to Round 2' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });
    const { game: round2Game } = useGameStore.getState();
    useGameStore.setState({ game: { ...round2Game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: /Wins the Series/ }, { timeout: 3000 });

    const originalArmy = [...useArmyBuilderStore.getState().selectedUnitIds];
    await user.click(screen.getByRole('button', { name: 'Play Again' }));

    // Straight into a fresh series intro, not back through Army Builder -
    // and initSeries reset the pool back to its original full 10 cards
    // (round 1's 5-card draw is gone, exactly as a brand new series should
    // start).
    expect(screen.getByRole('heading', { name: 'Series Begins' })).toBeInTheDocument();
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual(originalArmy);
    expect(useSeriesStore.getState().bluePool).toHaveLength(10);
    expect(useSeriesStore.getState().roundNumber).toBe(1);
  });

  it("shows a graceful, actionable error (not a crash) if the AI's opponent army can't be generated, and preserves the player's own selection so they can retry", async () => {
    // Regression coverage for a real crash found in play: "Could not
    // build an AI roster of at least 25 units within 2000 points" was an
    // UNCAUGHT error that took down the whole app. The underlying
    // algorithm bug is fixed (see matchSetup.test.ts), which means this
    // specific failure is no longer reachable through a fully-completed
    // human selection (completing your own N-unit pick within a cap is
    // itself proof at least one faction can support it, which the fixed
    // algorithm is now guaranteed to find) - so this test forces the
    // failure directly to verify the DEFENSIVE handling itself still
    // works correctly as a safety net, rather than relying on it never
    // being needed again.
    const matchSetup = await import('./state/matchSetup');
    vi.spyOn(matchSetup, 'buildRandomAIRoster').mockImplementation(() => {
      throw new Error('Could not build an AI roster of at least 25 units within 2000 points');
    });

    const user = userEvent.setup();
    render(<App />);
    await buildSeriesArmy(user, 10);

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't build an opponent army for a 10-card pool at 2000 points",
    );
    // The player's own completed selection must not be lost - they should
    // be able to see it's still there and just try a different cap/pool.
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(10);
    // Must NOT have advanced past Army Builder.
    expect(screen.queryByText('Round 1 Rules')).not.toBeInTheDocument();
  });
});

describe('App (campaign mode flow integration)', () => {
  it('navigates Mode Select -> Campaign Home (not straight to Army Builder) when Campaign is chosen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));

    await user.click(screen.getByRole('button', { name: /^Campaign/ }));

    expect(screen.getByRole('heading', { name: 'Campaign' })).toBeInTheDocument();
    expect(screen.getByText(/Build a starting roster/)).toBeInTheDocument();
  });

  it('skips the manual points-cap picker in Army Builder (campaign uses a forced 1500pt cap)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: /^Campaign/ }));
    await user.click(screen.getByRole('button', { name: 'Start New Run' }));

    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.queryByText('Choose Points Limit')).not.toBeInTheDocument();
    expect(screen.getByText('0 / 1500 pts')).toBeInTheDocument();
  });

  it('requires exactly the campaign starting pool size (15), not just "at least 5"', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: /^Campaign/ }));
    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));

    expect(screen.getByRole('button', { name: /Select exactly 15 units/ })).toBeDisabled();
  });

  it('starts the persistent campaign and reaches a live game after building a valid starting roster', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);

    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    expect(useCampaignStore.getState().isActive).toBe(true);
    expect(useCampaignStore.getState().collection).toHaveLength(15);
  });

  it("records a win into the persistent campaign store and returns to the campaign hub (not Home) afterward", async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });

    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });
    expect(useCampaignStore.getState().wins).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Back at the campaign hub (with updated stats), NOT the main Home
    // screen - a campaign match's "Continue" means "next match", not
    // "leave campaign mode".
    expect(screen.getByRole('heading', { name: 'Campaign' })).toBeInTheDocument();
    expect(screen.getByText('Wins')).toBeInTheDocument();
  });

  it('records a loss correctly too', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'red' } });

    await screen.findByRole('heading', { name: 'Red Wins!' }, { timeout: 3000 });
    expect(useCampaignStore.getState().losses).toBe(1);
    expect(useCampaignStore.getState().wins).toBe(0);
  });

  it("never rolls the 'direct' trade rule for a campaign match, even when the random roll would otherwise land on it", async () => {
    // 0.6 is the exact value that lands on index 2 ('direct') of the
    // unfiltered ['one','diff','direct','all'] list randomRuleSet.ts
    // rolls from - see randomRuleSet.test.ts's own equivalent unit test.
    // Asserting against the real, live App-driven campaign flow here
    // (not just the isolated randomRuleSet() function) confirms the
    // exclusion is actually wired into handleArmyReady's campaign
    // branch, not just available and unused. ruleSet only lands on
    // gameStore's game.ruleSet once the coin flip actually starts the
    // game (it's App-local state until then), so flip the coin like the
    // other campaign tests do before reading it.
    vi.spyOn(Math, 'random').mockReturnValue(0.6);

    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    expect(useGameStore.getState().game?.ruleSet.tradeRule).not.toBe('direct');
  });

  it('Continuing an active campaign run skips Army Builder entirely and draws the next hand from the existing collection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        phase: 'finished',
        winner: 'blue',
        ruleSet: { ...game!.ruleSet, tradeRule: 'direct' },
      },
    });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Now at the campaign hub with an active run - Continue Campaign
    // should skip straight past Army Builder to the coin flip.
    await user.click(screen.getByRole('button', { name: 'Continue Campaign' }));

    expect(screen.queryByText('Choose Your Faction')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // 'direct' trade rule forced above means no cards changed hands -
    // still the same 15 units, still fielding a real 5-card hand from
    // them for round 2.
    expect(useCampaignStore.getState().collection).toHaveLength(15);
  });

  it('a second run start (after confirming) resets the collection/record from the campaign hub', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });
    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'blue' } });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(useCampaignStore.getState().wins).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    await user.click(screen.getByRole('button', { name: 'Yes, Start Over' }));

    // Back in Army Builder for a fresh roster, and the old record is gone.
    expect(screen.getByText('Choose Your Faction')).toBeInTheDocument();
    expect(useCampaignStore.getState().wins).toBe(0);
    expect(useCampaignStore.getState().collection).toEqual([]);
  });

  it("a win under the 'one' trade rule adds exactly one gained unit to the persistent collection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        phase: 'finished',
        winner: 'blue',
        ruleSet: { ...game!.ruleSet, tradeRule: 'one' },
      },
    });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });

    // Started with exactly 15 - a win under 'one' gains exactly 1 card,
    // never loses any, so the collection should now be 16.
    expect(useCampaignStore.getState().collection).toHaveLength(16);
  });

  it("a loss under the 'one' trade rule removes exactly one unit from the persistent collection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        phase: 'finished',
        winner: 'red',
        ruleSet: { ...game!.ruleSet, tradeRule: 'one' },
      },
    });
    await screen.findByRole('heading', { name: 'Red Wins!' }, { timeout: 3000 });

    // Started with 15 - a loss under 'one' loses exactly 1 card.
    expect(useCampaignStore.getState().collection).toHaveLength(14);
  });

  it("a win under the 'direct' trade rule does not change the persistent collection at all", async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        phase: 'finished',
        winner: 'blue',
        ruleSet: { ...game!.ruleSet, tradeRule: 'direct' },
      },
    });
    await screen.findByRole('heading', { name: 'Blue Wins!' }, { timeout: 3000 });

    // 'direct' means each side just keeps what they already control - no
    // transfer happens at all, regardless of who won.
    expect(useCampaignStore.getState().collection).toHaveLength(15);
  });

  it('a draw records into the campaign record without touching the collection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await buildCampaignArmy(user);
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'draw' } });
    await screen.findByRole('heading', { name: 'Draw' }, { timeout: 3000 });

    expect(useCampaignStore.getState().draws).toBe(1);
    expect(useCampaignStore.getState().collection).toHaveLength(15);
  });
});