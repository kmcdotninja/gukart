// node tools/_controls.mjs <outdir>: the controls card on a desktop (keys) and on a phone (the race screen's buttons)
import { chromium, devices } from 'playwright';
import { preview } from 'vite';
const [out] = process.argv.slice(2);
const server = await preview({ preview: { port: 4188, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [
  ['desk', { viewport: { width: 1280, height: 800 } }],
  ['phone', { ...devices['iPhone 13'] }],
]) {
  const ctx = await b.newContext(opts),
    p = await ctx.newPage();
  await p.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
    localStorage.setItem('gukart.fsTip', 'true');
  });
  await p.goto('http://127.0.0.1:4188/');
  await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
    timeout: 240000,
  });
  await p.waitForTimeout(1200);
  await p.locator('#setBtn').first().click({ force: true });
  await p.waitForTimeout(600);
  await p.locator('#setCtrl').first().scrollIntoViewIfNeeded();
  await p.locator('#setCtrl').first().click({ force: true });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/controls-${name}.png` });
  await ctx.close();
}
await b.close();
await server.close();
