// Dala Hill, 2070: the hill is hollow. On the Dala circuit the road runs into the mountain through a portal on the
// viaduct and climbs the whole spiral inside it, in a world of its own: a dome of stars and nebula for a sky, the
// arewa knots drawn across it in gold like constellations, a glowing indigo lake on the floor, and in the middle the
// Heart of Dala, a spire from the lake to the roof ringed in light. Over the road all the way round runs one
// continuous vault painted like the Emir's hall (emirpalace.js), on terracotta ribs, lanterns down its crown, gold
// lines along the kerbs. Out through a second
// portal high on the mountainside onto the top deck, back into daylight. About 800 m under the rock.
// The rest of the lap never comes near (it stays 200 m+ from the hill), so the mountain sits on its own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';
import { fbm } from './util.js';
import { paintedVault } from './emirpalace.js';

// the mountain's shape, [radius, height]: a steep cliff from the ground, then a dome over the top
const PROFILE = [
  [178, 0],
  [177, 6],
  [176, 12],
  [175, 18],
  [174, 24],
  [173, 30],
  [172, 36],
  [170, 42],
  [167, 48],
  [163, 54],
  [157, 60],
  [148, 67],
  [136, 75],
  [120, 83],
  [100, 91],
  [76, 98],
  [48, 103],
  [20, 106],
  [0, 107],
];
export const HOLLOW_R = 182; // (what the rest of the city keeps clear of)
// the cliff's radius at height y (the portals go where the road meets it)
const shellR = y => {
  for (let i = 1; i < PROFILE.length; i++)
    if (PROFILE[i][1] >= y) {
      const [r0, y0] = PROFILE[i - 1],
        [r1, y1] = PROFILE[i];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  return 0;
};

// the sky inside: deep indigo to violet, stars, nebula, and gold knots drawn between bright stars
function starDome() {
  return canvasTex(2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05061a');
    g.addColorStop(0.55, '#0d0b33');
    g.addColorStop(1, '#2a1250');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    let r = 11;
    const R = () => (r = (r * 16807) % 2147483647) / 2147483647;
    // nebula: soft clouds in magenta, cyan and indigo
    for (let i = 0; i < 26; i++) {
      const cx = R() * w,
        cy = h * (0.15 + R() * 0.75),
        rad = 80 + R() * 220,
        col = ['255,60,170', '60,200,255', '120,80,255', '255,150,60'][(R() * 4) | 0],
        ng = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      ng.addColorStop(0, `rgba(${col},.22)`);
      ng.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = ng;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 2600; i++) {
      const s = R() < 0.95 ? 1 + R() * 1.4 : 2.5 + R() * 2;
      x.fillStyle = `rgba(255,${230 + R() * 25},${210 + R() * 45},${0.4 + R() * 0.6})`;
      x.fillRect(R() * w, R() * h, s, s);
    }
    // the knots as constellations: a diamond with a cross through it, gold lines, a bright star on each point
    x.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const cx = (i + 0.5) * (w / 9),
        cy = h * (0.3 + (i % 3) * 0.17),
        s = 60 + (i % 2) * 30;
      x.strokeStyle = 'rgba(255,198,92,.55)';
      x.beginPath();
      x.moveTo(cx, cy - s);
      x.lineTo(cx + s * 1.5, cy);
      x.lineTo(cx, cy + s);
      x.lineTo(cx - s * 1.5, cy);
      x.closePath();
      x.moveTo(cx - s * 0.75, cy - s * 0.5);
      x.lineTo(cx + s * 0.75, cy + s * 0.5);
      x.moveTo(cx + s * 0.75, cy - s * 0.5);
      x.lineTo(cx - s * 0.75, cy + s * 0.5);
      x.stroke();
      x.fillStyle = '#fff4d6';
      for (const [px, py] of [
        [cx, cy - s],
        [cx + s * 1.5, cy],
        [cx, cy + s],
        [cx - s * 1.5, cy],
      ]) {
        x.beginPath();
        x.arc(px, py, 4, 0, Math.PI * 2);
        x.fill();
      }
    }
  });
}

export function buildHollowDala(scene, tr, hill, W) {
  const cx = hill.x,
    cz = hill.z;
  const group = new THREE.Group();
  scene.add(group);

  // where the road meets the cliff, going in and coming out: scan the lap for where it crosses the shell
  const cross = [];
  {
    let prev = null;
    for (let s = 0; s < tr.len; s += 1) {
      const p = tr.point(s, 0),
        r = Math.hypot(p.x - cx, p.z - cz),
        inside = r < shellR(Math.max(0, p.y));
      if (prev !== null && inside !== prev) cross.push({ s, in: inside });
      prev = inside;
    }
  }
  const sIn = cross.find(c => c.in)?.s ?? 0,
    sOut = cross.find(c => !c.in && c.s > sIn)?.s ?? 0;
  // the portals' spans along the road: [centre, length]; no light arch stands inside one
  const IN = { c: sIn + 14, len: 40 },
    OUT = { c: sOut, len: 34 },
    inPortal = s => Math.abs(s - IN.c) < IN.len / 2 + 4 || Math.abs(s - OUT.c) < OUT.len / 2 + 4;

  /* ---------- the mountain: a rocky shell outside, the star dome inside, holes where the road goes through ---------- */
  const SEG = 220;
  const prof = [];
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i],
      [r1, y1] = PROFILE[i + 1],
      n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / 4));
    for (let k = 0; k < n; k++) prof.push([r0 + ((r1 - r0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  prof.push(PROFILE.at(-1));
  // (from the foot up to the top: the faces point outwards)
  const lathe = (grow = 0) => {
    const g = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(Math.max(0.01, r + grow), y)),
      SEG,
    );
    return g.toNonIndexed();
  };
  // drop every triangle the road passes through (near a crossing, around the road's height)
  const cut = (g, pad) => {
    const p = g.attributes.position,
      keep = [];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      m = new THREE.Vector3();
    for (let t = 0; t < p.count; t += 3) {
      a.fromBufferAttribute(p, t);
      b.fromBufferAttribute(p, t + 1);
      c.fromBufferAttribute(p, t + 2);
      m.copy(a).add(b).add(c).divideScalar(3);
      const n = tr.nearest(m.x + cx, m.z + cz),
        y = tr.P[n.i].y,
        s = (n.i * tr.len) / tr.N,
        dIn = Math.abs(s - sIn),
        dOut = Math.abs(s - sOut),
        top = dIn < dOut ? 11 : 15; // (as high as each portal's opening: the way in is lower)
      if (Math.min(dIn, dOut) < 60 && n.d < W / 2 + pad && m.y > y - 3 && m.y < y + top) continue;
      keep.push(t);
    }
    const out = new THREE.BufferGeometry(),
      arrs = {};
    for (const k of Object.keys(g.attributes)) {
      const at = g.attributes[k],
        src = at.array,
        sz = at.itemSize,
        dst = new Float32Array(keep.length * 3 * sz);
      keep.forEach((t, j) => dst.set(src.subarray(t * sz, (t + 3) * sz), j * 3 * sz));
      arrs[k] = new THREE.BufferAttribute(dst, sz);
      out.setAttribute(k, arrs[k]);
    }
    return out;
  };
  {
    // outside: rock, rough (pushed out by noise, never in), flat-shaded, scrub low down
    const g = lathe(0),
      p = g.attributes.position,
      col = new Float32Array(p.count * 3),
      c = new THREE.Color(),
      rock = new THREE.Color('#b19a80'),
      rock2 = new THREE.Color('#8d7a68'),
      scrub = new THREE.Color('#8a9a52');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        r = Math.hypot(x, z) || 1,
        n = fbm(x * 0.03 + 7, z * 0.03 + y * 0.04),
        push = 1 + Math.max(0, n - 0.35) * 0.09 * Math.min(1, y / 8 + 0.2);
      p.setXYZ(i, (x / r) * r * push, y + (y > 0.5 ? (n - 0.5) * 4 : 0), (z / r) * r * push);
      c.copy(rock)
        .lerp(rock2, Math.min(1, Math.max(0, (n - 0.4) * 3)))
        .lerp(scrub, Math.max(0, 1 - y / 30) * 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const outer = cut(g, 7);
    outer.computeVertexNormals();
    const m = new THREE.Mesh(
      outer,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.FrontSide }),
    );
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  {
    // inside: the star dome (the inner face of a slightly smaller shell), lit by nothing but itself
    const g = cut(lathe(-2.5), 6);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: starDome(), side: THREE.BackSide, fog: false }));
    group.add(m);
  }
  group.position.set(cx, -0.5, cz);

  /* ---------- the floor: dark glass, the lake glowing indigo in the middle ---------- */
  const lakeTex = canvasTex(512, 512, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#6a5cff');
    g.addColorStop(0.45, '#3a2fd0');
    g.addColorStop(0.85, '#1a1470');
    g.addColorStop(1, '#0a0a2a');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(160,220,255,.25)';
    for (let k = 1; k < 9; k++) {
      x.lineWidth = 2;
      x.beginPath();
      x.arc(w / 2, h / 2, (k * w) / 18, 0, Math.PI * 2);
      x.stroke();
    }
  });
  // the floor round the lake: a ring of giant arewa knots laid in light, gold and cyan on the dark, seen from the road
  // as it climbs (twelve knots between two gold rings, a band of diamonds inside them)
  const floorTex = canvasTex(2048, 2048, (x, w, h) => {
    const c = w / 2,
      R = w / 2;
    x.fillStyle = '#0d0a2a';
    x.fillRect(0, 0, w, h);
    x.lineCap = x.lineJoin = 'round';
    const ring = (r, lw, col) => {
      x.strokeStyle = col;
      x.lineWidth = lw;
      x.beginPath();
      x.arc(c, c, r, 0, Math.PI * 2);
      x.stroke();
    };
    x.shadowColor = '#ffc65c';
    x.shadowBlur = 18;
    ring(R * 0.61, 10, '#ffc65c');
    ring(R * 0.97, 12, '#ffc65c');
    ring(R * 0.93, 4, '#5fe6ff');
    ring(R * 0.65, 4, '#5fe6ff');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2,
        r = R * 0.79,
        s = R * 0.1;
      x.save();
      x.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
      x.rotate(a);
      x.strokeStyle = '#ffc65c';
      x.shadowColor = '#ffc65c';
      x.lineWidth = 9;
      // the knot: a diamond with a cross through it, a loop out of each point
      x.beginPath();
      x.moveTo(0, -s);
      x.lineTo(s, 0);
      x.lineTo(0, s);
      x.lineTo(-s, 0);
      x.closePath();
      x.moveTo(-s / 2, -s / 2);
      x.lineTo(s / 2, s / 2);
      x.moveTo(s / 2, -s / 2);
      x.lineTo(-s / 2, s / 2);
      x.stroke();
      x.strokeStyle = '#5fe6ff';
      x.shadowColor = '#5fe6ff';
      x.lineWidth = 6;
      for (const [px, py] of [
        [0, -s],
        [s, 0],
        [0, s],
        [-s, 0],
      ]) {
        x.beginPath();
        x.arc(px * 1.35, py * 1.35, s * 0.32, 0, Math.PI * 2);
        x.stroke();
      }
      x.restore();
    }
    // between the knots, a diamond each
    for (let k = 0; k < 12; k++) {
      const a = ((k + 0.5) / 12) * Math.PI * 2,
        r = R * 0.79,
        s = R * 0.045;
      x.save();
      x.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
      x.rotate(a);
      x.fillStyle = '#e0a42a';
      x.shadowColor = '#ffc65c';
      x.beginPath();
      x.moveTo(0, -s);
      x.lineTo(s, 0);
      x.lineTo(0, s);
      x.lineTo(-s, 0);
      x.fill();
      x.restore();
    }
  });
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(176, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: floorTex }),
  );
  floor.position.set(cx, 0.08, cz);
  floor.receiveShadow = true;
  scene.add(floor);
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(104, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: lakeTex }),
  );
  lake.position.set(cx, 0.14, cz);
  scene.add(lake);

  /* ---------- the Heart of Dala: a spire from the lake to the roof, rings of light round it ---------- */
  // its faces a lattice of light: gold diamonds on deep violet, a cyan knot in every other one
  const spireTex = canvasTex(256, 1024, (x, w, h) => {
    x.fillStyle = '#1e1238';
    x.fillRect(0, 0, w, h);
    x.lineJoin = 'round';
    for (let y = 0; y < h + 64; y += 64)
      for (let xx = 0; xx <= w; xx += 128) {
        const cx = xx + ((y / 64) % 2) * 64,
          cy = y;
        x.strokeStyle = '#ffc65c';
        x.lineWidth = 5;
        x.beginPath();
        x.moveTo(cx, cy - 32);
        x.lineTo(cx + 64, cy);
        x.lineTo(cx, cy + 32);
        x.lineTo(cx - 64, cy);
        x.closePath();
        x.stroke();
        if ((y / 64 + xx / 128) % 2 === 0) {
          x.strokeStyle = '#5fe6ff';
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(cx - 14, cy - 7);
          x.lineTo(cx + 14, cy + 7);
          x.moveTo(cx + 14, cy - 7);
          x.lineTo(cx - 14, cy + 7);
          x.stroke();
        }
      }
  });
  spireTex.wrapS = spireTex.wrapT = THREE.RepeatWrapping;
  spireTex.repeat.set(3, 3);
  const glow = [];
  {
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 13, 106, 6, 1),
      new THREE.MeshBasicMaterial({ map: spireTex }),
    );
    spire.position.set(cx, 53, cz);
    scene.add(spire);
    // gold seams up its six edges
    const seams = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const pts = [
        new THREE.Vector3(Math.cos(a) * 13.1, 0, Math.sin(a) * 13.1),
        new THREE.Vector3(Math.cos(a) * 4.6, 106, Math.sin(a) * 4.6),
      ];
      seams.push(new THREE.TubeGeometry(new THREE.LineCurve3(...pts), 1, 0.35, 4).translate(cx, 0, cz));
    }
    scene.add(new THREE.Mesh(mergeGeometries(seams), new THREE.MeshBasicMaterial({ color: '#ffc65c' })));
    // collars at three heights, each with a wide ring held out on four spokes
    const ringM = new THREE.MeshBasicMaterial({ color: '#5fe6ff' }),
      spokeM = new THREE.MeshLambertMaterial({ color: '#d9cdbd' });
    for (const [y, R] of [
      [26, 30],
      [52, 24],
      [78, 18],
    ]) {
      const rw = 13 - (y / 106) * 8.5;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 8, 64).rotateX(Math.PI / 2), ringM);
      ring.position.set(cx, y, cz);
      scene.add(ring);
      glow.push(ring);
      const sp = [];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + y;
        sp.push(
          new THREE.BoxGeometry(R - rw, 0.6, 0.8)
            .translate(rw + (R - rw) / 2, 0, 0)
            .rotateY(a)
            .translate(cx, y, cz),
        );
      }
      scene.add(new THREE.Mesh(mergeGeometries(sp), spokeM));
    }
  }

  /* ---------- the road through it: the vault's ribs over the way, gold kerbs ---------- */
  const s0 = sIn - 4,
    s1 = sOut + 4,
    span = s1 - s0;
  // the ribs: terracotta arches like the Emir's hall's, hugging the inside of the painted vault (same shape: RV, 0.95)
  const archG = new THREE.TorusGeometry(W / 2 + 3.6 - 0.5, 0.6, 8, 32, Math.PI); // a half ring standing on the road's edges
  const legG = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, -0.5, 0);
  const ARCH = 16,
    nArch = Math.floor(span / ARCH);
  const arches = new THREE.InstancedMesh(
    archG,
    new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a1408' }),
    nArch,
  );
  const legs = new THREE.InstancedMesh(legG, new THREE.MeshLambertMaterial({ color: '#3a3346' }), nArch * 2);
  const M = new THREE.Matrix4(),
    T = new THREE.Vector3(),
    Lv = new THREE.Vector3(),
    U = new THREE.Vector3(),
    O = new THREE.Vector3(),
    S1 = new THREE.Vector3(1, 1, 1),
    Q = new THREE.Quaternion();
  const archS = [];
  for (let k = 0; k < nArch; k++) {
    const s = s0 + ARCH / 2 + k * ARCH,
      i = tr.idx(tr.wrapS ? tr.wrapS(s) : s),
      p = tr.point(s, 0);
    T.copy(tr.T[i]).normalize();
    Lv.copy(tr.L[i]).normalize();
    U.crossVectors(Lv, T).normalize();
    if (U.y < 0) U.negate();
    // the ring lies in the plane across the road (x along the road's side, y up); the torus's own plane is xy
    M.makeBasis(Lv, U.clone().multiplyScalar(0.95), T).setPosition(O.copy(p).addScaledVector(U, 0.6));
    if (inPortal(s)) M.scale(new THREE.Vector3(0, 0, 0));
    arches.setMatrixAt(k, M);
    archS.push(s);
    // a short post under each foot, down to the deck's edge
    for (const sd of [-1, 1]) {
      const f = O.copy(p)
        .addScaledVector(Lv, sd * (W / 2 + 3))
        .addScaledVector(U, 0.6);
      Q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Lv, U, T));
      legs.setMatrixAt(
        k * 2 + (sd > 0 ? 1 : 0),
        new THREE.Matrix4().compose(f, Q, inPortal(s) ? S1.set(0, 0, 0) : S1.set(1, 0.6, 1)),
      );
    }
  }
  arches.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = true;
  const col = new THREE.Color();
  for (let k = 0; k < nArch; k++) arches.setColorAt(k, col.set('#8a3e28'));
  scene.add(arches, legs);
  // the painted vault over the road: the Emir's hall's ceiling (emirpalace.js), every panel a diamond in red, blue,
  // green, gold or black on cream, sweeping over the road the whole way round the spiral, banked with it, the light
  // arches as its ribs; the tiles glow a little and flow slowly towards you. Every so often it opens onto the stars
  const vaultTex = paintedVault();
  const vaultM = new THREE.MeshLambertMaterial({
    map: vaultTex,
    emissive: '#ffffff',
    emissiveMap: vaultTex,
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide,
  });
  const RV = W / 2 + 3.6,
    COLS = 28,
    inVault = s => !inPortal(s); // (one continuous vault from portal to portal)
  const lanterns = [];
  {
    let rows = [];
    const flush = () => {
      if (rows.length < 2) return (rows = []);
      const pos = [],
        uv = [],
        idx = [];
      rows.forEach(({ pts, v }, r) => {
        pts.forEach(([q, u]) => {
          pos.push(q.x, q.y, q.z);
          uv.push(u, v);
        });
        if (r) {
          const a0 = (r - 1) * (COLS + 1),
            a1 = r * (COLS + 1);
          for (let c = 0; c < COLS; c++) idx.push(a0 + c, a1 + c, a0 + c + 1, a0 + c + 1, a1 + c, a1 + c + 1);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, vaultM);
      m.receiveShadow = true;
      scene.add(m);
      rows = [];
    };
    for (let s = s0; s <= s1; s += 2) {
      if (!inVault(s)) {
        flush();
        continue;
      }
      const i = tr.idx(tr.wrapS ? tr.wrapS(s) : s),
        p = tr.point(s, 0);
      Lv.copy(tr.L[i]).normalize();
      T.copy(tr.T[i]).normalize();
      U.crossVectors(Lv, T).normalize();
      if (U.y < 0) U.negate();
      const pts = [];
      for (let c = 0; c <= COLS; c++) {
        const th = (c / COLS) * Math.PI;
        pts.push([
          p
            .clone()
            .addScaledVector(Lv, Math.cos(th) * RV)
            .addScaledVector(U, Math.sin(th) * RV * 0.95 + 0.6),
          (th * RV) / 9,
        ]);
      }
      rows.push({ pts, v: (s - s0) / 9 });
      if (Math.round(s - s0) % 12 === 6) lanterns.push(p.clone().addScaledVector(U, RV * 0.95 + 0.6));
    }
    flush();
  }
  // lanterns hung on chains from the crown of the vault
  if (lanterns.length) {
    const chain = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3, 4).translate(0, -1.5, 0),
      new THREE.MeshLambertMaterial({ color: '#2a1a14' }),
      lanterns.length,
    );
    const lamp = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.75, 12, 8).scale(1, 1.25, 1).translate(0, -3.7, 0),
      new THREE.MeshBasicMaterial({ color: '#ffcf7a' }),
      lanterns.length,
    );
    const cap = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.6, 0.6, 8).translate(0, -2.75, 0),
      new THREE.MeshLambertMaterial({ color: '#c99a3a' }),
      lanterns.length,
    );
    const m4 = new THREE.Matrix4();
    lanterns.forEach((q, i) => {
      m4.makeTranslation(q.x, q.y, q.z);
      chain.setMatrixAt(i, m4);
      lamp.setMatrixAt(i, m4);
      cap.setMatrixAt(i, m4);
    });
    scene.add(chain, lamp, cap);
  }

  // the kerbs: a glowing line along each edge of the road, the length of the tunnel
  {
    const strips = [];
    for (const sd of [-1, 1]) {
      const pos = [],
        idx = [];
      let n = 0;
      for (let s = s0; s <= s1; s += 3, n++) {
        const i = tr.idx(tr.wrapS ? tr.wrapS(s) : s),
          p = tr.point(s, 0);
        Lv.copy(tr.L[i]).normalize();
        for (const off of [-0.25, 0.25]) {
          const q = p.clone().addScaledVector(Lv, sd * (W / 2 - 0.6) + off);
          pos.push(q.x, q.y + 0.12, q.z);
        }
        if (n) idx.push((n - 1) * 2, n * 2, (n - 1) * 2 + 1, (n - 1) * 2 + 1, n * 2, n * 2 + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      strips.push(g);
    }
    const m = new THREE.Mesh(
      mergeGeometries(strips),
      new THREE.MeshBasicMaterial({ color: '#e0a42a', side: THREE.DoubleSide }),
    );
    m.renderOrder = 2;
    scene.add(m);
  }

  /* ---------- the portals: a laterite collar round the road where it goes through the rock, ringed in gold ---------- */
  // The way in is low and long (the top deck passes close over it on its way out of the mountain, so it keeps under
  // the deck), the way out tall with two zanko horns on its crown.
  {
    const collarM = new THREE.MeshLambertMaterial({ color: '#b5573a' }),
      goldM = new THREE.MeshBasicMaterial({ color: '#ffc65c' }),
      hornM = new THREE.MeshLambertMaterial({ color: '#c0663f' });
    const hw = W / 2 + 5;
    const portal = (c, { ht, th, cap, DEP, horns }) => {
      const sh = new THREE.Shape();
      sh.moveTo(-hw - th, -1);
      sh.lineTo(hw + th, -1);
      sh.lineTo(hw + th, ht);
      sh.quadraticCurveTo(hw + th, ht + th + cap, 0, ht + th + cap);
      sh.quadraticCurveTo(-hw - th, ht + th + cap, -hw - th, ht);
      sh.lineTo(-hw - th, -1);
      const hole = new THREE.Path();
      hole.moveTo(-hw, -1);
      hole.lineTo(-hw, ht - 2);
      hole.quadraticCurveTo(-hw, ht + 3, 0, ht + 3);
      hole.quadraticCurveTo(hw, ht + 3, hw, ht - 2);
      hole.lineTo(hw, -1);
      hole.lineTo(-hw, -1);
      sh.holes.push(hole);
      const collar = new THREE.ExtrudeGeometry(sh, { depth: DEP, bevelEnabled: false }).translate(0, 0, -DEP / 2);
      // a gold band just round the opening, at each end
      const grow = new THREE.Path(
        hole.getPoints(24).map(v => new THREE.Vector2(v.x * (1 + 1.2 / hw), v.y < 0 ? v.y : v.y + 1.2)),
      );
      const bandShape = new THREE.Shape(grow.getPoints());
      bandShape.holes.push(hole);
      const bandG = new THREE.ExtrudeGeometry(bandShape, { depth: 0.5, bevelEnabled: false });
      const i = tr.idx(c),
        p = tr.point(c, 0);
      T.copy(tr.T[i]).normalize();
      Lv.copy(tr.L[i]).normalize();
      U.crossVectors(Lv, T).normalize();
      if (U.y < 0) U.negate();
      const basis = new THREE.Matrix4().makeBasis(Lv, U, T).setPosition(p);
      const m = new THREE.Mesh(collar, collarM);
      m.applyMatrix4(basis);
      m.castShadow = true;
      scene.add(m);
      for (const z of [-DEP / 2 - 0.5, DEP / 2]) {
        const b = new THREE.Mesh(bandG, goldM);
        b.position.z = z;
        b.updateMatrix();
        b.applyMatrix4(basis);
        scene.add(b);
      }
      if (horns)
        for (const sd of [-1, 1]) {
          const h = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 8).translate(0, 4.5, 0), hornM);
          h.rotation.z = -sd * 0.4;
          h.position.set(sd * (hw * 0.5), ht + th + cap - 1.5, 0);
          h.updateMatrix();
          h.applyMatrix4(basis);
          h.castShadow = true;
          scene.add(h);
        }
    };
    portal(IN.c, { ht: 8, th: 3.5, cap: 1, DEP: IN.len, horns: false });
    portal(OUT.c, { ht: 15, th: 6, cap: 4, DEP: OUT.len, horns: true });
  }

  return {
    sIn,
    sOut,
    update(t) {
      for (const r of glow) r.rotation.y = t * 0.2;
      lakeTex.rotation = t * 0.02;
      lakeTex.center.set(0.5, 0.5);
      vaultTex.offset.y = -t * 0.35; // (the tiles flow towards you)
      spireTex.offset.y = t * 0.04;
    },
  };
}
