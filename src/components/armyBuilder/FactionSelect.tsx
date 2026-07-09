/**
 * Lets the player choose which of the v1 active rosters to build their
 * army from. Reads ACTIVE_FACTIONS directly (Phase 3.5's validated,
 * generated data) rather than taking it as a prop - the set of playable
 * factions is app-wide configuration, not something a caller should need
 * to thread through.
 */
import { ACTIVE_FACTIONS } from '../../data/activeFactions';
import { FactionIcon } from '../common/FactionIcon';
import styles from './FactionSelect.module.css';

export interface FactionSelectProps {
  selectedRosterName: string | null;
  onSelectRoster: (rosterName: string) => void;
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
            <FactionIcon slug={faction.slug} className={styles.icon} />
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