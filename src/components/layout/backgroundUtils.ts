/**
 * Picks one path at random from a pool of available battle backgrounds.
 * Callers (GameScreen) are expected to call this once per match, not per
 * render - see GameScreen for how it's memoized via useState's lazy
 * initializer. Returns undefined (falls back to the token gradient) if the
 * pool is empty, which it will be until real background art is added.
 *
 * Split into its own file (rather than living in BackgroundLayer.tsx)
 * because mixing a component export with a plain function export in the
 * same file degrades Fast Refresh reliability during development.
 */
export function pickRandomBackground(pool: string[]): string | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}