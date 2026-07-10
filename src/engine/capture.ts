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
 *
 * `getStats` resolves a card's EFFECTIVE stats given its position - by
 * default just its raw printed stats, but ruleEngine.ts passes a resolver
 * that applies the Elemental modifier when that rule is active. Crucially,
 * this is called for BOTH the placed card AND every neighbor being
 * compared against - a card's positional bonus/penalty applies whenever
 * it's checked, whether it's attacking or defending, not only at the
 * moment it was originally placed.
 */
import type { Board, Card, Position, StatsResolver } from './types';
import { getCell, neighborsOf, opposite } from './board';

const identityStats: StatsResolver = (card) => card.stats;

/**
 * Resolves base captures for a card just placed at `pos`. Returns the
 * positions of any opponent cards that should flip. Does NOT mutate the
 * board or apply the flips — callers (gameReducer, ruleEngine) own that,
 * so this function stays a pure, side-effect-free predicate.
 */
export function resolveBaseCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  getStats: StatsResolver = identityStats,
): Position[] {
  const captured: Position[] = [];
  const placedStats = getStats(placedCard, pos);

  for (const { side, neighborPos } of neighborsOf(pos)) {
    const neighborCell = getCell(board, neighborPos);
    if (!neighborCell.card) continue;
    if (neighborCell.card.owner === placedCard.owner) continue;

    const placedValue = placedStats[side];
    const neighborFacingSide = opposite(side);
    const neighborValue = getStats(neighborCell.card, neighborPos)[neighborFacingSide];

    if (placedValue > neighborValue) {
      captured.push(neighborPos);
    }
  }

  return captured;
}