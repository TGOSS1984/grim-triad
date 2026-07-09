# Grim Triad

A Warhammer 40k themed card battler in the style of Triple Triad. Build a points-capped
army roster from a 40k faction, then battle on a 3x3 grid using directional capture rules
plus a full suite of optional modifier rules (Open, Same, Plus, Elemental, Trade Rules,
and more).

See [`ROADMAP.md`](./ROADMAP.md) for the full architecture, data model, and commit-by-commit
build plan.

## Tech stack

React 18 + TypeScript, Vite, Zustand, Framer Motion, Vitest. No backend for v1 — fully
static, client-side app. See `ROADMAP.md` Section 2 for full reasoning.

## Getting started

```bash
npm install
npm run dev        # start dev server
npm run test        # run test suite
npm run build:data  # regenerate unit/faction JSON from the source MFM catalogue
npm run build       # production build
```

## Project status

Phase 0 (tooling scaffold) complete. See `ROADMAP.md` Section 8 for the full phase plan
and current progress.

## Data source

Unit stats and points are derived from the Warhammer 40,000 10th Edition Munitorum Field
Manual v2.3 (March 2025), via a structured catalogue workbook at
`data/source/Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx`.
See `ROADMAP.md` Section 4 for how points map to in-game card stats.
