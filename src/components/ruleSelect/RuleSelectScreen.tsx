/**
 * Lets the player choose which optional rule modifiers are active for the
 * upcoming match, producing a RuleSet (engine/types.ts) to pass into
 * createGame. A single self-contained file per ROADMAP.md's plan - unlike
 * ArmyBuilder this has no store/data dependency and no sub-components
 * complex enough to warrant splitting out, so screen and component are one
 * here rather than the screens/ + components/ split used elsewhere.
 *
 * Includes a "Randomize Rules" button addressing the open question from
 * the original brief ("not sure if we randomise these") - gives quick
 * variety without forcing the player to manually configure every match.
 *
 * TOGGLE_RULES/TRADE_RULES (the label + description for every rule) now
 * live in data/ruleDescriptions.ts, not here - this screen used to be the
 * only place that copy existed, but screens/HowToPlayScreen.tsx also
 * needs to show the same explanations, and two independently-maintained
 * copies of the same 16 rules' descriptions would inevitably drift apart.
 * This screen still owns the actual toggle/radio INTERACTION (the shared
 * module is pure label/description data, no UI concerns), just not the
 * copy itself anymore.
 */
import { useState } from 'react';
import type { RuleSet } from '../../engine/types';
import { DEFAULT_RULE_SET } from '../../engine/gameReducer';
import { TOGGLE_RULES, TRADE_RULES, type ToggleRuleKey } from '../../data/ruleDescriptions';
import { randomRuleSet } from './randomRuleSet';
import styles from './RuleSelectScreen.module.css';

export interface RuleSelectScreenProps {
  onContinue: (ruleSet: RuleSet) => void;
  initialRuleSet?: RuleSet;
}

export function RuleSelectScreen({
  onContinue,
  initialRuleSet = DEFAULT_RULE_SET,
}: RuleSelectScreenProps) {
  const [ruleSet, setRuleSet] = useState<RuleSet>(initialRuleSet);

  function toggleRule(key: ToggleRuleKey) {
    setRuleSet((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>Match Rules</h2>

      <div className={styles.toggleGrid} role="group" aria-label="Optional rule modifiers">
        {TOGGLE_RULES.map((rule) => (
          <label key={rule.key} className={styles.toggleRow}>
            <input type="checkbox" checked={ruleSet[rule.key]} onChange={() => toggleRule(rule.key)} />
            <span className={styles.toggleLabel}>{rule.label}</span>
            <span className={styles.toggleDescription}>{rule.description}</span>
          </label>
        ))}
      </div>

      <fieldset className={styles.tradeFieldset}>
        <legend className={styles.title}>Trade Rule</legend>
        {TRADE_RULES.map((option) => (
          <label key={option.key} className={styles.toggleRow}>
            <input
              type="radio"
              name="tradeRule"
              checked={ruleSet.tradeRule === option.key}
              onChange={() => setRuleSet((prev) => ({ ...prev, tradeRule: option.key }))}
            />
            <span className={styles.toggleLabel}>{option.label}</span>
            <span className={styles.toggleDescription}>{option.description}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.randomizeButton}
          onClick={() => setRuleSet(randomRuleSet())}
        >
          Randomize Rules
        </button>
        <button type="button" className={styles.continueButton} onClick={() => onContinue(ruleSet)}>
          Continue
        </button>
      </div>
    </div>
  );
}