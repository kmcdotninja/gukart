// Road check: loads a circuit in a headless browser and looks for anything solid standing on the road.
//   1. tr.blocked: buildings, walls and trees the placement guard (clearOfRoad in world.js) left out, with where they were
//   2. a sweep of rays along every lane at kart height, listing big static things they hit (expected: jump ramps, the
//      barriers where the road splits at a fork, tunnel mouths; anything else is a bug)
// With the dev server running (npm run dev, port 5191):  node tools/road-check.mjs kano | doha msheireb | doha pearl | doha lusail
// Needs Playwright (npm i -D playwright, or point CHROME at a Chromium build).
import { chromium } from 'playwright';
const [city, circ] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('pageerror', e => console.log('ERR', e.message));
p.on('console', m => {
  if (m.text().includes('[gukart]')) console.log(m.text());
});
await p.addInitScript(
  ([city, c]) => {
    localStorage.setItem('gudu.city', JSON.stringify(city));
    if (c) localStorage.setItem('gudu.circuit.doha', JSON.stringify(c));
  },
  [city, circ],
);
await p.goto('http://localhost:5191/#capture', { waitUntil: 'commit', timeout: 0 });
await p.waitForFunction(() => window.gudu?.ready, null, { timeout: 300000 });
const r = await p.evaluate(async () => {
  const g = window.gudu,
    tr = g.track,
    THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
  const RC = THREE ? new THREE.Raycaster() : null;
  if (!RC) return { err: 'no three' };
  const objs = [];
  g.scene.children.forEach(o => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    o.geometry.computeBoundingBox();
    const sz = o.geometry.boundingBox.getSize(new THREE.Vector3());
    if (o.isInstancedMesh || Math.max(sz.x, sz.y, sz.z) > 3) objs.push(o);
  });
  const hits = new Map();
  for (let i = 0; i < tr.P.length; i += 2) {
    const P = tr.P[i],
      T = tr.T[i],
      U = tr.U ? tr.U[i] : { x: 0, y: 1, z: 0 },
      L = tr.L[i];
    for (const lat of [-11, -6, 0, 6, 11])
      for (const h of [0.8, 2.5]) {
        RC.set(
          new THREE.Vector3(P.x + L.x * lat + U.x * h, P.y + L.y * lat + U.y * h, P.z + L.z * lat + U.z * h),
          new THREE.Vector3(T.x, T.y, T.z).normalize(),
        );
        RC.far = 4;
        for (const x of RC.intersectObjects(objs, false)) {
          const n = x.face ? x.face.normal.clone().transformDirection(x.object.matrixWorld) : null;
          if (n && Math.abs(n.dot(new THREE.Vector3(T.x, T.y, T.z).normalize())) < 0.35) continue; // grazing a side wall along the road
          if (x.instanceId != null) {
            const M = new THREE.Matrix4();
            x.object.getMatrixAt(x.instanceId, M);
            const sc = new THREE.Vector3();
            M.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
            x.object.geometry.computeBoundingBox();
            const sz = x.object.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(sc);
            if (Math.max(sz.x, sz.y, sz.z) < 3) continue;
          }
          const col =
              (Array.isArray(x.object.material) ? x.object.material[0] : x.object.material)?.color?.getHexString?.() ||
              '?',
            key = (x.object.name || x.object.type) + ':' + col + ':' + Math.round((i * tr.len) / tr.P.length / 20) * 20;
          if (!hits.has(key))
            hits.set(key, {
              obj: x.object.name || x.object.type,
              col,
              s: Math.round((i * tr.len) / tr.P.length),
              lat,
              h,
              inst: x.instanceId != null,
              at: [+x.point.x.toFixed(0), +x.point.z.toFixed(0)],
              mat: x.object.material?.map ? 'tex' : '',
            });
        }
      }
  }
  return { blocked: tr.blocked || [], hits: [...hits.values()] };
});
console.log('blocked', JSON.stringify(r.blocked));
for (const h of r.hits || []) console.log(JSON.stringify(h));
if (r.err) console.log(r.err);
await b.close();
