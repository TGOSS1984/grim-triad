/**
 * The pool of Elemental terrain/affinity types, 40k-themed. Deliberately
 * kept as a small, separate file from src/data/elements.ts (its runtime
 * counterpart with display labels) rather than shared directly - scripts/
 * and src/ are separate TypeScript project boundaries (see tsconfig.node.json
 * vs tsconfig.json), same reasoning as CardStats being duplicated between
 * statCurve.ts and engine/types.ts. If this list ever changes, update both.
 */
export const ELEMENT_IDS = ['warp', 'promethium', 'void', 'toxic', 'radiation'] as const;

export type ElementId = (typeof ELEMENT_IDS)[number];