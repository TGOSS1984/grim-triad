import { describe, it, expect, beforeEach } from 'vitest';
import { useArmyBuilderStore } from './armyBuilderStore';

// Real generated Blood Angels units (see src/data/units.generated.json),
// cheapest-first, used as concrete fixtures so this store is tested against
// the actual data shape it will run against in the app.
const CAPTAIN = 'blood-angels-blood-angels-captain'; // 80pts
const DEATH_COMPANY = 'blood-angels-death-company-marines'; // 85pts

beforeEach(() => {
  useArmyBuilderStore.getState().reset();
});

describe('selectRoster', () => {
  it('sets the roster name and clears any prior selection', () => {
    useArmyBuilderStore.getState().selectRoster('Blood Angels');
    expect(useArmyBuilderStore.getState().rosterName).toBe('Blood Angels');
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([]);
  });

  it('clears units selected under a previous roster when switching', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(1);

    store.selectRoster('Necrons');
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([]);
  });
});

describe('addUnit', () => {
  it('returns false and does nothing if no roster is selected', () => {
    useArmyBuilderStore.getState().setPointsCap(500);
    const result = useArmyBuilderStore.getState().addUnit(CAPTAIN);
    expect(result).toBe(false);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([]);
  });

  it('returns false and does nothing if no points cap is set', () => {
    useArmyBuilderStore.getState().selectRoster('Blood Angels');
    const result = useArmyBuilderStore.getState().addUnit(CAPTAIN);
    expect(result).toBe(false);
  });

  it('adds a valid unit within the points cap', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);

    const result = store.addUnit(CAPTAIN);

    expect(result).toBe(true);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
    expect(useArmyBuilderStore.getState().totalPoints()).toBe(80);
  });

  it('rejects a unit that would exceed the points cap', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    // Stack cheap units close to the 500 cap: 80+85+90+105+110 = 470.
    store.addUnit(CAPTAIN);
    store.addUnit(DEATH_COMPANY);
    store.addUnit('blood-angels-sanguinary-priest'); // 90, total 255
    store.addUnit('blood-angels-astorath'); // 105, total 360
    store.addUnit('blood-angels-lemartes'); // 110, total 470

    // Commander Dante is 130pts - would push total to 600, over the 500 cap.
    const result = store.addUnit('blood-angels-commander-dante');

    expect(result).toBe(false);
    expect(useArmyBuilderStore.getState().totalPoints()).toBe(470);
  });

  it('rejects adding the same unit twice', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);

    const result = store.addUnit(CAPTAIN);

    expect(result).toBe(false);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
  });

  it('rejects a unit id that does not exist in the current roster', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);

    const result = store.addUnit('not-a-real-unit-id');

    expect(result).toBe(false);
  });
});

describe('removeUnit', () => {
  it('removes a previously added unit', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);
    store.addUnit(DEATH_COMPANY);

    store.removeUnit(CAPTAIN);

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([DEATH_COMPANY]);
  });

  it('does nothing if the unit was not selected', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);

    store.removeUnit(DEATH_COMPANY);

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
  });
});

describe('setPointsCap', () => {
  it('trims the most recently added units if lowering the cap invalidates the current spend', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.addUnit(CAPTAIN); // 80
    store.addUnit('blood-angels-death-company-dreadnought'); // 180, total 260
    store.addUnit('blood-angels-the-sanguinor'); // 140, total 400
    store.addUnit('blood-angels-chief-librarian-mephiston'); // 135, total 535

    store.setPointsCap(500); // valid v1 cap, below current 535 spend

    const { selectedUnitIds } = useArmyBuilderStore.getState();
    // Trimmed from the end (most recently added) until back under 500:
    // removing Mephiston (535 -> 400) is enough, so the first 3 remain.
    expect(selectedUnitIds).toEqual([
      CAPTAIN,
      'blood-angels-death-company-dreadnought',
      'blood-angels-the-sanguinor',
    ]);
    expect(useArmyBuilderStore.getState().totalPoints()).toBeLessThanOrEqual(500);
  });

  it('leaves the selection untouched if the new cap still covers current spend', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);

    store.setPointsCap(1000);

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
  });
});

describe('totalPoints / remainingPoints', () => {
  it('remainingPoints is null when no cap is set', () => {
    useArmyBuilderStore.getState().selectRoster('Blood Angels');
    expect(useArmyBuilderStore.getState().remainingPoints()).toBeNull();
  });

  it('remainingPoints reflects the cap minus total spent', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);
    store.addUnit(DEATH_COMPANY);

    expect(useArmyBuilderStore.getState().totalPoints()).toBe(165);
    expect(useArmyBuilderStore.getState().remainingPoints()).toBe(335);
  });
});

describe('selectedUnits / availableUnits', () => {
  it('selectedUnits returns full Unit objects for the selected ids', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);

    const units = useArmyBuilderStore.getState().selectedUnits();

    expect(units).toHaveLength(1);
    expect(units[0].id).toBe(CAPTAIN);
    expect(units[0].name).toBe('Blood Angels Captain');
  });

  it('availableUnits returns the full roster pool regardless of selection', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(500);
    store.addUnit(CAPTAIN);

    const available = useArmyBuilderStore.getState().availableUnits();

    expect(available.length).toBeGreaterThan(1);
    expect(available.some((u) => u.id === CAPTAIN)).toBe(true);
  });

  it('both return empty arrays when no roster is selected', () => {
    expect(useArmyBuilderStore.getState().selectedUnits()).toEqual([]);
    expect(useArmyBuilderStore.getState().availableUnits()).toEqual([]);
  });
});

describe('maxArmySize', () => {
  it('is null by default (single-match mode: no upper limit)', () => {
    expect(useArmyBuilderStore.getState().maxArmySize).toBeNull();
  });

  it('rejects adding a unit once at capacity, even if affordable', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.setMaxArmySize(2);
    store.addUnit(CAPTAIN);
    store.addUnit(DEATH_COMPANY);

    const result = store.addUnit('blood-angels-sanguinary-priest');

    expect(result).toBe(false);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(2);
  });

  it('allows adding up to exactly the configured maximum', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.setMaxArmySize(2);

    expect(store.addUnit(CAPTAIN)).toBe(true);
    expect(store.addUnit(DEATH_COMPANY)).toBe(true);
    expect(useArmyBuilderStore.getState().selectedUnitIds).toHaveLength(2);
  });

  it('trims the selection if the new max is lower than the current count', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.addUnit(CAPTAIN);
    store.addUnit(DEATH_COMPANY);
    store.addUnit('blood-angels-sanguinary-priest');

    store.setMaxArmySize(1);

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
  });

  it('does not trim anything if the new max still covers the current count', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.addUnit(CAPTAIN);

    store.setMaxArmySize(5);

    expect(useArmyBuilderStore.getState().selectedUnitIds).toEqual([CAPTAIN]);
  });

  it('setting max back to null removes the upper limit', () => {
    const store = useArmyBuilderStore.getState();
    store.selectRoster('Blood Angels');
    store.setPointsCap(2000);
    store.setMaxArmySize(1);
    store.addUnit(CAPTAIN);

    store.setMaxArmySize(null);

    expect(store.addUnit(DEATH_COMPANY)).toBe(true);
  });

  it('reset clears maxArmySize back to null', () => {
    const store = useArmyBuilderStore.getState();
    store.setMaxArmySize(15);

    store.reset();

    expect(useArmyBuilderStore.getState().maxArmySize).toBeNull();
  });
});