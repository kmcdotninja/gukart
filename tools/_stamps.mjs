// node tools/_stamps.mjs <out.png>: every city's passport stamp (src/stamps.js) on one sheet, in its own ink
import { chromium } from 'playwright';
import { createServer } from 'vite';
const out = process.argv[2];
const server = await createServer({ server: { port: 4193, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
await server.listen();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 820 } });
await p.goto('http://127.0.0.1:4193/poster.html');
await p.evaluate(async () => {
  const { drawStamp, STAMP_INK, wear } = await import('/src/stamps.js');
  await document.fonts.load('800 40px "Barlow Condensed"').catch(() => {});
  document.body.innerHTML = '';
  const c = document.createElement('canvas');
  c.width = 760;
  c.height = 820;
  document.body.append(c);
  document.body.style.margin = '0';
  const x = c.getContext('2d');
  x.fillStyle = '#fbf8f1';
  x.fillRect(0, 0, 760, 820);
  Object.keys(STAMP_INK).forEach((city, i) => {
    // each on its own layer, worn, then laid on the sheet a little crooked
    const L = 400,
      o = document.createElement('canvas');
    o.width = o.height = L;
    const y = o.getContext('2d');
    y.translate(L / 2, L / 2);
    y.strokeStyle = y.fillStyle = STAMP_INK[city];
    drawStamp(y, city, city.toUpperCase());
    wear(y, L, L);
    x.save();
    x.translate(190 + (i % 2) * 380, 140 + Math.floor(i / 2) * 270);
    x.rotate((i % 2 ? 1 : -1) * 0.06);
    x.drawImage(o, -L * 0.44, -L * 0.44, L * 0.88, L * 0.88);
    x.restore();
  });
});
await p.screenshot({ path: out });
await b.close();
await server.close();
