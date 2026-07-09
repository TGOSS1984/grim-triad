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
  it('creates a game with no AI (local PvP) and does not auto-play any move', () => {
    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const { game } = useGameStore.getState();
    expect(game).not.toBeNull();
    expect(game?.activePlayer).toBe('blue');
    expect(game?.history).toHaveLength(0);
  });

  it('auto-plays the AI immediately when the AI is the starting player', () => {
    useGameStore.getState().startGame({
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
});

describe('playCard', () => {
  it('applies a human move and does not auto-play when there is no AI', () => {
    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    useGameStore.getState().playCard(card, { row: 0, col: 0 });

    const { game } = useGameStore.getState();
    expect(game?.history).toHaveLength(1);
    expect(game?.activePlayer).toBe('red');
  });

  it('auto-plays the AI turn immediately after a human move', () => {
    useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    useGameStore.getState().playCard(card, { row: 0, col: 0 });

    const { game } = useGameStore.getState();
    // Blue's move + red (AI)'s auto-played response = 2 history entries.
    expect(game?.history).toHaveLength(2);
    expect(game?.history[1].player).toBe('red');
    expect(game?.activePlayer).toBe('blue');
  });

  it('throws if called before a game has started', () => {
    const card = makeCard('blue', 'blue-1');
    expect(() => useGameStore.getState().playCard(card, { row: 0, col: 0 })).toThrow(
      'Cannot play a card before a game has started',
    );
  });

  it('throws if called for a human move while it is actually the AI turn', () => {
    useGameStore.getState().startGame({
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
    expect(() => useGameStore.getState().playCard(card, { row: 1, col: 1 })).toThrow(
      "It is the AI's turn",
    );
  });
});

describe('reset', () => {
  it('clears the game and aiPlayer back to null', () => {
    useGameStore.getState().startGame({
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