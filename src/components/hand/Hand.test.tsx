import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hand } from './Hand';
import type { HandCardData } from './Hand';

const cards: HandCardData[] = [
  {
    instanceId: 'card-1',
    name: 'Lychguard',
    stats: { top: 5, bottom: 5, left: 6, right: 6 },
    portraitPath: 'assets/factions/necrons/units/lychguard.png',
  },
  {
    instanceId: 'card-2',
    name: 'Deathmark',
    stats: { top: 4, bottom: 4, left: 5, right: 5 },
    portraitPath: 'assets/factions/necrons/units/deathmark.png',
  },
];

describe('Hand', () => {
  it('shows the correct card count', () => {
    render(<Hand cards={cards} owner="red" faceUp />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders each card face-up when faceUp is true', () => {
    render(<Hand cards={cards} owner="red" faceUp />);
    expect(screen.getByRole('img', { name: 'Lychguard' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Deathmark' })).toBeInTheDocument();
  });

  it('renders face-down CardBacks when faceUp is false, hiding card identity', () => {
    render(<Hand cards={cards} owner="red" faceUp={false} />);
    expect(screen.queryByRole('img', { name: 'Lychguard' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Face-down card' })).toHaveLength(2);
  });

  it('makes cards interactive (clickable) when faceUp and onSelectCard are both provided', async () => {
    const user = userEvent.setup();
    const onSelectCard = vi.fn();
    render(<Hand cards={cards} owner="red" faceUp onSelectCard={onSelectCard} />);

    await user.click(screen.getByRole('button', { name: /Lychguard/ }));

    expect(onSelectCard).toHaveBeenCalledWith('card-1');
  });

  it('does not render cards as buttons when faceUp is true but no onSelectCard is provided', () => {
    render(<Hand cards={cards} owner="red" faceUp />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('does not render cards as buttons when face-down, even with onSelectCard provided', () => {
    render(<Hand cards={cards} owner="red" faceUp={false} onSelectCard={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('marks the selected card as pressed', () => {
    render(
      <Hand cards={cards} owner="red" faceUp onSelectCard={vi.fn()} selectedCardId="card-2" />,
    );

    expect(screen.getByRole('button', { name: /Lychguard/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /Deathmark/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders an empty hand gracefully with a count of 0', () => {
    render(<Hand cards={[]} owner="blue" faceUp />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});