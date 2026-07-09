/**
 * Board/grid helpers: pure functions for creating, reading, and navigating
 * the 3x3 board. No capture or rule logic lives here — see capture.ts and
 * rules/ for that. This module is deliberately "dumb" so it's trivial to
 * unit test and reuse from the AI, the renderer, and every rule module.
 */
import type { Board, BoardCell, Position, Side } from './types';

/** Creates a fresh, empty 3x3 board. */
export function createEmptyBoard(): Board {
  const makeCell = (): BoardCell => ({ card: null });
  return [
    [makeCell(), makeCell(), makeCell()],
    [makeCell(), makeCell(), makeCell()],
    [makeCell(), makeCell(), makeCell()],
  ];
}

export function getCell(board: Board, pos: Position): BoardCell {
  return board[pos.row][pos.col];
}

export function isPositionEmpty(board: Board, pos: Position): boolean {
  return getCell(board, pos).card === null;
}

/** All 9 positions on the board, in row-major order. */
export function allPositions(): Position[] {
  const positions: Position[] = [];
  for (let row = 0 as 0 | 1 | 2; row <= 2; row++) {
    for (let col = 0 as 0 | 1 | 2; col <= 2; col++) {
      positions.push({ row, col });
    }
  }
  return positions;
}

export function emptyPositions(board: Board): Position[] {
  return allPositions().filter((pos) => isPositionEmpty(board, pos));
}

export function isBoardFull(board: Board): boolean {
  return emptyPositions(board).length === 0;
}

/**
 * Returns the neighbor position in a given direction from `pos`, or null if
 * that direction runs off the board (e.g. `left` from col 0).
 */
export function neighborPosition(pos: Position, side: Side): Position | null {
  switch (side) {
    case 'top':
      return pos.row > 0 ? { row: (pos.row - 1) as 0 | 1 | 2, col: pos.col } : null;
    case 'bottom':
      return pos.row < 2 ? { row: (pos.row + 1) as 0 | 1 | 2, col: pos.col } : null;
    case 'left':
      return pos.col > 0 ? { row: pos.row, col: (pos.col - 1) as 0 | 1 | 2 } : null;
    case 'right':
      return pos.col < 2 ? { row: pos.row, col: (pos.col + 1) as 0 | 1 | 2 } : null;
  }
}

/** The side that "faces" `side` on the neighboring card (top faces bottom, etc). */
export function opposite(side: Side): Side {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export const ALL_SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

/**
 * For a given board position, returns each side paired with its neighbor
 * position (only sides that have a neighbor on the board are included).
 */
export function neighborsOf(
  pos: Position,
): { side: Side; neighborPos: Position }[] {
  const result: { side: Side; neighborPos: Position }[] = [];
  for (const side of ALL_SIDES) {
    const neighborPos = neighborPosition(pos, side);
    if (neighborPos) {
      result.push({ side, neighborPos });
    }
  }
  return result;
}