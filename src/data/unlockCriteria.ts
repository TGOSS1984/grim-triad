/**
 * Defines the unlock tiers (points-cost ranges gated behind cross-mode
 * progress - see state/unlockStore.ts) and the pure functions that
 * compute, given a snapshot of that progress, which units are currently
 * locked. No store access here, same "pure function over a snapshot"
 * philosophy as achievements.ts's relationship to campaignStore - this
 * module doesn't know unlockStore exists, just what counts as unlocked
 * given a plain data snapshot, so it's independently unit-testable and
 * reusable by whatever UI needs it (armyBuilderStore's availableUnits()
 * filter, in the next commit).
 *
 * Tier boundaries and unlock conditions are calibrated against the REAL
 * points distribution across the 737 currently-obtainable units, not
 * arbitrary guesses:
 *   <200 pts   : 645 units (87.5%) - always available, no tier at all
 *   200-250    :  34 units (4.6%)  - Win 10 games (any mode, any faction)
 *   250-300    :  23 units (3.1%)  - Win 20 games total, OR 15 Same/Plus combos total
 *   300-400    :  16 units (2.2%)  - Win 10 games with THAT unit's own faction
 *   400-500    :   9 units (1.2%)  - Win with 5 different factions (>=1 win each)
 *   500+       :  10 units (1.4%)  - 3 flawless wins, each with a different faction
 * The 500+ tier is deliberately the rarest condition (flawless wins, not
 * just volume) for the rarest, most iconic units in the catalog (Phantom
 * Titan, Revenant Titan, Stompa, Thunderhawk Gunship, etc.) - a genuine
 * "I earned that" moment rather than one more volume checkpoint.
 */
import { ACTIVE_FACTIONS, getUnitsForRoster } from './activeFactions';
import type { Unit } from './schema';

/** Matches unlockStore's UnlockState shape (minus the action functions) - a plain snapshot, not the live store, so this module never needs to import unlockStore itself. */
export interface UnlockProgressSnapshot {
  totalWins: number;
  winsByFaction: Record<string, number>;
  sameOrPlusComboCount: number;
  chainReactionCount: number;
  flawlessWinFactions: string[];
}

export interface UnlockTierContext {
  /** Every active faction whose effective roster (getUnitsForRoster) includes this unit - usually just one, but a shared generic Space Marine unit can belong to several chapters at once (see getUnitFactionNames below). */
  factionsContainingUnit: string[];
}

export interface UnlockTier {
  id: string;
  /** Short display label, e.g. "300-400 pts". */
  label: string;
  /** Inclusive lower bound. */
  minPoints: number;
  /** Exclusive upper bound, or null for no upper bound (the top tier). */
  maxPoints: number | null;
  /** Human-readable unlock condition, for UI copy (locked-card tooltips, the unlock reveal, etc.). */
  description: string;
  isUnlocked: (snapshot: UnlockProgressSnapshot, context: UnlockTierContext) => boolean;
}

export const UNLOCK_TIERS: UnlockTier[] = [
  {
    id: 'tier-200-250',
    label: '200-250 pts',
    minPoints: 200,
    maxPoints: 250,
    description: 'Win 10 games (any mode, any faction)',
    isUnlocked: (snapshot) => snapshot.totalWins >= 10,
  },
  {
    id: 'tier-250-300',
    label: '250-300 pts',
    minPoints: 250,
    maxPoints: 300,
    description: 'Win 20 games total, or land 15 Same/Plus combos total',
    isUnlocked: (snapshot) => snapshot.totalWins >= 20 || snapshot.sameOrPlusComboCount >= 15,
  },
  {
    id: 'tier-300-400',
    label: '300-400 pts',
    minPoints: 300,
    maxPoints: 400,
    description: "Win 10 games with that unit's own faction",
    isUnlocked: (snapshot, context) =>
      context.factionsContainingUnit.some(
        (factionName) => (snapshot.winsByFaction[factionName] ?? 0) >= 10,
      ),
  },
  {
    id: 'tier-400-500',
    label: '400-500 pts',
    minPoints: 400,
    maxPoints: 500,
    description: 'Win with 5 different factions (at least 1 win each)',
    isUnlocked: (snapshot) =>
      Object.values(snapshot.winsByFaction).filter((wins) => wins > 0).length >= 5,
  },
  {
    id: 'tier-500-plus',
    label: '500+ pts',
    minPoints: 500,
    maxPoints: null,
    description: '3 flawless wins (your opponent captures nothing), each with a different faction',
    isUnlocked: (snapshot) => snapshot.flawlessWinFactions.length >= 3,
  },
];

/**
 * Which tier a given points cost falls into, or null if it's under the
 * lowest tier's minimum (200) - meaning it's always available, no
 * progress needed at all. Tiers are checked in ascending order and are
 * contiguous/non-overlapping by construction (see UNLOCK_TIERS above),
 * so at most one can ever match.
 */
export function getTierForPoints(points: number): UnlockTier | null {
  return (
    UNLOCK_TIERS.find(
      (tier) => points >= tier.minPoints && (tier.maxPoints === null || points < tier.maxPoints),
    ) ?? null
  );
}

/**
 * O(1) lookup from a unit id to every active faction whose effective
 * roster includes it - built once at module load, same reasoning as
 * activeFactions.ts's own UNITS_BY_ID: a per-check scan over every active
 * faction's full roster would work but there's no reason to pay that cost
 * repeatedly (this gets checked for every locked-tier unit, every time
 * availableUnits() is computed) when the mapping never changes after
 * load.
 */
const FACTIONS_CONTAINING_UNIT = new Map<string, string[]>();
for (const faction of ACTIVE_FACTIONS) {
  for (const unit of getUnitsForRoster(faction.name)) {
    const existing = FACTIONS_CONTAINING_UNIT.get(unit.id);
    if (existing) {
      existing.push(faction.name);
    } else {
      FACTIONS_CONTAINING_UNIT.set(unit.id, [faction.name]);
    }
  }
}

/** See FACTIONS_CONTAINING_UNIT above. Returns an empty array for a unit id that isn't in any active faction's roster at all (shouldn't normally happen for a unit actually being checked, but never throws). */
export function getFactionsContainingUnit(unitId: string): string[] {
  return FACTIONS_CONTAINING_UNIT.get(unitId) ?? [];
}

/**
 * Whether a specific unit is currently unlocked, given a progress
 * snapshot. A unit with no tier (under 200 pts) is always unlocked
 * regardless of progress.
 */
export function isUnitUnlocked(
  unitId: string,
  points: number,
  snapshot: UnlockProgressSnapshot,
): boolean {
  const tier = getTierForPoints(points);
  if (!tier) return true;
  return tier.isUnlocked(snapshot, { factionsContainingUnit: getFactionsContainingUnit(unitId) });
}

/**
 * Every currently-obtainable unit that has SOME tier at all (points >=
 * 200) - i.e. every unit isUnitUnlocked could ever actually return false
 * for. Precomputed once at module load, same reasoning as
 * FACTIONS_CONTAINING_UNIT above: this gets scanned on every
 * getNewlyUnlockedBatches call (once per finished match, across every
 * mode - see App.tsx), so there's no reason to re-derive it from every
 * active faction's full roster each time when the underlying data never
 * changes after load.
 */
const LOCKABLE_UNITS: Unit[] = (() => {
  const seen = new Set<string>();
  const units: Unit[] = [];
  for (const faction of ACTIVE_FACTIONS) {
    for (const unit of getUnitsForRoster(faction.name)) {
      if (seen.has(unit.id) || getTierForPoints(unit.points) === null) continue;
      seen.add(unit.id);
      units.push(unit);
    }
  }
  return units;
})();

export interface NewlyUnlockedBatch {
  tier: UnlockTier;
  /** Every unit that just unlocked in this tier, sorted MOST EXPENSIVE FIRST - units[0] is the intended "hero" card for a reveal (the single most impressive unlock to actually show big), with the rest summarized as a count rather than shown individually. See file header on CardUnlockReveal.tsx for why: a single threshold crossing can unlock an entire tier's worth of units at once (up to 34, at the 200-250 tier), and showing that many full-screen reveals in a row would be exhausting rather than premium. */
  units: Unit[];
}

/**
 * Compares unlock progress BEFORE and AFTER something changed it (a
 * finished match, in practice - see App.tsx) and returns which units
 * newly became unlocked, grouped by tier, in ascending tier order. Empty
 * array if nothing newly unlocked. A unit already unlocked in `before`
 * is never included even if it's ALSO unlocked in `after` - only a
 * genuine false -> true transition counts, matching every other
 * "newly happened" detection already used elsewhere in this app (e.g.
 * campaignStore's hasCompletedCollection transition in App.tsx).
 */
export function getNewlyUnlockedBatches(
  before: UnlockProgressSnapshot,
  after: UnlockProgressSnapshot,
): NewlyUnlockedBatch[] {
  const byTierId = new Map<string, Unit[]>();
  for (const unit of LOCKABLE_UNITS) {
    const wasLocked = !isUnitUnlocked(unit.id, unit.points, before);
    const isNowUnlocked = isUnitUnlocked(unit.id, unit.points, after);
    if (!wasLocked || !isNowUnlocked) continue;

    const tier = getTierForPoints(unit.points)!;
    const existing = byTierId.get(tier.id);
    if (existing) {
      existing.push(unit);
    } else {
      byTierId.set(tier.id, [unit]);
    }
  }

  return UNLOCK_TIERS.filter((tier) => byTierId.has(tier.id)).map((tier) => ({
    tier,
    units: byTierId.get(tier.id)!.sort((a, b) => b.points - a.points),
  }));
}