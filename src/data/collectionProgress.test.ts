import { describe, it, expect } from 'vitest';
import { ALL_UNITS } from './activeFactions';
import { getObtainableUnitIds, getCollectionProgress } from './collectionProgress';

describe('getObtainableUnitIds', () => {
  it('is strictly smaller than the full catalog, since some factions are inactive', () => {
    const obtainable = getObtainableUnitIds();
    expect(obtainable.size).toBeGreaterThan(0);
    expect(obtainable.size).toBeLessThan(ALL_UNITS.length);
  });

  it('includes a unit from an active faction (Necrons)', () => {
    const obtainable = getObtainableUnitIds();
    const necronUnit = ALL_UNITS.find((u) => u.faction === 'Necrons');
    expect(necronUnit).toBeDefined();
    expect(obtainable.has(necronUnit!.id)).toBe(true);
  });

  it('excludes a unit belonging only to an inactive faction (Adeptus Titanicus)', () => {
    const obtainable = getObtainableUnitIds();
    expect(obtainable.has('adeptus-titanicus-reaver-titan')).toBe(false);
  });
});

describe('getCollectionProgress', () => {
  it('counts distinct obtainable units owned, not raw collection length (duplicates)', () => {
    const necronUnit = ALL_UNITS.find((u) => u.faction === 'Necrons')!;
    const progress = getCollectionProgress([necronUnit.id, necronUnit.id, necronUnit.id]);

    expect(progress.owned).toBe(1);
  });

  it('does not count an inactive-faction unit toward owned progress, even if somehow in the collection', () => {
    const emptyProgress = getCollectionProgress([]);
    const withInactiveUnit = getCollectionProgress(['adeptus-titanicus-reaver-titan']);

    expect(withInactiveUnit.owned).toBe(emptyProgress.owned);
  });

  it('reports obtainable equal to getObtainableUnitIds().size', () => {
    const progress = getCollectionProgress([]);
    expect(progress.obtainable).toBe(getObtainableUnitIds().size);
  });

  it('is not complete with an empty collection', () => {
    expect(getCollectionProgress([]).isComplete).toBe(false);
  });

  it('is complete once every obtainable id is owned at least once', () => {
    const everything = Array.from(getObtainableUnitIds());
    expect(getCollectionProgress(everything).isComplete).toBe(true);
  });
});