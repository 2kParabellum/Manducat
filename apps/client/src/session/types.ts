// Сессия — единственная точка, через которую интерфейс общается с партией.
// Сейчас есть LocalSession (ИИ или двое за одним экраном). Сетевая сессия
// будет реализовывать этот же интерфейс — интерфейс игры при этом не меняется.
import type { Action, GameEvent, Player, PlayerView } from '@manducat/core';

export type SessionUpdate =
  | { kind: 'start'; view: PlayerView }
  /** action === null, если ход тайный для этого зрителя (например, чужая мина). */
  | { kind: 'action'; view: PlayerView; events: GameEvent[]; actor: Player; action: Action | null }
  | { kind: 'thinking'; player: Player };

export interface SessionInfo {
  mode: 'ai' | 'hotseat' | 'online';
  /** За какие цвета играют на этом устройстве. */
  localSeats: Player[];
  /** Цвет бота (в игре против ИИ). */
  botSeat: Player | null;
}

export interface GameSession {
  readonly info: SessionInfo;
  subscribe(listener: (u: SessionUpdate) => void): () => void;
  start(): void;
  /** Отправить ход. false — ход отклонён. */
  submit(action: Action): boolean;
  resign(player: Player): void;
  dispose(): void;
}
