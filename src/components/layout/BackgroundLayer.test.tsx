import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BackgroundLayer } from './BackgroundLayer';

describe('BackgroundLayer', () => {
  it('renders with only the tint gradient class when no imagePath is given', () => {
    const { container } = render(<BackgroundLayer />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain('hasImage');
    expect(el.style.getPropertyValue('--bg-photo')).toBe('');
  });

  it('sets a root-relative --bg-photo custom property when imagePath is given', () => {
    const { container } = render(<BackgroundLayer imagePath="assets/backgrounds/battle-01.jpg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue('--bg-photo')).toContain('/assets/backgrounds/battle-01.jpg');
  });

  it('adds the hasImage class when imagePath is given, so the CSS module layers the tint gradient over the photo rather than replacing it', () => {
    const { container } = render(<BackgroundLayer imagePath="assets/backgrounds/battle-01.jpg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hasImage');
  });

  it('is hidden from assistive tech (decorative)', () => {
    const { container } = render(<BackgroundLayer />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});