// Персонажи и их способности. Чтобы добавить персонажа: описать способность в ABILITIES
// (цели + применение) и добавить запись в CHARACTERS. Тексты и иконки — в клиенте.
import { BIT, CELLS, SIZE, idx, scoutArea } from './board';
import { identityOf, strength } from './pieces';
import type { AbilityId, CharacterId, GameCore, GameEvent, Piece, Player } from './types';
import { opponent } from './types';

export interface AbilityDef {
  readonly id: AbilityId;
  /** Тайная способность: соперник видит только сам факт применения, без цели. */
  readonly secret: boolean;
  /** Допустимые цели (индексы клеток). */
  targets(g: GameCore, p: Player): number[];
  /** Применить к клетке i. Состояние меняется на месте, события дописываются в ev. */
  apply(g: GameCore, p: Player, i: number, ev: GameEvent[]): void;
}

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
    // Нельзя на M и на карты с силой 1 (в том числе уже проклятые до единицы)
    targets: (g, p) => openOf(g, opponent(p), c => c.value !== 'M' && strength(c) > 1),
    apply(g, p, i, ev) {
      const c = g.board[i] as Piece;
      const target = setPiece(g, i, { curse: (c.curse ?? 0) + 1 });
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
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
export const abilityOf = (ch: CharacterId): AbilityId | null => CHARACTERS[ch].ability;
