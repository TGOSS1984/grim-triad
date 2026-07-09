/**
 * The 3x3 battle grid. Takes a plain 3x3 array of cell contents (row-major,
 * matching the engine's Board convention) rather than the engine's Board
 * type directly, keeping the same decoupled-presentational philosophy as
 * Card/BoardCell: the caller (GameScreen, wired up in Phase 8) is
 * responsible for turning engine GameState + unit lookup data into this
 * shape.
 */
import type { Position } from '../../engine/types';
import { BoardCell, type BoardCardData } from './BoardCell';
import styles from './Board.module.css';

export interface BoardProps {
  /** 3x3, row-major: cells[row][col]. Null = empty. */
  cells: (BoardCardData | null)[][];
  /** Positions that should glow as legal placement targets for the current selection. */
  highlightedPositions?: Position[];
  onCellClick?: (position: Position) => void;
  cardWidth?: number;
}

function isHighlighted(highlighted: Position[] | undefined, pos: Position): boolean {
  return !!highlighted?.some((p) => p.row === pos.row && p.col === pos.col);
}

export function Board({ cells, highlightedPositions, onCellClick, cardWidth }: BoardProps) {
  return (
    <div className={styles.boardWrapper}>
      <div className={styles.grid} role="grid" aria-label="Battle grid">
        {([0, 1, 2] as const).map((row) =>
          ([0, 1, 2] as const).map((col) => {
            const position: Position = { row, col };
            return (
              <BoardCell
                key={`${row}-${col}`}
                position={position}
                card={cells[row][col]}
                highlighted={isHighlighted(highlightedPositions, position)}
                cardWidth={cardWidth}
                onClick={onCellClick}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}