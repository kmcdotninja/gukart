// node tools/_home.mjs <out.jpg> [vehicle] [phone]: the home screen with that vehicle as your car (the GARAGE tile)
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, veh = 'roadster', phone] = process.argv.slice(2);
const server = await preview({ preview: { port: 4198, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await b.newPage(
  phone
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1100, height: 650 } },
);
await p.addInitScript(v => {
  localStorage.clear();
  localStorage.setItem('gukart.fsTip', 'true');
  localStorage.setItem('gukart.veh', JSON.stringify(v));
  localStorage.setItem('gukart.owned', JSON.stringify(['veh:' + v]));
  localStorage.setItem('gukart.school.offered', 'true');
  localStorage.setItem('gukart.earned', '0');
}, veh);
await p.goto('http://127.0.0.1:4198/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(2000);
await p.screenshot({ path: out, type: 'jpeg', quality: 75 });
await b.close();
await server.close();
