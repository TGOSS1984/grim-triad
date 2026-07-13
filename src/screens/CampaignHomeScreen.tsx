/**
 * Campaign mode's entry point (reached from ModeSelectScreen, before
 * ArmyBuilder). Unlike single-match/series mode, campaign progress
 * PERSISTS across sessions (see campaignStore.ts) - this screen is where
 * that persistence actually becomes visible: current collection size,
 * win/loss/draw record, and the choice to keep playing or start over.
 *
 * Reads campaignStore directly (not purely presentational, unlike most
 * other screens) - this screen's whole purpose is showing live store
 * state, the same reasoning GameScreen reads useGameStore directly.
 */
import { useState } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { ACHIEVEMENTS } from '../state/achievements';
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { HOME_BACKGROUND_PATH } from '../components/layout/backgroundPaths';
import styles from './CampaignHomeScreen.module.css';

/** A campaign match deals a 5-card hand - fewer units than this in the collection means no match can be fielded. */
const MIN_HAND_SIZE = 5;

export interface CampaignHomeScreenProps {
  /** Continue an active run - draw the next match's hand from the existing collection. */
  onContinue: () => void;
  /** Start a fresh run - goes to the campaign army builder. If a run is already active, the caller only receives this after the player confirms via this screen's own two-step prompt. */
  onStartNewRun: () => void;
}

export function CampaignHomeScreen({ onContinue, onStartNewRun }: CampaignHomeScreenProps) {
  const { isActive, collection, wins, losses, draws, unlockedAchievementIds } = useCampaignStore();
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);

  const canContinue = collection.length >= MIN_HAND_SIZE;
  const unlockedSet = new Set(unlockedAchievementIds);

  return (
    <div className={styles.screen}>
      <BackgroundLayer imagePath={HOME_BACKGROUND_PATH} />
      <div className={styles.panel}>
        <h1 className={styles.title}>Campaign</h1>

        <div className={styles.achievementsSection}>
          <h2 className={styles.sectionTitle}>
            Achievements ({unlockedAchievementIds.length}/{ACHIEVEMENTS.length})
          </h2>
          <div className={styles.achievementGrid}>
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = unlockedSet.has(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={[
                    styles.achievementBadge,
                    unlocked ? styles.achievementUnlocked : styles.achievementLocked,
                  ].join(' ')}
                >
                  <span className={styles.achievementName}>{achievement.name}</span>
                  <span className={styles.achievementDescription}>{achievement.description}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isActive ? (
          <>
            <div className={styles.statRow}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{collection.length}</span>
                <span className={styles.statLabel}>Cards owned</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{wins}</span>
                <span className={styles.statLabel}>Wins</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{losses}</span>
                <span className={styles.statLabel}>Losses</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{draws}</span>
                <span className={styles.statLabel}>Draws</span>
              </div>
            </div>

            {!canContinue && (
              <p className={styles.warning} role="alert">
                Your collection has fallen below {MIN_HAND_SIZE} cards - not enough to field a
                match. Start a new run to keep playing.
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.continueButton}
                disabled={!canContinue}
                onClick={onContinue}
              >
                Continue Campaign
              </button>

              {confirmingNewRun ? (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmText}>
                    This will permanently discard your current collection and record.
                  </span>
                  <button
                    type="button"
                    className={styles.confirmButton}
                    onClick={onStartNewRun}
                  >
                    Yes, Start Over
                  </button>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => setConfirmingNewRun(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.newRunButton}
                  onClick={() => setConfirmingNewRun(true)}
                >
                  Start New Run
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.description}>
              Build a starting roster, then keep playing across sessions - wins and losses are
              permanent, and cards you capture stay captured.
            </p>
            <button type="button" className={styles.newRunButton} onClick={onStartNewRun}>
              Start New Run
            </button>
          </>
        )}
      </div>
    </div>
  );
}