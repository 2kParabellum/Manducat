// Матчи бот против бота — для тестов и балансировки (npm run sim).
import { applyAction, createGame, getPlayerView, isLegalAction, redactEvents } from '@manducat/core';
import type { AbilityId, CharacterId, GameResult, PerPlayer, Player, ResultReason } from '@manducat/core';
import { createBot } from './bot';
import type { Difficulty } from './bot';

export interface MatchSetup {
  seed: number;
  chars: PerPlayer<CharacterId>;
  difficulty: PerPlayer<Difficulty>;
  maxMoves?: number;
}

export interface MatchResult {
  result: GameResult | null;
  moves: number;
  abilities: Partial<Record<AbilityId, number>>;
  maxMs: number;
  totalMs: number;
  botMoves: number;
}

export function playMatch(setup: MatchSetup): MatchResult {
  const state = createGame({ chars: setup.chars, seed: setup.seed });
  const bots = {
    blue: createBot('blue', setup.difficulty.blue),
    red: createBot('red', setup.difficulty.red),
  };
  for (const p of ['blue', 'red'] as Player[]) bots[p].observe(getPlayerView(state, p), []);
  const out: MatchResult = { result: null, moves: 0, abilities: {}, maxMs: 0, totalMs: 0, botMoves: 0 };
  const maxMoves = setup.maxMoves ?? 1000;
  while (!state.result && out.moves < maxMoves) {
    const p = state.turn;
    const t0 = Date.now();
    const a = bots[p].chooseAction(getPlayerView(state, p));
    const dt = Date.now() - t0;
    out.maxMs = Math.max(out.maxMs, dt);
    out.totalMs += dt;
    out.botMoves++;
    if (!isLegalAction(state, p, a)) throw new Error(`illegal action by ${p}: ${JSON.stringify(a)}`);
    if (a.type === 'ability') out.abilities[a.kind] = (out.abilities[a.kind] ?? 0) + 1;
    const events = applyAction(state, a);
    for (const q of ['blue', 'red'] as Player[]) bots[q].observe(getPlayerView(state, q), redactEvents(events, q));
    out.moves++;
  }
  out.result = state.result;
  return out;
}

export interface SeriesSummary {
  games: number;
  /** Победы первого участника (A) и второго (B). Цвета чередуются. */
  winsA: number;
  winsB: number;
  unfinished: number;
  reasons: Partial<Record<ResultReason, number>>;
  abilities: Partial<Record<AbilityId, number>>;
  avgMoves: number;
  avgMs: number;
  maxMs: number;
}

export function playSeries(
  games: number,
  a: { char: CharacterId; difficulty: Difficulty },
  b: { char: CharacterId; difficulty: Difficulty },
  seed0 = 1,
): SeriesSummary {
  const s: SeriesSummary = { games, winsA: 0, winsB: 0, unfinished: 0, reasons: {}, abilities: {}, avgMoves: 0, avgMs: 0, maxMs: 0 };
  let ms = 0, botMoves = 0;
  for (let g = 0; g < games; g++) {
    const aColor: Player = g % 2 ? 'blue' : 'red';
    const bColor: Player = aColor === 'blue' ? 'red' : 'blue';
    const r = playMatch({
      seed: seed0 + g,
      chars: { [aColor]: a.char, [bColor]: b.char } as PerPlayer<CharacterId>,
      difficulty: { [aColor]: a.difficulty, [bColor]: b.difficulty } as PerPlayer<Difficulty>,
    });
    s.avgMoves += r.moves / games;
    ms += r.totalMs;
    botMoves += r.botMoves;
    s.maxMs = Math.max(s.maxMs, r.maxMs);
    for (const [k, n] of Object.entries(r.abilities)) s.abilities[k as AbilityId] = (s.abilities[k as AbilityId] ?? 0) + n;
    if (!r.result) { s.unfinished++; continue; }
    s.reasons[r.result.reason] = (s.reasons[r.result.reason] ?? 0) + 1;
    if (r.result.winner === aColor) s.winsA++; else s.winsB++;
  }
  s.avgMoves = Math.round(s.avgMoves);
  s.avgMs = botMoves ? Math.round(ms / botMoves) : 0;
  return s;
}
