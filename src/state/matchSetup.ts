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
 * Generates a random army roster (unit ids) for the AI opponent: picks a
 * random active faction, then greedily adds random affordable units from
 * its pool until the points cap is used up. Tries other factions if the
 * first pick can't reach `minUnits` within the cap - defensive, shouldn't
 * happen with the current v1 faction data (every active roster has plenty
 * of cheap units), but avoids a hard crash rather than silently producing
 * an under-sized army.
 */
export function buildRandomAIRoster(pointsCap: number, minUnits = 5): string[] {
  const candidateFactions = shuffle(ACTIVE_FACTIONS.map((f) => f.name));

  for (const factionName of candidateFactions) {
    const pool = shuffle(getUnitsForRoster(factionName));
    const selected: string[] = [];
    let spent = 0;
    for (const unit of pool) {
      if (spent + unit.points <= pointsCap) {
        selected.push(unit.id);
        spent += unit.points;
      }
    }
    if (selected.length >= minUnits) {
      return selected;
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
 */
export function unitIdsToHand(unitIds: string[], owner: PlayerColour, handSize = 5): Card[] {
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
    };
  });
}