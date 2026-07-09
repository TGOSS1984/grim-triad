# [Working Title: "GRIM TRIAD"] — Build Roadmap

> Working name — needs a real 40k-flavored name. Candidates to bikeshed later:
> **Wargrid**, **Triad of War**, **The Tessera Wars**, **Ninefold Ground**, **Occulus Triad**,
> **Warp Triad**, **Manifold War** — parking this, not blocking.

## 1. Premise

A Triple Triad–style card battler skinned in Warhammer 40k. Players build a points-capped
army roster from a chosen faction, draw a 5-card hand, and battle on a 3x3 grid using
directional capture rules plus a full suite of optional modifier rules (Open, Same, Plus,
Elemental, Trade Rules, etc). v1 targets Player vs Computer; the engine is built so
Player vs Player (local hotseat now, online later) is a data/transport change, not a rewrite.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React 18 + TypeScript** | Strong typing for a rules-heavy engine, huge animation/state ecosystem, best AI-pair-coding support |
| Build tool | **Vite** | Fast dev server, trivial static build output, zero-config TS+React |
| Styling | **CSS Modules + a small design-token file** (no Tailwind) | Bespoke grimdark look needs real custom styling, not utility-class defaults; CSS Modules keep styles scoped per component |
| Animation | **Framer Motion** | Card move/flip/hover animations, works cleanly with React state, good mobile perf |
| State management | **Zustand** | Lightweight, avoids Redux boilerplate, easy to snapshot/replay game state (useful for undo, AI simulation, later networked play) |
| Game engine | **Plain TypeScript module, framework-agnostic** | Pure functions `applyMove(state, move) -> state`. No React/DOM inside it. This is what lets PvP bolt on later without a rewrite. |
| Data pipeline | **TypeScript Node script** (CSV → validated JSON) | One language across the whole repo; runs at build/authoring time only, never shipped to the browser |
| Testing | **Vitest** | Pairs natively with Vite; engine logic (captures, combos, elemental math) needs real unit tests since it's easy to get subtly wrong |
| Hosting | **Vercel or Cloudflare Pages** (static) | Free tier, push-to-deploy from GitHub, zero server to maintain for v1 |
| Backend (v1) | **None** | See rationale below |

### Why no backend for v1
All v1 game logic (battles, AI, modifiers, deckbuilding) runs client-side. Roster/army data
is static JSON generated ahead of time from your CSV. Player progress/collection state
lives in `localStorage`. This keeps v1 simple, free to host, and fast to iterate on.

### Path to PvP later (no rewrite required)
The engine module (`/src/engine`) only knows about `GameState` and `Move` — it has zero
knowledge of where a move came from. Local hotseat PvP = two humans feeding moves into
the same engine on one screen. Online PvP = a thin relay (WebSocket service, e.g. a small
Node/Fastify service or a hosted realtime service) that validates and forwards `Move`
objects between two clients, each running the same engine to render state. This is an
additive phase, not a foundation change.

### Why not Python
No part of v1 needs a server, and keeping the data pipeline in TypeScript avoids running
two toolchains (Node + a Python venv) side by side for a repo that's otherwise 100% TS.
Python earns its place later only if we want a heavier AI (minimax with deep lookahead,
simulation-based faction balance testing, or an ML-trained opponent) — that would be an
**offline research tool** whose output feeds into the JS AI, not a runtime dependency.

## 3. Project Structure

```
grim-triad/
├── ROADMAP.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
│
├── data/                          # source-of-truth data authored by you
│   ├── units.csv                  # raw spreadsheet export you provide
│   └── factions.csv                # faction metadata (name, colour, icon)
│
├── scripts/
│   └── build-data.ts              # CSV -> validated JSON, run via `npm run build:data`
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── engine/                    # pure game logic, NO React/DOM imports allowed
│   │   ├── types.ts               # Card, GameState, Move, RuleSet, Player, etc.
│   │   ├── board.ts               # grid helpers, adjacency
│   │   ├── capture.ts             # core capture resolution
│   │   ├── rules/
│   │   │   ├── open.ts
│   │   │   ├── suddenDeath.ts
│   │   │   ├── random.ts
│   │   │   ├── same.ts
│   │   │   ├── sameWall.ts
│   │   │   ├── plus.ts
│   │   │   ├── elemental.ts
│   │   │   └── tradeRules.ts       # one/diff/direct/all
│   │   ├── ruleEngine.ts          # composes active rule modifiers into one resolver
│   │   ├── gameReducer.ts         # applyMove(state, move) -> state
│   │   └── engine.test.ts         # (mirrored per-rule test files too)
│   │
│   ├── ai/
│   │   ├── types.ts
│   │   ├── heuristicAI.ts         # v1 opponent: scored move search, 1-2 ply lookahead
│   │   └── ai.test.ts
│   │
│   ├── data/
│   │   ├── units.generated.json   # OUTPUT of scripts/build-data.ts — gitignored or committed, TBD
│   │   ├── factions.generated.json
│   │   └── schema.ts              # zod schema mirroring engine types, used to validate generated JSON
│   │
│   ├── state/
│   │   ├── gameStore.ts           # zustand store wrapping the engine for React
│   │   └── armyBuilderStore.ts    # points totals, roster selection state
│   │
│   ├── components/
│   │   ├── card/
│   │   │   ├── Card.tsx
│   │   │   ├── Card.module.css
│   │   │   └── CardBack.tsx
│   │   ├── board/
│   │   │   ├── Board.tsx
│   │   │   ├── BoardCell.tsx
│   │   │   └── Board.module.css
│   │   ├── hand/
│   │   │   └── Hand.tsx
│   │   ├── coinFlip/
│   │   │   └── CoinFlip.tsx
│   │   ├── armyBuilder/
│   │   │   ├── ArmyBuilder.tsx
│   │   │   ├── FactionSelect.tsx
│   │   │   ├── UnitPicker.tsx
│   │   │   └── PointsTally.tsx
│   │   ├── ruleSelect/
│   │   │   └── RuleSelectScreen.tsx
│   │   └── layout/
│   │       ├── ResponsiveGameLayout.tsx
│   │       └── BackgroundLayer.tsx
│   │
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ArmyBuilderScreen.tsx
│   │   ├── RuleSelectScreen.tsx
│   │   ├── GameScreen.tsx
│   │   └── ResultScreen.tsx
│   │
│   ├── theme/
│   │   ├── tokens.css              # colour, spacing, font tokens
│   │   └── fonts.css
│   │
│   └── utils/
│       └── shuffle.ts, id.ts, etc.
│
└── public/
    └── assets/
        ├── cardTemplates/
        │   ├── template-red.png
        │   └── template-blue.png
        ├── factions/
        │   └── <faction-slug>/
        │       ├── icon.png                     # faction symbol
        │       └── units/
        │           ├── <unit-slug>.png          # portrait, naming = CSV slug
        │           └── _fallback.png            # generic silhouette per faction
        ├── backgrounds/
        │   └── battle-01.jpg ... battle-NN.jpg
        └── fonts/
            └── (self-hosted via @fontsource npm packages, see Section 6.1 note - not manual files here)
```

### Card template strategy (your question)
**Use the repeatable template PNGs as a frame layer + compose portrait art on top at
render time — do not pre-bake hundreds of flattened card images.**

- `template-red.png` / `template-blue.png` are the two frame assets you supply (owner colour).
- Each unit has **one portrait PNG only** (`assets/factions/<faction>/units/<unit-slug>.png`).
- The `Card` component layers: template PNG (bottom) → portrait PNG (masked into the
  window area) → faction icon (top) → numbers (rendered as styled text/SVG, not baked
  into images) → name plate text.
- **Why:** stat numbers are dynamic data, not art — baking them into flattened images
  means regenerating art every time you rebalance a card. Compositing at render time
  means a CSV edit is the only change needed. It's also dramatically less asset-storage
  and production work than authoring a unique flattened card per unit.
- **Fallback:** if `<unit-slug>.png` is missing, the `Card` component automatically falls
  back to `_fallback.png` for that faction (or a global generic silhouette if the faction
  fallback is also missing). This is a simple existence-check + `onError` swap in the
  image loader — you can add real art incrementally with zero code changes, as you said.

### 3.1 Visual Theme (confirmed in Phase 6.1)

**Colour palette**: supplied by the user (Space Marine 2 UI references + the
card template art), mapped to semantic CSS custom properties in
`src/theme/tokens.css` rather than used as raw hex in components. Two
colours were added to fill genuine gaps in the supplied palette (which had
no light/near-white tone and no red) - flagged explicitly in that file's
header rather than silently invented.

**Typography**: a two-font system rather than a single face, since Zen Dots
(the user's suggested display font - geometric, blocky, futuristic-stencil)
is too heavy to read comfortably at small sizes for body copy:
- **Zen Dots** - titles, faction/unit names, card stat numbers.
- **Rajdhani** - buttons, descriptions, rule text, any longer-form UI copy.
  Condensed technical sans with a HUD/military terminal feel matching the
  Space Marine 2 reference screenshots.

Both are self-hosted via `@fontsource/zen-dots` and `@fontsource/rajdhani`
npm packages rather than manually-managed files under `public/assets/fonts/`
as originally planned - Vite's asset pipeline already bundles, hashes, and
cache-busts anything imported as CSS/JS, so there's no binary font file to
hand around or keep in sync; `npm install` is sufficient.

**Card templates**: `template-blue.png` / `template-red.png` (renamed from
the user-supplied `blue_card.png`/`red_card.png` to match this document's
existing naming convention) live in `public/assets/cardTemplates/`, each
1024x1536 with genuine alpha transparency outside the ornate frame border -
confirmed by inspecting actual pixel data, not assumed - so they composite
cleanly over any background in the Card component (Phase 7).



Source: `Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx`,
`Master Catalogue` sheet — 819 rows, 29 factions, 768 with verified points (20–800pt range).
Also using each faction's dedicated sheet for chapter/subfaction-level data (e.g. Blood
Angels, Dark Angels, Space Wolves, Black Templars, Deathwatch all nest under the base
Space Marines roster — see faction rollup rule below).

```ts
interface Unit {
  id: string;                 // slug generated from Unit Name, matches portrait filename
  name: string;                // Unit Name
  faction: string;              // Faction (parent army-list faction, e.g. "Space Marines")
  subfaction?: string;          // Subfaction/Chapter (e.g. "Blood Angels"), optional
  battlefieldRole: string;      // Battlefield Role (Character / Battleline / Infantry / Vehicle / Monster...)
  unitType: string;             // Unit Type (Infantry / Vehicle / Monster / Walker / Beast / Aircraft / etc)
  models: string;               // raw "Models" field, kept for display/flavour
  keywords: string[];           // parsed from Keywords/Tags, includes flags like "Epic Hero", "Psyker"
  points: number;               // verified Points value from MFM v2.3 — army-builder cost
  statBudget: number;           // derived: log-curve mapped from points (see below)
  stats: { top: number; bottom: number; left: number; right: number }; // 1-9, 10 = "A"
  element?: string;             // reserved for Elemental rule, assigned later per-faction
  portraitPath: string;         // assets/factions/<faction-slug>/units/<id>.png, with fallback
}

interface Faction {
  slug: string;
  name: string;                 // e.g. "Space Marines"
  colour: 'red' | 'blue';       // maps to card template
  active: boolean;               // whether selectable in v1 UI (see Section 4.3)
  unitCount: number;
}
```

### 4.1 Points → Card Stat curve (confirmed)

Raw points span 20–800 (40x range) — mapping linearly onto 1-9/A sides would make cheap
units all-1s and everything above ~250pts indistinguishable maxed-out A's. Instead we
derive a **stat budget** (sum of all 4 sides, A=10) using a log curve, fit so the *common*
range (20–300pts, ~90% of all units) spreads meaningfully across the scale, while the
long tail of rare super-heavies (400-800pts) compresses into a tight "very strong but not
absurd" band rather than blowing the scale out:

```
budget = round( slope * ln(points) + intercept )
  where slope/intercept fit so points=20 -> budget=11, points=800 -> budget=37
```

| Points | Budget | Example stats (T/B/L/R) |
|---|---|---|
| 20 | 11 | 2/3/3/3 |
| 50 | 17 | 4/4/4/5 |
| 95 (median) | 22 | 5/5/6/6 |
| 150 | 25 | 6/6/6/7 |
| 250 | 29 | 7/7/7/8 |
| 400 | 32 | 8/8/8/8 |
| 480 | 33 | 8/8/8/9 |
| 800 (Stompa, max) | 37 | 9/9/9/A |

Budget is then **unevenly distributed across the 4 sides** based on `battlefieldRole`/
`unitType`/`keywords`, so cards have shape rather than being 4 identical numbers:

- **Character / Epic Hero** → front-loaded (high on one signature side, weaker flanks) — duelist feel
- **Vehicle / Monster / Super-heavy** → hull-heavy (high top+bottom, weaker sides)
- **Infantry / Battleline** → balanced, no side far from the others
- **Beast / Swarm / Mounted / Bike** → flanker (high on two adjacent sides, weak opposite corner)

Implemented in `scripts/build-data.ts` as a pure, unit-tested function
(`pointsToBudget`, `budgetToSides`) so the curve/shaping logic can be tuned and re-run
without touching any other code.

### 4.2 Faction rollup rule (Chapters/Sub-factions)

Some factions (Space Marines primarily) have chapter-specific sheets (Blood Angels, Dark
Angels, Space Wolves, Black Templars, Deathwatch) that list **only their unique units** —
the bulk of a chapter's playable roster lives in the base `Space Marines` sheet. The data
pipeline models this explicitly rather than duplicating rows:

- `faction` = parent army-list faction (e.g. `Space Marines`) — drives card colour/template
- `subfaction` = chapter, when present (e.g. `Blood Angels`)
- **Army Builder roster query**: selecting subfaction "Blood Angels" pulls all units where
  `faction = Space Marines AND (subfaction = Blood Angels OR subfaction IS NULL)` — i.e.
  chapter-unique characters/vehicles plus the shared Marine pool. Same mechanism will
  support Dark Angels, Space Wolves, etc. later with zero new code.

### 4.3 Faction activation (build all, ship fewer)

The pipeline generates JSON for **all 29 factions** from the Master Catalogue — this is
zero extra engineering cost since the transform is faction-agnostic. A small `activeFactions`
config list controls which factions are actually selectable in the v1 UI, so we can
validate the fun/balance loop on a manageable set before opening the rest up.

**v1 active factions:** `Blood Angels` (Space Marines base + Blood Angels chapter units,
~90+ unit pool via the rollup rule above), `Tyranids` (46 units), `Necrons` (46 units),
`Aeldari` (47 units). Remaining 25 factions generated into data, held inactive, switched
on by flipping a config flag once art/balance is ready.

### 4.4 Unpriced units

51 of 819 rows have no verified MFM v2.3 points match (`Verification Status = "Not found
in uploaded PDF"`) — likely retired/Legends/renamed units. These are **excluded entirely**
from `units.generated.json` in v1. Revisit if/when a points value is confirmed.

## 5. Game Flow / Screens

1. **Home** → New Game
2. **Faction Select** → pick your army (see all units, points cost per unit)
3. **Army Builder** → pick point cap (500/1000/2000) → select units within cap → running
   points tally → confirm 5+ card roster pool
4. **Rule Select** → choose active modifiers (Open / Same / Plus / Elemental / Trade Rule / etc.),
   or "Randomize rules"
5. **Coin Flip** → animated, decides first player
6. **Game Screen** → 3x3 board, hand left/right, background image, placement + capture
   animations, live score
7. **Result Screen** → win/loss, trade rule resolution (cards won/lost), play again

## 6. AI Approach (v1)

Heuristic scoring function over legal moves: for each (card, cell) pair, simulate the
capture result including active rule modifiers (combos, elemental, etc.), score by net
cards flipped minus risk of exposing a weak side to a strong opponent card next turn
(1-ply lookahead minimum, 2-ply if performance allows). No ML, no Python needed for v1 —
this lives entirely in `src/ai/heuristicAI.ts` as pure TS, unit-testable like the engine.

## 7. Responsive / Mobile Plan

- Board + hands built with CSS Grid/Flexbox using `clamp()` sizing, not fixed pixels.
- Touch-first interaction: tap card in hand → tap board cell (already matches your
  reference images' click-to-place flow, works identically for touch).
- Breakpoint strategy: single fluid layout that reflows hands from left/right-of-board
  (desktop) to above/below-board (narrow mobile), rather than separate mobile-only screens.
- All animations (Framer Motion) tested for reduced-motion accessibility and mobile GPU cost.

## 8. Commit Roadmap

Each commit below lists: **files touched** (tagged `NEW` / `OVERWRITE` / `APPEND`),
**paths**, and a **commit message**. This is the working checklist — I'll execute these
in order in this environment and hand you downloadable output at each step (and a real
git history once we scaffold the repo).

### Phase 0 — Repo & Tooling Foundation
- **0.1** `NEW`: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.eslintrc.cjs`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/App.tsx`
  `chore: scaffold Vite + React + TypeScript project`
- **0.2** `NEW`: `vitest.config.ts`, `src/setupTests.ts`
  `chore: add Vitest testing setup`
- **0.3** `NEW`: `README.md`, `ROADMAP.md`
  `docs: add project README and roadmap`

### Phase 1 — Engine Core (no UI yet, fully unit-tested)
- **1.1** `NEW`: `src/engine/types.ts`
  `feat(engine): define core types (Card, GameState, Move, Player, RuleSet)`
- **1.2** `NEW`: `src/engine/board.ts`
  `feat(engine): grid + adjacency helpers`
- **1.3** `NEW`: `src/engine/capture.ts`, `src/engine/capture.test.ts`
  `feat(engine): base capture resolution + tests`
- **1.4** `NEW`: `src/engine/gameReducer.ts`, `src/engine/engine.test.ts`
  `feat(engine): applyMove reducer, turn flow, win condition`

### Phase 2 — Rule Modifiers (one commit per rule, isolated + tested)
- **2.1** `NEW`: `src/engine/rules/open.ts` → `feat(rules): implement Open rule`
- **2.2** `NEW`: `src/engine/rules/suddenDeath.ts` → `feat(rules): implement Sudden Death`
- **2.3** `NEW`: `src/engine/rules/random.ts` → `feat(rules): implement Random hand rule`
- **2.4** `NEW`: `src/engine/rules/same.ts` + tests → `feat(rules): implement Same + combo detection`
- **2.5** `NEW`: `src/engine/rules/sameWall.ts` → `feat(rules): implement Same Wall`
- **2.6** `NEW`: `src/engine/rules/plus.ts` + tests → `feat(rules): implement Plus + combo detection`
- **2.7** `NEW`: `src/engine/rules/elemental.ts` + tests → `feat(rules): implement Elemental tiles + stat modifiers`
- **2.8** `NEW`: `src/engine/rules/tradeRules.ts` + tests → `feat(rules): implement Trade Rules (One/Diff/Direct/All)`
- **2.9** `NEW`: `src/engine/ruleEngine.ts` (composes 2.1–2.8) → `feat(engine): compose active rule modifiers into resolver`

### Phase 3 — Data Pipeline
- **3.1** `NEW`: `data/source/Warhammer_40K_10th_Edition_Full_Catalogue_With_MFM_March_2025_Points.xlsx`, `src/data/schema.ts`
  `feat(data): add source MFM catalogue + define unit/faction schema`
- **3.2** `NEW`: `scripts/parseCatalogue.ts` (xlsx -> normalized intermediate JSON: faction rollup, keyword parsing, unpriced-row exclusion)
  `feat(data): parse Master Catalogue xlsx into normalized unit records`
- **3.3** `NEW`: `scripts/statCurve.ts`, `scripts/statCurve.test.ts` (pointsToBudget, budgetToSides, role-shaping)
  `feat(data): points-to-card-stat curve with role-based side shaping`
- **3.4** `NEW`: `scripts/build-data.ts` (orchestrates 3.2 + 3.3 -> final JSON, applies activeFactions flag)
  `feat(data): build-data pipeline producing units.generated.json + factions.generated.json`
- **3.5** `NEW`: `src/data/units.generated.json`, `src/data/factions.generated.json`, `src/data/activeFactions.ts` *(generated output + v1 faction toggle: Blood Angels, Tyranids, Necrons, Aeldari active)*
  `chore(data): generate full 29-faction dataset, activate v1 faction set`

### Phase 4 — AI Opponent
- **4.1** `NEW`: `src/ai/types.ts`, `src/ai/heuristicAI.ts`, `src/ai/ai.test.ts`
  `feat(ai): heuristic move-scoring opponent with 1-ply lookahead`

### Phase 5 — State Layer (bridges engine to React)
- **5.1** `NEW`: `src/state/gameStore.ts`
  `feat(state): zustand store wrapping engine + AI turn triggering`
- **5.2** `NEW`: `src/state/armyBuilderStore.ts`
  `feat(state): army builder points/roster state`

### Phase 6 — Theming & Design Tokens
- **6.1** `NEW`: `src/theme/tokens.css`, `src/theme/fonts.css`; `NEW` (assets): `public/assets/cardTemplates/template-blue.png`, `template-red.png`; fonts self-hosted via `@fontsource/zen-dots` + `@fontsource/rajdhani` npm packages (see note below) `OVERWRITE`: `src/main.tsx` (imports global theme)
  `feat(theme): 40k design tokens, colour palette, typography`

### Phase 7 — Card & Board Components
- **7.1** `NEW`: `src/components/card/Card.tsx`, `Card.module.css`, `CardBack.tsx`
  `feat(ui): Card component with template compositing + fallback art`
- **7.2** `NEW`: `src/components/board/Board.tsx`, `BoardCell.tsx`, `Board.module.css`
  `feat(ui): 3x3 battle grid with glow/shadow styling`
- **7.3** `NEW`: `src/components/hand/Hand.tsx`
  `feat(ui): player hand display + card selection`
- **7.4** `OVERWRITE`: `src/components/card/Card.tsx`, `Card.module.css`
  `feat(ui): card placement + capture flip animations (Framer Motion)`

### Phase 8 — Screens & Flow
- **8.1** `NEW`: `src/screens/HomeScreen.tsx` → `feat(ui): home/start screen`
- **8.2** `NEW`: `src/components/armyBuilder/*`, `src/screens/ArmyBuilderScreen.tsx`
  `feat(ui): faction select + army builder with live points tally`
- **8.3** `NEW`: `src/components/ruleSelect/RuleSelectScreen.tsx`
  `feat(ui): rule modifier selection screen`
- **8.4** `NEW`: `src/components/coinFlip/CoinFlip.tsx`
  `feat(ui): animated coin flip to decide first turn`
- **8.5** `NEW`: `src/screens/GameScreen.tsx`, `src/components/layout/*`
  `feat(ui): main game screen wiring board + hands + background`
- **8.6** `NEW`: `src/screens/ResultScreen.tsx`
  `feat(ui): win/loss + trade rule resolution screen`
- **8.7** `NEW`: `src/App.tsx` (routing between screens) `OVERWRITE`
  `feat(app): wire full screen flow start-to-finish`

### Phase 9 — Responsiveness Pass
- **9.1** `OVERWRITE`: various `*.module.css`
  `fix(ui): mobile/responsive layout pass across all screens`

### Phase 10 — Polish & Deploy
- **10.1** `NEW`: `public/assets/backgrounds/*`, background randomization wiring
  `feat(ui): random battle background per match`
- **10.2** `NEW`: `.github/workflows/deploy.yml` (or Vercel config)
  `chore: CI deploy pipeline to static hosting`
- **10.3** `NEW`: `README.md` (deploy instructions) `OVERWRITE`
  `docs: deployment + contribution instructions`

---

## 9. What I need from you to keep moving

1. ~~Units data~~ — **DONE.** Real Munitorum Field Manual v2.3 catalogue received and
   confirmed (819 rows / 29 factions / 768 verified points). Stat curve and v1 faction
   set (Blood Angels, Tyranids, Necrons, Aeldari) confirmed.
2. **The two card template PNGs** (red/blue) at final resolution, and any faction icon
   PNGs you already have — needed for Phase 6/7 (theming, Card component).
3. Confirmation on **font choice** — I can shortlist a few 40k-appropriate free/licensable
   fonts for you to pick from, or you can send one you already like.
4. **Portrait art** for units, as/when available, following the naming convention in
   Section 3 (`assets/factions/<faction-slug>/units/<unit-slug>.png`) — not blocking,
   fallback silhouette covers any gaps.

## 10. Open Questions / Parking Lot

- Final game name.
- Exact points-to-stats balancing formula — will tune once real unit data is in.
- Whether `units.generated.json` gets committed to git or built fresh each time (leaning
  **commit it** for now — simpler deploys, easy diffing of balance changes over time).
- Element types for the Elemental rule — need a 40k-flavored list (e.g. Warp, Fire,
  Void, Toxic, Psychic...) — can propose options once you confirm you want this named/themed.