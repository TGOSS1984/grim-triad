import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildRandomAIRoster,
  unitIdsToHand,
  _resetInstanceCounterForTests,
} from './matchSetup';
import { getUnitById } from '../data/activeFactions';

beforeEach(() => {
  _resetInstanceCounterForTests();
});

describe('buildRandomAIRoster', () => {
  it('produces at least the minimum army size within a 500pt cap', () => {
    const roster = buildRandomAIRoster(500);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('produces at least the minimum army size within a 1000pt cap', () => {
    const roster = buildRandomAIRoster(1000);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('produces at least the minimum army size within a 2000pt cap', () => {
    const roster = buildRandomAIRoster(2000);
    expect(roster.length).toBeGreaterThanOrEqual(5);
  });

  it('never exceeds the given points cap', () => {
    const roster = buildRandomAIRoster(500);
    const totalPoints = roster.reduce((sum, id) => sum + (getUnitById(id)?.points ?? 0), 0);
    expect(totalPoints).toBeLessThanOrEqual(500);
  });

  it('every returned unit id resolves to a real unit', () => {
    const roster = buildRandomAIRoster(1000);
    for (const id of roster) {
      expect(getUnitById(id)).toBeDefined();
    }
  });

  it('respects a custom minUnits threshold', () => {
    const roster = buildRandomAIRoster(2000, 10);
    expect(roster.length).toBeGreaterThanOrEqual(10);
  });
});

describe('unitIdsToHand', () => {
  it('produces exactly handSize cards when the roster is larger', () => {
    const roster = buildRandomAIRoster(2000); // typically well over 5 units
    const hand = unitIdsToHand(roster, 'blue', 5);
    expect(hand).toHaveLength(5);
  });

  it('uses the whole roster if it is smaller than handSize', () => {
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain', 'necrons-lychguard'], 'red', 5);
    expect(hand).toHaveLength(2);
  });

  it('assigns the given owner to every card', () => {
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'red', 1);
    expect(hand[0].owner).toBe('red');
  });

  it("copies each unit's real stats onto the card", () => {
    const unit = getUnitById('blood-angels-blood-angels-captain')!;
    const hand = unitIdsToHand(['blood-angels-blood-angels-captain'], 'blue', 1);
    expect(hand[0].stats).toEqual(unit.stats);
  });

  it('assigns unique instanceIds even for the same unit id repeated', () => {
    const hand = unitIdsToHand(
      ['blood-angels-blood-angels-captain', 'blood-angels-blood-angels-captain'],
      'blue',
      2,
    );
    expect(hand[0].instanceId).not.toBe(hand[1].instanceId);
  });

  it('throws for an unknown unit id', () => {
    expect(() => unitIdsToHand(['not-a-real-id'], 'blue', 1)).toThrow('Unknown unit id');
  });
});