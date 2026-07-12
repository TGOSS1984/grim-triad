import { describe, it, expect, beforeEach } from 'vitest';
import { useCampaignStore } from './campaignStore';

const STORAGE_KEY = 'grim-triad-campaign';

beforeEach(() => {
  useCampaignStore.getState().resetCampaign();
  localStorage.clear();
});

describe('campaignStore', () => {
  it('starts inactive with an empty collection and zeroed record', () => {
    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.collection).toEqual([]);
    expect(state.wins).toBe(0);
    expect(state.losses).toBe(0);
    expect(state.draws).toBe(0);
  });

  it('startCampaign seeds the collection and marks the run active', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);

    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('startCampaign resets any prior win/loss/draw record', () => {
    useCampaignStore.getState().startCampaign(['a']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().wins).toBe(1);

    useCampaignStore.getState().startCampaign(['b']);
    expect(useCampaignStore.getState().wins).toBe(0);
  });

  it('recordMatchResult increments the correct counter for win/loss/draw', () => {
    useCampaignStore.getState().startCampaign([]);

    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('draw', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    const state = useCampaignStore.getState();
    expect(state.wins).toBe(2);
    expect(state.losses).toBe(1);
    expect(state.draws).toBe(1);
  });

  it('recordMatchResult adds gained units to the collection', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-immortals'], []);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('recordMatchResult removes lost units from the collection', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-immortals']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-immortals']);
  });

  it('removes exactly ONE matching entry per lost id, not every copy (multiset, not a set)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard', 'necrons-lychguard', 'necrons-immortals']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard']);

    // Still has one Lychguard left - only one copy should have been removed.
    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard', 'necrons-immortals']);
  });

  it('a lost id not present in the collection is simply a no-op, not a crash', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('loss', [], ['not-actually-owned']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-lychguard']);
  });

  it('handles simultaneous gains and losses correctly in one call', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore
      .getState()
      .recordMatchResult('win', ['necrons-overlord', 'necrons-immortals'], ['necrons-lychguard']);

    expect(useCampaignStore.getState().collection).toEqual(['necrons-overlord', 'necrons-immortals']);
  });

  it('resetCampaign clears everything back to the initial state', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-overlord'], []);

    useCampaignStore.getState().resetCampaign();

    const state = useCampaignStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.collection).toEqual([]);
    expect(state.wins).toBe(0);
    expect(state.losses).toBe(0);
    expect(state.draws).toBe(0);
  });

  it('auto-persists to localStorage on every state change, with no explicit save action', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', ['necrons-overlord'], []);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.state.collection).toEqual(['necrons-lychguard', 'necrons-overlord']);
    expect(parsed.state.wins).toBe(1);
    expect(parsed.state.isActive).toBe(true);
  });
});