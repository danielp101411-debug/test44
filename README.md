# Dusk Arena

A wave-based first-person shooter that runs in your browser. The sun is going down, drones are coming over the walls, and you have to hold the yard for as long as you can.

Built with HTML, CSS, JavaScript and [three.js](https://threejs.org/). There's nothing to install to play it.

## How to play

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Click (hold) | Shoot |
| Space | Jump (you can climb onto crates) |
| Shift | Sprint |
| R | Reload |
| Esc | Pause |

On a phone, drag with your left thumb to move and your right thumb to look, and use the on-screen buttons to fire and jump.

**Enemies**

- **Seekers** (teal) rush at you.
- **Spitters** (pink) keep their distance and shoot orbs. They glow right before they fire. They show up from wave 2.
- **Brutes** (violet) are slow and tough. They show up from wave 3.

Shooting a drone's glowing eye does double damage. Clearing a wave gives you some health back, and defeated drones sometimes drop health crosses.

## Put it online

### GitHub Pages

1. In your repository, open the **Settings** tab, then click **Pages** in the left sidebar.
2. Under **Build and deployment**, set Source to **Deploy from a branch**, choose **main** and **/ (root)**, and click **Save**.
3. Wait a minute or two, then refresh. Your link appears at the top: `https://YOUR-USERNAME.github.io/REPO-NAME/`

The `index.html` at the top of the repo sends visitors straight to the game in `dist/`.

### Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). The included `vercel.json` tells Vercel to build the game and serve the `dist/` folder, so you don't have to change any settings.

## What's in this project

```
dusk-arena/
├── dist/
│   └── index.html      ← the finished game, all in one file (this is what people play)
├── src/
│   ├── index.html      ← the page layout
│   ├── style.css       ← the look of the menus and HUD
│   ├── logic.js        ← game rules with no graphics (collisions, waves, map) — the part we test
│   └── game.js         ← graphics, controls, sound and the game loop
├── scripts/
│   └── build.js        ← joins the src/ files into dist/index.html
├── tests/
│   ├── logic.test.js   ← checks the game rules
│   └── build.test.js   ← checks that dist/ was built correctly
├── .github/workflows/
│   └── test.yml        ← runs the tests on GitHub every time you push
├── index.html          ← redirects to dist/ for GitHub Pages
├── vercel.json         ← settings for Vercel
└── package.json        ← project name and the build/test commands
```

**Why is there a `src` and a `dist`?** `src/` is where you write and edit code, split into files so it's easier to read. `dist/` (short for "distribution") is the finished product: everything joined into one file that's ready to play. This is how most real web projects are set up.

## Tests

The tests check things like:

- Players get pushed out of walls correctly.
- You can stand on crates.
- Each wave has the right enemies.
- The map never has overlapping obstacles.
- The `dist/` file matches the source code.

**On GitHub (no setup):** every time you upload a change, GitHub runs the tests automatically. Click the **Actions** tab to see the results. A green tick means everything passed and a red cross means something broke.

**On your own computer (optional):** install [Node.js](https://nodejs.org/) version 18 or newer, then run these from inside the project folder:

```
npm test          # run the tests
npm run build     # rebuild dist/index.html after editing src/
```

No other packages are needed, because the tests use Node's built-in test runner.

## Making changes

1. Edit files in `src/`. For example, try changing the enemy speeds near the top of the enemies section in `src/game.js`, or the wave sizes in `src/logic.js`.
2. Run `npm run build` to update `dist/index.html`.
3. Upload the changed files and check the **Actions** tab.

If you edit `src/` but forget to rebuild, the test called "dist/index.html is up to date with src/" fails to remind you.

## Ideas to try

- Add a second weapon, like a shotgun that fires several rays at once.
- Add a new enemy type, including a test for when it appears in `waveComposition`.
- Add a boss every 5 waves.
- Change the colours to make the arena feel like night, snow or the desert.

## License

MIT — see [LICENSE](LICENSE).
