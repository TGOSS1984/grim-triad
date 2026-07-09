/**
 * A single cell in the 3x3 battle grid. Two states:
 *  - Empty: a clickable placement target, glowing when highlighted as a
 *    legal move for the currently selected hand card.
 *  - Occupied: renders the placed Card, non-interactive (board cards
 *    aren't clicked after placement in the base game).
 *
 * Deliberately dumb/presentational, same philosophy as Card itself - this
 * component doesn't know about game rules, legality, or engine types
 * directly; Board computes what's legal and passes the result down.
 */
import type { CardStats, PlayerColour, Position } from '../../engine/types';
import { Card } from '../card/Card';
import styles from './Board.module.css';

export interface BoardCardData {
  name: string;
  stats: CardStats;
  portraitPath: string;
  fallbackPortraitPath?: string;
  owner: PlayerColour;
}

export interface BoardCellProps {
  position: Position;
  card: BoardCardData | null;
  highlighted?: boolean;
  cardWidth?: number;
  onClick?: (position: Position) => void;
}

export function BoardCell({ position, card, highlighted = false, cardWidth, onClick }: BoardCellProps) {
  if (card) {
    return (
      <div className={styles.cell}>
        <Card
          name={card.name}
          stats={card.stats}
          portraitPath={card.portraitPath}
          fallbackPortraitPath={card.fallbackPortraitPath}
          owner={card.owner}
          width={cardWidth}
        />
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
    </div>
  );
}