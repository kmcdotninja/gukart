// Road check: loads a circuit in a headless browser and looks for anything solid standing on the road.
//   1. tr.blocked: buildings, walls and trees the placement guard (clearOfRoad in world.js) left out, with where they were
//   2. a sweep of rays along every lane at kart height, listing big static things they hit (expected: jump ramps, the
//      barriers where the road splits at a fork, tunnel mouths; anything else is a bug)
// With the dev server running (npm run dev, port 5191):  node tools/road-check.mjs kano | kano dala | doha msheireb | doha pearl | doha lusail
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
    localStorage.setItem('gukart.city', JSON.stringify(city));
    if (c) localStorage.setItem('gukart.circuit.' + city, JSON.stringify(c));
  },
  [city, circ],
);
await p.goto('http://localhost:5191/#capture', { waitUntil: 'commit', timeout: 0 });
await p.waitForFunction(() => window.gukart?.ready, null, { timeout: 300000 });
const r = await p.evaluate(async () => {
  const g = window.gukart,
    tr = g.game.track,
    THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
  const RC = THREE ? new THREE.Raycaster() : null;
  if (!RC) return { err: 'no three' };
  // every solid thing in the scene, inside groups too (signs, gantries, landmarks), but not the karts or see-through
  // things (glass, nets), and only pieces over 3 m (smaller parts belong to something bigger that's caught anyway)
  const objs = [],
    karts = new Set();
  for (const k of g.game.race?.all || []) k.m?.root?.traverse?.(o => karts.add(o));
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible || karts.has(o)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.transparent && m.opacity < 0.5) return;
    let v = o;
    while (v) {
      if (!v.visible) return;
      v = v.parent;
    }
    o.geometry.computeBoundingBox();
    const sz = o.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(o.getWorldScale(new THREE.Vector3()));
    if (o.isInstancedMesh || Math.max(sz.x, sz.y, sz.z) > 3) objs.push(o);
  });
  // a grid of 20 m cells over the ground, each listing the solid things that reach into it, so each ray is only
  // tested against what's nearby (thousands of meshes against every point of every lane took many minutes)
  const CELL = 20,
    grid = new Map(),
    always = [];
  // (a mesh drawn many times over, a town's houses or its trees, goes into the grid copy by copy as a box: tested
  // against every ray, thousands of copies made one circuit take most of an hour)
  const boxes = new Map(),
    M4 = new THREE.Matrix4();
  for (const o of objs) {
    if (o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      for (let n = 0; n < o.count; n++) {
        o.getMatrixAt(n, M4);
        const bb = o.geometry.boundingBox.clone().applyMatrix4(M4.premultiply(o.matrixWorld));
        const sz = bb.getSize(new THREE.Vector3());
        if (Math.max(sz.x, sz.y, sz.z) < 3) continue;
        const entry = { box: bb, mesh: o, id: n };
        for (let cx = Math.floor(bb.min.x / CELL); cx <= Math.floor(bb.max.x / CELL); cx++)
          for (let cz = Math.floor(bb.min.z / CELL); cz <= Math.floor(bb.max.z / CELL); cz++) {
            const k = cx + ',' + cz;
            (boxes.get(k) || boxes.set(k, []).get(k)).push(entry);
          }
      }
      continue;
    }
    const bb = new THREE.Box3().setFromObject(o);
    const cx0 = Math.floor(bb.min.x / CELL),
      cx1 = Math.floor(bb.max.x / CELL),
      cz0 = Math.floor(bb.min.z / CELL),
      cz1 = Math.floor(bb.max.z / CELL);
    if ((cx1 - cx0 + 1) * (cz1 - cz0 + 1) > 900) {
      always.push(o);
      continue;
    }
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = cx + ',' + cz;
        (grid.get(k) || grid.set(k, []).get(k)).push(o);
      }
  }
  const near = (x, z) => {
    const set = new Set(always);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const o of grid.get(Math.floor(x / CELL) + dx + ',' + (Math.floor(z / CELL) + dz)) || []) set.add(o);
    return [...set];
  };
  const hitPt = new THREE.Vector3();
  const nearBoxes = (x, z) => {
    const out = [],
      seen = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const e of boxes.get(Math.floor(x / CELL) + dx + ',' + (Math.floor(z / CELL) + dz)) || []) {
          if (seen.has(e)) continue;
          seen.add(e);
          if (RC.ray.intersectBox(e.box, hitPt) && hitPt.distanceTo(RC.ray.origin) <= RC.far)
            out.push({ object: e.mesh, instanceId: e.id, point: hitPt.clone(), face: null, box: true });
        }
    return out;
  };
  const hits = new Map();
  // the ways a kart can drive: the main road (not the closed stretch at a fork), and each branch of a fork
  const ways = [
    {
      name: 'road',
      P: tr.P,
      T: tr.T,
      L: tr.L,
      U: tr.U,
      lats: [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12],
      skip: i => tr.closed?.[i],
    },
  ];
  for (const f of tr.forks || [])
    ways.push({
      name: f.tunnel ? 'subway' : 'skybridge',
      P: f.P,
      T: f.T,
      L: f.L,
      U: null,
      lats: [-9, -7, -5, -3, -1, 1, 3, 5, 7, 9],
      skip: () => false,
      f,
    });
  for (const way of ways)
    for (let i = 0; i < way.P.length; i += 1) {
      if (way.skip(i)) continue;
      const P = way.P[i],
        T = way.T[i],
        U = way.U ? way.U[i] : { x: 0, y: 1, z: 0 },
        L = way.L[i];
      for (const lat of way.lats)
        for (const h of [0.8, 2.5, 4.5]) {
          RC.set(
            new THREE.Vector3(P.x + L.x * lat + U.x * h, P.y + L.y * lat + U.y * h, P.z + L.z * lat + U.z * h),
            new THREE.Vector3(T.x, T.y, T.z).normalize(),
          );
          RC.far = 4;
          for (const x of [...RC.intersectObjects(near(P.x, P.z), false), ...nearBoxes(P.x, P.z)]) {
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
                (Array.isArray(x.object.material)
                  ? x.object.material[0]
                  : x.object.material
                )?.color?.getHexString?.() || '?',
              sAt = way.f
                ? Math.round(way.f.sA + (i / way.P.length) * (way.f.sB - way.f.sA))
                : Math.round((i * tr.len) / tr.P.length),
              key = way.name + ':' + (x.object.name || x.object.type) + ':' + col + ':' + Math.round(sAt / 20) * 20;
            if (!hits.has(key))
              hits.set(key, {
                way: way.name,
                obj: x.object.name || x.object.type,
                parent: x.object.parent?.type === 'Group' ? 'in a group' : '',
                col,
                size: [...new THREE.Box3().setFromObject(x.object).getSize(new THREE.Vector3())].map(
                  v => +v.toFixed(1),
                ),
                s: sAt,
                lat,
                h,
                inst: x.instanceId != null,
                at: [+x.point.x.toFixed(0), +x.point.z.toFixed(0)],
                mat: x.object.material?.map ? 'tex' : '',
              });
          }
        }
    }
  // the joints: where each fork branch leaves the road and rejoins it, how far its surface is from the road's
  const joints = [];
  for (const f of tr.forks || [])
    for (const [bi, ri] of [
      [0, f.a],
      [f.M, f.b],
    ]) {
      const q = f.P[bi],
        r = tr.P[tr.wrap(ri)];
      joints.push({
        way: f.tunnel ? 'subway' : 'skybridge',
        end: bi ? 'rejoins' : 'leaves',
        dy: +(q.y - r.y).toFixed(2),
      });
    }
  return { blocked: tr.blocked || [], hits: [...hits.values()], joints };
});
console.log('blocked', JSON.stringify(r.blocked));
for (const h of r.hits || []) console.log(JSON.stringify(h));
for (const j of r.joints || []) if (Math.abs(j.dy) > 0.05) console.log('joint', JSON.stringify(j));
if (r.err) console.log(r.err);
await b.close();
