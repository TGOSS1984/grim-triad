/**
 * Resolves a path under public/ (e.g. 'assets/factions/necrons/icon.png')
 * to the correct URL for wherever this app is actually deployed, by
 * prefixing it with Vite's own configured base (import.meta.env.BASE_URL
 * - see vite.config.ts's own `base` setting) instead of assuming the app
 * is served from the domain root.
 *
 * This matters specifically for GitHub Pages: a repo NOT named
 * '<username>.github.io' is served from a SUBPATH
 * (https://<username>.github.io/repo-name/), not the root. A hardcoded
 * leading '/' on an asset path resolves to the wrong place there (e.g.
 * '/assets/...' would point at https://<username>.github.io/assets/...,
 * missing '/repo-name/' entirely - a 404). Vite already rewrites any
 * asset it can see at build time (an `import` of an image, a CSS
 * `url()` pointing at a bundled file) to respect `base` automatically -
 * this helper exists for the handful of places that instead construct a
 * public/ asset URL themselves at runtime, from a plain string (faction
 * icons, card portraits/backs, background images - all built from a
 * dynamic slug/unit id, not a static import Vite could rewrite).
 *
 * BASE_URL always ends with a trailing slash (Vite's own guarantee, true
 * for both '/' and '/repo-name/'), so this strips any leading slash from
 * `path` first to avoid a double slash in the result either way.
 */
export function publicAssetPath(path: string): string {
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${relativePath}`;
}