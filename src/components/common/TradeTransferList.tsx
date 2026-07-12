/**
 * Renders a list of Trade Rule transfers (unit name + which side it moved
 * from/to), or a "No cards changed hands." message if the list is empty.
 * Extracted from ResultScreen (single-match) and RoundSummaryScreen
 * (series), which had ended up with byte-for-byte identical rendering
 * for this one piece - resolving a unit id to its display name, then
 * listing "X moves from A to B" for each transfer.
 *
 * Deliberately NOT a broader "match outcome summary" component covering
 * title/score/actions too: ResultScreen's tally is board-control count,
 * RoundSummaryScreen's is pool-remaining + round-wins, and
 * SeriesResultScreen's is round-wins only (and it has no trade info at
 * all, a series' trade outcomes are per-round, not per-series) - three
 * genuinely different shapes that would need heavy conditional plumbing
 * to force into one shared component. This is the one piece that really
 * was identical, so this is the one piece that got extracted.
 *
 * Callers own their own heading (if any) and whether to render this
 * component at all when the list is empty - see ResultScreen (always
 * renders, shows the empty-state message) vs RoundSummaryScreen (only
 * renders when there's actually something to show).
 */
import { getUnitById } from '../../data/activeFactions';
import type { PlayerColour } from '../../engine/types';
import styles from './TradeTransferList.module.css';

export interface TradeTransfer {
  unitId: string;
  from: PlayerColour;
  to: PlayerColour;
}

export interface TradeTransferListProps {
  transfers: TradeTransfer[];
  className?: string;
}

export function TradeTransferList({ transfers, className }: TradeTransferListProps) {
  if (transfers.length === 0) {
    return <p className={styles.noTrade}>No cards changed hands.</p>;
  }

  return (
    <ul className={[styles.tradeList, className ?? ''].filter(Boolean).join(' ')}>
      {transfers.map((t, i) => (
        <li key={`${t.unitId}-${i}`}>
          {getUnitById(t.unitId)?.name ?? 'Unknown Unit'} moves from {t.from} to {t.to}
        </li>
      ))}
    </ul>
  );
}