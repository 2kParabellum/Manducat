import { describe, expect, it } from 'vitest';
import {
  BIT, applyAction, createGame, getPlayerView, isLegalAction, listActions, mulberry32, redactEvents,
} from '../src';
import type { GameState } from '../src';

const setup = (seed = 1, chars = { blue: 'jack', red: 'jack' } as const) => createGame({ chars: { ...chars }, seed });

describe('game creation', () => {
  it('deck: 36 cards of the right composition', () => {
    const g = setup();
    const counts: Record<string, number> = {};
    for (const c of g.board) {
      expect(c).not.toBeNull();
      const key = c!.owner ? c!.owner + c!.value : 'G';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toMatchObject({ blue1: 4, blue2: 3, blue3: 3, blue5: 2, blue8: 2, blueM: 1, red3: 3, G: 6 });
  });

  it('same seed gives the same layout', () => {
    expect(JSON.stringify(setup(42).board)).toBe(JSON.stringify(setup(42).board));
    expect(JSON.stringify(setup(42).board)).not.toBe(JSON.stringify(setup(43).board));
  });
});

describe('player view does not leak hidden info', () => {
  it('face-down identities are not in the view', () => {
    const view = getPlayerView(setup(), 'blue');
    for (const c of view.board) expect(c).toEqual({ faceUp: false });
  });

  it('enemy mines and enemy mine targets are hidden', () => {
    const g = createGame({ chars: { blue: 'miner', red: 'jack' }, seed: 3 });
    g.board[0] = null;
    const ev = applyAction(g, { type: 'ability', kind: 'mine', i: 0 });
    expect(getPlayerView(g, 'blue').mines[0]).toBe(BIT.blue);
    expect(getPlayerView(g, 'red').mines[0]).toBe(0);
    expect(redactEvents(ev, 'red')).toEqual([{ t: 'ability', p: 'blue', kind: 'mine' }]);
    expect(redactEvents(ev, 'blue')).toEqual(ev);
  });

  it('only the scout receives the scout result', () => {
    const g = createGame({ chars: { blue: 'scout', red: 'jack' }, seed: 5 });
    const ev = applyAction(g, { type: 'ability', kind: 'scout', i: 0 });
    const mine = redactEvents(ev, 'blue').find(e => e.t === 'scout');
    expect(mine && mine.t === 'scout' && mine.cells.every(c => c.card)).toBe(true);
    expect(redactEvents(ev, 'red').some(e => e.t === 'scout')).toBe(false);
  });
});

describe('actions', () => {
  it('an illegal action is rejected', () => {
    const g = setup();
    expect(isLegalAction(g, 'red', { type: 'flip', i: 0 })).toBe(false);   // not their turn
    expect(isLegalAction(g, 'blue', { type: 'move', from: 0, to: 1 })).toBe(false);
    expect(isLegalAction(g, 'blue', { type: 'flip', i: 0 })).toBe(true);
  });

  it('random games always finish correctly', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g: GameState = createGame({ chars: { blue: 'miner', red: 'poisoner' }, seed });
      const rng = mulberry32(seed);
      let n = 0;
      while (!g.result && n < 2000) {
        const acts = listActions(g, g.turn);
        applyAction(g, acts[Math.floor(rng() * acts.length)]);
        n++;
      }
      expect(g.result).not.toBeNull();
    }
  });
});
