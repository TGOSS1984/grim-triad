/**
 * The live match screen. Assumes a game has already been started elsewhere
 * (useGameStore.startGame - called during the App-level flow after the
 * coin flip resolves, Phase 8.7) - this screen's job is purely to render
 * the current live GameState and drive human interaction (select a hand
 * card, click a board cell to place it), not to own match setup.
 *
 * Resolves each engine Card's unitId back to display data (name, portrait)
 * via getUnitById - the engine only carries stats/owner/unitId, no display
 * info, by design (see engine/types.ts).
 */
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { getUnitById } from '../data/activeFactions';
import { isHandVisibleTo } from '../engine/rules/open';
import { emptyPositions } from '../engine/board';
import type { Card as EngineCard, PlayerColour, Position } from '../engine/types';
import { Board } from '../components/board/Board';
import type { BoardCardData } from '../components/board/BoardCell';
import { Hand } from '../components/hand/Hand';
import type { HandCardData } from '../components/hand/Hand';
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { ResponsiveGameLayout } from '../components/layout/ResponsiveGameLayout';
import styles from './GameScreen.module.css';

export interface GameScreenProps {
  /** Which colour the local human is playing as. */
  humanPlayer: PlayerColour;
  backgroundImagePath?: string;
  cardWidth?: number;
}

/** A portrait path that will 404 cleanly (not "" - see the note in Card.tsx about empty src being a footgun) if a unit can't be resolved. This should only happen for malformed/stale data. */
const UNKNOWN_UNIT_PORTRAIT = 'assets/factions/unknown/units/unknown.png';

function toDisplayFields(card: EngineCard): Pick<HandCardData, 'name' | 'stats' | 'portraitPath'> {
  const unit = getUnitById(card.unitId);
  return {
    name: unit?.name ?? 'Unknown Unit',
    stats: card.stats,
    portraitPath: unit?.portraitPath ?? UNKNOWN_UNIT_PORTRAIT,
  };
}

export function GameScreen({ humanPlayer, backgroundImagePath, cardWidth = 130 }: GameScreenProps) {
  const game = useGameStore((s) => s.game);
  const playCard = useGameStore((s) => s.playCard);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();

  if (!game) {
    return (
      <div className={styles.screen}>
        <p className={styles.empty}>No game in progress.</p>
      </div>
    );
  }

  const isHumanTurn = game.activePlayer === humanPlayer;

  const boardCells: (BoardCardData | null)[][] = game.board.map((row) =>
    row.map((cell) => {
      if (!cell.card) return null;
      return {
        instanceId: cell.card.instanceId,
        owner: cell.card.owner,
        ...toDisplayFields(cell.card),
      };
    }),
  ) as (BoardCardData | null)[][];

  function buildHandCards(colour: PlayerColour): HandCardData[] {
    return game!.players[colour].hand.map((card) => ({
      instanceId: card.instanceId,
      ...toDisplayFields(card),
    }));
  }

  const blueHandCards = buildHandCards('blue');
  const redHandCards = buildHandCards('red');

  const highlightedPositions =
    isHumanTurn && selectedCardId ? emptyPositions(game.board) : [];

  function handleSelectCard(colour: PlayerColour, instanceId: string) {
    if (colour !== humanPlayer || !isHumanTurn) return;
    setSelectedCardId((prev) => (prev === instanceId ? undefined : instanceId));
  }

  function handleCellClick(position: Position) {
    if (!isHumanTurn || !selectedCardId) return;
    const card = game!.players[humanPlayer].hand.find((c) => c.instanceId === selectedCardId);
    if (!card) return;
    playCard(card, position);
    setSelectedCardId(undefined);
  }

  const blueFaceUp = isHandVisibleTo(game.ruleSet, humanPlayer, 'blue');
  const redFaceUp = isHandVisibleTo(game.ruleSet, humanPlayer, 'red');

  return (
    <div className={styles.screen}>
      <BackgroundLayer imagePath={backgroundImagePath} />
      <div className={styles.turnBanner}>
        {game.phase === 'finished'
          ? 'Match finished'
          : isHumanTurn
            ? 'Your turn'
            : "Opponent's turn"}
      </div>
      <ResponsiveGameLayout
        left={
          <Hand
            cards={blueHandCards}
            owner="blue"
            faceUp={blueFaceUp}
            side="left"
            cardWidth={cardWidth}
            selectedCardId={humanPlayer === 'blue' ? selectedCardId : undefined}
            onSelectCard={
              humanPlayer === 'blue' && isHumanTurn
                ? (id) => handleSelectCard('blue', id)
                : undefined
            }
          />
        }
        center={
          <Board
            cells={boardCells}
            highlightedPositions={highlightedPositions}
            onCellClick={handleCellClick}
            cardWidth={cardWidth + 10}
          />
        }
        right={
          <Hand
            cards={redHandCards}
            owner="red"
            faceUp={redFaceUp}
            side="right"
            cardWidth={cardWidth}
            selectedCardId={humanPlayer === 'red' ? selectedCardId : undefined}
            onSelectCard={
              humanPlayer === 'red' && isHumanTurn
                ? (id) => handleSelectCard('red', id)
                : undefined
            }
          />
        }
      />
    </div>
  );
}