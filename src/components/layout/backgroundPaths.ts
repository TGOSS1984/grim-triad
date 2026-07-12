/**
 * Background image path CONVENTIONS - no actual files exist at these
 * paths yet (see BackgroundLayer's own header for why that's fine: it
 * falls back to the token gradient whenever an image 404s, with no
 * special-casing needed). This file exists so that dropping real art into
 * public/assets/backgrounds/ at these exact filenames is a drop-in change
 * with zero further code edits - one place defines where each screen
 * looks, rather than that convention being implicit/undocumented.
 *
 * - Home and the roster (army builder) screen each use ONE fixed image.
 * - Battle (GameScreen) picks randomly from a pool per match - see
 *   backgroundUtils.ts's pickRandomBackground, and GameScreen for how the
 *   pick is memoized so it doesn't re-roll on every re-render.
 */

export const HOME_BACKGROUND_PATH = 'assets/backgrounds/home.jpg';

export const ROSTER_BACKGROUND_PATH = 'assets/backgrounds/roster.jpg';

export const BATTLE_BACKGROUND_POOL = [
  'assets/backgrounds/battle-1.jpg',
  'assets/backgrounds/battle-2.jpg',
  'assets/backgrounds/battle-3.jpg',
  'assets/backgrounds/battle-4.jpg',
];