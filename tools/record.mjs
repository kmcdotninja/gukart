// Record a race to a video: Buddy (on autopilot) races a Doha circuit, from the loading card through the countdown and on,
// frame by frame at a steady 60 fps however slowly the browser draws. Run `npm run build` first; it plays dist/.
//   node tools/record.mjs                                   (Lusail, 60 seconds, recordings/lusail.mp4)
//   node tools/record.mjs --circuit pearl --seconds 30 --out recordings/pearl.mp4
//   node tools/record.mjs --frames 120                      (a quick check: a couple of seconds)
//   node tools/record.mjs --launch                          (the launch video: Doha's garage, then a race on Msheireb, 45 s)
// The window is a 14" MacBook Pro screen (1512x982 points, drawn at 2x: a 3024x1964 video). Change it with --size 1512x982
// and --scale 2. Needs ffmpeg (brew install ffmpeg). --mute leaves the sound out.
//
// How: the game's #capture mode stops its own frame loop and lets this script call frame() itself (src/main.js). Each frame
// moves the page's (fake) clock on by exactly 1/60 s, so timers fire on game time, steps every CSS animation by the same
// amount, draws the frame and takes a screenshot that goes straight to ffmpeg.
// The sound: the game's AudioContext is swapped for an OfflineAudioContext, which only makes sound when told to; after each
// frame it renders exactly that frame's 1/60 s, so the engines, hits and beeps land on the very frame that made them.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const launch = process.argv.includes('--launch');
const circuit = arg('circuit', launch ? 'msheireb' : 'lusail');
const FPS = 60;
const frames = +arg('frames', 0) || Math.round(+arg('seconds', launch ? 45 : 60) * FPS);
const out = arg('out', launch ? 'recordings/launch.mp4' : `recordings/${circuit}.mp4`);
// the launch video, one take with no titles: Doha's home, into the garage, through the vehicles, the muscle car dressed
// in Buddy Orange with flames and turbo wheels, saved, then PLAY and a race on Msheireb. [second, what is clicked]
const LAUNCH = [
  [1.6, '#garageBtn'],
  [4.2, '#gNext'], // buggy
  [6.2, '#gNext'], // monster
  [8.2, '#gNext'], // muscle
  [10.4, '#custOpen'],
  [11.6, '#custTabs [data-ct=paint]'],
  [12.4, '#custList [data-part="#ff6a00"]'], // Buddy Orange
  [13.8, '#custTabs [data-ct=decal]'],
  [14.6, '#custList [data-part=flames]'],
  [16.0, '#custTabs [data-ct=rim]'],
  [16.8, '#custList [data-part=turbo]'],
  [18.4, '#custSave'],
  [19.8, '#gPlay'],
  [21.0, '#mCards .mcard[data-mode="gp"]'], // RACE opens, then NEXT on it, then the setup (Doha, Msheireb, the time of
  [22.0, '#mCards .mcard.on'], // day it's in): NEXT, NEXT, GO
  [23.0, '#qNext'],
  [24.0, '#qNext'],
  [25.0, '#qNext'],
];
const [W, H] = arg('size', '1512x982').split('x').map(Number);
const scale = +arg('scale', 2);
const DT = 1000 / FPS;
const mute = process.argv.includes('--mute');
const RATE = 48000; // 800 samples a frame

const server = await preview({ preview: { port: 4198, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await chromium.launch({
  // the Mac's own graphics chip: software rendering is far too slow at this size
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
page.on('pageerror', e => console.log('page error:', e.message));
await page.addInitScript(
  ([c, launch]) => {
    const set = (k, v) => localStorage.setItem('gukart.' + k, JSON.stringify(v));
    set('city', 'doha');
    set('circuit.doha', c);
    set('mode', 'gp');
    set('coach', { steer: true, brake: true, drift: true, fire: true }); // no "how to steer" hints over the race
    if (launch) {
      set('veh', 'kart'); // the garage opens on the kart
      set('wallet', 2500); // enough for the paint, flames and wheels it buys
    }
  },
  [circuit, launch],
);
// the game's sound goes into an offline context exactly as long as the video; the game's own resume() calls (it wakes the
// sound on a key press or a new race) do nothing, only this script moves it on
if (!mute)
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
      // render the next dt of sound (the last call renders to the end)
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
      // the finished sound as a 16-bit WAV, base64
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
await page.clock.install(); // the page's timers run on a clock this script moves (it ticks normally until paused)
await page.goto('http://127.0.0.1:4198/#capture');
console.log(`booting Doha · ${circuit} ...`);
await page.waitForFunction(() => window.gukart?.ready, null, { timeout: 300000, polling: 200 });
await page.clock.pauseAt(Date.now() + 1000);

// in the page: step the game and every CSS animation/transition by one frame
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

// home > QUICK RACE > RACE > the setup (the card is already picked); then a few frames so the screens settle. The launch video starts on
// the home screen instead and clicks its way along as it records
for (let i = 0; i < 20; i++) await step();
if (!launch) {
  await page.evaluate(() => document.querySelector('#quickBtn').click());
  for (let i = 0; i < 30; i++) await step();
}
// the sound starts with the video: its first sample is the first frame
if (!mute) await page.evaluate(() => window.gukart.Sound.init());
// RACE (open it, then its NEXT), then the QUICK RACE setup already on this circuit and time of day: NEXT (city), NEXT (circuit), GO
if (!launch)
  await page.evaluate(() => {
    document.querySelector('#mCards .mcard[data-mode="gp"]').click(); // opens RACE
    document.querySelector('#mCards .mcard.on').click(); // its NEXT
    for (let i = 0; i < 3; i++) document.querySelector('#qNext').click();
  });
await page.mouse.move(W - 1, H - 1); // nothing hovered

// ffmpeg takes the frames as JPEGs on its input (into a picture-only file first when the sound is added after)
mkdirSync(dirname(out), { recursive: true });
const vidOut = mute ? out : out.replace(/\.mp4$/, '') + '.video.mp4',
  wavOut = out.replace(/\.mp4$/, '') + '.wav';
const ff = spawn(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'].concat([
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
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

const t0 = Date.now();
let auto = false;
const clicks = launch ? LAUNCH.map(([t, sel]) => [Math.round(t * FPS), sel]) : [];
for (let f = 0; f < frames; f++) {
  for (const [at, sel] of clicks)
    if (at === f) {
      const ok = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        el?.click();
        return !!el;
      }, sel);
      if (!ok) console.log(`  (nothing to click at ${(f / FPS).toFixed(1)}s: ${sel})`);
    }
  await step();
  if (!mute) await page.evaluate(n => window.__audioStep(n), RATE / FPS);
  if (!auto && (await page.evaluate(() => ['count', 'race'].includes(window.gukart.game.state)))) {
    await page.evaluate(() => (window.gukart.game.race.player.ai = true)); // autopilot for Buddy
    auto = true;
  }
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 95,
    clip: { x: 0, y: 0, width: W, height: H, scale }, // (asked for: on its own it comes out at 1x, ignoring the 2x screen)
  });
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 300 === 0 || f === frames - 1) {
    const done = f + 1,
      per = (Date.now() - t0) / done;
    console.log(
      `  ${String(done).padStart(5)}/${frames} frames (${(done / FPS).toFixed(0)}s of video), about ${Math.round(((frames - done) * per) / 60000)} min to go`,
    );
  }
}
ff.stdin.end();
let code = await ffDone;
if (!mute && !code) {
  writeFileSync(wavOut, Buffer.from(await page.evaluate(() => window.__wav()), 'base64'));
  code = await new Promise(r =>
    spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', vidOut, '-i', wavOut].concat([
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-shortest',
        '-movflags',
        '+faststart',
        out,
      ]),
      { stdio: 'inherit' },
    ).on('close', r),
  );
  if (!code) [vidOut, wavOut].forEach(f => rmSync(f));
}
await browser.close();
await server.close();
if (code) {
  console.log('ffmpeg failed');
  process.exit(1);
}
console.log(`saved ${out} (${W * scale}x${H * scale}, ${(frames / FPS).toFixed(1)}s at ${FPS} fps)`);
