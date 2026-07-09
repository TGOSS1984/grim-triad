/**
 * Lets the player choose which of the v1 active rosters to build their
 * army from. Reads ACTIVE_FACTIONS directly (Phase 3.5's validated,
 * generated data) rather than taking it as a prop - the set of playable
 * factions is app-wide configuration, not something a caller should need
 * to thread through.
 */
import { useState } from 'react';
import { ACTIVE_FACTIONS } from '../../data/activeFactions';
import styles from './FactionSelect.module.css';

export interface FactionSelectProps {
  selectedRosterName: string | null;
  onSelectRoster: (rosterName: string) => void;
}

type IconExtension = 'png' | 'webp';

/**
 * A faction's icon, e.g. assets/factions/blood-angels/icon.png (see
 * ROADMAP.md's asset structure). Tries .png first, falls back to .webp,
 * then hides itself entirely if neither loads - no icon art exists for
 * most factions yet, and rather than show a broken-image icon this stays
 * silent, same "graceful missing art" philosophy as Card.tsx's portrait
 * fallback. Nothing else needs to change once real icons (in either
 * format) are dropped into place; they'll just start appearing.
 */
function FactionIcon({ slug }: { slug: string }) {
  const [extension, setExtension] = useState<IconExtension | null>('png');
  if (extension === null) return null;

  return (
    <img
      className={styles.icon}
      src={`/assets/factions/${slug}/icon.${extension}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setExtension((current) => (current === 'png' ? 'webp' : null))}
    />
  );
}

export function FactionSelect({ selectedRosterName, onSelectRoster }: FactionSelectProps) {
  return (
    <div className={styles.list} role="list" aria-label="Select your faction">
      {ACTIVE_FACTIONS.map((faction) => {
        const isSelected = faction.name === selectedRosterName;
        return (
          <button
            key={faction.slug}
            type="button"
            role="listitem"
            aria-label={faction.name}
            className={[styles.factionButton, isSelected ? styles.selected : ''].join(' ')}
            onClick={() => onSelectRoster(faction.name)}
            aria-pressed={isSelected}
          >
            <FactionIcon slug={faction.slug} />
            <div className={styles.textBlock}>
              <span className={styles.name}>{faction.name}</span>
              <span className={styles.count}>{faction.unitCount} units available</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}