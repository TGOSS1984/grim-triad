import { describe, it, expect } from 'vitest';
import {
  getUnitsForRoster,
  getFactionSlugForRosterName,
  inferRosterNameFromUnitIds,
  getUnitById,
} from './activeFactions';

describe('getUnitsForRoster', () => {
  it("includes a Space Marine chapter's own dedicated units", () => {
    const units = getUnitsForRoster('Blood Angels');
    const ownUnit = units.find((u) => u.id === 'blood-angels-astorath');
    expect(ownUnit).toBeDefined();
  });

  it('unions in the shared generic Space Marines pool for a chapter roster', () => {
    const units = getUnitsForRoster('Blood Angels');
    const genericUnit = units.find((u) => u.faction === 'Space Marines' && !u.subfaction);
    expect(genericUnit).toBeDefined();
  });

  it("gives every Space Marine chapter the SAME generic pool size on top of its own units", () => {
    const genericCount = (rosterName: string) =>
      getUnitsForRoster(rosterName).filter((u) => u.faction === 'Space Marines' && !u.subfaction)
        .length;

    const bloodAngelsGeneric = genericCount('Blood Angels');
    const darkAngelsGeneric = genericCount('Dark Angels');

    expect(bloodAngelsGeneric).toBeGreaterThan(0);
    expect(bloodAngelsGeneric).toBe(darkAngelsGeneric);
  });

  it('does NOT union the generic pool into a non-Space-Marine faction (e.g. Necrons)', () => {
    const units = getUnitsForRoster('Necrons');
    const genericSmUnit = units.find((u) => u.faction === 'Space Marines');
    expect(genericSmUnit).toBeUndefined();
  });

  it('does not duplicate a chapter unit that also happens to be in the roster twice', () => {
    const units = getUnitsForRoster('Blood Angels');
    const ids = units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns an empty array for an unknown roster name', () => {
    expect(getUnitsForRoster('Not A Real Roster')).toEqual([]);
  });
});

describe('getFactionSlugForRosterName', () => {
  it('resolves a known roster name to its slug', () => {
    expect(getFactionSlugForRosterName('Blood Angels')).toBe('blood-angels');
  });

  it('returns undefined for an unknown roster name', () => {
    expect(getFactionSlugForRosterName('Not A Real Roster')).toBeUndefined();
  });
});

describe('inferRosterNameFromUnitIds', () => {
  it("infers a Space Marine chapter's name from a chapter-specific unit id, even mixed with generic ones", () => {
    const genericUnit = getUnitById('space-marines-apothecary');
    expect(genericUnit).toBeDefined(); // sanity check the fixture id is real

    const inferred = inferRosterNameFromUnitIds([
      'space-marines-apothecary',
      'blood-angels-astorath',
    ]);
    expect(inferred).toBe('Blood Angels');
  });

  it('falls back to the top-level faction when no unit has a subfaction (single-faction army)', () => {
    const inferred = inferRosterNameFromUnitIds(['necrons-lychguard']);
    expect(inferred).toBe('Necrons');
  });

  it('returns undefined for an empty or entirely-unresolvable list', () => {
    expect(inferRosterNameFromUnitIds([])).toBeUndefined();
    expect(inferRosterNameFromUnitIds(['not-a-real-id'])).toBeUndefined();
  });

  it('skips unresolvable ids and still infers from a later valid one', () => {
    const inferred = inferRosterNameFromUnitIds(['not-a-real-id', 'necrons-lychguard']);
    expect(inferred).toBe('Necrons');
  });
});