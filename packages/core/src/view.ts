// Player view: what a particular player is allowed to know about the game.
// The UI draws only the view, the AI thinks only from the view, a server sends players only views.
import { ABILITIES } from './abilities';
import { BIT } from './board';
import type { CardIdentity, Concealed, GameEvent, GameState, Player } from './types';
import type { GameCore } from './types';

export interface PlayerView extends GameCore {
  /** Whose view this is; null — spectator. */
  viewer: Player | null;
  graveyard: CardIdentity[];
  moveNumber: number;
}

export interface ViewOptions {
  /** Reveal all mines and secret abilities (debug hot-seat mode). */
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
    countdown: state.countdown,
    recent: { blue: state.recent.blue.slice(), red: state.recent.red.slice() },
    chars: { ...state.chars },
    result: state.result,
    graveyard: state.graveyard.slice(),
    moveNumber: state.moveNumber,
  };
}

/** Removes from events what the viewer must not know (secret ability targets, other players' scouting). */
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
