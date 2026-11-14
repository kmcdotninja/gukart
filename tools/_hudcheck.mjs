// node tools/_hudcheck.mjs <outdir> [phone]: a Quick Race with your kart driven by the AI, pictured every couple of
// seconds, to check the bend trail on the road and the racers along the progress bar
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, phone] = process.argv.slice(2);
const server = await preview({ preview: { port: 4190, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(
  phone
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1100, height: 650 } },
);
await p.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('gukart.fsTip', 'true');
  localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
  localStorage.setItem('gukart.wallet', '99999');
  localStorage.setItem('gukart.earned', '0'); // (no coin-milestone chest in the way)
});
await p.goto('http://127.0.0.1:4190/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(1200);
console.log(
  'garage badge:',
  await p.evaluate(
    () => !document.querySelector('#garageBadge').hidden && document.querySelector('#garageBadge').textContent,
  ),
);
await p.screenshot({ path: `${out}/home.jpg`, type: 'jpeg', quality: 70 });
const tap = async s => {
  await p.locator(s).first().click({ force: true, timeout: 15000 });
  await p.waitForTimeout(500);
};
await tap('#quickBtn');
await tap('#mCards .mcard[data-mode="gp"]');
await tap('#mCards .mcard.on');
for (let k = 0; k < 4; k++) await tap('#qNext');
await p.waitForTimeout(1500);
await p.keyboard.press('KeyX'); // (skip the introduction)
await p.waitForFunction(() => document.body.dataset.state === 'race', null, { timeout: 30000 });
await p.evaluate(() => (window.gukart.game.race.player.ai = true));
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${out}/r${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 65 });
}
await b.close();
await server.close();
