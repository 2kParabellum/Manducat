'use strict';

// ================== НАСТРОЙКИ ==================
const SIZE = 6;
const WIN_SCORE = 39;
const G_POINTS = 3;
const M_POINTS = 10;          // сколько очков даёт съеденная M
const G_COUNT = 6;
const ARMY = [                // [номинал, количество]
  ['1', 4], ['2', 3], ['3', 2], ['5', 2], ['8', 2], ['M', 1],
];
const POWER = { '1': 1, '2': 2, '3': 3, '5': 5, '8': 8 };
const PLAYERS = ['blue', 'red'];
const NAMES = { blue: 'Синие', red: 'Красные' };
const NAMES_GEN = { blue: 'синих', red: 'красных' };
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// ================== ПРАВИЛА ==================
function canBeat(attacker, target) {
  if (attacker === 'M' || target === 'M') return true;
  if (attacker === '1' && target === '8') return true;
  return POWER[attacker] > POWER[target];
}

function cardPoints(value) {
  return value === 'M' ? M_POINTS : POWER[value];
}

const opponent = p => (p === 'blue' ? 'red' : 'blue');
const rc = i => [Math.floor(i / SIZE), i % SIZE];
const idx = (r, c) => r * SIZE + c;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const coordName = i => { const [r, c] = rc(i); return 'ABCDEF'[c] + (r + 1); };
const cardLabel = card => (card.owner ? `${card.value} ${NAMES_GEN[card.owner]}` : card.value);

// ================== СОСТОЯНИЕ ==================
let state = null;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const deck = [];
  for (const owner of PLAYERS) {
    for (const [value, count] of ARMY) {
      for (let k = 0; k < count; k++) deck.push({ owner, value, faceUp: false });
    }
  }
  for (let k = 0; k < G_COUNT; k++) deck.push({ owner: null, value: 'G', faceUp: false });
  while (deck.length < SIZE * SIZE) deck.push(null); // пустые клетки, если карт меньше 36
  return shuffle(deck);
}

function newGame() {
  state = {
    board: createDeck(),
    turn: 'blue',
    scores: { blue: 0, red: 0 },
    hand: { blue: 0, red: 0 },
    selected: null,      // {type:'cell', i} | {type:'hand'}
    busy: false,
    over: false,
    lastMove: [],
    vanishing: null,     // индекс клетки с исчезающей картой (G / M)
    log: [],
  };
  addLog('sys', 'Новая игра. Ходят Синие.');
  showScreen('game');
  render();
}

// ================== ВОЗМОЖНЫЕ ДЕЙСТВИЯ ==================
function moveTargets(i) {
  const [r, c] = rc(i);
  const res = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (inside(nr, nc) && state.board[idx(nr, nc)] === null) res.push(idx(nr, nc));
  }
  return res;
}

function attackTargets(i) {
  const me = state.board[i];
  const [r, c] = rc(i);
  const res = [];
  for (const [dr, dc] of DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inside(nr, nc) && state.board[idx(nr, nc)] === null) { nr += dr; nc += dc; }
    if (!inside(nr, nc)) continue;
    const target = state.board[idx(nr, nc)];
    if (target.faceUp && target.owner === opponent(me.owner) && canBeat(me.value, target.value)) {
      res.push(idx(nr, nc));
    }
  }
  return res;
}

function emptyCells() {
  return state.board.map((c, i) => (c === null ? i : -1)).filter(i => i >= 0);
}

function hasAnyAction(player) {
  const b = state.board;
  if (b.some(c => c && !c.faceUp)) return true;
  if (state.hand[player] > 0 && emptyCells().length > 0) return true;
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c && c.faceUp && c.owner === player && (moveTargets(i).length || attackTargets(i).length)) return true;
  }
  return false;
}

// ================== ДЕЙСТВИЯ ==================
function flipCard(i) {
  const card = state.board[i];
  const p = state.turn;
  card.faceUp = true;
  state.lastMove = [i];

  if (card.value === 'G') {
    state.scores[p] += G_POINTS;
    addLog(p, `${NAMES[p]} открыли ${coordName(i)}: G! +${G_POINTS} очка.`);
    vanishThenEnd(i);
  } else if (card.value === 'M') {
    state.hand[card.owner]++;
    addLog(p, `${NAMES[p]} открыли ${coordName(i)}: M ${NAMES_GEN[card.owner]} — уходит в руку ${NAMES[card.owner] === NAMES[p] ? 'себе' : 'сопернику'}.`);
    vanishThenEnd(i);
  } else {
    addLog(p, `${NAMES[p]} открыли ${coordName(i)}: ${cardLabel(card)}.`);
    endTurn();
  }
}

function vanishThenEnd(i) {
  state.busy = true;
  state.vanishing = i;
  render();
  setTimeout(() => {
    state.board[i] = null;
    state.vanishing = null;
    state.busy = false;
    endTurn();
  }, 900);
}

function moveCard(from, to) {
  const p = state.turn;
  const card = state.board[from];
  state.board[to] = card;
  state.board[from] = null;
  state.lastMove = [from, to];
  addLog(p, `${NAMES[p]}: ${card.value} ${coordName(from)} → ${coordName(to)}.`);
  endTurn();
}

function attack(from, to) {
  const p = state.turn;
  const me = state.board[from];
  const victim = state.board[to];
  const pts = cardPoints(victim.value);
  state.scores[p] += pts;
  state.board[to] = me;
  state.board[from] = null;
  state.lastMove = [from, to];
  addLog(p, `${NAMES[p]}: ${me.value} (${coordName(from)}) съедает ${victim.value} на ${coordName(to)}. +${pts}.`);
  endTurn();
}

function playM(i) {
  const p = state.turn;
  state.hand[p]--;
  state.board[i] = { owner: p, value: 'M', faceUp: true };
  state.lastMove = [i];
  addLog(p, `${NAMES[p]} выкладывают M на ${coordName(i)}.`);
  endTurn();
}

function endTurn() {
  state.selected = null;

  for (const p of PLAYERS) {
    if (state.scores[p] >= WIN_SCORE) {
      return finishGame(p, `${NAMES[p]} набрали ${state.scores[p]} очков.`);
    }
  }

  state.turn = opponent(state.turn);
  if (!hasAnyAction(state.turn)) {
    if (!hasAnyAction(opponent(state.turn))) {
      return finishByScore('Ни у кого не осталось ходов.');
    }
    addLog('sys', `У ${NAMES_GEN[state.turn]} нет доступных ходов — пропуск.`);
    state.turn = opponent(state.turn);
  }
  render();
}

function finishByScore(reason) {
  const { blue, red } = state.scores;
  finishGame(blue === red ? null : (blue > red ? 'blue' : 'red'), reason);
}

function finishGame(winner, reason) {
  state.over = true;
  render();
  const title = document.getElementById('victory-title');
  title.className = winner || '';
  title.textContent = winner ? `Победили ${NAMES[winner]}!` : 'Ничья!';
  document.getElementById('victory-reason').textContent = reason;
  document.getElementById('final-blue').textContent = state.scores.blue;
  document.getElementById('final-red').textContent = state.scores.red;
  setTimeout(() => showScreen('victory'), 400);
}

// ================== ВВОД ==================
function onCellClick(i) {
  if (!state || state.busy || state.over) return;
  const card = state.board[i];
  const sel = state.selected;
  const p = state.turn;

  // Выбрана M из руки — выкладываем на пустую клетку
  if (sel && sel.type === 'hand') {
    if (card === null) return playM(i);
    state.selected = null;
  }

  // Выбрана карта на поле — двигаем или атакуем
  if (sel && sel.type === 'cell') {
    if (moveTargets(sel.i).includes(i)) return moveCard(sel.i, i);
    if (attackTargets(sel.i).includes(i)) return attack(sel.i, i);
    if (sel.i === i) { state.selected = null; return render(); }
  }

  if (card === null) { state.selected = null; return render(); }

  if (!card.faceUp) return flipCard(i);

  if (card.owner === p) {
    state.selected = { type: 'cell', i };
  } else {
    state.selected = null;
  }
  render();
}

function onHandClick(player) {
  if (!state || state.busy || state.over) return;
  if (player !== state.turn || state.hand[player] === 0) return;
  if (state.selected && state.selected.type === 'hand') state.selected = null;
  else state.selected = { type: 'hand' };
  render();
}

function cancelSelection() {
  if (state && state.selected) { state.selected = null; render(); }
}

// ================== ОТРИСОВКА ==================
const boardEl = document.getElementById('board');
const cellEls = [];

function buildBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    el.addEventListener('click', () => onCellClick(i));
    boardEl.appendChild(el);
    cellEls.push(el);
  }
}

function makeCardEl(card, extra = []) {
  const el = document.createElement('div');
  el.className = 'card';
  if (!card.faceUp) {
    el.classList.add('back');
  } else {
    el.textContent = card.value;
    if (card.value === 'G') el.classList.add('gold');
    else el.classList.add(card.owner);
    if (card.value === 'M') el.classList.add('mcard');
  }
  extra.forEach(c => el.classList.add(c));
  return el;
}

function render() {
  if (!state) return;
  const sel = state.selected;
  let moves = [], attacks = [], placeTargets = [];
  if (sel && sel.type === 'cell') {
    moves = moveTargets(sel.i);
    attacks = attackTargets(sel.i);
  } else if (sel && sel.type === 'hand') {
    placeTargets = emptyCells();
  }

  state.board.forEach((card, i) => {
    const el = cellEls[i];
    el.className = 'cell';
    el.innerHTML = '';
    if (state.lastMove.includes(i)) el.classList.add('last-move');
    if (moves.includes(i) || placeTargets.includes(i)) el.classList.add('move-target');
    if (attacks.includes(i)) el.classList.add('attack-target');
    if (!card) return;

    const extra = [];
    if (sel && sel.type === 'cell' && sel.i === i) extra.push('selected');
    if (state.vanishing === i) extra.push('vanish');
    if (card.faceUp && card.owner !== state.turn && !attacks.includes(i)) extra.push('not-mine');
    el.appendChild(makeCardEl(card, extra));
  });

  for (const p of PLAYERS) {
    document.getElementById(`score-${p}`).textContent = state.scores[p];
    document.getElementById(`panel-${p}`).classList.toggle('active', p === state.turn && !state.over);

    const handEl = document.getElementById(`hand-${p}`);
    handEl.innerHTML = '';
    if (state.hand[p] === 0) {
      handEl.innerHTML = '<span class="empty">пусто</span>';
    } else {
      for (let k = 0; k < state.hand[p]; k++) {
        const extra = ['hand-card'];
        if (p !== state.turn) extra.push('not-mine');
        if (p === state.turn && sel && sel.type === 'hand') extra.push('selected');
        const cEl = makeCardEl({ owner: p, value: 'M', faceUp: true }, extra);
        cEl.style.width = 'var(--cell)';
        cEl.style.height = 'var(--cell)';
        cEl.style.animation = 'none';
        cEl.addEventListener('click', () => onHandClick(p));
        handEl.appendChild(cEl);
      }
    }
  }

  const ti = document.getElementById('turn-indicator');
  ti.className = 'turn-indicator ' + state.turn;
  ti.textContent = state.over ? 'Игра окончена' : `Ход: ${NAMES[state.turn]}`;

  renderLog();
}

function addLog(type, text) {
  state.log.push({ type, text });
}

function renderLog() {
  const logEl = document.getElementById('log');
  logEl.innerHTML = state.log
    .slice(-50)
    .map(e => `<div class="entry ${e.type}">${e.text}</div>`)
    .join('');
  logEl.scrollTop = logEl.scrollHeight;
}

// ================== ЭКРАНЫ ==================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function init() {
  buildBoard();
  document.querySelectorAll('.win-score').forEach(e => (e.textContent = WIN_SCORE));
  document.getElementById('rules-win-score').textContent = WIN_SCORE;
  document.getElementById('rules-m-points').textContent = M_POINTS;

  document.getElementById('btn-new').onclick = newGame;
  document.getElementById('btn-rules').onclick = () => showScreen('rules');
  document.getElementById('btn-rules-back').onclick = () => showScreen('menu');
  document.getElementById('btn-again').onclick = newGame;
  document.getElementById('btn-victory-menu').onclick = () => showScreen('menu');
  document.getElementById('btn-to-menu').onclick = () => {
    if (confirm('Выйти в меню? Текущая партия будет потеряна.')) showScreen('menu');
  };
  document.getElementById('btn-surrender').onclick = () => {
    if (!state || state.over || state.busy) return;
    if (confirm(`${NAMES[state.turn]} сдаются?`)) {
      const loser = state.turn;
      finishGame(opponent(loser), `${NAMES[loser]} сдались.`);
    }
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') cancelSelection(); });
  boardEl.addEventListener('contextmenu', e => { e.preventDefault(); cancelSelection(); });
}

init();
