// The session is the only way the UI talks to a game.
// Today there is LocalSession (AI or hot-seat). A network session
// will implement the same interface; the game UI won't change.
import type { Action, GameEvent, Player, PlayerView } from '@manducat/core';

export type SessionUpdate =
  | { kind: 'start'; view: PlayerView }
  /** action === null if the move is secret for this viewer (e.g. an enemy mine). */
  | { kind: 'action'; view: PlayerView; events: GameEvent[]; actor: Player; action: Action | null }
  | { kind: 'thinking'; player: Player };

export interface SessionInfo {
  mode: 'ai' | 'hotseat' | 'online';
  /** Which colors are played on this device. */
  localSeats: Player[];
  /** Bot's color (in a game against the AI). */
  botSeat: Player | null;
}

export interface GameSession {
  readonly info: SessionInfo;
  subscribe(listener: (u: SessionUpdate) => void): () => void;
  start(): void;
  /** Submit an action. false — the action was rejected. */
  submit(action: Action): boolean;
  resign(player: Player): void;
  dispose(): void;
}
