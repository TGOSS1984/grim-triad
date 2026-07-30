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
 * `victoryModalKind` is passed in rather than computed here: detecting
 * the MOMENT either milestone (campaignStore's hasCompletedCollection or
 * hasVanquishedRival) is first reached - as opposed to it already having
 * happened - requires comparing that flag's value before/after the
 * recordMatchResult call that might have just caused it, a transition
 * this component's normal render-time reads can't reconstruct on their
 * own. App.tsx does that comparison (it's the one place recordMatchResult
 * is actually called) and hands down which milestone (if either) was
 * just newly reached. If a single win somehow reaches BOTH at once,
 * App.tsx prioritizes 'collection-complete' - the bigger, final
 * milestone - over 'rival-vanquished'; the Rival Vanquished achievement
 * still silently unlocks either way (see campaignStore), only the modal
 * itself is single-at-a-time.
 */
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { resolveTradeRule } from '../engine/rules/tradeRules';
import { countCardsOnBoard, sumPointsOnBoard } from '../engine/gameReducer';
import { TradeTransferList } from '../components/common/TradeTransferList';
import { CaptureBreakdownTable } from '../components/common/CaptureBreakdownTable';
import { CampaignVictoryModal } from '../components/campaign/CampaignVictoryModal';
import { ACTIVE_FACTIONS, getUnitsForRoster } from '../data/activeFactions';
import { getCollectionProgress } from '../data/collectionProgress';
import { ACHIEVEMENTS } from '../state/achievements';
import styles from './CampaignResultScreen.module.css';

const COMPLETE_COLLECTION_ACHIEVEMENT = ACHIEVEMENTS.find((a) => a.id === 'complete-collection')!;
const RIVAL_VANQUISHED_ACHIEVEMENT = ACHIEVEMENTS.find((a) => a.id === 'rival-vanquished')!;

export type VictoryModalKind = 'collection-complete' | 'rival-vanquished' | null;

export interface CampaignResultScreenProps {
  onContinue: () => void;
  /** Which milestone (if either) was JUST newly reached - see file header. Drives whether CampaignVictoryModal shows at all, and which of the two it shows. */
  victoryModalKind: VictoryModalKind;
  onStartNewRun: () => void;
  onReturnToTitle: () => void;
  onDismissVictoryModal: () => void;
  /** Only actually offered as a button when victoryModalKind is 'rival-vanquished' - see CampaignVictoryModal's own onReinforce prop. */
  onReinforceRival: () => void;
}

const TRADE_RULE_LABELS: Record<string, string> = {
  one: 'One',
  diff: 'Diff',
  direct: 'Direct',
  all: 'All',
};

export function CampaignResultScreen({
  onContinue,
  victoryModalKind,
  onStartNewRun,
  onReturnToTitle,
  onDismissVictoryModal,
  onReinforceRival,
}: CampaignResultScreenProps) {
  const game = useGameStore((s) => s.game);
  const blueCaptureBreakdown = useGameStore((s) => s.matchBlueCaptureBreakdown);
  const redCaptureBreakdown = useGameStore((s) => s.matchRedCaptureBreakdown);
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

  /**
   * Same "show both, label which one decided it" treatment as
   * ResultScreen.tsx - see that file's own doc on isPointsWinCondition
   * for the full reasoning. Kept identical between the two screens
   * deliberately, same as their shared countCardsOnBoard import: a
   * campaign match and a single match should explain a points-decided
   * outcome the same way.
   */
  const isPointsWinCondition = game.ruleSet.winCondition === 'points';
  const bluePoints = isPointsWinCondition ? sumPointsOnBoard(game.board, 'blue') : null;
  const redPoints = isPointsWinCondition ? sumPointsOnBoard(game.board, 'red') : null;

  const tradeResult = !isDraw && game.winner ? resolveTradeRule(game) : null;

  const ownedIds = new Set(collection);
  const progress = getCollectionProgress(collection);

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

      <div className={styles.tradeSection}>
        <h2 className={styles.subtitle}>Captures</h2>
        <CaptureBreakdownTable blue={blueCaptureBreakdown} red={redCaptureBreakdown} />
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

      {victoryModalKind === 'collection-complete' && (
        <CampaignVictoryModal
          title="Collection Complete!"
          subtitle={`You now own ${progress.owned} / ${progress.obtainable} units - one of everything currently obtainable.`}
          achievementName={COMPLETE_COLLECTION_ACHIEVEMENT.name}
          achievementDescription={COMPLETE_COLLECTION_ACHIEVEMENT.description}
          onStartNewRun={onStartNewRun}
          onReturnToTitle={onReturnToTitle}
          onDismiss={onDismissVictoryModal}
        />
      )}

      {victoryModalKind === 'rival-vanquished' && (
        <CampaignVictoryModal
          title="Rival Vanquished!"
          subtitle="You've reduced your AI rival's pool to its final cards."
          achievementName={RIVAL_VANQUISHED_ACHIEVEMENT.name}
          achievementDescription={RIVAL_VANQUISHED_ACHIEVEMENT.description}
          onStartNewRun={onStartNewRun}
          onReturnToTitle={onReturnToTitle}
          onDismiss={onDismissVictoryModal}
          onReinforce={onReinforceRival}
        />
      )}
    </div>
  );
}