# Fun Run — Alien Escape

A dependency-free endless platform runner built with HTML, CSS, JavaScript, and Canvas. Open `index.html` in a browser to play. No build step or external assets are required.

## Controls

- Left/right arrows: adjust your position while running automatically.
- Up arrow: jump (release and press again for another jump).
- Space: shoot; hold for continuous fire.
- P or Escape: pause/resume. Leaving the window also pauses.
- Touch controls are available on phones and tablets; landscape gives more room.

Survive the accelerating course, jump over spikes and gaps, and cross bridges before their planks fall. Alien or bird contact ends your run. Survival earns 10 points per second; shooting an alien earns 100 bonus points and shooting a bird earns 150. Your best score is saved in this browser when local storage is available.

Birds begin appearing after eight seconds, approaching from above before diving and climbing away. An orange ground marker shows the locked dive target: move left or right to dodge, or jump and shoot as the bird descends. Early birds appear only over clear solid ground; after 35 seconds they can also attack over harder terrain. Their frequency increases gradually, with only one bird active at a time. Existing keyboard and touch controls work unchanged.

## GitHub Pages

Commit `index.html`, `game.css`, and `game.js` to your repository. In the repository's Pages settings, configure branch publishing from the folder containing `index.html` (typically the root of `main`). All asset paths are relative, so the game works under a repository subpath.
