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
 *
 * `capturedCount`, when given, renders a second animated badge (see
 * AnimatedScoreBadge.tsx) alongside the existing hand-count one - "how
 * many cards are on the board in this side's colour right now" (board
 * control, the same number the end-of-game screens already show as
 * "Blue: X"), made LIVE during play rather than only visible once the
 * match ends. Deliberately paired with the hand count rather than placed
 * somewhere new: this is the one place in the layout that's already a
 * per-side, always-visible, correctly-responsive column on both desktop
 * and mobile, so reusing it means the live score inherits that
 * responsiveness for free instead of needing its own placement logic.
 * Optional (undefined = hidden entirely) because Hand has no other
 * consumer needing this today - see GameScreen.tsx, the only caller.
 *
 * `pointsTotal`, same shape and same reasoning, adds a THIRD badge for
 * this side's total points cost of controlled cards - GameScreen only
 * ever passes this when the match's active winCondition is actually
 * 'points' (see engine/types.ts's RuleSet.winCondition), so it's absent
 * entirely for the vast majority of matches still using the default
 * 'cards' condition, where a secondary points score would just be
 * clutter with nothing riding on it.
 */
import type { CardStats, PlayerColour } from '../../engine/types';
import type { ElementId } from '../../data/elements';
import { Card } from '../card/Card';
import { CardBack } from '../card/CardBack';
import { AnimatedScoreBadge } from './AnimatedScoreBadge';
import styles from './Hand.module.css';

export interface HandCardData {
  instanceId: string;
  name: string;
  stats: CardStats;
  /** The card's in-play stats after any active buff/debuff mechanic that still applies while in hand (currently just Epic Hero Presence - see Card.tsx's own doc on effectiveStats for why this is deliberately generic). */
  effectiveStats?: CardStats;
  portraitPath: string;
  fallbackPortraitPath?: string;
  /** This card's own Elemental affinity - only rendered when the hand is face-up (a face-down card's element stays hidden along with everything else about it). Only set when the Elemental rule is active this match (see GameScreen). */
  element?: ElementId;
  /** The unit's keyword tags - only used to pick the Epic Hero template variant (see Card.tsx). Not a visibility/secrecy concern the way `element` is (Card.tsx is never used for a genuinely hidden card in the first place - see CardBack.tsx for that), so unlike `element` this isn't conditionally omitted for a face-down hand. */
  keywords?: string[];
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
  /** Live board-control count for this side, animated on change - see file header. Omit to hide the badge entirely. */
  capturedCount?: number;
  /** Live total points cost of controlled cards for this side, animated on change - see file header. Only ever passed when winCondition is 'points'; omit to hide the badge entirely. */
  pointsTotal?: number;
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
  capturedCount,
  pointsTotal,
}: HandProps) {
  const interactive = faceUp && !!onSelectCard;
  const style = cardWidth
    ? ({ '--card-width': `${cardWidth}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className={[styles.hand, styles[`side-${side}`]].join(' ')} style={style}>
      <div className={styles.badgeRow}>
        <div className={styles.count} aria-hidden="true">
          {cards.length}
        </div>
        {capturedCount !== undefined && (
          <AnimatedScoreBadge value={capturedCount} label="Captured" />
        )}
        {pointsTotal !== undefined && <AnimatedScoreBadge value={pointsTotal} label="Points" />}
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
                keywords={card.keywords}
                effectiveStats={card.effectiveStats}
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