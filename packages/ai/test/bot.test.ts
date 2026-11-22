import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, DEFAULT_RULES } from '@manducat/core';
import type { Cell, Piece, Player, PlayerView } from '@manducat/core';
import { createBot, playMatch } from '../src';

const P = (owner: Player, value: Piece['value'], extra: Partial<Piece> = {}): Piece =>
  ({ faceUp: true, owner, value, ...extra });

function position(cells: Record<number, Cell>, extra: Partial<PlayerView> = {}): PlayerView {
  const board: Cell[] = new Array(36).fill(null);
  for (const [i, c] of Object.entries(cells)) board[+i] = c;
  return {
    viewer: 'blue', rules: DEFAULT_RULES, board, turn: 'blue',
    scores: { blue: 0, red: 0 }, hand: { blue: 0, red: 0 }, mines: new Array(36).fill(0),
    cooldown: { blue: 0, red: 0 }, quiet: { blue: 0, red: 0 }, countdown: 0, recent: { blue: [], red: [] }, chars: { blue: 'jack', red: 'jack' },
    result: null, graveyard: [], moveNumber: 0, ...extra,
  };
}

describe('bots', () => {
  it('easy bots finish games with every character without illegal moves', () => {
    CHARACTER_IDS.forEach((ch, k) => {
      const other = CHARACTER_IDS[(k + 1) % CHARACTER_IDS.length];
      const r = playMatch({ seed: 100 + k, chars: { blue: ch, red: other }, difficulty: { blue: 'easy', red: 'easy' } });
      expect(r.result).not.toBeNull();
    });
  });

  it('a normal bot finishes a game with characters', () => {
    const r = playMatch({ seed: 7, chars: { blue: 'miner', red: 'scout' }, difficulty: { blue: 'normal', red: 'normal' } });
    expect(r.result).not.toBeNull();
    expect(r.abilities.mine ?? 0).toBeGreaterThan(0);
  });

  it('takes a free piece', () => {
    const bot = createBot('blue', 'normal', { random: () => 0.5 });
    const view = position({ 0: P('blue', '8'), 3: P('red', '5') });
    bot.observe(view, []);
    expect(bot.chooseAction(view)).toEqual({ type: 'attack', from: 0, to: 3 });
  });

  it('does not miss the winning capture', () => {
    const bot = createBot('blue', 'normal', { random: () => 0.5 });
    const view = position({ 0: P('blue', '3'), 2: P('red', '3'), 30: P('blue', '8'), 33: P('red', '5', { shield: 2 }) },
      { scores: { blue: 36, red: 30 } });
    bot.observe(view, []);
    expect(bot.chooseAction(view)).toEqual({ type: 'attack', from: 0, to: 2 });
  });

  it('moves a piece out of danger instead of hanging it', () => {
    const bot = createBot('blue', 'normal', { random: () => 0.5 });
    // blue 5 is attacked by red 8 vertically; it can escape sideways
    const view = position({ 14: P('blue', '5'), 2: P('red', '8'), 35: P('blue', '1'), 34: P('red', '1') });
    bot.observe(view, []);
    const a = bot.chooseAction(view);
    expect(a.type === 'move' && a.from === 14 && (a.to === 13 || a.to === 15)).toBe(true);
  });
});
