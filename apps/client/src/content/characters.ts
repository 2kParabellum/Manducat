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
  swapper: {
    name: 'Swapper', icon: '🔄', verb: 'Swap',
    hint: 'Choose a card, then a neighbouring card to swap it with',
    desc: () => 'Swaps two neighbouring cards (up/down/left/right): yours, the opponent\'s or face-down ones. Effects travel with the cards. Stone cards can\'t be swapped.',
  },
  runner: {
    name: 'Runner', icon: '💨', verb: 'Haste',
    hint: 'Choose your face-up card to haste',
    desc: r => `Hastes your card for ${r.effectTurns} own turns: once, it may run any distance along a free path (mines only matter where it stops). No attack after the run. Any move or attack by the card uses the haste up.`,
  },
  necromancer: {
    name: 'Necromancer', icon: '💀', verb: 'Summon',
    hint: 'Choose an empty cell to summon a 3',
    desc: () => 'Summons your own 3 on any empty cell. It stays until captured (worth 3 points). A mine on the cell blows it up.',
  },
  avenger: {
    name: 'Avenger', icon: '⚔️', verb: 'Strike',
    desc: r => `Strikes the opponent directly: they lose ${r.strikeDamage} points. Doesn't work while you lead on points.`,
  },
  gargoyle: {
    name: 'Gargoyle', icon: '🗿', verb: 'Stone',
    hint: 'Choose your face-up card to turn to stone',
    desc: r => `Turns your card to stone for ${r.effectTurns} opponent turns: it can\'t move or attack, but can\'t be captured either (it still blocks lines).`,
  },
};

export const charLabel = (c: CharacterId): string => `${CHARACTER_INFO[c].icon} ${CHARACTER_INFO[c].name}`;
