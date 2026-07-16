/**
 * Elemental rule: each match, a random subset of board cells is assigned an
 * elemental terrain type. Any card placed on a cell whose element matches
 * the card's own `element` gets +1 on all four sides; a card with a
 * different (or no) element gets -1 on all four sides while sitting there
 * - EXCEPT Psyker units (see rules/keywords.ts's isPsyker), which still
 * get the +1 for a genuine match but are immune to the -1 mismatch
 * penalty (see getEffectiveStats's own doc for why).
 *
 * These modified values are what capture/Same/Plus comparisons should use -
 * this module only computes the effective stats for a given placement, it
 * does not decide capture outcomes itself (capture.ts/same.ts/plus.ts stay
 * unaware of Elemental; ruleEngine.ts is responsible for applying
 * `getEffectiveStats` to the placed card before calling into them).
 */
import type { Board, Card, CardStats, Element, Position } from '../types';
import { allPositions } from '../board';
import { isPsyker } from './keywords';

/** Minimum a side value can be pushed down to by a -1 Elemental penalty. */
const MIN_SIDE_VALUE = 1;
/** Maximum a side value can be pushed up to by a +1 Elemental bonus. */
const MAX_SIDE_VALUE = 10;

export interface ElementalAssignment {
  position: Position;
  element: Element;
}

/**
 * Randomly assigns elements to a subset of board cells at the start of a
 * match. `elements` is the pool of possible terrain types to choose from
 * (see src/data/elements.ts for the themed list the app actually uses);
 * `cellCount` controls how many of the 9 cells get an element (classic
 * Triple Triad uses a random subset, not the whole board). Each chosen
 * cell gets one element picked independently at random from the pool - two
 * cells can end up with the same element, or different ones.
 */
export function assignElementalTerrain(
  elements: Element[],
  cellCount = 3,
): ElementalAssignment[] {
  if (elements.length === 0) return [];
  const shuffledPositions = [...allPositions()].sort(() => Math.random() - 0.5);
  const chosenPositions = shuffledPositions.slice(0, Math.min(cellCount, 9));
  return chosenPositions.map((position) => ({
    position,
    element: elements[Math.floor(Math.random() * elements.length)],
  }));
}

function clampSide(value: number): number {
  return Math.max(MIN_SIDE_VALUE, Math.min(MAX_SIDE_VALUE, value));
}

/**
 * Returns the effective stats a card should use for capture comparisons
 * when placed at `pos`, accounting for that cell's element (if any) versus
 * the card's own element. A card with no `element` is always treated as a
 * mismatch (i.e. it takes the -1 penalty on any elemental cell) - UNLESS
 * it's a Psyker (see rules/keywords.ts's isPsyker): psychic units adapt to
 * any battlefield, so they still get the +1 for a genuine element match,
 * but never take the -1 for a mismatch or absent element. This doesn't
 * need its own RuleSet toggle - it's a passive property of the Psyker
 * keyword that only ever matters once Elemental itself is already active
 * (no terrain, nothing for a Psyker to be resilient against).
 */
export function getEffectiveStats(board: Board, card: Card, pos: Position): CardStats {
  const cellElement = board[pos.row][pos.col].element;
  if (!cellElement) return card.stats;

  const isMatch = card.element === cellElement;
  if (!isMatch && isPsyker(card)) return card.stats;

  const modifier = isMatch ? 1 : -1;

  return {
    top: clampSide(card.stats.top + modifier),
    bottom: clampSide(card.stats.bottom + modifier),
    left: clampSide(card.stats.left + modifier),
    right: clampSide(card.stats.right + modifier),
  };
}