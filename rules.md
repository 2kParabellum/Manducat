# Manducat — Game Rules

Rules of a single 1v1 game. Numbers below are the defaults from `packages/core/src/rules-config.ts`; campaign levels may override them.

## Setup

- Board: 6×6 (columns A–F, rows 1–6). Two players: **Blue** and **Red**. Blue moves first.
- Each player's army is 15 cards: `1`×4, `2`×3, `3`×3, `5`×2, `8`×2, `M`×1.
- Plus 6 neutral **G** cards. Total 36 cards — the board is completely full.
- All cards are shuffled and dealt **face down**, one per cell. Nobody knows what is where.
- Each player picks a **character** (see below). Characters may have one ability.

## Turn

On your turn you do exactly one action:

1. **Flip** any face-down card (yours, the opponent's or a G — you don't know which until it's flipped).
2. **Move** one of your face-up cards one cell orthogonally (up/down/left/right) into an empty cell.
3. **Attack** with one of your face-up cards (see Captures).
4. **Place M** from your hand on any empty cell.
5. **Use your character's ability** (if it is ready).

## Flipping

- A unit card (`1`–`8`) stays where it is, face up, and belongs to its owner — even if the opponent flipped it.
- **G**: removed from the board, the player who flipped it gets **+3 points**.
- **M**: removed from the board and goes to its **owner's hand** (no matter who flipped it). The owner can later place it on any empty cell as a turn.

## Captures

- Attacks go like a rook: along a row or column, any distance. The attacker hits the **first card** on that line.
- The target must be a **face-up enemy** card that the attacker can beat. Face-down cards block the line and cannot be attacked.
- The attacker moves into the target's cell; the victim is removed. The attacker scores the victim's **value** in points (curses reduce it, see Witch).
- Who beats whom:
  - A card beats any card of **equal or lower** strength.
  - **M** beats everything, and **everything beats M**. Capturing M gives **0 points**.
  - A **1 beats an 8** (even a cursed 8).

## Winning

- **Score**: the first player to reach **39 points** wins. If both reach it on the same turn, the higher score wins; on a tie the player who made the move wins.
- **Quiet moves and the final countdown**: a move without a flip or a capture (an explosion on a mine also counts as "loud") is quiet. Any loud move resets both players' quiet counters. When a player makes their **15th quiet move in a row**, a warning appears and the **final countdown** starts: each player makes **10 more moves** (the opponent moves first, so the player who triggered it moves last). Flips and captures do **not** stop the countdown. When it ends, more points wins; on a tie the player who made the last move (the one who triggered the countdown) **loses**. Reaching 39 points during the countdown still wins immediately.
- **No moves**: a player who has no legal action on their turn loses.
- **Surrender**: a player may resign at any time.

## Rule of Three Repeats

- If a player's last 6 own actions are **A, B, A, B, A, B** (only moves and attacks count; flips, placing M and abilities break the pattern), action **A is banned** on their next turn.
- The banned target cell is shown in red; trying it shows a warning.
- The ban is lifted if it is the player's only legal action.

## Characters and abilities

- Using an ability takes your whole turn and counts as a quiet move.
- An ability is ready at the start of the game. After use it can be used again only **15 own turns later**.
- Timed effects (poison, shield, stone) last **5 opponent turns**; Runner's haste lasts **5 own turns**; Witch's curse lasts **5 turns of the cursed card's owner**.

| Character | Ability |
|---|---|
| **Jack** | No ability — the classic game. |
| **Scout** | Secretly peeks at a 2×2 area: sees the face-down cards there and mines on empty cells. The opponent only learns that Scout was used, not where. (In the UI the peek lasts 3 seconds — then you must remember it.) |
| **Poisoner** | Poisons one of **your own** face-up cards. Whoever captures it dies right after the capture: the attacker still scores the victim, and the Poisoner scores the attacker's full value. A shield does not save the attacker. |
| **Witch** | Curses an **enemy** face-up card: −1 to its strength and points for **5 turns of the card's owner**, then the curse is gone. Capturing does **not** lift it. A cursed card can't be cursed again. Not on M, not on 1s. A 1 still beats a cursed 8. |
| **Miner** | Secretly mines an empty cell (only the Miner sees it). Any card that enters the cell (move or placing M) explodes and is removed; the mine is used up. If it was an enemy mine, the mine's owner scores the card's value. If your own card blows up on your own mine, you **lose** the card's value in points (not below 0). Shields don't help. |
| **Defender** | Shields one of **your own** face-up cards. The shield reflects one attack: the attacker stays in place, nothing is captured, and the shield breaks. Poison and mines go through the shield. |
| **Swapper** | Swaps two orthogonally adjacent cards: yours, the opponent's or face-down ones (face-down cards are not revealed). Effects (curse, poison, shield, haste) travel with the cards. Stone cards can't be swapped. Both cells are occupied, so mines never trigger. |
| **Runner** | Hastes one of **your own** face-up cards for **5 own turns**. While hasted, the card may move to any empty cell reachable along a free orthogonal path (any distance). Mines on the way don't matter — only a mine in the cell where it stops. A run can't end with an attack. **Any** move or attack by the hasted card uses the haste up. |
| **Necromancer** | Summons a **3** of your own on any empty cell. It stays until it is captured and is worth 3 points like any 3. If the cell has a mine, the summoned card blows up (like placing M). Summoned cards are marked 💀 and are not part of the army (they don't count in the graveyard). |
| **Avenger** | Strikes the opponent directly: they lose **2 points** (not below 0). Can't be used while the Avenger leads on points (works on a tie) or when the opponent has 0 points. No target. |
| **Gargoyle** | Turns one of **your own** face-up cards to **stone** for 5 opponent turns: it can't move or attack, and it can't be captured (it still blocks line attacks). Stone cards can't be swapped. |

## Series (Bo3 / Bo5)

- Each player builds a **deck of 3 characters** in a fixed order. Jack may appear any number of times; every other character at most once.
- Game 1 is played with each player's first slot. After each game the **winner keeps** their character and the **loser moves to the next slot** (staying on the last one if already there).
- The first player to win the majority (2 of 3, 3 of 5) wins the series. Colors (who is Blue) may be assigned per game.
