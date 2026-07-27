/**
 * A single "where do I stand" destination, combining two things that used
 * to live in different places: cross-mode card-unlock progress
 * (state/unlockStore.ts + data/unlockCriteria.ts - previously only
 * visible piecemeal, as a caption on individual locked cards) and
 * campaign achievements (previously embedded directly in
 * CampaignHomeScreen). Consolidated here on purpose: a player checking
 * "what am I working toward" shouldn't need to know achievements live in
 * one place and unlock tiers in another - both are long-running,
 * cross-session progress, so they belong on the same screen.
 *
 * Reads unlockStore and campaignStore directly (not purely
 * presentational) - this screen's whole purpose is showing live store
 * state, same reasoning CampaignHomeScreen/GameScreen already read their
 * stores directly rather than having everything passed in as props.
 *
 * Achievements are shown here even with no campaign run ever started -
 * same permanence CampaignHomeScreen's own achievement grid already had
 * (unlockedAchievementIds survives resetCampaign, see campaignStore's own
 * header) - this screen doesn't gate on isActive at all, unlike
 * CampaignHomeScreen which has real campaign-specific state to branch on.
 */
import { useCampaignStore } from '../state/campaignStore';
import { useUnlockStore } from '../state/unlockStore';
import { ACHIEVEMENTS } from '../state/achievements';
import { getTierUnlockCounts } from '../data/unlockCriteria';
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { HOME_BACKGROUND_PATH } from '../components/layout/backgroundPaths';
import styles from './ProgressScreen.module.css';

export interface ProgressScreenProps {
  onBack: () => void;
}

export function ProgressScreen({ onBack }: ProgressScreenProps) {
  const unlockState = useUnlockStore();
  const { unlockedAchievementIds, bestWinStreak } = useCampaignStore();

  const tierCounts = getTierUnlockCounts(unlockState);
  const factionsWonWith = Object.values(unlockState.winsByFaction).filter((w) => w > 0).length;
  const unlockedAchievementSet = new Set(unlockedAchievementIds);

  return (
    <div className={styles.screen}>
      <BackgroundLayer imagePath={HOME_BACKGROUND_PATH} />
      <div className={styles.panel}>
        <h1 className={styles.title}>Progress</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Card Collection</h2>

          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{unlockState.totalWins}</span>
              <span className={styles.statLabel}>Total Wins</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{factionsWonWith}</span>
              <span className={styles.statLabel}>Factions Won With</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{unlockState.sameOrPlusComboCount}</span>
              <span className={styles.statLabel}>Same/Plus Combos</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{unlockState.chainReactionCount}</span>
              <span className={styles.statLabel}>Chain Reactions</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{unlockState.flawlessWinFactions.length}</span>
              <span className={styles.statLabel}>Flawless-Win Factions</span>
            </div>
          </div>

          <ul className={styles.tierList} aria-label="Card unlock tiers">
            {tierCounts.map(({ tier, unlocked, total }) => {
              const percent = total === 0 ? 0 : Math.round((unlocked / total) * 100);
              return (
                <li key={tier.id} className={styles.tierRow}>
                  <div className={styles.tierHeader}>
                    <span className={styles.tierLabel}>{tier.label}</span>
                    <span className={styles.tierCount}>
                      {unlocked}/{total} unlocked
                    </span>
                  </div>
                  <div className={styles.tierBarTrack} aria-hidden="true">
                    <div className={styles.tierBarFill} style={{ width: `${percent}%` }} />
                  </div>
                  <p className={styles.tierDescription}>{tier.description}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Achievements ({unlockedAchievementIds.length}/{ACHIEVEMENTS.length})
          </h2>
          <p className={styles.bestStreak}>Best Win Streak: {bestWinStreak}</p>
          <div className={styles.achievementGrid}>
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = unlockedAchievementSet.has(achievement.id);
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
        </section>

        <button type="button" className={styles.backButton} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}