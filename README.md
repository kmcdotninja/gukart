# Gukart

A kart racer for phones, starring Buddy (the orange robot from DeFleet). Each chapter is an island set in a Nigerian city.
Chapter 1 is Kano and is playable. Lagos, Abuja and Calabar are on the chapter screen as "coming soon".

## Run it

```bash
npm install
npm run dev
```

Vite prints two addresses. Open the `Network` one (for example `http://192.168.1.58:5173`) on your phone. The phone has to be on the same Wi-Fi.
To get a full-screen app icon, use "Add to Home Screen" (Safari on iPhone, or the Chrome menu on Android).

`npm run build` writes a static site to `dist/`, ready for any static host (Vercel, Netlify, GitHub Pages).

## Controls

| | Phone | Keyboard |
|---|---|---|
| Steer | drag left or right anywhere | ← → or A D |
| Drift | hold **Drift** through a turn, let go to boost | hold Space |
| Item | tap **Item** or the item circle | E |
| Brake | | ↓ |
| Pause | pause button | P or Esc |

The kart accelerates on its own. Drift charges a mini-turbo that goes blue, then orange, then purple; the longer you hold it, the bigger the boost.

## Kano: what's on the track

- **Kofar Nassarawa**: the start gate, with the Arewa knot on its sign
- **Ganuwa**: the old earthen city walls, with zanko pinnacles on the towers
- **Kofar Mata**: the second gate, and the indigo dye pits beside it with adire cloth drying on lines
- **Kurmi market**: stalls, umbrellas and bunting across the road
- **Dala Hill**: inside the loop
- **Gidan Rumfa**: the Emir's palace
- Doum palms, neem and baobab trees. Lagos, Zuma Rock and Calabar's hills are on the horizon.

Items: **Yaji** (suya pepper) is a speed boost. A **Kwallo** rolls ahead and hits the kart in front of you. A **Calabash** gets dropped behind you as a trap.
Coins raise your top speed a little, up to 10.

## Code map

| File | What it does |
|---|---|
| `src/main.js` | renderer, camera, controls, menus, HUD, game loop |
| `src/race.js` | kart physics, drifting, rival AI, items, coins, boost pads, laps |
| `src/buddy.js` | Buddy and the kart model, his fur shader and his visor faces, the racer list |
| `src/world.js` | the Kano island and everything on it |
| `src/track.js` | the track spline, road and curbs, position lookup |
| `src/textures.js` | every texture, drawn on canvas (mud walls, adire, signs) |
| `src/chapters.js` | the chapter list, each chapter's track shape and card art |
| `src/audio.js` | engine and sound effects, synthesised |

To add a chapter, give it a `track` (a list of x, z control points) and `playable: true` in `chapters.js`, then write its scenery the way `buildWorld` does for Kano.
