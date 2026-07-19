/**
 * Core types for the Grim Triad game engine.
 *
 * This module has ZERO dependencies on React, the DOM, or any UI library.
 * It is pure data + the shapes that `board.ts`, `capture.ts`, `gameReducer.ts`,
 * and every rule in `rules/` operate on. This separation is what allows the
 * same engine to power PvC now and local/online PvP later without a rewrite —
 * see ROADMAP.md Section 2.
 */

/** The four card sides, matching the 4 cells adjacent to a board position. */
export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * A card's power on a given side. 1-9 are literal values; 10 represents the
 * "A" rank (highest possible), stored numerically so all comparisons/maths
 * (capture checks, Plus sums, Elemental +/-1) work without special-casing.
 * Display layers are responsible for rendering 10 as "A".
 */
export type SideValue = number; // 1-10 inclusive, enforced by data pipeline + schema

export interface CardStats {
  top: SideValue;
  bottom: SideValue;
  left: SideValue;
  right: SideValue;
}

/** The two player colours. Matches the two card template PNGs (red/blue). */
export type PlayerColour = 'blue' | 'red';

/** Reserved for the Elemental rule; assigned per-card in a later data pass. */
export type Element = string;

/**
 * A single card instance in play. `unitId` links back to the sourced 40k
 * unit data (see src/data/schema.ts) for name/faction/points/portrait -
 * the engine itself never needs to know about factions or points, only
 * the battle-relevant stats.
 */
export interface Card {
  /** Unique instance id (a card in a player's deck), distinct from unitId. */
  instanceId: string;
  /** Links to the sourced unit this card represents. */
  unitId: string;
  stats: CardStats;
  element?: Element;
  owner: PlayerColour;
  /**
   * The unit catalog's keyword tags for this card (e.g. "Psyker", "Epic
   * Hero", "Infantry") - see data/schema.ts's Unit.keywords, threaded
   * through at hand-build time (see state/matchSetup.ts's unitIdsToHand).
   * Optional so existing Card fixtures across the codebase (many
   * constructed directly in tests) don't all need updating - a card with
   * no keywords is simply not eligible for any keyword-gated rule (see
   * rules/keywords.ts), same graceful-degradation stance as `element`
   * being optional.
   */
  keywords?: string[];
  /**
   * The faction/chapter slug this card was actually drafted/recruited
   * under (e.g. "blood-angels"), as chosen by whichever player built this
   * roster - NOT necessarily the same as the underlying unit's own static
   * faction. This distinction only matters for shared/generic units (e.g.
   * a generic Space Marines unit fielded as part of a Blood Angels
   * roster): the unit's own data still says "Space Marines", but this
   * field says "blood-angels" so the card visually belongs to the
   * roster the player actually built. See matchSetup.ts's unitIdsToHand
   * and data/activeFactions.ts's getFactionSlugForRosterName. Optional
   * since not every caller needs card-back branding (e.g. engine tests).
   */
  rosterFactionSlug?: string;
  /**
   * The unit catalog's unitType (e.g. "Infantry", "Vehicle", "Monster") -
   * see data/schema.ts's Unit.unitType, threaded through at hand-build
   * time. Used by the Combined Arms rule (rules/combinedArms.ts) to check
   * whether two adjacent friendly cards are different types. Optional for
   * the same reason keywords/element are - most existing Card fixtures
   * across the codebase don't set it, and a card with no unitType simply
   * never qualifies for a Combined Arms bonus either way.
   */
  unitType?: string;
  /**
   * The unit catalog's points cost - see data/schema.ts's Unit.points,
   * threaded through at hand-build time. Used by the Underdog rule (see
   * gameReducer.ts's applyMove) to compare the capturing card's cost
   * against what it just captured. Optional for the same reason as the
   * other catalog-sourced fields above.
   */
  points?: number;
  /**
   * Set once, permanently, the first time this card captures something
   * costing at least 50% more than itself (Underdog rule) - never
   * cleared for the rest of the match, even if this card is later
   * recaptured by the opponent (the bonus follows the card instance, not
   * "is this currently a winning position"). Capped at a single +1, not
   * a counter - a card can't stack multiple Underdog bonuses by
   * capturing several expensive cards in the same or later moves.
   */
  hasUnderdogBonus?: boolean;
}

/** A position on the 3x3 board, row/col each 0-2. */
export interface Position {
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
}

/** A single board cell: empty, or occupied by a card belonging to a player. */
export interface BoardCell {
  card: Card | null;
  /** Elemental rule: this cell's terrain element, if the rule is active. */
  element?: Element;
}

/** The 3x3 board, row-major: board[row][col]. */
export type Board = [
  [BoardCell, BoardCell, BoardCell],
  [BoardCell, BoardCell, BoardCell],
  [BoardCell, BoardCell, BoardCell],
];

/** Which optional rule modifiers are active for this match. See ROADMAP.md. */
export interface RuleSet {
  open: boolean;
  suddenDeath: boolean;
  random: boolean;
  same: boolean;
  sameWall: boolean;
  plus: boolean;
  elemental: boolean;
  /**
   * Chain: extends the plain higher-value base capture into a cascade -
   * each card captured this way immediately re-checks its OWN other
   * neighbors using the same higher-value rule, chaining further captures
   * until nothing more falls. This is the same cascade mechanic Same/Plus
   * already trigger after THEIR captures (see rules/chainCascade.ts) -
   * Chain is what lets an ordinary capture (no Same/Plus match needed)
   * cascade the same way.
   */
  chain: boolean;
  /**
   * Heroic: cards with the "Epic Hero" keyword (see data/schema.ts's
   * Unit.keywords - the game's named/unique characters) can't be captured
   * by a Same or Plus value-match, or swept up by the cascade that
   * follows one - only a genuine higher-value flanking capture (the base
   * rule) can take them down, with or without Chain. They're not
   * invincible, just immune to being "gotcha"-captured by a lucky number
   * match rather than actually being outmatched. See
   * rules/keywords.ts's isEpicHero, which ruleEngine.ts uses to exclude
   * these cards from Same/Plus's own matching checks entirely (as if
   * that neighbor position were simply absent for matching purposes).
   */
  heroic: boolean;
  /**
   * Combined Arms: two adjacent FRIENDLY cards with different unitType
   * (see data/schema.ts's Unit.unitType - Infantry/Character/Vehicle/
   * Monster/etc.) each get +1 on the side facing each other. Checked
   * per-side, per-neighbor independently - a card boxed in by 2 or 3
   * different-type friendly neighbors can be boosted on that many sides
   * at once. Board only (see rules/combinedArms.ts) - a card still in
   * hand has no neighbors to combine with yet, same reasoning as
   * Elemental only mattering once placed.
   */
  combinedArms: boolean;
  /**
   * Underdog: the first time a card captures something costing at least
   * 50% more than itself (via any capture mechanism - base, Same, Plus,
   * or a Chain-cascade neighbor check), it permanently gains +1 on all
   * four sides for the rest of the match - see Card.hasUnderdogBonus's
   * own doc for why this needs to be a persistent per-card flag rather
   * than a live board calculation the way Elemental/Combined Arms are.
   * Scoped to the DIRECTLY-PLACED card only, not every card in a cascade
   * chain that individually captures something - see gameReducer.ts's
   * applyMove for why attributing Underdog per-cascade-link would need a
   * much larger engine change to track capture causality, not just this
   * rule's own logic.
   */
  underdog: boolean;
  /**
   * Epic Hero Presence: if a player's STARTING hand contains an Epic
   * Hero (see rules/keywords.ts's isEpicHero), one random side is chosen
   * ONCE for that player at the start of the match, and every card that
   * player owns - in hand AND on the board - gets +1 on that side for
   * the whole match. Unlike Elemental/Combined Arms/Underdog, this is
   * NOT board-only: it's a standing army-wide buff representing having a
   * legendary character in your ranks, not a positional or event-driven
   * effect, so it has to apply even to cards still in hand. See
   * GameState.epicHeroPresence for where the chosen side is stored.
   */
  epicHeroPresence: boolean;
  tradeRule: 'one' | 'diff' | 'direct' | 'all';
}

export interface PlayerState {
  colour: PlayerColour;
  /** Cards not yet played this match. */
  hand: Card[];
}

export type GamePhase = 'coinFlip' | 'playing' | 'suddenDeath' | 'finished';

export interface GameState {
  board: Board;
  players: Record<PlayerColour, PlayerState>;
  /** Whose turn it is to place a card. */
  activePlayer: PlayerColour;
  ruleSet: RuleSet;
  phase: GamePhase;
  /** Populated once phase === 'finished'. */
  winner: PlayerColour | 'draw' | null;
  /** Move history, useful for animation replay, undo (dev tooling), and later networked sync. */
  history: Move[];
  /**
   * The capture result of the most recent move, in the order captures
   * actually resolved (immediate captures first, then any combo-chain
   * captures in discovery order) - optional so it's a non-breaking
   * addition for any code constructing a GameState directly. Lets the UI
   * (see GameScreen) stagger flip animations for multi-card captures
   * instead of flipping every captured card at the exact same instant.
   */
  lastCapture?: { positions: Position[]; comboTriggered: boolean; captureKinds: CaptureKind[] };
  /**
   * Which side (if any) each player's cards get +1 on for the whole
   * match, from the Epic Hero Presence rule - see RuleSet.epicHeroPresence's
   * own doc. Computed once, at game start, from each player's STARTING
   * hand only (see gameReducer.ts's startGame) - a side drawn later
   * doesn't retroactively grant this, since the check is "did this
   * player's force ride out with a legendary character," not "do they
   * currently hold one in hand." Absent for a player whose starting hand
   * had no Epic Hero.
   */
  epicHeroPresence?: Partial<Record<PlayerColour, Side>>;
}

/** A player action: place a card from hand onto a board position. */
export interface Move {
  player: PlayerColour;
  card: Card;
  position: Position;
}

/**
 * Which mechanism captured a given card - lets the UI give each rule its
 * own distinct visual "tell" (see CardCaptureFlame.tsx) instead of every
 * capture looking identical regardless of which rule caused it:
 *  - 'base': the plain higher-value flanking capture, the rule every
 *    match has active. The default/familiar look.
 *  - 'same': directly matched via the Same rule (2+ equal facing values).
 *  - 'plus': directly matched via the Plus rule (2+ equal side sums).
 *  - 'cascade': NOT a direct trigger of any rule above - this card fell
 *    as a secondary reaction, either from Same/Plus's own built-in
 *    cascade after their initial match, or from the standalone Chain
 *    rule cascading a plain base capture. Same mechanic either way (see
 *    rules/chainCascade.ts's cascadeCaptures, which same.ts, plus.ts, and
 *    ruleEngine.ts's Chain path all call into) - the UI doesn't need to
 *    know which rule STARTED the cascade, only that this particular card
 *    was swept up by it rather than being the initiating capture.
 */
export type CaptureKind = 'base' | 'same' | 'plus' | 'cascade';

/**
 * The result of resolving a single placement: which opponent cards (if any)
 * flipped, and whether a Same/Plus combo chain was triggered. UI layers use
 * this to drive flip animations without re-deriving what happened.
 */
export interface CaptureResult {
  /** Positions of cards that flipped to the placing player's colour. */
  captured: Position[];
  /** True if this placement triggered a Same or Plus combo chain reaction. */
  comboTriggered: boolean;
  /** Which mechanism captured each entry in `captured`, same order/length - see CaptureKind's own doc. */
  captureKinds: CaptureKind[];
}

/**
 * Resolves a card's EFFECTIVE stats given where it's currently sitting on
 * the board - used so positional modifiers (currently just Elemental) can
 * apply symmetrically to whichever card is being compared in a capture
 * check, not only the card that was just placed. Defaults to an identity
 * resolver (a card's raw printed stats) when no positional modifier is
 * active - see ruleEngine.ts for how this gets wired up.
 */
export type StatsResolver = (card: Card, pos: Position) => CardStats;