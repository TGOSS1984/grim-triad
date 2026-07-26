import { describe, it, expect } from 'vitest';
import { TOGGLE_RULES, TRADE_RULES } from './ruleDescriptions';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';

describe('TOGGLE_RULES', () => {
  it('has exactly one entry per boolean key on RuleSet (every toggle rule is described, none extra)', () => {
    const ruleSetKeys = Object.keys(DEFAULT_RULE_SET).filter((k) => k !== 'tradeRule').sort();
    const describedKeys = TOGGLE_RULES.map((r) => r.key).sort();
    expect(describedKeys).toEqual(ruleSetKeys);
  });

  it('has no duplicate keys', () => {
    const keys = TOGGLE_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a non-empty label and description', () => {
    for (const rule of TOGGLE_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });
});

describe('TRADE_RULES', () => {
  it('has exactly one entry per RuleSet["tradeRule"] value', () => {
    const keys = TRADE_RULES.map((r) => r.key).sort();
    expect(keys).toEqual(['all', 'diff', 'direct', 'one']);
  });

  it('has no duplicate keys', () => {
    const keys = TRADE_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a non-empty label and description', () => {
    for (const rule of TRADE_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });
});