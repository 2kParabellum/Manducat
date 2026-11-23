// Player profile: unlocked characters, deck and campaign progress. Stored locally for now;
// later it moves to the server (along with achievements and purchases).
import { CHARACTER_IDS, normalizeDeck } from '@manducat/core';
import type { CharacterId, Deck } from '@manducat/core';
import { CAMPAIGN, TUTORIAL_ID } from '../content/campaign';

export interface Profile {
  unlocked: CharacterId[];
  deck: Deck;
  /** Completed campaign node ids. */
  completed: string[];
  /** Character received at each opened reward node. */
  rewards: Record<string, CharacterId>;
}

const KEY = 'manducat.profile.v1';
const fresh = (): Profile => ({ unlocked: ['jack'], deck: normalizeDeck([]), completed: [], rewards: {} });

function sanitize(p: Partial<Profile>): Profile {
  const unlocked = CHARACTER_IDS.filter(c => c === 'jack' || p.unlocked?.includes(c));
  const ids = new Set(CAMPAIGN.map(n => n.id));
  const completed = (p.completed ?? []).filter(id => ids.has(id));
  // Profiles from before the tutorial existed: whoever already got past it doesn't have to replay it
  if (completed.length > 0 && !completed.includes(TUTORIAL_ID)) completed.unshift(TUTORIAL_ID);
  return {
    unlocked,
    deck: normalizeDeck(p.deck ?? [], unlocked),
    completed,
    rewards: p.rewards ?? {},
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return fresh();
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* not critical */ }
}

/** Replaces the profile contents in place (so every screen keeps the same object). */
function assign(p: Profile, next: Profile): void {
  Object.assign(p, next);
  saveProfile(p);
}

export function resetCampaign(p: Profile): void {
  assign(p, fresh());
}

export function unlockAll(p: Profile): void {
  assign(p, sanitize({ ...p, unlocked: [...CHARACTER_IDS], completed: CAMPAIGN.map(n => n.id) }));
}

export function isUnlocked(p: Profile, c: CharacterId): boolean {
  return p.unlocked.includes(c);
}

/** Unlocks a character and puts it into the first Jack slot of the deck, if any. Returns true if it went into the deck. */
export function grantCharacter(p: Profile, c: CharacterId): boolean {
  if (!p.unlocked.includes(c)) p.unlocked.push(c);
  let added = false;
  if (!p.deck.includes(c)) {
    const slot = p.deck.indexOf('jack');
    if (slot >= 0) { p.deck[slot] = c; added = true; }
  }
  saveProfile(p);
  return added;
}
