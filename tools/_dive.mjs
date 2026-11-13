// node tools/_dive.mjs <outdir> <city> <circuit>: the chase camera's view going down into an underwater tube, frame by frame
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, city, circ] = process.argv.slice(2);
const server = await preview({ preview: { port: 4181, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
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
await p.goto('http://127.0.0.1:4181/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(600);
const s0 = await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *:not(canvas)'))
    if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  window.gukart.frozen = true;
  const tr = window.gukart.game.track;
  for (let i = 0; i < tr.N; i++) if (tr.lowb[i] && tr.P[i].y < -1) return i * tr.seg;
  return null;
});
let n = 0;
for (let d = -30; d <= 90; d += 15) {
  await p.evaluate(s => {
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track,
      k = tr.point(s, 0),
      q = tr.point(s - 9, 0);
    cam.position.set(q.x, q.y + 3.8, q.z); // (behind and above, as the chase camera rides)
    cam.lookAt(k.x, k.y + 1.2, k.z);
    cam.fov = 70;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }, s0 + d);
  await p.screenshot({ path: `${out}/dive-${String(n++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 });
}
console.log('tube starts at', s0);
await b.close();
await server.close();
