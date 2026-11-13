// node tools/_tunnel.mjs <outdir> <city> <circuit>: a tunnel from the chase camera: the approach, inside, the way out, and from above
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ] = process.argv.slice(2);
const server = await preview({ preview: { port: 4182, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4182/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(600);
const T = await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  window.gukart.frozen = true;
  for (const k of window.gukart.game.race.all) k.m.root.visible = false;
  const f = window.gukart.game.track.feats.find(q => q.type === 'tunnel');
  return { s: f.s, len: f.len };
});
const views = [
  [T.s - 90, 0, 3.8, 'approach'],
  [T.s - 25, 0, 3.8, 'mouth'],
  [T.s + 30, 0, 3.8, 'in'],
  [T.s + T.len / 2, 0, 3.8, 'mid'],
  [T.s + T.len - 30, 0, 3.8, 'out'],
  [T.s + T.len / 2, 150, 90, 'air'],
];
let n = 0;
for (const [s, side, ht, name] of views) {
  await p.evaluate(
    ([s, side, ht, name]) => {
      const { game, cam, renderer, scene } = window.gukart,
        tr = game.track;
      if (name === 'air') {
        const q = tr.point(s, side),
          t = tr.point(s, 0);
        cam.position.set(q.x, ht, q.z);
        cam.lookAt(t.x, 0, t.z);
      } else {
        const k = tr.point(s + 12, 0),
          q = tr.point(s, 0);
        cam.position.set(q.x, q.y + ht, q.z);
        cam.lookAt(k.x, k.y + 2, k.z);
      }
      cam.fov = 70;
      cam.far = 5000;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
    [s, side, ht, name],
  );
  await p.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${name}.jpg`, type: 'jpeg', quality: 75 });
}
console.log('tunnel', T);
await b.close();
await server.close();
