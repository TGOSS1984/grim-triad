import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveGameLayout } from './ResponsiveGameLayout';

describe('ResponsiveGameLayout', () => {
  it('renders all three slots', () => {
    render(
      <ResponsiveGameLayout
        left={<div>Left Hand</div>}
        center={<div>The Board</div>}
        right={<div>Right Hand</div>}
      />,
    );

    expect(screen.getByText('Left Hand')).toBeInTheDocument();
    expect(screen.getByText('The Board')).toBeInTheDocument();
    expect(screen.getByText('Right Hand')).toBeInTheDocument();
  });
});