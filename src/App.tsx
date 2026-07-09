/**
 * The root application: a simple step-based flow, not a full router (the
 * game has one linear path with no deep-linkable sub-pages, so react-router
 * would be pure overhead here). Owns cross-screen orchestration that no
 * individual screen should own itself:
 *  - Carrying the human's chosen army/rules from one screen to the next.
 *  - Generating the AI opponent's army (matchSetup.ts) and starting the
 *    live game once the coin flip resolves.
 *  - Watching the live game for phase 'finished' and switching to
 *    ResultScreen automatically - GameScreen itself doesn't navigate.
 */
import { useEffect, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ArmyBuilderScreen } from './screens/ArmyBuilderScreen';
import { RuleSelectScreen } from './components/ruleSelect/RuleSelectScreen';
import { CoinFlip } from './components/coinFlip/CoinFlip';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useGameStore } from './state/gameStore';
import { useArmyBuilderStore } from './state/armyBuilderStore';
import { buildRandomAIRoster, unitIdsToHand } from './state/matchSetup';
import type { PlayerColour, RuleSet } from './engine/types';
import { DEFAULT_RULE_SET } from './engine/gameReducer';
import styles from './App.module.css';

type Step = 'home' | 'armyBuilder' | 'ruleSelect' | 'coinFlip' | 'game' | 'result';

/** The human always plays blue; the AI always plays red - see GameScreen/matchSetup for why this is a reasonable v1 simplification. */
const HUMAN_PLAYER: PlayerColour = 'blue';

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [humanArmyUnitIds, setHumanArmyUnitIds] = useState<string[]>([]);
  const [ruleSet, setRuleSet] = useState<RuleSet>(DEFAULT_RULE_SET);

  const game = useGameStore((s) => s.game);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.reset);
  const resetArmyBuilder = useArmyBuilderStore((s) => s.reset);

  // GameScreen only renders/drives the live match - it doesn't navigate.
  // Watching for phase 'finished' here is what actually moves the app on
  // to ResultScreen once a match concludes.
  useEffect(() => {
    if (step === 'game' && game?.phase === 'finished') {
      setStep('result');
    }
  }, [step, game?.phase]);

  function handleHomeNewGame() {
    setStep('armyBuilder');
  }

  function handleArmyReady(unitIds: string[]) {
    setHumanArmyUnitIds(unitIds);
    setStep('ruleSelect');
  }

  function handleRulesReady(chosenRuleSet: RuleSet) {
    setRuleSet(chosenRuleSet);
    setStep('coinFlip');
  }

  function handleCoinFlipResult(startingPlayer: PlayerColour) {
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
    setStep('game');
  }

  function handleNewGameFromResult() {
    resetGame();
    resetArmyBuilder();
    setHumanArmyUnitIds([]);
    setStep('home');
  }

  switch (step) {
    case 'home':
      return <HomeScreen onNewGame={handleHomeNewGame} />;

    case 'armyBuilder':
      return <ArmyBuilderScreen onContinue={handleArmyReady} />;

    case 'ruleSelect':
      return <RuleSelectScreen onContinue={handleRulesReady} />;

    case 'coinFlip':
      return (
        <div className={styles.centeredScreen}>
          <CoinFlip onResult={handleCoinFlipResult} />
        </div>
      );

    case 'game':
      return <GameScreen humanPlayer={HUMAN_PLAYER} />;

    case 'result':
      return <ResultScreen onNewGame={handleNewGameFromResult} />;
  }
}