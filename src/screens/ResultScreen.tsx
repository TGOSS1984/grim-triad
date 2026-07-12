/**
 * Shown once a match reaches phase 'finished'. Reads the live gameStore
 * directly (same pattern as GameScreen) rather than taking the finished
 * GameState as a prop.
 *
 * Trade Rule display: resolveTradeRule (engine/rules/tradeRules.ts) is
 * called informationally here to show what the configured trade rule
 * WOULD transfer between the two sides' card pools. Actually persisting
 * that outcome into a durable player collection is out of v1's scope -
 * there is no persistent collection/meta-game layer built yet (see
 * ROADMAP.md's original open question on this). This screen shows the
 * narrative result of the match, not a saved account balance.
 */
import { useGameStore } from '../state/gameStore';
import { resolveTradeRule } from '../engine/rules/tradeRules';
import { TradeTransferList } from '../components/common/TradeTransferList';
import type { Board, PlayerColour } from '../engine/types';
import styles from './ResultScreen.module.css';

export interface ResultScreenProps {
  onNewGame: () => void;
}

function countCardsOnBoard(board: Board, colour: PlayerColour): number {
  return board.flat().filter((cell) => cell.card?.owner === colour).length;
}

const TRADE_RULE_LABELS: Record<string, string> = {
  one: 'One',
  diff: 'Diff',
  direct: 'Direct',
  all: 'All',
};

export function ResultScreen({ onNewGame }: ResultScreenProps) {
  const game = useGameStore((s) => s.game);
  const triggerSuddenDeathRematch = useGameStore((s) => s.triggerSuddenDeathRematch);

  if (!game || game.phase !== 'finished') {
    return (
      <div className={styles.screen}>
        <p className={styles.empty}>No finished match to show.</p>
      </div>
    );
  }

  const blueCount = countCardsOnBoard(game.board, 'blue');
  const redCount = countCardsOnBoard(game.board, 'red');
  const isDraw = game.winner === 'draw';
  const canSuddenDeath = isDraw && game.ruleSet.suddenDeath;

  const tradeResult =
    !isDraw && game.winner ? resolveTradeRule(game) : null;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>
        {isDraw ? 'Draw' : `${game.winner === 'blue' ? 'Blue' : 'Red'} Wins!`}
      </h1>

      <div className={styles.score}>
        <span className={styles.scoreBlue}>Blue: {blueCount}</span>
        <span className={styles.scoreRed}>Red: {redCount}</span>
      </div>

      {tradeResult && (
        <div className={styles.tradeSection}>
          <h2 className={styles.subtitle}>
            Trade Rule: {TRADE_RULE_LABELS[game.ruleSet.tradeRule]}
          </h2>
          <TradeTransferList
            transfers={tradeResult.transferred.map((t) => ({
              unitId: t.card.unitId,
              from: t.from,
              to: t.to,
            }))}
          />
        </div>
      )}

      <div className={styles.actions}>
        {canSuddenDeath && (
          <button
            type="button"
            className={styles.suddenDeathButton}
            onClick={triggerSuddenDeathRematch}
          >
            Sudden Death Rematch
          </button>
        )}
        <button type="button" className={styles.newGameButton} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  );
}