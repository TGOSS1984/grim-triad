/**
 * Produces a fully random RuleSet. Used by RuleSelectScreen's "Randomize
 * Rules" button, and by App.tsx to auto-roll rules for every series mode
 * round (see SeriesIntroScreen/RoundSummaryScreen, which surface whatever
 * this produces to the player before each round starts) and for every
 * campaign mode match.
 *
 * Split into its own file (rather than living in RuleSelectScreen.tsx)
 * because mixing a component export with a plain function export in the
 * same file degrades Fast Refresh reliability during development - same
 * reasoning as layout/backgroundUtils.ts.
 */
import type { RuleSet } from '../../engine/types';

export interface RandomRuleSetOptions {
  /**
   * Trade rule values that should never be rolled. Campaign mode passes
   * `['direct']` here: resolveTradeRule's 'direct' case transfers zero
   * cards even on a win (see engine/rules/tradeRules.ts), which is fine
   * for a one-off single match but means a campaign win has a 1-in-4
   * chance of adding nothing at all to the player's persistent
   * collection - undermining the whole point of playing campaign mode.
   * Series mode and the manual "Randomize Rules" button both call this
   * with no options, so they're unaffected and still roll all four trade
   * rules as before.
   */
  excludeTradeRules?: RuleSet['tradeRule'][];
}

export function randomRuleSet(options: RandomRuleSetOptions = {}): RuleSet {
  const randomBool = () => Math.random() < 0.5;
  const excluded = new Set(options.excludeTradeRules ?? []);
  const tradeOptions: RuleSet['tradeRule'][] = (['one', 'diff', 'direct', 'all'] as const).filter(
    (rule) => !excluded.has(rule),
  );
  return {
    open: randomBool(),
    suddenDeath: randomBool(),
    random: randomBool(),
    same: randomBool(),
    sameWall: randomBool(),
    plus: randomBool(),
    elemental: randomBool(),
    chain: randomBool(),
    heroic: randomBool(),
    combinedArms: randomBool(),
    underdog: randomBool(),
    epicHeroPresence: randomBool(),
    tradeRule: tradeOptions[Math.floor(Math.random() * tradeOptions.length)],
    // Not yet randomized - RuleSet.winCondition is new (see
    // engine/types.ts), and this function's own randomization of it is
    // deliberately a separate, later commit alongside the UI that lets a
    // player actually choose it manually. Always 'cards' for now (the
    // only behaviour that existed before this field did), not a
    // regression - just not yet doing the new thing.
    winCondition: 'cards',
  };
}