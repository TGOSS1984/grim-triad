import type { Move } from '../engine/types';

export interface ScoredMove {
  move: Move;
  score: number;
}

export interface AIOptions {
  /**
   * How heavily to penalize a move that leaves the opponent a strong
   * immediate reply (1-ply lookahead). 0 disables lookahead entirely,
   * useful for isolating the immediate-capture component in tests.
   */
  lookaheadWeight?: number;
  /**
   * Probability (0-1) that chooseMove ignores scoring entirely and plays
   * a uniformly random legal move instead. 0 (default) means the AI
   * always plays its best-scored move. See ai/difficulty.ts for why this
   * exists separately from lookaheadWeight.
   */
  mistakeChance?: number;
}