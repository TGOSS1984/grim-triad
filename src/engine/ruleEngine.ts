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
 * Elemental now applies symmetrically: a StatsResolver is built once per
 * move and passed into base/Same/Plus, which each call it for EVERY card
 * they compare - the card being placed AND every neighbor being checked
 * against it, at that neighbor's own board position. Earlier this only
 * ever applied the modifier to the card being placed, so a card sitting on
 * a matching element got no benefit when it was later attacked, only when
 * it was doing the attacking - caught in actual play (a card on a matching
 * tile lost to a value it should have tied against) and confirmed by
 * auditing the code: the old version literally never re-read a defender's
 * position at all.
 */
import type { Board, Card, CaptureKind, CaptureResult, Position, RuleSet, StatsResolver } from './types';
import { resolveBaseCaptures } from './capture';
import { resolveSameCaptures } from './rules/same';
import { getWallValueForRuleSet } from './rules/sameWall';
import { resolvePlusCaptures } from './rules/plus';
import { getEffectiveStats } from './rules/elemental';
import { isEpicHero } from './rules/keywords';
import { cascadeCaptures } from './rules/chainCascade';

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
 * base rule - at which point Chain (if active) gets its own chance to
 * cascade that base capture, using the exact same cascade mechanic Same
 * uses internally (see rules/chainCascade.ts). Elemental modifies the
 * *effective* stats used throughout, regardless of which path is taken.
 */
export function resolveCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  ruleSet: RuleSet,
): CaptureResult {
  // Resolves ANY card's effective stats at ITS OWN position - used for
  // both the card being placed and every neighbor it's compared against,
  // so Elemental applies the same way regardless of which side of a
  // comparison a card is on. A no-op (raw stats) when Elemental is off.
  const getStats: StatsResolver = ruleSet.elemental
    ? (card, cardPos) => getEffectiveStats(board, card, cardPos)
    : (card) => card.stats;

  if (ruleSet.same) {
    const wallValue = getWallValueForRuleSet(ruleSet);
    const excludeCard = ruleSet.heroic ? isEpicHero : undefined;
    const sameResult = resolveSameCaptures(board, placedCard, pos, { wallValue, excludeCard }, getStats);
    if (sameResult.captured.length > 0) {
      return sameResult;
    }
  }

  if (ruleSet.plus) {
    const excludeCard = ruleSet.heroic ? isEpicHero : undefined;
    const plusResult = resolvePlusCaptures(board, placedCard, pos, getStats, excludeCard);
    if (plusResult.captured.length > 0) {
      return plusResult;
    }
  }

  const baseCaptured = resolveBaseCaptures(board, placedCard, pos, getStats);

  if (ruleSet.chain && baseCaptured.length > 0) {
    const cascaded = cascadeCaptures(board, baseCaptured, placedCard.owner, getStats);
    return {
      captured: cascaded,
      comboTriggered: cascaded.length > baseCaptured.length,
      // baseCaptured.length is the boundary between the plain flanking
      // captures this move made directly and anything Chain swept up
      // afterward - same boundary trick same.ts/plus.ts use for their
      // own direct-match vs cascade split.
      captureKinds: cascaded.map((_, i): CaptureKind => (i < baseCaptured.length ? 'base' : 'cascade')),
    };
  }

  return {
    captured: baseCaptured,
    comboTriggered: false,
    captureKinds: baseCaptured.map((): CaptureKind => 'base'),
  };
}