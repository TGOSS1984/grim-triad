import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomRuleSet } from './randomRuleSet';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('randomRuleSet', () => {
  it('produces a deterministic result when Math.random is mocked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    const ruleSet = randomRuleSet();

    expect(ruleSet).toEqual({
      open: true,
      suddenDeath: true,
      random: true,
      same: true,
      sameWall: true,
      plus: true,
      elemental: true,
      chain: true,
      heroic: true,
      combinedArms: true,
      underdog: true,
      epicHeroPresence: true,
      tradeRule: 'diff',
      winCondition: 'cards',
    });
  });

  it('produces a valid tradeRule value across many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const { tradeRule } = randomRuleSet();
      expect(['one', 'diff', 'direct', 'all']).toContain(tradeRule);
    }
  });

  it('never rolls an excluded trade rule, across many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const { tradeRule } = randomRuleSet({ excludeTradeRules: ['direct'] });
      expect(tradeRule).not.toBe('direct');
      expect(['one', 'diff', 'all']).toContain(tradeRule);
    }
  });

  it('still rolls direct when no exclusion is passed (default, unchanged behavior)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6); // index 2 of the unfiltered 4-option list = 'direct'

    expect(randomRuleSet().tradeRule).toBe('direct');
  });

  it('produces a valid winCondition value across many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const { winCondition } = randomRuleSet();
      expect(['cards', 'points']).toContain(winCondition);
    }
  });

  it('actually rolls both winCondition values across many rolls, not stuck on one', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomRuleSet().winCondition));
    expect(seen.has('cards')).toBe(true);
    expect(seen.has('points')).toBe(true);
  });

  it('rolls "points" specifically when Math.random favours it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // randomBool() = false -> 'points'

    expect(randomRuleSet().winCondition).toBe('points');
  });
});