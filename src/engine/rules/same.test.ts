import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { resolveSameCaptures } from './same';
import type { Board, Card, Position } from '../types';

function makeCard(
  owner: 'blue' | 'red',
  stats: { top: number; bottom: number; left: number; right: number },
  instanceId = 'test-card',
): Card {
  return { instanceId, unitId: 'test-unit', owner, stats };
}

function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('resolveSameCaptures', () => {
  it('does not trigger with only one matching side', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 9, bottom: 9, left: 5, right: 9 }, 'blue-1');

    const result = resolveSameCaptures(board, placed, { row: 1, col: 0 });

    expect(result.captured).toEqual([]);
  });

  it('captures when two sides match an opponent card, even if placed value is lower', () => {
    const board = createEmptyBoard();
    // red card above and to the right of where blue will place.
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    // blue placed at (1,1): bottom of red-top is 5, matches blue's top=5.
    // left of red-right is 5, matches blue's right=5.
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveSameCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toHaveLength(2);
    expect(result.captured).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 2 },
      ]),
    );
  });

  it('does not trigger if matched sides are all the placing player own cards', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', { top: 1, bottom: 5, left: 1, right: 1 }, 'blue-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('blue', { top: 1, bottom: 1, left: 5, right: 1 }, 'blue-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveSameCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toEqual([]);
  });

  it('chains a combo capture from a flipped card into a further opponent card', () => {
    const board = createEmptyBoard();
    // Same setup as the 2-match test, plus a weak red card below red-right
    // that the newly-flipped red-right (now blue, value bottom=1... let's
    // give it a strong bottom) should capture via the base rule.
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 9, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    // Below red-right: a weak red card whose top (facing red-right's bottom=9) is low.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-below-right'), {
      row: 2,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveSameCaptures(board, placed, { row: 1, col: 1 });

    // red-top, red-right captured by Same; red-below-right captured by the
    // combo chain (red-right's bottom=9 beats red-below-right's top=1).
    expect(result.captured).toHaveLength(3);
    expect(result.comboTriggered).toBe(true);
    expect(result.captured).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 2 },
        { row: 2, col: 2 },
      ]),
    );
  });

  it('counts a wall match when wallValue is provided (Same Wall support)', () => {
    const board = createEmptyBoard();
    // Placing in the top-left corner: top and left sides face the wall.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 10 }, 'red-right'), {
      row: 0,
      col: 1,
    });
    // placed card: right=10 matches red-right's left=10... wait red-right's
    // left faces placed's right. Let's set placed.right = 1 to match
    // red-right's left=1, and placed.top = 10 to match the wall (10).
    const placed = makeCard('blue', { top: 10, bottom: 1, left: 10, right: 1 }, 'blue-1');

    const result = resolveSameCaptures(board, placed, { row: 0, col: 0 }, { wallValue: 10 });

    // top matches wall (10), left matches wall (10), right matches red-right's left (1)
    // -> 3 matched sides, 1 actual opponent card captured.
    expect(result.captured).toEqual([{ row: 0, col: 1 }]);
  });
});