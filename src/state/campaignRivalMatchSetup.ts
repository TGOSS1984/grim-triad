/**
 * Builds the AI rival's match roster from ITS OWN persistent, depletable
 * pool (campaignStore's `aiCollection` - see that store's file header)
 * rather than the unconstrained full catalog matchSetup.ts's
 * buildRandomAIRoster draws from. Campaign mode is the only mode with a
 * persistent AI-side pool at all - single-match and series mode both
 * still call buildRandomAIRoster directly in App.tsx, unchanged - so this
 * lives in its own file rather than complicating that shared function
 * with an optional "restrict to this pool" parameter only one caller
 * would ever pass.
 *
 * Deliberately mirrors buildRandomAIRoster's own algorithm as closely as
 * possible - same two-pass random-then-cheapest-first fill per faction,
 * same 'greedy' most-expensive-first strategy option (see
 * ai/difficulty.ts), same shuffled faction-by-faction attempt order, same
 * failure contract - rather than inventing a different balance approach.
 * The whole point, per the design this came out of, is that the rival
 * should feel like a normal, appropriately-tuned-for-difficulty AI
 * opponent for as long as its pool can support one - not a special
 * weaker/different opponent once Option B is in play. Reuses
 * matchSetup.ts's own greedyFill (exported for exactly this) rather than
 * a second copy of the same logic.
 */
import { getUnitsForRoster, ACTIVE_FACTIONS } from '../data/activeFactions';
import { shuffle } from '../utils/shuffle';
import { greedyFill, type RosterStrategy } from './matchSetup';

/**
 * Builds a roster (unit ids) for the AI rival, constrained to units
 * currently present in `pool` (campaignStore's aiCollection) - same
 * points-cap/minUnits/strategy contract as buildRandomAIRoster, just
 * sourced from a shrinking pool instead of the full catalog.
 *
 * `pool` is treated as a SET of ownable ids for roster-building purposes
 * (deduplicated via `owned` below), not a multiset: an army can't field
 * the same unit id twice no matter how many duplicate copies happen to be
 * in the pool - the same "no duplicate ids in one army" rule
 * armyBuilderStore already enforces for the human side (see its own
 * addUnit). Duplicate copies matter for campaignStore's own bookkeeping
 * (see recordMatchResult), not for what a single roster can contain.
 *
 * Throws the same "could not build a roster" error as buildRandomAIRoster
 * when no active faction's pool-owned units can reach `minUnits` within
 * `pointsCap` - a real, reachable failure once the pool is sufficiently
 * depleted (unlike buildRandomAIRoster, where the full catalog makes this
 * essentially unreachable at campaign's own points cap). Commit 8 is
 * responsible for detecting depletion BEFORE this is ever called
 * (offering reinforcements or ending the run), so in practice this throw
 * is a last-resort backstop, not the primary way depletion surfaces.
 */
export function buildRivalRosterFromPool(
  pool: string[],
  pointsCap: number,
  minUnits = 5,
  strategy: RosterStrategy = 'balanced',
): string[] {
  const owned = new Set(pool);
  const candidateFactions = shuffle(ACTIVE_FACTIONS.map((f) => f.name));

  for (const factionName of candidateFactions) {
    const ownedUnitsInRoster = getUnitsForRoster(factionName).filter((u) => owned.has(u.id));

    if (strategy === 'greedy') {
      const mostExpensiveFirst = [...ownedUnitsInRoster].sort((a, b) => b.points - a.points);
      const greedyResult = greedyFill(mostExpensiveFirst, pointsCap);
      if (greedyResult.length >= minUnits) {
        return greedyResult;
      }
      // Fell short with the greedy fill on this faction's owned units -
      // fall through to the balanced two-pass below rather than giving up
      // on the faction entirely, same reasoning as buildRandomAIRoster.
    }

    const randomOrderResult = greedyFill(shuffle(ownedUnitsInRoster), pointsCap);
    if (randomOrderResult.length >= minUnits) {
      return randomOrderResult;
    }

    const cheapestFirst = [...ownedUnitsInRoster].sort((a, b) => a.points - b.points);
    const cheapestFirstResult = greedyFill(cheapestFirst, pointsCap);
    if (cheapestFirstResult.length >= minUnits) {
      return cheapestFirstResult;
    }
  }

  throw new Error(
    `Could not build a rival roster of at least ${minUnits} units within ${pointsCap} points from the AI's remaining pool of ${owned.size} unique units`,
  );
}