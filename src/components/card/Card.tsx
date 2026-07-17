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
 *
 * Animation (Framer Motion):
 *  - Placement: passing a `layoutId` (the card's unique instanceId) makes
 *    this card participate in Framer Motion's automatic shared-layout
 *    animation - when the SAME layoutId is rendered in a different place
 *    in the tree on a later render (e.g. a card moving from Hand's DOM
 *    subtree into Board's), Framer Motion animates the transition between
 *    the two positions/sizes automatically, producing the "card flies
 *    from hand to board" effect. Hand and Board are responsible for
 *    passing the engine's card.instanceId through as layoutId so the
 *    identity actually matches across both contexts.
 *  - Capture flip: when the `owner` prop changes on an already-mounted
 *    Card (a capture flipping this card to the other player), it animates
 *    a flip rather than snapping instantly - scaleX shrinks the card to
 *    edge-on, the owner-dependent visuals (template colour/glow) swap at
 *    that midpoint, then it expands back out. This reads as "the card
 *    flipping over" without needing true 3D perspective plumbing from
 *    whatever parent happens to render it.
 *  - `flipDelayMs`: when a single move captures multiple cards (a Same/
 *    Plus combo chain), passing an increasing delay per card (see
 *    GameScreen, which reads GameState.lastCapture to compute these) lets
 *    them flip one after another instead of all at the exact same instant
 *    - much easier to actually see what happened, especially for a long
 *    chain.
 *
 * Element badge: shows the card's own Elemental affinity (see
 * src/data/elements.ts) as a small icon in the top-left corner, when the
 * `element` prop is given. Every unit has an element regardless of
 * whether the Elemental rule is active this match, so callers (GameScreen)
 * are responsible for only passing this prop when ruleSet.elemental is
 * actually on - otherwise it'd be a confusing icon that does nothing.
 * This is what actually closes the loop the board terrain badges opened:
 * without seeing a card's own element, there was no way to tell in
 * advance whether placing it on an elemental tile would help or hurt.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { CardStats, CaptureKind, PlayerColour } from '../../engine/types';
import type { ElementId } from '../../data/elements';
import { CAPTURE_FLIP_DURATION_MS } from '../../state/animationTiming';
import { ElementIcon } from '../common/ElementIcon';
import { CardCaptureFlame } from './CardCaptureFlame';
import styles from './Card.module.css';

const ELEMENT_LABELS: Record<ElementId, string> = {
  warp: 'Warp',
  promethium: 'Promethium',
  void: 'Void',
  toxic: 'Toxic',
  radiation: 'Radiation',
};

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
  /** Unique per-card-instance id enabling the hand-to-board flying placement animation. */
  layoutId?: string;
  /** Delay (ms) before this card's capture flip animation starts - staggers multi-card combo captures. */
  flipDelayMs?: number;
  /** Which rule captured this card in the most recent move, if any - gives each rule its own visual "tell" during the flip (see CardCaptureFlame.tsx). Undefined (or omitted) means the plain default flame - either this card wasn't just captured, or captureKind info isn't available in this context. */
  captureKind?: CaptureKind;
  /** This card's Elemental affinity - only pass when the Elemental rule is active this match (see file header). */
  element?: ElementId;
  /** The unit's keyword tags (e.g. "Infantry", "Epic Hero") - currently only used to pick the Epic Hero template variant below, but kept as the general catalog keyword list rather than a single isEpicHero boolean, so future keyword-driven visual treatments don't need their own separate prop. */
  keywords?: string[];
}

function toPublicPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Renders a stat value as "A" for 10 (highest rank), or the digit otherwise. */
function displayStat(value: number): string {
  return value >= 10 ? 'A' : String(value);
}

type PortraitStage = 'primary' | 'fallbackImage' | 'none';

/**
 * Half the total flip duration (shrink-to-edge-on, then expand back out),
 * in seconds for Framer Motion. Derived from the shared
 * CAPTURE_FLIP_DURATION_MS constant (see state/animationTiming.ts) rather
 * than its own hardcoded value, so this and gameStore's AI-turn delay
 * calculation can never silently drift apart from each other.
 */
const FLIP_HALF_DURATION = CAPTURE_FLIP_DURATION_MS / 2 / 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  layoutId,
  flipDelayMs = 0,
  captureKind,
  element,
  keywords,
}: CardProps) {
  const [stage, setStage] = useState<PortraitStage>('primary');

  // Epic Hero units get a distinct template frame (see the two new
  // assets in public/assets/cardTemplates/) so the game's named/unique
  // characters visually stand out from the generic roster at a glance,
  // independent of whichever optional rules (e.g. Heroic) happen to be
  // active this match - this is purely a visual "these are the big
  // names" cue, not tied to any rule being on.
  const isEpicHero = keywords?.includes('Epic Hero') ?? false;

  // Reset to the primary image whenever the underlying unit's art paths
  // change, so a reused/re-rendered Card (rather than a fresh remount)
  // never gets stuck showing a stale fallback from a previously-displayed
  // unit that lacked art.
  useEffect(() => {
    setStage('primary');
  }, [portraitPath, fallbackPortraitPath]);

  // Capture-flip animation: `displayOwner` is what's actually rendered
  // (template colour, glow), and only updates at the midpoint of the flip
  // - the `owner` prop itself may already have changed, but we don't want
  // the colour to snap instantly, we want it to swap while the card is
  // edge-on (scaleX near 0) so it reads as a physical flip.
  const [displayOwner, setDisplayOwner] = useState(owner);
  // Mirrors displayOwner for the effect's own guard check below, WITHOUT
  // being a dependency of that effect - see the comment on the effect
  // itself for why that distinction matters.
  const displayOwnerRef = useRef(owner);
  // Drives the flame/fuse overlay (CardCaptureFlame) - 'idle' renders
  // nothing. Tracked separately from displayOwner/flipControls because
  // the overlay needs to render DIFFERENT visuals for the shrink half
  // (a burning fuse) vs. the expand half (the payoff flash + embers),
  // not just "is a flip happening".
  const [flipPhase, setFlipPhase] = useState<'idle' | 'shrinking' | 'expanding'>('idle');
  const flipControls = useAnimation();

  // IMPORTANT: displayOwner is deliberately NOT a dependency here, even
  // though the effect reads it (via the ref) and writes it. If it WERE a
  // dependency, calling setDisplayOwner below would itself cause this
  // effect to re-run (React re-runs an effect whenever a value in its
  // dependency array changes, including ones the effect just set) - which
  // runs this SAME invocation's cleanup and sets `cancelled = true` out
  // from under it, silently skipping everything after that point in the
  // still-running async IIFE. That's a real bug this project hit: the
  // final `setFlipPhase('idle')` below was being skipped every time,
  // leaving the flame overlay mounted forever after a flip completed.
  useEffect(() => {
    if (owner === displayOwnerRef.current) return;
    let cancelled = false;

    (async () => {
      if (flipDelayMs > 0) {
        await delay(flipDelayMs);
        if (cancelled) return;
      }

      setFlipPhase('shrinking');
      await flipControls.start({
        scaleX: 0,
        transition: { duration: FLIP_HALF_DURATION, ease: 'easeIn' },
      });
      if (cancelled) return;
      displayOwnerRef.current = owner;
      setDisplayOwner(owner);
      setFlipPhase('expanding');
      await flipControls.start({
        scaleX: 1,
        transition: { duration: FLIP_HALF_DURATION, ease: 'easeOut' },
      });
      if (cancelled) return;
      setFlipPhase('idle');
    })();

    return () => {
      cancelled = true;
    };
  }, [owner, flipControls, flipDelayMs]);

  const rootClassName = [
    styles.card,
    styles[`owner-${displayOwner}`],
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
        src={`/assets/cardTemplates/template-${displayOwner}${isEpicHero ? '-epic' : ''}.png`}
        alt=""
        draggable={false}
      />
      <div className={styles.portraitWindow}>{renderPortraitContent()}</div>
      <div className={styles.name}>{name}</div>
      {element && (
        <div className={styles.elementBadge}>
          <ElementIcon element={element} title={`${ELEMENT_LABELS[element]} affinity`} />
        </div>
      )}
      <div className={`${styles.stat} ${styles.statTop}`}>{displayStat(stats.top)}</div>
      <div className={`${styles.stat} ${styles.statBottom}`}>{displayStat(stats.bottom)}</div>
      <div className={`${styles.stat} ${styles.statLeft}`}>{displayStat(stats.left)}</div>
      <div className={`${styles.stat} ${styles.statRight}`}>{displayStat(stats.right)}</div>
      {flipPhase !== 'idle' && (
        <CardCaptureFlame
          phase={flipPhase}
          newOwner={displayOwner}
          halfDurationSeconds={FLIP_HALF_DURATION}
          captureKind={captureKind ?? 'base'}
        />
      )}
    </>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        layout
        layoutId={layoutId}
        animate={flipControls}
        className={rootClassName}
        style={style}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${name}: top ${stats.top}, bottom ${stats.bottom}, left ${stats.left}, right ${stats.right}`}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      layoutId={layoutId}
      animate={flipControls}
      className={rootClassName}
      style={style}
      role="img"
      aria-label={name}
    >
      {content}
    </motion.div>
  );
}