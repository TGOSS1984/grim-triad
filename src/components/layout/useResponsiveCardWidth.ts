/**
 * Tracks a card width (px) that scales fluidly with the viewport, so the
 * whole board+hands composition grows to use more of a large desktop
 * screen (the original fixed 130px default left a lot of unused space -
 * see the desktop screenshot that prompted this) while staying safely
 * on-screen on small/portrait viewports.
 *
 * Sized off whichever of viewport width/height is more constraining
 * (`Math.min` of the two candidate values below), not width alone - a
 * wide-but-short window (common on laptops) would otherwise size cards
 * off width and overflow vertically once a hand's cards fan out and
 * overlap (see Hand.module.css's overlap math, which is itself a function
 * of card height). This is the same "constrain by the tighter dimension"
 * trick CSS's `clamp(min, min(Xvw, Yvh), max)` pattern uses, done in JS
 * here so the resulting number can still be fed to width-based arithmetic
 * elsewhere (e.g. GameScreen's `cardWidth + 10` for the board vs hands).
 *
 * Recomputes on resize and orientation change. The VW/VH factors and
 * MIN/MAX bounds are tunable constants, not derived from anything - treat
 * them as a starting point to adjust by eye, same spirit as Hand's own
 * overlap-percentage comment.
 */
import { useEffect, useState } from 'react';

const MIN_CARD_WIDTH = 90;
const MAX_CARD_WIDTH = 230;
const VW_FACTOR = 0.14;
const VH_FACTOR = 0.19;

function computeCardWidth(): number {
  if (typeof window === 'undefined') return MIN_CARD_WIDTH;
  const byWidth = window.innerWidth * VW_FACTOR;
  const byHeight = window.innerHeight * VH_FACTOR;
  const fluid = Math.min(byWidth, byHeight);
  return Math.round(Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, fluid)));
}

export function useResponsiveCardWidth(): number {
  const [cardWidth, setCardWidth] = useState(computeCardWidth);

  useEffect(() => {
    function handleResize() {
      setCardWidth(computeCardWidth());
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return cardWidth;
}