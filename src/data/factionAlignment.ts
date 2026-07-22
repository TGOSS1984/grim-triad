/**
 * Which of the three 40k "alignments" (Imperium / Chaos / Xenos) each
 * faction belongs to, for grouping the faction selector into collapsible
 * sections (see FactionSelect.tsx).
 *
 * This is deliberately a small hand-maintained table here, NOT a field on
 * the generated Faction type in schema.ts / factions.generated.json: a
 * faction's alignment is fixed 40k taxonomy that doesn't come from - and
 * has no reason to live in - the Excel workbook build-data.ts parses. It
 * covers all 38 rosters in ALL_FACTIONS (see activeFactions.ts), not just
 * the ones currently active, so a newly-activated faction is already
 * grouped correctly the moment its `active` flag flips - no edit needed
 * here when that happens.
 *
 * If a new faction is ever added to the source data that isn't in this
 * table, factionOf() below falls back to 'Xenos' rather than throwing -
 * see its own comment for why.
 */
export type FactionAlignment = 'Imperium' | 'Chaos' | 'Xenos';

/** Display order for the group sections - Imperium, Chaos, Xenos. */
export const ALIGNMENT_ORDER: FactionAlignment[] = ['Imperium', 'Chaos', 'Xenos'];

const IMPERIUM_FACTIONS = new Set([
  'Adepta Sororitas',
  'Adeptus Custodes',
  'Adeptus Mechanicus',
  'Adeptus Titanicus',
  'Astra Militarum',
  'Black Templars',
  'Blood Angels',
  'Crimson Fists',
  'Dark Angels',
  'Deathwatch',
  'Grey Knights',
  'Imperial Agents',
  'Imperial Fists',
  'Imperial Knights',
  'Iron Hands',
  'Raven Guard',
  'Salamanders',
  'Space Marines',
  'Space Wolves',
  'Ultramarines',
  'White Scars',
]);

const CHAOS_FACTIONS = new Set([
  'Chaos Daemons',
  'Chaos Knights',
  'Chaos Space Marines',
  'Chaos Titan Legions',
  'Death Guard',
  "Emperor's Children",
  'Thousand Sons',
  'World Eaters',
]);

const XENOS_FACTIONS = new Set([
  'Aeldari',
  'Drukhari',
  'Genestealer Cults',
  'Harlequins',
  'Leagues of Votann',
  'Necrons',
  'Orks',
  "T'au Empire",
  'Tyranids',
]);

/**
 * Looks up a faction's alignment by its roster name (Faction.name - the
 * same selectable name FactionSelect already keys off). Falls back to
 * 'Xenos' for anything not in the three tables above (rather than
 * throwing) so a data-entry gap surfaces as "this faction is in the
 * wrong group" - visible and easy to spot/fix - instead of a hard crash
 * on the army builder screen.
 */
export function factionAlignmentOf(factionName: string): FactionAlignment {
  if (IMPERIUM_FACTIONS.has(factionName)) return 'Imperium';
  if (CHAOS_FACTIONS.has(factionName)) return 'Chaos';
  if (XENOS_FACTIONS.has(factionName)) return 'Xenos';
  return 'Xenos';
}