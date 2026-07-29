import { describe, it, expect } from 'vitest';
import {
  applyMove,
  createGame,
  DEFAULT_RULE_SET,
  IllegalMoveError,
  countCardsOnBoard,
  sumPointsOnBoard,
} from './gameReducer';
import { createEmptyBoard } from './board';
import type { Board, Card, Move, PlayerState, Position } from './types';

function makeCard(
  owner: 'blue' | 'red',
  instanceId: string,
  stats = { top: 5, bottom: 5, left: 5, right: 5 },
  points?: number,
): Card {
  return { instanceId, unitId: `unit-${instanceId}`, owner, stats, points };
}

function makeHand(owner: 'blue' | 'red', count: number): Card[] {
  return Array.from({ length: count }, (_, i) => makeCard(owner, `${owner}-${i}`));
}

/** Places a card directly on the board without going through the reducer - same convention as capture.test.ts's own helper, used here to construct an already-8-of-9-full board so a test can drive just the ONE final move that fills it, rather than needing to simulate a full alternating game. */
function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
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

  it('declares blue winner via POINTS even while controlling fewer cards, when winCondition is "points"', () => {
    const state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, winCondition: 'points' };

    // 8 of 9 cells already filled directly (bypassing a full alternating
    // game, which strict turn-order would make fiddly to orchestrate for
    // an exact final tally) - blue holds just 1 cell but it's worth 500,
    // red holds 7 cells worth only 10 each. The 9th, final move (red,
    // completing the board) is the one actually driven through
    // applyMove, so determineWinner's real branching gets exercised, not
    // just asserted against directly.
    place(state.board, makeCard('blue', 'blue-expensive', undefined, 500), { row: 1, col: 1 });
    const redPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
    ];
    for (const pos of redPositions) {
      place(state.board, makeCard('red', `red-${pos.row}-${pos.col}`, undefined, 10), pos);
    }

    const finalRedCard = makeCard('red', 'red-final', undefined, 10);
    state.activePlayer = 'red';
    state.players.red.hand = [finalRedCard];

    const next = applyMove(state, { player: 'red', card: finalRedCard, position: { row: 2, col: 2 } });

    expect(next.phase).toBe('finished');
    expect(countCardsOnBoard(next.board, 'blue')).toBe(1);
    expect(countCardsOnBoard(next.board, 'red')).toBe(8);
    expect(sumPointsOnBoard(next.board, 'blue')).toBe(500);
    expect(sumPointsOnBoard(next.board, 'red')).toBe(80);
    expect(next.winner).toBe('blue');
  });

  it('the identical board loses for blue under the default "cards" win condition - confirms the points test above is really testing the branch, not a fluke', () => {
    const state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, winCondition: 'cards' };

    place(state.board, makeCard('blue', 'blue-expensive', undefined, 500), { row: 1, col: 1 });
    const redPositions: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
    ];
    for (const pos of redPositions) {
      place(state.board, makeCard('red', `red-${pos.row}-${pos.col}`, undefined, 10), pos);
    }

    const finalRedCard = makeCard('red', 'red-final', undefined, 10);
    state.activePlayer = 'red';
    state.players.red.hand = [finalRedCard];

    const next = applyMove(state, { player: 'red', card: finalRedCard, position: { row: 2, col: 2 } });

    expect(next.winner).toBe('red');
  });

  it('a "points" match ends in a draw when both sides hold equal total points, even with unequal card counts', () => {
    const state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, winCondition: 'points' };

    // Blue: 1 cell worth 100. Red: 2 cells worth 50 each - equal totals,
    // unequal counts. The rest of the board is filled with 0-point
    // filler on both sides so it doesn't affect either total.
    place(state.board, makeCard('blue', 'blue-100', undefined, 100), { row: 0, col: 0 });
    place(state.board, makeCard('red', 'red-50-a', undefined, 50), { row: 0, col: 1 });
    place(state.board, makeCard('red', 'red-50-b', undefined, 50), { row: 0, col: 2 });
    place(state.board, makeCard('blue', 'blue-filler-1', undefined, 0), { row: 1, col: 0 });
    place(state.board, makeCard('red', 'red-filler-1', undefined, 0), { row: 1, col: 1 });
    place(state.board, makeCard('blue', 'blue-filler-2', undefined, 0), { row: 1, col: 2 });
    place(state.board, makeCard('red', 'red-filler-2', undefined, 0), { row: 2, col: 0 });
    place(state.board, makeCard('blue', 'blue-filler-3', undefined, 0), { row: 2, col: 1 });

    const finalCard = makeCard('red', 'red-filler-final', undefined, 0);
    state.activePlayer = 'red';
    state.players.red.hand = [finalCard];

    const next = applyMove(state, { player: 'red', card: finalCard, position: { row: 2, col: 2 } });

    expect(next.phase).toBe('finished');
    expect(sumPointsOnBoard(next.board, 'blue')).toBe(sumPointsOnBoard(next.board, 'red'));
    expect(next.winner).toBe('draw');
  });

  it('records an empty lastCapture when the move captures nothing', () => {
    const state = newTestGame();
    const move: Move = { player: 'blue', card: state.players.blue.hand[0], position: { row: 0, col: 0 } };

    const next = applyMove(state, move);

    expect(next.lastCapture).toEqual({ positions: [], comboTriggered: false, captureKinds: [] });
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
      captureKinds: ['base'],
    });
  });
});

describe('sumPointsOnBoard (direct, engine/gameReducer.ts)', () => {
  it('sums points for only the given colour', () => {
    const board = createEmptyBoard();
    board[0][0].card = makeCard('blue', 'b1', undefined, 100);
    board[0][1].card = makeCard('blue', 'b2', undefined, 50);
    board[1][0].card = makeCard('red', 'r1', undefined, 300);

    expect(sumPointsOnBoard(board, 'blue')).toBe(150);
    expect(sumPointsOnBoard(board, 'red')).toBe(300);
  });

  it('returns 0 for an empty board', () => {
    const board = createEmptyBoard();
    expect(sumPointsOnBoard(board, 'blue')).toBe(0);
  });

  it('treats a card with no points recorded as contributing 0, not throwing', () => {
    const board = createEmptyBoard();
    board[0][0].card = makeCard('blue', 'no-points-set'); // points left undefined

    expect(() => sumPointsOnBoard(board, 'blue')).not.toThrow();
    expect(sumPointsOnBoard(board, 'blue')).toBe(0);
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

describe('applyMove: Underdog', () => {
  it('grants hasUnderdogBonus when a cheap card captures something 50%+ more expensive', () => {
    let state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, underdog: true };

    const cheapAttacker = makeCard('blue', 'blue-cheap', { top: 9, bottom: 1, left: 1, right: 1 });
    cheapAttacker.points = 100;
    state.players.blue.hand[0] = cheapAttacker;
    state = applyMove(state, { player: 'blue', card: cheapAttacker, position: { row: 1, col: 1 } });

    const expensiveVictim = makeCard('red', 'red-expensive', { top: 1, bottom: 5, left: 5, right: 5 });
    expensiveVictim.points = 150; // exactly 1.5x - meets the threshold
    state.players.red.hand[0] = expensiveVictim;
    state = applyMove(state, { player: 'red', card: expensiveVictim, position: { row: 0, col: 1 } });

    // Red's placement doesn't capture anything (blue's card there has a
    // higher top than red's bottom would need) - need blue to do the
    // capturing. Let's have blue capture red's expensive card next.
    const secondCheapBlue = makeCard('blue', 'blue-cheap-2', { top: 1, bottom: 1, left: 1, right: 9 });
    secondCheapBlue.points = 100;
    state.players.blue.hand[0] = secondCheapBlue;
    state = applyMove(state, { player: 'blue', card: secondCheapBlue, position: { row: 0, col: 0 } });

    const capturedCard = state.board[0][1].card;
    expect(capturedCard?.owner).toBe('blue');
    const capturingCard = state.board[0][0].card;
    expect(capturingCard?.hasUnderdogBonus).toBe(true);
  });

  it('does NOT trigger when the captured card costs less than 50% more', () => {
    let state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, underdog: true };

    const attacker = makeCard('blue', 'blue-1', { top: 9, bottom: 1, left: 1, right: 1 });
    attacker.points = 100;
    state.players.blue.hand[0] = attacker;
    state = applyMove(state, { player: 'blue', card: attacker, position: { row: 1, col: 1 } });

    const victim = makeCard('red', 'red-1', { top: 1, bottom: 5, left: 5, right: 5 });
    victim.points = 140; // only 1.4x - below the 1.5x threshold
    state.players.red.hand[0] = victim;
    state = applyMove(state, { player: 'red', card: victim, position: { row: 0, col: 1 } });

    const secondBlue = makeCard('blue', 'blue-2', { top: 1, bottom: 1, left: 1, right: 9 });
    secondBlue.points = 100;
    state.players.blue.hand[0] = secondBlue;
    state = applyMove(state, { player: 'blue', card: secondBlue, position: { row: 0, col: 0 } });

    expect(state.board[0][0].card?.hasUnderdogBonus).toBeFalsy();
  });

  it('does not trigger at all when the rule is off, even for an otherwise-qualifying capture', () => {
    let state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, underdog: false };

    const cheapAttacker = makeCard('blue', 'blue-cheap', { top: 9, bottom: 1, left: 1, right: 1 });
    cheapAttacker.points = 100;
    state.players.blue.hand[0] = cheapAttacker;
    state = applyMove(state, { player: 'blue', card: cheapAttacker, position: { row: 1, col: 1 } });

    const expensiveVictim = makeCard('red', 'red-expensive', { top: 1, bottom: 5, left: 5, right: 5 });
    expensiveVictim.points = 200;
    state.players.red.hand[0] = expensiveVictim;
    state = applyMove(state, { player: 'red', card: expensiveVictim, position: { row: 0, col: 1 } });

    const secondCheapBlue = makeCard('blue', 'blue-cheap-2', { top: 1, bottom: 1, left: 1, right: 9 });
    secondCheapBlue.points = 100;
    state.players.blue.hand[0] = secondCheapBlue;
    state = applyMove(state, { player: 'blue', card: secondCheapBlue, position: { row: 0, col: 0 } });

    expect(state.board[0][0].card?.hasUnderdogBonus).toBeFalsy();
  });

  it('does not trigger when either card has no points data (undefined)', () => {
    let state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, underdog: true };

    // No .points set on either card (as makeCard leaves it by default).
    const attacker = makeCard('blue', 'blue-cheap', { top: 9, bottom: 1, left: 1, right: 1 });
    state.players.blue.hand[0] = attacker;
    state = applyMove(state, { player: 'blue', card: attacker, position: { row: 1, col: 1 } });

    const victim = makeCard('red', 'red-expensive', { top: 1, bottom: 5, left: 5, right: 5 });
    state.players.red.hand[0] = victim;
    state = applyMove(state, { player: 'red', card: victim, position: { row: 0, col: 1 } });

    const secondBlue = makeCard('blue', 'blue-cheap-2', { top: 1, bottom: 1, left: 1, right: 9 });
    state.players.blue.hand[0] = secondBlue;
    state = applyMove(state, { player: 'blue', card: secondBlue, position: { row: 0, col: 0 } });

    expect(state.board[0][0].card?.hasUnderdogBonus).toBeFalsy();
  });
});

describe('createGame: Epic Hero Presence', () => {
  it('sets a random side for a player whose starting hand contains an Epic Hero', () => {
    const epicHero = makeCard('blue', 'blue-hero');
    epicHero.keywords = ['Character', 'Epic Hero'];
    const bluePlayer: PlayerState = { colour: 'blue', hand: [epicHero, ...makeHand('blue', 4)] };
    const redPlayer: PlayerState = { colour: 'red', hand: makeHand('red', 5) };

    const state = createGame({
      bluePlayer,
      redPlayer,
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: true },
    });

    expect(state.epicHeroPresence?.blue).toBeDefined();
    expect(['top', 'bottom', 'left', 'right']).toContain(state.epicHeroPresence?.blue);
    expect(state.epicHeroPresence?.red).toBeUndefined();
  });

  it('sets no presence at all when neither starting hand has an Epic Hero', () => {
    const bluePlayer: PlayerState = { colour: 'blue', hand: makeHand('blue', 5) };
    const redPlayer: PlayerState = { colour: 'red', hand: makeHand('red', 5) };

    const state = createGame({
      bluePlayer,
      redPlayer,
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: true },
    });

    expect(state.epicHeroPresence).toBeUndefined();
  });

  it('does not compute anything at all when the rule is off, even with an Epic Hero in hand', () => {
    const epicHero = makeCard('blue', 'blue-hero');
    epicHero.keywords = ['Character', 'Epic Hero'];
    const bluePlayer: PlayerState = { colour: 'blue', hand: [epicHero, ...makeHand('blue', 4)] };
    const redPlayer: PlayerState = { colour: 'red', hand: makeHand('red', 5) };

    const state = createGame({
      bluePlayer,
      redPlayer,
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: false },
    });

    expect(state.epicHeroPresence).toBeUndefined();
  });

  it('sets independent sides for both players when both starting hands have an Epic Hero', () => {
    const blueHero = makeCard('blue', 'blue-hero');
    blueHero.keywords = ['Epic Hero'];
    const redHero = makeCard('red', 'red-hero');
    redHero.keywords = ['Epic Hero'];
    const bluePlayer: PlayerState = { colour: 'blue', hand: [blueHero, ...makeHand('blue', 4)] };
    const redPlayer: PlayerState = { colour: 'red', hand: [redHero, ...makeHand('red', 4)] };

    const state = createGame({
      bluePlayer,
      redPlayer,
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, epicHeroPresence: true },
    });

    expect(state.epicHeroPresence?.blue).toBeDefined();
    expect(state.epicHeroPresence?.red).toBeDefined();
  });
});