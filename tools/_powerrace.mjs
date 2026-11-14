// node tools/_powerrace.mjs <outdir> <vehicle> [phone|landscape]: a Quick Race in that vehicle, the clock put past the
// powers' opening seconds, then Q (the special power): pictures as it runs, and how many rivals it knocked out
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, veh = 'roadster', view] = process.argv.slice(2);
const server = await preview({ preview: { port: 4195, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(
  view === 'phone'
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : view === 'landscape'
      ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1100, height: 650 } },
);
p.on('pageerror', e => console.log('page error:', e.message));
await p.addInitScript(v => {
  localStorage.clear();
  localStorage.setItem('gukart.fsTip', 'true');
  localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
  localStorage.setItem('gukart.earned', '0');
  localStorage.setItem('gukart.veh', JSON.stringify(v));
  localStorage.setItem('gukart.owned', JSON.stringify(['veh:' + v]));
  localStorage.setItem('gukart.school.offered', 'true');
}, veh);
await p.goto('http://127.0.0.1:4195/?gktest');
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
await p.waitForTimeout(800);
console.log('vehicle', await p.evaluate(() => window.gukart.game.race.player.m.type));
await p.evaluate(() => {
  const R = window.gukart.game.race;
  R.time = 29.5;
  for (const k of R.karts) if (k !== R.player) k.pw.used = true; // (just ours, for the pictures)
});
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/ready.jpg`, type: 'jpeg', quality: 70 });
await p.evaluate(() => (window.gukart.game.race.input.powerPressed = true));
for (const t of [0.3, 0.8, 1.5, 2.5, 3.5]) {
  await p.waitForTimeout(t === 0.3 ? 300 : t === 0.8 ? 500 : t === 1.5 ? 700 : 1000);
  await p.screenshot({ path: `${out}/p${t}.jpg`, type: 'jpeg', quality: 70 });
}
console.log(
  await p.evaluate(() => {
    const R = window.gukart.game.race;
    return JSON.stringify({
      used: R.player.pw.used,
      takedowns: R.player.takedowns,
      spun: R.karts.filter(k => k.spin > 0).length,
    });
  }),
);
await b.close();
await server.close();
