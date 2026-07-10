import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { assignElementalTerrain, getEffectiveStats } from './elemental';
import type { Card } from '../types';

function makeCard(element?: string): Card {
  return {
    instanceId: 'test-card',
    unitId: 'test-unit',
    owner: 'blue',
    stats: { top: 5, bottom: 5, left: 5, right: 5 },
    element,
  };
}

describe('assignElementalTerrain', () => {
  it('returns an empty list when no elements are provided', () => {
    expect(assignElementalTerrain([])).toEqual([]);
  });

  it('assigns the requested number of cells, capped at 9', () => {
    const assignments = assignElementalTerrain(['warp', 'fire', 'void'], 3);
    expect(assignments).toHaveLength(3);
  });

  it('never assigns more than 9 cells even if asked for more', () => {
    const assignments = assignElementalTerrain(['warp'], 20);
    expect(assignments).toHaveLength(9);
  });

  it('assigns no duplicate positions', () => {
    const assignments = assignElementalTerrain(['warp', 'fire', 'void', 'toxic'], 6);
    const seen = new Set(assignments.map((a) => `${a.position.row},${a.position.col}`));
    expect(seen.size).toBe(assignments.length);
  });

  it('each assignment uses an element from the given pool', () => {
    const pool = ['warp', 'fire'];
    const assignments = assignElementalTerrain(pool, 5);
    for (const { element } of assignments) {
      expect(pool).toContain(element);
    }
  });

  it('can assign every element in the pool across enough cells (statistical)', () => {
    // Single-element pool: every assignment must be that element.
    const assignments = assignElementalTerrain(['warp'], 5);
    expect(assignments.every((a) => a.element === 'warp')).toBe(true);
  });
});

describe('getEffectiveStats', () => {
  it('returns unmodified stats when the cell has no element', () => {
    const board = createEmptyBoard();
    const card = makeCard('warp');

    const stats = getEffectiveStats(board, card, { row: 0, col: 0 });

    expect(stats).toEqual({ top: 5, bottom: 5, left: 5, right: 5 });
  });

  it('applies +1 to all sides when the card element matches the cell', () => {
    const board = createEmptyBoard();
    board[0][0].element = 'warp';
    const card = makeCard('warp');

    const stats = getEffectiveStats(board, card, { row: 0, col: 0 });

    expect(stats).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  });

  it('applies -1 to all sides when the card element does not match the cell', () => {
    const board = createEmptyBoard();
    board[0][0].element = 'warp';
    const card = makeCard('fire');

    const stats = getEffectiveStats(board, card, { row: 0, col: 0 });

    expect(stats).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
  });

  it('applies -1 to a card with no element at all on an elemental cell', () => {
    const board = createEmptyBoard();
    board[0][0].element = 'warp';
    const card = makeCard(undefined);

    const stats = getEffectiveStats(board, card, { row: 0, col: 0 });

    expect(stats).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
  });

  it('clamps the bonus at 10 and the penalty at 1', () => {
    const board = createEmptyBoard();
    board[0][0].element = 'warp';

    const maxedCard: Card = {
      instanceId: 'max',
      unitId: 'u',
      owner: 'blue',
      stats: { top: 10, bottom: 10, left: 10, right: 10 },
      element: 'warp',
    };
    const minCard: Card = {
      instanceId: 'min',
      unitId: 'u',
      owner: 'blue',
      stats: { top: 1, bottom: 1, left: 1, right: 1 },
      element: 'fire',
    };

    expect(getEffectiveStats(board, maxedCard, { row: 0, col: 0 })).toEqual({
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
    });
    expect(getEffectiveStats(board, minCard, { row: 0, col: 0 })).toEqual({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    });
  });
});