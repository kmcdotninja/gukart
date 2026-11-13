// node tools/_fork.mjs <outdir> <city> <circuit>: the fork from the driver's seat — the split ahead, along each branch,
// and where each branch comes back down to the road — to look for anything in the way or a joint that doesn't meet
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ] = process.argv.slice(2);
const server = await preview({ preview: { port: 4179, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4179/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(600);
await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  window.gukart.frozen = true;
  for (const k of window.gukart.game.race.all) k.m.root.visible = false;
});
const views = await p.evaluate(() => {
  const tr = window.gukart.game.track,
    out = [];
  (tr.forks || []).forEach((f, n) => {
    out.push({ name: `fork${n}-approach`, kind: 'road', s: f.sA - 40, ahead: 40 });
    for (const u of [0.05, 0.3, 0.5, 0.75, 0.93])
      out.push({ name: `fork${n}-${f.tunnel ? 'sub' : 'sky'}-${u}`, kind: 'branch', n, u });
  });
  return out;
});
for (const v of views) {
  await p.evaluate(v => {
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track;
    let pos, look;
    if (v.kind === 'road') {
      const q = tr.point(v.s, 0),
        t = tr.point(v.s + v.ahead, 0);
      pos = [q.x, q.y + 3.2, q.z];
      look = [t.x, t.y + 2, t.z];
    } else {
      const f = tr.forks[v.n],
        i = Math.round(v.u * f.M),
        j = Math.min(f.M, i + 14),
        q = f.P[i],
        t = f.P[j];
      pos = [q.x, q.y + 3.2, q.z];
      look = [t.x, t.y + 2, t.z];
    }
    cam.position.set(...pos);
    cam.lookAt(...look);
    cam.fov = 75;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }, v);
  await p.screenshot({ path: `${out}/${v.name}.jpg`, type: 'jpeg', quality: 75 });
}
console.log(views.map(v => v.name).join(' '));
await b.close();
await server.close();
