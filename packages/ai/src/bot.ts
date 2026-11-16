// Бот: помнит, что видел, и выбирает ход по своему «виду игрока».
// Один и тот же бот работает и в браузере, и (в будущем) на сервере.
import { listActions } from '@manducat/core';
import type { Action, GameEvent, Player, PlayerView } from '@manducat/core';
import { makeBelief, simApply } from './belief';
import { W, WIN_VALUE } from './evaluate';
import { Knowledge, positionKey } from './knowledge';
import { ABORT, actionValue, scoutInfo, setDeadline } from './search';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface DifficultyConfig {
  depth: number;
  noise: number;
  /** Сколько лучших кандидатов досчитать на ход глубже (0 — не досчитывать). */
  deepen: number;
  beam: number;
  budgetMs: number;
  /** Досчитывать, только когда закрытых карт не больше этого (в начале партии вариантов слишком много). */
  maxHidden: number;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: { depth: 1, noise: 5, deepen: 0, beam: 0, budgetMs: 0, maxHidden: 0 },
  normal: { depth: 2, noise: 0.3, deepen: 0, beam: 0, budgetMs: 0, maxHidden: 0 },
  hard: { depth: 2, noise: 0, deepen: 8, beam: 7, budgetMs: 700, maxHidden: 16 },
};

export interface Bot {
  readonly player: Player;
  readonly difficulty: Difficulty;
  /** Сообщить боту новый вид и события, которые он видел. */
  observe(view: PlayerView, events: readonly GameEvent[]): void;
  /** Выбрать ход (вызывать, когда ход бота). */
  chooseAction(view: PlayerView): Action;
}

export interface BotOptions {
  random?: () => number;
}

export function createBot(player: Player, difficulty: Difficulty, opts: BotOptions = {}): Bot {
  const knowledge = new Knowledge(player);
  const random = opts.random ?? Math.random;
  let lastMove: { from: number; to: number } | null = null;

  return {
    player,
    difficulty,
    observe(view, events) {
      knowledge.observe(view, events);
    },
    chooseAction(view) {
      const a = choose(view, knowledge, DIFFICULTY[difficulty], random, lastMove);
      lastMove = a.type === 'move' ? { from: a.from, to: a.to } : null;
      return a;
    },
  };
}

interface Scored { a: Action; v: number; bonus: number }

function choose(
  view: PlayerView, k: Knowledge, cfg: DifficultyConfig, random: () => number,
  lastMove: { from: number; to: number } | null,
): Action {
  const s = makeBelief(view, k);
  const me = k.me;
  const actions = listActions(s, me);
  if (actions.length === 1) return actions[0];

  // Разведка не меняет позицию: её ценность = «пропуск хода» + ценность информации
  let passVal: number | null = null;
  let scored: Scored[] = actions.map(a => {
    if (a.type === 'ability' && a.kind === 'scout') {
      passVal ??= actionValue(s, a, cfg.depth - 1, me, {});
      const bonus = scoutInfo(s, a.i);
      return { a, v: passVal + bonus, bonus };
    }
    return { a, v: actionValue(s, a, cfg.depth - 1, me, {}), bonus: 0 };
  });

  // Сложный: лучшие кандидаты досчитываем на ход глубже, но не дольше бюджета времени
  if (cfg.deepen && s.hidden <= cfg.maxHidden) {
    scored.sort((x, y) => y.v - x.v);
    const top = scored.slice(0, cfg.deepen);
    const done: Scored[] = [];
    let deepPass: number | null = null;
    setDeadline(Date.now() + cfg.budgetMs);
    try {
      for (const x of top) {
        let v = x.v;
        if (Math.abs(x.v) < WIN_VALUE / 4) {
          if (x.a.type === 'ability' && x.a.kind === 'scout') {
            deepPass ??= actionValue(s, x.a, 2, me, { beam: cfg.beam });
            v = deepPass + x.bonus;
          } else v = actionValue(s, x.a, 2, me, { beam: cfg.beam });
        }
        done.push({ ...x, v });
      }
    } catch (e) {
      if (e !== ABORT) throw e;
    } finally {
      setDeadline(Infinity);
    }
    if (done.length >= 2) scored = done;   // иначе остаёмся с обычным просчётом
  }

  for (const x of scored) {
    if (x.a.type === 'move' && Math.abs(x.v) < WIN_VALUE / 4) {
      if (lastMove && x.a.from === lastMove.to && x.a.to === lastMove.from) x.v -= 0.5;   // не дёргать туда-обратно
      x.v -= W.stall * view.quiet[me];                                                   // долго топчемся — пора действовать
      x.v -= W.repeat * (k.positions.get(positionKey(simApply(s, x.a))) ?? 0);           // повтор позиции
    }
    x.v += (random() - 0.5) * cfg.noise;
  }
  scored.sort((x, y) => y.v - x.v);
  return scored[0].a;
}
