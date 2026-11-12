import { chromium } from 'playwright';
import { preview } from 'vite';
const out = process.argv[2];
const server = await preview({ preview: { port: 4178, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const list = [
  ['kano', 'old', 0],
  ['kano', 'dala', 0],
  ['doha', 'msheireb', 0],
  ['doha', 'pearl', 0],
  ['doha', 'lusail', 1],
  ['singapore', 'marina', 1],
  ['singapore', 'gardens', 0],
  ['singapore', 'river', 0],
  ['singapore', 'changi', 1],
];
for (const [city, circ, night] of list) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log(city, circ, 'ERR', e.message));
  await p.addInitScript(
    ([c, k, n]) => {
      localStorage.clear();
      const set = (a, v) => localStorage.setItem('gukart.' + a, JSON.stringify(v));
      set('city', c);
      set('circuit.' + c, k);
      set('night', !!n);
    },
    [city, circ, night],
  );
  await p.goto('http://127.0.0.1:4178/?gktest#capture');
  await p.waitForFunction(() => window.gukart?.ready, null, { timeout: 240000 });
  await p.evaluate(() => {
    for (const e of document.querySelectorAll('body > *'))
      if (!e.querySelector('canvas') && e.tagName !== 'CANVAS') e.style.display = 'none';
    const gl = document.getElementById('gl');
    if (gl) {
      gl.className = '';
      gl.style.filter = 'none';
    }
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track;
    game.world.startLights(3);
    const F = tr.frame(tr.len - 34, tr.newFrame());
    cam.position.copy(F.p).addScaledVector(F.u, 3).addScaledVector(F.l, 3);
    const q = tr.point(0, 0);
    cam.lookAt(q.x, q.y + 8, q.z);
    cam.fov = 60;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  });
  await p.screenshot({ path: `${out}/gate-${city}-${circ}.jpg`, type: 'jpeg', quality: 80 });
  await p.close();
}
await b.close();
await server.close();
