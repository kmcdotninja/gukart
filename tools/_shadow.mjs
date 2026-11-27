import { chromium } from 'playwright';
import { preview } from 'vite';
// node tools/_shadow.mjs [city]: what the shadow pass draws, grouped by where it lives in the scene
const city = process.argv[2] || 'kano';
const server = await preview({ preview: { port: 4177, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.addInitScript(cy => { localStorage.clear(); localStorage.setItem('gukart.city', JSON.stringify(cy)); }, city);
await p.goto('http://127.0.0.1:4177/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 240000 });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const { game, cam, renderer, scene } = window.gukart, tr = game.track;
  window.gukart.frozen = true;
  const a = tr.point(200, 0), f = tr.point(212, 0);
  cam.position.set(a.x - (f.x - a.x) * 0.75, a.y + 4, a.z - (f.z - a.z) * 0.75);
  cam.lookAt(f.x, f.y + 1.5, f.z); cam.updateMatrixWorld();
  const sun = scene.children.find(o => o.isDirectionalLight), dir = sun.position.clone().sub(sun.target.position);
  sun.target.position.set(a.x, 0, a.z); sun.position.copy(sun.target.position).add(dir); sun.target.updateMatrixWorld();
  const hits = new Map(), hooks = [];
  scene.traverse(o => { if (o.castShadow && (o.isMesh || o.isInstancedMesh)) { const pr = o.onBeforeShadow;
    o.onBeforeShadow = function (...x) { hits.set(o, (hits.get(o) || 0) + 1); return pr.apply(this, x); }; hooks.push([o, pr]); } });
  renderer.render(scene, cam);
  for (const [o, pr] of hooks) o.onBeforeShadow = pr;
  const top = o => { let q = o, last = o; while (q.parent && q.parent !== scene) { last = q; q = q.parent; } return q; };
  const groups = {};
  let small = 0, noCull = 0, inst = 0;
  const sz = new (scene.position.constructor)();
  for (const [o] of hits) {
    const t = top(o), k = (t.name || t.type) + (t === game.world?.group || t === game.world?.root ? ' (world)' : '');
    groups[k] = (groups[k] || 0) + 1;
    o.geometry.computeBoundingSphere?.();
    const rad = (o.geometry.boundingSphere?.radius || 0) * o.getWorldScale(sz).x;
    if (rad < 1.5) small++; if (!o.frustumCulled) noCull++; if (o.isInstancedMesh) inst++;
  }
  const worldKeys = game.world ? Object.keys(game.world).filter(k => game.world[k]?.isObject3D) : [];
  let calls = 0; for (const v of hits.values()) calls += v;
  const lights = []; scene.traverse(o => { if (o.isLight && o.castShadow) lights.push(o.type + ' ' + (o.name || '') + ' vis=' + o.visible + ' map=' + (o.shadow.mapSize.x)); });
  const big = [...hits].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([o, v]) => v + 'x ' + (o.name || o.geometry.type) + ' mats=' + (Array.isArray(o.material) ? o.material.length : 1) + ' groups=' + o.geometry.groups.length);
  return { calls, lights, big, n: hits.size, small, noCull, inst, groups: Object.entries(groups).sort((x, y) => y[1] - x[1]).slice(0, 12), worldKeys };
});
console.log(r);
await b.close(); server.httpServer.close();
