// 6×6 board geometry. Cells are numbered 0..35 row by row.
import type { Player } from './types';

export const SIZE = 6;
export const CELLS = SIZE * SIZE;
export const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];

/** Mine owners as a bitmask. */
export const BIT: Readonly<Record<Player, number>> = { blue: 1, red: 2 };

export const rc = (i: number): [number, number] => [Math.floor(i / SIZE), i % SIZE];
export const idx = (r: number, c: number): number => r * SIZE + c;
export const inside = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
export const coordName = (i: number): string => {
  const [r, c] = rc(i);
  return 'ABCDEF'[c] + (r + 1);
};

/** Row and column of every cell (lookup tables for the AI's hot loops). */
export const ROW: readonly number[] = Array.from({ length: CELLS }, (_, i) => Math.floor(i / SIZE));
export const COL: readonly number[] = Array.from({ length: CELLS }, (_, i) => i % SIZE);

/** Rays from a cell in 4 directions (for rook-like attacks), nearest cell first. */
export const RAYS: ReadonlyArray<ReadonlyArray<readonly number[]>> = Array.from({ length: CELLS }, (_, i) =>
  DIRS.map(([dr, dc]) => {
    const ray: number[] = [];
    for (let r = Math.floor(i / SIZE) + dr, c = (i % SIZE) + dc; inside(r, c); r += dr, c += dc) ray.push(idx(r, c));
    return ray;
  }));

/** Horizontal and vertical neighbours. */
export const NEIGHBORS: ReadonlyArray<readonly number[]> = Array.from({ length: CELLS }, (_, i) => {
  const [r, c] = rc(i);
  return DIRS.map(([dr, dc]) => [r + dr, c + dc] as const)
    .filter(([a, b]) => inside(a, b))
    .map(([a, b]) => idx(a, b));
});

/** The 2×2 scout area by its top-left corner. */
export const scoutArea = (i: number): number[] => [i, i + 1, i + SIZE, i + SIZE + 1];

/** Top-left corner of the 2×2 area starting at cell i (clamped to the board edge). */
export const scoutCorner = (i: number): number => {
  const [r, c] = rc(i);
  return idx(Math.min(r, SIZE - 2), Math.min(c, SIZE - 2));
};
