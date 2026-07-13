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
 * full catalog is 1075 units; the four active factions' EFFECTIVE roster
 * sizes (including the shared generic Space Marine pool - see
 * activeFactions.ts's getUnitsForRoster) range from 52 (Necrons/
 * Tyranids) to 99 (Blood Angels) units.
 */
import { ACTIVE_FACTIONS, getUnitsForRoster } from '../data/activeFactions';

export interface AchievementContext {
  collection: string[];
  wins: number;
  losses: number;
  draws: number;
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

/** True if the collection currently contains every unit in at least one active faction's full effective roster (own units + the shared generic pool, for a Space Marine chapter). */
function ownsCompleteFaction(collection: string[]): boolean {
  const owned = new Set(collection);
  return ACTIVE_FACTIONS.some((faction) => {
    const roster = getUnitsForRoster(faction.name);
    return roster.length > 0 && roster.every((u) => owned.has(u.id));
  });
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
];

/** Every achievement currently satisfied by this snapshot - NOT the permanent unlocked set (see file header), just what's true right now. */
export function getCurrentlyUnlockedAchievementIds(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(ctx)).map((a) => a.id);
}