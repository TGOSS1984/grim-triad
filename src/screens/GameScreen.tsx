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
import { getUnitById, getFactionSlugForUnit } from '../data/activeFactions';
import { isHandVisibleTo } from '../engine/rules/open';
import { getEffectiveStats } from '../engine/rules/elemental';
import { emptyPositions } from '../engine/board';
import { CAPTURE_FLIP_STAGGER_MS } from '../state/animationTiming';
import type { Card as EngineCard, CaptureKind, GameState, PlayerColour, Position } from '../engine/types';
import type { ElementId } from '../data/elements';
import { Board } from '../components/board/Board';
import type { BoardCardData } from '../components/board/BoardCell';
import { Hand } from '../components/hand/Hand';
import type { HandCardData } from '../components/hand/Hand';
import { BackgroundLayer } from '../components/layout/BackgroundLayer';
import { pickRandomBackground } from '../components/layout/backgroundUtils';
import { BATTLE_BACKGROUND_POOL } from '../components/layout/backgroundPaths';
import { ResponsiveGameLayout } from '../components/layout/ResponsiveGameLayout';
import { useResponsiveCardWidth } from '../components/layout/useResponsiveCardWidth';
import { describeRuleSet } from '../utils/describeRuleSet';
import styles from './GameScreen.module.css';

export interface GameScreenProps {
  /** Which colour the local human is playing as. */
  humanPlayer: PlayerColour;
  /** Explicit override for the background image. Omit to get a random pick from BATTLE_BACKGROUND_POOL, made once per match (see the useState lazy initializer below). */
  backgroundImagePath?: string;
  /** Explicit override for card width (px). Omit to use useResponsiveCardWidth's fluid, viewport-driven default. */
  cardWidth?: number;
  /** Called when the player confirms they want to abandon the current match and return to the menu. Omit to hide the Quit button entirely. */
  onQuit?: () => void;
}

/** A portrait path that will 404 cleanly (not "" - see the note in Card.tsx about empty src being a footgun) if a unit can't be resolved. This should only happen for malformed/stale data. */
const UNKNOWN_UNIT_PORTRAIT = 'assets/factions/unknown/units/unknown.png';

function toDisplayFields(
  card: EngineCard,
  includeElement: boolean,
): Pick<HandCardData, 'name' | 'stats' | 'portraitPath' | 'element' | 'keywords'> {
  const unit = getUnitById(card.unitId);
  return {
    name: unit?.name ?? 'Unknown Unit',
    stats: card.stats,
    portraitPath: unit?.portraitPath ?? UNKNOWN_UNIT_PORTRAIT,
    element: includeElement ? unit?.element : undefined,
    keywords: unit?.keywords,
  };
}

/**
 * Resolves which faction's logo a side's face-down cards should show,
 * checking their hand first and falling back to any of their cards
 * already on the board (the hand can be empty near the end of a match, so
 * relying on the hand alone would lose the logo right when there's the
 * least else on screen to identify the side).
 *
 * Prefers each card's OWN `rosterFactionSlug` (the roster it was actually
 * drafted under - see engine/types.ts's Card) over re-deriving a slug
 * from the underlying unit's static faction data. These differ for
 * shared/generic units: a generic Space Marines unit fielded as part of a
 * Blood Angels roster should show the Blood Angels logo (the roster the
 * player actually built), not a generic Space Marines icon - see
 * data/activeFactions.ts's getUnitsForRoster for why that union exists.
 * Falls back to the old per-unit derivation for any card that predates
 * this field (rosterFactionSlug is optional).
 */
function resolveHandFactionSlug(game: GameState, colour: PlayerColour): string | undefined {
  const handCard = game.players[colour].hand[0];
  if (handCard) {
    if (handCard.rosterFactionSlug) return handCard.rosterFactionSlug;
    const unit = getUnitById(handCard.unitId);
    if (unit) return getFactionSlugForUnit(unit);
  }
  for (const row of game.board) {
    for (const cell of row) {
      if (cell.card?.owner === colour) {
        if (cell.card.rosterFactionSlug) return cell.card.rosterFactionSlug;
        const unit = getUnitById(cell.card.unitId);
        if (unit) return getFactionSlugForUnit(unit);
      }
    }
  }
  return undefined;
}

export function GameScreen({ humanPlayer, backgroundImagePath: backgroundOverride, cardWidth: cardWidthOverride, onQuit }: GameScreenProps) {
  const game = useGameStore((s) => s.game);
  const playCard = useGameStore((s) => s.playCard);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const responsiveCardWidth = useResponsiveCardWidth();
  const cardWidth = cardWidthOverride ?? responsiveCardWidth;
  // Lazy initializer: rolled exactly once when this GameScreen instance
  // first mounts (i.e. once per match), not on every render - a plain
  // pickRandomBackground(...) call in the render body would re-roll a new
  // background on every single re-render (every move!), not once per
  // match as intended.
  const [randomBackground] = useState(() => pickRandomBackground(BATTLE_BACKGROUND_POOL));
  const backgroundImagePath = backgroundOverride ?? randomBackground;

  if (!game) {
    return (
      <div className={styles.screen}>
        <p className={styles.empty}>No game in progress.</p>
      </div>
    );
  }

  const isHumanTurn = game.activePlayer === humanPlayer;

  /**
   * Maps each captured position from the most recent move to a stagger
   * delay, so a multi-card combo chain flips one card at a time instead
   * of all at once - see Card.tsx's flipDelayMs (a fast, fully-simultaneous
   * flip was hard to actually see for multi-card captures).
   */
  const flipDelayByPosition = new Map<string, number>();
  game.lastCapture?.positions.forEach((pos, index) => {
    flipDelayByPosition.set(`${pos.row},${pos.col}`, index * CAPTURE_FLIP_STAGGER_MS);
  });

  /**
   * Same per-position mapping, this time for WHICH rule captured each
   * card (see engine/types.ts's CaptureKind) - lets Card.tsx give each
   * rule its own visual "tell" during the flip instead of every capture
   * looking identical. captureKinds is parallel to positions (same
   * index), same as flipDelayByPosition's index usage above.
   */
  const captureKindByPosition = new Map<string, CaptureKind>();
  game.lastCapture?.positions.forEach((pos, index) => {
    const kind = game.lastCapture?.captureKinds[index];
    if (kind) captureKindByPosition.set(`${pos.row},${pos.col}`, kind);
  });

  const boardCells: (BoardCardData | null)[][] = game.board.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (!cell.card) return null;
      const position = { row: rowIndex, col: colIndex };
      return {
        instanceId: cell.card.instanceId,
        owner: cell.card.owner,
        flipDelayMs: flipDelayByPosition.get(`${rowIndex},${colIndex}`),
        captureKind: captureKindByPosition.get(`${rowIndex},${colIndex}`),
        // Safe to always compute, not gated on game.ruleSet.elemental -
        // getEffectiveStats naturally returns the card's stats unchanged
        // when the cell has no assigned element (board[pos].element is
        // only ever set in the first place when Elemental is active), so
        // there's no behavioral difference to gate, just an unnecessary
        // conditional.
        effectiveStats: getEffectiveStats(game.board, cell.card, position),
        ...toDisplayFields(cell.card, game.ruleSet.elemental),
      };
    }),
  ) as (BoardCardData | null)[][];

  // The engine's Board cells carry a generic `element?: string` (see
  // engine/types.ts - the engine itself is deliberately theme-agnostic).
  // createGame only ever assigns values from the app's real themed pool
  // (src/data/elements.ts, wired via gameStore's default availableElements),
  // so this cast is safe in practice, not a real type-safety gap.
  const boardElements: (ElementId | undefined)[][] = game.board.map((row) =>
    row.map((cell) => cell.element as ElementId | undefined),
  );

  function buildHandCards(colour: PlayerColour): HandCardData[] {
    return game!.players[colour].hand.map((card) => ({
      instanceId: card.instanceId,
      ...toDisplayFields(card, game!.ruleSet.elemental),
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
  const blueFactionSlug = resolveHandFactionSlug(game, 'blue');
  const redFactionSlug = resolveHandFactionSlug(game, 'red');

  return (
    <div className={styles.screen}>
      <BackgroundLayer imagePath={backgroundImagePath} />
      <div className={styles.header}>
        <div className={styles.turnBanner}>
          {game.phase === 'finished'
            ? 'Match finished'
            : isHumanTurn
              ? 'Your turn'
              : "Opponent's turn"}
        </div>
        <div className={styles.rulesBadge} aria-label="Active match rules">
          {describeRuleSet(game.ruleSet).map((label) => (
            <span
              key={label}
              className={[
                styles.ruleChip,
                label.startsWith('Trade Rule:') ? styles.ruleChipTrade : '',
              ].join(' ')}
            >
              {label}
            </span>
          ))}
        </div>
        {onQuit && (
          <div className={styles.quitArea}>
            {confirmingQuit ? (
              <>
                <span className={styles.quitConfirmText}>Quit this match?</span>
                <button type="button" className={styles.quitConfirmButton} onClick={onQuit}>
                  Yes, Quit
                </button>
                <button
                  type="button"
                  className={styles.quitCancelButton}
                  onClick={() => setConfirmingQuit(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.quitButton}
                onClick={() => setConfirmingQuit(true)}
              >
                Quit Game
              </button>
            )}
          </div>
        )}
      </div>
      <ResponsiveGameLayout
        left={
          <Hand
            cards={blueHandCards}
            owner="blue"
            faceUp={blueFaceUp}
            factionSlug={blueFactionSlug}
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
            elements={boardElements}
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
            factionSlug={redFactionSlug}
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