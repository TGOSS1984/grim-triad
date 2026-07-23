/**
 * Icon for a faction-group accordion header in FactionSelect (Imperium /
 * Chaos / Xenos - see data/factionAlignment.ts). User-supplied artwork,
 * loaded the same way FactionIcon loads a faction's icon: tries .png
 * first, falls back to .webp, then renders nothing if neither loads -
 * same "graceful missing art" degrade as FactionIcon and Card's portrait
 * fallback, rather than a broken-image icon or a hardcoded placeholder
 * mark.
 *
 * Expected asset path, matching the existing
 * assets/factions/<faction-slug>/icon.png convention (see ROADMAP.md's
 * asset structure):
 *   public/assets/groups/imperium/icon.png (+ optional icon.webp)
 *   public/assets/groups/chaos/icon.png    (+ optional icon.webp)
 *   public/assets/groups/xenos/icon.png    (+ optional icon.webp)
 */
import { useState } from 'react';
import type { FactionAlignment } from '../../data/factionAlignment';

export interface GroupIconProps {
  alignment: FactionAlignment;
  className?: string;
}

type IconExtension = 'png' | 'webp';

export function GroupIcon({ alignment, className }: GroupIconProps) {
  const slug = alignment.toLowerCase();
  const [extension, setExtension] = useState<IconExtension | null>('png');
  if (extension === null) return null;

  return (
    <img
      className={className}
      src={`/assets/groups/${slug}/icon.${extension}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setExtension((current) => (current === 'png' ? 'webp' : null))}
    />
  );
}