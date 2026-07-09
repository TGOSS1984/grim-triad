/**
 * The game reducer: the single entry point for advancing game state.
 * `applyMove` is a pure function — given a state and a move, it returns a
 * brand new state, never mutating its input. This is what makes the engine
 * safe to use from the AI (simulate moves without side effects), from undo/
 * replay tooling, and eventually from networked PvP (apply a remote move
 * exactly the same way a local move is applied).
 *
 * NOTE: capture resolution is delegated to ruleEngine.ts's `resolveCaptures`,
 * which composes whichever optional rule modifiers (Same, Plus, Elemental,
 * Same Wall) are active for this match's RuleSet, falling back to the base
 * rule when none apply or none trigger. This keeps applyMove itself
 * unaware of individual rule mechanics - it only needs to know "resolve
 * captures for this placement" and apply whatever comes back.
 */
import type { Board, Card, GameState, Move, PlayerColour, PlayerState, RuleSet } from './types';
import { createEmptyBoard, getCell, isBoardFull, isPositionEmpty } from './board';
import { resolveCaptures } from './ruleEngine';

export const DEFAULT_RULE_SET: RuleSet = {
  open: false,
  suddenDeath: false,
  random: false,
  same: false,
  sameWall: false,
  plus: false,
  elemental: false,
  tradeRule: 'one',
};

export interface CreateGameOptions {
  bluePlayer: PlayerState;
  redPlayer: PlayerState;
  startingPlayer: PlayerColour;
  ruleSet?: RuleSet;
}

/** Builds a fresh game ready to play (post coin-flip: startingPlayer is already decided). */
export function createGame(options: CreateGameOptions): GameState {
  const { bluePlayer, redPlayer, startingPlayer, ruleSet = DEFAULT_RULE_SET } = options;

  return {
    board: createEmptyBoard(),
    players: {
      blue: bluePlayer,
      red: redPlayer,
    },
    activePlayer: startingPlayer,
    ruleSet,
    phase: 'playing',
    winner: null,
    history: [],
  };
}

export class IllegalMoveError extends Error {}

/** Throws IllegalMoveError if the move cannot legally be applied to this state. */
export function assertLegalMove(state: GameState, move: Move): void {
  if (state.phase !== 'playing' && state.phase !== 'suddenDeath') {
    throw new IllegalMoveError(`Cannot move: game phase is "${state.phase}"`);
  }
  if (move.player !== state.activePlayer) {
    throw new IllegalMoveError(
      `It is ${state.activePlayer}'s turn, not ${move.player}'s`,
    );
  }
  if (!isPositionEmpty(state.board, move.position)) {
    throw new IllegalMoveError(
      `Position (${move.position.row}, ${move.position.col}) is already occupied`,
    );
  }
  const inHand = state.players[move.player].hand.some(
    (c) => c.instanceId === move.card.instanceId,
  );
  if (!inHand) {
    throw new IllegalMoveError(
      `Card ${move.card.instanceId} is not in ${move.player}'s hand`,
    );
  }
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell }))) as Board;
}

function placeCard(board: Board, card: Card, move: Move): Board {
  const next = cloneBoard(board);
  next[move.position.row][move.position.col] = { ...getCell(next, move.position), card };
  return next;
}

function flipCard(board: Board, positions: Move['position'][], newOwner: PlayerColour): Board {
  let next = board;
  for (const pos of positions) {
    const cell = getCell(next, pos);
    if (!cell.card) continue;
    next = cloneBoard(next);
    next[pos.row][pos.col] = { ...cell, card: { ...cell.card, owner: newOwner } };
  }
  return next;
}

function removeFromHand(hand: Card[], instanceId: string): Card[] {
  return hand.filter((c) => c.instanceId !== instanceId);
}

function countCardsOnBoard(board: Board, colour: PlayerColour): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.card?.owner === colour) count++;
    }
  }
  return count;
}

function determineWinner(board: Board): PlayerColour | 'draw' {
  const blue = countCardsOnBoard(board, 'blue');
  const red = countCardsOnBoard(board, 'red');
  if (blue > red) return 'blue';
  if (red > blue) return 'red';
  return 'draw';
}

/**
 * Applies a single move to the game state, resolving captures and advancing
 * the turn. Throws IllegalMoveError if the move is not legal for this state
 * (callers driving UI should check `assertLegalMove` / build a legal-moves
 * list before allowing the player to attempt a move, so this should only
 * ever throw on programmer error or a malicious/out-of-sync client).
 */
export function applyMove(state: GameState, move: Move): GameState {
  assertLegalMove(state, move);

  let board = placeCard(state.board, move.card, move);
  const { captured } = resolveCaptures(board, move.card, move.position, state.ruleSet);
  if (captured.length > 0) {
    board = flipCard(board, captured, move.player);
  }

  const players: GameState['players'] = {
    ...state.players,
    [move.player]: {
      ...state.players[move.player],
      hand: removeFromHand(state.players[move.player].hand, move.card.instanceId),
    },
  };

  const boardFull = isBoardFull(board);
  const nextActivePlayer: PlayerColour = move.player === 'blue' ? 'red' : 'blue';

  return {
    ...state,
    board,
    players,
    activePlayer: nextActivePlayer,
    phase: boardFull ? 'finished' : state.phase,
    winner: boardFull ? determineWinner(board) : null,
    history: [...state.history, move],
  };
}