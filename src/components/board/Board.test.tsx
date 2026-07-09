import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import type { BoardCardData } from './BoardCell';

function emptyCells(): (BoardCardData | null)[][] {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

const sampleCard: BoardCardData = {
  name: 'Lychguard',
  stats: { top: 5, bottom: 5, left: 6, right: 6 },
  portraitPath: 'assets/factions/necrons/units/lychguard.png',
  owner: 'red',
};

describe('Board', () => {
  it('renders a 3x3 grid of 9 cells', () => {
    render(<Board cells={emptyCells()} />);
    // 9 empty-cell buttons, each with a distinct row/col aria-label.
    expect(screen.getByLabelText('Empty cell, row 1, column 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Empty cell, row 3, column 3')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('renders an occupied cell as a Card instead of an empty slot', () => {
    const cells = emptyCells();
    cells[1][1] = sampleCard;
    render(<Board cells={cells} />);

    expect(screen.getByRole('img', { name: 'Lychguard' })).toBeInTheDocument();
    // 8 empty cells remain clickable buttons, the occupied one does not add a 9th.
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('calls onCellClick with the correct position when an empty cell is clicked', () => {
    const onCellClick = vi.fn();
    render(<Board cells={emptyCells()} onCellClick={onCellClick} />);

    fireEvent.click(screen.getByLabelText('Empty cell, row 2, column 3'));

    expect(onCellClick).toHaveBeenCalledWith({ row: 1, col: 2 });
  });

  it('disables empty-cell buttons when no onCellClick handler is provided', () => {
    render(<Board cells={emptyCells()} />);
    const cell = screen.getByLabelText('Empty cell, row 1, column 1');
    expect(cell).toBeDisabled();
  });

  it('does not call onCellClick for an occupied cell (no click target rendered for it)', () => {
    const onCellClick = vi.fn();
    const cells = emptyCells();
    cells[0][0] = sampleCard;
    render(<Board cells={cells} onCellClick={onCellClick} />);

    // The occupied cell renders as a non-interactive Card (role="img"),
    // not a button, so there is nothing at that position to click.
    expect(screen.queryByLabelText('Empty cell, row 1, column 1')).not.toBeInTheDocument();
  });

  it('applies the highlighted state only to positions in highlightedPositions', () => {
    render(
      <Board
        cells={emptyCells()}
        highlightedPositions={[{ row: 0, col: 1 }, { row: 2, col: 2 }]}
      />,
    );

    const highlightedCell = screen.getByLabelText('Empty cell, row 1, column 2');
    const nonHighlightedCell = screen.getByLabelText('Empty cell, row 1, column 1');

    // Highlighted cells carry the highlight CSS module class; exact class
    // name is implementation detail, so assert via className containing
    // a distinguishing substring is fragile - instead assert the two
    // cells render with different className values.
    expect(highlightedCell.className).not.toBe(nonHighlightedCell.className);
  });
});