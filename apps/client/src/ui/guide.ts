// A guide coaches the player during a game (the tutorial): a message above the board,
// highlighted cells and, while it is scripted, the only action the player may make.
import type { Action, PlayerView } from '@manducat/core';

export interface Coach {
  title: string;
  /** May contain <b> (static content only). */
  text: string;
  /** Small caption, e.g. "Step 2 of 7". */
  progress?: string;
  /** A button under the message; the board is blocked until it is pressed. */
  button?: string;
  /** The only action the player may make now (it is highlighted). */
  expect?: Action;
  /** Waiting for the opponent: the message is shown dimmed. */
  dim?: boolean;
  /** Scripted part of the game: surrendering is not offered. */
  scripted: boolean;
}

export interface Guide {
  /** The coach message for this view. myTurn — the player can act right now. */
  coach(view: PlayerView, myTurn: boolean): Coach | null;
  /** The coach button was pressed. */
  press(): void;
}

export const sameAction = (a: Action, b: Action): boolean => JSON.stringify(a) === JSON.stringify(b);
