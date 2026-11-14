// node tools/_finish.mjs <outdir> [city] [circuit]: a Quick Race finished at once (your kart put on its last metres of
// the last lap, driven by the AI), to picture what comes after the line: the replay behind the results, photo mode
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city = 'kano', circ = 'old'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4192, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
p.on('pageerror', e => console.log('page error:', e.message));
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.fsTip', 'true');
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
    localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
    localStorage.setItem('gukart.earned', '0');
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4192/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(1000);
const tap = async s => {
  await p.locator(s).first().click({ force: true, timeout: 15000 });
  await p.waitForTimeout(500);
};
await tap('#quickBtn');
await tap('#mCards .mcard[data-mode="gp"]');
await tap('#mCards .mcard.on');
for (let k = 0; k < 4; k++) await tap('#qNext');
await p.waitForTimeout(1500);
await p.keyboard.press('KeyX');
await p.waitForFunction(() => document.body.dataset.state === 'race', null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const g = window.gukart.game,
    P = g.race.player;
  P.ai = true;
  for (const k of g.race.all) if (k !== P) k.lap = Math.max(k.lap, 0);
  P.lap = 1; // (the last lap of two, or three: finished within metres)
  P.lap = g.race.constructor.name && P.lap;
});
// put the player on the final straight of the final lap
await p.evaluate(async () => {
  const g = window.gukart.game,
    P = g.race.player,
    mod = await import('/src/race.js').catch(() => null);
  const L = mod?.LAPS || (g.track.len > 2600 ? 2 : 3);
  P.lap = L - 1;
  P.s = g.track.len - 60;
  P.prog = P.lap * g.track.len + P.s;
});
await p.waitForFunction(() => document.body.dataset.state === 'results', null, { timeout: 30000 }).catch(() => {});
console.log('state', await p.evaluate(() => document.body.dataset.state));
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${out}/res${i}.jpg`, type: 'jpeg', quality: 65 });
}
await tap('#photoBtn');
console.log('photo state', await p.evaluate(() => document.body.dataset.state));
await p.mouse.move(550, 300);
await p.mouse.down();
await p.mouse.move(420, 260, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/photo.jpg`, type: 'jpeg', quality: 70 });
await tap('#photoSnap');
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/polaroid.jpg`, type: 'jpeg', quality: 75 });
// the saved picture itself, full size
const png = await p.evaluate(async () => {
  const r = await fetch(document.querySelector('#phPrintImg').src),
    b = await r.blob();
  return await new Promise(res => {
    const f = new FileReader();
    f.onload = () => res(f.result);
    f.readAsDataURL(b);
  });
});
(await import('node:fs')).writeFileSync(`${out}/print.png`, Buffer.from(png.split(',')[1], 'base64'));
await tap('#phClose');
await tap('#photoBack');
console.log('back state', await p.evaluate(() => document.body.dataset.state));
await b.close();
await server.close();
