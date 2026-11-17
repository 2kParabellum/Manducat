// Engine: game creation and applying actions. Knows nothing about UI or network.
import { ABILITIES } from './abilities';
import { BIT, CELLS } from './board';
import { identityOf, piecePoints } from './pieces';
import { mulberry32, shuffle } from './rng';
import { DEFAULT_RULES } from './rules-config';
import { listActions } from './rules';
import type {
  Action, CardIdentity, CharacterId, GameCore, GameEvent, GameResult, GameState, PerPlayer, Piece, Player, RulesConfig,
} from './types';
import { PLAYERS, opponent } from './types';

export interface GameSetup {
  chars: PerPlayer<CharacterId>;
  seed: number;
  rules?: Partial<RulesConfig>;
  /** A fixed layout instead of a random one (campaign levels, tests). */
  layout?: ReadonlyArray<CardIdentity | null>;
}

export function createGame(setup: GameSetup): GameState {
  const rules: RulesConfig = { ...DEFAULT_RULES, ...setup.rules };
  let deck: (CardIdentity | null)[];
  if (setup.layout) {
    if (setup.layout.length !== CELLS) throw new Error(`layout must have ${CELLS} cells`);
    deck = setup.layout.slice();
  } else {
    deck = [];
    for (const owner of PLAYERS) {
      for (const [value, count] of rules.army) for (let k = 0; k < count; k++) deck.push({ owner, value });
    }
    for (let k = 0; k < rules.gCount; k++) deck.push({ owner: null, value: 'G' });
    if (deck.length > CELLS) throw new Error('too many cards for the board');
    while (deck.length < CELLS) deck.push(null);
    shuffle(deck, mulberry32(setup.seed));
  }
  return {
    rules,
    board: deck.map(c => (c ? { faceUp: false, owner: c.owner, value: c.value } : null)),
    turn: 'blue',
    scores: { blue: 0, red: 0 },
    hand: { blue: 0, red: 0 },
    mines: new Array(CELLS).fill(0),
    cooldown: { blue: 0, red: 0 },
    quiet: { blue: 0, red: 0 },
    chars: { ...setup.chars },
    result: null,
    graveyard: [],
    moveNumber: 0,
    seed: setup.seed,
  };
}

export interface ApplyContext {
  /** What is under the card back (for flips in AI simulations where identities are unknown). */
  card?: CardIdentity;
  /** AI simulation: assume there is an enemy mine on the cell. */
  forceMine?: boolean;
}

/** A piece enters a cell (move or placing M). Returns true if it blew up. */
function enterCell(g: GameCore, p: Player, i: number, piece: Piece, ctx: ApplyContext, ev: GameEvent[]): boolean {
  const m = g.mines[i];
  if (!m && !ctx.forceMine) { g.board[i] = piece; return false; }
  const enemy = opponent(piece.owner);
  const enemyMine = !!ctx.forceMine || (m & BIT[enemy]) !== 0;
  const pts = enemyMine ? piecePoints(piece, g.rules) : 0;   // nobody scores for stepping on their own mine
  if (enemyMine) g.scores[enemy] += pts;
  if (m) { g.mines = g.mines.slice(); g.mines[i] = 0; }
  g.board[i] = null;
  g.graveyard?.push({ owner: piece.owner, value: piece.value });
  ev.push({ t: 'boom', p, i, piece, pts, by: enemyMine ? enemy : piece.owner });
  return true;
}

/**
 * Applies an action without legality checks and without the "no moves" check.
 * Mutates g in place (board pieces are replaced with new objects). Used by the engine and the AI.
 */
export function applyRaw(g: GameCore, a: Action, ctx: ApplyContext = {}): GameEvent[] {
  const p = g.turn, opp = opponent(p), b = g.board, R = g.rules;
  const ev: GameEvent[] = [];
  let loud = false;   // flip or capture — resets the quiet-move counter

  switch (a.type) {
    case 'flip': {
      const card = ctx.card ?? identityOf(b[a.i]);
      if (!card) throw new Error(`flip ${a.i}: card identity unknown`);
      loud = true;
      if (card.value === 'G') {
        b[a.i] = null;
        g.scores[p] += R.gPoints;
        g.graveyard?.push({ owner: null, value: 'G' });
        ev.push({ t: 'flipG', p, i: a.i, pts: R.gPoints });
      } else if (card.value === 'M') {
        b[a.i] = null;
        g.hand[card.owner!]++;
        ev.push({ t: 'flipM', p, i: a.i, owner: card.owner! });
      } else {
        const piece: Piece = { faceUp: true, owner: card.owner!, value: card.value };
        b[a.i] = piece;
        ev.push({ t: 'flip', p, i: a.i, piece });
      }
      break;
    }
    case 'move': {
      const piece = b[a.from] as Piece;
      b[a.from] = null;
      ev.push({ t: 'move', p, from: a.from, to: a.to, piece });
      if (enterCell(g, p, a.to, piece, ctx, ev)) loud = true;
      break;
    }
    case 'place': {
      g.hand[p]--;
      ev.push({ t: 'place', p, i: a.i });
      if (enterCell(g, p, a.i, { faceUp: true, owner: p, value: 'M' }, ctx, ev)) loud = true;
      break;
    }
    case 'attack': {
      const att = b[a.from] as Piece, vic = b[a.to] as Piece;
      if (vic.shield) {   // the shield reflects the attack and breaks; the attacker stays in place
        b[a.to] = { ...vic, shield: 0 };
        ev.push({ t: 'reflect', p, from: a.from, to: a.to, attacker: att, victim: vic });
        break;
      }
      loud = true;
      const pts = piecePoints(vic, R);
      g.scores[p] += pts;
      g.graveyard?.push({ owner: vic.owner, value: vic.value });
      b[a.from] = null;
      const moved: Piece = att.curse ? { ...att, curse: 0 } : att;   // it captured — the curse is lifted
      ev.push({ t: 'capture', p, from: a.from, to: a.to, attacker: att, victim: vic, pts, uncursed: !!att.curse });
      if (vic.poison) {   // captured a poisoned card — dies itself (a shield doesn't help)
        b[a.to] = null;
        const pp = piecePoints(moved, R);
        g.scores[opp] += pp;
        g.graveyard?.push({ owner: moved.owner, value: moved.value });
        ev.push({ t: 'poisonKill', p, i: a.to, piece: moved, pts: pp });
      } else {
        b[a.to] = moved;
      }
      break;
    }
    case 'ability': {
      g.cooldown[p] = R.abilityCooldown;
      ABILITIES[a.kind].apply(g, p, a.i, ev);
      break;
    }
  }

  if (loud) { g.quiet.blue = 0; g.quiet.red = 0; } else g.quiet[p]++;
  if (g.cooldown[p] > 0) g.cooldown[p]--;

  // Poison and shield on the opponent's pieces count down the opponent's turns
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c && c.faceUp && c.owner === opp && (c.poison || c.shield)) {
      b[i] = { ...c, poison: c.poison ? c.poison - 1 : 0, shield: c.shield ? c.shield - 1 : 0 };
    }
  }

  // Game end
  const sp = g.scores[p], so = g.scores[opp];
  if (sp >= R.winScore || so >= R.winScore) {
    const w = sp >= R.winScore && so >= R.winScore ? (sp >= so ? p : opp) : (sp >= R.winScore ? p : opp);
    g.result = { winner: w, reason: 'score' };
  } else if (g.quiet[p] >= R.quietLimit) {
    // more points wins; on a tie the player who made this move loses
    g.result = { winner: sp > so ? p : opp, reason: 'quiet', mover: p };
  }
  g.turn = opp;
  return ev;
}

/** Applies an action to the real game (check legality beforehand with isLegalAction). */
export function applyAction(state: GameState, a: Action): GameEvent[] {
  const ev = applyRaw(state, a);
  state.moveNumber++;
  if (!state.result && listActions(state, state.turn).length === 0) {
    state.result = { winner: opponent(state.turn), reason: 'noMoves' };
  }
  if (state.result) ev.push({ t: 'end', result: state.result });
  return ev;
}

export function resign(state: GameState, player: Player): GameEvent[] {
  if (state.result) return [];
  const result: GameResult = { winner: opponent(player), reason: 'surrender', mover: player };
  state.result = result;
  return [{ t: 'end', result }];
}
