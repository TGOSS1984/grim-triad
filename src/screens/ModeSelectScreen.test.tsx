import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeSelectScreen } from './ModeSelectScreen';
import type { ModeSelectScreenProps } from './ModeSelectScreen';

/** Renders with all three handlers defaulted to vi.fn(), overridable per test - keeps individual tests focused on just the prop(s) they care about. */
function renderScreen(overrides: Partial<ModeSelectScreenProps> = {}) {
  const props: ModeSelectScreenProps = {
    onSelectSingleMatch: vi.fn(),
    onSelectSeries: vi.fn(),
    onSelectCampaign: vi.fn(),
    ...overrides,
  };
  render(<ModeSelectScreen {...props} />);
  return props;
}

describe('ModeSelectScreen', () => {
  it('calls onSelectSingleMatch when Single Match is clicked', async () => {
    const user = userEvent.setup();
    const onSelectSingleMatch = vi.fn();
    renderScreen({ onSelectSingleMatch });

    await user.click(screen.getByRole('button', { name: /Single Match/ }));

    expect(onSelectSingleMatch).toHaveBeenCalledOnce();
  });

  it('does not show series pool options until Series is clicked', () => {
    renderScreen();
    expect(screen.queryByText('Choose Your Pool Size')).not.toBeInTheDocument();
  });

  it('reveals pool size options after clicking Series', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /^Series/ }));

    expect(screen.getByText('Choose Your Pool Size')).toBeInTheDocument();
  });

  it('defaults to a 15-card pool (3 rounds)', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /^Series/ }));

    expect(screen.getByText('3 rounds before any Trade Rule attrition')).toBeInTheDocument();
  });

  it('calls onSelectSeries with the chosen preset pool size', async () => {
    const user = userEvent.setup();
    const onSelectSeries = vi.fn();
    renderScreen({ onSelectSeries });

    await user.click(screen.getByRole('button', { name: /^Series/ }));
    await user.click(screen.getByRole('button', { name: '25' }));
    await user.click(screen.getByRole('button', { name: 'Start Series' }));

    expect(onSelectSeries).toHaveBeenCalledWith(25, 'normal');
  });

  it('allows a custom pool size via the numeric input', async () => {
    const user = userEvent.setup();
    const onSelectSeries = vi.fn();
    renderScreen({ onSelectSeries });

    await user.click(screen.getByRole('button', { name: /^Series/ }));
    const input = screen.getByLabelText('Custom pool size');
    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'Start Series' }));

    expect(onSelectSeries).toHaveBeenCalledWith(30, 'normal');
  });

  it('disables Start Series for a pool size that is not a multiple of 5', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /^Series/ }));
    const input = screen.getByLabelText('Custom pool size');
    await user.clear(input);
    await user.type(input, '17');

    expect(screen.getByRole('button', { name: 'Start Series' })).toBeDisabled();
    expect(
      screen.getByText('Pool size must be a multiple of 5, at least 10'),
    ).toBeInTheDocument();
  });

  it('disables Start Series for a pool size below the minimum', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /^Series/ }));
    const input = screen.getByLabelText('Custom pool size');
    await user.clear(input);
    await user.type(input, '5');

    expect(screen.getByRole('button', { name: 'Start Series' })).toBeDisabled();
  });

  it('defaults to Normal difficulty', () => {
    renderScreen();
    expect(screen.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
  });

  it('passes the chosen difficulty to onSelectSingleMatch', async () => {
    const user = userEvent.setup();
    const onSelectSingleMatch = vi.fn();
    renderScreen({ onSelectSingleMatch });

    await user.click(screen.getByRole('radio', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Single Match/ }));

    expect(onSelectSingleMatch).toHaveBeenCalledWith('hard');
  });

  it('passes the chosen difficulty to onSelectSeries', async () => {
    const user = userEvent.setup();
    const onSelectSeries = vi.fn();
    renderScreen({ onSelectSeries });

    await user.click(screen.getByRole('radio', { name: 'Easy' }));
    await user.click(screen.getByRole('button', { name: /^Series/ }));
    await user.click(screen.getByRole('button', { name: 'Start Series' }));

    expect(onSelectSeries).toHaveBeenCalledWith(15, 'easy');
  });

  it('calls onSelectCampaign directly when Campaign is clicked, with no extra options screen', async () => {
    const user = userEvent.setup();
    const onSelectCampaign = vi.fn();
    renderScreen({ onSelectCampaign });

    await user.click(screen.getByRole('button', { name: /^Campaign/ }));

    expect(onSelectCampaign).toHaveBeenCalledOnce();
  });

  it('passes the chosen difficulty to onSelectCampaign', async () => {
    const user = userEvent.setup();
    const onSelectCampaign = vi.fn();
    renderScreen({ onSelectCampaign });

    await user.click(screen.getByRole('radio', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /^Campaign/ }));

    expect(onSelectCampaign).toHaveBeenCalledWith('hard');
  });
});