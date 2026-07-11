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