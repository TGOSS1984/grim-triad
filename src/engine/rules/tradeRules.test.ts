import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { resolveTradeRule } from './tradeRules';
import { DEFAULT_RULE_SET } from '../gameReducer';
import type { Board, Card, GameState, PlayerColour } from '../types';

function makeCard(owner: PlayerColour, instanceId: string): Card {
  return {
    instanceId,
    unitId: `unit-${instanceId}`,
    owner,
    stats: { top: 1, bottom: 1, left: 1, right: 1 },
  };
}

/**
 * Builds a finished game state where blue controls `blueCount` cells and
 * red controls the remaining cells (up to 9), both hands empty, winner
 * pre-computed. Only used to exercise resolveTradeRule in isolation.
 */
function finishedGame(blueCount: number, redCount: number, tradeRule: GameState['ruleSet']['tradeRule']): GameState {
  const board: Board = createEmptyBoard();
  let placed = 0;
  for (let row = 0; row < 3 && placed < blueCount; row++) {
    for (let col = 0; col < 3 && placed < blueCount; col++) {
      board[row][col].card = makeCard('blue', `blue-${placed}`);
      placed++;
    }
  }
  let redPlaced = 0;
  outer: for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (board[row][col].card) continue;
      if (redPlaced >= redCount) break outer;
      board[row][col].card = makeCard('red', `red-${redPlaced}`);
      redPlaced++;
    }
  }

  const winner: PlayerColour = blueCount > redCount ? 'blue' : 'red';

  return {
    board,
    players: {
      blue: { colour: 'blue', hand: [] },
      red: { colour: 'red', hand: [] },
    },
    activePlayer: 'blue',
    ruleSet: { ...DEFAULT_RULE_SET, tradeRule },
    phase: 'finished',
    winner,
    history: [],
  };
}

describe('resolveTradeRule', () => {
  it('throws if the game is not finished with a clear winner', () => {
    const state = finishedGame(5, 4, 'one');
    state.phase = 'playing';
    expect(() => resolveTradeRule(state)).toThrow();
  });

  it('One: winner takes exactly one card from the loser', () => {
    const state = finishedGame(5, 4, 'one');
    const result = resolveTradeRule(state);

    expect(result.transferred).toHaveLength(1);
    expect(result.transferred[0].from).toBe('red');
    expect(result.transferred[0].to).toBe('blue');
    expect(result.finalPools.blue).toHaveLength(6);
    expect(result.finalPools.red).toHaveLength(3);
  });

  it('Diff: winner takes cards equal to the margin of victory', () => {
    // blue controls 4, red controls 1 on the board -> margin 3.
    // Give red 2 extra cards in hand so the loser pool (3 total) can
    // actually satisfy a transfer of 3 without the pool-size cap kicking in.
    const state = finishedGame(4, 1, 'diff');
    state.players.red.hand = [makeCard('red', 'red-hand-1'), makeCard('red', 'red-hand-2')];
    const result = resolveTradeRule(state);

    expect(result.transferred).toHaveLength(3);
    expect(result.finalPools.blue).toHaveLength(7);
    expect(result.finalPools.red).toHaveLength(0);
  });

  it('Diff: winner takes ALL cards if margin exceeds 5', () => {
    // blue controls 8, red controls 1 -> margin 7
    const state = finishedGame(8, 1, 'diff');
    const result = resolveTradeRule(state);

    expect(result.transferred).toHaveLength(1);
    expect(result.finalPools.blue).toHaveLength(9);
    expect(result.finalPools.red).toHaveLength(0);
  });

  it('Direct: no transfer happens, each side keeps board control', () => {
    const state = finishedGame(6, 3, 'direct');
    const result = resolveTradeRule(state);

    expect(result.transferred).toHaveLength(0);
    expect(result.finalPools.blue).toHaveLength(6);
    expect(result.finalPools.red).toHaveLength(3);
  });

  it('All: winner takes every card the loser has', () => {
    const state = finishedGame(6, 3, 'all');
    const result = resolveTradeRule(state);

    expect(result.transferred).toHaveLength(3);
    expect(result.finalPools.blue).toHaveLength(9);
    expect(result.finalPools.red).toHaveLength(0);
  });
});