import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PointsTally } from './PointsTally';

describe('PointsTally', () => {
  it('shows spent and cap when a cap is set', () => {
    render(<PointsTally totalPoints={250} pointsCap={500} />);
    expect(screen.getByText('250 / 500 pts')).toBeInTheDocument();
    expect(screen.getByText('250 remaining')).toBeInTheDocument();
  });

  it('shows just the spent total, no remaining, when no cap is set', () => {
    render(<PointsTally totalPoints={0} pointsCap={null} />);
    expect(screen.getByText('0 pts')).toBeInTheDocument();
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('exposes progress via the progressbar role with correct values', () => {
    render(<PointsTally totalPoints={300} pointsCap={1000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '300');
    expect(bar).toHaveAttribute('aria-valuemax', '1000');
  });

  it('caps the visual fill at 100% even if somehow over cap', () => {
    const { container } = render(<PointsTally totalPoints={600} pointsCap={500} />);
    const fill = container.querySelector('[class*="barFill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});