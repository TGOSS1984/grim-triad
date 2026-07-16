import { describe, it, expect } from 'vitest';
import { describeRuleSet } from './describeRuleSet';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';

describe('describeRuleSet', () => {
  it('lists only the Trade Rule when everything else is off', () => {
    expect(describeRuleSet(DEFAULT_RULE_SET)).toEqual(['Trade Rule: One']);
  });

  it('lists every active toggle rule plus the Trade Rule', () => {
    const labels = describeRuleSet({
      ...DEFAULT_RULE_SET,
      open: true,
      same: true,
      elemental: true,
      tradeRule: 'diff',
    });

    expect(labels).toEqual(['Open', 'Same', 'Elemental', 'Trade Rule: Diff']);
  });

  it('reflects each of the 4 trade rule options correctly', () => {
    expect(describeRuleSet({ ...DEFAULT_RULE_SET, tradeRule: 'all' })).toContain('Trade Rule: All');
    expect(describeRuleSet({ ...DEFAULT_RULE_SET, tradeRule: 'direct' })).toContain(
      'Trade Rule: Direct',
    );
  });

  it('includes the Heroic label when active', () => {
    const labels = describeRuleSet({ ...DEFAULT_RULE_SET, heroic: true });
    expect(labels).toContain('Heroic');
  });

  it('always includes the Trade Rule label even with nothing else active', () => {
    const labels = describeRuleSet(DEFAULT_RULE_SET);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toContain('Trade Rule');
  });
});