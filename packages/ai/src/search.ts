// Search: expectimax. The AI's move is a max node, the opponent's reply a min node,
// flipping a face-down card averages over all possible cards, stepping onto a possible mine is weighted by risk.
import { listActions, opponent, scoutArea } from '@manducat/core';
import type { AbilityId, Action, Player } from '@manducat/core';
import { simApply } from './belief';
import type { SimState } from './belief';
import { W, WIN_VALUE, evaluate } from './evaluate';

/** Abilities that make sense deep in the search (scout and mines only at the root). */
export const tacticalAbility = (kind: AbilityId): boolean => kind !== 'scout' && kind !== 'mine';

export interface SearchOptions {
  /** How many best replies to consider at deep nodes (0 — all). */
  beam?: number;
}

/** Hard time limit: when exceeded, the search is aborted by throwing ABORT. */
export const ABORT = Symbol('abort');
let deadline = Infinity;
let nodes = 0;
export function setDeadline(ms: number): void { deadline = ms; }

export function search(s: SimState, depth: number, me: Player, opts: SearchOptions): number {
  if ((++nodes & 255) === 0 && Date.now() > deadline) throw ABORT;
  if (s.result) return s.result.winner === me ? WIN_VALUE + s.scores[me] : -WIN_VALUE - s.scores[opponent(me)];
  if (depth === 0) return evaluate(s, me);

  const actions = listActions(s, s.turn, tacticalAbility);
  if (actions.length === 0) return s.turn === me ? -WIN_VALUE : WIN_VALUE;   // no moves = loss
  const maximize = s.turn === me;

  let list = actions;
  if (opts.beam && depth >= 2 && actions.length > opts.beam) {
    list = actions
      .map(a => ({ a, v: actionValue(s, a, 0, me, opts) }))
      .sort((x, y) => (maximize ? y.v - x.v : x.v - y.v))
      .slice(0, opts.beam)
      .map(x => x.a);
  }

  let best = maximize ? -Infinity : Infinity;
  for (const a of list) {
    const v = actionValue(s, a, depth - 1, me, opts);
    if (maximize ? v > best : v < best) best = v;
  }
  return best;
}

export function actionValue(s: SimState, a: Action, depth: number, me: Player, opts: SearchOptions): number {
  if (a.type === 'flip') {
    const cell = s.board[a.i];
    if (cell && !cell.faceUp && !cell.known) {
      let total = 0, count = 0;
      for (const k in s.pool) {
        const n = s.pool[k];
        if (n <= 0) continue;
        count += n;
        total += n * search(simApply(s, a, k), depth, me, opts);
      }
      return count ? total / count : evaluate(s, me);
    }
  }
  if ((a.type === 'move' || a.type === 'place') && s.turn === me) {
    const r = s.risk[a.type === 'move' ? a.to : a.i];
    if (r >= 1) return search(simApply(s, a, undefined, true), depth, me, opts);
    if (r > 0) {
      return (1 - r) * search(simApply(s, a), depth, me, opts) +
        r * search(simApply(s, a, undefined, true), depth, me, opts);
    }
  }
  return search(simApply(s, a), depth, me, opts);
}

/** Scout value: how much is unknown in the 2×2 area. */
export function scoutInfo(s: SimState, i: number): number {
  let v = 0;
  for (const j of scoutArea(i)) {
    const c = s.board[j];
    if (c && !c.faceUp && !c.known) v += W.scoutCard;
    else if (c === null && s.risk[j] > 0 && s.risk[j] < 1) v += W.scoutMine * s.risk[j];
  }
  return v;
}
