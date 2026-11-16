// Тексты сообщений о событиях партии.
import { coordName, opponent, strength } from '@manducat/core';
import type { GameEvent, GameResult, Piece, Player, PlayerView } from '@manducat/core';
import { CHARACTER_INFO } from './characters';

export const NAMES: Readonly<Record<Player, string>> = { blue: 'Синие', red: 'Красные' };
export const NAMES_GEN: Readonly<Record<Player, string>> = { blue: 'синих', red: 'красных' };

export type NameFn = (p: Player) => string;

export interface EventText {
  /** Кто «автор» строки лога (для цвета). */
  cls: Player | 'sys';
  log: string;
  /** Крупное всплывающее сообщение (способности и их срабатывания). */
  toast?: string;
}

const showVal = (c: Piece): string => (c.curse ? `${c.value}→${strength(c)}` : c.value);

export function describeEvent(e: GameEvent, view: PlayerView, name: NameFn): EventText | null {
  switch (e.t) {
    case 'flip':
      return { cls: e.p, log: `${name(e.p)} открыли ${coordName(e.i)}: ${e.piece.value} ${NAMES_GEN[e.piece.owner]}.` };
    case 'flipG':
      return { cls: e.p, log: `${name(e.p)} открыли ${coordName(e.i)}: G! +${e.pts} очка.` };
    case 'flipM':
      return { cls: e.p, log: `${name(e.p)} открыли ${coordName(e.i)}: M ${NAMES_GEN[e.owner]} — уходит в руку ${e.owner === e.p ? 'себе' : 'сопернику'}.` };
    case 'move':
      return { cls: e.p, log: `${name(e.p)}: ${e.piece.value} ${coordName(e.from)} → ${coordName(e.to)}.` };
    case 'place':
      return { cls: e.p, log: `${name(e.p)} выкладывают M на ${coordName(e.i)}.` };
    case 'capture':
      return {
        cls: e.p,
        log: `${name(e.p)}: ${e.attacker.value} (${coordName(e.from)}) съедает ${showVal(e.victim)} на ${coordName(e.to)}. +${e.pts}.` +
          (e.uncursed ? ' Порча снята.' : ''),
      };
    case 'poisonKill': {
      const msg = `☠️ Яд! ${e.piece.value} ${NAMES_GEN[e.piece.owner]} погибает. +${e.pts} ${NAMES_GEN[opponent(e.piece.owner)]}.`;
      return { cls: opponent(e.p), log: msg, toast: msg };
    }
    case 'reflect': {
      const msg = `🛡️ Щит отразил атаку ${e.attacker.value} на ${showVal(e.victim)} (${coordName(e.to)}). Щит сломан.`;
      return { cls: opponent(e.p), log: msg, toast: msg };
    }
    case 'boom': {
      const msg = `💥 Мина на ${coordName(e.i)}! ${e.piece.value} ${NAMES_GEN[e.piece.owner]} погибает` +
        (e.pts ? `. +${e.pts} ${NAMES_GEN[e.by]}.` : ' на своей мине.');
      return { cls: e.by, log: msg, toast: msg };
    }
    case 'ability': {
      const ch = CHARACTER_INFO[view.chars[e.p]];
      let msg = `${ch.icon} ${name(e.p)} · ${ch.name}: `;
      const where = e.i !== undefined ? ` (${coordName(e.i)})` : '';
      if (e.kind === 'scout') msg += 'подсмотрел 4 карты';
      else if (e.kind === 'mine') msg += 'заминировал клетку';
      else if (e.kind === 'poison') msg += `отравил ${e.target!.value}${where}`;
      else if (e.kind === 'shield') msg += `поставил щит на ${e.target!.value}${where}`;
      else if (e.kind === 'curse') msg += `наложила порчу на ${showVal(e.target!)}${where} — теперь сила ${strength(e.target!) - 1}`;
      return { cls: e.p, log: msg + '.', toast: msg };
    }
    case 'scout':
    case 'end':
      return null;
  }
}

export function describeResult(r: GameResult, view: PlayerView, name: NameFn): string {
  switch (r.reason) {
    case 'score':
      return `${name(r.winner)} набрали ${view.scores[r.winner]} очков.`;
    case 'quiet': {
      const tie = view.scores.blue === view.scores.red;
      return `${view.rules.quietLimit} ходов подряд без открытий и взятий. ` +
        (tie ? `Очков поровну — проигрывают ${NAMES[r.mover!]}, сделавшие ${view.rules.quietLimit}-й ход.` : `Больше очков у ${NAMES_GEN[r.winner]}.`);
    }
    case 'noMoves':
      return `У ${NAMES_GEN[opponent(r.winner)]} не осталось ходов — поражение.`;
    case 'surrender':
      return `${name(r.mover!)} сдались.`;
  }
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
