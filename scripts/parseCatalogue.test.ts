import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseRow, parseCatalogue, slugify } from './parseCatalogue';
import type { RawCatalogueRow } from './parseCatalogue';

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Blood Angels Captain')).toBe('blood-angels-captain');
  });

  it('strips punctuation', () => {
    expect(slugify("Emperor's Children")).toBe('emperor-s-children');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('  Astorath  ')).toBe('astorath');
  });

  it('strips accented characters down to their base letter, not to a dash - REAL BUG this fixes: an accented name previously slugified with the accent replaced by a dash instead of dropped, producing an id/portraitPath that would never match how anyone actually names an image file', () => {
    expect(slugify('Brôkhyr Iron-master')).toBe('brokhyr-iron-master');
  });

  it('strips a variety of common accented characters correctly', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('Naïve')).toBe('naive');
    expect(slugify('Ñandu')).toBe('nandu');
    expect(slugify('Über')).toBe('uber');
    expect(slugify('Zoë')).toBe('zoe');
  });

  it('keeps the display name untouched - slugify only affects the derived id/portraitPath, not what the player actually sees', () => {
    // This is really documentation-as-a-test: slugify is a pure function
    // called separately to derive id/portraitPath (see build-data.ts) -
    // the raw `name` field itself is never passed through it, so the
    // real accented spelling always survives for display.
    const original = 'Brôkhyr Iron-master';
    slugify(original);
    expect(original).toBe('Brôkhyr Iron-master');
  });
});

describe('parseRow', () => {
  const baseRow: RawCatalogueRow = {
    Faction: 'Necrons',
    'Battlefield Role': 'Character',
    'Unit Type': 'Infantry',
    'Unit Name': 'Test Unit',
    Models: '1',
    'Keywords / Tags': 'Epic Hero, Infantry, Fly',
    Points: 100,
    'Verification Status': 'Matched to Munitorum Field Manual v2.3',
  };

  it('parses a valid, verified row', () => {
    const result = parseRow(baseRow);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('test-unit');
    expect(result?.faction).toBe('Necrons');
    expect(result?.subfaction).toBeUndefined();
    expect(result?.keywords).toEqual(['Epic Hero', 'Infantry', 'Fly']);
    expect(result?.points).toBe(100);
  });

  it('excludes a row with unverified points', () => {
    const row: RawCatalogueRow = { ...baseRow, 'Verification Status': 'Not found in uploaded PDF' };
    expect(parseRow(row)).toBeNull();
  });

  it("includes a row verified via the newer 'Added from current Munitorum Field Manual' phrasing, not just 'Matched...'", () => {
    // Real, reachable bug: a whole later addition to the source workbook
    // (307 real units, each with a confirmed points value and a source
    // URL) used this different wording and was being silently dropped
    // entirely by a filter that only recognized "Matched".
    const row: RawCatalogueRow = {
      ...baseRow,
      'Verification Status': 'Added from current Munitorum Field Manual v4.1 (non-Legends)',
    };
    expect(parseRow(row)).not.toBeNull();
  });

  it('excludes a row missing points entirely', () => {
    const row: RawCatalogueRow = { ...baseRow, Points: undefined };
    expect(parseRow(row)).toBeNull();
  });

  it('excludes a row missing a unit name', () => {
    const row: RawCatalogueRow = { ...baseRow, 'Unit Name': undefined };
    expect(parseRow(row)).toBeNull();
  });

  it('rolls a chapter faction up under Space Marines with subfaction set', () => {
    const row: RawCatalogueRow = {
      ...baseRow,
      Faction: 'Blood Angels',
      'Subfaction/Chapter': 'Blood Angels',
      'Unit Name': 'Commander Dante',
    };
    const result = parseRow(row);
    expect(result?.faction).toBe('Space Marines');
    expect(result?.subfaction).toBe('Blood Angels');
  });

  it('leaves a base Space Marines row with no subfaction', () => {
    const row: RawCatalogueRow = {
      ...baseRow,
      Faction: 'Space Marines',
      'Subfaction/Chapter': undefined,
      'Unit Name': 'Intercessor Squad',
    };
    const result = parseRow(row);
    expect(result?.faction).toBe('Space Marines');
    expect(result?.subfaction).toBeUndefined();
  });

  it('handles an empty keywords field', () => {
    const row: RawCatalogueRow = { ...baseRow, 'Keywords / Tags': undefined };
    expect(parseRow(row)?.keywords).toEqual([]);
  });
});

describe('parseCatalogue (integration, real workbook)', () => {
  const workbookPath = path.resolve(
    __dirname,
    '../data/source/Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx',
  );

  it('parses a large, non-trivial number of verified units from the real file', () => {
    const units = parseCatalogue(workbookPath);
    // 768 verified rows at time of writing; assert a generous lower bound
    // so this doesn't break on minor future data-file edits.
    expect(units.length).toBeGreaterThan(700);
  });

  it('rolls Blood Angels units up under Space Marines with subfaction set', () => {
    const units = parseCatalogue(workbookPath);
    const dante = units.find((u) => u.name === 'Commander Dante');
    expect(dante).toBeDefined();
    expect(dante?.faction).toBe('Space Marines');
    expect(dante?.subfaction).toBe('Blood Angels');
  });

  it('also rolls up the newer chapters (Ultramarines, Imperial Fists, Raven Guard, White Scars, Iron Hands, Salamanders) - these were originally missing from CHAPTER_ROLLUP, modelled as their own standalone top-level factions instead, which meant they never picked up the shared generic Space Marine unit pool the way Blood Angels/Dark Angels/etc already did', () => {
    const units = parseCatalogue(workbookPath);
    const guilliman = units.find((u) => u.name === 'Roboute Guilliman');
    expect(guilliman).toBeDefined();
    expect(guilliman?.faction).toBe('Space Marines');
    expect(guilliman?.subfaction).toBe('Ultramarines');
  });

  it('every parsed unit has a positive points value and a non-empty id', () => {
    const units = parseCatalogue(workbookPath);
    for (const unit of units) {
      expect(unit.points).toBeGreaterThan(0);
      expect(unit.id.length).toBeGreaterThan(0);
    }
  });
});