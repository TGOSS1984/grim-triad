import type { Move } from '../engine/types';

export interface ScoredMove {
  move: Move;
  score: number;
}

export interface AIOptions {
  /**
   * How heavily to penalize a move that leaves the opponent a strong
   * immediate reply (1-ply lookahead). 0 disables lookahead entirely,
   * useful for isolating the immediate-capture component in tests. Only
   * used when searchDepth is 1 (the default) - see searchDepth's own doc.
   */
  lookaheadWeight?: number;
  /**
   * Probability (0-1) that chooseMove ignores scoring entirely and plays
   * a uniformly random legal move instead. 0 (default) means the AI
   * always plays its best-scored move. See ai/difficulty.ts for why this
   * exists separately from lookaheadWeight.
   */
  mistakeChance?: number;
  /**
   * How many plies of REAL minimax search to run, as opposed to the
   * cheap heuristic path (scoreMove's capture-count + lookaheadWeight
   * penalty). 1 (the default) preserves the original heuristic-only
   * behavior exactly - no recursive search, just immediate captures
   * penalized by a raw capture-count estimate of the opponent's best
   * reply. 2 or more switches to genuine minimax: actually simulating
   * the opponent's full legal move set and picking their best reply (by
   * real board-control evaluation, not just capture count), rather than
   * approximating it with a heuristic. See heuristicAI.ts's minimax for
   * why this is a meaningfully different algorithm, not just a bigger
   * number on the same one.
   */
  searchDepth?: number;
}