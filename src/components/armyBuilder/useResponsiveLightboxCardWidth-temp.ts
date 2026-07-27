/**
 * Responsive width (px) for the Lightbox's full-size card - same
 * "constrain by whichever of viewport width/height is tighter" approach
 * as useResponsiveCardWidth (see that file's own header for the full
 * reasoning), recalibrated for a much larger card.
 *
 * Why this needs its own hook rather than reusing useResponsiveCardWidth
 * directly: that hook is tuned for the tiny board/hand cards (90-230px)
 * with small VW/VH factors appropriate to that scale. The Lightbox card
 * is deliberately much bigger (up to 480px on desktop, per the request
 * that prompted the size increase) - reusing the same small factors would
 * either undersize it on desktop or, worse, oversize it on mobile with no
 * relationship to what actually fits. Height is the usual binding
 * constraint on typical desktop window proportions (reaching close to the
 * 480px max), while width becomes binding on a narrow mobile portrait
 * viewport (shrinking well below 480 so the card - and Lightbox.tsx's own
 * close button/padding around it - stays fully on-screen rather than
 * overflowing the frame the way a fixed 480px would on a 375px-wide
 * phone).
 */
import { useEffect, useState } from 'react';

const MIN_LIGHTBOX_CARD_WIDTH = 160;
const MAX_LIGHTBOX_CARD_WIDTH = 480;
const VW_FACTOR = 0.8;
const VH_FACTOR = 0.55;

function computeLightboxCardWidth(): number {
  if (typeof window === 'undefined') return MIN_LIGHTBOX_CARD_WIDTH;
  const byWidth = window.innerWidth * VW_FACTOR;
  const byHeight = window.innerHeight * VH_FACTOR;
  const fluid = Math.min(byWidth, byHeight);
  return Math.round(
    Math.min(MAX_LIGHTBOX_CARD_WIDTH, Math.max(MIN_LIGHTBOX_CARD_WIDTH, fluid)),
  );
}

export function useResponsiveLightboxCardWidth(): number {
  const [width, setWidth] = useState(computeLightboxCardWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(computeLightboxCardWidth());
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return width;
}