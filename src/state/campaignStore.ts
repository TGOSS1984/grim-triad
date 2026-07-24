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
 *
 * Streaks split the same way: `currentStreakType`/`currentStreakCount`
 * describe THIS run (a draw breaks the streak; consecutive wins or
 * consecutive losses extend it) and reset with everything else on
 * startCampaign/resetCampaign. `bestWinStreak` is the longest win streak
 * ever reached and is PERMANENT, same reasoning and same "never
 * decreases" pattern as unlockedAchievementIds - it's also fed into the
 * achievement check (see the 'on-a-roll' achievement in achievements.ts),
 * so it has to be resolved BEFORE the achievement union runs each time,
 * not after.
 *
 * `hasCompletedCollection` is PERMANENT too, same "once true, never
 * unset" pattern as unlockedAchievementIds/bestWinStreak: it records that
 * the player has, at some point across ANY run, simultaneously owned one
 * of every currently-obtainable unit (see data/collectionProgress.ts for
 * why "obtainable" - active factions only - not the full generated
 * catalog). Deliberately a dedicated boolean rather than callers checking
 * `unlockedAchievementIds.includes('complete-collection')` - this is the
 * one piece of state the victory-celebration UI (CampaignResultScreen)
 * gates on directly, and a purpose-built field there is clearer and more
 * robust than parsing a magic achievement-id string out of a generic
 * list every time it's needed. Detecting the MOMENT completion is first
 * reached (to show a one-time celebration, vs this already having been
 * true) is left to the caller - compare this flag's value immediately
 * before and after calling recordMatchResult/startCampaign.
 *
 * `aiCollection` is the AI rival's own persistent pool, mirroring
 * `collection`'s shape and lifecycle exactly (a multiset, seeded fresh on
 * startCampaign, wiped on resetCampaign - NOT permanent, unlike
 * unlockedAchievementIds/bestWinStreak/hasCompletedCollection above: a
 * new campaign run means a new rival, not the same one picking up where
 * a previous run's depleted pool left off). Seeded as one copy of every
 * currently-obtainable unit (a full sweep - see startCampaign) rather
 * than a small random subset, so grinding it down to depletion is a
 * genuinely long arc, not a handful of wins.
 *
 * Trades are symmetric and use the SAME gained/lost arrays already
 * passed to recordMatchResult, just mirrored: whatever the human
 * *gained* came out of the AI's pool for that match (see App.tsx's
 * handleCoinFlipResult, which draws the AI's actual match hand from
 * aiCollection via campaignRivalMatchSetup.ts), so it's removed from
 * aiCollection here; whatever the human *lost* went TO the AI, so it's
 * added. No separate aiGained/aiLost parameters needed - every transfer
 * in a finished game is by construction either human-directed or
 * human-losing, so the human's own gained/lost fully determines both
 * sides' accounting.
 *
 * `hasVanquishedRival` is PERMANENT, same pattern as
 * hasCompletedCollection: it records that the AI's pool has, at some
 * point across ANY run, been ground down below CAMPAIGN_MIN_HAND_SIZE -
 * the same threshold CampaignHomeScreen uses to gate the player's OWN
 * "Continue Campaign" button when THEIR collection gets too small,
 * applied symmetrically to the other side. Deliberately stays true even
 * after `reinforceRival` refills the pool back up - the player DID
 * accomplish that at some point, the same way winning a game once still
 * counts even if you go on to lose the next one.
 *
 * `reinforceRival` is the recovery path once aiCollection is too
 * depleted to field a match: it reseeds aiCollection back to a full
 * sweep, exactly like startCampaign's own seeding, but touches NOTHING
 * else (collection, wins/losses, streaks, achievements) - "reinforcements
 * arrived" is purely an AI-pool event, not a new run and not a match
 * result of any kind.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentlyUnlockedAchievementIds } from './achievements';
import { getCollectionProgress, getObtainableUnitIds } from '../data/collectionProgress';
import { CAMPAIGN_MIN_HAND_SIZE } from './campaignBalance';

const CAMPAIGN_STORAGE_KEY = 'grim-triad-campaign';

type StreakType = 'win' | 'loss' | 'none';

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
  /** What the current run's active streak is made of - 'none' after a draw or before any match. */
  currentStreakType: StreakType;
  /** Length of the current streak - 0 when currentStreakType is 'none'. */
  currentStreakCount: number;
  /** Longest win streak ever reached, across ALL runs - permanent, same reasoning as unlockedAchievementIds. */
  bestWinStreak: number;
  /** True once the player has, at any point across ANY run, owned one of every currently-obtainable unit simultaneously - permanent, never reset. See file header for why this is a dedicated field. */
  hasCompletedCollection: boolean;
  /** The AI rival's own persistent, depletable pool for THIS run - a multiset, same shape as `collection`. Resets (unlike hasCompletedCollection etc.) on both startCampaign and resetCampaign - see file header. */
  aiCollection: string[];
  /** True once the AI's pool has, at any point across ANY run, been ground down below CAMPAIGN_MIN_HAND_SIZE - permanent, never reset (not even by reinforceRival). See file header. */
  hasVanquishedRival: boolean;

  /** Starts a new campaign run with a starting collection (the player's initial army). Overwrites any existing run - callers should confirm with the player before calling this if a run is already active. */
  startCampaign: (startingCollection: string[]) => void;
  /**
   * Records one match's outcome and applies any Trade Rule transfers to
   * both collections: `gained` unit ids are added to the player's
   * collection and removed from the AI's; `lost` unit ids are removed
   * from the player's collection and added to the AI's (one matching
   * entry each, not every copy - see file header). Safe to call with
   * empty gained/lost arrays for a Direct trade rule or a draw.
   */
  recordMatchResult: (outcome: 'win' | 'loss' | 'draw', gained: string[], lost: string[]) => void;
  /** Ends the current campaign run entirely, clearing all persisted progress (including aiCollection) EXCEPT unlockedAchievementIds, bestWinStreak, hasCompletedCollection, and hasVanquishedRival (see file header). */
  resetCampaign: () => void;
  /** Reseeds aiCollection back to a full sweep - the recovery path once the AI's pool is too depleted to field a match. Does not touch collection, wins/losses, streaks, or achievements - see file header. */
  reinforceRival: () => void;
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
  snapshot: {
    collection: string[];
    wins: number;
    losses: number;
    draws: number;
    bestWinStreak: number;
    aiCollection: string[];
  },
): string[] {
  const newlyUnlocked = getCurrentlyUnlockedAchievementIds(snapshot);
  return Array.from(new Set([...existing, ...newlyUnlocked]));
}

/** Monotonic OR, same "once true, never unset" pattern as unionUnlockedAchievements/bestWinStreak's Math.max: once the player has ever fully completed the collection, this stays true even if the collection given afterward (e.g. after subsequent losses) is no longer complete. */
function resolveHasCompletedCollection(alreadyCompleted: boolean, collection: string[]): boolean {
  return alreadyCompleted || getCollectionProgress(collection).isComplete;
}

/** Monotonic OR, same pattern as resolveHasCompletedCollection: once the AI's pool has ever been ground down below CAMPAIGN_MIN_HAND_SIZE, this stays true even after reinforceRival refills it back up. */
function resolveHasVanquishedRival(alreadyVanquished: boolean, aiCollection: string[]): boolean {
  return alreadyVanquished || aiCollection.length < CAMPAIGN_MIN_HAND_SIZE;
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
      currentStreakType: 'none',
      currentStreakCount: 0,
      bestWinStreak: 0,
      hasCompletedCollection: false,
      aiCollection: [],
      hasVanquishedRival: false,

      startCampaign: (startingCollection) => {
        const collection = [...startingCollection];
        // Full sweep of every currently-obtainable unit - one copy each
        // (see file header for why this, not a small random subset: a
        // long-lasting rival to grind down, not a quick one). Recomputed
        // fresh each call rather than a module-level constant, same
        // reasoning as getObtainableUnitIds() itself - stays correct as
        // more factions activate over time.
        const aiCollection = Array.from(getObtainableUnitIds());
        const wins = 0;
        const losses = 0;
        const draws = 0;
        const bestWinStreak = get().bestWinStreak;
        set({
          isActive: true,
          collection,
          aiCollection,
          wins,
          losses,
          draws,
          currentStreakType: 'none',
          currentStreakCount: 0,
          hasCompletedCollection: resolveHasCompletedCollection(
            get().hasCompletedCollection,
            collection,
          ),
          hasVanquishedRival: resolveHasVanquishedRival(get().hasVanquishedRival, aiCollection),
          unlockedAchievementIds: unionUnlockedAchievements(get().unlockedAchievementIds, {
            collection,
            wins,
            losses,
            draws,
            bestWinStreak,
            aiCollection,
          }),
        });
      },

      recordMatchResult: (outcome, gained, lost) => {
        const {
          collection,
          aiCollection,
          wins,
          losses,
          draws,
          unlockedAchievementIds,
          currentStreakType,
          currentStreakCount,
          bestWinStreak,
          hasCompletedCollection,
          hasVanquishedRival,
        } = get();
        const nextCollection = [...removeOneEach(collection, lost), ...gained];
        // Mirror image of nextCollection above: whatever the human
        // gained is removed from the AI's pool (that's where it came
        // from), whatever the human lost is added to it (that's where it
        // went) - see file header for why gained/lost alone fully
        // determines both sides without extra parameters.
        const nextAiCollection = [...removeOneEach(aiCollection, gained), ...lost];
        const nextWins = wins + (outcome === 'win' ? 1 : 0);
        const nextLosses = losses + (outcome === 'loss' ? 1 : 0);
        const nextDraws = draws + (outcome === 'draw' ? 1 : 0);

        // A draw breaks any streak. A result matching the current streak
        // type extends it; anything else starts a fresh streak of 1.
        const nextStreakType: StreakType = outcome === 'draw' ? 'none' : outcome;
        const nextStreakCount =
          outcome === 'draw' ? 0 : outcome === currentStreakType ? currentStreakCount + 1 : 1;
        const nextBestWinStreak =
          nextStreakType === 'win' ? Math.max(bestWinStreak, nextStreakCount) : bestWinStreak;

        set({
          collection: nextCollection,
          aiCollection: nextAiCollection,
          wins: nextWins,
          losses: nextLosses,
          draws: nextDraws,
          currentStreakType: nextStreakType,
          currentStreakCount: nextStreakCount,
          bestWinStreak: nextBestWinStreak,
          hasCompletedCollection: resolveHasCompletedCollection(
            hasCompletedCollection,
            nextCollection,
          ),
          hasVanquishedRival: resolveHasVanquishedRival(hasVanquishedRival, nextAiCollection),
          unlockedAchievementIds: unionUnlockedAchievements(unlockedAchievementIds, {
            collection: nextCollection,
            wins: nextWins,
            losses: nextLosses,
            draws: nextDraws,
            bestWinStreak: nextBestWinStreak,
            aiCollection: nextAiCollection,
          }),
        });
      },

      resetCampaign: () => {
        // unlockedAchievementIds, bestWinStreak, hasCompletedCollection,
        // and hasVanquishedRival are deliberately omitted here - see file
        // header. Everything else genuinely resets, including the
        // CURRENT streak (which is per-run) and aiCollection (a new run
        // means a new rival, not the same depleted one - see file
        // header).
        set({
          isActive: false,
          collection: [],
          aiCollection: [],
          wins: 0,
          losses: 0,
          draws: 0,
          currentStreakType: 'none',
          currentStreakCount: 0,
        });
      },

      reinforceRival: () => {
        // Deliberately touches ONLY aiCollection - see file header for
        // why this isn't a match result, a new run, or an achievement
        // event of its own (hasVanquishedRival already stays true from
        // whenever depletion first happened; reinforcing doesn't unset
        // it, and doesn't need to re-run the achievement union since
        // nothing achievement-relevant changed here).
        set({ aiCollection: Array.from(getObtainableUnitIds()) });
      },
    }),
    { name: CAMPAIGN_STORAGE_KEY },
  ),
);