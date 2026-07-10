/**
 * Thin screen wrapper around the ArmyBuilder component. Screens own
 * navigation-level concerns; ArmyBuilder itself owns the store wiring and
 * army-building validation logic (minimum army size etc).
 */
import { ArmyBuilder } from '../components/armyBuilder/ArmyBuilder';
import styles from './ArmyBuilderScreen.module.css';

export interface ArmyBuilderScreenProps {
  onContinue: (armyUnitIds: string[]) => void;
  /** Exact army size required (series mode); omit for single-match's default (at least 5, no upper limit). */
  requiredArmySize?: number;
  /** See ArmyBuilder's own doc - a graceful, actionable message shown above the picker instead of letting a real setup failure crash the app. */
  errorMessage?: string;
}

export function ArmyBuilderScreen({ onContinue, requiredArmySize, errorMessage }: ArmyBuilderScreenProps) {
  return (
    <div className={styles.screen}>
      <ArmyBuilder onReady={onContinue} requiredArmySize={requiredArmySize} errorMessage={errorMessage} />
    </div>
  );
}