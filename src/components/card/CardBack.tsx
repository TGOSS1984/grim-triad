/**
 * Renders a face-down card: just the owner-coloured template frame with no
 * portrait, name, or stats. Used for an opponent's hand when the Open rule
 * is not active (see engine/rules/open.ts::isHandVisibleTo) - the UI layer
 * decides Card vs CardBack per-hand, this component doesn't know about
 * rules itself, keeping it a simple, dumb, reusable piece.
 */
import type { PlayerColour } from '../../engine/types';
import styles from './Card.module.css';

export interface CardBackProps {
  owner: PlayerColour;
  width?: number;
  className?: string;
}

export function CardBack({ owner, width, className }: CardBackProps) {
  const rootClassName = [styles.card, styles[`owner-${owner}`], className ?? '']
    .filter(Boolean)
    .join(' ');
  const style = width ? ({ '--card-width': `${width}px` } as React.CSSProperties) : undefined;

  return (
    <div className={rootClassName} style={style} role="img" aria-label="Face-down card">
      <img
        className={styles.frame}
        src={`/assets/cardTemplates/template-${owner}.png`}
        alt=""
        draggable={false}
      />
    </div>
  );
}