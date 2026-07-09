import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardBack } from './CardBack';

describe('CardBack', () => {
  it('renders with an accessible "face-down" label', () => {
    render(<CardBack owner="red" />);
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
  });

  it('does not render any stat numbers or a name', () => {
    render(<CardBack owner="blue" />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('uses a dedicated back-image asset, not the front template', () => {
    render(<CardBack owner="blue" />);
    const img = screen.getByRole('img', { name: 'Face-down card' }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('/assets/cardTemplates/back-blue.png');
  });

  it('uses the owner-specific back image for red', () => {
    render(<CardBack owner="red" />);
    const img = screen.getByRole('img', { name: 'Face-down card' }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('/assets/cardTemplates/back-red.png');
  });

  it('shows the faction logo centered on the back when factionSlug is given', () => {
    render(<CardBack owner="blue" factionSlug="blood-angels" />);
    const container = screen.getByRole('img', { name: 'Face-down card' });
    const images = container.querySelectorAll('img');
    // Two images: the back template itself, plus the faction logo.
    expect(images).toHaveLength(2);
    expect(images[1].getAttribute('src')).toBe('/assets/factions/blood-angels/icon.png');
  });

  it('shows no logo image when factionSlug is omitted', () => {
    render(<CardBack owner="blue" />);
    const container = screen.getByRole('img', { name: 'Face-down card' });
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('falls back to .webp for the logo if .png fails to load', () => {
    render(<CardBack owner="blue" factionSlug="blood-angels" />);
    const container = screen.getByRole('img', { name: 'Face-down card' });
    const logo = container.querySelectorAll('img')[1];

    fireEvent.error(logo);

    const updated = container.querySelectorAll('img')[1];
    expect(updated.getAttribute('src')).toBe('/assets/factions/blood-angels/icon.webp');
  });
});