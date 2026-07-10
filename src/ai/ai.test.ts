import { describe, it, expect } from 'vitest';
import { getLegalMoves, scoreMove, chooseMove } from './heuristicAI';
import { createGame, applyMove, DEFAULT_RULE_SET } from '../engine/gameReducer';
import type { Card, GameState, PlayerState } from '../engine/types';

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

function newTestGame(): GameState {
  const bluePlayer: PlayerState = { colour: 'blue', hand: makeHand('blue', 5) };
  const redPlayer: PlayerState = { colour: 'red', hand: makeHand('red', 5) };
  return createGame({ bluePlayer, redPlayer, startingPlayer: 'blue' });
}

describe('getLegalMoves', () => {
  it('enumerates every (card, empty position) pairing', () => {
    const state = newTestGame();
    const moves = getLegalMoves(state, 'blue');
    // 5 cards in hand x 9 empty cells
    expect(moves).toHaveLength(45);
  });

  it('shrinks as the board fills up', () => {
    let state = newTestGame();
    state = { ...state, board: state.board };
    state.board[0][0].card = makeCard('blue', 'placed');
    const moves = getLegalMoves(state, 'red');
    expect(moves).toHaveLength(5 * 8);
  });

  it('returns an empty list when the hand is empty', () => {
    const state = newTestGame();
    state.players.blue.hand = [];
    expect(getLegalMoves(state, 'blue')).toEqual([]);
  });
});

describe('scoreMove (immediate captures, lookahead disabled)', () => {
  it('scores a capturing move higher than a non-capturing move', () => {
    const state = newTestGame();
    // Weak red card already on the board.
    state.board[1][1].card = makeCard('red', 'red-weak', {
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
    const strongCard = makeCard('blue', 'blue-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.blue.hand[0] = strongCard;

    const capturingMove = { player: 'blue' as const, card: strongCard, position: { row: 0 as const, col: 1 as const } };
    const nonCapturingMove = { player: 'blue' as const, card: strongCard, position: { row: 2 as const, col: 2 as const } };

    const capturingScore = scoreMove(state, capturingMove, { lookaheadWeight: 0 });
    const nonCapturingScore = scoreMove(state, nonCapturingMove, { lookaheadWeight: 0 });

    expect(capturingScore).toBeGreaterThan(nonCapturingScore);
  });

  it('scores a plain multi-side Same capture without a cascading chain (no combo bonus)', () => {
    const state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, same: true };
    // Two matched sides, but neither flipped card has a further neighbor to
    // chain into - comboTriggered should stay false (it only fires when
    // the capture cascades beyond the initial Same match - see same.ts).
    state.board[0][1].card = makeCard('red', 'red-top', { top: 1, bottom: 5, left: 1, right: 1 });
    state.board[1][2].card = makeCard('red', 'red-right', { top: 1, bottom: 1, left: 5, right: 1 });
    const sameCard = makeCard('blue', 'blue-same', { top: 5, bottom: 1, left: 1, right: 5 });
    state.players.blue.hand[0] = sameCard;

    const move = { player: 'blue' as const, card: sameCard, position: { row: 1 as const, col: 1 as const } };
    const score = scoreMove(state, move, { lookaheadWeight: 0 });

    // 2 captures * weight(2), no combo bonus since nothing cascaded.
    expect(score).toBe(4);
  });

  it('gives a genuinely cascading combo an extra bonus over its base capture count', () => {
    const state = newTestGame();
    state.ruleSet = { ...DEFAULT_RULE_SET, same: true };
    // Same setup as above, but red-right has a further weak neighbor that
    // it should capture via the base rule once flipped to blue - a real
    // cascading chain (comboTriggered: true).
    state.board[0][1].card = makeCard('red', 'red-top', { top: 1, bottom: 5, left: 1, right: 1 });
    state.board[1][2].card = makeCard('red', 'red-right', { top: 1, bottom: 9, left: 5, right: 1 });
    state.board[2][2].card = makeCard('red', 'red-below-right', {
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
    const comboCard = makeCard('blue', 'blue-combo', { top: 5, bottom: 1, left: 1, right: 5 });
    state.players.blue.hand[0] = comboCard;

    const move = { player: 'blue' as const, card: comboCard, position: { row: 1 as const, col: 1 as const } };
    const score = scoreMove(state, move, { lookaheadWeight: 0 });

    // 3 captures (2 Same + 1 chained) * weight(2) + combo bonus(1) = 7
    expect(score).toBe(7);
  });
});

describe('scoreMove (lookahead)', () => {
  it('penalizes a move that leaves the opponent a strong immediate reply', () => {
    const state = newTestGame();
    // blue's card captures nothing wherever placed (weak card, empty board);
    // but placing at (1,1) center leaves 4 exposed sides for red to exploit
    // with a very strong red card, vs a corner placement which leaves fewer
    // exposed neighbors for a same-strength reply to matter.
    const weakCard = makeCard('blue', 'blue-weak', { top: 1, bottom: 1, left: 1, right: 1 });
    state.players.blue.hand[0] = weakCard;
    // Give red a very strong card in hand capable of capturing the weak
    // blue card from any adjacent side once placed.
    state.players.red.hand[0] = makeCard('red', 'red-strong', {
      top: 9,
      bottom: 9,
      left: 9,
      right: 9,
    });

    const centerMove = { player: 'blue' as const, card: weakCard, position: { row: 1 as const, col: 1 as const } };
    const cornerMove = { player: 'blue' as const, card: weakCard, position: { row: 0 as const, col: 0 as const } };

    const centerScore = scoreMove(state, centerMove);
    const cornerScore = scoreMove(state, cornerMove);

    // Center placement is adjacent to more empty cells red could attack from
    // is not itself the mechanism here - what matters is red's best capture
    // of the (now-placed) weak blue card, which is possible from ANY
    // adjacent side in both cases. This test instead confirms the lookahead
    // penalty is being applied at all (score is reduced vs no-lookahead).
    const noLookaheadScore = scoreMove(state, centerMove, { lookaheadWeight: 0 });
    expect(centerScore).toBeLessThan(noLookaheadScore);
    expect(cornerScore).toBeLessThan(scoreMove(state, cornerMove, { lookaheadWeight: 0 }));
  });

  it('applies no lookahead penalty when lookaheadWeight is 0', () => {
    const state = newTestGame();
    const card = state.players.blue.hand[0];
    const move = { player: 'blue' as const, card, position: { row: 1 as const, col: 1 as const } };

    const score = scoreMove(state, move, { lookaheadWeight: 0 });
    expect(score).toBe(0);
  });
});

describe('chooseMove', () => {
  it('chooses the move with the highest score (obvious capture over no capture)', () => {
    const state = newTestGame();
    state.board[1][1].card = makeCard('red', 'red-weak', {
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
    const strongCard = makeCard('blue', 'blue-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.blue.hand = [strongCard];

    const chosen = chooseMove(state, 'blue', { lookaheadWeight: 0 });

    // Only a placement adjacent to (1,1) can capture; verify the chosen
    // position is indeed adjacent to the weak red card.
    const adjacent = [
      { row: 0, col: 1 },
      { row: 2, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
    ];
    expect(adjacent).toContainEqual(chosen.position);
  });

  it('throws when the player has no cards in hand', () => {
    const state = newTestGame();
    state.players.blue.hand = [];
    expect(() => chooseMove(state, 'blue')).toThrow('No legal moves available for blue');
  });

  it('always returns a move for the requested player, given it is genuinely their turn', () => {
    let state = newTestGame();
    // Advance one move so it's actually red's turn before asking the AI
    // to move for red - chooseMove/applyMove correctly reject an
    // out-of-turn request, so the test must set up a legal turn state.
    const blueCard = state.players.blue.hand[0];
    state = applyMove(state, { player: 'blue', card: blueCard, position: { row: 0, col: 0 } });

    const move = chooseMove(state, 'red');
    expect(move.player).toBe('red');
  });

  it('with mistakeChance 1, ignores its own scoring and can play a move other than the best one', () => {
    const state = newTestGame();
    state.board[1][1].card = makeCard('red', 'red-weak', {
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
    const strongCard = makeCard('blue', 'blue-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.blue.hand = [strongCard];

    // With mistakeChance forced to 1, run many trials - at least one
    // should land somewhere other than the one obviously-best capture
    // position (a purely-scored AI would pick that same spot every time).
    const positions = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const chosen = chooseMove(state, 'blue', { mistakeChance: 1 });
      positions.add(`${chosen.position.row},${chosen.position.col}`);
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('with mistakeChance 0 (default), always plays the best-scored move, same as before', () => {
    const state = newTestGame();
    state.board[1][1].card = makeCard('red', 'red-weak', {
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
    const strongCard = makeCard('blue', 'blue-strong', { top: 9, bottom: 9, left: 9, right: 9 });
    state.players.blue.hand = [strongCard];

    const adjacent = [
      { row: 0, col: 1 },
      { row: 2, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
    ];
    for (let i = 0; i < 10; i++) {
      const chosen = chooseMove(state, 'blue', { lookaheadWeight: 0, mistakeChance: 0 });
      expect(adjacent).toContainEqual(chosen.position);
    }
  });
  
});