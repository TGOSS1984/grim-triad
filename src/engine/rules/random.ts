/**
 * Random rule: instead of the player manually picking their 5-card hand
 * from their full army roster, the hand is drawn randomly from that
 * roster's card pool.
 *
 * This applies at army-builder/pre-game time, not mid-match, so it has no
 * interaction with the board or capture logic - it only produces the
 * starting hand that gets passed into `createGame`.
 */
import type { Card } from '../types';
import { shuffle } from '../../utils/shuffle';

/**
 * Draws `count` random cards from `pool` (e.g. a player's full points-legal
 * roster) to form a starting hand. Throws if the pool is smaller than the
 * requested hand size, since that indicates a broken army-builder state
 * rather than something the UI should silently tolerate.
 */
export function drawRandomHand(pool: Card[], count: number): Card[] {
  if (pool.length < count) {
    throw new Error(
      `Cannot draw a hand of ${count} cards from a pool of only ${pool.length}`,
    );
  }
  return shuffle(pool).slice(0, count);
}