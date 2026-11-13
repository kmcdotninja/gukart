// The QUICK RACE pictures: a real shot from the game for each city, each circuit (day and night) and each race mode,
// saved as small JPEGs in public/places/ and public/modes/ (the cards on the QUICK RACE screen, src/modes.js). Run it
// once after `npm run build` (it plays dist/), and again when a circuit changes enough to need a new picture:
//   node tools/place-shots.mjs              (everything)
//   node tools/place-shots.mjs --all        (also every candidate shot of every circuit, in recordings/place-candidates/,
//                                            to choose from: the names are what PICK below takes)
//   node tools/place-shots.mjs --only singapore   (one city's pictures; the others and the mode pictures are left alone)
// How: each circuit boots in #capture mode (city, circuit and day/night set in localStorage first, main.js honours them),
// the game's own snapshots (src/snapshots.js: the start, the landmarks, the pack on the grid, the underpass, the cruise)
// are taken from the live 3D scene with no menu over it, and the chosen one is scaled to 800x600 and saved.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const all = process.argv.includes('--all'),
  only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const W = 800,
  H = 600;
// which shot pictures each circuit (a landmark's name, or start / pack / tunnel / cruise: see --all)
const PICK = {
  'kano.old': 'start', // the start arch, the Emir's palace behind
  'kano.dala': 'start', // the start arch from above, the city and the sea behind
  'kano.metro': 'THE INTERCHANGE', // the clock towers and the steel X over the flyover
  'doha.msheireb': 'start', // the start arch down a Msheireb street
  'doha.pearl': 'THE AQUARIUM TUNNEL', // the glass tube under the marina mouth, fish all round
  'doha.lusail': 'LUSAIL STADIUM',
  'singapore.marina': 'THE SKYLINE', // from up on the viaduct, across the bay to Marina Bay Sands
  'singapore.gardens': 'THE FLYOVER', // over the Supertree crowns
  'singapore.river': 'BOAT QUAY',
  'singapore.changi': 'JEWEL',
  'kaduna.abu': 'COMPUTER SCIENCE', // down the corridor between the labs
  'kaduna.city': 'THE SQUARE GATE', // the gate of Murtala Muhammed Square, the bridge through it
  'kaduna.zazzau': "THE EMIR'S PALACE", // the horsemen on the square
};
// each city's own card: its best-known sight [circuit, shot]
const CITY_PIC = {
  kano: ['kano.old', 'KOFAR NASSARAWA'],
  doha: ['doha.msheireb', 'THE CORNICHE'],
  singapore: ['singapore.marina', 'THE SKYLINE'],
  kaduna: ['kaduna.city', 'THE SQUARE GATE'],
};
// one fixed picture per mode, whatever circuit is built [circuit, shot]
const MODE_PIC = {
  race: ['kano.old', 'pack'], // the crew bunched up on the grid
  'time-trial': ['kano.old', 'tunnel'], // an empty lit bore of the underpass: just you and the clock
  'free-drive': ['doha.msheireb', 'SOUQ WAQIF'], // karts cruising down a Doha street, the towers ahead
};

const server = await preview({ preview: { port: 4213, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

// boot one circuit, day or night, and hand back its shots (scaled, as JPEG data)
async function shots(city, circ, night) {
  const page = await browser.newPage({ viewport: { width: W * 1.25, height: H * 1.25 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('  page error:', e.message));
  await page.addInitScript(
    ([city, circ, night]) => {
      const set = (k, v) => localStorage.setItem('gukart.' + k, JSON.stringify(v));
      localStorage.clear();
      set('city', city);
      set('circuit.' + city, circ);
      set('night', night);
      set('coach', { steer: true, brake: true, drift: true, fire: true });
    },
    [city, circ, night],
  );
  await page.goto('http://127.0.0.1:4213/#capture');
  await page.waitForFunction(() => window.gukart?.ready, null, { timeout: 300000, polling: 200 });
  const out = await page.evaluate(
    async ([W, H]) => {
      const g = window.gukart.game,
        m = g.mapShot,
        src = { start: g.kanoSnap, pack: m.pack, tunnel: m.tunnel, cruise: m.cruise };
      for (const p of m.places) if (p.img && !(p.name in src)) src[p.name] = p.img;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const x = c.getContext('2d');
      const res = {};
      for (const [k, url] of Object.entries(src)) {
        if (!url) continue;
        const im = new Image();
        im.src = url;
        await im.decode();
        const s = Math.max(W / im.width, H / im.height);
        x.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
        res[k] = c.toDataURL('image/jpeg', 0.78);
      }
      return res;
    },
    [W, H],
  );
  await page.close();
  return out;
}
const save = (path, url) => {
  const b = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(path, b);
  console.log(`  ${path} (${Math.round(b.length / 1024)} KB)`);
};

mkdirSync('public/places', { recursive: true });
mkdirSync('public/modes', { recursive: true });
if (all) mkdirSync('recordings/place-candidates', { recursive: true });
const day = {};
for (const key of Object.keys(PICK)) {
  const [city, circ] = key.split('.');
  if (only && city !== only && key !== only) continue;
  for (const night of [false, true]) {
    console.log(`${city} · ${circ} · ${night ? 'night' : 'day'}`);
    const s = await shots(city, circ, night);
    if (!night) day[key] = s;
    if (all)
      for (const [k, url] of Object.entries(s))
        save(
          `recordings/place-candidates/${key}.${night ? 'night' : 'day'}.${k.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`,
          url,
        );
    save(`public/places/${city}-${circ}${night ? '-night' : ''}.jpg`, s[PICK[key]] || s.start);
    if (CITY_PIC[city][0] === key)
      save(`public/places/${city}${night ? '-night' : ''}.jpg`, s[CITY_PIC[city][1]] || s.start);
  }
}
if (!only) for (const [name, [key, shot]] of Object.entries(MODE_PIC)) save(`public/modes/${name}.jpg`, day[key][shot]);

await browser.close();
await server.close();
