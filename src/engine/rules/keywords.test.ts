import { describe, it, expect } from 'vitest';
import { isEpicHero, isPsyker } from './keywords';
import type { Card } from '../types';

function makeCard(keywords?: string[]): Card {
  return {
    instanceId: 'test-1',
    unitId: 'test-unit',
    owner: 'blue',
    stats: { top: 5, bottom: 5, left: 5, right: 5 },
    keywords,
  };
}

describe('isEpicHero', () => {
  it('is true for a card with the Epic Hero keyword', () => {
    expect(isEpicHero(makeCard(['Character', 'Epic Hero']))).toBe(true);
  });

  it('is false for a card without it', () => {
    expect(isEpicHero(makeCard(['Character', 'Infantry']))).toBe(false);
  });

  it('is false for a card with no keywords at all (undefined), not a crash', () => {
    expect(isEpicHero(makeCard(undefined))).toBe(false);
  });

  it('is false for a card with an empty keywords array', () => {
    expect(isEpicHero(makeCard([]))).toBe(false);
  });
});

describe('isPsyker', () => {
  it('is true for a card with the Psyker keyword', () => {
    expect(isPsyker(makeCard(['Character', 'Psyker']))).toBe(true);
  });

  it('is false for a card without it', () => {
    expect(isPsyker(makeCard(['Character', 'Epic Hero']))).toBe(false);
  });

  it('is false for a card with no keywords at all (undefined), not a crash', () => {
    expect(isPsyker(makeCard(undefined))).toBe(false);
  });
});