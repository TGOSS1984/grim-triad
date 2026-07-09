/**
 * Open rule: when active, each player can see their opponent's hand.
 *
 * The engine's GameState already stores both hands in full (there is no
 * server/client split hiding data at the state level - see ROADMAP.md
 * Section 2 on the client-only v1 architecture). So this rule has no effect
 * on state or captures; it is purely a UI visibility switch. This module
 * exists so the UI layer has a single, testable source of truth for "should
 * I render this hand's card faces or backs" rather than checking
 * `ruleSet.open` inline in components.
 */
import type { PlayerColour, RuleSet } from '../types';

/**
 * Whether `viewer` is allowed to see the face-up details of `target`'s hand.
 * A player can always see their own hand; opponents' hands are only visible
 * when the Open rule is active.
 */
export function isHandVisibleTo(
  ruleSet: RuleSet,
  viewer: PlayerColour,
  target: PlayerColour,
): boolean {
  if (viewer === target) return true;
  return ruleSet.open;
}