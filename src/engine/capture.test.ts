import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from './board';
import { resolveBaseCaptures } from './capture';
import type { Board, Card, Position } from './types';

/** Test helper: builds a minimal card with given stats and owner. */
function makeCard(
  owner: 'blue' | 'red',
  stats: { top: number; bottom: number; left: number; right: number },
  instanceId = 'test-card',
): Card {
  return { instanceId, unitId: 'test-unit', owner, stats };
}

/** Test helper: places a card directly on the board without going through the reducer. */
function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('resolveBaseCaptures', () => {
  it('captures a single weaker neighbor', () => {
    const board = createEmptyBoard();
    // red card sits to the right of where blue will place.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 0 });

    // blue's right (5) vs red's left-facing value (left=3) -> blue wins
    expect(captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('does not capture when neighbor value is equal', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 0 });

    expect(captured).toEqual([]);
  });

  it('does not capture when neighbor value is higher', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 9, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 0 });

    expect(captured).toEqual([]);
  });

  it('does not capture cards belonging to the same player', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', { top: 1, bottom: 1, left: 1, right: 1 }, 'blue-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 9 }, 'blue-2');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 0 });

    expect(captured).toEqual([]);
  });

  it('captures multiple neighbors simultaneously', () => {
    const board = createEmptyBoard();
    // Place blue in the center, surrounded by weaker red cards on all 4 sides.
    place(board, makeCard('red', { top: 2, bottom: 2, left: 2, right: 2 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 2, bottom: 2, left: 2, right: 2 }, 'red-bottom'), {
      row: 2,
      col: 1,
    });
    place(board, makeCard('red', { top: 2, bottom: 2, left: 2, right: 2 }, 'red-left'), {
      row: 1,
      col: 0,
    });
    place(board, makeCard('red', { top: 2, bottom: 2, left: 2, right: 2 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-center');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 1 });

    expect(captured).toHaveLength(4);
    expect(captured).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 2, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 2 },
      ]),
    );
  });

  it('handles a 10 ("A" rank) beating a 9', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 9, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 10 }, 'blue-1');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 0 });

    expect(captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('ignores empty neighboring cells', () => {
    const board = createEmptyBoard();
    const placed = makeCard('blue', { top: 9, bottom: 9, left: 9, right: 9 }, 'blue-1');

    const captured = resolveBaseCaptures(board, placed, { row: 1, col: 1 });

    expect(captured).toEqual([]);
  });

  it('ignores neighbors off the edge of the board (corner placement)', () => {
    const board = createEmptyBoard();
    const placed = makeCard('blue', { top: 9, bottom: 9, left: 9, right: 9 }, 'blue-1');

    // corner has only 2 real neighbors (bottom, right) - should not throw
    expect(() => resolveBaseCaptures(board, placed, { row: 0, col: 0 })).not.toThrow();
  });
});