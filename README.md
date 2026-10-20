# Goober Arcade

Goober Arcade is a lightweight, static game-picker site published with GitHub Pages. The picker is being rebuilt; for now, it shows looping placeholder cards with the supplied cat image. Snack Snake and Mini Tetris are clickable from the picker.

## Preview locally

Run a static web server from the repository root, for example:

```powershell
python -m http.server 8765
```

Then open <http://localhost:8765/>. The site follows the browser's light or dark color-scheme preference. Scroll horizontally, use the mouse wheel, drag the cards, or press the left and right arrow keys to move through the centered carousel.

## Project layout

- `index.html` contains the game picker and its carousel behavior.
- `games/flappy-rat.html` is a 100-second sewer escape game with automatic wing animation, vertical flight, speed controls, collectable boosts, and a replay-verified global leaderboard.
- `games/snack-snake.html` is the playable Snack Snake game. Move with WASD or the arrow keys; press Space or P to pause. Global leaderboard scores are replay-verified before they are saved.
- `games/tetris.html` is Mini Tetris in the Base Format layout. Move with the left/right/down arrows, rotate with Up, hard drop with Space, and pause with P or Escape. Global scores are replay-verified before they are saved.
- `assets/placeholder.png` is the temporary game-card image, marked with a diagonal red placeholder watermark.
- `archive/` preserves the previous site and games while the redesign is in progress. The old games are not linked from the current picker.
- `devtools/base-format.html` is the reusable responsive 1150 × 800 game-page template, aligned 15px from the top-left with its title and scrollable description alongside it. It includes the shared global top-five leaderboard component. Copy it when creating a game and set the game's leaderboard ID; add a server replay verifier before enabling submissions for a new game.
- `assets/leaderboard.js` loads the public top-five lists, prompts for a five-letter name when a finished score qualifies, and submits replay data for server-side validation.
- `supabase/migrations/` contains the leaderboard schema and write restrictions. `supabase/functions/arcade-scores/` starts seeded game sessions and independently replays Snake, Tetris, and Flappy Rat runs before accepting scores. Direct client score inserts are disabled.
- `.github/workflows/pages.yml` publishes the repository with GitHub Pages when changes are pushed to `main`.

When adding a game image or sprite, load it with the picker's `loadGameImage()` helper. If that asset is missing, corrupted, or fails to load from the repository, the helper uses `assets/placeholder.png` instead.

Snack Snake currently draws its snake and snacks directly, so it does not require sprite files. Optional custom art can be added later as transparent 32 × 32 PNGs: a snake head facing right, a straight body segment, a corner body segment, a tail pointing left, and a snack. The game can be updated to rotate these pieces to match movement.

## Links

- [Goober on GitHub](https://github.com/FinnishSwedRetard)
- [Goober Arcade repository](https://github.com/FinnishSwedRetard/Goober)
