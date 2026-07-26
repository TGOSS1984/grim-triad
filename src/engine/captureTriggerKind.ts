/**
 * Pure resolver for "which ONE rule should this move's captures be
 * attributed to" - shared by RuleTriggerCallout's visual banner
 * (screens/GameScreen.tsx) and cross-mode unlock progress tracking
 * (state/gameStore.ts), so both stay in perfect agreement about what
 * counts as a Same/Plus/Chain moment versus a plain base capture, rather
 * than two independently-maintained copies of the same priority logic
 * quietly drifting apart over time.
 *
 * Priority: 'same' or 'plus' (the initiating rule) beats a bare
 * 'cascade' entry, since a cascaded card's own kind doesn't tell you what
 * STARTED the chain - only that this specific card was swept up by one
 * (see engine/types.ts's CaptureKind for what each raw kind means). A
 * standalone 'cascade' with neither 'same' nor 'plus' present means the
 * Chain rule fired on a plain base capture, which counts on its own. A
 * plain base capture (no same/plus/cascade at all) returns null - not a
 * Same/Plus/Chain moment, the default mechanic every match has.
 */
import type { CaptureKind } from './types';

export type CaptureTriggerKind = 'same' | 'plus' | 'chain';

export function resolvePrimaryCaptureTriggerKind(
  captureKinds: CaptureKind[] | undefined,
): CaptureTriggerKind | null {
  if (!captureKinds || captureKinds.length === 0) return null;
  if (captureKinds.includes('same')) return 'same';
  if (captureKinds.includes('plus')) return 'plus';
  if (captureKinds.includes('cascade')) return 'chain';
  return null;
}