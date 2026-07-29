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
 *
 * Layout: 12 optional rules plus 4 trade rule options plus 2 win
 * condition options is a lot of scrolling on a phone screen before ever
 * reaching Randomize/Continue - exactly the same problem FactionSelect
 * solved for a long faction list. Two changes address it, mirroring that
 * same solution:
 *  - Randomize Rules and Continue sit right below the title, ALWAYS
 *    visible with no scrolling - a player who doesn't want to fuss with
 *    individual rules can act immediately, at any screen size.
 *  - Optional Rules, Trade Rule, and Win Condition are each a collapsible
 *    accordion section (only one open at a time, same interaction as
 *    FactionSelect's Imperium/Chaos/Xenos groups), all collapsed by
 *    default. Unlike FactionSelect, there's no single "most relevant"
 *    group to pre-open here (no current selection to highlight the way a
 *    chosen faction does) and the fast path above already covers "I just
 *    want to play" - so starting fully collapsed maximizes the actual
 *    scroll reduction rather than leaving one large section open by
 *    default. Each collapsed header still shows a live summary (how many
 *    optional rules are on; which trade rule/win condition is currently
 *    selected) so the current configuration is visible without opening
 *    anything.
 *
 * Win Condition gets its OWN section rather than being folded into Trade
 * Rule, even though both are conceptually about "how the match resolves"
 * rather than what happens during play (the same reason it isn't just
 * another entry in Optional Rules - see RuleSet.winCondition's own doc in
 * engine/types.ts): they're two genuinely independent decisions (how the
 * winner is decided; what happens to the cards once they are), and
 * cramming both into one section risked reading as if they were related
 * or dependent when they aren't.
 */
import { useState } from 'react';
import type { RuleSet } from '../../engine/types';
import { DEFAULT_RULE_SET } from '../../engine/gameReducer';
import {
  TOGGLE_RULES,
  TRADE_RULES,
  WIN_CONDITIONS,
  type ToggleRuleKey,
} from '../../data/ruleDescriptions';
import { randomRuleSet } from './randomRuleSet';
import styles from './RuleSelectScreen.module.css';

export interface RuleSelectScreenProps {
  onContinue: (ruleSet: RuleSet) => void;
  initialRuleSet?: RuleSet;
}

type RuleSection = 'optional' | 'trade' | 'winCondition';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={[styles.sectionChevron, open ? styles.sectionChevronOpen : ''].join(' ')}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6 L8 10 L12 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RuleSelectScreen({
  onContinue,
  initialRuleSet = DEFAULT_RULE_SET,
}: RuleSelectScreenProps) {
  const [ruleSet, setRuleSet] = useState<RuleSet>(initialRuleSet);
  // Both sections start collapsed - see file header for why this differs
  // from FactionSelect always having one group open.
  const [openSection, setOpenSection] = useState<RuleSection | null>(null);

  function toggleRule(key: ToggleRuleKey) {
    setRuleSet((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleSection(section: RuleSection) {
    setOpenSection((current) => (current === section ? null : section));
  }

  const activeOptionalCount = TOGGLE_RULES.filter((rule) => ruleSet[rule.key]).length;
  const selectedTradeRule = TRADE_RULES.find((rule) => rule.key === ruleSet.tradeRule);
  const selectedWinCondition = WIN_CONDITIONS.find((c) => c.key === ruleSet.winCondition);

  const isOptionalOpen = openSection === 'optional';
  const isTradeOpen = openSection === 'trade';
  const isWinConditionOpen = openSection === 'winCondition';

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>Match Rules</h2>

      {/* Always visible, no scrolling required - see file header. */}
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

      <div className={styles.sections}>
        <div className={styles.section}>
          <button
            type="button"
            className={[styles.sectionHeader, isOptionalOpen ? styles.sectionHeaderOpen : ''].join(
              ' ',
            )}
            aria-expanded={isOptionalOpen}
            aria-controls="rule-section-optional"
            onClick={() => toggleSection('optional')}
          >
            <span className={styles.sectionName}>Optional Rules</span>
            <span className={styles.sectionSummary}>
              {activeOptionalCount} active
            </span>
            <Chevron open={isOptionalOpen} />
          </button>
          <div
            id="rule-section-optional"
            className={[styles.sectionBody, isOptionalOpen ? styles.sectionBodyOpen : ''].join(' ')}
          >
            <div className={styles.sectionBodyInner}>
              <div
                className={styles.toggleGrid}
                role="group"
                aria-label="Optional rule modifiers"
              >
                {TOGGLE_RULES.map((rule) => (
                  <label key={rule.key} className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={ruleSet[rule.key]}
                      onChange={() => toggleRule(rule.key)}
                    />
                    <span className={styles.toggleLabel}>{rule.label}</span>
                    <span className={styles.toggleDescription}>{rule.description}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <button
            type="button"
            className={[styles.sectionHeader, isTradeOpen ? styles.sectionHeaderOpen : ''].join(
              ' ',
            )}
            aria-expanded={isTradeOpen}
            aria-controls="rule-section-trade"
            onClick={() => toggleSection('trade')}
          >
            <span className={styles.sectionName}>Trade Rule</span>
            <span className={styles.sectionSummary}>{selectedTradeRule?.label}</span>
            <Chevron open={isTradeOpen} />
          </button>
          <div
            id="rule-section-trade"
            className={[styles.sectionBody, isTradeOpen ? styles.sectionBodyOpen : ''].join(' ')}
          >
            <div className={styles.sectionBodyInner}>
              <fieldset className={styles.tradeFieldset}>
                <legend className={styles.srOnly}>Trade Rule</legend>
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
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <button
            type="button"
            className={[
              styles.sectionHeader,
              isWinConditionOpen ? styles.sectionHeaderOpen : '',
            ].join(' ')}
            aria-expanded={isWinConditionOpen}
            aria-controls="rule-section-win-condition"
            onClick={() => toggleSection('winCondition')}
          >
            <span className={styles.sectionName}>Win Condition</span>
            <span className={styles.sectionSummary}>{selectedWinCondition?.label}</span>
            <Chevron open={isWinConditionOpen} />
          </button>
          <div
            id="rule-section-win-condition"
            className={[
              styles.sectionBody,
              isWinConditionOpen ? styles.sectionBodyOpen : '',
            ].join(' ')}
          >
            <div className={styles.sectionBodyInner}>
              <fieldset className={styles.tradeFieldset}>
                <legend className={styles.srOnly}>Win Condition</legend>
                {WIN_CONDITIONS.map((option) => (
                  <label key={option.key} className={styles.toggleRow}>
                    <input
                      type="radio"
                      name="winCondition"
                      checked={ruleSet.winCondition === option.key}
                      onChange={() =>
                        setRuleSet((prev) => ({ ...prev, winCondition: option.key }))
                      }
                    />
                    <span className={styles.toggleLabel}>{option.label}</span>
                    <span className={styles.toggleDescription}>{option.description}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}