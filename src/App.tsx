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
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';
import { useSeriesStore } from './state/seriesStore';
import { buildRandomAIRoster, unitIdsToHand } from './state/matchSetup';
import { resolveTradeRule } from './engine/rules/tradeRules';
import type { PlayerColour, RuleSet } from './engine/types';
import { DEFAULT_RULE_SET } from './engine/gameReducer';
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
  | 'seriesResult';

type Mode = 'single' | 'series';

/** The human always plays blue; the AI always plays red - see GameScreen/matchSetup for why this is a reasonable v1 simplification. */
const HUMAN_PLAYER: PlayerColour = 'blue';

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [mode, setMode] = useState<Mode>('single');
  const [seriesPoolSize, setSeriesPoolSize] = useState<number | null>(null);
  const [humanArmyUnitIds, setHumanArmyUnitIds] = useState<string[]>([]);
  /** Single-match mode's player-chosen rules, OR series mode's current round's rolled rules. */
  const [ruleSet, setRuleSet] = useState<RuleSet>(DEFAULT_RULE_SET);

  const game = useGameStore((s) => s.game);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.reset);
  const resetArmyBuilder = useArmyBuilderStore((s) => s.reset);
  const seriesState = useSeriesStore();

  // GameScreen only renders/drives the live match - it doesn't navigate.
  // Watching for phase 'finished' here is what actually moves the app on
  // once a match concludes, branching for series mode's round loop.
  useEffect(() => {
    if (step !== 'game') return;
    if (!game || game.phase !== 'finished') return;

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
  }, [step, game, mode]);

  function handleHomeNewGame() {
    setStep('modeSelect');
  }

  function handleSelectSingleMatch() {
    setMode('single');
    setSeriesPoolSize(null);
    setStep('armyBuilder');
  }

  function handleSelectSeries(poolSize: number) {
    setMode('series');
    setSeriesPoolSize(poolSize);
    setStep('armyBuilder');
  }

  function handleArmyReady(unitIds: string[]) {
    setHumanArmyUnitIds(unitIds);

    if (mode === 'series' && seriesPoolSize) {
      const pointsCap = useArmyBuilderStore.getState().pointsCap ?? 500;
      // buildRandomAIRoster can return more than requested (it greedily
      // fills the points cap) - slice to the exact pool size so both
      // sides have symmetric attrition potential.
      const aiPool = buildRandomAIRoster(pointsCap, seriesPoolSize).slice(0, seriesPoolSize);
      useSeriesStore.getState().initSeries(unitIds, aiPool);

      setRuleSet(randomRuleSet());
      setStep('seriesIntro');
    } else {
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
    if (mode === 'series') {
      const { blueHand: blueUnitIds, redHand: redUnitIds } =
        useSeriesStore.getState().drawRoundHands();
      // Both hands are already exactly 5 specific unit ids drawn from the
      // series pool - unitIdsToHand with handSize equal to the array
      // length just converts to real Cards without any further sub-draw.
      const blueHand = unitIdsToHand(blueUnitIds, 'blue', blueUnitIds.length);
      const redHand = unitIdsToHand(redUnitIds, 'red', redUnitIds.length);

      startGame({
        bluePlayer: { colour: 'blue', hand: blueHand },
        redPlayer: { colour: 'red', hand: redHand },
        startingPlayer,
        ruleSet,
        aiPlayer: 'red',
      });
    } else {
      const pointsCap = useArmyBuilderStore.getState().pointsCap ?? 500;
      const aiRoster = buildRandomAIRoster(pointsCap);
      const blueHand = unitIdsToHand(humanArmyUnitIds, 'blue');
      const redHand = unitIdsToHand(aiRoster, 'red');

      startGame({
        bluePlayer: { colour: 'blue', hand: blueHand },
        redPlayer: { colour: 'red', hand: redHand },
        startingPlayer,
        ruleSet,
        aiPlayer: 'red',
      });
    }
    setStep('game');
  }

  function handleReturnToHome() {
    resetGame();
    resetArmyBuilder();
    useSeriesStore.getState().reset();
    setHumanArmyUnitIds([]);
    setMode('single');
    setSeriesPoolSize(null);
    setStep('home');
  }

  switch (step) {
    case 'home':
      return <HomeScreen onNewGame={handleHomeNewGame} />;

    case 'modeSelect':
      return (
        <ModeSelectScreen
          onSelectSingleMatch={handleSelectSingleMatch}
          onSelectSeries={handleSelectSeries}
        />
      );

    case 'armyBuilder':
      return (
        <ArmyBuilderScreen
          onContinue={handleArmyReady}
          requiredArmySize={mode === 'series' ? (seriesPoolSize ?? undefined) : undefined}
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
          tradeTransferredCount={lastRound.tradeTransferredCount}
          nextRoundRuleSet={ruleSet}
          onContinue={handleRoundSummaryContinue}
        />
      );
    }

    case 'result':
      return <ResultScreen onNewGame={handleReturnToHome} />;

    case 'seriesResult':
      return (
        <SeriesResultScreen
          seriesWinner={seriesState.seriesWinner ?? 'draw'}
          blueWins={seriesState.blueWins}
          redWins={seriesState.redWins}
          roundsPlayed={seriesState.roundHistory.length}
          onNewGame={handleReturnToHome}
        />
      );
  }
}