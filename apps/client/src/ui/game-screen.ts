// Game screen. Draws only the player view from the session and submits actions to it.
// Session updates are played one by one: first the move's animations, then the next move.
import {
  BIT, CELLS, PLAYERS, abilityOf, abilityTargets, attackTargets, bannedAction, emptyCells, keyOf, moveTargets, scoutArea, scoutCorner,
  strength,
} from '@manducat/core';
import type { Action, CardIdentity, GameEvent, GameResult, Piece, Player, PlayerView, ScoutCell } from '@manducat/core';
import { CHARACTER_INFO } from '../content/characters';
import { NAMES, describeEvent, describeResult, plural } from '../content/describe';
import type { GameSession, SessionUpdate } from '../session/types';
import { $, askConfirm, showToast, sleep } from './dom';
import { sameAction } from './guide';
import type { Coach, Guide } from './guide';

type Selection = { type: 'cell'; i: number } | { type: 'hand' } | { type: 'ability' };

const PEEK_MS = 3000;
const AI_PREVIEW_MS = 550;
const BANNED_MSG = 'Rule of Three Repeats: this move can not be repeated a fourth time. Make another move.';

export interface GameOverInfo {
  title: string;
  titleClass: string;
  reason: string;
  view: PlayerView;
  result: GameResult;
}

export class GameScreen {
  private view: PlayerView | null = null;
  private queue: SessionUpdate[] = [];
  private processing = false;
  private disposed = false;
  private selected: Selection | null = null;
  private hover: number | null = null;
  private lastMove: number[] = [];
  private lastAction: Action['type'] | null = null;
  private vanishing: { i: number; card: CardIdentity } | null = null;
  private fx: Record<number, 'boom' | 'poison' | 'shield'> = {};
  private peek: Map<number, ScoutCell> | null = null;
  private thinking: Player | null = null;
  private log: { cls: string; text: string }[] = [];
  private cellEls: HTMLDivElement[] = [];
  private readonly unsubscribe: () => void;
  private readonly onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') this.cancelSelection(); };

  constructor(
    private readonly session: GameSession,
    private readonly onGameOver: (info: GameOverInfo) => void,
    private readonly guide?: Guide,
  ) {
    this.buildBoard();
    $('coach-btn').onclick = () => {
      this.guide?.press();
      this.render();
    };
    for (const pl of PLAYERS) $(`ability-${pl}`).onclick = () => this.onAbilityClick(pl);
    $('btn-surrender').onclick = () => this.onSurrender();
    document.addEventListener('keydown', this.onKey);
    this.unsubscribe = session.subscribe(u => {
      this.queue.push(u);
      void this.pump();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    document.removeEventListener('keydown', this.onKey);
  }

  get isOver(): boolean { return !!this.view?.result; }

  // ---------- names and permissions ----------

  private name(p: Player): string {
    const { mode, botSeat } = this.session.info;
    if (mode === 'ai') return p === botSeat ? 'AI' : 'You';
    return NAMES[p];
  }

  private isLocal(p: Player): boolean { return this.session.info.localSeats.includes(p); }

  /** Whether it is the local human's turn and nothing is being animated. */
  private inputReady(): boolean {
    const v = this.view;
    return !!v && !v.result && !this.processing && this.queue.length === 0 && this.isLocal(v.turn);
  }

  /** Whether the human on this device can act right now (the coach may be waiting for its button). */
  private canAct(): boolean {
    return this.inputReady() && !this.coach()?.button;
  }

  // ---------- guide (tutorial) ----------

  private coach(): Coach | null {
    return this.guide && this.view ? this.guide.coach(this.view, this.inputReady()) : null;
  }

  /** The only action the guide allows now, if any. */
  private expected(): Action | undefined {
    return this.coach()?.expect;
  }

  /** Shakes the coach message: the player tried something other than what it asks. */
  private nudge(): void {
    const el = $('coach');
    el.classList.remove('nudge');
    void el.offsetWidth;   // restart the animation
    el.classList.add('nudge');
  }

  // ---------- update queue ----------

  private async pump(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length && !this.disposed) await this.handle(this.queue.shift()!);
    this.processing = false;
    if (!this.disposed) this.render();
  }

  private async handle(u: SessionUpdate): Promise<void> {
    if (u.kind === 'start') {
      this.view = u.view;
      const ch = (p: Player) => CHARACTER_INFO[u.view.chars[p]].name;
      const first = this.name(u.view.turn);
      const intro = this.session.info.mode === 'ai'
        ? PLAYERS.map(p => `${this.name(p) === 'You' ? 'You are' : 'AI is'} ${NAMES[p]} (${ch(p)})`).join(', ')
        : `${NAMES.blue}: ${ch('blue')}, ${NAMES.red}: ${ch('red')}`;
      this.addLog('sys', `New game. ${intro}. ${first} ${first === 'You' ? 'move' : 'moves'} first.`);
      this.render();
      return;
    }
    if (u.kind === 'thinking') {
      this.thinking = u.player;
      this.render();
      return;
    }

    // Opponent's move: first highlight the piece being moved
    const a = u.action;
    if (a && !this.isLocal(u.actor) && (a.type === 'move' || a.type === 'attack' || a.type === 'place')) {
      this.selected = a.type === 'place' ? { type: 'hand' } : { type: 'cell', i: a.from };
      this.render();
      await sleep(AI_PREVIEW_MS);
      if (this.disposed) return;
    }

    this.thinking = null;
    this.selected = null;
    this.hover = null;
    this.view = u.view;
    this.lastAction = a?.type ?? null;
    this.lastMove = !a ? this.lastMove
      : a.type === 'move' || a.type === 'attack' ? [a.from, a.to]
      : a.type === 'ability' && (a.kind === 'scout' || a.kind === 'mine') ? [] : [a.i];
    if (!a && u.events.some(e => e.t === 'ability')) this.lastMove = [];

    let delay = 0;
    for (const e of u.events) delay = Math.max(delay, this.onEvent(e));
    this.render();
    if (delay) {
      await sleep(delay);
      if (this.disposed) return;
      this.vanishing = null;
      this.fx = {};
      this.render();
    }
    if (u.view.result) {
      await sleep(700);
      if (!this.disposed) this.finish(u.view.result, u.view);
    }
  }

  /** Messages and animations for an event. Returns the animation duration. */
  private onEvent(e: GameEvent): number {
    const text = describeEvent(e, this.view!, p => this.name(p));
    if (text) {
      this.addLog(text.cls, text.log);
      if (text.toast) showToast(text.toast);
    }
    switch (e.t) {
      case 'flipG':
        this.vanishing = { i: e.i, card: { owner: null, value: 'G' } };
        return 900;
      case 'flipM':
        this.vanishing = { i: e.i, card: { owner: e.owner, value: 'M' } };
        return 900;
      case 'boom': this.fx[e.i] = 'boom'; return 900;
      case 'poisonKill': this.fx[e.i] = 'poison'; return 900;
      case 'reflect': this.fx[e.to] = 'shield'; return 700;
      case 'scout': {
        const peek = new Map(e.cells.map(c => [c.i, c]));
        this.peek = peek;
        setTimeout(() => {
          if (this.disposed || this.peek !== peek) return;
          this.peek = null;
          this.render();
        }, PEEK_MS);
        return 0;
      }
    }
    return 0;
  }

  private finish(r: GameResult, view: PlayerView): void {
    const { mode, botSeat } = this.session.info;
    const title = mode === 'ai' ? (r.winner === botSeat ? 'AI wins' : 'Victory!') : `${NAMES[r.winner]} wins!`;
    this.onGameOver({ title, titleClass: r.winner, reason: describeResult(r, view, p => this.name(p)), view, result: r });
  }

  // ---------- input ----------

  private submit(a: Action): void {
    const exp = this.expected();
    if (exp && !sameAction(a, exp)) return this.nudge();
    this.selected = null;
    this.hover = null;
    if (!this.session.submit(a)) this.render();
  }

  private onCellClick(i: number): void {
    if (!this.canAct()) return;
    const v = this.view!;
    const card = v.board[i];
    const sel = this.selected;
    const p = v.turn;

    if (sel?.type === 'ability') {
      const kind = abilityOf(v.chars[p])!;
      const t = kind === 'scout' ? scoutCorner(i) : i;
      if (abilityTargets(v, p).includes(t)) return this.submit({ type: 'ability', kind, i: t });
      this.selected = null;
      return this.render();
    }
    if (sel?.type === 'hand') {
      if (card === null) return this.submit({ type: 'place', i });
      this.selected = null;
    }
    if (sel?.type === 'cell') {
      const ban = bannedAction(v, p);
      if (ban && (ban.type === 'move' || ban.type === 'attack') && ban.from === sel.i && ban.to === i) {
        showToast(BANNED_MSG);
        return;
      }
      if (moveTargets(v.board, sel.i).includes(i)) return this.submit({ type: 'move', from: sel.i, to: i });
      if (attackTargets(v.board, sel.i).includes(i)) return this.submit({ type: 'attack', from: sel.i, to: i });
      if (sel.i === i) { this.selected = null; return this.render(); }
    }
    if (card === null) { this.selected = null; return this.render(); }
    if (!card.faceUp) return this.submit({ type: 'flip', i });
    const exp = this.expected();
    if (exp && card.owner === p && !((exp.type === 'move' || exp.type === 'attack') && exp.from === i)) return this.nudge();
    this.selected = card.owner === p ? { type: 'cell', i } : null;
    this.render();
  }

  private onCellHover(i: number): void {
    if (this.selected?.type === 'ability' && this.hover !== i) {
      this.hover = i;
      this.render();
    }
  }

  private onHandClick(pl: Player): void {
    if (!this.canAct() || pl !== this.view!.turn || this.view!.hand[pl] === 0) return;
    const exp = this.expected();
    if (exp && exp.type !== 'place') return this.nudge();
    this.selected = this.selected?.type === 'hand' ? null : { type: 'hand' };
    this.render();
  }

  private onAbilityClick(pl: Player): void {
    const v = this.view;
    if (!v || !this.canAct() || pl !== v.turn) return;
    if (!abilityOf(v.chars[pl]) || v.cooldown[pl] > 0) return;
    if (this.selected?.type === 'ability') { this.selected = null; return this.render(); }
    if (abilityTargets(v, pl).length === 0) return showToast('No valid targets for the ability');
    this.selected = { type: 'ability' };
    this.hover = null;
    this.render();
  }

  private cancelSelection(): void {
    if (this.selected && this.canAct()) {
      this.selected = null;
      this.hover = null;
      this.render();
    }
  }

  private onSurrender(): void {
    const v = this.view;
    if (!v || v.result) return;
    const { mode, localSeats } = this.session.info;
    const loser = mode === 'ai' ? localSeats[0] : v.turn;
    askConfirm(mode === 'ai' ? 'Surrender?' : `${NAMES[loser]} surrenders?`, () => this.session.resign(loser));
  }

  // ---------- rendering ----------

  private buildBoard(): void {
    const boardEl = $('board');
    boardEl.innerHTML = '';
    this.cellEls = [];
    for (let i = 0; i < CELLS; i++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.sig = '';
      el.addEventListener('click', () => this.onCellClick(i));
      el.addEventListener('mouseenter', () => this.onCellHover(i));
      boardEl.appendChild(el);
      this.cellEls.push(el);
    }
    boardEl.onmouseleave = () => { if (this.hover !== null) { this.hover = null; this.render(); } };
    boardEl.oncontextmenu = e => { e.preventDefault(); this.cancelSelection(); };
  }

  private visibleMines(i: number): number {
    return this.view!.mines[i] | (this.peek?.get(i)?.mines ?? 0);
  }

  render(): void {
    const v = this.view;
    if (!v || this.disposed) return;
    const sel = this.selected;
    const p = v.turn;
    const myTurn = this.isLocal(p) && !v.result;
    let moves: number[] = [], attacks: number[] = [], places: number[] = [], abil: number[] = [], scoutCells: number[] = [];
    let banned = -1;
    if (sel?.type === 'cell') {
      moves = moveTargets(v.board, sel.i);
      attacks = attackTargets(v.board, sel.i);
      const ban = myTurn ? bannedAction(v, p) : null;
      if (ban && (ban.type === 'move' || ban.type === 'attack') && ban.from === sel.i) {
        banned = ban.to;
        moves = moves.filter(t => t !== banned);
        attacks = attacks.filter(t => t !== banned);
      }
    } else if (sel?.type === 'hand') {
      places = emptyCells(v.board);
    } else if (sel?.type === 'ability') {
      if (abilityOf(v.chars[p]) === 'scout') { if (this.hover !== null) scoutCells = scoutArea(scoutCorner(this.hover)); }
      else abil = abilityTargets(v, p);
    }

    // Guide: only the expected action is offered and highlighted
    const coach = this.coach();
    const exp = coach?.expect;
    let guideCells: number[] = [];
    if (exp) {
      const ok = (a: Action) => sameAction(a, exp);
      if (sel?.type === 'cell') {
        moves = moves.filter(to => ok({ type: 'move', from: sel.i, to }));
        attacks = attacks.filter(to => ok({ type: 'attack', from: sel.i, to }));
      }
      places = places.filter(i => ok({ type: 'place', i }));
      guideCells = guideTargets(exp, sel);
    }
    $('board').classList.toggle('guided', !!exp || !!coach?.button);

    v.board.forEach((card, i) => {
      const el = this.cellEls[i];
      el.classList.toggle('last-move', this.lastMove.includes(i));
      el.classList.toggle('move-target', moves.includes(i) || places.includes(i));
      el.classList.toggle('attack-target', attacks.includes(i));
      el.classList.toggle('banned-target', banned === i);
      el.classList.toggle('ability-target', abil.includes(i));
      el.classList.toggle('scout-area', scoutCells.includes(i));
      el.classList.toggle('guide', guideCells.includes(i));

      // Cell content is rebuilt only when it actually changed, otherwise animations would replay
      const peekCard = this.peek?.get(i)?.card;
      const fx = this.fx[i] ?? '';
      const van = this.vanishing?.i === i ? this.vanishing.card : null;
      const mineBits = card === null && !van ? this.visibleMines(i) : 0;
      let base: string;
      if (van) base = 'v:' + keyOf(van.owner, van.value);
      else if (card) base = card.faceUp ? pieceSig(card) : peekCard ? 'back:peek:' + keyOf(peekCard.owner, peekCard.value) : 'back';
      else base = mineBits ? 'mine' + mineBits : '';
      const sig = base + (fx ? '|' + fx : '');

      const prev = el.dataset.sig ?? '';
      if (sig !== prev) {
        const prevBase = prev.split('|')[0];
        el.innerHTML = '';
        if (van) {
          const c = makeCardEl({ faceUp: true, owner: van.owner ?? 'blue', value: van.value as Piece['value'] }, v.rules.effectTurns, van.value === 'G');
          c.classList.add('vanish');
          el.appendChild(c);
        } else if (card) {
          const c = !card.faceUp ? (peekCard ? makePeekEl(peekCard) : makeBackEl()) : makeCardEl(card, v.rules.effectTurns);
          if (prevBase.startsWith('back') && card.faceUp) c.classList.add('flip');
          else if (card.faceUp && card.value === 'M' && !prevBase.startsWith(card.owner + 'M') &&
            this.lastAction === 'place' && this.lastMove[0] === i) c.classList.add('pop');
          el.appendChild(c);
        } else if (mineBits) {
          const m = document.createElement('div');
          m.className = 'mine ' + (mineBits === 3 ? 'both' : mineBits === BIT.blue ? 'blue' : 'red');
          m.textContent = '💣';
          el.appendChild(m);
        }
        if (fx) {
          const f = document.createElement('div');
          f.className = 'fx ' + fx;
          f.textContent = fx === 'boom' ? '💥' : fx === 'poison' ? '☠️' : '🛡️';
          el.appendChild(f);
        }
        el.dataset.sig = sig;
      }

      const cEl = el.querySelector('.card');
      if (cEl && card) {
        cEl.classList.toggle('selected', sel?.type === 'cell' && sel.i === i);
        const mine = card.faceUp && card.owner === p && myTurn;
        cEl.classList.toggle('not-mine', card.faceUp && !mine && !attacks.includes(i) && !abil.includes(i));
      }
    });

    const guideHand = exp?.type === 'place' && sel?.type !== 'hand';
    for (const pl of PLAYERS) this.renderPanel(pl, v, sel, guideHand && pl === p);
    this.renderCoach(coach);

    const ti = $('turn-indicator');
    ti.className = 'turn-indicator ' + p + (this.thinking ? ' thinking' : '');
    ti.textContent = v.result ? 'Game over' : this.session.info.mode === 'ai' ? (this.isLocal(p) ? 'Your turn' : 'AI\'s turn') : `${NAMES[p]} to move`;

    let hint = '';
    if (sel?.type === 'ability') hint = (CHARACTER_INFO[v.chars[p]].hint ?? '') + ' · Esc to cancel';
    else if (sel?.type === 'hand') hint = 'Choose an empty cell for M · Esc to cancel';
    else if (banned >= 0) hint = 'Rule of Three Repeats: the red cell is blocked this turn';
    $('hint-line').textContent = hint;

    this.renderLog();
  }

  private renderCoach(c: Coach | null): void {
    const el = $('coach');
    el.classList.toggle('hidden', !c);
    $('btn-surrender').classList.toggle('hidden', !!c?.scripted);
    if (!c) return;
    el.classList.toggle('dim', !!c.dim);
    $('coach-progress').textContent = c.progress ?? '';
    $('coach-title').textContent = c.title;
    const text = $('coach-text');
    if (text.innerHTML !== c.text) text.innerHTML = c.text;
    const btn = $('coach-btn');
    btn.textContent = c.button ?? '';
    btn.classList.toggle('hidden', !c.button);
  }

  private renderPanel(pl: Player, v: PlayerView, sel: Selection | null, guideHand: boolean): void {
    const p = v.turn;
    $(`score-${pl}`).textContent = String(v.scores[pl]);
    $(`panel-${pl}`).classList.toggle('active', pl === p && !v.result);
    const { mode, botSeat } = this.session.info;
    $(`tag-${pl}`).textContent = mode === 'ai' ? (pl === botSeat ? 'AI' : 'You') : '';
    const ch = CHARACTER_INFO[v.chars[pl]];
    $(`char-${pl}`).textContent = `${ch.icon} ${ch.name}`;

    const handEl = $(`hand-${pl}`);
    handEl.innerHTML = '';
    if (v.hand[pl] === 0) {
      handEl.innerHTML = '<span class="empty">empty</span>';
    } else {
      for (let k = 0; k < v.hand[pl]; k++) {
        const cEl = makeCardEl({ faceUp: true, owner: pl, value: 'M' }, v.rules.effectTurns);
        if (!(pl === p && this.isLocal(pl))) cEl.classList.add('not-mine');
        if (pl === p && sel?.type === 'hand') cEl.classList.add('selected');
        if (guideHand) cEl.classList.add('guide');
        cEl.addEventListener('click', () => this.onHandClick(pl));
        handEl.appendChild(cEl);
      }
    }

    const btn = $<HTMLButtonElement>(`ability-${pl}`);
    if (!ch.verb) {
      btn.className = 'ability-btn hidden';
    } else {
      const cd = v.cooldown[pl];
      const mine = pl === p && !v.result && this.isLocal(pl);
      btn.className = 'ability-btn' + (cd === 0 ? ' ready' : '') + (mine && sel?.type === 'ability' ? ' active' : '');
      btn.disabled = !mine || cd > 0 || this.processing || this.queue.length > 0;
      btn.innerHTML = `${ch.icon} ${ch.verb}<small>${cd === 0 ? 'ready' : `in ${plural(cd, 'turn')}`}</small>`;
    }

    const q = v.quiet[pl];
    const qEl = $(`quiet-${pl}`);
    if (v.countdown > 0 && !v.result) {
      // Half-moves alternate starting with the player to move
      const left = pl === p ? Math.ceil(v.countdown / 2) : Math.floor(v.countdown / 2);
      qEl.textContent = `⚠️ Game ends in ${plural(left, 'move')}`;
      qEl.classList.add('warn');
    } else {
      qEl.textContent = q > 0 ? `Quiet moves: ${q}/${v.rules.quietLimit}` : '';
      qEl.classList.toggle('warn', q >= v.rules.quietLimit - 5);
    }
  }

  private addLog(cls: string, text: string): void {
    this.log.push({ cls, text });
  }

  private renderLog(): void {
    const logEl = $('log');
    logEl.innerHTML = '';
    for (const e of this.log.slice(-50)) {
      const d = document.createElement('div');
      d.className = 'entry ' + e.cls;
      d.textContent = e.text;
      logEl.appendChild(d);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }
}

/** Cells to highlight for the expected action: the piece to pick first, then its target. */
function guideTargets(a: Action, sel: Selection | null): number[] {
  switch (a.type) {
    case 'flip': return [a.i];
    case 'move':
    case 'attack': return [sel?.type === 'cell' && sel.i === a.from ? a.to : a.from];
    case 'place': return sel?.type === 'hand' ? [a.i] : [];
    case 'ability': return [a.i];
  }
}

// ---------- card elements ----------

function pieceSig(c: Piece): string {
  return c.owner + c.value + 'c' + (c.curse ?? 0) + 'p' + (c.poison ?? 0) + 's' + (c.shield ?? 0);
}

function makeBackEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card back';
  return el;
}

function makeBar(kind: string, n: number, total: number): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'bar ' + kind;
  for (let k = 0; k < total; k++) {
    const seg = document.createElement('i');
    if (k < n) seg.className = 'on';
    bar.appendChild(seg);
  }
  return bar;
}

function makeCardEl(card: Piece, effectTurns: number, gold = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card ' + (gold ? 'gold' : card.owner);
  if (card.value === 'M') el.classList.add('mcard');
  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = gold ? 'G' : card.curse ? String(strength(card)) : card.value;
  el.appendChild(val);
  if (card.curse) {
    el.classList.add('cursed');
    el.insertAdjacentHTML('beforeend', `<span class="orig">${card.value}</span><span class="badge curse">−${card.curse}</span>`);
  }
  if (card.poison) {
    el.classList.add('poisoned');
    el.insertAdjacentHTML('beforeend', '<span class="badge poison">☠️</span>');
    el.appendChild(makeBar('poison', card.poison, effectTurns));
  }
  if (card.shield) {
    el.classList.add('shielded');
    el.insertAdjacentHTML('beforeend', '<span class="badge shield">🛡️</span>');
    el.appendChild(makeBar('shield', card.shield, effectTurns));
  }
  return el;
}

function makePeekEl(card: CardIdentity): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card back peek ' + (card.value === 'G' ? 'gold-peek' : card.owner + '-peek');
  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = card.value;
  el.appendChild(val);
  return el;
}
