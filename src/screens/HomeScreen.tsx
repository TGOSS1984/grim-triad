/**
 * The landing/start screen: title, tagline, and the entry point into the
 * game flow. Deliberately a pure presentational component (no store/router
 * access) - the caller (App.tsx, wired up in Phase 8.7) owns navigation
 * and passes down what happens when "New Game" is pressed.
 */
import styles from './HomeScreen.module.css';

export interface HomeScreenProps {
  onNewGame: () => void;
}

export function HomeScreen({ onNewGame }: HomeScreenProps) {
  return (
    <div className={styles.home}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Grim Triad</h1>
        <p className={styles.tagline}>A card battle for the 41st millennium</p>
      </div>
      <button type="button" className={styles.newGameButton} onClick={onNewGame}>
        New Game
      </button>
    </div>
  );
}