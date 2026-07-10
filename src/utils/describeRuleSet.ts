/**
 * Describes which optional rules are active in a RuleSet as short,
 * human-readable labels - e.g. for surfacing a randomly-rolled ruleset to
 * the player before a series round starts (see RoundSummaryScreen).
 *
 * Deliberately its own small standalone list rather than reusing
 * RuleSelectScreen's internal TOGGLE_RULES/TRADE_RULES data (which carries
 * full descriptions meant for a picker UI, not a compact summary) - a
 * little duplication of short label strings is simpler than coupling two
 * very different UI needs to the same data.
 */
import type { RuleSet } from '../engine/types';

const TRADE_RULE_LABELS: Record<RuleSet['tradeRule'], string> = {
  one: 'Trade Rule: One',
  diff: 'Trade Rule: Diff',
  direct: 'Trade Rule: Direct',
  all: 'Trade Rule: All',
};

/** Returns a list of short labels for every active optional rule, always including the Trade Rule. */
export function describeRuleSet(ruleSet: RuleSet): string[] {
  const labels: string[] = [];
  if (ruleSet.open) labels.push('Open');
  if (ruleSet.suddenDeath) labels.push('Sudden Death');
  if (ruleSet.random) labels.push('Random');
  if (ruleSet.same) labels.push('Same');
  if (ruleSet.sameWall) labels.push('Same Wall');
  if (ruleSet.plus) labels.push('Plus');
  if (ruleSet.elemental) labels.push('Elemental');
  if (ruleSet.chain) labels.push('Chain');
  labels.push(TRADE_RULE_LABELS[ruleSet.tradeRule]);
  return labels;
}