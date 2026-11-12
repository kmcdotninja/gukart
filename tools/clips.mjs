// Feature clips for social posts: one short clip per feature, each with a caption card at the bottom (the game's own
// slanted orange button style) naming it. Same frame-by-frame capture as tools/record.mjs (a steady 60 fps, the game's
// sound rendered in step), at a laptop's screen size (1920x1200). Run `npm run build` first.
//   node tools/clips.mjs                      (every clip, into recordings/clips/)
//   node tools/clips.mjs fire podium          (just those)
//   node tools/clips.mjs --size 864x1080 --scale 1.25   (4:5, a phone feed's shape, instead)
// A clip can run the race on unrecorded first (preroll) to reach the part worth showing, then records. Needs ffmpeg.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const [W, H] = arg('size', '1440x900').split('x').map(Number); // a laptop screen (MacBook proportions)
const scale = +arg('scale', 4 / 3); // 1920x1200
const FPS = 60,
  DT = 1000 / FPS,
  RATE = 48000;
const outDir = 'recordings/clips';
const coach = { steer: true, brake: true, drift: true, fire: true };
const tour = (i, res = []) => ({
  id: 'tour1',
  races: [
    ['kano', 'old'],
    ['doha', 'msheireb'],
    ['kano', 'dala'],
    ['doha', 'pearl'],
    ['doha', 'lusail'],
  ],
  i,
  res,
  retries: 2,
});
// race straight from the boot: the menu hidden, everyone on autopilot (for clips that start mid-race)
const RACE = `(() => { const g = window.gukart.game, r = g.race; document.querySelectorAll('section').forEach(s => (s.hidden = true));
  document.querySelector('#hud').hidden = false; r.setMode('gp'); r.reset(); r.all.forEach(k => (k.ai = true)); g.state = 'race'; })()`;

// each clip: what's saved before it boots, what to do first unrecorded (preroll: seconds, and a setup script), then
// [seconds, action] while recording (a selector is clicked; anything else is run), its length, and its caption
const CLIPS = {
  'world-tour': {
    store: { city: 'kano', 'circuit.kano': 'old', coach, night: false },
    seconds: 8,
    at: [
      [1.0, '#goBtn'],
      [3.6, '#trGo'],
    ], // (a new tour shows its route first)
    cap: ['WORLD TOUR', '5 races · Kano to Doha · win a trophy'],
  },
  'quick-race': {
    store: { city: 'kano', 'circuit.kano': 'old', coach, night: false },
    seconds: 8,
    at: [
      [0.8, '#quickBtn'],
      [2.2, '#mCards .mcard[data-mode=gp]'],
      [3.3, '#mCards .mcard.on'],
      [4.6, '#qNext'],
      [5.4, '#qCirc [data-circ=dala], #qCirc .q-card:nth-child(2)'],
      [6.3, '#qNext'],
      [7.2, '#qTime .q-card:nth-child(2)'],
    ],
    cap: ['QUICK RACE', 'Pick a city, a circuit, day or night'],
  },
  'dala-hill': {
    store: { city: 'kano', 'circuit.kano': 'dala', coach, night: false },
    preroll: 60,
    until: 'window.gukart.game.race.player.s > 820 && window.gukart.game.race.player.s < 1400', // up on the spiral
    setup: RACE,
    seconds: 7,
    // a tracking shot from outside the spiral: you on the bridge, the hill behind you
    cam: `(() => { const { game: g, cam, renderer, scene } = window.gukart, kp = g.race.player.m.root.position, H = g.world.hill;
      const dx = kp.x - H.x, dz = kp.z - H.z, d = Math.hypot(dx, dz);
      cam.position.set(kp.x + (dx / d) * 15, kp.y + 4.5, kp.z + (dz / d) * 15);
      cam.up.set(0, 1, 0);
      cam.lookAt(kp.x - (dx / d) * 16, kp.y + 1.5, kp.z - (dz / d) * 16);
      renderer.render(scene, cam); })()`,
    cap: ['NEW CIRCUIT · DALA HILL', 'A spiral bridge round the hill'],
  },
  fire: {
    store: { city: 'doha', 'circuit.doha': 'msheireb', coach, night: false },
    preroll: 5,
    setup: RACE,
    seconds: 7,
    at: [
      [0.4, 'window.gukart.game.race.player.heat = 0.55; window.gukart.game.race.ev.heat(0.55)'],
      [1.2, 'window.gukart.game.race.player.heat = 0.85; window.gukart.game.race.ev.heat(0.85)'],
      [2, 'window.gukart.game.race.ignite(window.gukart.game.race.player)'],
    ],
    cap: ['FIRE MODE', 'Chain moves, catch fire, double points'],
  },
  cockpit: {
    store: { city: 'kano', 'circuit.kano': 'old', coach, night: false, view: 'fp' },
    preroll: 6,
    setup: RACE,
    seconds: 7,
    cap: ['COCKPIT VIEW', 'Race from the driver’s seat'],
  },
  podium: {
    store: { city: 'kano', 'circuit.kano': 'old', coach, night: false, tour: tour(0) },
    seconds: 8,
    // a tour race, started from home and run on until it's nearly over: you cross the line first
    preroll: 9,
    setup: `(() => { document.querySelector('#goBtn').click(); document.querySelector('#trGo')?.click(); })()`,
    setup2: `(() => { const g = window.gukart.game, k = g.race.player; k.ai = true; k.lap = 2; k.s = g.track.len - 40;
      for (const o of g.race.all) if (o !== k) { o.lap = 2; o.s = Math.max(0, g.track.len - 140 - o.n * 12); } })()`,
    cap: ['PODIUM', 'Win it, and celebrate on the steps'],
  },
  chests: {
    store: {
      city: 'kano',
      'circuit.kano': 'old',
      coach,
      night: false,
      earned: 600,
      wallet: 600,
      chests: 0,
      upgrades: ['hot', 'turbo', 'grip', 'armour'],
    },
    seconds: 7,
    at: [[2.2, '#chestGo']],
    cap: ['CHESTS & UPGRADES', 'Earn coins, crack open upgrades'],
  },
  night: {
    store: { city: 'doha', 'circuit.doha': 'lusail', coach, night: true },
    preroll: 8,
    setup: RACE,
    seconds: 7,
    cap: ['NIGHT RACING', 'Doha under the lights'],
  },
  final: {
    store: {
      city: 'doha',
      'circuit.doha': 'lusail',
      coach,
      night: true,
      tour: tour(4, [
        ['buddy', 'zaki', 'gimbiya', 'kibiya', 'tauraro', 'dodo'],
        ['zaki', 'buddy', 'gimbiya', 'kibiya', 'tauraro', 'dodo'],
        ['buddy', 'gimbiya', 'zaki', 'kibiya', 'tauraro', 'dodo'],
        ['gimbiya', 'buddy', 'zaki', 'kibiya', 'dodo', 'tauraro'],
      ]),
    },
    seconds: 12,
    at: [[0.8, '#goBtn']],
    cap: ['THE FINAL', 'Lusail, under the lights'],
  },
  airport: {
    store: { city: 'doha', 'circuit.doha': 'msheireb', coach, night: false },
    preroll: 60,
    until: (() => {
      const f = "window.gukart.game.track.feats.find(f => f.type === 'airport')";
      return `window.gukart.game.race.player.s > ${f}.s - 70 && window.gukart.game.race.player.s < ${f}.s`; // just before the hall
    })(),
    setup: RACE,
    seconds: 7,
    cap: ['HAMAD INTERNATIONAL', 'Race through the departures hall'],
  },
};
const want = process.argv.slice(2).filter(a => !a.startsWith('--') && CLIPS[a]);
const list = want.length ? want : Object.keys(CLIPS);

// the caption card: the game's slanted orange button, a white name, a small line under it; it slides up as the clip opens
const CAPTION_CSS = `
#clipCap { position: fixed; left: 50%; bottom: 34px; z-index: 99999; translate: -50% 0; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 4px; animation: capIn .5s cubic-bezier(.2,1.3,.4,1) both .25s; }
#clipCap b { display: block; padding: 10px 30px 8px; background: linear-gradient(100deg, #ff6a00, #ff8a2a);
  clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%); box-shadow: inset 0 -5px 0 rgba(0,0,0,.18);
  font: italic 900 ${W > 1000 ? 46 : 38}px/1 'Barlow Condensed', 'Arial Narrow', sans-serif; letter-spacing: .02em; color: #fff; white-space: nowrap; }
#clipCap span { display: block; padding: 6px 16px; background: rgba(11,19,48,.86); clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  font: italic 800 ${W > 1000 ? 23 : 19}px/1 'Barlow Condensed', 'Arial Narrow', sans-serif; letter-spacing: .04em; color: #fff; white-space: nowrap; }
@keyframes capIn { from { translate: -50% 120px; opacity: 0; } }`;

const server = await preview({ preview: { port: 4198, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
mkdirSync(outDir, { recursive: true });
for (const name of list) {
  const C = CLIPS[name],
    frames = Math.round(C.seconds * FPS);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('pageerror', e => console.log(`  ${name}: page error:`, e.message));
  await page.addInitScript(store => {
    localStorage.clear();
    for (const [k, v] of Object.entries(store)) localStorage.setItem('gukart.' + k, JSON.stringify(v));
  }, C.store);
  // the sound: an offline context exactly as long as the clip, rendered a frame at a time (as tools/record.mjs does)
  await page.addInitScript(
    ([length, sampleRate]) => {
      const Off = window.OfflineAudioContext;
      window.AudioContext = window.webkitAudioContext = function () {
        const c = new Off({ numberOfChannels: 2, length, sampleRate });
        c.__resume = c.resume.bind(c);
        c.__suspend = c.suspend.bind(c);
        c.resume = () => Promise.resolve();
        c.suspend = () => Promise.resolve();
        c.__n = 0;
        window.__actx = c;
        return c;
      };
      window.__audioStep = async samples => {
        const c = window.__actx;
        if (!c) return;
        c.__n += samples;
        if (c.__n >= c.length) {
          if (!c.__done) c.__done = c.startRendering();
          else c.__resume();
          c.__buf = await c.__done;
          return;
        }
        const reached = c.__suspend(c.__n / c.sampleRate);
        if (!c.__done) c.__done = c.startRendering();
        else c.__resume();
        await reached;
      };
      window.__wav = () => {
        const b = window.__actx.__buf,
          n = b.length,
          ch = [b.getChannelData(0), b.getChannelData(1)];
        const buf = new ArrayBuffer(44 + n * 4),
          v = new DataView(buf);
        const str = (o, s) => [...s].forEach((x, i) => v.setUint8(o + i, x.charCodeAt(0)));
        str(0, 'RIFF');
        v.setUint32(4, 36 + n * 4, true);
        str(8, 'WAVEfmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 2, true);
        v.setUint32(24, b.sampleRate, true);
        v.setUint32(28, b.sampleRate * 4, true);
        v.setUint16(32, 4, true);
        v.setUint16(34, 16, true);
        str(36, 'data');
        v.setUint32(40, n * 4, true);
        for (let i = 0, o = 44; i < n; i++)
          for (const d of ch) {
            const s = Math.max(-1, Math.min(1, d[i]));
            v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            o += 2;
          }
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
    },
    [frames * (RATE / FPS), RATE],
  );
  await page.clock.install();
  await page.goto('http://127.0.0.1:4198/#capture');
  await page.waitForFunction(() => window.gukart?.ready, null, { timeout: 300000, polling: 200 });
  await page.clock.pauseAt(Date.now() + 1000);
  await page.evaluate(() => {
    const seen = new WeakMap();
    window.__step = dt => {
      for (const a of document.getAnimations()) {
        const t = (seen.has(a) ? seen.get(a) : 0) + dt;
        seen.set(a, t);
        const end = a.effect?.getComputedTiming().endTime;
        if (Number.isFinite(end) && t >= end) a.finish();
        else {
          a.pause();
          a.currentTime = t;
        }
      }
      window.gukart.frame(performance.now());
    };
  });
  const step = async () => {
    await page.clock.runFor(DT);
    await page.evaluate(dt => window.__step(dt), DT);
  };
  for (let i = 0; i < 20; i++) await step();
  // unrecorded: the setup, then the race run on to the part worth showing (no sound yet: it starts with the clip)
  if (C.setup) await page.evaluate(C.setup);
  if (C.preroll) {
    const n = Math.round(C.preroll * FPS);
    for (let i = 0; i < n; i++) {
      await step();
      if (i === 60) await page.evaluate(() => window.gukart.game.race && (window.gukart.game.race.player.ai = true));
      // (a clip can stop the run-up as soon as you've reached its place)
      if (C.until && i % 6 === 0 && (await page.evaluate(C.until))) break;
    }
  }
  if (C.setup2) {
    await page.evaluate(C.setup2);
    for (let i = 0; i < 4; i++) await step();
  }
  await page.evaluate(() => window.gukart.Sound.init());
  await page.addStyleTag({ content: CAPTION_CSS });
  await page.evaluate(([t, s]) => {
    const d = document.createElement('div');
    d.id = 'clipCap';
    d.innerHTML = `<b>${t}</b><span>${s}</span>`;
    document.body.append(d);
  }, C.cap);
  await page.mouse.move(W - 1, H - 1);
  const out = `${outDir}/${String(Object.keys(CLIPS).indexOf(name) + 1).padStart(2, '0')}-${name}.mp4`, // (its place in the set)
    vidOut = out.replace(/\.mp4$/, '.video.mp4'),
    wavOut = out.replace(/\.mp4$/, '.wav');
  const ff = spawn(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'].concat([
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '17',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      vidOut,
    ]),
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const ffDone = new Promise(r => ff.on('close', r));
  const cdp = await page.context().newCDPSession(page);
  const acts = (C.at || []).map(([t, a]) => [Math.round(t * FPS), a]);
  for (let f = 0; f < frames; f++) {
    for (const [at, a] of acts)
      if (at === f) {
        if (/^[#.[]/.test(a))
          await page.evaluate(sel => {
            for (const s of sel.split(',')) {
              const el = document.querySelector(s.trim());
              if (el) return el.click();
            }
          }, a);
        else await page.evaluate(a);
      }
    await step();
    if (C.cam) await page.evaluate(C.cam); // (a clip's own camera, drawn over the game's)
    await page.evaluate(n => window.__audioStep(n), RATE / FPS);
    if (f === 30) await page.evaluate(() => window.gukart.game.race && (window.gukart.game.race.player.ai = true));
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      clip: { x: 0, y: 0, width: W, height: H, scale },
    });
    if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  let code = await ffDone;
  if (!code) {
    writeFileSync(wavOut, Buffer.from(await page.evaluate(() => window.__wav()), 'base64'));
    code = await new Promise(r =>
      spawn(
        'ffmpeg',
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          vidOut,
          '-i',
          wavOut,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '224k',
          '-shortest',
          '-movflags',
          '+faststart',
          out,
        ],
        { stdio: 'inherit' },
      ).on('close', r),
    );
    if (!code) [vidOut, wavOut].forEach(f => rmSync(f));
  }
  await page.close();
  console.log(code ? `${name}: ffmpeg failed` : `${out}  (${C.seconds}s)`);
}
await browser.close();
await server.close();
