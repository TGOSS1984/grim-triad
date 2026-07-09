/**
 * Base capture resolution: the core Triple-Triad rule with no optional
 * modifiers applied. A placed card compares its value on each side against
 * the facing value of any occupied neighboring cell; if the placed card's
 * value is strictly higher and the neighbor belongs to the opponent, that
 * neighbor flips to the placing player's colour.
 *
 * Optional rule modifiers (Same, Plus, Elemental, etc.) wrap or extend this
 * base resolution — see ruleEngine.ts, which composes this function with
 * whichever rules/*.ts modules are active for the match. This file has no
 * knowledge of those modifiers by design, so the base rule stays simple and
 * independently testable.
 */
import type { Board, Card, Position } from './types';
import { getCell, neighborsOf, opposite } from './board';

/**
 * Resolves base captures for a card just placed at `pos`. Returns the
 * positions of any opponent cards that should flip. Does NOT mutate the
 * board or apply the flips — callers (gameReducer, ruleEngine) own that,
 * so this function stays a pure, side-effect-free predicate.
 */
export function resolveBaseCaptures(board: Board, placedCard: Card, pos: Position): Position[] {
  const captured: Position[] = [];

  for (const { side, neighborPos } of neighborsOf(pos)) {
    const neighborCell = getCell(board, neighborPos);
    if (!neighborCell.card) continue;
    if (neighborCell.card.owner === placedCard.owner) continue;

    const placedValue = placedCard.stats[side];
    const neighborFacingSide = opposite(side);
    const neighborValue = neighborCell.card.stats[neighborFacingSide];

    if (placedValue > neighborValue) {
      captured.push(neighborPos);
    }
  }

  return captured;
}