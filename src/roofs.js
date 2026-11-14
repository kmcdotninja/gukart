// Rideable roofs: anything built over the road (a tube's top, a tunnel's or a hall's roof, a deck, the ground over an
// underpass) is a surface a car coming down from above lands on and drives along, as it would the road, dropping back
// down where it ends. Worked out once a circuit is built: down the whole lap, a look straight down from high above the
// road, across its width, for the first solid top over it. Returns, for each point of the track, how high over the road
// that top is (0 where nothing covers the road). src/race.js lands karts on it.
import * as THREE from 'three';
import { W } from './track.js';

// fills `out` (one height per track point) a slice at a time between frames, so it never holds up loading or a race
// (roofs only matter once a car is in the air); out starts all 0 and the roofs appear as it goes
export function roofHeights(tr, scene, skip = [], out = new Float32Array(tr.N)) {
  const N = tr.N,
    skipSet = new Set(skip),
    cands = [],
    box = new THREE.Box3(),
    sz = new THREE.Vector3();
  // what could be a roof: solid meshes of some size (not the karts, sprites, the sky or the whole ground, not
  // instanced crowds of trees and houses) that reach over the road somewhere; each filed under the stretches of road
  // it's over, so a look down at a point only tries what's there (the whole city for every look was seconds)
  const CH = 16, // (points of the track to a stretch)
    chunks = Array.from({ length: Math.ceil(N / CH) }, () => []);
  scene.updateMatrixWorld(true);
  const ctr = new THREE.Vector3();
  const walk = o => {
    if (skipSet.has(o) || !o.visible) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSprite && o.geometry) {
      box.setFromObject(o);
      box.getSize(sz);
      const R = Math.max(sz.x, sz.z) / 2;
      if (R > 3 && R < 750 && sz.y < 400) {
        box.getCenter(ctr);
        const n = tr.nearest(ctr.x, ctr.z);
        if (n.d - R < W / 2 + 2) {
          const span = Math.ceil(R / tr.seg) + 1;
          for (let c = Math.floor((n.i - span) / CH); c <= Math.floor((n.i + span) / CH); c++)
            chunks[((c % chunks.length) + chunks.length) % chunks.length].push(o);
          cands.push(o);
        }
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(scene);
  const ray = new THREE.Raycaster(),
    down = new THREE.Vector3(0, -1, 0),
    from = new THREE.Vector3();
  const topAt = (i, lat) => {
    const p = tr.point(i * tr.seg, lat, 0);
    from.set(p.x, p.y + 45, p.z);
    ray.set(from, down);
    ray.far = 45 - 2.5; // (down to 2.5 m above the road: anything lower is the road's own kerbs and barriers)
    const hit = ray.intersectObjects(chunks[Math.floor(i / CH)], false).find(h => h.object.visible);
    return hit ? hit.point.y - p.y : 0;
  };
  let i = 0;
  const raw = new Float32Array(N);
  const slice = () => {
    const t0 = performance.now();
    for (; i < N && performance.now() - t0 < 6; i += 2) {
      let h = 0;
      if (tr.covered[i])
        h = -tr.P[i].y; // (an underpass: the ground over it)
      else {
        // a top right across the road: found in the middle and a quarter of the way in from each side, at much the
        // same height (so a gantry's beam or a lamp's arm doesn't count)
        const c = topAt(i, 0);
        if (c > 0) {
          const l = topAt(i, -W / 4),
            r = topAt(i, W / 4);
          if (l > 0 && r > 0 && Math.abs(l - c) < 2.5 && Math.abs(r - c) < 2.5) h = Math.min(c, l, r);
        }
      }
      raw[i] = h;
      if (i + 1 < N) raw[i + 1] = h;
    }
    if (i < N) return setTimeout(slice, 0);
    // (a roof shorter than a car's length is a beam, not a roof)
    for (let a = 0; a < N; a++) {
      if (!raw[a]) continue;
      let b = a;
      while (b < N && raw[b]) b++;
      if ((b - a) * tr.seg < 8) raw.fill(0, a, b);
      a = b;
    }
    out.set(raw);
  };
  slice();
  return out;
}
