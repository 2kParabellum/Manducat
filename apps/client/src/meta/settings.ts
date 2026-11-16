// Настройки, которые запоминаются между запусками (только на этом устройстве).
// Здесь же в будущем появится профиль игрока: прогресс кампании, ачивки, купленный контент.
import type { CharacterId } from '@manducat/core';
import type { Difficulty } from '@manducat/ai';

export type CharChoice = CharacterId | 'random';

export interface Settings {
  color: 'blue' | 'red' | 'random';
  difficulty: Difficulty;
  /** Персонажи: в игре против ИИ — свой и ИИ; вдвоём — синих и красных. */
  charA: CharChoice;
  charB: CharChoice;
}

const KEY = 'manducat.settings.v1';
const DEFAULTS: Settings = { color: 'blue', difficulty: 'normal', charA: 'jack', charB: 'jack' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* хранилище недоступно — работаем с настройками по умолчанию */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* не страшно */ }
}
