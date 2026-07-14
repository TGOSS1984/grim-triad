/**
 * Composes the full army-building flow: pick a faction, pick a points cap,
 * then add/remove units against a live points tally. Wired directly to
 * useArmyBuilderStore (Phase 5.2) - this component owns that wiring so
 * FactionSelect/PointsTally/UnitPicker themselves stay pure/presentational
 * and independently testable.
 */
import { useEffect, useState } from 'react';
import { useArmyBuilderStore } from '../../state/armyBuilderStore';
import type { PointsCap } from '../../state/armyBuilderStore';
import { canAddToCampaignRoster, countPowerUnits, CAMPAIGN_MAX_POWER_UNITS } from '../../state/campaignBalance';
import { FactionSelect } from './FactionSelect';
import { PointsTally } from './PointsTally';
import { UnitPicker } from './UnitPicker';
import { UnitCarousel } from './UnitCarousel';
import styles from './ArmyBuilder.module.css';

const POINTS_CAPS: PointsCap[] = [500, 1000, 2000];

/** Default minimum army size for single-match mode: a match hand is 5 cards, so an army needs at least that many units. */
const DEFAULT_MIN_ARMY_SIZE = 5;

export interface ArmyBuilderProps {
  onReady: (armyUnitIds: string[]) => void;
  /**
   * Exact army size required, e.g. series mode's chosen pool size. When
   * set, the player must select EXACTLY this many units (no more, no
   * less) - series mode's round count is derived from this number
   * (rounds = pool size / 5), so letting the player bring extra unused
   * units would make that math meaningless. Omit for single-match mode's
   * default: at least DEFAULT_MIN_ARMY_SIZE, no upper limit.
   */
  requiredArmySize?: number;
  /**
   * When set, the points cap is applied automatically (via setPointsCap,
   * same as if the player had clicked it) and the "Choose Points Limit"
   * step is skipped entirely - straight from faction to unit picker. Used
   * by campaign mode, whose starting-roster points cap is a fixed rule
   * (see campaignBalance.ts's CAMPAIGN_STARTING_POINTS_CAP), not a player
   * choice like single-match/series mode's cap picker.
   */
  forcedPointsCap?: PointsCap;
  /**
   * Shown as a banner above the faction picker when set - used for
   * surfacing a graceful, actionable message (e.g. "couldn't build an
   * opponent army for this pool size/points combination, try a smaller
   * pool or a higher points limit") rather than letting a real setup
   * failure crash the app. See App.tsx's handleArmyReady.
   */
  errorMessage?: string;
  /**
   * When true, live-disables Add for any unit that would push the
   * roster over campaign mode's power-unit cap (see campaignBalance.ts) -
   * this used to only be enforced when the player clicked Continue
   * (validateCampaignStartingRoster in App.tsx), which meant clicking
   * Add on a unit that was allowed by points/size but NOT by the power
   * cap silently succeeded, only to be rejected later with no
   * indication of which unit was the problem. Omit for single-match/
   * series mode, which have no such rule.
   */
  enforcePowerCap?: boolean;
}

export function ArmyBuilder({
  onReady,
  requiredArmySize,
  forcedPointsCap,
  errorMessage,
  enforcePowerCap = false,
}: ArmyBuilderProps) {
  const rosterName = useArmyBuilderStore((s) => s.rosterName);
  const pointsCap = useArmyBuilderStore((s) => s.pointsCap);
  const selectedUnitIds = useArmyBuilderStore((s) => s.selectedUnitIds);
  const selectRoster = useArmyBuilderStore((s) => s.selectRoster);
  const setPointsCap = useArmyBuilderStore((s) => s.setPointsCap);
  const setMaxArmySize = useArmyBuilderStore((s) => s.setMaxArmySize);
  const addUnit = useArmyBuilderStore((s) => s.addUnit);
  const removeUnit = useArmyBuilderStore((s) => s.removeUnit);
  const totalPoints = useArmyBuilderStore((s) => s.totalPoints());
  const remainingPoints = useArmyBuilderStore((s) => s.remainingPoints());
  const availableUnits = useArmyBuilderStore((s) => s.availableUnits());

  const minArmySize = requiredArmySize ?? DEFAULT_MIN_ARMY_SIZE;

  /**
   * List is the default and always was the only option - Carousel is an
   * ADDITIONAL accessible alternative for players who find the dense
   * scrolling list harder to scan (large touch targets, one unit at a
   * time, works with swipe/arrow-key/button navigation), not a
   * replacement. Local UI state, not persisted - each visit to the army
   * builder starts on the list view.
   */
  const [viewMode, setViewMode] = useState<'list' | 'carousel'>('list');

  // Sync the exact-size cap into the store whenever this screen is used
  // for series mode - the store is the real enforcement point (addUnit
  // refuses once at capacity), this just keeps it configured correctly
  // for whichever mode is currently active.
  useEffect(() => {
    setMaxArmySize(requiredArmySize ?? null);
  }, [requiredArmySize, setMaxArmySize]);

  // Same principle for a forced points cap (campaign mode) - apply it
  // once, immediately, rather than waiting for the player to click a cap
  // button that (for this mode) doesn't even render.
  useEffect(() => {
    if (forcedPointsCap !== undefined) setPointsCap(forcedPointsCap);
  }, [forcedPointsCap, setPointsCap]);

  const canContinue = requiredArmySize
    ? selectedUnitIds.length === requiredArmySize
    : selectedUnitIds.length >= minArmySize;

  const continueLabel = requiredArmySize
    ? `Select exactly ${requiredArmySize} units (${selectedUnitIds.length}/${requiredArmySize})`
    : `Select at least ${minArmySize} units (${selectedUnitIds.length}/${minArmySize})`;

  // Live per-unit gate for campaign mode's power-unit cap - see this
  // prop's own doc for why this needs to be a live check now rather
  // than only failing at Continue time. canAddToCampaignRoster's default
  // pool size/points cap/power cap already match the real campaign
  // constants (the same ones this screen was configured with via
  // requiredArmySize/forcedPointsCap when enforcePowerCap is true), so
  // no explicit overrides are needed here.
  const isDisabledByPowerCap = enforcePowerCap
    ? (unitId: string) => !canAddToCampaignRoster(selectedUnitIds, unitId).allowed
    : undefined;
  const currentPowerUnitCount = enforcePowerCap ? countPowerUnits(selectedUnitIds) : 0;

  return (
    <div className={styles.builder}>
      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Choose Your Faction</h2>
        <FactionSelect selectedRosterName={rosterName} onSelectRoster={selectRoster} />
      </section>

      {rosterName && forcedPointsCap === undefined && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Choose Points Limit</h2>
          <div className={styles.capRow}>
            {POINTS_CAPS.map((cap) => {
              const isSelected = cap === pointsCap;
              return (
                <button
                  key={cap}
                  type="button"
                  className={[styles.capButton, isSelected ? styles.capButtonSelected : ''].join(' ')}
                  onClick={() => setPointsCap(cap)}
                  aria-pressed={isSelected}
                >
                  {cap} pts
                </button>
              );
            })}
          </div>
        </section>
      )}

      {rosterName && pointsCap !== null && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Build Your Army
            {requiredArmySize && (
              <span className={styles.sectionSubtitle}> ({requiredArmySize}-card series pool)</span>
            )}
          </h2>
          <PointsTally totalPoints={totalPoints} pointsCap={pointsCap} />
          {enforcePowerCap && (
            <p className={styles.powerUnitTally}>
              Power units (over 150pts): {currentPowerUnitCount}/{CAMPAIGN_MAX_POWER_UNITS}
            </p>
          )}

          <div className={styles.viewToggle} role="group" aria-label="Unit picker view">
            <button
              type="button"
              className={[styles.viewToggleButton, viewMode === 'list' ? styles.viewToggleActive : ''].join(' ')}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
            <button
              type="button"
              className={[styles.viewToggleButton, viewMode === 'carousel' ? styles.viewToggleActive : ''].join(
                ' ',
              )}
              aria-pressed={viewMode === 'carousel'}
              onClick={() => setViewMode('carousel')}
            >
              Carousel View
            </button>
          </div>

          {viewMode === 'list' ? (
            <UnitPicker
              units={availableUnits}
              selectedIds={selectedUnitIds}
              remainingPoints={remainingPoints}
              atCapacity={requiredArmySize !== undefined && selectedUnitIds.length >= requiredArmySize}
              isDisabledExtra={isDisabledByPowerCap}
              onAdd={addUnit}
              onRemove={removeUnit}
            />
          ) : (
            <UnitCarousel
              units={availableUnits}
              selectedIds={selectedUnitIds}
              remainingPoints={remainingPoints}
              atCapacity={requiredArmySize !== undefined && selectedUnitIds.length >= requiredArmySize}
              isDisabledExtra={isDisabledByPowerCap}
              onAdd={addUnit}
              onRemove={removeUnit}
            />
          )}
        </section>
      )}

      <button
        type="button"
        className={styles.continueButton}
        disabled={!canContinue}
        onClick={() => onReady(selectedUnitIds)}
      >
        {canContinue ? 'Continue' : continueLabel}
      </button>
    </div>
  );
}