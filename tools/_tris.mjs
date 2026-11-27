import { chromium } from 'playwright';
import { preview } from 'vite';
// node tools/_tris.mjs [city]: where a frame's triangles come from (the biggest meshes drawn), and the shadow pass's own cost
const city = process.argv[2] || 'kano';
const server = await preview({ preview: { port: 4176, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.addInitScript(cy => { localStorage.clear(); localStorage.setItem('gukart.city', JSON.stringify(cy)); }, city);
await p.goto('http://127.0.0.1:4176/?gktest#capture');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 240000 });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const { game, cam, renderer, scene } = window.gukart, tr = game.track;
  window.gukart.frozen = true;
  const a = tr.point(200, 0), f = tr.point(212, 0);
  cam.position.set(a.x - (f.x - a.x) * 0.75, a.y + 4, a.z - (f.z - a.z) * 0.75);
  cam.lookAt(f.x, f.y + 1.5, f.z); cam.updateMatrixWorld();
  const tri = o => { const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position?.count || 0;
    return (n / 3) * (o.isInstancedMesh ? o.count : 1); };
  // what got drawn: hook every object's onBeforeRender for one frame
  const drawn = new Map(), seen = [];
  scene.traverse(o => { if (o.isMesh || o.isInstancedMesh) { const prev = o.onBeforeRender;
    o.onBeforeRender = function (...x) { drawn.set(o, (drawn.get(o) || 0) + 1); return prev.apply(this, x); }; seen.push([o, prev]); } });
  renderer.info.autoReset = false; renderer.info.reset();
  renderer.render(scene, cam);
  const all = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  renderer.info.reset(); renderer.shadowMap.autoUpdate = false; renderer.render(scene, cam); renderer.shadowMap.autoUpdate = true;
  const main = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  renderer.info.autoReset = true;
  for (const [o, prev] of seen) o.onBeforeRender = prev;
  let total = 0; scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible) total += tri(o); });
  const name = o => { let s = o.name || o.geometry.type; let q = o.parent; while (q && !q.name) q = q.parent; return (q?.name ? q.name + '/' : '') + s; };
  const top = [...drawn.keys()].map(o => ({ n: name(o), t: tri(o), cull: o.frustumCulled, sh: o.castShadow, r: Math.round(o.geometry.boundingSphere?.radius || 0) }))
    .sort((x, y) => y.t - x.t).slice(0, 18);
  let ibg = 0, ibgN = 0; const ibgNames = new Set(); for (const [o] of drawn) if (o.geometry.isInstancedBufferGeometry) { ibg += tri(o) * o.geometry.instanceCount; ibgN++; let q = o; const path = []; while (q) { if (q.name) path.push(q.name); q = q.parent; } ibgNames.add(path.slice(0, 3).join("<") || o.material.type); }
  window.__ibg = { ibg, ibgN, names: [...ibgNames].slice(0, 15) };
  let drawnSum = 0; const big = []; for (const [o, k] of drawn) { const g = o.geometry; drawnSum += tri(o) * k; if (o.isInstancedMesh || g.isInstancedBufferGeometry) big.push({ n: name(o), count: o.count, ic: g.instanceCount, t: tri(o), k }); if (k > 1) big.push({ n: "x" + k + " " + name(o), t: tri(o) }); }
  return { ibgInfo: window.__ibg, all, main, total, top, drawnSum, big: big.sort((a, b) => (b.ic === Infinity) - (a.ic === Infinity) || b.t - a.t).slice(0, 12) };
});
console.log(city, 'whole frame', r.all, '| main pass only', r.main, '| shadow pass', { calls: r.all.calls - r.main.calls, tris: r.all.tris - r.main.tris }, '| whole city', Math.round(r.total / 1000) + 'k tris');
console.log("drawn sum", r.drawnSum, "instanced-geometry tris", r.ibgInfo);
for (const t of r.top) console.log(`  ${(t.t / 1000).toFixed(0).padStart(5)}k  radius ${String(t.r).padStart(5)}  culled:${t.cull ? 'y' : 'N'} shadow:${t.sh ? 'y' : 'n'}  ${t.n}`);
await b.close(); server.httpServer.close();
