/**
 * Pure "random army selection" algorithm, used by the Randomize Army
 * button in ArmyBuilder.tsx - kept as a standalone pure function (not a
 * store action) so it's directly testable without needing to drive the
 * zustand store through a whole sequence of clicks.
 *
 * Two target-size shapes, matching how the three modes actually differ:
 *  - `{ exact: N }` (series/campaign): the pool size is load-bearing
 *    elsewhere (series' round count is pool size / 5; campaign's power
 *    cap and starting-collection size assume the real starting count),
 *    so a random army for these modes MUST land on exactly N units, not
 *    "close enough". A single random shuffle can genuinely fail to reach
 *    N within budget (e.g. picks several expensive units early and runs
 *    out of room) - retried with fresh shuffles up to
 *    MAX_EXACT_SIZE_ATTEMPTS times, then falls back to a deterministic
 *    cheapest-first fill, which succeeds whenever the pool/cap
 *    combination is feasible at all (same "cheapest-first floor" already
 *    used to size these constraints in the first place - see
 *    campaignBalance.ts).
 *  - `{ atLeast: N }` (single-match): no exact target, just spend as much
 *    of the points cap as reasonably fits - same "shuffle, fall back to
 *    cheapest-first if short of the minimum" pattern
 *    buildRandomAIRoster already uses for the AI's own roster, so a
 *    player's random army has the same flavour/strength distribution the
 *    AI already gets.
 *
 * `isBlocked` is a generic per-candidate veto, evaluated against the
 * selection built SO FAR - used for campaign mode's power-unit cap (see
 * campaignBalance.ts's canAddToCampaignRoster) without this module
 * needing to know campaign rules exist. Mirrors the same generic-
 * predicate shape already used elsewhere (UnitPicker's isDisabledExtra,
 * same.ts/plus.ts's excludeCard).
 */
import { shuffle } from '../utils/shuffle';

export interface RandomizableUnit {
  id: string;
  points: number;
}

export type ArmySizeTarget = { exact: number } | { atLeast: number };

const MAX_EXACT_SIZE_ATTEMPTS = 100;

function fillInOrder(
  orderedUnits: RandomizableUnit[],
  pointsCap: number,
  stopAt: number | undefined,
  isBlocked: (unitId: string, currentSelection: string[]) => boolean,
): string[] {
  const selected: string[] = [];
  let spent = 0;
  for (const unit of orderedUnits) {
    if (stopAt !== undefined && selected.length >= stopAt) break;
    if (spent + unit.points > pointsCap) continue;
    if (isBlocked(unit.id, selected)) continue;
    selected.push(unit.id);
    spent += unit.points;
  }
  return selected;
}

export function randomizeArmySelection(
  availableUnits: RandomizableUnit[],
  pointsCap: number,
  target: ArmySizeTarget,
  isBlocked: (unitId: string, currentSelection: string[]) => boolean = () => false,
): string[] {
  const cheapestFirst = [...availableUnits].sort((a, b) => a.points - b.points);

  if ('exact' in target) {
    for (let attempt = 0; attempt < MAX_EXACT_SIZE_ATTEMPTS; attempt++) {
      const result = fillInOrder(shuffle(availableUnits), pointsCap, target.exact, isBlocked);
      if (result.length === target.exact) return result;
    }
    // Deterministic fallback - not random, but guarantees a result if the
    // pool/cap/target combination is feasible at all, rather than
    // leaving the player with an incomplete roster and no explanation.
    return fillInOrder(cheapestFirst, pointsCap, target.exact, isBlocked);
  }

  const randomResult = fillInOrder(shuffle(availableUnits), pointsCap, undefined, isBlocked);
  if (randomResult.length >= target.atLeast) return randomResult;
  return fillInOrder(cheapestFirst, pointsCap, undefined, isBlocked);
}