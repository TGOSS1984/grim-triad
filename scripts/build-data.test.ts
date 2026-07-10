import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { buildUnit, buildFactions, ACTIVE_ROSTER_NAMES } from './build-data';
import { parseCatalogue } from './parseCatalogue';
import type { NormalizedUnit } from './parseCatalogue';

function makeUnit(overrides: Partial<NormalizedUnit> = {}): NormalizedUnit {
  return {
    id: 'test-unit',
    name: 'Test Unit',
    faction: 'Necrons',
    subfaction: undefined,
    battlefieldRole: 'Infantry',
    unitType: 'Infantry',
    models: '1',
    keywords: [],
    points: 100,
    ...overrides,
  };
}

describe('buildUnit', () => {
  it('produces a globally-unique id prefixed by the roster slug', () => {
    const unit = buildUnit(makeUnit({ faction: 'Necrons', subfaction: undefined }));
    expect(unit.id).toBe('necrons-test-unit');
  });

  it('produces a portrait path scoped to the roster (faction) slug', () => {
    const unit = buildUnit(makeUnit({ faction: 'Necrons', subfaction: undefined }));
    expect(unit.portraitPath).toBe('assets/factions/necrons/units/test-unit.png');
  });

  it('scopes the portrait path to the subfaction when present, not the parent faction', () => {
    const unit = buildUnit(
      makeUnit({ faction: 'Space Marines', subfaction: 'Blood Angels', id: 'commander-dante' }),
    );
    expect(unit.portraitPath).toBe('assets/factions/blood-angels/units/commander-dante.png');
  });

  it('gives the same unit name a distinct global id in two different rosters', () => {
    const chaosVersion = buildUnit(
      makeUnit({ id: 'khorne-lord-of-skulls', faction: 'Chaos Space Marines', subfaction: undefined }),
    );
    const worldEatersVersion = buildUnit(
      makeUnit({ id: 'khorne-lord-of-skulls', faction: 'World Eaters', subfaction: undefined }),
    );
    expect(chaosVersion.id).not.toBe(worldEatersVersion.id);
  });

  it('attaches computed stats that sum to the statBudget', () => {
    const unit = buildUnit(makeUnit({ points: 150 }));
    const sum = unit.stats.top + unit.stats.bottom + unit.stats.left + unit.stats.right;
    expect(sum).toBe(unit.statBudget);
  });

  it('carries through identity and classification fields unchanged', () => {
    const unit = buildUnit(makeUnit({ name: 'Lychguard', keywords: ['Infantry', 'Necrons'] }));
    expect(unit.name).toBe('Lychguard');
    expect(unit.keywords).toEqual(['Infantry', 'Necrons']);
  });
});

describe('buildFactions', () => {
  it('groups units by roster (subfaction when present, else faction)', () => {
    const units: NormalizedUnit[] = [
      makeUnit({ faction: 'Necrons', subfaction: undefined }),
      makeUnit({ faction: 'Necrons', subfaction: undefined, id: 'unit-2' }),
      makeUnit({ faction: 'Space Marines', subfaction: 'Blood Angels', id: 'unit-3' }),
    ];

    const factions = buildFactions(units);

    const necrons = factions.find((f) => f.name === 'Necrons');
    const bloodAngels = factions.find((f) => f.name === 'Blood Angels');
    expect(necrons?.unitCount).toBe(2);
    expect(bloodAngels?.unitCount).toBe(1);
  });

  it('marks only the configured v1 rosters as active', () => {
    const units: NormalizedUnit[] = [
      makeUnit({ faction: 'Tyranids' }),
      makeUnit({ faction: 'Orks', id: 'unit-2' }),
    ];

    const factions = buildFactions(units);

    expect(factions.find((f) => f.name === 'Tyranids')?.active).toBe(true);
    expect(factions.find((f) => f.name === 'Orks')?.active).toBe(false);
  });
});

describe('build-data integration (real workbook)', () => {
  const workbookPath = path.resolve(
    __dirname,
    '../data/source/Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx',
  );

  it('generates units with no duplicate ids', () => {
    const normalizedUnits = parseCatalogue(workbookPath);
    const units = normalizedUnits.map((u) => buildUnit(u));
    const ids = units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every configured v1 active roster actually exists in the generated data', () => {
    const normalizedUnits = parseCatalogue(workbookPath);
    const factions = buildFactions(normalizedUnits);
    for (const rosterName of ACTIVE_ROSTER_NAMES) {
      const match = factions.find((f) => f.name === rosterName);
      expect(match, `expected an active roster named "${rosterName}"`).toBeDefined();
      expect(match!.unitCount).toBeGreaterThan(0);
    }
  });

  it('all generated factions/rosters have at least one unit', () => {
    const normalizedUnits = parseCatalogue(workbookPath);
    const factions = buildFactions(normalizedUnits);
    for (const faction of factions) {
      expect(faction.unitCount).toBeGreaterThan(0);
    }
  });
});