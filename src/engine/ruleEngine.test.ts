import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from './board';
import { resolveCaptures } from './ruleEngine';
import { DEFAULT_RULE_SET } from './gameReducer';
import type { Board, Card, Position } from './types';

function makeCard(
  owner: 'blue' | 'red',
  stats: { top: number; bottom: number; left: number; right: number },
  instanceId = 'test-card',
  element?: string,
  keywords?: string[],
): Card {
  return { instanceId, unitId: 'test-unit', owner, stats, element, keywords };
}

function place(board: Board, card: Card, pos: Position): void {
  board[pos.row][pos.col].card = card;
}

describe('resolveCaptures (composed rule engine)', () => {
  it('falls back to the base rule when no modifiers are active', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const result = resolveCaptures(board, placed, { row: 1, col: 0 }, DEFAULT_RULE_SET);

    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
    expect(result.comboTriggered).toBe(false);
  });

  it('uses the Same rule when active and it produces a capture', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 1 },
      { ...DEFAULT_RULE_SET, same: true },
    );

    expect(result.captured).toHaveLength(2);
  });

  it('falls back to base rule when Same is active but does not trigger', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 0 },
      { ...DEFAULT_RULE_SET, same: true },
    );

    // Same doesn't fire (no 2+ matches), so it should fall back to base capture.
    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('applies Elemental bonus before evaluating the base rule', () => {
    const board = createEmptyBoard();
    board[1][0].element = 'warp';
    // neighbor's facing value is 5; placed card's raw right=5 would tie (no capture),
    // but a matching Elemental cell bumps it to 6, which should now capture.
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-1'), {
      row: 1,
      col: 1,
    });
    const placed = makeCard(
      'blue',
      { top: 5, bottom: 5, left: 5, right: 5 },
      'blue-1',
      'warp',
    );

    const result = resolveCaptures(
      board,
      placed,
      { row: 1, col: 0 },
      { ...DEFAULT_RULE_SET, elemental: true },
    );

    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
  });

  it('passes the Same Wall value through when both same and sameWall are active', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 10 }, 'red-right'), {
      row: 0,
      col: 1,
    });
    const placed = makeCard('blue', { top: 10, bottom: 1, left: 10, right: 1 }, 'blue-1');

    const result = resolveCaptures(
      board,
      placed,
      { row: 0, col: 0 },
      { ...DEFAULT_RULE_SET, same: true, sameWall: true },
    );

    // top+left match the wall (10), right matches red-right's left (1) -> 3 matches, captures red-right.
    expect(result.captured).toEqual([{ row: 0, col: 1 }]);
  });

  describe('Elemental applies to the DEFENDER too, not just the attacker', () => {
    // Regression coverage for a real bug caught in play: a card sitting on
    // a matching element got no benefit when later attacked, only when it
    // was doing the attacking - because the old version only ever applied
    // the modifier to the card being placed that turn.

    it('a defender on a MATCHING element resists a capture it would otherwise lose to', () => {
      const board = createEmptyBoard();
      // Red card sits on a warp tile it matches - its printed left=5
      // should become an effective 6 when defending.
      board[1][1].element = 'warp';
      place(
        board,
        makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-defender', 'warp'),
        { row: 1, col: 1 },
      );
      // Blue attacks with a raw 6 on the facing side - under the old bug
      // this beats the defender's raw 5. With the fix, the defender's
      // effective 6 makes this a tie, so no capture.
      const attacker = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 6 }, 'blue-attacker');

      const result = resolveCaptures(board, attacker, { row: 1, col: 0 }, {
        ...DEFAULT_RULE_SET,
        elemental: true,
      });

      expect(result.captured).toEqual([]);
    });

    it('an attacker with just enough of an edge still beats a defended (matching-element) card', () => {
      const board = createEmptyBoard();
      board[1][1].element = 'warp';
      place(
        board,
        makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-defender', 'warp'),
        { row: 1, col: 1 },
      );
      // 7 beats the defender's boosted 6 (5+1), where it would also have
      // beaten the raw 5 - a sanity check that genuine advantages still work.
      const attacker = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 7 }, 'blue-attacker');

      const result = resolveCaptures(board, attacker, { row: 1, col: 0 }, {
        ...DEFAULT_RULE_SET,
        elemental: true,
      });

      expect(result.captured).toEqual([{ row: 1, col: 1 }]);
    });

    it('a defender on a MISMATCHED element is weaker than its printed value suggests', () => {
      const board = createEmptyBoard();
      board[1][1].element = 'warp';
      // Red's own element is 'toxic', mismatching the warp tile it sits on
      // - its printed left=6 should become an effective 5 when defending.
      place(
        board,
        makeCard('red', { top: 1, bottom: 1, left: 6, right: 1 }, 'red-defender', 'toxic'),
        { row: 1, col: 1 },
      );
      // Raw 6 would only tie a raw 6, but the mismatch-weakened defender
      // (effective 5) should now lose to it.
      const attacker = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 6 }, 'blue-attacker');

      const result = resolveCaptures(board, attacker, { row: 1, col: 0 }, {
        ...DEFAULT_RULE_SET,
        elemental: true,
      });

      expect(result.captured).toEqual([{ row: 1, col: 1 }]);
    });

    it('applies independently to both cards when both are sitting on (different) elemental tiles', () => {
      const board = createEmptyBoard();
      board[1][0].element = 'warp'; // attacker's own tile
      board[1][1].element = 'toxic'; // defender's own tile

      // Defender matches its own tile (toxic): printed left=5 -> effective 6.
      place(
        board,
        makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-defender', 'toxic'),
        { row: 1, col: 1 },
      );
      // Attacker matches its own tile (warp): printed right=5 -> effective 6.
      const attacker = makeCard(
        'blue',
        { top: 1, bottom: 1, left: 1, right: 5 },
        'blue-attacker',
        'warp',
      );

      const result = resolveCaptures(board, attacker, { row: 1, col: 0 }, {
        ...DEFAULT_RULE_SET,
        elemental: true,
      });

      // Both boosted to 6 - a tie, so no capture, proving each side's
      // modifier was computed independently at its OWN position rather
      // than only the attacker's.
      expect(result.captured).toEqual([]);
    });
  });
});

describe('resolveCaptures (Chain rule)', () => {
  it('does NOT cascade a plain base capture when chain is off (default)', () => {
    const board = createEmptyBoard();
    // red-right will be captured by the placed card, and could ITSELF
    // capture red-below-right via a strong bottom side - but chain is off,
    // so that second capture must not happen.
    place(board, makeCard('red', { top: 1, bottom: 9, left: 1, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-below-right'), {
      row: 2,
      col: 2,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 9 }, 'blue-placed');

    const result = resolveCaptures(board, placed, { row: 1, col: 1 }, DEFAULT_RULE_SET);

    expect(result.captured).toEqual([{ row: 1, col: 2 }]);
    expect(result.comboTriggered).toBe(false);
    expect(result.captureKinds).toEqual(['base']);
  });

  it('cascades a base capture into a further one when chain is on, and reports comboTriggered', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 9, left: 1, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-below-right'), {
      row: 2,
      col: 2,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 9 }, 'blue-placed');

    const result = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      chain: true,
    });

    expect(result.captured).toEqual(
      expect.arrayContaining([{ row: 1, col: 2 }, { row: 2, col: 2 }]),
    );
    expect(result.captured).toHaveLength(2);
    expect(result.comboTriggered).toBe(true);
    // The base capture always comes first (cascadeCaptures appends its
    // discoveries after the initial list it's given), so this is
    // deterministic despite using arrayContaining above for `captured`.
    expect(result.captureKinds).toEqual(['base', 'cascade']);
  });

  it('with chain on, does nothing extra when the initial placement captures nothing at all', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 9, bottom: 9, left: 9, right: 9 }, 'red-strong'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 1, bottom: 1, left: 1, right: 1 }, 'blue-weak');

    const result = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      chain: true,
    });

    expect(result.captured).toEqual([]);
    expect(result.comboTriggered).toBe(false);
  });

  it('chain has no additional effect when Same already fired (Same supersedes and has its own cascade)', () => {
    const board = createEmptyBoard();
    // Same setup as the existing Same-combo test above: a genuine Same
    // match that itself cascades via the shared cascade helper.
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 9, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    place(
      board,
      makeCard('red', { top: 1, bottom: 1, left: 1, right: 1 }, 'red-below-right'),
      { row: 2, col: 2 },
    );
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-combo');

    const withoutChain = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      same: true,
    });
    const withChain = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      same: true,
      chain: true,
    });

    expect(withChain.captured).toEqual(withoutChain.captured);
    expect(withChain.comboTriggered).toBe(withoutChain.comboTriggered);
  });
});

describe('resolveCaptures with Heroic active', () => {
  it('an Epic Hero neighbor is immune to a Same capture when Heroic is on', () => {
    const board = createEmptyBoard();
    place(
      board,
      makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top', undefined, ['Epic Hero']),
      { row: 0, col: 1 },
    );
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const withoutHeroic = resolveCaptures(board, placed, { row: 1, col: 1 }, { ...DEFAULT_RULE_SET, same: true });
    const withHeroic = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      same: true,
      heroic: true,
    });

    // Without Heroic, both sides match -> a genuine Same capture of both.
    expect(withoutHeroic.captured).toHaveLength(2);
    // With Heroic on, the Epic Hero (top) no longer counts toward the
    // matched-sides threshold at all - only 1 real match remains, below
    // the 2+ needed, so Same doesn't trigger and NEITHER card is
    // captured this way (not even the non-hero one).
    expect(withHeroic.captured).toEqual([]);
  });

  it('a non-Epic-Hero card is completely unaffected by Heroic', () => {
    const board = createEmptyBoard();
    place(board, makeCard('red', { top: 1, bottom: 5, left: 1, right: 1 }, 'red-top'), {
      row: 0,
      col: 1,
    });
    place(board, makeCard('red', { top: 1, bottom: 1, left: 5, right: 1 }, 'red-right'), {
      row: 1,
      col: 2,
    });
    const placed = makeCard('blue', { top: 5, bottom: 1, left: 1, right: 5 }, 'blue-1');

    const result = resolveCaptures(board, placed, { row: 1, col: 1 }, {
      ...DEFAULT_RULE_SET,
      same: true,
      heroic: true,
    });

    expect(result.captured).toHaveLength(2);
  });

  it('Heroic has no effect at all when Same/Plus are both off - an Epic Hero still falls to a plain higher-value base capture', () => {
    const board = createEmptyBoard();
    place(
      board,
      makeCard('red', { top: 1, bottom: 1, left: 3, right: 1 }, 'red-1', undefined, ['Epic Hero']),
      { row: 1, col: 1 },
    );
    const placed = makeCard('blue', { top: 5, bottom: 5, left: 5, right: 5 }, 'blue-1');

    const result = resolveCaptures(board, placed, { row: 1, col: 0 }, {
      ...DEFAULT_RULE_SET,
      heroic: true,
    });

    // Heroic only ever excludes Epic Heroes from Same/Plus's OWN
    // matching - a genuine higher-value base capture (no matching trick
    // involved at all) still works normally.
    expect(result.captured).toEqual([{ row: 1, col: 1 }]);
  });
});