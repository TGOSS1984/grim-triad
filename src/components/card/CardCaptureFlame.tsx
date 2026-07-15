/**
 * Overlay animation layered on top of Card during a capture flip. Purely
 * decorative (aria-hidden) - Card.tsx's own accessible name/role already
 * communicates the actual ownership change; this exists to make a capture
 * FEEL like something happened, not just report that it did.
 *
 * Four distinct visual "tells", one per CaptureKind (see engine/types.ts),
 * not one effect with a recolor - each rule gets a motion signature that
 * actually reads as different, not just a different palette on the same
 * animation:
 *  - 'base' (the plain flanking capture every match has): the original
 *    fire/ember effect - a lit fuse ring burns around the border during
 *    the shrink half, then a warm flash + radiating embers on expand.
 *    This is the default/familiar look, unchanged.
 *  - 'same': a cyan "resonance" ring during shrink (matching values
 *    syncing up), then on expand a cyan flash with 2-3 concentric PULSE
 *    RINGS expanding outward - like a sonar ping, not embers, since
 *    "matching" is about synchronization, not combustion.
 *  - 'plus': a gold ring during shrink, then on expand particles that
 *    briefly draw INWARD before bursting back out (a real keyframe
 *    motion, not just a recolored ember) - representing several values
 *    converging on one sum before the release. Fewer, larger particles
 *    than base's ember spread.
 *  - 'cascade': NOT a rule of its own (see CaptureKind's doc) - a card
 *    swept up as a SECONDARY reaction to Same/Plus/Chain's cascade.
 *    Reuses base's ember mechanic (this is still fundamentally a
 *    flanking capture, just triggered by an already-flipped neighbor
 *    rather than the original placement) but violet-tinted, with a
 *    dashed/jagged ring and a faster duration multiplier - it should
 *    read as a quick secondary zap, not a second full-weight event.
 *
 * Two-part sequence per kind, still timed off `phase`
 * ('shrinking' | 'expanding') and `halfDurationSeconds` (scaled per-kind
 * by durationMultiplier below) - same overall shrink/expand structure as
 * before, just parametrized instead of hardcoded, so the underlying
 * Card.tsx flip choreography didn't need to change at all.
 */
import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CaptureKind, PlayerColour } from '../../engine/types';
import styles from './CardCaptureFlame.module.css';

export interface CardCaptureFlameProps {
  phase: 'shrinking' | 'expanding';
  /** The owner colour the card is becoming - already swapped by the time phase is 'expanding' (see Card.tsx), so this tints the payoff flash correctly. */
  newOwner: PlayerColour;
  /** Seconds - matches Card's own FLIP_HALF_DURATION (scaled by the active theme's durationMultiplier below). */
  halfDurationSeconds: number;
  /** Which rule captured this card - selects the visual theme. Defaults to 'base' if omitted. */
  captureKind?: CaptureKind;
}

interface GradientStop {
  offset: string;
  color: string;
}

interface FlameTheme {
  ringGradientStops: GradientStop[];
  ringGlowFilter: string;
  ringDashed?: boolean;
  /** Applied to halfDurationSeconds - 1 for the normal pace, <1 for a snappier secondary reaction (cascade). */
  durationMultiplier: number;
  particleStyle: 'ember' | 'pulseRing' | 'convergingSpark';
  particleAngles: number[];
  particleTravelPx: number;
  particleGradient?: string;
}

/**
 * Ember burst directions, in degrees, hand-picked for a roughly even
 * spread rather than Math.random() - keeps rendering pure/predictable
 * (this component can re-render mid-animation) and avoids embers ever
 * clumping together by chance.
 */
const BASE_EMBER_ANGLES_DEG = [-150, -105, -55, -10, 35, 85, 140];
const CASCADE_EMBER_ANGLES_DEG = [-140, -50, 40, 130]; // fewer - a quicker, smaller reaction
const PLUS_SPARK_ANGLES_DEG = [-90, -18, 54, 126, 198]; // 5-point spread, evenly spaced

const THEMES: Record<CaptureKind, FlameTheme> = {
  base: {
    ringGradientStops: [
      { offset: '0%', color: '#fff2c2' },
      { offset: '35%', color: '#ffb347' },
      { offset: '100%', color: '#ff4d1c' },
    ],
    ringGlowFilter: 'drop-shadow(0 0 3px #ffb347) drop-shadow(0 0 7px #ff4d1c)',
    durationMultiplier: 1,
    particleStyle: 'ember',
    particleAngles: BASE_EMBER_ANGLES_DEG,
    particleTravelPx: 60,
  },
  same: {
    ringGradientStops: [
      { offset: '0%', color: '#e8feff' },
      { offset: '35%', color: '#7fe0ff' },
      { offset: '100%', color: '#1c9bff' },
    ],
    ringGlowFilter: 'drop-shadow(0 0 3px #7fe0ff) drop-shadow(0 0 7px #1c9bff)',
    durationMultiplier: 1,
    particleStyle: 'pulseRing',
    particleAngles: [], // pulse rings don't radiate at angles - concentric instead
    particleTravelPx: 0,
  },
  plus: {
    ringGradientStops: [
      { offset: '0%', color: '#fff9e0' },
      { offset: '35%', color: '#ffd35c' },
      { offset: '100%', color: '#c98a1c' },
    ],
    ringGlowFilter: 'drop-shadow(0 0 3px #ffd35c) drop-shadow(0 0 7px #c98a1c)',
    durationMultiplier: 1,
    particleStyle: 'convergingSpark',
    particleAngles: PLUS_SPARK_ANGLES_DEG,
    particleTravelPx: 55,
  },
  cascade: {
    ringGradientStops: [
      { offset: '0%', color: '#f3e0ff' },
      { offset: '35%', color: '#b967ff' },
      { offset: '100%', color: '#6a1cad' },
    ],
    ringGlowFilter: 'drop-shadow(0 0 3px #b967ff) drop-shadow(0 0 6px #6a1cad)',
    ringDashed: true,
    durationMultiplier: 0.65,
    particleStyle: 'ember',
    particleAngles: CASCADE_EMBER_ANGLES_DEG,
    particleTravelPx: 45,
    particleGradient: 'radial-gradient(circle, #f3e0ff 0%, #b967ff 40%, #6a1cad 80%, transparent 100%)',
  },
};

export function CardCaptureFlame({
  phase,
  newOwner,
  halfDurationSeconds,
  captureKind = 'base',
}: CardCaptureFlameProps) {
  // SVG ids must be unique in the document, and multiple cards can be
  // mid-flip at once during a combo capture - each instance needs its
  // own gradient def, not a shared hardcoded id.
  const gradientId = useId();
  const theme = THEMES[captureKind];
  const duration = halfDurationSeconds * theme.durationMultiplier;

  return (
    <div className={styles.overlay} aria-hidden="true">
      {phase === 'shrinking' && (
        <svg className={styles.fuseRing} viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {theme.ringGradientStops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          <circle className={styles.fuseTrack} cx="50" cy="50" r="47" fill="none" strokeWidth="3" />
          <motion.circle
            className={styles.fuseBurn}
            cx="50"
            cy="50"
            r="47"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ stroke: `url(#${gradientId})`, filter: theme.ringGlowFilter }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration, ease: 'easeIn' }}
          />
          {theme.ringDashed && (
            // A separate, independently-drawn dashed ring for cascade's
            // "jagged zap" texture - deliberately NOT applied to the
            // circle above: Framer Motion's pathLength animation drives
            // stroke-dasharray internally to reveal the path
            // progressively, so a custom strokeDasharray on that SAME
            // element gets silently overridden by Framer's own value the
            // instant the animation starts (confirmed by inspecting the
            // rendered output - the prop never actually took effect).
            // This ring is fully static (no pathLength animation at all),
            // so nothing overrides its dasharray.
            <circle
              className={styles.fuseDashOverlay}
              cx="50"
              cy="50"
              r="47"
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
          )}
        </svg>
      )}

      <AnimatePresence>
        {phase === 'expanding' && (
          <motion.div
            key="flash"
            className={`${styles.flash} ${styles[`flash-${newOwner}`]}`}
            initial={{ opacity: 0.95, scale: 0.3 }}
            animate={{ opacity: 0, scale: 2.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration * 1.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'expanding' && theme.particleStyle === 'ember' && (
          <>
            {theme.particleAngles.map((angleDeg, i) => {
              const radians = (angleDeg * Math.PI) / 180;
              return (
                <motion.div
                  key={`ember-${angleDeg}`}
                  className={styles.ember}
                  style={theme.particleGradient ? { background: theme.particleGradient } : undefined}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(radians) * theme.particleTravelPx,
                    // Slight upward bias (- extra) on top of the radial spread - embers drift up like real ones, not just outward.
                    y: Math.sin(radians) * theme.particleTravelPx - 16,
                    opacity: 0,
                    scale: 0.2,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: duration * 1.3,
                    ease: 'easeOut',
                    delay: i * 0.02,
                  }}
                />
              );
            })}
          </>
        )}

        {phase === 'expanding' && theme.particleStyle === 'pulseRing' && (
          <>
            {[0, 1, 2].map((ringIndex) => (
              <motion.div
                key={`pulse-${ringIndex}`}
                className={styles.pulseRing}
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 2.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: duration * 1.4,
                  ease: 'easeOut',
                  delay: ringIndex * 0.12,
                }}
              />
            ))}
          </>
        )}

        {phase === 'expanding' && theme.particleStyle === 'convergingSpark' && (
          <>
            {theme.particleAngles.map((angleDeg, i) => {
              const radians = (angleDeg * Math.PI) / 180;
              const outX = Math.cos(radians) * theme.particleTravelPx;
              const outY = Math.sin(radians) * theme.particleTravelPx;
              // Keyframe array (not just initial->animate): each spark
              // starts OUTSIDE, is briefly drawn IN toward the center
              // (the "converging" part), then bursts back OUT - a real
              // motion signature, not just a recolored ember.
              return (
                <motion.div
                  key={`spark-${angleDeg}`}
                  className={styles.spark}
                  initial={{ x: outX, y: outY, opacity: 0, scale: 0.6 }}
                  animate={{
                    x: [outX, outX * 0.15, outX * 1.1],
                    y: [outY, outY * 0.15, outY * 1.1],
                    opacity: [0, 1, 0],
                    scale: [0.6, 1.1, 0.3],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: duration * 1.5,
                    ease: 'easeInOut',
                    delay: i * 0.015,
                    times: [0, 0.4, 1],
                  }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}