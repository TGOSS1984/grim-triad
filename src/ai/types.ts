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
}