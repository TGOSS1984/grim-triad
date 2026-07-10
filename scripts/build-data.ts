/**
 * The data pipeline entry point. Run via `npm run build:data`.
 *
 * data/source/*.xlsx --[parseCatalogue]--> NormalizedUnit[]
 *                     --[statCurve]------> + statBudget/stats per unit
 *                     --[this file]------> src/data/units.generated.json
 *                                          src/data/factions.generated.json
 *
 * "Faction" in the generated output means a SELECTABLE ARMY ROSTER, not
 * always a raw top-level Faction column value: Space Marine chapters with
 * their own unit pool (Blood Angels, Dark Angels, Space Wolves, Black
 * Templars, Deathwatch) are rolled up under the parent "Space Marines"
 * faction by parseCatalogue.ts, with the chapter surfaced as `subfaction`.
 * A roster is keyed by `subfaction ?? faction`, so "Blood Angels" appears
 * as its own selectable roster (its chapter-unique units) while the base
 * "Space Marines" pool remains separately selectable too - see
 * ROADMAP.md Section 4.2 for the full rationale.
 *
 * NOTE on validation: src/data/schema.ts's zod schemas are the runtime
 * contract for this generated JSON, but are deliberately NOT imported here.
 * scripts/ and src/ are separate TypeScript project boundaries (see
 * tsconfig.node.json vs tsconfig.json - the same reasoning as statCurve.ts
 * defining its own CardStats shape rather than importing the engine's).
 * Validation against schema.ts happens where the app actually loads this
 * JSON, catching any drift between the pipeline's output and the engine's
 * expectations at the point that matters - app startup - rather than only
 * at generation time.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalogue, slugify, type NormalizedUnit } from './parseCatalogue';
import { deriveCardStats, type CardStats, type Rng } from './statCurve';
import { ELEMENT_IDS, type ElementId } from './elements';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_WORKBOOK = path.resolve(
  __dirname,
  '../data/source/Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx',
);
const UNITS_OUTPUT = path.resolve(__dirname, '../src/data/units.generated.json');
const FACTIONS_OUTPUT = path.resolve(__dirname, '../src/data/factions.generated.json');

/** v1 rosters selectable in the UI; every other roster is generated but held inactive. */
export const ACTIVE_ROSTER_NAMES = ['Blood Angels', 'Tyranids', 'Necrons', 'Aeldari'];

export interface GeneratedUnit {
  id: string;
  name: string;
  faction: string;
  subfaction?: string;
  battlefieldRole: string;
  unitType: string;
  models?: string;
  keywords: string[];
  points: number;
  statBudget: number;
  stats: CardStats;
  portraitPath: string;
  /** Elemental affinity (see scripts/elements.ts) - every unit gets one, uniformly at random. Without this, the Elemental rule's +1 "matching element" bonus could never fire, only its -1 penalty ever would. */
  element: ElementId;
}

export interface GeneratedFaction {
  slug: string;
  name: string;
  active: boolean;
  unitCount: number;
}

/** The roster a unit belongs to for army-builder/portrait-folder purposes. */
function rosterName(unit: Pick<NormalizedUnit, 'faction' | 'subfaction'>): string {
  return unit.subfaction ?? unit.faction;
}

function assignElement(rng: Rng): ElementId {
  return ELEMENT_IDS[Math.floor(rng() * ELEMENT_IDS.length)];
}

export function buildUnit(unit: NormalizedUnit, rng: Rng = Math.random): GeneratedUnit {
  const { statBudget, stats } = deriveCardStats(unit, rng);
  const rosterSlug = slugify(rosterName(unit));

  // A small number of units are legitimately shared across multiple
  // factions/rosters (e.g. "Khorne Lord of Skulls" is available to both
  // Chaos Space Marines and World Eaters) - parseCatalogue's `unit.id` is
  // just a name slug, so those collide. Prefixing with the roster slug
  // keeps the generated id globally unique without touching parseCatalogue
  // itself (that file's `id` remains a "unit name" concept; global
  // uniqueness is this module's responsibility, since only it knows about
  // rosters). Portrait filenames deliberately stay unprefixed - they're
  // already scoped by the roster folder in `portraitPath`, so two
  // factions sharing a unit name never collide on disk, and each faction
  // can have its own distinct portrait for the same unit if desired.
  const globalId = `${rosterSlug}-${unit.id}`;

  return {
    id: globalId,
    name: unit.name,
    faction: unit.faction,
    subfaction: unit.subfaction,
    battlefieldRole: unit.battlefieldRole,
    unitType: unit.unitType,
    models: unit.models,
    keywords: unit.keywords,
    points: unit.points,
    statBudget,
    stats,
    portraitPath: `assets/factions/${rosterSlug}/units/${unit.id}.png`,
    element: assignElement(rng),
  };
}

export function buildFactions(units: NormalizedUnit[]): GeneratedFaction[] {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const name = rosterName(unit);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, unitCount]) => ({
      slug: slugify(name),
      name,
      active: ACTIVE_ROSTER_NAMES.includes(name),
      unitCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function run(): void {
  const normalizedUnits = parseCatalogue(SOURCE_WORKBOOK);
  const units = normalizedUnits.map((u) => buildUnit(u));
  const factions = buildFactions(normalizedUnits);

  mkdirSync(path.dirname(UNITS_OUTPUT), { recursive: true });
  writeFileSync(UNITS_OUTPUT, JSON.stringify(units, null, 2));
  writeFileSync(FACTIONS_OUTPUT, JSON.stringify(factions, null, 2));

  const activeCount = factions.filter((f) => f.active).length;
  console.log(
    `Generated ${units.length} units across ${factions.length} rosters ` +
      `(${activeCount} active for v1) -> ${path.relative(process.cwd(), UNITS_OUTPUT)}, ` +
      `${path.relative(process.cwd(), FACTIONS_OUTPUT)}`,
  );
}

// Only run when executed directly (`npm run build:data`), not when imported
// by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}