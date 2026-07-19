/**
 * ruleEngine composes whichever optional rule modifiers are active for a
 * match (Same, Same Wall, Plus, Chain, Heroic) into a single capture
 * resolution function that gameReducer calls on every placed move. This is
 * the one place that needs to know about all the rules/*.ts modules
 * together - each individual rule module stays independently testable and
 * ignorant of the others.
 *
 * Rules NOT handled here (they don't affect per-move capture resolution):
 * - Open: UI visibility only (rules/open.ts)
 * - Sudden Death: post-game rematch flow (rules/suddenDeath.ts)
 * - Random: pre-game hand-drawing (rules/random.ts)
 * - Trade Rule: post-game card exchange (rules/tradeRules.ts)
 *
 * Stat modifiers (Elemental, Combined Arms, Underdog, Epic Hero Presence)
 * are all composed together via rules/effectiveStats.ts's
 * computeEffectiveStats - this module doesn't apply any of them directly
 * itself, it just builds the StatsResolver every capture check uses and
 * lets that one function decide what's active. Applies symmetrically: the
 * resolver is called for EVERY card being compared, at that card's OWN
 * board position - the card being placed AND every neighbor being checked
 * against it - not just the card being placed (a card sitting on a
 * favorable position should benefit from that when it's attacked too, not
 * only when it's doing the attacking).
 */
import type { Board, Card, CaptureKind, CaptureResult, GameState, Position, RuleSet, StatsResolver } from './types';
import { resolveBaseCaptures } from './capture';
import { resolveSameCaptures } from './rules/same';
import { getWallValueForRuleSet } from './rules/sameWall';
import { resolvePlusCaptures } from './rules/plus';
import { computeEffectiveStats } from './rules/effectiveStats';
import { isEpicHero } from './rules/keywords';
import { cascadeCaptures } from './rules/chainCascade';

/**
 * Resolves all captures for a card just placed at `pos`, given the match's
 * active rule set. Returns the full CaptureResult (positions to flip, plus
 * whether a combo chain fired) - callers apply the flips and drive
 * animations off this, same as the Phase-1 base-only version did.
 *
 * `epicHeroPresence` is GameState's own field (see its doc) - passed
 * through here rather than read off some ambient state, since this
 * function otherwise only takes `board`/`ruleSet`, not a whole GameState.
 *
 * Precedence: if Same or Plus produces a capture, that result is used
 * (combo rules are more specific/powerful than the base rule and, per
 * standard Triple Triad behaviour, supersede a plain higher-value capture
 * on the same placement). If neither combo rule fires, falls back to the
 * base rule - at which point Chain (if active) gets its own chance to
 * cascade that base capture, using the exact same cascade mechanic Same
 * uses internally (see rules/chainCascade.ts). Every stat modifier applies
 * to the *effective* stats used throughout, regardless of which path is
 * taken.
 */
export function resolveCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  ruleSet: RuleSet,
  epicHeroPresence?: GameState['epicHeroPresence'],
): CaptureResult {
  // Resolves ANY card's effective stats at ITS OWN position - used for
  // both the card being placed and every neighbor it's compared against.
  // computeEffectiveStats itself handles all the per-rule gating
  // internally (Elemental/Combined Arms/Underdog/Epic Hero Presence each
  // individually check their own ruleSet flag), so this can just always
  // call it rather than needing its own conditional here.
  const getStats: StatsResolver = (card, cardPos) =>
    computeEffectiveStats(card, ruleSet, { board, pos: cardPos }, epicHeroPresence);

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