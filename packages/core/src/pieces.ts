// Card strength, points and the "who beats whom" rule.
import type { CardIdentity, CardKey, Cell, Piece, Player, RulesConfig, UnitValue } from './types';
import { PLAYERS } from './types';

export const POWER: Readonly<Record<Exclude<UnitValue, 'M'>, number>> = { '1': 1, '2': 2, '3': 3, '5': 5, '8': 8 };

/** Current strength of a card including curses. M is the strongest. */
export const strength = (c: Piece): number => (c.value === 'M' ? 100 : POWER[c.value] - (c.curse ?? 0));

/** Points awarded for a captured card (curses reduce points too). */
export const piecePoints = (c: Piece, rules: RulesConfig): number =>
  c.value === 'M' ? rules.mPoints : POWER[c.value] - (c.curse ?? 0);

/**
 * Can a capture t. M beats everyone and everyone beats M. A real 1 beats a real
 * 8, even a cursed one. Otherwise strength must be at least equal.
 */
export function canBeat(a: Piece, t: Piece): boolean {
  if (a.value === 'M' || t.value === 'M') return true;
  if (a.value === '1' && t.value === '8') return true;
  return strength(a) >= strength(t);
}

export const keyOf = (owner: Player | null, value: string): CardKey => (owner ? owner + value : 'G');

const KEY_CARDS = new Map<CardKey, CardIdentity>();
export function cardOfKey(key: CardKey): CardIdentity {
  let c = KEY_CARDS.get(key);
  if (!c) {
    if (key === 'G') c = { owner: null, value: 'G' };
    else {
      const owner = PLAYERS.find(p => key.startsWith(p))!;
      c = { owner, value: key.slice(owner.length) as UnitValue };
    }
    KEY_CARDS.set(key, c);
  }
  return c;
}

/** Identity of a face-down card, if known (in the real game state). */
export function identityOf(cell: Cell): CardIdentity | undefined {
  if (!cell || cell.faceUp || cell.value === undefined) return undefined;
  return { owner: cell.owner ?? null, value: cell.value };
}

/** Full deck composition: how many cards of each kind. */
export function fullPool(rules: RulesConfig): Record<CardKey, number> {
  const pool: Record<CardKey, number> = {};
  for (const owner of PLAYERS) for (const [v, n] of rules.army) pool[owner + v] = n;
  pool.G = rules.gCount;
  return pool;
}
