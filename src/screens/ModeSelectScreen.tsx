/**
 * Lets the player choose between a single one-off match and a multi-round
 * series (see ROADMAP discussion: a series draws 5 fresh, never-repeated
 * cards per round from a larger pool the player chooses freely, playing
 * until one side can no longer field a full hand). Pure presentational -
 * no store access, matching HomeScreen's pattern.
 */
import { useState } from 'react';
import { DIFFICULTY_PROFILES, DEFAULT_DIFFICULTY } from '../ai/difficulty';
import type { Difficulty } from '../ai/difficulty';
import styles from './ModeSelectScreen.module.css';

export interface ModeSelectScreenProps {
  onSelectSingleMatch: (difficulty: Difficulty) => void;
  onSelectSeries: (poolSize: number, difficulty: Difficulty) => void;
  /** Campaign has no extra options at select-time (unlike Series' pool size) - its starting roster size/points cap/power cap are fixed rules, see campaignBalance.ts. */
  onSelectCampaign: (difficulty: Difficulty) => void;
}

const PRESET_POOL_SIZES = [10, 15, 20, 25];
const MIN_POOL_SIZE = 10;
const DEFAULT_POOL_SIZE = 15;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export function ModeSelectScreen({
  onSelectSingleMatch,
  onSelectSeries,
  onSelectCampaign,
}: ModeSelectScreenProps) {
  const [showSeriesOptions, setShowSeriesOptions] = useState(false);
  const [poolSize, setPoolSize] = useState(DEFAULT_POOL_SIZE);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);

  const isValidPoolSize = poolSize >= MIN_POOL_SIZE && poolSize % 5 === 0;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Choose Your Battle</h1>

      <div className={styles.difficultyBlock}>
        <h3 className={styles.difficultyTitle}>Opponent Difficulty</h3>
        <div className={styles.difficultyRow} role="radiogroup" aria-label="Opponent difficulty">
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={difficulty === level}
              className={[
                styles.difficultyButton,
                difficulty === level ? styles.difficultyButtonSelected : '',
              ].join(' ')}
              onClick={() => setDifficulty(level)}
            >
              {DIFFICULTY_PROFILES[level].label}
            </button>
          ))}
        </div>
        <p className={styles.difficultyDescription}>{DIFFICULTY_PROFILES[difficulty].description}</p>
      </div>

      <div className={styles.modeRow}>
        <button
          type="button"
          className={styles.modeCard}
          onClick={() => onSelectSingleMatch(difficulty)}
        >
          <h2 className={styles.modeCardTitle}>Single Match</h2>
          <p className={styles.modeCardDescription}>
            One battle, a 5-card hand, winner takes it. Quick and simple.
          </p>
        </button>

        <button
          type="button"
          className={[styles.modeCard, showSeriesOptions ? styles.modeCardSelected : ''].join(' ')}
          onClick={() => setShowSeriesOptions(true)}
          aria-pressed={showSeriesOptions}
        >
          <h2 className={styles.modeCardTitle}>Series</h2>
          <p className={styles.modeCardDescription}>
            Bring a bigger army pool, play consecutive rounds with no card
            repeats, and see how far you can go.
          </p>
        </button>

        <button
          type="button"
          className={styles.modeCard}
          onClick={() => onSelectCampaign(difficulty)}
        >
          <h2 className={styles.modeCardTitle}>Campaign</h2>
          <p className={styles.modeCardDescription}>
            Build a starting roster, then keep playing across sessions -
            wins and losses are permanent, and cards you capture stay
            captured.
          </p>
        </button>
      </div>

      {showSeriesOptions && (
        <div className={styles.seriesOptions}>
          <h3 className={styles.seriesOptionsTitle}>Choose Your Pool Size</h3>

          <div className={styles.presetRow}>
            {PRESET_POOL_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={[
                  styles.presetButton,
                  size === poolSize ? styles.presetButtonSelected : '',
                ].join(' ')}
                onClick={() => setPoolSize(size)}
                aria-pressed={size === poolSize}
              >
                {size}
              </button>
            ))}
          </div>

          <label className={styles.customLabel}>
            Or choose a custom size (multiples of 5):
            <input
              type="number"
              min={MIN_POOL_SIZE}
              step={5}
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value))}
              className={styles.customInput}
              aria-label="Custom pool size"
            />
          </label>

          <p className={styles.roundsPreview}>
            {isValidPoolSize
              ? `${poolSize / 5} rounds before any Trade Rule attrition`
              : `Pool size must be a multiple of 5, at least ${MIN_POOL_SIZE}`}
          </p>

          <button
            type="button"
            className={styles.startSeriesButton}
            disabled={!isValidPoolSize}
            onClick={() => onSelectSeries(poolSize, difficulty)}
          >
            Start Series
          </button>
        </div>
      )}
    </div>
  );
}