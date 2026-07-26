import { describe, it, expect } from 'vitest';
import { resolvePrimaryCaptureTriggerKind } from './captureTriggerKind';

describe('resolvePrimaryCaptureTriggerKind', () => {
  it('returns null for no captures at all', () => {
    expect(resolvePrimaryCaptureTriggerKind(undefined)).toBeNull();
    expect(resolvePrimaryCaptureTriggerKind([])).toBeNull();
  });

  it('returns null for a plain base capture - not a Same/Plus/Chain moment', () => {
    expect(resolvePrimaryCaptureTriggerKind(['base'])).toBeNull();
    expect(resolvePrimaryCaptureTriggerKind(['base', 'base'])).toBeNull();
  });

  it('returns "same" when same is present, even alongside other kinds', () => {
    expect(resolvePrimaryCaptureTriggerKind(['same'])).toBe('same');
    expect(resolvePrimaryCaptureTriggerKind(['same', 'cascade'])).toBe('same');
    expect(resolvePrimaryCaptureTriggerKind(['base', 'same'])).toBe('same');
  });

  it('returns "plus" when plus is present (and same is not)', () => {
    expect(resolvePrimaryCaptureTriggerKind(['plus'])).toBe('plus');
    expect(resolvePrimaryCaptureTriggerKind(['plus', 'cascade'])).toBe('plus');
  });

  it('prioritizes "same" over "plus" if both somehow appear together', () => {
    expect(resolvePrimaryCaptureTriggerKind(['same', 'plus'])).toBe('same');
  });

  it('returns "chain" for a standalone cascade with no same/plus initiator', () => {
    expect(resolvePrimaryCaptureTriggerKind(['base', 'cascade'])).toBe('chain');
    expect(resolvePrimaryCaptureTriggerKind(['cascade'])).toBe('chain');
  });
});