/**
 * Large, brief callout banner shown just above the board the moment a
 * Same, Plus, or Chain capture fires - "it would be great for this to
 * pop up on screen so the player knows what has happened - sometimes it
 * can be quite fast and not always obvious". CardCaptureFlame already
 * gives each rule its own distinct particle effect ON the captured
 * card(s) themselves, but that reads at card scale - easy to miss,
 * especially mid-cascade with several cards flipping in quick
 * succession. This is the same information at a much larger, harder-to-
 * miss scale, positioned ABOVE the grid rather than over it deliberately:
 * covering the exact cards that just flipped with a big flash would
 * defeat the actual goal here (seeing what happened), not help it.
 *
 * Deliberately reuses CardCaptureFlame's own colour language (same =
 * cyan, plus = gold, chain/cascade = violet) rather than inventing a
 * second palette - the card-level flame and this banner should read as
 * one coordinated event, not two unrelated effects that happen to fire
 * together.
 *
 * 'chain' here means specifically the standalone Chain rule cascading a
 * plain base capture (no Same/Plus involved) - see engine/types.ts's
 * CaptureKind doc. When Same or Plus itself ALSO cascades further
 * (comboTriggered), that's still shown as "SAME!"/"PLUS!" (the
 * initiating rule takes priority - see GameScreen's
 * resolvePrimaryTriggerKind), with a smaller "Chain Reaction!" flourish
 * underneath via `comboExtended` rather than a separate, confusing second
 * banner.
 *
 * Manages its OWN visible/hidden lifecycle internally (a self-clearing
 * timer keyed off `triggerKey`) rather than expecting the parent to clear
 * `trigger` after some delay - GameScreen just always passes the latest
 * move's resolved trigger (or null) and a key that changes every move;
 * this component decides how long a banner actually stays on screen
 * before animating out on its own. `triggerKey` changing is what matters,
 * not `trigger`'s value alone - without a changing key, two consecutive
 * "SAME!" triggers in a row would look like nothing happened the second
 * time, since nothing would tell this component a NEW event occurred.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './RuleTriggerCallout.module.css';

export type RuleTriggerKind = 'same' | 'plus' | 'chain';

export interface RuleTrigger {
  kind: RuleTriggerKind;
  /** True if this trigger's own capture ALSO cascaded further (Same/Plus's built-in chain reaction) - shown as a smaller secondary line, not a second banner. Meaningless (ignored) for kind 'chain' itself, which IS the cascade. */
  comboExtended: boolean;
}

export interface RuleTriggerCalloutProps {
  /** The current move's resolved trigger, or null if this move didn't trigger Same/Plus/Chain (e.g. a plain base capture, or no capture at all). */
  trigger: RuleTrigger | null;
  /** Changes on every move (GameScreen passes game.history.length) - see file header for why this, not `trigger`'s value, is what actually drives re-triggering. */
  triggerKey: number;
}

/** How long the banner stays fully visible before animating out - deliberately generous (the whole point is "it moves too fast to notice"), on top of its own ~200ms enter/exit transitions. */
const HOLD_MS = 900;

const LABEL: Record<RuleTriggerKind, string> = {
  same: 'SAME!',
  plus: 'PLUS!',
  chain: 'CHAIN!',
};

export function RuleTriggerCallout({ trigger, triggerKey }: RuleTriggerCalloutProps) {
  const [visible, setVisible] = useState<RuleTrigger | null>(null);
  // Read via ref inside the effect below rather than listing `trigger` as
  // a dependency: GameScreen recomputes `trigger` as a fresh object every
  // render (not memoized), so depending on it directly would re-run this
  // effect - and reset the just-started hold timer - on every unrelated
  // re-render, not just once per actual move. triggerKey alone is the
  // correct re-trigger signal (see file header); the ref just gives the
  // effect access to that move's trigger VALUE without making it reactive.
  const latestTriggerRef = useRef(trigger);
  latestTriggerRef.current = trigger;

  useEffect(() => {
    const currentTrigger = latestTriggerRef.current;
    if (!currentTrigger) return;
    setVisible(currentTrigger);
    const timer = setTimeout(() => setVisible(null), HOLD_MS);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={triggerKey}
            className={[styles.banner, styles[`banner-${visible.kind}`]].join(' ')}
            initial={{ opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.92 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <span className={styles.flash} />
            <span className={styles.label}>{LABEL[visible.kind]}</span>
            {visible.comboExtended && visible.kind !== 'chain' && (
              <motion.span
                className={styles.comboLabel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: 0.15 }}
              >
                Chain Reaction!
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}