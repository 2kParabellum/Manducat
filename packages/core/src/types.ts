// Базовые типы игры. Всё здесь — простые сериализуемые данные (JSON), чтобы
// состояние, ходы и события можно было передавать по сети и сохранять.

export type Player = 'blue' | 'red';
export const PLAYERS: readonly Player[] = ['blue', 'red'];
export const opponent = (p: Player): Player => (p === 'blue' ? 'red' : 'blue');

export type PerPlayer<T> = Record<Player, T>;

/** Номиналы карт армии. */
export type UnitValue = '1' | '2' | '3' | '5' | '8' | 'M';
/** Все номиналы, включая нейтральную G. */
export type CardValue = UnitValue | 'G';

/** Что это за карта (без положения на поле). owner === null только у G. */
export interface CardIdentity {
  readonly owner: Player | null;
  readonly value: CardValue;
}

/** Ключ карты для подсчётов: 'blue8', 'redM', 'G'. */
export type CardKey = string;

/** Открытая карта на поле. Объекты не мутируются — при изменении создаётся новый. */
export interface Piece {
  readonly faceUp: true;
  readonly owner: Player;
  readonly value: UnitValue;
  /** Сколько порч наложено (минус к силе и очкам). */
  readonly curse?: number;
  /** Сколько ходов соперника осталось у яда. */
  readonly poison?: number;
  /** Сколько ходов соперника осталось у щита. */
  readonly shield?: number;
}

/**
 * Закрытая карта. В настоящем состоянии партии (GameState) у неё заполнены owner/value,
 * в «виде игрока» (PlayerView) — нет: суть закрытой карты игрокам неизвестна.
 * known — служебное поле ИИ (карта, которую он подсмотрел).
 */
export interface Concealed {
  readonly faceUp: false;
  readonly owner?: Player | null;
  readonly value?: CardValue;
  readonly known?: CardKey;
}

export type Cell = Piece | Concealed | null;

export type AbilityId = 'scout' | 'poison' | 'curse' | 'mine' | 'shield';
export type CharacterId = 'jack' | 'scout' | 'poisoner' | 'witch' | 'miner' | 'defender';

/** Действие игрока за ход. */
export type Action =
  | { type: 'flip'; i: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'attack'; from: number; to: number }
  | { type: 'place'; i: number }
  | { type: 'ability'; kind: AbilityId; i: number };

export type ResultReason = 'score' | 'quiet' | 'noMoves' | 'surrender';

export interface GameResult {
  winner: Player;
  reason: ResultReason;
  /** quiet — кто сделал последний «тихий» ход; surrender — кто сдался. */
  mover?: Player;
}

/** Параметры правил. Кампания сможет менять их для отдельных уровней. */
export interface RulesConfig {
  winScore: number;
  gPoints: number;
  mPoints: number;
  gCount: number;
  /** Своих ходов подряд без открытий и взятий → конец партии. */
  quietLimit: number;
  /** Способность — раз в столько своих ходов. */
  abilityCooldown: number;
  /** Яд и щит действуют столько ходов соперника. */
  effectTurns: number;
  /** Состав армии каждого игрока: [номинал, количество]. */
  army: ReadonlyArray<readonly [UnitValue, number]>;
}

/**
 * Минимальное состояние, с которым работают правила. Его же использует ИИ
 * для своих симуляций (с закрытыми картами без сути).
 */
export interface GameCore {
  rules: RulesConfig;
  board: Cell[];
  turn: Player;
  scores: PerPlayer<number>;
  hand: PerPlayer<number>;
  /** Мины: битовая маска владельцев (1 — синие, 2 — красные). */
  mines: number[];
  cooldown: PerPlayer<number>;
  quiet: PerPlayer<number>;
  chars: PerPlayer<CharacterId>;
  result: GameResult | null;
  /** Съеденные/погибшие карты и собранные G — публичная информация. */
  graveyard?: CardIdentity[];
}

/** Настоящее состояние партии («правда»). Живёт у того, кто ведёт партию: локально или на сервере. */
export interface GameState extends GameCore {
  graveyard: CardIdentity[];
  moveNumber: number;
  seed: number;
}

export interface ScoutCell {
  i: number;
  /** Суть закрытой карты (если клетка закрыта). */
  card?: CardIdentity;
  /** Мины в клетке (если клетка пустая). */
  mines: number;
}

/** События хода — по ним интерфейс показывает анимации и сообщения, а ИИ обновляет знания. */
export type GameEvent =
  | { t: 'flip'; p: Player; i: number; piece: Piece }
  | { t: 'flipG'; p: Player; i: number; pts: number }
  | { t: 'flipM'; p: Player; i: number; owner: Player }
  | { t: 'move'; p: Player; from: number; to: number; piece: Piece }
  | { t: 'place'; p: Player; i: number }
  | { t: 'capture'; p: Player; from: number; to: number; attacker: Piece; victim: Piece; pts: number; uncursed: boolean }
  | { t: 'poisonKill'; p: Player; i: number; piece: Piece; pts: number }
  | { t: 'reflect'; p: Player; from: number; to: number; attacker: Piece; victim: Piece }
  | { t: 'boom'; p: Player; i: number; piece: Piece; pts: number; by: Player }
  /** i и target отсутствуют, если способность тайная (разведка, мина) и событие видит соперник. */
  | { t: 'ability'; p: Player; kind: AbilityId; i?: number; target?: Piece }
  /** Результат разведки — приватное событие только для разведчика. */
  | { t: 'scout'; p: Player; cells: ScoutCell[] }
  | { t: 'end'; result: GameResult };
