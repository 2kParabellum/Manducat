// Local game: the "truth" lives in the browser, the opponent is a bot or a second person at the same screen.
import { ABILITIES, applyAction, createGame, getPlayerView, isLegalAction, opponent, randomSeed, redactEvents, resign } from '@manducat/core';
import type { Action, CharacterId, GameEvent, GameState, PerPlayer, Player } from '@manducat/core';
import { createBot } from '@manducat/ai';
import type { Bot, Difficulty } from '@manducat/ai';
import type { GameSession, SessionInfo, SessionUpdate } from './types';

export interface LocalSetup {
  mode: 'ai' | 'hotseat';
  chars: PerPlayer<CharacterId>;
  /** Human's color in a game against the AI. */
  humanColor?: Player;
  difficulty?: Difficulty;
  seed?: number;
}

const BOT_THINK_MS = 350;

export class LocalSession implements GameSession {
  readonly info: SessionInfo;
  private state: GameState;
  private bot: Bot | null = null;
  private listeners = new Set<(u: SessionUpdate) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(setup: LocalSetup) {
    this.state = createGame({ chars: setup.chars, seed: setup.seed ?? randomSeed() });
    if (setup.mode === 'ai') {
      const human = setup.humanColor ?? 'blue';
      this.bot = createBot(opponent(human), setup.difficulty ?? 'normal');
      this.info = { mode: 'ai', localSeats: [human], botSeat: this.bot.player };
    } else {
      this.info = { mode: 'hotseat', localSeats: ['blue', 'red'], botSeat: null };
    }
  }

  subscribe(listener: (u: SessionUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    this.bot?.observe(getPlayerView(this.state, this.bot.player), []);
    this.emit({ kind: 'start', view: this.view() });
    this.scheduleBot();
  }

  submit(action: Action): boolean {
    const s = this.state;
    if (this.disposed || s.result || !this.info.localSeats.includes(s.turn)) return false;
    if (!isLegalAction(s, s.turn, action)) return false;
    this.play(action);
    return true;
  }

  resign(player: Player): void {
    if (this.disposed || this.state.result) return;
    const events = resign(this.state, player);
    this.clearTimer();
    this.broadcast(events, player, null);
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
  }

  // Hot-seat is a debug mode: everything is visible, including mines and scouting.
  private get reveal(): boolean { return this.info.mode === 'hotseat'; }
  private get viewer(): Player | null { return this.info.mode === 'ai' ? this.info.localSeats[0] : null; }
  private view() { return getPlayerView(this.state, this.viewer, { revealSecrets: this.reveal }); }

  private play(action: Action): void {
    const actor = this.state.turn;
    const events = applyAction(this.state, action);
    const secret = action.type === 'ability' && ABILITIES[action.kind].secret && !this.reveal && actor !== this.viewer;
    this.broadcast(events, actor, secret ? null : action);
    this.scheduleBot();
  }

  private broadcast(events: GameEvent[], actor: Player, action: Action | null): void {
    if (this.bot) this.bot.observe(getPlayerView(this.state, this.bot.player), redactEvents(events, this.bot.player));
    this.emit({
      kind: 'action',
      view: this.view(),
      events: redactEvents(events, this.viewer, { revealSecrets: this.reveal }),
      actor,
      action,
    });
  }

  private scheduleBot(): void {
    const bot = this.bot;
    if (!bot || this.disposed || this.state.result || this.state.turn !== bot.player) return;
    this.emit({ kind: 'thinking', player: bot.player });
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || this.state.result) return;
      // TODO: move the search into a Web Worker so Hard doesn't freeze the UI
      const action = bot.chooseAction(getPlayerView(this.state, bot.player));
      this.play(action);
    }, BOT_THINK_MS);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(u: SessionUpdate): void {
    for (const l of this.listeners) l(u);
  }
}
