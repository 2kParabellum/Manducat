// Экран настройки партии и экран правил.
import { CHARACTER_IDS, DEFAULT_RULES } from '@manducat/core';
import { CHARACTER_INFO } from '../content/characters';
import type { Settings } from '../meta/settings';
import { $ } from './dom';

export type GameMode = 'ai' | 'hotseat';

export function initSetupScreen(settings: Settings, onChange: () => void): void {
  document.querySelectorAll<HTMLElement>('.char-grid').forEach(g => {
    g.innerHTML = [...CHARACTER_IDS, 'random' as const].map(k => {
      const ch = k === 'random' ? null : CHARACTER_INFO[k];
      return `<button class="opt" data-value="${k}"><span class="ic">${ch ? ch.icon : '🎲'}</span>${ch ? ch.name : 'Случайный'}</button>`;
    }).join('');
  });
  document.querySelectorAll<HTMLElement>('.opt-group, .char-grid').forEach(g => {
    g.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.opt');
      if (!b) return;
      (settings as unknown as Record<string, string>)[g.dataset.opt!] = b.dataset.value!;
      syncSetup(settings);
      onChange();
    });
  });
}

export function openSetup(mode: GameMode, settings: Settings): void {
  const ai = mode === 'ai';
  $('setup-title').textContent = ai ? 'Игра против ИИ' : 'Игра вдвоём';
  $('setup-ai-opts').style.display = ai ? '' : 'none';
  $('char-a-title').textContent = ai ? 'Ваш персонаж' : 'Персонаж синих';
  $('char-b-title').textContent = ai ? 'Персонаж ИИ' : 'Персонаж красных';
  syncSetup(settings);
}

function syncSetup(settings: Settings): void {
  const values = settings as unknown as Record<string, string>;
  document.querySelectorAll<HTMLElement>('.opt-group, .char-grid').forEach(g => {
    g.querySelectorAll<HTMLElement>('.opt').forEach(b => b.classList.toggle('active', b.dataset.value === values[g.dataset.opt!]));
  });
  const desc = (k: string) => (k === 'random' ? 'Персонаж выберется случайно.' : CHARACTER_INFO[k as keyof typeof CHARACTER_INFO].desc(DEFAULT_RULES));
  $('char-a-desc').textContent = desc(settings.charA);
  $('char-b-desc').textContent = desc(settings.charB);
}

export function fillRules(): void {
  const r = DEFAULT_RULES;
  document.querySelectorAll('.win-score').forEach(e => (e.textContent = String(r.winScore)));
  document.querySelectorAll('.quiet-limit').forEach(e => (e.textContent = String(r.quietLimit)));
  document.querySelectorAll('.ability-cd').forEach(e => (e.textContent = String(r.abilityCooldown)));
  $('rules-win-score').textContent = String(r.winScore);
  $('rules-m-points').textContent = String(r.mPoints);
  $('rules-chars').innerHTML = CHARACTER_IDS
    .map(k => `<li>${CHARACTER_INFO[k].icon} <b>${CHARACTER_INFO[k].name}</b> — ${CHARACTER_INFO[k].desc(r)}</li>`).join('');
}
