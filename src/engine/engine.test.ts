import { describe, it, expect } from 'vitest';
import { applyMove, createGame, DEFAULT_RULE_SET, IllegalMoveError } from './gameReducer';
import type { Card, Move, PlayerState } from './types';

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

function newTestGame() {
  const bluePlayer: PlayerState = { colour: 'blue', hand: makeHand('blue', 5) };
  const redPlayer: PlayerState = { colour: 'red', hand: makeHand('red', 5) };
  return createGame({ bluePlayer, redPlayer, startingPlayer: 'blue' });
}

describe('createGame', () => {
  it('starts in the playing phase with the designated starting player', () => {
    const state = newTestGame();
    expect(state.phase).toBe('playing');
    expect(state.activePlayer).toBe('blue');
    expect(state.winner).toBeNull();
  });

  it('starts with an empty board', () => {
    const state = newTestGame();
    for (const row of state.board) {
      for (const cell of row) {
        expect(cell.card).toBeNull();
      }
    }
  });
});

describe('applyMove', () => {
  it('places the card and removes it from the player hand', () => {
    const state = newTestGame();
    const card = state.players.blue.hand[0];
    const move: Move = { player: 'blue', card, position: { row: 0, col: 0 } };

    const next = applyMove(state, move);

    expect(next.board[0][0].card?.instanceId).toBe(card.instanceId);
    expect(next.players.blue.hand).toHaveLength(4);
    expect(next.players.blue.hand.find((c) => c.instanceId === card.instanceId)).toBeUndefined();
  });

  it('alternates the active player after a move', () => {
    const state = newTestGame();
    const move: Move = { player: 'blue', card: state.players.blue.hand[0], position: { row: 0, col: 0 } };

    const next = applyMove(state, move);

    expect(next.activePlayer).toBe('red');
  });

  it('does not mutate the original state (pure function)', () => {
    const state = newTestGame();
    const move: Move = { player: 'blue', card: state.players.blue.hand[0], position: { row: 0, col: 0 } };

    applyMove(state, move);

    expect(state.board[0][0].card).toBeNull();
    expect(state.players.blue.hand).toHaveLength(5);
  });

  it('rejects a move from the player who is not active', () => {
    const state = newTestGame();
    const move: Move = { player: 'red', card: state.players.red.hand[0], position: { row: 0, col: 0 } };

    expect(() => applyMove(state, move)).toThrow(IllegalMoveError);
  });

  it('rejects a move onto an occupied cell', () => {
    let state = newTestGame();
    const firstMove: Move = { player: 'blue', card: state.players.blue.hand[0], position: { row: 1, col: 1 } };
    state = applyMove(state, firstMove);

    const secondMove: Move = { player: 'red', card: state.players.red.hand[0], position: { row: 1, col: 1 } };
    expect(() => applyMove(state, secondMove)).toThrow(IllegalMoveError);
  });

  it('rejects a card that is not in the moving player hand', () => {
    const state = newTestGame();
    const foreignCard = makeCard('blue', 'not-in-hand');
    const move: Move = { player: 'blue', card: foreignCard, position: { row: 0, col: 0 } };

    expect(() => applyMove(state, move)).toThrow(IllegalMoveError);
  });

  it('flips a captured card to the placing player color', () => {
    let state = newTestGame();
    // Blue places a weak card first so red can legally sit next to it.
    const weakBlue = makeCard('blue', 'blue-weak', { top: 1, bottom: 1, left: 1, right: 1 });
    state.players.blue.hand[0] = weakBlue;
    state = applyMove(state, { player: 'blue', card: weakBlue, position: { row: 1, col: 0 } });

    const strongRed = makeCard('red', 'red-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.red.hand[0] = strongRed;
    state = applyMove(state, { player: 'red', card: strongRed, position: { row: 1, col: 1 } });

    expect(state.board[1][0].card?.owner).toBe('red');
    expect(state.board[1][0].card?.instanceId).toBe('blue-weak');
  });

  it('finishes the game and determines a winner once the board is full', () => {
    let state = newTestGame();
    const positions = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ] as const;

    // Alternate blue/red placing all equal-strength cards (no captures) until full.
    let turn: 'blue' | 'red' = 'blue';
    for (const pos of positions) {
      const hand = state.players[turn].hand;
      if (hand.length === 0) break;
      state = applyMove(state, { player: turn, card: hand[0], position: pos });
      turn = turn === 'blue' ? 'red' : 'blue';
    }

    expect(state.phase).toBe('finished');
    // 5 cards each, 9 slots -> not possible to fill all 9 with 5+5=10 hand... actually 5+5=10 >= 9, ok fills.
    expect(state.winner).not.toBeNull();
  });

  it('declares blue winner when blue controls more cards at game end', () => {
    let state = newTestGame();
    // Craft a sequence where blue captures everything red places.
    const strongBlue = () => makeCard('blue', `blue-${Math.random()}`, { top: 9, bottom: 9, left: 9, right: 9 });
    const weakRed = () => makeCard('red', `red-${Math.random()}`, { top: 1, bottom: 1, left: 1, right: 1 });

    state.players.blue.hand = Array.from({ length: 5 }, strongBlue);
    state.players.red.hand = Array.from({ length: 5 }, weakRed);

    const positions = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ] as const;

    let turn: 'blue' | 'red' = 'blue';
    for (const pos of positions) {
      const hand = state.players[turn].hand;
      if (hand.length === 0) break;
      state = applyMove(state, { player: turn, card: hand[0], position: pos });
      turn = turn === 'blue' ? 'red' : 'blue';
    }

    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('blue');
  });

  it('records an empty lastCapture when the move captures nothing', () => {
    const state = newTestGame();
    const move: Move = { player: 'blue', card: state.players.blue.hand[0], position: { row: 0, col: 0 } };

    const next = applyMove(state, move);

    expect(next.lastCapture).toEqual({ positions: [], comboTriggered: false });
  });

  it('records the captured position(s) in lastCapture when a move does capture', () => {
    let state = newTestGame();
    const weakBlue = makeCard('blue', 'blue-weak', { top: 1, bottom: 1, left: 1, right: 1 });
    state.players.blue.hand[0] = weakBlue;
    state = applyMove(state, { player: 'blue', card: weakBlue, position: { row: 1, col: 0 } });

    const strongRed = makeCard('red', 'red-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.red.hand[0] = strongRed;
    state = applyMove(state, { player: 'red', card: strongRed, position: { row: 1, col: 1 } });

    expect(state.lastCapture).toEqual({
      positions: [{ row: 1, col: 0 }],
      comboTriggered: false,
    });
  });
});

describe('createGame: Elemental terrain wiring', () => {
  it('assigns no elements to the board when the Elemental rule is inactive', () => {
    const state = createGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, elemental: false },
      availableElements: ['warp', 'fire', 'void'],
    });

    const anyElementAssigned = state.board.flat().some((cell) => cell.element !== undefined);
    expect(anyElementAssigned).toBe(false);
  });

  it('assigns no elements even when active, if no element pool is provided', () => {
    const state = createGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, elemental: true },
    });

    const anyElementAssigned = state.board.flat().some((cell) => cell.element !== undefined);
    expect(anyElementAssigned).toBe(false);
  });

  it('assigns elements to some board cells when the Elemental rule is active with a pool', () => {
    const state = createGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, elemental: true },
      availableElements: ['warp', 'fire', 'void'],
    });

    const elementedCells = state.board.flat().filter((cell) => cell.element !== undefined);
    expect(elementedCells.length).toBeGreaterThan(0);
    for (const cell of elementedCells) {
      expect(['warp', 'fire', 'void']).toContain(cell.element);
    }
  });
});