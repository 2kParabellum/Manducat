// Deck screen: character info and the deck of three (Jack may be picked several times).
import { CHARACTER_IDS, DECK_SIZE, DEFAULT_RULES } from '@manducat/core';
import type { CharacterId } from '@manducat/core';
import { CHARACTER_INFO } from '../content/characters';
import { isUnlocked, saveProfile } from '../meta/profile';
import type { Profile } from '../meta/profile';
import { $, showScreen, showToast } from './dom';

export class DeckScreen {
  private active = 0;
  private onBack: () => void = () => {};

  constructor(private readonly profile: Profile) {
    $('btn-deck-back').onclick = () => this.onBack();
    $('deck-slots').addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!el) return;
      this.active = Number(el.dataset.slot);
      this.render();
    });
    $('deck-chars').addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-char]');
      if (el) this.pick(el.dataset.char as CharacterId);
    });
  }

  open(onBack: () => void): void {
    this.onBack = onBack;
    this.active = 0;
    this.render();
    showScreen('deck');
  }

  private pick(c: CharacterId): void {
    const p = this.profile;
    if (!isUnlocked(p, c)) return showToast('Unlock this character in the campaign');
    const deck = p.deck;
    const other = c === 'jack' ? -1 : deck.indexOf(c);
    if (other >= 0 && other !== this.active) deck[other] = deck[this.active];   // swap instead of duplicating
    deck[this.active] = c;
    this.active = (this.active + 1) % DECK_SIZE;
    saveProfile(p);
    this.render();
  }

  private render(): void {
    const p = this.profile;
    $('deck-slots').innerHTML = p.deck.map((c, i) => {
      const ch = CHARACTER_INFO[c];
      return `<button class="slot${i === this.active ? ' active' : ''}" data-slot="${i}">` +
        `<span class="slot-no">#${i + 1}</span><span class="ic">${ch.icon}</span>${ch.name}</button>`;
    }).join('');
    $('deck-chars').innerHTML = CHARACTER_IDS.map(c => {
      const ch = CHARACTER_INFO[c];
      const open = isUnlocked(p, c);
      const inDeck = c !== 'jack' && p.deck.includes(c);
      return `<button class="char-card${open ? '' : ' locked'}${inDeck ? ' in-deck' : ''}" data-char="${c}">` +
        `<span class="ic">${open ? ch.icon : '🔒'}</span>` +
        `<span class="cc-body"><span><b>${ch.name}</b>${inDeck ? ' <small class="tag">in deck</small>' : ''}</span>` +
        `<span class="cc-desc">${open ? ch.desc(DEFAULT_RULES) : 'Unlock it in the campaign.'}</span></span></button>`;
    }).join('');
  }
}
