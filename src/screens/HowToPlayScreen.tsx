/**
 * A static reference screen explaining how a match actually works - the
 * basic capture mechanic, every optional rule modifier, every trade
 * rule, every win condition, and what each game mode offers. Pure
 * presentational (no store access, matching HomeScreen/ModeSelectScreen's
 * pattern) - this is reference content, not live game state.
 *
 * Tabbed rather than one long scroll or an accordion (contrast
 * FactionSelect's accordion, or CampaignVictoryModal's single-screen
 * layout): "Optional Rules" alone is 12 items, long enough that an
 * accordion panel would dominate the screen even collapsed, and a single
 * scroll would bury "Game Modes" beneath 16+ rules' worth of text. Tabs
 * keep exactly one section's content on screen at a time regardless of
 * that section's own length.
 *
 * Win Condition gets its own tab rather than being folded into Trade
 * Rules, even though a short 2-option list could easily fit alongside
 * Trade Rules' own list in one tab - this mirrors RuleSelectScreen's own
 * choice to give Win Condition its own accordion section rather than
 * merging it with Trade Rule (see that screen's own header for the full
 * reasoning: they're genuinely independent decisions). Matching that same
 * structure here means a player sees the identical grouping in both the
 * reference and the actual picker, rather than this screen inventing a
 * different organization for the same underlying rules.
 *
 * Rule/trade rule/win condition copy is imported from
 * data/ruleDescriptions.ts, not duplicated here - see that module's own
 * header for why: this screen and RuleSelectScreen's picker need to
 * describe the same rules identically, and two independently-maintained
 * copies would drift. GAME_MODES below is NOT similarly extracted -
 * ModeSelectScreen's own blurbs are single-sentence teasers for a
 * selection screen, while this needs fuller explanations for a reference
 * screen; they're related but not the same copy the way rule descriptions
 * are, so there's no shared source to extract without forcing one of the
 * two purposes to compromise.
 */
import { useState } from 'react';
import { TOGGLE_RULES, TRADE_RULES, WIN_CONDITIONS } from '../data/ruleDescriptions';
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { HOME_BACKGROUND_PATH } from '../components/layout/backgroundPaths';
import styles from './HowToPlayScreen.module.css';

export interface HowToPlayScreenProps {
  onBack: () => void;
}

type Tab = 'basics' | 'rules' | 'tradeRules' | 'winCondition' | 'modes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'basics', label: 'The Basics' },
  { id: 'rules', label: 'Optional Rules' },
  { id: 'tradeRules', label: 'Trade Rules' },
  { id: 'winCondition', label: 'Win Condition' },
  { id: 'modes', label: 'Game Modes' },
];

interface GameModeInfo {
  name: string;
  description: string;
}

const GAME_MODES: GameModeInfo[] = [
  {
    name: 'Single Match',
    description:
      'One battle, a 5-card hand drawn from whatever army you build. Winner takes the match. The fastest way to play - build a roster, choose rules, go.',
  },
  {
    name: 'Series',
    description:
      "Build a bigger army pool (a multiple of 5, your choice), then play consecutive rounds - each round draws a fresh 5-card hand with no repeats across the whole series. Depending on the Trade Rule, losing cards in one round can mean fielding a smaller hand in the next, so a series rewards a well-rounded pool, not just your 5 strongest units. Ends when one side can no longer field a full hand.",
  },
  {
    name: 'Campaign',
    description:
      "Build a 15-card starting roster, then keep playing across sessions - your collection, win/loss record, and streaks all persist. Wins add cards to your collection, losses take them away, so your roster genuinely evolves match to match. The AI rival has its own persistent, depletable pool too - grind it down far enough and it needs reinforcements to keep fighting. Achievements and card-collection unlock progress (see the Progress screen) both apply here, and everywhere else - a Single Match or Series win counts just as much as a Campaign win.",
  },
];

export function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basics');

  return (
    <div className={styles.screen}>
      <BackgroundLayer imagePath={HOME_BACKGROUND_PATH} />
      <div className={styles.panel}>
        <h1 className={styles.title}>How to Play</h1>

        <div className={styles.tabBar} role="tablist" aria-label="How to Play sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={[styles.tabButton, activeTab === tab.id ? styles.tabButtonActive : ''].join(
                ' ',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent} role="tabpanel">
          {activeTab === 'basics' && (
            <div className={styles.basicsContent}>
              <p>
                The board is a 3&times;3 grid. Players take turns placing one card from their
                hand onto any empty cell - blue and red alternate, five cards each, until the
                board is full.
              </p>
              <p>
                Every card has four values, one per edge: top, bottom, left, and right. When you
                place a card, it checks each occupied neighbor it's now touching. For each
                neighbor, compare your card's value on the side facing them to their value on the
                side facing you - if yours is higher, you capture their card and it flips to your
                colour.
              </p>
              <p>
                That's the whole core loop: place, compare, capture. Optional rules (see the next
                tab) layer extra ways to capture - or protect against being captured - on top of
                this base mechanic; none of them replace it.
              </p>
              <p>
                Once all 9 cells are filled, the match ends. By default, whoever controls more
                cards on the board wins - a tie is a draw - but the active Win Condition can
                change that (see that tab). What happens to the cards themselves afterward
                depends on the active Trade Rule (see that tab too).
              </p>
            </div>
          )}

          {activeTab === 'rules' && (
            <ul className={styles.ruleList} aria-label="Optional rules">
              {TOGGLE_RULES.map((rule) => (
                <li key={rule.key} className={styles.ruleRow}>
                  <span className={styles.ruleLabel}>{rule.label}</span>
                  <p className={styles.ruleDescription}>{rule.description}</p>
                </li>
              ))}
            </ul>
          )}

          {activeTab === 'tradeRules' && (
            <>
              <p className={styles.tradeRulesIntro}>
                Exactly one Trade Rule is active per match, deciding what happens to captured
                cards once the match ends.
              </p>
              <ul className={styles.ruleList} aria-label="Trade rules">
                {TRADE_RULES.map((rule) => (
                  <li key={rule.key} className={styles.ruleRow}>
                    <span className={styles.ruleLabel}>{rule.label}</span>
                    <p className={styles.ruleDescription}>{rule.description}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {activeTab === 'winCondition' && (
            <>
              <p className={styles.tradeRulesIntro}>
                Exactly one Win Condition is active per match, deciding how the winner itself is
                determined once the board is full - a different decision from the Trade Rule
                above, which only decides what happens to the cards once the winner is already
                known.
              </p>
              <ul className={styles.ruleList} aria-label="Win conditions">
                {WIN_CONDITIONS.map((condition) => (
                  <li key={condition.key} className={styles.ruleRow}>
                    <span className={styles.ruleLabel}>{condition.label}</span>
                    <p className={styles.ruleDescription}>{condition.description}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {activeTab === 'modes' && (
            <ul className={styles.modeList} aria-label="Game modes">
              {GAME_MODES.map((mode) => (
                <li key={mode.name} className={styles.modeRow}>
                  <span className={styles.modeName}>{mode.name}</span>
                  <p className={styles.modeDescription}>{mode.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" className={styles.backButton} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}