/**
 * A single cell in the 3x3 battle grid. Two states:
 *  - Empty: a clickable placement target, glowing when highlighted as a
 *    legal move for the currently selected hand card.
 *  - Occupied: renders the placed Card, non-interactive (board cards
 *    aren't clicked after placement in the base game).
 *
 * When the Elemental rule is active, a cell may also have a terrain
 * element - shown as a small badge in the corner regardless of whether
 * the cell is empty or occupied, since the terrain exists independent of
 * what's currently placed there (and you need to see it BEFORE placing to
 * make an informed choice).
 *
 * Deliberately dumb/presentational, same philosophy as Card itself - this
 * component doesn't know about game rules, legality, or engine types
 * directly; Board computes what's legal and passes the result down.
 */
import type { CardStats, PlayerColour, Position } from '../../engine/types';
import type { ElementId } from '../../data/elements';
import { Card } from '../card/Card';
import { ElementIcon } from '../common/ElementIcon';
import styles from './Board.module.css';

export interface BoardCardData {
  instanceId: string;
  name: string;
  stats: CardStats;
  portraitPath: string;
  fallbackPortraitPath?: string;
  owner: PlayerColour;
  /** Delay (ms) before this card's capture flip animation starts - see Card.tsx. */
  flipDelayMs?: number;
}

export interface BoardCellProps {
  position: Position;
  card: BoardCardData | null;
  /** This cell's Elemental terrain type, if the rule is active and this cell was chosen. */
  element?: ElementId;
  highlighted?: boolean;
  cardWidth?: number;
  onClick?: (position: Position) => void;
}

const ELEMENT_LABELS: Record<ElementId, string> = {
  warp: 'Warp terrain',
  promethium: 'Promethium terrain',
  void: 'Void terrain',
  toxic: 'Toxic terrain',
  radiation: 'Radiation terrain',
};

export function BoardCell({
  position,
  card,
  element,
  highlighted = false,
  cardWidth,
  onClick,
}: BoardCellProps) {
  const elementBadge = element && (
    <div className={styles.elementBadge}>
      <ElementIcon element={element} title={ELEMENT_LABELS[element]} />
    </div>
  );

  if (card) {
    return (
      <div className={styles.cell}>
        <Card
          layoutId={card.instanceId}
          name={card.name}
          stats={card.stats}
          portraitPath={card.portraitPath}
          fallbackPortraitPath={card.fallbackPortraitPath}
          owner={card.owner}
          width={cardWidth}
          flipDelayMs={card.flipDelayMs}
        />
        {elementBadge}
      </div>
    );
  }

  const label = `Empty cell, row ${position.row + 1}, column ${position.col + 1}`;

  return (
    <div className={styles.cell}>
      <button
        type="button"
        className={[styles.emptySlot, highlighted ? styles.emptySlotHighlighted : ''].join(' ')}
        style={cardWidth ? ({ '--card-width': `${cardWidth}px` } as React.CSSProperties) : undefined}
        onClick={() => onClick?.(position)}
        disabled={!onClick}
        aria-label={label}
      />
      {elementBadge}
    </div>
  );
}