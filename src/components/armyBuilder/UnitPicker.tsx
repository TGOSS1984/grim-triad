/**
 * Lists every unit in the currently-selected roster, letting the player
 * add/remove them from their army. Sorted cheapest-first so the roster
 * reads as a natural progression, matching how the army builder brief
 * described browsing "all available options and a points tally".
 */
import { useState } from 'react';
import type { Unit } from '../../data/schema';
import styles from './UnitPicker.module.css';

export interface UnitPickerProps {
  units: Unit[];
  selectedIds: string[];
  /** Points left to spend; used to disable Add for anything unaffordable. Null = no cap chosen yet. */
  remainingPoints: number | null;
  /** True once the army has reached its exact required size (series mode) - disables Add for everything not already selected. */
  atCapacity?: boolean;
  onAdd: (unitId: string) => void;
  onRemove: (unitId: string) => void;
}

function toPublicPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Swaps a path's extension to .webp, e.g. "units/dante.png" -> "units/dante.webp". */
function toWebpPath(path: string): string {
  return path.replace(/\.[a-z0-9]+$/i, '.webp');
}

type ThumbnailStage = 'original' | 'webp' | 'none';

/**
 * A small portrait thumbnail for a unit picker row. Tries the unit's
 * portraitPath as given (normally .png), falls back to a same-named .webp,
 * then shows a plain placeholder block if neither loads - most units have
 * no portrait art yet, and rather than show a broken-image icon this
 * degrades gracefully (same pattern as Card.tsx's portrait fallback and
 * FactionSelect's FactionIcon). Nothing else needs to change once real
 * portraits (in either format) are dropped into place; they just start
 * appearing.
 */
function UnitThumbnail({ portraitPath }: { portraitPath: string }) {
  const [stage, setStage] = useState<ThumbnailStage>('original');
  if (stage === 'none') return <div className={styles.thumbnailPlaceholder} aria-hidden="true" />;

  const src = stage === 'original' ? toPublicPath(portraitPath) : toWebpPath(toPublicPath(portraitPath));

  return (
    <img
      className={styles.thumbnail}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setStage((current) => (current === 'original' ? 'webp' : 'none'))}
    />
  );
}

export function UnitPicker({
  units,
  selectedIds,
  remainingPoints,
  atCapacity = false,
  onAdd,
  onRemove,
}: UnitPickerProps) {
  const sorted = [...units].sort((a, b) => a.points - b.points);
  const selectedSet = new Set(selectedIds);

  return (
    <ul className={styles.list} aria-label="Available units">
      {sorted.map((unit) => {
        const isSelected = selectedSet.has(unit.id);
        const affordable = remainingPoints !== null && unit.points <= remainingPoints;
        const canAdd = !isSelected && affordable && !atCapacity;

        return (
          <li key={unit.id} className={styles.row}>
            <UnitThumbnail portraitPath={unit.portraitPath} />
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