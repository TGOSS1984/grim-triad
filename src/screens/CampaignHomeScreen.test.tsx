import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignHomeScreen, type CampaignHomeScreenProps } from './CampaignHomeScreen';
import { useCampaignStore } from '../state/campaignStore';
import { getObtainableUnitIds } from '../data/collectionProgress';

beforeEach(() => {
  useCampaignStore.getState().resetCampaign();
  // resetCampaign() deliberately does NOT clear unlockedAchievementIds,
  // bestWinStreak, hasCompletedCollection, or hasVanquishedRival in
  // production (all four survive across runs) - tests need a clean slate
  // regardless, same bypass campaignStore.test.ts itself uses.
  useCampaignStore.setState({
    unlockedAchievementIds: [],
    bestWinStreak: 0,
    hasCompletedCollection: false,
    hasVanquishedRival: false,
  });
  localStorage.clear();
});

/** Renders CampaignHomeScreen with sensible defaults for every prop - individual tests only need to override what they actually care about. */
function renderScreen(overrides: Partial<CampaignHomeScreenProps> = {}) {
  const props: CampaignHomeScreenProps = {
    onContinue: vi.fn(),
    onStartNewRun: vi.fn(),
    onReinforceRival: vi.fn(),
    onViewProgress: vi.fn(),
    ...overrides,
  };
  render(<CampaignHomeScreen {...props} />);
  return props;
}

describe('CampaignHomeScreen with no active run', () => {
  it('shows a description and a Start New Run button, no stats', () => {
    renderScreen();

    expect(screen.getByText(/Build a starting roster/)).toBeInTheDocument();
    expect(screen.queryByText('Cards owned')).not.toBeInTheDocument();
  });

  it('calls onStartNewRun immediately when clicked - no confirm needed with nothing to lose', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));

    expect(onStartNewRun).toHaveBeenCalledOnce();
  });
});

describe('CampaignHomeScreen with an active run', () => {
  beforeEach(() => {
    useCampaignStore.getState().startCampaign([
      'necrons-lychguard',
      'necrons-immortals',
      'necrons-overlord',
      'necrons-royal-warden',
      'necrons-technomancer',
    ]);
  });

  it('shows the current collection size and win/loss/draw record', () => {
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('draw', [], []);

    renderScreen();

    expect(screen.getByText('5')).toBeInTheDocument(); // cards owned
    expect(screen.getByText('Cards owned')).toBeInTheDocument();
    expect(screen.getByText('Wins')).toBeInTheDocument();
    expect(screen.getByText('Losses')).toBeInTheDocument();
    expect(screen.getByText('Draws')).toBeInTheDocument();
  });

  it('enables Continue when both the collection and the rival pool have at least 5 cards', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeEnabled();
  });

  it('calls onContinue when Continue is clicked', async () => {
    const user = userEvent.setup();
    const { onContinue } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Continue Campaign' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('disables Continue and shows a warning once the collection drops below 5 cards', () => {
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard', 'necrons-immortals']);

    renderScreen();

    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Your collection has fallen below 5 cards');
  });

  it('requires a two-step confirm before starting a new run, since it discards progress', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(screen.getByText(/permanently discard/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, Start Over' }));
    expect(onStartNewRun).toHaveBeenCalledOnce();
  });

  it('cancels the new-run confirmation without calling onStartNewRun', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start New Run' })).toBeInTheDocument();
  });
});

describe('CampaignHomeScreen rival depletion (Option B)', () => {
  it('disables Continue and shows a distinct warning once the AI pool drops below 5 cards, even with a healthy collection', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    const almostEverything = Array.from(getObtainableUnitIds()).slice(0, -3); // leaves 3 for the AI
    useCampaignStore.getState().recordMatchResult('win', almostEverything, []);

    renderScreen();

    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent("Your rival's pool has fallen below 5 cards");
  });

  it('does NOT show the rival-depleted warning while the AI pool is healthy', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);

    renderScreen();

    expect(screen.queryByText(/rival's pool has fallen/)).not.toBeInTheDocument();
  });

  it('shows a "Reinforce Rival" button only when the AI pool is depleted', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    const almostEverything = Array.from(getObtainableUnitIds()).slice(0, -3);
    useCampaignStore.getState().recordMatchResult('win', almostEverything, []);

    renderScreen();

    expect(screen.getByRole('button', { name: 'Reinforce Rival' })).toBeInTheDocument();
  });

  it('does NOT show a "Reinforce Rival" button while the AI pool is healthy', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);

    renderScreen();

    expect(screen.queryByRole('button', { name: 'Reinforce Rival' })).not.toBeInTheDocument();
  });

  it('calls onReinforceRival when "Reinforce Rival" is clicked', async () => {
    const user = userEvent.setup();
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    const almostEverything = Array.from(getObtainableUnitIds()).slice(0, -3);
    useCampaignStore.getState().recordMatchResult('win', almostEverything, []);

    const { onReinforceRival } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Reinforce Rival' }));

    expect(onReinforceRival).toHaveBeenCalledOnce();
  });

  it('re-enables Continue once the store itself reflects a reinforced pool (integration of the store action, not just the button click)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    const almostEverything = Array.from(getObtainableUnitIds()).slice(0, -3);
    useCampaignStore.getState().recordMatchResult('win', almostEverything, []);
    useCampaignStore.getState().reinforceRival();

    renderScreen();

    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Reinforce Rival' })).not.toBeInTheDocument();
  });
});

describe('CampaignHomeScreen navigation', () => {
  it('calls onViewProgress when the "View Progress & Achievements" link is clicked', async () => {
    const user = userEvent.setup();
    const { onViewProgress } = renderScreen();

    await user.click(screen.getByRole('button', { name: /View Progress/ }));

    expect(onViewProgress).toHaveBeenCalledOnce();
  });

  it('shows the View Progress link even with no active run - achievements/progress are permanent, not tied to an active campaign', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /View Progress/ })).toBeInTheDocument();
  });
});

describe('CampaignHomeScreen streaks', () => {
  it('shows the current win streak count and label', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    renderScreen();

    const streakTile = screen.getByText('Win Streak').closest('div');
    expect(streakTile).toHaveTextContent('2');
  });

  it('shows the current loss streak with the correct label', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);
    useCampaignStore.getState().recordMatchResult('loss', [], []);

    renderScreen();

    const streakTile = screen.getByText('Loss Streak').closest('div');
    expect(streakTile).toHaveTextContent('3');
  });

  it('shows a dash when there is no active streak (fresh run or just drew)', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);

    renderScreen();

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});