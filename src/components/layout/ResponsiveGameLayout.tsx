/**
 * Arranges the game screen's three main pieces: left hand, board, right
 * hand. This is a starting-point layout, not the final mobile-responsive
 * version - the full responsiveness pass (stacking hands above/below the
 * board on narrow screens, fluid sizing) is Phase 9's dedicated scope. For
 * now this provides a sound flex structure with a basic wrap fallback
 * rather than nothing at all.
 */
import type { ReactNode } from 'react';
import styles from './ResponsiveGameLayout.module.css';

export interface ResponsiveGameLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ResponsiveGameLayout({ left, center, right }: ResponsiveGameLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.side}>{left}</div>
      <div className={styles.center}>{center}</div>
      <div className={styles.side}>{right}</div>
    </div>
  );
}