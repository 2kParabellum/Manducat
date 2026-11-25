// Shared state helpers used by the engine and by abilities: a piece entering a cell, a piece leaving the game.
import { BIT } from './board';
import { piecePoints } from './pieces';
import type { CardIdentity, GameCore, GameEvent, Piece, Player } from './types';
import { opponent } from './types';

export interface ApplyContext {
  /** What is under the card back (for flips in AI simulations where identities are unknown). */
  card?: CardIdentity;
  /** AI simulation: assume there is an enemy mine on the cell. */
  forceMine?: boolean;
}

/** A piece leaves the game: it goes to the public graveyard (summoned cards are not part of the army and don't). */
export function bury(g: GameCore, piece: Piece): void {
  if (!piece.summoned) g.graveyard?.push({ owner: piece.owner, value: piece.value });
}

/** A piece enters a cell (move, placing M, summoning). Returns true if it blew up on a mine. */
export function enterCell(g: GameCore, p: Player, i: number, piece: Piece, ctx: ApplyContext, ev: GameEvent[]): boolean {
  const m = g.mines[i];
  if (!m && !ctx.forceMine) { g.board[i] = piece; return false; }
  const enemy = opponent(piece.owner);
  const enemyMine = !!ctx.forceMine || (m & BIT[enemy]) !== 0;
  const value = piecePoints(piece, g.rules);
  // An enemy mine: its owner scores the card. Your own mine: you lose the card's value (not below 0).
  const pts = enemyMine ? value : 0;
  const lost = enemyMine ? 0 : Math.min(value, g.scores[piece.owner]);
  if (enemyMine) g.scores[enemy] += pts;
  else g.scores[piece.owner] -= lost;
  if (m) { g.mines = g.mines.slice(); g.mines[i] = 0; }
  g.board[i] = null;
  bury(g, piece);
  ev.push(enemyMine ? { t: 'boom', p, i, piece, pts, by: enemy } : { t: 'boom', p, i, piece, pts, by: piece.owner, lost });
  return true;
}
