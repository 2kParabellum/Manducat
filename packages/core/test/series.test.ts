import { describe, expect, it } from 'vitest';
import { createSeries, isValidDeck, normalizeDeck, recordGame, seriesChars, seriesWinner } from '../src';

describe('deck', () => {
  it('pads with Jack and drops duplicates except Jack', () => {
    expect(normalizeDeck([])).toEqual(['jack', 'jack', 'jack']);
    expect(normalizeDeck(['witch', 'witch', 'jack'])).toEqual(['witch', 'jack', 'jack']);
    expect(normalizeDeck(['jack', 'jack', 'miner', 'scout'])).toEqual(['jack', 'jack', 'miner']);
    expect(normalizeDeck(['nobody', 'scout'])).toEqual(['jack', 'scout', 'jack']);
  });

  it('respects the allowed list', () => {
    expect(normalizeDeck(['witch', 'scout'], ['jack', 'scout'])).toEqual(['jack', 'scout', 'jack']);
    expect(isValidDeck(['jack', 'jack', 'jack'])).toBe(true);
    expect(isValidDeck(['scout', 'scout', 'jack'])).toBe(false);
    expect(isValidDeck(['scout', 'jack'])).toBe(false);
  });
});

describe('series', () => {
  it('winner keeps the character, loser moves to the next slot', () => {
    const s = createSeries(3, { a: ['scout', 'witch', 'miner'], b: ['jack', 'defender', 'poisoner'] });
    expect(seriesChars(s)).toEqual({ a: 'scout', b: 'jack' });
    recordGame(s, 'a');
    expect(seriesChars(s)).toEqual({ a: 'scout', b: 'defender' });
    recordGame(s, 'b');
    expect(seriesChars(s)).toEqual({ a: 'witch', b: 'defender' });
    expect(seriesWinner(s)).toBeNull();
    recordGame(s, 'b');
    expect(seriesWinner(s)).toBe('b');
    expect(s.games.map(g => g.chars.a)).toEqual(['scout', 'scout', 'witch']);
    expect(() => recordGame(s, 'a')).toThrow();
  });

  it('Bo5 needs 3 wins and a deck of 3 is enough', () => {
    const s = createSeries(5, { a: ['scout', 'witch', 'miner'], b: ['jack', 'jack', 'jack'] });
    recordGame(s, 'b'); recordGame(s, 'b');
    expect(seriesChars(s).a).toBe('miner');
    recordGame(s, 'a'); recordGame(s, 'a');
    expect(seriesWinner(s)).toBeNull();
    recordGame(s, 'a');
    expect(seriesWinner(s)).toBe('a');
  });

  it('single game is Bo1', () => {
    const s = createSeries(1, { a: ['witch'], b: ['jack'] });
    recordGame(s, 'b');
    expect(seriesWinner(s)).toBe('b');
    expect(() => createSeries(2, { a: [], b: [] })).toThrow();
  });
});
