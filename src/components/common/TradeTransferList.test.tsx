import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeTransferList } from './TradeTransferList';

describe('TradeTransferList', () => {
  it('shows a "no cards changed hands" message when given an empty list', () => {
    render(<TradeTransferList transfers={[]} />);
    expect(screen.getByText('No cards changed hands.')).toBeInTheDocument();
  });

  it('names each transferred unit and which side it moved to', () => {
    render(
      <TradeTransferList
        transfers={[
          { unitId: 'necrons-lychguard', from: 'red', to: 'blue' },
          { unitId: 'necrons-immortals', from: 'blue', to: 'red' },
        ]}
      />,
    );

    expect(screen.getByText('Lychguard moves from red to blue')).toBeInTheDocument();
    expect(screen.getByText('Immortals moves from blue to red')).toBeInTheDocument();
  });

  it('falls back to "Unknown Unit" for an unresolvable unit id rather than crashing', () => {
    render(<TradeTransferList transfers={[{ unitId: 'not-a-real-id', from: 'red', to: 'blue' }]} />);
    expect(screen.getByText('Unknown Unit moves from red to blue')).toBeInTheDocument();
  });

  it('renders a real list (not the empty-state message) when given at least one transfer', () => {
    render(<TradeTransferList transfers={[{ unitId: 'necrons-lychguard', from: 'red', to: 'blue' }]} />);
    expect(screen.queryByText('No cards changed hands.')).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});