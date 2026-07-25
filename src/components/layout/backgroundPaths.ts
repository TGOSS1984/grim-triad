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
 * - The 3x3 battle grid itself has its own single decorative emblem,
 *   independent of the battle background pool above - see Board.module.css
 *   (a plain CSS background-image, not plumbed through a component prop
 *   the way the paths below are, since it's one fixed image with no
 *   per-screen variation to choose between - CSS can't import this
 *   constant directly, so this entry exists purely as the documented
 *   convention for where to drop the file; the actual reference lives in
 *   that CSS module).
 */

export const HOME_BACKGROUND_PATH = 'assets/backgrounds/home.jpg';

export const ROSTER_BACKGROUND_PATH = 'assets/backgrounds/roster.jpg';

export const BATTLE_BACKGROUND_POOL = [
  'assets/backgrounds/battle-1.jpg',
  'assets/backgrounds/battle-2.jpg',
  'assets/backgrounds/battle-3.jpg',
  'assets/backgrounds/battle-4.jpg',
];

/** See Board.module.css's .boardEmblem - documented here for discoverability alongside the other background path conventions, even though CSS references it directly rather than through this constant. */
export const BOARD_EMBLEM_PATH = 'assets/backgrounds/board-emblem.png';