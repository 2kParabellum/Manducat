// The tutorial: Jack vs Jack against the easiest AI on a fixed layout.
// The first moves of both sides are scripted so the player meets every basic mechanic in order:
// flip → gold → move → capture → find M → place M → capture an 8 with M. Then the game is played out freely.
import { CELLS, DEFAULT_RULES, mulberry32, shuffle } from '@manducat/core';
import type { Action, CardIdentity, Player, UnitValue } from '@manducat/core';

/** A coach message. */
export interface CoachText {
  title: string;
  /** May contain <b> for emphasis (static text, never user input). */
  text: string;
}

/** A scripted step: the player must make exactly `expect`, then the AI answers with `reply`. */
export interface TutorialStep extends CoachText {
  expect: Action;
  /** The AI's scripted answer (none — the AI starts thinking on its own). */
  reply?: Action;
}

export interface TutorialScript {
  layout: ReadonlyArray<CardIdentity | null>;
  /** Shown before the first move, with a button. */
  intro: CoachText & { button: string };
  steps: readonly TutorialStep[];
  /** Shown right after the scripted part. */
  outro: CoachText;
  /** Shown for the rest of the game. */
  freePlay: CoachText;
}

// Cells: index = row * 6 + column, A1 = 0, F6 = 35.
const C = { A2: 6, B2: 7, C3: 14, D3: 15, F2: 11, C4: 20, E4: 22, B5: 25, E5: 28 } as const;

const card = (owner: Player | null, value: UnitValue | 'G'): CardIdentity => ({ owner, value });

/** Cards the script relies on; everything else is shuffled with a fixed seed (the layout never changes). */
const FIXED: Readonly<Record<number, CardIdentity>> = {
  [C.C4]: card('blue', '5'),
  [C.C3]: card(null, 'G'),
  [C.B2]: card('blue', 'M'),
  [C.B5]: card('blue', '3'),
  [C.D3]: card('red', '2'),
  [C.E5]: card('red', '8'),
  [C.E4]: card(null, 'G'),
  [C.A2]: card('red', '3'),
  [C.F2]: card('red', '5'),
};

const LAYOUT_SEED = 2026;

function buildLayout(): CardIdentity[] {
  const rest: CardIdentity[] = [];
  const left = (c: CardIdentity) => Object.values(FIXED).filter(f => f.owner === c.owner && f.value === c.value).length;
  const add = (c: CardIdentity, n: number) => { for (let k = n - left(c); k > 0; k--) rest.push(c); };
  for (const owner of ['blue', 'red'] as const) for (const [v, n] of DEFAULT_RULES.army) add(card(owner, v), n);
  add(card(null, 'G'), DEFAULT_RULES.gCount);
  shuffle(rest, mulberry32(LAYOUT_SEED));
  const layout: CardIdentity[] = [];
  for (let i = 0; i < CELLS; i++) layout.push(FIXED[i] ?? rest.pop()!);
  return layout;
}

const flip = (i: number): Action => ({ type: 'flip', i });

export const TUTORIAL: TutorialScript = {
  layout: buildLayout(),
  intro: {
    title: 'Welcome to Manducat',
    text: 'All 36 cards lie <b>face down</b>: two armies of 15 cards (1, 2, 3, 5, 8 and M) and 6 gold cards. ' +
      'Nobody knows what is where. You are <b>Blue</b> and move first. The first to score <b>39 points</b> wins.',
    button: 'Let\'s play',
  },
  steps: [
    {
      title: 'Flip a card',
      text: 'Each turn you make <b>one action</b>. The simplest one is flipping a face-down card. ' +
        '<b>Tap the highlighted card.</b>',
      expect: flip(C.C4),
      reply: flip(C.D3),
    },
    {
      title: 'Find the gold',
      text: 'That\'s your 5 — it stays face up. The AI flipped its 2. ' +
        'Gold cards (G) are hidden among the others: flip one for <b>+3 points</b>. <b>Tap the highlighted card.</b>',
      expect: flip(C.C3),
      reply: flip(C.E5),
    },
    {
      title: 'Move into position',
      text: 'Gold! It leaves the board, and the cell is empty now. The AI found its 8 — the strongest card. ' +
        'A face-up card can step one cell (up, down, left, right) into an empty cell. ' +
        '<b>Tap your 5, then the empty cell next to the red 2.</b>',
      expect: { type: 'move', from: C.C4, to: C.C3 },
      reply: flip(C.E4),
    },
    {
      title: 'Capture',
      text: 'Cards attack like a rook: along a row or column, hitting the first card in line. ' +
        'You can capture a face-up enemy card of <b>equal or lower</b> strength and score its value. ' +
        '<b>Tap your 5, then the red 2.</b>',
      expect: { type: 'attack', from: C.C3, to: C.D3 },
      reply: flip(C.B5),
    },
    {
      title: 'Find the Manducat',
      text: '+2 points! The AI flipped <b>your</b> 3 — a card always belongs to its owner, whoever flips it. ' +
        'Now find your Manducat (M), the most powerful card. <b>Tap the highlighted card.</b>',
      expect: flip(C.B2),
      reply: flip(C.A2),
    },
    {
      title: 'Place the Manducat',
      text: 'A flipped M goes to its owner\'s <b>hand</b>. Placing it on any empty cell takes a turn. ' +
        '<b>Tap the M in your panel, then the cell next to the red 8.</b>',
      expect: { type: 'place', i: C.E4 },
      reply: flip(C.F2),
    },
    {
      title: 'Strike with M',
      text: 'M beats anything — but anything beats M, and it is worth 0 points. ' +
        'Don\'t let the 8 take it first: <b>tap your M, then the red 8.</b>',
      expect: { type: 'attack', from: C.E4, to: C.E5 },
    },
  ],
  outro: {
    title: 'Now play it out',
    text: '+8 points! You know the basics. A few more: equal cards beat each other, a <b>1 beats an 8</b>, and ' +
      `${DEFAULT_RULES.quietLimit} quiet moves in a row (no flips or captures) start the final countdown. ` +
      '<b>Finish the game</b> — win or lose — to open the campaign.',
  },
  freePlay: {
    title: 'Free play',
    text: `Reach ${DEFAULT_RULES.winScore} points first. Win or lose, finishing the game opens the campaign.`,
  },
};

/** The AI's scripted answers, in order (its k-th turn plays the k-th one). */
export const tutorialBotScript = (t: TutorialScript): Action[] => t.steps.flatMap(s => (s.reply ? [s.reply] : []));
