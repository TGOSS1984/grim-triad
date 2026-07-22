/**
 * Icons for the three faction-group accordion headers in FactionSelect
 * (Imperium / Chaos / Xenos - see data/factionAlignment.ts).
 *
 * These are original, abstract marks - deliberately NOT the actual 40k
 * iconography (aquila, 8-pointed chaos star, etc.), which are Games
 * Workshop trademarks. Each is built from the same stroke-based geometry
 * so the trio reads as a matched set at a glance:
 *   Imperium - a symmetric shield/spire silhouette: order, hierarchy.
 *   Chaos    - an irregular, asymmetric jagged burst: corruption, disorder.
 *   Xenos    - an off-center ring with a satellite dot: something alien
 *              orbiting outside the norm.
 * All three use `currentColor` for both stroke and fill so they inherit
 * color from their CSS context (muted by default, gold when the section
 * is open/hovered) exactly like the rest of the UI's icon treatment.
 */
export type GroupIconKind = 'Imperium' | 'Chaos' | 'Xenos';

export interface GroupIconProps {
  kind: GroupIconKind;
  className?: string;
}

function ImperiumGlyph() {
  return (
    <path
      d="M14 2 L24 6 V15 C24 21 19.5 25.5 14 27 C8.5 25.5 4 21 4 15 V6 Z M14 2 V27"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function ChaosGlyph() {
  return (
    <path
      d="M14 2 L17 10.5 L25.5 8 L19 14.5 L26 19 L17.5 18 L18.5 26.5 L13 20.5 L8 26.5 L8.5 18 L1.5 19.5 L7.5 14 L2 8.5 L10.5 10.5 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function XenosGlyph() {
  return (
    <>
      <circle cx="13" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="23" cy="7" r="2.6" fill="currentColor" />
    </>
  );
}

export function GroupIcon({ kind, className }: GroupIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 29"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'Imperium' && <ImperiumGlyph />}
      {kind === 'Chaos' && <ChaosGlyph />}
      {kind === 'Xenos' && <XenosGlyph />}
    </svg>
  );
}