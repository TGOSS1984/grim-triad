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
import { countCardsOnBoard, sumPointsOnBoard } from '../engine/gameReducer';
import { TradeTransferList } from '../components/common/TradeTransferList';
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
  /**
   * Card count alone doesn't explain the outcome when the match was
   * decided by points - a side can hold fewer, more expensive cards and
   * still win outright (see engine/gameReducer.ts's determineWinner). So
   * when winCondition is 'points', a second points-total row is shown
   * alongside the card count (not instead of it - board control is still
   * useful context either way, same "both together" reasoning
   * GameScreen's own live score already uses), with an explicit label
   * naming which one actually decided this match.
   */
  const isPointsWinCondition = game.ruleSet.winCondition === 'points';
  const bluePoints = isPointsWinCondition ? sumPointsOnBoard(game.board, 'blue') : null;
  const redPoints = isPointsWinCondition ? sumPointsOnBoard(game.board, 'red') : null;

  const tradeResult =
    !isDraw && game.winner ? resolveTradeRule(game) : null;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>
        {isDraw ? 'Draw' : `${game.winner === 'blue' ? 'Blue' : 'Red'} Wins!`}
      </h1>

      <div className={styles.score}>
        <span className={styles.scoreBlue}>
          Blue: {blueCount} card{blueCount === 1 ? '' : 's'}
        </span>
        <span className={styles.scoreRed}>
          Red: {redCount} card{redCount === 1 ? '' : 's'}
        </span>
      </div>

      {isPointsWinCondition && (
        <>
          <p className={styles.scoreCaption}>Decided by total points</p>
          <div className={styles.score}>
            <span className={styles.scoreBlue}>Blue: {bluePoints} pts</span>
            <span className={styles.scoreRed}>Red: {redPoints} pts</span>
          </div>
        </>
      )}

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