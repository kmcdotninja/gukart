// node tools/_night.mjs <out.jpg> <city> <circuit> <feature> <offset> [side] [height]: a set piece at night, from beside
// the road (offset metres from where the named feature starts)
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ, feat, off, side = '-80', ht = '30'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4185, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
    localStorage.setItem('gukart.night', 'true');
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4185/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(800);
await p.evaluate(
  ([feat, off, side, ht]) => {
    for (const e of document.querySelectorAll('body > *:not(canvas)'))
      if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track;
    window.gukart.frozen = true;
    const s = tr.feats.find(f => f.type === feat).s + off,
      q = tr.point(s, side),
      t = tr.point(s + 60, 0);
    cam.position.set(q.x, ht, q.z);
    cam.lookAt(t.x, 10, t.z);
    cam.fov = 70;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  },
  [feat, +off, +side, +ht],
);
await p.screenshot({ path: out, type: 'jpeg', quality: 80 });
await b.close();
await server.close();
