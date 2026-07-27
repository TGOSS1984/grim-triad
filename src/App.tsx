/**
 * The root application: a simple step-based flow, not a full router (the
 * game has one linear path with no deep-linkable sub-pages, so react-router
 * would be pure overhead here). Owns cross-screen orchestration that no
 * individual screen should own itself:
 *  - Carrying the human's chosen army/rules from one screen to the next.
 *  - Generating the AI opponent's army (matchSetup.ts) and starting the
 *    live game once the coin flip resolves.
 *  - Watching the live game for phase 'finished' and switching to the
 *    correct next screen automatically - GameScreen itself doesn't navigate.
 *
 * Series mode: after Home, the player chooses Single Match or Series
 * (ModeSelectScreen). Series mode reuses almost the entire single-match
 * pipeline (ArmyBuilder, CoinFlip, GameScreen) with two differences:
 *  - ArmyBuilder requires an exact pool size instead of "at least 5".
 *  - Instead of the player choosing rules once via RuleSelectScreen, every
 *    round's rules are rolled automatically (randomRuleSet) and surfaced
 *    via SeriesIntroScreen (round 1) or RoundSummaryScreen (every
 *    subsequent round) before that round starts.
 * A drawn round triggers gameStore's existing Sudden Death rematch
 * automatically (no player choice, unlike single-match mode's manual
 * button) - the series can't meaningfully continue on an undecided round.
 * A decisive round resolves the Trade Rule (informational in single-match
 * mode) into a real, persistent bonus for the winner's future pool via
 * seriesStore.applyRoundResult - see seriesStore.ts for the full mechanic.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { ArmyBuilderScreen } from './screens/ArmyBuilderScreen';
import { RuleSelectScreen } from './components/ruleSelect/RuleSelectScreen';
import { randomRuleSet } from './components/ruleSelect/randomRuleSet';
import { SeriesIntroScreen } from './screens/SeriesIntroScreen';
import { CoinFlip } from './components/coinFlip/CoinFlip';
import { GameScreen } from './screens/GameScreen';
import { RoundSummaryScreen } from './screens/RoundSummaryScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SeriesResultScreen } from './screens/SeriesResultScreen';
import { CampaignHomeScreen } from './screens/CampaignHomeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { CampaignResultScreen, type VictoryModalKind } from './screens/CampaignResultScreen';
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';
import { useSeriesStore } from './state/seriesStore';
import { useCampaignStore } from './state/campaignStore';
import {
  CAMPAIGN_STARTING_POOL_SIZE,
  CAMPAIGN_STARTING_POINTS_CAP,
  validateCampaignStartingRoster,
} from './state/campaignBalance';
import { buildRandomAIRoster, unitIdsToHand } from './state/matchSetup';
import { buildRivalRosterFromPool } from './state/campaignRivalMatchSetup';
import { getFactionSlugForRosterName, getFactionNameForSlug, inferRosterNameFromUnitIds } from './data/activeFactions';
import { useUnlockStore } from './state/unlockStore';
import { getNewlyUnlockedBatches, type NewlyUnlockedBatch } from './data/unlockCriteria';
import { CardUnlockReveal } from './components/unlocks/CardUnlockReveal';
import { resolveTradeRule } from './engine/rules/tradeRules';
import type { PlayerColour, RuleSet } from './engine/types';
import { DEFAULT_RULE_SET } from './engine/gameReducer';
import { computeGameEndDelayMs } from './state/animationTiming';
import { DIFFICULTY_PROFILES, DEFAULT_DIFFICULTY } from './ai/difficulty';
import type { Difficulty } from './ai/difficulty';
import styles from './App.module.css';

type Step =
  | 'home'
  | 'modeSelect'
  | 'armyBuilder'
  | 'ruleSelect'
  | 'seriesIntro'
  | 'coinFlip'
  | 'game'
  | 'roundSummary'
  | 'result'
  | 'seriesResult'
  | 'campaignHome'
  | 'progress';

type Mode = 'single' | 'series' | 'campaign';

/** The human always plays blue; the AI always plays red - see GameScreen/matchSetup for why this is a reasonable v1 simplification. */
const HUMAN_PLAYER: PlayerColour = 'blue';

export default function App() {
  const [step, setStep] = useState<Step>('home');

  // Every step is a fresh screen, not a page a user might want to return
  // to at a remembered scroll position (no history/back navigation
  // exists here) - so any scroll position carried over from the
  // previous screen (e.g. a long roster list scrolled down in
  // ArmyBuilder) should never persist onto the next one.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const [mode, setMode] = useState<Mode>('single');
  const [seriesPoolSize, setSeriesPoolSize] = useState<number | null>(null);
  const [humanArmyUnitIds, setHumanArmyUnitIds] = useState<string[]>([]);
  /** Set when the AI's opponent army can't be generated for the chosen pool size/points cap - see handleArmyReady. Cleared on the next attempt. */
  const [armyBuilderError, setArmyBuilderError] = useState<string | null>(null);
  /** Single-match mode's player-chosen rules, OR series mode's current round's rolled rules. */
  const [ruleSet, setRuleSet] = useState<RuleSet>(DEFAULT_RULE_SET);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  /** The AI's roster faction slug for card-back branding (see Card.rosterFactionSlug) - resolved once when the AI's pool/roster is built, reused for every hand dealt from it (every round, in series mode). */
  const [aiRosterFactionSlug, setAiRosterFactionSlug] = useState<string | undefined>();
  /**
   * The human's campaign roster faction slug, resolved once when a
   * campaign run starts (from armyBuilderStore.rosterName at that exact
   * moment) and reused for every match drawn from campaignStore's
   * persistent collection thereafter. Unlike single-match/series mode
   * (which can re-derive this fresh from armyBuilderStore each time,
   * since ArmyBuilder was JUST used), campaign's "Continue" flow skips
   * ArmyBuilder entirely on every match after the first - armyBuilderStore
   * would be stale by then, so this has to be captured explicitly instead.
   * NOTE: once Trade Rule transfers start mixing units from the
   * opponent's differently-rostered pool into the collection (see
   * campaignBalance.ts/commit 7), a single uniform slug for the whole
   * hand stops being fully accurate for GAINED cards specifically - a
   * known, deliberate v1 simplification, not an oversight.
   */
  const [campaignRosterFactionSlug, setCampaignRosterFactionSlug] = useState<string | undefined>();
  /**
   * Which of the two campaign milestones (if either) a match JUST newly
   * reached - drives whether CampaignResultScreen shows
   * CampaignVictoryModal, and which of the two variants. Set by comparing
   * campaignStore's hasCompletedCollection and hasVanquishedRival
   * immediately before and after the recordMatchResult call in the
   * game-finished effect below (that's the only place a win can actually
   * trigger either transition) - see VictoryModalKind's own doc in
   * CampaignResultScreen.tsx for the priority rule when a single win
   * somehow reaches both at once. Explicitly reset to null by every
   * handler that navigates away from the result screen
   * (handleCampaignMatchDone, handleCampaignStartNewRun,
   * handleReturnToHome) - all three are reachable directly from the modal
   * itself, not just from CampaignResultScreen's own Continue button, so
   * each needs to clear this rather than relying on a single choke point.
   */
  const [victoryModalKind, setVictoryModalKind] = useState<VictoryModalKind>(null);

  /**
   * Queue of newly-unlocked-unit batches (see
   * data/unlockCriteria.ts's getNewlyUnlockedBatches) waiting to be shown
   * via CardUnlockReveal, one at a time - queue[0] is always whichever is
   * currently on screen. Cross-mode and mode-agnostic on purpose: unlike
   * victoryModalKind (campaign-only, rendered only from
   * CampaignResultScreen), this is rendered directly from App.tsx's own
   * JSX below so it layers on top of WHATEVER result screen is showing,
   * regardless of mode - a single-match or series win can unlock cards
   * exactly the same as a campaign win can. Deliberately NOT reset by the
   * result-screen navigation handlers the way victoryModalKind is: if a
   * batch is still queued when the player continues past the result
   * screen, it should still get shown, not silently dropped.
   */
  const [unlockRevealQueue, setUnlockRevealQueue] = useState<NewlyUnlockedBatch[]>([]);

  const game = useGameStore((s) => s.game);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.reset);
  const resetArmyBuilder = useArmyBuilderStore((s) => s.reset);
  const seriesState = useSeriesStore();

  // Warns before a page reload/close while a match is actually in
  // progress - App-level state (the whole step machine, the live
  // GameState) has no persistence layer, so a refresh mid-match
  // currently loses it silently with zero warning (this is what
  // prompted the ask: an accidental Ctrl+Shift+R felt jarring). A full
  // session-resume feature would properly SURVIVE a reload; this is the
  // smaller, cheaper fix - just make sure the browser's own native
  // "leave site?" prompt fires first, so an accidental reload has a
  // chance to be caught before it costs anything. Scoped to step ===
  // 'game' specifically (not e.g. ArmyBuilder) - that's genuinely
  // irreversible progress (moves already played), whereas losing an
  // in-progress unit selection is a much smaller/more recoverable loss.
  useEffect(() => {
    if (step !== 'game') return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Modern browsers show their own generic message regardless of
      // this value, but setting returnValue is still required for the
      // prompt to fire at all in some engines (a legacy quirk of the
      // beforeunload spec, not optional boilerplate).
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  // GameScreen only renders/drives the live match - it doesn't navigate.
  // Watching for phase 'finished' here is what actually moves the app on
  // once a match concludes, branching for series mode's round loop.
  //
  // The winning move's own capture flip(s) are still mid-animation the
  // instant `phase` flips to 'finished' (that happens synchronously in the
  // same store update that applied the move) - navigating away immediately
  // meant the final move's outcome was never actually seen, cutting
  // straight to the result screen. So this waits out computeGameEndDelayMs
  // - the same per-move animation delay gameStore uses between turns, PLUS
  // a deliberate extra beat specifically for this transition (see that
  // function's own doc in animationTiming.ts): the per-move delay alone is
  // tuned only to not cut off a capture's own flip, which gives almost no
  // pause at all when the winning move captures nothing - nowhere near
  // enough time to actually take in the final board before the ENTIRE
  // SCREEN changes to results. The timer is cleared on cleanup so a fast
  // unmount/step-change (e.g. Quit) can't fire a stale navigation
  // afterwards.
  useEffect(() => {
    if (step !== 'game') return;
    if (!game || game.phase !== 'finished') return;

    const capturedCount = game.lastCapture?.positions.length ?? 0;
    const delayMs = computeGameEndDelayMs(capturedCount);

    const timer = setTimeout(() => {
      // Cross-mode unlock progress (state/unlockStore.ts) - recorded
      // once, uniformly, for every mode's genuinely CONCLUDED match,
      // before any of the mode-specific branches below (which handle
      // campaign's collection, series' round progression, etc. -
      // separate concerns campaignStore/seriesStore own). Skipped
      // specifically for series mode's drawn round, which isn't actually
      // concluded yet (auto-triggers a Sudden Death replay just below) -
      // that replay's own eventual real result passes through this same
      // effect again once IT finishes, recording then instead.
      const isInconclusiveSeriesDraw = mode === 'series' && game.winner === 'draw';
      if (game.winner && !isInconclusiveSeriesDraw) {
        // Snapshotted BEFORE any of this match's progress is recorded -
        // getNewlyUnlockedBatches (below) needs to compare against
        // exactly this moment to know which units this specific match's
        // outcome newly unlocked, the same "before/after diff" pattern
        // already used for campaignStore's hasCompletedCollection.
        const progressBefore = useUnlockStore.getState();

        const outcome: 'win' | 'loss' | 'draw' =
          game.winner === 'draw' ? 'draw' : game.winner === HUMAN_PLAYER ? 'win' : 'loss';
        // Campaign's "Continue" flow skips ArmyBuilder on every match
        // after the first, so armyBuilderStore would be stale by then -
        // campaignRosterFactionSlug is captured once up front instead
        // (see its own doc above) and converted slug -> name here, since
        // unlockStore keys by NAME (matching achievements.ts's existing
        // convention) while campaignRosterFactionSlug only has the slug.
        // Single-match/series mode can read armyBuilderStore directly -
        // ArmyBuilder always immediately precedes those matches, no
        // "Continue"-style skip to go stale across.
        const factionName =
          mode === 'campaign'
            ? campaignRosterFactionSlug
              ? getFactionNameForSlug(campaignRosterFactionSlug)
              : undefined
            : (useArmyBuilderStore.getState().rosterName ?? undefined);
        // "Flawless" = the opponent never captured a single card from the
        // human across the whole match - see gameStore.ts's own header
        // for why this has to be tracked live during play rather than
        // reconstructed from the finished GameState alone.
        const wasFlawless = !useGameStore.getState().matchOpponentCapturedFromHuman;
        useUnlockStore.getState().recordMatchOutcome(outcome, factionName, wasFlawless);

        // Flush this match's running Same/Plus/Chain tallies (see
        // gameStore.ts's own header for why they accumulate there during
        // play rather than being pushed to unlockStore trigger-by-trigger)
        // as a single batched count each - unconditionally correct even
        // when a tally is 0, but guarded anyway to avoid two pointless
        // no-op store writes on the (very common) match with no
        // Same/Plus/Chain triggers at all.
        const { matchSameOrPlusComboCount, matchChainReactionCount } = useGameStore.getState();
        if (matchSameOrPlusComboCount > 0) {
          useUnlockStore.getState().recordSameOrPlusCombo(matchSameOrPlusComboCount);
        }
        if (matchChainReactionCount > 0) {
          useUnlockStore.getState().recordChainReaction(matchChainReactionCount);
        }

        // Now that every stat this match could possibly affect has been
        // recorded, diff against progressBefore to find what newly
        // unlocked - queued for CardUnlockReveal to show one batch at a
        // time (see that component's own header for why one-per-TIER,
        // not one-per-unit). Appends rather than replaces the queue,
        // since a still-showing previous reveal (the player hasn't
        // dismissed it yet) shouldn't lose its own remaining batches.
        const newBatches = getNewlyUnlockedBatches(progressBefore, useUnlockStore.getState());
        if (newBatches.length > 0) {
          setUnlockRevealQueue((queue) => [...queue, ...newBatches]);
        }
      }

      if (mode === 'campaign') {
        if (!game.winner) return; // defensive - shouldn't happen once phase is 'finished'

        if (game.winner === 'draw') {
          useCampaignStore.getState().recordMatchResult('draw', [], []);
          setStep('result');
          return;
        }

        const outcome: 'win' | 'loss' = game.winner === HUMAN_PLAYER ? 'win' : 'loss';
        // Both sides now have a persistent pool (collection / aiCollection
        // - see campaignStore and campaignRivalMatchSetup.ts), and
        // recordMatchResult mirrors transfers onto both automatically -
        // this just needs the human's own gained/lost, same as before.
        // Filtering by t.to/t.from === HUMAN_PLAYER (rather than assuming
        // "winner always gains, loser always loses") stays correct
        // regardless of which Trade Rule variant is active - every
        // transferred entry has an explicit from/to, and exactly one of
        // the two checks below can ever match a given entry.
        const tradeResult = resolveTradeRule(game);
        const gained = tradeResult.transferred
          .filter((t) => t.to === HUMAN_PLAYER)
          .map((t) => t.card.unitId);
        const lost = tradeResult.transferred
          .filter((t) => t.from === HUMAN_PLAYER)
          .map((t) => t.card.unitId);

        // Only a win can ever complete the collection or deplete the
        // rival (a loss only removes the human's own cards, and
        // gained/lost above are already empty for a draw's separate
        // branch above) - but checking both unconditionally here rather
        // than only inside an `if (outcome === 'win')` costs nothing and
        // stays correct even if that assumption ever changes.
        const wasComplete = useCampaignStore.getState().hasCompletedCollection;
        const wasVanquished = useCampaignStore.getState().hasVanquishedRival;
        useCampaignStore.getState().recordMatchResult(outcome, gained, lost);
        const isCompleteNow = useCampaignStore.getState().hasCompletedCollection;
        const isVanquishedNow = useCampaignStore.getState().hasVanquishedRival;

        // Collection Complete takes priority if a single win somehow
        // reaches both at once - see VictoryModalKind's own doc in
        // CampaignResultScreen.tsx. The Rival Vanquished achievement
        // still silently unlocks either way (see recordMatchResult
        // above); only which MODAL shows is affected by this priority.
        if (!wasComplete && isCompleteNow) {
          setVictoryModalKind('collection-complete');
        } else if (!wasVanquished && isVanquishedNow) {
          setVictoryModalKind('rival-vanquished');
        }

        setStep('result');
        return;
      }

      if (mode !== 'series') {
        setStep('result');
        return;
      }

      if (game.winner === 'draw') {
        // Series rounds can't end undecided - auto-trigger Sudden Death
        // rather than asking the player (there's no other sensible choice).
        void useGameStore.getState().triggerSuddenDeathRematch();
        return;
      }
      if (!game.winner) return; // defensive - shouldn't happen once phase is 'finished'

      const tradeResult = resolveTradeRule(game);
      const transferred = tradeResult.transferred.map((t) => ({
        unitId: t.card.unitId,
        to: t.to,
      }));
      useSeriesStore.getState().applyRoundResult(game.winner, transferred);

      if (useSeriesStore.getState().seriesWinner !== null) {
        setStep('seriesResult');
      } else {
        setRuleSet(randomRuleSet());
        setStep('roundSummary');
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [step, game, mode]);

  function handleHomeNewGame() {
    setStep('modeSelect');
  }

  /** Navigates to screens/ProgressScreen.tsx - reachable from Home directly, or from CampaignHomeScreen's own shortcut. */
  function handleViewProgress() {
    setStep('progress');
  }

  /**
   * Deliberately always returns to 'home', not wherever the player was
   * before opening Progress - kept simple rather than tracking a
   * return-to step for what's meant to be a quick reference/stats check,
   * not a deep navigation flow. If this ends up feeling wrong in practice
   * (e.g. a player who opened Progress from CampaignHomeScreen expecting
   * Back to return them there), a return-to step is a small, easy
   * addition later.
   */
  function handleBackFromProgress() {
    setStep('home');
  }

  function handleSelectSingleMatch(chosenDifficulty: Difficulty) {
    setMode('single');
    setSeriesPoolSize(null);
    setDifficulty(chosenDifficulty);
    setStep('armyBuilder');
  }

  function handleSelectSeries(poolSize: number, chosenDifficulty: Difficulty) {
    setMode('series');
    setSeriesPoolSize(poolSize);
    setDifficulty(chosenDifficulty);
    setStep('armyBuilder');
  }

  function handleSelectCampaign(chosenDifficulty: Difficulty) {
    setMode('campaign');
    setDifficulty(chosenDifficulty);
    setStep('campaignHome');
  }

  /** Continuing an active campaign run skips ArmyBuilder entirely - the roster already exists (campaignStore's persistent collection), so this goes straight to the coin flip for the next match. Rolls a fresh random ruleset each time, same spirit as series mode's per-round rules - but excludes the Direct trade rule (see randomRuleSet.ts) so every campaign win always grows the player's collection. */
  function handleCampaignContinue() {
    setRuleSet(randomRuleSet({ excludeTradeRules: ['direct'] }));
    setStep('coinFlip');
  }

  /** Starting a fresh campaign run (CampaignHomeScreen has already confirmed this with the player if one was active) discards any prior collection/record and goes to ArmyBuilder for a new starting roster. */
  function handleCampaignStartNewRun() {
    useCampaignStore.getState().resetCampaign();
    setArmyBuilderError(null);
    setVictoryModalKind(null);
    setStep('armyBuilder');
  }

  function handleArmyReady(unitIds: string[]) {
    setHumanArmyUnitIds(unitIds);

    if (mode === 'campaign') {
      const validation = validateCampaignStartingRoster(unitIds);
      if (!validation.valid) {
        // Shouldn't normally be reachable anymore - ArmyBuilder now
        // live-gates all three rules (size/points/power-unit cap, the
        // last one via enforcePowerCap), so a player using the UI
        // normally can't reach Continue with an invalid roster. Kept as
        // a defensive backstop (same graceful, actionable-message
        // pattern as series mode's AI-roster failure below) rather than
        // trusting the UI gate alone - if these two ever drift out of
        // sync, this is what catches it instead of a broken match start.
        setArmyBuilderError(validation.reasons.join(' '));
        return;
      }

      const rosterName = useArmyBuilderStore.getState().rosterName;
      setCampaignRosterFactionSlug(rosterName ? getFactionSlugForRosterName(rosterName) : undefined);
      useCampaignStore.getState().startCampaign(unitIds);

      setArmyBuilderError(null);
      setRuleSet(randomRuleSet({ excludeTradeRules: ['direct'] }));
      setStep('coinFlip');
      return;
    }

    if (mode === 'series' && seriesPoolSize) {
      const pointsCap = useArmyBuilderStore.getState().pointsCap ?? 500;
      try {
        // buildRandomAIRoster can return more than requested (it greedily
        // fills the points cap) - slice to the exact pool size so both
        // sides have symmetric attrition potential.
        const aiPool = buildRandomAIRoster(
          pointsCap,
          seriesPoolSize,
          DIFFICULTY_PROFILES[difficulty].rosterStrategy,
        ).slice(0, seriesPoolSize);
        useSeriesStore.getState().initSeries(unitIds, aiPool);
        const inferredAiRosterName = inferRosterNameFromUnitIds(aiPool);
        setAiRosterFactionSlug(
          inferredAiRosterName ? getFactionSlugForRosterName(inferredAiRosterName) : undefined,
        );

        setArmyBuilderError(null);
        setRuleSet(randomRuleSet());
        setStep('seriesIntro');
      } catch {
        // A genuinely reachable failure, not a theoretical edge case: pool
        // size and points cap are chosen in separate steps, so a large
        // pool with a low cap (e.g. 25 units at 500pts, whose real
        // ceiling is 10) is easy to hit through completely normal use.
        // Stay on this screen with a clear, actionable message rather
        // than letting the uncaught error crash the app.
        setArmyBuilderError(
          `Couldn't build an opponent army for a ${seriesPoolSize}-card pool at ${pointsCap} points - try a smaller pool size or a higher points limit.`,
        );
      }
    } else {
      setArmyBuilderError(null);
      setStep('ruleSelect');
    }
  }

  function handleRulesReady(chosenRuleSet: RuleSet) {
    setRuleSet(chosenRuleSet);
    setStep('coinFlip');
  }

  function handleSeriesIntroContinue() {
    setStep('coinFlip');
  }

  function handleRoundSummaryContinue() {
    setStep('coinFlip');
  }

  function handleCoinFlipResult(startingPlayer: PlayerColour) {
    const humanRosterName = useArmyBuilderStore.getState().rosterName;
    const humanRosterFactionSlug = humanRosterName
      ? getFactionSlugForRosterName(humanRosterName)
      : undefined;

    if (mode === 'campaign') {
      const collection = useCampaignStore.getState().collection;
      // Campaign mode is the only mode whose AI opponent draws from its
      // OWN persistent, depletable pool rather than the unconstrained
      // full active-faction catalog buildRandomAIRoster uses (see
      // campaignRivalMatchSetup.ts's own header) - single-match and
      // series mode below are unaffected, still calling
      // buildRandomAIRoster directly.
      const aiPool = useCampaignStore.getState().aiCollection;
      const aiRoster = buildRivalRosterFromPool(
        aiPool,
        CAMPAIGN_STARTING_POINTS_CAP,
        5,
        DIFFICULTY_PROFILES[difficulty].rosterStrategy,
      );
      const inferredAiRosterName = inferRosterNameFromUnitIds(aiRoster);
      const resolvedAiFactionSlug = inferredAiRosterName
        ? getFactionSlugForRosterName(inferredAiRosterName)
        : undefined;
      const blueHand = unitIdsToHand(collection, 'blue', 5, campaignRosterFactionSlug);
      const redHand = unitIdsToHand(aiRoster, 'red', 5, resolvedAiFactionSlug);

      startGame({
        bluePlayer: { colour: 'blue', hand: blueHand },
        redPlayer: { colour: 'red', hand: redHand },
        startingPlayer,
        ruleSet,
        aiPlayer: 'red',
        aiOptions: DIFFICULTY_PROFILES[difficulty].aiOptions,
      });
    } else if (mode === 'series') {
      const { blueHand: blueUnitIds, redHand: redUnitIds } =
        useSeriesStore.getState().drawRoundHands();
      // Both hands are already exactly 5 specific unit ids drawn from the
      // series pool - unitIdsToHand with handSize equal to the array
      // length just converts to real Cards without any further sub-draw.
      const blueHand = unitIdsToHand(blueUnitIds, 'blue', blueUnitIds.length, humanRosterFactionSlug);
      const redHand = unitIdsToHand(redUnitIds, 'red', redUnitIds.length, aiRosterFactionSlug);

      startGame({
        bluePlayer: { colour: 'blue', hand: blueHand },
        redPlayer: { colour: 'red', hand: redHand },
        startingPlayer,
        ruleSet,
        aiPlayer: 'red',
        aiOptions: DIFFICULTY_PROFILES[difficulty].aiOptions,
      });
    } else {
      const pointsCap = useArmyBuilderStore.getState().pointsCap ?? 500;
      const aiRoster = buildRandomAIRoster(
        pointsCap,
        5,
        DIFFICULTY_PROFILES[difficulty].rosterStrategy,
      );
      const inferredAiRosterName = inferRosterNameFromUnitIds(aiRoster);
      const resolvedAiFactionSlug = inferredAiRosterName
        ? getFactionSlugForRosterName(inferredAiRosterName)
        : undefined;
      const blueHand = unitIdsToHand(humanArmyUnitIds, 'blue', 5, humanRosterFactionSlug);
      const redHand = unitIdsToHand(aiRoster, 'red', 5, resolvedAiFactionSlug);

      startGame({
        bluePlayer: { colour: 'blue', hand: blueHand },
        redPlayer: { colour: 'red', hand: redHand },
        startingPlayer,
        ruleSet,
        aiPlayer: 'red',
        aiOptions: DIFFICULTY_PROFILES[difficulty].aiOptions,
      });
    }
    setStep('game');
  }

  function handleReturnToHome() {
    resetGame();
    resetArmyBuilder();
    useSeriesStore.getState().reset();
    setHumanArmyUnitIds([]);
    setArmyBuilderError(null);
    setMode('single');
    setSeriesPoolSize(null);
    setDifficulty(DEFAULT_DIFFICULTY);
    setAiRosterFactionSlug(undefined);
    setCampaignRosterFactionSlug(undefined);
    setVictoryModalKind(null);
    setStep('home');
  }

  /** A campaign match's "New Game" doesn't mean "leave campaign mode" - it means "back to the campaign hub, ready for the next match". Only the live match resets; campaignStore's collection/record are untouched. */
  function handleCampaignMatchDone() {
    resetGame();
    setVictoryModalKind(null);
    setStep('campaignHome');
  }

  /** Refills the AI rival's depleted pool (campaignStore's reinforceRival) and dismisses the Rival Vanquished modal - the "Continue with AI Reinforcements" action. Stays on CampaignResultScreen; the player still clicks its own Continue button to actually proceed, same as dismissing any other way. */
  function handleReinforceRival() {
    useCampaignStore.getState().reinforceRival();
    setVictoryModalKind(null);
  }

  /**
   * Real bug this fixes (see ResultScreen.tsx's own doc on onSuddenDeath):
   * a Sudden Death rematch used to be triggered by ResultScreen calling
   * gameStore.triggerSuddenDeathRematch() directly, mutating `game` while
   * `step` stayed stuck at 'result' - GameScreen never re-mounted, so the
   * human had no board to actually play the rematch on. Pairing the store
   * mutation with setStep('game') here fixes it at the source: the
   * navigation state lives in App.tsx, so the fix belongs here too.
   */
  function handleSuddenDeathRematch() {
    void useGameStore.getState().triggerSuddenDeathRematch();
    setStep('game');
  }

  /**
   * Rematch with the SAME army, skipping ArmyBuilder entirely - single-
   * match and series result screens only (Campaign already has its own
   * "Continue" flow via CampaignHomeScreen, which is a different shape of
   * problem - a persistent collection, not a one-off army pick).
   *
   * Deliberately just re-invokes handleArmyReady with the already-stored
   * humanArmyUnitIds rather than duplicating its branching logic: that
   * function is already exactly "what happens once an army is chosen",
   * and nothing about being a REPLAYED army changes that - it still needs
   * the same mode-specific setup (single-match goes to rule selection,
   * series builds a fresh AI pool and starts a new series). armyBuilderStore's
   * rosterName/pointsCap are still intact too (resetArmyBuilder is only
   * called from handleReturnToHome, never here), so the AI roster and
   * card-back faction slug resolve exactly as they did the first time.
   */
  function handlePlayAgain() {
    resetGame();
    handleArmyReady(humanArmyUnitIds);
  }

  /**
   * Renders whichever screen `step` currently points to. Extracted into
   * its own function (rather than being the component's own top-level
   * return, as it used to be) specifically so CardUnlockReveal below can
   * be layered on top of THIS, whatever it is - that reveal needs to
   * appear regardless of which screen is currently showing (any mode's
   * result screen, or even mid-navigation), not be threaded into every
   * individual screen's own render call.
   */
  function renderStep(): ReactNode {
    switch (step) {
    case 'home':
      return <HomeScreen onNewGame={handleHomeNewGame} onViewProgress={handleViewProgress} />;

    case 'modeSelect':
      return (
        <ModeSelectScreen
          onSelectSingleMatch={handleSelectSingleMatch}
          onSelectSeries={handleSelectSeries}
          onSelectCampaign={handleSelectCampaign}
        />
      );

    case 'armyBuilder':
      return (
        <ArmyBuilderScreen
          onContinue={handleArmyReady}
          requiredArmySize={
            mode === 'campaign'
              ? CAMPAIGN_STARTING_POOL_SIZE
              : mode === 'series'
                ? (seriesPoolSize ?? undefined)
                : undefined
          }
          forcedPointsCap={mode === 'campaign' ? CAMPAIGN_STARTING_POINTS_CAP : undefined}
          errorMessage={armyBuilderError ?? undefined}
          enforcePowerCap={mode === 'campaign'}
        />
      );

    case 'ruleSelect':
      return <RuleSelectScreen onContinue={handleRulesReady} />;

    case 'seriesIntro':
      return (
        <SeriesIntroScreen
          poolSize={seriesPoolSize ?? 0}
          round1RuleSet={ruleSet}
          onContinue={handleSeriesIntroContinue}
        />
      );

    case 'coinFlip':
      return (
        <div className={styles.centeredScreen}>
          <CoinFlip onResult={handleCoinFlipResult} />
        </div>
      );

    case 'game':
      return <GameScreen humanPlayer={HUMAN_PLAYER} onQuit={handleReturnToHome} />;

    case 'roundSummary': {
      const lastRound = seriesState.roundHistory[seriesState.roundHistory.length - 1];
      return (
        <RoundSummaryScreen
          roundNumber={lastRound.roundNumber}
          winner={lastRound.winner}
          bluePoolRemaining={seriesState.bluePool.length}
          redPoolRemaining={seriesState.redPool.length}
          blueWins={seriesState.blueWins}
          redWins={seriesState.redWins}
          tradeTransferred={lastRound.tradeTransferred}
          nextRoundRuleSet={ruleSet}
          onContinue={handleRoundSummaryContinue}
        />
      );
    }

    case 'result':
      return mode === 'campaign' ? (
        <CampaignResultScreen
          onContinue={handleCampaignMatchDone}
          victoryModalKind={victoryModalKind}
          onStartNewRun={handleCampaignStartNewRun}
          onReturnToTitle={handleReturnToHome}
          onDismissVictoryModal={() => setVictoryModalKind(null)}
          onReinforceRival={handleReinforceRival}
        />
      ) : (
        <ResultScreen
          onPlayAgain={handlePlayAgain}
          onReturnToMenu={handleReturnToHome}
          onSuddenDeath={handleSuddenDeathRematch}
        />
      );

    case 'campaignHome':
      return (
        <CampaignHomeScreen
          onContinue={handleCampaignContinue}
          onStartNewRun={handleCampaignStartNewRun}
          onReinforceRival={handleReinforceRival}
          onViewProgress={handleViewProgress}
        />
      );

    case 'progress':
      return <ProgressScreen onBack={handleBackFromProgress} />;

    case 'seriesResult':
      return (
        <SeriesResultScreen
          seriesWinner={seriesState.seriesWinner ?? 'draw'}
          blueWins={seriesState.blueWins}
          redWins={seriesState.redWins}
          roundsPlayed={seriesState.roundHistory.length}
          onPlayAgain={handlePlayAgain}
          onReturnToMenu={handleReturnToHome}
        />
      );
    }
  }

  const currentUnlockReveal = unlockRevealQueue[0];

  return (
    <>
      {renderStep()}
      {currentUnlockReveal && (
        <CardUnlockReveal
          tier={currentUnlockReveal.tier}
          units={currentUnlockReveal.units}
          onDismiss={() => setUnlockRevealQueue((queue) => queue.slice(1))}
        />
      )}
    </>
  );
}