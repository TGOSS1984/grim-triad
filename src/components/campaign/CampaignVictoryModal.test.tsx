import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignVictoryModal } from './CampaignVictoryModal';

function renderModal(overrides: Partial<Parameters<typeof CampaignVictoryModal>[0]> = {}) {
  const onStartNewRun = vi.fn();
  const onReturnToTitle = vi.fn();
  const onDismiss = vi.fn();
  render(
    <CampaignVictoryModal
      achievementName="Complete Collection"
      achievementDescription="Own one of every unit currently obtainable across all active factions."
      unitsOwned={737}
      obtainableTotal={737}
      onStartNewRun={onStartNewRun}
      onReturnToTitle={onReturnToTitle}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onStartNewRun, onReturnToTitle, onDismiss };
}

describe('CampaignVictoryModal', () => {
  it('renders the completion title and unit counts', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Collection Complete!' })).toBeInTheDocument();
    expect(screen.getByText('You now own 737 / 737 units - one of everything currently obtainable.')).toBeInTheDocument();
  });

  it('renders the achievement name and description passed in', () => {
    renderModal({
      achievementName: 'Complete Collection',
      achievementDescription: 'Own one of every unit currently obtainable across all active factions.',
    });
    expect(screen.getByText('Complete Collection')).toBeInTheDocument();
    expect(
      screen.getByText('Own one of every unit currently obtainable across all active factions.'),
    ).toBeInTheDocument();
  });

  it('calls onDismiss when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Keep playing' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the "Keep Playing" action button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Keep Playing' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('presentation'));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does NOT call onDismiss when the dialog content itself is clicked (does not bubble to the backdrop)', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('heading', { name: 'Collection Complete!' }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss on Escape', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onReturnToTitle when "Return to Title" is clicked', async () => {
    const user = userEvent.setup();
    const { onReturnToTitle } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Return to Title' }));

    expect(onReturnToTitle).toHaveBeenCalledOnce();
  });

  it('does NOT call onStartNewRun immediately on "Start New Campaign" - requires confirmation first', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Start New Campaign' }));

    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(
      screen.getByText('This will permanently discard your current collection and record.'),
    ).toBeInTheDocument();
  });

  it('calls onStartNewRun after confirming "Yes, Start Over"', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Start New Campaign' }));
    await user.click(screen.getByRole('button', { name: 'Yes, Start Over' }));

    expect(onStartNewRun).toHaveBeenCalledOnce();
  });

  it('"Cancel" backs out of the confirm step without calling onStartNewRun', async () => {
    const user = userEvent.setup();
    const { onStartNewRun } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Start New Campaign' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStartNewRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start New Campaign' })).toBeInTheDocument();
    expect(
      screen.queryByText('This will permanently discard your current collection and record.'),
    ).not.toBeInTheDocument();
  });
});