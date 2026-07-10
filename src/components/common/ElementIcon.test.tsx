import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ElementIcon } from './ElementIcon';

describe('ElementIcon', () => {
  it('renders an svg icon for every element type without crashing', () => {
    const elements = ['warp', 'promethium', 'void', 'toxic', 'radiation'] as const;
    for (const element of elements) {
      const { container } = render(<ElementIcon element={element} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    }
  });

  it('is decorative (aria-hidden, no img role) when no title is given', () => {
    const { container } = render(<ElementIcon element="warp" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role', 'img');
  });

  it('exposes an accessible name when a title is given', () => {
    const { container } = render(<ElementIcon element="warp" title="Warp terrain" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Warp terrain');
  });

  it('applies the given className', () => {
    const { container } = render(<ElementIcon element="toxic" className="my-icon" />);
    expect(container.querySelector('svg')).toHaveClass('my-icon');
  });

  it('uses a distinct colour per element', () => {
    const colors = new Set<string | null>();
    const elements = ['warp', 'promethium', 'void', 'toxic', 'radiation'] as const;
    for (const element of elements) {
      const { container } = render(<ElementIcon element={element} />);
      colors.add(container.querySelector('svg')?.getAttribute('color') ?? null);
    }
    expect(colors.size).toBe(elements.length);
  });
});