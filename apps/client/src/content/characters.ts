// Character texts and icons. Mechanics live in @manducat/core (abilities.ts).
import type { CharacterId, RulesConfig } from '@manducat/core';

export interface CharacterInfo {
  name: string;
  icon: string;
  /** Ability name on the button. */
  verb?: string;
  /** Hint while choosing a target. */
  hint?: string;
  desc(rules: RulesConfig): string;
}

export const CHARACTER_INFO: Readonly<Record<CharacterId, CharacterInfo>> = {
  jack: {
    name: 'Jack', icon: '🃏',
    desc: () => 'No ability — the classic game.',
  },
  scout: {
    name: 'Scout', icon: '🔍', verb: 'Scout',
    hint: 'Choose a 2×2 area to scout',
    desc: () => 'Secretly peeks at 4 cards (a 2×2 area) for 3 seconds — then you have to remember them. Reveals mines.',
  },
  poisoner: {
    name: 'Poisoner', icon: '☠️', verb: 'Poison',
    hint: 'Choose your face-up card to poison',
    desc: r => `Poisons your face-up card for ${r.effectTurns} opponent turns. Whoever captures it dies too (the Poisoner scores for the attacker).`,
  },
  witch: {
    name: 'Witch', icon: '🔮', verb: 'Curse',
    hint: 'Choose an enemy card to curse (not 1 or M)',
    desc: () => 'Lowers an enemy card\'s strength and points by 1 (stacks). The curse is lifted when the card captures. Not on 1 or M. A 1 still beats a cursed 8.',
  },
  miner: {
    name: 'Miner', icon: '💣', verb: 'Mine',
    hint: 'Choose an empty cell to mine',
    desc: () => 'Mines an empty cell. Only the Miner sees it. Any piece that steps on it dies (single use). Shields don\'t help.',
  },
  defender: {
    name: 'Defender', icon: '🛡️', verb: 'Shield',
    hint: 'Choose your face-up card to shield',
    desc: r => `Shields your card for ${r.effectTurns} opponent turns. The shield reflects one attack (the attacker stays in place) and breaks. Poison and mines go through it.`,
  },
};

export const charLabel = (c: CharacterId): string => `${CHARACTER_INFO[c].icon} ${CHARACTER_INFO[c].name}`;
