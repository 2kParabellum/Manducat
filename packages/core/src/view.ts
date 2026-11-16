// «Вид игрока»: что конкретный игрок имеет право знать о партии.
// Интерфейс рисует только вид, ИИ думает только по виду, сервер отправляет игрокам только вид.
import { ABILITIES } from './abilities';
import { BIT } from './board';
import type { CardIdentity, Concealed, GameEvent, GameState, Player } from './types';
import type { GameCore } from './types';

export interface PlayerView extends GameCore {
  /** Чей это вид; null — наблюдатель. */
  viewer: Player | null;
  graveyard: CardIdentity[];
  moveNumber: number;
}

export interface ViewOptions {
  /** Показывать все мины и тайные способности (отладочный режим «вдвоём за одним экраном»). */
  revealSecrets?: boolean;
}

export const CONCEALED: Concealed = Object.freeze({ faceUp: false as const });

export function getPlayerView(state: GameState, viewer: Player | null, opts: ViewOptions = {}): PlayerView {
  const allMines = opts.revealSecrets || viewer === null;
  return {
    viewer,
    rules: state.rules,
    board: state.board.map(c => (c && !c.faceUp ? CONCEALED : c)),
    turn: state.turn,
    scores: { ...state.scores },
    hand: { ...state.hand },
    mines: state.mines.map(m => (allMines ? m : m & BIT[viewer!])),
    cooldown: { ...state.cooldown },
    quiet: { ...state.quiet },
    chars: { ...state.chars },
    result: state.result,
    graveyard: state.graveyard.slice(),
    moveNumber: state.moveNumber,
  };
}

/** Убирает из событий то, что зрителю знать нельзя (цель тайной способности, чужая разведка). */
export function redactEvents(events: readonly GameEvent[], viewer: Player | null, opts: ViewOptions = {}): GameEvent[] {
  if (opts.revealSecrets) return events.slice();
  const res: GameEvent[] = [];
  for (const e of events) {
    if (e.t === 'scout' && e.p !== viewer) continue;
    if (e.t === 'ability' && ABILITIES[e.kind].secret && e.p !== viewer) {
      res.push({ t: 'ability', p: e.p, kind: e.kind });
      continue;
    }
    res.push(e);
  }
  return res;
}
