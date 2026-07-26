/**
 * Alternate to UnitPicker's compact scrolling list: shows ONE unit at a
 * time as a large card, with Prev/Next navigation (buttons, swipe, and
 * arrow keys), an Add/Remove action for whichever unit is currently
 * shown, and a persistent header showing the running unit count and
 * points remaining. Built for players who find the dense list harder to
 * scan - same underlying data and the same add/remove/affordability
 * rules as UnitPicker (this takes an identical prop shape on purpose, so
 * ArmyBuilder can swap between the two views without either one needing
 * to know the other exists) - including the same locked-unit treatment:
 * a locked unit is still shown and still fully browsable (it's the
 * "large card" view, arguably the BETTER place to admire a locked unit
 * up close), just can't be added, with the same live-progress caption
 * UnitPicker shows (formatLockedCaption below is a deliberate duplicate
 * of UnitPicker's own copy, not a shared import - same "these two views
 * don't know about each other" independence as the rest of this file).
 *
 * Reuses useResponsiveLightboxCardWidth for the big card - it's the exact
 * same sizing problem the Lightbox already solved (a large card that must
 * still fit on a narrow mobile viewport without overflowing), so there's
 * no reason for a third bespoke width calculation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, TouchEvent } from 'react';
import type { Unit } from '../../data/schema';
import { getTierForPoints, type UnlockProgress } from '../../data/unlockCriteria';
import { Card } from '../card/Card';
import { useResponsiveLightboxCardWidth } from './useResponsiveLightboxCardWidth';
import styles from './UnitCarousel.module.css';

export interface UnitCarouselProps {
  units: Unit[];
  selectedIds: string[];
  /** Points left to spend; used to disable Add for anything unaffordable. Null = no cap chosen yet. */
  remainingPoints: number | null;
  /** True once the army has reached its exact required size (series mode) - disables Add for everything not already selected. */
  atCapacity?: boolean;
  /** Same per-unit extra disable check as UnitPicker - see that component's own doc. */
  isDisabledExtra?: (unitId: string) => boolean;
  /** Same locked-unit predicate as UnitPicker - see that component's own doc. */
  isLocked?: (unitId: string) => boolean;
  /** Same live-progress predicate as UnitPicker - see that component's own doc. */
  getUnlockProgress?: (unitId: string) => UnlockProgress | null;
  onAdd: (unitId: string) => void;
  onRemove: (unitId: string) => void;
}

/** Locked-caption text for a unit - live progress when available, the tier's static description otherwise. Deliberate duplicate of UnitPicker's own copy - see file header. */
function formatLockedCaption(
  unit: Unit,
  getUnlockProgress?: (unitId: string) => UnlockProgress | null,
): string {
  const progress = getUnlockProgress?.(unit.id);
  if (progress) return `${progress.current}/${progress.target} ${progress.label}`;
  return getTierForPoints(unit.points)?.description ?? '';
}

/** Horizontal swipe distance (px) required to trigger Prev/Next - short enough to feel responsive, long enough to not fire on an incidental tap-drag. */
const SWIPE_THRESHOLD_PX = 50;

export function UnitCarousel({
  units,
  selectedIds,
  remainingPoints,
  atCapacity = false,
  isDisabledExtra,
  isLocked,
  getUnlockProgress,
  onAdd,
  onRemove,
}: UnitCarouselProps) {
  const sorted = useMemo(() => [...units].sort((a, b) => a.points - b.points), [units]);
  const [index, setIndex] = useState(0);
  const cardWidth = useResponsiveLightboxCardWidth();
  const touchStartX = useRef<number | null>(null);

  // If the underlying unit list changes (e.g. switching factions resets
  // it) and the current index is now out of range, snap back into range
  // rather than showing a blank stage or throwing on an undefined unit.
  const clampedIndex = sorted.length === 0 ? 0 : Math.min(index, sorted.length - 1);
  useEffect(() => {
    if (clampedIndex !== index) setIndex(clampedIndex);
  }, [clampedIndex, index]);

  if (sorted.length === 0) {
    return <p className={styles.empty}>No units available.</p>;
  }

  const unit = sorted[clampedIndex];
  const selectedSet = new Set(selectedIds);
  const isSelected = selectedSet.has(unit.id);
  const locked = isLocked?.(unit.id) ?? false;
  const affordable = remainingPoints !== null && unit.points <= remainingPoints;
  const blockedByExtraRule = isDisabledExtra?.(unit.id) ?? false;
  const canAdd = !isSelected && affordable && !atCapacity && !blockedByExtraRule && !locked;

  function goPrev() {
    setIndex((i) => (i - 1 + sorted.length) % sorted.length);
  }

  function goNext() {
    setIndex((i) => (i + 1) % sorted.length);
  }

  function handleTouchStart(event: TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    }
  }

  return (
    <div
      className={styles.carousel}
      role="group"
      aria-label="Unit carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.summaryBar}>
        <span>
          {selectedIds.length} unit{selectedIds.length === 1 ? '' : 's'} selected
        </span>
        {remainingPoints !== null && <span>{remainingPoints} pts remaining</span>}
      </div>

      <div className={styles.stage}>
        <button type="button" className={styles.navButton} onClick={goPrev} aria-label="Previous unit">
          &#8249;
        </button>

        <div className={styles.cardArea}>
          <div className={locked ? styles.lockedCardWrap : undefined}>
            <Card
              name={unit.name}
              stats={unit.stats}
              portraitPath={unit.portraitPath}
              owner="blue"
              width={cardWidth}
              element={unit.element}
              keywords={unit.keywords}
            />
            {locked && (
              <span className={styles.lockIconLarge} aria-hidden="true">
                &#128274;
              </span>
            )}
          </div>
          <div className={styles.unitInfo}>
            {locked ? (
              <span className={styles.unitMetaLocked}>
                &#128274; {formatLockedCaption(unit, getUnlockProgress)}
              </span>
            ) : (
              <span className={styles.unitMeta}>
                {unit.battlefieldRole} &middot; {unit.unitType}
              </span>
            )}
            <span className={styles.unitPoints}>{unit.points} pts</span>
          </div>
        </div>

        <button type="button" className={styles.navButton} onClick={goNext} aria-label="Next unit">
          &#8250;
        </button>
      </div>

      <p className={styles.positionIndicator}>
        {clampedIndex + 1} / {sorted.length}
      </p>

      {isSelected ? (
        <button type="button" className={styles.removeButton} onClick={() => onRemove(unit.id)}>
          Remove
        </button>
      ) : (
        <button type="button" className={styles.addButton} disabled={!canAdd} onClick={() => onAdd(unit.id)}>
          {locked ? 'Locked' : 'Add'}
        </button>
      )}
    </div>
  );
}