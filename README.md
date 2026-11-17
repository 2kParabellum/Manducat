# Manducat

A turn-based card game for two on a 6×6 board: flips, rook-like captures, characters with abilities.
Modes: campaign, quick game vs AI (single game, Bo3, Bo5; 3 difficulty levels) and hot-seat (debug mode, everything is visible).

## Running

```
npm install
npm run dev       # http://localhost:5173
```

Build: `npm run build` → `apps/client/dist` (static files for a web server). `npm run build:single` → `apps/client/dist-single/index.html`, everything in one file.

## GitHub Pages

The game is published from the root of the `main` branch: the root `index.html` is a single-file build.
After code changes rebuild it with `npm run pages` and commit `index.html`.

## Development

- `npm test` — tests for rules, player views, series and bots
- `npm run typecheck` — type checking
- `npm run sim -- --games 20 --a normal:miner --b normal:jack` — bot tournament for balancing

Project structure and plans: [ARCHITECTURE.md](ARCHITECTURE.md).
