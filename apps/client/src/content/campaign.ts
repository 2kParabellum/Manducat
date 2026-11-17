// Campaign route: a snake of levels and reward chests. Levels are pure data.
import type { CharacterId } from '@manducat/core';
import type { Difficulty } from '@manducat/ai';

export type CampaignNode =
  | { id: string; kind: 'tutorial'; name: string }
  | { id: string; kind: 'reward'; name: string }
  | {
      id: string; kind: 'level'; name: string; num: number;
      difficulty: Difficulty;
      bestOf: 1 | 3 | 5;
      /** Opponent's deck (game 1 uses the first slot; the loser of a game moves to the next one). */
      deck: CharacterId[];
    };

export type LevelNode = Extract<CampaignNode, { kind: 'level' }>;

export const CAMPAIGN: readonly CampaignNode[] = [
  { id: 'tutorial', kind: 'tutorial', name: 'Tutorial' },
  { id: 'l1', kind: 'level', num: 1, name: 'First Steps', difficulty: 'easy', bestOf: 1, deck: ['jack'] },
  { id: 'l2', kind: 'level', num: 2, name: 'Card Sharp', difficulty: 'normal', bestOf: 1, deck: ['jack'] },
  { id: 'l3', kind: 'level', num: 3, name: "Jack's Gambit", difficulty: 'hard', bestOf: 1, deck: ['jack'] },
  { id: 'r1', kind: 'reward', name: 'New Recruit' },
  { id: 'l4', kind: 'level', num: 4, name: 'Iron Wall', difficulty: 'normal', bestOf: 1, deck: ['defender'] },
  { id: 'l5', kind: 'level', num: 5, name: 'Eyes in the Dark', difficulty: 'normal', bestOf: 1, deck: ['scout'] },
  { id: 'l6', kind: 'level', num: 6, name: 'Hex', difficulty: 'normal', bestOf: 1, deck: ['witch'] },
  { id: 'r2', kind: 'reward', name: 'New Recruit' },
  { id: 'l7', kind: 'level', num: 7, name: 'The Gauntlet', difficulty: 'normal', bestOf: 3, deck: ['poisoner', 'scout', 'defender'] },
  { id: 'l8', kind: 'level', num: 8, name: 'Bitter Cup', difficulty: 'hard', bestOf: 3, deck: ['witch', 'poisoner', 'miner'] },
  { id: 'r3', kind: 'reward', name: 'New Recruit' },
  { id: 'l9', kind: 'level', num: 9, name: 'Minefield', difficulty: 'normal', bestOf: 5, deck: ['miner', 'defender', 'witch'] },
  { id: 'l10', kind: 'level', num: 10, name: 'Endgame', difficulty: 'hard', bestOf: 5, deck: ['defender', 'witch', 'miner'] },
];

export type NodeState = 'done' | 'current' | 'locked' | 'soon';

/** The tutorial is not made yet: it is shown but doesn't block the route. */
const isPlayable = (n: CampaignNode): boolean => n.kind !== 'tutorial';

/** The first node the player hasn't completed yet (null — campaign finished). */
export function currentNode(completed: readonly string[]): CampaignNode | null {
  return CAMPAIGN.find(n => isPlayable(n) && !completed.includes(n.id)) ?? null;
}

export function nodeState(n: CampaignNode, completed: readonly string[]): NodeState {
  if (!isPlayable(n)) return 'soon';
  if (completed.includes(n.id)) return 'done';
  return currentNode(completed) === n ? 'current' : 'locked';
}

export const DIFFICULTY_NAME: Readonly<Record<Difficulty, string>> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const formatName = (bestOf: number): string => (bestOf === 1 ? 'Single game' : `Best of ${bestOf}`);
