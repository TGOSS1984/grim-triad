import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleSelectScreen } from './RuleSelectScreen';
import { DEFAULT_RULE_SET } from '../../engine/gameReducer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RuleSelectScreen actions (always visible, no accordion interaction needed)', () => {
  it('shows Randomize Rules and Continue immediately, with both accordion sections collapsed', () => {
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Randomize Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /Trade Rule/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('calls onContinue with the untouched default rule set if Continue is clicked immediately - no accordion ever needs to be opened', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RuleSelectScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith(DEFAULT_RULE_SET);
  });

  it('Randomize Rules works without opening either accordion section first', async () => {
    const user = userEvent.setup();
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
      chain: true,
      heroic: true,
      combinedArms: true,
      underdog: true,
      epicHeroPresence: true,
      tradeRule: 'diff',
      winCondition: 'cards',
    });
  });
});

describe('RuleSelectScreen accordion behaviour', () => {
  it('opens the Optional Rules section when its header is clicked', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));

    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /^Open/ })).toBeInTheDocument();
  });

  it('opening Trade Rule closes Optional Rules - accordion, only one open at a time', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Trade Rule/ }));

    expect(screen.getByRole('button', { name: /Trade Rule/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('clicking an open section\'s header again collapses it', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));

    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('the Optional Rules header shows a live count of currently-active rules, even while collapsed', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveTextContent('0 active');

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Same Matching/ }));
    await user.click(screen.getByRole('button', { name: /Optional Rules/ })); // collapse again

    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /Optional Rules/ })).toHaveTextContent('1 active');
  });

  it('the Trade Rule header shows the currently-selected trade rule, even while collapsed', () => {
    render(
      <RuleSelectScreen
        onContinue={vi.fn()}
        initialRuleSet={{ ...DEFAULT_RULE_SET, tradeRule: 'all' }}
      />,
    );

    expect(screen.getByRole('button', { name: /Trade Rule/ })).toHaveTextContent('All');
  });
});

describe('RuleSelectScreen rule selection', () => {
  it('starts with all toggle rules off and Trade Rule "One" selected, matching DEFAULT_RULE_SET', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    expect(screen.getByRole('checkbox', { name: /Open/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Same Wall/ })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /Trade Rule/ }));
    expect(screen.getByRole('radio', { name: /^One/ })).toBeChecked();
  });

  it('respects an initialRuleSet prop', async () => {
    const user = userEvent.setup();
    render(
      <RuleSelectScreen
        onContinue={vi.fn()}
        initialRuleSet={{ ...DEFAULT_RULE_SET, open: true, tradeRule: 'all' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    expect(screen.getByRole('checkbox', { name: /^Open/ })).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Trade Rule/ }));
    expect(screen.getByRole('radio', { name: /^All/ })).toBeChecked();
  });

  it('toggles a rule checkbox on click', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    const sameCheckbox = screen.getByRole('checkbox', { name: /^Same Matching/ });
    expect(sameCheckbox).not.toBeChecked();

    await user.click(sameCheckbox);

    expect(sameCheckbox).toBeChecked();
  });

  it('shows the Heroic toggle and includes it when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RuleSelectScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    const heroicCheckbox = screen.getByRole('checkbox', { name: /^Heroic/ });
    expect(heroicCheckbox).not.toBeChecked();

    await user.click(heroicCheckbox);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith({ ...DEFAULT_RULE_SET, heroic: true });
  });

  it('only one trade rule radio can be selected at a time', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Trade Rule/ }));
    await user.click(screen.getByRole('radio', { name: /^Diff/ }));

    expect(screen.getByRole('radio', { name: /^Diff/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^One/ })).not.toBeChecked();
  });

  it('calls onContinue with the current rule set when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<RuleSelectScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Elemental/ }));

    await user.click(screen.getByRole('button', { name: /Trade Rule/ }));
    await user.click(screen.getByRole('radio', { name: /^Direct/ }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith({
      ...DEFAULT_RULE_SET,
      elemental: true,
      tradeRule: 'direct',
    });
  });

  it('a checked rule survives collapsing and reopening its section', async () => {
    const user = userEvent.setup();
    render(<RuleSelectScreen onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Optional Rules/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Chain/ }));
    await user.click(screen.getByRole('button', { name: /Optional Rules/ })); // collapse
    await user.click(screen.getByRole('button', { name: /Optional Rules/ })); // reopen

    expect(screen.getByRole('checkbox', { name: /^Chain/ })).toBeChecked();
  });
});