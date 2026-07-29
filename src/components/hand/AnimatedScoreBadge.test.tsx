import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnimatedScoreBadge } from './AnimatedScoreBadge';

describe('AnimatedScoreBadge', () => {
  it('renders the initial value and label', () => {
    render(<AnimatedScoreBadge value={3} label="Captured" />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Captured')).toBeInTheDocument();
  });

  it('eventually displays the new value after an increase', async () => {
    const { rerender } = render(<AnimatedScoreBadge value={1} label="Captured" />);
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(<AnimatedScoreBadge value={4} label="Captured" />);

    await waitFor(
      () => {
        expect(screen.getByText('4')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('eventually displays the new value after a decrease', async () => {
    const { rerender } = render(<AnimatedScoreBadge value={5} label="Captured" />);

    rerender(<AnimatedScoreBadge value={2} label="Captured" />);

    await waitFor(
      () => {
        expect(screen.getByText('2')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('shows the "up" flash treatment while counting up toward an increase', async () => {
    const { rerender, container } = render(<AnimatedScoreBadge value={1} label="Captured" />);

    rerender(<AnimatedScoreBadge value={3} label="Captured" />);

    await waitFor(() => {
      expect(container.querySelector('[class*="valueUp"]')).toBeInTheDocument();
    });
  });

  it('shows the "down" flash treatment while counting down toward a decrease', async () => {
    const { rerender, container } = render(<AnimatedScoreBadge value={5} label="Captured" />);

    rerender(<AnimatedScoreBadge value={2} label="Captured" />);

    await waitFor(() => {
      expect(container.querySelector('[class*="valueDown"]')).toBeInTheDocument();
    });
  });

  it('does not show a flash treatment when re-rendered with the same value', () => {
    const { rerender, container } = render(<AnimatedScoreBadge value={2} label="Captured" />);

    rerender(<AnimatedScoreBadge value={2} label="Captured" />);

    expect(container.querySelector('[class*="valueUp"]')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="valueDown"]')).not.toBeInTheDocument();
  });

  it('the flash treatment eventually clears once the change has settled', async () => {
    const { rerender, container } = render(<AnimatedScoreBadge value={1} label="Captured" />);

    rerender(<AnimatedScoreBadge value={2} label="Captured" />);
    await waitFor(() => {
      expect(container.querySelector('[class*="valueUp"]')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(container.querySelector('[class*="valueUp"]')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});