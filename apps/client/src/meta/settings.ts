// Settings remembered between launches (on this device only).
import type { CharacterId } from '@manducat/core';
import type { Difficulty } from '@manducat/ai';

export type CharChoice = CharacterId | 'random';
export type Format = 1 | 3 | 5;

export interface Settings {
  color: 'blue' | 'red' | 'random';
  difficulty: Difficulty;
  /** Quick game format: single game, Bo3 or Bo5 (series use your deck). */
  format: Format;
  /** Characters: vs AI — yours and the AI's; hot-seat — blue's and red's. */
  charA: CharChoice;
  charB: CharChoice;
}

const KEY = 'manducat.settings.v1';
const DEFAULTS: Settings = { color: 'blue', difficulty: 'normal', format: 1, charA: 'jack', charB: 'jack' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS, ...JSON.parse(raw) } as Settings;
      s.format = ([1, 3, 5] as const).find(f => f === Number(s.format)) ?? 1;
      return s;
    }
  } catch { /* storage unavailable — use defaults */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* not critical */ }
}
