import { describe, it, expect, beforeEach } from 'vitest';
import { useSeriesStore, ROUND_HAND_SIZE } from './seriesStore';

function pool(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}

beforeEach(() => {
  useSeriesStore.getState().reset();
});

describe('initSeries', () => {
  it('sets up pools, round number, and clears any prior state', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));

    const state = useSeriesStore.getState();
    expect(state.poolSize).toBe(15);
    expect(state.bluePool).toHaveLength(15);
    expect(state.redPool).toHaveLength(15);
    expect(state.roundNumber).toBe(1);
    expect(state.blueWins).toBe(0);
    expect(state.redWins).toBe(0);
    expect(state.seriesWinner).toBeNull();
    expect(state.roundHistory).toEqual([]);
  });
});

describe('drawRoundHands', () => {
  it('draws exactly ROUND_HAND_SIZE cards from each pool', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));

    const { blueHand, redHand } = useSeriesStore.getState().drawRoundHands();

    expect(blueHand).toHaveLength(ROUND_HAND_SIZE);
    expect(redHand).toHaveLength(ROUND_HAND_SIZE);
  });

  it('removes the drawn cards from the remaining pool', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));

    const { blueHand } = useSeriesStore.getState().drawRoundHands();

    const { bluePool } = useSeriesStore.getState();
    expect(bluePool).toHaveLength(10);
    for (const id of blueHand) {
      expect(bluePool).not.toContain(id);
    }
  });

  it('never repeats a card across multiple draws (no replacement)', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));

    const draw1 = useSeriesStore.getState().drawRoundHands();
    const draw2 = useSeriesStore.getState().drawRoundHands();
    const draw3 = useSeriesStore.getState().drawRoundHands();

    const allBlueDrawn = [...draw1.blueHand, ...draw2.blueHand, ...draw3.blueHand];
    expect(new Set(allBlueDrawn).size).toBe(15); // all 15 unique, none repeated
    expect(useSeriesStore.getState().bluePool).toHaveLength(0);
  });
});

describe('applyRoundResult', () => {
  it('tallies a win for the correct side', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));
    useSeriesStore.getState().drawRoundHands();

    useSeriesStore.getState().applyRoundResult('blue', []);

    const state = useSeriesStore.getState();
    expect(state.blueWins).toBe(1);
    expect(state.redWins).toBe(0);
    expect(state.roundNumber).toBe(2);
  });

  it('adds trade-transferred units to the winner pool as a bonus', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));
    useSeriesStore.getState().drawRoundHands(); // bluePool now 10, redPool now 10

    useSeriesStore.getState().applyRoundResult('blue', [
      { unitId: 'red-captured-1', to: 'blue' },
      { unitId: 'red-captured-2', to: 'blue' },
    ]);

    const { bluePool } = useSeriesStore.getState();
    expect(bluePool).toHaveLength(12); // 10 remaining + 2 bonus
    expect(bluePool).toContain('red-captured-1');
    expect(bluePool).toContain('red-captured-2');
  });

  it('records a round history entry', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));
    useSeriesStore.getState().drawRoundHands();

    useSeriesStore.getState().applyRoundResult('red', [{ unitId: 'x', to: 'red' }]);

    const { roundHistory } = useSeriesStore.getState();
    expect(roundHistory).toEqual([
      { roundNumber: 1, winner: 'red', tradeTransferred: [{ unitId: 'x', to: 'red' }] },
    ]);
  });

  it('does not end the series while both pools can still field a round', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));
    useSeriesStore.getState().drawRoundHands();

    useSeriesStore.getState().applyRoundResult('blue', []);

    expect(useSeriesStore.getState().seriesWinner).toBeNull();
  });

  it('ends the series in favour of the side that can still field a round', () => {
    // Small pools so one side runs out fast.
    useSeriesStore.getState().initSeries(pool('blue', 10), pool('red', 5));
    useSeriesStore.getState().drawRoundHands(); // blue: 5 left, red: 0 left

    useSeriesStore.getState().applyRoundResult('blue', []);

    expect(useSeriesStore.getState().seriesWinner).toBe('blue');
  });

  it('when both pools run out simultaneously, the side with more round wins takes the series', () => {
    useSeriesStore.getState().initSeries(pool('blue', 5), pool('red', 5));
    useSeriesStore.getState().drawRoundHands(); // both pools now empty

    useSeriesStore.getState().applyRoundResult('blue', []);

    expect(useSeriesStore.getState().seriesWinner).toBe('blue');
  });

  it('is a series draw if both pools run out with equal round wins', () => {
    // Two rounds, one win each, both pools exhausted after round 2.
    useSeriesStore.getState().initSeries(pool('blue', 10), pool('red', 10));
    useSeriesStore.getState().drawRoundHands();
    useSeriesStore.getState().applyRoundResult('blue', []);
    useSeriesStore.getState().drawRoundHands(); // both pools now empty
    useSeriesStore.getState().applyRoundResult('red', []);

    expect(useSeriesStore.getState().seriesWinner).toBe('draw');
  });

  it('a trade bonus can rescue a side from elimination it would otherwise face', () => {
    useSeriesStore.getState().initSeries(pool('blue', 5), pool('red', 15));
    useSeriesStore.getState().drawRoundHands(); // bluePool now empty, would eliminate blue if it loses

    // Blue wins this round and receives enough trade bonus cards to field
    // another round - the series should NOT end, since blue can continue.
    useSeriesStore.getState().applyRoundResult('blue', [
      { unitId: 'bonus-1', to: 'blue' },
      { unitId: 'bonus-2', to: 'blue' },
      { unitId: 'bonus-3', to: 'blue' },
      { unitId: 'bonus-4', to: 'blue' },
      { unitId: 'bonus-5', to: 'blue' },
    ]);

    expect(useSeriesStore.getState().bluePool).toHaveLength(5);
    expect(useSeriesStore.getState().seriesWinner).toBeNull();
  });

  it('without a rescuing trade bonus, an empty pool after a win still ends the series for the OTHER side (not the winner)', () => {
    useSeriesStore.getState().initSeries(pool('blue', 10), pool('red', 5));
    useSeriesStore.getState().drawRoundHands(); // red pool now empty

    useSeriesStore.getState().applyRoundResult('blue', []);

    expect(useSeriesStore.getState().seriesWinner).toBe('blue');
  });
});

describe('reset', () => {
  it('clears all series state back to defaults', () => {
    useSeriesStore.getState().initSeries(pool('blue', 15), pool('red', 15));
    useSeriesStore.getState().drawRoundHands();
    useSeriesStore.getState().applyRoundResult('blue', []);

    useSeriesStore.getState().reset();

    const state = useSeriesStore.getState();
    expect(state.poolSize).toBeNull();
    expect(state.bluePool).toEqual([]);
    expect(state.redPool).toEqual([]);
    expect(state.roundNumber).toBe(0);
    expect(state.seriesWinner).toBeNull();
  });
});