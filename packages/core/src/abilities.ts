// Characters and their abilities. To add a character: describe its ability in ABILITIES
// (targets + apply) and add an entry to CHARACTERS. Texts and icons live in the client.
import { BIT, CELLS, NEIGHBORS, SIZE, idx, scoutArea } from './board';
import { enterCell } from './enter';
import type { ApplyContext } from './enter';
import { identityOf, strength } from './pieces';
import type { AbilityId, Cell, CharacterId, GameCore, GameEvent, Piece, Player } from './types';
import { opponent } from './types';

export interface AbilityDef {
  readonly id: AbilityId;
  /** Secret ability: the opponent only sees that it was used, not the target. */
  readonly secret: boolean;
  /** No target: the only "target" is NO_TARGET (-1); the UI applies it straight from the button. */
  readonly noTarget?: boolean;
  /** Valid targets (cell indices). For two-cell abilities — valid first cells. */
  targets(g: GameCore, p: Player): number[];
  /** Two-cell abilities (swap): valid second cells for the first cell i. */
  partners?(g: GameCore, p: Player, i: number): number[];
  /**
   * Apply to cell i (and j for two-cell abilities). Mutates the state in place and appends events to ev.
   * Returns true if the turn was "loud" (something blew up).
   */
  apply(g: GameCore, p: Player, i: number, ev: GameEvent[], j?: number, ctx?: ApplyContext): boolean | void;
}

/** Target of abilities without a target. */
export const NO_TARGET = -1;

/** Swapper: any card that is not stone can be swapped. */
const swappable = (c: Cell): boolean => c !== null && !(c.faceUp && c.stone);
const swapPartners = (g: GameCore, i: number): number[] =>
  swappable(g.board[i]) ? NEIGHBORS[i].filter(j => swappable(g.board[j])) : [];

const openOf = (g: GameCore, owner: Player, extra: (c: Piece) => boolean): number[] => {
  const res: number[] = [];
  g.board.forEach((c, i) => { if (c && c.faceUp && c.owner === owner && extra(c)) res.push(i); });
  return res;
};

const setPiece = (g: GameCore, i: number, patch: Partial<Piece>): Piece => {
  const c = g.board[i] as Piece;
  const next = { ...c, ...patch } as Piece;
  g.board[i] = next;
  return c;
};

export const ABILITIES: Readonly<Record<AbilityId, AbilityDef>> = {
  scout: {
    id: 'scout',
    secret: true,
    targets() {
      const res: number[] = [];
      for (let r = 0; r < SIZE - 1; r++) for (let c = 0; c < SIZE - 1; c++) res.push(idx(r, c));
      return res;
    },
    apply(g, p, i, ev) {
      ev.push({ t: 'ability', p, kind: 'scout', i });
      ev.push({
        t: 'scout', p,
        cells: scoutArea(i).map(j => ({ i: j, card: identityOf(g.board[j]), mines: g.board[j] === null ? g.mines[j] : 0 })),
      });
    },
  },
  poison: {
    id: 'poison',
    secret: false,
    targets: (g, p) => openOf(g, p, c => !c.poison),
    apply(g, p, i, ev) {
      const target = setPiece(g, i, { poison: g.rules.effectTurns });
      ev.push({ t: 'ability', p, kind: 'poison', i, target });
    },
  },
  shield: {
    id: 'shield',
    secret: false,
    targets: (g, p) => openOf(g, p, c => !c.shield),
    apply(g, p, i, ev) {
      const target = setPiece(g, i, { shield: g.rules.effectTurns });
      ev.push({ t: 'ability', p, kind: 'shield', i, target });
    },
  },
  curse: {
    id: 'curse',
    secret: false,
    // Not on M, not on 1s, not on a card that is already cursed
    targets: (g, p) => openOf(g, opponent(p), c => c.value !== 'M' && strength(c) > 1 && !c.curse),
    apply(g, p, i, ev) {
      // Lasts effectTurns turns of the card's owner
      const target = setPiece(g, i, { curse: 1, curseTurns: g.rules.effectTurns });
      ev.push({ t: 'ability', p, kind: 'curse', i, target });
    },
  },
  mine: {
    id: 'mine',
    secret: true,
    targets(g, p) {
      const res: number[] = [];
      for (let i = 0; i < CELLS; i++) if (g.board[i] === null && !(g.mines[i] & BIT[p])) res.push(i);
      return res;
    },
    apply(g, p, i, ev) {
      g.mines = g.mines.slice();
      g.mines[i] |= BIT[p];
      ev.push({ t: 'ability', p, kind: 'mine', i });
    },
  },
  swap: {
    id: 'swap',
    secret: false,
    targets(g) {
      const res: number[] = [];
      for (let i = 0; i < CELLS; i++) if (swapPartners(g, i).length) res.push(i);
      return res;
    },
    partners: (g, _p, i) => swapPartners(g, i),
    apply(g, p, i, ev, j) {
      const k = j!;
      const a = g.board[i], b = g.board[k];
      g.board[i] = b;
      g.board[k] = a;
      ev.push({ t: 'ability', p, kind: 'swap', i, j: k });
    },
  },
  haste: {
    id: 'haste',
    secret: false,
    targets: (g, p) => openOf(g, p, c => !c.haste && !c.stone),
    apply(g, p, i, ev) {
      const target = setPiece(g, i, { haste: g.rules.effectTurns });
      ev.push({ t: 'ability', p, kind: 'haste', i, target });
    },
  },
  summon: {
    id: 'summon',
    secret: false,
    targets(g) {
      const res: number[] = [];
      for (let i = 0; i < CELLS; i++) if (g.board[i] === null) res.push(i);
      return res;
    },
    apply(g, p, i, ev, _j, ctx) {
      ev.push({ t: 'ability', p, kind: 'summon', i });
      // A summoned card on a mine blows up, like a placed M
      return enterCell(g, p, i, { faceUp: true, owner: p, value: '3', summoned: true }, ctx ?? {}, ev);
    },
  },
  strike: {
    id: 'strike',
    secret: false,
    noTarget: true,
    // Useless (and not allowed) while the Avenger leads on points or the opponent has nothing to lose
    targets: (g, p) => (g.scores[p] <= g.scores[opponent(p)] && g.scores[opponent(p)] > 0 ? [NO_TARGET] : []),
    apply(g, p, _i, ev) {
      const opp = opponent(p);
      const pts = Math.min(g.rules.strikeDamage, g.scores[opp]);
      g.scores[opp] -= pts;
      ev.push({ t: 'ability', p, kind: 'strike', pts });
    },
  },
  stone: {
    id: 'stone',
    secret: false,
    targets: (g, p) => openOf(g, p, c => !c.stone),
    apply(g, p, i, ev) {
      const target = setPiece(g, i, { stone: g.rules.effectTurns, haste: 0 });
      ev.push({ t: 'ability', p, kind: 'stone', i, target });
    },
  },
};

export interface CharacterDef {
  readonly id: CharacterId;
  readonly ability: AbilityId | null;
}

export const CHARACTERS: Readonly<Record<CharacterId, CharacterDef>> = {
  jack: { id: 'jack', ability: null },
  scout: { id: 'scout', ability: 'scout' },
  poisoner: { id: 'poisoner', ability: 'poison' },
  witch: { id: 'witch', ability: 'curse' },
  miner: { id: 'miner', ability: 'mine' },
  defender: { id: 'defender', ability: 'shield' },
  swapper: { id: 'swapper', ability: 'swap' },
  runner: { id: 'runner', ability: 'haste' },
  necromancer: { id: 'necromancer', ability: 'summon' },
  avenger: { id: 'avenger', ability: 'strike' },
  gargoyle: { id: 'gargoyle', ability: 'stone' },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
export const abilityOf = (ch: CharacterId): AbilityId | null => CHARACTERS[ch].ability;
