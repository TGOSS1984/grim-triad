/**
 * Heuristic opponent: scores every legal move by (a) how many opponent
 * cards it captures immediately - via the full composed rule engine, so
 * Same/Plus combo chains and Elemental are correctly accounted for - and
 * (b) a 1-ply lookahead penalty for how strong a reply the move leaves the
 * opponent. Picks the highest-scoring move, with ties broken randomly so
 * the AI doesn't play deterministically identical games every time.
 *
 * No ML, no search beyond 1 ply - see ROADMAP.md Section 6. A heavier
 * search-based or trained AI is a documented future option (Section 2's
 * "why not Python" note), not required for v1.
 */
import type { GameState, Move, PlayerColour } from '../engine/types';
import { emptyPositions } from '../engine/board';
import { resolveCaptures } from '../engine/ruleEngine';
import { applyMove } from '../engine/gameReducer';
import type { ScoredMove, AIOptions } from './types';

const DEFAULT_LOOKAHEAD_WEIGHT = 1.5;
const IMMEDIATE_CAPTURE_WEIGHT = 2;
const COMBO_BONUS = 1;

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

/** The most captures a single move by `player` could achieve against `state` - used for lookahead. */
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
 * Chooses the AI's move for `player` in the current state: scores every
 * legal move and returns the highest-scoring one. Throws if the player has
 * no legal moves - callers should only invoke this when it's genuinely
 * that player's turn with cards in hand and board space available.
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

  const scored: ScoredMove[] = legalMoves.map((move) => ({
    move,
    score: scoreMove(state, move, options),
  }));

  const bestScore = Math.max(...scored.map((s) => s.score));
  const bestMoves = scored.filter((s) => s.score === bestScore);
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return chosen.move;
}