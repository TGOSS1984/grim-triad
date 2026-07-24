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
      title="Collection Complete!"
      subtitle="You now own 737 / 737 units - one of everything currently obtainable."
      achievementName="Complete Collection"
      achievementDescription="Own one of every unit currently obtainable across all active factions."
      onStartNewRun={onStartNewRun}
      onReturnToTitle={onReturnToTitle}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onStartNewRun, onReturnToTitle, onDismiss };
}

describe('CampaignVictoryModal', () => {
  it('renders the given title and subtitle', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Collection Complete!' })).toBeInTheDocument();
    expect(
      screen.getByText('You now own 737 / 737 units - one of everything currently obtainable.'),
    ).toBeInTheDocument();
  });

  it('renders a different title/subtitle when given different ones (Rival Vanquished case)', () => {
    renderModal({
      title: 'Rival Vanquished!',
      subtitle: "You've reduced your rival's pool to its final cards.",
    });
    expect(screen.getByRole('heading', { name: 'Rival Vanquished!' })).toBeInTheDocument();
    expect(
      screen.getByText("You've reduced your rival's pool to its final cards."),
    ).toBeInTheDocument();
  });

  it('renders the achievement name and description passed in', () => {
    renderModal({
      achievementName: 'Rival Vanquished',
      achievementDescription: "Reduce your AI rival's pool to its final cards.",
    });
    expect(screen.getByText('Rival Vanquished')).toBeInTheDocument();
    expect(screen.getByText("Reduce your AI rival's pool to its final cards.")).toBeInTheDocument();
  });

  it('calls onDismiss when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

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

describe('CampaignVictoryModal third action button (onReinforce)', () => {
  it('shows "Keep Playing" and NOT the reinforcements button when onReinforce is omitted (Collection Complete case)', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Keep Playing' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue with AI Reinforcements' }),
    ).not.toBeInTheDocument();
  });

  it('calls onDismiss when "Keep Playing" is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Keep Playing' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows "Continue with AI Reinforcements" and NOT "Keep Playing" when onReinforce is given (Rival Vanquished case)', () => {
    renderModal({ onReinforce: vi.fn() });

    expect(
      screen.getByRole('button', { name: 'Continue with AI Reinforcements' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep Playing' })).not.toBeInTheDocument();
  });

  it('calls onReinforce (not onDismiss) when "Continue with AI Reinforcements" is clicked', async () => {
    const user = userEvent.setup();
    const onReinforce = vi.fn();
    const { onDismiss } = renderModal({ onReinforce });

    await user.click(screen.getByRole('button', { name: 'Continue with AI Reinforcements' }));

    expect(onReinforce).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('the close button still dismisses without reinforcing, even when onReinforce is given', async () => {
    const user = userEvent.setup();
    const onReinforce = vi.fn();
    const { onDismiss } = renderModal({ onReinforce });

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onReinforce).not.toHaveBeenCalled();
  });
});