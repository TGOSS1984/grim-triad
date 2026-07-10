/**
 * Displays a player's hand as a vertical stack of cards (matching the
 * left/right hand layout from the Triple Triad reference images), with a
 * card-count badge. Two display modes:
 *  - faceUp: renders real Card components, selectable if onSelectCard is
 *    provided (the player's own hand, always face-up).
 *  - face-down: renders CardBack for every slot (an opponent's hand when
 *    the Open rule isn't active - see engine/rules/open.ts). Hand itself
 *    doesn't know about rules; the caller decides faceUp per the active
 *    RuleSet and passes it in.
 */
import type { CardStats, PlayerColour } from '../../engine/types';
import type { ElementId } from '../../data/elements';
import { Card } from '../card/Card';
import { CardBack } from '../card/CardBack';
import styles from './Hand.module.css';

export interface HandCardData {
  instanceId: string;
  name: string;
  stats: CardStats;
  portraitPath: string;
  fallbackPortraitPath?: string;
  /** This card's own Elemental affinity - only rendered when the hand is face-up (a face-down card's element stays hidden along with everything else about it). Only set when the Elemental rule is active this match (see GameScreen). */
  element?: ElementId;
}

export interface HandProps {
  cards: HandCardData[];
  owner: PlayerColour;
  faceUp: boolean;
  /** The hand's owning faction icon slug (e.g. "blood-angels") - shown centered on face-down cards. A hand is always single-faction, so this applies to every CardBack in it. */
  factionSlug?: string;
  selectedCardId?: string;
  onSelectCard?: (instanceId: string) => void;
  cardWidth?: number;
  side?: 'left' | 'right';
}

export function Hand({
  cards,
  owner,
  faceUp,
  factionSlug,
  selectedCardId,
  onSelectCard,
  cardWidth,
  side = 'left',
}: HandProps) {
  const interactive = faceUp && !!onSelectCard;
  const style = cardWidth
    ? ({ '--card-width': `${cardWidth}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className={[styles.hand, styles[`side-${side}`]].join(' ')} style={style}>
      <div className={styles.count} aria-hidden="true">
        {cards.length}
      </div>
      <div className={styles.stack} role="list" aria-label={`${owner} hand, ${cards.length} cards`}>
        {cards.map((card) =>
          faceUp ? (
            <div key={card.instanceId} role="listitem" className={styles.slot}>
              <Card
                layoutId={card.instanceId}
                name={card.name}
                stats={card.stats}
                portraitPath={card.portraitPath}
                fallbackPortraitPath={card.fallbackPortraitPath}
                owner={owner}
                width={cardWidth}
                interactive={interactive}
                selected={card.instanceId === selectedCardId}
                onClick={interactive ? () => onSelectCard?.(card.instanceId) : undefined}
                element={card.element}
              />
            </div>
          ) : (
            <div key={card.instanceId} role="listitem" className={styles.slot}>
              <CardBack owner={owner} factionSlug={factionSlug} width={cardWidth} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}