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
 */
import { create } from 'zustand';
import type { Card, GameState, PlayerColour, PlayerState, Position, RuleSet } from '../engine/types';
import { createGame, applyMove, DEFAULT_RULE_SET } from '../engine/gameReducer';
import { startSuddenDeathRematch } from '../engine/rules/suddenDeath';
import { chooseMove } from '../ai/heuristicAI';
import { computeMoveAnimationDurationMs } from './animationTiming';

export interface StartGameOptions {
  bluePlayer: PlayerState;
  redPlayer: PlayerState;
  startingPlayer: PlayerColour;
  ruleSet?: RuleSet;
  /** Which player colour (if any) the AI controls. Undefined/null = both human (local PvP). */
  aiPlayer?: PlayerColour | null;
}

export interface GameStoreState {
  game: GameState | null;
  aiPlayer: PlayerColour | null;

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

    const move = chooseMove(current, aiPlayer);
    const next = applyMove(current, move);
    set({ game: next });
  }
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  aiPlayer: null,

  startGame: async ({
    bluePlayer,
    redPlayer,
    startingPlayer,
    ruleSet = DEFAULT_RULE_SET,
    aiPlayer = null,
  }) => {
    const game = createGame({ bluePlayer, redPlayer, startingPlayer, ruleSet });
    set({ game, aiPlayer });
    await playAITurnsWithDelay(aiPlayer, get, set);
  },

  playCard: async (card, position) => {
    const { game, aiPlayer } = get();
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

    await playAITurnsWithDelay(aiPlayer, get, set);
  },

  triggerSuddenDeathRematch: async () => {
    const { game, aiPlayer } = get();
    if (!game) {
      throw new Error('Cannot start Sudden Death without a game');
    }
    const nextGame = startSuddenDeathRematch(game);
    set({ game: nextGame });
    await playAITurnsWithDelay(aiPlayer, get, set);
  },

  reset: () => set({ game: null, aiPlayer: null }),
}));