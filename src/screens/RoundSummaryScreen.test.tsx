import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundSummaryScreen } from './RoundSummaryScreen';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';

const baseProps = {
  roundNumber: 1,
  winner: 'blue' as const,
  bluePoolRemaining: 10,
  redPoolRemaining: 8,
  blueWins: 1,
  redWins: 0,
  tradeTransferred: [] as { unitId: string; to: 'blue' | 'red' }[],
  nextRoundRuleSet: DEFAULT_RULE_SET,
  onContinue: vi.fn(),
};

describe('RoundSummaryScreen', () => {
  it('announces which side won the round that just finished', () => {
    render(<RoundSummaryScreen {...baseProps} winner="blue" roundNumber={2} />);
    expect(screen.getByRole('heading', { name: 'Round 2: Blue Wins' })).toBeInTheDocument();
  });

  it('shows the pool and win tally for both sides', () => {
    render(<RoundSummaryScreen {...baseProps} bluePoolRemaining={12} redPoolRemaining={7} blueWins={2} redWins={1} />);

    expect(screen.getByText('12 cards remaining')).toBeInTheDocument();
    expect(screen.getByText('7 cards remaining')).toBeInTheDocument();
    expect(screen.getByText('2 round wins')).toBeInTheDocument();
    expect(screen.getByText('1 round wins')).toBeInTheDocument();
  });

  it('does not mention trade transfers when none happened', () => {
    render(<RoundSummaryScreen {...baseProps} tradeTransferred={[]} />);
    expect(screen.queryByText(/changed hands/)).not.toBeInTheDocument();
  });

  it('mentions the number of cards transferred via trade, with correct pluralization', () => {
    render(
      <RoundSummaryScreen {...baseProps} tradeTransferred={[{ unitId: 'necrons-lychguard', to: 'blue' }]} />,
    );
    expect(screen.getByText(/^1 card changed hands/)).toBeInTheDocument();

    render(
      <RoundSummaryScreen
        {...baseProps}
        tradeTransferred={[
          { unitId: 'necrons-lychguard', to: 'blue' },
          { unitId: 'necrons-immortals', to: 'blue' },
          { unitId: 'necrons-overlord', to: 'blue' },
        ]}
      />,
    );
    expect(screen.getByText(/^3 cards changed hands/)).toBeInTheDocument();
  });

  it('names each transferred unit and which side it moved to, not just a bare count', () => {
    render(
      <RoundSummaryScreen
        {...baseProps}
        tradeTransferred={[
          { unitId: 'necrons-lychguard', to: 'blue' },
          { unitId: 'necrons-immortals', to: 'red' },
        ]}
      />,
    );

    expect(screen.getByText('Lychguard moves from red to blue')).toBeInTheDocument();
    expect(screen.getByText('Immortals moves from blue to red')).toBeInTheDocument();
  });

  it('falls back to "Unknown Unit" for an unresolvable unit id rather than crashing', () => {
    render(
      <RoundSummaryScreen {...baseProps} tradeTransferred={[{ unitId: 'not-a-real-id', to: 'blue' }]} />,
    );
    expect(screen.getByText('Unknown Unit moves from red to blue')).toBeInTheDocument();
  });

  it("surfaces the next round's rules clearly before continuing", () => {
    render(
      <RoundSummaryScreen
        {...baseProps}
        roundNumber={1}
        nextRoundRuleSet={{ ...DEFAULT_RULE_SET, same: true, elemental: true, tradeRule: 'all' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Round 2 Rules' })).toBeInTheDocument();
    expect(screen.getByText('Same')).toBeInTheDocument();
    expect(screen.getByText('Elemental')).toBeInTheDocument();
    expect(screen.getByText('Trade Rule: All')).toBeInTheDocument();
  });

  it('calls onContinue when the continue button is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RoundSummaryScreen {...baseProps} roundNumber={3} onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Continue to Round 4' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});