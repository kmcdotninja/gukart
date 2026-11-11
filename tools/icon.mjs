// The app icons: Buddy's monster truck and its fire, cut from the drift poster (the same shot as the share card).
// Run it again after a new poster render:  node tools/icon.mjs
//   public/apple-touch-icon.png   180  full square (iOS rounds it)
//   public/icon-192.png, icon-512.png   rounded corners, for the manifest and desktop installs
//   public/icon-maskable-512.png  full square with the truck inside the middle 80% (Android cuts its own shape)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const PW = 1920,
  PH = 1080; // poster size
const CX = 922,
  CY = 540; // middle of the truck in the poster
const poster = `data:image/jpeg;base64,${readFileSync(new URL('../public/loader-drift-desk.jpg', import.meta.url)).toString('base64')}`;

// `span` is how many poster pixels the icon's side covers: 1080 is the whole poster height, more than that zooms out
// and the gap above and below is filled with a stretched, blurred copy (sky on top, road underneath).
const html = (S, span, radius) => {
  const k = S / span,
    w = PW * k,
    h = PH * k,
    left = S / 2 - CX * k,
    top = S / 2 - CY * k;
  const fade = h < S ? 'mask-image: linear-gradient(180deg, transparent 0, #000 7%, #000 93%, transparent 100%);' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: transparent; }
  .icon { position: relative; width: ${S}px; height: ${S}px; overflow: hidden; border-radius: ${radius * S}px; background: #1d2a6b; }
  img { position: absolute; left: ${left}px; width: ${w}px; }
  .fill { top: -6%; height: 112%; filter: blur(${S * 0.03}px); }
  .shot { top: ${top}px; height: ${h}px; ${fade} }
  /* a touch of shade at the bottom so the truck sits on the road and the fire glows */
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,19,48,0) 70%, rgba(11,19,48,.35) 100%); }
</style></head><body><div class="icon">
  <img class="fill" src="${poster}"><img class="shot" src="${poster}"><div class="shade"></div>
</div></body></html>`;
};

const icons = [
  { file: 'apple-touch-icon.png', size: 180, span: 980, radius: 0 },
  { file: 'icon-192.png', size: 192, span: 980, radius: 0.22 },
  { file: 'icon-512.png', size: 512, span: 980, radius: 0.22 },
  { file: 'icon-maskable-512.png', size: 512, span: 1230, radius: 0 },
];

const browser = await chromium.launch();
for (const { file, size, span, radius } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html(size, span, radius), { waitUntil: 'load' });
  const png = await page.locator('.icon').screenshot({ type: 'png', omitBackground: true });
  await page.close();
  writeFileSync(new URL('../public/' + file, import.meta.url), png);
  console.log(`public/${file}  ${(png.length / 1024).toFixed(0)} KB`);
}
await browser.close();
