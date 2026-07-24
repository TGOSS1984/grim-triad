/**
 * Computes campaign mode's collector progress against the set of units
 * that are actually obtainable right now, rather than the full generated
 * catalog.
 *
 * Why this exists: `ALL_UNITS` (activeFactions.ts) is the FULL generated
 * catalog across all 38 factions - 1075 units as of this writing - but a
 * campaign match's AI opponent is only ever built from `ACTIVE_FACTIONS`
 * (see matchSetup.ts's buildRandomAIRoster), currently 18 of those 38.
 * A unit belonging to an inactive faction can never appear in a match,
 * so it can never be won, so measuring a player's collector progress
 * against `ALL_UNITS.length` overstates the real goal by however many
 * units sit in inactive factions (338 as of this writing) - the
 * "Collection: X / Y" figure was showing a Y nobody could ever actually
 * reach.
 *
 * This module computes the REAL denominator instead: every unique unit
 * id reachable through `ACTIVE_FACTIONS`'s effective rosters (via
 * `getUnitsForRoster`, which already correctly folds in the shared
 * generic Space Marine pool for a chapter roster - see that function's
 * own header in activeFactions.ts). Recomputed from `ACTIVE_FACTIONS`
 * each call rather than cached at module load, so it always reflects the
 * current data and automatically grows as more factions are activated
 * over time, with no code change needed here when that happens.
 */
import { ACTIVE_FACTIONS, getUnitsForRoster } from './activeFactions';

/**
 * Every unique unit id obtainable in campaign mode right now - i.e.
 * belonging to at least one currently-active faction's effective roster.
 * Cheap enough (a few hundred units, one pass) to recompute on every
 * call rather than memoizing.
 */
export function getObtainableUnitIds(): Set<string> {
  const ids = new Set<string>();
  for (const faction of ACTIVE_FACTIONS) {
    for (const unit of getUnitsForRoster(faction.name)) {
      ids.add(unit.id);
    }
  }
  return ids;
}

export interface CollectionProgress {
  /** How many distinct obtainable units the given collection currently owns at least one of. */
  owned: number;
  /** Total distinct units currently obtainable across all active factions - the real completion target, NOT ALL_UNITS.length (see file header). */
  obtainable: number;
  /** True once `owned` reaches `obtainable` - the player owns at least one of every currently-obtainable unit simultaneously. Guards against a vacuous true if `obtainable` were ever 0 (no active factions). */
  isComplete: boolean;
}

/**
 * Computes a collector's progress toward owning one of every obtainable
 * unit, given their current collection. `collection` is a multiset (can
 * contain duplicate ids - see campaignStore.ts's own header for why);
 * this only cares about distinct ids owned, not how many copies.
 */
export function getCollectionProgress(collection: string[]): CollectionProgress {
  const obtainableIds = getObtainableUnitIds();
  const ownedSet = new Set(collection);

  let owned = 0;
  for (const id of obtainableIds) {
    if (ownedSet.has(id)) owned += 1;
  }

  return {
    owned,
    obtainable: obtainableIds.size,
    isComplete: obtainableIds.size > 0 && owned === obtainableIds.size,
  };
}