import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleSelectScreen } from './RuleSelectScreen';
import { DEFAULT_RULE_SET } from '../../engine/gameReducer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RuleSelectScreen', () => {
  it('starts with all toggle rules off and Trade Rule "One" selected, matching DEFAULT_RULE_SET', () => {
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /Open/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Same Wall/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /^One/ })).toBeChecked();
  });

  it('respects an initialRuleSet prop', () => {
    render(
      <RuleSelectScreen
        onContinue={vi.fn()}
        initialRuleSet={{ ...DEFAULT_RULE_SET, open: true, tradeRule: 'all' }}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /^Open/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^All/ })).toBeChecked();
  });

  it('toggles a rule checkbox on click', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    const sameCheckbox = screen.getByRole('checkbox', { name: /^Same Matching/ });
    expect(sameCheckbox).not.toBeChecked();

    await user.click(sameCheckbox);

    expect(sameCheckbox).toBeChecked();
  });

  it('only one trade rule radio can be selected at a time', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /^Diff/ }));

    expect(screen.getByRole('radio', { name: /^Diff/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^One/ })).not.toBeChecked();
  });

  it('calls onContinue with the current rule set when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RuleSelectScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('checkbox', { name: /^Elemental/ }));
    await user.click(screen.getByRole('radio', { name: /^Direct/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith({
      ...DEFAULT_RULE_SET,
      elemental: true,
      tradeRule: 'direct',
    });
  });

  it('Randomize Rules produces a deterministic result when Math.random is mocked', async () => {
    const user = userEvent.setup();
    // Force every randomBool() (Math.random() < 0.5) to be true, and the
    // trade-rule index pick to land on 'diff' (index 1 of 4).
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    const onContinue = vi.fn();
    render(<RuleSelectScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Randomize Rules' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith({
      open: true,
      suddenDeath: true,
      random: true,
      same: true,
      sameWall: true,
      plus: true,
      elemental: true,
      tradeRule: 'diff',
    });
  });
});