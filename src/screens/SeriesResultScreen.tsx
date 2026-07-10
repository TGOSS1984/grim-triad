/**
 * Shown once a series has concluded (see seriesStore.seriesWinner) -
 * distinct from the single-match ResultScreen, since a series result is
 * about overall standing across all rounds, not one match's board state.
 */
import type { PlayerColour } from '../engine/types';
import styles from './SeriesResultScreen.module.css';

export interface SeriesResultScreenProps {
  seriesWinner: PlayerColour | 'draw';
  blueWins: number;
  redWins: number;
  roundsPlayed: number;
  onNewGame: () => void;
}

export function SeriesResultScreen({
  seriesWinner,
  blueWins,
  redWins,
  roundsPlayed,
  onNewGame,
}: SeriesResultScreenProps) {
  const title =
    seriesWinner === 'draw'
      ? 'Series Draw'
      : `${seriesWinner === 'blue' ? 'Blue' : 'Red'} Wins the Series`;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{title}</h1>

      <p className={styles.summary}>
        {roundsPlayed} round{roundsPlayed === 1 ? '' : 's'} played
      </p>

      <div className={styles.tallyRow}>
        <span className={styles.tallyBlue}>Blue: {blueWins}</span>
        <span className={styles.tallyRed}>Red: {redWins}</span>
      </div>

      <button type="button" className={styles.newGameButton} onClick={onNewGame}>
        New Game
      </button>
    </div>
  );
}