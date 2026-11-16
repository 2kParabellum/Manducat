// Точка входа: меню, настройка партии, запуск игры.
import { CHARACTER_IDS, opponent } from '@manducat/core';
import type { CharacterId, Player } from '@manducat/core';
import './styles.css';
import { loadSettings, saveSettings } from './meta/settings';
import type { CharChoice } from './meta/settings';
import { LocalSession } from './session/local';
import type { GameSession } from './session/types';
import { $, askConfirm, initConfirm, showScreen } from './ui/dom';
import { GameScreen } from './ui/game-screen';
import type { GameOverInfo } from './ui/game-screen';
import { fillRules, initSetupScreen, openSetup } from './ui/setup';
import type { GameMode } from './ui/setup';

const settings = loadSettings();
let mode: GameMode = 'ai';
let session: GameSession | null = null;
let screen: GameScreen | null = null;

const pickChar = (c: CharChoice): CharacterId =>
  c === 'random' ? CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)] : c;

function startGame(): void {
  stopGame();
  if (mode === 'ai') {
    const human: Player = settings.color === 'random' ? (Math.random() < 0.5 ? 'blue' : 'red') : settings.color;
    const chars = { [human]: pickChar(settings.charA), [opponent(human)]: pickChar(settings.charB) } as Record<Player, CharacterId>;
    session = new LocalSession({ mode: 'ai', chars, humanColor: human, difficulty: settings.difficulty });
  } else {
    session = new LocalSession({ mode: 'hotseat', chars: { blue: pickChar(settings.charA), red: pickChar(settings.charB) } });
  }
  screen = new GameScreen(session, showVictory);
  showScreen('game');
  session.start();
}

function stopGame(): void {
  screen?.dispose();
  session?.dispose();
  screen = null;
  session = null;
}

function showVictory(info: GameOverInfo): void {
  const title = $('victory-title');
  title.className = info.titleClass;
  title.textContent = info.title;
  $('victory-reason').textContent = info.reason;
  $('final-blue').textContent = String(info.view.scores.blue);
  $('final-red').textContent = String(info.view.scores.red);
  showScreen('victory');
}

function toMenu(): void {
  stopGame();
  showScreen('menu');
}

function init(): void {
  initConfirm();
  fillRules();
  initSetupScreen(settings, () => saveSettings(settings));

  $('btn-vs-ai').onclick = () => { mode = 'ai'; openSetup(mode, settings); showScreen('setup'); };
  $('btn-pvp').onclick = () => { mode = 'hotseat'; openSetup(mode, settings); showScreen('setup'); };
  $('btn-rules').onclick = () => showScreen('rules');
  $('btn-rules-back').onclick = () => showScreen('menu');
  $('btn-setup-back').onclick = () => showScreen('menu');
  $('btn-setup-start').onclick = startGame;
  $('btn-again').onclick = startGame;
  $('btn-victory-menu').onclick = toMenu;
  $('btn-to-menu').onclick = () => {
    if (!screen || screen.isOver) return toMenu();
    askConfirm('Выйти в меню? Текущая партия будет потеряна.', toMenu);
  };
}

init();
