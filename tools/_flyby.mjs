// node tools/_flyby.mjs <outdir> <city> <circuit>: start a Quick Race and capture the circuit's introduction as it plays
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ] = process.argv.slice(2);
const server = await preview({ preview: { port: 4187, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
    localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4187/');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(1500);
const tap = async s => {
  await p.locator(s).first().click({ force: true, timeout: 15000 });
  await p.waitForTimeout(500);
};
await tap('#quickBtn');
await tap('#mCards .mcard[data-mode="gp"]');
await tap('#mCards .mcard.on');
for (let k = 0; k < 4; k++) await tap('#qNext');
const t0 = Date.now();
for (const at of [1.2, 3.8, 6, 8, 10, 12.5]) {
  const wait = at * 1000 - (Date.now() - t0);
  if (wait > 0) await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}/fly-${String(at).replace('.', '_')}.jpg`, type: 'jpeg', quality: 70 });
}
console.log(await p.evaluate(() => document.body.dataset.state));
await b.close();
await server.close();
