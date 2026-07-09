/**
 * Trade Rules: determine what happens to each player's cards once a match
 * ends. This runs AFTER the game reaches `phase: 'finished'` - it does not
 * affect anything during play, only how the two decks look afterward (e.g.
 * for a campaign/collection meta-layer, or simply what each side "keeps").
 *
 * - One: winner takes exactly one card from the loser.
 * - Diff: winner takes a number of cards equal to their margin of victory
 *   (cards controlled - opponent's cards controlled); if the margin is
 *   greater than 5, winner takes ALL of the loser's cards.
 * - Direct: each side keeps whatever they controlled on the board at match
 *   end, regardless of original ownership - no further transfer happens.
 * - All: winner takes every card the loser had.
 *
 * "Cards" here means each player's full match-end pool: what's on the
 * board under their control, plus anything left in hand (a match can end
 * before hands are fully emptied only in edge cases; for a standard 5v5
 * game hands will be empty at fill, but this stays correct either way).
 */
import type { Card, GameState, PlayerColour } from '../types';

export interface TradeResult {
  /** instanceIds of cards that moved from red to blue, or vice versa. */
  transferred: { card: Card; from: PlayerColour; to: PlayerColour }[];
  /** Final pool of cards each player keeps after the trade resolves. */
  finalPools: Record<PlayerColour, Card[]>;
}

function collectPlayerPool(state: GameState, colour: PlayerColour): Card[] {
  const boardCards = state.board
    .flat()
    .filter((cell) => cell.card?.owner === colour)
    .map((cell) => cell.card as Card);
  return [...boardCards, ...state.players[colour].hand];
}

function countBoardControl(state: GameState, colour: PlayerColour): number {
  return state.board.flat().filter((cell) => cell.card?.owner === colour).length;
}

/**
 * Resolves the configured trade rule for a finished, non-draw game. Callers
 * should check `state.winner` is a real player (not 'draw' or null) before
 * calling - a draw has no winner/loser pool to trade between (see Sudden
 * Death for how draws are actually resolved instead).
 */
export function resolveTradeRule(state: GameState): TradeResult {
  if (state.phase !== 'finished' || state.winner === 'draw' || state.winner === null) {
    throw new Error('resolveTradeRule can only be called on a finished game with a clear winner');
  }

  const winner = state.winner;
  const loser: PlayerColour = winner === 'blue' ? 'red' : 'blue';

  const winnerPool = collectPlayerPool(state, winner);
  const loserPool = [...collectPlayerPool(state, loser)];
  const transferred: TradeResult['transferred'] = [];

  const takeFromLoser = (count: number) => {
    const taken = loserPool.splice(0, Math.max(0, count));
    for (const card of taken) {
      transferred.push({ card, from: loser, to: winner });
    }
    return taken;
  };

  switch (state.ruleSet.tradeRule) {
    case 'one': {
      const taken = takeFromLoser(1);
      winnerPool.push(...taken);
      break;
    }
    case 'diff': {
      const margin = countBoardControl(state, winner) - countBoardControl(state, loser);
      const takeCount = margin > 5 ? loserPool.length : margin;
      const taken = takeFromLoser(takeCount);
      winnerPool.push(...taken);
      break;
    }
    case 'all': {
      const taken = takeFromLoser(loserPool.length);
      winnerPool.push(...taken);
      break;
    }
    case 'direct': {
      // Each side keeps what they already control - no transfer at all.
      break;
    }
  }

  return {
    transferred,
    finalPools: {
      [winner]: winnerPool,
      [loser]: loserPool,
    } as Record<PlayerColour, Card[]>,
  };
}