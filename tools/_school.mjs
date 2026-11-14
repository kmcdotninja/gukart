// node tools/_school.mjs <outdir> [phone]: open the game as a first-time player, take the Driving School's offer and
// drive through its lessons with the keyboard (or, with phone, just picture the offer and the first lessons on a phone)
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, phone] = process.argv.slice(2);
const server = await preview({ preview: { port: 4188, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(
  phone
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1100, height: 650 } },
);
await p.addInitScript(() => {
  if (!sessionStorage.getItem('fresh')) {
    localStorage.clear();
    localStorage.setItem('gukart.fsTip', 'true');
    sessionStorage.setItem('fresh', '1');
  }
});
await p.goto('http://127.0.0.1:4188/' + (process.env.DBG ? '?gktest' : ''));
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(1500);
const shot = n => p.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 70 });
const bar = () =>
  p.evaluate(() => [...document.querySelectorAll('#schSteps i')].map(i => i.className || '-').join(' '));
const say = () => p.evaluate(() => document.querySelector('#coachText')?.textContent);
console.log('offer shown:', await p.isVisible('#schoolAsk'));
await shot('1-offer');
if (process.env.DBG) {
  await p.locator('#setBtn').click();
  await p.waitForTimeout(500);
  await p.locator('#setSchool').click();
} else await p.locator('#schoolGo').click();
await p.waitForFunction(() => document.body.dataset.state === 'race', null, { timeout: 30000 });
await p.waitForTimeout(800);
await shot('2-steer');
console.log('1', await say(), '|', await bar());
if (phone) {
  await b.close();
  await server.close();
  process.exit(0);
}
const hold = async (k, ms) => {
  await p.keyboard.down(k);
  await p.waitForTimeout(ms);
  await p.keyboard.up(k);
};
await hold('ArrowLeft', 500);
await hold('ArrowRight', 500);
await p.waitForTimeout(1200);
console.log('2', await say(), '|', await bar());
await shot('3-brake');
await hold('ArrowDown', 700);
await p.waitForTimeout(1500);
console.log('3', await say(), '|', await bar());
// drift: hold space and a turn until it says let go, then let go
for (let a = 0; a < 6; a++) {
  await p.keyboard.down('Space');
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(1600);
  await p.keyboard.up('ArrowLeft');
  await p.keyboard.up('Space');
  await p.waitForTimeout(1300);
  const s = await say();
  console.log('  drift try', a, s);
  if (/NITRO/.test(s)) break;
  await hold('ArrowRight', 900); // (back toward the road)
}
console.log('4', await say(), '|', await bar());
await shot('4-nitro');
await p.keyboard.press('ArrowUp');
await p.waitForTimeout(1500);
console.log('5', await say(), '|', await bar());
// a crate: keep driving (steering gently to stay on the road is left to the road being wide); up to 40 s
for (let a = 0; a < 40 && /CRATE/.test(await say()); a++) await p.waitForTimeout(1000);
console.log('6', await say(), '|', await bar());
await p.waitForTimeout(2500);
await shot('5-fire');
if (process.env.DBG)
  console.log(
    'before F',
    await p.evaluate(() => {
      const P = window.gukart.game.race.player;
      return JSON.stringify({ w: P.weapon, r: P.rolling, cool: P.cool, spin: P.spin, st: window.gukart.game.state });
    }),
  );
await hold('KeyF', 150);
await p.waitForTimeout(600);
console.log('after F', await say(), '|', await bar());
if (process.env.DBG)
  console.log(
    await p.evaluate(() => {
      const P = window.gukart.game.race.player;
      return JSON.stringify({
        w: P.weapon,
        r: P.rolling,
        pend: P.pending,
        cool: P.cool,
        spin: P.spin,
        st: window.gukart.game.state,
      });
    }),
  );
await p.waitForTimeout(2000);
console.log('done card:', await p.isVisible('#schoolDone'));
await shot('6-done');
await b.close();
await server.close();
