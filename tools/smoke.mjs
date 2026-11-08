// Smoke test: builds nothing itself; run `npm test`, which builds the game first. It serves dist/ and plays the game in a
// headless browser the way a player would: boot, the garage, settings, a race (steer, pause, quit and back), the map, then
// Doha and a circuit switch. It fails on any page error, console error, or a screen that doesn't open.
//   node tools/smoke.mjs            (the whole run, a few minutes: headless graphics are slow)
//   node tools/smoke.mjs --headed   (watch it)
import { chromium } from 'playwright';
import { preview } from 'vite';

const headed = process.argv.includes('--headed');
const server = await preview({ preview: { port: 4199, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const URL = 'http://127.0.0.1:4199/';
const browser = await chromium.launch({
  headless: !headed,
  // the Mac's own graphics chip (Metal): software rendering draws the race at about 1 frame a second, too slow to play
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const problems = [];
let passed = 0;
const fail = msg => {
  problems.push(msg);
  console.log(`  FAIL  ${msg}`);
};
const pass = msg => {
  passed++;
  console.log(`  ok    ${msg}`);
};

async function newPage(saves = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  page.on('pageerror', e => fail(`page error: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') fail(`console error: ${m.text().slice(0, 200)}`);
  });
  await page.addInitScript(s => {
    if (sessionStorage.getItem('smoke.seeded')) return; // only before the first load: a city switch reloads the page
    sessionStorage.setItem('smoke.seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem('gukart.' + k, JSON.stringify(v));
  }, saves);
  return page;
}
async function inState(page, state, what, timeout = 30000) {
  try {
    await page.locator(`body[data-state="${state}"]`).waitFor({ state: 'attached', timeout });
    pass(what);
  } catch {
    fail(`${what} (the game never reached "${state}")`);
  }
}
const visible = (page, sel) => page.locator(sel).first().isVisible();
async function expectVisible(page, sel, what, timeout = 8000) {
  try {
    await page.locator(sel).first().waitFor({ state: 'visible', timeout });
    pass(what);
  } catch {
    fail(`${what} (${sel} never showed)`);
  }
}
async function expectHidden(page, sel, what, timeout = 8000) {
  try {
    await page.locator(sel).first().waitFor({ state: 'hidden', timeout });
    pass(what);
  } catch {
    fail(`${what} (${sel} stayed on screen)`);
  }
}
async function booted(page, what, timeout = 240000) {
  try {
    await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout });
    pass(what);
    await page.waitForTimeout(600);
  } catch {
    fail(`${what} (still loading after ${timeout / 1000}s)`);
  }
}
const click = (page, sel) =>
  page
    .locator(sel)
    .first()
    .click({ timeout: 8000 })
    .catch(e => fail(`could not click ${sel}: ${e.message.split('\n').slice(0, 12).join(' | ')}`));

try {
  // ---- Kano: a first visit, with the coach hints already seen so they don't cover the buttons
  console.log('Kano');
  const page = await newPage({ coach: { steer: true, brake: true, drift: true, fire: true } });
  const t0 = Date.now();
  await page.goto(URL);
  await booted(page, 'the game boots');
  console.log(`        (boot took ${((Date.now() - t0) / 1000).toFixed(0)}s headless)`);
  await expectVisible(page, '#menu', 'the home screen shows');
  if ((await page.locator('#chName').textContent()) !== 'KANO') fail('the home card should start on Kano');
  else pass('the home card is on Kano');

  // garage: open it, change vehicle, the name and the wallet follow, back home
  await click(page, '#garageBtn');
  await expectVisible(page, '#garage', 'the garage opens');
  const before = await page.locator('#gName').textContent();
  await click(page, '#gNext');
  await page.waitForTimeout(500);
  const after = await page.locator('#gName').textContent();
  if (after && after !== before) pass(`next vehicle (${before} > ${after})`);
  else fail('next vehicle did not change the name');
  await click(page, '#custOpen');
  await expectVisible(page, '#cust', 'Customise opens');
  await click(page, '#custCancel');
  await expectHidden(page, '#cust', 'Customise closes');
  await click(page, '#gBack');
  await expectVisible(page, '#menu', 'back home from the garage');

  // settings from home
  await click(page, '#setBtn');
  await expectVisible(page, '#settings', 'settings opens');
  await click(page, '#setBack');
  await expectVisible(page, '#menu', 'back home from settings');

  // a race: PLAY, pick Race, the intro, the countdown, then drive
  await click(page, '#goBtn');
  await expectVisible(page, '#modes', 'the race modes open');
  await click(page, '#mCards .mcard.on');
  await expectVisible(page, '#hud', 'the race starts', 20000);
  await inState(page, 'race', 'the countdown ends and the race is on', 90000);
  const time0 = await page.locator('#timer').textContent();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowRight');
  const time1 = await page.locator('#timer').textContent();
  if (time1 !== time0) pass(`the race clock runs (${time0} > ${time1})`);
  else fail('the race clock did not move');
  const speed = +(await page.locator('#speed').textContent());
  if (speed > 0) pass(`the kart is moving (${speed} km/h)`);
  else fail('the kart is not moving');

  // pause, the quit question, back, resume
  await page.keyboard.press('KeyP');
  await expectVisible(page, '#pause', 'pause opens');
  await click(page, '#quitBtn');
  await expectVisible(page, '#quitAsk', 'quit asks first');
  await click(page, '#quitNo');
  await expectVisible(page, '#pause', 'BACK returns to pause');
  await click(page, '#setBtn2');
  await expectVisible(page, '#settings', 'settings opens from pause');
  await click(page, '#setBack');
  await expectVisible(page, '#pause', 'settings returns to pause');
  await click(page, '#resumeBtn');
  await expectHidden(page, '#pause', 'resume closes pause');
  await page.keyboard.press('KeyP');
  await expectVisible(page, '#pause', 'pause opens again');
  await click(page, '#quitBtn');
  await expectVisible(page, '#quitAsk', 'quit asks again');
  await click(page, '#quitYes');
  await expectVisible(page, '#menu', 'quitting goes home');

  // the map
  await click(page, '#mapBtn');
  await expectVisible(page, '#map', 'the map opens', 12000);
  await page.waitForTimeout(800);
  await click(page, '#mapBack');
  await expectVisible(page, '#menu', 'back home from the map');

  // ---- Doha: switching city reloads; then another circuit swaps in place
  console.log('Doha');
  await click(page, '#nextCh');
  if ((await page.locator('#chName').textContent()) === 'DOHA') pass('the home card steps to Doha');
  else fail('next chapter is not Doha');
  await click(page, '#goBtn');
  await booted(page, 'Doha loads');
  await expectVisible(page, '#modes', 'Doha opens on the race modes');
  await click(page, '#mBack');
  await expectVisible(page, '#menu', 'back home in Doha');
  const circuits = page.locator('#chCirc [data-circ]:not(.on)');
  if (await circuits.count()) {
    await circuits.first().click();
    await click(page, '#goBtn');
    await expectVisible(page, '#modes', 'another Doha circuit swaps in without a reload', 120000);
  } else fail('Doha has no other circuit to pick');
  await click(page, '#mBack');
  await click(page, '#garageBtn');
  await expectVisible(page, '#garage', "Doha's garage opens");
  if (await visible(page, '#gLights')) pass('the garage lights switch is there');
} catch (e) {
  fail(`the test itself crashed: ${e.message}`);
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${passed} passed, ${problems.length} failed`);
process.exit(problems.length ? 1 : 0);
