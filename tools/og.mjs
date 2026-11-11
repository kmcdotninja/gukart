// The share card (public/og.jpg, 1200x630 drawn at 2x): the drift poster (Buddy in the monster truck) with the logo and a play button.
// Run it again after a new poster render:  node tools/og.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const W = 1200,
  H = 630;
const b64 = f => readFileSync(new URL('../public/' + f, import.meta.url)).toString('base64');
const poster = `data:image/jpeg;base64,${b64('loader-drift-desk.jpg')}`,
  logo = `data:image/svg+xml;base64,${b64('gukart-logo.svg')}`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800;1,900&display=swap">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #0b1330; }
  .bg { position: absolute; inset: 0; background: url(${poster}) 50% 58% / cover no-repeat; }
  /* a dark wash low down so the button reads over the road, and a little on the left behind the logo */
  .wash { position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(11,19,48,0) 52%, rgba(11,19,48,.55) 78%, rgba(11,19,48,.9) 100%),
                radial-gradient(70% 60% at 0% 0%, rgba(11,19,48,.35), rgba(11,19,48,0) 70%); }
  .logo { position: absolute; left: 44px; top: 34px; width: 360px; filter: drop-shadow(0 10px 24px rgba(5,9,28,.45)); }
  .line { position: absolute; left: 48px; right: 48px; bottom: 38px; display: flex; align-items: flex-end;
    justify-content: flex-end; font-family: 'Barlow Condensed', sans-serif; font-style: italic; color: #f4f7ff; }
  .play { font-weight: 900; font-size: 30px; letter-spacing: .06em; color: #0b1330; background: #ff6a00;
    padding: 12px 34px 10px; transform: skewX(-14deg); box-shadow: 0 8px 24px rgba(5,9,28,.45); white-space: nowrap; }
  .play span { display: inline-block; transform: skewX(14deg); color: #fff; }
</style></head><body>
  <div class="bg"></div><div class="wash"></div>
  <img class="logo" src="${logo}">
  <div class="line">
    <div class="play"><span>PLAY FREE IN YOUR BROWSER</span></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const jpg = await page.screenshot({ type: 'jpeg', quality: 78 });
await browser.close();
const out = new URL('../public/og.jpg', import.meta.url);
writeFileSync(out, jpg);
console.log(`public/og.jpg  ${(jpg.length / 1024).toFixed(0)} KB`);
