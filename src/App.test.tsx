import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';
import { useSeriesStore } from './state/seriesStore';

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function addUnitsByName(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const unitName of names) {
    const row = screen.getByText(unitName).closest('li')!;
    await user.click(row.querySelector('button')!);
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
});