import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinFlip } from './CoinFlip';

describe('CoinFlip', () => {
  it('shows a Flip Coin button initially', () => {
    render(<CoinFlip onResult={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Flip Coin' })).toBeInTheDocument();
  });

  it('shows a flipping status and hides the button once flipping starts', async () => {
    const user = userEvent.setup();
    render(<CoinFlip onResult={vi.fn()} predeterminedResult="blue" />);

    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    expect(screen.queryByRole('button', { name: 'Flip Coin' })).not.toBeInTheDocument();
    expect(screen.getByText('Flipping...')).toBeInTheDocument();
  });

  it('calls onResult with the predetermined outcome once the flip completes', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<CoinFlip onResult={onResult} predeterminedResult="red" />);

    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('red'), { timeout: 2000 });
  });

  it('displays the correct winner message after the flip completes', async () => {
    const user = userEvent.setup();
    render(<CoinFlip onResult={vi.fn()} predeterminedResult="blue" />);

    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await waitFor(() => expect(screen.getByText('Blue goes first!')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('does not allow flipping again while already flipping or after completion', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<CoinFlip onResult={onResult} predeterminedResult="blue" />);

    const button = screen.getByRole('button', { name: 'Flip Coin' });
    await user.click(button);
    await waitFor(() => expect(onResult).toHaveBeenCalledOnce(), { timeout: 2000 });

    // Button is gone after completion (status now 'done'), so there's no
    // way to trigger a second flip through the UI - confirms the
    // one-shot behaviour rather than re-invoking handleFlip directly.
    expect(screen.queryByRole('button', { name: 'Flip Coin' })).not.toBeInTheDocument();
  });

  it('without a predeterminedResult, still resolves to one of the two valid outcomes', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<CoinFlip onResult={onResult} />);

    await user.click(screen.getByRole('button', { name: 'Flip Coin' }));

    await waitFor(() => expect(onResult).toHaveBeenCalledOnce(), { timeout: 2000 });
    expect(['blue', 'red']).toContain(onResult.mock.calls[0][0]);
  });
});