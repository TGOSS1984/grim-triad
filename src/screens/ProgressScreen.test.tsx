import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressScreen } from './ProgressScreen';
import { useCampaignStore } from '../state/campaignStore';
import { useUnlockStore } from '../state/unlockStore';
import { ACHIEVEMENTS } from '../state/achievements';

beforeEach(() => {
  useCampaignStore.getState().resetCampaign();
  // resetCampaign() deliberately does NOT clear unlockedAchievementIds or
  // bestWinStreak in production (both survive across runs) - tests need a
  // clean slate regardless, same bypass campaignStore.test.ts itself uses.
  useCampaignStore.setState({
    unlockedAchievementIds: [],
    bestWinStreak: 0,
    hasCompletedCollection: false,
    hasVanquishedRival: false,
  });
  useUnlockStore.getState().resetProgress();
  localStorage.clear();
});

function renderScreen(onBack = vi.fn()) {
  render(<ProgressScreen onBack={onBack} />);
  return { onBack };
}

describe('ProgressScreen card collection section', () => {
  it('shows all five unlock tiers with real totals, even with zero progress', () => {
    renderScreen();

    expect(screen.getByText('200-250 pts')).toBeInTheDocument();
    expect(screen.getByText('250-300 pts')).toBeInTheDocument();
    expect(screen.getByText('300-400 pts')).toBeInTheDocument();
    expect(screen.getByText('400-500 pts')).toBeInTheDocument();
    expect(screen.getByText('500+ pts')).toBeInTheDocument();
    // Real data as of this writing - see unlockCriteria.ts's own header.
    expect(screen.getByText('0/34 unlocked')).toBeInTheDocument();
  });

  it('shows a tier count reflecting real progress', () => {
    for (let i = 0; i < 10; i++) {
      useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    }

    renderScreen();

    expect(screen.getByText('34/34 unlocked')).toBeInTheDocument();
  });

  it('shows the raw underlying stats driving unlock progress', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    useUnlockStore.getState().recordSameOrPlusCombo(4);
    useUnlockStore.getState().recordChainReaction(2);

    renderScreen();

    expect(screen.getByText('Total Wins').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Same/Plus Combos').previousElementSibling).toHaveTextContent('4');
    expect(screen.getByText('Chain Reactions').previousElementSibling).toHaveTextContent('2');
  });

  it('counts distinct factions won with, not raw win count', () => {
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    useUnlockStore.getState().recordMatchOutcome('win', 'Necrons', false);
    useUnlockStore.getState().recordMatchOutcome('win', 'Orks', false);

    renderScreen();

    const factionsStat = screen.getByText('Factions Won With').previousElementSibling;
    expect(factionsStat).toHaveTextContent('2');
  });
});

describe('ProgressScreen achievements section', () => {
  it('shows the achievement trophy case even with no campaign run ever started - achievements are permanent', () => {
    renderScreen();
    expect(screen.getByText(`Achievements (0/${ACHIEVEMENTS.length})`)).toBeInTheDocument();
    expect(screen.getByText('First Blood')).toBeInTheDocument();
  });

  it('shows the correct unlocked count once achievements have been earned', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], [], false);

    renderScreen();

    expect(screen.getByText(`Achievements (1/${ACHIEVEMENTS.length})`)).toBeInTheDocument();
  });

  it('gives an unlocked achievement a distinct visual class from a locked one', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], [], false);

    renderScreen();

    const firstBlood = screen.getByText('First Blood').closest('div');
    const grandChampion = screen.getByText('Grand Champion').closest('div');
    expect(firstBlood?.className).toMatch(/achievementUnlocked/);
    expect(grandChampion?.className).toMatch(/achievementLocked/);
  });

  it('shows the permanent Best Win Streak', () => {
    useCampaignStore.getState().startCampaign(['necrons-lychguard']);
    useCampaignStore.getState().recordMatchResult('win', [], [], false);
    useCampaignStore.getState().recordMatchResult('win', [], [], false);

    renderScreen();

    expect(screen.getByText('Best Win Streak: 2')).toBeInTheDocument();
  });
});

describe('ProgressScreen navigation', () => {
  it('calls onBack when the Back button is clicked', async () => {
    const user = userEvent.setup();
    const { onBack } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});