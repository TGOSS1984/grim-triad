import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignHomeScreen } from './CampaignHomeScreen';
import { useCampaignStore } from '../state/campaignStore';
import { ACHIEVEMENTS } from '../state/achievements';

beforeEach(() => {
  useCampaignStore.getState().resetCampaign();
  useCampaignStore.setState({ unlockedAchievementIds: [] });
  localStorage.clear();
});

describe('CampaignHomeScreen with no active run', () => {
  it('shows a description and a Start New Run button, no stats', () => {
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);

    expect(screen.getByText(/Build a starting roster/)).toBeInTheDocument();
    expect(screen.queryByText('Cards owned')).not.toBeInTheDocument();
  });

  it('calls onStartNewRun immediately when clicked - no confirm needed with nothing to lose', async () => {
    const user = userEvent.setup();
    const onStartNewRun = vi.fn();
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={onStartNewRun} />);

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

    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);

    expect(screen.getByText('5')).toBeInTheDocument(); // cards owned
    expect(screen.getByText('Cards owned')).toBeInTheDocument();
    expect(screen.getByText('Wins')).toBeInTheDocument();
    expect(screen.getByText('Losses')).toBeInTheDocument();
    expect(screen.getByText('Draws')).toBeInTheDocument();
  });

  it('enables Continue when the collection has at least 5 cards', () => {
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeEnabled();
  });

  it('calls onContinue when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<CampaignHomeScreen onContinue={onContinue} onStartNewRun={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Continue Campaign' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('disables Continue and shows a warning once the collection drops below 5 cards', () => {
    useCampaignStore.getState().recordMatchResult('loss', [], ['necrons-lychguard', 'necrons-immortals']);

    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Continue Campaign' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('fallen below 5 cards');
  });

  it('requires a two-step confirm before starting a new run, since it discards progress', async () => {
    const user = userEvent.setup();
    const onStartNewRun = vi.fn();
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={onStartNewRun} />);

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(screen.getByText(/permanently discard/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, Start Over' }));
    expect(onStartNewRun).toHaveBeenCalledOnce();
  });

  it('cancels the new-run confirmation without calling onStartNewRun', async () => {
    const user = userEvent.setup();
    const onStartNewRun = vi.fn();
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={onStartNewRun} />);

    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start New Run' })).toBeInTheDocument();
  });
});

describe('CampaignHomeScreen achievements', () => {
  it('shows the achievement trophy case even with no active run - achievements are permanent', () => {
    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);
    expect(screen.getByText(`Achievements (0/${ACHIEVEMENTS.length})`)).toBeInTheDocument();
    expect(screen.getByText('First Blood')).toBeInTheDocument();
  });

  it('shows the correct unlocked count once achievements have been earned', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);

    expect(screen.getByText(`Achievements (1/${ACHIEVEMENTS.length})`)).toBeInTheDocument();
  });

  it('gives an unlocked achievement a distinct visual class from a locked one', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);

    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);

    const firstBlood = screen.getByText('First Blood').closest('div');
    const grandChampion = screen.getByText('Grand Champion').closest('div');
    expect(firstBlood?.className).toMatch(/achievementUnlocked/);
    expect(grandChampion?.className).toMatch(/achievementLocked/);
  });

  it('still shows previously-earned achievements after starting a new run (permanence)', async () => {
    const user = userEvent.setup();
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], []);
    expect(useCampaignStore.getState().unlockedAchievementIds).toContain('first-blood');

    render(<CampaignHomeScreen onContinue={vi.fn()} onStartNewRun={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start New Run' }));
    await user.click(screen.getByRole('button', { name: 'Yes, Start Over' }));

    expect(screen.getByText(`Achievements (1/${ACHIEVEMENTS.length})`)).toBeInTheDocument();
  });
});