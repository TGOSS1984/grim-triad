/**
 * Celebratory modal shown the MOMENT a campaign collection first reaches
 * completion (see campaignStore's hasCompletedCollection - the caller,
 * CampaignResultScreen, is responsible for detecting the false -> true
 * transition and only rendering this on that transition, not on every
 * subsequent render while still complete).
 *
 * Three real choices, matching the confirmed design (not four - "keep
 * playing with AI reinforcements" is a later, separate feature once the
 * AI has a persistent, depletable pool of its own; until then there's
 * nothing for that button to actually DO beyond what "Keep Playing"
 * already covers here):
 *   - Start New Campaign: wipes the (now-complete) collection for a fresh
 *     run. Gets its own inline two-step confirm, same wording/pattern as
 *     CampaignHomeScreen's own "Start New Run" - this is genuinely
 *     destructive (discards a just-finished 100% collection) and
 *     deserves the same guard rail that screen already gives a much less
 *     consequential version of the same action.
 *   - Return to Title: leaves campaign mode entirely. Does NOT touch the
 *     collection - it's still saved, still complete, whenever the player
 *     comes back.
 *   - Keep Playing: dismisses the modal, same as backdrop-click or
 *     Escape (see Lightbox.tsx for the same three-way dismiss
 *     convention this mirrors) - the collection stays exactly as-is,
 *     and CampaignResultScreen's ordinary Continue button underneath is
 *     unaffected. Nothing stops further play; there's just no more
 *     collection progress to chase (see file header above).
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
  /** The Complete Collection achievement's display name (see achievements.ts) - passed in rather than imported/looked-up here, keeping this component pure presentation. */
  achievementName: string;
  achievementDescription: string;
  /** How many distinct obtainable units are owned - equal to `obtainableTotal` by definition when this modal is shown, but both are passed so the copy can say "737 / 737" rather than just "737". */
  unitsOwned: number;
  obtainableTotal: number;
  onStartNewRun: () => void;
  onReturnToTitle: () => void;
  onDismiss: () => void;
}

export function CampaignVictoryModal({
  achievementName,
  achievementDescription,
  unitsOwned,
  obtainableTotal,
  onStartNewRun,
  onReturnToTitle,
  onDismiss,
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
          aria-label="Keep playing"
        >
          &times;
        </button>

        <h2 id="campaign-victory-title" className={styles.title}>
          Collection Complete!
        </h2>
        <p className={styles.subtitle}>
          You now own {unitsOwned} / {obtainableTotal} units - one of everything currently
          obtainable.
        </p>

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
              <button
                type="button"
                className={styles.titleButton}
                onClick={onReturnToTitle}
              >
                Return to Title
              </button>
              <button type="button" className={styles.keepPlayingButton} onClick={onDismiss}>
                Keep Playing
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}