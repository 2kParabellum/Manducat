// Статическая оценка позиции. Веса подобраны матчами ИИ против ИИ (npm run sim).
import { BIT, COL, NEIGHBORS, PLAYERS, ROW, abilityOf, attackTargets, canBeat, opponent, piecePoints } from '@manducat/core';
import type { Piece, Player, UnitValue } from '@manducat/core';
import type { SimState } from './belief';

export const W = {
  /** «Боевая ценность» открытой карты на поле. */
  power: { '1': 1.0, '2': 0.5, '3': 0.8, '5': 1.3, '8': 2.0, 'M': 2.5 } as Record<UnitValue, number>,
  handM: 2.5,         // M в руке
  tmThreat: 0.85,     // взятие, доступное тому, кто сейчас ходит
  otherThreat: 0.35,  // угроза от того, кто не ходит
  approach: 0.25,     // тянуться к картам, которые можем съесть
  winRush: 12,        // насколько дороже очки при приближении к победе
  stall: 0.35,        // штраф за каждый «тихий» ход подряд
  repeat: 1.5,        // штраф за повтор позиции
  ability: 1.5,       // ценность готовой способности (не тратить зря)
  mine: 1.2,          // своя мина на поле
  mineAdj: 0.6,       // ...и за каждую вражескую фигуру рядом с ней
  scoutCard: 0.8,     // разведка: за каждую неизвестную карту в области
  scoutMine: 3,       // разведка: за вероятную мину в области
};

export const WIN_VALUE = 1e6;

function scoreValue(x: number, winScore: number): number {
  const r = Math.min(x, winScore) / winScore;
  return x + W.winRush * r * r * r;
}

// Горячая функция: без замыканий и лишних аллокаций.
export function evaluate(s: SimState, me: Player): number {
  const opp = opponent(me);
  const b = s.board, R = s.rules;
  let v = scoreValue(s.scores[me], R.winScore) - scoreValue(s.scores[opp], R.winScore);
  v += W.handM * (s.hand[me] - s.hand[opp]);

  for (const p of PLAYERS) {
    if (abilityOf(s.chars[p])) v += (p === me ? 1 : -1) * W.ability * (1 - s.cooldown[p] / R.abilityCooldown);
  }

  const gain = { blue: 0, red: 0 };   // лучшее доступное взятие (очки + выбитая боевая ценность)
  const pts = { blue: 0, red: 0 };    // лучшее взятие в чистых очках
  const open: number[] = [];
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (!c || !c.faceUp) continue;
    open.push(i);
    v += (c.owner === me ? 1 : -1) * (W.power[c.value] - 0.25 * (c.curse ?? 0));
    for (const t of attackTargets(b, i)) {
      const T = b[t] as Piece;
      let g: number;
      if (T.shield) g = 0.3;
      else {
        g = piecePoints(T, R) + W.power[T.value];
        if (T.poison) g -= piecePoints(c, R) + W.power[c.value];
        else if (piecePoints(T, R) > pts[c.owner]) pts[c.owner] = piecePoints(T, R);
      }
      if (g > gain[c.owner]) gain[c.owner] = g;
    }
  }

  const tm = s.turn, other = opponent(tm);
  const tmSign = tm === me ? 1 : -1;
  if (s.scores[tm] + pts[tm] >= R.winScore) return tmSign * WIN_VALUE * 0.5;
  if (s.scores[tm] + R.gPoints >= R.winScore && s.pool.G > 0 && s.hidden > 0) {
    v += tmSign * (s.pool.G / s.hidden) * 40;
  }
  v += tmSign * W.tmThreat * gain[tm];
  v -= tmSign * W.otherThreat * gain[other];

  // Подтягиваться к тем, кого можем съесть
  for (let xi = 0; xi < open.length; xi++) {
    const x = open[xi];
    const A = b[x] as Piece;
    const ar = ROW[x], ac = COL[x];
    const sign = A.owner === me ? 1 : -1;
    for (let yi = 0; yi < open.length; yi++) {
      const y = open[yi];
      const B = b[y] as Piece;
      if (A.owner === B.owner || B.shield || B.poison || !canBeat(A, B)) continue;
      const br = ROW[y], bc = COL[y];
      const d = Math.abs(ar - br) + Math.abs(ac - bc);
      const aligned = ar === br || ac === bc ? 1 : 0.5;
      v += sign * W.approach * aligned * (piecePoints(B, R) + 1) / (4 * (1 + d));
    }
  }

  // Свои мины ценны, особенно рядом с врагами
  for (let i = 0; i < b.length; i++) {
    if (!(s.mines[i] & BIT[me]) || b[i] !== null) continue;
    let adj = 0;
    for (const j of NEIGHBORS[i]) {
      const c = b[j];
      if (c && c.faceUp && c.owner === opp) adj++;
    }
    v += W.mine + W.mineAdj * adj;
  }
  return v;
}
