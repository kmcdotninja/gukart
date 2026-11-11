// Smoke test: builds nothing itself; run `npm test`, which builds the game first. It serves dist/ and plays the game in a
// headless browser the way a player would: boot, the garage, settings, a race (steer, pause, quit and back), the map, then
// Doha and a circuit switch. It fails on any page error, console error, or a screen that doesn't open.
//   node tools/smoke.mjs            (the whole run, a few minutes: headless graphics are slow)
//   node tools/smoke.mjs --headed   (watch it)
import { chromium } from 'playwright';
import { preview } from 'vite';

const headed = process.argv.includes('--headed');
// never hang: if the whole run takes more than 6 minutes, something is stuck
setTimeout(
  () => {
    console.log('\nFAIL  the smoke test took over 6 minutes: something hung');
    process.exit(1);
  },
  6 * 60 * 1000,
).unref();
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
// press a button the way a finger would: once it's on screen and nothing (a card still fading out) sits on top of it.
// (Playwright's own wait for it to stop moving is unreliable while the 3D scene renders behind it)
async function click(page, sel) {
  const el = page.locator(sel).first();
  try {
    await el.waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(
      s => {
        const b = document.querySelector(s),
          r = b?.getBoundingClientRect();
        if (!r || !r.width) return false;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && (b === top || b.contains(top));
      },
      sel,
      { timeout: 8000, polling: 100 },
    );
    await el.click({ force: true, timeout: 8000 });
  } catch (e) {
    const top = await page
      .evaluate(s => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        const t = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const m = document.querySelector('#menu'),
          cs = getComputedStyle(m);
        const info = `menu hidden=${m.hidden} class="${m.className}" display=${cs.display} vis=${cs.visibility} op=${cs.opacity} z=${cs.zIndex} state=${document.body.dataset.state}`;
        return (t ? `${t.tagName}#${t.id}.${t.className} in ${t.closest('[id]')?.id}` : 'nothing') + ' | ' + info;
      }, sel)
      .catch(() => 'the page did not answer');
    fail(`could not click ${sel} (on top of it: ${top}): ${e.message.split('\n')[0]}`);
  }
}

try {
  // ---- Kano: a first visit, with the coach hints already seen so they don't cover the buttons
  console.log('Kano');
  const page = await newPage({ coach: { steer: true, brake: true, drift: true, fire: true } });
  const t0 = Date.now();
  await page.goto(URL);
  await booted(page, 'the game boots');
  console.log(`        (boot took ${((Date.now() - t0) / 1000).toFixed(0)}s headless)`);
  await expectVisible(page, '#menu', 'the home screen shows');
  if (!(await visible(page, '#goBtn'))) fail('the World Tour tile should be on the home screen');
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

  // a race: QUICK RACE, the modes (an accordion: one open at a time), then CITY, CIRCUIT, DAY OR NIGHT, GO
  await click(page, '#quickBtn');
  await expectVisible(page, '#modes', 'the race modes open');
  const open = () => page.$$eval('#mCards .mcard.on', l => l.map(c => c.dataset.mode));
  if ((await page.locator('#mCards .mcard').count()) === 3) pass('three mode cards');
  else fail('the modes screen should have three cards');
  if (!(await open()).length) pass('no mode is open until you pick one');
  else fail(`the modes should open all closed (open: ${await open()})`);
  await click(page, '#mCards .mcard[data-mode="tt"]');
  if ((await open()).join() === 'tt') pass('tapping Time Trial opens it and closes the others');
  else fail(`tapping Time Trial should open only it (open: ${await open()})`);
  await click(page, '#mCards .mcard[data-mode="gp"]');
  if ((await open()).join() === 'gp') pass('tapping Race opens it again');
  else fail(`tapping Race should open only it (open: ${await open()})`);
  await click(page, '#mCards .mcard.on');
  await expectVisible(page, '#qCity', 'NEXT on Race goes to the city');
  if ((await page.locator('#qCity .q-card').count()) >= 2 && (await page.locator('#qCity .q-card.on').count()) === 1)
    pass('every city is offered, the one you are in already chosen');
  else fail('the city step should show the cities with one chosen');
  await click(page, '#qNext');
  await expectVisible(page, '#qCirc', 'NEXT goes to the circuit');
  if ((await page.locator('#qCirc .q-card').count()) >= 2 && (await page.locator('#qCirc .q-card.on').count()) === 1)
    pass("the city's circuits are offered, the current one chosen");
  else fail('the circuit step should show the circuits with one chosen');
  await click(page, '#mBack');
  await expectVisible(page, '#qCity', 'back steps back to the city');
  await click(page, '#qNext');
  await expectVisible(page, '#qCirc', 'and on to the circuit again');
  await click(page, '#qNext');
  await expectVisible(page, '#qTime', 'NEXT goes to day or night');
  await click(page, '#qTime .q-card[data-night="1"]');
  if ((await page.locator('#qTime .q-card.on').getAttribute('data-night')) === '1') pass('night is chosen');
  else fail('tapping NIGHT should choose it');
  if ((await page.locator('#qNext').textContent()).trim() === 'GO') pass('the last step says GO');
  else fail('the last step should say GO');
  await click(page, '#qNext');
  await expectVisible(page, '#hud', 'the race starts', 20000);
  if (await page.locator('#nightBtn.on').count()) pass('the race is at night, as chosen');
  else fail('night was chosen but the race is in the day');
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
  await click(page, '#mapBtn');
  await expectVisible(page, '#map', 'the map opens with its places');
  const doha = page.locator('#map .isl', { hasText: 'DOHA' });
  if (await doha.count()) pass('the map offers Doha');
  else fail('the map has no Doha');
  await doha.first().click();
  await booted(page, 'Doha loads');
  await expectVisible(page, '#map', 'Doha opens on its map');
  const other = page.locator('#map .isl:not(.sel)', { hasText: 'DOHA' });
  if (await other.count()) {
    await other.first().click();
    await expectVisible(page, '#map', 'another Doha circuit swaps in without a reload', 120000);
  } else fail('Doha has no other circuit to pick');
  await click(page, '#mapBack');
  await expectVisible(page, '#menu', 'back home in Doha');
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
