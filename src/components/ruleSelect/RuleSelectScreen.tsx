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
 */
import { useState } from 'react';
import type { RuleSet } from '../../engine/types';
import { DEFAULT_RULE_SET } from '../../engine/gameReducer';
import styles from './RuleSelectScreen.module.css';

export interface RuleSelectScreenProps {
  onContinue: (ruleSet: RuleSet) => void;
  initialRuleSet?: RuleSet;
}

type ToggleRuleKey = keyof Omit<RuleSet, 'tradeRule'>;

interface ToggleRuleInfo {
  key: ToggleRuleKey;
  label: string;
  description: string;
}

const TOGGLE_RULES: ToggleRuleInfo[] = [
  { key: 'open', label: 'Open', description: "Both players' hands are visible." },
  {
    key: 'suddenDeath',
    label: 'Sudden Death',
    description: "A draw is replayed immediately using each side's controlled cards.",
  },
  { key: 'random', label: 'Random', description: 'Your hand is drawn randomly from your army.' },
  {
    key: 'same',
    label: 'Same',
    description: 'Matching adjacent values on 2+ sides capture, regardless of strength.',
  },
  {
    key: 'sameWall',
    label: 'Same Wall',
    description: 'Board edges count as rank A for Same combos (has no effect unless Same is also on).',
  },
  {
    key: 'plus',
    label: 'Plus',
    description: 'Matching sums on 2+ sides capture, regardless of strength.',
  },
  {
    key: 'elemental',
    label: 'Elemental',
    description: 'Random tiles boost or weaken cards by matching or mismatched element.',
  },
];

interface TradeRuleInfo {
  key: RuleSet['tradeRule'];
  label: string;
  description: string;
}

const TRADE_RULES: TradeRuleInfo[] = [
  { key: 'one', label: 'One', description: 'Winner takes one card from the loser.' },
  {
    key: 'diff',
    label: 'Diff',
    description: "Winner takes cards equal to their margin of victory (all, if the margin exceeds 5).",
  },
  {
    key: 'direct',
    label: 'Direct',
    description: 'Each side keeps whatever they controlled at the end - no transfer.',
  },
  { key: 'all', label: 'All', description: "Winner takes every one of the loser's cards." },
];

function randomRuleSet(): RuleSet {
  const randomBool = () => Math.random() < 0.5;
  const tradeOptions: RuleSet['tradeRule'][] = ['one', 'diff', 'direct', 'all'];
  return {
    open: randomBool(),
    suddenDeath: randomBool(),
    random: randomBool(),
    same: randomBool(),
    sameWall: randomBool(),
    plus: randomBool(),
    elemental: randomBool(),
    tradeRule: tradeOptions[Math.floor(Math.random() * tradeOptions.length)],
  };
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