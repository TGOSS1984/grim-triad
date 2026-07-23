/**
 * Lets the player choose which of the v1 active rosters to build their
 * army from. Reads ACTIVE_FACTIONS directly (Phase 3.5's validated,
 * generated data) rather than taking it as a prop - the set of playable
 * factions is app-wide configuration, not something a caller should need
 * to thread through.
 *
 * Grouped into three collapsible, accordion sections (Imperium / Chaos /
 * Xenos - see data/factionAlignment.ts) rather than one long list: with
 * the roster count growing toward ~40, a flat grid means a lot of
 * scrolling just to find one faction. Accordion (only one section open
 * at a time) rather than independently-collapsible sections, per design
 * decision - keeps exactly one faction grid on screen at once, so the
 * page doesn't grow tall as more sections happen to be open.
 *
 * The grid *inside* each section is untouched from the pre-grouping
 * version - same cards, same responsive column tiers - only now scoped
 * to one alignment's factions instead of all of them.
 */
import { useEffect, useMemo, useState } from 'react';
import { ACTIVE_FACTIONS } from '../../data/activeFactions';
import { ALIGNMENT_ORDER, factionAlignmentOf, type FactionAlignment } from '../../data/factionAlignment';
import type { Faction } from '../../data/schema';
import { FactionIcon } from '../common/FactionIcon';
import { GroupIcon } from '../common/GroupIcon';
import styles from './FactionSelect.module.css';

export interface FactionSelectProps {
  selectedRosterName: string | null;
  onSelectRoster: (rosterName: string) => void;
}

interface FactionGroup {
  alignment: FactionAlignment;
  factions: Faction[];
}

/** ACTIVE_FACTIONS bucketed by alignment, in ALIGNMENT_ORDER, dropping any
 *  group that currently has no active factions in it (keeps the v1 screen
 *  from showing an empty "Chaos" section if only Imperium/Xenos rosters
 *  are active yet). */
function groupByAlignment(factions: Faction[]): FactionGroup[] {
  const byAlignment = new Map<FactionAlignment, Faction[]>(
    ALIGNMENT_ORDER.map((alignment) => [alignment, []]),
  );
  for (const faction of factions) {
    byAlignment.get(factionAlignmentOf(faction.name))?.push(faction);
  }
  return ALIGNMENT_ORDER.map((alignment) => ({
    alignment,
    factions: byAlignment.get(alignment) ?? [],
  })).filter((group) => group.factions.length > 0);
}

export function FactionSelect({ selectedRosterName, onSelectRoster }: FactionSelectProps) {
  const groups = useMemo(() => groupByAlignment(ACTIVE_FACTIONS), []);

  const [openGroup, setOpenGroup] = useState<FactionAlignment | null>(() =>
    selectedRosterName ? factionAlignmentOf(selectedRosterName) : (groups[0]?.alignment ?? null),
  );

  // If the selected faction changes from elsewhere (e.g. a "randomize
  // army" action outside this component), jump the accordion to whichever
  // group now holds it, so the open section always matches the
  // selection. Doesn't fire on manual accordion clicks - those only ever
  // change `openGroup`, never `selectedRosterName`.
  useEffect(() => {
    if (selectedRosterName) {
      setOpenGroup(factionAlignmentOf(selectedRosterName));
    }
  }, [selectedRosterName]);

  return (
    <div className={styles.groups}>
      {groups.map(({ alignment, factions }) => {
        const isOpen = openGroup === alignment;
        const sectionId = `faction-group-${alignment.toLowerCase()}`;
        return (
          <div key={alignment} className={styles.group}>
            <button
              type="button"
              className={[styles.groupHeader, isOpen ? styles.groupHeaderOpen : ''].join(' ')}
              aria-expanded={isOpen}
              aria-controls={sectionId}
              onClick={() => setOpenGroup(isOpen ? null : alignment)}
            >
              <GroupIcon alignment={alignment} className={styles.groupIcon} />
              <span className={styles.groupName}>{alignment}</span>
              <span className={styles.groupCount}>
                {factions.length} faction{factions.length === 1 ? '' : 's'}
              </span>
              <svg
                className={styles.groupChevron}
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M4 6 L8 10 L12 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              id={sectionId}
              className={[styles.groupBody, isOpen ? styles.groupBodyOpen : ''].join(' ')}
            >
              <div className={styles.groupBodyInner}>
                <div className={styles.list} role="list" aria-label={`${alignment} factions`}>
                  {factions.map((faction) => {
                    const isSelected = faction.name === selectedRosterName;
                    return (
                      <button
                        key={faction.slug}
                        type="button"
                        role="listitem"
                        aria-label={faction.name}
                        className={[styles.factionButton, isSelected ? styles.selected : ''].join(
                          ' ',
                        )}
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}