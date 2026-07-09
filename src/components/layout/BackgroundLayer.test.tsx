import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BackgroundLayer } from './BackgroundLayer';

describe('BackgroundLayer', () => {
  it('renders without a background-image style when no imagePath is given', () => {
    const { container } = render(<BackgroundLayer />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundImage).toBe('');
  });

  it('sets a root-relative background-image url when imagePath is given', () => {
    const { container } = render(<BackgroundLayer imagePath="assets/backgrounds/battle-01.jpg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundImage).toContain('/assets/backgrounds/battle-01.jpg');
  });

  it('is hidden from assistive tech (decorative)', () => {
    const { container } = render(<BackgroundLayer />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});