import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Card } from './Card';

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

  it('shows the primary portrait when it loads successfully (no fallback needed)', () => {
    render(<Card {...baseProps} />);
    const img = screen.getByTestId('card-portrait') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(
      '/assets/factions/blood-angels/units/commander-dante.png',
    );
  });

  it('renders nothing in the portrait window (letting parchment show through) when the primary fails and no fallback image is configured', () => {
    render(<Card {...baseProps} />);
    fireEvent.error(screen.getByTestId('card-portrait'));

    expect(screen.queryByTestId('card-portrait')).not.toBeInTheDocument();
    // The name should appear exactly once (the name plate) - it must NOT
    // be duplicated as a fallback placeholder, since that duplication is
    // what previously caused stacked/overlapped hand cards to look like
    // illegible text soup (see Hand overlap fix history).
    expect(screen.getAllByText('Commander Dante')).toHaveLength(1);
  });

  it('falls to the faction fallback image when the primary fails and a fallback is configured', () => {
    render(
      <Card
        {...baseProps}
        fallbackPortraitPath="assets/factions/blood-angels/_fallback.png"
      />,
    );

    fireEvent.error(screen.getByTestId('card-portrait'));

    const img = screen.getByTestId('card-portrait') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/blood-angels/_fallback.png');
  });

  it('renders nothing in the portrait window if both the primary and the fallback image fail', () => {
    render(
      <Card
        {...baseProps}
        fallbackPortraitPath="assets/factions/blood-angels/_fallback.png"
      />,
    );

    fireEvent.error(screen.getByTestId('card-portrait')); // primary fails -> fallback image
    fireEvent.error(screen.getByTestId('card-portrait')); // fallback image also fails -> nothing

    expect(screen.queryByTestId('card-portrait')).not.toBeInTheDocument();
    expect(screen.getAllByText('Commander Dante')).toHaveLength(1);
  });

  it('resets to the primary portrait when portraitPath changes (reused component, different unit)', () => {
    const { rerender } = render(<Card {...baseProps} />);
    fireEvent.error(screen.getByTestId('card-portrait')); // -> text fallback
    expect(screen.queryByTestId('card-portrait')).not.toBeInTheDocument();

    rerender(
      <Card
        {...baseProps}
        name="Lychguard"
        portraitPath="assets/factions/necrons/units/lychguard.png"
      />,
    );

    // A different unit's portrait should get a fresh attempt, not stay
    // stuck on the previous unit's fallback state.
    const img = screen.getByTestId('card-portrait') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/necrons/units/lychguard.png');
  });

  it('builds the portrait src as root-relative regardless of a leading slash', () => {
    render(<Card {...baseProps} portraitPath="assets/factions/necrons/units/lychguard.png" />);
    const img = screen.getByTestId('card-portrait') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/factions/necrons/units/lychguard.png');
  });

  it('applies the given layoutId to the rendered root element (enables the flying placement animation)', () => {
    render(<Card {...baseProps} layoutId="card-instance-42" />);
    // Framer Motion's layoutId isn't exposed as a DOM attribute directly,
    // but the root element should still render normally with it applied -
    // this is mostly a smoke test that passing layoutId doesn't break
    // rendering (Framer Motion manages the actual animation internally).
    expect(screen.getByRole('img', { name: 'Commander Dante' })).toBeInTheDocument();
  });

  it('eventually swaps the rendered template to the new owner after a capture (owner prop change)', async () => {
    const { rerender } = render(<Card {...baseProps} owner="blue" />);
    let frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue.png');

    rerender(<Card {...baseProps} owner="red" />);

    await waitFor(() => {
      frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
      expect(frame.src).toContain('template-red.png');
    });
  });

  it('does not change the rendered template if owner stays the same across a rerender', () => {
    const { rerender } = render(<Card {...baseProps} owner="blue" />);
    rerender(<Card {...baseProps} owner="blue" stats={{ top: 1, bottom: 1, left: 1, right: 1 }} />);

    const frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue.png');
  });

  it('respects flipDelayMs, only swapping the template after the delay has elapsed', async () => {
    const { rerender } = render(<Card {...baseProps} owner="blue" flipDelayMs={400} />);
    rerender(<Card {...baseProps} owner="red" flipDelayMs={400} />);

    // Immediately after the rerender (well under the 400ms delay plus the
    // flip's own transition time), the template should NOT have swapped
    // yet - the delay is actually being honoured, not just accepted as a
    // no-op prop.
    await new Promise((resolve) => setTimeout(resolve, 100));
    let frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue.png');

    // After enough time for the delay plus the flip itself, it should
    // have completed.
    await waitFor(
      () => {
        frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
        expect(frame.src).toContain('template-red.png');
      },
      { timeout: 2000 },
    );
  });

  it('shows no element badge when element is not provided', () => {
    render(<Card {...baseProps} />);
    expect(screen.queryByRole('img', { name: /affinity/ })).not.toBeInTheDocument();
  });

  it('shows an element badge with an accessible label when element is provided', () => {
    render(<Card {...baseProps} element="toxic" />);
    expect(screen.getByRole('img', { name: 'Toxic affinity' })).toBeInTheDocument();
  });

  it('shows the correct icon/label for each element', () => {
    const cases: [string, string][] = [
      ['warp', 'Warp affinity'],
      ['promethium', 'Promethium affinity'],
      ['void', 'Void affinity'],
      ['toxic', 'Toxic affinity'],
      ['radiation', 'Radiation affinity'],
    ];
    for (const [element, label] of cases) {
      const { unmount } = render(
        <Card {...baseProps} element={element as 'warp' | 'promethium' | 'void' | 'toxic' | 'radiation'} />,
      );
      expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
      unmount();
    }
  });
});