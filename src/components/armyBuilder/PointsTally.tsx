/**
 * Displays a live progress bar + numeric readout of points spent against
 * the chosen cap. Pure presentational - takes the already-computed
 * totalPoints/pointsCap rather than reading the store itself, so it can be
 * reused/tested independent of ArmyBuilder's store wiring.
 */
import styles from './PointsTally.module.css';

export interface PointsTallyProps {
  totalPoints: number;
  pointsCap: number | null;
}

export function PointsTally({ totalPoints, pointsCap }: PointsTallyProps) {
  const percent = pointsCap ? Math.min(100, (totalPoints / pointsCap) * 100) : 0;
  const remaining = pointsCap !== null ? pointsCap - totalPoints : null;

  return (
    <div className={styles.tally}>
      <div
        className={styles.barTrack}
        role="progressbar"
        aria-valuenow={totalPoints}
        aria-valuemin={0}
        aria-valuemax={pointsCap ?? undefined}
        aria-label="Points spent"
      >
        <div className={styles.barFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.numbers}>
        <span className={styles.spent}>
          {totalPoints}
          {pointsCap !== null ? ` / ${pointsCap}` : ''} pts
        </span>
        {remaining !== null && (
          <span className={styles.remaining}>{remaining} remaining</span>
        )}
      </div>
    </div>
  );
}