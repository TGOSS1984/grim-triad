/**
 * Lists every unit in the currently-selected roster, letting the player
 * add/remove them from their army. Sorted cheapest-first so the roster
 * reads as a natural progression, matching how the army builder brief
 * described browsing "all available options and a points tally".
 */
import type { Unit } from '../../data/schema';
import styles from './UnitPicker.module.css';

export interface UnitPickerProps {
  units: Unit[];
  selectedIds: string[];
  /** Points left to spend; used to disable Add for anything unaffordable. Null = no cap chosen yet. */
  remainingPoints: number | null;
  onAdd: (unitId: string) => void;
  onRemove: (unitId: string) => void;
}

export function UnitPicker({ units, selectedIds, remainingPoints, onAdd, onRemove }: UnitPickerProps) {
  const sorted = [...units].sort((a, b) => a.points - b.points);
  const selectedSet = new Set(selectedIds);

  return (
    <ul className={styles.list} aria-label="Available units">
      {sorted.map((unit) => {
        const isSelected = selectedSet.has(unit.id);
        const affordable = remainingPoints !== null && unit.points <= remainingPoints;
        const canAdd = !isSelected && affordable;

        return (
          <li key={unit.id} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.name}>{unit.name}</span>
              <span className={styles.meta}>
                {unit.battlefieldRole} &middot; {unit.unitType}
              </span>
            </div>
            <span className={styles.points}>{unit.points} pts</span>
            {isSelected ? (
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => onRemove(unit.id)}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className={styles.addButton}
                disabled={!canAdd}
                onClick={() => onAdd(unit.id)}
              >
                Add
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}