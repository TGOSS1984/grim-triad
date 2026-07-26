/**
 * Human-readable descriptions of every optional rule modifier and trade
 * rule (engine/types.ts's RuleSet). Extracted from RuleSelectScreen (this
 * copy used to live there as a private array) so more than one UI can
 * show the same explanations without them drifting apart - originally
 * RuleSelectScreen's own picker, now also screens/HowToPlayScreen.tsx's
 * rules reference. A pure refactor: this data is unchanged from what
 * RuleSelectScreen already had, just relocated so it has one home instead
 * of being copy-pasted a second time.
 */
import type { RuleSet } from '../engine/types';

export type ToggleRuleKey = keyof Omit<RuleSet, 'tradeRule'>;

export interface ToggleRuleInfo {
  key: ToggleRuleKey;
  label: string;
  description: string;
}

export const TOGGLE_RULES: ToggleRuleInfo[] = [
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
  {
    key: 'chain',
    label: 'Chain',
    description:
      'A capture can trigger a chain reaction: each card it flips immediately checks its own other neighbors too.',
  },
  {
    key: 'heroic',
    label: 'Heroic',
    description:
      "Epic Hero units can't be captured by Same or Plus - only a genuine higher-value capture can take them down.",
  },
  {
    key: 'combinedArms',
    label: 'Combined Arms',
    description:
      'Two adjacent friendly cards of different unit types each get +1 on the side facing each other.',
  },
  {
    key: 'underdog',
    label: 'Underdog',
    description:
      'The first time a card captures something costing 50%+ more than itself, it permanently gains +1 on all sides.',
  },
  {
    key: 'epicHeroPresence',
    label: 'Epic Hero Presence',
    description:
      "If your starting hand has an Epic Hero, all your cards get +1 on one randomly chosen side for the match.",
  },
];

export interface TradeRuleInfo {
  key: RuleSet['tradeRule'];
  label: string;
  description: string;
}

export const TRADE_RULES: TradeRuleInfo[] = [
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