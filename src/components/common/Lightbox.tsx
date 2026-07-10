/**
 * Full-screen image/content lightbox. Portalled to document.body so it
 * always renders above any scrollable/overflow-clipped container it was
 * opened from (e.g. UnitPicker's scrolling roster list) rather than being
 * constrained by that container's own stacking/overflow rules.
 *
 * Closes on backdrop click, the close button, or Escape - the three
 * conventional ways users expect to dismiss a lightbox.
 *
 * Two content modes: pass `src`/`alt` for a plain image (the original use
 * case), or `children` for arbitrary content - e.g. UnitPicker renders a
 * real, full-size Card component here instead of a flat portrait image,
 * so the "enlarged view" actually matches what the card looks like in a
 * real match (stats, name plate, element badge and all), not just its
 * portrait art in isolation.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Lightbox.module.css';

export interface LightboxProps {
  /** Image mode: the image to show. Ignored if `children` is given. */
  src?: string;
  /** Image mode: required alt text for the image. */
  alt?: string;
  /** Custom-content mode: renders this instead of an <img> entirely. */
  children?: ReactNode;
  /** Optional caption shown below the content (e.g. unit name). */
  caption?: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, children, caption, onClose }: LightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.frame} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close image"
        >
          &times;
        </button>
        {children ?? <img className={styles.image} src={src} alt={alt} draggable={false} />}
        {caption && <div className={styles.caption}>{caption}</div>}
      </div>
    </div>,
    document.body,
  );
}