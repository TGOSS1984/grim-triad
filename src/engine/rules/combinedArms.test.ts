import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { getCombinedArmsDelta } from './combinedArms';
import type { Board, Card, Position } from '../types';

function makeCard(
  owner: 'blue' | 'red',
  unitType?: string,
  instanceId = 'test-card',
): Card {
  return {
    instanceId,
    unitId: 'test-unit',
    owner,
    stats: { top: 5, bottom: 5, left: 5, right: 5 },
    unitType,
  };
}

function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('getCombinedArmsDelta', () => {
  it('gives no bonus with no neighbors at all', () => {
    const board = createEmptyBoard();
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('gives +1 on the facing side for a friendly neighbor with a different unitType', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', 'Vehicle', 'neighbor'), { row: 0, col: 1 }); // top neighbor
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 1, bottom: 0, left: 0, right: 0 });
  });

  it('gives no bonus for a friendly neighbor with the SAME unitType', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', 'Infantry', 'neighbor'), { row: 0, col: 1 });
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('gives no bonus for an OPPONENT neighbor, even with a different unitType (friendly only)', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', 'Vehicle', 'neighbor'), { row: 0, col: 1 });
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('gives no bonus at all for a card with no unitType', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', 'Vehicle', 'neighbor'), { row: 0, col: 1 });
    const card = makeCard('blue', undefined);

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('gives no bonus for a neighbor with no unitType, even if this card has one', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', undefined, 'neighbor'), { row: 0, col: 1 });
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('stacks across multiple sides - a card boxed in by 3 different-type friendly neighbors gets +1 on all 3 facing sides', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', 'Vehicle', 'top-neighbor'), { row: 0, col: 1 });
    place(board, makeCard('blue', 'Monster', 'left-neighbor'), { row: 1, col: 0 });
    place(board, makeCard('blue', 'Character', 'right-neighbor'), { row: 1, col: 2 });
    const card = makeCard('blue', 'Infantry');

    const delta = getCombinedArmsDelta(board, card, { row: 1, col: 1 });

    expect(delta).toEqual({ top: 1, bottom: 0, left: 1, right: 1 });
  });

  it('a corner position (fewer neighbors) only gets bonuses for the sides it actually has', () => {
    const board = createEmptyBoard();
    place(board, makeCard('blue', 'Vehicle', 'right-neighbor'), { row: 0, col: 1 });
    place(board, makeCard('blue', 'Monster', 'bottom-neighbor'), { row: 1, col: 0 });
    const card = makeCard('blue', 'Infantry');

    // Top-left corner - only has right and bottom neighbors, no top/left.
    const delta = getCombinedArmsDelta(board, card, { row: 0, col: 0 });

    expect(delta).toEqual({ top: 0, bottom: 1, left: 0, right: 1 });
  });
});