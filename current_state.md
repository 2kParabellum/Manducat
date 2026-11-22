# Current State

## In progress: Rule of Three Repeats + final countdown

Requested rules:

1. **Rule of Three Repeats.** If a player's last 6 own actions are A, B, A, B, A, B (moves/attacks; flips, place and abilities never count), action A is banned on their next turn. The UI shows the banned target cell in red and a toast if the player tries it. The ban is lifted if it is the player's only legal action.
2. **Final countdown.** `quietLimit` 20 → 15. When a player makes their 15th quiet move in a row, a warning appears and the final countdown starts: `finalMoves` = 10 more moves per player (20 half-moves). Flips and captures do NOT stop it. Then: more points wins, on a tie the player who made the last move loses (the player who triggered the countdown). Reaching 39 points still wins immediately.

Done (code written, NOT yet compiled or tested — the local machine had no Node.js):

- core: `RulesConfig.finalMoves`, `GameCore.countdown` + `GameCore.recent`, `countdown` event, `repeatKey` / `repeatBanKey` / `bannedAction` in `rules.ts`, `listActions` filters the ban, engine updates history and countdown, view copies new fields.
- ai: `belief.ts` copies `countdown` and `recent` (bot respects the ban via `listActions`).
- client: `describe.ts` (countdown event, result text), `game-screen.ts` (red banned cell, toast, hint, countdown in player panels), `styles.css` (`.banned-target`), rules screen in `index.html` + `setup.ts`.
- tests: fixtures updated with the new fields.

Left:

- `npm install`, `npm run typecheck`, `npm test`; fix errors. Update the old "20 quiet moves rule" tests in `packages/core/test/rules.test.ts` and add tests for the repeat ban and countdown.
- Update `rules.md` (Winning section + new Rule of Three Repeats section) and `ARCHITECTURE.md` if needed.
- `npm run pages` to rebuild root `index.html`, commit and push to `main`, then clear this file.
