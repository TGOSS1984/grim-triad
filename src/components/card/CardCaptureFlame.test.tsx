import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CardCaptureFlame } from './CardCaptureFlame';

describe('CardCaptureFlame', () => {
  it("renders the fuse ring (an svg) during the 'shrinking' phase", () => {
    const { container } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it("does NOT render the fuse ring during the 'expanding' phase", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it("does NOT render the flash/embers during the 'shrinking' phase", () => {
    const { container } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('[class*="flash"]')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="ember"]')).not.toBeInTheDocument();
  });

  it("renders the flash and ember particles during the 'expanding' phase", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('[class*="flash"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="ember"]').length).toBeGreaterThan(0);
  });

  it('tints the flash toward blue when newOwner is blue', () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('[class*="flash-blue"]')).toBeInTheDocument();
  });

  it('tints the flash toward red when newOwner is red', () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="red" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('[class*="flash-red"]')).toBeInTheDocument();
  });

  it('is entirely decorative (aria-hidden), never competing with the card\'s own accessible name', () => {
    const { container } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('gives each rendered instance its own unique SVG gradient id (multiple cards can flip at once in a combo)', () => {
    const { container: a } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    const { container: b } = render(
      <CardCaptureFlame phase="shrinking" newOwner="red" halfDurationSeconds={0.35} />,
    );
    const idA = a.querySelector('linearGradient')?.id;
    const idB = b.querySelector('linearGradient')?.id;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});

describe('CardCaptureFlame per-rule visual tells', () => {
  it("defaults to the 'base' theme (embers) when captureKind is omitted - preserves the original effect exactly", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} />,
    );
    expect(container.querySelectorAll('[class*="ember"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[class*="pulseRing"]')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="spark"]')).not.toBeInTheDocument();
  });

  it("'base' captureKind explicitly renders embers, not pulse rings or sparks", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} captureKind="base" />,
    );
    expect(container.querySelectorAll('[class*="ember"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[class*="pulseRing"]')).not.toBeInTheDocument();
  });

  it("'same' renders concentric pulse rings, not embers or sparks", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} captureKind="same" />,
    );
    expect(container.querySelectorAll('[class*="pulseRing"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[class*="ember"]')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="spark"]')).not.toBeInTheDocument();
  });

  it("'plus' renders converging sparks, not embers or pulse rings", () => {
    const { container } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} captureKind="plus" />,
    );
    expect(container.querySelectorAll('[class*="spark"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[class*="ember"]')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="pulseRing"]')).not.toBeInTheDocument();
  });

  it("'cascade' renders embers (same particle mechanic as base), fewer of them, and a dashed ring", () => {
    const { container: cascadeContainer } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} captureKind="cascade" />,
    );
    const { container: baseContainer } = render(
      <CardCaptureFlame phase="expanding" newOwner="blue" halfDurationSeconds={0.35} captureKind="base" />,
    );
    const cascadeEmbers = cascadeContainer.querySelectorAll('[class*="ember"]').length;
    const baseEmbers = baseContainer.querySelectorAll('[class*="ember"]').length;
    expect(cascadeEmbers).toBeGreaterThan(0);
    expect(cascadeEmbers).toBeLessThan(baseEmbers);
  });

  it("'cascade' shrinking-phase ring has an extra dashed overlay circle, unlike the other three kinds", () => {
    const { container: cascade } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} captureKind="cascade" />,
    );
    const { container: base } = render(
      <CardCaptureFlame phase="shrinking" newOwner="blue" halfDurationSeconds={0.35} captureKind="base" />,
    );
    // Not asserting on stroke-dasharray directly - Framer Motion's
    // pathLength animation sets that attribute on EVERY fuseBurn circle
    // internally regardless of theme, so its mere presence isn't a
    // reliable signal (confirmed while building this: my first attempt
    // tried a custom strokeDasharray prop on the animated circle itself,
    // and it silently never took effect for exactly this reason).
    expect(cascade.querySelector('[class*="fuseDashOverlay"]')).toBeInTheDocument();
    expect(base.querySelector('[class*="fuseDashOverlay"]')).not.toBeInTheDocument();
  });

  it('every capture kind still shows the owner-tinted flash regardless of its particle style', () => {
    for (const kind of ['base', 'same', 'plus', 'cascade'] as const) {
      const { container } = render(
        <CardCaptureFlame phase="expanding" newOwner="red" halfDurationSeconds={0.35} captureKind={kind} />,
      );
      expect(container.querySelector('[class*="flash-red"]')).toBeInTheDocument();
    }
  });
});