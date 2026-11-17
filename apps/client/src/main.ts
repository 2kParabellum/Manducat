// Entry point: menu, campaign, deck, quick game, settings.
import { CHARACTER_IDS, seriesChars, shuffle } from '@manducat/core';
import type { CharacterId } from '@manducat/core';
import './styles.css';
import { charLabel } from './content/characters';
import { CAMPAIGN, DIFFICULTY_NAME } from './content/campaign';
import type { LevelNode } from './content/campaign';
import { Match } from './flow/match';
import type { GameEnd, MatchConfig } from './flow/match';
import { loadProfile, resetCampaign, saveProfile, unlockAll } from './meta/profile';
import { loadSettings, saveSettings } from './meta/settings';
import type { CharChoice } from './meta/settings';
import { CampaignScreen } from './ui/campaign-screen';
import { DeckScreen } from './ui/deck-screen';
import { $, askConfirm, initDialogs, showScreen, showToast } from './ui/dom';
import { fillRules, initSetupScreen, isSeries, openSetup } from './ui/setup';
import type { GameMode } from './ui/setup';

const settings = loadSettings();
const profile = loadProfile();
let setupMode: GameMode = 'ai';
let match: Match | null = null;

type Context = { kind: 'quick' } | { kind: 'campaign'; level: LevelNode };
let context: Context = { kind: 'quick' };

const deckScreen = new DeckScreen(profile);
const campaign = new CampaignScreen(profile, {
  play: level => startLevel(level),
  editDeck: back => deckScreen.open(back),
});

const pickChar = (c: CharChoice): CharacterId =>
  c === 'random' ? CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)] : c;

// ---------- starting matches ----------

function startQuick(): void {
  const d = settings.difficulty;
  let cfg: MatchConfig;
  if (setupMode === 'hotseat') {
    cfg = { mode: 'hotseat', bestOf: 1, decks: { a: [pickChar(settings.charA)], b: [pickChar(settings.charB)] }, difficulty: d, color: 'blue', title: 'Hot-seat' };
  } else if (!isSeries(settings, setupMode)) {
    cfg = {
      mode: 'ai', bestOf: 1, decks: { a: [pickChar(settings.charA)], b: [pickChar(settings.charB)] }, difficulty: d,
      color: settings.color, title: `Quick game · ${DIFFICULTY_NAME[d]} AI`,
    };
  } else {
    const aiDeck = shuffle([...CHARACTER_IDS], Math.random).slice(0, 3);
    cfg = {
      mode: 'ai', bestOf: settings.format, decks: { a: [...profile.deck], b: aiDeck }, difficulty: d,
      color: 'random', title: `Quick game · ${DIFFICULTY_NAME[d]} AI`,
    };
  }
  runMatch(cfg, { kind: 'quick' });
}

function startLevel(level: LevelNode): void {
  runMatch({
    mode: 'ai', bestOf: level.bestOf, decks: { a: [...profile.deck], b: [...level.deck] }, difficulty: level.difficulty,
    color: 'random', title: `Level ${level.num} · ${level.name}`,
  }, { kind: 'campaign', level });
}

function runMatch(cfg: MatchConfig, ctx: Context): void {
  stopMatch();
  context = ctx;
  match = new Match(cfg, showResult);
  match.next();
}

function stopMatch(): void {
  match?.dispose();
  match = null;
}

// ---------- game / series result ----------

interface ResultButton { label: string; primary?: boolean; onClick: () => void }

function showResult(e: GameEnd): void {
  const m = match!;
  const ctx = context;
  const isSeriesMatch = m.config.bestOf > 1;
  const over = e.seriesWinner !== null;
  const won = e.seriesWinner === 'a';
  const w = e.series.wins;

  let title = e.game.title, cls = e.game.titleClass, reason = e.game.reason;
  if (over && (isSeriesMatch || ctx.kind === 'campaign')) {
    if (ctx.kind === 'campaign' && won) title = 'Level complete!';
    else if (isSeriesMatch) title = m.config.mode === 'ai' ? (won ? 'Series won!' : 'Series lost') : `${m.sideName(e.seriesWinner!)} wins the series!`;
    else title = 'Level failed';
    cls = won ? 'win' : 'lose';
    reason = `${e.game.title} ${e.game.reason}`;
  }
  if (ctx.kind === 'campaign' && won && !profile.completed.includes(ctx.level.id)) {
    profile.completed.push(ctx.level.id);
    saveProfile(profile);
  }

  $('victory-kicker').textContent = isSeriesMatch
    ? `Game ${e.gameNo} · Best of ${m.config.bestOf} · ${m.sideName('a')} ${w.a} – ${w.b} ${m.sideName('b')}` : '';
  const t = $('victory-title');
  t.className = cls;
  t.textContent = title;
  $('victory-reason').textContent = reason;
  $('final-blue').textContent = String(e.game.view.scores.blue);
  $('final-red').textContent = String(e.game.view.scores.red);

  let seriesHtml = '';
  if (isSeriesMatch) {
    seriesHtml = '<div class="games">' + e.series.games.map((g, i) =>
      `<span class="game-pill ${g.winner === 'a' ? 'win' : 'lose'}">G${i + 1}: ${charLabel(g.chars.a)} vs ${charLabel(g.chars.b)}</span>`).join('') + '</div>';
    if (!over) {
      const next = seriesChars(e.series);
      const loser = e.winner === 'a' ? 'b' : 'a';
      const switched = e.series.games[e.series.games.length - 1].chars[loser] !== next[loser];
      seriesHtml += `<p>Next game: <b>${charLabel(next.a)}</b> (${m.sideName('a')}) vs <b>${charLabel(next.b)}</b> (${m.sideName('b')})` +
        (switched ? `<br><small>${m.sideName(loser)} switched to the next deck slot.</small>` : '') + '</p>';
    }
  }
  $('series-result').innerHTML = seriesHtml;

  const buttons: ResultButton[] = [];
  const exit = ctx.kind === 'campaign' ? openCampaign : toMenu;
  if (!over) {
    buttons.push({ label: 'Next game', primary: true, onClick: () => match?.next() });
    buttons.push({ label: 'Leave series', onClick: () => askConfirm('Leave the series? It will be lost.', exit) });
  } else if (ctx.kind === 'campaign') {
    if (won) buttons.push({ label: 'Continue', primary: true, onClick: openCampaign });
    else {
      buttons.push({ label: 'Retry', primary: true, onClick: () => startLevel(ctx.level) });
      buttons.push({ label: 'Campaign map', onClick: openCampaign });
    }
  } else {
    buttons.push({ label: 'Play again', primary: true, onClick: startQuick });
    buttons.push({ label: 'Menu', onClick: toMenu });
  }
  const box = $('victory-buttons');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : '');
    el.textContent = b.label;
    el.onclick = b.onClick;
    box.appendChild(el);
  }
  showScreen('victory');
}

// ---------- navigation ----------

function toMenu(): void {
  stopMatch();
  showScreen('menu');
}

function openCampaign(): void {
  stopMatch();
  campaign.open();
}

function openSettings(): void {
  const levels = CAMPAIGN.filter(n => n.kind === 'level');
  const done = levels.filter(n => profile.completed.includes(n.id)).length;
  $('settings-progress').textContent =
    `${done} / ${levels.length} levels completed · ${profile.unlocked.length} / ${CHARACTER_IDS.length} characters unlocked`;
  showScreen('settings');
}

function openQuickSetup(mode: GameMode): void {
  setupMode = mode;
  openSetup(mode, settings, profile);
  showScreen('setup');
}

function init(): void {
  initDialogs();
  fillRules();
  initSetupScreen(settings, profile, () => saveSettings(settings));

  $('btn-campaign').onclick = openCampaign;
  $('btn-campaign-back').onclick = () => showScreen('menu');
  $('btn-vs-ai').onclick = () => openQuickSetup('ai');
  $('btn-pvp').onclick = () => openQuickSetup('hotseat');
  $('btn-deck').onclick = () => deckScreen.open(() => showScreen('menu'));
  $('btn-setup-deck').onclick = () => deckScreen.open(() => openQuickSetup(setupMode));
  $('btn-rules').onclick = () => showScreen('rules');
  $('btn-rules-back').onclick = () => showScreen('menu');
  $('btn-settings').onclick = openSettings;
  $('btn-settings-back').onclick = () => showScreen('menu');
  $('btn-reset').onclick = () => askConfirm('Reset the campaign? All progress and unlocked characters will be lost.', () => {
    resetCampaign(profile);
    openSettings();
    showToast('Campaign reset');
  });
  $('btn-unlock').onclick = () => askConfirm('Unlock all levels and characters?', () => {
    unlockAll(profile);
    openSettings();
    showToast('Everything unlocked');
  });
  $('btn-setup-back').onclick = () => showScreen('menu');
  $('btn-setup-start').onclick = startQuick;
  $('btn-to-menu').onclick = () => {
    const exit = context.kind === 'campaign' ? openCampaign : toMenu;
    if (!match?.gameInProgress) return exit();
    askConfirm('Leave the game? It will be lost.', exit);
  };
}

init();
