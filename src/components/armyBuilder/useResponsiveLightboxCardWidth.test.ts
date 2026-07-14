import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsiveLightboxCardWidth } from './useResponsiveLightboxCardWidth';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
}

const ORIGINAL_WIDTH = window.innerWidth;
const ORIGINAL_HEIGHT = window.innerHeight;

afterEach(() => {
  setViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT);
});

describe('useResponsiveLightboxCardWidth', () => {
  it('never returns below the minimum, even on a tiny viewport', () => {
    setViewport(200, 300);
    const { result } = renderHook(() => useResponsiveLightboxCardWidth());
    expect(result.current).toBeGreaterThanOrEqual(160);
  });

  it('never returns above the maximum, even on a huge viewport', () => {
    setViewport(4000, 3000);
    const { result } = renderHook(() => useResponsiveLightboxCardWidth());
    expect(result.current).toBeLessThanOrEqual(480);
  });

  it('reaches close to the 480px desktop max on a typical desktop window', () => {
    setViewport(1440, 900);
    const { result } = renderHook(() => useResponsiveLightboxCardWidth());
    expect(result.current).toBe(480);
  });

  it('a real iPhone SE viewport (375x667) gets a card meaningfully smaller than the desktop max - the actual bug this fixes', () => {
    setViewport(375, 667);
    const { result } = renderHook(() => useResponsiveLightboxCardWidth());

    expect(result.current).toBeLessThan(480);
    // Card aspect ratio is 1024:1536 (width:height) - the resulting
    // height must still fit comfortably within the viewport, with room
    // left over for the Lightbox's own close button and padding.
    const impliedHeight = result.current * (1536 / 1024);
    expect(impliedHeight).toBeLessThan(667 * 0.85);
  });

  it('is constrained by the SHORTER dimension - a wide-but-short viewport does not get an oversized card', () => {
    setViewport(3000, 400); // very wide, short - height (400*0.55=220) should bind
    const { result: wide } = renderHook(() => useResponsiveLightboxCardWidth());
    expect(wide.current).toBe(220);

    setViewport(400, 3000); // narrow, very tall - width (400*0.8=320) should bind
    const { result: tall } = renderHook(() => useResponsiveLightboxCardWidth());
    expect(tall.current).toBe(320);

    // Both meaningfully smaller than the 480 desktop max - neither large
    // dimension gets to blow the card up past what its OWN small
    // dimension can actually fit.
    expect(wide.current).toBeLessThan(480);
    expect(tall.current).toBeLessThan(480);
  });

  it('recomputes on window resize', () => {
    setViewport(300, 400);
    const { result } = renderHook(() => useResponsiveLightboxCardWidth());
    const initial = result.current;

    act(() => {
      setViewport(2000, 2000);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBeGreaterThan(initial);
  });
});