/**
 * Converts a unit's points cost into card stats (top/bottom/left/right,
 * 1-10 where 10 = "A"). Two steps, kept as separate, independently testable
 * functions:
 *
 *  1. pointsToBudget: points (20-800 in the source data) -> a total stat
 *     budget (sum of all 4 sides). Uses a log curve so the common 20-300pt
 *     range spreads out meaningfully across the scale, while the rare
 *     400-800pt super-heavies compress into a tight "very strong but not
 *     absurd" band rather than blowing the scale out. See ROADMAP.md
 *     Section 4.1 for the worked examples this was designed against.
 *
 *  2. budgetToSides: distributes that budget unevenly across the 4 sides
 *     based on a randomly-chosen archetype (see below), so cards have
 *     personality rather than being 4 identical numbers.
 *
 * REVISION (post-playtest): the original version hard-coded WHICH sides
 * got the strong allocation per role (Character always favoured top,
 * Vehicle always favoured top+bottom, Beast always favoured top+left).
 * Across the whole dataset this meant top/bottom were structurally
 * stronger than left/right in 3 of 4 shapes, and right was never
 * specifically favoured by any shape - exactly the bias real playtesting
 * surfaced. This version instead randomly picks WHICH side (or pair of
 * sides) gets the strong allocation per card, so the advantage is spread
 * evenly across all four sides over the roster as a whole, while still
 * giving each card a genuine, sometimes-pronounced personality rather
 * than a uniformly mild lean. It also allows a deliberately weak
 * remaining side (a real risk/reward tradeoff on cheap cards) and a rare,
 * budget-scaled chance of a second maxed ("A") side on expensive cards.
 */
import type { NormalizedUnit } from './parseCatalogue';

/**
 * Mirrors src/engine/types.ts's CardStats shape. Deliberately NOT imported
 * from there: scripts/ and src/ are separate TypeScript project boundaries
 * (see tsconfig.node.json vs tsconfig.json), and the pipeline's real
 * contract with the engine is its generated JSON output - validated at
 * build time against src/data/schema.ts - not a shared compile-time type.
 */
export interface CardStats {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

type Side = keyof CardStats;
const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

/** A source of randomness, injectable for deterministic tests. Defaults to Math.random in production. */
export type Rng = () => number;

const MIN_POINTS = 20;
const MAX_POINTS = 800;
const MIN_BUDGET = 11;
const MAX_BUDGET = 37;
const MIN_SIDE = 1;
const MAX_SIDE = 10;

// Fit a log curve through (MIN_POINTS, MIN_BUDGET) and (MAX_POINTS, MAX_BUDGET).
const CURVE_SLOPE = (MAX_BUDGET - MIN_BUDGET) / (Math.log(MAX_POINTS) - Math.log(MIN_POINTS));
const CURVE_INTERCEPT = MIN_BUDGET - CURVE_SLOPE * Math.log(MIN_POINTS);

/**
 * Maps a points cost to a total stat budget (sum of all 4 card sides).
 * Points outside the [20, 800] range the curve was fit against are clamped
 * to it first, so an unexpectedly cheap/expensive future unit degrades
 * gracefully instead of producing a nonsensical or out-of-range budget.
 */
export function pointsToBudget(points: number): number {
  const clampedPoints = Math.max(MIN_POINTS, Math.min(MAX_POINTS, points));
  const raw = CURVE_SLOPE * Math.log(clampedPoints) + CURVE_INTERCEPT;
  return Math.round(Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, raw)));
}

export type StatArchetype = 'signature' | 'pair' | 'balanced';

/** All 6 ways to pick 2 of the 4 sides - deliberately includes top+bottom AND left+right as just two of six equally-likely options, not a favoured default. */
const ALL_PAIRS: [Side, Side][] = [
  ['top', 'bottom'],
  ['top', 'left'],
  ['top', 'right'],
  ['bottom', 'left'],
  ['bottom', 'right'],
  ['left', 'right'],
];

interface ArchetypeWeights {
  signature: number;
  pair: number;
  balanced: number;
}

/**
 * Role still flavours the ODDS of each archetype (a Character is more
 * often spiky, a Vehicle is more often a strong pair), but never which
 * specific side(s) - that's always randomized. This keeps role-appropriate
 * flavour on average without making every unit of a given role look the
 * same shape.
 */
const ROLE_ARCHETYPE_WEIGHTS: Record<string, ArchetypeWeights> = {
  character: { signature: 0.65, pair: 0.25, balanced: 0.1 },
  vehicle: { signature: 0.2, pair: 0.65, balanced: 0.15 },
  beast: { signature: 0.3, pair: 0.55, balanced: 0.15 },
  default: { signature: 0.2, pair: 0.25, balanced: 0.55 },
};

function roleCategoryForUnit(
  unit: Pick<NormalizedUnit, 'battlefieldRole' | 'unitType' | 'keywords'>,
): keyof typeof ROLE_ARCHETYPE_WEIGHTS {
  const isEpicHero = unit.keywords.some((k) => k.toLowerCase() === 'epic hero');
  if (isEpicHero || /character/i.test(unit.battlefieldRole)) return 'character';
  if (/vehicle|monster|walker|aircraft/i.test(unit.unitType)) return 'vehicle';
  if (/beast|mounted|bike|cavalry/i.test(unit.unitType)) return 'beast';
  return 'default';
}

/** Picks an archetype for a unit, weighted by role but otherwise random - see file header. */
export function shapeForUnit(
  unit: Pick<NormalizedUnit, 'battlefieldRole' | 'unitType' | 'keywords'>,
  rng: Rng = Math.random,
): StatArchetype {
  const weights = ROLE_ARCHETYPE_WEIGHTS[roleCategoryForUnit(unit)];
  const roll = rng();
  if (roll < weights.signature) return 'signature';
  if (roll < weights.signature + weights.pair) return 'pair';
  return 'balanced';
}

function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Converts a weight-per-side map into final integer stats summing to exactly `budget`, each in [1, 10]. Used for the 'balanced' archetype, which has no distinct "strong" side(s). */
function weightsToSides(weights: Record<Side, number>, budget: number): CardStats {
  const raw = SIDES.map((side) => budget * weights[side]);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = budget - floored.reduce((a, b) => a + b, 0);

  const fractional = raw.map((v, i) => ({ i, frac: v - floored[i] }));
  fractional.sort((a, b) => b.frac - a.frac);
  const values = [...floored];
  for (let k = 0; k < fractional.length && remainder > 0; k++) {
    values[fractional[k].i]++;
    remainder--;
  }

  const clamp = (v: number) => Math.max(MIN_SIDE, Math.min(MAX_SIDE, v));
  const clamped = values.map(clamp);
  let diff = budget - clamped.reduce((a, b) => a + b, 0);

  let guard = 0;
  while (diff !== 0 && guard < 100) {
    for (let i = 0; i < clamped.length && diff !== 0; i++) {
      if (diff > 0 && clamped[i] < MAX_SIDE) {
        clamped[i]++;
        diff--;
      } else if (diff < 0 && clamped[i] > MIN_SIDE) {
        clamped[i]--;
        diff++;
      }
    }
    guard++;
  }

  return { top: clamped[0], bottom: clamped[1], left: clamped[2], right: clamped[3] };
}

/**
 * Rare, budget-scaled chance of bumping a high-budget card's strongest
 * side up to the max (10/"A") even if the base allocation didn't reach
 * it - "for high-end cards we shouldn't worry about having 2xA's
 * (although sparingly)". Only applies above ~400pt-equivalent budgets
 * (32+), and the chance itself scales up gradually toward the very top of
 * the range rather than jumping straight to common. The bonus is funded by
 * trimming other sides (largest first) so the total still sums to budget.
 */
function maybeApplyDoubleMaxBonus(stats: CardStats, budget: number, rng: Rng): CardStats {
  const bonusChance = Math.max(0, Math.min(1, (budget - 32) / 8)) * 0.3;
  if (rng() >= bonusChance) return stats;

  const values: [Side, number][] = SIDES.map((s) => [s, stats[s]]);
  const candidates = values.filter(([, v]) => v < MAX_SIDE).sort((a, b) => b[1] - a[1]);
  if (candidates.length === 0) return stats; // already all maxed, nothing to do

  const [boostSide, boostValue] = candidates[0];
  const needed = MAX_SIDE - boostValue;

  const result: CardStats = { ...stats, [boostSide]: MAX_SIDE };
  const donors = SIDES.filter((s) => s !== boostSide).sort((a, b) => result[b] - result[a]);

  let remaining = needed;
  let guard = 0;
  while (remaining > 0 && guard < 100) {
    for (const side of donors) {
      if (remaining <= 0) break;
      if (result[side] > MIN_SIDE) {
        result[side]--;
        remaining--;
      }
    }
    guard++;
  }

  return result;
}

/**
 * Distributes `totalBudget` across exactly `sides`, using a wide random
 * jitter per side so the result can be genuinely unequal (a real weak
 * side, not just a mild dip) - not merely proportionally-equal shares.
 * Same largest-remainder + clamp/redistribute mechanics as weightsToSides,
 * but scoped to a specific subset of sides and a specific sub-budget, so
 * any redistribution needed here only ever has to move a handful of
 * points, not the large swings that used to flatten out intended
 * inequality when a single strong side's raw target vastly exceeded 10.
 */
function distributeAmongSides(sides: Side[], totalBudget: number, rng: Rng): Record<Side, number> {
  const jitters = sides.map(() => randomBetween(rng, 0.2, 1.8));
  const jitterTotal = jitters.reduce((a, b) => a + b, 0);
  const raw = sides.map((_, i) => totalBudget * (jitters[i] / jitterTotal));
  const floored = raw.map((v) => Math.floor(v));
  let remainder = totalBudget - floored.reduce((a, b) => a + b, 0);

  const fractional = raw.map((v, i) => ({ i, frac: v - floored[i] }));
  fractional.sort((a, b) => b.frac - a.frac);
  const values = [...floored];
  for (let k = 0; k < fractional.length && remainder > 0; k++) {
    values[fractional[k].i]++;
    remainder--;
  }

  const clamp = (v: number) => Math.max(MIN_SIDE, Math.min(MAX_SIDE, v));
  const clamped = values.map(clamp);
  let diff = totalBudget - clamped.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 100) {
    for (let i = 0; i < clamped.length && diff !== 0; i++) {
      if (diff > 0 && clamped[i] < MAX_SIDE) {
        clamped[i]++;
        diff--;
      } else if (diff < 0 && clamped[i] > MIN_SIDE) {
        clamped[i]--;
        diff++;
      }
    }
    guard++;
  }

  const result = {} as Record<Side, number>;
  sides.forEach((s, i) => {
    result[s] = clamped[i];
  });
  return result;
}

/**
 * Distributes `budget` across the 4 sides according to `archetype`,
 * randomizing which side(s) get the strong allocation (see file header
 * for why this matters), guaranteeing the sides sum to exactly `budget`
 * and each stays within [1, 10].
 *
 * Two-stage for 'signature'/'pair': the strong side(s) get a target value
 * directly (rounded and clamped to [1, 10]) BEFORE any redistribution
 * happens, and only the genuine leftover budget is distributed among the
 * remaining sides. This avoids the old single-pass approach, where a
 * strong side's raw fractional target could vastly exceed 10 (e.g. 21.5
 * at a high budget), and dumping that much overflow onto the other sides
 * via round-robin both erased intended inequality AND made a second side
 * hit the max almost as often as the "rare" bonus was meant to.
 */
export function budgetToSides(
  budget: number,
  archetype: StatArchetype,
  rng: Rng = Math.random,
): CardStats {
  if (archetype === 'balanced') {
    // Mild multiplicative jitter around an equal split - even "balanced"
    // units get some texture, without a dramatic spike.
    const jitters = SIDES.map(() => randomBetween(rng, 0.86, 1.14));
    const jitterTotal = jitters.reduce((a, b) => a + b, 0);
    const weights = {} as Record<Side, number>;
    SIDES.forEach((s, i) => {
      weights[s] = jitters[i] / jitterTotal;
    });
    return maybeApplyDoubleMaxBonus(weightsToSides(weights, budget), budget, rng);
  }

  const strongSides: Side[] =
    archetype === 'signature'
      ? [SIDES[Math.floor(rng() * SIDES.length)]]
      : ALL_PAIRS[Math.floor(rng() * ALL_PAIRS.length)];
  const fractionRange: [number, number] = archetype === 'signature' ? [0.4, 0.58] : [0.24, 0.36];

  const values: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  let usedBudget = 0;
  for (const side of strongSides) {
    const target = Math.max(
      MIN_SIDE,
      Math.min(MAX_SIDE, Math.round(randomBetween(rng, fractionRange[0], fractionRange[1]) * budget)),
    );
    values[side] = target;
    usedBudget += target;
  }

  const remainingSides = SIDES.filter((s) => !strongSides.includes(s));
  let remainingBudget = budget - usedBudget;

  // Defensive guard: with the fraction ranges and budget bounds [11, 37]
  // this shouldn't actually be reachable, but if it ever were, nudge the
  // last strong side rather than let the remainder fall outside what
  // remainingSides can represent (each must stay within [1, 10]).
  const minPossible = remainingSides.length * MIN_SIDE;
  const maxPossible = remainingSides.length * MAX_SIDE;
  if (remainingBudget < minPossible) {
    const deficit = minPossible - remainingBudget;
    const lastStrong = strongSides[strongSides.length - 1];
    values[lastStrong] = Math.max(MIN_SIDE, values[lastStrong] - deficit);
    remainingBudget = budget - strongSides.reduce((sum, s) => sum + values[s], 0);
  } else if (remainingBudget > maxPossible) {
    const excess = remainingBudget - maxPossible;
    const lastStrong = strongSides[strongSides.length - 1];
    values[lastStrong] = Math.min(MAX_SIDE, values[lastStrong] + excess);
    remainingBudget = budget - strongSides.reduce((sum, s) => sum + values[s], 0);
  }

  const remainingValues = distributeAmongSides(remainingSides, remainingBudget, rng);
  for (const s of remainingSides) values[s] = remainingValues[s];

  return maybeApplyDoubleMaxBonus(values, budget, rng);
}

/** Convenience: derives both the stat budget and the final 4-side stats for a unit. */
export function deriveCardStats(
  unit: Pick<NormalizedUnit, 'points' | 'battlefieldRole' | 'unitType' | 'keywords'>,
  rng: Rng = Math.random,
): { statBudget: number; stats: CardStats } {
  const statBudget = pointsToBudget(unit.points);
  const stats = budgetToSides(statBudget, shapeForUnit(unit, rng), rng);
  return { statBudget, stats };
}