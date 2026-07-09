/**
 * Composes the full army-building flow: pick a faction, pick a points cap,
 * then add/remove units against a live points tally. Wired directly to
 * useArmyBuilderStore (Phase 5.2) - this component owns that wiring so
 * FactionSelect/PointsTally/UnitPicker themselves stay pure/presentational
 * and independently testable.
 */
import { useArmyBuilderStore } from '../../state/armyBuilderStore';
import type { PointsCap } from '../../state/armyBuilderStore';
import { FactionSelect } from './FactionSelect';
import { PointsTally } from './PointsTally';
import { UnitPicker } from './UnitPicker';
import styles from './ArmyBuilder.module.css';

const POINTS_CAPS: PointsCap[] = [500, 1000, 2000];

/** Minimum army size: a match hand is 5 cards, so an army needs at least that many units. */
const MIN_ARMY_SIZE = 5;

export interface ArmyBuilderProps {
  onReady: (armyUnitIds: string[]) => void;
}

export function ArmyBuilder({ onReady }: ArmyBuilderProps) {
  const rosterName = useArmyBuilderStore((s) => s.rosterName);
  const pointsCap = useArmyBuilderStore((s) => s.pointsCap);
  const selectedUnitIds = useArmyBuilderStore((s) => s.selectedUnitIds);
  const selectRoster = useArmyBuilderStore((s) => s.selectRoster);
  const setPointsCap = useArmyBuilderStore((s) => s.setPointsCap);
  const addUnit = useArmyBuilderStore((s) => s.addUnit);
  const removeUnit = useArmyBuilderStore((s) => s.removeUnit);
  const totalPoints = useArmyBuilderStore((s) => s.totalPoints());
  const remainingPoints = useArmyBuilderStore((s) => s.remainingPoints());
  const availableUnits = useArmyBuilderStore((s) => s.availableUnits());

  const canContinue = selectedUnitIds.length >= MIN_ARMY_SIZE;

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
          <h2 className={styles.sectionTitle}>Build Your Army</h2>
          <PointsTally totalPoints={totalPoints} pointsCap={pointsCap} />
          <UnitPicker
            units={availableUnits}
            selectedIds={selectedUnitIds}
            remainingPoints={remainingPoints}
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
        {canContinue
          ? 'Continue'
          : `Select at least ${MIN_ARMY_SIZE} units (${selectedUnitIds.length}/${MIN_ARMY_SIZE})`}
      </button>
    </div>
  );
}