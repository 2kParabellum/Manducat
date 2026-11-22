import { describe, expect, it } from 'vitest';
import {
  BIT, DEFAULT_RULES, NO_TARGET, abilityTargets, applyRaw, attackTargets, listActions, moveTargets,
} from '../src';
import type { Cell, CharacterId, GameCore, Piece, Player } from '../src';

const P = (owner: Player, value: Piece['value'], extra: Partial<Piece> = {}): Piece =>
  ({ faceUp: true, owner, value, ...extra });
const HIDDEN = (owner: Player | null, value: Piece['value'] | 'G'): Cell => ({ faceUp: false, owner, value });

function game(cells: Record<number, Cell>, blue: CharacterId, extra: Partial<GameCore> = {}): GameCore {
  const board: Cell[] = new Array(36).fill(null);
  for (const [i, c] of Object.entries(cells)) board[+i] = c;
  return {
    rules: DEFAULT_RULES, board, turn: 'blue',
    scores: { blue: 0, red: 0 }, hand: { blue: 0, red: 0 }, mines: new Array(36).fill(0),
    cooldown: { blue: 0, red: 0 }, quiet: { blue: 0, red: 0 }, countdown: 0, recent: { blue: [], red: [] },
    chars: { blue, red: 'jack' }, result: null, graveyard: [], ...extra,
  };
}

/** Red makes a harmless move with its piece on cell 35 / 34. */
const redPass = (g: GameCore): void => {
  applyRaw(g, g.board[35] ? { type: 'move', from: 35, to: 29 } : { type: 'move', from: 29, to: 35 });
};

describe('Swapper', () => {
  it('swaps any two neighbouring cards, effects travel with them', () => {
    const g = game({ 0: P('blue', '1'), 1: P('red', '8', { curse: 1 }), 6: HIDDEN('red', '5') }, 'swapper');
    applyRaw(g, { type: 'ability', kind: 'swap', i: 0, j: 1 });
    expect(g.board[0]).toMatchObject({ owner: 'red', value: '8', curse: 1 });
    expect(g.board[1]).toMatchObject({ owner: 'blue', value: '1' });
  });

  it('can swap face-down cards without revealing them', () => {
    const g = game({ 0: HIDDEN('red', '5'), 6: P('blue', '2') }, 'swapper');
    applyRaw(g, { type: 'ability', kind: 'swap', i: 0, j: 6 });
    expect(g.board[6]).toEqual(HIDDEN('red', '5'));
    expect(g.board[0]).toMatchObject({ value: '2' });
  });

  it('lists each neighbouring pair once, never empty cells or stone cards', () => {
    const g = game({ 0: P('blue', '1'), 1: P('red', '2'), 2: P('red', '3', { stone: 3 }), 7: P('red', '5') }, 'swapper');
    const swaps = listActions(g, 'blue').filter(a => a.type === 'ability');
    expect(swaps).toEqual([
      { type: 'ability', kind: 'swap', i: 0, j: 1 },
      { type: 'ability', kind: 'swap', i: 1, j: 7 },
    ]);
  });
});

describe('Runner', () => {
  it('a hasted card runs along a free path, not through cards', () => {
    const g = game({ 0: P('blue', '2'), 1: P('red', '8'), 35: P('red', '1') }, 'runner');
    applyRaw(g, { type: 'ability', kind: 'haste', i: 0 });
    expect((g.board[0] as Piece).haste).toBe(5);
    redPass(g);
    const t = moveTargets(g.board, 0);
    expect(t).toContain(6);
    expect(t).toContain(35);       // far corner via column A and the bottom rows
    expect(t).not.toContain(1);    // occupied
    expect(t.length).toBe(36 - 3);  // every empty cell is reachable
  });

  it('the run uses the haste up; mines only matter where it stops', () => {
    const g = game({ 0: P('blue', '5'), 35: P('red', '1') }, 'runner');
    g.mines[1] = BIT.red;
    applyRaw(g, { type: 'ability', kind: 'haste', i: 0 });
    redPass(g);
    applyRaw(g, { type: 'move', from: 0, to: 2 });   // passes over the mine on 1
    expect(g.board[2]).toMatchObject({ value: '5', haste: 0 });
    expect(g.mines[1]).toBe(BIT.red);
    redPass(g);
    expect(moveTargets(g.board, 2).sort((a, b) => a - b)).toEqual([1, 3, 8]);
  });

  it('a normal one-cell move or an attack also removes the haste', () => {
    const g = game({ 0: P('blue', '5'), 12: P('red', '2'), 35: P('red', '1') }, 'runner');
    applyRaw(g, { type: 'ability', kind: 'haste', i: 0 });
    redPass(g);
    applyRaw(g, { type: 'attack', from: 0, to: 12 });
    expect(g.board[12]).toMatchObject({ value: '5', haste: 0 });
  });

  it('haste lasts 5 own turns', () => {
    const g = game({ 0: P('blue', '5'), 5: P('blue', '1'), 35: P('red', '1') }, 'runner');
    applyRaw(g, { type: 'ability', kind: 'haste', i: 0 });
    const left: number[] = [];
    for (let k = 0; k < 5; k++) {
      redPass(g);
      left.push((g.board[0] as Piece).haste ?? 0);
      applyRaw(g, g.board[5] ? { type: 'move', from: 5, to: 11 } : { type: 'move', from: 11, to: 5 });
    }
    expect(left).toEqual([5, 4, 3, 2, 1]);
    expect((g.board[0] as Piece).haste).toBe(0);
  });
});

describe('Necromancer', () => {
  it('summons an own 3 on an empty cell; capturing it gives 3 points, no graveyard entry', () => {
    const g = game({ 0: P('red', '5'), 35: P('red', '1') }, 'necromancer');
    applyRaw(g, { type: 'ability', kind: 'summon', i: 12 });
    expect(g.board[12]).toEqual({ faceUp: true, owner: 'blue', value: '3', summoned: true });
    applyRaw(g, { type: 'attack', from: 0, to: 12 });
    expect(g.scores.red).toBe(3);
    expect(g.graveyard).toEqual([]);
  });

  it('a summoned card on an enemy mine blows up', () => {
    const g = game({}, 'necromancer');
    g.mines[7] = BIT.red;
    applyRaw(g, { type: 'ability', kind: 'summon', i: 7 });
    expect(g.board[7]).toBeNull();
    expect(g.scores.red).toBe(3);
    expect(g.quiet.blue).toBe(0);
  });
});

describe('Avenger', () => {
  it('takes 2 points from the opponent, not below 0', () => {
    const g = game({}, 'avenger', { scores: { blue: 5, red: 6 } });
    expect(abilityTargets(g, 'blue')).toEqual([NO_TARGET]);
    applyRaw(g, { type: 'ability', kind: 'strike', i: NO_TARGET });
    expect(g.scores).toEqual({ blue: 5, red: 4 });
    const h = game({}, 'avenger', { scores: { blue: 1, red: 1 } });
    applyRaw(h, { type: 'ability', kind: 'strike', i: NO_TARGET });
    expect(h.scores.red).toBe(0);
  });

  it('works on a tie, not while leading or when the opponent has 0', () => {
    expect(abilityTargets(game({}, 'avenger', { scores: { blue: 4, red: 4 } }), 'blue')).toEqual([NO_TARGET]);
    expect(abilityTargets(game({}, 'avenger', { scores: { blue: 5, red: 4 } }), 'blue')).toEqual([]);
    expect(abilityTargets(game({}, 'avenger'), 'blue')).toEqual([]);
  });
});

describe('Gargoyle', () => {
  it('a stone card cannot move, attack or be captured, but blocks lines', () => {
    const g = game({ 0: P('blue', '2'), 2: P('red', '1'), 12: P('red', '8'), 18: P('blue', '1') }, 'gargoyle');
    applyRaw(g, { type: 'ability', kind: 'stone', i: 0 });
    expect(moveTargets(g.board, 0)).toEqual([]);
    expect(attackTargets(g.board, 0)).toEqual([]);
    expect(attackTargets(g.board, 2)).toEqual([]);      // red 1 can't capture the stone 2
    expect(attackTargets(g.board, 12)).toEqual([18]);  // the stone card is not a target
  });

  it('lasts 5 opponent turns', () => {
    const g = game({ 0: P('blue', '2'), 5: P('blue', '1'), 35: P('red', '1') }, 'gargoyle');
    applyRaw(g, { type: 'ability', kind: 'stone', i: 0 });
    const left: number[] = [];
    for (let k = 0; k < 5; k++) {
      redPass(g);
      left.push((g.board[0] as Piece).stone ?? 0);
      applyRaw(g, g.board[5] ? { type: 'move', from: 5, to: 11 } : { type: 'move', from: 11, to: 5 });
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
    expect(moveTargets(g.board, 0).length).toBeGreaterThan(0);
  });
});
