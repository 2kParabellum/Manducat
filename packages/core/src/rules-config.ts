import type { RulesConfig } from './types';

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze<RulesConfig>({
  winScore: 39,
  gPoints: 3,
  mPoints: 0,
  gCount: 6,
  quietLimit: 20,
  abilityCooldown: 15,
  effectTurns: 5,
  army: [['1', 4], ['2', 3], ['3', 3], ['5', 2], ['8', 2], ['M', 1]],
});
