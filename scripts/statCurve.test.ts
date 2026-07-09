import { describe, it, expect } from 'vitest';
import {
  pointsToBudget,
  budgetToSides,
  shapeForUnit,
  deriveCardStats,
} from './statCurve';

describe('pointsToBudget', () => {
  it('matches the worked examples from ROADMAP.md Section 4.1', () => {
    expect(pointsToBudget(20)).toBe(11);
    expect(pointsToBudget(800)).toBe(37);
  });

  it('produces increasing budgets for increasing points (monotonic)', () => {
    const points = [20, 50, 95, 150, 250, 400, 480, 800];
    const budgets = points.map(pointsToBudget);
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
    }
  });

  it('compresses the long tail: an equal absolute points increase moves the budget more at the low end than the high end', () => {
    // +80 points near the bottom of the range vs +80 points near the top.
    const lowDelta = pointsToBudget(100) - pointsToBudget(20);
    const highDelta = pointsToBudget(480) - pointsToBudget(400);
    expect(highDelta).toBeLessThan(lowDelta);
  });

  it('clamps points below the fitted range to the minimum budget', () => {
    expect(pointsToBudget(5)).toBe(11);
  });

  it('clamps points above the fitted range to the maximum budget', () => {
    expect(pointsToBudget(5000)).toBe(37);
  });
});

describe('budgetToSides', () => {
  it('always sums to exactly the requested budget', () => {
    for (const budget of [11, 15, 20, 22, 25, 29, 32, 37]) {
      for (const shape of ['frontLoaded', 'hullHeavy', 'balanced', 'flanker'] as const) {
        const stats = budgetToSides(budget, shape);
        const sum = stats.top + stats.bottom + stats.left + stats.right;
        expect(sum).toBe(budget);
      }
    }
  });

  it('never produces a side below 1 or above 10', () => {
    for (const budget of [11, 15, 20, 22, 25, 29, 32, 37]) {
      for (const shape of ['frontLoaded', 'hullHeavy', 'balanced', 'flanker'] as const) {
        const stats = budgetToSides(budget, shape);
        for (const value of Object.values(stats)) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('balanced shape keeps all sides close together', () => {
    const stats = budgetToSides(24, 'balanced');
    const values = Object.values(stats);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('frontLoaded shape gives top a clear edge over the other sides', () => {
    const stats = budgetToSides(26, 'frontLoaded');
    expect(stats.top).toBeGreaterThan(stats.left);
    expect(stats.top).toBeGreaterThan(stats.right);
    expect(stats.top).toBeGreaterThan(stats.bottom);
  });

  it('hullHeavy shape gives top+bottom an edge over left+right', () => {
    const stats = budgetToSides(28, 'hullHeavy');
    expect(stats.top + stats.bottom).toBeGreaterThan(stats.left + stats.right);
  });

  it('flanker shape gives top+left an edge over bottom+right', () => {
    const stats = budgetToSides(28, 'flanker');
    expect(stats.top + stats.left).toBeGreaterThan(stats.bottom + stats.right);
  });
});

describe('shapeForUnit', () => {
  it('classifies an Epic Hero as frontLoaded regardless of unit type', () => {
    const shape = shapeForUnit({
      battlefieldRole: 'Infantry / Other',
      unitType: 'Infantry',
      keywords: ['Epic Hero', 'Infantry'],
    });
    expect(shape).toBe('frontLoaded');
  });

  it('classifies a Character role as frontLoaded', () => {
    const shape = shapeForUnit({
      battlefieldRole: 'Character',
      unitType: 'Infantry',
      keywords: [],
    });
    expect(shape).toBe('frontLoaded');
  });

  it('classifies a Vehicle as hullHeavy', () => {
    const shape = shapeForUnit({
      battlefieldRole: 'Vehicle / Support',
      unitType: 'Vehicle',
      keywords: [],
    });
    expect(shape).toBe('hullHeavy');
  });

  it('classifies a Beast as flanker', () => {
    const shape = shapeForUnit({
      battlefieldRole: 'Infantry / Other',
      unitType: 'Beast',
      keywords: [],
    });
    expect(shape).toBe('flanker');
  });

  it('defaults plain Infantry to balanced', () => {
    const shape = shapeForUnit({
      battlefieldRole: 'Battleline',
      unitType: 'Infantry',
      keywords: [],
    });
    expect(shape).toBe('balanced');
  });
});

describe('deriveCardStats', () => {
  it('combines budget and shape into final stats matching the points curve', () => {
    const result = deriveCardStats({
      points: 190,
      battlefieldRole: 'Character',
      unitType: 'Infantry',
      keywords: ['Epic Hero'],
    });
    expect(result.statBudget).toBe(pointsToBudget(190));
    const sum = result.stats.top + result.stats.bottom + result.stats.left + result.stats.right;
    expect(sum).toBe(result.statBudget);
  });
});