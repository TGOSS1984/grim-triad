import { describe, it, expect } from 'vitest';
import { TOGGLE_RULES, TRADE_RULES, WIN_CONDITIONS } from './ruleDescriptions';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';

describe('TOGGLE_RULES', () => {
  it('has exactly one entry per boolean key on RuleSet (every toggle rule is described, none extra)', () => {
    const ruleSetKeys = Object.keys(DEFAULT_RULE_SET)
      .filter((k) => k !== 'tradeRule' && k !== 'winCondition')
      .sort();
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

describe('WIN_CONDITIONS', () => {
  it('has exactly one entry per RuleSet["winCondition"] value', () => {
    const keys = WIN_CONDITIONS.map((c) => c.key).sort();
    expect(keys).toEqual(['cards', 'points']);
  });

  it('has no duplicate keys', () => {
    const keys = WIN_CONDITIONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a non-empty label and description', () => {
    for (const condition of WIN_CONDITIONS) {
      expect(condition.label.length).toBeGreaterThan(0);
      expect(condition.description.length).toBeGreaterThan(0);
    }
  });

  it('includes "cards" matching the default, pre-existing behaviour', () => {
    expect(DEFAULT_RULE_SET.winCondition).toBe('cards');
    expect(WIN_CONDITIONS.map((c) => c.key)).toContain('cards');
  });
});