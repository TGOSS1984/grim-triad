/**
 * Overlay animation layered on top of Card during a capture flip. Purely
 * decorative (aria-hidden) - Card.tsx's own accessible name/role already
 * communicates the actual ownership change; this exists to make a capture
 * FEEL like something happened, not just report that it did.
 *
 * Two-part sequence, timed entirely off its own `phase` prop
 * ('shrinking' | 'expanding') and `halfDurationSeconds` - both driven by
 * the SAME FLIP_HALF_DURATION Card.tsx already uses for its own scaleX
 * animation (see Card.tsx / state/animationTiming.ts), so this overlay
 * stays in sync with the card's physical flip without needing any
 * tighter coupling than that one shared constant:
 *
 *  1. 'shrinking' - a lit fuse burns around the card's border (an SVG
 *     ring, animated via Framer Motion's `pathLength`, which normalizes
 *     0-1 regardless of the ring's actual geometry - the standard
 *     technique for a progress-ring/fuse-style reveal), racing all the
 *     way around exactly as the card shrinks to edge-on. A dim "unlit
 *     cord" track ring sits underneath so the burnt portion reads as
 *     burnt, not just "a ring appearing out of nowhere".
 *  2. 'expanding' - the instant the fuse reaches its end (= the card's
 *     ownership has just swapped), a bright flash bursts outward along
 *     with a handful of ember particles, both fading out as the card
 *     expands back to full size. The flash is tinted toward `newOwner`'s
 *     colour, so the payoff reads as "claimed by blue/red", not just
 *     generic fire.
 *
 * Wrapped in AnimatePresence so that if `phase` changes to 'idle' (flip
 * complete) before this overlay's own forward animation has fully played
 * out, it gets a graceful exit transition instead of an abrupt cutoff.
 */
import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerColour } from '../../engine/types';
import styles from './CardCaptureFlame.module.css';

export interface CardCaptureFlameProps {
  phase: 'shrinking' | 'expanding';
  /** The owner colour the card is becoming - already swapped by the time phase is 'expanding' (see Card.tsx), so this tints the payoff flash correctly. */
  newOwner: PlayerColour;
  /** Seconds - matches Card's own FLIP_HALF_DURATION. */
  halfDurationSeconds: number;
}

/**
 * Ember burst directions, in degrees, hand-picked for a roughly even
 * spread rather than Math.random() - keeps rendering pure/predictable
 * (this component can re-render mid-animation) and avoids embers ever
 * clumping together by chance.
 */
const EMBER_ANGLES_DEG = [-150, -105, -55, -10, 35, 85, 140];
const EMBER_TRAVEL_PX = 60;

export function CardCaptureFlame({ phase, newOwner, halfDurationSeconds }: CardCaptureFlameProps) {
  // SVG ids must be unique in the document, and multiple cards can be
  // mid-flip at once during a combo capture - each instance needs its
  // own gradient def, not a shared hardcoded id.
  const gradientId = useId();

  return (
    <div className={styles.overlay} aria-hidden="true">
      {phase === 'shrinking' && (
        <svg className={styles.fuseRing} viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff2c2" />
              <stop offset="35%" stopColor="#ffb347" />
              <stop offset="100%" stopColor="#ff4d1c" />
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
            style={{ stroke: `url(#${gradientId})` }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: halfDurationSeconds, ease: 'easeIn' }}
          />
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
            transition={{ duration: halfDurationSeconds * 1.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'expanding' &&
          EMBER_ANGLES_DEG.map((angleDeg, i) => {
            const radians = (angleDeg * Math.PI) / 180;
            return (
              <motion.div
                key={`ember-${angleDeg}`}
                className={styles.ember}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(radians) * EMBER_TRAVEL_PX,
                  // Slight upward bias (- extra) on top of the radial spread - embers drift up like real ones, not just outward.
                  y: Math.sin(radians) * EMBER_TRAVEL_PX - 16,
                  opacity: 0,
                  scale: 0.2,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: halfDurationSeconds * 1.3,
                  ease: 'easeOut',
                  delay: i * 0.02,
                }}
              />
            );
          })}
      </AnimatePresence>
    </div>
  );
}