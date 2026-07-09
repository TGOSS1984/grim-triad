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
 *     based on a "shape" derived from the unit's battlefield role/type, so
 *     cards have personality rather than being 4 identical numbers.
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

export type StatShape = 'frontLoaded' | 'hullHeavy' | 'balanced' | 'flanker';

/** Relative weight of each side for a given shape; must sum to 1. */
const SHAPE_WEIGHTS: Record<StatShape, CardStats> = {
  // Character/Epic Hero: strong on one signature side (top, by convention -
  // the side that "faces" an opponent placed above), weaker flanks.
  frontLoaded: { top: 0.34, bottom: 0.22, left: 0.22, right: 0.22 },
  // Vehicle/Monster/Super-heavy: hard to punch through head-on.
  hullHeavy: { top: 0.3, bottom: 0.3, left: 0.2, right: 0.2 },
  // Infantry/Battleline: no side far from the others.
  balanced: { top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 },
  // Beast/Mounted/Bike: mobile flanker, strong on two adjacent sides.
  flanker: { top: 0.3, bottom: 0.2, left: 0.3, right: 0.2 },
};

const SIDES: (keyof CardStats)[] = ['top', 'bottom', 'left', 'right'];

/**
 * Distributes `budget` across the 4 sides according to `shape`, clamping
 * every side to [1, 10] and guaranteeing the sides sum to exactly `budget`
 * (assuming budget is within the achievable range 4-40 for 4 sides of
 * 1-10; values from pointsToBudget always are).
 */
export function budgetToSides(budget: number, shape: StatShape): CardStats {
  const weights = SHAPE_WEIGHTS[shape];

  // Initial proportional allocation, floored.
  const raw = SIDES.map((side) => budget * weights[side]);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = budget - floored.reduce((a, b) => a + b, 0);

  // Distribute the rounding remainder to the sides with the largest
  // fractional part first (largest-remainder method).
  const fractional = raw.map((v, i) => ({ i, frac: v - floored[i] }));
  fractional.sort((a, b) => b.frac - a.frac);
  const values = [...floored];
  for (let k = 0; k < fractional.length && remainder > 0; k++) {
    values[fractional[k].i]++;
    remainder--;
  }

  // Clamp into [MIN_SIDE, MAX_SIDE], then redistribute any resulting
  // surplus/deficit so the total still sums to exactly `budget`.
  const clamp = (v: number) => Math.max(MIN_SIDE, Math.min(MAX_SIDE, v));
  const clamped = values.map(clamp);
  let diff = budget - clamped.reduce((a, b) => a + b, 0);

  // diff > 0: budget was clamped down somewhere, need to add it back
  //           to sides with headroom below MAX_SIDE.
  // diff < 0: budget was clamped up somewhere, need to remove it from
  //           sides with headroom above MIN_SIDE.
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

  return {
    top: clamped[0],
    bottom: clamped[1],
    left: clamped[2],
    right: clamped[3],
  };
}

/** Determines which stat-distribution shape applies to a unit. */
export function shapeForUnit(
  unit: Pick<NormalizedUnit, 'battlefieldRole' | 'unitType' | 'keywords'>,
): StatShape {
  const isEpicHero = unit.keywords.some((k) => k.toLowerCase() === 'epic hero');
  if (isEpicHero || /character/i.test(unit.battlefieldRole)) {
    return 'frontLoaded';
  }
  if (/vehicle|monster|walker|aircraft/i.test(unit.unitType)) {
    return 'hullHeavy';
  }
  if (/beast|mounted|bike|cavalry/i.test(unit.unitType)) {
    return 'flanker';
  }
  return 'balanced';
}

/** Convenience: derives both the stat budget and the final 4-side stats for a unit. */
export function deriveCardStats(
  unit: Pick<NormalizedUnit, 'points' | 'battlefieldRole' | 'unitType' | 'keywords'>,
): { statBudget: number; stats: CardStats } {
  const statBudget = pointsToBudget(unit.points);
  const stats = budgetToSides(statBudget, shapeForUnit(unit));
  return { statBudget, stats };
}