import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from './board';
import { resolveCaptures } from './ruleEngine';
import { DEFAULT_RULE_SET } from './gameReducer';
import type { Board, Card, Position } from './types';

function makeCard(
  owner: 'blue' | 'red',
  stats: { top: number; bottom: number; left: number; right: number },
  instanceId = 'test-card',
  element?: string,
): Card {
  return { instanceId, unitId: 'test-unit', owner, stats, element };
}

function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('resolveCaptures (composed rule engine)', () => {
  it('falls back to the base rule when no modifiers are active', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const result = resolveCaptures(board, placed, { row: 1, col: 0 }, DEFAULT_RULE_SET);

    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
    expect(result.comboTriggered).toBe(false);
  });

  it('uses the Same rule when active and it produces a capture', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 1 },
      { ...DEFAULT_RULE_SET, same: true },
    );

    expect(result.captured).toHaveLength(2);
  });

  it('falls back to base rule when Same is active but does not trigger', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 0 },
      { ...DEFAULT_RULE_SET, same: true },
    );

    // Same doesn't fire (no 2+ matches), so it should fall back to base capture.
    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('applies Elemental bonus before evaluating the base rule', () => {
    const board = createEmptyBoard();
    board[1][0].element = 'warp';
    // neighbor's facing value is 5; placed card's raw right=5 would tie (no capture),
    // but a matching Elemental cell bumps it to 6, which should now capture.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard(
      'blue',
      { top: 5, bottom: 5, left: 5, right: 5 },
      'blue-1',
      'warp',
    );

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 0 },
      { ...DEFAULT_RULE_SET, elemental: true },
    );

    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('passes the Same Wall value through when both same and sameWall are active', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 10 }, 'red-right'), {
      row: 0,
      col: 1,
    });
    const placed = makeCard('blue', { top: 10, bottom: 1, left: 10, right: 1 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 0, col: 0 },
      { ...DEFAULT_RULE_SET, same: true, sameWall: true },
    );

    // top+left match the wall (10), right matches red-right's left (1) -> 3 matches, captures red-right.
    expect(result.captured).toEqual([{ row: 0, col: 1 }]);
  });
});