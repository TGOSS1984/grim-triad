/**
 * Combined Arms: two adjacent FRIENDLY cards with different unitType each
 * get +1 on the side facing each other, not all four sides - a card
 * boxed in by multiple different-type friendly neighbors can be boosted
 * on that many sides at once, which is the actual point of doing this
 * per-side rather than as a flat per-card bonus (positioning matters,
 * not just which cards you brought).
 *
 * Returns a DELTA (each side 0 or 1), not full effective stats, matching
 * the composition pattern effectiveStats.ts uses to combine multiple
 * active modifiers (Elemental, Combined Arms, Underdog, Epic Hero
 * Presence) into one final value without each module needing to know
 * about the others.
 */
import type { Board, Card, CardStats, Position } from '../types';
import { neighborsOf, getCell } from '../board';

const ZERO_DELTA: CardStats = { top: 0, bottom: 0, left: 0, right: 0 };

export function getCombinedArmsDelta(board: Board, card: Card, pos: Position): CardStats {
  if (!card.unitType) return ZERO_DELTA;

  const delta: CardStats = { ...ZERO_DELTA };

  for (const { side, neighborPos } of neighborsOf(pos)) {
    const neighborCard = getCell(board, neighborPos).card;
    if (!neighborCard) continue;
    if (neighborCard.owner !== card.owner) continue; // friendly only
    if (!neighborCard.unitType) continue;
    if (neighborCard.unitType === card.unitType) continue; // must be a DIFFERENT type

    delta[side] = 1;
  }

  return delta;
}