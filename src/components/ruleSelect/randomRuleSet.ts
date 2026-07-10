/**
 * Produces a fully random RuleSet. Used by RuleSelectScreen's "Randomize
 * Rules" button, and by App.tsx to auto-roll rules for every series mode
 * round (see SeriesIntroScreen/RoundSummaryScreen, which surface whatever
 * this produces to the player before each round starts).
 *
 * Split into its own file (rather than living in RuleSelectScreen.tsx)
 * because mixing a component export with a plain function export in the
 * same file degrades Fast Refresh reliability during development - same
 * reasoning as layout/backgroundUtils.ts.
 */
import type { RuleSet } from '../../engine/types';

export function randomRuleSet(): RuleSet {
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
    chain: randomBool(),
    tradeRule: tradeOptions[Math.floor(Math.random() * tradeOptions.length)],
  };
}