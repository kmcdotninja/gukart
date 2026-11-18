// node tools/_loader.mjs <outdir>: renders the loader images from poster.html on the dev server (localhost:5175): the
// drift poster and its hero cut-out (webp) and the pack poster, each for desk and phone
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const save = (name, url) => writeFileSync(`${out}/${name}`, Buffer.from(url.split(',')[1], 'base64'));
for (const shot of ['drift', 'pack'])
  for (const f of ['desk', 'phone']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', e => console.log('page error:', e.message));
    await p.goto(`http://localhost:5175/poster.html?f=${f}&shot=${shot}`);
    await p.waitForFunction(() => typeof window.__poster === 'function', null, { timeout: 120000 });
    await p.waitForTimeout(3000);
    save(`loader-${shot}-${f}.jpg`, await p.evaluate(() => window.__poster()));
    if (shot === 'drift') {
      // (the cut-out is trimmed to Buddy and his truck; the loader places it by its box, as fractions of the frame:
      // #loading .ld-hero in src/style.css)
      const webp = await p.evaluate(async () => {
        const h = window.__hero();
        const img = new Image();
        img.src = h.png;
        await img.decode();
        const W = img.width,
          H = img.height,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const a = x.getImageData(0, 0, W, H).data;
        let x0 = W,
          y0 = H,
          x1 = 0,
          y1 = 0;
        for (let y = 0; y < H; y++)
          for (let xx = 0; xx < W; xx++)
            if (a[(y * W + xx) * 4 + 3] > 8) {
              if (xx < x0) x0 = xx;
              if (xx > x1) x1 = xx;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
        const cw = x1 - x0 + 1,
          ch = y1 - y0 + 1,
          o = document.createElement('canvas');
        o.width = cw;
        o.height = ch;
        o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
        return { url: o.toDataURL('image/webp', 0.86), head: h.head, box: [x0 / W, y0 / H, cw / W, cw, ch] };
      });
      save(`loader-drift-${f}-hero.webp`, webp.url);
      console.log(
        f,
        'box left/top/width %',
        (webp.box[0] * 100).toFixed(2),
        (webp.box[1] * 100).toFixed(2),
        (webp.box[2] * 100).toFixed(2),
        'px',
        webp.box[3],
        webp.box[4],
      );
      console.log(f, 'head', webp.head.map(v => v.toFixed(3)).join(','));
    }
    await p.close();
  }
await b.close();
