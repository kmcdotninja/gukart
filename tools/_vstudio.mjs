// node tools/_vstudio.mjs <outdir> [vehicle,...]: the Vehicle Studio on the dev server, each vehicle's power played
// and pictured mid-way, to check the stage and the panels
import { chromium } from 'playwright';
import { createServer } from 'vite';
const [out, list = 'monster,roadster,kart,buggy,rail,muscle,raider,brute'] = process.argv.slice(2);
const server = await createServer({ server: { port: 4194, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
await server.listen();
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1360, height: 1000 } });
p.on('pageerror', e => console.log('page error:', e.message));
for (const v of list.split(',')) {
  await p.goto(`http://127.0.0.1:4194/studio.html?v=${v}`);
  await p.waitForTimeout(2500);
  if (v === list.split(',')[0])
    await p.screenshot({ path: `${out}/page-${v}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
  await p.click('#play');
  for (const t of [0.3, 0.6, 1.2, 2, 2.6]) {
    await p.waitForTimeout(t === 0.3 ? 300 : t === 0.6 ? 300 : t === 1.2 ? 600 : t === 2 ? 800 : 600);
    await p.locator('.stage').screenshot({ path: `${out}/${v}-${t}.jpg`, type: 'jpeg', quality: 70 });
  }
}
await b.close();
await server.close();
