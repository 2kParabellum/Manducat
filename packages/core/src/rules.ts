// Which actions are possible in a position.
import { ABILITIES, abilityOf } from './abilities';
import { DIRS, RAYS, idx, inside, rc } from './board';
import { canBeat } from './pieces';
import type { AbilityId, Action, Cell, GameCore, Player } from './types';

/** Adjacent empty cells a card can move to. */
export function moveTargets(board: readonly Cell[], i: number): number[] {
  const [r, c] = rc(i);
  const res: number[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (inside(nr, nc) && board[idx(nr, nc)] === null) res.push(idx(nr, nc));
  }
  return res;
}

/** What the card at i can capture: the first card along a line (rook-like), face up, enemy, by strength. */
export function attackTargets(board: readonly Cell[], i: number): number[] {
  const me = board[i];
  if (!me || !me.faceUp) return [];
  const res: number[] = [];
  const rays = RAYS[i];
  for (let d = 0; d < 4; d++) {
    const ray = rays[d];
    for (let k = 0; k < ray.length; k++) {
      const target = board[ray[k]];
      if (target === null) continue;
      if (target.faceUp && target.owner !== me.owner && canBeat(me, target)) res.push(ray[k]);
      break;
    }
  }
  return res;
}

export function emptyCells(board: readonly Cell[]): number[] {
  const res: number[] = [];
  board.forEach((c, i) => { if (c === null) res.push(i); });
  return res;
}

export function abilityTargets(g: GameCore, p: Player): number[] {
  const kind = abilityOf(g.chars[p]);
  return kind ? ABILITIES[kind].targets(g, p) : [];
}

export const abilityReady = (g: GameCore, p: Player): boolean =>
  abilityOf(g.chars[p]) !== null && g.cooldown[p] === 0;

/**
 * All possible actions of a player.
 * abilityFilter — which abilities to consider (the AI drops the "informational" ones deep in the search).
 */
export function listActions(g: GameCore, player: Player, abilityFilter?: (kind: AbilityId) => boolean): Action[] {
  const board = g.board;
  const acts: Action[] = [];
  let hasEmpty = false;
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c === null) { hasEmpty = true; continue; }
    if (!c.faceUp) { acts.push({ type: 'flip', i }); continue; }
    if (c.owner !== player) continue;
    for (const t of attackTargets(board, i)) acts.push({ type: 'attack', from: i, to: t });
    for (const t of moveTargets(board, i)) acts.push({ type: 'move', from: i, to: t });
  }
  if (g.hand[player] > 0 && hasEmpty) {
    for (let i = 0; i < board.length; i++) if (board[i] === null) acts.push({ type: 'place', i });
  }
  const kind = abilityOf(g.chars[player]);
  if (kind && g.cooldown[player] === 0 && (!abilityFilter || abilityFilter(kind))) {
    for (const i of ABILITIES[kind].targets(g, player)) acts.push({ type: 'ability', kind, i });
  }
  return acts;
}

const actionKey = (a: Action): string => JSON.stringify(a);

/** Validates an action before applying it (a server must validate everything a client sends). */
export function isLegalAction(g: GameCore, player: Player, a: Action): boolean {
  if (g.result || g.turn !== player) return false;
  const key = actionKey(a);
  return listActions(g, player).some(x => actionKey(x) === key);
}
