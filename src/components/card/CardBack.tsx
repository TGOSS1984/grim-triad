/**
 * Renders a face-down card: a dedicated back-of-card design (not the front
 * template with the portrait/stats hidden), with the owning faction's logo
 * centered on it. Used for an opponent's hand when the Open rule is not
 * active (see engine/rules/open.ts::isHandVisibleTo) - the UI layer
 * decides Card vs CardBack per-hand, this component doesn't know about
 * rules itself, keeping it a simple, dumb, reusable piece.
 *
 * Uses its own CSS module (CardBack.module.css) rather than sharing
 * Card.module.css - the back's layout (full-bleed back image + a centered
 * logo) is simpler and conceptually separate from the front's portrait
 * window/stat-badge layout, so sharing styles would mean carrying a lot of
 * front-specific CSS that has no meaning here.
 */
import type { PlayerColour } from '../../engine/types';
import { FactionIcon } from '../common/FactionIcon';
import { publicAssetPath } from '../../utils/publicAssetPath';
import styles from './CardBack.module.css';

export interface CardBackProps {
  owner: PlayerColour;
  /** The owning faction's icon slug (e.g. "blood-angels"), shown centered on the back. Omit to show no logo. */
  factionSlug?: string;
  width?: number;
  className?: string;
}

export function CardBack({ owner, factionSlug, width, className }: CardBackProps) {
  const rootClassName = [styles.cardBack, className ?? ''].filter(Boolean).join(' ');
  const style = width ? ({ '--card-width': `${width}px` } as React.CSSProperties) : undefined;

  return (
    <div className={rootClassName} style={style} role="img" aria-label="Face-down card">
      <img
        className={styles.backImage}
        src={publicAssetPath(`assets/cardTemplates/back-${owner}.png`)}
        alt=""
        draggable={false}
      />
      {factionSlug && <FactionIcon slug={factionSlug} className={styles.logo} />}
    </div>
  );
}