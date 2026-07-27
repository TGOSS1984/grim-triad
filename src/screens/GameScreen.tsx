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
import { computeEffectiveStats } from '../engine/rules/effectiveStats';
import { emptyPositions } from '../engine/board';
import { CAPTURE_FLIP_STAGGER_MS } from '../state/animationTiming';
import type { Card as EngineCard, CaptureKind, GameState, PlayerColour, Position } from '../engine/types';
import { resolvePrimaryCaptureTriggerKind } from '../engine/captureTriggerKind';
import type { ElementId } from '../data/elements';
import { Board } from '../components/board/Board';
import type { BoardCardData } from '../components/board/BoardCell';
import { RuleTriggerCallout, type RuleTrigger } from '../components/board/RuleTriggerCallout';
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
 * Picks the ONE rule to call out for a move's captures - a thin wrapper
 * around the shared engine/captureTriggerKind.ts resolver (also used by
 * gameStore.ts for cross-mode unlock progress tracking, so both stay in
 * perfect agreement about what counts as a trigger), adding only the UI
 * concern of whether to show the smaller "Chain Reaction!" flourish.
 */
function resolvePrimaryTrigger(
  captureKinds: CaptureKind[] | undefined,
  comboTriggered: boolean,
): RuleTrigger | null {
  const kind = resolvePrimaryCaptureTriggerKind(captureKinds);
  if (!kind) return null;
  return { kind, comboExtended: comboTriggered };
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

  /**
   * Which rule (if any) to call out via RuleTriggerCallout for the most
   * recent move - see resolvePrimaryTrigger's own doc. game.history.length
   * is passed as the callout's triggerKey (not game itself, which changes
   * on every render for reasons unrelated to a new move) so it only
   * re-fires when an actual new move has been recorded, once per move.
   */
  const currentTrigger = resolvePrimaryTrigger(
    game.lastCapture?.captureKinds,
    game.lastCapture?.comboTriggered ?? false,
  );

  const boardCells: (BoardCardData | null)[][] = game.board.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (!cell.card) return null;
      // game.board's own type (engine/types.ts's Board) guarantees exactly
      // 3 rows of 3 cells, but .map()'s callback index is typed as plain
      // `number`, not the `0 | 1 | 2` literal union Position actually
      // requires - this assertion is safe precisely because that
      // guarantee exists, not a runtime claim being made blindly.
      const position = { row: rowIndex, col: colIndex } as Position;
      return {
        instanceId: cell.card.instanceId,
        owner: cell.card.owner,
        flipDelayMs: flipDelayByPosition.get(`${rowIndex},${colIndex}`),
        captureKind: captureKindByPosition.get(`${rowIndex},${colIndex}`),
        // Safe to always compute, not gated on any single rule flag -
        // computeEffectiveStats checks each rule's own ruleSet flag
        // internally and naturally no-ops for anything inactive, so
        // there's no behavioral difference to gate here, just an
        // unnecessary conditional.
        effectiveStats: computeEffectiveStats(cell.card, game.ruleSet, { board: game.board, pos: position }, game.epicHeroPresence),
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
      // No boardContext (null) - a hand card has no position yet, so
      // board-positional rules (Elemental, Combined Arms) don't apply.
      // Underdog also can't apply (a card in hand hasn't captured
      // anything). Epic Hero Presence is the one modifier that DOES
      // still apply here - it's a standing army-wide buff, not
      // positional or event-driven, so it has to show up in hand too.
      effectiveStats: computeEffectiveStats(card, game!.ruleSet, null, game!.epicHeroPresence),
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
          <div className={styles.boardStack}>
            <Board
              cells={boardCells}
              elements={boardElements}
              highlightedPositions={highlightedPositions}
              onCellClick={handleCellClick}
              cardWidth={cardWidth + 10}
            />
            <RuleTriggerCallout trigger={currentTrigger} triggerKey={game.history.length} />
          </div>
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