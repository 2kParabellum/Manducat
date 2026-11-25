import { describe, expect, it } from 'vitest';
import {
  BIT, DEFAULT_RULES, abilityTargets, applyRaw, bannedAction, canBeat, listActions, piecePoints, repeatBanKey,
  strength,
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
    cooldown: { blue: 0, red: 0 }, quiet: { blue: 0, red: 0 }, countdown: 0, recent: { blue: [], red: [] },
    chars: { blue: 'jack', red: 'jack' }, result: null, ...extra,
  };
}

/** Pieces 0 (blue) and 35 (red) shuffle back and forth — quiet moves. */
function shuffleMove(g: GameCore): Action {
  if (g.turn === 'blue') return g.board[0] ? { type: 'move', from: 0, to: 1 } : { type: 'move', from: 1, to: 0 };
  return g.board[35] ? { type: 'move', from: 35, to: 34 } : { type: 'move', from: 34, to: 35 };
}

describe('shield', () => {
  it('reflects an attack: attacker stays, target survives, shield is gone', () => {
    const g = game({ 0: P('blue', '8'), 2: P('red', '5', { shield: 3 }) });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect((g.board[0] as Piece).value).toBe('8');
    expect(g.board[2]).toMatchObject({ value: '5', shield: 0 });
    expect(g.scores.blue).toBe(0);
  });

  it('lasts 5 opponent turns', () => {
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

describe('poison', () => {
  it('the eater dies even under a shield; both sides score', () => {
    const g = game({ 0: P('blue', '8', { shield: 4 }), 2: P('red', '5', { poison: 3 }) });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.board[0]).toBeNull();
    expect(g.board[2]).toBeNull();
    expect(g.scores).toEqual({ blue: 5, red: 8 });
  });
});

describe('curse', () => {
  it('reduces strength and points', () => {
    const c8 = P('red', '8', { curse: 1 });
    expect(strength(c8)).toBe(7);
    expect(piecePoints(c8, DEFAULT_RULES)).toBe(7);
  });

  it('a real 1 beats a cursed 8, a cursed 2 does not beat an 8', () => {
    expect(canBeat(P('blue', '1'), P('red', '8', { curse: 1 }))).toBe(true);
    expect(canBeat(P('blue', '2', { curse: 1 }), P('red', '8'))).toBe(false);
  });

  it('equal values with a curse: 5 beats a cursed 5, not vice versa', () => {
    expect(canBeat(P('blue', '5'), P('red', '5', { curse: 1 }))).toBe(true);
    expect(canBeat(P('red', '5', { curse: 1 }), P('blue', '5'))).toBe(false);
  });

  it('is not lifted when the cursed card captures', () => {
    const g = game({ 0: P('blue', '5', { curse: 1, curseTurns: 3 }), 2: P('red', '2') });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.board[2]).toMatchObject({ value: '5', curse: 1 });
  });

  it('lasts 5 turns of the card owner, then is gone', () => {
    const g = game({ 0: P('blue', '3'), 35: P('red', '8') }, { chars: { blue: 'witch', red: 'jack' } });
    applyRaw(g, { type: 'ability', kind: 'curse', i: 35 });
    const left: number[] = [];
    for (let k = 0; k < 5; k++) {
      applyRaw(g, shuffleMove(g));   // red's turn
      const c = (g.board[35] ?? g.board[34]) as Piece;
      left.push(c.curse ? c.curseTurns! : 0);
      applyRaw(g, shuffleMove(g));
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
  });

  it('a cursed card cannot be cursed again', () => {
    const g = game({ 0: P('blue', '3'), 4: P('red', '8', { curse: 1, curseTurns: 2 }), 5: P('red', '5') },
      { chars: { blue: 'witch', red: 'jack' } });
    expect(abilityTargets(g, 'blue')).toEqual([5]);
  });

  it('cannot target strength 1 or M', () => {
    const g = game(
      { 0: P('blue', '3'), 2: P('red', '1'), 3: P('red', 'M'), 4: P('red', '8') },
      { chars: { blue: 'witch', red: 'jack' } },
    );
    expect(abilityTargets(g, 'blue')).toEqual([4]);
    applyRaw(g, { type: 'ability', kind: 'curse', i: 4 });
    expect((g.board[4] as Piece).curse).toBe(1);
  });
});

describe('mines', () => {
  it('an enemy piece dies, the miner scores, the mine is gone', () => {
    const g = game({ 0: P('red', '5') }, { turn: 'red' });
    g.mines[1] = BIT.blue;
    applyRaw(g, { type: 'move', from: 0, to: 1 });
    expect(g.board[1]).toBeNull();
    expect(g.scores.blue).toBe(5);
    expect(g.mines[1]).toBe(0);
  });

  it('own piece blows up too, shield does not help, the owner loses its points', () => {
    const g = game({ 0: P('blue', '5', { shield: 5 }) }, { scores: { blue: 7, red: 4 } });
    g.mines[1] = BIT.blue;
    const ev = applyRaw(g, { type: 'move', from: 0, to: 1 });
    expect(g.board[1]).toBeNull();
    expect(g.scores).toEqual({ blue: 2, red: 4 });
    expect(ev).toContainEqual(expect.objectContaining({ t: 'boom', by: 'blue', pts: 0, lost: 5 }));
  });

  it('own mine damage does not go below 0', () => {
    const g = game({ 0: P('blue', '8') }, { scores: { blue: 3, red: 0 } });
    g.mines[1] = BIT.blue;
    applyRaw(g, { type: 'move', from: 0, to: 1 });
    expect(g.scores.blue).toBe(0);
  });

  it('a placed M blows up', () => {
    const g = game({}, { hand: { blue: 1, red: 0 } });
    g.mines[7] = BIT.red;
    applyRaw(g, { type: 'place', i: 7 });
    expect(g.board[7]).toBeNull();
    expect(g.hand.blue).toBe(0);
  });

  it('a line attack passes over mines', () => {
    const g = game({ 0: P('blue', '8'), 3: P('red', '2') });
    g.mines[1] = BIT.red;
    g.mines[2] = BIT.red;
    applyRaw(g, { type: 'attack', from: 0, to: 3 });
    expect((g.board[3] as Piece).value).toBe('8');
    expect(g.scores.blue).toBe(2);
  });
});

describe('abilities', () => {
  it('cooldown: available again on the 16th own turn', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') }, { chars: { blue: 'defender', red: 'jack' } });
    applyRaw(g, { type: 'ability', kind: 'shield', i: 0 });   // turn 1
    let readyTurn: number | null = null;
    for (let t = 2; t <= 20 && readyTurn === null; t++) {
      applyRaw(g, shuffleMove(g));
      if (listActions(g, 'blue').some(a => a.type === 'ability')) readyTurn = t;
      applyRaw(g, shuffleMove(g));
    }
    expect(readyTurn).toBe(16);
  });
});

describe('quiet moves and the final countdown', () => {
  it('15 quiet moves start a countdown of 10 moves each; on a tie the last mover loses', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') });
    let n = 0, started = -1;
    while (!g.result && n < 100) {
      const ev = applyRaw(g, shuffleMove(g)); n++;
      if (ev.some(e => e.t === 'countdown')) started = n;
    }
    expect(started).toBe(29);  // blue's 15th quiet move
    expect(n).toBe(49);        // blue's 10th move of the countdown
    expect(g.result).toEqual({ winner: 'red', reason: 'quiet', mover: 'blue' });
  });

  it('more points wins', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') }, { scores: { blue: 5, red: 0 } });
    while (!g.result) applyRaw(g, shuffleMove(g));
    expect(g.result!.winner).toBe('blue');
  });

  it('a flip resets the quiet counters', () => {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1'), 20: { faceUp: false, owner: 'red', value: '3' } },
      { quiet: { blue: 14, red: 14 } });
    applyRaw(g, { type: 'flip', i: 20 });
    expect(g.result).toBeNull();
    expect(g.countdown).toBe(0);
    expect(g.quiet).toEqual({ blue: 0, red: 0 });
  });

  it('flips and captures do not stop a running countdown', () => {
    const g = game({ 0: P('blue', '8'), 2: P('red', '2'), 20: { faceUp: false, owner: 'red', value: '3' } },
      { countdown: 3 });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.countdown).toBe(2);
    applyRaw(g, { type: 'flip', i: 20 });
    expect(g.countdown).toBe(1);
    applyRaw(g, { type: 'move', from: 2, to: 3 });
    expect(g.result).toEqual({ winner: 'blue', reason: 'quiet', mover: 'blue' });
  });

  it('reaching 39 points still wins immediately during the countdown', () => {
    const g = game({ 0: P('blue', '8'), 2: P('red', '8') }, { countdown: 5, scores: { blue: 35, red: 0 } });
    applyRaw(g, { type: 'attack', from: 0, to: 2 });
    expect(g.result).toEqual({ winner: 'blue', reason: 'score' });
  });
});

describe('Rule of Three Repeats', () => {
  const A: Action = { type: 'move', from: 0, to: 1 };
  const B: Action = { type: 'move', from: 1, to: 0 };

  function repeated(): GameCore {
    const g = game({ 0: P('blue', '1'), 35: P('red', '1') });
    for (let k = 0; k < 3; k++) {
      applyRaw(g, A); applyRaw(g, shuffleMove(g));
      applyRaw(g, B); applyRaw(g, shuffleMove(g));
    }
    return g;
  }

  it('A, B, A, B, A, B bans A on the next turn', () => {
    const g = repeated();
    expect(repeatBanKey(g, 'blue')).toBe('move:0-1');
    expect(bannedAction(g, 'blue')).toEqual(A);
    const acts = listActions(g, 'blue');
    expect(acts).not.toContainEqual(A);
    expect(acts).toContainEqual({ type: 'move', from: 0, to: 6 });
  });

  it('the ban is lifted after a different action', () => {
    const g = repeated();
    applyRaw(g, { type: 'move', from: 0, to: 6 });
    applyRaw(g, shuffleMove(g));
    expect(repeatBanKey(g, 'blue')).toBeNull();
  });

  it('only five repeats are not enough', () => {
    const g = game({ 0: P('blue', '1') });
    g.recent = { blue: ['move:1-0', 'move:0-1', 'move:1-0', 'move:0-1', 'move:1-0'], red: [] };
    expect(repeatBanKey(g, 'blue')).toBeNull();
  });

  it('flips, place and abilities never count', () => {
    const g = game({ 0: P('blue', '1') });
    g.recent = { blue: ['-', 'move:1-0', '-', 'move:1-0', '-', 'move:1-0'], red: [] };
    expect(repeatBanKey(g, 'blue')).toBeNull();
  });

  it('the ban is lifted if it is the only legal action', () => {
    // Blue's only piece is boxed in: 0 → 1 is its single possible action
    const g = game({ 0: P('blue', '2'), 6: P('red', '8'), 2: P('red', '8'), 7: P('red', '8') });
    g.recent = { blue: ['move:0-1', 'move:1-0', 'move:0-1', 'move:1-0', 'move:0-1', 'move:1-0'], red: [] };
    expect(listActions(g, 'blue')).toEqual([A]);
    expect(bannedAction(g, 'blue')).toBeNull();
  });
});
