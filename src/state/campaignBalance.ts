/**
 * Balance rules for a campaign run's STARTING roster - the "smallish
 * hand, decent points limit" the collector meta-game begins with (see
 * campaignStore.ts for the persistent collection this seeds). Pure
 * functions/constants only, no store access - this module doesn't know
 * about campaignStore or React, just what makes a starting roster valid,
 * so it can be unit tested directly and reused by whatever UI wiring
 * consumes it later.
 *
 * Design reasoning, checked against the REAL active-roster data, not
 * guessed:
 *  - CAMPAIGN_STARTING_POOL_SIZE (15): bigger than a single match's
 *    5-card hand and bigger than single-match mode's own minimum army
 *    size, so an early loss or two doesn't wipe out the whole starting
 *    roster - matches this project's existing "series pool" sizing
 *    pattern (a multiple of 5).
 *  - CAMPAIGN_STARTING_POINTS_CAP (1000): one of the app's EXISTING
 *    points-cap options (see ArmyBuilder.tsx's POINTS_CAPS: 500/1000/
 *    2000), not a new one. This matters because 500 turned out to be
 *    infeasible for a 15-unit roster: the cheapest possible 15 units in
 *    any of the v1 active rosters (Blood Angels, Necrons, Tyranids,
 *    Aeldari) already cost 815-895pts on their own, before the player
 *    has picked anything but the bare minimum. 1000 leaves real
 *    breathing room above that floor without being the wide-open ceiling
 *    2000 would be.
 *  - Power cap, not a ban: rather than excluding any specific card
 *    outright, this caps how MANY units above
 *    CAMPAIGN_POWER_THRESHOLD_POINTS the starting roster can include
 *    (CAMPAIGN_MAX_POWER_UNITS). 150pts sits roughly at the
 *    top 15-25% most expensive units per active faction (median unit
 *    cost across all four is 85-100pts) - "powerful", not just "above
 *    average". This still leaves every unit selectable, it just stops a
 *    starting roster from being ALL big-ticket cards.
 */
import { getUnitById } from '../data/activeFactions';

export const CAMPAIGN_STARTING_POOL_SIZE = 15;
export const CAMPAIGN_STARTING_POINTS_CAP = 1000;
export const CAMPAIGN_POWER_THRESHOLD_POINTS = 150;
export const CAMPAIGN_MAX_POWER_UNITS = 3;

/** True if a unit counts as "powerful" for the starting-roster power cap - i.e. costs more than CAMPAIGN_POWER_THRESHOLD_POINTS. */
export function isPowerUnit(unitId: string): boolean {
  const unit = getUnitById(unitId);
  return !!unit && unit.points > CAMPAIGN_POWER_THRESHOLD_POINTS;
}

/** Counts how many power units (see isPowerUnit) are in a given roster/selection. */
export function countPowerUnits(unitIds: string[]): number {
  return unitIds.filter(isPowerUnit).length;
}

/** Sums the points cost of a given roster/selection - unresolvable ids contribute 0 rather than throwing, matching the app's general "degrade gracefully on bad data" stance elsewhere. */
export function totalPoints(unitIds: string[]): number {
  return unitIds.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
}

export interface CampaignAddCheckResult {
  allowed: boolean;
  /** Present only when allowed is false - a short, user-facing reason. */
  reason?: string;
}

/**
 * Checks whether `candidateUnitId` can be added to a starting roster
 * currently made up of `currentUnitIds`, without exceeding the pool size,
 * points cap, or power-unit cap. Mirrors armyBuilderStore.addUnit's own
 * "check before adding" shape (duplicate check, points check, size
 * check), plus the campaign-specific power-unit check - intended to back
 * the same kind of live "is Add enabled for this unit" UI armyBuilderStore
 * already drives, without this module needing to know about that store.
 */
export function canAddToCampaignRoster(
  currentUnitIds: string[],
  candidateUnitId: string,
  {
    poolSize = CAMPAIGN_STARTING_POOL_SIZE,
    pointsCap = CAMPAIGN_STARTING_POINTS_CAP,
    maxPowerUnits = CAMPAIGN_MAX_POWER_UNITS,
  }: { poolSize?: number; pointsCap?: number; maxPowerUnits?: number } = {},
): CampaignAddCheckResult {
  if (currentUnitIds.includes(candidateUnitId)) {
    return { allowed: false, reason: 'That unit is already in your roster.' };
  }
  if (currentUnitIds.length >= poolSize) {
    return { allowed: false, reason: `Your starting roster is already full (${poolSize} units).` };
  }

  const candidate = getUnitById(candidateUnitId);
  if (!candidate) {
    return { allowed: false, reason: 'Unknown unit.' };
  }

  if (totalPoints(currentUnitIds) + candidate.points > pointsCap) {
    return { allowed: false, reason: `Adding this unit would exceed the ${pointsCap}pt limit.` };
  }

  if (isPowerUnit(candidateUnitId) && countPowerUnits(currentUnitIds) >= maxPowerUnits) {
    return {
      allowed: false,
      reason: `Your roster already has the maximum ${maxPowerUnits} units over ${CAMPAIGN_POWER_THRESHOLD_POINTS}pts.`,
    };
  }

  return { allowed: true };
}

export interface CampaignRosterValidation {
  valid: boolean;
  /** Every reason the roster is currently invalid, if any - empty when valid is true. */
  reasons: string[];
}

/**
 * Validates a COMPLETE starting roster (not a single add) against pool
 * size (exact, not "at least" - matches series mode's own
 * requiredArmySize convention), points cap, and power-unit cap. Returns
 * every violated rule at once (not just the first) so a UI can surface
 * everything wrong in one pass rather than one error at a time.
 */
export function validateCampaignStartingRoster(
  unitIds: string[],
  {
    poolSize = CAMPAIGN_STARTING_POOL_SIZE,
    pointsCap = CAMPAIGN_STARTING_POINTS_CAP,
    maxPowerUnits = CAMPAIGN_MAX_POWER_UNITS,
  }: { poolSize?: number; pointsCap?: number; maxPowerUnits?: number } = {},
): CampaignRosterValidation {
  const reasons: string[] = [];

  if (unitIds.length !== poolSize) {
    reasons.push(`Your starting roster must be exactly ${poolSize} units (currently ${unitIds.length}).`);
  }

  const spent = totalPoints(unitIds);
  if (spent > pointsCap) {
    reasons.push(`Your roster costs ${spent}pts, over the ${pointsCap}pt limit.`);
  }

  const powerCount = countPowerUnits(unitIds);
  if (powerCount > maxPowerUnits) {
    reasons.push(
      `Your roster has ${powerCount} units over ${CAMPAIGN_POWER_THRESHOLD_POINTS}pts - only ${maxPowerUnits} allowed.`,
    );
  }

  return { valid: reasons.length === 0, reasons };
}