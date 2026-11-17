// Bot tournament for balancing. Example:
//   npm run sim -- --games 20 --a normal:miner --b normal:jack
import { CHARACTER_IDS } from '@manducat/core';
import type { CharacterId } from '@manducat/core';
import { playSeries } from '@manducat/ai';
import type { Difficulty } from '@manducat/ai';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function side(spec: string): { difficulty: Difficulty; char: CharacterId } {
  const [difficulty, char] = spec.split(':') as [Difficulty, CharacterId];
  if (!CHARACTER_IDS.includes(char)) throw new Error(`unknown character ${char}`);
  return { difficulty, char };
}

const games = Number(arg('games', '10'));
const a = side(arg('a', 'normal:jack'));
const b = side(arg('b', 'easy:jack'));
const seed = Number(arg('seed', '1'));
const s = playSeries(games, a, b, seed);
console.log(`${a.difficulty}:${a.char} vs ${b.difficulty}:${b.char} — ${s.winsA}:${s.winsB}` +
  (s.unfinished ? ` (unfinished ${s.unfinished})` : ''));
console.log(JSON.stringify({ reasons: s.reasons, abilities: s.abilities, avgMoves: s.avgMoves, avgMs: s.avgMs, maxMs: s.maxMs }));
