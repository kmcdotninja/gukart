// The circuit in 3D. Every sample carries a frame (forward T, left L, up U), so karts ride the road itself: up the
// spiral, over the flyover, upside down through the loop. Corners are banked from their curvature.
import * as THREE from 'three';
import { clamp } from './util.js';
import { signTex } from './textures.js';
import * as DQ from './doharoad.js';
import * as SG from './sgroad.js';
import { SUBWAYS } from './subways.js';

export const W = 26;
const V = () => new THREE.Vector3();

export function buildTrack(def) {
  const pts = def.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const len = curve.getLength();
  const N = Math.round(len / 2);
  const P = curve.getSpacedPoints(N).slice(0, N);
  const seg = len / N,
    scale = len / def.len;
  const wrap = i => ((i % N) + N) % N;
  const wrapS = s => ((s % len) + len) % len;
  const sOf = turtleS => turtleS * scale;

  const inLoop = new Uint8Array(N);
  for (const [a, b] of def.loops)
    for (let s = sOf(a) - 6; s < sOf(b) + 6; s += seg / 2) inLoop[wrap(Math.floor(wrapS(s) / seg))] = 1;

  // the spline overshoots a little at the foot of each ramp: keep the road on or above the ground
  // (only where the designed road is at ground level: the underpass is meant to go down)
  for (let i = 0; i < N; i++) {
    if (inLoop[i] || P[i].y >= 0) continue;
    let low = 0;
    for (const q of pts) if (Math.hypot(q.x - P[i].x, q.z - P[i].z) < 9) low = Math.min(low, q.y);
    if (low > -0.05) P[i].y = 0;
  }
  const T = P.map((_, i) =>
    V()
      .subVectors(P[wrap(i + 1)], P[wrap(i - 1)])
      .normalize(),
  );
  // up: straight up (tipped with the road's slope) everywhere on the ground and the bridges; round a loop-the-loop it's
  // carried along the road (parallel transport) from the foot, and the small twist the loop's sideways step leaves is
  // eased out inside the loop itself, so the road comes out level. (It used to be carried round the whole lap with the
  // twist spread over every metre: a loop then tipped the road and its barriers over on the approach)
  const upOf = i => V().set(0, 1, 0).addScaledVector(T[i], -T[i].y).normalize();
  const U = P.map((_, i) => upOf(i));
  for (let a = 0; a < N; a++) {
    if (!inLoop[a] || inLoop[wrap(a - 1)]) continue; // the first point of each loop
    let b = a;
    while (inLoop[wrap(b + 1)] && b - a < N) b++;
    for (let i = a; i <= b; i++) {
      const u = U[wrap(i - 1)];
      U[wrap(i)] = u
        .clone()
        .addScaledVector(T[wrap(i)], -u.dot(T[wrap(i)]))
        .normalize();
    }
    const k = wrap(b + 1),
      end = U[wrap(b)].clone().addScaledVector(T[k], -U[wrap(b)].dot(T[k])).normalize(),
      want = U[k];
    const phi = Math.atan2(V().crossVectors(end, want).dot(T[k]), end.dot(want)),
      n = b - a + 1;
    for (let i = a; i <= b; i++) {
      const ang = (phi * (i - a + 1)) / (n + 1),
        t = T[wrap(i)],
        u = U[wrap(i)],
        c = V().crossVectors(t, u);
      u.multiplyScalar(Math.cos(ang)).addScaledVector(c, Math.sin(ang)).normalize();
    }
  }
  // bank the flat corners into the turn
  let L = U.map((u, i) => V().crossVectors(u, T[i]).normalize());
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // no banking on roads at ground level: a tilted road would dip its inner edge into the ground
    if (inLoop[i] || Math.abs(T[i].y) > 0.3 || U[i].y < 0.8 || P[i].y < 1.5) continue;
    raw[i] = clamp(
      (V()
        .subVectors(T[wrap(i + 1)], T[wrap(i - 1)])
        .dot(L[i]) /
        (2 * seg)) *
        26,
      -0.3,
      0.3,
    );
  }
  let bank = raw;
  for (let pass = 0; pass < 3; pass++) {
    const nb = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let o = -10; o <= 10; o++) s += bank[wrap(i + o)];
      nb[i] = s / 21;
    }
    bank = nb;
  }
  for (let i = 0; i < N; i++) {
    const b = bank[i];
    U[i].multiplyScalar(Math.cos(b)).addScaledVector(L[i], Math.sin(b)).normalize();
  }
  L = U.map((u, i) => V().crossVectors(u, T[i]).normalize());
  // how fast the road turns under a kart (around its own up), for the physics
  const K = new Float32Array(N);
  for (let i = 0; i < N; i++)
    K[i] =
      V()
        .subVectors(T[wrap(i + 1)], T[wrap(i - 1)])
        .dot(L[i]) /
      (2 * seg);
  const elevated = new Uint8Array(N),
    limit = new Float32Array(N);
  // raised stretches: one that climbs above 10 m is a bridge (deck, barriers, pillars); lower ones are earth mounds you
  // can run wide on, with shoulders and embankments down to the ground
  for (let i = 0; i < N; i++) {
    if (!(P[i].y > 1.2 || inLoop[i]) || P[wrap(i - 1)].y > 1.2 || inLoop[wrap(i - 1)]) continue;
    let j = i,
      top = 0;
    while ((P[wrap(j)].y > 1.2 || inLoop[wrap(j)]) && j < i + N) {
      top = Math.max(top, P[wrap(j)].y);
      j++;
    }
    if (top > 10 || def.loops.length) for (let k = i; k < j; k++) elevated[wrap(k)] = 1;
  }
  const elev2 = elevated.slice();
  for (let i = 0; i < N; i++) if (elevated[i]) for (let o = -4; o <= 4; o++) elev2[wrap(i + o)] = 1;
  for (let i = 0; i < N; i++) {
    elevated[i] = elev2[i];
    limit[i] = elevated[i] ? W / 2 - 0.8 : W / 2 + 9;
  }
  // below ground: the ramps run in a walled trench, the deep part is a covered tunnel split by a central wall into two bores
  const trench = new Uint8Array(N),
    covered = new Uint8Array(N),
    divider = new Uint8Array(N);
  // a water bridge (The Pearl): a deck that dips close to the sea, then a glass tube under it. Not a trench or an
  // underpass, though it runs below street level: doha.js builds it
  const lowb = new Uint8Array(N);
  // a water lane (Singapore's river): the road runs on the water itself, the river on one side ('in' or 'out' of the
  // loop), the bank on the other; it counts as a water bridge for everything else
  const wway = new Int8Array(N);
  for (const f of def.feats)
    if (f.type === 'lowbridge' || f.type === 'waterway')
      for (let s = sOf(f.s); s <= sOf(f.s + f.len); s += seg / 2) {
        const k = wrap(Math.floor(wrapS(s) / seg));
        lowb[k] = 1;
        if (f.type === 'waterway') wway[k] = f.side === 'in' ? -1 : 1;
      }
  for (let i = 0; i < N; i++) {
    if (P[i].y < -0.3 && !lowb[i]) {
      trench[i] = 1;
      limit[i] = W / 2 - 0.8;
    }
    if (P[i].y < -8.3 && !lowb[i]) covered[i] = 1;
  } // the mouth's top sits flush with the street
  // where a solid wall stands beside the road (barriers, trench walls; the gates add theirs): vehicles stop at it by their own width
  const wall = new Float32Array(N);
  for (let i = 0; i < N; i++) if (elevated[i] || trench[i] || lowb[i]) wall[i] = W / 2 + 0.2;
  // (no central wall: the underpass is one wide road)
  // the central wall's half width: full in the middle, tapering to a point at each end like the nose of a highway barrier
  const divW = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!divider[i]) continue;
    let a = 0,
      b = 0;
    while (divider[wrap(i - a - 1)] && a < 40) a++;
    while (divider[wrap(i + b + 1)] && b < 40) b++;
    divW[i] = 1.1 * Math.min(1, Math.min(a, b) / 9);
  }

  // features, now in road distance
  const feats = def.feats.map(f => ({ ...f, s: wrapS(sOf(f.s)), len: f.len ? sOf(f.len) : 0 }));
  // a hall the road runs through (Doha's airport): a rail either side of the tarmac, the concourse beyond it
  const hall = new Uint8Array(N); // (and no kerb or pavement there: the hall lays its own floor)
  for (const f of feats)
    if (f.type === 'airport' || f.type === 'hall')
      for (let s = f.s; s <= f.s + f.len; s += seg / 2) {
        const i = wrap(Math.floor(wrapS(s) / seg));
        wall[i] = W / 2 + 0.2;
        hall[i] = 1;
      }
  const kickers = feats.filter(f => f.type === 'kicker').map(f => ({ s: f.s, gap: [f.s + 3, f.s + 24] }));
  const inGap = new Uint8Array(N);
  for (const k of kickers)
    for (let s = k.gap[0]; s < k.gap[1]; s += seg / 2) inGap[wrap(Math.floor(wrapS(s) / seg))] = 1;

  // a smooth frame anywhere along the road
  function frame(s, F) {
    s = wrapS(s);
    const f = s / seg,
      i0 = Math.floor(f) % N,
      i1 = (i0 + 1) % N,
      k = f - Math.floor(f);
    F.p.lerpVectors(P[i0], P[i1], k);
    F.t.lerpVectors(T[i0], T[i1], k).normalize();
    F.u.lerpVectors(U[i0], U[i1], k).normalize();
    F.l.lerpVectors(L[i0], L[i1], k).normalize();
    F.i = i0;
    return F;
  }
  const newFrame = () => ({ p: V(), t: V(), u: V(), l: V(), i: 0 });
  const point = (s, lat, h = 0, out = V()) => {
    const F = frame(s, tmpF);
    return out.copy(F.p).addScaledVector(F.l, lat).addScaledVector(F.u, h);
  };
  const tmpF = newFrame();

  // flat helpers for laying out scenery on the ground
  function nearest(x, z) {
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < N; i += 3) {
      const dx = P[i].x - x,
        dz = P[i].z - z,
        d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    for (let o = -2; o <= 2; o++) {
      const i = wrap(best + o),
        dx = P[i].x - x,
        dz = P[i].z - z,
        d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return { i: best, d: Math.sqrt(bd) };
  }
  function isInside(x, z) {
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = P[i],
        b = P[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  }
  const flatL = i => V().set(T[i].z, 0, -T[i].x).normalize();
  const out = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const l = flatL(i);
    out[i] = isInside(P[i].x + l.x * 40, P[i].z + l.z * 40) ? -1 : 1;
  }
  const beside = (i, off) => {
    i = wrap(Math.round(i));
    const l = flatL(i);
    return V().set(P[i].x + l.x * off, 0, P[i].z + l.z * off);
  };
  const heading = i => {
    const t = T[wrap(Math.round(i))];
    return Math.atan2(t.x, t.z);
  };
  const idx = s => Math.floor(wrapS(s) / seg) % N;

  const box = new THREE.Box3().setFromPoints(P);
  const center = box.getCenter(V());
  center.y = 0;
  let radius = 0;
  for (const p of P) radius = Math.max(radius, Math.hypot(p.x - center.x, p.z - center.z));

  return {
    N,
    P,
    T,
    U,
    L,
    K,
    len,
    seg,
    limit,
    elevated,
    inLoop,
    inGap,
    kickers,
    trench,
    lowb,
    wway,
    hall,
    covered,
    divider,
    divW,
    wall,
    feats,
    wrap,
    wrapS,
    idx,
    frame,
    newFrame,
    point,
    nearest,
    isInside,
    out,
    beside,
    heading,
    center,
    radius,
    box,
  };
}

/* ---------- meshes ---------- */
function strip(tr, rows, skip) {
  // rows: [lat, h] pairs across the road; one vertex row per sample; v runs along the road
  const { N, P, L, U, seg } = tr,
    pos = [],
    uv = [],
    idx = [],
    R = rows.length;
  for (let k = 0; k <= N; k++) {
    const i = k % N;
    rows.forEach(([lat0, h0], r) => {
      const lat = typeof lat0 === 'function' ? lat0(i) : lat0,
        h = typeof h0 === 'function' ? h0(i) : h0;
      pos.push(
        P[i].x + L[i].x * lat + U[i].x * h,
        P[i].y + L[i].y * lat + U[i].y * h,
        P[i].z + L[i].z * lat + U[i].z * h,
      );
      uv.push(r / (R - 1), k * seg);
    });
  }
  for (let k = 0; k < N; k++) {
    if (skip && skip(k)) continue;
    for (let r = 0; r < R - 1; r++) {
      const a = k * R + r,
        b = a + 1,
        c = a + R,
        d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const vscale = (g, s) => {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) / s);
  return g;
};

export function buildRoad(scene, tr, tex) {
  const { N, elevated, inGap } = tr;
  const add = (g, mat, shadow = true) => {
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = shadow;
    scene.add(m);
    return m;
  };
  // asphalt
  const shut = k => tr.closed && tr.closed[k];
  {
    const g = vscale(
      strip(
        tr,
        [
          [W / 2, 0.06],
          [-W / 2, 0.06],
        ],
        k => inGap[k] || shut(k),
      ),
      24,
    );
    // a slow wash of tone along the lap, so the 24 m texture never reads as a repeat: newer and older stretches of tarmac
    const col = [],
      n = g.attributes.position.count;
    for (let v = 0; v < n; v++) {
      const s = (v >> 1) * tr.seg,
        side = v & 1;
      const t = 1 + 0.07 * Math.sin(s / 41) + 0.05 * Math.sin(s / 97 + 2) + 0.03 * Math.sin(s / 13 + side * 1.7);
      col.push(t, t, t * 1.01);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    add(g, new THREE.MeshLambertMaterial({ map: tex.road, vertexColors: true, side: THREE.DoubleSide }), false);
  }
  // dust blown in from the shoulders, lying over the asphalt
  {
    const dustM = new THREE.MeshLambertMaterial({
      map: tex.dust,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    if (tr.city !== 'doha' && tr.city !== 'singapore')
      for (const sg of [1, -1])
        add(
          vscale(
            strip(
              tr,
              [
                [(sg * W) / 2, 0.065],
                [sg * (W / 2 - 2.6), 0.065],
              ],
              k => elevated[k] || inGap[k] || tr.trench[k] || tr.lowb[k] || tr.hall[k] || shut(k),
            ),
            6,
          ),
          dustM,
          false,
        ); // (Doha's streets are swept)
  }
  // curbs on the ground, barriers on the decks
  // (Doha: a grey concrete kerb and a paved pavement with palms in it, not a racing kerb and a dirt verge)
  const curbMat = new THREE.MeshLambertMaterial({ map: tr.city === 'doha' ? DQ.kerbTex() : tex.curb });
  // a raised crown across each kerb (low at both lips, high in the middle) so the light catches it
  add(
    vscale(
      strip(
        tr,
        [
          [W / 2 + 2.4, 0.1],
          [W / 2 + 1.7, 0.19],
          [W / 2 + 0.6, 0.17],
          [W / 2, 0.07],
        ],
        k => elevated[k] || inGap[k] || tr.trench[k] || tr.lowb[k] || tr.hall[k] || shut(k),
      ),
      4,
    ),
    curbMat,
    false,
  );
  add(
    vscale(
      strip(
        tr,
        [
          [-W / 2, 0.07],
          [-W / 2 - 0.6, 0.17],
          [-W / 2 - 1.7, 0.19],
          [-W / 2 - 2.4, 0.1],
        ],
        k => elevated[k] || inGap[k] || tr.trench[k] || tr.lowb[k] || tr.hall[k] || shut(k),
      ),
      4,
    ),
    curbMat,
    false,
  );
  // dirt shoulders past the curbs, then an embankment down into the ground: one continuous surface, nothing floats
  tex.ground.repeat.set(1, 1);
  const dirt =
    tr.city === 'doha'
      ? new THREE.MeshLambertMaterial({ map: DQ.paverTex(), side: THREE.DoubleSide })
      : tr.city === 'singapore'
        ? new THREE.MeshLambertMaterial({ map: SG.paverTex(), side: THREE.DoubleSide }) // (Singapore: slabs and a verge)
        : new THREE.MeshLambertMaterial({
            color: tr.city === 'kaduna' ? '#cf9f78' : '#d9c7a2', // (Kaduna's verges are red laterite)
            map: tex.dirt,
            side: THREE.DoubleSide,
          });
  const foot = i => W / 2 + 12.5 + tr.P[i].y * 1.8,
    drop = i => -tr.P[i].y - 0.4;
  for (const sg of [1, -1]) {
    add(
      vscale(
        strip(
          tr,
          [
            [sg * (W / 2 + 2.4), 0.1],
            [sg * (W / 2 + 11.5), 0.05],
            [i => sg * foot(i), drop],
          ],
          // (it carries on up the low ends of a bridge, so the road climbs out of the ground on a bank and meets the
          // deck where it's well up: it used to stop dead at the foot of the ramp, a cut face of earth beside the road)
          k =>
            (elevated[k] && Math.max(tr.P[k].y, tr.P[(k + 1) % N].y) > 3.5) ||
            inGap[k] ||
            tr.trench[k] ||
            tr.lowb[k] ||
            tr.hall[k] ||
            shut(k) ||
            tr.inLoop[k] ||
            tr.inLoop[(k + 1) % N],
        ),
        10,
      ),
      dirt,
      false,
    ); // (none round a loop-the-loop: the strip leading in swung up into a slab)
  }
  // the underpass: trench walls with a concrete cap out to the ground, a lit ceiling over the deep part, a central wall
  {
    const { trench, covered, divider, P } = tr,
      notT = k => !trench[k] || !trench[(k + 1) % N],
      notC = k => !covered[k] || !covered[(k + 1) % N];
    // Doha's is its own (doharoad.js): limestone panels with the star band, sandstone coping, a pale lit ceiling, white
    // lamp posts, a sandstone portal under a mashrabiya lattice, and Qatar's blue road signs in Arabic and English
    const dq = tr.city === 'doha';
    const wallM = new THREE.MeshLambertMaterial({ map: dq ? DQ.underpassWall() : tex.tunnel, side: THREE.DoubleSide }),
      capM = new THREE.MeshLambertMaterial({ color: dq ? '#d9c7a3' : '#7d8189', side: THREE.DoubleSide });
    const railM = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.35 });
    const top = i => (covered[i] ? 8 : -P[i].y + 0.6); // up to the ceiling inside, to just above the ground in the open trench
    for (const sg of [1, -1]) {
      add(
        vscale(
          strip(
            tr,
            [
              [sg * (W / 2 + 0.2), 0],
              [sg * (W / 2 + 0.2), top],
            ],
            notT,
          ),
          6,
        ),
        wallM,
      );
      add(
        strip(
          tr,
          [
            [sg * (W / 2 + 0.2), i => -P[i].y + 0.6],
            [sg * (W / 2 + 27), i => -P[i].y + 0.6],
          ],
          k => notT(k) || covered[k],
        ),
        capM,
      ); // the cap over the cut (the ground is cut away beneath)
      add(
        strip(
          tr,
          [
            [sg * (W / 2 + 0.1), 1.1],
            [sg * (W / 2 + 0.1), 1.4],
          ],
          k => !covered[k] || !covered[(k + 1) % N],
        ),
        new THREE.MeshBasicMaterial({ color: dq ? '#ffd99a' : '#6fd3ff', side: THREE.DoubleSide }),
        false,
      ); // LED strip, inside
      add(
        strip(
          tr,
          [
            [sg * (W / 2 + 0.6), i => -P[i].y + 1.5],
            [sg * (W / 2 + 0.6), i => -P[i].y + 1.65],
          ],
          k => notT(k) || covered[k],
        ),
        railM,
        false,
      ); // guard rail along the top
      add(
        strip(
          tr,
          [
            [sg * 6.6, 7.95],
            [sg * 5.4, 7.95],
          ],
          notC,
        ),
        new THREE.MeshBasicMaterial({ color: dq ? '#fff6e2' : '#ffe2a8', side: THREE.DoubleSide }),
        false,
      ); // ceiling lights
    }
    // over the tunnel, a slab at street level (the ground is cut away here too)
    add(
      strip(
        tr,
        [
          [W / 2 + 27, i => -P[i].y - 0.3],
          [-W / 2 - 27, i => -P[i].y - 0.3],
        ],
        notC,
      ),
      new THREE.MeshLambertMaterial(
        dq ? { color: '#ddd0b8', side: THREE.DoubleSide } : { color: '#cdbb92', map: tex.dirt, side: THREE.DoubleSide },
      ),
      false,
    ); // (Doha: paving)
    const ceil = add(
      strip(
        tr,
        [
          [W / 2 + 0.2, 8],
          [-W / 2 - 0.2, 8],
        ],
        notC,
      ),
      dq
        ? new THREE.MeshBasicMaterial({ color: '#d9d0c0', side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ color: '#23262e', side: THREE.DoubleSide }),
    ); // (Doha: a pale, evenly lit ceiling)
    ceil.castShadow = true;
    const dw = i => tr.divW[i];
    add(
      vscale(
        strip(
          tr,
          [
            [dw, 0],
            [dw, 2.6],
            [i => -dw(i), 2.6],
            [i => -dw(i), 0],
          ],
          k => !divider[k] || !divider[(k + 1) % N],
        ),
        8,
      ),
      new THREE.MeshLambertMaterial({ map: dq ? DQ.dividerTex() : tex.barrier, side: THREE.DoubleSide }),
    );
    // street lamps down the open ramps, on the caps either side
    const poleG = new THREE.CylinderGeometry(0.12, 0.15, 6, 8).translate(0, 3, 0),
      headG = new THREE.BoxGeometry(1.6, 0.25, 0.5),
      lampM = new THREE.MeshBasicMaterial({ color: '#fff1c8' }),
      poleM = new THREE.MeshLambertMaterial({ color: dq ? '#ecebe6' : '#3a3f4d' });
    for (let i = 0; i < N; i += 9) {
      if (!trench[i] || covered[i]) continue;
      for (const sg of [1, -1]) {
        const p = P[i].clone().addScaledVector(tr.L[i], sg * (W / 2 + 2));
        p.y = 0.6;
        const pole = new THREE.Mesh(poleG, poleM);
        pole.position.copy(p);
        pole.castShadow = true;
        scene.add(pole);
        const head = new THREE.Mesh(headG, lampM);
        head.position.copy(p).addScaledVector(tr.L[i], -sg * 0.7);
        head.position.y = 6.1;
        head.rotation.y = Math.atan2(tr.T[i].x, tr.T[i].z);
        scene.add(head);
      }
    }
    // a portal round each mouth: pillars either side, a deep header over the opening carrying the sign and a row of lights,
    // standing up above street level so the tunnel mouth reads from far off
    const uName = (tr.cityName || 'KANO') + ' UNDERPASS',
      sign = dq ? DQ.qaSign(uName) : signTex(uName, 0, tr.city),
      conc = dq
        ? new THREE.MeshLambertMaterial({ color: DQ.SAND })
        : new THREE.MeshLambertMaterial({ map: tex.tunnel }),
      lightM = new THREE.MeshBasicMaterial({ color: '#fff1c8' });
    let latM = null;
    for (let i = 0; i < N; i++) {
      if (covered[i] === covered[(i + 1) % N]) continue;
      const entry = !covered[i],
        at = entry ? (i + 1) % N : i,
        F = tr.frame(at * tr.seg, tr.newFrame()),
        h = Math.atan2(F.t.x, F.t.z);
      const g = new THREE.Group();
      g.position.copy(F.p);
      g.rotation.y = h;
      const box = (w, hh, d, x, y, m = conc) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m);
        b.position.set(x, y, 0);
        b.castShadow = b.receiveShadow = true;
        g.add(b);
        return b;
      };
      box(W + 10, 4.6, 2.6, 0, 8 + 2.3); // the header over the opening
      for (const sx of [-1, 1]) box(3.2, 12.6, 2.6, sx * (W / 2 + 1.8), 6.3); // the pillars
      for (let k = -5; k <= 5; k++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.6), lightM);
        l.position.set(k * 2.3, 7.9, 0);
        g.add(l);
      }
      const face = entry ? -1 : 1; // the sign faces the traffic coming in
      const sp = new THREE.Mesh(
        new THREE.PlaneGeometry(dq ? 14 : 20, dq ? 3.55 : 3.2),
        new THREE.MeshBasicMaterial({ map: sign }),
      );
      sp.position.set(0, 10.3, face * 1.32);
      if (face < 0) sp.rotation.y = Math.PI;
      g.add(sp);
      if (dq) {
        // Doha: a gold rule under the header, gold caps on the pillars, and a mashrabiya lattice standing on top
        const gold = new THREE.MeshPhongMaterial({ color: DQ.GOLD, specular: '#fff1c4', shininess: 70 });
        box(W + 10.2, 0.3, 2.8, 0, 8.05, gold);
        for (const sx of [-1, 1]) box(3.6, 0.5, 3, sx * (W / 2 + 1.8), 12.85, gold);
        latM ||= new THREE.MeshLambertMaterial({
          map: DQ.lattice(),
          transparent: true,
          alphaTest: 0.4,
          side: THREE.DoubleSide,
        });
        const lt = latM.map;
        lt.repeat.set(9, 1);
        const lat = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, 3), latM);
        lat.position.set(0, 14.1, 0);
        g.add(lat);
        box(W + 10.2, 0.35, 2.8, 0, 15.75, gold);
        box(W + 10, 0.5, 2.6, 0, 12.85);
      }
      scene.add(g);
    }
    // a gantry over the road where it starts to drop
    for (let i = 0; i < N; i++) {
      if (!(trench[(i + 6) % N] && !trench[(i + 5) % N])) continue;
      const F = tr.frame(i * tr.seg, tr.newFrame()),
        g = new THREE.Group();
      g.position.copy(F.p);
      g.rotation.y = Math.atan2(F.t.x, F.t.z);
      const steel = new THREE.MeshLambertMaterial({ color: dq ? '#e4e5e8' : '#4a5060' });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.4, 0.6), steel);
        post.position.set(sx * (W / 2 + 3), 4.2, 0);
        post.castShadow = true;
        g.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 7, 0.8, 0.8), steel);
      beam.position.y = 8;
      g.add(beam);
      const sp = new THREE.Mesh(
        new THREE.PlaneGeometry(dq ? 12 : 16, dq ? 3.05 : 2.6),
        new THREE.MeshBasicMaterial({
          map: dq ? DQ.qaSign('UNDERPASS AHEAD') : signTex('UNDERPASS AHEAD', 0, tr.city),
        }),
      );
      sp.position.set(0, dq ? 6.4 : 6.6, -0.45);
      sp.rotation.y = Math.PI;
      g.add(sp);
      scene.add(g);
    }
  }
  const rail = new THREE.MeshLambertMaterial({ map: tex.barrier, side: THREE.DoubleSide });
  // (Singapore's decks are pale concrete lit from below, not left dark brown by the night's ground light)
  const deck = new THREE.MeshLambertMaterial({
    color: '#c9ccd6',
    side: THREE.DoubleSide,
    emissive: tr.city === 'singapore' ? '#5a5e68' : '#000000',
  });
  const off = k => !elevated[k];
  for (const s of [1, -1]) {
    const e = s * (W / 2 + 0.2),
      o = s * (W / 2 + 0.9);
    add(
      vscale(
        strip(
          tr,
          [
            [e, 0],
            [e, 1.3],
            [o, 1.3],
            [o, -1.6],
          ],
          off,
        ),
        8,
      ),
      rail,
    ); // barrier: inner face, top, outer face down the deck side
  }
  add(
    strip(
      tr,
      [
        [W / 2 + 0.9, -1.6],
        [-W / 2 - 0.9, -1.6],
      ],
      off,
    ),
    deck,
  ); // underside of the deck
  // pillars under the decks
  const pil = [],
    pilGeo = new THREE.CylinderGeometry(1.3, 1.6, 1, 10).translate(0, 0.5, 0);
  for (let i = 0; i < N; i += 9) {
    const p = tr.P[i];
    if (!elevated[i] || tr.inLoop[i] || p.y < 4) continue;
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(tr.L[i], (s * W) / 4);
      // never on a road that runs underneath (the crossing under the flyover; a deck crossing a lower deck)
      let clear = true;
      for (let j = 0; j < N && clear; j += 2)
        if ((!elevated[j] || tr.P[j].y < q.y - 6) && Math.hypot(tr.P[j].x - q.x, tr.P[j].z - q.z) < W / 2 + 4)
          clear = false;
      if (clear) pil.push([q.x, q.z, q.y - 1.4]);
    }
  }
  if (pil.length) {
    const m = new THREE.InstancedMesh(pilGeo, new THREE.MeshLambertMaterial({ color: '#d7d9e0' }), pil.length),
      o = new THREE.Object3D();
    pil.forEach(([x, z, h], j) => {
      o.position.set(x, 0, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      m.setMatrixAt(j, o.matrix);
    });
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  // jump ramps: an orange kicker, then a canal across the road
  const kickMat = new THREE.MeshLambertMaterial({ map: tex.kicker, side: THREE.DoubleSide }),
    water = new THREE.MeshPhongMaterial({ color: '#1a6fb0', shininess: 90, specular: '#bfe8ff' });
  for (const k of tr.kickers) {
    const F = tr.frame(k.s, tr.newFrame()),
      g = new THREE.BufferGeometry(),
      w = W / 2,
      Lr = 10,
      H = 1.6;
    // a wedge in road space: x = left, y = up, z = forward
    const v = [
      [-w, 0, -Lr],
      [w, 0, -Lr],
      [-w, H, 0],
      [w, H, 0],
      [-w, 0, 0],
      [w, 0, 0],
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 4, 2, 1, 3, 5]);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, kickMat);
    m.castShadow = m.receiveShadow = true;
    m.matrix.makeBasis(F.l, F.u, F.t).setPosition(F.p.clone().addScaledVector(F.u, 0.07));
    m.matrixAutoUpdate = false;
    scene.add(m);
    const G = tr.frame((k.gap[0] + k.gap[1]) / 2, tr.newFrame());
    const c = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 1, k.gap[1] - k.gap[0]), water);
    c.matrix.makeBasis(G.l, G.u, G.t).setPosition(G.p.clone().addScaledVector(G.u, -1.6));
    c.matrixAutoUpdate = false;
    scene.add(c);
  }
  // start line
  const F = tr.frame(0, tr.newFrame());
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(W, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: tex.checker }),
  );
  line.matrix.makeBasis(F.l, F.u, F.t).setPosition(F.p.clone().addScaledVector(F.u, 0.09));
  line.matrixAutoUpdate = false;
  line.receiveShadow = true;
  scene.add(line);
}

/* ---------- the fork: on a long straight the road splits like a Y; the left branch is an open bypass, the right one runs
   through a covered subway; they meet again further on. The straight between them is closed ---------- */
export const BW = 20;
export function buildForks(tr) {
  const { N, P, seg, len } = tr,
    V3 = THREE.Vector3,
    BULGE = 50;
  const plain = i =>
    Math.abs(P[i].y) < 0.3 && !tr.trench[i] && !tr.elevated[i] && !tr.inGap[i] && Math.abs(tr.K[i]) < 0.016; // straight or a gentle bend
  const blocked = new Uint8Array(N);
  for (const f of tr.feats)
    if (f.type === 'gate' || f.type === 'kicker')
      for (let o = -18; o <= 18; o++) blocked[tr.wrap(Math.floor(f.s / seg) + o)] = 1;
  for (const f of tr.feats)
    if (
      [
        'shore',
        'dhows',
        'westbay',
        'souq',
        'msheireb',
        'qanat',
        'portoarabia',
        'boulevard',
        'lusailmarina',
        'beach',
        'medina',
        'mbs',
        'cbd',
        'boatquay',
        'clarkequay',
        'padang',
        'supertrees',
        'lowbridge',
        'hall',
        'apron',
        'terminal',
        'runway',
        'taxiway',
        'jewel',
        'skyway',
        'cloudforest',
        'flowerdome',
        'dragonfly',
        'padang',
        'helix',
        'float',
        'esplanade',
        'merlion',
        'fullerton',
        'clarkequay',
        'laupasat',
        'erp',
        'gantry',
        'abugate',
        'waterfall',
        'avenue',
        'senate',
        'library',
        'physci',
        'compsci',
        'longhalls',
        'hostels',
        'football',
        'squaregate',
        'racecourse',
        'footbridge',
        'skywalk',
        'grandstand',
        'gazebo',
        'lugard',
        'flyover',
        'gumiarch',
        'market',
        'railbridge',
        'oldcity',
        'palacesq',
        'mosque',
        'zgate',
        'rock',
        'flowerring',
        'tunnel',
        'govhouse',
        'redflyover',
        'chequered',
        'fountain',
        'buhari',
        'golf',
        'ringroad',
      ].includes(f.type)
    )
      for (let s = f.s - 30; s < f.s + (f.len || 0) + 30; s += seg) blocked[tr.wrap(Math.floor(tr.wrapS(s) / seg))] = 1; // no fork through a city's set pieces
  const clear = (i, side) => {
    // room for a branch out to the side here
    const q = P[i].clone().addScaledVector(tr.L[i], side * (BULGE + 4));
    for (let j = 0; j < N; j += 3)
      if (
        Math.abs(j - i) > 40 &&
        Math.abs(j - i) < N - 40 &&
        Math.hypot(P[j].x - q.x, P[j].z - q.z) < W / 2 + BW / 2 + 22
      )
        return false;
    return Math.hypot(q.x - tr.center.x, q.z - tr.center.z) < tr.radius + 110;
  };
  // a circuit can say exactly where its fork goes ([s, 'fork', { len, tunnel: 'in' | 'out' }]: Doha's are placed by hand
  // where they suit the city); otherwise search for the longest clear, plain stretch (Kano)
  const pin = tr.feats.find(f => f.type === 'fork');
  let best = null;
  if (pin) {
    const a0 = Math.floor(tr.wrapS(pin.s) / seg);
    best = { a: a0, b: a0 + Math.round(pin.len / seg), L: pin.len + 16 };
  }
  if (!pin)
    for (let a = 0; a < N; a++) {
      if (a * seg < len * 0.3 || a * seg > len * 0.6) continue; // after the race has settled: from about a third of the way round
      let b = a;
      // (and the bend one way only: over an S-bend the two ways and the closed road between them tangled, and sent karts
      // off the edge at ABU)
      let bend = 0;
      while (
        b < N - 1 &&
        b * seg < len * 0.7 &&
        plain(b) &&
        !blocked[b] &&
        clear(b, 1) &&
        clear(b, -1) &&
        !(bend && Math.sign(tr.K[b]) !== bend && Math.abs(tr.K[b]) > 0.002)
      ) {
        if (!bend && Math.abs(tr.K[b]) > 0.002) bend = Math.sign(tr.K[b]);
        b++;
      }
      if ((b - a) * seg > (best ? best.L : 0)) best = { a, b, L: (b - a) * seg };
      a = b;
    }
  if (!best || best.L < 170) return [];
  const span = Math.min(best.L - 16, 300),
    a = best.a + Math.round((best.L - span) / 2 / seg),
    b = a + Math.round(span / seg);
  const UP = new V3(0, 1, 0),
    forks = [];
  // which way each branch goes: the bridge on +L and the subway on -L, unless the circuit puts the subway on a given side
  // ('in' towards the inside of the loop, 'out' away from it): Doha keeps its subways under the land and its bridges over the water
  const tunnelSign = pin?.tunnel ? (pin.tunnel === 'in' ? -1 : 1) * tr.out[a] : -1;
  for (const side of [1, -1]) {
    const off = (side * W) / 4,
      at = (i, o) => P[i].clone().addScaledVector(tr.L[i], o),
      t = (i, d) => tr.T[i].clone().multiplyScalar(d);
    const m1 = Math.round(a + (b - a) * 0.3),
      m2 = Math.round(a + (b - a) * 0.7);
    const pts = [
      at(a, off),
      at(a, off)
        .add(t(a, 24))
        .addScaledVector(tr.L[a], side * 6),
      at(m1, side * BULGE),
      at(m2, side * BULGE),
      at(b, off)
        .add(t(b, -24))
        .addScaledVector(tr.L[b], side * 6),
      at(b, off),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
      blen = curve.getLength(),
      M = Math.max(8, Math.round(blen / 2)),
      BP = curve.getSpacedPoints(M);
    const bridge = side !== tunnelSign,
      deck = new Uint8Array(M + 1);
    // the bridge's height: a smooth climb to 7 m over its first 40% and, mirroring it, a smooth ramp back down over its
    // last 40%, at road level again before it rejoins the circuit. (It used to stop at 80% and drop straight from 9 m to
    // the road: karts flew off the end, landed hard and went on into the barrier)
    const ease = x => {
      x = Math.min(1, Math.max(0, x));
      return x * x * (3 - 2 * x);
    };
    BP.forEach((q, i) => {
      const u = i / M;
      q.y = bridge ? 7 * ease((u - 0.03) / 0.42) * (1 - ease((u - 0.55) / 0.42)) : 0; // (long ramps: under 15% at their steepest)
      if (bridge && q.y > 0.4) deck[i] = 1;
    });
    const BT = BP.map((_, i) => new V3().subVectors(BP[Math.min(M, i + 1)], BP[Math.max(0, i - 1)]).normalize());
    const BL = BT.map(q => new V3().crossVectors(UP, q).normalize()),
      bseg = blen / M,
      BK = new Float32Array(M + 1);
    for (let i = 0; i <= M; i++)
      BK[i] = new V3().subVectors(BT[Math.min(M, i + 1)], BT[Math.max(0, i - 1)]).dot(BL[i]) / (2 * bseg);
    const tunnel = side === tunnelSign,
      inT = new Uint8Array(M + 1);
    if (tunnel) for (let i = Math.round(M * 0.22); i <= Math.round(M * 0.78); i++) inT[i] = 1;
    const limit = new Float32Array(M + 1).map((_, i) => (inT[i] || deck[i] ? BW / 2 - 0.4 : BW / 2 + 7));
    const idx = s0 => Math.max(0, Math.min(M - 1, Math.floor(s0 / bseg)));
    const frame = (s0, F) => {
      const f = Math.max(0, Math.min(M - 1e-3, s0 / bseg)),
        i0 = Math.floor(f),
        k = f - i0;
      F.p.lerpVectors(BP[i0], BP[i0 + 1], k);
      F.t.lerpVectors(BT[i0], BT[i0 + 1], k).normalize();
      F.u.copy(UP);
      F.l.lerpVectors(BL[i0], BL[i0 + 1], k).normalize();
      F.i = i0;
      return F;
    };
    const dist = (x, z) => {
      let d = Infinity;
      for (let i = 0; i <= M; i += 2) d = Math.min(d, Math.hypot(BP[i].x - x, BP[i].z - z));
      return d;
    };
    forks.push({
      side,
      off,
      tunnel,
      inT,
      deck,
      bridge,
      sA: a * seg,
      sB: b * seg,
      a,
      b,
      P: BP,
      T: BT,
      L: BL,
      K: BK,
      len: blen,
      seg: bseg,
      M,
      idx,
      frame,
      dist,
      limit,
      name: tunnel
        ? (tr.cityName || 'KANO') + (tr.city === 'doha' ? ' STATION' : tr.city === 'singapore' ? ' MRT' : ' SUBWAY')
        : 'SKY BRIDGE',
    });
  }
  // the closed straight between the ends
  tr.closed = new Uint8Array(N);
  for (let i = a + 3; i < b - 3; i++) tr.closed[i] = 1;
  return forks;
}

export function buildForkRoads(scene, tr, tex) {
  const forks = tr.forks || [];
  if (!forks.length) return;
  const strip = (b, lats, h, step = 1) => {
    const pos = [],
      uv = [],
      idx = [],
      n = lats.length;
    for (let i = 0; i <= b.M; i++)
      for (const [r, lat] of lats.entries()) {
        const L0 = typeof lat === 'function' ? lat(i) : lat,
          H = typeof h === 'function' ? h(i, r) : h;
        const q = b.P[i].clone().addScaledVector(b.L[i], L0);
        pos.push(q.x, H + (b.P[i].y || 0), q.z);
        uv.push(r / (n - 1), (i * b.seg) / 24);
      }
    for (let i = 0; i < b.M; i += step)
      for (let r = 0; r < n - 1; r++) {
        const a2 = i * n + r,
          c = a2 + n;
        idx.push(a2, a2 + 1, c, a2 + 1, c + 1, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const mesh = (g, m, shadow = false) => {
    const o = new THREE.Mesh(g, m);
    o.receiveShadow = true;
    o.castShadow = shadow;
    scene.add(o);
    return o;
  };
  const road = new THREE.MeshLambertMaterial({
    map: tex.road,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const curb = new THREE.MeshLambertMaterial({
    map: tr.city === 'doha' ? DQ.kerbTex() : tex.curb,
    side: THREE.DoubleSide,
  });
  for (const b of forks) {
    mesh(strip(b, [BW / 2, -BW / 2], 0.075), road);
    for (const sg of [1, -1]) mesh(strip(b, [sg * (BW / 2 + 1.6), (sg * BW) / 2], 0.09), curb);
    if (b.bridge) {
      const i0 = b.deck.indexOf(1),
        i1 = b.deck.lastIndexOf(1),
        sub = { ...b, M: i1 - i0, P: b.P.slice(i0, i1 + 1), L: b.L.slice(i0, i1 + 1), seg: b.seg };
      const railT =
        tr.city === 'doha'
          ? (() => {
              const c = document.createElement('canvas');
              c.width = 256;
              c.height = 64;
              const x = c.getContext('2d'); // Doha: white barrier, a maroon band, a gold line
              x.fillStyle = '#eef0f3';
              x.fillRect(0, 0, 256, 64);
              x.fillStyle = '#7a1430';
              x.fillRect(0, 26, 256, 14);
              x.fillStyle = '#d9b25a';
              x.fillRect(0, 44, 256, 4);
              const t = new THREE.CanvasTexture(c);
              t.colorSpace = THREE.SRGBColorSpace;
              t.wrapS = t.wrapT = THREE.RepeatWrapping;
              return t;
            })()
          : tex.barrier;
      const rail = new THREE.MeshLambertMaterial({ map: railT, side: THREE.DoubleSide }),
        under = new THREE.MeshLambertMaterial({ color: '#c9ccd6', side: THREE.DoubleSide });
      for (const sg of [1, -1])
        mesh(
          strip(
            sub,
            [sg * (BW / 2 + 0.2), sg * (BW / 2 + 0.2), sg * (BW / 2 + 0.9), sg * (BW / 2 + 0.9)],
            (i, r) => [0, 1.3, 1.3, -1.6][r],
          ),
          rail,
          true,
        );
      mesh(strip(sub, [BW / 2 + 0.9, -BW / 2 - 0.9], -1.6), under, true);
      const pilG = new THREE.CylinderGeometry(1.1, 1.4, 1, 10).translate(0, 0.5, 0),
        pilM = new THREE.MeshLambertMaterial({ color: '#d7d9e0' });
      for (let i = i0 + 6; i <= i1; i += 9) {
        const q = b.P[i];
        if (q.y < 3) continue;
        for (const sx of [-1, 1]) {
          const pm = new THREE.Mesh(pilG, pilM);
          const pp = q.clone().addScaledVector(b.L[i], (sx * BW) / 3.2);
          pm.position.set(pp.x, 0, pp.z);
          pm.scale.y = q.y - 1.6;
          pm.castShadow = true;
          scene.add(pm);
        }
      }
      // the end of the bridge: a hazard-striped lip you fly off
      const e = b.P[i1],
        tt = b.T[i1],
        lip = new THREE.Mesh(
          new THREE.BoxGeometry(BW + 1.8, 0.5, 1.2),
          new THREE.MeshLambertMaterial({ map: tex.kicker }),
        );
      lip.position.set(e.x, e.y - 0.1, e.z);
      lip.rotation.y = Math.atan2(tt.x, tt.z);
      scene.add(lip);
    }
    if (b.tunnel) {
      // cut-and-cover subway: concrete walls, a lit ceiling, a mound of sand over the top, portals with the sign
      const i0 = b.inT.indexOf(1),
        i1 = b.inT.lastIndexOf(1),
        sub = { ...b, M: i1 - i0, P: b.P.slice(i0, i1 + 1), L: b.L.slice(i0, i1 + 1) };
      // a bright metro tunnel: white glazed tiles with an orange band, tall, skylight slots in the roof, lights all along
      const H = 9,
        tile = (() => {
          const c = document.createElement('canvas');
          c.width = c.height = 256;
          const x = c.getContext('2d');
          const dq = tr.city === 'doha'; // (Doha: cream tiles, a maroon band, a gold line)
          x.fillStyle = dq ? '#f4ede0' : '#f2f3f5';
          x.fillRect(0, 0, 256, 256);
          x.strokeStyle = dq ? '#d8ccb4' : '#cfd4dc';
          x.lineWidth = 3;
          for (let k = 0; k <= 8; k++) {
            x.beginPath();
            x.moveTo(0, k * 32);
            x.lineTo(256, k * 32);
            x.stroke();
            x.beginPath();
            x.moveTo(k * 32, 0);
            x.lineTo(k * 32, 256);
            x.stroke();
          }
          x.fillStyle = dq ? '#7a1430' : '#ff6a00';
          x.fillRect(0, 150, 256, 26);
          x.fillStyle = dq ? '#d9b25a' : '#1d2a6b';
          x.fillRect(0, 182, 256, 8);
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          return t;
        })();
      // Doha: a Doha Metro station instead (doharoad.js): glass platform screen doors with the platform lit behind and the
      // station's name on the glass, a vault of pearl facets overhead, golden sandstone portals
      const dq = tr.city === 'doha',
        stn = tr.cityName || 'DOHA';
      const wall = dq
        ? new THREE.MeshLambertMaterial({
            map: DQ.metroWall(stn),
            side: THREE.DoubleSide,
            emissive: '#ffffff',
            emissiveMap: null,
            emissiveIntensity: 0.0,
          })
        : new THREE.MeshLambertMaterial({ map: tile, side: THREE.DoubleSide, emissive: '#3a3a40' });
      if (dq) {
        wall.emissive.set('#5a5650');
      }
      // a city with its own subway builds it (src/subways.js): Kano's dune ceiling, Kaduna's arcade, Singapore's tube
      const own = !dq && SUBWAYS[tr.city];
      if (own) own({ scene, sub: { ...sub, seg: b.seg }, BW, H });
      for (const sg of own ? [] : [1, -1]) {
        const g2 = strip(sub, [sg * (BW / 2 + 0.3), sg * (BW / 2 + 0.3)], (i, r) => (r ? H : 0));
        const uv = g2.attributes.uv;
        if (!dq)
          for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getY(k) * 24) / 6, (uv.getX(k) * H) / 6); // (Doha's wall is drawn up the wall x along it, 24 m a tile: as the strip maps it)
        else {
          // the wall on the driver's left would read backwards: flip it (which side is which depends on how the fork runs)
          const t = sub.P[Math.min(1, sub.M)].clone().sub(sub.P[0]),
            l = sub.L[0];
          if (sg * (l.x * t.z - l.z * t.x) > 0) for (let k = 0; k < uv.count; k++) uv.setY(k, -uv.getY(k));
        }
        mesh(g2, wall, true);
      }
      // Doha: the vault, a shallow arch across the station in triangular facets, pearl, lit from within
      if (dq) {
        const n2 = sub.M,
          A = 10,
          pos = [],
          uv2 = [],
          idx = [],
          rise = 4.2;
        for (let i = 0; i <= n2; i++)
          for (let a = 0; a <= A; a++) {
            const t = a / A,
              lat = (BW / 2 + 0.3) * (1 - 2 * t),
              q = sub.P[i].clone().addScaledVector(sub.L[i], lat);
            pos.push(q.x, H + rise * Math.sin(Math.PI * t), q.z);
            uv2.push(t * 2, (i * b.seg) / 8);
          }
        for (let i = 0; i < n2; i++)
          for (let a = 0; a < A; a++) {
            const p0 = i * (A + 1) + a,
              p1 = p0 + 1,
              p2 = p0 + A + 1,
              p3 = p2 + 1;
            if ((i + a) % 2) idx.push(p0, p1, p2, p1, p3, p2);
            else idx.push(p0, p1, p3, p0, p3, p2);
          }
        let gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
        gg.setIndex(idx);
        gg = gg.toNonIndexed();
        gg.computeVertexNormals(); // flat-shaded, so every facet catches the light its own way
        mesh(
          gg,
          new THREE.MeshLambertMaterial({ map: DQ.pearlTex(), emissive: '#8c8692', side: THREE.DoubleSide }),
          true,
        );
        // light lines along the vault, and the long shell of the station showing above the ground in golden sandstone
        const lineM = new THREE.MeshBasicMaterial({ color: '#fff4dc', side: THREE.DoubleSide });
        for (const t of [0.22, 0.5, 0.78])
          mesh(
            strip(
              sub,
              [(BW / 2 + 0.3) * (1 - 2 * t) + 0.25, (BW / 2 + 0.3) * (1 - 2 * t) - 0.25],
              H + rise * Math.sin(Math.PI * t) - 0.15,
            ),
            lineM,
          );
        const shellM = new THREE.MeshLambertMaterial({ color: DQ.SAND, side: THREE.DoubleSide });
        const sh = [];
        for (let i = 0; i <= n2; i++)
          for (let a = 0; a <= A; a++) {
            const t = a / A,
              lat = (BW / 2 + 1.2) * (1 - 2 * t),
              q = sub.P[i].clone().addScaledVector(sub.L[i], lat);
            sh.push(q.x, H + 0.6 + rise * Math.sin(Math.PI * t), q.z);
          }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sh, 3));
        sg.setIndex(idx);
        sg.computeVertexNormals();
        mesh(sg, shellM, true);
      }
      // the roof, with an open slot every few metres so daylight comes through
      if (!dq && !own) {
        const pos = [],
          idx = [];
        const n2 = sub.M;
        for (let i = 0; i <= n2; i++)
          for (const lat of [BW / 2 + 0.3, -BW / 2 - 0.3]) {
            const q = sub.P[i].clone().addScaledVector(sub.L[i], lat);
            pos.push(q.x, H, q.z);
          }
        for (let i = 0; i < n2; i++)
          if (i % 8 < 3) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        gg.setIndex(idx);
        gg.computeVertexNormals();
        mesh(
          gg,
          new THREE.MeshLambertMaterial({ color: '#e8ebf0', emissive: '#9aa0aa', side: THREE.DoubleSide }),
          true,
        ); // white roof beams with daylight between them
        // a light bar across the tunnel every 8 steps, each turned to the tunnel's own heading there (they used to all face one
        // world direction, so on a curved subway they stuck out through the walls and the portal sign)
        const lampM = new THREE.MeshBasicMaterial({ color: '#fff4dc' });
        for (let i = 0; i < n2; i += 8) {
          const q = sub.P[i],
            tt = b.T[i0 + i],
            l = new THREE.Mesh(new THREE.BoxGeometry(BW - 4, 0.12, 0.5), lampM);
          l.position.set(q.x, H - 0.1, q.z);
          l.rotation.y = Math.atan2(tt.x, tt.z);
          scene.add(l);
        }
      }
      if (!own?.open)
        mesh(
          strip(sub, [BW / 2 + 26, BW / 2 + 0.3], (i, r) => (r ? H + 0.2 : 0)),
          new THREE.MeshLambertMaterial({ color: '#d9c49a', map: tex.dirt, side: THREE.DoubleSide }),
          true,
        ); // banks of sand either side, up to the roof
      if (!own?.open)
        mesh(
          strip(sub, [-BW / 2 - 0.3, -BW / 2 - 26], (i, r) => (r ? 0 : H + 0.2)),
          new THREE.MeshLambertMaterial({ color: '#d9c49a', map: tex.dirt, side: THREE.DoubleSide }),
          true,
        );
      const sign = dq
          ? DQ.qaSign(stn + ' STATION')
          : signTex((tr.cityName || 'KANO') + (tr.city === 'singapore' ? ' MRT' : ' SUBWAY'), 0, tr.city),
        conc = dq
          ? new THREE.MeshLambertMaterial({ color: DQ.SAND })
          : new THREE.MeshLambertMaterial({ map: tex.tunnel });
      for (const [i, face] of [
        [i0, -1],
        [i1, 1],
      ]) {
        const g = new THREE.Group();
        g.position.copy(b.P[i]);
        g.rotation.y = Math.atan2(b.T[i].x, b.T[i].z);
        if (dq) {
          // a station mouth: a deep golden sandstone frame that follows the vault, its edge in gold, the sign under the arch
          const gold = new THREE.MeshPhongMaterial({ color: DQ.GOLD, specular: '#fff1c4', shininess: 70 });
          const shape = new THREE.Shape(),
            R = BW / 2 + 3.4,
            Ri = BW / 2 + 0.3,
            rise = 4.2;
          shape.moveTo(-R, 0);
          for (let k = 0; k <= 24; k++) {
            const t = k / 24;
            shape.lineTo(-R + 2 * R * t, H + 1.4 + (rise + 1) * Math.sin(Math.PI * t));
          }
          shape.lineTo(R, 0);
          shape.lineTo(Ri, 0);
          shape.lineTo(Ri, H);
          for (let k = 24; k >= 0; k--) {
            const t = k / 24;
            shape.lineTo(-Ri + 2 * Ri * t, H + rise * Math.sin(Math.PI * t));
          }
          shape.lineTo(-Ri, 0);
          shape.closePath();
          const fr = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2),
            conc,
          );
          fr.castShadow = fr.receiveShadow = true;
          g.add(fr);
          const rim = new THREE.Shape();
          rim.moveTo(-R, H + 1.4);
          for (let k = 1; k <= 24; k++) {
            const t = k / 24;
            rim.lineTo(-R + 2 * R * t, H + 1.4 + (rise + 1) * Math.sin(Math.PI * t));
          }
          for (let k = 24; k >= 0; k--) {
            const t = k / 24;
            rim.lineTo(-R + 2 * R * t, H + 1.0 + (rise + 1) * Math.sin(Math.PI * t));
          }
          const rm = new THREE.Mesh(
            new THREE.ExtrudeGeometry(rim, { depth: 2.6, bevelEnabled: false }).translate(0, 0, -1.3),
            gold,
          );
          g.add(rm);
          const sp = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.54), new THREE.MeshBasicMaterial({ map: sign }));
          sp.position.set(0, H + 1.6, face * 1.25);
          if (face < 0) sp.rotation.y = Math.PI;
          g.add(sp);
          scene.add(g);
          continue;
        }
        const hdr = new THREE.Mesh(new THREE.BoxGeometry(BW + 4, 3, 1.4), conc);
        hdr.position.y = 10.2;
        hdr.castShadow = true;
        g.add(hdr);
        for (const sx of [-1, 1]) {
          const pl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11.7, 1.4), conc);
          pl.position.set(sx * (BW / 2 + 1.1), 5.85, 0);
          g.add(pl);
        }
        const sp = new THREE.Mesh(new THREE.PlaneGeometry(BW, 2.3), new THREE.MeshBasicMaterial({ map: sign }));
        sp.position.set(0, 10.2, face * 0.72);
        if (face < 0) sp.rotation.y = Math.PI;
        g.add(sp);
        scene.add(g);
      }
    }
  }
  // the split: a striped crash barrier nose in the middle of the road, and signs over each way
  const b = forks[0],
    F = tr.frame(b.sA + 4, tr.newFrame()),
    g = new THREE.Group();
  g.position.copy(F.p);
  g.rotation.y = Math.atan2(F.t.x, F.t.z);
  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.2, 16, 1, false, 0, Math.PI).rotateY(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: tex.barrier }),
  );
  nose.position.set(0, 0.6, 0);
  g.add(nose);
  const steel = new THREE.MeshLambertMaterial({ color: '#4a5060' });
  // (the posts stand clear of both branches: each starts a quarter of the road off the middle and is BW wide, so its
  // outer kerb reaches past the road's own edge; a post just off the road stood a metre inside a branch's lane)
  const PX = W / 4 + BW / 2 + 3.5;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), steel);
    post.position.set(sx * PX, 4, -6);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(PX * 2 + 1, 0.7, 0.7), steel);
  beam.position.set(0, 7.6, -6);
  g.add(beam);
  for (const f of forks) {
    const dq = tr.city === 'doha',
      sp = new THREE.Mesh(
        new THREE.PlaneGeometry(W / 2 - 1, dq ? (W / 2 - 1) / 3.94 : 2),
        new THREE.MeshBasicMaterial({
          map: dq ? DQ.qaSign(f.name, f.side > 0 ? -1 : 1) : signTex(f.name, f.side > 0 ? -1 : 1, tr.city),
        }),
      );
    sp.position.set((f.side * W) / 4, 6.2, -6.4);
    sp.rotation.y = Math.PI;
    g.add(sp);
  }
  scene.add(g);
}
