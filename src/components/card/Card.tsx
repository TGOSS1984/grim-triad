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
 * Portrait compositing: when a unit has no art yet, nothing is drawn in
 * the window - the template PNG's own painted parchment texture shows
 * through directly (portraitWindow has no background colour of its own).
 * When a portrait DOES exist, it's expected to be authored with its own
 * transparent edges/vignette (rendered with object-fit: contain, not
 * cover - see Card.module.css) so it sits on top of the parchment as its
 * own shaped artwork, with parchment still visible around it, rather than
 * being force-cropped into a hard rectangle.
 *
 * Two-tier fallback (unit portrait -> faction-level fallback silhouette,
 * matching the asset convention in ROADMAP.md Section 3:
 * assets/factions/<faction-slug>/units/_fallback.png). If both are missing
 * or fail to load, nothing is drawn - see above.
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

type PortraitStage = 'primary' | 'fallbackImage' | 'none';

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
    if (stage === 'none') {
      // Nothing to render - the template's own painted parchment shows
      // through the (backgroundless) portraitWindow beneath this.
      return null;
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
            setStage(fallbackPortraitPath ? 'fallbackImage' : 'none');
          } else {
            setStage('none');
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