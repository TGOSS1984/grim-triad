/**
 * Runtime validation schema for the generated unit/faction JSON
 * (src/data/units.generated.json, src/data/factions.generated.json).
 *
 * Why zod, and why here: the data pipeline (scripts/build-data.ts) parses a
 * human-maintained Excel workbook - it's easy for a stray blank cell, typo,
 * or renamed column to slip through silently. Validating the OUTPUT against
 * this schema at build time (and again at app startup in dev) means a bad
 * row fails loudly with a clear error instead of quietly breaking a card
 * somewhere in the UI. This schema is intentionally a close mirror of
 * engine/types.ts's shapes, but kept separate: engine/types.ts is the
 * compile-time contract the game logic is written against, this is the
 * runtime contract the data pipeline's output is checked against - the two
 * layers shouldn't casually import from each other.
 */
import { z } from 'zod';

export const battlefieldRoleSchema = z.enum([
  'Character',
  'Battleline',
  'Infantry',
  'Vehicle',
  'Monster',
  'Mounted',
  'Other',
]);

export const unitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  faction: z.string().min(1),
  subfaction: z.string().optional(),
  battlefieldRole: z.string().min(1),
  unitType: z.string().min(1),
  models: z.string().optional(),
  keywords: z.array(z.string()),
  points: z.number().int().positive(),
  statBudget: z.number().int().positive(),
  stats: z.object({
    top: z.number().int().min(1).max(10),
    bottom: z.number().int().min(1).max(10),
    left: z.number().int().min(1).max(10),
    right: z.number().int().min(1).max(10),
  }),
  element: z.string().optional(),
  portraitPath: z.string(),
});

export type Unit = z.infer<typeof unitSchema>;

export const factionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  colour: z.enum(['red', 'blue']),
  active: z.boolean(),
  unitCount: z.number().int().nonnegative(),
});

export type Faction = z.infer<typeof factionSchema>;

export const unitsFileSchema = z.array(unitSchema);
export const factionsFileSchema = z.array(factionSchema);