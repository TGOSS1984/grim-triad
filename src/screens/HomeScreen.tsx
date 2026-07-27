/**
 * The landing/start screen: title, tagline, and the entry point into the
 * game flow. Deliberately a pure presentational component (no store/router
 * access) - the caller (App.tsx, wired up in Phase 8.7) owns navigation
 * and passes down what happens when "New Game" is pressed.
 *
 * onViewProgress: a secondary entry point to screens/ProgressScreen.tsx
 * (unlock-tier progress + achievements, both permanent/cross-session), so
 * a player can check "where do I stand" without needing to be mid-way
 * through starting a new game first.
 */
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { HOME_BACKGROUND_PATH } from '../components/layout/backgroundPaths';
import styles from './HomeScreen.module.css';

export interface HomeScreenProps {
  onNewGame: () => void;
  onViewProgress: () => void;
}

export function HomeScreen({ onNewGame, onViewProgress }: HomeScreenProps) {
  return (
    <div className={styles.home}>
      <BackgroundLayer imagePath={HOME_BACKGROUND_PATH} />
      <div className={styles.panel}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Grim Triad</h1>
          <p className={styles.tagline}>A card battle for the 41st millennium</p>
        </div>
        <button type="button" className={styles.newGameButton} onClick={onNewGame}>
          New Game
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onViewProgress}>
          Progress &amp; Achievements
        </button>
      </div>
    </div>
  );
}