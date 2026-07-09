/**
 * The army-builder state layer: tracks which roster (faction/chapter) and
 * points cap (500/1000/2000) the player has chosen, and which units from
 * that roster they've added to their army, keeping total spent points
 * always within the cap.
 *
 * Scope note: this store only builds the player's full points-legal ARMY
 * POOL - it does not draw the 5-card match hand (that's a separate,
 * later concern: either manual hand-picking or the Random rule drawing
 * from this pool, see engine/rules/random.ts). Keeping these responsibilities
 * separate mirrors the real flow described in the brief: pick your army
 * first, then a 5-card hand comes from it each match.
 *
 * v1 simplification: each unit id can only be added once (a roster is a
 * set of distinct card types, not squad-quantity stacks) - documented here
 * as a deliberate scope decision, not an oversight.
 */
import { create } from 'zustand';
import { getUnitsForRoster } from '../data/activeFactions';
import type { Unit } from '../data/schema';

export type PointsCap = 500 | 1000 | 2000;

export interface ArmyBuilderState {
  rosterName: string | null;
  pointsCap: PointsCap | null;
  selectedUnitIds: string[];

  selectRoster: (rosterName: string) => void;
  setPointsCap: (cap: PointsCap) => void;
  /** Returns true if the unit was added; false if the action was invalid (see rules below). */
  addUnit: (unitId: string) => boolean;
  removeUnit: (unitId: string) => void;
  reset: () => void;

  totalPoints: () => number;
  remainingPoints: () => number | null;
  selectedUnits: () => Unit[];
  availableUnits: () => Unit[];
}

function unitById(rosterUnits: Unit[], unitId: string): Unit | undefined {
  return rosterUnits.find((u) => u.id === unitId);
}

export const useArmyBuilderStore = create<ArmyBuilderState>((set, get) => ({
  rosterName: null,
  pointsCap: null,
  selectedUnitIds: [],

  selectRoster: (rosterName) => {
    // Switching roster invalidates any prior selection - a valid army is
    // always drawn from a single roster (see ROADMAP.md Section 5).
    set({ rosterName, selectedUnitIds: [] });
  },

  setPointsCap: (cap) => {
    const { rosterName, selectedUnitIds } = get();
    const rosterUnits = rosterName ? getUnitsForRoster(rosterName) : [];

    // Lowering the cap below the current spend must not leave the store in
    // an invalid state (spent > cap) - trim the most recently added units
    // first until back under the new cap.
    const trimmed = [...selectedUnitIds];
    const spent = () =>
      trimmed.reduce((sum, id) => sum + (unitById(rosterUnits, id)?.points ?? 0), 0);
    while (trimmed.length > 0 && spent() > cap) {
      trimmed.pop();
    }

    set({ pointsCap: cap, selectedUnitIds: trimmed });
  },

  addUnit: (unitId) => {
    const { rosterName, pointsCap, selectedUnitIds } = get();
    if (!rosterName || pointsCap === null) return false;
    if (selectedUnitIds.includes(unitId)) return false;

    const rosterUnits = getUnitsForRoster(rosterName);
    const unit = unitById(rosterUnits, unitId);
    if (!unit) return false;

    const currentSpend = selectedUnitIds.reduce(
      (sum, id) => sum + (unitById(rosterUnits, id)?.points ?? 0),
      0,
    );
    if (currentSpend + unit.points > pointsCap) return false;

    set({ selectedUnitIds: [...selectedUnitIds, unitId] });
    return true;
  },

  removeUnit: (unitId) => {
    set((state) => ({
      selectedUnitIds: state.selectedUnitIds.filter((id) => id !== unitId),
    }));
  },

  reset: () => set({ rosterName: null, pointsCap: null, selectedUnitIds: [] }),

  totalPoints: () => {
    const { rosterName, selectedUnitIds } = get();
    if (!rosterName) return 0;
    const rosterUnits = getUnitsForRoster(rosterName);
    return selectedUnitIds.reduce((sum, id) => sum + (unitById(rosterUnits, id)?.points ?? 0), 0);
  },

  remainingPoints: () => {
    const { pointsCap } = get();
    if (pointsCap === null) return null;
    return pointsCap - get().totalPoints();
  },

  selectedUnits: () => {
    const { rosterName, selectedUnitIds } = get();
    if (!rosterName) return [];
    const rosterUnits = getUnitsForRoster(rosterName);
    return selectedUnitIds
      .map((id) => unitById(rosterUnits, id))
      .filter((u): u is Unit => u !== undefined);
  },

  availableUnits: () => {
    const { rosterName } = get();
    if (!rosterName) return [];
    return getUnitsForRoster(rosterName);
  },
}));