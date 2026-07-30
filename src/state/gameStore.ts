/**
 * The live-match state layer: wraps the pure engine (createGame/applyMove)
 * in a Zustand store so React components can subscribe to game state and
 * dispatch moves, without any component needing to touch engine internals
 * directly. Also owns AI turn triggering.
 *
 * AI turn timing: the AI's move is NOT applied in the same synchronous
 * call as the human's move. Each move is committed to the store
 * separately, with a real await in between - long enough for that move's
 * own capture-flip animation(s) to actually be seen (see
 * state/animationTiming.ts's computeMoveAnimationDurationMs, which scales
 * with how many cards that move captured). Without this, the human's
 * capture and the AI's immediate response both landed in the same React
 * render, so a card you'd just won back could be re-captured by the AI
 * before you ever saw it change colour - the animation existed, but
 * nothing paused long enough for it to register.
 *
 * matchSameOrPlusComboCount / matchChainReactionCount /
 * matchOpponentCapturedFromHuman: running tallies for THIS match only,
 * reset at the start of every startGame/triggerSuddenDeathRematch call -
 * NOT persisted here, just fed into unlockStore's permanent cross-mode
 * totals once the match actually finishes (see App.tsx's finished-game
 * effect, the only reader of these three fields). They live here rather
 * than being reconstructed after the fact because game.history (see
 * engine/types.ts's Move) only records {player, card, position} per move
 * - it doesn't retain which rule captured what, so "how many Same/Plus
 * triggers happened this match" genuinely can't be answered after the
 * match ends without tracking it AS it happens. Updated right after every
 * applyMove call, for both the human's move (playCard) and each of the
 * AI's (playAITurnsWithDelay) - using the same
 * engine/captureTriggerKind.ts resolver RuleTriggerCallout uses, so
 * what's tracked here always agrees with what the player actually saw
 * called out on screen. Combo/chain counts only accumulate for the
 * HUMAN's own moves (this is meant to track the PLAYER's achievement
 * progress, not "combos that happened in a game they were part of");
 * matchOpponentCapturedFromHuman only ever gets set by an AI move, since
 * only the AI can capture cards FROM the human.
 *
 * matchBlueCaptureBreakdown / matchRedCaptureBreakdown: a different,
 * BOTH-sides running tally for the same underlying reason (game.history
 * doesn't retain which rule captured what, so this has to be tracked
 * live too) but a different shape and purpose - a per-side breakdown of
 * every capture kind (base/same/plus/chain), covering BOTH players'
 * moves rather than just the human's, feeding the result screens' "why
 * you won" summary rather than unlockStore. Kept as its own pair of
 * fields (not folded into the unlock-tracking ones above) since a
 * cascaded 3-card capture should count as 3 individual entries split
 * across whichever kind actually captured each one, not resolved down to
 * one "primary" kind for the whole move the way the unlock/callout
 * tracking deliberately does.
 */
import { create } from 'zustand';
import type {
  Card,
  CaptureKind,
  Element,
  GameState,
  PlayerColour,
  PlayerState,
  Position,
  RuleSet,
} from '../engine/types';
import { createGame, applyMove, DEFAULT_RULE_SET } from '../engine/gameReducer';
import { startSuddenDeathRematch } from '../engine/rules/suddenDeath';
import { resolvePrimaryCaptureTriggerKind } from '../engine/captureTriggerKind';
import { chooseMove } from '../ai/heuristicAI';
import type { AIOptions } from '../ai/types';
import { computeMoveAnimationDurationMs } from './animationTiming';
import { ELEMENT_IDS } from '../data/elements';

export interface StartGameOptions {
  bluePlayer: PlayerState;
  redPlayer: PlayerState;
  startingPlayer: PlayerColour;
  ruleSet?: RuleSet;
  /** Which player colour (if any) the AI controls. Undefined/null = both human (local PvP). */
  aiPlayer?: PlayerColour | null;
  /** Elemental terrain pool; defaults to the app's real themed element list (src/data/elements.ts) so callers don't need to know about Elemental at all unless they want to override it. */
  availableElements?: Element[];
  /** Tunes AI play strength (lookahead weight, mistake chance) - see ai/difficulty.ts. Defaults to heuristicAI's own defaults if omitted. */
  aiOptions?: AIOptions;
}

/** Per-side tally of how many cards were captured by each mechanism this match - see file header. */
export interface CaptureBreakdown {
  base: number;
  same: number;
  plus: number;
  chain: number;
}

export interface GameStoreState {
  game: GameState | null;
  aiPlayer: PlayerColour | null;
  aiOptions: AIOptions;
  /** Running tally of Same/Plus triggers BY THE HUMAN this match - see file header. */
  matchSameOrPlusComboCount: number;
  /** Running tally of Chain triggers BY THE HUMAN this match - see file header. */
  matchChainReactionCount: number;
  /** True once the opponent has captured at least one card from the human at any point this match - see file header. */
  matchOpponentCapturedFromHuman: boolean;
  /** Blue's own captures this match, broken down by kind - see file header. */
  matchBlueCaptureBreakdown: CaptureBreakdown;
  /** Red's own captures this match, broken down by kind - see file header. */
  matchRedCaptureBreakdown: CaptureBreakdown;

  startGame: (options: StartGameOptions) => Promise<void>;
  /** Plays a card for the current human turn, then auto-plays the AI's turn(s) if applicable. */
  playCard: (card: Card, position: Position) => Promise<void>;
  /**
   * Starts a Sudden Death rematch after a drawn, finished game - uses each
   * side's board-controlled cards as their new hand (engine/rules/
   * suddenDeath.ts). Throws if there is no game, or it isn't actually a
   * finished draw, matching the engine function's own precondition.
   */
  triggerSuddenDeathRematch: () => Promise<void>;
  reset: () => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** After the HUMAN's own move, tallies a Same/Plus/Chain trigger into this match's running counts - see file header for why this happens here, in real time, rather than being reconstructed after the match ends. */
function trackHumanMoveForUnlocks(
  get: () => GameStoreState,
  set: (partial: Partial<GameStoreState>) => void,
  resultingGame: GameState,
): void {
  const kind = resolvePrimaryCaptureTriggerKind(resultingGame.lastCapture?.captureKinds);
  if (kind === 'same' || kind === 'plus') {
    set({ matchSameOrPlusComboCount: get().matchSameOrPlusComboCount + 1 });
  } else if (kind === 'chain') {
    set({ matchChainReactionCount: get().matchChainReactionCount + 1 });
  }
}

/** After an AI move, flags matchOpponentCapturedFromHuman if it captured anything - see file header. Only ever needs to flip false -> true once; a capture-free AI move leaves it untouched rather than needlessly re-setting an unchanged value. */
function trackAIMoveForUnlocks(
  set: (partial: Partial<GameStoreState>) => void,
  resultingGame: GameState,
): void {
  const capturedCount = resultingGame.lastCapture?.positions.length ?? 0;
  if (capturedCount > 0) {
    set({ matchOpponentCapturedFromHuman: true });
  }
}

function emptyCaptureBreakdown(): CaptureBreakdown {
  return { base: 0, same: 0, plus: 0, chain: 0 };
}

/**
 * Adds one move's worth of capture kinds onto an existing breakdown,
 * returning a NEW object (not mutating `existing`). Each entry in
 * `kinds` is tallied individually by whichever rule captured THAT
 * specific card - a 3-card cascade capturing via same+cascade+cascade
 * adds 1 to `same` and 2 to `chain`, not "1 same move" - deliberately
 * different from engine/captureTriggerKind.ts's resolver, which
 * collapses a whole move down to one "primary" kind for the rule-trigger
 * callout banner. That collapse is right for a single on-screen banner
 * (you can't show two banners for one move); it would be wrong here,
 * where the whole point is an accurate count of how many cards were
 * actually captured by each mechanism.
 */
function addCaptureKindsToBreakdown(
  existing: CaptureBreakdown,
  kinds: CaptureKind[] | undefined,
): CaptureBreakdown {
  if (!kinds || kinds.length === 0) return existing;
  const next = { ...existing };
  for (const kind of kinds) {
    if (kind === 'base') next.base++;
    else if (kind === 'same') next.same++;
    else if (kind === 'plus') next.plus++;
    else if (kind === 'cascade') next.chain++;
  }
  return next;
}

/**
 * After ANY move - the human's or the AI's alike, unlike
 * trackHumanMoveForUnlocks above which is deliberately human-only - tallies
 * that move's captures onto whichever side actually made it. `mover` is
 * the move's own player, not necessarily state.activePlayer at call time
 * (which may have already advanced past it) - always pass the mover
 * explicitly rather than reading it back off current store state.
 */
function trackCaptureBreakdown(
  get: () => GameStoreState,
  set: (partial: Partial<GameStoreState>) => void,
  mover: PlayerColour,
  resultingGame: GameState,
): void {
  const kinds = resultingGame.lastCapture?.captureKinds;
  if (!kinds || kinds.length === 0) return;

  if (mover === 'blue') {
    set({
      matchBlueCaptureBreakdown: addCaptureKindsToBreakdown(get().matchBlueCaptureBreakdown, kinds),
    });
  } else {
    set({
      matchRedCaptureBreakdown: addCaptureKindsToBreakdown(get().matchRedCaptureBreakdown, kinds),
    });
  }
}

/**
 * Repeatedly applies the AI's chosen move while it's the AI's turn and the
 * game is still live, waiting before each one long enough for the
 * previous move's own capture animation to finish (see file header). A
 * `while` loop rather than a single `if` is defensive: normal play always
 * alternates turns, but this keeps the store correct even if some future
 * rule ever granted an extra consecutive turn.
 */
async function playAITurnsWithDelay(
  aiPlayer: PlayerColour | null,
  aiOptions: AIOptions,
  get: () => GameStoreState,
  set: (partial: Partial<GameStoreState>) => void,
): Promise<void> {
  for (;;) {
    const { game } = get();
    if (!aiPlayer || !game) return;
    if (game.phase !== 'playing' && game.phase !== 'suddenDeath') return;
    if (game.activePlayer !== aiPlayer) return;

    const capturedCount = game.lastCapture?.positions.length ?? 0;
    await delay(computeMoveAnimationDurationMs(capturedCount));

    // Re-read state after the wait in case something else changed the
    // store in the meantime (defensive - shouldn't happen in normal play,
    // but avoids acting on stale state if it ever did).
    const current = get().game;
    if (!current || current.activePlayer !== aiPlayer) return;

    const move = chooseMove(current, aiPlayer, aiOptions);
    const next = applyMove(current, move);
    set({ game: next });
    trackAIMoveForUnlocks(set, next);
    trackCaptureBreakdown(get, set, aiPlayer, next);
  }
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  aiPlayer: null,
  aiOptions: {},
  matchSameOrPlusComboCount: 0,
  matchChainReactionCount: 0,
  matchOpponentCapturedFromHuman: false,
  matchBlueCaptureBreakdown: emptyCaptureBreakdown(),
  matchRedCaptureBreakdown: emptyCaptureBreakdown(),

  startGame: async ({
    bluePlayer,
    redPlayer,
    startingPlayer,
    ruleSet = DEFAULT_RULE_SET,
    aiPlayer = null,
    availableElements = [...ELEMENT_IDS],
    aiOptions = {},
  }) => {
    const game = createGame({ bluePlayer, redPlayer, startingPlayer, ruleSet, availableElements });
    set({
      game,
      aiPlayer,
      aiOptions,
      matchSameOrPlusComboCount: 0,
      matchChainReactionCount: 0,
      matchOpponentCapturedFromHuman: false,
      matchBlueCaptureBreakdown: emptyCaptureBreakdown(),
      matchRedCaptureBreakdown: emptyCaptureBreakdown(),
    });
    await playAITurnsWithDelay(aiPlayer, aiOptions, get, set);
  },

  playCard: async (card, position) => {
    const { game, aiPlayer, aiOptions } = get();
    if (!game) {
      throw new Error('Cannot play a card before a game has started');
    }
    if (game.activePlayer === aiPlayer) {
      throw new Error(
        "It is the AI's turn - playCard should only be called for the human player's turn",
      );
    }

    const afterHuman = applyMove(game, { player: game.activePlayer, card, position });
    set({ game: afterHuman });
    trackHumanMoveForUnlocks(get, set, afterHuman);
    trackCaptureBreakdown(get, set, game.activePlayer, afterHuman);

    await playAITurnsWithDelay(aiPlayer, aiOptions, get, set);
  },

  triggerSuddenDeathRematch: async () => {
    const { game, aiPlayer, aiOptions } = get();
    if (!game) {
      throw new Error('Cannot start Sudden Death without a game');
    }
    const nextGame = startSuddenDeathRematch(game);
    // Sudden Death is a fresh decisive replay with new hands (see
    // startSuddenDeathRematch) - resetting the running tallies here too,
    // same as startGame, rather than carrying over counts from the drawn
    // match that preceded it.
    set({
      game: nextGame,
      matchSameOrPlusComboCount: 0,
      matchChainReactionCount: 0,
      matchOpponentCapturedFromHuman: false,
      matchBlueCaptureBreakdown: emptyCaptureBreakdown(),
      matchRedCaptureBreakdown: emptyCaptureBreakdown(),
    });
    await playAITurnsWithDelay(aiPlayer, aiOptions, get, set);
  },

  reset: () =>
    set({
      game: null,
      aiPlayer: null,
      aiOptions: {},
      matchSameOrPlusComboCount: 0,
      matchChainReactionCount: 0,
      matchOpponentCapturedFromHuman: false,
      matchBlueCaptureBreakdown: emptyCaptureBreakdown(),
      matchRedCaptureBreakdown: emptyCaptureBreakdown(),
    }),
}));