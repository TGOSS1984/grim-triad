/**
 * Campaign mode's dedicated match-result screen - shown instead of the
 * generic ResultScreen when mode === 'campaign' (see App.tsx's 'result'
 * case). Reads gameStore and campaignStore directly, same pattern
 * ResultScreen already uses (this screen's whole purpose is showing live
 * store state, not something a parent should compute and pass down).
 *
 * Adds two things ResultScreen doesn't have, both specific to the
 * persistent collector meta-game: collector numbers (how many of the
 * CURRENTLY OBTAINABLE units you own - see data/collectionProgress.ts
 * for why this is deliberately NOT the full 1075-unit generated catalog,
 * most of which belongs to factions not yet active and so can never
 * actually be won) and per-active-faction completion badges
 * (getUnitsForRoster already correctly includes the shared generic Space
 * Marine pool for a chapter roster - see activeFactions.ts - so a
 * chapter's badge reflects its REAL effective roster size, not just its
 * own dedicated units).
 *
 * "Collected" means CURRENTLY owned, not "ever owned": campaignStore only
 * tracks the live collection, not a historical log, and cards can be
 * lost as well as gained - counting only what you hold right now is the
 * honest number to show, not an all-time high that could overstate your
 * actual position after a bad run of losses.
 *
 * Deliberately has NO Sudden Death button, unlike ResultScreen: that
 * button (see ResultScreen.tsx) triggers a rematch by mutating gameStore
 * directly without changing App.tsx's `step` back to 'game' - which
 * works for series mode (by coincidence - it never left step: 'game' in
 * the first place) but is a genuine, pre-existing navigation bug for any
 * screen reached via step: 'result' the way this one is. Rather than
 * carry that same bug into a new screen, campaign draws simply record
 * and let the player continue - no in-place rematch offered.
 *
 * `showVictoryModal` is passed in rather than computed here: detecting
 * the moment collection completion is first reached (as opposed to it
 * already having happened) requires comparing campaignStore's
 * hasCompletedCollection before/after the recordMatchResult call that
 * might have just caused it - a transition, not a snapshot this
 * component's normal render-time reads could reconstruct on their own.
 * App.tsx does that comparison (it's the one place recordMatchResult is
 * actually called) and hands down a plain boolean.
 */
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { resolveTradeRule } from '../engine/rules/tradeRules';
import { TradeTransferList } from '../components/common/TradeTransferList';
import { CampaignVictoryModal } from '../components/campaign/CampaignVictoryModal';
import { ACTIVE_FACTIONS, getUnitsForRoster } from '../data/activeFactions';
import { getCollectionProgress } from '../data/collectionProgress';
import { ACHIEVEMENTS } from '../state/achievements';
import type { Board, PlayerColour } from '../engine/types';
import styles from './CampaignResultScreen.module.css';

const COMPLETE_COLLECTION_ACHIEVEMENT = ACHIEVEMENTS.find((a) => a.id === 'complete-collection')!;

export interface CampaignResultScreenProps {
  onContinue: () => void;
  /** True for exactly the render(s) right after the collection first reached 100% completion - see file header. Drives whether CampaignVictoryModal shows at all. */
  showVictoryModal: boolean;
  onStartNewRun: () => void;
  onReturnToTitle: () => void;
  onDismissVictoryModal: () => void;
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

export function CampaignResultScreen({
  onContinue,
  showVictoryModal,
  onStartNewRun,
  onReturnToTitle,
  onDismissVictoryModal,
}: CampaignResultScreenProps) {
  const game = useGameStore((s) => s.game);
  const { collection, wins, losses, draws } = useCampaignStore();

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

  const tradeResult = !isDraw && game.winner ? resolveTradeRule(game) : null;

  const ownedIds = new Set(collection);
  const progress = getCollectionProgress(collection);

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

      <div className={styles.recordSection}>
        <h2 className={styles.subtitle}>Campaign Record</h2>
        <div className={styles.recordRow}>
          <span>{wins} wins</span>
          <span>{losses} losses</span>
          <span>{draws} draws</span>
        </div>
      </div>

      <div className={styles.collectorSection}>
        <h2 className={styles.subtitle}>
          Collection: {progress.owned} / {progress.obtainable}
        </h2>
        <div className={styles.badgeRow}>
          {ACTIVE_FACTIONS.map((faction) => {
            const rosterUnits = getUnitsForRoster(faction.name);
            const ownedInRoster = rosterUnits.filter((u) => ownedIds.has(u.id)).length;
            return (
              <span key={faction.slug} className={styles.badge}>
                {faction.name}: {ownedInRoster}/{rosterUnits.length}
              </span>
            );
          })}
        </div>
      </div>

      <button type="button" className={styles.continueButton} onClick={onContinue}>
        Continue
      </button>

      {showVictoryModal && (
        <CampaignVictoryModal
          achievementName={COMPLETE_COLLECTION_ACHIEVEMENT.name}
          achievementDescription={COMPLETE_COLLECTION_ACHIEVEMENT.description}
          unitsOwned={progress.owned}
          obtainableTotal={progress.obtainable}
          onStartNewRun={onStartNewRun}
          onReturnToTitle={onReturnToTitle}
          onDismiss={onDismissVictoryModal}
        />
      )}
    </div>
  );
}