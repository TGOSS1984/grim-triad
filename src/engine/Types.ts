/**
 * Core types for the Grim Triad game engine. File adjust - lower case t for commit.
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
}

/** A player action: place a card from hand onto a board position. */
export interface Move {
  player: PlayerColour;
  card: Card;
  position: Position;
}

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
}