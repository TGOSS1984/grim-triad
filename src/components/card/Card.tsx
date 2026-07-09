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
 * Three-tier portrait fallback, matching the asset convention in
 * ROADMAP.md Section 3 (assets/factions/<faction-slug>/units/_fallback.png):
 *   1. The unit's own portraitPath.
 *   2. If that fails to load and a fallbackPortraitPath is provided (a
 *      faction-level generic silhouette), try that instead.
 *   3. If that also fails, or no fallback was provided, show a plain text
 *      placeholder with the unit's name rather than a broken image icon.
 * No fallback silhouette art exists yet at the time of writing, but the
 * component is ready for it - passing fallbackPortraitPath just works,
 * with zero further changes needed once real fallback art is authored.
 */
import { useEffect, useState } from 'react';
import type { CardStats, PlayerColour } from '../../engine/types';
import styles from './Card.module.css';

export interface CardProps {
  name: string;
  stats: CardStats;
  /** Root-relative path, e.g. "assets/factions/blood-angels/units/commander-dante.png" */
  portraitPath: string;
  /** Root-relative path to a faction-level generic fallback silhouette, if one exists. */
  fallbackPortraitPath?: string;
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

type PortraitStage = 'primary' | 'fallbackImage' | 'text';

export function Card({
  name,
  stats,
  portraitPath,
  fallbackPortraitPath,
  owner,
  width,
  selected = false,
  interactive = false,
  onClick,
  className,
}: CardProps) {
  const [stage, setStage] = useState<PortraitStage>('primary');

  // Reset to the primary image whenever the underlying unit's art paths
  // change, so a reused/re-rendered Card (rather than a fresh remount)
  // never gets stuck showing a stale fallback from a previously-displayed
  // unit that lacked art.
  useEffect(() => {
    setStage('primary');
  }, [portraitPath, fallbackPortraitPath]);

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

  function renderPortraitContent() {
    if (stage === 'text') {
      return <div className={styles.portraitFallback}>{name}</div>;
    }

    const src =
      stage === 'fallbackImage' && fallbackPortraitPath
        ? toPublicPath(fallbackPortraitPath)
        : toPublicPath(portraitPath);

    return (
      <img
        className={styles.portrait}
        src={src}
        alt=""
        data-testid="card-portrait"
        draggable={false}
        onError={() => {
          if (stage === 'primary') {
            setStage(fallbackPortraitPath ? 'fallbackImage' : 'text');
          } else {
            setStage('text');
          }
        }}
      />
    );
  }

  const content = (
    <>
      <img
        className={styles.frame}
        src={`/assets/cardTemplates/template-${owner}.png`}
        alt=""
        draggable={false}
      />
      <div className={styles.portraitWindow}>{renderPortraitContent()}</div>
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