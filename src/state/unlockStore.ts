/**
 * Tracks progress toward unlocking higher-cost units, ACCUMULATED ACROSS
 * EVERY GAME MODE - single match, series, and campaign all feed the same
 * counters here. This is deliberately a separate store from
 * campaignStore, not an extension of it: campaignStore is explicitly
 * scoped to one campaign run's own collection (wiped on
 * startCampaign/resetCampaign), whereas unlock progress is meant to
 * persist and grow regardless of which mode is being played or how many
 * campaign runs have come and gone - a single-match win should count
 * exactly the same as a campaign win.
 *
 * Every field here is a MONOTONICALLY INCREASING counter or an
 * ever-growing set - wins only go up, combo counts only go up, the set of
 * factions won with only grows. Unlike campaignStore's collection (which
 * can shrink on a loss, requiring a separate permanent "ever completed"
 * flag - see its own hasCompletedCollection), nothing here can ever
 * decrease. That means "which units are currently unlocked" can always
 * be computed FRESH from these raw numbers with no special permanence
 * bookkeeping needed - see data/unlockCriteria.ts (added in the next
 * commit), which is a pure function over this store's state, the same
 * relationship achievements.ts has to campaignStore's raw fields.
 *
 * Two DIFFERENT kinds of "how many combos happened" are tracked
 * separately on purpose:
 *  - recordSameOrPlusCombo/recordChainReaction are meant to be called in
 *    REAL TIME, once per trigger, as they happen during a live match
 *    (the natural hook point is wherever GameScreen already resolves
 *    RuleTriggerCallout's primary trigger per move - see that
 *    component's own history). This avoids having to reconstruct "how
 *    many Same/Plus triggers happened across this whole match" after the
 *    fact from game.history, which lastCapture alone (only ever reflects
 *    the MOST RECENT move) can't answer.
 *  - recordMatchOutcome is called exactly ONCE per finished match,
 *    regardless of mode, and separately carries whether that win was
 *    FLAWLESS (opponent captured zero cards across the whole match) -
 *    also a whole-match fact the caller needs to track cumulatively
 *    during play, not something derivable from the final GameState alone.
 *
 * `winsByFaction`/`flawlessWinFactions` are both keyed by faction NAME
 * (e.g. 'Necrons'), matching the convention achievements.ts already uses
 * (ownsRosterCompletely(collection, faction.name)) rather than faction
 * slug - keeps this store consistent with the other place per-faction
 * progress is already tracked in this codebase.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global on/off switch for the entire card-lock system, for local
 * testing/QA - flip to false to see and use every unit regardless of
 * unlock progress, exactly like before this feature existed. Deliberately
 * a plain exported constant (not a store field, not an env var, not a
 * build flag) - the whole point is a single line to comment out change
 * in one obvious place, nothing to configure or rebuild for.
 *
 * Colocated here rather than in campaignBalance.ts (where the original
 * plan for this commit put it): this feature spans every game mode, not
 * just campaign, so the switch belongs next to the store it actually
 * controls rather than in a campaign-specific file - easier to find when
 * "where's the unlock toggle" is the question being asked, not "where's
 * the campaign config".
 */
export const ENABLE_CARD_UNLOCKS = true;

export interface UnlockState {
  /** Total wins across every game mode. */
  totalWins: number;
  /** Wins per faction name, across every game mode. Only factions the player has ever won at least one match with appear as keys. */
  winsByFaction: Record<string, number>;
  /** Total Same/Plus combo triggers across every game mode, recorded in real time as they happen (see file header). */
  sameOrPlusComboCount: number;
  /** Total Chain-rule triggers across every game mode, recorded in real time as they happen (see file header). */
  chainReactionCount: number;
  /** Faction names the player has won at least one FLAWLESS match with (opponent captured zero cards across the whole match) - each name appears once regardless of how many flawless wins with that faction. */
  flawlessWinFactions: string[];

  /** Call once per Same or Plus trigger, in real time during a live match - see file header for why this can't be reconstructed after the match ends. */
  recordSameOrPlusCombo: () => void;
  /** Call once per Chain-rule trigger, in real time during a live match - see file header. */
  recordChainReaction: () => void;
  /**
   * Call exactly once when a match finishes, regardless of game mode.
   * `factionName` is the human player's faction for that match (undefined
   * if it genuinely couldn't be resolved - matches should never crash
   * over a missing faction name, this just means that match doesn't
   * contribute to winsByFaction/flawlessWinFactions, though it still
   * contributes to totalWins). `wasFlawless` only matters when outcome is
   * 'win' - ignored otherwise.
   */
  recordMatchOutcome: (
    outcome: 'win' | 'loss' | 'draw',
    factionName: string | undefined,
    wasFlawless: boolean,
  ) => void;
  /** Wipes all unlock progress back to zero - a testing/QA utility, not something normally exposed in the UI (there's no in-game "reset my unlocks" button planned). */
  resetProgress: () => void;
}

const UNLOCK_STORAGE_KEY = 'grim-triad-unlocks';

const initialState = {
  totalWins: 0,
  winsByFaction: {},
  sameOrPlusComboCount: 0,
  chainReactionCount: 0,
  flawlessWinFactions: [],
};

export const useUnlockStore = create<UnlockState>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordSameOrPlusCombo: () => {
        set({ sameOrPlusComboCount: get().sameOrPlusComboCount + 1 });
      },

      recordChainReaction: () => {
        set({ chainReactionCount: get().chainReactionCount + 1 });
      },

      recordMatchOutcome: (outcome, factionName, wasFlawless) => {
        if (outcome !== 'win') return;

        const { totalWins, winsByFaction, flawlessWinFactions } = get();
        const nextTotalWins = totalWins + 1;
        const nextWinsByFaction = factionName
          ? { ...winsByFaction, [factionName]: (winsByFaction[factionName] ?? 0) + 1 }
          : winsByFaction;
        const nextFlawlessWinFactions =
          factionName && wasFlawless && !flawlessWinFactions.includes(factionName)
            ? [...flawlessWinFactions, factionName]
            : flawlessWinFactions;

        set({
          totalWins: nextTotalWins,
          winsByFaction: nextWinsByFaction,
          flawlessWinFactions: nextFlawlessWinFactions,
        });
      },

      resetProgress: () => {
        set(initialState);
      },
    }),
    { name: UNLOCK_STORAGE_KEY },
  ),
);