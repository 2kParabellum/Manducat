// Basic game types. Everything here is plain serializable data (JSON), so that
// state, actions and events can be sent over the network and saved.

export type Player = 'blue' | 'red';
export const PLAYERS: readonly Player[] = ['blue', 'red'];
export const opponent = (p: Player): Player => (p === 'blue' ? 'red' : 'blue');

export type PerPlayer<T> = Record<Player, T>;

/** Army card values. */
export type UnitValue = '1' | '2' | '3' | '5' | '8' | 'M';
/** All values, including the neutral G. */
export type CardValue = UnitValue | 'G';

/** What a card is (regardless of its position). owner === null only for G. */
export interface CardIdentity {
  readonly owner: Player | null;
  readonly value: CardValue;
}

/** Card key for counting: 'blue8', 'redM', 'G'. */
export type CardKey = string;

/** A face-up card on the board. Objects are never mutated: a change creates a new one. */
export interface Piece {
  readonly faceUp: true;
  readonly owner: Player;
  readonly value: UnitValue;
  /** Number of curses (minus to strength and points). */
  readonly curse?: number;
  /** Opponent turns left on the poison. */
  readonly poison?: number;
  /** Opponent turns left on the shield. */
  readonly shield?: number;
  /** Runner: own turns left on haste (one long move along a free path). Any move or attack by the card removes it. */
  readonly haste?: number;
  /** Gargoyle: opponent turns left as stone (cannot move, attack or be captured). */
  readonly stone?: number;
  /** Necromancer's summoned 3: not part of the army, never goes to the graveyard. */
  readonly summoned?: boolean;
}

/**
 * A face-down card. In the real game state (GameState) owner/value are filled in,
 * in a player's view (PlayerView) they are not: players don't know face-down cards.
 * known — AI-only field (a card it has peeked at).
 */
export interface Concealed {
  readonly faceUp: false;
  readonly owner?: Player | null;
  readonly value?: CardValue;
  readonly known?: CardKey;
}

export type Cell = Piece | Concealed | null;

export type AbilityId = 'scout' | 'poison' | 'curse' | 'mine' | 'shield' | 'swap' | 'haste' | 'summon' | 'strike' | 'stone';
export type CharacterId =
  | 'jack' | 'scout' | 'poisoner' | 'witch' | 'miner' | 'defender'
  | 'swapper' | 'runner' | 'necromancer' | 'avenger' | 'gargoyle';

/** A player's action for the turn. */
export type Action =
  | { type: 'flip'; i: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'attack'; from: number; to: number }
  | { type: 'place'; i: number }
  /** i — target cell (-1 for abilities without a target); j — second cell (swap only, j > i). */
  | { type: 'ability'; kind: AbilityId; i: number; j?: number };

export type ResultReason = 'score' | 'quiet' | 'noMoves' | 'surrender';

export interface GameResult {
  winner: Player;
  reason: ResultReason;
  /** quiet — who made the last move of the final countdown; surrender — who surrendered. */
  mover?: Player;
}

/** Rule parameters. The campaign can change them for individual levels. */
export interface RulesConfig {
  winScore: number;
  gPoints: number;
  mPoints: number;
  gCount: number;
  /** Own moves in a row without flips or captures → the final countdown starts. */
  quietLimit: number;
  /** Length of the final countdown in own moves per player. Flips and captures don't stop it. */
  finalMoves: number;
  /** Ability can be used once per this many own turns. */
  abilityCooldown: number;
  /** Poison and shield last this many opponent turns. */
  effectTurns: number;
  /** Avenger: points the strike takes from the opponent. */
  strikeDamage: number;
  /** Each player's army: [value, count]. */
  army: ReadonlyArray<readonly [UnitValue, number]>;
}

/**
 * Minimal state the rules work with. The AI uses it too
 * for its simulations (with face-down cards of unknown identity).
 */
export interface GameCore {
  rules: RulesConfig;
  board: Cell[];
  turn: Player;
  scores: PerPlayer<number>;
  hand: PerPlayer<number>;
  /** Mines: bitmask of owners (1 — blue, 2 — red). */
  mines: number[];
  cooldown: PerPlayer<number>;
  quiet: PerPlayer<number>;
  /** Final countdown: half-moves left until the game ends (0 — not running). */
  countdown: number;
  /** Rule of Three Repeats: each player's last own actions as repeat keys (see repeatKey). */
  recent: PerPlayer<readonly string[]>;
  chars: PerPlayer<CharacterId>;
  result: GameResult | null;
  /** Captured/killed cards and collected G — public information. */
  graveyard?: CardIdentity[];
}

/** The real game state (the "truth"). Lives with whoever hosts the game: locally or on a server. */
export interface GameState extends GameCore {
  graveyard: CardIdentity[];
  moveNumber: number;
  seed: number;
}

export interface ScoutCell {
  i: number;
  /** Identity of a face-down card (if the cell is face down). */
  card?: CardIdentity;
  /** Mines in the cell (if the cell is empty). */
  mines: number;
}

/** Turn events: the UI shows animations and messages from them, the AI updates its knowledge. */
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
  /** i and target are absent if the ability is secret (scout, mine) and the opponent sees the event. */
  /** j — second cell of a swap; pts — points taken by the Avenger's strike. */
  | { t: 'ability'; p: Player; kind: AbilityId; i?: number; j?: number; target?: Piece; pts?: number }
  /** The final countdown has started: the game ends after this many own moves per player. */
  | { t: 'countdown'; p: Player; moves: number }
  /** Scout result — a private event only for the scout. */
  | { t: 'scout'; p: Player; cells: ScoutCell[] }
  | { t: 'end'; result: GameResult };
