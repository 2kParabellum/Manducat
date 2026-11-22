// What the AI knows beyond its player view: peeked cards, where enemy mines may be,
// which positions have already occurred. Updated only from what the AI is allowed to see.
import { BIT, NEIGHBORS, keyOf, opponent } from '@manducat/core';
import type { CardKey, GameCore, GameEvent, Player, PlayerView } from '@manducat/core';

export function positionKey(g: GameCore): string {
  let k = g.turn[0] + g.hand.blue + g.hand.red;
  for (const c of g.board) {
    k += c === null ? '.' : !c.faceUp ? '#'
      : c.owner[0] + c.value + (c.curse || '') + (c.poison ? 'p' : '') + (c.shield ? 's' : '') +
        (c.haste ? 'h' : '') + (c.stone ? 'x' : '') + ',';
  }
  return k;
}

export class Knowledge {
  /** Peeked face-down cards: cell → card. */
  readonly known = new Map<number, CardKey>();
  /** One "cell → weight" set per enemy mine with an unknown location. */
  mineSets: Map<number, number>[] = [];
  /** Enemy mines whose location is known exactly. */
  readonly knownMines = new Set<number>();
  /** How many times a position occurred (against endless shuffling). */
  readonly positions = new Map<string, number>();
  private prevMines: number[] | null = null;

  constructor(readonly me: Player) {}

  observe(view: PlayerView, events: readonly GameEvent[]): void {
    const enemy = opponent(this.me);
    const prevMines = this.prevMines ?? view.mines;
    for (const e of events) {
      switch (e.t) {
        case 'flip': case 'flipG': case 'flipM':
          this.known.delete(e.i);
          break;
        case 'move':
          this.entered(e.to, events, prevMines);
          break;
        case 'place':
          this.entered(e.i, events, prevMines);
          break;
        case 'ability':
          if (e.kind === 'mine' && e.p === enemy) this.enemyMined(view);
          else if (e.kind === 'summon' && e.i !== undefined) this.entered(e.i, events, prevMines);
          else if (e.kind === 'swap' && e.i !== undefined && e.j !== undefined) this.swapped(e.i, e.j);
          break;
        case 'scout':
          if (e.p !== this.me) break;
          for (const c of e.cells) {
            if (c.card) this.known.set(c.i, keyOf(c.card.owner, c.card.value));
            else if (view.board[c.i] === null) {
              if (c.mines & BIT[enemy]) this.markKnownMine(c.i);
              else this.clearCell(c.i);
            }
          }
          break;
      }
    }
    this.prevMines = view.mines.slice();
    const key = positionKey(view);
    this.positions.set(key, (this.positions.get(key) ?? 0) + 1);
  }

  /** Probability of an enemy mine in each cell. */
  risk(cells: number): Float64Array {
    const risk = new Float64Array(cells);
    for (let i = 0; i < cells; i++) {
      if (this.knownMines.has(i)) { risk[i] = 1; continue; }
      let safe = 1;
      for (const s of this.mineSets) if (s.has(i)) safe *= 1 - share(s, i);
      risk[i] = 1 - safe;
    }
    return risk;
  }

  /** Someone entered cell X: no explosion — no mine there; explosion not on my mine — it was an enemy one. */
  private entered(X: number, events: readonly GameEvent[], prevMines: readonly number[]): void {
    const boom = events.some(e => e.t === 'boom' && e.i === X);
    if (!boom) this.clearCell(X);
    else if (!(prevMines[X] & BIT[this.me])) this.consumeMine(X);
  }

  /** Two cards were swapped: peeked face-down cards travel with them. */
  private swapped(i: number, j: number): void {
    const a = this.known.get(i), b = this.known.get(j);
    this.known.delete(i);
    this.known.delete(j);
    if (a) this.known.set(j, a);
    if (b) this.known.set(i, b);
  }

  /** The opponent placed a mine: it is somewhere among the empty cells, more likely in the path of my pieces. */
  private enemyMined(view: PlayerView): void {
    const cand = new Map<number, number>();
    view.board.forEach((c, i) => {
      if (c !== null || this.knownMines.has(i)) return;
      let adj = 0;
      for (const j of NEIGHBORS[i]) {
        const x = view.board[j];
        if (x && x.faceUp && x.owner === this.me) adj++;
      }
      cand.set(i, 1 + 3 * adj);
    });
    if (cand.size) this.mineSets.push(cand);
  }

  private prune(): void { this.mineSets = this.mineSets.filter(s => s.size > 0); }

  private clearCell(i: number): void {
    this.knownMines.delete(i);
    for (const s of this.mineSets) s.delete(i);
    this.prune();
  }

  /** Cross out one unknown mine that most likely is the one in cell i. */
  private takeMineEvent(i: number): void {
    let best = -1, bestShare = 0;
    this.mineSets.forEach((s, k) => {
      const sh = share(s, i);
      if (sh > bestShare) { best = k; bestShare = sh; }
    });
    if (best >= 0) this.mineSets.splice(best, 1);
    for (const s of this.mineSets) s.delete(i);
    this.prune();
  }

  private consumeMine(i: number): void {
    if (this.knownMines.has(i)) this.clearCell(i);
    else this.takeMineEvent(i);
  }

  private markKnownMine(i: number): void {
    if (this.knownMines.has(i)) return;
    this.takeMineEvent(i);
    this.knownMines.add(i);
  }
}

function share(m: Map<number, number>, i: number): number {
  const w = m.get(i);
  if (w === undefined) return 0;
  let sum = 0;
  for (const x of m.values()) sum += x;
  return w / sum;
}
