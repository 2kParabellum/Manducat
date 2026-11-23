import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getPlayerView, isLegalAction, listActions } from '@manducat/core';
import type { GameEvent, GameState } from '@manducat/core';
import { createBot } from '@manducat/ai';
import { TUTORIAL, tutorialBotScript } from '../src/content/tutorial';
import { tutorialScenario } from '../src/flow/tutorial';

const newGame = (): GameState => createGame({ chars: { blue: 'jack', red: 'jack' }, seed: 1, layout: TUTORIAL.layout });

/** Plays the scripted part and returns the events of every blue action. */
function playScript(g: GameState): GameEvent[][] {
  const blueEvents: GameEvent[][] = [];
  const replies = tutorialBotScript(TUTORIAL);
  TUTORIAL.steps.forEach((s, k) => {
    expect(isLegalAction(g, 'blue', s.expect), `step ${k + 1}`).toBe(true);
    blueEvents.push(applyAction(g, s.expect));
    if (k < replies.length) {
      expect(isLegalAction(g, 'red', replies[k]), `reply ${k + 1}`).toBe(true);
      applyAction(g, replies[k]);
    }
  });
  return blueEvents;
}

describe('tutorial', () => {
  it('the layout is a full regular deck', () => {
    const counts: Record<string, number> = {};
    for (const c of TUTORIAL.layout) {
      const key = c!.owner ? c!.owner + c!.value : 'G';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      blue1: 4, blue2: 3, blue3: 3, blue5: 2, blue8: 2, blueM: 1,
      red1: 4, red2: 3, red3: 3, red5: 2, red8: 2, redM: 1, G: 6,
    });
  });

  it('the script is legal and teaches every mechanic in order', () => {
    const g = newGame();
    const ev = playScript(g);
    const kinds = ev.map(e => e.find(x => x.t !== 'end')!);
    expect(kinds[0]).toMatchObject({ t: 'flip', piece: { owner: 'blue' } });
    expect(kinds[1]).toMatchObject({ t: 'flipG' });
    expect(kinds[2]).toMatchObject({ t: 'move' });
    expect(kinds[3]).toMatchObject({ t: 'capture', victim: { owner: 'red' } });
    expect(kinds[4]).toMatchObject({ t: 'flipM', owner: 'blue' });
    expect(kinds[5]).toMatchObject({ t: 'place' });
    expect(kinds[6]).toMatchObject({ t: 'capture', attacker: { value: 'M' }, victim: { owner: 'red', value: '8' }, pts: 8 });
    expect(g.result).toBeNull();
    expect(g.turn).toBe('red');
    expect(g.scores).toEqual({ blue: 13, red: 3 });
  });

  it('the game can be played out after the script', () => {
    const g = newGame();
    playScript(g);
    const bots = { blue: createBot('blue', 'easy'), red: createBot('red', 'easy') };
    for (let n = 0; n < 600 && !g.result; n++) {
      const p = g.turn;
      const a = bots[p].chooseAction(getPlayerView(g, p));
      expect(listActions(g, p).length).toBeGreaterThan(0);
      applyAction(g, a);
    }
    expect(g.result).not.toBeNull();
  });

  it('the coach: intro, scripted steps, then free play', () => {
    const guide = tutorialScenario().guide();
    const g = newGame();
    const view = () => getPlayerView(g, 'blue');
    expect(guide.coach(view(), true)?.button).toBeTruthy();
    guide.press();
    const replies = tutorialBotScript(TUTORIAL);
    TUTORIAL.steps.forEach((s, k) => {
      const c = guide.coach(view(), true)!;
      expect(c.expect).toEqual(s.expect);
      expect(c.scripted).toBe(true);
      applyAction(g, s.expect);
      if (k < replies.length) {
        const waiting = guide.coach(view(), false)!;
        expect(waiting.dim).toBe(true);
        expect(waiting.expect).toBeUndefined();
        applyAction(g, replies[k]);
      }
    });
    const after = guide.coach(view(), false)!;
    expect(after.scripted).toBe(false);
    expect(after.expect).toBeUndefined();
    expect(after.title).toBe(TUTORIAL.outro.title);
  });
});
