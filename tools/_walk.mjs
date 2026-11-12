import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, circ, types] = process.argv.slice(2);
const server = await preview({ preview: { port: 4177, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(c => {
  localStorage.clear();
  localStorage.setItem('gukart.city', '"singapore"');
  localStorage.setItem('gukart.circuit.singapore', JSON.stringify(c));
  localStorage.setItem('gukart.night', 'true');
}, circ);
await p.goto('http://127.0.0.1:4177/?gktest#capture');
await p.waitForFunction(() => window.gukart?.ready, null, { timeout: 240000 });
await p.evaluate(() => {
  for (const e of document.querySelectorAll('body > *'))
    if (!e.querySelector('canvas') && e.tagName !== 'CANVAS') e.style.display = 'none';
  for (const c of document.querySelectorAll('canvas, canvas *, body > *')) {
    c.style.filter = 'none';
    c.style.backdropFilter = 'none';
  }
  document.body.className = '';
});
const spans = await p.evaluate(
  ts =>
    window.gukart.game.track.feats
      .filter(f => ts.includes(f.type))
      .map(f => [f.type, Math.round(f.s), Math.round(f.len || 0)]),
  types.split(','),
);
console.log(JSON.stringify(spans));
let n = 0;
for (const [t, s0, len] of spans)
  for (let s = s0 - 40; s <= s0 + len + 20; s += 20) {
    await p.evaluate(s => {
      const { game, cam, renderer, scene } = window.gukart,
        tr = game.track,
        F = tr.frame(s, tr.newFrame());
      cam.position.copy(F.p).addScaledVector(F.u, 3.2);
      const ahead = tr.frame(s + 25, tr.newFrame()).p;
      cam.lookAt(ahead.x, ahead.y + 2, ahead.z);
      cam.fov = 70;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    }, s);
    await p.screenshot({
      path: `${out}/walk-${String(n++).padStart(2, '0')}-${t}-${s}.jpg`,
      type: 'jpeg',
      quality: 75,
    });
  }
for (const [t, s0, len] of spans) {
  await p.evaluate(
    ([s0, len]) => {
      const { game, cam, renderer, scene } = window.gukart,
        tr = game.track,
        c = tr.point(s0 + len / 2, 0);
      cam.position.set(c.x + 60, 170, c.z + 60);
      cam.lookAt(c.x, 0, c.z);
      cam.fov = 60;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
    [s0, len],
  );
  await p.screenshot({ path: `${out}/top-${t}-${s0}.jpg`, type: 'jpeg', quality: 75 });
}
await b.close();
await server.close();
