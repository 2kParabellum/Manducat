// A match: one game or a best-of-N series against the AI (or hot-seat).
// Creates a LocalSession + GameScreen per game and keeps the series score.
import { createSeries, opponent, recordGame, seriesChars, seriesWinner } from '@manducat/core';
import type { CharacterId, Player, SeriesState, Side } from '@manducat/core';
import type { Difficulty } from '@manducat/ai';
import { LocalSession } from '../session/local';
import { GameScreen } from '../ui/game-screen';
import type { GameOverInfo } from '../ui/game-screen';
import { $, showScreen } from '../ui/dom';

export interface MatchConfig {
  mode: 'ai' | 'hotseat';
  bestOf: 1 | 3 | 5;
  /** Side a is the human (blue in hot-seat), side b is the AI (red in hot-seat). */
  decks: Record<Side, CharacterId[]>;
  difficulty: Difficulty;
  /** Side a's color: fixed or random for every game. */
  color: Player | 'random';
  /** Caption above the board, e.g. "Level 7 · The Gauntlet". */
  title: string;
}

export interface GameEnd {
  game: GameOverInfo;
  /** Which side won this game. */
  winner: Side;
  series: SeriesState;
  /** Series winner, null while the series goes on. */
  seriesWinner: Side | null;
  /** Game number that just ended (1-based). */
  gameNo: number;
}

export class Match {
  readonly series: SeriesState;
  private session: LocalSession | null = null;
  private screen: GameScreen | null = null;
  private colorA: Player = 'blue';

  constructor(readonly config: MatchConfig, private readonly onGameEnd: (e: GameEnd) => void) {
    this.series = createSeries(config.bestOf, config.decks);
  }

  get isOver(): boolean { return !!seriesWinner(this.series); }
  get gameInProgress(): boolean { return !!this.screen && !this.screen.isOver; }

  sideName(s: Side): string {
    if (this.config.mode === 'ai') return s === 'a' ? 'You' : 'AI';
    return s === 'a' ? 'Player 1' : 'Player 2';
  }

  /** Starts the next game of the series. */
  next(): void {
    if (this.isOver) return;
    this.stopGame();
    const cfg = this.config;
    const chars = seriesChars(this.series);
    this.colorA = cfg.color === 'random' ? (Math.random() < 0.5 ? 'blue' : 'red') : cfg.color;
    const byColor = { [this.colorA]: chars.a, [opponent(this.colorA)]: chars.b } as Record<Player, CharacterId>;
    this.session = cfg.mode === 'ai'
      ? new LocalSession({ mode: 'ai', chars: byColor, humanColor: this.colorA, difficulty: cfg.difficulty })
      : new LocalSession({ mode: 'hotseat', chars: byColor });
    const gameNo = this.series.games.length + 1;
    this.screen = new GameScreen(this.session, info => this.finish(info, gameNo));
    $('series-bar').textContent = this.caption(gameNo);
    showScreen('game');
    this.session.start();
  }

  private caption(gameNo: number): string {
    const { bestOf, title } = this.config;
    if (bestOf === 1) return title;
    const w = this.series.wins;
    return `${title} · Game ${gameNo} · Bo${bestOf} · ${this.sideName('a')} ${w.a}–${w.b} ${this.sideName('b')}`;
  }

  private finish(info: GameOverInfo, gameNo: number): void {
    const winner: Side = info.result.winner === this.colorA ? 'a' : 'b';
    recordGame(this.series, winner);
    this.onGameEnd({ game: info, winner, series: this.series, seriesWinner: seriesWinner(this.series), gameNo });
  }

  private stopGame(): void {
    this.screen?.dispose();
    this.session?.dispose();
    this.screen = null;
    this.session = null;
  }

  dispose(): void {
    this.stopGame();
  }
}
