/**
 * Renders the icon for a single Elemental terrain type (see
 * src/data/elements.ts for the themed list). Uses react-icons' Game Icons
 * set (game-icons.net via react-icons/gi), which has genuinely fitting
 * icons for each concept rather than generic shapes.
 */
import { GiVortex, GiFlame, GiBlackHoleBolas, GiPoisonBottle, GiRadioactive } from 'react-icons/gi';
import type { IconType } from 'react-icons';
import type { ElementId } from '../../data/elements';

const ELEMENT_ICONS: Record<ElementId, IconType> = {
  warp: GiVortex,
  promethium: GiFlame,
  void: GiBlackHoleBolas,
  toxic: GiPoisonBottle,
  radiation: GiRadioactive,
};

/**
 * Colours chosen to be immediately legible against the board/card
 * backgrounds and distinct from each other at a glance, not pulled from
 * the general design token palette - these are a small, self-contained
 * concern specific to Elemental terrain.
 */
const ELEMENT_COLORS: Record<ElementId, string> = {
  warp: '#a855f7',
  promethium: '#f97316',
  void: '#38bdf8',
  toxic: '#65a30d',
  radiation: '#eab308',
};

export interface ElementIconProps {
  element: ElementId;
  className?: string;
  /** Accessible label; omit for a purely decorative icon (e.g. when the surrounding UI already names the element in text). */
  title?: string;
}

export function ElementIcon({ element, className, title }: ElementIconProps) {
  const Icon = ELEMENT_ICONS[element];
  return (
    <Icon
      className={className}
      color={ELEMENT_COLORS[element]}
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    />
  );
}