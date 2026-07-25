/**
 * Shared animation timing constants. These live in one place because two
 * very different parts of the app need to agree on the same numbers:
 *  - Card.tsx uses these to actually run the flip animation.
 *  - gameStore.ts uses these to know how long to wait before applying the
 *    AI's next move, so it doesn't step on the tail of the human's own
 *    move's capture animation (see computeMoveAnimationDurationMs below -
 *    this was the actual bug: the AI's response was being applied and
 *    committed to the store in the same synchronous call as the human's
 *    move, so React rendered both outcomes at once with no visible pause
 *    between "you captured a card" and "the AI took it right back").
 *  - App.tsx uses computeGameEndDelayMs specifically for the
 *    finished-game -> results-screen transition (see its own doc below).
 *
 * If Card.tsx's flip duration or GameScreen's stagger amount ever change,
 * change them here - don't hand-tune a second copy of the same number
 * somewhere else.
 */

/** Total duration (ms) of a single card's capture flip animation (shrink + expand). */
export const CAPTURE_FLIP_DURATION_MS = 700;

/** Delay (ms) between each successive card's flip start in a multi-card combo capture. */
export const CAPTURE_FLIP_STAGGER_MS = 220;

/** Small buffer (ms) before any flip starts, and after the last one finishes, before the next move should visibly begin. */
export const MOVE_SETTLE_BUFFER_MS = 300;

/**
 * How long to wait before applying the next move (e.g. the AI's turn),
 * given how many cards the previous move captured - scales with combo
 * size so a 3-card chain gets enough time to actually be watched, not
 * just a flat delay tuned only for the single-card case.
 */
export function computeMoveAnimationDurationMs(capturedCount: number): number {
  if (capturedCount === 0) {
    return MOVE_SETTLE_BUFFER_MS;
  }
  const lastCardFlipStartDelay = (capturedCount - 1) * CAPTURE_FLIP_STAGGER_MS;
  return MOVE_SETTLE_BUFFER_MS + lastCardFlipStartDelay + CAPTURE_FLIP_DURATION_MS;
}

/**
 * Extra beat, on top of computeMoveAnimationDurationMs, specifically for
 * the moment a MATCH ends - not just the moment a MOVE finishes
 * animating. Those aren't the same pause: computeMoveAnimationDurationMs
 * is tuned only to not cut off a capture's own flip animation, which
 * gives almost no pause at all when the winning move captures nothing
 * (falls straight through to MOVE_SETTLE_BUFFER_MS - 300ms). That's fine
 * mid-match (the next move is coming immediately either way), but at the
 * very end of a match the ENTIRE SCREEN changes to the results screen
 * right after - 300ms was nowhere near enough time to actually take in
 * the final board state before it vanished. This is a deliberate second,
 * larger pause layered on top for that one specific transition.
 */
export const GAME_END_EXTRA_PAUSE_MS = 1000;

/**
 * Total delay (ms) before navigating away from a just-finished match to
 * its results screen - the normal per-move animation wait PLUS the extra
 * end-of-game beat above. See App.tsx's game-finished effect, the one
 * caller of this.
 */
export function computeGameEndDelayMs(capturedCount: number): number {
  return computeMoveAnimationDurationMs(capturedCount) + GAME_END_EXTRA_PAUSE_MS;
}