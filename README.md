# GUKART

A kart racer for phone and web. Race through Kano and Doha.

## Run

```bash
npm install
npm run dev
```

Open the Network address on your phone (same Wi-Fi).

## Check before you commit

```bash
npm test
```

Checks the code, builds the game, and plays it in a hidden browser. It fails if anything breaks.

## Where things are

- `src/main.js`: starts the game
- `src/game.js`: the game's shared state
- Screens: `home.js`, `garage-screen.js`, `modes.js`, `race-flow.js`, `results.js`, `worldmap.js`, `settings.js`
- Racing: `race.js`, `hud.js`, `input.js`, `camera.js`
- World: `track.js`, `world.js`, `doha.js`, `chapters.js`
- Helpers: `dom.js`, `util.js`
