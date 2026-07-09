import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { Card } from '../engine/types';

function makeCard(
  owner: 'blue' | 'red',
  instanceId: string,
  stats = { top: 5, bottom: 5, left: 5, right: 5 },
): Card {
  return { instanceId, unitId: `unit-${instanceId}`, owner, stats };
}

function makeHand(owner: 'blue' | 'red', count: number): Card[] {
  return Array.from({ length: count }, (_, i) => makeCard(owner, `${owner}-${i}`));
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('startGame', () => {
  it('creates a game with no AI (local PvP) and does not auto-play any move', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const { game } = useGameStore.getState();
    expect(game).not.toBeNull();
    expect(game?.activePlayer).toBe('blue');
    expect(game?.history).toHaveLength(0);
  });

  it('auto-plays the AI after a real delay when the AI is the starting player', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });

    const { game } = useGameStore.getState();
    // AI (red) should have played its move, handing the turn back to blue.
    expect(game?.history).toHaveLength(1);
    expect(game?.history[0].player).toBe('red');
    expect(game?.activePlayer).toBe('blue');
  });

  it('does not apply the AI move until startGame actually resolves (real delay, not instant)', async () => {
    const promise = useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });

    // Immediately after calling (before awaiting), the AI's move must not
    // have been applied yet - this is the actual behaviour being fixed:
    // previously everything resolved synchronously in one go.
    expect(useGameStore.getState().game?.history).toHaveLength(0);

    await promise;
    expect(useGameStore.getState().game?.history).toHaveLength(1);
  });
});

describe('playCard', () => {
  it('applies a human move and does not auto-play when there is no AI', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    await useGameStore.getState().playCard(card, { row: 0, col: 0 });

    const { game } = useGameStore.getState();
    expect(game?.history).toHaveLength(1);
    expect(game?.activePlayer).toBe('red');
  });

  it('commits the human move to the store immediately, before the AI response', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    const promise = useGameStore.getState().playCard(card, { row: 0, col: 0 });

    // The human's move should be visible right away (this is what lets
    // the player actually see their own capture before the AI responds) -
    // but the AI has not moved yet.
    expect(useGameStore.getState().game?.history).toHaveLength(1);
    expect(useGameStore.getState().game?.history[0].player).toBe('blue');

    await promise;
    expect(useGameStore.getState().game?.history).toHaveLength(2);
    expect(useGameStore.getState().game?.history[1].player).toBe('red');
    expect(useGameStore.getState().game?.activePlayer).toBe('blue');
  });

  it('throws if called before a game has started', async () => {
    const card = makeCard('blue', 'blue-1');
    await expect(
      useGameStore.getState().playCard(card, { row: 0, col: 0 }),
    ).rejects.toThrow('Cannot play a card before a game has started');
  });

  it('throws if called for a human move while it is actually the AI turn', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    // The public API (startGame/playCard) always drains AI turns
    // automatically, so this state is otherwise unreachable through normal
    // use - force it directly via setState to confirm the defensive guard
    // in playCard actually fires rather than silently misbehaving.
    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, activePlayer: 'red' } });

    const card = useGameStore.getState().game!.players.red.hand[0];
    await expect(
      useGameStore.getState().playCard(card, { row: 1, col: 1 }),
    ).rejects.toThrow("It is the AI's turn");
  });
});

describe('triggerSuddenDeathRematch', () => {
  function finishAsDraw(): void {
    // Force the store into a finished-draw state directly (constructing a
    // real draw through play would need a contrived sequence of moves) -
    // triggerSuddenDeathRematch's own precondition check is exercised by
    // the "throws" test below using a genuinely non-draw state instead.
    const { game } = useGameStore.getState();
    const blueCard = makeCard('blue', 'blue-onboard');
    const redCard = makeCard('red', 'red-onboard');
    useGameStore.setState({
      game: {
        ...game!,
        board: [
          [{ card: blueCard }, { card: redCard }, { card: null }],
          [{ card: null }, { card: null }, { card: null }],
          [{ card: null }, { card: null }, { card: null }],
        ],
        phase: 'finished',
        winner: 'draw',
      },
    });
  }

  it('starts a new live game (phase suddenDeath) after a drawn finished game', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    expect(game?.phase).toBe('suddenDeath');
    expect(game?.winner).toBeNull();
  });

  it('rebuilds each hand from what that side controlled on the board', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    expect(game?.players.blue.hand.map((c) => c.instanceId)).toEqual(['blue-onboard']);
    expect(game?.players.red.hand.map((c) => c.instanceId)).toEqual(['red-onboard']);
  });

  it('throws if there is no game at all', async () => {
    await expect(useGameStore.getState().triggerSuddenDeathRematch()).rejects.toThrow(
      'Cannot start Sudden Death without a game',
    );
  });

  it('throws (via the engine) if the game is not actually a finished draw', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    await expect(useGameStore.getState().triggerSuddenDeathRematch()).rejects.toThrow();
  });

  it('auto-plays the AI if the AI is the rematch starting player', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    // Red (AI) started, per the original startingPlayer, and should have
    // auto-played its first move, handing the turn to blue.
    expect(game?.activePlayer).toBe('blue');
  });
});

describe('reset', () => {
  it('clears the game and aiPlayer back to null', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    useGameStore.getState().reset();

    const { game, aiPlayer } = useGameStore.getState();
    expect(game).toBeNull();
    expect(aiPlayer).toBeNull();
  });
});