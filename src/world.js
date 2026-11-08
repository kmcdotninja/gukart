// Chapter 1, Kano: the island, Dala Hill, the old city walls (Ganuwa), the gates, Hausa mud houses with zanko pinnacles,
// the Kofar Mata dye pits, Kurmi market, the Emir's palace, doum palms, neem and baobab trees.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { W } from './track.js';
import { clamp, lerp, sstep, fbm, rng } from './util.js';
import { signTex, canvasTex, loopKnot, starKnot, diamondBand } from './textures.js';

// many copies of one shape in one draw call
class Inst {
  constructor(geo, mat, shadow = true) {
    this.geo = geo;
    this.mat = mat;
    this.items = [];
    this.shadow = shadow;
  }
  add(x, y, z, ry, sx, sy, sz, color, rx = 0, rz = 0) {
    if (this.guard) {
      // (a solid shape: left out if it would stand on the road, see clearOfRoad)
      const o = Inst.o;
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      this.geo.boundingBox || this.geo.computeBoundingBox();
      if (!this.guard(this.geo.boundingBox, o.matrix, this.label)) return false;
    }
    this.items.push([x, y, z, ry, sx, sy, sz, color, rx, rz]);
    return true;
  }
  build(scene) {
    if (!this.items.length) return null;
    const m = new THREE.InstancedMesh(this.geo, this.mat, this.items.length),
      o = new THREE.Object3D(),
      c = new THREE.Color();
    o.rotation.order = 'YXZ';
    this.items.forEach(([x, y, z, ry, sx, sy, sz, col, rx, rz], i) => {
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(col || '#ffffff'));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = this.shadow;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
}
Inst.o = Object.assign(new THREE.Object3D(), {});
Inst.o.rotation.order = 'YXZ';
const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const toW = (x, z, a, lx, lz) => [x + lx * Math.cos(a) + lz * Math.sin(a), z - lx * Math.sin(a) + lz * Math.cos(a)];

// lime-washed plaster in sand and cream, with the odd indigo, teal or ochre house
const MUD = [
  '#f1e4cc',
  '#e9d6b4',
  '#f5ecdc',
  '#e2cba6',
  '#eadcc2',
  '#d9c29b',
  '#f0e0c0',
  '#9fb4d8',
  '#e8c27a',
  '#a9d3cc',
];
const WALL = '#dcc39c';
const TARP = ['#e8336a', '#2ec4b6', '#ffc22e', '#1f8a4c', '#3a7bfd', '#ff6a00', '#8a5cff', '#f6f0e4'];
const GOODS = ['#ff8a1c', '#e0302a', '#c7a089', '#d9a441', '#8d6a4b', '#7cb342', '#ffd23a'];

// a small seeded random, so each island looks the same every time
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(scene, tr, tex, opts = {}) {
  const rand = rng(1957),
    rr = (a, b) => a + (b - a) * rand(),
    pick = a => a[(rand() * a.length) | 0];
  const { N, P, L, T, out, center: C } = tr;
  const R0 = tr.radius + 150; // island radius
  const city = opts.city || 'kano',
    doha = city === 'doha';
  let isLand = () => true;
  const occ = [];
  // the canals under the jumps: the ground drops away there
  const gaps = tr.kickers.map(k => {
    const m = (k.gap[0] + k.gap[1]) / 2,
      t = tr.T[tr.idx(m)];
    const tl = Math.hypot(t.x, t.z) || 1;
    return { p: tr.point(m, 0), tx: t.x / tl, tz: t.z / tl, half: (k.gap[1] - k.gap[0]) / 2 + 2 };
  });
  const roadGap = (x, z) => Math.min(tr.nearest(x, z).d, ...(tr.forks || []).map(f => f.dist(x, z) + (W / 2 - 20 / 2))); // (the fork's two ways count as road)
  const free = (x, z, r, minRoad = W / 2 + 13) => {
    const n = tr.nearest(x, z);
    if (n.d < minRoad + r + Math.abs(tr.P[n.i].y) * 1.9) return false;
    for (const f of tr.forks || []) if (f.dist(x, z) < minRoad + 2 + r + (f.tunnel ? 12 : 0)) return false; // clear of the embankments under raised road
    if (Math.hypot(x - C.x, z - C.z) > R0 - 40 - r) return false;
    for (const o of occ) if (Math.hypot(x - o[0], z - o[1]) < o[2] + r) return false;
    return true;
  };
  const reserve = (x, z, r) => occ.push([x, z, r]);
  // Nothing solid stands on the road. Every building, wall and tree is checked as it goes in: its footprint is sampled
  // every 2 m and each spot measured to the road (and the fork's two ways). If the low part of it (under 4.5 m, what a
  // kart can hit; a canopy or a bridge deck overhead is fine) reaches the tarmac, it's left out and listed in tr.blocked
  // with a console warning, so a landmark turned the wrong way can never block the road again.
  const blocked = (tr.blocked = []),
    _p = new THREE.Vector3();
  const clearOfRoad = (bb, m, label = 'piece') => {
    const nx = Math.min(60, Math.ceil((bb.max.x - bb.min.x) / 2)),
      nz = Math.min(60, Math.ceil((bb.max.z - bb.min.z) / 2));
    for (let a = 0; a <= nx; a++)
      for (let b = 0; b <= nz; b++) {
        _p.set(lerp(bb.min.x, bb.max.x, a / nx || 0), bb.min.y, lerp(bb.min.z, bb.max.z, b / nz || 0)).applyMatrix4(m);
        if (_p.y > 4.5) continue;
        const d = roadGap(_p.x, _p.z);
        if (d < W / 2) {
          const n = tr.nearest(_p.x, _p.z);
          blocked.push({
            label,
            x: +_p.x.toFixed(1),
            z: +_p.z.toFixed(1),
            s: Math.round((n.i * tr.len) / N),
            into: +(W / 2 - d).toFixed(1),
          });
          console.warn(
            `[gukart] left out a ${label} standing ${(W / 2 - d).toFixed(1)} m onto the road at s=${Math.round((n.i * tr.len) / N)}`,
          );
          return false;
        }
      }
    return true;
  };
  const faceRoad = (x, z) => {
    const p = P[tr.nearest(x, z).i];
    return Math.atan2(p.x - x, p.z - z);
  };

  const mudMat = new THREE.MeshLambertMaterial({ map: tex.mud });
  const decoMat = new THREE.MeshLambertMaterial({ map: tex.mudDeco });
  const plain = new THREE.MeshLambertMaterial();
  const flat = new THREE.MeshLambertMaterial({ flatShading: true });
  const bodies = new Inst(unitBox(), mudMat),
    decoBodies = new Inst(unitBox(), decoMat);
  const zanko = new Inst(new THREE.ConeGeometry(0.42, 1.7, 6).translate(0, 0.85, 0), mudMat);
  const merlon = new Inst(new THREE.ConeGeometry(0.75, 1.3, 4).translate(0, 0.65, 0), mudMat);
  const winMat = new THREE.MeshLambertMaterial();
  const dark = new Inst(unitBox(), winMat, false);
  const spouts = new Inst(new THREE.CylinderGeometry(0.14, 0.14, 1, 6).rotateX(Math.PI / 2), plain, false);
  const posts = new Inst(unitBox(), plain);
  const slabs = new Inst(unitBox(), plain);
  const balls = new Inst(new THREE.SphereGeometry(1, 8, 6), plain, false);
  const cones = new Inst(new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0), plain);
  const trunks = new Inst(new THREE.CylinderGeometry(0.6, 1, 1, 7).translate(0, 0.5, 0), plain);
  const canopy = new Inst(new THREE.IcosahedronGeometry(1, 1), flat);
  for (const [g, label] of [
    [bodies, 'house'],
    [decoBodies, 'house'],
    [slabs, 'wall'],
    [trunks, 'tree'],
  ])
    Object.assign(g, { guard: clearOfRoad, label });
  const rims = new Inst(new THREE.TorusGeometry(1.5, 0.35, 6, 18).rotateX(Math.PI / 2), mudMat, false);
  const dye = new Inst(
    new THREE.CircleGeometry(1.5, 18).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ shininess: 90, specular: 0x6688cc }),
    false,
  );
  const flags = new Inst(
    new THREE.BufferGeometry()
      .setFromPoints([new THREE.Vector3(-0.45, 0, 0), new THREE.Vector3(0.45, 0, 0), new THREE.Vector3(0, -1.1, 0)])
      .computeVertexNormals(),
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    false,
  );

  /* ---------- sky, sea, island ---------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      // a harmattan sky: deep blue overhead, dusty gold at the horizon
      uniforms: {
        uNight: { value: 0 },
        uCity: { value: doha ? 1 : 0 },
        uMoon: { value: new THREE.Vector3(0.5, 0.45, -0.74).normalize() },
      },
      fragmentShader: `uniform float uNight; uniform float uCity; uniform vec3 uMoon; varying vec3 vP;
      float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){ float h = vP.y;
      vec3 top = vec3(.2,.47,.82), mid = vec3(.55,.76,.93), hz = vec3(.99,.84,.62);
      vec3 c = mix(hz, mid, smoothstep(0., .2, h)); c = mix(c, top, smoothstep(.2, .75, h)); if (h < 0.) c = hz;
      // night: inky blue overhead, a faint warm city glow at the horizon, stars, the moon
      vec3 n = mix(vec3(.16,.12,.2), vec3(.04,.07,.17), smoothstep(0., .25, h)); n = mix(n, vec3(.01,.02,.07), smoothstep(.25, .8, h));
      vec3 q = floor(vP * 260.); float st = step(.9965, h3(q)) * smoothstep(.05, .3, h) * (.6 + .4 * h3(q + 7.));
      float md = dot(normalize(vP), uMoon); float moon = smoothstep(.9992, .9996, md); float halo = pow(max(md, 0.), 400.) * .5;
      // a big city (Doha): the sky lit from below, a warm orange-pink glow on the horizon through purple to navy, the
      // stars mostly washed out
      vec3 cg = mix(vec3(.62,.32,.3), vec3(.24,.16,.4), smoothstep(0., .3, h)); cg = mix(cg, vec3(.07,.08,.22), smoothstep(.3, .9, h));
      n = mix(n, cg, uCity); st *= 1. - uCity * .8;
      n += st + moon * vec3(1., .97, .88) + halo * vec3(.6, .7, 1.);
      gl_FragColor = vec4(mix(c, n, uNight), 1.); }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const waterTex = tex.water;
  waterTex.repeat.set(500, 500);
  // the sea is a ring round the island, so nothing below ground (the underpass) is ever under water
  const water = new THREE.Mesh(
    new THREE.RingGeometry(R0 - 90, 4500, 160, 1).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: '#2aa9c0', specular: '#bfefff', shininess: 70, map: waterTex }),
  ); // solid: see-through water showed the square edge of the ground plane under the sea
  water.position.set(C.x, -1.4, C.z);
  if (!doha) scene.add(water);

  // Dala Hill: the rocky hill at the heart of old Kano, set in the widest open spot inside the loop
  let hill = { x: C.x, z: C.z, d: 0 };
  for (let x = tr.box.min.x; x <= tr.box.max.x; x += 8)
    for (let z = tr.box.min.z; z <= tr.box.max.z; z += 8) {
      if (!tr.isInside(x, z)) continue;
      const d = roadGap(x, z);
      if (d > hill.d) hill = { x, z, d };
    }
  const hr = clamp(hill.d - W / 2 - 22, 25, 80),
    hh = hr * 0.85;

  const size = R0 * 2 + 700,
    segs = opts.low ? 130 : 180;
  const gg = new THREE.PlaneGeometry(size, size, segs, segs).rotateX(-Math.PI / 2).translate(C.x, 0, C.z);
  const gp = gg.attributes.position,
    cols = new Float32Array(gp.count * 3),
    cut = new Uint8Array(gp.count);
  const c = new THREE.Color();
  if (doha) {
    // Doha: flat ground; Doha Bay fills the inside of the loop, open water under the two bridges out to The Pearl, the
    // Gulf to the south of the causeway and all round the coast
    // the coast comes from the circuit's own features: 'shore' (water beyond d on one side along a stretch), 'marina'
    // (the whole inside of the loop beyond d is water), the open sea under any bridge, and the sea all round
    const shores = tr.feats.filter(f => f.type === 'shore'),
      marina = tr.feats.find(f => f.type === 'marina');
    const inStretch = (s, f) => {
      const o = tr.wrapS(s - f.s);
      return o <= f.len;
    };
    const blobs = tr.feats
      .filter(f => f.type === 'westbay')
      .map(f => {
        const s = f.s + f.len * 0.5,
          i = tr.idx(s);
        return { ...tr.beside(i, tr.out[i] * (W / 2 + 330)), r: 180 };
      });
    const wet = new Float32Array(gp.count),
      n1 = segs + 1;
    for (let k = 0; k < gp.count; k++) {
      const x = gp.getX(k),
        z = gp.getZ(k),
        d = roadGap(x, z),
        r = Math.hypot(x - C.x, z - C.z),
        th = Math.atan2(z - C.z, x - C.x);
      const Rs =
        R0 +
        40 * Math.sin(3 * th + 0.4) +
        26 * Math.sin(5 * th + 1.3) +
        60 * (fbm(Math.cos(th) * 2 + 9, Math.sin(th) * 2) - 0.45);
      const n = tr.nearest(x, z),
        dLand = Math.min(n.d, ...(tr.forks || []).filter(f => f.tunnel).map(f => f.dist(x, z) + (W / 2 - 20 / 2))),
        onRoad = dLand < W / 2 + 22 && P[n.i].y < 3, // (a sky bridge keeps the sea under it; a subway needs land)
        ins = tr.isInside(x, z),
        s = n.i * tr.seg;
      const wob = 14 * Math.sin(s * 0.02) + 22 * (fbm(x * 0.006, z * 0.006) - 0.45); // coasts that wander, not ruler lines
      let sea = r > Rs;
      for (const f of shores) if (inStretch(s, f) && (f.side === 'in') === ins && d > f.d + wob) sea = true;
      if (marina && ins && d > marina.d + wob) sea = true;
      for (const b of blobs)
        if (Math.hypot(x - b.x, z - b.z) < b.r * (0.85 + 0.3 * fbm(x * 0.01, z * 0.01))) sea = false; // land out across the water (West Bay)
      let canal = false;
      for (const g of gaps) {
        const dx = x - g.p.x,
          dz = z - g.p.z,
          al = dx * g.tx + dz * g.tz,
          la = Math.abs(dx * g.tz - dz * g.tx);
        if (Math.abs(al) < g.half && la < W / 2 + 60) canal = true;
      } // the canal under each jump
      wet[k] = canal || (sea && !onRoad) ? 1 : 0;
      if ((tr.trench[n.i] || tr.covered[n.i]) && n.d < W / 2 + 13) cut[k] = 1;
    }
    // soften the coast over a few cells, so the land shelves into the water as a beach instead of a cliff
    let m = wet;
    for (let pass = 0; pass < 3; pass++) {
      const o = new Float32Array(m.length);
      for (let a = 0; a < n1; a++)
        for (let b = 0; b < n1; b++) {
          let s = 0,
            q = 0;
          for (let da = -1; da <= 1; da++)
            for (let db = -1; db <= 1; db++) {
              const aa = a + da,
                bb = b + db;
              if (aa < 0 || bb < 0 || aa >= n1 || bb >= n1) continue;
              s += m[aa * n1 + bb];
              q++;
            }
          o[a * n1 + b] = s / q;
        }
      m = o;
    }
    {
      const x0 = C.x - size / 2,
        z0 = C.z - size / 2,
        step = size / segs; // is this spot dry land? (scenery asks before it builds)
      isLand = (x, z) => {
        const a = Math.round((z - z0) / step),
          b = Math.round((x - x0) / step);
        if (a < 0 || b < 0 || a >= n1 || b >= n1) return false;
        return m[a * n1 + b] < 0.2;
      };
    }
    const cSand = new THREE.Color('#efe0bd'),
      cPave = new THREE.Color('#d9d2c4'),
      cGreen = new THREE.Color('#8fb35a'),
      cBeach = new THREE.Color('#f8ecd0');
    for (let k = 0; k < gp.count; k++) {
      const x = gp.getX(k),
        z = gp.getZ(k),
        d = roadGap(x, z),
        wv = wet[k] ? Math.max(m[k], 0.5) : m[k];
      gp.setY(k, d < W / 2 + 26 && !wet[k] ? -0.35 : lerp(0.15, -7, sstep(0.25, 0.75, wv)));
      c.copy(cSand)
        .lerp(cGreen, sstep(0.6, 0.75, fbm(x * 0.02 + 3, z * 0.02)) * 0.5)
        .lerp(cPave, 1 - sstep(W / 2 + 3, W / 2 + 18, d))
        .lerp(cBeach, sstep(0.15, 0.45, wv));
      cols.set([c.r, c.g, c.b], k * 3);
    }
  } else {
    const cSand = new THREE.Color('#ecd9ae'),
      cGrass = new THREE.Color('#9dbb5c'),
      cLat = new THREE.Color('#7fa64f'),
      cShoulder = new THREE.Color('#d8c7a4'),
      cBeach = new THREE.Color('#f7e9c6'),
      cWet = new THREE.Color('#d9c79c');
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i),
        z = gp.getZ(i),
        d = roadGap(x, z),
        r = Math.hypot(x - C.x, z - C.z),
        th = Math.atan2(z - C.z, x - C.x);
      const Rs =
        R0 +
        30 * Math.sin(3 * th) +
        18 * Math.sin(5 * th + 1.3) +
        50 * (fbm(Math.cos(th) * 2 + 9, Math.sin(th) * 2) - 0.45);
      // dunes only well away from the road; inside the road corridor the ground sits just under the shoulders
      let h =
        d < W / 2 + 26 ? -0.35 : Math.max(0, fbm(x * 0.009, z * 0.009) - 0.42) * 36 * sstep(W / 2 + 30, W / 2 + 90, d);
      {
        const n = tr.nearest(x, z);
        if ((tr.trench[n.i] || tr.covered[n.i]) && n.d < W / 2 + 13) cut[i] = 1;
      } // the ground is cut away over the underpass
      for (const g of gaps) {
        const dx = x - g.p.x,
          dz = z - g.p.z,
          al = dx * g.tx + dz * g.tz,
          la = Math.abs(dx * g.tz - dz * g.tx);
        if (Math.abs(al) < g.half && la < W / 2 + 22) h = Math.min(h, -3.5);
      }
      const shore = sstep(Rs - 60, Rs + 25, r);
      h = lerp(h, -7, shore);
      gp.setY(i, h);
      const n1 = fbm(x * 0.02 + 3, z * 0.02),
        n2 = fbm(x * 0.05, z * 0.05 + 7);
      c.copy(cSand)
        .lerp(cGrass, sstep(0.42, 0.62, n1) * 0.85)
        .lerp(cLat, sstep(0.55, 0.75, n2) * 0.6);
      c.lerp(cShoulder, 1 - sstep(W / 2 + 3, W / 2 + 12, d));
      c.lerp(cBeach, sstep(Rs - 110, Rs - 50, r)).lerp(cWet, sstep(Rs - 20, Rs + 20, r));
      cols.set([c.r, c.g, c.b], i * 3);
    }
  }
  gg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  {
    const I = gg.index.array,
      keep = [];
    for (let t = 0; t < I.length; t += 3)
      if (!cut[I[t]] && !cut[I[t + 1]] && !cut[I[t + 2]]) keep.push(I[t], I[t + 1], I[t + 2]);
    gg.setIndex(keep);
  }
  gg.computeVertexNormals();
  tex.ground.repeat.set(size / 10, size / 10);
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.ground }));
  ground.receiveShadow = true;
  scene.add(ground);
  if (doha) {
    // one sheet of sea, with a hole wherever the road runs below ground (so no water shows in the underpass)
    const S = size * 2.6,
      ws = 160,
      wg = new THREE.PlaneGeometry(S, S, ws, ws).rotateX(-Math.PI / 2).translate(C.x, 0, C.z),
      wp = wg.attributes.position,
      wc = new Uint8Array(wp.count);
    for (let k = 0; k < wp.count; k++) {
      const n = tr.nearest(wp.getX(k), wp.getZ(k));
      if ((tr.trench[n.i] || tr.covered[n.i]) && n.d < W / 2 + 40) wc[k] = 1;
    }
    const I = wg.index.array,
      keep = [];
    for (let t = 0; t < I.length; t += 3)
      if (!wc[I[t]] && !wc[I[t + 1]] && !wc[I[t + 2]]) keep.push(I[t], I[t + 1], I[t + 2]);
    wg.setIndex(keep);
    water.geometry = wg;
    water.position.set(0, -1.4, 0);
    scene.add(water);
  }

  {
    const g = new THREE.SphereGeometry(1, 56, 28),
      p = g.attributes.position,
      hc = new Float32Array(p.count * 3);
    const rock = new THREE.Color('#b9a48c'),
      rock2 = new THREE.Color('#9d8a76'),
      top = new THREE.Color('#8fb35a');
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const n = fbm(x * 2.2 + 4, z * 2.2 + y * 1.7);
      const k = 1 + (n - 0.45) * 0.5;
      x *= hr * k;
      z *= hr * 0.88 * k;
      y = Math.max(y, -0.05) * hh * (0.85 + n * 0.4);
      p.setXYZ(i, x, y, z);
      c.copy(rock)
        .lerp(rock2, sstep(0.4, 0.7, fbm(x * 0.2, z * 0.2)))
        .lerp(top, sstep(0.55, 0.9, y / hh) * sstep(0.45, 0.6, n));
      hc.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.position.set(hill.x, -2, hill.z);
    m.castShadow = m.receiveShadow = true;
    if (!doha) scene.add(m);
    if (!doha) reserve(hill.x, hill.z, hr + 6);
  }

  /* ---------- builders ---------- */
  function addZanko(x, z, a, lx, lz, y, sx, sz, s = 1, col) {
    const [wx, wz] = toW(x, z, a, lx, lz);
    zanko.add(wx, y, wz, a, s, s * rr(1, 1.5), s, col || '#e6d2ae', 0.28 * sz, -0.28 * sx);
  }
  function house(x, z, a, w, d, h, deco) {
    const col = pick(MUD),
      zc = undefined;
    (deco ? decoBodies : bodies).add(x, 0, z, a, w, h, d, col);
    let topH = h,
      tw = w,
      td = d,
      oz = 0;
    if (rand() < 0.45) {
      tw = w * rr(0.45, 0.65);
      td = d * rr(0.45, 0.6);
      oz = -d * 0.18;
      const th = h * rr(0.5, 0.7);
      const [ux, uz] = toW(x, z, a, 0, oz);
      bodies.add(ux, h, uz, a, tw, th, td, col);
      topH = h + th;
      for (const [sx, sz] of [
        [1, 1],
        [-1, 1],
      ])
        addZanko(x, z, a, ((sx * w) / 2) * 0.9, ((sz * d) / 2) * 0.9, h, sx, sz, 0.9, zc);
    }
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      addZanko(x, z, a, ((sx * tw) / 2) * 0.9, oz + ((sz * td) / 2) * 0.9, topH, sx, sz, 1, zc);
    if (tw > 7) for (const s of [-1, 1]) addZanko(x, z, a, s * tw * 0.16, oz + (td / 2) * 0.95, topH, 0, 1, 0.8, zc);
    const dx = rr(-w * 0.25, w * 0.25),
      [ex, ez] = toW(x, z, a, dx, d / 2);
    dark.add(ex, 0, ez, a, 1.5, 2.6, 0.3, '#2a1a10');
    if (rand() < 0.6) {
      const [qx, qz] = toW(x, z, a, -dx * 0.8 + (dx > 0 ? -1.5 : 1.5), d / 2);
      dark.add(qx, h * 0.55, qz, a, 0.8, 0.8, 0.25, '#2a1a10');
    }
    for (const s of [-0.3, 0.3]) {
      const [sx, sz] = toW(x, z, a, s * w, d / 2 + 0.45);
      spouts.add(sx, h - 0.5, sz, a, 1, 1, 1, '#5b3b22');
    }
  }
  function tryHouse(i, side, off, deco = false) {
    const p = tr.beside(i, side * off);
    const w = rr(6, 11),
      d = rr(6, 9),
      r = Math.max(w, d) * 0.6;
    if (!free(p.x, p.z, r)) return false;
    reserve(p.x, p.z, r);
    house(p.x, p.z, faceRoad(p.x, p.z), w, d, rr(4, 6.5), deco);
    return true;
  }
  const idxOf = f => Math.round(f * N) % N;
  const nearFork = i => (tr.forks || []).some(f => i > f.a - 30 && i < f.b + 60);
  const range = (f0, f1, step, fn) => {
    const a = idxOf(f0),
      n = (((idxOf(f1) - a) % N) + N) % N;
    for (let k = 0; k < n; k += step) {
      const i = (a + k) % N;
      if (!tr.elevated[i] && !nearFork(i) && tr.P[i].y < 0.4 && tr.P[(i + step) % N].y < 0.4) fn(i);
    }
  };

  // Ganuwa, the old earthen city wall, along the outside of the road: one continuous rammed-earth bank per run, battered
  // (wide at the foot, narrow at the crown), its top worn uneven, rain gullies down the faces; buttress towers along it
  const ganuwaM = new THREE.MeshLambertMaterial({ map: tex.ganuwa });
  function wall(f0, f1, off = W / 2 + 16) {
    const step = 3;
    let n = 0,
      run = [],
      last = -1;
    // across the bank, from the road side over the crown to the far side: [lateral offset, share of the height]
    const PROF = [
      [-2.3, 0],
      [-1.85, 0.5],
      [-1.35, 0.9],
      [-0.75, 1],
      [0.75, 1],
      [1.35, 0.9],
      [1.85, 0.5],
      [2.3, 0],
    ];
    const flush = () => {
      if (run.length < 2) {
        run = [];
        return;
      }
      run[0][2] *= 0.12;
      run[run.length - 1][2] *= 0.12; // each run slumps into the ground at its ends, as eroded earth does
      const pos = [],
        uv = [],
        idx = [],
        R = PROF.length;
      let along = 0;
      run.forEach(([i, sg, h], k) => {
        if (k) {
          const a = tr.beside(run[k - 1][0], run[k - 1][1] * off),
            b = tr.beside(i, sg * off);
          along += Math.hypot(b.x - a.x, b.z - a.z);
        }
        for (const [d, f] of PROF) {
          const q = tr.beside(i, sg * (off + d)),
            y = h * f;
          pos.push(q.x, y, q.z);
          uv.push(along / 10 + d * 0.02, y / 8);
        }
      });
      for (let k = 0; k < run.length - 1; k++)
        for (let r = 0; r < R - 1; r++) {
          const a = k * R + r,
            b = a + 1,
            c = a + R,
            d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, ganuwaM);
      m.castShadow = m.receiveShadow = true;
      m.material.side = THREE.DoubleSide;
      scene.add(m);
      run = [];
    };
    range(f0, f1, step, i => {
      if (last >= 0 && (i - last + N) % N !== step) flush();
      last = i;
      const s = out[i],
        a = tr.beside(i, s * off),
        b = tr.beside(i + step, s * off);
      const mx = (a.x + b.x) / 2,
        mz = (a.z + b.z) / 2,
        ang = Math.atan2(b.x - a.x, b.z - a.z),
        len = Math.hypot(b.x - a.x, b.z - a.z);
      const h = 5 + fbm(i * 0.05, 1) * 2.5 - fbm(i * 0.7, 4) * 0.7; // the crown: slow rises and falls, then crumbled spots
      run.push([i, s, h]);
      if (n++ % 14 === 0) {
        // a buttress tower
        bodies.add(mx, 0, mz, ang, 6.5, h + 4, 6.5, '#d2b68c');
        for (const [sx, sz] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ])
          addZanko(mx, mz, ang, sx * 2.9, sz * 2.9, h + 4, sx, sz, 1.1);
      }
      reserve(mx, mz, len / 2 + 2);
    });
    // close the last run (it ends at the stretch's end, so its final sample still needs the next one)
    if (run.length) {
      const [i, sg] = run[run.length - 1];
      run.push([i + step, sg, run[run.length - 1][2]]);
    }
    flush();
  }

  // the old mud gates, from what's known of each: Kansakali the first (c. 1095-1135, never rebuilt: low, thick, worn),
  // Na'isa ("I can prove my mettle", demolished 2010, shown as it stood), Dan Agundi (1499, rebuilt 2014: crisp twin
  // towers), Wambai (1118, rebuilt wide in concrete: flat lintel, painted, green bands), Dawanau (c. 1470, still standing)
  const CREAM = ['rgba(70,40,18,.55)', 'rgba(255,244,222,.6)', '#efdcb8'];
  const EARTH_GATES = {
    'KOFAR KANSAKALI': {
      mud: '#b98a66',
      tw: 5,
      th: 11,
      H: 10,
      spring: 6,
      crown: 8.2,
      D: 7,
      ruin: true,
      pal: ['rgba(70,40,18,.3)', 'rgba(255,244,222,.25)', 'rgba(232,210,170,.75)'],
      ink: '#6b3a1c',
      plateBg: '#dcc29a',
      trim: '#e9dcc4',
    },
    "KOFAR NA'ISA": {
      mud: '#c99a72',
      tw: 5,
      th: 15,
      H: 13,
      spring: 7.5,
      crown: 11.2,
      D: 5,
      zanko: true,
      bands: true,
      pal: CREAM,
      ink: '#6b3a1c',
      plateBg: '#efdcb8',
      trim: '#f4efe6',
    },
    'KOFAR DAN AGUNDI': {
      mud: '#d8a878',
      tw: 5.5,
      th: 18,
      H: 15.5,
      spring: 9,
      crown: 13.4,
      D: 6,
      zanko: true,
      merlons: true,
      pal: CREAM,
      ink: '#7a3f1f',
      plateBg: '#efdcb8',
      trim: '#efdcb8',
    },
    'KOFAR WAMBAI': {
      mud: '#f0e2c4',
      tw: 4.5,
      th: 14,
      H: 14,
      spring: 9.5,
      crown: 9.5,
      D: 5,
      bands: true,
      pal: ['rgba(20,50,30,.35)', 'rgba(255,255,255,.6)', '#2a7d52'],
      ink: '#ffffff',
      plateBg: '#2a7d52',
      trim: '#2a7d52',
    },
    'KOFAR DAWANAU': {
      mud: '#e0a66c',
      tw: 5,
      th: 16,
      H: 14,
      spring: 8.5,
      crown: 12,
      D: 6,
      zanko: true,
      bands: true,
      pal: ['rgba(10,15,50,.4)', 'rgba(255,255,255,.45)', '#2b3f8f'],
      ink: '#2b3f8f',
      plateBg: '#f1e4cc',
      trim: '#2b3f8f',
    },
  };
  const zankoGeo = new THREE.ConeGeometry(0.5, 2.2, 6).translate(0, 1.1, 0);
  let mudGrainTex; // a pale grain the gate's colour tints: speckle, a few rain streaks
  const mudGrain = () =>
    (mudGrainTex ||= (() => {
      const t = canvasTex(
        256,
        256,
        (x, w, h) => {
          x.fillStyle = '#ffffff';
          x.fillRect(0, 0, w, h);
          for (let i = 0; i < 4000; i++) {
            x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,35' : '255,245,230'},${0.05 + Math.random() * 0.08})`;
            const r = 1 + Math.random() * 2.5;
            x.fillRect(Math.random() * w, Math.random() * h, r, r);
          }
          for (let i = 0; i < 14; i++) {
            x.fillStyle = `rgba(80,50,25,${0.04 + Math.random() * 0.06})`;
            x.fillRect(Math.random() * w, 0, 2 + Math.random() * 5, h * (0.1 + Math.random() * 0.35));
          }
        },
        { repeat: true },
      );
      t.repeat.set(0.1, 0.1);
      return t;
    })());

  // the city gates across the road (kofa), each built as the real one stands today
  function gate(f, name) {
    const i = idxOf(f),
      g = new THREE.Group(),
      a = W / 2 + 1.6,
      h = tr.heading(i);
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    const blk = (w, ht, d, m, x, y, z) => {
      const o = new THREE.Mesh(unitBox(), m);
      o.scale.set(w, ht, d);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    const plate = (text, w, ht, fg, bg) => {
      const t = canvasTex(1024, Math.round((1024 * ht) / w), (x, cw, ch) => {
        x.fillStyle = bg;
        x.fillRect(0, 0, cw, ch);
        x.fillStyle = fg;
        x.font = `italic 800 ${ch * 0.62}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(text, cw / 2, ch * 0.54);
      });
      return new THREE.MeshLambertMaterial({ map: t, transparent: bg === 'rgba(0,0,0,0)' });
    };
    const archBlock = (x0, x1, y1, ow, spring, crown, depth, m) => {
      // a wall from x0 to x1, y 0..y1, with an arched opening ow wide
      const sh = new THREE.Shape(),
        c = (x0 + x1) / 2;
      sh.moveTo(x0, 0);
      sh.lineTo(c - ow / 2, 0);
      sh.lineTo(c - ow / 2, spring);
      sh.quadraticCurveTo(c - ow / 2, crown, c, crown);
      sh.quadraticCurveTo(c + ow / 2, crown, c + ow / 2, spring);
      sh.lineTo(c + ow / 2, 0);
      sh.lineTo(x1, 0);
      sh.lineTo(x1, y1);
      sh.lineTo(x0, y1);
      sh.lineTo(x0, 0);
      const o = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2),
        m,
      );
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    // the Hausa relief from the house entrances (star knot, looped knots, diamond bands), pressed onto the gate's faces:
    // a transparent panel w x h metres, its bottom edge at y, on both faces (z = ±zf)
    const PXM = 64;
    const reliefPanel = (w, h, cx, y, zf, draw) => {
      const m = new THREE.MeshLambertMaterial({
        map: canvasTex(Math.round(w * PXM), Math.round(h * PXM), (x, cw, ch) => draw(x, cw, ch, PXM)),
        transparent: true,
        depthWrite: false,
      });
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
        p.position.set(cx, y + h / 2, sz * zf);
        if (sz < 0) p.rotation.y = Math.PI;
        g.add(p);
      }
    };
    const RED = ['rgba(90,20,28,.4)', 'rgba(255,255,255,.75)', '#e0334a'];
    let side = 12;
    if (name === 'KOFAR NASSARAWA') {
      // rebuilt 2014: a white portal, crenellated, the piers' inner edges lined in red, the Kano horned emblem in red on
      // top, the name painted in red on the beam; a red pavilion with white trim and an arched opening each side
      const white = mat('#f1efe9'),
        red = mat('#e0334a'),
        pw = 3.4,
        H = 15.5,
        D = 4;
      for (const sx of [-1, 1]) {
        blk(pw, H + 1.2, D, white, sx * (a + pw / 2), 0, 0);
        for (const sz of [-1, 1]) blk(0.35, 11, 0.12, red, sx * (a + 0.2), 0, sz * (D / 2 + 0.05));
        for (let k = 0; k < 3; k++)
          for (const sz of [-1, 1]) blk(0.6, 0.7, 0.5, white, sx * (a + 0.5 + k * 1.2), H + 1.2, sz * (D / 2 - 0.25));
      }
      blk(2 * a, 4.3, D, white, 0, H - 4.3, 0);
      for (let x = -a + 0.6; x <= a - 0.4; x += 1.25)
        for (const sz of [-1, 1]) blk(0.6, 0.6, 0.5, white, x, H, sz * (D / 2 - 0.25));
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(
          new THREE.PlaneGeometry(20, 2.2),
          plate('KOFAR NASSARAWA', 20, 2.2, '#d8243e', '#f1efe9'),
        );
        p.position.set(0, H - 2.4, sz * (D / 2 + 0.03));
        if (sz < 0) p.rotation.y = Math.PI;
        g.add(p);
      }
      const em = new THREE.Shape();
      em.moveTo(-2.1, 4.4);
      em.quadraticCurveTo(-2.6, 0.2, 0, 0);
      em.quadraticCurveTo(2.6, 0.2, 2.1, 4.4);
      em.lineTo(1.2, 3.1);
      em.quadraticCurveTo(1.3, 1.1, 0, 1.0);
      em.quadraticCurveTo(-1.3, 1.1, -1.2, 3.1);
      em.lineTo(-2.1, 4.4);
      const emb = new THREE.Mesh(
        new THREE.ExtrudeGeometry(em, {
          depth: 0.8,
          bevelEnabled: true,
          bevelSize: 0.08,
          bevelThickness: 0.08,
          bevelSegments: 2,
        }).translate(0, 0, -0.4),
        red,
      );
      emb.position.set(0, H + 0.1, 0);
      emb.castShadow = true;
      g.add(emb);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 20).rotateX(Math.PI / 2), white);
      disc.position.set(0, H + 2.4, 0);
      g.add(disc);
      for (const sx of [-1, 1]) {
        // the pavilions
        const cx = sx * (a + pw + 4.2);
        archBlock(cx - 4, cx + 4, 7.2, 3.4, 3.6, 5.6, 6, red);
        blk(8.6, 0.6, 6.6, white, cx, 7.2, 0);
        blk(8, 0.25, 6, white, cx, 7.8, 0);
        for (let k = -3; k <= 3; k++)
          for (const sz of [-1, 1]) blk(0.12, 1.1, 0.12, white, cx + k * 1.2, 7.8, sz * 2.9);
        for (const sz of [-1, 1]) blk(8, 0.12, 0.12, white, cx, 8.9, sz * 2.9);
        for (const sz of [-1, 1]) blk(0.3, 7.2, 0.1, white, cx - sx * 3.85, 0, sz * 3.03);
      }
      for (const sx of [-1, 1])
        reliefPanel(2.6, 9.6, sx * (a + pw / 2), 1.2, D / 2 + 0.03, (x, w, h, k) => {
          starKnot(x, w / 2, 1.5 * k, 1.85 * k, RED);
          loopKnot(x, w / 2, 4.3 * k, 1.9 * k, RED);
          diamondBand(x, 0.15 * k, w - 0.15 * k, 6.8 * k, 0.95 * k, RED);
          diamondBand(x, 0.15 * k, w - 0.15 * k, 8.75 * k, 0.95 * k, RED);
        });
      side = a + pw + 8.5;
    } else if (name === 'KOFAR MATA') {
      // Kofar Mata: an arcade of red-orange arches, every pier topped with pointed horns, white strips down the pier faces;
      // the wide middle arch spans the road, two smaller ones each side over the walkways
      const red = mat('#d9532f'),
        white = mat('#f4f1ea'),
        pw = 2.6,
        H = 15,
        D = 3.4;
      archBlock(-a - pw, a + pw, H, 2 * a, 9.5, 13, D, red);
      const horn = new THREE.ConeGeometry(0.5, 3.4, 4).rotateY(Math.PI / 4).translate(0, 1.7, 0); // a slim blade, pointed, the pier's depth
      const horns = (x, y, lean) => {
        const o = new THREE.Mesh(horn, red);
        o.position.set(x, y, 0);
        o.scale.set(0.8, 1, (D * 0.9) / 0.707);
        o.rotation.z = -lean * 0.1;
        o.castShadow = true;
        g.add(o);
      };
      const bays = [[-a - pw, a + pw, H]];
      let x = a + pw;
      for (let k = 0; k < 2; k++) {
        const w = 6.2,
          hb = 11.5 - k * 0.8;
        for (const sx of [-1, 1]) {
          const x0 = sx > 0 ? x : -x - w,
            x1 = sx > 0 ? x + w : -x;
          archBlock(x0, x1, hb, 3.4, 5, 7.6, D, red);
          bays.push([x0, x1, hb]);
        }
        x += w;
      }
      for (const [x0, x1, hb] of bays) {
        horns(x0 + 0.45, hb, -1);
        horns(x1 - 0.45, hb, 1);
        for (const xe of [x0, x1])
          for (const sz of [-1, 1])
            blk(0.35, hb - 0.2, 0.1, white, xe + (xe === x0 ? 0.3 : -0.3), 0, sz * (D / 2 + 0.04));
      }
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), plate('KOFAR MATA', 9, 1.3, '#d9532f', '#f4f1ea'));
        p.position.set(0, H - 1.3, sz * (D / 2 + 0.03));
        if (sz < 0) p.rotation.y = Math.PI;
        g.add(p);
      }
      const z = D / 2 + 0.03;
      for (const sx of [-1, 1]) {
        reliefPanel(1.6, 7.5, sx * (a + pw / 2), 1.2, z, (x, w, h, k) => {
          for (const y of [1.3, 3.75, 6.2]) diamondBand(x, 0, w, y * k, 1.15 * k, CREAM);
        });
        reliefPanel(4.6, 3.7, sx * (a + pw + 3.1), 7.7, z, (x, w, h, k) => loopKnot(x, w / 2, h / 2, 3 * k, CREAM));
        reliefPanel(4.6, 2.95, sx * (a + pw + 9.3), 7.7, z, (x, w, h, k) => starKnot(x, w / 2, h / 2, 2.3 * k, CREAM));
      }
      side = x;
    } else {
      // the older mud gates, each its own: earth towers either side of an arched wall over the road, zanko on the
      // towers, the name over the arch, and the Hausa relief down the towers (and over the arch where there's room)
      const o = EARTH_GATES[name] || EARTH_GATES['KOFAR DAWANAU'],
        { tw, th, H, spring, crown, D } = o;
      const grnd = rng(name.length * 97 + 11),
        gr = (lo, hi) => lo + (hi - lo) * grnd(); // its own dice, so the city around stays put
      const mud = new THREE.MeshLambertMaterial({ color: o.mud, map: mudGrain() }),
        trim = mat(o.trim);
      archBlock(-a, a, H, 2 * a, spring, crown, D, mud);
      const TD = D + 1;
      for (const sx of [-1, 1]) {
        const cx = sx * (a + tw / 2),
          hh = th + (o.ruin ? sx * 1.3 : 0);
        blk(tw, hh, TD, mud, cx, 0, 0);
        if (o.bands) for (const y of [hh - 1.6, 1.2]) blk(tw + 0.06, 0.35, TD + 0.06, trim, cx, y, 0);
        if (o.zanko)
          for (const ex of [-1, 1])
            for (const ez of [-1, 1]) {
              const z = new THREE.Mesh(zankoGeo, mud);
              z.position.set(cx + ex * (tw / 2 - 0.55), hh, ez * (TD / 2 - 0.55));
              z.castShadow = true;
              g.add(z);
            }
        if (o.ruin)
          for (let k = 0; k < 4; k++)
            blk(
              gr(0.8, 1.6),
              gr(0.3, 1.1),
              gr(1, 2.4),
              mud,
              cx + gr(-tw / 2 + 0.6, tw / 2 - 0.6),
              hh,
              gr(-TD / 2 + 1, TD / 2 - 1),
            ); // worn, broken crown
        // the tower face: star knot on top, a looped knot, then diamond bands to the foot
        reliefPanel(tw - 0.9, hh - 2.6, cx, 1.1, TD / 2 + 0.03, (x, w, h, k) => {
          const m = w / k,
            sK = m * 0.72,
            sL = m * 0.66,
            sB = m * 0.34;
          let y = 0.7 * sK + 0.15;
          starKnot(x, w / 2, y * k, sK * k, o.pal);
          y += 0.62 * sK + 0.35 + 0.6 * sL;
          loopKnot(x, w / 2, y * k, sL * k, o.pal);
          y += 0.6 * sL + 0.4 + 1.15 * sB;
          while (y + 0.65 * sB < h / k) {
            diamondBand(x, 0, w, y * k, sB * k, o.pal);
            y += 2 * sB + 0.3;
          }
        });
      }
      if (o.merlons)
        for (let x = -a + 0.7; x <= a - 0.5; x += 1.6)
          for (const sz of [-1, 1]) blk(0.8, 0.8, 0.6, mud, x, H, sz * (D / 2 - 0.3));
      if (o.ruin) for (let k = 0; k < 6; k++) blk(gr(1, 3), gr(0.2, 0.9), D * 0.8, mud, gr(-a + 1, a - 1), H, 0);
      // the name over the arch; on a tall wall the relief carries on above it
      const pw2 = Math.min(2 * a - 4, name.length * 0.9 + 2),
        ph = Math.min(1.6, (H - crown) * 0.72);
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(pw2, ph), plate(name, pw2, ph, o.ink, o.plateBg));
        p.position.set(0, crown + (H - crown) / 2, sz * (D / 2 + 0.03));
        if (sz < 0) p.rotation.y = Math.PI;
        g.add(p);
      }
      if (spring === crown)
        for (const sx of [-1, 1])
          reliefPanel(
            a - pw2 / 2 - 1.2,
            H - crown - 0.6,
            sx * (pw2 / 2 + (a - pw2 / 2) / 2),
            crown + 0.3,
            D / 2 + 0.03,
            (x, w, h, k) => diamondBand(x, 0, w, h * 0.62, h * 0.42, o.pal),
          );
      side = a + tw;
    }
    g.position.copy(P[i]);
    g.rotation.y = h;
    scene.add(g);
    for (let o = -7; o <= 7; o++) {
      tr.limit[tr.wrap(i + o)] = a - 1.6;
      tr.wall[tr.wrap(i + o)] = a;
    } // the arch's sides are solid
    for (const sx of [-1, 1]) {
      const p = tr.beside(i, (sx * (a + side)) / 2);
      reserve(p.x, p.z, (side - a) / 2 + 4);
    }
    reserve(P[i].x, P[i].z, 4);
  }

  // Kofar Mata: indigo dye pits beside the road, cloth drying on lines behind them
  const cloths = [];
  function dyePits(f0, f1) {
    range(f0, f1, 4, i => {
      const s = out[i];
      for (const off of [W / 2 + 17, W / 2 + 22, W / 2 + 27, W / 2 + 32]) {
        const p = tr.beside(i + rr(-1, 1), s * (off + rr(-1, 1)));
        if (!free(p.x, p.z, 2)) continue;
        reserve(p.x, p.z, 1.9);
        rims.add(p.x, 0.2, p.z, 0, 1, 1, 1, pick(['#d9c29b', '#cdb48c', '#e2cba6']));
        dye.add(
          p.x,
          0.3,
          p.z,
          0,
          1,
          1,
          1,
          rand() < 0.8 ? pick(['#1b2a80', '#22336b', '#0f1a4d', '#2b3f9e']) : pick(['#4b6b2a', '#7a3b1e']),
        );
      }
    });
    range(f0, f1, 6, i => {
      const s = out[i],
        p = tr.beside(i, s * (W / 2 + 39));
      if (!free(p.x, p.z, 2.5)) return;
      reserve(p.x, p.z, 2.5);
      const a = tr.heading(i);
      for (const k of [-3, 3]) {
        const [px, pz] = toW(p.x, p.z, a, 0, k);
        posts.add(px, 0, pz, a, 0.25, 4.2, 0.25, '#5b3b22');
      }
      const cl = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 3.2).translate(0, -1.6, 0),
        new THREE.MeshLambertMaterial({ map: pick(tex.adire), side: THREE.DoubleSide }),
      );
      cl.position.set(p.x, 4.1, p.z);
      cl.rotation.y = a + Math.PI / 2;
      cl.castShadow = true;
      scene.add(cl);
      cloths.push({ m: cl, ph: rand() * 6 });
    });
  }

  // Kurmi market: stalls and umbrellas right on the roadside
  function market(f0, f1) {
    range(f0, f1, 5, i => {
      for (const s of [-1, 1]) {
        const p = tr.beside(i + rr(-1, 1), s * (W / 2 + rr(16, 19)));
        if (!free(p.x, p.z, 2.5, W / 2 + 12)) continue;
        reserve(p.x, p.z, 2.6);
        const a = faceRoad(p.x, p.z);
        if (rand() < 0.55) {
          for (const [lx, lz] of [
            [-1.6, -1.2],
            [1.6, -1.2],
            [-1.6, 1.2],
            [1.6, 1.2],
          ]) {
            const [wx, wz] = toW(p.x, p.z, a, lx, lz);
            posts.add(wx, 0, wz, a, 0.18, lz > 0 ? 2.8 : 3.3, 0.18, '#6b4a2e');
          }
          slabs.add(p.x, 2.9, p.z, a, 3.8, 0.14, 3.2, pick(TARP), -0.16);
        } else {
          posts.add(p.x, 0, p.z, a, 0.14, 3.2, 0.14, '#ddd');
          cones.add(p.x, 3, p.z, a, 2.4, 0.9, 2.4, pick(TARP));
        }
        slabs.add(p.x, 0, p.z, a, 3, 0.9, 1.6, '#8d6a4b');
        for (let g = 0; g < 7; g++) {
          const [wx, wz] = toW(p.x, p.z, a, rr(-1.2, 1.2), rr(-0.5, 0.5));
          balls.add(wx, 1.1, wz, 0, 0.3, 0.26, 0.3, pick(GOODS));
        }
      }
    });
  }
  // strings of flags across the road
  function bunting(f) {
    const i = idxOf(f),
      A = tr.beside(i, W / 2 + 13.5),
      B = tr.beside(i, -W / 2 - 13.5),
      h = tr.heading(i);
    if (tr.elevated[i]) return;
    const ry = tr.P[i].y;
    for (const p of [A, B]) posts.add(p.x, 0, p.z, h, 0.3, 8 + ry, 0.3, '#eee');
    for (let k = 0; k <= 26; k++) {
      const s = k / 26,
        x = lerp(A.x, B.x, s),
        z = lerp(A.z, B.z, s),
        y = ry + 7.8 - Math.sin(Math.PI * s) * 1.6;
      flags.add(x, y, z, h, 1, 1, 1, ['#008751', '#ffffff', '#ffc22e', '#e8336a', '#2ec4b6'][k % 5]);
    }
  }

  // Gidan Rumfa, the Emir's palace, at the heart of the island: a walled compound in the palace red, the tall gate
  // tower (yellow crenellations with horned corners, the tall pointed lobed arch with its toothed yellow frame,
  // a balcony, the gateway below, a green plinth), lower wings either side with framed windows, the beams (toron)
  // sticking out of the walls, the Emir's halls inside
  let palaceAt = null;
  function palace() {
    // the site: the open ground nearest the middle of the island that the compound fits in
    const half = 50;
    let best = null;
    for (let x = C.x - 260; x <= C.x + 260; x += 6)
      for (let z = C.z - 260; z <= C.z + 260; z += 6) {
        if (Math.hypot(x - hill.x, z - hill.z) < hr + half + 30) continue;
        if (Math.hypot(x - C.x, z - C.z) > R0 - 120) continue;
        const g = roadGap(x, z);
        if (g < half + W / 2 + 14) continue;
        const sc = -Math.hypot(x - C.x, z - C.z) - Math.max(0, g - (half + W / 2 + 40)) * 2;
        if (!best || sc > best.sc) best = { x, z, sc };
      }
    if (!best) return;
    const a = faceRoad(best.x, best.z);
    reserve(best.x, best.z, half * 1.35);
    palaceAt = { x: best.x, z: best.z, a };
    const g = new THREE.Group();
    g.position.set(best.x, 0, best.z);
    g.rotation.y = a;
    scene.add(g);
    const RED = '#b5524a',
      YEL = '#ecc96e',
      GRN = '#2a7d52';
    const rough = (x, w, h, base) => {
      x.fillStyle = base;
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < (w * h) / 18; i++) {
        x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,220,200,.05)';
        const r = 1 + Math.random() * 2.5;
        x.fillRect(Math.random() * w, Math.random() * h, r, r);
      }
    };
    const teeth = (x, x0, y0, y1, w, dir) => {
      x.fillStyle = YEL;
      for (let y = y0; y < y1; y += w * 2) x.fillRect(dir > 0 ? x0 : x0 - w, y, w, w);
    };
    const crenel = (x, w, y, hgt, n) => {
      x.fillStyle = YEL;
      x.fillRect(0, y, w, hgt * 0.45);
      const cw = w / (n * 2 - 1);
      for (let k = 0; k < n; k++) x.fillRect(k * cw * 2, y - hgt * 0.55, cw, hgt * 0.55);
    };
    // the tower's face: 12 m wide, 26 m tall
    const towerT = canvasTex(480, 1040, (x, w, h) => {
      rough(x, w, h, RED);
      const m = w / 12;
      x.fillStyle = GRN;
      x.fillRect(0, h - 1.4 * m, w, 1.4 * m);
      crenel(x, w, 1.1 * m, 1.1 * m, 6);
      // the tall arch: a yellow frame with a toothed edge, a pointed head, three lobed openings inside it
      const ax = w / 2,
        aw = 3.4 * m,
        top = 6.5 * m,
        spring = 11 * m,
        bot = h - 1.4 * m;
      const arch = (hw, ty, sy, by) => {
        x.beginPath();
        x.moveTo(ax - hw, by);
        x.lineTo(ax - hw, sy);
        x.quadraticCurveTo(ax - hw, ty + (sy - ty) * 0.25, ax, ty);
        x.quadraticCurveTo(ax + hw, ty + (sy - ty) * 0.25, ax + hw, sy);
        x.lineTo(ax + hw, by);
        x.closePath();
      };
      x.fillStyle = YEL;
      arch(aw, top, spring, bot);
      x.fill();
      teeth(x, ax - aw, spring, bot - 0.2 * m, 0.45 * m, -1);
      teeth(x, ax + aw, spring, bot - 0.2 * m, 0.45 * m, 1);
      x.fillStyle = GRN;
      x.fillRect(ax - aw - 0.45 * m, bot - 1.5 * m, aw * 2 + 0.9 * m, 1.5 * m);
      // the open lobes up top (sky shows through), the balcony, then the gateway
      x.fillStyle = '#5b2a20';
      arch(aw * 0.62, top + 1.1 * m, spring + 0.3 * m, 17.6 * m);
      x.fill();
      x.fillStyle = '#b9d6ef';
      for (const [ox, oy, hw] of [
        [0, 2.6, 0.55],
        [-1.15, 4.6, 0.42],
        [1.15, 4.6, 0.42],
      ]) {
        x.save();
        x.translate(ox * m, oy * m);
        arch(hw * m, top, top + 1.6 * m, 17.4 * m - oy * m * 0.2);
        x.fill();
        x.restore();
      }
      x.fillStyle = '#2b2f33';
      x.fillRect(ax - aw * 0.62, 16.6 * m, aw * 1.24, 0.15 * m);
      for (let k = -5; k <= 5; k++) x.fillRect(ax + k * aw * 0.11 - 1, 16.6 * m, 2, 1 * m);
      x.fillRect(ax - aw * 0.62, 17.5 * m, aw * 1.24, 0.12 * m);
      x.fillStyle = '#e2bb5c';
      x.fillRect(ax - aw * 0.72, 17.6 * m, aw * 1.44, 1.1 * m);
      x.fillStyle = '#1d140f';
      arch(aw * 0.62, 19.6 * m, 21.6 * m, bot);
      x.fill();
      x.fillStyle = 'rgba(31,107,69,.9)';
      arch(aw * 0.62, 19.6 * m, 21.2 * m, 21.3 * m);
      x.fill();
    });
    // a wing's face: 12 m wide, 13 m tall, two framed windows with the yellow cross panels over them
    const wingT = canvasTex(480, 520, (x, w, h) => {
      rough(x, w, h, RED);
      const m = w / 12;
      x.fillStyle = GRN;
      x.fillRect(0, h - 1.2 * m, w, 1.2 * m);
      crenel(x, w, 1.1 * m, 1.1 * m, 7);
      for (const cx of [w * 0.36, w * 0.64]) {
        x.fillStyle = YEL;
        x.fillRect(cx - 0.75 * m, 3.4 * m, 1.5 * m, 2.6 * m);
        x.fillStyle = RED;
        x.beginPath();
        x.moveTo(cx - 0.45 * m, 3.8 * m);
        x.lineTo(cx, 4.7 * m);
        x.lineTo(cx + 0.45 * m, 3.8 * m);
        x.moveTo(cx - 0.45 * m, 5.6 * m);
        x.lineTo(cx, 4.7 * m);
        x.lineTo(cx + 0.45 * m, 5.6 * m);
        x.fill();
        x.fillStyle = YEL;
        x.fillRect(cx - 0.8 * m, 6.4 * m, 1.6 * m, 3.9 * m);
        x.fillRect(cx - 1 * m, 10.3 * m, 2 * m, 0.35 * m);
        x.fillStyle = '#2d4a3e';
        x.fillRect(cx - 0.6 * m, 6.6 * m, 1.2 * m, 3.6 * m);
        x.fillStyle = 'rgba(200,220,210,.5)';
        for (let k = 1; k < 4; k++) x.fillRect(cx - 0.6 * m, 6.6 * m + k * 0.9 * m, 1.2 * m, 2);
      }
    });
    const wallT = canvasTex(
      256,
      128,
      (x, w, h) => {
        rough(x, w, h, RED);
        x.fillStyle = GRN;
        x.fillRect(0, h * 0.88, w, h * 0.12);
        x.fillStyle = YEL;
        x.fillRect(0, 0, w, h * 0.07);
      },
      { repeat: true },
    );
    const redM = new THREE.MeshLambertMaterial({
        map: canvasTex(128, 128, (x, w, h) => rough(x, w, h, RED), { repeat: true }),
      }),
      yelM = new THREE.MeshLambertMaterial({ color: YEL }),
      grnM = new THREE.MeshLambertMaterial({ color: GRN });
    const blk = (w, h, d, mats, x, y, z) => {
      const m = new THREE.Mesh(unitBox(), mats);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const tM = new THREE.MeshLambertMaterial({ map: towerT }),
      wM = new THREE.MeshLambertMaterial({ map: wingT });
    const crown = (cx, y, cz, w, d, n) => {
      // yellow crenellations round a roof, a horn at each corner
      for (const [sx, sz, len, along] of [
        [0, 1, w, 'x'],
        [0, -1, w, 'x'],
        [1, 0, d, 'z'],
        [-1, 0, d, 'z'],
      ]) {
        const k = Math.max(2, Math.round(len / 1.6));
        for (let i = 0; i < k; i++) {
          const t = (i + 0.5) / k - 0.5;
          blk(
            along === 'x' ? 0.8 : 0.6,
            1,
            along === 'x' ? 0.6 : 0.8,
            yelM,
            cx + (along === 'x' ? t * len : sx * (w / 2 - 0.3)),
            y,
            cz + (along === 'x' ? sz * (d / 2 - 0.3) : t * len),
          );
        }
      }
      blk(w + 0.3, 0.45, d + 0.3, yelM, cx, y - 0.5, cz);
      for (const [sx, sz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 4).translate(0, 1.2, 0), yelM);
        h.position.set(cx + sx * (w / 2 - 0.4), y, cz + sz * (d / 2 - 0.4));
        h.rotation.set(sz * 0.12, Math.PI / 4, -sx * 0.12);
        g.add(h);
      }
    };
    const fz = half * 0.8; // the front wall line (toward the road)
    // the gate tower and its wings, on the front wall
    blk(12, 26, 9, [redM, redM, redM, redM, tM, tM], 0, 0, fz);
    crown(0, 26, fz, 12, 9);
    for (const sx of [-1, 1]) {
      blk(12, 13, 8, [redM, redM, redM, redM, wM, wM], sx * 12, 0, fz - 0.3);
      crown(sx * 12, 13, fz - 0.3, 12, 8);
      for (const y of [17, 21])
        blk(1.6, 0.25, 0.25, new THREE.MeshLambertMaterial({ color: '#c9a76a' }), sx * 6.4, y, fz + 2.5); // toron beams
    }
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.8),
      new THREE.MeshLambertMaterial({ color: '#1d1f3a', side: THREE.DoubleSide }),
    );
    flag.position.set(1.6, 31.5, fz);
    g.add(flag);
    flagMeshes.push(flag);
    blk(0.12, 5, 0.12, new THREE.MeshLambertMaterial({ color: '#ddd' }), 0, 27, fz);
    // the compound wall
    const wallM = len => {
      const t = wallT.clone();
      t.repeat.set(len / 10, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0),
        m = blk(1, 8, 1, wallM(len), (x0 + x1) / 2, 0, (z0 + z1) / 2);
      m.scale.set(len, 8, 1.6);
      m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    };
    wall(-half, fz, -18, fz);
    wall(18, fz, half, fz);
    wall(-half, -fz, half, -fz);
    wall(-half, -fz, -half, fz);
    wall(half, -fz, half, fz);
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      blk(5, 11, 5, redM, sx * half, 0, sz * fz);
      crown(sx * half, 11, sz * fz, 5, 5);
    }
    // inside: the Emir's halls round a court, roofs crowned the same way, a green dome on the audience hall
    for (const [x, z, w, h, d] of [
      [0, -12, 30, 12, 20],
      [-30, 0, 14, 9, 30],
      [30, 0, 14, 9, 30],
      [-22, 26, 16, 8, 12],
      [22, 26, 16, 8, 12],
    ]) {
      blk(w, h, d, redM, x, 0, z);
      crown(x, h, z, w, d);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), grnM);
    dome.position.set(0, 12, -12);
    dome.castShadow = true;
    g.add(dome);
    blk(1, 1.4, 1, yelM, 0, 18, -12).scale.set(0.5, 1.6, 0.5);
    for (const [x, z] of [
      [-10, 12],
      [10, 12],
      [-40, -30],
      [40, -30],
      [0, 34],
    ])
      tree(...toW(best.x, best.z, a, x, z), 'neem');
  }

  function tree(x, z, kind) {
    if (kind === 'doum') {
      // doum palm: a trunk that forks, a fan crown on each branch
      const h = rr(5, 8);
      trunks.add(x, 0, z, 0, 0.35, h, 0.35, '#7d6249');
      for (const s of [-1, 1]) {
        const lean = 0.45 * s,
          bh = rr(3, 5),
          ex = x + Math.sin(lean) * bh,
          ey = h + Math.cos(lean) * bh;
        trunks.add(x, h - 0.2, z, 0, 0.28, bh, 0.28, '#7d6249', 0, -lean);
        canopy.add(ex, ey + 0.4, z, rand() * 6, 2.2, 1.1, 2.2, pick(['#6f8f4a', '#7d9c52', '#5f7f45']));
      }
    } else if (kind === 'baobab') {
      const h = rr(6, 9),
        r = rr(1.6, 2.4);
      trunks.add(x, 0, z, 0, r, h, r, '#9b8a7a');
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3 + rand();
        trunks.add(
          x + Math.cos(a) * r * 0.5,
          h - 0.4,
          z + Math.sin(a) * r * 0.5,
          a,
          0.25,
          rr(2.5, 4),
          0.25,
          '#9b8a7a',
          Math.cos(a) * 0.7,
          Math.sin(a) * 0.7,
        );
      }
      canopy.add(x, h + 2.6, z, rand() * 6, 3.6, 1.4, 3.6, pick(['#8a9a4a', '#97a352']));
    } else {
      // neem
      const h = rr(3, 4.5);
      trunks.add(x, 0, z, 0, 0.5, h, 0.5, '#6a4c33');
      canopy.add(
        x,
        h + 2.4,
        z,
        rand() * 6,
        rr(3.2, 4.4),
        rr(2.6, 3.4),
        rr(3.2, 4.4),
        pick(['#3f7a3a', '#4c8a3f', '#356b34', '#5a9446']),
      );
    }
  }

  /* ---------- the start: a toll-plaza gantry over the grid ----------
     A flat canopy over the road on four pillars, a toll booth under each end with its barrier arm raised, a deep fascia
     carrying the race name between checkered bands and the diamond-band relief, and five pairs of start lights hung
     facing the grid: they come on red one by one through the countdown and all go green on GO */
  const startLamps = [],
    gateGlow = []; // (gateGlow: Doha's gantry lights up at night: [material, strength])
  function startGate() {
    const i = 0,
      g = new THREE.Group(),
      x0 = W / 2 + 4,
      span = W / 2 + 10.5,
      top = 7.6,
      D = 9;
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, ht, d, m, x, y, z) => {
      const o = new THREE.Mesh(unitBox(), m);
      o.scale.set(w, ht, d);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    // Kano's is a toll plaza in the game's own colours; Doha's is a gateway in its own: cream limestone, Qatar maroon, gold
    const dq = doha,
      MAROON = '#7a1430',
      gold = new THREE.MeshPhongMaterial({ color: '#c9a24a', specular: '#fff1c4', shininess: 70 });
    const white = lam(dq ? '#f3ede0' : '#eef1f6'),
      navy = dq ? lam('#e8dcc4') : lam('#16246b'),
      orange = dq ? gold : lam('#ff6a00'),
      dark = lam(dq ? '#2a1a20' : '#1b1f2a'),
      glass = new THREE.MeshPhongMaterial({
        color: dq ? '#3a4a5a' : '#2a5a9a',
        specular: '#cfe8ff',
        shininess: 90,
        transparent: true,
        opacity: 0.75,
      });
    // the canopy: a white slab with a lip (orange in Kano, gold in Doha), light strips underneath
    box(span * 2, 1.2, D, white, 0, top, 0);
    box(span * 2 + 0.1, 0.3, D + 0.1, orange, 0, top + 1.2, 0);
    for (const x of [-12, -4, 4, 12])
      box(5.5, 0.06, D * 0.8, new THREE.MeshBasicMaterial({ color: '#fff6dc' }), x, top - 0.03, 0);
    // the fascia on both faces: navy, the race name in white, checkered bands, the relief at each end
    // Doha's fascia: maroon, the white serrated edge of the Qatari flag at each end, gold rules, gold eight-point stars
    const star8 = (x, cx, cy, r) => {
      x.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8 - Math.PI / 2,
          rr2 = k % 2 ? r * 0.62 : r;
        x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
      }
      x.closePath();
      x.fill();
    };
    const fas = dq
      ? canvasTex(2048, 220, (x, w, h) => {
          x.fillStyle = '#7a1430';
          x.fillRect(0, 0, w, h);
          for (const [x0s, dir] of [
            [0, 1],
            [w, -1],
          ]) {
            x.fillStyle = '#f6f2ea';
            x.beginPath();
            x.moveTo(x0s, 0);
            x.lineTo(x0s + dir * 150, 0); // the nine-point serration
            for (let k = 0; k < 9; k++) {
              const y0 = (k * h) / 9;
              x.lineTo(x0s + dir * 210, y0 + h / 18);
              x.lineTo(x0s + dir * 150, y0 + h / 9);
            }
            x.lineTo(x0s, h);
            x.closePath();
            x.fill();
          }
          x.fillStyle = '#d9b25a';
          x.fillRect(0, 14, w, 6);
          x.fillRect(0, h - 20, w, 6);
          x.fillRect(0, 26, w, 2);
          x.fillRect(0, h - 28, w, 2);
          x.fillStyle = '#ffffff';
          x.font = `italic 800 112px "Barlow Condensed", sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(opts.title || 'DOHA GRAND PRIX', w / 2, h / 2 + 4);
          const tw = x.measureText(opts.title || 'DOHA GRAND PRIX').width;
          x.fillStyle = '#d9b25a';
          for (const sd of [-1, 1]) {
            star8(x, w / 2 + sd * (tw / 2 + 80), h / 2, 38);
            for (let k = 1; k <= 3; k++) star8(x, w / 2 + sd * (tw / 2 + 80 + k * 120), h / 2, 22);
          }
        })
      : canvasTex(2048, 220, (x, w, h) => {
          x.fillStyle = '#16246b';
          x.fillRect(0, 0, w, h);
          for (const yy of [0, h - 26])
            for (let k = 0; k < w / 26; k++)
              for (let r = 0; r < 2; r++) {
                x.fillStyle = (k + r) % 2 ? '#0b1330' : '#f4f7ff';
                x.fillRect(k * 26, yy + r * 13, 26, 13);
              }
          x.fillStyle = '#ff6a00';
          x.fillRect(0, 26, w, 8);
          x.fillRect(0, h - 34, w, 8);
          x.fillStyle = '#ffffff';
          x.font = `italic 800 112px "Barlow Condensed", sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(opts.title || 'KANO GRAND PRIX', w / 2, h / 2 + 4);
          const pal = ['rgba(0,0,0,.35)', 'rgba(255,255,255,.25)', '#f6e7c8'];
          diamondBand(x, 40, 520, h / 2, 70, pal);
          diamondBand(x, w - 520, w - 40, h / 2, 70, pal);
        });
    const fasM = new THREE.MeshLambertMaterial({
      map: fas,
      ...(dq ? { emissive: '#ffffff', emissiveMap: fas, emissiveIntensity: 0 } : {}),
    });
    if (dq) {
      gateGlow.push([fasM, 0.75]);
      gold.emissive.set('#c9a24a');
      gold.emissiveIntensity = 0;
      gateGlow.push([gold, 0.55]);
      navy.emissive.set('#5a4a34');
      navy.emissiveIntensity = 0;
      gateGlow.push([navy, 1]);
    } // the sign lit, the gold catching the light, the stone floodlit
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, 2.2), fasM);
      p.position.set(0, top + 0.25, sz * (D / 2 + 0.02));
      if (sz < 0) p.rotation.y = Math.PI;
      g.add(p);
    }
    // pillars: navy with an orange collar, on a white plinth
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        box(1.3, top, 1.3, navy, sx * x0, 0, sz * (D / 2 - 1));
        box(1.36, 0.5, 1.36, orange, sx * x0, top - 1.4, sz * (D / 2 - 1));
        box(1.9, 0.5, 1.9, white, sx * x0, 0, sz * (D / 2 - 1));
      }
    if (dq) {
      // Doha: the pylons rise above the canopy as slim towers, banded in gold, a gold dome and finial on each
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const px = sx * x0,
            pz = sz * (D / 2 - 1);
          box(1.5, 3.4, 1.5, navy, px, top + 1.5, pz);
          box(1.6, 0.22, 1.6, gold, px, top + 2.9, pz);
          box(1.6, 0.22, 1.6, gold, px, top + 4.7, pz);
          box(1.95, 0.25, 1.95, gold, px, 0.5, pz);
          const dm = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
          dm.position.set(px, top + 4.9, pz);
          g.add(dm);
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.3, 8), gold);
          fin.position.set(px, top + 6.2, pz);
          g.add(fin);
        }
      // a pointed arch on each face between the pylons: the spandrels in a cream lattice screen, edged in gold
      const lat = canvasTex(
        128,
        128,
        (x, w, h) => {
          x.fillStyle = '#efe5d0';
          x.fillRect(0, 0, w, h);
          x.strokeStyle = '#b89a6a';
          x.lineWidth = 3;
          for (let k = -2; k < 3; k++) {
            x.beginPath();
            x.moveTo((k * w) / 2, 0);
            x.lineTo((k * w) / 2 + w, h);
            x.stroke();
            x.beginPath();
            x.moveTo((k * w) / 2 + w, 0);
            x.lineTo((k * w) / 2, h);
            x.stroke();
          }
          x.fillStyle = '#b89a6a';
          for (const [cx, cy] of [
            [0, 0],
            [w, 0],
            [0, h],
            [w, h],
            [w / 2, h / 2],
          ])
            star8(x, cx, cy, 12);
        },
        { repeat: true },
      );
      const ax = x0 - 0.65,
        spring = 3.6,
        apex = top - 0.35;
      const arch = new THREE.Shape();
      arch.moveTo(-ax, spring);
      arch.lineTo(-ax, top);
      arch.lineTo(ax, top);
      arch.lineTo(ax, spring);
      arch.bezierCurveTo(ax, spring + (apex - spring) * 0.75, ax * 0.32, apex - 0.25, 0, apex);
      arch.bezierCurveTo(-ax * 0.32, apex - 0.25, -ax, spring + (apex - spring) * 0.75, -ax, spring);
      const ag = new THREE.ExtrudeGeometry(arch, { depth: 0.5, bevelEnabled: false }),
        auv = ag.attributes.uv;
      for (let n = 0; n < auv.count; n++) auv.setXY(n, auv.getX(n) / 2.2, auv.getY(n) / 2.2);
      const arM = new THREE.MeshLambertMaterial({ map: lat });
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(ag, arM);
        m.position.set(0, 0, sz * (D / 2 - 1) - 0.25);
        m.castShadow = true;
        g.add(m);
        // the gold edge along the arch itself
        const pts = arch
          .getSpacedPoints(160)
          .filter(q => q.y < top - 0.05 && Math.abs(q.x) < ax - 0.05)
          .map(q => new THREE.Vector3(q.x, q.y, sz * (D / 2 - 1) + sz * 0.28));
        if (pts.length > 2)
          g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.09, 6), gold));
      }
    }
    // a toll booth under each end: a raised island with a hazard nose, a white kiosk with blue glass and an orange band,
    // its barrier arm (red and white) raised for the race
    const stripe = canvasTex(256, 32, (x, w, h) => {
      for (let k = 0; k < 8; k++) {
        x.fillStyle = k % 2 ? '#f4f7ff' : dq ? MAROON : '#e02a2a';
        x.fillRect(k * 32, 0, 32, h);
      }
    });
    const armM = new THREE.MeshLambertMaterial({ map: stripe });
    for (const sx of [-1, 1]) {
      const bx = sx * (W / 2 + 7.3);
      box(4.2, 0.3, D + 3, lam('#c9ccd4'), bx, 0, 0); // the island
      box(4.2, 0.32, 0.8, dq ? lam('#3a2a2e') : lam('#ffc400'), bx, 0, -(D / 2 + 1.1)); // its nose, facing the grid (hazard yellow in Kano, dark granite in Doha)
      box(3, 3.2, 3.6, white, bx, 0.3, 0); // the kiosk
      box(3.06, 0.3, 3.66, orange, bx, 2.1, 0); // its band
      for (const sz of [-1, 1]) box(2.2, 1.1, 0.05, glass, bx, 2.4 - 1.1 + 0.55, sz * 1.82); // windows front and back
      box(0.05, 1.1, 2.4, glass, bx - sx * 1.52, 1.85, 0); // the window onto the road
      box(3.4, 0.25, 4, dq ? lam(MAROON) : navy, bx, 3.5, 0); // its roof
      if (dq) box(3.5, 0.12, 4.1, gold, bx, 3.75, 0); // (Doha: a gold edge)
      // the barrier: a post, then the arm pivoted on it, swung up
      const post = box(0.5, 1.1, 0.5, dark, bx - sx * 1.9, 0.3, -2.6);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.22, 0.22).translate(-sx * 2.75, 0, 0), armM);
      arm.position.set(bx - sx * 1.9, 1.35, -2.6);
      arm.rotation.z = sx * 1.25;
      arm.castShadow = true;
      g.add(arm);
      void post;
    }
    // the start lights: a dark beam hung under the fascia on the grid side, five pods of two lamps
    const beamZ = -(D / 2 - 0.4);
    box(9, 1.4, 0.6, dark, 0, top - 1.8, beamZ);
    for (const sx of [-1, 1]) box(0.12, 0.6, 0.12, dark, sx * 4, top - 0.4, beamZ);
    const lampG = new THREE.CircleGeometry(0.42, 24);
    for (let k = 0; k < 5; k++) {
      const pod = [];
      for (const yy of [0.3, -0.3]) {
        const m = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: '#3a0c10' }));
        m.position.set((k - 2) * 1.7, top - 1.1 + yy, beamZ - 0.4);
        m.rotation.y = Math.PI;
        g.add(m);
        pod.push(m);
      }
      box(1.2, 1.25, 0.1, lam('#0b0d14'), (k - 2) * 1.7, top - 1.73, beamZ - 0.3);
      startLamps.push(pod);
    }
    g.position.copy(P[i]);
    g.rotation.y = tr.heading(i);
    scene.add(g);
    for (let o = -3; o <= 3; o++) tr.wall[tr.wrap(i + o)] = Math.min(tr.wall[tr.wrap(i + o)] || 99, x0 - 0.7); // the pillars are solid
    for (const sx of [-1, 1]) {
      const p = tr.beside(i, sx * (W / 2 + 7.3));
      reserve(p.x, p.z, 9);
    }
  }
  startGate();

  /* ---------- lay out Kano ---------- */
  const flagMeshes = [];
  // everything is placed where the chapter's track says (features carry road distances)
  const fr = s => tr.wrapS(s) / tr.len;
  if (!doha)
    for (const f of tr.feats) {
      if (f.type === 'gate') gate(fr(f.s), f.name);
      else if (f.type === 'walls') wall(fr(f.s), fr(f.s + f.len));
      else if (f.type === 'dye') dyePits(fr(f.s), fr(f.s + f.len));
      else if (f.type === 'market') {
        market(fr(f.s), fr(f.s + f.len));
        bunting(fr(f.s + 20));
        bunting(fr(f.s + f.len * 0.6));
      }
    }
  if (!doha) {
    bunting(fr(60));
    palace();
  }
  // houses: the dense old city along the middle of the lap, scattered compounds elsewhere
  if (!doha)
    for (let k = 0; k < 900; k++) {
      const f = rand(),
        i = Math.floor(f * N),
        s = rand() < 0.5 ? 1 : -1;
      const dense = f > 0.38 && f < 0.64;
      if (!dense && rand() < 0.55) continue;
      tryHouse(i, s, W / 2 + rr(16, dense ? 60 : 90), rand() < 0.25);
    }
  if (!doha)
    for (let k = 0; k < 500; k++) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * (R0 - 45),
        x = C.x + Math.cos(a) * r,
        z = C.z + Math.sin(a) * r;
      if (!free(x, z, 3)) continue;
      reserve(x, z, 2.5);
      const roll = rand();
      tree(x, z, roll < 0.4 ? 'neem' : roll < 0.8 ? 'doum' : 'baobab');
    }
  // doum palms around the beach
  const dk = {
    scene,
    tr,
    tex,
    rand,
    rr,
    pick,
    free: (x, z, r, mr) => isLand(x, z) && free(x, z, r, mr),
    land: (x, z) => isLand(x, z),
    reserve,
    faceRoad,
    roadGap,
    clearOfRoad,
    trunks,
    canopy,
    flat,
    plain,
    Inst,
    unitBox,
    toW,
    W,
    R0,
    C,
  };
  if (doha) opts.dress?.(dk); // the city itself (doha.js): it may hand back night(n), update(t) and its places
  if (!doha)
    for (let k = 0; k < 90; k++) {
      const a = rand() * Math.PI * 2,
        r = R0 - rr(50, 75),
        x = C.x + Math.cos(a) * r,
        z = C.z + Math.sin(a) * r;
      if (roadGap(x, z) > W / 2 + 15) tree(x, z, 'doum');
    }

  // the archipelago: every chapter's city is its own island out in the sea around Kano, each with its circuit laid
  // round it and its landmarks, so the map can fly from island to island
  const others = new THREE.Group(); // the other cities' islands, seen from the map
  const islands = [{ id: city, name: city.toUpperCase(), ch: 0, open: true, x: C.x, z: C.z, r: R0 }];
  {
    const sand = c => new THREE.MeshLambertMaterial({ color: c }),
      lam = c => new THREE.MeshLambertMaterial({ color: c }),
      flatM = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const roadT = tex.road.clone();
    roadT.needsUpdate = true;
    roadT.wrapS = roadT.wrapT = THREE.RepeatWrapping;
    const roadM = new THREE.MeshLambertMaterial({ map: roadT, side: THREE.DoubleSide });
    const put = (g, m, x, y, z) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      scene.add(o);
      return o;
    };
    const circuit = (cx, cz, r, seed, into = scene) => {
      // a closed loop of road round the island
      const pts = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2,
          rad = r * (0.58 + 0.14 * Math.sin(a * 3 + seed) + 0.06 * Math.cos(a * 5 + seed * 2));
        pts.push(new THREE.Vector3(cx + Math.cos(a) * rad, 0.7, cz + Math.sin(a) * rad));
      }
      const cv = new THREE.CatmullRomCurve3(pts, true, 'centripetal'),
        n = 300,
        w = 7,
        P = [],
        U = [],
        I = [];
      let dist = 0,
        prev = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n,
          p = cv.getPointAt(t % 1),
          tg = cv.getTangentAt(t % 1),
          nx = -tg.z,
          nz = tg.x;
        if (prev) dist += p.distanceTo(prev);
        prev = p;
        P.push(p.x + nx * w, 0.7, p.z + nz * w, p.x - nx * w, 0.7, p.z - nz * w);
        U.push(0, dist / 26, 1, dist / 26);
        if (k < n) {
          const b = k * 2;
          I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, roadM);
      into.add(m);
      return cv;
    };
    const tower = (x, z, w, h, col, round = false) => {
      const g = round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 16) : new THREE.BoxGeometry(w, h, w);
      put(g, lam(col), x, h / 2, z);
    };
    const dome = (x, y, z, r, col) =>
      put(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam(col), x, y, z);
    const DIST = R0 + 470,
      IR = 200;
    const defs = [
      ['doha', 'DOHA', 2, 0.35, '#efdcb4'],
      ['abudhabi', 'ABU DHABI', 3, 1.6, '#f1e0bc'],
      ['singapore', 'SINGAPORE', 4, 2.85, '#b9d3c4'],
      ['lagos', 'LAGOS', 5, 4.1, '#e3cfa2'],
    ];
    // where each island sits, with Kano in the middle of the archipelago; the city that's built sits at the centre of this
    // scene and the rest are placed round it the same way (Kano and Doha are built: tapping one travels there)
    const ALL = [['kano', 'KANO', 1, null], ...defs.map(d => d.slice(0, 4))],
      at = ang => (ang === null ? [0, 0] : [Math.cos(ang) * 1500, Math.sin(ang) * 1500]);
    const here = at(ALL.find(d => d[0] === city)[3]);
    for (const [id, name, ch, ang] of ALL) {
      if (id === city) {
        islands[0].name = name;
        islands[0].ch = ch;
        continue;
      }
      const p = at(ang);
      islands.push({
        id,
        name,
        ch,
        x: C.x + p[0] - here[0],
        z: C.z + p[1] - here[1],
        r: IR,
        built: id === 'kano' || id === 'doha',
      });
    }
    islands.sort((a, b) => a.ch - b.ch);
    // the other islands, seen from the map: a stand-in for each city, all in a few draw calls (one per material, merged)
    others.visible = false;
    scene.add(others); // (shown only while the map is open: main.js)
    {
      const SAND = Object.fromEntries([['kano', '#d9b98a'], ...defs.map(d => [d[0], d[4]])]),
        geos = [],
        tint = (g, c) => {
          const col = new THREE.Color(c),
            n = g.attributes.position.count,
            a2 = new Float32Array(n * 3);
          for (let k = 0; k < n; k++) col.toArray(a2, k * 3);
          g.setAttribute('color', new THREE.BufferAttribute(a2, 3));
          return g.index ? g.toNonIndexed() : g;
        };
      const at2 = (g, x, y, z, ry = 0) => g.rotateY(ry).translate(x, y, z);
      for (const is of islands) {
        if (is.id === city) continue;
        const { x, z } = is,
          r = is.r,
          rnd = mulberry(is.ch * 7919);
        geos.push(tint(at2(new THREE.CylinderGeometry(r + 40, r + 40, 0.3, 48), x, -1.15, z), '#62cfd6')); // the shallows
        geos.push(tint(at2(new THREE.CylinderGeometry(r, r + 14, 2.4, 48), x, -0.6, z), SAND[is.id] || '#e3cfa2')); // the sand
        const box = (bx, bz, w, h, d, c, ry = 0) =>
          geos.push(tint(at2(new THREE.BoxGeometry(w, h, d), x + bx, h / 2 + 0.6, z + bz, ry), c));
        if (is.id === 'kano') {
          // the old city wall, the palace and its dome, mud houses packed inside
          for (let k = 0; k < 40; k++) {
            const a3 = (k / 40) * Math.PI * 2;
            box(
              Math.cos(a3) * r * 0.72,
              Math.sin(a3) * r * 0.72,
              4,
              7,
              (r * 0.72 * Math.PI * 2) / 40 + 1,
              '#b9784a',
              -a3,
            );
          }
          box(0, 0, 34, 9, 26, '#e7d3ad');
          geos.push(
            tint(
              at2(new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 9.6, 0),
              '#2f8a5a',
            ).translate(x, 0, z),
          );
          for (let k = 0; k < 70; k++) {
            const a3 = rnd() * Math.PI * 2,
              rr2 = r * (0.2 + rnd() * 0.48);
            box(
              Math.cos(a3) * rr2,
              Math.sin(a3) * rr2,
              6 + rnd() * 6,
              3 + rnd() * 3,
              6 + rnd() * 6,
              rnd() < 0.5 ? '#c99a6a' : '#d8b07c',
              rnd(),
            );
          }
        } else if (is.id === 'doha') {
          // West Bay: glass towers round the Doha Tower
          geos.push(tint(at2(new THREE.CylinderGeometry(10, 10, 90, 20), 0, 45.6, 0), '#9fb3c8').translate(x, 0, z));
          for (let k = 0; k < 26; k++) {
            const a3 = rnd() * Math.PI * 2,
              rr2 = 20 + rnd() * r * 0.55,
              h = 25 + rnd() * 60;
            box(
              Math.cos(a3) * rr2,
              Math.sin(a3) * rr2,
              10 + rnd() * 8,
              h,
              10 + rnd() * 8,
              ['#2f6a9a', '#3f8a8a', '#8a9aac', '#26405e'][k % 4],
              rnd(),
            );
          }
        } else {
          // a city still to come: low blocks round a ring road
          for (let k = 0; k < 40; k++) {
            const a3 = rnd() * Math.PI * 2,
              rr2 = r * (0.15 + rnd() * 0.55);
            box(
              Math.cos(a3) * rr2,
              Math.sin(a3) * rr2,
              6 + rnd() * 8,
              4 + rnd() * (k % 6 ? 6 : 22),
              6 + rnd() * 8,
              rnd() < 0.5 ? '#efe6d4' : '#d9cbb0',
              rnd(),
            );
          }
        }
        circuit(x, z, r * 1.1, is.ch, others); // its race loop
      }
      if (geos.length) {
        const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true }));
        m.receiveShadow = true;
        others.add(m);
      }
    }
  }

  // street lights: a lamp post every 32 m along the road, alternating sides; at night each throws a pool of light
  // (Doha: white poles, both sides of the road every 18 m, a cooler, brighter light; Kano: dark poles, one side every 32 m)
  const poleM = new THREE.MeshLambertMaterial({ color: doha ? '#e9ecf1' : '#3a3f4a' });
  // one lamp's parts, in its own space (the post at the origin, the arm reaching out along +z over the road)
  const postG = mergeGeometries(
    [
      new THREE.CylinderGeometry(0.14, 0.2, 8, 8).translate(0, 4, 0),
      new THREE.BoxGeometry(0.18, 0.18, 3).translate(0, 8, 1.4),
      new THREE.BoxGeometry(0.7, 0.22, 1.2).translate(0, 7.9, 2.8),
    ].map(g => g.toNonIndexed()),
  );
  const bulbM = new THREE.MeshBasicMaterial({ color: '#5a5040' }),
    bulbG = new THREE.PlaneGeometry(0.55, 1).rotateX(Math.PI / 2).translate(0, 7.78, 2.8);
  const poolT = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'),
      g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,200,130,1)');
    g.addColorStop(0.5, 'rgba(255,180,100,.5)');
    g.addColorStop(1, 'rgba(255,160,80,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const poolM = new THREE.MeshBasicMaterial({
      map: poolT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
    poolG = new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2);
  // the glow round each bulb: one cloud of points for every lamp, so all the lamps are a handful of draw calls
  const glowM = new THREE.PointsMaterial({
    map: poolT,
    color: doha ? '#fff0d8' : '#ffd29a',
    size: 5,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const lampPosts = [],
    lampBulbs = [],
    lampPools = [],
    lampGlows = [],
    LM = new THREE.Matrix4(),
    LQ = new THREE.Quaternion(),
    LY = new THREE.Vector3(0, 1, 0),
    L1 = new THREE.Vector3(1, 1, 1);
  const LAMP = doha ? 18 : 32;
  for (let k = 0, alt = 1; k * LAMP < tr.len; k++, alt = -alt)
    for (const sd of doha ? [1, -1] : [alt]) {
      const i = tr.idx(k * LAMP + 12 + (doha && sd < 0 ? LAMP / 2 : 0));
      if (tr.trench[i] || tr.elevated[i] || (tr.closed && tr.closed[i]) || Math.abs(tr.P[i].y) > 0.3) continue;
      const p = tr.beside(i, sd * (W / 2 + 3.5));
      if (!free(p.x, p.z, 0.6, W / 2 + 2)) continue;
      LM.compose(p, LQ.setFromAxisAngle(LY, Math.atan2(-tr.L[i].x * sd, -tr.L[i].z * sd)), L1);
      lampPosts.push(postG.clone().applyMatrix4(LM));
      lampBulbs.push(bulbG.clone().applyMatrix4(LM));
      lampGlows.push(new THREE.Vector3(0, 7.7, 2.8).applyMatrix4(LM));
      const q = tr.beside(i, sd * (W / 2 - 5));
      lampPools.push(poolG.clone().translate(q.x, 0.1, q.z));
    }
  if (lampPosts.length) {
    const post = new THREE.Mesh(mergeGeometries(lampPosts), poleM);
    post.castShadow = true;
    scene.add(post);
    scene.add(new THREE.Mesh(mergeGeometries(lampBulbs), bulbM));
    const pool = new THREE.Mesh(mergeGeometries(lampPools), poolM);
    pool.renderOrder = 1;
    scene.add(pool);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(lampGlows), glowM));
  }

  for (const inst of [
    bodies,
    decoBodies,
    zanko,
    merlon,
    dark,
    spouts,
    posts,
    slabs,
    balls,
    cones,
    trunks,
    canopy,
    rims,
    dye,
    flags,
  ])
    inst.build(scene);

  return {
    sky,
    water,
    hill,
    palace: palaceAt,
    islands,
    others,
    places: dk.places || [],
    // the start lights: n red pods lit (0..5), or 'go' for all green
    startLights(n) {
      startLamps.forEach((pod, k) =>
        pod.forEach(m => m.material.color.set(n === 'go' ? '#2bff6a' : 4 - k < n ? '#ff2a2a' : '#3a0c10')),
      );
    },
    setNight(n) {
      // 0 day .. 1 night
      sky.material.uniforms.uNight.value = n;
      winMat.emissive.set('#ff9a3c');
      winMat.emissiveIntensity = n * 1.1;
      winMat.color.set(n > 0.5 ? '#3a2412' : '#2a1a10');
      bulbM.color.set(n > 0.5 ? '#fff2d6' : '#5a5040');
      poolM.opacity = n;
      glowM.opacity = n;
      dk.night?.(n);
      for (const [m, k] of gateGlow) m.emissiveIntensity = n * k;
    },
    update(dt, t, cam) {
      sky.position.copy(cam.position);
      dk.update?.(t);
      waterTex.offset.x = t * 0.004;
      waterTex.offset.y = t * 0.002;
      for (const c of cloths) c.m.rotation.x = Math.sin(t * 1.8 + c.ph) * 0.12;
      for (const f of flagMeshes) f.rotation.x = Math.sin(t * 3 + f.position.x) * 0.15;
    },
  };
}
