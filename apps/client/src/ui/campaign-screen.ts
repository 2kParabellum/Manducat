// Campaign map (a snake route of levels and rewards) and the level briefing screen.
import { CHARACTER_IDS, DEFAULT_RULES, winsNeeded } from '@manducat/core';
import { CHARACTER_INFO, charLabel } from '../content/characters';
import { CAMPAIGN, DIFFICULTY_NAME, currentNode, formatName, nodeState } from '../content/campaign';
import type { CampaignNode, LevelNode } from '../content/campaign';
import { grantCharacter, saveProfile } from '../meta/profile';
import type { Profile } from '../meta/profile';
import { $, escapeHtml, showInfo, showScreen, showToast } from './dom';
import { deckChips } from './widgets';

const STEP = 104;      // vertical distance between nodes, px
const TOP = 56;
const X = [50, 72, 50, 28];   // snake: horizontal positions (%) repeating every 4 nodes

const LEVEL_COUNT = CAMPAIGN.filter(n => n.kind === 'level').length;

export interface CampaignHandlers {
  play(level: LevelNode): void;
  tutorial(): void;
  editDeck(back: () => void): void;
}

export class CampaignScreen {
  private level: LevelNode | null = null;

  constructor(private readonly profile: Profile, private readonly h: CampaignHandlers) {
    $('campaign-map').addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-node]');
      if (el) this.onNode(CAMPAIGN.find(n => n.id === el.dataset.node)!);
    });
    $('btn-level-back').onclick = () => this.open();
    $('btn-level-deck').onclick = () => this.h.editDeck(() => this.openLevel(this.level!));
    $('btn-level-play').onclick = () => this.h.play(this.level!);
  }

  open(): void {
    this.render();
    showScreen('campaign');
    const cur = document.querySelector('#campaign-map .node.current');
    cur?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  private onNode(n: CampaignNode): void {
    const state = nodeState(n, this.profile.completed);
    if (state === 'locked') return showToast('Complete the previous levels first');
    if (n.kind === 'tutorial') return this.h.tutorial();
    if (n.kind === 'reward') {
      if (state === 'current') this.openReward(n);
      else {
        const c = this.profile.rewards[n.id];
        if (c) showToast(`Here you recruited ${charLabel(c)}`);
      }
      return;
    }
    if (n.kind === 'level') this.openLevel(n);
  }

  private openReward(n: CampaignNode): void {
    const p = this.profile;
    const pool = CHARACTER_IDS.filter(c => !p.unlocked.includes(c));
    p.completed.push(n.id);
    if (pool.length === 0) {
      saveProfile(p);
      showInfo('<h2>🎁</h2><p>You already have every character.</p>', 'OK', () => this.open());
      return;
    }
    const c = pool[Math.floor(Math.random() * pool.length)];
    p.rewards[n.id] = c;
    const added = grantCharacter(p, c);   // also saves the profile
    const ch = CHARACTER_INFO[c];
    showInfo(
      `<div class="reward-ic">${ch.icon}</div><h2>${ch.name} joins you!</h2>` +
      `<p class="reward-desc">${escapeHtml(ch.desc(DEFAULT_RULES))}</p>` +
      (added ? '<p class="hint">Added to your deck.</p>' : '<p class="hint">Add it to your deck on the Deck screen.</p>'),
      'Great!',
      () => this.open(),
    );
  }

  openLevel(n: LevelNode): void {
    this.level = n;
    const done = this.profile.completed.includes(n.id);
    $('level-title').textContent = `Level ${n.num} · ${n.name}`;
    $('level-meta').textContent = `${formatName(n.bestOf)} · ${DIFFICULTY_NAME[n.difficulty]} AI${done ? ' · ✅ Completed' : ''}`;
    $('level-opponent').innerHTML = deckChips(n.bestOf === 1 ? n.deck.slice(0, 1) : n.deck);
    $('level-you').innerHTML = deckChips(n.bestOf === 1 ? this.profile.deck.slice(0, 1) : this.profile.deck);
    $('level-you-title').textContent = n.bestOf === 1 ? 'You play (deck slot #1)' : 'Your deck';
    $('level-note').textContent = n.bestOf === 1
      ? 'One game. Win it to complete the level.'
      : `Win ${winsNeeded(n.bestOf)} games. After each game the winner keeps their character and the loser switches to the next one in their deck.`;
    showScreen('level');
  }

  private render(): void {
    const done = this.profile.completed;
    const cur = currentNode(done);
    const levelsDone = CAMPAIGN.filter(n => n.kind === 'level' && done.includes(n.id)).length;
    $('campaign-progress').textContent = cur ? `${levelsDone} / ${LEVEL_COUNT} levels` : 'Campaign complete! More levels coming soon.';

    const pts = CAMPAIGN.map((_, i) => ({ x: X[i % X.length], y: TOP + i * STEP }));
    const height = TOP * 2 + (CAMPAIGN.length - 1) * STEP;
    const curIdx = cur ? CAMPAIGN.indexOf(cur) : CAMPAIGN.length - 1;
    const path = (upto: number) => pts.slice(0, upto + 1).map((p, i) => {
      if (i === 0) return `M${p.x} ${p.y}`;
      const q = pts[i - 1], my = (q.y + p.y) / 2;
      return `C${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`;
    }).join(' ');

    const nodes = CAMPAIGN.map((n, i) => {
      const st = nodeState(n, done);
      let icon: string, sub: string;
      if (n.kind === 'tutorial') { icon = '🎓'; sub = st === 'done' ? 'Play again' : 'Learn the basics'; }
      else if (n.kind === 'reward') {
        const got = this.profile.rewards[n.id];
        icon = st === 'done' && got ? CHARACTER_INFO[got].icon : '🎁';
        sub = st === 'done' ? (got ? `Recruited ${CHARACTER_INFO[got].name}` : 'Opened') : 'Random character';
      } else {
        icon = n === CAMPAIGN[CAMPAIGN.length - 1] ? '👑' : String(n.num);
        const opp = n.deck.slice(0, n.bestOf === 1 ? 1 : 3).map(c => CHARACTER_INFO[c].icon).join('');
        sub = `${opp} · ${DIFFICULTY_NAME[n.difficulty]}${n.bestOf > 1 ? ` · Bo${n.bestOf}` : ''}`;
      }
      return `<button class="node ${n.kind} ${st}" data-node="${n.id}" style="left:${pts[i].x}%;top:${pts[i].y}px">` +
        `<span class="disc">${icon}${st === 'done' ? '<i class="check">✓</i>' : st === 'locked' ? '<i class="lock">🔒</i>' : ''}</span>` +
        `<span class="label"><b>${escapeHtml(n.name)}</b><small>${sub}</small></span></button>`;
    }).join('');

    $('campaign-map').style.height = `${height}px`;
    $('campaign-map').innerHTML =
      `<svg class="route" viewBox="0 0 100 ${height}" preserveAspectRatio="none">` +
      `<path class="todo" d="${path(CAMPAIGN.length - 1)}"/><path class="done" d="${path(curIdx)}"/></svg>` + nodes;
  }
}
