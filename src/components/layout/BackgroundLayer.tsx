/**
 * Full-bleed background behind a game screen. No battle background art
 * exists yet (per the original brief: "Each battle will use a random
 * background image which I will save down in assets") - rather than block
 * on assets, this falls back to the same void/surface gradient used
 * elsewhere in the app when no imagePath is given, so the screen never
 * looks broken while art is pending. Dropping real background images into
 * assets/backgrounds/ and passing a path in is a drop-in change, nothing
 * structural.
 */
import styles from './BackgroundLayer.module.css';

export interface BackgroundLayerProps {
  /** Root-relative path to a battle background image, if one exists yet. */
  imagePath?: string;
}

function toPublicPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function BackgroundLayer({ imagePath }: BackgroundLayerProps) {
  const style = imagePath
    ? { backgroundImage: `url(${toPublicPath(imagePath)})` }
    : undefined;

  return <div className={styles.background} style={style} aria-hidden="true" />;
}