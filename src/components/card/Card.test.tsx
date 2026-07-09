import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { CardBack } from './CardBack';

const baseProps = {
  name: 'Commander Dante',
  stats: { top: 8, bottom: 5, left: 6, right: 4 },
  portraitPath: 'assets/factions/blood-angels/units/commander-dante.png',
  owner: 'blue' as const,
};

describe('Card', () => {
  it('renders the unit name', () => {
    render(<Card {...baseProps} />);
    expect(screen.getAllByText('Commander Dante').length).toBeGreaterThan(0);
  });

  it('renders all four distinct stat values', () => {
    render(<Card {...baseProps} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays a stat value of 10 as "A"', () => {
    render(<Card {...baseProps} stats={{ top: 10, bottom: 1, left: 1, right: 1 }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders as a non-interactive element with an accessible img role by default', () => {
    render(<Card {...baseProps} />);
    const el = screen.getByRole('img', { name: 'Commander Dante' });
    expect(el.tagName).toBe('DIV');
  });

  it('renders as a button when interactive, and calls onClick', () => {
    const onClick = vi.fn();
    render(<Card {...baseProps} interactive onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('marks an interactive card as aria-pressed when selected', () => {
    render(<Card {...baseProps} interactive selected />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not render a button role when not interactive', () => {
    render(<Card {...baseProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not duplicate the accessible name on the portrait image (a11y: only the card container should be named)', () => {
    render(<Card {...baseProps} />);
    // The outer container carries the accessible name; the portrait <img>
    // must be decorative (empty alt) or screen readers announce the name
    // twice for one card.
    const portrait = screen.getByTestId('card-portrait');
    expect(portrait).toHaveAttribute('alt', '');
  });

  it('falls back to a text placeholder when the portrait image fails to load', () => {
    render(<Card {...baseProps} />);
    const portraitImg = screen.getByTestId('card-portrait');

    fireEvent.error(portraitImg);

    expect(screen.queryByTestId('card-portrait')).not.toBeInTheDocument();
    expect(screen.getAllByText('Commander Dante').length).toBeGreaterThan(0);
  });

  it('builds the portrait src as root-relative regardless of a leading slash', () => {
    render(<Card {...baseProps} portraitPath="assets/factions/necrons/units/lychguard.png" />);
    const img = screen.getByTestId('card-portrait') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/necrons/units/lychguard.png');
  });
});

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
});