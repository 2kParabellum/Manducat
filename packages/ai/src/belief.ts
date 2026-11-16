// Состояние партии «глазами ИИ» и быстрое применение ходов в симуляции.
import { BIT, CELLS, applyRaw, cardOfKey, fullPool, keyOf, opponent } from '@manducat/core';
import type { Action, CardKey, Concealed, GameCore, PlayerView } from '@manducat/core';
import type { Knowledge } from './knowledge';

export interface SimState extends GameCore {
  /** Сколько карт каждого вида может лежать под неизвестными рубашками. */
  pool: Record<CardKey, number>;
  /** Сколько закрытых карт неизвестно. */
  hidden: number;
  /** Вероятность вражеской мины по клеткам. */
  risk: Float64Array;
}

const HIDDEN: Concealed = Object.freeze({ faceUp: false as const });
const KNOWN_HIDDEN = new Map<CardKey, Concealed>();
const knownHidden = (k: CardKey): Concealed => {
  let c = KNOWN_HIDDEN.get(k);
  if (!c) { c = Object.freeze({ faceUp: false as const, known: k }); KNOWN_HIDDEN.set(k, c); }
  return c;
};

export function makeBelief(view: PlayerView, k: Knowledge): SimState {
  const me = k.me;
  const pool = fullPool(view.rules);
  let hidden = 0;
  const board = view.board.map((c, i) => {
    if (c === null) return null;
    if (!c.faceUp) {
      const key = k.known.get(i);
      if (key) { pool[key]--; return knownHidden(key); }
      hidden++;
      return HIDDEN;
    }
    pool[keyOf(c.owner, c.value)]--;
    return c;   // открытые карты не мутируются — можно делить
  });
  for (const p of ['blue', 'red'] as const) pool[p + 'M'] -= view.hand[p];
  for (const g of view.graveyard) pool[keyOf(g.owner, g.value)]--;
  const enemyBit = BIT[opponent(me)];
  return {
    rules: view.rules,
    board,
    turn: view.turn,
    scores: { ...view.scores },
    hand: { ...view.hand },
    mines: view.mines.map((m, i) => (m & BIT[me]) | (k.knownMines.has(i) ? enemyBit : 0)),
    cooldown: { ...view.cooldown },
    quiet: { ...view.quiet },
    chars: view.chars,
    result: view.result,
    pool,
    hidden,
    risk: k.risk(CELLS),
  };
}

/** Новое состояние после хода. key — что окажется под рубашкой при открытии неизвестной карты. */
export function simApply(s: SimState, a: Action, key?: CardKey, forceMine?: boolean): SimState {
  const n: SimState = {
    rules: s.rules,
    board: s.board.slice(),
    turn: s.turn,
    scores: { blue: s.scores.blue, red: s.scores.red },
    hand: { blue: s.hand.blue, red: s.hand.red },
    mines: s.mines,
    cooldown: { blue: s.cooldown.blue, red: s.cooldown.red },
    quiet: { blue: s.quiet.blue, red: s.quiet.red },
    chars: s.chars,
    result: null,
    pool: s.pool,
    hidden: s.hidden,
    risk: s.risk,
  };
  let card;
  if (a.type === 'flip') {
    const cell = s.board[a.i] as Concealed;
    if (cell.known) card = cardOfKey(cell.known);
    else {
      n.pool = { ...s.pool };
      n.pool[key!]--;
      n.hidden--;
      card = cardOfKey(key!);
    }
  }
  applyRaw(n, a, { card, forceMine });
  return n;
}
