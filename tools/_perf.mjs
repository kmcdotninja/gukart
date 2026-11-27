import { chromium } from 'playwright';
import { preview } from 'vite';
// node tools/_perf.mjs [cities]: for each city's first circuit, stands a chase camera at six points round the track and
// measures a frame: draw calls and triangles with and without the shadow pass, the time to draw it (GPU-synced), and the
// shadow casters (how many, how many are small props). Run `npm run build` first (it measures the real build).
const cities = (process.argv[2] || 'kano,doha,kaduna,abuja,abudhabi,singapore').split(',');
const server = await preview({ preview: { port: 4175, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const city of cities) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.addInitScript(cy => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.night', 'false');
  }, city);
  await p.goto('http://127.0.0.1:4175/?gktest#capture');
  try {
    await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 240000 });
  } catch {
    console.log(city, 'NO LOAD');
    await p.close();
    continue;
  }
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const { game, cam, renderer, scene } = window.gukart,
      tr = game.track,
      gl = renderer.getContext(),
      px = new Uint8Array(4);
    window.gukart.frozen = true;
    renderer.info.autoReset = true;
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const time = n => {
      sync();
      const t = performance.now();
      for (let i = 0; i < n; i++) renderer.render(scene, cam);
      sync();
      return (performance.now() - t) / n;
    };
    // shadow casters in the city
    let casters = 0,
      small = 0;
    const box = new (scene.position.constructor)();
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || !o.castShadow || !o.visible) return;
      casters++;
      o.geometry.computeBoundingSphere?.();
      const rad = (o.geometry.boundingSphere?.radius || 0) * o.getWorldScale(box).x;
      if (!o.isInstancedMesh && rad < 1.5) small++;
    });
    const L = tr.length || tr.total || 1000,
      out = [];
    for (let k = 0; k < 6; k++) {
      const s = (L * (k + 0.5)) / 6,
        a = tr.point(s, 0),
        f = tr.point(s + 12, 0);
      const dx = f.x - a.x,
        dz = f.z - a.z,
        d = Math.hypot(dx, dz) || 1;
      cam.position.set(a.x - (dx / d) * 9, a.y + 4, a.z - (dz / d) * 9);
      cam.lookAt(f.x, f.y + 1.5, f.z);
      cam.updateMatrixWorld();
      // the sun follows the camera spot, as in a race (src/camera.js)
      const sun = scene.children.find(o => o.isDirectionalLight);
      if (sun) {
        const dir = sun.position.clone().sub(sun.target.position);
        sun.target.position.set(a.x, 0, a.z);
        sun.position.copy(sun.target.position).add(dir);
        sun.target.updateMatrixWorld();
      }
      renderer.shadowMap.autoUpdate = true;
      renderer.render(scene, cam);
      const on = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, ms: time(20) };
      renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, cam);
      const off = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, ms: time(20) };
      renderer.shadowMap.autoUpdate = true;
      out.push({ on, off });
    }
    return { casters, small, out };
  });
  const avg = (k, f) => r.out.reduce((a, x) => a + x[k][f], 0) / r.out.length,
    max = (k, f) => Math.max(...r.out.map(x => x[k][f]));
  console.log(
    `${city.padEnd(10)} casters ${r.casters} (small ${r.small}) | with shadows: ${avg('on', 'calls').toFixed(0)} draws (max ${max('on', 'calls')}), ${(avg('on', 'tris') / 1000).toFixed(0)}k tris, ${avg('on', 'ms').toFixed(2)} ms (max ${max('on', 'ms').toFixed(2)}) | shadow pass off: ${avg('off', 'calls').toFixed(0)} draws, ${(avg('off', 'tris') / 1000).toFixed(0)}k tris, ${avg('off', 'ms').toFixed(2)} ms`,
  );
  await p.close();
}
await b.close();
server.httpServer.close();
