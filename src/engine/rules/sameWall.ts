/**
 * Same Wall rule: treats the board's outer edges as having a value of 10
 * ("A") for the purposes of Same combo matching. Has no effect unless the
 * Same rule is also active - the actual matching-against-a-wall logic lives
 * in same.ts (`resolveSameCaptures`'s `wallValue` option); this module is
 * the small piece of glue that decides whether that option should be
 * switched on for a given match's rule set.
 */
import type { RuleSet } from '../types';

/** The numeric value board edges represent when Same Wall is active. */
export const WALL_VALUE = 10;

/**
 * Returns the wallValue to pass into `resolveSameCaptures`, or undefined if
 * Same Wall shouldn't apply (either the rule itself is off, or Same isn't
 * active so wall-matching would have nothing to combo with).
 */
export function getWallValueForRuleSet(ruleSet: RuleSet): number | undefined {
  if (ruleSet.sameWall && ruleSet.same) {
    return WALL_VALUE;
  }
  return undefined;
}