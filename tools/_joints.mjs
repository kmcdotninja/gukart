// node tools/_joints.mjs <outdir> <city> <circuit>: where the road goes onto and comes off each bridge, from the
// driver's seat and from the side, to see that deck and road meet with nothing in between
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ] = process.argv.slice(2);
const server = await preview({ preview: { port: 4180, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 520 } });
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4180/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(600);
const ends = await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  window.gukart.frozen = true;
  for (const k of window.gukart.game.race.all) k.m.root.visible = false;
  const tr = window.gukart.game.track,
    out = [];
  for (let i = 0; i < tr.N; i++) {
    const a = tr.elevated[i],
      b = tr.elevated[(i + 1) % tr.N];
    if (a !== b) out.push({ s: (i * tr.len) / tr.N, down: !!a });
  }
  return out;
});
let n = 0;
for (const e of ends) {
  for (const view of ['drive', 'side']) {
    await p.evaluate(
      ([e, view]) => {
        const { game, cam, renderer, scene } = window.gukart,
          tr = game.track;
        if (view === 'drive') {
          const q = tr.point(e.s - (e.down ? 25 : 35), 0),
            t = tr.point(e.s + 10, 0);
          cam.position.set(q.x, q.y + 3.2, q.z);
          cam.lookAt(t.x, t.y + 1, t.z);
        } else {
          const q = tr.point(e.s, 34),
            t = tr.point(e.s, 0);
          cam.position.set(q.x, Math.max(q.y, 0) + 4, q.z);
          cam.lookAt(t.x, Math.max(t.y - 2, 0), t.z);
        }
        cam.fov = 70;
        cam.updateProjectionMatrix();
        renderer.render(scene, cam);
      },
      [e, view],
    );
    await p.screenshot({
      path: `${out}/${city}-${circ}-${n}-${e.down ? 'off' : 'on'}-${view}.jpg`,
      type: 'jpeg',
      quality: 70,
    });
  }
  n++;
}
console.log(ends.length, 'bridge ends');
await b.close();
await server.close();
