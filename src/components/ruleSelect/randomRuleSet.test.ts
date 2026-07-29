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
});