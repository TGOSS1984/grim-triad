/**
 * Composes every active stat-modifying rule into one final effective
 * stats value - the single place in the engine that knows about
 * Elemental, Combined Arms, Underdog, and Epic Hero Presence all at
 * once, so none of THOSE individual modules need to know the others
 * exist. Both real capture comparisons (ruleEngine.ts) and the UI's
 * buff/debuff display (GameScreen.tsx) call this same function, so
 * "what you see is what actually gets compared" is guaranteed by
 * construction, not by keeping two separate calculations in sync by
 * hand.
 *
 * Deltas from each active rule are all SUMMED first, then clamped to
 * [1,10] ONCE at the very end - not clamped after each individual rule.
 * This matters: if Elemental gives -1 on a side and Combined Arms gives
 * +1 on that same side, they should net to 0 (the printed value), not
 * get clamped partway through in a way that loses one of the two
 * effects.
 */
import type { Board, Card, CardStats, GameState, Position, RuleSet, Side } from '../types';
import { getEffectiveStats as getElementalEffectiveStats } from './elemental';
import { getCombinedArmsDelta } from './combinedArms';

const MIN_SIDE_VALUE = 1;
const MAX_SIDE_VALUE = 10;

function clampSide(value: number): number {
  return Math.min(MAX_SIDE_VALUE, Math.max(MIN_SIDE_VALUE, value));
}

const ZERO_DELTA: CardStats = { top: 0, bottom: 0, left: 0, right: 0 };

function addDeltas(a: CardStats, b: CardStats): CardStats {
  return { top: a.top + b.top, bottom: a.bottom + b.bottom, left: a.left + b.left, right: a.right + b.right };
}

function sideOnlyDelta(side: Side): CardStats {
  return { ...ZERO_DELTA, [side]: 1 };
}

/**
 * `boardContext` is null for a card still in hand - board-positional
 * rules (Elemental, Combined Arms) only ever apply once a card is
 * placed, same reasoning Elemental alone already had. Underdog and Epic
 * Hero Presence aren't positional, so they apply either way.
 */
export function computeEffectiveStats(
  card: Card,
  ruleSet: RuleSet,
  boardContext: { board: Board; pos: Position } | null,
  epicHeroPresence?: GameState['epicHeroPresence'],
): CardStats {
  let delta = ZERO_DELTA;

  if (boardContext) {
    if (ruleSet.elemental) {
      const elementalStats = getElementalEffectiveStats(boardContext.board, card, boardContext.pos);
      delta = addDeltas(delta, {
        top: elementalStats.top - card.stats.top,
        bottom: elementalStats.bottom - card.stats.bottom,
        left: elementalStats.left - card.stats.left,
        right: elementalStats.right - card.stats.right,
      });
    }

    if (ruleSet.combinedArms) {
      delta = addDeltas(delta, getCombinedArmsDelta(boardContext.board, card, boardContext.pos));
    }
  }

  if (ruleSet.underdog && card.hasUnderdogBonus) {
    delta = addDeltas(delta, { top: 1, bottom: 1, left: 1, right: 1 });
  }

  if (ruleSet.epicHeroPresence) {
    const side = epicHeroPresence?.[card.owner];
    if (side) {
      delta = addDeltas(delta, sideOnlyDelta(side));
    }
  }

  return {
    top: clampSide(card.stats.top + delta.top),
    bottom: clampSide(card.stats.bottom + delta.bottom),
    left: clampSide(card.stats.left + delta.left),
    right: clampSide(card.stats.right + delta.right),
  };
}