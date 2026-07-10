/**
 * Same rule: when a card is placed, check each side against the facing
 * value of any occupied neighbor. If two or more sides have matching
 * values, and at least one of those matched cards belongs to the opponent,
 * a "Same" capture triggers - all matched opponent cards flip, regardless
 * of whether the placed card's value was higher or lower.
 *
 * Combo: each card captured this way immediately re-checks ITS OWN other
 * neighbors using the normal (higher-value-wins) base rule, since it now
 * belongs to the capturing player. Any further captures those trigger
 * chain the same way, cascading until no more captures occur. This
 * cascade step is shared with the Chain rule - see rules/chainCascade.ts.
 *
 * `wallValue`: when the Same Wall rule is also active, board edges count as
 * a value of 10 ("A") for matching purposes only - see sameWall.ts, which
 * calls into this module with that value set. Wall matches count toward
 * the "2+ matched sides" threshold but can never themselves be captured
 * (there's no card there).
 */
import type { Board, Card, CaptureResult, Position, StatsResolver } from '../types';
import { getCell, neighborsOf, opposite } from '../board';
import { cascadeCaptures } from './chainCascade';

export interface SameOptions {
  /** If set (Same Wall active), board edges are treated as this value for matching. */
  wallValue?: number;
}

const identityStats: StatsResolver = (card) => card.stats;

export function resolveSameCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  options: SameOptions = {},
  getStats: StatsResolver = identityStats,
): CaptureResult {
  const matchedNeighborPositions: Position[] = [];
  let matchedSideCount = 0;
  const placedStats = getStats(placedCard, pos);

  for (const { side, neighborPos } of neighborsOf(pos)) {
    const neighborCell = getCell(board, neighborPos);
    const placedValue = placedStats[side];

    if (neighborCell.card) {
      const neighborValue = getStats(neighborCell.card, neighborPos)[opposite(side)];
      if (placedValue === neighborValue) {
        matchedSideCount++;
        if (neighborCell.card.owner !== placedCard.owner) {
          matchedNeighborPositions.push(neighborPos);
        }
      }
    }
  }

  // Also count matches against the wall on any side that has NO neighbor
  // (i.e. this position is on the board edge in that direction).
  if (options.wallValue !== undefined) {
    const sidesWithNeighbors = new Set(neighborsOf(pos).map((n) => n.side));
    const allSides: Array<'top' | 'bottom' | 'left' | 'right'> = [
      'top',
      'bottom',
      'left',
      'right',
    ];
    for (const side of allSides) {
      if (!sidesWithNeighbors.has(side) && placedStats[side] === options.wallValue) {
        matchedSideCount++;
      }
    }
  }

  if (matchedSideCount < 2 || matchedNeighborPositions.length === 0) {
    return { captured: [], comboTriggered: false };
  }

  const allCaptured = cascadeCaptures(board, matchedNeighborPositions, placedCard.owner, getStats);

  return {
    captured: allCaptured,
    comboTriggered: allCaptured.length > matchedNeighborPositions.length,
  };
}