import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeriesIntroScreen } from './SeriesIntroScreen';
import { DEFAULT_RULE_SET } from '../engine/gameReducer';

describe('SeriesIntroScreen', () => {
  it('shows the pool size and derived round count', () => {
    render(
      <SeriesIntroScreen poolSize={15} round1RuleSet={DEFAULT_RULE_SET} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('15-card pool · up to 3 rounds')).toBeInTheDocument();
  });

  it("surfaces round 1's rolled rules", () => {
    render(
      <SeriesIntroScreen
        poolSize={10}
        round1RuleSet={{ ...DEFAULT_RULE_SET, plus: true, tradeRule: 'diff' }}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Round 1 Rules' })).toBeInTheDocument();
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(screen.getByText('Trade Rule: Diff')).toBeInTheDocument();
  });

  it('calls onContinue when Start Round 1 is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <SeriesIntroScreen poolSize={15} round1RuleSet={DEFAULT_RULE_SET} onContinue={onContinue} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start Round 1' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});