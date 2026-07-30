/**
 * Renders a small "who captured what, and how" table - one row per
 * capture kind (Base/Same/Plus/Chain), one column per side, plus a Total
 * row - or a "No captures this match." message if nothing was ever
 * captured by either side. Extracted as its own shared component
 * (mirroring TradeTransferList's own reasoning) so ResultScreen and
 * CampaignResultScreen show byte-for-byte identical breakdowns rather
 * than two independently-maintained copies of the same table.
 *
 * Deliberately factual, not narrative - this shows what happened (a
 * scannable stat table), not an authored "you won because of X" sentence.
 * A match decided by five plain base captures is a completely ordinary
 * outcome; manufacturing a story around it would occasionally just be
 * wrong. Reads as this match's "why you won/lost" breakdown by simply
 * being honest about what actually happened, side by side.
 *
 * Pure presentational, no store access (same as TradeTransferList) -
 * takes plain CaptureBreakdown data (see state/gameStore.ts, the type's
 * actual home; reused here via a type-only import rather than duplicated,
 * since it's the exact same shape gameStore already tracks per match) so
 * this component has no idea gameStore exists as anything other than a
 * type definition.
 */
import type { CaptureBreakdown } from '../../state/gameStore';
import styles from './CaptureBreakdownTable.module.css';

export interface CaptureBreakdownTableProps {
  blue: CaptureBreakdown;
  red: CaptureBreakdown;
}

const ROWS: { key: keyof CaptureBreakdown; label: string }[] = [
  { key: 'base', label: 'Base' },
  { key: 'same', label: 'Same' },
  { key: 'plus', label: 'Plus' },
  { key: 'chain', label: 'Chain' },
];

function total(breakdown: CaptureBreakdown): number {
  return breakdown.base + breakdown.same + breakdown.plus + breakdown.chain;
}

export function CaptureBreakdownTable({ blue, red }: CaptureBreakdownTableProps) {
  const blueTotal = total(blue);
  const redTotal = total(red);

  if (blueTotal === 0 && redTotal === 0) {
    return <p className={styles.noCaptures}>No captures this match.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col" className={styles.kindHeader}>
            Captures
          </th>
          <th scope="col" className={styles.blueHeader}>
            Blue
          </th>
          <th scope="col" className={styles.redHeader}>
            Red
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.key}>
            <th scope="row" className={styles.kindLabel}>
              {row.label}
            </th>
            <td className={styles.blueCell}>{blue[row.key]}</td>
            <td className={styles.redCell}>{red[row.key]}</td>
          </tr>
        ))}
        <tr className={styles.totalRow}>
          <th scope="row" className={styles.kindLabel}>
            Total
          </th>
          <td className={styles.blueCell}>{blueTotal}</td>
          <td className={styles.redCell}>{redTotal}</td>
        </tr>
      </tbody>
    </table>
  );
}