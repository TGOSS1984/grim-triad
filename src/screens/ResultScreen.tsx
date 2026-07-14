/**
 * Shown once a match reaches phase 'finished'. Reads the live gameStore
 * directly (same pattern as GameScreen) rather than taking the finished
 * GameState as a prop.
 *
 * Trade Rule display: resolveTradeRule (engine/rules/tradeRules.ts) is
 * called informationally here to show what the configured trade rule
 * WOULD transfer between the two sides' card pools. Actually persisting
 * that outcome into a durable player collection is out of v1's scope for
 * single-match mode specifically - see campaignStore.ts for where that
 * DOES happen now.
 *
 * Sudden Death is deliberately NOT triggered directly from here anymore -
 * see onSuddenDeath's own doc for why that used to be a real navigation
 * bug.
 */
import { useGameStore } from '../state/gameStore';
import { resolveTradeRule } from '../engine/rules/tradeRules';
import { TradeTransferList } from '../components/common/TradeTransferList';
import type { Board, PlayerColour } from '../engine/types';
import styles from './ResultScreen.module.css';

export interface ResultScreenProps {
  /** Reuses the same army (skips ArmyBuilder entirely) and starts a fresh match - see App.tsx's handlePlayAgain for why this is safe to just re-invoke the normal army-submission handler. */
  onPlayAgain: () => void;
  /** Leaves this mode entirely, back to the main menu - was previously the only option (labeled "New Game", which read ambiguously once Play Again existed alongside it). */
  onReturnToMenu: () => void;
  /**
   * Called instead of this screen mutating gameStore directly. Real bug
   * this fixes: this screen is only ever shown once App.tsx's `step` has
   * already moved to 'result' - if this screen called
   * gameStore.triggerSuddenDeathRematch() itself (as it originally did),
   * the rematch would start mutating `game` while `step` stayed stuck at
   * 'result', so GameScreen never re-mounted and the human had no board
   * to actually play the rematch on. App.tsx's handler pairs the store
   * mutation with setStep('game') so the fix lives where the navigation
   * state actually is.
   */
  onSuddenDeath: () => void;
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

export function ResultScreen({ onPlayAgain, onReturnToMenu, onSuddenDeath }: ResultScreenProps) {
  const game = useGameStore((s) => s.game);

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
            onClick={onSuddenDeath}
          >
            Sudden Death Rematch
          </button>
        )}
        <button type="button" className={styles.playAgainButton} onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" className={styles.newGameButton} onClick={onReturnToMenu}>
          Return to Menu
        </button>
      </div>
    </div>
  );
}