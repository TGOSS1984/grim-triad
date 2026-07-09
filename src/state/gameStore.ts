/**
 * The live-match state layer: wraps the pure engine (createGame/applyMove)
 * in a Zustand store so React components can subscribe to game state and
 * dispatch moves, without any component needing to touch engine internals
 * directly. Also owns AI turn triggering: after a human plays a card, if
 * the resulting active player is AI-controlled, the AI's move is chosen
 * and applied automatically before the store notifies subscribers.
 *
 * This store deliberately knows nothing about how a move visually
 * animates - it just advances state. Components read the resulting
 * GameState (board, hands, winner, etc.) and are responsible for their own
 * transition animations between the "before" and "after" they observe.
 */
import { create } from 'zustand';
import type { Card, GameState, PlayerColour, PlayerState, Position, RuleSet } from '../engine/types';
import { createGame, applyMove, DEFAULT_RULE_SET } from '../engine/gameReducer';
import { startSuddenDeathRematch } from '../engine/rules/suddenDeath';
import { chooseMove } from '../ai/heuristicAI';

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

  startGame: (options: StartGameOptions) => void;
  /** Plays a card for the current human turn, then auto-plays the AI's turn(s) if applicable. */
  playCard: (card: Card, position: Position) => void;
  /**
   * Starts a Sudden Death rematch after a drawn, finished game - uses each
   * side's board-controlled cards as their new hand (engine/rules/
   * suddenDeath.ts). Throws if there is no game, or it isn't actually a
   * finished draw, matching the engine function's own precondition.
   */
  triggerSuddenDeathRematch: () => void;
  reset: () => void;
}

/**
 * Repeatedly applies the AI's chosen move while it's the AI's turn and the
 * game is still live. A `while` loop rather than a single `if` is
 * defensive: normal play always alternates turns, but this keeps the store
 * correct even if some future rule ever granted an extra consecutive turn.
 */
function playAITurnsUntilHuman(game: GameState, aiPlayer: PlayerColour | null): GameState {
  let state = game;
  while (
    aiPlayer &&
    (state.phase === 'playing' || state.phase === 'suddenDeath') &&
    state.activePlayer === aiPlayer
  ) {
    const move = chooseMove(state, aiPlayer);
    state = applyMove(state, move);
  }
  return state;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  aiPlayer: null,

  startGame: ({ bluePlayer, redPlayer, startingPlayer, ruleSet = DEFAULT_RULE_SET, aiPlayer = null }) => {
    let game = createGame({ bluePlayer, redPlayer, startingPlayer, ruleSet });
    game = playAITurnsUntilHuman(game, aiPlayer);
    set({ game, aiPlayer });
  },

  playCard: (card, position) => {
    const { game, aiPlayer } = get();
    if (!game) {
      throw new Error('Cannot play a card before a game has started');
    }
    if (game.activePlayer === aiPlayer) {
      throw new Error(
        "It is the AI's turn - playCard should only be called for the human player's turn",
      );
    }

    let nextGame = applyMove(game, { player: game.activePlayer, card, position });
    nextGame = playAITurnsUntilHuman(nextGame, aiPlayer);
    set({ game: nextGame });
  },

  triggerSuddenDeathRematch: () => {
    const { game, aiPlayer } = get();
    if (!game) {
      throw new Error('Cannot start Sudden Death without a game');
    }
    let nextGame = startSuddenDeathRematch(game);
    nextGame = playAITurnsUntilHuman(nextGame, aiPlayer);
    set({ game: nextGame });
  },

  reset: () => set({ game: null, aiPlayer: null }),
}));