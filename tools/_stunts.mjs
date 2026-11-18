// node tools/_stunts.mjs <outdir> [vehicle]: the Vehicle Studio (dev server) playing each stunt, a still of each mid-air
import { chromium } from 'playwright';
const [out, veh] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', e => console.log('page error:', e.message));
await p.goto('http://localhost:5175/studio.html');
await p.waitForSelector('#stunts button', { timeout: 120000 });
await p.waitForTimeout(2500);
if (veh)
  await p
    .locator(`#veh [data-id="${veh}"], #veh button:has-text("${veh}")`)
    .first()
    .click()
    .catch(() => {});
const ids = await p.$$eval('#stunts button', bs => bs.map(b => b.dataset.ids));
for (const [n, id] of ids.entries()) {
  await p.locator(`#stunts button[data-ids="${id}"]`).click();
  const mid = id.includes(',') ? 1100 : 650;
  await p.waitForTimeout(mid);
  await p
    .locator('.stage')
    .screenshot({ path: `${out}/st-${n}-${id.replace(/,/g, '+')}.jpg`, type: 'jpeg', quality: 72 });
  await p.waitForTimeout(2600);
}
await b.close();
