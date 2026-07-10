/**
 * Composes the full army-building flow: pick a faction, pick a points cap,
 * then add/remove units against a live points tally. Wired directly to
 * useArmyBuilderStore (Phase 5.2) - this component owns that wiring so
 * FactionSelect/PointsTally/UnitPicker themselves stay pure/presentational
 * and independently testable.
 */
import { useEffect } from 'react';
import { useArmyBuilderStore } from '../../state/armyBuilderStore';
import type { PointsCap } from '../../state/armyBuilderStore';
import { FactionSelect } from './FactionSelect';
import { PointsTally } from './PointsTally';
import { UnitPicker } from './UnitPicker';
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
}

export function ArmyBuilder({ onReady, requiredArmySize }: ArmyBuilderProps) {
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

  // Sync the exact-size cap into the store whenever this screen is used
  // for series mode - the store is the real enforcement point (addUnit
  // refuses once at capacity), this just keeps it configured correctly
  // for whichever mode is currently active.
  useEffect(() => {
    setMaxArmySize(requiredArmySize ?? null);
  }, [requiredArmySize, setMaxArmySize]);

  const canContinue = requiredArmySize
    ? selectedUnitIds.length === requiredArmySize
    : selectedUnitIds.length >= minArmySize;

  const continueLabel = requiredArmySize
    ? `Select exactly ${requiredArmySize} units (${selectedUnitIds.length}/${requiredArmySize})`
    : `Select at least ${minArmySize} units (${selectedUnitIds.length}/${minArmySize})`;

  return (
    <div className={styles.builder}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Choose Your Faction</h2>
        <FactionSelect selectedRosterName={rosterName} onSelectRoster={selectRoster} />
      </section>

      {rosterName && (
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
          <UnitPicker
            units={availableUnits}
            selectedIds={selectedUnitIds}
            remainingPoints={remainingPoints}
            atCapacity={requiredArmySize !== undefined && selectedUnitIds.length >= requiredArmySize}
            onAdd={addUnit}
            onRemove={removeUnit}
          />
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