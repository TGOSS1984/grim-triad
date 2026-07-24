/**
 * Celebratory modal shown the MOMENT campaign mode reaches one of its two
 * milestone moments (see campaignStore's hasCompletedCollection and
 * hasVanquishedRival - the caller, CampaignResultScreen, is responsible
 * for detecting the false -> true transition on EITHER and only
 * rendering this on that transition, not on every subsequent render
 * while still true). One shared component for both rather than two
 * near-identical ones - same layout, same confirm-before-wiping-progress
 * behavior, same portal/dismiss conventions; only the copy and the
 * third action button differ, both driven entirely by props so this
 * component has no idea which milestone it's even showing.
 *
 * Three real choices in every case, matching the confirmed design:
 *   - Start New Campaign: wipes the current run for a fresh one. Gets its
 *     own inline two-step confirm, same wording/pattern as
 *     CampaignHomeScreen's own "Start New Run" - this is genuinely
 *     destructive (discards a just-reached milestone) and deserves the
 *     same guard rail that screen already gives a much less consequential
 *     version of the same action.
 *   - Return to Title: leaves campaign mode entirely. Does NOT touch any
 *     campaignStore state - progress is still saved, still there,
 *     whenever the player comes back.
 *   - The third action depends on WHICH milestone this is, via
 *     `onReinforce` being given or not:
 *       - Collection Complete (`onReinforce` omitted): "Keep Playing" -
 *         dismisses the modal, same as backdrop-click or Escape (see
 *         Lightbox.tsx for the same three-way dismiss convention this
 *         mirrors). The collection stays exactly as-is and
 *         CampaignResultScreen's ordinary Continue button underneath is
 *         unaffected - nothing stops further play, there's just no more
 *         collection progress left to chase.
 *       - Rival Vanquished (`onReinforce` given): "Continue with AI
 *         Reinforcements" - refills the AI's pool (campaignStore's
 *         reinforceRival) and dismisses. Plain "Keep Playing" wouldn't
 *         actually work here the way it does for Collection Complete: an
 *         AI pool below CAMPAIGN_MIN_HAND_SIZE can't field another match
 *         at all (see campaignRivalMatchSetup.ts), so simply dismissing
 *         without reinforcing would leave the player stuck - the close
 *         button/Escape/backdrop-click still dismiss without reinforcing
 *         though (same conventions as always), CampaignHomeScreen has its
 *         own defensive "Continue Campaign" guard + its own Reinforce
 *         entry point for that case, same "shouldn't normally be reached
 *         but isn't a crash if it is" backstop pattern used elsewhere in
 *         this codebase (e.g. ArmyBuilder's roster-validation backstop).
 *
 * Portalled to document.body, same reasoning as Lightbox: this can be
 * triggered from CampaignResultScreen, which itself isn't inside any
 * particular scroll/overflow container, but portalling keeps it
 * consistent with the app's one other modal-like component rather than
 * relying on that not mattering here too.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CampaignVictoryModal.module.css';

export interface CampaignVictoryModalProps {
  /** Heading text - e.g. "Collection Complete!" or "Rival Vanquished!". Fully caller-supplied; this component has no built-in copy for either milestone. */
  title: string;
  /** One-line supporting detail below the title - e.g. real progress numbers or a short flavour line. */
  subtitle: string;
  /** The relevant achievement's display name (see achievements.ts) - passed in rather than imported/looked-up here, keeping this component pure presentation. */
  achievementName: string;
  achievementDescription: string;
  onStartNewRun: () => void;
  onReturnToTitle: () => void;
  onDismiss: () => void;
  /** When given, the third action button becomes "Continue with AI Reinforcements" instead of "Keep Playing" - see file header. Omit for the Collection Complete milestone; pass campaignStore's reinforceRival (wrapped to also dismiss) for Rival Vanquished. */
  onReinforce?: () => void;
}

export function CampaignVictoryModal({
  title,
  subtitle,
  achievementName,
  achievementDescription,
  onStartNewRun,
  onReturnToTitle,
  onDismiss,
  onReinforce,
}: CampaignVictoryModalProps) {
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return createPortal(
    <div className={styles.backdrop} onClick={onDismiss} role="presentation">
      <div
        className={styles.frame}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-victory-title"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>

        <h2 id="campaign-victory-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.subtitle}>{subtitle}</p>

        <div className={styles.achievementBadge}>
          <span className={styles.achievementLabel}>Achievement Unlocked</span>
          <span className={styles.achievementName}>{achievementName}</span>
          <span className={styles.achievementDescription}>{achievementDescription}</span>
        </div>

        <div className={styles.actions}>
          {confirmingNewRun ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>
                This will permanently discard your current collection and record.
              </span>
              <button type="button" className={styles.confirmButton} onClick={onStartNewRun}>
                Yes, Start Over
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setConfirmingNewRun(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={styles.newRunButton}
                onClick={() => setConfirmingNewRun(true)}
              >
                Start New Campaign
              </button>
              <button type="button" className={styles.titleButton} onClick={onReturnToTitle}>
                Return to Title
              </button>
              {onReinforce ? (
                <button type="button" className={styles.keepPlayingButton} onClick={onReinforce}>
                  Continue with AI Reinforcements
                </button>
              ) : (
                <button type="button" className={styles.keepPlayingButton} onClick={onDismiss}>
                  Keep Playing
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}