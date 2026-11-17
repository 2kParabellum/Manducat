// Decks and best-of-N series.
// A deck is DECK_SIZE characters in a fixed order; Jack may appear any number of times,
// every other character at most once. Game 1 is played with slot 1. After each game the
// winner keeps their character and the loser moves on to the next slot.
import { CHARACTER_IDS } from './abilities';
import type { CharacterId } from './types';

export const DECK_SIZE = 3;
export type Deck = CharacterId[];

/** Series sides are not colors: colors are assigned per game. */
export type Side = 'a' | 'b';
export const SIDES: readonly Side[] = ['a', 'b'];
export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

export interface SeriesGame {
  winner: Side;
  chars: Record<Side, CharacterId>;
}

export interface SeriesState {
  bestOf: number;
  decks: Record<Side, Deck>;
  /** Index of the deck slot each side plays the next game with. */
  slot: Record<Side, number>;
  wins: Record<Side, number>;
  games: SeriesGame[];
}

/** Brings any list to a valid deck: known characters, no duplicates except Jack, padded with Jack. */
export function normalizeDeck(list: readonly string[], allowed: readonly CharacterId[] = CHARACTER_IDS): Deck {
  const deck: Deck = [];
  for (const c of list.slice(0, DECK_SIZE)) {
    const ok = (allowed as readonly string[]).includes(c) && (c === 'jack' || !deck.includes(c as CharacterId));
    deck.push(ok ? (c as CharacterId) : 'jack');
  }
  while (deck.length < DECK_SIZE) deck.push('jack');
  return deck;
}

export function isValidDeck(deck: readonly string[], allowed: readonly CharacterId[] = CHARACTER_IDS): boolean {
  return deck.length === DECK_SIZE && normalizeDeck(deck, allowed).every((c, i) => c === deck[i]);
}

export const winsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

export function createSeries(bestOf: number, decks: Record<Side, readonly CharacterId[]>): SeriesState {
  if (bestOf < 1 || bestOf % 2 === 0) throw new Error(`bestOf must be odd: ${bestOf}`);
  return {
    bestOf,
    decks: { a: [...decks.a], b: [...decks.b] },
    slot: { a: 0, b: 0 },
    wins: { a: 0, b: 0 },
    games: [],
  };
}

/** Characters for the next game. */
export function seriesChars(s: SeriesState): Record<Side, CharacterId> {
  const pick = (side: Side) => {
    const d = s.decks[side];
    return d[Math.min(s.slot[side], d.length - 1)] ?? 'jack';
  };
  return { a: pick('a'), b: pick('b') };
}

export function seriesWinner(s: SeriesState): Side | null {
  const need = winsNeeded(s.bestOf);
  return SIDES.find(side => s.wins[side] >= need) ?? null;
}

/** Records a finished game. The loser advances to the next deck slot. */
export function recordGame(s: SeriesState, winner: Side): void {
  if (seriesWinner(s)) throw new Error('series is already over');
  s.games.push({ winner, chars: seriesChars(s) });
  s.wins[winner]++;
  const loser = otherSide(winner);
  s.slot[loser] = Math.min(s.slot[loser] + 1, s.decks[loser].length - 1);
}
