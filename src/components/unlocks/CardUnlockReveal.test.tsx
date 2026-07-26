import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardUnlockReveal } from './CardUnlockReveal';
import { UNLOCK_TIERS } from '../../data/unlockCriteria';
import type { Unit } from '../../data/schema';

const TIER_200_250 = UNLOCK_TIERS.find((t) => t.id === 'tier-200-250')!;

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'necrons-doom-scythe',
    name: 'Doom Scythe',
    faction: 'Necrons',
    battlefieldRole: 'Vehicle / Support',
    unitType: 'Vehicle',
    keywords: ['Vehicle'],
    points: 230,
    statBudget: 28,
    stats: { top: 10, bottom: 3, left: 7, right: 8 },
    portraitPath: 'assets/factions/necrons/units/doom-scythe.png',
    element: 'void',
    ...overrides,
  };
}

function renderReveal(overrides: Partial<Parameters<typeof CardUnlockReveal>[0]> = {}) {
  const onDismiss = vi.fn();
  render(
    <CardUnlockReveal
      tier={TIER_200_250}
      units={[makeUnit()]}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onDismiss };
}

describe('CardUnlockReveal', () => {
  it('shows "New Unit Unlocked!" (singular) for a batch of exactly one unit', () => {
    renderReveal({ units: [makeUnit()] });
    expect(screen.getByRole('heading', { name: 'New Unit Unlocked!' })).toBeInTheDocument();
  });

  it('shows "New Units Unlocked!" (plural) for a batch of more than one unit', () => {
    renderReveal({ units: [makeUnit({ id: 'a' }), makeUnit({ id: 'b', name: 'Second Unit' })] });
    expect(screen.getByRole('heading', { name: 'New Units Unlocked!' })).toBeInTheDocument();
  });

  it('shows the tier\'s own unlock condition as the subtitle', () => {
    renderReveal();
    expect(screen.getByText(TIER_200_250.description)).toBeInTheDocument();
  });

  it('shows the tier label', () => {
    renderReveal();
    expect(screen.getByText(TIER_200_250.label)).toBeInTheDocument();
  });

  it('features the FIRST unit in the batch (the hero) by name - getNewlyUnlockedBatches already sorts most-expensive-first', () => {
    const hero = makeUnit({ id: 'hero', name: 'Hero Unit', points: 900 });
    const other = makeUnit({ id: 'other', name: 'Lesser Unit', points: 210 });
    renderReveal({ units: [hero, other] });

    // getAllByText, not getByText: the hero's name legitimately appears
    // twice (Card's own internal name label, plus this component's own
    // .heroName caption below it) - both are expected, this just
    // confirms the hero (not the lesser unit) is what's actually shown.
    expect(screen.getAllByText('Hero Unit').length).toBeGreaterThan(0);
    expect(screen.queryByText('Lesser Unit')).not.toBeInTheDocument();
  });

  it('shows a "+N more units" count for the rest of the batch, not shown individually', () => {
    const units = Array.from({ length: 5 }, (_, i) => makeUnit({ id: `u${i}`, name: `Unit ${i}` }));
    renderReveal({ units });

    expect(screen.getByText('+ 4 more units unlocked in this tier')).toBeInTheDocument();
  });

  it('uses singular "unit" wording for exactly one extra unit', () => {
    renderReveal({ units: [makeUnit({ id: 'a' }), makeUnit({ id: 'b', name: 'Second' })] });
    expect(screen.getByText('+ 1 more unit unlocked in this tier')).toBeInTheDocument();
  });

  it('shows no "+N more" line at all for a single-unit batch', () => {
    renderReveal({ units: [makeUnit()] });
    expect(screen.queryByText(/more unit/)).not.toBeInTheDocument();
  });

  it('calls onDismiss when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the Continue button is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();

    // Not getByRole('presentation'): Card's own decorative portrait image
    // (alt="") also implicitly carries role="presentation" per ARIA, so
    // that query is ambiguous once a real Card is in the DOM. Query the
    // backdrop by its class instead, same technique already used
    // elsewhere in this codebase for similarly ambiguous cases.
    const backdrop = document.querySelector('[class*="backdrop"]')!;
    await user.click(backdrop);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does NOT call onDismiss when the dialog content itself is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();

    await user.click(screen.getByRole('heading', { name: 'New Unit Unlocked!' }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss on Escape', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});