// The aquarium tunnel: a deck that rides half a metre off the water, and where the road dives, a glass tube down to
// the bed and up again, the water round it built to be seen from inside (its blue walls, a bed with coral and weed,
// the surface shimmering overhead, fish swimming by; the real sheet of water clipped away over the tube). First built
// for The Pearl in Doha (doha.js); Singapore's river has one too (singapore.js). Called once per 'lowbridge' feature,
// with the city's own helpers: lam(colour), glow(material, map, colour, strength), place(name, sub, at, s, opts),
// head(s), and a list to push the swimmers' update(t) onto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';
import { renderer } from './scene.js';

const clampN = (v, a, b) => Math.min(b, Math.max(a, v));

// how the tube looks: The Pearl's is a tall pointed vault in white ribs over a turquoise reef; a city can have its own
// (Singapore's river: a round tube in silver hoops on steel rails, deep clear blue water, pale sand, big bubbles)
const LOOK = {
  round: false, // a round tube rather than a pointed vault
  hoop: 9, // metres between ribs
  rails: false, // steel rails along the tube between the hoops
  rib: '#f4f7f9',
  ribGlow: '#30363a',
  metal: false,
  glass: '#c9f1f6',
  top: '#57cfdc', // the water just under the surface
  bed: '#0a4d6e', // and down at the bed
  haze: '#2b93a9', // what far things fade into
  sand: '#5c9ea3',
  surf: '#86dbe6', // the surface seen from under it
  surfDeep: '#58b9c9',
  bubble: 0.2, // the bubbles' size
  bubbleCols: 17,
};
export function aquarium(k, f, h) {
  const { scene, tr, rand, rr, pick, W } = k;
  const {
    lam,
    glow,
    place,
    head,
    swimmers,
    sign, // the sign on the gantry before the tube (a texture)
    look: look0 = {}, // (a city's own tube: see LOOK below)
    names = {
      tube: ['THE AQUARIUM TUNNEL', 'Down a glass tube under the marina mouth, fish all round'],
      bridge: ['THE WATER BRIDGE', 'A deck half a metre off the sea'],
    },
  } = h;
  const parts = new Map(),
    put = (geo, mat, p, y, ry) =>
      (parts.get(mat) || parts.set(mat, []).get(mat)).push(geo.clone().rotateY(ry).translate(p.x, y, p.z));
  const roadY = s => tr.point(s, 0).y;
  // where the tube runs (the road under -1 m), and where it's wholly under the sea (its crown below the surface)
  let sA = null,
    sB = null,
    sC = null,
    sD = null;
  for (let s = f.s; s <= f.s + f.len; s += 1) {
    const y = roadY(s);
    if (y < -1) {
      sA ??= s;
      sB = s;
    }
    if (y < -15.7) {
      sC ??= s;
      sD = s;
    }
  }
  const tube = sA !== null,
    inTube = s => tube && s >= sA && s <= sB;

  // the deck: its underside the whole way, and on the open stretches an edge beam, piles and a rope
  const timber = lam('#9a6b3c'),
    timberDark = lam('#5e3f22'),
    capM = glow(lam('#fff4d6', { emissive: '#3a3324' }), null, '#ffe2a0', 1.2),
    step = tr.seg * 2,
    beam = new THREE.BoxGeometry(0.6, 0.55, step + 0.3),
    slab = new THREE.BoxGeometry(W + 1.8, 0.5, step + 0.3),
    pile = new THREE.CylinderGeometry(0.34, 0.4, 4.4, 8),
    cap = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 8),
    rope = new THREE.BoxGeometry(0.09, 0.09, step * 3);
  let n = 0;
  // (deck: false: the city lays its own deck over the open stretches, and this builds only the tube)
  for (let s = f.s; h.deck !== false && s < f.s + f.len; s += step, n++) {
    const i = tr.idx(s + step / 2),
      y = tr.P[i].y,
      a = head(s + step / 2);
    if (inTube(s + step / 2)) continue;
    put(slab, timberDark, tr.P[i], y - 0.62, a); // the deck's underside, a clear step under the road
    for (const sd of [-1, 1]) {
      const e = tr.beside(i, sd * (W / 2 + 0.6));
      put(beam, timber, e, y - 0.05, a); // the edge beam, a kerb's height over the road
      if (n % 3 || inTube(s + step * 3.5)) continue;
      put(pile, timberDark, e, y - 1.3, a); // a pile every third bay, standing a metre over the deck
      put(cap, capM, e, y + 1.0, a);
      const j = tr.idx(s + step * 2);
      put(rope, timberDark, tr.beside(j, sd * (W / 2 + 0.6)), tr.P[j].y + 0.72, a);
    }
  }
  for (const [mat, geos] of parts) {
    const m = new THREE.Mesh(mergeGeometries(geos.map(x => (x.index ? x.toNonIndexed() : x))), mat);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  if (!tube) {
    if (names.bridge)
      place(names.bridge[0], names.bridge[1], tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
        back: 55,
        h: 3,
        lookH: 1,
      });
    return;
  }

  // a skin along the road: rings of a cross-section [across, up] every few metres from s0 to s1. `abs` profiles give
  // heights in the world (the sea's own levels), the rest are measured up from the road
  const skin = (prof, s0, s1, ds = 3, abs = false, col = null) => {
    const pos = [],
      uv = [],
      cols = [],
      idx = [],
      m = prof.length,
      rings = Math.max(1, Math.round((s1 - s0) / ds)),
      c = new THREE.Color();
    for (let r = 0; r <= rings; r++) {
      const s = s0 + ((s1 - s0) * r) / rings;
      prof.forEach(([lat, h], q) => {
        const p = abs ? tr.point(s, lat, 0) : tr.point(s, lat, h);
        if (abs) p.y = h;
        pos.push(p.x, p.y, p.z);
        uv.push(lat / 20, (s - s0) / 20);
        if (col) {
          c.set(col(h));
          cols.push(c.r, c.g, c.b);
        }
      });
      if (r)
        for (let q = 0; q < m - 1; q++) {
          const a = (r - 1) * m + q,
            b = r * m + q;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const mesh = (geos, mat, order = 0) => {
    const m = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat);
    m.renderOrder = order;
    scene.add(m);
    return m;
  };
  const look = { ...LOOK, ...look0 };
  const both = { side: THREE.DoubleSide },
    HT = W / 2 + 0.9, // half the tube's width
    ROUND = Array.from({ length: 13 }, (_, k2) => {
      const a = Math.PI * (1 - k2 / 12);
      return [Math.cos(a) * HT, -0.6 + Math.sin(a) * 13.6];
    }),
    ARCH = look.round
      ? ROUND
      : [
          [-HT, -0.6],
          [-HT, 8],
          [-HT * 0.8, 10.6],
          [-HT * 0.45, 12.3],
          [0, 13], // a high crown: room over a kart in the air, and over the camera following it down the ramp
          [HT * 0.45, 12.3],
          [HT * 0.8, 10.6],
          [HT, 8],
          [HT, -0.6],
        ],
    inset = k => ARCH.map(([l, h]) => [l * k, h * k + (1 - k) * 2]);

  // the glass, white ribs every 9 m, a low concrete upstand, the strip of floor beside the road, two lines of light
  mesh(
    [skin(ARCH, sA, sB)],
    new THREE.MeshPhongMaterial({
      color: look.glass,
      transparent: true,
      opacity: 0.2,
      shininess: 120,
      depthWrite: false,
      ...both,
    }),
    3,
  );
  const ribs = [];
  for (let s = sA + look.hoop / 2; s < sB; s += look.hoop) ribs.push(skin(inset(0.992), s - 0.3, s + 0.3, 1));
  // steel rails along the tube, from hoop to hoop, at a few points round the arch
  if (look.rails)
    for (const q of [2, 4, 6, 8, 10]) {
      const [l, hh] = ARCH[q];
      ribs.push(
        skin(
          [
            [l * 0.99 - 0.12, hh * 0.99],
            [l * 0.99 + 0.12, hh * 0.99 + 0.02],
          ],
          sA,
          sB,
          4,
        ),
      );
    }
  for (const s of [sA, sB]) ribs.push(skin(inset(1.03), s - 0.9, s + 0.9, 1), skin(inset(0.97), s - 0.9, s + 0.9, 1)); // the two mouths: a deep white frame
  mesh(
    ribs,
    look.metal
      ? new THREE.MeshStandardMaterial({
          color: look.rib,
          metalness: 0.85,
          roughness: 0.25,
          emissive: look.ribGlow,
          ...both,
        })
      : glow(lam(look.rib, { emissive: look.ribGlow, ...both }), null, '#cfeff5', 0.9),
  );
  const wallsG = [];
  for (const sd of [-1, 1])
    wallsG.push(
      skin(
        [
          [sd * W * 0.5, 0.03],
          [sd * HT * 0.995, 0.03],
          [sd * HT * 0.995, 0.9],
        ],
        sA,
        sB,
      ),
    );
  wallsG.push(
    skin(
      [
        [-HT, -0.62],
        [HT, -0.62],
      ],
      sA,
      sB,
    ),
  ); // the tube's floor under the road
  mesh(wallsG, lam('#cfd8dc', both));
  const lines = [];
  for (const sd of [-1, 1])
    lines.push(
      skin(
        [
          [sd * HT * 0.8, 10.5],
          [sd * HT * 0.74, 10.85],
        ],
        sA,
        sB,
      ),
    );
  mesh(lines, new THREE.MeshBasicMaterial({ color: '#f4fdff', ...both }));
  // the road sign before the mouth you drive in at: a steel gantry across the deck (a post each side, a truss between),
  // the board hung on it: the city's own road sign (doharoad.js: Arabic over English, a white border), in the brown
  // Qatar keeps for places to visit
  {
    const gs = sA - 16,
      o = tr.point(gs, 0),
      G = new THREE.Group(),
      steelM = lam('#aeb7c0'),
      px = W / 2 + 0.6,
      bits = [],
      bx = (w, h, d, x, y, z) => bits.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    G.position.copy(o);
    G.rotation.y = head(gs);
    for (const sd of [-1, 1]) {
      bx(0.45, 9.6, 0.45, sd * px, 4.8, 0); // the posts, standing on the deck's edge beams
      bx(0.9, 0.25, 0.9, sd * px, 0.35, 0);
    }
    for (const y of [8.1, 9.4]) bx(px * 2, 0.22, 0.22, 0, y, 0); // the truss: two chords and the struts between
    for (let x = -px + 1.2; x < px; x += 2.4) bx(0.14, 1.3, 0.14, x, 8.75, 0);
    bx(14.4, 3.9, 0.14, 0, 7.75, -0.3); // the board's back
    for (const x of [-5, 0, 5]) bx(0.16, 4.3, 0.2, x, 7.75, -0.14); // its stiffeners
    const frame = new THREE.Mesh(mergeGeometries(bits), steelM);
    frame.castShadow = true;
    G.add(frame);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(14.2, 3.6),
      new THREE.MeshBasicMaterial({ map: sign }), // (the city's own sign: Doha's is brown, a place to visit)
    );
    face.position.set(0, 7.75, -0.38);
    face.rotation.y = Math.PI; // facing the cars coming
    G.add(face);
    scene.add(G);
  }

  // the slot in the sea over the tube: the real water is clipped away inside this box
  if (k.water) {
    const a = tr.point(sA, 0),
      b = tr.point(sB, 0),
      T = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(),
      Lx = new THREE.Vector3(T.z, 0, -T.x),
      pl = (nrm, p) => new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, p);
    k.water.material.clippingPlanes = [
      pl(T.clone().negate(), a),
      pl(T, b),
      pl(Lx, a.clone().addScaledVector(Lx, HT)),
      pl(Lx.clone().negate(), a.clone().addScaledVector(Lx, -HT)),
    ];
    k.water.material.clipIntersection = true;
    k.water.material.needsUpdate = true;
    renderer.localClippingEnabled = true;
  }

  // the sea round the tube, seen from inside: walls of blue falling away, the bed, the surface from underneath
  const TOP = -2.4, // (well under the real sheet of sea at -1.4: from the map's height two surfaces closer than a few
    // tenths of a metre shimmer against each other)
    BED = -19.3,
    FAR = 52,
    deep = h => new THREE.Color(look.top).lerp(new THREE.Color(look.bed), (TOP - h) / (TOP - BED));
  const seaM = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, ...both });
  const wallP = sd => [0, 0.25, 0.5, 0.75, 1].map(q => [sd * (FAR - q * 8), TOP + (BED - TOP) * q]);
  const sea = [skin(wallP(-1), sA, sB, 6, true, deep), skin(wallP(1), sA, sB, 6, true, deep)];
  for (const s of [sA - 0.5, sB + 0.5]) {
    // the two ends: a wall of water across, under the road
    const e = [];
    for (const h of [TOP, (TOP + BED) / 2, BED]) e.push([-FAR, h], [FAR, h]);
    const g = new THREE.BufferGeometry(),
      pos = [],
      cols = [];
    for (const [lat, h] of e) {
      const p = tr.point(s, lat, 0),
        c = deep(h);
      pos.push(p.x, h, p.z);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
    g.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
    g.computeVertexNormals();
    sea.push(g);
  }
  mesh(sea, seaM);
  // the bed: sand under moving nets of light
  const causT = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = look.sand; // pale sand, seen through a few metres of sea
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        x.fillStyle = Math.random() < 0.5 ? 'rgba(225,205,160,.13)' : 'rgba(20,70,90,.1)';
        x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      x.strokeStyle = 'rgba(40,90,100,.1)'; // ripples in the sand
      x.lineWidth = 3;
      for (let y = 6; y < h; y += 16) {
        x.beginPath();
        for (let xx = 0; xx <= w; xx += 16) x.lineTo(xx, y + Math.sin(xx * 0.05 + y) * 3);
        x.stroke();
      }
      x.strokeStyle = 'rgba(215,250,255,.34)'; // the net of light the waves throw down
      x.lineWidth = 1.4;
      for (let i = 0; i < 60; i++) {
        const cx = Math.random() * w,
          cy = Math.random() * h,
          r = 10 + Math.random() * 22;
        x.beginPath();
        for (let a = 0; a <= 6.4; a += 0.45) {
          const r2 = r * (0.7 + Math.random() * 0.6);
          x.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        }
        x.stroke();
      }
    },
    { repeat: true },
  );
  mesh(
    [
      skin(
        [
          [-FAR + 8, BED],
          [FAR - 8, BED],
        ],
        sA,
        sB,
        6,
        true,
      ),
    ],
    new THREE.MeshBasicMaterial({ map: causT, fog: false, ...both }),
  );
  // the surface from below: bright, rippling; either side of the tube all the way, and over it where it's fully under
  const surfT = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = look.surf;
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        // soft pools of daylight coming through
        const cx = Math.random() * w,
          cy = Math.random() * h,
          r = 24 + Math.random() * 46,
          g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,.3)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      x.strokeStyle = 'rgba(30,130,160,.16)'; // the undersides of the ripples
      x.lineWidth = 2;
      for (let i = 0; i < 90; i++) {
        const cx = Math.random() * w,
          cy = Math.random() * h,
          l = 10 + Math.random() * 26;
        x.beginPath();
        x.moveTo(cx - l, cy);
        x.quadraticCurveTo(cx, cy - 3 - Math.random() * 4, cx + l, cy);
        x.stroke();
      }
    },
    { repeat: true },
  );
  const surf = [];
  for (const sd of [-1, 1])
    surf.push(
      skin(
        [
          [sd * HT, TOP],
          [sd * FAR, TOP],
        ],
        sA,
        sB,
        6,
        true,
      ),
    );
  // (over the tube it's a shade deeper: from the air that band is all you see of the tunnel, and it sits in with the sea)
  if (sC !== null)
    mesh(
      [
        skin(
          [
            [-HT, TOP],
            [HT, TOP],
          ],
          sC,
          sD,
          6,
          true,
        ),
      ],
      new THREE.MeshBasicMaterial({ map: surfT, color: look.surfDeep, fog: false, ...both }),
    );
  mesh(surf, new THREE.MeshBasicMaterial({ map: surfT, fog: false, ...both }));

  // Everything out in the water is painted by hand rather than lit: shaded by which way each face looks, and faded
  // towards the colour of the water the further it is from the glass, the way things are lost in real sea.
  const HAZE = new THREE.Color(look.haze),
    hazeAt = lat => clampN(((Math.abs(lat) - HT) / (FAR - HT)) * 0.85, 0, 0.8),
    tint = (g, colour, haze = 0, shade = v => v) => {
      const gg = g.index ? g.toNonIndexed() : g;
      gg.computeVertexNormals();
      const col = new THREE.Color(colour).lerp(HAZE, haze),
        nrm = gg.attributes.normal,
        pos = gg.attributes.position,
        arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const b = shade(0.62 + 0.38 * Math.max(0, nrm.getY(i)), pos.getX(i), pos.getY(i), pos.getZ(i));
        arr.set([col.r * b, col.g * b, col.b * b], i * 3);
      }
      gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      gg.deleteAttribute('uv');
      return gg;
    };
  const seaThing = { vertexColors: true, fog: false, side: THREE.DoubleSide };

  // the reef on the bed either side of the glass: rocks, brain coral, branching coral, sea fans, kelp
  {
    const reef = [],
      ROCK = ['#5b6f6c', '#4d6468', '#6a7a70'],
      BRAIN = ['#c98a6a', '#b9a36a', '#a8788f', '#8f9a6a'],
      BRANCH = ['#d9826f', '#e0a070', '#c77fa6', '#d9c27a'],
      FAN = ['#b0607a', '#8a6fb0', '#c9776a'],
      KELP = ['#3f8f5f', '#4f9a58', '#357a55'];
    for (let s = sA + 30; s < sB - 30; s += 2.6) {
      if (roadY(s) > -6) continue;
      for (const sd of [-1, 1]) {
        const lat = sd * rr(HT + 1.5, FAR - 12),
          p = tr.point(s + rr(-1.2, 1.2), lat, 0),
          hz = hazeAt(lat),
          roll = rand(),
          sc = rr(0.7, 1.5),
          bits = [];
        if (roll < 0.24)
          bits.push(
            tint(new THREE.DodecahedronGeometry(1.3 * sc).scale(1.4, 0.65, 1.1).rotateY(rand() * 6), pick(ROCK), hz),
          );
        else if (roll < 0.44)
          bits.push(tint(new THREE.SphereGeometry(1.05 * sc, 9, 6).scale(1, 0.7, 1), pick(BRAIN), hz));
        else if (roll < 0.66) {
          const c = pick(BRANCH);
          for (let b = 0, nb = 5 + ((rand() * 4) | 0); b < nb; b++) {
            const h = rr(1, 2.3) * sc;
            bits.push(
              tint(
                new THREE.CylinderGeometry(0.06 * sc, 0.15 * sc, h, 5)
                  .translate(0, h / 2, 0)
                  .rotateZ(rr(-0.55, 0.55))
                  .rotateX(rr(-0.55, 0.55))
                  .translate(rr(-0.4, 0.4), 0, rr(-0.4, 0.4)),
                c,
                hz,
              ),
            );
          }
        } else if (roll < 0.8) {
          const r = 1.1 * sc;
          bits.push(
            tint(
              new THREE.CircleGeometry(r, 9)
                .scale(1, 1.15, 1)
                .translate(0, r * 1.15 + 0.5, 0)
                .rotateY(rand() * 3),
              pick(FAN),
              hz,
              () => 0.85,
            ),
            tint(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 5).translate(0, 0.3, 0), '#5a4a4a', hz),
          );
        } else {
          const c = pick(KELP);
          for (let b = 0, nb = 3 + ((rand() * 3) | 0); b < nb; b++) {
            const h = rr(4, 8) * sc;
            bits.push(
              tint(
                new THREE.BoxGeometry(0.3, h, 0.05, 1, 5, 1)
                  .translate(0, h / 2, 0)
                  .rotateY(rand() * 3)
                  .rotateZ(rr(-0.16, 0.16))
                  .translate(rr(-0.5, 0.5), 0, rr(-0.5, 0.5)),
                c,
                hz,
                (v, x, y) => 0.55 + 0.45 * Math.min(1, y / h),
              ),
            );
          }
        }
        for (const g of bits) reef.push(g.translate(p.x, BED, p.z));
      }
    }
    if (reef.length) mesh(reef, new THREE.MeshBasicMaterial(seaThing));
  }

  // shafts of sunlight slanting down from the surface, and threads of bubbles rising off the bed
  const lo = (sC ?? sA) - 20,
    span = (sD ?? sB) + 20 - lo;
  {
    const shafts = [];
    for (let i = 0; i < 26; i++) {
      const s = lo + rand() * span,
        sd = i % 2 ? 1 : -1,
        lat = sd * rr(HT + 3, FAR - 14),
        w = rr(2.5, 6),
        lean = rr(2, 5),
        a = tr.point(s, lat, 0),
        b = tr.point(s + w, lat, 0),
        c = tr.point(s + w + lean, lat + sd * 1.5, 0),
        d = tr.point(s + lean, lat + sd * 1.5, 0),
        g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([a.x, TOP, a.z, b.x, TOP, b.z, c.x, BED, c.z, d.x, BED, d.z], 3),
      );
      g.setIndex([0, 1, 2, 0, 2, 3]);
      shafts.push(g);
    }
    mesh(
      shafts,
      new THREE.MeshBasicMaterial({
        color: '#dffcff',
        transparent: true,
        opacity: 0.075,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
      2,
    );
  }
  const NB = look.bubbleCols * 10,
    bub = new Float32Array(NB * 3),
    bubs = [];
  for (let c = 0; c < look.bubbleCols; c++) {
    const p = tr.point(lo + rand() * span, (c % 2 ? 1 : -1) * rr(HT + 2, FAR - 18), 0);
    for (let q = 0; q < 10; q++)
      bubs.push({ x: p.x, z: p.z, y0: rand() * (TOP - BED), v: rr(1.2, 2.2), ph: rand() * 6 });
  }
  const bubG = new THREE.BufferGeometry();
  bubG.setAttribute('position', new THREE.BufferAttribute(bub, 3));
  const bubP = new THREE.Points(
    bubG,
    new THREE.PointsMaterial({ color: '#eafcff', size: look.bubble, transparent: true, opacity: 0.75, fog: false }),
  );
  bubP.frustumCulled = false;
  scene.add(bubP);

  // the fish. Each kind is one shape, drawn many times: a dark back shading to a pale belly, a forked tail, a fin on
  // its back, an eye. Slim silver fish in tight shoals, tall reef fish idling by the coral, reef sharks cruising, rays
  // gliding over the sand, and one whale shark taking its time.
  {
    const tri = (...v) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      return g;
    };
    const fishGeo = (sx, sy, { stripe = false, shark = false } = {}) => {
      const body = new THREE.SphereGeometry(0.5, 12, 8).rotateX(Math.PI / 2), // its poles fore and aft
        bp = body.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const z = bp.getZ(i),
          k = z < 0 ? 1 + z * 1.25 : 1 - z * z * 0.9; // drawn in to the tail, rounded to the nose
        bp.setXYZ(i, bp.getX(i) * sx * 2 * k, bp.getY(i) * sy * 2 * k, z);
      }
      const top = sy * 0.5,
        th = shark ? 0.42 : 0.3, // the tail's height
        fins = [
          tri(0, 0, -0.42, 0, th, -0.92, 0, 0, -0.68), // the tail, forked
          tri(0, 0, -0.42, 0, 0, -0.68, 0, shark ? -0.22 : -th, -0.86),
          tri(0, top * 0.8, 0.14, 0, top + (shark ? 0.34 : 0.16), -0.14, 0, top * 0.7, -0.26), // the fin on its back
        ];
      if (shark)
        for (const sd of [-1, 1])
          fins.push(tri(sd * sx * 0.7, -0.05, 0.12, sd * (sx + 0.42), -0.16, -0.16, sd * sx * 0.6, -0.06, -0.12));
      const eyes = [-1, 1].map(sd => new THREE.SphereGeometry(0.035, 6, 4).translate(sd * sx * 0.56, sy * 0.12, 0.33));
      const back = (v, x, y, z) => {
        let b = 0.5 + 0.5 * clampN(0.5 - y / (sy * 0.9), 0, 1); // dark above, full colour below
        if (stripe && (Math.abs(z - 0.12) < 0.05 || Math.abs(z + 0.14) < 0.05)) b *= 0.35;
        return b;
      };
      return mergeGeometries([
        tint(body, '#ffffff', 0, back),
        ...fins.map(g => tint(g, '#ffffff', 0, () => 0.62)),
        ...eyes.map(g => tint(g, '#ffffff', 0, () => 0.04)),
      ]);
    };
    const rayGeo = (() => {
      const g = new THREE.SphereGeometry(0.5, 12, 6),
        p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i),
          wing = 1 - Math.abs(z) * 1.4; // a diamond from above: wide at the middle, drawn to a point fore and aft
        p.setXYZ(i, x * 2.2 * Math.max(0.15, wing), p.getY(i) * 0.16 + Math.abs(x) * 0.12, z * 1.3);
      }
      return mergeGeometries([
        tint(g, '#ffffff', 0, (v, x, y) => (y > 0 ? 0.55 : 1)),
        tint(
          new THREE.CylinderGeometry(0.012, 0.03, 1.1, 4).rotateX(Math.PI / 2).translate(0, 0, -1.1),
          '#ffffff',
          0,
          () => 0.5,
        ),
      ]);
    })();
    const SILVER = ['#cfd9e0', '#b9cbd6', '#dfe6ea', '#a9c4d4'],
      REEF = ['#f29a2e', '#f2cf3f', '#3f8fe0', '#e86a5a', '#8fd06a', '#f2f2e6'],
      kinds = [
        { geo: fishGeo(0.11, 0.16), list: [] }, // slim
        { geo: fishGeo(0.08, 0.3, { stripe: true }), list: [] }, // tall reef fish
        { geo: fishGeo(0.15, 0.17, { shark: true }), list: [] },
        { geo: rayGeo, list: [] },
      ];
    for (let g = 0; g < 12; g++) {
      const sd = g % 2 ? 1 : -1,
        lat = rr(HT + 3, FAR - 18),
        y = rr(BED + 4, TOP - 2.5),
        s0 = rand() * span,
        v = rr(3, 6) * (rand() < 0.5 ? -1 : 1),
        col = pick(SILVER),
        size = rr(0.6, 0.95);
      for (let q = 0; q < 16; q++)
        kinds[0].list.push({
          sd,
          lat: lat + rr(-1.6, 1.6),
          y: y + rr(-1, 1),
          s0: s0 + rr(-4, 4),
          v,
          col,
          size,
          ph: rand() * 6,
          wig: 0.14,
        });
    }
    for (let g = 0; g < 16; g++) {
      const sd = g % 2 ? 1 : -1,
        lat = rr(HT + 1.5, HT + 14),
        s0 = rand() * span,
        col = pick(REEF);
      for (let q = 0; q < 5; q++)
        kinds[1].list.push({
          sd,
          lat: lat + rr(-1.5, 1.5),
          y: BED + rr(1.2, 4.5),
          s0: s0 + rr(-3, 3),
          v: rr(0.4, 1.3) * (rand() < 0.5 ? -1 : 1),
          col,
          size: rr(0.7, 1.2),
          ph: rand() * 6,
          wig: 0.1,
        });
    }
    for (let g = 0; g < 4; g++)
      kinds[2].list.push({
        sd: g % 2 ? 1 : -1,
        lat: rr(HT + 4, HT + 18),
        y: rr(BED + 3, -5),
        s0: rand() * span,
        v: rr(2, 3.2) * (g < 2 ? 1 : -1),
        col: '#7f8f99',
        size: rr(2.6, 3.4),
        ph: rand() * 6,
        wig: 0.07,
      });
    kinds[2].list.push({
      sd: 1,
      lat: HT + 11,
      y: -9,
      s0: span * 0.4,
      v: 1.5,
      col: '#587a92',
      size: 11,
      ph: 0,
      wig: 0.03,
    }); // the whale shark
    for (let g = 0; g < 4; g++)
      kinds[3].list.push({
        sd: g % 2 ? 1 : -1,
        lat: rr(HT + 3, HT + 16),
        y: BED + rr(1, 2.2),
        s0: rand() * span,
        v: rr(1.2, 2) * (g < 2 ? -1 : 1),
        col: '#6f7f86',
        size: rr(2.2, 3),
        ph: rand() * 6,
        wig: 0.02,
      });
    const c = new THREE.Color(),
      M4 = new THREE.Matrix4(),
      Q = new THREE.Quaternion(),
      S = new THREE.Vector3(),
      UP = new THREE.Vector3(0, 1, 0),
      hd = head((sA + sB) / 2);
    for (const kd of kinds) {
      kd.im = new THREE.InstancedMesh(kd.geo, new THREE.MeshBasicMaterial(seaThing), kd.list.length);
      kd.list.forEach((o, i) => kd.im.setColorAt(i, c.set(o.col).lerp(HAZE, hazeAt(o.lat))));
      kd.im.frustumCulled = false;
      scene.add(kd.im);
    }
    const swim = t => {
      for (const kd of kinds) {
        kd.list.forEach((o, i) => {
          const s = lo + ((((o.s0 + o.v * t) % span) + span) % span),
            p = tr.point(s, o.sd * (o.lat + Math.sin(t * 0.4 + o.ph) * 0.8), 0);
          p.y = o.y + Math.sin(t * 0.8 + o.ph) * 0.3;
          Q.setFromAxisAngle(UP, hd + (o.v < 0 ? Math.PI : 0) + Math.sin(t * (2 + Math.abs(o.v)) + o.ph) * o.wig);
          M4.compose(p, Q, S.setScalar(o.size));
          kd.im.setMatrixAt(i, M4);
        });
        kd.im.instanceMatrix.needsUpdate = true;
      }
      bubs.forEach((b, i) => {
        const y = (b.y0 + b.v * t) % (TOP - BED);
        bub[i * 3] = b.x + Math.sin(t * 1.3 + b.ph + y) * 0.25;
        bub[i * 3 + 1] = BED + y;
        bub[i * 3 + 2] = b.z + Math.cos(t * 1.1 + b.ph) * 0.2;
      });
      bubG.attributes.position.needsUpdate = true;
      causT.offset.set(Math.sin(t * 0.21) * 0.06, t * 0.012);
      surfT.offset.set(t * 0.02, Math.cos(t * 0.17) * 0.05);
    };
    swim(0);
    swimmers.push(swim);
  }

  const mid = (sA + sB) / 2;
  place(names.tube[0], names.tube[1], tr.point(mid, 0), mid, {
    back: 45,
    h: 3,
    lookH: 2.5,
  });
}
