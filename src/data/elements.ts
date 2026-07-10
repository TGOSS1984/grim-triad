/**
 * The pool of Elemental terrain/affinity types, 40k-themed. Mirrors
 * scripts/elements.ts's ids (kept separate - see that file's header for
 * why) with the display label the UI needs added.
 */
export const ELEMENT_IDS = ['warp', 'promethium', 'void', 'toxic', 'radiation'] as const;

export type ElementId = (typeof ELEMENT_IDS)[number];

export interface ElementInfo {
  id: ElementId;
  label: string;
}

export const ELEMENTS: ElementInfo[] = [
  { id: 'warp', label: 'Warp' },
  { id: 'promethium', label: 'Promethium' },
  { id: 'void', label: 'Void' },
  { id: 'toxic', label: 'Toxic' },
  { id: 'radiation', label: 'Radiation' },
];