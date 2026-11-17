// Small HTML builders shared by several screens.
import type { CharacterId } from '@manducat/core';
import { CHARACTER_INFO } from '../content/characters';

export function charChip(c: CharacterId, note = ''): string {
  const ch = CHARACTER_INFO[c];
  return `<span class="chip"><span class="ic">${ch.icon}</span>${ch.name}${note ? `<small>${note}</small>` : ''}</span>`;
}

export function deckChips(deck: readonly CharacterId[]): string {
  return `<div class="chips">${deck.map((c, i) => charChip(c, deck.length > 1 ? `#${i + 1}` : '')).join('')}</div>`;
}
