/**
 * Lists every unit in the currently-selected roster, letting the player
 * add/remove them from their army. Sorted cheapest-first so the roster
 * reads as a natural progression, matching how the army builder brief
 * described browsing "all available options and a points tally".
 *
 * Locked units (see data/unlockCriteria.ts) are still shown in the list -
 * not hidden - deliberately: seeing a locked slot with its unlock
 * condition ("Win 10 games") is what makes the goal visible and worth
 * chasing, the same reason unlockable content in other games shows you
 * the silhouette rather than nothing at all. The card itself still opens
 * in the hover preview and Lightbox at full size, locked treatment and
 * all - a player should be able to admire exactly what they're working
 * toward, not just read a tier label. `isLocked` is injected as a
 * predicate (same pattern as isDisabledExtra below) so this component
 * stays mode-agnostic and never needs to know armyBuilderStore or
 * unlockStore exist; the human-readable "why" text, on the other hand, is
 * computed directly from getTierForPoints - that's pure data about the
 * unit itself (its points cost), not a store-dependent decision, so no
 * injection is needed for it.
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Unit } from '../../data/schema';
import { getTierForPoints } from '../../data/unlockCriteria';
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
  /**
   * True if a unit is currently locked by cross-mode unlock progress -
   * see armyBuilderStore's own isUnitLocked, the intended caller. Kept as
   * a generic predicate (same reasoning as isDisabledExtra above) rather
   * than this component reaching into armyBuilderStore/unlockStore
   * itself. Purely visual/disabling here - the REAL enforcement already
   * lives in armyBuilderStore.addUnit, so even if this prop were ever
   * omitted or wrong, a locked unit still can't actually be added.
   */
  isLocked?: (unitId: string) => boolean;
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
function UnitRowCard({ unit, locked }: { unit: Unit; locked: boolean }) {
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
        aria-label={
          locked ? `View larger card for locked unit ${unit.name}` : `View larger card for ${unit.name}`
        }
      >
        <div className={locked ? styles.lockedCardWrap : undefined}>
          <Card
            name={unit.name}
            stats={unit.stats}
            portraitPath={unit.portraitPath}
            owner="blue"
            width={ROW_CARD_WIDTH}
            element={unit.element}
            keywords={unit.keywords}
          />
          {locked && (
            <span className={styles.lockIcon} aria-hidden="true">
              &#128274;
            </span>
          )}
        </div>
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
            <div className={locked ? styles.lockedCardWrap : undefined}>
              <Card
                name={unit.name}
                stats={unit.stats}
                portraitPath={unit.portraitPath}
                owner="blue"
                width={HOVER_PREVIEW_CARD_WIDTH}
                element={unit.element}
                keywords={unit.keywords}
              />
              {locked && (
                <span className={styles.lockIcon} aria-hidden="true">
                  &#128274;
                </span>
              )}
            </div>
          </div>,
          document.body,
        )}
      {lightboxOpen && (
        <Lightbox
          onClose={() => setLightboxOpen(false)}
          caption={locked ? `Locked - ${getTierForPoints(unit.points)?.description}` : undefined}
        >
          <div className={locked ? styles.lockedCardWrap : undefined}>
            <Card
              name={unit.name}
              stats={unit.stats}
              portraitPath={unit.portraitPath}
              owner="blue"
              width={lightboxCardWidth}
              element={unit.element}
              keywords={unit.keywords}
            />
            {locked && (
              <span className={styles.lockIconLarge} aria-hidden="true">
                &#128274;
              </span>
            )}
          </div>
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
  isLocked,
  onAdd,
  onRemove,
}: UnitPickerProps) {
  const sorted = [...units].sort((a, b) => a.points - b.points);
  const selectedSet = new Set(selectedIds);

  return (
    <ul className={styles.list} aria-label="Available units">
      {sorted.map((unit) => {
        const isSelected = selectedSet.has(unit.id);
        const locked = isLocked?.(unit.id) ?? false;
        const affordable = remainingPoints !== null && unit.points <= remainingPoints;
        const blockedByExtraRule = isDisabledExtra?.(unit.id) ?? false;
        const canAdd = !isSelected && affordable && !atCapacity && !blockedByExtraRule && !locked;
        const tier = locked ? getTierForPoints(unit.points) : null;

        return (
          <li key={unit.id} className={[styles.row, locked ? styles.rowLocked : ''].join(' ')}>
            <UnitRowCard unit={unit} locked={locked} />
            <div className={styles.info}>
              <span className={styles.name}>{unit.name}</span>
              {locked && tier ? (
                <span className={styles.lockedMeta}>&#128274; {tier.description}</span>
              ) : (
                <span className={styles.meta}>
                  {unit.battlefieldRole} &middot; {unit.unitType}
                </span>
              )}
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
                {locked ? 'Locked' : 'Add'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}