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
 *
 * Each tier also exposes getProgress alongside isUnlocked - "how close",
 * not just "yes/no" - so locked-card UI can show live progress (e.g.
 * "6/10 games won") instead of a static, unchanging description. See
 * getUnitUnlockProgress for the per-unit entry point armyBuilderStore
 * uses, and getTierUnlockCounts for the tier-level "12/34 units unlocked"
 * summary screens/ProgressScreen.tsx uses.
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

/**
 * Live progress toward a tier's unlock condition - "how close", as
 * opposed to isUnlocked's plain yes/no. `label` names what's being
 * counted (e.g. "games won", "wins with Dark Angels") so the UI can
 * render "6/10 games won" without needing its own copy of each tier's
 * wording. `current` is always clamped to `target` (never shown as
 * "12/10") even though the underlying stat can keep climbing past it in
 * practice - once a tier is unlocked, getUnitUnlockProgress below stops
 * returning progress for it at all, so callers only ever see this while
 * a tier is still genuinely in progress.
 */
export interface UnlockProgress {
  current: number;
  target: number;
  label: string;
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
  /** See UnlockProgress's own doc. Called regardless of current unlock state - callers needing "only while still locked" semantics (e.g. getUnitUnlockProgress below) check isUnlocked themselves first. */
  getProgress: (snapshot: UnlockProgressSnapshot, context: UnlockTierContext) => UnlockProgress;
}

export const UNLOCK_TIERS: UnlockTier[] = [
  {
    id: 'tier-200-250',
    label: '200-250 pts',
    minPoints: 200,
    maxPoints: 250,
    description: 'Win 10 games (any mode, any faction)',
    isUnlocked: (snapshot) => snapshot.totalWins >= 10,
    getProgress: (snapshot) => ({
      current: Math.min(snapshot.totalWins, 10),
      target: 10,
      label: 'games won',
    }),
  },
  {
    id: 'tier-250-300',
    label: '250-300 pts',
    minPoints: 250,
    maxPoints: 300,
    description: 'Win 20 games total, or land 15 Same/Plus combos total',
    isUnlocked: (snapshot) => snapshot.totalWins >= 20 || snapshot.sameOrPlusComboCount >= 15,
    // Two independent paths - shows whichever the player is actually
    // CLOSER to (by percentage of target), not always the same one, so
    // someone who's been landing combos sees combo progress and someone
    // who's been grinding wins sees win progress, rather than always
    // defaulting to one path regardless of how the player's actually
    // been playing. Ties go to wins (the >, not >=, below).
    getProgress: (snapshot) => {
      const winsPct = snapshot.totalWins / 20;
      const comboPct = snapshot.sameOrPlusComboCount / 15;
      if (comboPct > winsPct) {
        return {
          current: Math.min(snapshot.sameOrPlusComboCount, 15),
          target: 15,
          label: 'Same/Plus combos',
        };
      }
      return { current: Math.min(snapshot.totalWins, 20), target: 20, label: 'games won' };
    },
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
    // A unit can belong to several factions at once (a shared generic
    // Space Marine unit usable by multiple chapters) - shows progress
    // against whichever ONE the player is closest to unlocking through,
    // not an arbitrary first-in-list pick, so a card shared across five
    // chapters reports the chapter the player's actually been playing.
    getProgress: (snapshot, context) => {
      if (context.factionsContainingUnit.length === 0) {
        return { current: 0, target: 10, label: "wins with its own faction" };
      }
      let bestFaction = context.factionsContainingUnit[0];
      let bestWins = snapshot.winsByFaction[bestFaction] ?? 0;
      for (const factionName of context.factionsContainingUnit.slice(1)) {
        const wins = snapshot.winsByFaction[factionName] ?? 0;
        if (wins > bestWins) {
          bestFaction = factionName;
          bestWins = wins;
        }
      }
      return { current: Math.min(bestWins, 10), target: 10, label: `wins with ${bestFaction}` };
    },
  },
  {
    id: 'tier-400-500',
    label: '400-500 pts',
    minPoints: 400,
    maxPoints: 500,
    description: 'Win with 5 different factions (at least 1 win each)',
    isUnlocked: (snapshot) =>
      Object.values(snapshot.winsByFaction).filter((wins) => wins > 0).length >= 5,
    getProgress: (snapshot) => ({
      current: Math.min(
        Object.values(snapshot.winsByFaction).filter((wins) => wins > 0).length,
        5,
      ),
      target: 5,
      label: 'factions won with',
    }),
  },
  {
    id: 'tier-500-plus',
    label: '500+ pts',
    minPoints: 500,
    maxPoints: null,
    description: '3 flawless wins (your opponent captures nothing), each with a different faction',
    isUnlocked: (snapshot) => snapshot.flawlessWinFactions.length >= 3,
    getProgress: (snapshot) => ({
      current: Math.min(snapshot.flawlessWinFactions.length, 3),
      target: 3,
      label: 'flawless-win factions',
    }),
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
 * Live "how close" progress toward unlocking a specific unit, given a
 * progress snapshot - companion to isUnitUnlocked's plain yes/no. Returns
 * null for anything that isn't currently locked at all: either it has no
 * tier (under 200pts, always available), or its tier is already
 * unlocked. Callers (locked-card UI) only ever need this while a card is
 * actually still locked - checking isUnlocked first here means a caller
 * doesn't have to separately guard against showing stale/meaningless
 * progress on a card that isn't locked anymore.
 */
export function getUnitUnlockProgress(
  unitId: string,
  points: number,
  snapshot: UnlockProgressSnapshot,
): UnlockProgress | null {
  const tier = getTierForPoints(points);
  if (!tier) return null;
  const context = { factionsContainingUnit: getFactionsContainingUnit(unitId) };
  if (tier.isUnlocked(snapshot, context)) return null;
  return tier.getProgress(snapshot, context);
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

/**
 * LOCKABLE_UNITS grouped by which tier each belongs to - precomputed once
 * at module load alongside LOCKABLE_UNITS itself, same reasoning: this
 * gets scanned by getTierUnlockCounts below (the Progress screen's own
 * summary), no reason to re-filter the full list by tier on every call
 * when the grouping never changes after load.
 */
const LOCKABLE_UNITS_BY_TIER_ID = new Map<string, Unit[]>();
for (const unit of LOCKABLE_UNITS) {
  const tier = getTierForPoints(unit.points)!;
  const existing = LOCKABLE_UNITS_BY_TIER_ID.get(tier.id);
  if (existing) {
    existing.push(unit);
  } else {
    LOCKABLE_UNITS_BY_TIER_ID.set(tier.id, [unit]);
  }
}

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

export interface TierUnlockCount {
  tier: UnlockTier;
  /** How many of this tier's units are unlocked right now, given the snapshot passed to getTierUnlockCounts. */
  unlocked: number;
  /** Total units in this tier - fixed by the catalog, independent of any snapshot. */
  total: number;
}

/**
 * How many units are currently unlocked vs the total in each tier, given
 * a progress snapshot - the Progress screen's own "12/34 units unlocked"
 * per-tier summary. Returns ALL FIVE tiers, in ascending order, regardless
 * of whether anything in a given tier is unlocked yet - unlike
 * getNewlyUnlockedBatches above (which only returns tiers that JUST
 * changed, for a one-time reveal), this is a full snapshot of every
 * tier's current state, meant for a persistent summary view that's
 * re-read on every visit, not a transition to react to once.
 *
 * Deliberately does NOT try to reduce tier-300-400 (the per-faction tier)
 * to a single current/target number the way getProgress does for one
 * specific unit - there's no single meaningful "6/10" for a tier whose
 * condition varies per unit's own faction. The unlocked/total COUNT still
 * works fine for it (a unit either counts as unlocked or it doesn't,
 * regardless of which faction got it there), which is all a tier-level
 * summary actually needs.
 */
export function getTierUnlockCounts(snapshot: UnlockProgressSnapshot): TierUnlockCount[] {
  return UNLOCK_TIERS.map((tier) => {
    const units = LOCKABLE_UNITS_BY_TIER_ID.get(tier.id) ?? [];
    const unlocked = units.filter((unit) => isUnitUnlocked(unit.id, unit.points, snapshot)).length;
    return { tier, unlocked, total: units.length };
  });
}