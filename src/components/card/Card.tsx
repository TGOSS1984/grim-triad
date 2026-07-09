/**
 * Renders a single game card: the owner-coloured template frame (see
 * ROADMAP.md Section 3.1 for how the two template PNGs were measured and
 * why compositing works this way) with the unit's portrait layered inside
 * the frame's parchment window, the unit name in the header plate, and the
 * four directional stat numbers as badges along the window's edges.
 *
 * Deliberately decoupled from both the engine's Card type and the data
 * pipeline's Unit type - it takes exactly the primitive props it needs
 * (name, stats, portraitPath, owner) rather than importing either shape
 * directly. This keeps Card reusable anywhere a card needs rendering
 * (hand, board, army builder preview) regardless of which layer is calling
 * it, and the caller (Board/Hand/ArmyBuilder) is responsible for pulling
 * those fields out of whatever combination of engine Card + Unit it has.
 *
 * Portrait fallback: if the unit's portraitPath 404s (no art authored yet,
 * expected for most units in early development - see ROADMAP.md Section
 * 4/9 on the fallback convention), this swaps to a plain text placeholder
 * showing the unit's name rather than a broken image icon. A dedicated
 * fallback silhouette image is a natural follow-up once one exists.
 */
import { useState } from 'react';
import type { CardStats, PlayerColour } from '../../engine/types';
import styles from './Card.module.css';

export interface CardProps {
  name: string;
  stats: CardStats;
  /** Root-relative path, e.g. "assets/factions/blood-angels/units/commander-dante.png" */
  portraitPath: string;
  owner: PlayerColour;
  /** Card width in px; height follows the template's fixed aspect ratio. Defaults to 140px. */
  width?: number;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

function toPublicPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Renders a stat value as "A" for 10 (highest rank), or the digit otherwise. */
function displayStat(value: number): string {
  return value >= 10 ? 'A' : String(value);
}

export function Card({
  name,
  stats,
  portraitPath,
  owner,
  width,
  selected = false,
  interactive = false,
  onClick,
  className,
}: CardProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);

  const rootClassName = [
    styles.card,
    styles[`owner-${owner}`],
    interactive ? styles.interactive : '',
    selected ? styles.selected : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = width ? ({ '--card-width': `${width}px` } as React.CSSProperties) : undefined;

  const content = (
    <>
      <img
        className={styles.frame}
        src={`/assets/cardTemplates/template-${owner}.png`}
        alt=""
        draggable={false}
      />
      <div className={styles.portraitWindow}>
        {portraitFailed ? (
          <div className={styles.portraitFallback}>{name}</div>
        ) : (
          <img
            className={styles.portrait}
            src={toPublicPath(portraitPath)}
            alt=""
            data-testid="card-portrait"
            draggable={false}
            onError={() => setPortraitFailed(true)}
          />
        )}
      </div>
      <div className={styles.name}>{name}</div>
      <div className={`${styles.stat} ${styles.statTop}`}>{displayStat(stats.top)}</div>
      <div className={`${styles.stat} ${styles.statBottom}`}>{displayStat(stats.bottom)}</div>
      <div className={`${styles.stat} ${styles.statLeft}`}>{displayStat(stats.left)}</div>
      <div className={`${styles.stat} ${styles.statRight}`}>{displayStat(stats.right)}</div>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={rootClassName}
        style={style}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${name}: top ${stats.top}, bottom ${stats.bottom}, left ${stats.left}, right ${stats.right}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={rootClassName} style={style} role="img" aria-label={name}>
      {content}
    </div>
  );
}