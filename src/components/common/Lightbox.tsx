/**
 * Full-screen image lightbox. Portalled to document.body so it always
 * renders above any scrollable/overflow-clipped container it was opened
 * from (e.g. UnitPicker's scrolling roster list) rather than being
 * constrained by that container's own stacking/overflow rules.
 *
 * Closes on backdrop click, the close button, or Escape - the three
 * conventional ways users expect to dismiss a lightbox.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Lightbox.module.css';

export interface LightboxProps {
  src: string;
  alt: string;
  /** Optional caption shown below the image (e.g. unit name). */
  caption?: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, caption, onClose }: LightboxProps) {
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
        <img className={styles.image} src={src} alt={alt} draggable={false} />
        {caption && <div className={styles.caption}>{caption}</div>}
      </div>
    </div>,
    document.body,
  );
}