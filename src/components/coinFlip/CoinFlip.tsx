/**
 * Animated coin flip deciding which player takes the first turn. No coin
 * artwork exists yet (the original brief flagged this as optional,
 * pending "a usable image for the coin") - rather than block on assets,
 * this uses a stylized CSS coin (circular, gold rim matching the design
 * tokens, blue/red faces) with a real 3D flip via Framer Motion. Swapping
 * in real coin face images later is a drop-in change to the two face divs
 * in the JSX below, nothing structural.
 *
 * The flip spins through several full rotations before settling on the
 * winning face, using CSS 3D transforms (perspective + backface-visibility)
 * so the "wrong" face is genuinely hidden mid-spin rather than just
 * colour-swapped.
 */
import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { PlayerColour } from '../../engine/types';
import styles from './CoinFlip.module.css';

export interface CoinFlipProps {
  onResult: (winner: PlayerColour) => void;
  /** Optional predetermined outcome (e.g. for tests); random if omitted. */
  predeterminedResult?: PlayerColour;
}

const FULL_SPINS_BEFORE_LANDING = 4;
const FLIP_DURATION_SECONDS = 1.1;

export function CoinFlip({ onResult, predeterminedResult }: CoinFlipProps) {
  const [status, setStatus] = useState<'idle' | 'flipping' | 'done'>('idle');
  const [winner, setWinner] = useState<PlayerColour | null>(null);
  const controls = useAnimation();

  async function handleFlip() {
    if (status !== 'idle') return;
    setStatus('flipping');

    const result = predeterminedResult ?? (Math.random() < 0.5 ? 'blue' : 'red');
    // Landing rotation: even multiples of 360 show the front (blue) face;
    // landing on +180 past a full spin shows the back (red) face, since
    // the back face is pre-rotated 180deg in CSS (see .back below).
    const targetRotation = FULL_SPINS_BEFORE_LANDING * 360 + (result === 'red' ? 180 : 0);

    await controls.start({
      rotateY: targetRotation,
      transition: { duration: FLIP_DURATION_SECONDS, ease: 'easeInOut' },
    });

    setWinner(result);
    setStatus('done');
    onResult(result);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.stage}>
        <motion.div className={styles.coin} animate={controls} initial={{ rotateY: 0 }}>
          <div className={`${styles.face} ${styles.front}`}>
            <span className={styles.faceLabel}>B</span>
          </div>
          <div className={`${styles.face} ${styles.back}`}>
            <span className={styles.faceLabel}>R</span>
          </div>
        </motion.div>
      </div>

      {status === 'idle' && (
        <button type="button" className={styles.flipButton} onClick={handleFlip}>
          Flip Coin
        </button>
      )}

      {status === 'flipping' && <p className={styles.status}>Flipping...</p>}

      {status === 'done' && winner && (
        <p className={styles.status}>
          {winner === 'blue' ? 'Blue' : 'Red'} goes first!
        </p>
      )}
    </div>
  );
}