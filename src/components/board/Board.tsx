/**
 * The 3x3 battle grid. Takes a plain 3x3 array of cell contents (row-major,
 * matching the engine's Board convention) rather than the engine's Board
 * type directly, keeping the same decoupled-presentational philosophy as
 * Card/BoardCell: the caller (GameScreen, wired up in Phase 8) is
 * responsible for turning engine GameState + unit lookup data into this
 * shape.
 *
 * .boardEmblem is a purely decorative watermark sitting behind the whole
 * grid (not repeated per-cell - see Board.module.css's own header for
 * why), gracefully absent if no image has been dropped in yet - same
 * "missing art degrades gracefully" philosophy as BackgroundLayer, since
 * this is decoration, not meaningful content the way a faction icon
 * <img> is. Unlike most of this app's decorative background images
 * (which use a plain CSS url(), letting Vite/the browser just 404
 * silently), this one is set via an inline style computed from
 * publicAssetPath - a CSS module can't call a JS function, and the
 * actual URL needs to respect wherever this app is deployed (see that
 * helper's own header for why a hardcoded path breaks under GitHub
 * Pages' project-site subpath).
 */
import type { Position } from '../../engine/types';
import type { ElementId } from '../../data/elements';
import { BoardCell, type BoardCardData } from './BoardCell';
import { publicAssetPath } from '../../utils/publicAssetPath';
import styles from './Board.module.css';

export interface BoardProps {
  /** 3x3, row-major: cells[row][col]. Null = empty. */
  cells: (BoardCardData | null)[][];
  /** 3x3, row-major, same shape as `cells`: this cell's Elemental terrain, if any. Independent of whether the cell is occupied. */
  elements?: (ElementId | undefined)[][];
  /** Positions that should glow as legal placement targets for the current selection. */
  highlightedPositions?: Position[];
  onCellClick?: (position: Position) => void;
  cardWidth?: number;
}

function isHighlighted(highlighted: Position[] | undefined, pos: Position): boolean {
  return !!highlighted?.some((p) => p.row === pos.row && p.col === pos.col);
}

export function Board({ cells, elements, highlightedPositions, onCellClick, cardWidth }: BoardProps) {
  return (
    <div className={styles.boardWrapper}>
      <div
        className={styles.boardEmblem}
        style={{ backgroundImage: `url(${publicAssetPath('assets/backgrounds/board-emblem.png')})` }}
        aria-hidden="true"
      />
      <div className={styles.grid} role="grid" aria-label="Battle grid">
        {([0, 1, 2] as const).map((row) =>
          ([0, 1, 2] as const).map((col) => {
            const position: Position = { row, col };
            return (
              <BoardCell
                key={`${row}-${col}`}
                position={position}
                card={cells[row][col]}
                element={elements?.[row][col]}
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