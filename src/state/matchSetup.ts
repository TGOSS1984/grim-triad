/**
 * Bridges the army-builder layer (a list of selected unit ids) into the
 * engine layer (real Card objects a match can be played with). Also
 * generates the AI opponent's army automatically - v1 only has an army
 * BUILDER UI for the human (see ROADMAP.md's game flow), so the AI needs
 * its own roster produced programmatically rather than through the UI.
 */
import type { Card, PlayerColour } from '../engine/types';
import { getUnitById, getUnitsForRoster, ACTIVE_FACTIONS } from '../data/activeFactions';
import { shuffle } from '../utils/shuffle';

let instanceCounter = 0;

/** Resets the instance-id counter - exported only for test isolation between cases. */
export function _resetInstanceCounterForTests(): void {
  instanceCounter = 0;
}

function nextInstanceId(unitId: string): string {
  instanceCounter += 1;
  return `${unitId}-${instanceCounter}`;
}

/**
 * Fills as many units as possible into `pointsCap`, processing `units` in
 * the given order and skipping any that don't currently fit (does not stop
 * at the first unaffordable one - keeps scanning for cheaper units later
 * in the list that still fit the remaining budget).
 */
function greedyFill(units: { id: string; points: number }[], pointsCap: number): string[] {
  const selected: string[] = [];
  let spent = 0;
  for (const unit of units) {
    if (spent + unit.points <= pointsCap) {
      selected.push(unit.id);
      spent += unit.points;
    }
  }
  return selected;
}

/**
 * 'balanced' (default): the existing random-then-cheapest-first fill - see
 * buildRandomAIRoster's own header for why the cheapest-first fallback
 * matters. 'greedy': fills most-expensive-first instead, so the roster
 * leans toward the strongest individual units the cap can afford (used for
 * Hard difficulty - see ai/difficulty.ts). Greedy still falls back to the
 * balanced two-pass if it can't reach minUnits on its own, since a
 * few-but-strong roster that fails the minimum-size requirement entirely
 * would be worse than a merely-average one that actually fields a team.
 */
export type RosterStrategy = 'balanced' | 'greedy';

/**
 * Generates a random army roster (unit ids) for the AI opponent: picks a
 * random active faction, then greedily fills it toward the points cap.
 * Tries other factions if a given one can't reach `minUnits` within the cap.
 *
 * Two-pass per faction: first tries a randomly-shuffled fill order (for
 * roster variety in the common case), then falls back to a cheapest-first
 * fill if that didn't reach `minUnits`. The cheapest-first pass matters a
 * lot more than it might look: random order is only budget-EFFICIENT by
 * chance, and for a high minUnits target (e.g. series mode's larger pools)
 * it is not just occasionally worse but close to certain to fail - a
 * roster averaging ~120pts/unit will only fit ~17 random units in a
 * 2000pt budget on average, never reliably reaching a target like 25,
 * confirmed empirically (100% failure rate across 500 trials for a case
 * cheapest-first solves easily). This was a real, reproducible crash in
 * series mode, not a theoretical edge case.
 */
export function buildRandomAIRoster(
  pointsCap: number,
  minUnits = 5,
  strategy: RosterStrategy = 'balanced',
): string[] {
  const candidateFactions = shuffle(ACTIVE_FACTIONS.map((f) => f.name));

  for (const factionName of candidateFactions) {
    const allUnits = getUnitsForRoster(factionName);

    if (strategy === 'greedy') {
      const mostExpensiveFirst = [...allUnits].sort((a, b) => b.points - a.points);
      const greedyResult = greedyFill(mostExpensiveFirst, pointsCap);
      if (greedyResult.length >= minUnits) {
        return greedyResult;
      }
      // Fell short on this faction with the greedy fill - fall through to
      // the balanced two-pass below rather than giving up on the faction
      // entirely (see this function's header for why balanced needs both
      // passes in the first place).
    }

    const randomOrderResult = greedyFill(shuffle(allUnits), pointsCap);
    if (randomOrderResult.length >= minUnits) {
      return randomOrderResult;
    }

    const cheapestFirst = [...allUnits].sort((a, b) => a.points - b.points);
    const cheapestFirstResult = greedyFill(cheapestFirst, pointsCap);
    if (cheapestFirstResult.length >= minUnits) {
      return cheapestFirstResult;
    }
  }

  throw new Error(
    `Could not build an AI roster of at least ${minUnits} units within ${pointsCap} points`,
  );
}

/**
 * Converts an army roster (unit ids) into a match-ready hand of real
 * engine Cards, drawing `handSize` at random if the roster is larger (a
 * roster only needs >= handSize units - see armyBuilderStore's own
 * MIN_ARMY_SIZE - the actual match hand is a random draw from it, per the
 * Random rule's own spirit even outside that specific rule toggle).
 *
 * `rosterFactionSlug`: stamped onto every returned Card as
 * `rosterFactionSlug` (see engine/types.ts's Card) - the roster/chapter
 * this hand was actually drafted under, used for card-back branding
 * (CardBack shows this instead of re-deriving a slug from each unit's own
 * static faction, which would show the wrong chapter for a shared/generic
 * unit fielded under a specific chapter roster - see
 * data/activeFactions.ts's getFactionSlugForRosterName). Optional and
 * appended AFTER handSize (not inserted before it) so this stays a
 * backward-compatible addition - every existing positional call site
 * (`unitIdsToHand(ids, owner, 5)`) is unaffected.
 */
export function unitIdsToHand(
  unitIds: string[],
  owner: PlayerColour,
  handSize = 5,
  rosterFactionSlug?: string,
): Card[] {
  const chosen = shuffle(unitIds).slice(0, Math.min(handSize, unitIds.length));
  return chosen.map((unitId) => {
    const unit = getUnitById(unitId);
    if (!unit) {
      throw new Error(`Unknown unit id: ${unitId}`);
    }
    return {
      instanceId: nextInstanceId(unitId),
      unitId,
      owner,
      stats: unit.stats,
      keywords: unit.keywords,
      rosterFactionSlug,
    };
  });
}