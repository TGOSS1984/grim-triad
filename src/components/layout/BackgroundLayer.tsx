/**
 * Full-bleed background behind a screen. No background art exists yet
 * (see components/layout/backgroundPaths.ts for the path conventions real
 * art will eventually be dropped into) - falls back to the same
 * void/surface gradient used elsewhere in the app when no imagePath is
 * given (or when it 404s - see below), so a screen never looks broken
 * while art is pending. Dropping real images into
 * public/assets/backgrounds/ at the conventional paths is a drop-in
 * change, nothing structural.
 *
 * Layering, not replacing: when an image IS given, it does NOT become the
 * background on its own - the SAME tint gradient still paints on top of
 * it (as a semi-transparent variant, defined in the CSS module), so a
 * background image always reads as "faded through the app's existing
 * colour identity", never as a raw, jarring standalone photo. This was a
 * deliberate requirement, not a style preference: the app's colour
 * palette should stay the dominant visual character on every screen
 * regardless of what background art gets added later.
 *
 * Graceful degradation without any JS: the photo is applied via a CSS
 * custom property consumed by a SECOND background-image layer (see
 * BackgroundLayer.module.css's `.hasImage` variant) - multiple CSS
 * background layers paint independently, so if the image path 404s,
 * only that one layer fails to render while the gradient layer beneath
 * it paints regardless. No onError handling needed, unlike <img> tags
 * elsewhere in the app.
 */
import styles from './BackgroundLayer.module.css';
import { publicAssetPath } from '../../utils/publicAssetPath';

export interface BackgroundLayerProps {
  /** Root-relative path to a background image, if one exists yet. */
  imagePath?: string;
}

export function BackgroundLayer({ imagePath }: BackgroundLayerProps) {
  const hasImage = !!imagePath;
  const style = hasImage
    ? ({ '--bg-photo': `url(${publicAssetPath(imagePath as string)})` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={[styles.background, hasImage ? styles.hasImage : ''].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}