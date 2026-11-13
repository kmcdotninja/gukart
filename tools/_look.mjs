// node tools/_look.mjs <out.jpg> <city> <circuit> <s> [side] [height] [night]: one look at a stretch of road from the side
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ, s, side = '60', ht = '18', night = '0'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4175, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(
  ([cy, c, n]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
    localStorage.setItem('gukart.night', n === '1' ? 'true' : 'false');
  },
  [city, circ, night],
);
await p.goto('http://127.0.0.1:4175/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(800);
await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
});
await p.evaluate(
  ([s, side, ht]) => {
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track;
    window.gukart.frozen = true;
    const q = tr.point(s, side),
      t = tr.point(s, 0);
    cam.position.set(q.x, q.y + ht, q.z);
    cam.lookAt(t.x, t.y + 4, t.z);
    cam.fov = 70;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  },
  [+s, +side, +ht],
);
await p.screenshot({ path: out, type: 'jpeg', quality: 80 });
await b.close();
await server.close();
