/**
 * Shown between rounds of a series: the outcome of the round that just
 * finished, running pool/win tallies, and - critically - the NEXT round's
 * randomly-rolled rules, surfaced clearly before the player continues
 * (per the original request: "these would need to be surfaced each round
 * so we can see"). Pure presentational, takes everything it needs as
 * props - App-level orchestration owns reading from gameStore/seriesStore
 * and rolling the next round's rules.
 */
import type { PlayerColour, RuleSet } from '../engine/types';
import { describeRuleSet } from '../utils/describeRuleSet';
import { getUnitById } from '../data/activeFactions';
import styles from './RoundSummaryScreen.module.css';

export interface RoundSummaryScreenProps {
  /** The round number that just finished. */
  roundNumber: number;
  winner: PlayerColour;
  bluePoolRemaining: number;
  redPoolRemaining: number;
  blueWins: number;
  redWins: number;
  /** Which units moved via the Trade Rule this round, and to which side - see seriesStore's RoundRecord. Named, not just counted, so the player can actually see what happened (this used to be a bare count, which made a real mechanic feel invisible - see the commit that added this). */
  tradeTransferred: { unitId: string; to: PlayerColour }[];
  /** Already-rolled rules for the upcoming round. */
  nextRoundRuleSet: RuleSet;
  onContinue: () => void;
}

export function RoundSummaryScreen({
  roundNumber,
  winner,
  bluePoolRemaining,
  redPoolRemaining,
  blueWins,
  redWins,
  tradeTransferred,
  nextRoundRuleSet,
  onContinue,
}: RoundSummaryScreenProps) {
  const nextRoundRules = describeRuleSet(nextRoundRuleSet);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>
        Round {roundNumber}: {winner === 'blue' ? 'Blue' : 'Red'} Wins
      </h1>

      {tradeTransferred.length > 0 && (
        <div className={styles.tradeSection}>
          <p className={styles.tradeNote}>
            {tradeTransferred.length} card{tradeTransferred.length === 1 ? '' : 's'} changed hands
            via the Trade Rule:
          </p>
          <ul className={styles.tradeList}>
            {tradeTransferred.map((t, i) => {
              const from: PlayerColour = t.to === 'blue' ? 'red' : 'blue';
              return (
                <li key={`${t.unitId}-${i}`}>
                  {getUnitById(t.unitId)?.name ?? 'Unknown Unit'} moves from {from} to {t.to}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={styles.tallyRow}>
        <div className={styles.tallyBlock}>
          <span className={styles.tallyLabel}>Blue</span>
          <span className={styles.tallyWins}>{blueWins} round wins</span>
          <span className={styles.tallyPool}>{bluePoolRemaining} cards remaining</span>
        </div>
        <div className={styles.tallyBlock}>
          <span className={styles.tallyLabel}>Red</span>
          <span className={styles.tallyWins}>{redWins} round wins</span>
          <span className={styles.tallyPool}>{redPoolRemaining} cards remaining</span>
        </div>
      </div>

      <div className={styles.nextRoundBlock}>
        <h2 className={styles.nextRoundTitle}>Round {roundNumber + 1} Rules</h2>
        <ul className={styles.rulesList}>
          {nextRoundRules.map((label) => (
            <li key={label} className={styles.ruleItem}>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className={styles.continueButton} onClick={onContinue}>
        Continue to Round {roundNumber + 1}
      </button>
    </div>
  );
}