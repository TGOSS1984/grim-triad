/**
 * A single animated number badge - built for Hand.tsx's own captured-card
 * count, but generic (just a number + a label), no hand/game knowledge of
 * its own.
 *
 * Two things happen together whenever `value` changes, not just a plain
 * re-render:
 *  - The DISPLAYED number tweens from the old value to the new one over
 *    CHANGE_DURATION_SECONDS, via Framer Motion's imperative `animate()`
 *    driving a motion value - a jump from 1 to 4 (a 4-card chain capture)
 *    visibly counts 1 -> 2 -> 3 -> 4 rather than snapping straight to 4,
 *    and is deliberately slower than this app's other UI transitions (see
 *    that constant's own doc) specifically so a fast multi-card swing is
 *    actually readable, not just technically visible for one frame.
 *  - The number flashes green (increase) or red (decrease) for
 *    FLASH_DURATION_MS, using a scale "pop" (via a fresh `key`, so even
 *    two same-direction changes in a row - two consecutive captures -
 *    each get their own pop rather than the second one having nothing to
 *    visibly restart) plus a colour transition back to the normal gold
 *    treatment once the flash window ends.
 *
 * If `value` changes again mid-animation (a second capture before the
 * first's tween finishes), Framer Motion's animate() naturally continues
 * from wherever the motion value currently sits rather than jumping - no
 * special handling needed for that case.
 */
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import styles from './AnimatedScoreBadge.module.css';

export interface AnimatedScoreBadgeProps {
  value: number;
  label: string;
}

/** Deliberately slower than the capture flip (0.7s) or rule callout (0.9s hold) - this needs to be legible as a COUNTING sequence, not just a single transition, so it gets the most generous duration of any animation in the app. */
const CHANGE_DURATION_SECONDS = 1.1;

/** How long the green/red flash colour lingers after the count itself has finished tweening - a beat longer than the count animation so the colour doesn't cut off right as the number lands. */
const FLASH_DURATION_MS = 1400;

export function AnimatedScoreBadge({ value, label }: AnimatedScoreBadgeProps) {
  const motionValue = useMotionValue(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [flashDirection, setFlashDirection] = useState<'up' | 'down' | null>(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value === previousValueRef.current) return;

    setFlashDirection(value > previousValueRef.current ? 'up' : 'down');
    previousValueRef.current = value;

    const controls = animate(motionValue, value, {
      duration: CHANGE_DURATION_SECONDS,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    const flashTimer = setTimeout(() => setFlashDirection(null), FLASH_DURATION_MS);

    return () => {
      controls.stop();
      clearTimeout(flashTimer);
    };
  }, [value, motionValue]);

  return (
    <div className={styles.badge}>
      <motion.span
        key={value}
        className={[
          styles.value,
          flashDirection === 'up' ? styles.valueUp : '',
          flashDirection === 'down' ? styles.valueDown : '',
        ].join(' ')}
        initial={{ scale: 1 }}
        animate={{ scale: flashDirection ? [1, 1.3, 1] : 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        {displayValue}
      </motion.span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}