// Texts for game events and results.
import { coordName, opponent, strength } from '@manducat/core';
import type { CardIdentity, GameEvent, GameResult, Piece, Player, PlayerView } from '@manducat/core';
import { CHARACTER_INFO } from './characters';

export const NAMES: Readonly<Record<Player, string>> = { blue: 'Blue', red: 'Red' };

export type NameFn = (p: Player) => string;

export interface EventText {
  /** Who "owns" the log line (for its color). */
  cls: Player | 'sys';
  log: string;
  /** Big toast message (abilities and their effects). */
  toast?: string;
}

const showVal = (c: Piece): string => (c.curse ? `${c.value}→${strength(c)}` : c.value);
const card = (c: CardIdentity): string => (c.owner ? `${NAMES[c.owner].toLowerCase()} ${c.value}` : c.value);

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function describeEvent(e: GameEvent, view: PlayerView, name: NameFn): EventText | null {
  switch (e.t) {
    case 'flip':
      return { cls: e.p, log: `${name(e.p)} flipped ${coordName(e.i)}: ${card(e.piece)}.` };
    case 'flipG':
      return { cls: e.p, log: `${name(e.p)} flipped ${coordName(e.i)}: G! +${e.pts} points.` };
    case 'flipM':
    {
      const whose = name(e.owner) === 'You' ? 'your' : `${name(e.owner)}'s`;
      return { cls: e.p, log: `${name(e.p)} flipped ${coordName(e.i)}: ${card({ owner: e.owner, value: 'M' })} — goes to ${whose} hand.` };
    }
    case 'move':
      return { cls: e.p, log: `${name(e.p)}: ${e.piece.value} ${coordName(e.from)} → ${coordName(e.to)}.` };
    case 'place':
      return { cls: e.p, log: `${name(e.p)} placed M on ${coordName(e.i)}.` };
    case 'capture':
      return {
        cls: e.p,
        log: `${name(e.p)}: ${e.attacker.value} (${coordName(e.from)}) captured ${showVal(e.victim)} on ${coordName(e.to)}. +${e.pts}.` +
          (e.uncursed ? ' Curse lifted.' : ''),
      };
    case 'poisonKill': {
      const msg = `☠️ Poison! ${card(e.piece)} dies. +${e.pts} to ${name(opponent(e.piece.owner))}.`;
      return { cls: opponent(e.p), log: msg, toast: msg };
    }
    case 'reflect': {
      const msg = `🛡️ The shield reflected ${e.attacker.value}'s attack on ${showVal(e.victim)} (${coordName(e.to)}). Shield broken.`;
      return { cls: opponent(e.p), log: msg, toast: msg };
    }
    case 'boom': {
      const msg = `💥 Mine on ${coordName(e.i)}! ${card(e.piece)} dies` +
        (e.pts ? `. +${e.pts} to ${name(e.by)}.` : ' on its own mine.');
      return { cls: e.by, log: msg, toast: msg };
    }
    case 'ability': {
      const ch = CHARACTER_INFO[view.chars[e.p]];
      let msg = `${ch.icon} ${name(e.p)} · ${ch.name}: `;
      const where = e.i !== undefined ? ` (${coordName(e.i)})` : '';
      if (e.kind === 'scout') msg += 'peeked at 4 cards';
      else if (e.kind === 'mine') msg += 'mined a cell';
      else if (e.kind === 'poison') msg += `poisoned ${e.target!.value}${where}`;
      else if (e.kind === 'shield') msg += `shielded ${e.target!.value}${where}`;
      else if (e.kind === 'curse') msg += `cursed ${showVal(e.target!)}${where} — strength is now ${strength(e.target!) - 1}`;
      return { cls: e.p, log: msg + '.', toast: msg };
    }
    case 'countdown': {
      const msg = `⚠️ ${view.rules.quietLimit} quiet moves in a row — final countdown! ` +
        `The game ends in ${plural(e.moves, 'move')} each. Flips and captures won't stop it.`;
      return { cls: 'sys', log: msg, toast: msg };
    }
    case 'scout':
    case 'end':
      return null;
  }
}

export function describeResult(r: GameResult, view: PlayerView, name: NameFn): string {
  switch (r.reason) {
    case 'score':
      return `${name(r.winner)} reached ${view.scores[r.winner]} points.`;
    case 'quiet': {
      const tie = view.scores.blue === view.scores.red;
      return 'The final countdown is over. ' +
        (tie ? `Points are tied — ${name(r.mover!)} made the last move and lost.` : `More points: ${name(r.winner)}.`);
    }
    case 'noMoves':
      return `No moves left for ${name(opponent(r.winner))} — defeat.`;
    case 'surrender':
      return `${name(r.mover!)} surrendered.`;
  }
}
