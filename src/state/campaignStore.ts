/**
 * Campaign/collection mode's persistent state: unlike single-match and
 * series mode (both fully reset via their own stores' `reset()` on every
 * "New Game"), a campaign run's collection and record PERSIST across
 * browser sessions - this is the "collector" meta-game layer: wins and
 * losses actually matter, cards change hands permanently, and the whole
 * point is building up a collection over many separate play sessions,
 * not just one sitting.
 *
 * Persistence: this is a static-hosted app with no backend (see
 * ROADMAP.md), so localStorage is the only realistic persistence
 * mechanism - zustand's `persist` middleware handles this, writing to
 * localStorage on every state change. That gives auto-save "for free":
 * there's no explicit save action anywhere in this store, and none is
 * needed - every `set()` call (start a run, record a match result, etc.)
 * persists immediately, matching the chosen design (auto-save after
 * every match, no explicit save button).
 *
 * Collection as a multiset, not a set: `collection` is a plain
 * `string[]` of unit ids, and CAN contain duplicates - a single army
 * build can never contain the same unit id twice (see
 * armyBuilderStore's addUnit), but a campaign collection can, because
 * gained units come from an independently-generated opponent pool that
 * may happen to include a unit id you already own. Removing a "lost"
 * unit therefore removes exactly ONE matching entry, not every copy of
 * that id - see removeOneEach below.
 *
 * Achievements are PERMANENT, unlike everything else in this store:
 * `unlockedAchievementIds` is deliberately never touched by
 * resetCampaign - an achievement earned in one run should still be
 * unlocked after starting a new one. Every state-changing action here
 * re-checks the full achievement list (see achievements.ts) against the
 * state AFTER that action and unions any newly-true ids into the
 * permanent set - once added, an id is never removed, even if e.g. the
 * collection later shrinks back below a collector threshold.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentlyUnlockedAchievementIds } from './achievements';

const CAMPAIGN_STORAGE_KEY = 'grim-triad-campaign';

export interface CampaignState {
  /** True once a campaign run has been started (collection seeded); false initially and after resetCampaign. */
  isActive: boolean;
  /** Unit ids currently owned - the persistent collection this run has built up. A multiset (can contain duplicate ids) - see file header. */
  collection: string[];
  wins: number;
  losses: number;
  draws: number;
  /** Every achievement id ever unlocked, across ALL runs - see file header for why this survives resetCampaign when nothing else does. */
  unlockedAchievementIds: string[];

  /** Starts a new campaign run with a starting collection (the player's initial army). Overwrites any existing run - callers should confirm with the player before calling this if a run is already active. */
  startCampaign: (startingCollection: string[]) => void;
  /**
   * Records one match's outcome and applies any Trade Rule transfers to
   * the collection: `gained` unit ids are added, `lost` unit ids are
   * removed (one matching entry each, not every copy - see file
   * header). Safe to call with empty gained/lost arrays for a Direct
   * trade rule or a draw.
   */
  recordMatchResult: (outcome: 'win' | 'loss' | 'draw', gained: string[], lost: string[]) => void;
  /** Ends the current campaign run entirely, clearing all persisted progress EXCEPT unlockedAchievementIds (see file header). */
  resetCampaign: () => void;
}

/** Removes exactly one occurrence of each id in `toRemove` from `pool` - a multiset removal, not a filter (which would remove every copy of a repeated id even if only one was actually lost). */
function removeOneEach(pool: string[], toRemove: string[]): string[] {
  const remaining = [...pool];
  for (const id of toRemove) {
    const index = remaining.indexOf(id);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

/** Unions any newly-satisfied achievement ids into the permanent set - never removes an id, even if the condition that earned it is no longer true. */
function unionUnlockedAchievements(
  existing: string[],
  snapshot: { collection: string[]; wins: number; losses: number; draws: number },
): string[] {
  const newlyUnlocked = getCurrentlyUnlockedAchievementIds(snapshot);
  return Array.from(new Set([...existing, ...newlyUnlocked]));
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      isActive: false,
      collection: [],
      wins: 0,
      losses: 0,
      draws: 0,
      unlockedAchievementIds: [],

      startCampaign: (startingCollection) => {
        const collection = [...startingCollection];
        const wins = 0;
        const losses = 0;
        const draws = 0;
        set({
          isActive: true,
          collection,
          wins,
          losses,
          draws,
          unlockedAchievementIds: unionUnlockedAchievements(get().unlockedAchievementIds, {
            collection,
            wins,
            losses,
            draws,
          }),
        });
      },

      recordMatchResult: (outcome, gained, lost) => {
        const { collection, wins, losses, draws, unlockedAchievementIds } = get();
        const nextCollection = [...removeOneEach(collection, lost), ...gained];
        const nextWins = wins + (outcome === 'win' ? 1 : 0);
        const nextLosses = losses + (outcome === 'loss' ? 1 : 0);
        const nextDraws = draws + (outcome === 'draw' ? 1 : 0);

        set({
          collection: nextCollection,
          wins: nextWins,
          losses: nextLosses,
          draws: nextDraws,
          unlockedAchievementIds: unionUnlockedAchievements(unlockedAchievementIds, {
            collection: nextCollection,
            wins: nextWins,
            losses: nextLosses,
            draws: nextDraws,
          }),
        });
      },

      resetCampaign: () => {
        // unlockedAchievementIds is deliberately omitted here - see file
        // header. Everything else genuinely resets.
        set({ isActive: false, collection: [], wins: 0, losses: 0, draws: 0 });
      },
    }),
    { name: CAMPAIGN_STORAGE_KEY },
  ),
);