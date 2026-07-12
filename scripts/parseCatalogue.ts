/**
 * Parses the Master Catalogue sheet of the source MFM workbook into
 * normalized intermediate unit records - one step in the data pipeline
 * (data/source/*.xlsx -> parseCatalogue -> statCurve -> build-data ->
 * src/data/*.generated.json). This module does NOT assign card stats or a
 * points-to-stat budget (see scripts/statCurve.ts for that); it only
 * normalizes what the spreadsheet directly gives us: identity,
 * classification, and points cost.
 *
 * Faction rollup: several Space Marine chapters (Blood Angels, Dark Angels,
 * Space Wolves, Black Templars, Deathwatch) are modelled as their own
 * top-level "Faction" values in the source workbook, each holding only
 * their chapter-unique units (verified directly against the workbook - see
 * ROADMAP.md Section 4.2). In-game we want these grouped under the parent
 * "Space Marines" faction (for card colour/template) with the chapter
 * surfaced separately as `subfaction` (for army-builder roster filtering).
 *
 * Row exclusion: a row is dropped from v1 data if it's missing an essential
 * field, or if its Verification Status doesn't match one of the accepted
 * phrasings in VERIFIED_STATUS_SUBSTRINGS below (i.e. no confirmed points
 * value) - see ROADMAP.md Section 4.4.
 */
import XLSX from 'xlsx';

const SHEET_NAME = 'Master Catalogue';
/**
 * Verification-status phrasings that indicate a row's points are actually
 * confirmed from a real source (and so should be included) - a row whose
 * status matches neither gets dropped (see this file's header). Two
 * phrasings exist because the workbook was built up over two separate
 * verification passes: the original MFM v2.3 sweep ("Matched to
 * Munitorum Field Manual v2.3"), and a later addition of newer units
 * sourced from MFM v4.1 ("Added from current Munitorum Field Manual v4.1
 * (non-Legends)"). A real, reachable data bug: checking only for
 * "Matched" silently dropped all 307 rows from that second pass - each
 * with a confirmed points value and its own Source URL, so there was no
 * actual reason to exclude them. "Not found in uploaded PDF" rows
 * (genuinely no confirmed points source) are deliberately NOT in this
 * list and stay excluded either way.
 */
const VERIFIED_STATUS_SUBSTRINGS = ['Matched', 'Added from current Munitorum Field Manual'];

/** Space Marine chapter factions that roll up under the parent "Space Marines" faction. */
const CHAPTER_ROLLUP: Record<string, string> = {
  'Blood Angels': 'Space Marines',
  'Dark Angels': 'Space Marines',
  'Space Wolves': 'Space Marines',
  'Black Templars': 'Space Marines',
  Deathwatch: 'Space Marines',
};

export interface RawCatalogueRow {
  Faction?: string;
  'Subfaction/Chapter'?: string;
  'Battlefield Role'?: string;
  'Unit Type'?: string;
  'Unit Name'?: string;
  Models?: string | number;
  'Keywords / Tags'?: string;
  Points?: number;
  'Verification Status'?: string;
}

/** A unit record after normalization, BEFORE stat-curve assignment (see statCurve.ts). */
export interface NormalizedUnit {
  id: string;
  name: string;
  faction: string;
  subfaction?: string;
  battlefieldRole: string;
  unitType: string;
  models?: string;
  keywords: string[];
  points: number;
}

/** Converts a unit/faction name into a URL/filename-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Parses a single raw spreadsheet row into a NormalizedUnit, or returns
 * null if the row should be excluded from v1 data. Kept as a pure function,
 * independent of xlsx file I/O, so it can be unit tested directly against
 * plain objects rather than needing a real workbook on disk.
 */
export function parseRow(row: RawCatalogueRow): NormalizedUnit | null {
  const name = row['Unit Name']?.trim();
  const rawFaction = row.Faction?.trim();
  const battlefieldRole = row['Battlefield Role']?.trim();
  const unitType = row['Unit Type']?.trim();
  const points = row.Points;
  const verification = row['Verification Status'] ?? '';

  if (!name || !rawFaction || !battlefieldRole || !unitType) return null;
  if (typeof points !== 'number' || Number.isNaN(points) || points <= 0) return null;
  if (!VERIFIED_STATUS_SUBSTRINGS.some((s) => verification.includes(s))) return null;

  const faction = CHAPTER_ROLLUP[rawFaction] ?? rawFaction;
  const subfaction = CHAPTER_ROLLUP[rawFaction]
    ? rawFaction
    : row['Subfaction/Chapter']?.trim() || undefined;

  return {
    id: slugify(name),
    name,
    faction,
    subfaction,
    battlefieldRole,
    unitType,
    models: row.Models !== undefined ? String(row.Models).trim() : undefined,
    keywords: parseKeywords(row['Keywords / Tags']),
    points,
  };
}

/** Reads the Master Catalogue sheet from the workbook at `filePath` and normalizes every row. */
export function parseCatalogue(filePath: string): NormalizedUnit[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${filePath}`);
  }
  const rows = XLSX.utils.sheet_to_json<RawCatalogueRow>(sheet);
  return rows.map(parseRow).filter((u): u is NormalizedUnit => u !== null);
}