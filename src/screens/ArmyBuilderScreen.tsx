/**
 * Thin screen wrapper around the ArmyBuilder component. Screens own
 * navigation-level concerns; ArmyBuilder itself owns the store wiring and
 * army-building validation logic (minimum army size etc).
 */
import { ArmyBuilder } from '../components/armyBuilder/ArmyBuilder';
import styles from './ArmyBuilderScreen.module.css';

export interface ArmyBuilderScreenProps {
  onContinue: (armyUnitIds: string[]) => void;
}

export function ArmyBuilderScreen({ onContinue }: ArmyBuilderScreenProps) {
  return (
    <div className={styles.screen}>
      <ArmyBuilder onReady={onContinue} />
    </div>
  );
}