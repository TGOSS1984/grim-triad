import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { RuleTriggerCallout } from './RuleTriggerCallout';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RuleTriggerCallout', () => {
  it('renders nothing when trigger is null', () => {
    render(<RuleTriggerCallout trigger={null} triggerKey={0} />);
    expect(screen.queryByText('SAME!')).not.toBeInTheDocument();
    expect(screen.queryByText('PLUS!')).not.toBeInTheDocument();
    expect(screen.queryByText('CHAIN!')).not.toBeInTheDocument();
  });

  it('shows "SAME!" for a same trigger', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={1} />,
    );
    expect(screen.getByText('SAME!')).toBeInTheDocument();
  });

  it('shows "PLUS!" for a plus trigger', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'plus', comboExtended: false }} triggerKey={1} />,
    );
    expect(screen.getByText('PLUS!')).toBeInTheDocument();
  });

  it('shows "CHAIN!" for a chain trigger', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'chain', comboExtended: false }} triggerKey={1} />,
    );
    expect(screen.getByText('CHAIN!')).toBeInTheDocument();
  });

  it('shows the "Chain Reaction!" flourish when comboExtended is true for same/plus', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: true }} triggerKey={1} />,
    );
    expect(screen.getByText('Chain Reaction!')).toBeInTheDocument();
  });

  it('does NOT show "Chain Reaction!" for a plain chain trigger (that IS the cascade already)', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'chain', comboExtended: true }} triggerKey={1} />,
    );
    expect(screen.queryByText('Chain Reaction!')).not.toBeInTheDocument();
  });

  it('does NOT show "Chain Reaction!" when comboExtended is false', () => {
    render(
      <RuleTriggerCallout trigger={{ kind: 'plus', comboExtended: false }} triggerKey={1} />,
    );
    expect(screen.queryByText('Chain Reaction!')).not.toBeInTheDocument();
  });

  it('schedules its own auto-dismiss timer (900ms) the moment a trigger fires, with no parent action needed', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={1} />,
    );

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 900);
  });

  it('calling the scheduled dismiss callback triggers a re-render (no error, callback is well-formed)', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={1} />,
    );
    const [dismissCallback] = setTimeoutSpy.mock.calls.find(([, ms]) => ms === 900)!;

    // Invoking the actual scheduled callback directly (rather than
    // depending on Framer Motion's exit ANIMATION completing under fake
    // timers, which is unreliable in jsdom - see the other tests here for
    // what's actually reliably testable) confirms the callback itself is
    // well-formed and doesn't throw.
    expect(() => act(() => (dismissCallback as () => void)())).not.toThrow();
  });

  it('schedules a NEW auto-dismiss timer when the same kind triggers again with a new triggerKey', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const { rerender } = render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={1} />,
    );
    const callsAfterFirstTrigger = setTimeoutSpy.mock.calls.length;

    rerender(<RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={2} />);

    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(callsAfterFirstTrigger);
  });

  it('does NOT schedule a new timer when re-rendered with the SAME triggerKey (not a new move)', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const { rerender } = render(
      <RuleTriggerCallout trigger={{ kind: 'plus', comboExtended: false }} triggerKey={1} />,
    );
    const callsAfterFirstTrigger = setTimeoutSpy.mock.calls.length;

    // Same triggerKey again - e.g. an unrelated re-render, not a new move.
    rerender(<RuleTriggerCallout trigger={{ kind: 'plus', comboExtended: false }} triggerKey={1} />);

    expect(setTimeoutSpy.mock.calls.length).toBe(callsAfterFirstTrigger);
  });

  it('is entirely decorative (aria-hidden), never competing with the game state itself', () => {
    const { container } = render(
      <RuleTriggerCallout trigger={{ kind: 'same', comboExtended: false }} triggerKey={1} />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});