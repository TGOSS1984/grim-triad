import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { resolvePlusCaptures } from './plus';
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

describe('resolvePlusCaptures', () => {
  it('does nothing when no two sums match', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 2, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 1 }, 'blue-1');

    const result = resolvePlusCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toEqual([]);
  });

  it('captures both cards when two sums match, even if placed value is lower', () => {
    const board = createEmptyBoard();
    // top neighbor: bottom=6, placed.top=4 -> sum 10
    place(board, makeCard('red', { top: 1, bottom: 6, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    // right neighbor: left=8, placed.right=2 -> sum 10
    place(board, makeCard('red', { top: 1, bottom: 1, left: 8, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 4, bottom: 1, left: 1, right: 2 }, 'blue-1');

    const result = resolvePlusCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toHaveLength(2);
    expect(result.captured).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 2 },
      ]),
    );
  });

  it('does not trigger when the matching sum pair is entirely the placer own cards', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', { top: 1, bottom: 6, left: 1, right: 1 }, 'blue-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('blue', { top: 1, bottom: 1, left: 8, right: 1 }, 'blue-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 4, bottom: 1, left: 1, right: 2 }, 'blue-1');

    const result = resolvePlusCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toEqual([]);
  });

  it('chains a combo capture from a flipped card via the base rule', () => {
    const board = createEmptyBoard();
    // top neighbor: bottom=6, placed.top=4 -> sum 10
    place(board, makeCard('red', { top: 1, bottom: 6, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    // right neighbor: left=8, placed.right=2 -> sum 10. Its own top=1 is weak.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 8, right: 9 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    // above red-right: a card with a very weak bottom, so red-right's top
    // beats it once red-right flips to blue and the combo chain checks it.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-above-right'), {
      row: 0,
      col: 2,
    });

    const placed = makeCard('blue', { top: 4, bottom: 1, left: 1, right: 2 }, 'blue-1');
    const result = resolvePlusCaptures(board, placed, { row: 1, col: 1 });

    // red-top + red-right captured directly by Plus (sum 10 each).
    // Combo chain: red-right (now blue) checks its own neighbors - its top
    // value (1) does NOT beat red-above-right's bottom (1, a tie) so no
    // further capture fires here; confirms combo does not force a tie.
    expect(result.captured).toHaveLength(2);
    expect(result.comboTriggered).toBe(false);
  });

  it('does trigger a further combo capture when the chained comparison is a genuine win', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 6, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    // right neighbor: left=8 matches placed.right=2 -> sum 10. Its own top=5 is strong.
    place(board, makeCard('red', { top: 5, bottom: 1, left: 8, right: 9 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    // above red-right: weak bottom (1), loses to red-right's top (5) once flipped.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-above-right'), {
      row: 0,
      col: 2,
    });

    const placed = makeCard('blue', { top: 4, bottom: 1, left: 1, right: 2 }, 'blue-1');
    const result = resolvePlusCaptures(board, placed, { row: 1, col: 1 });

    expect(result.captured).toHaveLength(3);
    expect(result.comboTriggered).toBe(true);
    expect(result.captured).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 2 },
        { row: 0, col: 2 },
      ]),
    );
  });
});