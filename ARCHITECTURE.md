# Manducat architecture

## Principles

1. **Rules are separate from everything else.** The `@manducat/core` package is pure functions with no browser, no network and no randomness "out of thin air". The same code runs in the browser, on a server, in tests and in AI simulations.
2. **One truth, many views.** The real game state (`GameState`) knows everything: face-down cards, all mines. A player only sees a `PlayerView`, where face-down cards have no identity and enemy mines are hidden. The UI draws **only the view**, the AI thinks **only from the view**. So online play won't require UI changes, and cheating through developer tools is impossible.
3. **The UI talks to a game only through a session** (`GameSession`): it submits actions and receives updates. Today there is a local session; a network session with the same interface will join it later.
4. **Everything is serializable.** State, actions (`Action`) and events (`GameEvent`) are plain JSON data: they can be sent over the network, saved and replayed.
5. **Determinism.** The layout depends only on the seed, so games can be replayed, debugged and used as fixed levels.

## Structure

```
packages/
  core/      game rules
    types.ts         types: cards, actions, events, state, rule settings
    board.ts         6×6 board geometry
    pieces.ts        strength, points, "who beats whom"
    abilities.ts     characters and abilities (registry)
    rules.ts         legal actions, action validation, Rule of Three Repeats ban
    engine.ts        game creation, applying actions, final countdown, game end
    view.ts          player view and event filtering
    series.ts        decks and best-of-N series
    rules-config.ts  default rule numbers (39 points, cooldown 15, etc.)
  ai/        artificial intelligence
    knowledge.ts     what the bot knows beyond the view: peeked cards, likely mines
    belief.ts        the position as the bot sees it, fast simulations
    evaluate.ts      position evaluation and its weights
    search.ts        search (expectimax)
    bot.ts           the bot and difficulty levels
    arena.ts         bot vs bot matches
apps/
  client/    web client (Vite)
    src/session/     sessions: types.ts (interface), local.ts (AI and hot-seat, fixed layouts, scripted bot moves)
    src/flow/        match.ts: one game or a series, a session + game screen per game
                     tutorial.ts: the tutorial script → a Scenario (layout, bot script, guide)
    src/ui/          screens: game, setup, campaign map, deck, dialogs; guide.ts: the coach interface
    src/content/     texts and data: characters, event messages, campaign levels, the tutorial script
  client/test/       tests for client content (the tutorial script is legal and complete)
    src/meta/        settings and the player profile (unlocked characters, deck, campaign progress)
tools/
  sim.ts            bot tournament for balancing
  inline-build.mjs  single-file build (GitHub Pages, embedded viewers)
```

Dependencies go strictly one way: `client → ai → core`, `client → core`. The core knows nothing about the AI or the UI, the AI knows nothing about the UI. Browser types are not included in `core` and `ai`, so an accidental use of `window` or `document` won't compile.

## Data flow

```
 Human ──click──► GameScreen ──submit(Action)──► GameSession
                       ▲                              │
                       │                     isLegalAction → applyAction
                       │                              │  (GameState — the truth)
                       │                              ▼
                       └──── SessionUpdate ◄── getPlayerView + redactEvents
                         (view + events for this viewer)

 Bot: observe(view, events) → chooseAction(view) → the same submit
```

`GameScreen` queues updates and plays them one by one: highlight the opponent's move → new view → event animations → next move.

`Match` sits above: it creates a session and a game screen for every game of a series, records results in a `SeriesState` (core) and reports each game's end to the result screen.

## Key concepts

| Concept | Where | What it is |
|---|---|---|
| `GameState` | core | the whole truth about a game |
| `PlayerView` | core | what a particular player knows |
| `Action` | core | a move: flip, move, capture, place M, ability |
| `GameEvent` | core | what happened during a move (for animations, the log, AI knowledge) |
| `RulesConfig` | core | rule numbers (campaign levels can change them) |
| `Deck`, `SeriesState` | core | a deck of 3 characters; a best-of-N series score |
| `GameSession` | client | the "UI ↔ game" channel |
| `Match` | client | one game or a series of games |
| `Profile` | client | unlocked characters, deck, campaign progress |
| `Bot` | ai | a bot that remembers what it saw and picks a move |

## Decks and series

A deck is 3 characters in a fixed order; Jack may appear several times, others at most once. Game 1 of a series is played with slot #1. After each game the winner keeps their character and the loser moves on to the next slot. Bo3 needs 2 wins, Bo5 needs 3; a deck of 3 is enough for both, because a side that lost 3 games has lost even a Bo5. This logic is in `core/series.ts`, so a server will be able to use the same code.

## Tutorial

The first campaign node. A Jack vs Jack game against the Easy AI on a fixed layout (`client/src/content/tutorial.ts`). The first 7 player actions are scripted (flip → gold → move → capture → find M → place M → capture an 8 with M), and so are the AI's answers in between; after that the game is played out freely. Any finished game (won, lost or surrendered after the script) completes the tutorial and opens Level 1.

How it is wired:
- `Scenario` (`flow/match.ts`) = fixed `layout` + `botScript` + a `Guide` factory. `Match` passes the layout and bot script to `LocalSession` (the bot's k-th turn plays `botScript[k]` if legal, then it thinks on its own) and the guide to `GameScreen`.
- `Guide` (`ui/guide.ts`) returns a `Coach` for the current view: the message above the board, an optional blocking button, and the only `expect`ed action. `GameScreen` highlights the expected piece/target, dims the rest of the board, rejects other actions with a shake of the message and hides Surrender while the game is scripted. The step is derived from `view.moveNumber`, so the guide keeps no game state of its own.
- The same mechanism can drive future scripted levels or puzzle challenges.

## Campaign

A level is data (`client/src/content/campaign.ts`): the opponent's deck, AI difficulty, format (Bo1/Bo3/Bo5). Reward nodes give a random character the player doesn't have yet. Progress lives in the `Profile` (`client/src/meta/profile.ts`, localStorage for now). Settings has "Reset campaign" and "Unlock everything".

## How a character is added

1. `core/src/types.ts`: add the id to `CharacterId` (and to `AbilityId` if the ability is new).
2. `core/src/abilities.ts`: describe the ability (`targets` and `apply`) and add an entry to `CHARACTERS`.
3. `client/src/content/characters.ts`: name, icon, description, hint.
4. If the ability has special value for the AI (like scouting or mines), teach `ai/src/evaluate.ts` and `ai/src/search.ts`.
5. Tests in `core/test/rules.test.ts`, balance with `npm run sim`.

## How future features fit in

**Multiplayer.** An `apps/server` will appear: Node.js with WebSocket (the plan is Colyseus: rooms, reconnection, matchmaking). The server keeps the `GameState`, receives `Action`s, validates them with `isLegalAction`, applies `applyAction` and sends each player `getPlayerView` + `redactEvents`. The client gets an `OnlineSession` implementing the same `GameSession`. `GameScreen` can already show opponent moves coming from outside. Series run on the server with `core/series.ts`.

**Custom lobbies and matchmaking.** A server layer over rooms: a room code or link for friends, a rating-based queue for matchmaking. The core doesn't change.

**Rating.** Elo or Glicko computed on the server from `GameResult` (or series results). The client receives rating as profile data.

**Campaign.** Levels can also get their own `rules` and a fixed `layout` via `GameSetup`, plus special win conditions. Progress will move from localStorage to the server profile.

**Paid content.** What is available (characters, cosmetics) is a set of entitlements in the profile. Online, the server checks them when creating a game: an unavailable character can't be picked. In the apps purchases go through the App Store and Google Play.

**Achievements.** Listeners of events (`GameEvent`) and game results: "capture an 8 with a 1", "win by blowing up 3 mines", etc. Locally they can be counted in the client; online, on the server so they can't be faked.

**A stronger AI.**
- Move search in a Web Worker so the UI doesn't freeze.
- Information set search (ISMCTS) instead of a fixed depth.
- Tuning evaluation weights by self-play via `tools/sim.ts`.

The `Bot` interface stays the same.

**Mobile app.** The client builds into plain static files with relative paths. It can then become a PWA or be wrapped with Capacitor for the App Store and Google Play.

## Commands

```
npm install        install dependencies
npm run dev        client in development mode
npm run build      build the client into apps/client/dist
npm run pages      single-file build into the root index.html (GitHub Pages)
npm test           tests (rules, player view, series, bots)
npm run typecheck  type check all packages
npm run sim -- --games 20 --a hard:miner --b normal:jack    bot tournament
```
