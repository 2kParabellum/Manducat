import { describe, expect, it } from 'vitest';
import {
  BIT, DEFAULT_RULES, abilityTargets, applyRaw, canBeat, listActions, piecePoints, strength,
} from '../src';
import type { Action, Cell, GameCore, Piece, Player } from '../src';

const P = (owner: Player, value: Piece['value'], extra: Partial<Piece> = {}): Piece =>
  ({ faceUp: true, owner, value, ...extra });

function game(cells: Record<number, Cell>, extra: Partial<GameCore> = {}): GameCore {
  const board: Cell[] = new Array(36).fill(null);
  for (const [i, c] of Object.entries(cells)) board[+i] = c;
  return {
    rules: DEFAULT_RULES, board, turn: 'blue',
    scores: { blue: 0, red: 0 }, hand: { blue: 0, red: 0 }, mines: new Array(36).fill(0),
    cooldown: { blue: 0, red: 0 }, quiet: { blue: 0, red: 0 },
    chars: { blue: 'jack', red: 'jack' }, result: null, ...extra,
  };
}

/** Фигуры 0 (синие) и 35 (красные) ходят туда-обратно — «тихие» ходы. */
function shuffleMove(g: GameCore): Action {
  if (g.turn === 'blue') return g.board[0] ? { type: 'move', from: 0, to: 1 } : { type: 'move', from: 1, to: 0 };
  return g.board[35] ? { type: 'move', from: 35, to: 34 } : { type: 'move', from: 34, to: 35 };
}

describe('щит', () => {
  it('отражает атаку: атакующий на месте, цель жива, щит снят', () => {
    const g = game({ 0: P('blue', '8'), 2: P('red', '5', { shield: 3 }) });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect((g.board[0] as Piece).value).toBe('8');
    expect(g.board[2]).toMatchObject({ value: '5', shield: 0 });
    expect(g.scores.blue).toBe(0);
  });

  it('действует 5 ходов соперника', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') }, { chars: { blue: 'defender', red: 'jack' } });
    applyRaw(g, { type: 'ability', kind: 'shield', i: 0 });
    const left: number[] = [];
    for (let k = 0; k < 5; k++) {
      applyRaw(g, shuffleMove(g));
      left.push(((g.board[0] ?? g.board[1]) as Piece).shield ?? 0);
      applyRaw(g, shuffleMove(g));
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
  });
});

describe('яд', () => {
  it('съевший погибает, даже под щитом; очки обоим', () => {
    const g = game({ 0: P('blue', '8', { shield: 4 }), 2: P('red', '5', { poison: 3 }) });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.board[0]).toBeNull();
    expect(g.board[2]).toBeNull();
    expect(g.scores).toEqual({ blue: 5, red: 8 });
  });
});

describe('порча', () => {
  it('снижает силу и очки', () => {
    const c8 = P('red', '8', { curse: 1 });
    expect(strength(c8)).toBe(7);
    expect(piecePoints(c8, DEFAULT_RULES)).toBe(7);
  });

  it('настоящая 1 бьёт проклятую 8, проклятая 2 восьмёрку — нет', () => {
    expect(canBeat(P('blue', '1'), P('red', '8', { curse: 1 }))).toBe(true);
    expect(canBeat(P('blue', '2', { curse: 1 }), P('red', '8'))).toBe(false);
  });

  it('равные с порчей: 5 бьёт проклятую 5, наоборот нет', () => {
    expect(canBeat(P('blue', '5'), P('red', '5', { curse: 1 }))).toBe(true);
    expect(canBeat(P('red', '5', { curse: 1 }), P('blue', '5'))).toBe(false);
  });

  it('складывается: за 8 с двумя порчами дают 6 очков', () => {
    const g = game({ 0: P('blue', '8'), 2: P('red', '8', { curse: 2 }) });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.scores.blue).toBe(6);
  });

  it('снимается, когда проклятая карта кого-то съела', () => {
    const g = game({ 0: P('blue', '5', { curse: 2 }), 2: P('red', '2') });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.board[2]).toMatchObject({ value: '5', curse: 0 });
  });

  it('нельзя на силу 1 и на M', () => {
    const g = game(
      { 0: P('blue', '3'), 1: P('red', '2', { curse: 1 }), 2: P('red', '1'), 3: P('red', 'M'), 4: P('red', '8') },
      { chars: { blue: 'witch', red: 'jack' } },
    );
    expect(abilityTargets(g, 'blue')).toEqual([4]);
    applyRaw(g, { type: 'ability', kind: 'curse', i: 4 });
    expect((g.board[4] as Piece).curse).toBe(1);
  });
});

describe('мины', () => {
  it('чужая фигура погибает, минёр получает очки, мина исчезает', () => {
    const g = game({ 0: P('red', '5') }, { turn: 'red' });
    g.mines[1] = BIT.blue;
    applyRaw(g, { type: 'move', from: 0, to: 1 });
    expect(g.board[1]).toBeNull();
    expect(g.scores.blue).toBe(5);
    expect(g.mines[1]).toBe(0);
  });

  it('своя фигура тоже подрывается, щит не спасает, очков нет', () => {
    const g = game({ 0: P('blue', '5', { shield: 5 }) });
    g.mines[1] = BIT.blue;
    applyRaw(g, { type: 'move', from: 0, to: 1 });
    expect(g.board[1]).toBeNull();
    expect(g.scores).toEqual({ blue: 0, red: 0 });
  });

  it('выложенная M подрывается', () => {
    const g = game({}, { hand: { blue: 1, red: 0 } });
    g.mines[7] = BIT.red;
    applyRaw(g, { type: 'place', i: 7 });
    expect(g.board[7]).toBeNull();
    expect(g.hand.blue).toBe(0);
  });

  it('атака по прямой пролетает над минами', () => {
    const g = game({ 0: P('blue', '8'), 3: P('red', '2') });
    g.mines[1] = BIT.red;
    g.mines[2] = BIT.red;
    applyRaw(g, { type: 'attack', from: 0, to: 3 });
    expect((g.board[3] as Piece).value).toBe('8');
    expect(g.scores.blue).toBe(2);
  });
});

describe('способности', () => {
  it('перезарядка: снова доступна на 16-м своём ходу', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') }, { chars: { blue: 'defender', red: 'jack' } });
    applyRaw(g, { type: 'ability', kind: 'shield', i: 0 });   // ход 1
    let readyTurn: number | null = null;
    for (let t = 2; t <= 20 && readyTurn === null; t++) {
      applyRaw(g, shuffleMove(g));
      if (listActions(g, 'blue').some(a => a.type === 'ability')) readyTurn = t;
      applyRaw(g, shuffleMove(g));
    }
    expect(readyTurn).toBe(16);
  });
});

describe('правило 20 тихих ходов', () => {
  it('при равенстве очков проигрывает сделавший 20-й ход', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') });
    let n = 0;
    while (!g.result && n < 100) { applyRaw(g, shuffleMove(g)); n++; }
    expect(n).toBe(39);   // 20-й ход синих
    expect(g.result).toEqual({ winner: 'red', reason: 'quiet', mover: 'blue' });
  });

  it('у кого больше очков — тот и победил', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') }, { scores: { blue: 5, red: 0 } });
    while (!g.result) applyRaw(g, shuffleMove(g));
    expect(g.result!.winner).toBe('blue');
  });

  it('открытие сбрасывает счётчик у обоих', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1'), 20: { faceUp: false, owner: 'red', value: '3' } },
      { quiet: { blue: 19, red: 19 } });
    applyRaw(g, { type: 'flip', i: 20 });
    expect(g.result).toBeNull();
    expect(g.quiet).toEqual({ blue: 0, red: 0 });
  });
});
