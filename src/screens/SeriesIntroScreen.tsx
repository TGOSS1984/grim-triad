/**
 * Shown once, before a series' very first round - surfaces its randomly-
 * rolled rules (same requirement as every subsequent round via
 * RoundSummaryScreen: "these would need to be surfaced each round so we
 * can see"). Round 1 has no previous round to summarize, so this is a
 * smaller, dedicated screen rather than a special-cased RoundSummaryScreen.
 */
import type { RuleSet } from '../engine/types';
import { describeRuleSet } from '../utils/describeRuleSet';
import styles from './SeriesIntroScreen.module.css';

export interface SeriesIntroScreenProps {
  poolSize: number;
  round1RuleSet: RuleSet;
  onContinue: () => void;
}

export function SeriesIntroScreen({ poolSize, round1RuleSet, onContinue }: SeriesIntroScreenProps) {
  const rules = describeRuleSet(round1RuleSet);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Series Begins</h1>
      <p className={styles.poolNote}>
        {poolSize}-card pool &middot; up to {Math.floor(poolSize / 5)} rounds
      </p>

      <div className={styles.rulesBlock}>
        <h2 className={styles.rulesTitle}>Round 1 Rules</h2>
        <ul className={styles.rulesList}>
          {rules.map((label) => (
            <li key={label} className={styles.ruleItem}>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className={styles.startButton} onClick={onContinue}>
        Start Round 1
      </button>
    </div>
  );
}