# Browser Arcade

A small collection of no-install games, with a simple game picker and the owner's original character as its mascot. The online picker checks the latest game list whenever you open it; use the refresh button to check again. It follows your device's light/dark theme. The games themselves need no Python or add-ons.

## Games

- **Comet Courier** (`comet-courier.html`): Dodge space rocks, collect stardust, and try to beat your best score. Steer with the left/right arrow keys or **A**/**D**; drag on a touchscreen.
- **Mini Tetris** (`tetris.html`): Stack falling blocks and clear lines. Move with **←/→**, rotate with **↑**, soft drop with **↓**, hard drop with **Space**, and pause with **P**. Touch controls are included.
- **Snack Snake** (`snake.html`): Eat snacks, grow longer, and avoid the walls and your tail. Steer with the arrow keys or **W/A/S/D**; press **Space** to pause. Touch controls are included.
- **Parking Lot Drift** (`drift.html`): Slide a little red car around the parking lot and build a drift combo in a 90-second run. Use **W/A/S/D** or the arrow keys; **Space** is the handbrake and **P** pauses. Touch controls are included.

## Online arcade

GitHub Pages publishes the site after changes are pushed to `main`. To enable it, open the repository's **Settings → Pages** and set the build and deployment source to **GitHub Actions**. The site will then be available at `https://finnishswedretard.github.io/Goober/`. Open that link with an internet connection to get the current game list and game files. A new push appears once the Pages deployment finishes; reload the site to get the update. The refresh button checks the latest deployed game list again.

## Add your own HTML game

1. Add the game's `.html` file to the repository. Keep any images or other assets it uses in the repository too, and use relative paths.
2. Add a comma after the last entry in `games.js`, then add a new object inside `window.ARCADE_GAMES` before the closing `]`. Give it a unique lowercase `id` using letters, numbers, and hyphens, plus a `title`, `description`, relative `.html` `href`, and a short emoji `icon`.
3. Push or merge the changes to `main`. Once Pages finishes deploying, the game appears in the picker automatically.

For example:

```js
{
  id: "my-new-game",
  title: "My New Game",
  description: "A short description of the game.",
  href: "my-new-game.html",
  icon: "🎮"
},
```

## Offline and USB

Download the repository with **Code → Download ZIP** and extract it, or copy the files together onto a USB stick. Open a game's HTML file directly to play offline. Keep `games.js` and the `assets` folder alongside the HTML files if using the picker locally. The online picker needs an internet connection to refresh its game list; a USB copy cannot silently update or replace its own files. Windows does not automatically launch files from USB drives.

The car sprites are from [Desktop-Drift](https://github.com/FinnishSwedRetard/Desktop-Drift/tree/main/Car%20Game/Assets/Car) and are bundled locally so Drift works offline.

If a managed device blocks local HTML files, use a school-approved way to play rather than bypassing its protections.
