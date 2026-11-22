// Quick game setup screen and the rules screen.
import { CHARACTER_IDS, DEFAULT_RULES } from '@manducat/core';
import { CHARACTER_INFO } from '../content/characters';
import type { Profile } from '../meta/profile';
import type { Settings } from '../meta/settings';
import { $ } from './dom';
import { deckChips } from './widgets';

export type GameMode = 'ai' | 'hotseat';

let currentMode: GameMode = 'ai';

export function initSetupScreen(settings: Settings, profile: Profile, onChange: () => void): void {
  document.querySelectorAll<HTMLElement>('.char-grid').forEach(g => {
    g.innerHTML = [...CHARACTER_IDS, 'random' as const].map(k => {
      const ch = k === 'random' ? null : CHARACTER_INFO[k];
      return `<button class="opt" data-value="${k}"><span class="ic">${ch ? ch.icon : '🎲'}</span>${ch ? ch.name : 'Random'}</button>`;
    }).join('');
  });
  document.querySelectorAll<HTMLElement>('#screen-setup .opt-group, #screen-setup .char-grid').forEach(g => {
    g.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.opt');
      if (!b) return;
      const key = g.dataset.opt!;
      const v = b.dataset.value!;
      (settings as unknown as Record<string, string | number>)[key] = key === 'format' ? Number(v) : v;
      syncSetup(settings, profile);
      onChange();
    });
  });
}

export function openSetup(mode: GameMode, settings: Settings, profile: Profile): void {
  currentMode = mode;
  const ai = mode === 'ai';
  $('setup-title').textContent = ai ? 'Quick game vs AI' : 'Hot-seat (debug)';
  $('setup-ai-opts').style.display = ai ? '' : 'none';
  syncSetup(settings, profile);
}

/** Whether the quick game is a series (then you play your deck against a random AI deck). */
export const isSeries = (settings: Settings, mode: GameMode): boolean => mode === 'ai' && settings.format > 1;

function syncSetup(settings: Settings, profile: Profile): void {
  const ai = currentMode === 'ai';
  const series = isSeries(settings, currentMode);
  const values = settings as unknown as Record<string, string | number>;
  document.querySelectorAll<HTMLElement>('#screen-setup .opt-group, #screen-setup .char-grid').forEach(g => {
    g.querySelectorAll<HTMLElement>('.opt').forEach(b => b.classList.toggle('active', b.dataset.value === String(values[g.dataset.opt!])));
  });
  $('color-block').style.display = series ? 'none' : '';
  $('chars-block').style.display = series ? 'none' : '';
  $('series-block').style.display = series ? '' : 'none';
  if (series) $('series-deck').innerHTML = deckChips(profile.deck);
  $('char-a-title').textContent = ai ? 'Your character' : 'Blue character';
  $('char-b-title').textContent = ai ? 'AI character' : 'Red character';
  const desc = (k: string) => (k === 'random' ? 'A random character.' : CHARACTER_INFO[k as keyof typeof CHARACTER_INFO].desc(DEFAULT_RULES));
  $('char-a-desc').textContent = desc(settings.charA);
  $('char-b-desc').textContent = desc(settings.charB);
}

export function fillRules(): void {
  const r = DEFAULT_RULES;
  document.querySelectorAll('.win-score').forEach(e => (e.textContent = String(r.winScore)));
  document.querySelectorAll('.quiet-limit').forEach(e => (e.textContent = String(r.quietLimit)));
  document.querySelectorAll('.final-moves').forEach(e => (e.textContent = String(r.finalMoves)));
  document.querySelectorAll('.ability-cd').forEach(e => (e.textContent = String(r.abilityCooldown)));
  $('rules-win-score').textContent = String(r.winScore);
  $('rules-m-points').textContent = String(r.mPoints);
  $('rules-chars').innerHTML = CHARACTER_IDS
    .map(k => `<li>${CHARACTER_INFO[k].icon} <b>${CHARACTER_INFO[k].name}</b> — ${CHARACTER_INFO[k].desc(r)}</li>`).join('');
}
