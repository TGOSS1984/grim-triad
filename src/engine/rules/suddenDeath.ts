/**
 * Sudden Death rule: if the match ends in a draw, an immediate rematch is
 * played using the cards each player controlled on the board at the moment
 * the draw occurred (not their original decks). This continues to repeat
 * until someone wins outright.
 */
import type { Board, GameState, PlayerColour } from '../types';
import { createEmptyBoard } from '../board';

/** Collects the cards currently controlled by `colour` anywhere on the board. */
function cardsControlledBy(board: Board, colour: PlayerColour) {
  const cards = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell.card?.owner === colour) cards.push(cell.card);
    }
  }
  return cards;
}

/**
 * Given a finished, drawn game, returns a fresh GameState for the Sudden
 * Death rematch: empty board, hands rebuilt from each player's end-of-match
 * board control, same starting player, phase set to 'suddenDeath'.
 *
 * Throws if called on a state that isn't actually a finished draw - this is
 * a programmer-error guard, not something the UI should need to branch on
 * (only offer/trigger a rematch when state.winner === 'draw').
 */
export function startSuddenDeathRematch(state: GameState): GameState {
  if (state.phase !== 'finished' || state.winner !== 'draw') {
    throw new Error('startSuddenDeathRematch can only be called on a finished, drawn game');
  }

  const blueCards = cardsControlledBy(state.board, 'blue');
  const redCards = cardsControlledBy(state.board, 'red');

  return {
    ...state,
    board: createEmptyBoard(),
    players: {
      blue: { colour: 'blue', hand: blueCards },
      red: { colour: 'red', hand: redCards },
    },
    // Same starting player as the original match, per standard Triple Triad
    // Sudden Death behaviour.
    activePlayer: state.history[0]?.player ?? state.activePlayer,
    phase: 'suddenDeath',
    winner: null,
    history: [],
  };
}