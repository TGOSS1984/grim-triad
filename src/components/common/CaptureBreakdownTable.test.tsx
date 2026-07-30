import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureBreakdownTable } from './CaptureBreakdownTable';
import type { CaptureBreakdown } from '../../state/gameStore';

const EMPTY: CaptureBreakdown = { base: 0, same: 0, plus: 0, chain: 0 };

describe('CaptureBreakdownTable', () => {
  it('shows "No captures this match." when both sides have zero captures across every kind', () => {
    render(<CaptureBreakdownTable blue={EMPTY} red={EMPTY} />);
    expect(screen.getByText('No captures this match.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a real table once at least one side has a genuine capture', () => {
    render(<CaptureBreakdownTable blue={{ base: 1, same: 0, plus: 0, chain: 0 }} red={EMPTY} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No captures this match.')).not.toBeInTheDocument();
  });

  it('shows all four capture-kind rows, even ones that are 0/0', () => {
    render(<CaptureBreakdownTable blue={{ base: 1, same: 0, plus: 0, chain: 0 }} red={EMPTY} />);
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Same')).toBeInTheDocument();
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(screen.getByText('Chain')).toBeInTheDocument();
  });

  it('shows the correct per-kind values for each side', () => {
    const blue: CaptureBreakdown = { base: 3, same: 2, plus: 0, chain: 1 };
    const red: CaptureBreakdown = { base: 1, same: 0, plus: 1, chain: 0 };
    render(<CaptureBreakdownTable blue={blue} red={red} />);

    const rows = screen.getAllByRole('row');
    // Header row + 4 kind rows + total row = 6.
    expect(rows).toHaveLength(6);

    const baseRow = screen.getByText('Base').closest('tr')!;
    expect(baseRow).toHaveTextContent('3');
    expect(baseRow).toHaveTextContent('1');

    const sameRow = screen.getByText('Same').closest('tr')!;
    expect(sameRow).toHaveTextContent('2');

    const chainRow = screen.getByText('Chain').closest('tr')!;
    expect(chainRow).toHaveTextContent('1');
  });

  it('shows a correct Total row summing all four kinds per side', () => {
    const blue: CaptureBreakdown = { base: 3, same: 2, plus: 0, chain: 1 }; // total 6
    const red: CaptureBreakdown = { base: 1, same: 0, plus: 1, chain: 0 }; // total 2
    render(<CaptureBreakdownTable blue={blue} red={red} />);

    const totalRow = screen.getByText('Total').closest('tr')!;
    expect(totalRow).toHaveTextContent('6');
    expect(totalRow).toHaveTextContent('2');
  });

  it('shows Blue and Red column headers', () => {
    render(<CaptureBreakdownTable blue={{ base: 1, same: 0, plus: 0, chain: 0 }} red={EMPTY} />);
    expect(screen.getByRole('columnheader', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Red' })).toBeInTheDocument();
  });
});