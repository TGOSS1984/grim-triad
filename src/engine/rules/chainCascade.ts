/**
 * Shared combo-chain cascade: given a set of positions that just got
 * captured by `capturingOwner`, repeatedly re-checks each newly-flipped
 * card's OWN other neighbors using the standard base (higher-value) rule,
 * flipping any further opponent cards it beats and queuing those in turn -
 * cascading until nothing more falls.
 *
 * This is the exact mechanic the Same rule has always used after its own
 * initial match (see rules/same.ts) - extracted here so the new Chain rule
 * (ruleEngine.ts, cascades after a plain higher-value capture) can reuse
 * the identical cascade behavior rather than a second, potentially
 * drifting copy of it. Only what triggers the FIRST capture differs
 * between Same and Chain; the cascade itself is one mechanic.
 */
import type { Board, Position, PlayerColour, StatsResolver } from '../types';
import { getCell } from '../board';
import { resolveBaseCaptures } from '../capture';

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell }))) as Board;
}

/**
 * Returns the full list of captured positions (the given initial captures
 * plus any further cascaded captures), in discovery order. Operates on an
 * internal clone of `board` - does not mutate the board passed in, since
 * that responsibility belongs to gameReducer/ruleEngine's callers.
 */
export function cascadeCaptures(
  board: Board,
  initialCaptured: Position[],
  capturingOwner: PlayerColour,
  getStats: StatsResolver,
): Position[] {
  const working = cloneBoard(board);
  for (const p of initialCaptured) {
    const cell = getCell(working, p);
    if (cell.card) {
      working[p.row][p.col] = { ...cell, card: { ...cell.card, owner: capturingOwner } };
    }
  }

  const allCaptured = [...initialCaptured];
  const queue = [...initialCaptured];
  const capturedSet = new Set(allCaptured.map((p) => `${p.row},${p.col}`));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCard = getCell(working, current).card;
    if (!currentCard) continue;

    const chainCaptures = resolveBaseCaptures(working, currentCard, current, getStats);
    for (const p of chainCaptures) {
      const key = `${p.row},${p.col}`;
      if (capturedSet.has(key)) continue;
      capturedSet.add(key);
      allCaptured.push(p);
      queue.push(p);
      const cell = getCell(working, p);
      if (cell.card) {
        working[p.row][p.col] = { ...cell, card: { ...cell.card, owner: capturingOwner } };
      }
    }
  }

  return allCaptured;
}