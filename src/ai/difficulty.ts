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
 * - Play strength feeds ai/heuristicAI.ts's chooseMove:
 *   - lookaheadWeight controls how much a move is penalized for leaving
 *     the opponent a strong reply, but ONLY when searchDepth is 1 (the
 *     shallow heuristic path) - see searchDepth below.
 *   - mistakeChance is the probability chooseMove ignores its own scoring
 *     and plays a uniformly random legal move instead - this is what
 *     makes Easy feel genuinely beatable rather than just "the same AI
 *     with a smaller number", since a lookahead-only nerf still plays a
 *     flawless immediate capture every time.
 *   - searchDepth switches Hard onto REAL minimax search instead of the
 *     shallow heuristic Easy/Normal use - see heuristicAI.ts's own header
 *     for why these are genuinely different algorithms, not the same one
 *     tuned differently. Left at the default (1, heuristic-only) for
 *     Easy/Normal, both to keep them cheap and because a sharper SEARCH
 *     is a fundamentally different kind of "harder" than a sharper
 *     heuristic weight - reserving it for Hard keeps that distinction
 *     meaningful rather than blurring every tier into "slightly more
 *     search".
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
    aiOptions: { lookaheadWeight: 0.5, mistakeChance: 0.35, searchDepth: 1 },
    rosterStrategy: 'balanced',
  },
  normal: {
    label: 'Normal',
    description: 'A balanced opponent roster and a sharp, no-mistakes AI.',
    aiOptions: { lookaheadWeight: 1.5, mistakeChance: 0, searchDepth: 1 },
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
    //
    // searchDepth: 2 means Hard actually simulates your best reply to
    // every move it's considering (real minimax, see heuristicAI.ts),
    // not just the shallow heuristic's raw capture-count guess at what
    // you might do. Kept at 2, not deeper - the branching factor grows
    // fast enough (up to ~45 legal moves per ply early in a match) that
    // 2 plies is already a genuine, correctly-evaluated lookahead
    // without risking a slow move on a slower device; a slower device
    // wasn't tested against here, so this is a deliberately conservative
    // depth, not a "this is the deepest we could go" claim.
    description:
      'The strongest units the points cap allows, played with no mistakes and a real two-move-ahead search - not just a bigger number on the same heuristic. Unlike your own roster, the AI has no cap on how many powerful units it can stack.',
    aiOptions: { mistakeChance: 0, searchDepth: 2 },
    rosterStrategy: 'greedy',
  },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';