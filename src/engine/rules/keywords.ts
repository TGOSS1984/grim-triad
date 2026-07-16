/**
 * Keyword-gated rule checks, shared by whichever rule modules need them -
 * centralizes the literal keyword strings (matching data/schema.ts's
 * Unit.keywords, sourced from the real catalog - see units.generated.json)
 * in one place rather than scattering 'Epic Hero'/'Psyker' string literals
 * across same.ts/plus.ts/elemental.ts/ruleEngine.ts.
 */
import type { Card } from '../types';

const EPIC_HERO_KEYWORD = 'Epic Hero';
const PSYKER_KEYWORD = 'Psyker';

function hasKeyword(card: Card, keyword: string): boolean {
  return card.keywords?.includes(keyword) ?? false;
}

/** True for the game's named/unique characters (e.g. Guilliman, Calgar) - see RuleSet.heroic's own doc. */
export function isEpicHero(card: Card): boolean {
  return hasKeyword(card, EPIC_HERO_KEYWORD);
}

/** True for psychic units - see elemental.ts's getEffectiveStats, which gives these a pass on Elemental's mismatch penalty. */
export function isPsyker(card: Card): boolean {
  return hasKeyword(card, PSYKER_KEYWORD);
}