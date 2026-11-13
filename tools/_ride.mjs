// node tools/_ride.mjs <outdir> <city> <circuit> <feature> <offsets,...>: the chase camera's view at points along the
// road, each an offset in metres from where the named feature starts (to see what the driver sees through a set piece)
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ, feat, offs] = process.argv.slice(2);
const server = await preview({ preview: { port: 4183, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
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
await p.goto('http://127.0.0.1:4183/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(600);
const s0 = await p.evaluate(feat => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  window.gukart.frozen = true;
  for (const k of window.gukart.game.race.all) k.m.root.visible = false;
  return window.gukart.game.track.feats.find(f => f.type === feat).s;
}, feat);
let n = 0;
for (const d of offs.split(',').map(Number)) {
  await p.evaluate(s => {
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track,
      q = tr.point(s - 8, 0),
      k = tr.point(s + 22, 0);
    cam.position.set(q.x, q.y + 4, q.z);
    cam.lookAt(k.x, k.y + 3, k.z);
    cam.fov = 72;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }, s0 + d);
  await p.screenshot({ path: `${out}/ride-${String(n++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 72 });
}
await b.close();
await server.close();
