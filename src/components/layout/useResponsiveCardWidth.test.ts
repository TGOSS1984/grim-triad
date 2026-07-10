import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsiveCardWidth } from './useResponsiveCardWidth';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
}

const ORIGINAL_WIDTH = window.innerWidth;
const ORIGINAL_HEIGHT = window.innerHeight;

afterEach(() => {
  setViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT);
});

describe('useResponsiveCardWidth', () => {
  it('never returns below the minimum, even on a tiny viewport', () => {
    setViewport(200, 300);
    const { result } = renderHook(() => useResponsiveCardWidth());
    expect(result.current).toBeGreaterThanOrEqual(90);
  });

  it('never returns above the maximum, even on a huge viewport', () => {
    setViewport(4000, 3000);
    const { result } = renderHook(() => useResponsiveCardWidth());
    expect(result.current).toBeLessThanOrEqual(230);
  });

  it('is constrained by the SHORTER dimension - a wide-but-short viewport does not get an oversized card', () => {
    setViewport(3000, 400); // very wide, short
    const { result: wide } = renderHook(() => useResponsiveCardWidth());

    setViewport(400, 3000); // narrow, very tall
    const { result: tall } = renderHook(() => useResponsiveCardWidth());

    // Both should be small - each is capped by whichever of its own
    // dimensions is small (height for the wide case, width for the tall
    // case), not blown up by the other, large dimension.
    expect(wide.current).toBeLessThan(150);
    expect(tall.current).toBeLessThan(150);
  });

  it('recomputes on window resize', () => {
    setViewport(500, 500);
    const { result } = renderHook(() => useResponsiveCardWidth());
    const initial = result.current;

    act(() => {
      setViewport(2000, 2000);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBeGreaterThan(initial);
  });
});