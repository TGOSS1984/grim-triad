/**
 * A faction's icon/logo, e.g. assets/factions/blood-angels/icon.png (see
 * ROADMAP.md's asset structure). Tries .png first, falls back to .webp,
 * then renders nothing if neither loads - most factions have no icon art
 * yet, and rather than show a broken-image icon this degrades gracefully,
 * same "graceful missing art" philosophy as Card.tsx's portrait fallback.
 *
 * Shared between FactionSelect (the faction picker) and CardBack (the
 * centered logo on a face-down card) rather than each defining their own
 * copy of the same fallback logic.
 */
import { useState } from 'react';

export interface FactionIconProps {
  slug: string;
  className?: string;
}

type IconExtension = 'png' | 'webp';

export function FactionIcon({ slug, className }: FactionIconProps) {
  const [extension, setExtension] = useState<IconExtension | null>('png');
  if (extension === null) return null;

  return (
    <img
      className={className}
      src={`/assets/factions/${slug}/icon.${extension}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setExtension((current) => (current === 'png' ? 'webp' : null))}
    />
  );
}