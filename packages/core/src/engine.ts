// Engine: game creation and applying actions. Knows nothing about UI or network.
import { ABILITIES } from './abilities';
import { CELLS } from './board';
import { bury, enterCell } from './enter';
import type { ApplyContext } from './enter';
import { identityOf, piecePoints } from './pieces';
import { mulberry32, shuffle } from './rng';
import { DEFAULT_RULES } from './rules-config';
import { REPEAT_WINDOW, listActions, repeatKey } from './rules';
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
    countdown: 0,
    recent: { blue: [], red: [] },
    chars: { ...setup.chars },
    result: null,
    graveyard: [],
    moveNumber: 0,
    seed: setup.seed,
  };
}

export type { ApplyContext } from './enter';

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
      const was = b[a.from] as Piece;
      const piece: Piece = was.haste ? { ...was, haste: 0 } : was;   // any move by a hasted card uses the haste up
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
        if (att.haste) b[a.from] = { ...att, haste: 0 };
        ev.push({ t: 'reflect', p, from: a.from, to: a.to, attacker: att, victim: vic });
        break;
      }
      loud = true;
      const pts = piecePoints(vic, R);
      g.scores[p] += pts;
      bury(g, vic);
      b[a.from] = null;
      const moved: Piece = att.haste ? { ...att, haste: 0 } : att;   // an attack uses up haste
      ev.push({ t: 'capture', p, from: a.from, to: a.to, attacker: att, victim: vic, pts });
      if (vic.poison) {   // captured a poisoned card — dies itself (a shield doesn't help)
        b[a.to] = null;
        const pp = piecePoints(moved, R);
        g.scores[opp] += pp;
        bury(g, moved);
        ev.push({ t: 'poisonKill', p, i: a.to, piece: moved, pts: pp });
      } else {
        b[a.to] = moved;
      }
      break;
    }
    case 'ability': {
      g.cooldown[p] = R.abilityCooldown;
      if (ABILITIES[a.kind].apply(g, p, a.i, ev, a.j, ctx)) loud = true;
      break;
    }
  }

  if (loud) { g.quiet.blue = 0; g.quiet.red = 0; } else g.quiet[p]++;

  // Rule of Three Repeats: remember the player's last own actions (a new array — states may share it)
  const recent = [...g.recent[p].slice(1 - REPEAT_WINDOW), repeatKey(a)];
  g.recent = p === 'blue' ? { blue: recent, red: g.recent.red } : { blue: g.recent.blue, red: recent };
  if (g.cooldown[p] > 0) g.cooldown[p]--;

  // Poison, shield and stone on the opponent's pieces count down the opponent's turns;
  // haste and curse on the player's own pieces count down their own turns (haste — not on the turn it was given)
  const justHasted = a.type === 'ability' && a.kind === 'haste';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (!c || !c.faceUp) continue;
    if (c.owner === opp && (c.poison || c.shield || c.stone)) {
      b[i] = {
        ...c, poison: c.poison ? c.poison - 1 : 0, shield: c.shield ? c.shield - 1 : 0, stone: c.stone ? c.stone - 1 : 0,
      };
    } else if (c.owner === p && ((c.haste && !justHasted) || c.curseTurns)) {
      const curseTurns = c.curseTurns ? c.curseTurns - 1 : 0;
      b[i] = {
        ...c, haste: c.haste && !justHasted ? c.haste - 1 : c.haste,
        curseTurns, curse: curseTurns > 0 ? c.curse : 0,
      };
    }
  }

  // Game end
  const sp = g.scores[p], so = g.scores[opp];
  if (sp >= R.winScore || so >= R.winScore) {
    const w = sp >= R.winScore && so >= R.winScore ? (sp >= so ? p : opp) : (sp >= R.winScore ? p : opp);
    g.result = { winner: w, reason: 'score' };
  } else if (g.countdown > 0) {
    // Final countdown: flips and captures don't stop it
    if (--g.countdown === 0) endByPoints(g, p, sp, so);
  } else if (g.quiet[p] >= R.quietLimit) {
    // Too many quiet moves: the final countdown starts (the opponent moves first, so this player moves last)
    g.countdown = 2 * R.finalMoves;
    if (g.countdown === 0) endByPoints(g, p, sp, so);
    else ev.push({ t: 'countdown', p, moves: R.finalMoves });
  }
  g.turn = opp;
  return ev;
}

/** End of the final countdown: more points wins; on a tie the player who made the last move loses. */
function endByPoints(g: GameCore, p: Player, sp: number, so: number): void {
  g.result = { winner: sp > so ? p : opponent(p), reason: 'quiet', mover: p };
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
