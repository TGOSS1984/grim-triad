/**
 * Full-attention "New Unit Unlocked!" reveal, shown the moment a match
 * (in ANY mode - see App.tsx) causes one or more units to cross from
 * locked to unlocked (data/unlockCriteria.ts's getNewlyUnlockedBatches).
 * Confirmed as a full-attention moment, same treatment as
 * CampaignVictoryModal, not a lighter dismissible toast - this is meant
 * to feel like a genuine payoff, not a notification to skim past.
 *
 * ONE REVEAL PER TIER, NOT PER UNIT - a real design call worth being
 * explicit about: a single threshold crossing can unlock an ENTIRE
 * TIER's worth of units at once (up to 34, at the 200-250 tier - see
 * unlockCriteria.ts's own header for the real distribution). Showing 34
 * consecutive full-screen reveals after one win would be exhausting, the
 * opposite of premium. So this shows the single most impressive unit in
 * that tier (getNewlyUnlockedBatches already sorts each batch most-
 * expensive-first) as the big hero card, with the rest summarized as a
 * count - "and 33 more units" - rather than paraded one at a time. If
 * multiple TIERS unlock in the same match (rare, but possible - see that
 * function's own test coverage), App.tsx queues one reveal per tier in
 * ascending order, dismissing into the next rather than stacking them.
 *
 * Reuses the exact same "big card" building blocks UnitPicker's Lightbox
 * preview already uses (Card + useResponsiveLightboxCardWidth) rather
 * than a bespoke sizing calculation - this should feel like the SAME
 * "look closely at a card" moment the player already knows from browsing
 * the army builder, just with achievement-pop chrome wrapped around it,
 * not a visually unrelated third way of showing a big card.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Unit } from '../../data/schema';
import type { UnlockTier } from '../../data/unlockCriteria';
import { Card } from '../card/Card';
import { useResponsiveLightboxCardWidth } from '../armyBuilder/useResponsiveLightboxCardWidth';
import styles from './CardUnlockReveal.module.css';

export interface CardUnlockRevealProps {
  tier: UnlockTier;
  /** This batch's units, most expensive first (see getNewlyUnlockedBatches) - units[0] is shown as the big hero card. */
  units: Unit[];
  onDismiss: () => void;
}

export function CardUnlockReveal({ tier, units, onDismiss }: CardUnlockRevealProps) {
  const cardWidth = useResponsiveLightboxCardWidth();
  const [heroUnit, ...rest] = units;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return createPortal(
    <div className={styles.backdrop} onClick={onDismiss} role="presentation">
      <motion.div
        className={styles.frame}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-unlock-title"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <button type="button" className={styles.closeButton} onClick={onDismiss} aria-label="Dismiss">
          &times;
        </button>

        <span className={styles.eyebrow}>Achievement Unlocked</span>
        <h2 id="card-unlock-title" className={styles.title}>
          {units.length > 1 ? 'New Units Unlocked!' : 'New Unit Unlocked!'}
        </h2>
        <p className={styles.subtitle}>{tier.description}</p>

        <motion.div
          className={styles.heroCardWrap}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        >
          <span className={styles.glow} aria-hidden="true" />
          <Card
            name={heroUnit.name}
            stats={heroUnit.stats}
            portraitPath={heroUnit.portraitPath}
            owner="blue"
            width={cardWidth}
            element={heroUnit.element}
            keywords={heroUnit.keywords}
          />
        </motion.div>

        <p className={styles.heroName}>{heroUnit.name}</p>
        <p className={styles.tierLabel}>{tier.label}</p>

        {rest.length > 0 && (
          <p className={styles.moreCount}>
            + {rest.length} more unit{rest.length === 1 ? '' : 's'} unlocked in this tier
          </p>
        )}

        <button type="button" className={styles.continueButton} onClick={onDismiss}>
          Continue
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}