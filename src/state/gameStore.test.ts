import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';
import type { Card, Board } from '../engine/types';

function makeCard(
  owner: 'blue' | 'red',
  instanceId: string,
  stats = { top: 5, bottom: 5, left: 5, right: 5 },
): Card {
  return { instanceId, unitId: `unit-${instanceId}`, owner, stats };
}

function makeHand(owner: 'blue' | 'red', count: number): Card[] {
  return Array.from({ length: count }, (_, i) => makeCard(owner, `${owner}-${i}`));
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('startGame', () => {
  it('creates a game with no AI (local PvP) and does not auto-play any move', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const { game } = useGameStore.getState();
    expect(game).not.toBeNull();
    expect(game?.activePlayer).toBe('blue');
    expect(game?.history).toHaveLength(0);
  });

  it('auto-plays the AI after a real delay when the AI is the starting player', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });

    const { game } = useGameStore.getState();
    // AI (red) should have played its move, handing the turn back to blue.
    expect(game?.history).toHaveLength(1);
    expect(game?.history[0].player).toBe('red');
    expect(game?.activePlayer).toBe('blue');
  });

  it('does not apply the AI move until startGame actually resolves (real delay, not instant)', async () => {
    const promise = useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });

    // Immediately after calling (before awaiting), the AI's move must not
    // have been applied yet - this is the actual behaviour being fixed:
    // previously everything resolved synchronously in one go.
    expect(useGameStore.getState().game?.history).toHaveLength(0);

    await promise;
    expect(useGameStore.getState().game?.history).toHaveLength(1);
  });
});

describe('playCard', () => {
  it('applies a human move and does not auto-play when there is no AI', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    await useGameStore.getState().playCard(card, { row: 0, col: 0 });

    const { game } = useGameStore.getState();
    expect(game?.history).toHaveLength(1);
    expect(game?.activePlayer).toBe('red');
  });

  it('commits the human move to the store immediately, before the AI response', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    const card = useGameStore.getState().game!.players.blue.hand[0];
    const promise = useGameStore.getState().playCard(card, { row: 0, col: 0 });

    // The human's move should be visible right away (this is what lets
    // the player actually see their own capture before the AI responds) -
    // but the AI has not moved yet.
    expect(useGameStore.getState().game?.history).toHaveLength(1);
    expect(useGameStore.getState().game?.history[0].player).toBe('blue');

    await promise;
    expect(useGameStore.getState().game?.history).toHaveLength(2);
    expect(useGameStore.getState().game?.history[1].player).toBe('red');
    expect(useGameStore.getState().game?.activePlayer).toBe('blue');
  });

  it('throws if called before a game has started', async () => {
    const card = makeCard('blue', 'blue-1');
    await expect(
      useGameStore.getState().playCard(card, { row: 0, col: 0 }),
    ).rejects.toThrow('Cannot play a card before a game has started');
  });

  it('throws if called for a human move while it is actually the AI turn', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    // The public API (startGame/playCard) always drains AI turns
    // automatically, so this state is otherwise unreachable through normal
    // use - force it directly via setState to confirm the defensive guard
    // in playCard actually fires rather than silently misbehaving.
    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, activePlayer: 'red' } });

    const card = useGameStore.getState().game!.players.red.hand[0];
    await expect(
      useGameStore.getState().playCard(card, { row: 1, col: 1 }),
    ).rejects.toThrow("It is the AI's turn");
  });
});

describe('triggerSuddenDeathRematch', () => {
  function finishAsDraw(): void {
    // Force the store into a finished-draw state directly (constructing a
    // real draw through play would need a contrived sequence of moves) -
    // triggerSuddenDeathRematch's own precondition check is exercised by
    // the "throws" test below using a genuinely non-draw state instead.
    const { game } = useGameStore.getState();
    const blueCard = makeCard('blue', 'blue-onboard');
    const redCard = makeCard('red', 'red-onboard');
    useGameStore.setState({
      game: {
        ...game!,
        board: [
          [{ card: blueCard }, { card: redCard }, { card: null }],
          [{ card: null }, { card: null }, { card: null }],
          [{ card: null }, { card: null }, { card: null }],
        ],
        phase: 'finished',
        winner: 'draw',
      },
    });
  }

  it('starts a new live game (phase suddenDeath) after a drawn finished game', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    expect(game?.phase).toBe('suddenDeath');
    expect(game?.winner).toBeNull();
  });

  it('rebuilds each hand from what that side controlled on the board', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    expect(game?.players.blue.hand.map((c) => c.instanceId)).toEqual(['blue-onboard']);
    expect(game?.players.red.hand.map((c) => c.instanceId)).toEqual(['red-onboard']);
  });

  it('throws if there is no game at all', async () => {
    await expect(useGameStore.getState().triggerSuddenDeathRematch()).rejects.toThrow(
      'Cannot start Sudden Death without a game',
    );
  });

  it('throws (via the engine) if the game is not actually a finished draw', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    await expect(useGameStore.getState().triggerSuddenDeathRematch()).rejects.toThrow();
  });

  it('auto-plays the AI if the AI is the rematch starting player', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'red',
      aiPlayer: 'red',
    });
    finishAsDraw();

    await useGameStore.getState().triggerSuddenDeathRematch();

    const { game } = useGameStore.getState();
    // Red (AI) started, per the original startingPlayer, and should have
    // auto-played its first move, handing the turn to blue.
    expect(game?.activePlayer).toBe('blue');
  });
});

describe('startGame: Elemental default element pool', () => {
  it('assigns board elements from the real themed list when Elemental is on and no override is given', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, elemental: true },
    });

    const { game } = useGameStore.getState();
    const elementedCells = game!.board.flat().filter((c) => c.element !== undefined);
    expect(elementedCells.length).toBeGreaterThan(0);
  });
});

describe('reset', () => {
  it('clears the game and aiPlayer back to null', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    useGameStore.getState().reset();

    const { game, aiPlayer } = useGameStore.getState();
    expect(game).toBeNull();
    expect(aiPlayer).toBeNull();
  });

  it('also clears the unlock-tracking counters back to zero/false', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });
    useGameStore.setState({
      matchSameOrPlusComboCount: 3,
      matchChainReactionCount: 2,
      matchOpponentCapturedFromHuman: true,
    });

    useGameStore.getState().reset();

    const state = useGameStore.getState();
    expect(state.matchSameOrPlusComboCount).toBe(0);
    expect(state.matchChainReactionCount).toBe(0);
    expect(state.matchOpponentCapturedFromHuman).toBe(false);
  });
});

describe('unlock progress tracking (matchSameOrPlusComboCount / matchChainReactionCount / matchOpponentCapturedFromHuman)', () => {
  it('starts every match at zero/false', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 5) },
      redPlayer: { colour: 'red', hand: makeHand('red', 5) },
      startingPlayer: 'blue',
    });

    const state = useGameStore.getState();
    expect(state.matchSameOrPlusComboCount).toBe(0);
    expect(state.matchChainReactionCount).toBe(0);
    expect(state.matchOpponentCapturedFromHuman).toBe(false);
  });

  it("increments matchSameOrPlusComboCount when the HUMAN's own move triggers a Same capture", async () => {
    const triggerCard = makeCard('blue', 'trigger', { top: 5, bottom: 1, left: 1, right: 5 });
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [triggerCard] },
      redPlayer: { colour: 'red', hand: [] },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, same: true },
    });

    // Two matched sides - Same requires 2+ (see engine/rules/same.ts).
    const redTop = makeCard('red', 'red-top', { top: 1, bottom: 5, left: 1, right: 1 });
    const redRight = makeCard('red', 'red-right', { top: 1, bottom: 1, left: 5, right: 1 });
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        // .map() over a tuple loses the tuple's fixed-length shape in
        // TS's type system, even though the source (game!.board) and
        // result are both genuinely always exactly 3x3 - same "provably
        // safe, not a runtime claim" reasoning as GameScreen.tsx's own
        // equivalent Position assertion.
        board: game!.board.map((row, r) =>
          row.map((cell, c) => {
            if (r === 0 && c === 1) return { card: redTop };
            if (r === 1 && c === 2) return { card: redRight };
            return cell;
          }),
        ) as Board,
      },
    });

    await useGameStore.getState().playCard(triggerCard, { row: 1, col: 1 });

    expect(useGameStore.getState().matchSameOrPlusComboCount).toBe(1);
    expect(useGameStore.getState().matchChainReactionCount).toBe(0);
  });

  it('does NOT increment matchSameOrPlusComboCount for a plain base capture (not a Same/Plus/Chain moment)', async () => {
    const triggerCard = makeCard('blue', 'trigger', { top: 5, bottom: 9, left: 1, right: 1 });
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [triggerCard] },
      redPlayer: { colour: 'red', hand: [] },
      startingPlayer: 'blue',
    });

    const redBelow = makeCard('red', 'red-below', { top: 1, bottom: 1, left: 1, right: 1 });
    const { game } = useGameStore.getState();
    useGameStore.setState({
      game: {
        ...game!,
        board: game!.board.map((row, r) =>
          row.map((cell, c) => (r === 1 && c === 0 ? { card: redBelow } : cell)),
        ) as Board,
      },
    });

    await useGameStore.getState().playCard(triggerCard, { row: 0, col: 0 });

    expect(useGameStore.getState().matchSameOrPlusComboCount).toBe(0);
    expect(useGameStore.getState().matchChainReactionCount).toBe(0);
  });

  it('sets matchOpponentCapturedFromHuman when the AI captures a card from the human', async () => {
    const blueFiller = makeCard('blue', 'blue-filler');
    const redCapture = makeCard('red', 'red-capture', { top: 9, bottom: 9, left: 9, right: 9 });

    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [blueFiller] },
      redPlayer: { colour: 'red', hand: [redCapture] },
      startingPlayer: 'blue',
      aiPlayer: 'red',
    });

    // Rig the board so both sides have exactly one legal move each,
    // deterministically forcing the AI's only possible move to capture a
    // weak pre-placed blue card - no reliance on heuristic AI's move
    // *choice* logic, since there's genuinely only one legal move at each
    // step.
    const weakBlue = makeCard('blue', 'weak-blue', { top: 1, bottom: 1, left: 1, right: 1 });
    const filler = makeCard('red', 'other-filler');
    const { game } = useGameStore.getState();
    const board = game!.board.map((row, r) =>
      row.map((cell, c) => {
        if (r === 0 && c === 0) return { card: weakBlue }; // capture target
        if (r === 0 && c === 1) return cell; // stays empty - the AI's only legal move, adjacent to weakBlue
        if (r === 2 && c === 2) return cell; // stays empty - blue's own move target
        return { card: filler };
      }),
    ) as Board;
    useGameStore.setState({ game: { ...game!, board } });

    expect(useGameStore.getState().matchOpponentCapturedFromHuman).toBe(false);

    await useGameStore.getState().playCard(blueFiller, { row: 2, col: 2 });

    expect(useGameStore.getState().matchOpponentCapturedFromHuman).toBe(true);
  });

  it("does NOT increment matchSameOrPlusComboCount for the AI's own Same/Plus trigger - only the human's moves count", async () => {
    // Same rigged-single-legal-move technique as above, but with Same
    // active and two matched sides on the AI's forced capture, to confirm
    // an AI-triggered Same still leaves the human's own combo count at 0.
    const blueFiller = makeCard('blue', 'blue-filler', { top: 2, bottom: 2, left: 2, right: 2 });
    const redCapture = makeCard('red', 'red-capture', { top: 5, bottom: 1, left: 5, right: 1 });

    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: [blueFiller] },
      redPlayer: { colour: 'red', hand: [redCapture] },
      startingPlayer: 'blue',
      aiPlayer: 'red',
      ruleSet: { ...DEFAULT_RULE_SET, same: true },
    });

    const blueAbove = makeCard('blue', 'blue-above', { top: 1, bottom: 5, left: 1, right: 1 });
    const blueLeft = makeCard('blue', 'blue-left', { top: 1, bottom: 1, left: 1, right: 5 });
    const filler = makeCard('red', 'other-filler');
    const { game } = useGameStore.getState();
    const board = game!.board.map((row, r) =>
      row.map((cell, c) => {
        if (r === 0 && c === 1) return { card: blueAbove };
        if (r === 1 && c === 0) return { card: blueLeft };
        if (r === 1 && c === 1) return cell; // stays empty - the AI's only legal move
        if (r === 2 && c === 2) return cell; // stays empty - blue's own move target
        return { card: filler };
      }),
    ) as Board;
    useGameStore.setState({ game: { ...game!, board } });

    await useGameStore.getState().playCard(blueFiller, { row: 2, col: 2 });

    expect(useGameStore.getState().matchOpponentCapturedFromHuman).toBe(true);
    expect(useGameStore.getState().matchSameOrPlusComboCount).toBe(0);
  });

  it('triggerSuddenDeathRematch resets all three tracking fields for the fresh replay', async () => {
    await useGameStore.getState().startGame({
      bluePlayer: { colour: 'blue', hand: makeHand('blue', 1) },
      redPlayer: { colour: 'red', hand: makeHand('red', 1) },
      startingPlayer: 'blue',
      ruleSet: { ...DEFAULT_RULE_SET, suddenDeath: true },
    });
    useGameStore.setState({
      matchSameOrPlusComboCount: 2,
      matchChainReactionCount: 1,
      matchOpponentCapturedFromHuman: true,
    });
    const { game } = useGameStore.getState();
    useGameStore.setState({ game: { ...game!, phase: 'finished', winner: 'draw' } });

    await useGameStore.getState().triggerSuddenDeathRematch();

    const state = useGameStore.getState();
    expect(state.matchSameOrPlusComboCount).toBe(0);
    expect(state.matchChainReactionCount).toBe(0);
    expect(state.matchOpponentCapturedFromHuman).toBe(false);
  });
});