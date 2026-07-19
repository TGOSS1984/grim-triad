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

  it('uses the plain template for a unit with no Epic Hero keyword', () => {
    render(<Card {...baseProps} owner="blue" keywords={['Character']} />);
    const frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue.png');
    expect(frame.src).not.toContain('template-blue-epic.png');
  });

  it('uses the plain template when keywords is omitted entirely', () => {
    render(<Card {...baseProps} owner="blue" />);
    const frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue.png');
    expect(frame.src).not.toContain('-epic.png');
  });

  it('uses the epic template variant for a unit with the Epic Hero keyword, for both owners', async () => {
    const { rerender } = render(<Card {...baseProps} owner="blue" keywords={['Character', 'Epic Hero']} />);
    let frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
    expect(frame.src).toContain('template-blue-epic.png');

    rerender(<Card {...baseProps} owner="red" keywords={['Character', 'Epic Hero']} />);
    await waitFor(() => {
      frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
      expect(frame.src).toContain('template-red-epic.png');
    });
  });

  it('an Epic Hero card still shows the epic template after a capture flip swaps its owner', async () => {
    const { rerender } = render(<Card {...baseProps} owner="blue" keywords={['Monster', 'Epic Hero']} />);
    rerender(<Card {...baseProps} owner="red" keywords={['Monster', 'Epic Hero']} />);

    await waitFor(() => {
      const frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
      expect(frame.src).toContain('template-red-epic.png');
    });
  });

  it('shows no element badge when element is not provided', () => {
    render(<Card {...baseProps} />);
    expect(screen.queryByRole('img', { name: /affinity/ })).not.toBeInTheDocument();
  });

  describe('capture flame overlay', () => {
    it('renders no flame overlay when the card has never flipped', () => {
      render(<Card {...baseProps} owner="blue" />);
      expect(document.querySelector('[class*="overlay"]')).not.toBeInTheDocument();
    });

    it('renders the flame overlay while a capture flip is in progress', async () => {
      const { rerender } = render(<Card {...baseProps} owner="blue" />);
      rerender(<Card {...baseProps} owner="red" />);

      await waitFor(() => {
        expect(document.querySelector('[class*="overlay"]')).toBeInTheDocument();
      });
    });

    it('removes the flame overlay once the flip has fully completed', async () => {
      const { rerender } = render(<Card {...baseProps} owner="blue" />);
      rerender(<Card {...baseProps} owner="red" />);

      // Wait for the flip to actually finish (template swapped), then for
      // the overlay itself to be gone.
      await waitFor(() => {
        const frame = document.querySelector('img[src*="template-"]') as HTMLImageElement;
        expect(frame.src).toContain('template-red.png');
      });
      await waitFor(() => {
        expect(document.querySelector('[class*="overlay"]')).not.toBeInTheDocument();
      });
    });

    it('does not render a flame overlay on the initial mount, even with a flipDelayMs prop set', () => {
      render(<Card {...baseProps} owner="blue" flipDelayMs={500} />);
      expect(document.querySelector('[class*="overlay"]')).not.toBeInTheDocument();
    });

    it("passes captureKind through to the flame, so a 'same' capture shows pulse rings instead of the default embers", async () => {
      const { rerender } = render(<Card {...baseProps} owner="blue" captureKind="same" />);
      rerender(<Card {...baseProps} owner="red" captureKind="same" />);

      await waitFor(() => {
        expect(document.querySelector('[class*="overlay"]')).toBeInTheDocument();
      });
      // Wait through to the expand phase, where particles actually render.
      await waitFor(() => {
        expect(
          document.querySelector('[class*="pulseRing"]') ?? document.querySelector('[class*="ember"]'),
        ).toBeInTheDocument();
      });
      expect(document.querySelector('[class*="pulseRing"]')).toBeInTheDocument();
      expect(document.querySelector('[class*="ember"]')).not.toBeInTheDocument();
    });
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

describe('Card buff/debuff display (effectiveStats)', () => {
  it('shows the plain printed value with no special styling when effectiveStats is omitted', () => {
    render(<Card {...baseProps} />);
    const topStat = screen.getByText('8');
    expect(topStat.className).not.toMatch(/statBuffed|statDebuffed/);
  });

  it('shows the plain printed value when effectiveStats is identical to stats', () => {
    render(<Card {...baseProps} effectiveStats={{ ...baseProps.stats }} />);
    const topStat = screen.getByText('8');
    expect(topStat.className).not.toMatch(/statBuffed|statDebuffed/);
  });

  it('shows the EFFECTIVE value, buffed-styled, when a side is higher than printed', () => {
    render(<Card {...baseProps} effectiveStats={{ ...baseProps.stats, top: 9 }} />);

    // The printed value (8) should no longer be shown for that side -
    // the effective value (9) replaces it, not just gets an extra badge.
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    const buffedStat = screen.getByText('9');
    expect(buffedStat.className).toMatch(/statBuffed/);
  });

  it('shows the EFFECTIVE value, debuffed-styled, when a side is lower than printed', () => {
    render(<Card {...baseProps} effectiveStats={{ ...baseProps.stats, top: 7 }} />);

    expect(screen.queryByText('8')).not.toBeInTheDocument();
    const debuffedStat = screen.getByText('7');
    expect(debuffedStat.className).toMatch(/statDebuffed/);
  });

  it('only the affected side gets buff/debuff styling - the other three stay plain', () => {
    render(<Card {...baseProps} effectiveStats={{ ...baseProps.stats, top: 9 }} />);

    const bottomStat = screen.getByText('5'); // unaffected
    const leftStat = screen.getByText('6'); // unaffected
    const rightStat = screen.getByText('4'); // unaffected
    expect(bottomStat.className).not.toMatch(/statBuffed|statDebuffed/);
    expect(leftStat.className).not.toMatch(/statBuffed|statDebuffed/);
    expect(rightStat.className).not.toMatch(/statBuffed|statDebuffed/);
  });

  it('handles buffed and debuffed sides simultaneously on the same card (e.g. Elemental affects all four sides at once)', () => {
    render(
      <Card
        {...baseProps}
        effectiveStats={{ top: 9, bottom: 6, left: 5, right: 3 }} // top/bottom +1, left/right -1
      />,
    );

    expect(screen.getByText('9').className).toMatch(/statBuffed/);
    expect(screen.getByText('6').className).toMatch(/statBuffed/);
    expect(screen.getByText('5').className).toMatch(/statDebuffed/);
    expect(screen.getByText('3').className).toMatch(/statDebuffed/);
  });

  it("caps A (10) display correctly for a buffed value that reaches the max", () => {
    render(<Card {...baseProps} stats={{ top: 9, bottom: 5, left: 6, right: 4 }} effectiveStats={{ top: 10, bottom: 5, left: 6, right: 4 }} />);

    const topStat = screen.getByText('A');
    expect(topStat.className).toMatch(/statBuffed/);
  });

  it('describes a buffed side verbally in the accessible name, not just via colour', () => {
    render(<Card {...baseProps} interactive effectiveStats={{ ...baseProps.stats, top: 9 }} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/top 9, buffed from 8/);
  });

  it('describes a debuffed side verbally in the accessible name, not just via colour', () => {
    render(<Card {...baseProps} interactive effectiveStats={{ ...baseProps.stats, left: 4 }} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/left 4, debuffed from 6/);
  });

  it('does not mention buffed/debuffed in the accessible name for an unaffected side', () => {
    render(<Card {...baseProps} interactive effectiveStats={{ ...baseProps.stats, top: 9 }} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/bottom 5(?!, buffed)(?!, debuffed)/);
  });
});