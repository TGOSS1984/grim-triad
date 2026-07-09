/**
 * The application's single entry point for the generated 40k unit/faction
 * data. Two jobs:
 *
 *  1. Validates the generated JSON (produced by `npm run build:data`, see
 *     scripts/build-data.ts) against the runtime schema in schema.ts. This
 *     is where the validation promised in build-data.ts's header comment
 *     actually happens: at the point the app loads the data, not only at
 *     generation time - so any drift between the pipeline's output and the
 *     engine's expectations fails loudly on startup instead of silently
 *     breaking a card somewhere deep in the UI.
 *  2. Exports the v1 active-roster subset the UI should offer, plus small
 *     typed lookup helpers used by the army builder.
 */
import rawUnits from './units.generated.json';
import rawFactions from './factions.generated.json';
import { unitsFileSchema, factionsFileSchema, type Unit, type Faction } from './schema';

/** Every generated unit, validated against schema.ts at import time. */
export const ALL_UNITS: Unit[] = unitsFileSchema.parse(rawUnits);

/** Every generated roster (faction/chapter), validated against schema.ts. */
export const ALL_FACTIONS: Faction[] = factionsFileSchema.parse(rawFactions);

/**
 * Only the rosters selectable in the v1 UI (Blood Angels, Tyranids,
 * Necrons, Aeldari) - see ROADMAP.md Section 4.3. The remaining rosters
 * still exist in ALL_FACTIONS/ALL_UNITS, generated and ready, just not
 * offered yet.
 */
export const ACTIVE_FACTIONS: Faction[] = ALL_FACTIONS.filter((f) => f.active);

/** All units belonging to a given roster (matches by subfaction, falling back to faction). */
export function getUnitsForRoster(rosterName: string): Unit[] {
  return ALL_UNITS.filter((u) => (u.subfaction ?? u.faction) === rosterName);
}

export function getFactionBySlug(slug: string): Faction | undefined {
  return ALL_FACTIONS.find((f) => f.slug === slug);
}