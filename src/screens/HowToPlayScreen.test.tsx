import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HowToPlayScreen } from './HowToPlayScreen';
import { TOGGLE_RULES, TRADE_RULES, WIN_CONDITIONS } from '../data/ruleDescriptions';

function renderScreen(onBack = vi.fn()) {
  render(<HowToPlayScreen onBack={onBack} />);
  return { onBack };
}

describe('HowToPlayScreen tabs', () => {
  it('shows "The Basics" tab content by default', () => {
    renderScreen();
    expect(screen.getByText(/The board is a 3×3 grid/)).toBeInTheDocument();
  });

  it('the Basics tab tells the player the win condition is configurable, not just describing the default as if it were the only option', () => {
    renderScreen();
    expect(screen.getByText(/the active Win Condition can/)).toBeInTheDocument();
  });

  it('the Basics tab is marked selected by default', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: 'The Basics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches to Optional Rules content when that tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Optional Rules' }));

    expect(screen.getByRole('tab', { name: 'Optional Rules' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText(/The board is a 3×3 grid/)).not.toBeInTheDocument();
  });

  it('switches to Trade Rules content when that tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Trade Rules' }));

    expect(
      screen.getByText(/Exactly one Trade Rule is active per match/),
    ).toBeInTheDocument();
  });

  it('switches to Win Condition content when that tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Win Condition' }));

    expect(
      screen.getByText(/Exactly one Win Condition is active per match/),
    ).toBeInTheDocument();
  });

  it('switches to Game Modes content when that tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Game Modes' }));

    expect(screen.getByText('Single Match')).toBeInTheDocument();
    expect(screen.getByText('Series')).toBeInTheDocument();
    expect(screen.getByText('Campaign')).toBeInTheDocument();
  });

  it('only one tab is marked selected at a time', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Game Modes' }));

    expect(screen.getByRole('tab', { name: 'The Basics' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Game Modes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('HowToPlayScreen rule content (reused from data/ruleDescriptions.ts)', () => {
  it('shows every optional rule\'s label and description, sourced from the shared data module', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Optional Rules' }));

    for (const rule of TOGGLE_RULES) {
      expect(screen.getByText(rule.label)).toBeInTheDocument();
      expect(screen.getByText(rule.description)).toBeInTheDocument();
    }
  });

  it('shows every trade rule\'s label and description, sourced from the shared data module', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Trade Rules' }));

    for (const rule of TRADE_RULES) {
      expect(screen.getByText(rule.label)).toBeInTheDocument();
      expect(screen.getByText(rule.description)).toBeInTheDocument();
    }
  });

  it('shows every win condition\'s label and description, sourced from the shared data module', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('tab', { name: 'Win Condition' }));

    for (const condition of WIN_CONDITIONS) {
      expect(screen.getByText(condition.label)).toBeInTheDocument();
      expect(screen.getByText(condition.description)).toBeInTheDocument();
    }
  });
});

describe('HowToPlayScreen navigation', () => {
  it('calls onBack when the Back button is clicked', async () => {
    const user = userEvent.setup();
    const { onBack } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});