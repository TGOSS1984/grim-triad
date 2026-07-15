/**
 * Plus rule: when a card is placed, for each occupied neighbor, add the
 * placed card's side value to that neighbor's facing value. If two or more
 * of these sums are equal to each other, a "Plus" combo triggers - all
 * cards involved in the matching sums flip to the placing player, whether
 * or not the placed card's raw value was higher.
 *
 * Combo chain behaviour is identical to the Same rule: each newly-flipped
 * card re-checks its own other neighbors using the standard base
 * (higher-value-wins) rule, cascading until no further captures occur.
 */
import type { Board, Card, CaptureKind, CaptureResult, Position, Side, StatsResolver } from '../types';
import { ALL_SIDES, getCell, neighborsOf, opposite } from '../board';
import { resolveBaseCaptures } from '../capture';

const identityStats: StatsResolver = (card) => card.stats;

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell }))) as Board;
}

export function resolvePlusCaptures(
  board: Board,
  placedCard: Card,
  pos: Position,
  getStats: StatsResolver = identityStats,
): CaptureResult {
  const neighbors = neighborsOf(pos);
  const placedStats = getStats(placedCard, pos);

  // sum -> list of (side, neighborPos) that produced it
  const sumGroups = new Map<number, { side: Side; neighborPos: Position }[]>();

  for (const { side, neighborPos } of neighbors) {
    const neighborCell = getCell(board, neighborPos);
    if (!neighborCell.card) continue;

    const sum = placedStats[side] + getStats(neighborCell.card, neighborPos)[opposite(side)];
    const group = sumGroups.get(sum) ?? [];
    group.push({ side, neighborPos });
    sumGroups.set(sum, group);
  }

  // A Plus combo needs 2+ neighbors sharing the same sum, with at least one
  // opponent card among them.
  const matchedNeighborPositions: Position[] = [];
  for (const group of sumGroups.values()) {
    if (group.length < 2) continue;
    const opponentEntries = group.filter(
      (entry) => getCell(board, entry.neighborPos).card?.owner !== placedCard.owner,
    );
    if (opponentEntries.length === 0) continue;
    for (const entry of opponentEntries) {
      matchedNeighborPositions.push(entry.neighborPos);
    }
  }

  if (matchedNeighborPositions.length === 0) {
    return { captured: [], comboTriggered: false, captureKinds: [] };
  }

  const working = cloneBoard(board);
  for (const p of matchedNeighborPositions) {
    const cell = getCell(working, p);
    if (cell.card) {
      working[p.row][p.col] = { ...cell, card: { ...cell.card, owner: placedCard.owner } };
    }
  }

  const allCaptured = [...matchedNeighborPositions];
  const queue = [...matchedNeighborPositions];
  const capturedSet = new Set(allCaptured.map((p) => `${p.row},${p.col}`));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCard = getCell(working, current).card;
    if (!currentCard) continue;

    const chainCaptures = resolveBaseCaptures(working, currentCard, current, getStats);
    for (const p of chainCaptures) {
      const key = `${p.row},${p.col}`;
      if (capturedSet.has(key)) continue;
      capturedSet.add(key);
      allCaptured.push(p);
      queue.push(p);
      const cell = getCell(working, p);
      if (cell.card) {
        working[p.row][p.col] = { ...cell, card: { ...cell.card, owner: placedCard.owner } };
      }
    }
  }

  return {
    captured: allCaptured,
    comboTriggered: allCaptured.length > matchedNeighborPositions.length,
    // Same boundary trick as same.ts: matchedNeighborPositions.length is
    // exactly where "directly matched this Plus check" ends and "fell as
    // a secondary cascade reaction" begins.
    captureKinds: allCaptured.map((_, i): CaptureKind =>
      i < matchedNeighborPositions.length ? 'plus' : 'cascade',
    ),
  };
}

/** Exported for tests/documentation - the sides a Plus check considers. */
export const PLUS_SIDES = ALL_SIDES;