// Each city's own subway (the covered way at a fork, src/track.js buildForkRoads): no two alike.
//  - Kano: concrete walls with a steel railing, and overhead a ceiling of golden slats rising and falling in waves, like
//    dunes in the harmattan light
//  - Kaduna: an arcade, open to the air: columns in pink, orange, yellow and teal flaring out into the roof, and in the
//    roof between them ovals of coloured glass
//  - Singapore: a tube of glass facets in white frames, every facet its own colour (green, yellow, pink, red, orange),
//    glowing at night
// (Doha has its own metro station: doharoad.js.) Each is built along `sub`, the covered stretch of the branch: its
// points P, sideways vectors L, M steps; BW is the branch's width, H the height the portals are built to. A builder
// that leaves the ground open beside the way says so with .open (no banks of sand heaped up its sides).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
// a point along the way at fractional step u, `lat` across it and `y` up
function at(sub, u, lat, y) {
  const i = Math.max(0, Math.min(sub.M - 1e-6, u)),
    i0 = Math.floor(i),
    k = i - i0,
    i1 = Math.min(sub.M, i0 + 1);
  const P = sub.P[i0].clone().lerp(sub.P[i1], k),
    L = sub.L[i0].clone().lerp(sub.L[i1], k).normalize();
  return P.addScaledVector(L, lat).setY((P.y || 0) + y);
}
// a rod from a to b
function rod(a, b, r, seg = 5) {
  const len = a.distanceTo(b),
    g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
const merged = (scene, list, mat, shadow = false) => {
  if (!list.length) return null;
  const m = new THREE.Mesh(mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g))), mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  scene.add(m);
  return m;
};
// a surface over the way: rows along it (every step of `du`), columns across it from lat0 to lat1, its height y(u, t)
// where t runs 0..1 across; colour per vertex if col(u, t) is given
function sheet(sub, du, n, lat0, lat1, y, col) {
  const pos = [],
    cols = [],
    idx = [];
  let rows = 0;
  for (let u = 0; u <= sub.M + 1e-6; u += du, rows++)
    for (let a = 0; a <= n; a++) {
      const t = a / n,
        q = at(sub, u, lat0 + (lat1 - lat0) * t, y(u, t));
      pos.push(q.x, q.y, q.z);
      if (col) cols.push(...col(u, t));
    }
  for (let r = 0; r < rows - 1; r++)
    for (let a = 0; a < n; a++) {
      const p0 = r * (n + 1) + a;
      idx.push(p0, p0 + 1, p0 + n + 1, p0 + 1, p0 + n + 2, p0 + n + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------- Kano: the dune ceiling ---------- */
function kano({ scene, sub, BW, H }) {
  const step = sub.seg || 2,
    W2 = BW / 2 + 0.3;
  // the walls: smooth pale concrete, a cove where they turn in to the roof, a darker plinth
  const concT = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#cfc9bf';
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 600; k++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)';
      x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    x.fillStyle = 'rgba(0,0,0,.12)';
    x.fillRect(0, 0, 2, 128); // the joints between the precast panels
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const wallM = new THREE.MeshLambertMaterial({ map: concT, side: THREE.DoubleSide, emissive: '#2c2620' });
  for (const sd of [-1, 1]) {
    // up the wall and curving in over the first metres of the roof
    const g = sheet(sub, 1, 8, sd * W2, sd * (W2 - 2.6), (u, t) =>
      t < 0.5 ? (t / 0.5) * (H - 1.4) : H - 1.4 + Math.sin(((t - 0.5) / 0.5) * (Math.PI / 2)) * 1.4,
    );
    const uv = [],
      p = g.attributes.position;
    for (let v = 0; v < p.count; v++) uv.push((Math.floor(v / 9) * step) / 6, (v % 9) / 4);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, wallM);
    m.receiveShadow = true;
    scene.add(m);
  }
  // the roof slab over it all, dark (the slats hang under it)
  const roof = new THREE.Mesh(
    sheet(sub, 1, 2, -W2 + 2.6, W2 - 2.6, () => H),
    new THREE.MeshLambertMaterial({ color: '#2a2622', side: THREE.DoubleSide }),
  );
  scene.add(roof);
  // the slats: thin fins across the tunnel, one every 0.7 m, each hanging down to a wave: two long swells along the
  // tunnel crossed by a shorter ripple, so the ceiling rolls like a dune field. Golden, lit warm from within
  const fins = [],
    n = 16,
    du = 1.1 / step;
  for (let u = 0; u <= sub.M; u += du) {
    const pos = [],
      cols = [],
      idx = [],
      along = u * step;
    for (let a = 0; a <= n; a++) {
      const t = a / n,
        lat = -W2 + 2.6 + (2 * W2 - 5.2) * t,
        depth =
          1.1 +
          1.1 * (0.5 + 0.5 * Math.sin(along * 0.07 + t * 2.4)) +
          0.7 * Math.sin(along * 0.19 - t * 5.5) * Math.sin(Math.PI * t),
        top = at(sub, u, lat, H - 0.05),
        bot = at(sub, u, lat, H - Math.max(0.5, depth));
      pos.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
      // dark where it meets the roof, bright gold at its lower edge: stacked fins read as lines of light
      cols.push(0.32, 0.17, 0.04, 1, 0.82, 0.36);
    }
    for (let a = 0; a < n; a++) {
      const p0 = a * 2;
      idx.push(p0, p0 + 1, p0 + 2, p0 + 1, p0 + 3, p0 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    fins.push(g);
  }
  merged(scene, fins, new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffc04a', side: THREE.DoubleSide })); // (lit from within)
  // the railing along each wall: posts every 2 m, a top rail and a mid rail, steel
  const rails = [];
  for (const sd of [-1, 1]) {
    let prev = null;
    for (let u = 0; u <= sub.M; u += 2 / step) {
      const lat = sd * (W2 - 0.7),
        a = at(sub, u, lat, 0),
        b = at(sub, u, lat, 1.2);
      rails.push(rod(a, b, 0.05));
      if (prev) rails.push(rod(prev[0], b, 0.05), rod(prev[1], at(sub, u, lat, 0.65), 0.035));
      prev = [b, at(sub, u, lat, 0.65)];
    }
  }
  merged(scene, rails, new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.7, roughness: 0.35 }));
}

/* ---------- Kaduna: the colour arcade ---------- */
const ARC = ['#ef3e6d', '#ff8a1c', '#ffc93a', '#ff5a8a', '#2ec4b6', '#f7a13a'];
function kaduna({ scene, sub, BW, H }) {
  const step = sub.seg || 2,
    X = BW / 2 + 1.6, // the columns' line, either side, clear of the lane
    BAY = 9; // metres between columns
  const cols = new Map(),
    add = (col, g) => (cols.get(col) || cols.set(col, []).get(col)).push(g);
  const capH = 3.2; // the flare at the top of each column
  let n = 0;
  for (let u = 0; u <= sub.M; u += BAY / step, n++)
    for (const sd of [-1, 1]) {
      const col = ARC[(n + (sd > 0 ? 0 : 3)) % ARC.length],
        foot = at(sub, u, sd * X, 0);
      // the shaft, then the flare opening out like a trumpet into the roof (toward the lane more than away from it)
      add(col, new THREE.CylinderGeometry(0.8, 0.9, H - capH, 20).translate(foot.x, (H - capH) / 2, foot.z));
      const flare = new THREE.CylinderGeometry(3.2, 0.8, capH, 24, 1, true).translate(foot.x, H - capH / 2, foot.z);
      add(col, flare);
      add(col, new THREE.CircleGeometry(3.2, 24).rotateX(Math.PI / 2).translate(foot.x, H - 0.02, foot.z)); // (its top, under the roof)
    }
  for (const [c, list] of cols)
    merged(
      scene,
      list,
      new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.18, side: THREE.DoubleSide }),
      true,
    );
  // the roof: a pale slab right across, from column line to column line
  const roofM = new THREE.MeshLambertMaterial({ color: '#f6e9dc', emissive: '#4a3a30', side: THREE.DoubleSide });
  const roof = new THREE.Mesh(
    sheet(sub, 1, 2, -X - 3, X + 3, () => H),
    roofM,
  );
  roof.castShadow = true;
  scene.add(roof);
  // the ovals of coloured glass set in the roof, two to a bay, lit
  const ovals = new Map();
  n = 0;
  for (let u = BAY / 2 / step; u <= sub.M; u += BAY / step, n++)
    for (const sd of [-1, 1]) {
      const c = ARC[(n * 2 + (sd > 0 ? 1 : 4)) % ARC.length],
        q = at(sub, u, sd * (BW / 4), H - 0.25),
        t = at(sub, Math.min(sub.M, u + 0.5), sd * (BW / 4), 0).sub(at(sub, u, sd * (BW / 4), 0)),
        g = new THREE.CylinderGeometry(1, 1, 0.5, 28).scale(BW / 4 - 0.6, 1, BAY / 2 - 0.8);
      g.rotateY(Math.atan2(t.x, t.z)).translate(q.x, q.y, q.z);
      (ovals.get(c) || ovals.set(c, []).get(c)).push(g);
    }
  for (const [c, list] of ovals)
    merged(
      scene,
      list,
      new THREE.MeshLambertMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
      }),
    );
  void step;
}
kaduna.open = true;

/* ---------- Singapore: the rainbow tube ---------- */
const GLASS = ['#3ddc84', '#c6f03a', '#ffd23a', '#ff8a3a', '#ff3b5c', '#ff4fb4', '#9b5cff'];
function singapore({ scene, sub, BW, H }) {
  const step = sub.seg || 2,
    R = BW / 2 + 0.8, // the tube's half width at the floor
    TOP = H + 1.5,
    SEGS = 7, // facets round the arch
    RING = 4.5; // metres between frames
  // the arch's cross-section: from the floor on one side, up and over, to the floor on the other
  const sect = k => {
    const a = (k / SEGS) * Math.PI;
    return [-Math.cos(a) * R, Math.sin(a) * TOP];
  };
  const pos = [],
    colr = [],
    frames = [],
    c = new THREE.Color();
  const rings = [];
  for (let u = 0, r = 0; u <= sub.M + 1e-6; u += RING / step, r++) {
    const half = r % 2 ? 0.5 : 0; // every other ring turned half a facet, so the panels are triangles
    rings.push(
      Array.from({ length: SEGS + 1 }, (_, k) => {
        const kk = Math.min(SEGS, Math.max(0, k + (k > 0 && k < SEGS ? half : 0))),
          [lat, y] = sect(kk);
        return at(sub, u, lat, y);
      }),
    );
  }
  for (let r = 0; r < rings.length - 1; r++)
    for (let k = 0; k < SEGS; k++) {
      const a = rings[r][k],
        b = rings[r][k + 1],
        d = rings[r + 1][k],
        e = rings[r + 1][k + 1];
      for (const [p, q, s] of [
        [a, b, d],
        [b, e, d],
      ]) {
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z, s.x, s.y, s.z);
        c.set(GLASS[(r * 3 + k * 2 + (p === b ? 1 : 0)) % GLASS.length]);
        for (let v = 0; v < 3; v++) colr.push(c.r, c.g, c.b);
      }
      // the white frame along this facet's edges
      frames.push(rod(a, b, 0.14, 4), rod(a, d, 0.14, 4), rod(b, d, 0.12, 4));
    }
  const last = rings.at(-1);
  for (let k = 0; k < SEGS; k++) frames.push(rod(last[k], last[k + 1], 0.14, 4));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.computeVertexNormals();
  const glass = new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: '#ffffff',
      emissiveIntensity: 0.18,
    }),
  );
  glass.renderOrder = 2;
  scene.add(glass);
  merged(scene, frames, new THREE.MeshLambertMaterial({ color: '#f7f8fa', emissive: '#6a6e76' }), true);
  // the floor either side of the lane, pale terrazzo, so the coloured light has something to fall on
  const floor = new THREE.Mesh(
    sheet(sub, 1, 1, -R, R, () => 0.03),
    new THREE.MeshLambertMaterial({ color: '#efe8f2', polygonOffset: true, polygonOffsetFactor: 1 }),
  );
  floor.receiveShadow = true;
  scene.add(floor);
  void step;
}
singapore.open = true;

export const SUBWAYS = { kano, kaduna, singapore };
