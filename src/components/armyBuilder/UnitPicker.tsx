/**
 * Lists every unit in the currently-selected roster, letting the player
 * add/remove them from their army. Sorted cheapest-first so the roster
 * reads as a natural progression, matching how the army builder brief
 * described browsing "all available options and a points tally".
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Unit } from '../../data/schema';
import { Card } from '../card/Card';
import { Lightbox } from '../common/Lightbox';
import { useResponsiveLightboxCardWidth } from './useResponsiveLightboxCardWidth';
import styles from './UnitPicker.module.css';

export interface UnitPickerProps {
  units: Unit[];
  selectedIds: string[];
  /** Points left to spend; used to disable Add for anything unaffordable. Null = no cap chosen yet. */
  remainingPoints: number | null;
  /** True once the army has reached its exact required size (series mode) - disables Add for everything not already selected. */
  atCapacity?: boolean;
  /**
   * Optional per-unit extra disable check, evaluated in ADDITION to
   * remainingPoints/atCapacity - used by campaign mode's power-unit cap
   * (see campaignBalance.ts's canAddToCampaignRoster), which disables
   * Add for a SPECIFIC unit (one that would push the roster over its
   * power-unit limit) rather than the whole picker uniformly the way
   * atCapacity does. Kept as a generic per-unit predicate rather than a
   * campaign-specific prop, since this component has no reason to know
   * campaign rules exist at all.
   */
  isDisabledExtra?: (unitId: string) => boolean;
  onAdd: (unitId: string) => void;
  onRemove: (unitId: string) => void;
}

/** Width (px) of the small row thumbnail card - kept tight so rows stay compact in the scrolling list. */
const ROW_CARD_WIDTH = 44;
/** Width (px) of the floating hover-zoom preview card. */
const HOVER_PREVIEW_CARD_WIDTH = 170;
/** How far past the row card's edge the hover preview floats, in px. */
const HOVER_PREVIEW_GAP = 12;

/**
 * A row's unit preview: renders the SAME Card component used in Hand/Board
 * (not a flat portrait image), at a small size, in the human's own colour
 * (blue - the army builder is always building the human's own army, never
 * the AI's). This is deliberate: what you see while browsing the roster
 * should be exactly what the card looks like once it's actually in play -
 * same frame, same stat badges, same element badge - not a simplified
 * stand-in that then looks different once the match starts.
 *
 * Element badge: unlike GameScreen (which only shows a card's element
 * when the Elemental rule is active THIS match, since otherwise it'd be a
 * confusing icon that does nothing), the roster picker always shows it -
 * this is a browse/catalog context, not a specific match, so surfacing a
 * unit's element affinity up front is useful information regardless of
 * which rules end up active.
 *
 * Interaction: hovering (or keyboard-focusing) the small card shows a
 * larger floating preview card - portalled to document.body and
 * positioned via the row card's own bounding rect, so it always renders
 * above the roster list's scrollable/overflow-clipped container rather
 * than being cut off inside it. Clicking opens a full-size Card in a
 * Lightbox.
 */
function UnitRowCard({ unit }: { unit: Unit }) {
  const [hovering, setHovering] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lightboxCardWidth = useResponsiveLightboxCardWidth();

  const rect = buttonRef.current?.getBoundingClientRect();
  // Prefer opening to the right of the card; flip to the left if there
  // isn't enough room, so the preview never runs off-screen on narrower
  // viewports.
  const opensLeft =
    !!rect && rect.right + HOVER_PREVIEW_GAP + HOVER_PREVIEW_CARD_WIDTH > window.innerWidth;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.cardButton}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onClick={() => setLightboxOpen(true)}
        aria-label={`View larger card for ${unit.name}`}
      >
        <Card
          name={unit.name}
          stats={unit.stats}
          portraitPath={unit.portraitPath}
          owner="blue"
          width={ROW_CARD_WIDTH}
          element={unit.element}
        />
      </button>
      {hovering &&
        rect &&
        createPortal(
          <div
            className={styles.hoverPreview}
            style={{
              top: rect.top + rect.height / 2,
              ...(opensLeft
                ? { right: window.innerWidth - rect.left + HOVER_PREVIEW_GAP }
                : { left: rect.right + HOVER_PREVIEW_GAP }),
            }}
            aria-hidden="true"
          >
            <Card
              name={unit.name}
              stats={unit.stats}
              portraitPath={unit.portraitPath}
              owner="blue"
              width={HOVER_PREVIEW_CARD_WIDTH}
              element={unit.element}
            />
          </div>,
          document.body,
        )}
      {lightboxOpen && (
        <Lightbox onClose={() => setLightboxOpen(false)}>
          <Card
            name={unit.name}
            stats={unit.stats}
            portraitPath={unit.portraitPath}
            owner="blue"
            width={lightboxCardWidth}
            element={unit.element}
          />
        </Lightbox>
      )}
    </>
  );
}

export function UnitPicker({
  units,
  selectedIds,
  remainingPoints,
  atCapacity = false,
  isDisabledExtra,
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
        const blockedByExtraRule = isDisabledExtra?.(unit.id) ?? false;
        const canAdd = !isSelected && affordable && !atCapacity && !blockedByExtraRule;

        return (
          <li key={unit.id} className={styles.row}>
            <UnitRowCard unit={unit} />
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