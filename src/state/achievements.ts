/**
 * Campaign achievement definitions. Pure functions/data only, no store
 * access - same reasoning as campaignBalance.ts: this module doesn't
 * know about campaignStore or React, just what counts as "unlocked"
 * given a snapshot of collection/wins/losses/draws, so it's unit
 * testable directly and reusable by whatever UI displays it.
 *
 * Permanence is a campaignStore concern, not this module's: an
 * achievement earned during one campaign run should stay unlocked even
 * after starting a new run (that's the whole point of an achievement
 * system - rewarding engagement across a player's whole history, not
 * just the current run). This module only answers "is this unlocked
 * RIGHT NOW given this snapshot" - campaignStore is the one that
 * remembers "was this ever true" permanently (see its own
 * unlockedAchievementIds field, which is deliberately NOT cleared by
 * resetCampaign).
 *
 * Thresholds checked against the real current data, not guessed: the
 * full generated catalog is 1075 units, but only 737 of those are
 * currently obtainable at all (belong to one of the 18 currently-active
 * factions - see data/collectionProgress.ts for why that split matters).
 * Active factions' EFFECTIVE roster sizes (including the shared generic
 * Space Marine pool - see activeFactions.ts's getUnitsForRoster) range
 * from ~50 to ~99 units.
 *
 * Per-faction "Master of X" achievements (one per entry in
 * ACTIVE_FACTIONS) and the top-tier "Complete Collection" achievement are
 * both generated/computed from live data rather than hardcoded, for the
 * same reason getObtainableUnitIds() is in collectionProgress.ts: the
 * active roster grows over time, and both should automatically cover
 * whatever's active without a code change here when that happens.
 *
 * "Rival Vanquished" mirrors "Complete Collection" from the OTHER side of
 * the collector meta-game: instead of the player's own collection
 * reaching full, it fires when the AI's persistent pool (aiCollection -
 * see campaignStore) has been ground down below CAMPAIGN_MIN_HAND_SIZE,
 * the same threshold CampaignHomeScreen already uses to gate the
 * player's OWN "Continue Campaign" button when THEIR collection gets too
 * small - same rule, applied symmetrically to the other side now that it
 * has a persistent pool of its own too.
 */
import { ACTIVE_FACTIONS, getUnitsForRoster } from '../data/activeFactions';
import { getCollectionProgress } from '../data/collectionProgress';
import { CAMPAIGN_MIN_HAND_SIZE } from './campaignBalance';

export interface AchievementContext {
  collection: string[];
  wins: number;
  losses: number;
  draws: number;
  /** Longest consecutive-win streak ever reached (see campaignStore's own bestWinStreak, which is permanent the same way achievements are). */
  bestWinStreak: number;
  /** The AI rival's own persistent pool for THIS run (see campaignStore's aiCollection) - used by the Rival Vanquished achievement below. */
  aiCollection: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  isUnlocked: (ctx: AchievementContext) => boolean;
}

function uniqueOwnedCount(collection: string[]): number {
  return new Set(collection).size;
}

/** True if every unit in a given faction's full effective roster (own units + the shared generic pool, for a Space Marine chapter) is present in `owned`. Empty rosters never count as "complete" (a data gap, not an achievement). */
function ownsRosterCompletely(owned: Set<string>, factionName: string): boolean {
  const roster = getUnitsForRoster(factionName);
  return roster.length > 0 && roster.every((u) => owned.has(u.id));
}

/** True if the collection currently contains every unit in at least one active faction's full effective roster - see ownsRosterCompletely. */
function ownsCompleteFaction(collection: string[]): boolean {
  const owned = new Set(collection);
  return ACTIVE_FACTIONS.some((faction) => ownsRosterCompletely(owned, faction.name));
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Win your first campaign match.',
    isUnlocked: (ctx) => ctx.wins >= 1,
  },
  {
    id: 'blooded-veteran',
    name: 'Blooded Veteran',
    description: 'Win 10 campaign matches.',
    isUnlocked: (ctx) => ctx.wins >= 10,
  },
  {
    id: 'grand-champion',
    name: 'Grand Champion',
    description: 'Win 25 campaign matches.',
    isUnlocked: (ctx) => ctx.wins >= 25,
  },
  {
    id: 'collector-recruit',
    name: 'Recruit Collector',
    description: 'Own 25 unique units at once.',
    isUnlocked: (ctx) => uniqueOwnedCount(ctx.collection) >= 25,
  },
  {
    id: 'collector-hoarder',
    name: 'Hoarder',
    description: 'Own 100 unique units at once.',
    isUnlocked: (ctx) => uniqueOwnedCount(ctx.collection) >= 100,
  },
  {
    id: 'collector-archivist',
    name: 'Archivist',
    description: 'Own 250 unique units at once.',
    isUnlocked: (ctx) => uniqueOwnedCount(ctx.collection) >= 250,
  },
  {
    id: 'full-muster',
    name: 'Full Muster',
    description: "Own every unit in at least one faction's complete roster.",
    isUnlocked: (ctx) => ownsCompleteFaction(ctx.collection),
  },
  {
    id: 'grim-determination',
    name: 'Grim Determination',
    description: 'Suffer 10 losses and keep fighting anyway.',
    isUnlocked: (ctx) => ctx.losses >= 10,
  },
  {
    id: 'on-a-roll',
    name: 'On a Roll',
    description: 'Win 5 campaign matches in a row.',
    isUnlocked: (ctx) => ctx.bestWinStreak >= 5,
  },

  // One "Master of X" achievement per currently-active faction, generated
  // from ACTIVE_FACTIONS rather than hardcoded per name - a newly
  // activated faction gets its own achievement automatically, no edit
  // needed here. Distinct from - and a strictly harder bar than - the
  // single 'full-muster' achievement above, which only asks for ANY one
  // complete roster: full-muster is the milestone most players reach
  // first, these give specific recognition for each faction mastered
  // beyond that.
  ...ACTIVE_FACTIONS.map(
    (faction): Achievement => ({
      id: `master-of-${faction.slug}`,
      name: `Master of ${faction.name}`,
      description: `Own every unit in the ${faction.name} roster.`,
      isUnlocked: (ctx) => ownsRosterCompletely(new Set(ctx.collection), faction.name),
    }),
  ),

  {
    id: 'complete-collection',
    name: 'Complete Collection',
    description: 'Own one of every unit currently obtainable across all active factions.',
    isUnlocked: (ctx) => getCollectionProgress(ctx.collection).isComplete,
  },
  {
    id: 'rival-vanquished',
    name: 'Rival Vanquished',
    description: "Reduce your AI rival's pool to its final cards.",
    isUnlocked: (ctx) => ctx.aiCollection.length < CAMPAIGN_MIN_HAND_SIZE,
  },
];

/** Every achievement currently satisfied by this snapshot - NOT the permanent unlocked set (see file header), just what's true right now. */
export function getCurrentlyUnlockedAchievementIds(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(ctx)).map((a) => a.id);
}