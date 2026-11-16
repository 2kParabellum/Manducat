// Что ИИ знает сверх «вида игрока»: подсмотренные карты, где могут стоять вражеские мины,
// какие позиции уже встречались. Обновляется только по тому, что ИИ имеет право видеть.
import { BIT, NEIGHBORS, keyOf, opponent } from '@manducat/core';
import type { CardKey, GameCore, GameEvent, Player, PlayerView } from '@manducat/core';

export function positionKey(g: GameCore): string {
  let k = g.turn[0] + g.hand.blue + g.hand.red;
  for (const c of g.board) {
    k += c === null ? '.' : !c.faceUp ? '#'
      : c.owner[0] + c.value + (c.curse || '') + (c.poison ? 'p' : '') + (c.shield ? 's' : '') + ',';
  }
  return k;
}

export class Knowledge {
  /** Подсмотренные закрытые карты: клетка → карта. */
  readonly known = new Map<number, CardKey>();
  /** По одному набору «клетка → вес» на каждую вражескую мину с неизвестным местом. */
  mineSets: Map<number, number>[] = [];
  /** Вражеские мины, место которых известно точно. */
  readonly knownMines = new Set<number>();
  /** Сколько раз встречалась позиция (против бесконечного топтания). */
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

  /** Вероятность вражеской мины в каждой клетке. */
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

  /** Кто-то встал на клетку X: если без взрыва — мины там нет; если со взрывом не на моей мине — это была вражеская. */
  private entered(X: number, events: readonly GameEvent[], prevMines: readonly number[]): void {
    const boom = events.some(e => e.t === 'boom' && e.i === X);
    if (!boom) this.clearCell(X);
    else if (!(prevMines[X] & BIT[this.me])) this.consumeMine(X);
  }

  /** Соперник поставил мину: она где-то среди пустых клеток, вероятнее — на пути моих фигур. */
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

  /** Вычеркнуть одну неизвестную мину, которая, скорее всего, и стоит в клетке i. */
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
