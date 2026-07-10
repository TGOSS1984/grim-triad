/**
 * Series/campaign mode state: a player brings a larger pool of units
 * (chosen freely, must be a multiple of 5) and plays consecutive rounds,
 * each drawing 5 FRESH, never-repeated cards from that pool, until one
 * side can no longer field a full hand.
 *
 * Core mechanic (confirmed design, see ROADMAP discussion): every round,
 * both players draw 5 cards from their own remaining pool - those 5 are
 * gone from that pool once drawn, regardless of what happens to them in
 * the match (won, lost, doesn't matter). Trade Rule outcomes are a pure
 * BONUS on top: if you win and the configured trade rule transfers cards,
 * whatever gets taken from the loser's board-controlled cards is ADDED
 * into the winner's pool for future rounds - a genuine extra asset, not
 * just "keeping what's yours". This was chosen over a "kept cards return
 * to your pool" model because that alternative gets inconsistent fast
 * (Direct barely drains pools at all, other rules drain much faster) -
 * this version drains at a consistent, predictable rate per round, with
 * trade providing the dramatic attrition swings.
 *
 * A round that ends in a draw does NOT resolve via this store at all -
 * the caller (App-level orchestration) triggers gameStore's existing
 * Sudden Death rematch instead and keeps waiting for a decisive result;
 * applyRoundResult should only ever be called with a real winner.
 */
import { create } from 'zustand';
import type { PlayerColour } from '../engine/types';
import { shuffle } from '../utils/shuffle';

/** Minimum cards drawn per round; a pool below this can no longer field a fresh hand. */
export const ROUND_HAND_SIZE = 5;

export interface RoundRecord {
  roundNumber: number;
  winner: PlayerColour;
  tradeTransferredCount: number;
}

export interface SeriesState {
  /** Null until a series has been initialized. */
  poolSize: number | null;
  /** Remaining, not-yet-drawn unit ids for each side. */
  bluePool: string[];
  redPool: string[];
  roundNumber: number;
  blueWins: number;
  redWins: number;
  /** Set once the series has concluded. */
  seriesWinner: PlayerColour | 'draw' | null;
  roundHistory: RoundRecord[];

  /** Starts a new series with each side's full chosen pool (must be equal length, a multiple of 5). */
  initSeries: (bluePool: string[], redPool: string[]) => void;
  /** Draws (and removes) exactly ROUND_HAND_SIZE unit ids from each side's remaining pool for the next round. */
  drawRoundHands: () => { blueHand: string[]; redHand: string[] };
  /**
   * Applies a decisive (non-draw) round result: adds any trade-transferred
   * units to the winner's pool, records the round, and checks whether the
   * series has now ended (a pool has dropped below ROUND_HAND_SIZE).
   */
  applyRoundResult: (
    winner: PlayerColour,
    tradeTransferred: { unitId: string; to: PlayerColour }[],
  ) => void;
  reset: () => void;
}

/** True if a pool still has enough cards to field one more fresh hand. */
function canFieldRound(pool: string[]): boolean {
  return pool.length >= ROUND_HAND_SIZE;
}

/** Decides the series winner once at least one side can no longer field a round - see file header. */
function resolveSeriesEnd(
  bluePool: string[],
  redPool: string[],
  blueWins: number,
  redWins: number,
): PlayerColour | 'draw' | null {
  const blueCan = canFieldRound(bluePool);
  const redCan = canFieldRound(redPool);

  if (blueCan && redCan) return null;
  if (blueCan && !redCan) return 'blue';
  if (!blueCan && redCan) return 'red';

  // Neither side can continue - fall back to whoever won more rounds.
  if (blueWins > redWins) return 'blue';
  if (redWins > blueWins) return 'red';
  return 'draw';
}

export const useSeriesStore = create<SeriesState>((set, get) => ({
  poolSize: null,
  bluePool: [],
  redPool: [],
  roundNumber: 0,
  blueWins: 0,
  redWins: 0,
  seriesWinner: null,
  roundHistory: [],

  initSeries: (bluePool, redPool) => {
    set({
      poolSize: bluePool.length,
      bluePool: [...bluePool],
      redPool: [...redPool],
      roundNumber: 1,
      blueWins: 0,
      redWins: 0,
      seriesWinner: null,
      roundHistory: [],
    });
  },

  drawRoundHands: () => {
    const { bluePool, redPool } = get();
    const shuffledBlue = shuffle(bluePool);
    const shuffledRed = shuffle(redPool);

    const blueHand = shuffledBlue.slice(0, ROUND_HAND_SIZE);
    const redHand = shuffledRed.slice(0, ROUND_HAND_SIZE);

    set({
      bluePool: shuffledBlue.slice(ROUND_HAND_SIZE),
      redPool: shuffledRed.slice(ROUND_HAND_SIZE),
    });

    return { blueHand, redHand };
  },

  applyRoundResult: (winner, tradeTransferred) => {
    const state = get();
    const bluePool = [...state.bluePool];
    const redPool = [...state.redPool];

    for (const { unitId, to } of tradeTransferred) {
      if (to === 'blue') bluePool.push(unitId);
      else redPool.push(unitId);
    }

    const blueWins = state.blueWins + (winner === 'blue' ? 1 : 0);
    const redWins = state.redWins + (winner === 'red' ? 1 : 0);

    const record: RoundRecord = {
      roundNumber: state.roundNumber,
      winner,
      tradeTransferredCount: tradeTransferred.length,
    };

    const seriesWinner = resolveSeriesEnd(bluePool, redPool, blueWins, redWins);

    set({
      bluePool,
      redPool,
      blueWins,
      redWins,
      roundNumber: state.roundNumber + 1,
      roundHistory: [...state.roundHistory, record],
      seriesWinner,
    });
  },

  reset: () =>
    set({
      poolSize: null,
      bluePool: [],
      redPool: [],
      roundNumber: 0,
      blueWins: 0,
      redWins: 0,
      seriesWinner: null,
      roundHistory: [],
    }),
}));