import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';

// Real generated Blood Angels units (see src/data/units.generated.json).
const BA_UNITS_TO_ADD = [
  'Blood Angels Captain',
  'Death Company Marines',
  'Sanguinary Priest',
  'Astorath',
  'Lemartes',
];

beforeEach(() => {
  useGameStore.getState().reset();
  useArmyBuilderStore.getState().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function buildBloodAngelsArmy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('listitem', { name: /Blood Angels/ }));
  await user.click(screen.getByRole('button', { name: '500 pts' }));
  for (const unitName of BA_UNITS_TO_ADD) {
    const row = screen.getByText(unitName).closest('li')!;
    await user.click(row.querySelector('button')!);
  }
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('App (full flow integration)', () => {
  it('starts on the Home screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Grim Triad' })).toBeInTheDocument();
  });

  it('navigates Home -> Army Builder on New Game', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));

    expect(screen.getByText('Choose Your Faction')).toBeInTheDocument();
  });

  it('navigates Army Builder -> Rule Select once an army is built', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));

    await buildBloodAngelsArmy(user);

    expect(screen.getByText('Match Rules')).toBeInTheDocument();
  });

  it('navigates Rule Select -> Coin Flip on Continue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await buildBloodAngelsArmy(user);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'Flip Coin' })).toBeInTheDocument();
  });

  it('starts a live game with the human hand showing the real chosen units, after the coin flip', async () => {
    // Force the coin flip to land on blue (the human) so the game is
    // immediately in a stable, assertable state (no AI-turn timing to
    // wait through) once GameScreen mounts.
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await buildBloodAngelsArmy(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    // Wait through the coin flip's real animation duration.
    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // The human's actual chosen unit should appear in their hand.
    expect(screen.getByRole('button', { name: /Blood Angels Captain/ })).toBeInTheDocument();
  });

  it('the live game state actually reflects the chosen ruleSet (Open makes the AI hand visible)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await buildBloodAngelsArmy(user);

    // Turn on the Open rule before continuing.
    await user.click(screen.getByRole('checkbox', { name: /^Open/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await screen.findByText('Your turn', {}, { timeout: 3000 });

    // With Open active, the AI's (red) hand should be rendered face-up
    // (real unit names visible) rather than as CardBacks.
    expect(screen.queryByRole('img', { name: 'Face-down card' })).not.toBeInTheDocument();
  });

  it('Quit Game (after confirming) returns to the Home screen and clears state', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await buildBloodAngelsArmy(user);
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