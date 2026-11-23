// Tutorial flow: turns the tutorial script into a coach for the game screen and a scenario for the match.
import type { PlayerView } from '@manducat/core';
import { TUTORIAL, tutorialBotScript } from '../content/tutorial';
import type { TutorialScript } from '../content/tutorial';
import type { Coach, Guide } from '../ui/guide';
import type { Scenario } from './match';

/** The human is Blue and moves first, so their k-th action is made at move number 2k. */
class TutorialGuide implements Guide {
  private introDone = false;

  constructor(private readonly t: TutorialScript) {}

  coach(view: PlayerView, myTurn: boolean): Coach | null {
    const { steps } = this.t;
    const n = steps.length;
    const m = view.moveNumber;
    if (view.result) return null;
    if (m === 0 && !this.introDone) return { ...this.t.intro, progress: 'Tutorial', scripted: true };
    if (m < 2 * n - 1) {
      const k = Math.floor(m / 2);
      const s = steps[k];
      const coach: Coach = { title: s.title, text: s.text, progress: `Step ${k + 1} of ${n}`, scripted: true };
      // While the AI answers, the last step stays on screen, dimmed
      if (m % 2 === 0 && myTurn) coach.expect = s.expect;
      else coach.dim = true;
      return coach;
    }
    if (m <= 2 * n) return { ...this.t.outro, progress: 'Tutorial', scripted: false };
    return { ...this.t.freePlay, progress: 'Tutorial', scripted: false };
  }

  press(): void {
    this.introDone = true;
  }
}

export function tutorialScenario(t: TutorialScript = TUTORIAL): Scenario {
  return {
    layout: t.layout,
    botScript: tutorialBotScript(t),
    guide: () => new TutorialGuide(t),
  };
}
