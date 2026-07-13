/**
 * Difficulty is the single knob the player sets before a match; everything
 * else (how sharply the AI plays, how its opponent roster is assembled)
 * derives from it here, in one place, so the two halves of "difficulty"
 * (roster strength and play strength) can never drift out of sync with
 * each other.
 *
 * - Roster strategy feeds matchSetup.buildRandomAIRoster: 'balanced' is
 *   the existing random-then-cheapest-first fill (see that file's own
 *   header for why cheapest-first matters as a *fallback*, not the
 *   primary strategy - that reasoning is unchanged here). 'greedy' fills
 *   most-expensive-first instead, so Hard's roster leans toward the
 *   strongest individual units the points cap can afford, at the cost of
 *   fielding fewer of them.
 * - Play strength feeds ai/heuristicAI.ts's chooseMove: lookaheadWeight
 *   controls how much a move is penalized for leaving the opponent a
 *   strong reply (0 = purely greedy, no lookahead at all). mistakeChance
 *   is the probability chooseMove ignores its own scoring and plays a
 *   uniformly random legal move instead - this is what makes Easy feel
 *   genuinely beatable rather than just "the same AI with a smaller
 *   number", since a lookahead-only nerf still plays a flawless immediate
 *   capture every time.
 */
import type { AIOptions } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type RosterStrategy = 'balanced' | 'greedy';

export interface DifficultyProfile {
  label: string;
  description: string;
  aiOptions: AIOptions;
  rosterStrategy: RosterStrategy;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    label: 'Easy',
    description: 'A balanced opponent roster and a forgiving AI that sometimes misplays.',
    aiOptions: { lookaheadWeight: 0.5, mistakeChance: 0.35 },
    rosterStrategy: 'balanced',
  },
  normal: {
    label: 'Normal',
    description: 'A balanced opponent roster and a sharp, no-mistakes AI.',
    aiOptions: { lookaheadWeight: 1.5, mistakeChance: 0 },
    rosterStrategy: 'balanced',
  },
  hard: {
    label: 'Hard',
    // Deliberately honest about an asymmetry, not just a difficulty
    // flex: campaignBalance.ts's power-unit cap (max N units over a
    // points threshold) only applies to the PLAYER's starting roster -
    // Hard's 'greedy' roster strategy has no equivalent constraint, so it
    // can spend its whole budget on the priciest units it can find with
    // no diversity requirement at all. That's a real, player-invisible
    // difference in how the two rosters get built at the same points
    // cap, not just "the AI tries harder" - worth saying outright rather
    // than letting it be a surprise.
    description:
      'The strongest units the points cap allows, played with no mistakes. Unlike your own roster, the AI has no cap on how many powerful units it can stack.',
    aiOptions: { lookaheadWeight: 2.5, mistakeChance: 0 },
    rosterStrategy: 'greedy',
  },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';