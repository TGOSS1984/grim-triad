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

/** The parent faction name generic, chapter-less Space Marine units are filed under in the source data. */
const SPACE_MARINES_PARENT_FACTION = 'Space Marines';

/**
 * True when a unit has no REAL subfaction distinct from its own top-level
 * faction. The source spreadsheet has used two different conventions for
 * this over time: leaving `subfaction` blank/absent entirely (older
 * exports), or - as of a later data edit - always populating it, with "no
 * real subfaction" represented as subfaction === faction (self-
 * referential, e.g. "Space Marines"/"Space Marines", "Necrons" units have
 * no subfaction key at all, "Salamanders"/"Salamanders" as its own
 * one-off roster). This checks for either convention, so a future
 * re-export using whichever pattern still works without a code change.
 */
function hasNoRealSubfaction(unit: Unit): boolean {
  return !unit.subfaction || unit.subfaction === unit.faction;
}

/**
 * All units belonging to a given roster (matches by subfaction, falling
 * back to faction) - PLUS, for a Space Marine chapter roster (Blood
 * Angels, Dark Angels, etc.), the shared pool of generic, chapter-less
 * Space Marine units.
 *
 * Why this union is needed: a chapter's own dedicated unit count is small
 * (Blood Angels: 13, Dark Angels: 12) compared to a single-faction army
 * like Necrons (46) - real Warhammer 40K chapters share the vast bulk of
 * their roster (Tactical Squads, Rhinos, generic Captains, etc.) with
 * every other chapter, with only a handful of named characters/units
 * being chapter-specific. The data already reflects this: ~70 generic
 * units exist under `faction: 'Space Marines'` with no real subfaction of
 * their own (see hasNoRealSubfaction above), each with its OWN portrait
 * art already in place - no image duplication needed, every unit still
 * points at its own existing asset. This function is the only place that
 * union needs to happen; everything downstream (army builder,
 * matchSetup) just calls this and gets a complete roster.
 *
 * Detecting "is this a Space Marine chapter roster" is done from the UNIT
 * data itself (any unit with subfaction === rosterName whose OWN faction
 * is 'Space Marines'), not a separate flag on the Faction record - avoids
 * needing to touch the generated faction JSON or the data pipeline at all
 * for this fix.
 */
export function getUnitsForRoster(rosterName: string): Unit[] {
  const own = ALL_UNITS.filter((u) => (u.subfaction ?? u.faction) === rosterName);
  const isSpaceMarineChapter = own.some(
    (u) =>
      u.faction === SPACE_MARINES_PARENT_FACTION &&
      u.subfaction === rosterName &&
      !hasNoRealSubfaction(u),
  );
  if (!isSpaceMarineChapter) return own;

  const generic = ALL_UNITS.filter(
    (u) => u.faction === SPACE_MARINES_PARENT_FACTION && hasNoRealSubfaction(u),
  );
  return [...own, ...generic];
}

export function getFactionBySlug(slug: string): Faction | undefined {
  return ALL_FACTIONS.find((f) => f.slug === slug);
}

/**
 * O(1) lookup from a unit's id back to its full data - built once at
 * module load. Used wherever a live engine Card (which only carries
 * unitId + stats + owner, not display info) needs to be resolved back to
 * a name/portrait for rendering, e.g. GameScreen mapping board/hand cards
 * to what Board/Hand actually display. A per-render .find() over ~800
 * units would work but there's no reason to pay that cost repeatedly when
 * the mapping never changes after load.
 */
const UNITS_BY_ID = new Map<string, Unit>(ALL_UNITS.map((u) => [u.id, u]));

export function getUnitById(unitId: string): Unit | undefined {
  return UNITS_BY_ID.get(unitId);
}

/** O(1) lookup from a roster name (e.g. "Blood Angels") to its slug - built once at module load, same reasoning as UNITS_BY_ID above. */
const FACTION_SLUG_BY_ROSTER_NAME = new Map<string, string>(
  ALL_FACTIONS.map((f) => [f.name, f.slug]),
);

/**
 * Resolves a unit back to its roster's icon slug (e.g. "blood-angels"),
 * for anywhere the UI needs to show that faction's logo alongside a card
 * whose only display data is the unit itself - see CardBack, which shows
 * the owning faction's logo centered on a face-down card.
 */
export function getFactionSlugForUnit(unit: Unit): string | undefined {
  const rosterName = unit.subfaction ?? unit.faction;
  return FACTION_SLUG_BY_ROSTER_NAME.get(rosterName);
}

/**
 * Resolves a roster/chapter NAME (e.g. "Blood Angels", as stored in
 * armyBuilderStore.rosterName) directly to its faction slug - the same
 * lookup getFactionSlugForUnit does internally, exposed for callers that
 * already know the roster name up front (matchSetup.ts stamping
 * Card.rosterFactionSlug) rather than starting from a specific unit.
 */
export function getFactionSlugForRosterName(rosterName: string): string | undefined {
  return FACTION_SLUG_BY_ROSTER_NAME.get(rosterName);
}

/**
 * Infers which roster an AI-generated unit id list (from
 * matchSetup.buildRandomAIRoster) was actually drawn for, WITHOUT
 * changing that function's return type (kept as a plain string[] - a
 * shape change there would ripple through a large existing test suite for
 * no real benefit when this can be derived after the fact instead).
 *
 * Prefers the first unit with its own subfaction (e.g. "Blood Angels") -
 * correctly identifies a Space Marine chapter roster even though its unit
 * list is now a mix of chapter-specific and generic Space Marine units
 * (see getUnitsForRoster above). Falls back to the first resolvable
 * unit's own top-level faction, which is already correct for any
 * single-faction army (Necrons, Tyranids, etc. never have a subfaction at
 * all) and is still a reasonable answer in the rare case an AI roster
 * happened to draw zero chapter-specific units.
 */
export function inferRosterNameFromUnitIds(unitIds: string[]): string | undefined {
  let fallback: string | undefined;
  for (const id of unitIds) {
    const unit = getUnitById(id);
    if (!unit) continue;
    if (!hasNoRealSubfaction(unit)) return unit.subfaction;
    if (!fallback) fallback = unit.faction;
  }
  return fallback;
}