import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../board';
import { computeEffectiveStats } from './effectiveStats';
import { DEFAULT_RULE_SET } from '../gameReducer';
import type { Board, Card, Position } from '../types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    instanceId: 'test-card',
    unitId: 'test-unit',
    owner: 'blue',
    stats: { top: 5, bottom: 5, left: 5, right: 5 },
    ...overrides,
  };
}

function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('computeEffectiveStats', () => {
  it('returns unmodified printed stats when no rules are active', () => {
    const board = createEmptyBoard();
    const card = makeCard();

    const stats = computeEffectiveStats(card, DEFAULT_RULE_SET, { board, pos: { row: 1, col: 1 } });

    expect(stats).toEqual(card.stats);
  });

  it('returns unmodified printed stats for a HAND card (no boardContext) even with Elemental active', () => {
    const card = makeCard({ element: 'void' });

    const stats = computeEffectiveStats(card, { ...DEFAULT_RULE_SET, elemental: true }, null);

    expect(stats).toEqual(card.stats);
  });

  it('applies Elemental alone correctly (buff on match)', () => {
    const board = createEmptyBoard();
    board[1][1].element = 'void';
    const card = makeCard({ element: 'void' });

    const stats = computeEffectiveStats(card, { ...DEFAULT_RULE_SET, elemental: true }, {
      board,
      pos: { row: 1, col: 1 },
    });

    expect(stats).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  });

  it('applies Combined Arms alone correctly (per-side)', () => {
    const board = createEmptyBoard();
    place(board, makeCard({ owner: 'blue', unitType: 'Vehicle', instanceId: 'neighbor' }), {
      row: 0,
      col: 1,
    });
    const card = makeCard({ unitType: 'Infantry' });

    const stats = computeEffectiveStats(card, { ...DEFAULT_RULE_SET, combinedArms: true }, {
      board,
      pos: { row: 1, col: 1 },
    });

    expect(stats).toEqual({ top: 6, bottom: 5, left: 5, right: 5 });
  });

  it('applies Underdog alone correctly (flat +1 all sides)', () => {
    const board = createEmptyBoard();
    const card = makeCard({ hasUnderdogBonus: true });

    const stats = computeEffectiveStats(card, { ...DEFAULT_RULE_SET, underdog: true }, {
      board,
      pos: { row: 1, col: 1 },
    });

    expect(stats).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  });

  it('Underdog has no effect if the rule is off, even if the flag is set on the card', () => {
    const board = createEmptyBoard();
    const card = makeCard({ hasUnderdogBonus: true });

    const stats = computeEffectiveStats(card, DEFAULT_RULE_SET, { board, pos: { row: 1, col: 1 } });

    expect(stats).toEqual(card.stats);
  });

  it('applies Epic Hero Presence alone correctly (+1 on the one chosen side)', () => {
    const board = createEmptyBoard();
    const card = makeCard({ owner: 'blue' });

    const stats = computeEffectiveStats(
      card,
      { ...DEFAULT_RULE_SET, epicHeroPresence: true },
      { board, pos: { row: 1, col: 1 } },
      { blue: 'left' },
    );

    expect(stats).toEqual({ top: 5, bottom: 5, left: 6, right: 5 });
  });

  it('Epic Hero Presence only applies to the OWNER it was assigned to, not the opponent', () => {
    const board = createEmptyBoard();
    const redCard = makeCard({ owner: 'red' });

    const stats = computeEffectiveStats(
      redCard,
      { ...DEFAULT_RULE_SET, epicHeroPresence: true },
      { board, pos: { row: 1, col: 1 } },
      { blue: 'left' }, // only blue has it
    );

    expect(stats).toEqual(redCard.stats);
  });

  it('STACKS all four modifiers correctly when active at once - the real point of this function', () => {
    const board = createEmptyBoard();
    board[1][1].element = 'void';
    place(board, makeCard({ owner: 'blue', unitType: 'Vehicle', instanceId: 'top-neighbor' }), {
      row: 0,
      col: 1,
    });
    const card = makeCard({
      owner: 'blue',
      element: 'void', // matches -> Elemental +1 all sides
      unitType: 'Infantry', // different from top neighbor -> Combined Arms +1 top only
      hasUnderdogBonus: true, // +1 all sides
    });
    const ruleSet = {
      ...DEFAULT_RULE_SET,
      elemental: true,
      combinedArms: true,
      underdog: true,
      epicHeroPresence: true,
    };

    const stats = computeEffectiveStats(card, ruleSet, { board, pos: { row: 1, col: 1 } }, { blue: 'left' });

    // top: printed 5 + elemental(+1) + combinedArms(+1) + underdog(+1) = 8
    // bottom: printed 5 + elemental(+1) + underdog(+1) = 7
    // left: printed 5 + elemental(+1) + underdog(+1) + epicHeroPresence(+1) = 8
    // right: printed 5 + elemental(+1) + underdog(+1) = 7
    expect(stats).toEqual({ top: 8, bottom: 7, left: 8, right: 7 });
  });

  it('opposing modifiers on the same side net out correctly rather than clamping mid-calculation', () => {
    // A card with NO element sitting on an elemental cell takes -1
    // (mismatch), but also has a Combined Arms +1 on the SAME side -
    // these should net to the printed value, not get clamped separately.
    const board = createEmptyBoard();
    board[1][1].element = 'void';
    place(board, makeCard({ owner: 'blue', unitType: 'Vehicle', instanceId: 'top-neighbor' }), {
      row: 0,
      col: 1,
    });
    const card = makeCard({ owner: 'blue', element: undefined, unitType: 'Infantry' });

    const stats = computeEffectiveStats(
      card,
      { ...DEFAULT_RULE_SET, elemental: true, combinedArms: true },
      { board, pos: { row: 1, col: 1 } },
    );

    // top: printed 5 + elemental(-1, no element = mismatch) + combinedArms(+1) = 5 (net zero change)
    expect(stats.top).toBe(5);
  });

  it('clamps the final combined result to the [1,10] range', () => {
    const board = createEmptyBoard();
    board[1][1].element = 'void';
    const card = makeCard({
      element: 'void',
      stats: { top: 10, bottom: 10, left: 10, right: 10 },
      hasUnderdogBonus: true,
    });

    const stats = computeEffectiveStats(
      card,
      { ...DEFAULT_RULE_SET, elemental: true, underdog: true },
      { board, pos: { row: 1, col: 1 } },
    );

    // 10 + 1 (elemental) + 1 (underdog) = 12, clamped to 10.
    expect(stats).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
  });
});