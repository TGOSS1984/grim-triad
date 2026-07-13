/**
 * Heuristic and minimax opponent logic.
 *
 * Two genuinely different move-selection paths, not one algorithm with a
 * bigger knob:
 *  - searchDepth 1 (default, Easy/Normal): the original heuristic path -
 *    scoreMove weighs immediate captures against a raw CAPTURE-COUNT
 *    estimate of the opponent's best reply (bestImmediateCaptureCount),
 *    not a real simulation of what the board looks like afterward. Cheap,
 *    always fast, unchanged from the original v1 AI.
 *  - searchDepth 2+ (Hard): real minimax. Actually applies the candidate
 *    move, then recursively explores the opponent's (and, at deeper
 *    settings, our own) full legal move set, evaluating final board
 *    control at the search horizon rather than approximating it. This
 *    can correctly account for cases the heuristic can't - e.g. a move
 *    that captures 1 card now but hands the opponent a devastating
 *    multi-card combo reply (Same/Plus/Chain cascades, which the
 *    heuristic only sees as "opponent's best reply captures N cards",
 *    not what board position that actually leaves).
 *
 * No ML, no search beyond what searchDepth is configured to - see
 * ROADMAP.md Section 6 and ai/difficulty.ts for how each difficulty tier
 * is tuned.
 */
import type { GameState, Move, PlayerColour } from '../engine/types';
import { emptyPositions } from '../engine/board';
import { resolveCaptures } from '../engine/ruleEngine';
import { applyMove } from '../engine/gameReducer';
import type { ScoredMove, AIOptions } from './types';

const DEFAULT_LOOKAHEAD_WEIGHT = 1.5;
const IMMEDIATE_CAPTURE_WEIGHT = 2;
const COMBO_BONUS = 1;
const DEFAULT_SEARCH_DEPTH = 1;

/** Every legal (card, position) pairing for `player` in the current state. */
export function getLegalMoves(state: GameState, player: PlayerColour): Move[] {
  const hand = state.players[player].hand;
  const positions = emptyPositions(state.board);
  const moves: Move[] = [];
  for (const card of hand) {
    for (const position of positions) {
      moves.push({ player, card, position });
    }
  }
  return moves;
}

/** The most captures a single move by `player` could achieve against `state` - used for the shallow heuristic's lookahead penalty (searchDepth 1 only - see this file's header). */
function bestImmediateCaptureCount(state: GameState, player: PlayerColour): number {
  let best = 0;
  for (const move of getLegalMoves(state, player)) {
    const result = resolveCaptures(state.board, move.card, move.position, state.ruleSet);
    if (result.captured.length > best) best = result.captured.length;
  }
  return best;
}

/**
 * Scores a single candidate move: rewards immediate captures (weighted
 * higher, plus a small combo bonus), penalized by how strong a reply it
 * leaves for the opponent's best next move (1-ply lookahead). Exported
 * (not just used internally by chooseMove) so its components can be tested
 * in isolation.
 *
 * PRECONDITION: `move.player` must be `state.activePlayer` - the lookahead
 * step calls the real `applyMove`, which validates turn order and throws
 * IllegalMoveError otherwise. This is intentional (scoring should only
 * ever be requested for whoever's turn it genuinely is) rather than a
 * limitation to work around.
 */
export function scoreMove(state: GameState, move: Move, options: AIOptions = {}): number {
  const lookaheadWeight = options.lookaheadWeight ?? DEFAULT_LOOKAHEAD_WEIGHT;

  const immediate = resolveCaptures(state.board, move.card, move.position, state.ruleSet);
  let score = immediate.captured.length * IMMEDIATE_CAPTURE_WEIGHT;
  if (immediate.comboTriggered) score += COMBO_BONUS;

  if (lookaheadWeight > 0) {
    const nextState = applyMove(state, move);
    if (nextState.phase !== 'finished') {
      const opponent: PlayerColour = move.player === 'blue' ? 'red' : 'blue';
      const opponentBest = bestImmediateCaptureCount(nextState, opponent);
      score -= opponentBest * lookaheadWeight;
    }
  }

  return score;
}

/**
 * Real position evaluation from `perspective`'s point of view: board
 * control difference (cards `perspective` owns on the board, minus cards
 * the opponent owns). This is what minimax bottoms out into at the search
 * horizon - a genuine "who's actually winning here" read of the board,
 * not a proxy like capture count.
 */
export function evaluatePosition(state: GameState, perspective: PlayerColour): number {
  const opponent: PlayerColour = perspective === 'blue' ? 'red' : 'blue';
  let perspectiveCount = 0;
  let opponentCount = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.card?.owner === perspective) perspectiveCount++;
      else if (cell.card?.owner === opponent) opponentCount++;
    }
  }
  return perspectiveCount - opponentCount;
}

/**
 * Real minimax: recursively explores `depth` more plies of whoever's
 * actually active in `state`, alternating maximizing (when the active
 * player IS `perspective`) and minimizing (when it's the opponent) at
 * each level, bottoming out into evaluatePosition once `depth` reaches 0
 * or the game ends. This is genuine game-tree search, not a heuristic
 * approximation - every node actually applies a real move via applyMove
 * and inherits whatever that move's real consequences were (captures,
 * combo cascades, Elemental modifiers, all of it), because it's calling
 * the same engine the real game uses, not a simplified model of it.
 *
 * Exported for direct testing - constructing a specific board position
 * and checking minimax's evaluation is a much more precise test than
 * only testing end-to-end move selection.
 */
export function minimax(state: GameState, depth: number, perspective: PlayerColour): number {
  if (depth <= 0 || state.phase === 'finished') {
    return evaluatePosition(state, perspective);
  }

  const activePlayer = state.activePlayer;
  const legalMoves = getLegalMoves(state, activePlayer);
  if (legalMoves.length === 0) {
    return evaluatePosition(state, perspective);
  }

  const isMaximizing = activePlayer === perspective;
  let best = isMaximizing ? -Infinity : Infinity;

  for (const move of legalMoves) {
    const nextState = applyMove(state, move);
    const value = minimax(nextState, depth - 1, perspective);
    best = isMaximizing ? Math.max(best, value) : Math.min(best, value);
  }

  return best;
}

/**
 * Scores one candidate move via real minimax rather than the shallow
 * heuristic - applies the move, then searches `searchDepth - 1` further
 * plies from the resulting position (the move itself is ply 1).
 */
function minimaxMoveScore(
  state: GameState,
  move: Move,
  searchDepth: number,
  perspective: PlayerColour,
): number {
  const nextState = applyMove(state, move);
  return minimax(nextState, searchDepth - 1, perspective);
}

/**
 * Chooses the AI's move for `player` in the current state: scores every
 * legal move and returns the highest-scoring one. Throws if the player has
 * no legal moves - callers should only invoke this when it's genuinely
 * that player's turn with cards in hand and board space available.
 *
 * Dispatches between the cheap heuristic (scoreMove) and real minimax
 * (minimaxMoveScore) based on options.searchDepth - see AIOptions' own
 * doc and this file's header for why these are genuinely different
 * algorithms, not the same one at different settings.
 */
export function chooseMove(
  state: GameState,
  player: PlayerColour,
  options: AIOptions = {},
): Move {
  const legalMoves = getLegalMoves(state, player);
  if (legalMoves.length === 0) {
    throw new Error(`No legal moves available for ${player}`);
  }

  const mistakeChance = options.mistakeChance ?? 0;
  if (mistakeChance > 0 && Math.random() < mistakeChance) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const searchDepth = options.searchDepth ?? DEFAULT_SEARCH_DEPTH;
  const scored: ScoredMove[] = legalMoves.map((move) => ({
    move,
    score:
      searchDepth > 1
        ? minimaxMoveScore(state, move, searchDepth, player)
        : scoreMove(state, move, options),
  }));

  const bestScore = Math.max(...scored.map((s) => s.score));
  const bestMoves = scored.filter((s) => s.score === bestScore);
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return chosen.move;
}