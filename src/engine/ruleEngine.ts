/**
 * ruleEngine composes whichever optional rule modifiers are active for a
 * match (Same, Same Wall, Plus, Elemental) into a single capture resolution
 * function that gameReducer calls on every placed move. This is the one
 * place that needs to know about all the rules/*.ts modules together -
 * each individual rule module stays independently testable and ignorant of
 * the others.
 *
 * Rules NOT handled here (they don't affect per-move capture resolution):
 * - Open: UI visibility only (rules/open.ts)
 * - Sudden Death: post-game rematch flow (rules/suddenDeath.ts)
 * - Random: pre-game hand-drawing (rules/random.ts)
 * - Trade Rule: post-game card exchange (rules/tradeRules.ts)
 *
 * KNOWN v1 SIMPLIFICATION (Elemental): the +/-1 modifier is applied to the
 * card being placed this turn, compared against neighbors' stored (raw)
 * stats. It is NOT retroactively re-applied to a card already sitting on an
 * elemental cell when a later placement attacks it. Some Triple Triad
 * implementations do apply the modifier symmetrically to the defender too;
 * we've scoped v1 to the simpler, still-faithful "affects the active
 * placement" behaviour and flagged this here so it's a deliberate, visible
 * choice to revisit rather than an accidental gap.
 */
import type { Board, Card, CaptureResult, Position, RuleSet } from './types';
import { resolveBaseCaptures } from './capture';
import { resolveSameCaptures } from './rules/same';
import { getWallValueForRuleSet } from './rules/sameWall';
import { resolvePlusCaptures } from './rules/plus';
import { getEffectiveStats } from './rules/elemental';

/**
 * Resolves all captures for a card just placed at `pos`, given the match's
 * active rule set. Returns the full CaptureResult (positions to flip, plus
 * whether a combo chain fired) - callers apply the flips and drive
 * animations off this, same as the Phase-1 base-only version did.
 *
 * Precedence: if Same or Plus produces a capture, that result is used
 * (combo rules are more specific/powerful than the base rule and, per
 * standard Triple Triad behaviour, supersede a plain higher-value capture
 * on the same placement). If neither combo rule fires, falls back to the
 * base rule. Elemental modifies the *effective* stats used throughout,
 * regardless of which path is taken.
 */
export function resolveCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  ruleSet: RuleSet,
): CaptureResult {
  // Elemental changes the placed card's effective stats for every other
  // rule to compare against - apply it first, unconditionally cheap if the
  // rule is inactive (getEffectiveStats is a no-op without a cell element).
  const effectiveCard: Card = ruleSet.elemental
    ? { ...placedCard, stats: getEffectiveStats(board, placedCard, pos) }
    : placedCard;

  if (ruleSet.same) {
    const wallValue = getWallValueForRuleSet(ruleSet);
    const sameResult = resolveSameCaptures(board, effectiveCard, pos, { wallValue });
    if (sameResult.captured.length > 0) {
      return sameResult;
    }
  }

  if (ruleSet.plus) {
    const plusResult = resolvePlusCaptures(board, effectiveCard, pos);
    if (plusResult.captured.length > 0) {
      return plusResult;
    }
  }

  const baseCaptured = resolveBaseCaptures(board, effectiveCard, pos);
  return { captured: baseCaptured, comboTriggered: false };
}