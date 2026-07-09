import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { FactionIcon } from './FactionIcon';

describe('FactionIcon', () => {
  it('tries .png first', () => {
    const { container } = render(<FactionIcon slug="necrons" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/necrons/icon.png');
  });

  it('falls back to .webp if .png fails to load', () => {
    const { container } = render(<FactionIcon slug="necrons" />);
    fireEvent.error(container.querySelector('img')!);

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/necrons/icon.webp');
  });

  it('renders nothing if both .png and .webp fail to load', () => {
    const { container } = render(<FactionIcon slug="necrons" />);
    fireEvent.error(container.querySelector('img')!); // .png fails
    fireEvent.error(container.querySelector('img')!); // .webp fails too

    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('applies the given className to the image', () => {
    const { container } = render(<FactionIcon slug="necrons" className="my-icon" />);
    expect(container.querySelector('img')).toHaveClass('my-icon');
  });
});