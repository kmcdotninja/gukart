// Chapter 4, Abuja: the capital's own landmarks, built on the modern Nigerian city kaduna.js lays out (shops, offices,
// keke napep, bungalows, trees). Its roads are stacked in layers the way the capital's are, so beside the race road this
// adds the other roads too: carriageways running alongside the expressway, flyovers crossing over it on their
// embankments, the cross road under the N16 interchange, the metro on its viaduct. Each circuit's pieces:
//  - Central Area: Eagle Square (the parade ground, the grandstand under its white canopy, the flags), the National
//    Assembly's green dome with Aso Rock filling the sky behind it, Shehu Shagari Way between the National Mosque (the
//    golden dome, four minarets) and the National Christian Centre (its spire), the Central Business District's towers
//    (the CBN tower, the NNPC towers, the World Trade Center) and the lawn inside the district's interchange loop
//  - Jabi: Unity Fountain (its basin ringed by a pillar for every state) and the Transcorp Hilton over it, Millennium
//    Park's lawns and long pool, the N16 interchange at Jahi (the expressway under its bridge), the metro's red train on
//    its viaduct, Jabi Lake (boats out on the water, Jabi Lake Mall on the shore)
//  - The Gateway: the Airport Road expressway, the City Gate's white arch over the road, the National Stadium's bowl,
//    the granite rock cut of the new Apo-Karshi road, the Outer Southern Expressway's cloverleaf, Zuma Rock
// Every piece stands on the ground or on something that does: nothing hangs in the air.
import * as THREE from 'three';
import { boxM } from './doha.js';
import { aquarium } from './aquarium.js';
import { signTex } from './textures.js';
import { tunnel } from './tunnels.js';
import { footballPitch, standTex } from './stadium.js';

const TAU = Math.PI * 2;
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

export function dressAbuja(k, h) {
  const { scene, tr, W, rand, rr, pick, free, reserve } = k;
  const { lam, bx, cy, frame, group, mesh, place, board, signBoth, fOf, P, head, inside, white } = h;
  const { steelM, concrete, darkM, lawnM, tryTree, tree, animated, glow, night, add, at, tile, litOf, grain } = h;
  const { keke, bus } = h;
  const CIRC = k.circuit;

  // Jabi Lake and the reservoirs: clear blue-green water, not the River Kaduna's brown
  k.water.material.color.set('#3f8fa0');
  k.water.material.specular?.set('#d6f2f4');

  /* ---------- materials ---------- */
  const flagGreen = '#008751';
  // glass towers: a grid of panes in a frame, a share of them lit at night (one floor every 4 m: boxM tiles every 16 m)
  const glassMat = (pane, frameCol, share = 0.45) => {
    const cells = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([c * 32 + 3, r * 32 + 5, 26, 22]);
    const t = tile((x, w, hh) => {
      x.fillStyle = frameCol;
      x.fillRect(0, 0, w, hh);
      grain(x, w, hh, 200, 0.04);
      for (const [cx, cy2, cw, ch] of cells) {
        const g = x.createLinearGradient(0, cy2, 0, cy2 + ch);
        g.addColorStop(0, pane[0]);
        g.addColorStop(1, pane[1]);
        x.fillStyle = g;
        x.fillRect(cx, cy2, cw, ch);
        x.fillStyle = 'rgba(255,255,255,.18)';
        x.fillRect(cx, cy2, cw, 3);
      }
    });
    return glow(lam('#ffffff', { map: t }), litOf(128, 128, cells, share), '#ffffff', 1);
  };
  const blueGlass = glassMat(['#7fb2d9', '#2f5f8e'], '#c9d3dc'),
    greenGlass = glassMat(['#8cc8b4', '#2e6b5c'], '#e7ebe6'),
    darkGlass = glassMat(['#5d7184', '#1d2a36'], '#9aa4ad'),
    goldGlass = glassMat(['#e7c98a', '#8a6528'], '#d8cbb3'),
    // a concrete grid, dark glass deep in each cell (the CBN, the federal blocks)
    gridMat = glassMat(['#3b4b5a', '#18222c'], '#e9e4da', 0.4);
  const TOWERS = [blueGlass, greenGlass, darkGlass, goldGlass, gridMat];
  const ledGreen = glow(lam('#2b4a3a'), null, '#4dff9c', 2.6),
    ledWhite = glow(lam('#c9cfd4'), null, '#ffffff', 2.2);
  const goldM = new THREE.MeshStandardMaterial({ color: '#e0ad3a', metalness: 0.85, roughness: 0.25 }),
    domeGreen = lam('#2f8f5a'),
    granite = lam('#b3aa9b', { flatShading: true }), // (sunlit granite: pale grey-brown, never black in the shade)
    paving = lam('#d9d4c8'),
    roadM = new THREE.MeshLambertMaterial({ map: k.tex.road, side: THREE.DoubleSide }),
    waterM = new THREE.MeshPhongMaterial({ color: '#4aa9bf', specular: '#e6fbff', shininess: 90 }),
    sandStone = lam('#e6dcc8');

  // a tower: the body, a slab on top, and maybe a crown (a frame of fins, a mast)
  const tower = (x, z, a, w, d, hh, mat, crown = true) => {
    if (!add(boxM(w, hh, d, 16), mat, x, 0, z, a)) return false;
    add(bx(w + 0.8, 1.2, d + 0.8), concrete, x, hh, z, a, 1, false);
    // Light Up Abuja: the tall ones carry LED strips up their corners, green or white, bright at night
    if (hh > 30) {
      const led = rand() < 0.5 ? ledGreen : ledWhite,
        put = at(x, z, a);
      for (const [cx, cz] of [
        [w / 2, d / 2],
        [-w / 2, d / 2],
        [w / 2, -d / 2],
        [-w / 2, -d / 2],
      ])
        put(new THREE.BoxGeometry(0.35, hh, 0.35).translate(cx, hh / 2, cz), led);
      put(new THREE.BoxGeometry(w + 0.9, 0.4, d + 0.9).translate(0, hh + 1.3, 0), led);
    }
    if (crown && rand() < 0.6) {
      add(bx(w * 0.6, 3, d * 0.6), darkM, x, hh + 1.2, z, a, 1, false);
      if (rand() < 0.5) add(cy(0.25, 0.3, 10, 6), steelM, x, hh + 4.2, z, a, 1, false);
    }
    return true;
  };
  // try to set a tower down at (x, z): clear ground, clear of the road and of everything else
  const tryTower = (x, z, a, w, d, hh, mat, minRoad = W / 2 + 22) => {
    const r = Math.hypot(w, d) / 2 + 2;
    if (!free(x, z, r, minRoad)) return false;
    if (!tower(x, z, a, w, d, hh, mat)) return false;
    reserve(x, z, r);
    return true;
  };
  // a road sign on two posts beside the road: green, white words (Abuja's road signs)
  const roadSign = (s, side, text, w = 14) => {
    const fr = frame(s, side, W / 2 + 4),
      G = group(fr.x, fr.z, fr.a);
    for (const z of [-w / 2 + 1, w / 2 - 1]) G.add(mesh(cy(0.22, 0.24, 6.4, 8), steelM, 0, 0, z));
    signBoth(
      G,
      board(text, w, 2.4, '#ffffff', flagGreen, { italic: false, border: '#ffffff' }),
      w,
      2.4,
      0,
      4,
      0,
      Math.PI / 2,
      0.25,
    );
  };
  // a rock: a lumpy ball of granite, flattened on the ground (Aso Rock, Zuma Rock, the rock cut's boulders)
  const rockGeo = (r, hh, seed = 1, detail = 4) => {
    const g = new THREE.IcosahedronGeometry(1, detail),
      p = g.attributes.position,
      v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n =
        0.18 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.z * 2.7 + seed * 2) +
        0.1 * Math.sin(v.y * 5.3 + v.x * 4.1 + seed * 3) +
        0.06 * Math.sin(v.z * 9.7 + seed);
      v.multiplyScalar(1 + n);
      v.y = Math.max(v.y, -0.15);
      p.setXYZ(i, v.x * r, (v.y + 0.15) * hh, v.z * r);
    }
    g.computeVertexNormals();
    return g;
  };
  // a flat ribbon of road `off` metres out to one side of the race road over [s0, s1] (a carriageway alongside), only
  // where it's open ground and the race road is the nearest road (it never runs over the circuit somewhere else)
  const sideRoad = (s0, s1, off, wid) => {
    const pos = [],
      uv = [],
      idx = [];
    let last = -1;
    for (let s = s0; s <= s1; s += 4) {
      const i = tr.idx(s);
      const a = tr.beside(i, off - wid / 2),
        b = tr.beside(i, off + wid / 2),
        ok =
          Math.abs(tr.P[i].y) < 0.6 &&
          !tr.elevated[i] &&
          k.land(a.x, a.z) &&
          k.land(b.x, b.z) &&
          Math.abs(tr.nearest(a.x, a.z).i - i) < 12 &&
          Math.abs(tr.nearest(b.x, b.z).i - i) < 12 &&
          k.roadGap(b.x, b.z) > Math.abs(off) + wid / 2 - 6;
      if (!ok) {
        last = -1;
        continue;
      }
      const n = pos.length / 3;
      pos.push(a.x, 0.06, a.z, b.x, 0.06, b.z);
      uv.push(0, s / 24, 1, s / 24);
      if (last >= 0) idx.push(last, last + 1, n, last + 1, n + 1, n);
      last = n;
      reserve((a.x + b.x) / 2, (a.z + b.z) / 2, wid / 2 + 1);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, roadM);
    m.receiveShadow = true;
    scene.add(m);
  };
  // the ground under a footprint is open land, clear of every road (a flyover's embankment, a viaduct's piers)
  const openGround = (x, z, r) => k.land(x, z) && k.roadGap(x, z) > W / 2 + r;
  // how far a crossing (a road, a viaduct) square across the race road at index i can run out on side sd (in a frame
  // turned by a, local x) before it would reach another part of the circuit or leave the land
  const reach = (c, i, a, sd, max, pad = 10) => {
    const dx = Math.cos(a),
      dz = -Math.sin(a);
    let o = 0;
    for (; o <= max; o += 4) {
      const q = { x: c.x + dx * sd * o, z: c.z + dz * sd * o },
        n = tr.nearest(q.x, q.z),
        dj = Math.min(Math.abs(n.i - i), tr.N - Math.abs(n.i - i));
      if ((dj > 40 && n.d < W / 2 + pad) || !k.land(q.x, q.z)) break;
    }
    return Math.min(max, o - 6);
  };
  // a road crossing over the race road at s on its own bridge: the deck square to the road at Y metres, its two
  // embankments (grassy earth, retaining walls) running out either side and sloping down to the ground. Only where the race
  // road is on the ground and nothing else is in the way
  const overpass = (s, Y = 10.5, wid = 16) => {
    const i = tr.idx(s),
      c = tr.P[i],
      L = tr.L[i],
      a = head(s); // (local x runs across the race road, along L)
    if (Math.abs(c.y) > 0.5 || tr.elevated[i]) return false;
    // never over a stretch the road runs through something (a cave, a tunnel, a hall), nor just outside its mouths
    for (let d = -40; d <= 40; d += 2) if (tr.hall[tr.idx(s + d)] || tr.lowb[tr.idx(s + d)]) return false;
    const SPAN = W / 2 + 12, // the deck between the embankments' faces
      EMB = 22, // the flat top of each embankment
      RAMP = 46; // its slope down to the ground
    // everything it stands on must be open ground, and no other part of the circuit may be near it
    for (const sd of [1, -1])
      for (let o = SPAN; o <= SPAN + EMB + RAMP; o += 6) {
        const q = { x: c.x + L.x * sd * o, z: c.z + L.z * sd * o };
        if (!openGround(q.x, q.z, wid / 2 + 2)) return false;
      }
    for (let j = 0; j < tr.N; j += 2) {
      const dj = Math.min(Math.abs(j - i), tr.N - Math.abs(j - i));
      if (dj < 25) continue;
      const q = tr.P[j],
        along = (q.x - c.x) * L.x + (q.z - c.z) * L.z,
        across = Math.abs((q.x - c.x) * L.z - (q.z - c.z) * L.x);
      if (Math.abs(along) < SPAN + EMB + RAMP + 10 && across < wid / 2 + W / 2 + 6) return false;
    }
    const put = at(c.x, c.z, a);
    // the deck: a slab of road over the race road, its parapets, its beams under it
    const deck = new THREE.BoxGeometry(2 * SPAN, 1.2, wid).translate(0, Y - 0.6, 0);
    put(deck, concrete);
    const top = new THREE.PlaneGeometry(2 * SPAN, wid).rotateX(-Math.PI / 2).translate(0, Y + 0.02, 0);
    put(top, roadM);
    for (const sd of [1, -1]) put(bx(2 * SPAN, 1.1, 0.4).translate(0, Y, sd * (wid / 2 - 0.2)), white);
    // the embankments: a block of earth faced with retaining walls, then a wedge sloping down to the ground
    for (const sd of [1, -1]) {
      const x0 = sd * (SPAN + EMB / 2);
      put(bx(EMB, Y, wid + 2).translate(x0, 0, 0), sandStone, 0, 0, 0, 0, true);
      put(new THREE.PlaneGeometry(EMB, wid).rotateX(-Math.PI / 2).translate(x0, Y + 0.02, 0), roadM);
      const w = new THREE.BufferGeometry(),
        xa = sd * (SPAN + EMB),
        xb = sd * (SPAN + EMB + RAMP),
        hw = wid / 2 + 1;
      const v = [
        [xa, 0, -hw],
        [xa, Y, -hw],
        [xb, 0, -hw],
        [xa, 0, hw],
        [xa, Y, hw],
        [xb, 0, hw],
      ];
      w.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
      w.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0], 2));
      w.setIndex(sd > 0 ? [0, 2, 1, 3, 4, 5, 1, 2, 5, 1, 5, 4] : [0, 1, 2, 3, 5, 4, 1, 5, 2, 1, 4, 5]);
      w.computeVertexNormals();
      put(w, lawnM);
      // its road surface up the slope
      const r = new THREE.BufferGeometry();
      r.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [xa, Y + 0.03, -wid / 2, xb, 0.05, -wid / 2, xa, Y + 0.03, wid / 2, xb, 0.05, wid / 2],
          3,
        ),
      );
      r.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, RAMP / 24, 1, 0, 1, RAMP / 24], 2));
      r.setIndex(sd > 0 ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 2, 3, 1]);
      r.computeVertexNormals();
      put(r, roadM);
      for (let o = SPAN; o <= SPAN + EMB + RAMP; o += 8) reserve(c.x + L.x * sd * o, c.z + L.z * sd * o, wid / 2 + 2);
    }
    // a lamp post on each parapet over the middle, and a few cars parked up on the deck's shoulder
    for (const sd of [1, -1]) put(cy(0.12, 0.14, 7, 6).translate(sd * (SPAN - 3), Y, wid / 2 - 0.6), steelM);
    return true;
  };
  // a lawn island inside an interchange loop: the middle of the loop, as far as the road allows, palms round it
  const loopIsland = (s0, len, signText) => {
    const pts = [];
    for (let s = s0; s < s0 + len; s += 6) pts.push(tr.P[tr.idx(s)]);
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length,
      cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    let rMin = Infinity;
    for (const p of pts) rMin = Math.min(rMin, Math.hypot(p.x - cx, p.z - cz));
    // (and clear of any road down on the ground anywhere: the lawn never covers a road)
    for (let j = 0; j < tr.N; j += 2)
      if (tr.P[j].y < 3) rMin = Math.min(rMin, Math.hypot(tr.P[j].x - cx, tr.P[j].z - cz));
    const R = rMin - W / 2 - 8;
    if (R < 12) return null;
    add(new THREE.CylinderGeometry(R, R, 0.3, 48).translate(0, 0.15, 0), lawnM, cx, 0, cz, 0, 1, false);
    add(
      new THREE.TorusGeometry(R, 0.35, 6, 64).rotateX(Math.PI / 2).translate(0, 0.3, 0),
      white,
      cx,
      0,
      cz,
      0,
      1,
      false,
    );
    for (let n = 0; n < 16; n++) {
      const t = (n / 16) * TAU,
        x = cx + Math.cos(t) * (R - 5),
        z = cz + Math.sin(t) * (R - 5);
      tree(x, z, n % 2 ? 'doum' : 'neem', rr(0.9, 1.15));
    }
    // the sign in the middle, on two posts, both faces
    if (signText) {
      const G = group(cx, cz, rand() * TAU);
      for (const z of [-6, 6]) G.add(mesh(cy(0.25, 0.28, 6, 8), steelM, 0, 0, z));
      signBoth(
        G,
        board(signText, 15, 2.6, '#ffffff', flagGreen, { italic: false, border: '#ffffff' }),
        15,
        2.6,
        0,
        3.6,
        0,
        Math.PI / 2,
        0.3,
      );
    }
    reserve(cx, cz, R);
    return { x: cx, z: cz, r: R };
  };

  /* ---------- Central Area ---------- */
  // Eagle Square: the parade ground, the grandstand under its white canopy, the flags along it, the eagle
  for (const f of fOf('eaglesq')) {
    const sm = f.s + f.len / 2,
      side = -1, // (outside the loop)
      fr = frame(sm, side, W / 2 + 60);
    if (!free(fr.x, fr.z, 50, W / 2 + 8)) continue;
    reserve(fr.x, fr.z, 62);
    const put = fr.put,
      rx = fr.rx; // (+rx points back at the road)
    put(new THREE.BoxGeometry(70, 0.2, 130).translate(0, 0.1, 0), paving);
    // the grandstand on the far side, facing the square and the road: tiers, the canopy on its columns
    const gx = -rx * 42;
    for (let t = 0; t < 6; t++)
      put(
        bx(4, 1.2 + t * 1.2, 110).translate(gx - rx * t * 3.6, 0, 0),
        t % 2 ? white : lam('#e5e1d6'),
        0,
        0,
        0,
        0,
        true,
      );
    for (let z = -50; z <= 50; z += 12.5) put(cy(0.5, 0.6, 15, 10).translate(gx - rx * 20, 0, z), white);
    // the canopy: a long white wave over the tiers
    {
      const g = new THREE.BoxGeometry(26, 0.8, 116, 1, 1, 24),
        p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin((p.getZ(i) / 116) * Math.PI * 3) * 1.2);
      g.computeVertexNormals();
      put(g.translate(gx - rx * 9, 15.5, 0), white);
    }
    // the national eagle on the grandstand's middle: a green and white emblem board between two pillars
    put(bx(1.2, 13, 1.2).translate(gx + rx * 3, 0, -8), white);
    put(bx(1.2, 13, 1.2).translate(gx + rx * 3, 0, 8), white);
    const crest = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 8),
      lam('#ffffff', {
        map: k.tex && THREE && boardCanvas(),
      }),
    );
    {
      const G = group(fr.x, fr.z, fr.a);
      crest.position.set(gx + rx * 3.7, 8.5, 0);
      crest.rotation.y = rx > 0 ? Math.PI / 2 : -Math.PI / 2;
      G.add(crest);
    }
    // the flags along the road edge of the square, green white green
    for (let z = -55; z <= 55; z += 11) {
      put(cy(0.12, 0.15, 12, 6).translate(rx * 33, 0, z), steelM);
      put(bx(0.08, 2, 3.2).translate(rx * 33, 9.6, z + 1.7), lam(Math.round(z / 11) % 2 ? flagGreen : '#ffffff'));
    }
    put(bx(4, 0.8, 4).translate(rx * 20, 0, 0), white);
    put(new THREE.BoxGeometry(2, 3.5, 2).translate(rx * 20, 2.55, 0), lam('#1f6b3f'));
    place('EAGLE SQUARE', 'The parade ground', { x: fr.x, z: fr.z }, sm, { back: 70, h: 6, lookH: 8 });
  }
  // the board for the eagle crest: green field, a white eagle, NIGERIA under it
  function boardCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 272;
    const x = c.getContext('2d');
    x.fillStyle = flagGreen;
    x.fillRect(0, 0, 512, 272);
    x.fillStyle = '#ffffff';
    x.beginPath(); // a spread eagle
    x.moveTo(256, 40);
    x.lineTo(296, 90);
    x.lineTo(420, 70);
    x.lineTo(320, 130);
    x.lineTo(300, 190);
    x.lineTo(256, 160);
    x.lineTo(212, 190);
    x.lineTo(192, 130);
    x.lineTo(92, 70);
    x.lineTo(216, 90);
    x.closePath();
    x.fill();
    x.font = `italic 800 48px ${FONT}`;
    x.textAlign = 'center';
    x.fillText('FEDERAL REPUBLIC OF NIGERIA', 256, 250);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // the Millennium Tower: Abuja's futuristic needle, three legs leaning in to a slender shaft, a disc of a pod near the
  // top lit round its rim, the cultural centre's white wings at its feet
  for (const f of fOf('eaglesq')) {
    const fr = [90, 120, 150].map(o => frame(f.s + f.len + 40, 1, W / 2 + o)).find(q => free(q.x, q.z, 30, W / 2 + 20));
    if (!fr) continue;
    reserve(fr.x, fr.z, 34);
    const put = fr.put,
      tall = 150,
      podM = glow(lam('#e9eef2'), null, '#8fe3ff', 1.4),
      ringM = glow(lam('#2a3a44'), null, '#3dd6ff', 2.4);
    for (let n = 0; n < 3; n++) {
      const t = (n / 3) * TAU;
      put(
        new THREE.CylinderGeometry(1.4, 3.2, 70, 8)
          .translate(0, 35, 0)
          .rotateZ(0.16)
          .rotateY(t)
          .translate(Math.cos(t) * 11, 0, -Math.sin(t) * 11),
        white,
      );
    }
    put(new THREE.CylinderGeometry(2.2, 4.2, tall, 12).translate(0, tall / 2, 0), white);
    put(new THREE.CylinderGeometry(15, 9, 7, 32).translate(0, tall - 22, 0), podM);
    put(new THREE.TorusGeometry(15, 0.6, 6, 48).rotateX(Math.PI / 2).translate(0, tall - 19.5, 0), ringM);
    put(new THREE.CylinderGeometry(9, 15, 3, 32).translate(0, tall - 27, 0), podM);
    put(new THREE.CylinderGeometry(0.5, 1.6, 22, 8).translate(0, tall, 0), steelM);
    for (const sd of [1, -1])
      put(
        new THREE.CylinderGeometry(24, 24, 12, 24, 1, false, 0, Math.PI * 0.6)
          .rotateY(sd > 0 ? 0.3 : Math.PI + 0.3)
          .translate(0, 6, 0),
        white,
      );
    place('MILLENNIUM TOWER', 'The needle over the capital', { x: fr.x, z: fr.z }, f.s + f.len + 40, {
      back: 120,
      h: 6,
      lookH: 90,
    });
  }
  // the National Assembly: the white hall on its colonnade, the green dome; Aso Rock behind it, filling the sky
  for (const f of fOf('assembly')) {
    const sm = f.s + 60,
      fr = frame(sm, -1, W / 2 + 70);
    if (!fOf('nahall').length && free(fr.x, fr.z, 46, W / 2 + 10)) {
      reserve(fr.x, fr.z, 50);
      const put = fr.put;
      put(bx(90, 1.6, 70), white, 0, 0, 0, 0, true); // the podium
      put(bx(80, 16, 56), lam('#f3efe6'), 0, 1.6, 0, 0, true);
      for (let z = -36; z <= 36; z += 4.5) put(cy(0.7, 0.8, 14, 10).translate(fr.rx * 41, 1.6, z), white);
      put(bx(84, 1.4, 60).translate(0, 17.6, 0), white);
      put(cy(18, 18, 7, 32).translate(0, 19, 0), lam('#efe9dc')); // the drum
      put(
        new THREE.SphereGeometry(18.5, 32, 16, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, 26, 0),
        domeGreen,
      );
      put(cy(1, 1.6, 6, 10).translate(0, 41.5, 0), white);
      for (const z of [-30, 30])
        put(new THREE.SphereGeometry(6, 18, 10, 0, TAU, 0, Math.PI / 2).translate(0, 19, z), domeGreen);
      place('NATIONAL ASSEMBLY', 'The green dome', { x: fr.x, z: fr.z }, sm, { back: 80, h: 5, lookH: 22 });
    }
    // Aso Rock: the great bare granite rock behind the Three Arms Zone, far out past the Assembly
    for (const off of [300, 240, 360, 200]) {
      const q = frame(sm + 40, -1, W / 2 + off);
      if (!free(q.x, q.z, 110, W / 2 + 60)) continue;
      reserve(q.x, q.z, 120);
      const g = rockGeo(115, 135, 2.3, 4);
      add(g, granite, q.x, 0, q.z, rand() * TAU, 1, false);
      // a smaller shoulder of rock leaning against it, and scrub at its foot
      add(rockGeo(55, 70, 5.1, 3), granite, q.x + 80, 0, q.z - 50, 0, 1, false);
      for (let n = 0; n < 30; n++) {
        const t = rand() * TAU,
          r = rr(110, 150);
        tryTree(
          q.x + Math.cos(t) * r,
          q.z + Math.sin(t) * r,
          3,
          pick(['neem', 'mango', 'baobab']),
          rr(0.9, 1.3),
          W / 2 + 20,
        );
      }
      place('ASO ROCK', 'The rock over the capital', { x: q.x, y: 60, z: q.z }, sm, { back: 120, h: 8, lookH: 70 });
      break;
    }
  }

  // the National Mosque: a square white hall under the golden dome, a minaret at each corner, gold tips
  for (const f of fOf('abmosque')) {
    const sm = f.s + f.len * 0.4,
      fr = [52, 64, 80, 100].map(o => frame(sm, 1, W / 2 + o)).find(q => free(q.x, q.z, 36, W / 2 + 10));
    if (!fr) continue;
    reserve(fr.x, fr.z, 40);
    const put = fr.put;
    put(bx(56, 1.2, 56), paving, 0, 0, 0, 0, true);
    put(bx(36, 13, 36), white, 0, 1.2, 0, 0, true);
    put(cy(13, 13, 3.5, 32).translate(0, 14.2, 0), white);
    put(new THREE.SphereGeometry(13.5, 32, 18, 0, TAU, 0, Math.PI / 2).scale(1, 1.15, 1).translate(0, 17.7, 0), goldM);
    put(cy(0.5, 0.9, 5, 8).translate(0, 33, 0), goldM);
    for (const [x, z] of [
      [-23, -23],
      [23, -23],
      [-23, 23],
      [23, 23],
    ]) {
      put(cy(1.6, 1.9, 50, 12).translate(x, 1.2, z), white);
      put(cy(2.3, 2.3, 1.2, 12).translate(x, 34, z), white); // the balcony
      put(new THREE.ConeGeometry(1.7, 6, 12).translate(x, 54.2, z), goldM);
    }
    place('NATIONAL MOSQUE', 'The golden dome', { x: fr.x, z: fr.z }, sm, { back: 60, h: 4, lookH: 20 });
  }
  // the National Christian Centre: a long white hall, its tall pointed spire at the front, a cross on top
  for (const f of fOf('abchurch')) {
    const sm = f.s + f.len * 0.55,
      fr = [50, 62, 78, 96].map(o => frame(sm, -1, W / 2 + o)).find(q => free(q.x, q.z, 34, W / 2 + 10));
    if (!fr) continue;
    reserve(fr.x, fr.z, 38);
    const put = fr.put;
    put(bx(46, 1.2, 60), paving, 0, 0, 0, 0, true);
    put(bx(30, 14, 46), white, 0, 1.2, 0, 0, true);
    // the roof: a steep white gable along the hall
    put(
      new THREE.CylinderGeometry(0.1, 17, 10, 4, 1)
        .rotateY(Math.PI / 4)
        .scale(1, 1, 1.9)
        .translate(0, 20.2, 0),
      lam('#eeeeea'),
    );
    // the spire: a tall four-sided point on the front facing the road
    put(new THREE.CylinderGeometry(0.4, 7, 58, 4).rotateY(Math.PI / 4).translate(fr.rx * 12, 30.2, 0), white);
    put(bx(0.6, 7, 0.6).translate(fr.rx * 12, 59, 0), goldM);
    put(bx(0.6, 0.6, 3.6).translate(fr.rx * 12, 63.5, 0), goldM);
    place('NATIONAL CHRISTIAN CENTRE', 'The white spire', { x: fr.x, z: fr.z }, sm, { back: 60, h: 4, lookH: 24 });
  }

  // the district's interchange: the lawn inside its loop, and the CBN tower beside its way in
  for (const f of fOf('cbdspiral')) {
    const [o, len] = f.spiral || [40, 600];
    loopIsland(f.s + o, len, 'THE ABUJA HELIX');
    // the CBN: a tall tower in a concrete grid, its podium out front, the bank's name over the door
    for (const off of [60, 80, 100]) {
      const fr = frame(f.s + 10, -1, W / 2 + off);
      if (!free(fr.x, fr.z, 30, W / 2 + 24)) continue;
      reserve(fr.x, fr.z, 34);
      const put = fr.put;
      put(boxM(60, 14, 40, 16), gridMat, 0, 0, 0, 0, true);
      put(boxM(30, 96, 30, 16), gridMat, 0, 0, 0, 0, true);
      put(bx(32, 2.5, 32).translate(0, 96, 0), concrete);
      put(bx(20, 7, 20).translate(0, 98.5, 0), darkM);
      put(cy(0.4, 0.5, 14, 8).translate(0, 105.5, 0), steelM);
      const G = group(fr.x, fr.z, fr.a);
      signBoth(
        G,
        board('CENTRAL BANK OF NIGERIA', 30, 3, '#f2cf63', '#123a2a', { italic: false }),
        30,
        3,
        fr.rx * 30.4,
        9,
        0,
        Math.PI / 2,
        0.4,
      );
      place('CENTRAL BANK OF NIGERIA', 'The CBN tower', { x: fr.x, z: fr.z }, f.s, { back: 90, h: 6, lookH: 50 });
      break;
    }
    // the NNPC towers: four tall towers in two pairs across the loop from the CBN
    let made = 0;
    for (let n = 0; n < 30 && made < 4; n++) {
      const s = f.s + rr(0, 200),
        fr = frame(s, 1, W / 2 + rr(70, 140));
      if (tryTower(fr.x, fr.z, fr.a, 18, 18, rr(70, 85), goldGlass, W / 2 + 40)) made++;
    }
    place('THE HELIX', 'Two turns stacked among the towers', tr.point(f.s + o + len * 0.75, 30), f.s + o + len * 0.75, {
      back: 60,
      h: 30,
      lookH: 24,
    });
  }
  // the World Trade Center: two glass towers side by side
  for (const f of fOf('wtc')) {
    for (const off of [60, 80, 110]) {
      const fr = frame(f.s + 30, -1, W / 2 + off);
      if (!free(fr.x, fr.z, 34, W / 2 + 26)) continue;
      reserve(fr.x, fr.z, 38);
      fr.put(boxM(22, 88, 22, 16), blueGlass, 0, 0, -16, 0, true);
      fr.put(boxM(20, 70, 20, 16), blueGlass, 0, 0, 16, 0, true);
      fr.put(bx(23, 3, 23).translate(0, 88, -16), concrete);
      fr.put(bx(21, 3, 21).translate(0, 70, 16), concrete);
      fr.put(boxM(40, 8, 60, 16), darkGlass, 0, 0, 0, 0, true);
      place('WORLD TRADE CENTER', 'The twin glass towers', { x: fr.x, z: fr.z }, f.s, { back: 80, h: 5, lookH: 40 });
      break;
    }
  }

  // the Central Business District: glass towers set back either side, taller further in
  for (const f of fOf('cbd'))
    for (let n = 0; n < 70; n++) {
      const s = f.s + rand() * f.len,
        sd = rand() < 0.5 ? 1 : -1,
        off = rr(40, 190),
        p = P(s, sd * (W / 2 + off)),
        hh = off > 90 ? rr(40, 92) : rr(26, 55);
      tryTower(
        p.x,
        p.z,
        head(s) + (rand() < 0.2 ? Math.PI / 4 : 0),
        rr(18, 28),
        rr(18, 26),
        hh,
        pick(TOWERS),
        W / 2 + 30,
      );
    }
  /* ---------- Jabi ---------- */
  // Unity Fountain: a round basin, a pillar for each of the 36 states and the FCT round it, jets in the middle; the
  // Transcorp Hilton behind
  for (const f of fOf('unity')) {
    const fr = frame(f.s, 1, W / 2 + 40);
    if (free(fr.x, fr.z, 26, W / 2 + 10)) {
      reserve(fr.x, fr.z, 30);
      const put = fr.put;
      put(new THREE.CylinderGeometry(26, 26, 0.3, 48).translate(0, 0.15, 0), paving);
      put(new THREE.CylinderGeometry(16, 16.5, 1, 48, 1, true).translate(0, 0.5, 0), white);
      put(new THREE.CylinderGeometry(16, 16, 0.2, 48).translate(0, 0.7, 0), waterM);
      for (let n = 0; n < 37; n++) {
        const t = (n / 37) * TAU;
        put(bx(0.9, 7, 0.9).translate(Math.cos(t) * 20, 0, Math.sin(t) * 20), n === 0 ? lam(flagGreen) : white);
        put(bx(1.3, 0.5, 1.3).translate(Math.cos(t) * 20, 7, Math.sin(t) * 20), lam(flagGreen));
      }
      put(cy(1.4, 2, 8, 16).translate(0, 0.8, 0), white);
      // the jets: white columns of spray rising and falling
      const G = group(fr.x, fr.z, fr.a),
        sprayM = new THREE.MeshLambertMaterial({ color: '#eaf8ff', transparent: true, opacity: 0.75 }),
        jets = [];
      for (let n = 0; n < 8; n++) {
        const t = (n / 8) * TAU,
          j = mesh(
            new THREE.ConeGeometry(0.7, 1, 8).translate(0, 0.5, 0),
            sprayM,
            Math.cos(t) * 8,
            0.8,
            Math.sin(t) * 8,
          );
        G.add(j);
        jets.push(j);
      }
      const mid = mesh(new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0), sprayM, 0, 8.8, 0);
      G.add(mid);
      animated.push(tt => {
        jets.forEach((j, n) => (j.scale.y = 4 + 2 * Math.sin(tt * 2 + n)));
        mid.scale.y = 7 + 2 * Math.sin(tt * 1.3);
      });
      place('UNITY FOUNTAIN', 'A pillar for every state', { x: fr.x, z: fr.z }, f.s, { back: 50, h: 4, lookH: 6 });
    }
    // the Transcorp Hilton: a tall white slab, balconies in bands, its name on the top
    for (const off of [90, 110, 130]) {
      const q = frame(f.s + 30, 1, W / 2 + off);
      if (!free(q.x, q.z, 36, W / 2 + 40)) continue;
      reserve(q.x, q.z, 40);
      const hotelM = glassMat(['#4f6b85', '#24384c'], '#f4f2ec', 0.6);
      q.put(boxM(62, 66, 18, 16), hotelM, 0, 0, 0, Math.PI / 2, true);
      q.put(
        bx(66, 2, 22)
          .translate(0, 66, 0)
          .rotateY(Math.PI / 2),
        white,
      );
      q.put(boxM(80, 8, 50, 16), darkGlass, 0, 0, 0, Math.PI / 2, true);
      const G = group(q.x, q.z, q.a);
      signBoth(
        G,
        board('TRANSCORP HILTON', 26, 3.6, '#ffffff', '#1d3557', { italic: false }),
        26,
        3.6,
        q.rx * 9.4,
        60,
        0,
        Math.PI / 2,
        0.4,
      );
      place('TRANSCORP HILTON', 'Over Unity Fountain', { x: q.x, z: q.z }, f.s, { back: 70, h: 5, lookH: 40 });
      break;
    }
  }
  // Millennium Park: lawns either side, trees in groves, a long pool down the middle of the far lawn
  for (const f of fOf('millennium')) {
    const fr = [50, 70, 95].map(o => frame(f.s + f.len / 2, 1, W / 2 + o)).find(q => free(q.x, q.z, 22, W / 2 + 14));
    if (fr) {
      reserve(fr.x, fr.z, 24);
      fr.put(bx(10, 0.6, 70), white);
      fr.put(new THREE.BoxGeometry(8.6, 0.1, 68.6).translate(0, 0.62, 0), waterM);
      place('MILLENNIUM PARK', 'The lawns and the long pool', { x: fr.x, z: fr.z }, f.s + f.len / 2, {
        back: 50,
        h: 4,
        lookH: 4,
      });
    }
    for (let s = f.s; s < f.s + f.len; s += 8)
      for (const sd of [1, -1]) {
        const p = P(s, sd * (W / 2 + 30));
        if (!openGround(p.x, p.z, 10)) continue;
        add(new THREE.CylinderGeometry(20, 20, 0.12, 12).translate(0, 0.06, 0), lawnM, p.x, 0, p.z, 0, 1, false);
      }
    for (let n = 0; n < 60; n++) {
      const s = f.s + rand() * f.len,
        p = P(s, (rand() < 0.5 ? 1 : -1) * (W / 2 + rr(16, 90)));
      tryTree(p.x, p.z, 3, pick(['neem', 'mango', 'mahogany', 'doum']), rr(0.9, 1.3), W / 2 + 10);
    }
  }
  // the N16 interchange at Jahi: the expressway under the bridge, square across it, its traffic parked up; the sign
  for (const f of fOf('n16')) {
    const sm = f.s + f.len / 2,
      i = tr.idx(sm),
      c = tr.P[i],
      L = tr.L[i],
      span = W / 2 + 90,
      a = head(sm);
    // the road beneath: a ribbon across under the bridge, each side only as far as it stays clear of the rest of the circuit
    const e0 = reach(c, i, a, -1, span),
      e1 = reach(c, i, a, 1, span),
      dx = Math.cos(a),
      dz = -Math.sin(a);
    if (e0 > W / 2 + 20 && e1 > W / 2 + 20) {
      const put = at(c.x, c.z, a);
      put(new THREE.PlaneGeometry(e0 + e1, 18).rotateX(-Math.PI / 2).translate((e1 - e0) / 2, 0.06, 0), roadM);
      for (let o = -e0 + 10; o < e1 - 10; o += 22) {
        if (Math.abs(o) < W / 2 + 6) continue; // (not under the bridge itself)
        const x = c.x + dx * o,
          z = c.z + dz * o;
        rand() < 0.6 ? keke(x, z, a + Math.PI / 2 + rr(-0.2, 0.2)) : bus(x, z, a + Math.PI / 2);
      }
      for (let o = -e0; o <= e1; o += 8) reserve(c.x + dx * o, c.z + dz * o, 10);
    }
    void L;
    roadSign(f.s - 20, -1, 'N16 INTERCHANGE  JAHI – GWARINPA', 18);
    place('N16 INTERCHANGE', 'The new bridge at Jahi', tr.point(sm, 12), sm, { back: 40, h: 4, lookH: 8 });
  }
  // the metro: the red train on its viaduct, square across over the road on concrete piers
  for (const f of fOf('metro')) {
    const i = tr.idx(f.s),
      c = tr.P[i],
      L = tr.L[i],
      a = head(f.s),
      Y = 11,
      span = W / 2 + 110;
    if (Math.abs(c.y) > 0.5) continue;
    const e0 = reach(c, i, a, -1, span, 14),
      e1 = reach(c, i, a, 1, span, 14),
      dx = Math.cos(a),
      dz = -Math.sin(a);
    if (e0 < W / 2 + 12 || e1 < W / 2 + 12) continue;
    const put = at(c.x, c.z, a);
    put(bx(e0 + e1, 1.8, 9).translate((e1 - e0) / 2, Y - 1.8, 0), concrete);
    for (const sd of [1, -1]) put(bx(e0 + e1, 1.4, 0.4).translate((e1 - e0) / 2, Y, sd * 4.3), concrete);
    // the piers: one each side of the road, then every 26 m out, the last at each end of the deck
    for (const sd of [1, -1]) {
      const e = sd > 0 ? e1 : e0,
        at2 = [];
      for (let o = W / 2 + 5; o < e - 6; o += 26) at2.push(o);
      at2.push(e - 2);
      for (const o of at2) {
        put(bx(2.6, Y - 1.8, 4).translate(sd * o, 0, 0), concrete);
        reserve(c.x + dx * sd * o, c.z + dz * sd * o, 4);
      }
    }
    void L;
    // the train: three white cars, a red band, dark windows, standing over the road
    const trainT = tile(
      (x, w, hh) => {
        x.fillStyle = '#f2f3f5';
        x.fillRect(0, 0, w, hh);
        x.fillStyle = '#c8202b';
        x.fillRect(0, hh * 0.68, w, hh * 0.14);
        x.fillStyle = '#1d2630';
        for (let n = 0; n < 6; n++) x.fillRect(8 + n * 20, hh * 0.22, 14, hh * 0.32);
      },
      128,
      64,
    );
    const trainM = glow(lam('#ffffff', { map: trainT }), null, '#fff2d0', 0.3);
    for (let n = -1; n <= 1; n++) put(new THREE.BoxGeometry(19, 3.8, 3).translate(n * 20, Y + 2.1, 0), trainM);
    roadSign(f.s - 30, 1, 'ABUJA LIGHT RAIL', 12);
    place('THE METRO', 'Under the light rail', { x: c.x, y: Y, z: c.z }, f.s, { back: 40, h: 3, lookH: 10 });
  }
  // Jabi Lake: boats out on the water, the mall on the far side of the road, the promenade's lamps
  for (const f of fOf('jabi')) {
    const boats = [];
    for (let n = 0; n < 24; n++) {
      const s = f.s + rand() * f.len,
        sd = inside(s),
        p = P(s, sd * (W / 2 + rr(40, 140)));
      if (k.land(p.x, p.z)) continue;
      const G = group(p.x, p.z, rand() * TAU),
        hull = rand() < 0.5 ? '#f4f4f0' : pick(['#e85a2a', '#2a6fc8', '#f2c230']);
      G.add(mesh(new THREE.BoxGeometry(2.2, 0.8, 5).translate(0, 0.1, 0), lam(hull), 0, -1.2, 0));
      G.add(mesh(new THREE.BoxGeometry(2, 0.12, 2.4), lam('#1f6fb0'), 0, 0.5, -0.4));
      for (const x of [-0.9, 0.9]) G.add(mesh(cy(0.05, 0.05, 1.2, 4), steelM, x, -0.7, -0.4));
      boats.push({ G, ph: rand() * TAU });
    }
    animated.push(t => boats.forEach(b => (b.G.position.y = Math.sin(t * 1.2 + b.ph) * 0.12)));
    // the mall: a long low block, a glass front to the road, its name along the top
    for (const [off, along] of [
      [50, 0.6],
      [70, 0.6],
      [100, 0.6],
      [70, 0.35],
      [70, 0.8],
      [130, 0.5],
    ]) {
      const fr = frame(f.s + f.len * along, -1, W / 2 + off);
      if (!free(fr.x, fr.z, 44, W / 2 + 20)) continue;
      reserve(fr.x, fr.z, 48);
      fr.put(boxM(40, 16, 120, 16), blueGlass, 0, 0, 0, 0, true);
      fr.put(bx(44, 1.5, 124).translate(0, 16, 0), white);
      const G = group(fr.x, fr.z, fr.a);
      signBoth(
        G,
        board('JABI LAKE MALL', 30, 4, '#ffffff', '#0f6f86', { italic: false }),
        30,
        4,
        fr.rx * 20.4,
        11,
        0,
        Math.PI / 2,
        0.4,
      );
      place('JABI LAKE MALL', 'On the lakeshore', { x: fr.x, z: fr.z }, f.s + f.len * 0.6, {
        back: 60,
        h: 4,
        lookH: 10,
      });
      break;
    }
    place('JABI LAKE', 'The water at your shoulder', tr.point(f.s + f.len * 0.3, 0), f.s + f.len * 0.3, {
      back: 50,
      h: 4,
      lookH: 3,
    });
  }

  // under Jabi Lake: where the road dives, a glass tube along the lake bed, in the lake's own look: green-blue water, a
  // sandy bed, the light coming down from the surface
  for (const f of fOf('lowbridge'))
    aquarium(k, f, {
      lam,
      glow,
      place,
      head,
      swimmers: animated,
      deck: false,
      sign: signTex('JABI LAKE TUNNEL', 0, 'kano'),
      names: { tube: ['UNDER JABI LAKE', 'Down a glass tube along the lake bed'], bridge: null },
      look: {
        round: true,
        hoop: 6,
        rails: true,
        rib: '#f2f6f8',
        ribGlow: '#3c6a5c',
        glass: '#d4f3ec',
        top: '#4fb8b0',
        bed: '#0f4a4a',
        haze: '#2b8a86',
        sand: '#a8b98a',
        surf: '#8fdcd2',
        surfDeep: '#4fa9a6',
        bubble: 0.35,
        bubbleCols: 24,
      },
    });

  /* ---------- futuristic: lights under every raised deck, glowing green at night ---------- */
  {
    const ledM = glow(lam('#123326'), null, '#3dff9a', 2.2);
    for (let i = 0; i < tr.N; i += 2) {
      if (!tr.elevated[i] || tr.P[i].y < 6) continue;
      const p = tr.P[i],
        a = head(i * tr.seg);
      for (const sd of [1, -1]) {
        const q = tr.beside(i, sd * (W / 2 + 0.6));
        add(new THREE.BoxGeometry(0.35, 0.25, tr.seg * 2.05), ledM, q.x, p.y - 1.75, q.z, a, 1, false);
      }
    }
  }

  /* ---------- through the National Assembly, out into the State House ---------- */
  // the road runs straight through the Assembly: in under its colonnade, down a marble hall between columns, under the
  // green dome, and out the back. The walls stand clear of the road; the roof and the dome sit on them
  for (const f of fOf('nahall')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      G = group(o.x, o.z, head(mid)),
      HW = W / 2 + 18, // the outer walls
      CH = 18, // the ceiling
      marble = lam('#f1eee6'),
      cream = lam('#f6f2e8'),
      gold = new THREE.MeshStandardMaterial({ color: '#d8ae4a', metalness: 0.7, roughness: 0.3 }),
      lightM = glow(lam('#fffbe8'), null, '#fff2c8', 1.6),
      carpet = lam('#1f7a4a');
    const box = (w, hh, d, x, y, z, m) =>
      G.add(mesh(new THREE.BoxGeometry(w, hh, d).translate(0, hh / 2, 0), m, x, y, z));
    // the floors either side of the road: marble, a green carpet runner along each
    for (const sd of [-1, 1]) {
      box(HW - W / 2 - 0.5, 0.14, L, sd * (W / 2 + 0.5 + (HW - W / 2 - 0.5) / 2), 0, 0, marble);
      box(3, 0.16, L, sd * (W / 2 + 6), 0, 0, carpet);
    }
    // the outer walls, the roof over all of it, the strip lights down the ceiling
    for (const sd of [-1, 1]) box(1.5, CH, L, sd * HW, 0, 0, cream);
    box(2 * HW + 1.5, 1.6, L, 0, CH, 0, lam('#f6f2e8', { emissive: '#8a857a' })); // (the ceiling: lit, not lost in shadow)
    for (const x of [-W / 4, W / 4]) box(1.2, 0.2, L - 6, x, CH - 0.25, 0, lightM);
    // the colonnades down each side of the road, holding the ceiling up
    for (let z = -L / 2 + 5; z < L / 2 - 2; z += 10)
      for (const sd of [-1, 1]) {
        G.add(mesh(cy(0.9, 1, CH, 16), marble, sd * (W / 2 + 2.5), 0, z));
        G.add(mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6), gold, sd * (W / 2 + 2.5), CH - 0.4, z));
      }
    // the coat of arms on the walls, gold on green, every 40 m
    for (let z = -L / 2 + 20; z < L / 2; z += 40)
      for (const sd of [-1, 1]) {
        const p = mesh(new THREE.PlaneGeometry(7, 7), lam('#ffffff', { map: crestTex() }), sd * (HW - 0.8), 7, z);
        p.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
        G.add(p);
      }
    // the fronts at each end: a colonnade of tall white columns either side of the opening, a deep white entablature
    // over the whole width (on the walls), NATIONAL ASSEMBLY across it
    for (const zf of [-L / 2, L / 2]) {
      for (let x = W / 2 + 3; x < HW; x += 4)
        for (const sd of [-1, 1]) G.add(mesh(cy(0.9, 1, CH, 16), marble, sd * x, 0, zf));
      box(2 * HW + 4, 4.5, 3, 0, CH - 1, zf, cream);
      const sign = mesh(
        new THREE.PlaneGeometry(30, 3),
        board('NATIONAL ASSEMBLY', 30, 3, '#1f6b3f', '#f6f2e8', { italic: false }),
        0,
        CH + 1.25,
        zf + Math.sign(zf) * 1.55,
      );
      if (zf < 0) sign.rotation.y = Math.PI;
      G.add(sign);
    }
    // the green dome on its drum over the middle of the hall
    G.add(mesh(cy(19, 19, 7, 40), cream, 0, CH + 1.6, 0));
    G.add(
      mesh(new THREE.SphereGeometry(19.5, 40, 18, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1), domeGreen, 0, CH + 8.6, 0),
    );
    G.add(mesh(cy(1, 1.6, 6, 10), white, 0, CH + 8.6 + 16.5, 0));
    for (let s = f.s - 10; s < f.s + L + 10; s += 8) reserve(tr.point(s, 0).x, tr.point(s, 0).z, HW + 4);
    place('NATIONAL ASSEMBLY', 'Through the hall under the dome', tr.point(f.s + 30, 0), f.s + 30, {
      back: 26,
      h: 3,
      lookH: 4,
    });
  }
  function crestTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = flagGreen;
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#e0b04a';
    x.beginPath();
    x.arc(128, 128, 96, 0, TAU);
    x.fill();
    x.fillStyle = '#1b1b1b';
    x.fillRect(96, 70, 64, 90); // the shield
    x.strokeStyle = '#ffffff';
    x.lineWidth = 10;
    x.beginPath();
    x.moveTo(104, 78);
    x.lineTo(128, 112);
    x.lineTo(152, 78);
    x.moveTo(128, 112);
    x.lineTo(128, 152);
    x.stroke(); // the Y of the rivers
    x.fillStyle = '#c4122f';
    x.beginPath();
    x.arc(128, 54, 12, 0, TAU);
    x.fill();
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }
  // the State House grounds: you burst out of the Assembly onto the drive. Flags both sides, lawns and hedges, the
  // fountain, and the Villa itself beside the drive (white, a green roof, the portico and its dome), Aso Rock behind
  for (const f of fOf('statehouse')) {
    for (let s = f.s + 6; s < f.s + f.len; s += 14)
      for (const sd of [-1, 1]) {
        const fr = frame(s, sd, W / 2 + 5);
        fr.put(cy(0.12, 0.15, 11, 6), steelM);
        fr.put(bx(0.08, 2, 3.4).translate(0, 8.8, 1.8), lam(Math.round((s - f.s) / 14) % 2 ? flagGreen : '#ffffff'));
        const h2 = frame(s + 7, sd, W / 2 + 8);
        if (free(h2.x, h2.z, 2, W / 2 + 6)) h2.put(bx(1.6, 1.2, 9), lam('#2f6b2f')); // the clipped hedge
      }
    for (const sd of [-1, 1])
      for (let s = f.s; s < f.s + f.len; s += 10) {
        const p = P(s, sd * (W / 2 + 30));
        if (openGround(p.x, p.z, 10))
          add(new THREE.CylinderGeometry(18, 18, 0.12, 12).translate(0, 0.06, 0), lawnM, p.x, 0, p.z, 0, 1, false);
      }
    // the fountain on its lawn
    const ff = [40, 55].map(o => frame(f.s + f.len * 0.3, 1, W / 2 + o)).find(q => free(q.x, q.z, 14, W / 2 + 10));
    if (ff) {
      reserve(ff.x, ff.z, 15);
      ff.put(new THREE.CylinderGeometry(12, 12.5, 1, 40, 1, true).translate(0, 0.5, 0), white);
      ff.put(new THREE.CylinderGeometry(12, 12, 0.2, 40).translate(0, 0.7, 0), waterM);
      ff.put(cy(2.2, 3, 3, 20).translate(0, 0.8, 0), white);
      ff.put(cy(4.5, 4.5, 0.6, 24).translate(0, 3.8, 0), white);
      const G = group(ff.x, ff.z, ff.a),
        spray = mesh(
          new THREE.ConeGeometry(1.2, 1, 12).translate(0, 0.5, 0),
          new THREE.MeshLambertMaterial({ color: '#eaf8ff', transparent: true, opacity: 0.7 }),
          0,
          4.4,
          0,
        );
      G.add(spray);
      animated.push(tt => (spray.scale.y = 5 + 1.5 * Math.sin(tt * 1.7)));
    }
    // the Villa
    const vf = [70, 90, 115]
      .map(o => frame(f.s + f.len * 0.6, -1, W / 2 + o))
      .find(q => free(q.x, q.z, 44, W / 2 + 20));
    if (vf) {
      reserve(vf.x, vf.z, 48);
      const put = vf.put,
        roofG = lam('#2f7d4f');
      put(bx(96, 1.4, 56), paving, 0, 0, 0, 0, true);
      put(bx(84, 14, 40), white, 0, 1.4, 0, 0, true);
      put(
        new THREE.CylinderGeometry(0.1, 1, 1, 4)
          .rotateY(Math.PI / 4)
          .scale(64, 8, 30)
          .translate(0, 19.4, 0),
        roofG,
      );
      // the portico facing the drive: columns, a pediment, the dome over it
      for (let z = -14; z <= 14; z += 4) put(cy(0.8, 0.9, 14, 12).translate(vf.rx * 24, 1.4, z), white);
      put(bx(8, 2.4, 34).translate(vf.rx * 24, 15.4, 0), white);
      put(cy(9, 9, 5, 28).translate(vf.rx * 12, 15.4, 0), white);
      put(new THREE.SphereGeometry(9.5, 28, 14, 0, TAU, 0, Math.PI / 2).translate(vf.rx * 12, 20.4, 0), roofG);
      put(cy(0.15, 0.2, 9, 6).translate(vf.rx * 12, 29.5, 0), steelM);
      put(bx(0.1, 2, 3.4).translate(vf.rx * 12, 36, 1.8), lam(flagGreen));
      place('THE STATE HOUSE', 'Out into the Villa grounds', { x: vf.x, z: vf.z }, f.s + f.len * 0.6, {
        back: 60,
        h: 4,
        lookH: 14,
      });
    }
  }

  /* ---------- Wonderland: the Ferris wheel and the roller coaster over the road ---------- */
  for (const f of fOf('wonderland')) {
    const sm = f.s + f.len / 2,
      i = tr.idx(sm),
      c = tr.P[i],
      a = head(sm),
      dx = Math.cos(a),
      dz = -Math.sin(a),
      tx = Math.sin(a),
      tz = Math.cos(a);
    const toW = (lx, lz) => ({ x: c.x + dx * lx + tx * lz, z: c.z + dz * lx + tz * lz });
    // the coaster's track: a closed ride that crosses high over the road twice, its hills out either side (local x across
    // the road, z along it; it's only built if every support stands on open ground and no other road is near)
    const path = [
      [38, 4, -100],
      [38, 15, -72],
      [20, 19, -52],
      [-20, 19, -52],
      [-38, 13, -30],
      [-40, 5, 0],
      [-38, 24, 30],
      [-20, 19, 52],
      [20, 19, 52],
      [38, 12, 74],
      [40, 3, 100],
      [48, 7, 62],
      [52, 28, 0],
      [48, 7, -62],
    ];
    let ok = true;
    for (const [lx, , lz] of path) {
      const q = toW(lx, lz);
      if (Math.abs(lx) > W / 2 + 3 && (!k.land(q.x, q.z) || k.roadGap(q.x, q.z) < Math.abs(lx) - 6)) ok = false;
    }
    if (ok) {
      const G = group(c.x, c.z, a);
      G.position.set(c.x, c.y, c.z);
      const curve = new THREE.CatmullRomCurve3(
        path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        true,
        'centripetal',
      );
      const railM = lam('#e8302a'),
        legM = lam('#f2f2f0');
      G.add(mesh(new THREE.TubeGeometry(curve, 400, 0.55, 8, true), railM));
      // supports: a white leg down to the ground wherever the track isn't over the road
      for (let u = 0; u < 1; u += 1 / 90) {
        const p = curve.getPointAt(u);
        if (Math.abs(p.x) < W / 2 + 3 || p.y < 1.5) continue;
        G.add(mesh(cy(0.3, 0.38, p.y - 0.5, 6), legM, p.x, 0, p.z));
        const q = toW(p.x, p.z);
        reserve(q.x, q.z, 2);
      }
      // the train: four cars running round
      const carM = lam('#1d4fd1'),
        cars = [];
      for (let n = 0; n < 4; n++) {
        const m = mesh(new THREE.BoxGeometry(1.8, 1.2, 2.8).translate(0, 1, 0), carM);
        G.add(m);
        cars.push(m);
      }
      const v = new THREE.Vector3();
      animated.push(tt => {
        cars.forEach((m, n) => {
          const u = (tt * 0.045 + n * 0.006) % 1;
          m.position.copy(curve.getPointAt(u));
          m.lookAt(
            v
              .copy(curve.getPointAt((u + 0.002) % 1))
              .add(G.position)
              .sub(G.position),
          );
        });
      });
      place('WONDERLAND', 'Under the roller coaster', { x: c.x, y: 18, z: c.z }, sm - 80, {
        back: 40,
        h: 3,
        lookH: 16,
      });
    }
    // the Ferris wheel, turning, past the coaster
    const wf = [60, 80].map(o => frame(sm + 150, 1, W / 2 + o)).find(q => free(q.x, q.z, 34, W / 2 + 20));
    if (wf) {
      reserve(wf.x, wf.z, 36);
      const G = group(wf.x, wf.z, wf.a + Math.PI / 2),
        R = 28,
        wheel = new THREE.Group();
      for (const sd of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.6, 0.9, R + 6, 8);
        G.add(
          mesh(
            leg
              .clone()
              .translate(0, (R + 6) / 2, 0)
              .rotateZ(0.32),
            steelM,
            -6,
            0,
            sd * 2.5,
          ),
        );
        G.add(
          mesh(
            leg
              .clone()
              .translate(0, (R + 6) / 2, 0)
              .rotateZ(-0.32),
            steelM,
            6,
            0,
            sd * 2.5,
          ),
        );
      }
      wheel.position.set(0, R + 4, 0);
      const ringM = glow(lam('#f4f4f2'), null, '#ffd24a', 1.6);
      for (const zz of [-2, 2]) wheel.add(mesh(new THREE.TorusGeometry(R, 0.45, 6, 64), ringM, 0, 0, zz));
      for (let n = 0; n < 16; n++) {
        const t = (n / 16) * TAU,
          sp = mesh(new THREE.BoxGeometry(0.3, R, 0.3).translate(0, R / 2, 0), steelM);
        sp.rotation.z = t;
        wheel.add(sp);
        const g = mesh(
          new THREE.BoxGeometry(2.4, 2.4, 2.4),
          lam(['#e8302a', '#1d4fd1', '#f2c230', '#1f8a4c'][n % 4]),
          Math.sin(t) * R,
          -Math.cos(t) * R - 1.6,
          0,
        );
        wheel.add(g);
      }
      G.add(wheel);
      const gondolas = wheel.children.filter(
        m => m.geometry.type === 'BoxGeometry' && m.geometry.parameters.width === 2.4,
      );
      animated.push(tt => {
        wheel.rotation.z = tt * 0.12;
        for (const g of gondolas) g.rotation.z = -wheel.rotation.z; // (the cars hang level)
      });
      place('THE FERRIS WHEEL', 'Wonderland turning beside the road', { x: wf.x, y: 20, z: wf.z }, sm + 150, {
        back: 60,
        h: 4,
        lookH: 22,
      });
    }
  }

  /* ---------- Gurara Falls: a cave in the cliff, waterfalls pouring down both its walls beside the road ---------- */
  // The road never meets rock or water head on: it runs into an arched opening in the cliff face, through a vaulted
  // granite cavern whose walls stand back past a channel of water on each side, and out of an arched opening at the far
  // end. The water falls down the walls beside you, side by side, into the channels; the great falls itself pours down
  // the cliff face beside the way in, into a pool off the road's edge.
  for (const f of fOf('gurara')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      G = group(o.x, o.z, head(mid)),
      HW = W / 2 + 9, // the cavern's walls, a channel's width out past each edge of the road
      WALLH = 10, // the walls stand straight this high, where the water pours out
      RISE = 9,
      CR = WALLH + RISE, // the vault's crown
      Z0 = -L / 2,
      Z1 = L / 2,
      X = HW + 24, // the cliff face's half width
      TOP = CR + 16;
    G.position.set(o.x, o.y, o.z);
    const caveM = lam('#9a9083', { flatShading: true, emissive: '#4a443b', side: THREE.DoubleSide }),
      cliffT = tile(
        (cx, w, hh) => {
          cx.fillStyle = '#a89f90';
          cx.fillRect(0, 0, w, hh);
          for (let n = 0; n < 60; n++) {
            cx.fillStyle = `rgba(${50 + rand() * 40},${44 + rand() * 30},36,${0.2 + rand() * 0.35})`;
            cx.fillRect(rand() * w, rand() * hh * 0.5, 2 + rand() * 8, hh * (0.3 + rand() * 0.7));
          }
          for (let n = 0; n < 14; n++) {
            cx.fillStyle = 'rgba(40,36,30,0.35)';
            cx.fillRect(0, rand() * hh, w, 1 + rand() * 2);
          }
        },
        256,
        256,
      ),
      cliffM = lam('#ffffff', { map: cliffT, emissive: '#2a2620', side: THREE.DoubleSide });
    cliffT.repeat.set(1 / 30, 1 / 30);
    // the bore's outline across the road: up a wall, over the vault, down the other wall
    const prof = [[HW, -1]];
    for (let i = 0; i <= 12; i++) {
      const th = (Math.PI * i) / 12;
      prof.push([Math.cos(th) * HW, WALLH + Math.sin(th) * RISE]);
    }
    prof.push([-HW, -1]);
    // the cavern: that outline swept along, the rock bulging out (never in) away from the openings
    {
      const pos = [],
        idx = [],
        n = prof.length;
      let rows = 0;
      for (let z = Z0; z <= Z1 + 1e-6; z += 4, rows++) {
        const ease = Math.min(1, Math.min(z - Z0, Z1 - z) / 12);
        prof.forEach(([x, y], i) => {
          const cx = 0,
            cy = i === 0 || i === n - 1 ? y : WALLH * 0.6,
            dx = x - cx,
            dy = y - cy,
            d = Math.hypot(dx, dy) || 1,
            bump = ease * (1.2 + Math.sin(z * 0.21 + i * 1.7) * 1.1 + Math.sin(z * 0.07 + i * 0.6) * 1.4);
          pos.push(
            x + (dx / d) * Math.max(0, bump),
            y + (i === 0 || i === n - 1 ? 0 : (dy / d) * Math.max(0, bump)),
            z,
          );
        });
      }
      for (let r = 0; r < rows - 1; r++)
        for (let i = 0; i < n - 1; i++) {
          const a0 = r * n + i,
            b0 = a0 + n;
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      const gn = g.toNonIndexed();
      gn.computeVertexNormals();
      G.add(mesh(gn, caveM));
    }
    // the cliff face at each end: a sheer granite face, the arched opening cut through it
    for (const z of [Z0, Z1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-X, -1);
      sh.lineTo(-HW, -1);
      for (let i = 12; i >= 0; i--) {
        const th = (Math.PI * i) / 12;
        sh.lineTo(Math.cos(th) * HW, WALLH + Math.sin(th) * RISE);
      }
      sh.lineTo(HW, -1);
      sh.lineTo(X, -1);
      sh.lineTo(X, TOP * 0.8);
      sh.lineTo(X * 0.5, TOP);
      sh.lineTo(-X * 0.4, TOP * 1.05);
      sh.lineTo(-X, TOP * 0.75);
      sh.closePath();
      G.add(mesh(new THREE.ShapeGeometry(sh), cliffM, 0, 0, z));
      // the arch picked out in rough stone, and boulders heaped either side of the opening and along the top (all clear
      // of the opening itself)
      for (const sd of [-1, 1]) {
        G.add(mesh(rockGeo(7, 12, z + sd, 1), granite, sd * (HW + 11), -1, z + Math.sign(z) * -4));
        G.add(mesh(rockGeo(9, 18, z + sd * 3, 1), granite, sd * (HW + 26), -1, z + Math.sign(z) * -5));
      }
      for (let x = -X + 8; x <= X - 8; x += 14)
        G.add(mesh(rockGeo(rr(7, 10), rr(8, 14), x + z, 1), granite, x, TOP * 0.72, z + Math.sign(z) * -8));
    }
    // the hill over the cavern, wholly between the two faces (from inside the cave you only ever see the cavern's rock)
    // its outline runs along the tops of the two cliff faces, so the faces close its ends
    {
      const out = [
          [X, -1],
          [X, TOP * 0.8],
          [X * 0.5, TOP],
          [-X * 0.4, TOP * 1.05],
          [-X, TOP * 0.75],
          [-X, -1],
        ],
        pos = [],
        idx = [],
        n = out.length;
      let rows = 0;
      for (let z = Z0; z <= Z1 + 1e-6; z += 10, rows++) {
        const ease = Math.min(1, Math.min(z - Z0, Z1 - z) / 20);
        out.forEach(([x, y], i) =>
          pos.push(x, y + (i === 0 || i === n - 1 ? 0 : ease * (6 + 5 * Math.sin(z * 0.05 + i))), z),
        );
      }
      for (let r = 0; r < rows - 1; r++)
        for (let i = 0; i < n - 1; i++) {
          const a0 = r * n + i,
            b0 = a0 + n;
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      const gn = g.toNonIndexed();
      gn.computeVertexNormals();
      G.add(mesh(gn, lam('#8f9a62', { flatShading: true, side: THREE.DoubleSide })));
    }
    // inside: the channels either side of the road, glowing blue, a stone lip between them and the tarmac
    const chanM = glow(
      new THREE.MeshLambertMaterial({ color: '#2f9ccf', transparent: true, opacity: 0.9 }),
      null,
      '#3fc4ff',
      1.2,
    );
    for (const sd of [-1, 1]) {
      const cw = HW - W / 2 - 1;
      G.add(mesh(new THREE.BoxGeometry(cw, 0.2, L), chanM, sd * (W / 2 + 1 + cw / 2), 0.05, 0));
      G.add(mesh(new THREE.BoxGeometry(0.8, 0.6, L), concrete, sd * (W / 2 + 0.6), 0.3, 0));
      G.add(
        mesh(new THREE.BoxGeometry(0.3, 0.2, L), glow(lam('#1d6f9a'), null, '#3fd0ff', 2), sd * (W / 2 + 1.1), 0.62, 0),
      );
    }
    // the waterfalls: sheets pouring down both walls from ledges where the vault springs, one after another along the
    // cavern, into the channels; mist rising off each
    const fallT = tile(
      (x, w, hh) => {
        x.fillStyle = '#a8dcec';
        x.fillRect(0, 0, w, hh);
        for (let n = 0; n < 90; n++) {
          x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`;
          x.fillRect(Math.random() * w, Math.random() * hh, 1 + Math.random() * 3, 10 + Math.random() * 40);
        }
      },
      128,
      128,
    );
    fallT.repeat.set(2, 1.5);
    const fallM = glow(
      new THREE.MeshLambertMaterial({
        map: fallT,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      null,
      '#7fd4ff',
      0.8,
    );
    fallM.emissive.set('#3a8fc0');
    animated.push(tt => (fallT.offset.y = tt * 1.6));
    const sprayM = new THREE.MeshLambertMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      puffs = [];
    const FW = 22;
    for (let z = Z0 + 26; z <= Z1 - 26 + 1e-6; z += (L - 52) / Math.max(1, Math.round((L - 52) / 36)))
      for (const sd of [-1, 1]) {
        const zz = z + sd * 6,
          x = sd * (HW - 1.2);
        const sheet = mesh(new THREE.PlaneGeometry(FW, WALLH + 0.5), fallM, x, (WALLH + 0.5) / 2, zz);
        sheet.rotation.y = Math.PI / 2;
        G.add(sheet);
        // the ledge it pours from
        G.add(mesh(new THREE.BoxGeometry(2.6, 1.2, FW + 2), granite, sd * (HW - 0.4), WALLH + 0.6, zz));
        for (let n = 0; n < 3; n++) {
          const p = mesh(
            new THREE.SphereGeometry(rr(1.6, 2.6), 8, 6),
            sprayM,
            sd * (HW - 3),
            1,
            zz + rr(-FW / 2, FW / 2),
          );
          G.add(p);
          puffs.push({ p, ph: rand() * 10 });
        }
      }
    animated.push(tt => puffs.forEach(q => (q.p.position.y = 0.5 + ((tt * 1.1 + q.ph) % 5))));
    // light falling through cracks in the vault onto the road
    const shaftM = new THREE.MeshBasicMaterial({
      color: '#fff6d8',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    for (const z of [Z0 + L * 0.3, Z0 + L * 0.7])
      G.add(mesh(new THREE.CylinderGeometry(1.5, 4.5, CR - 0.5, 12, 1, true), shaftM, rr(-3, 3), (CR - 0.5) / 2, z));
    // outside: the great falls down the cliff face beside the way in, into a pool off the road's edge (on the side away
    // from the road), a rainbow in its spray
    {
      const z = Z0 - 0.6,
        x0 = HW + 6,
        x1 = X - 4,
        fw = x1 - x0,
        bigT = fallT.clone();
      bigT.repeat.set(3, 2);
      bigT.needsUpdate = true;
      animated.push(tt => (bigT.offset.y = tt * 1.4));
      const big = mesh(
        new THREE.PlaneGeometry(fw, TOP * 0.75),
        glow(
          new THREE.MeshLambertMaterial({
            map: bigT,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
          null,
          '#7fd4ff',
          0.5,
        ),
        -(x0 + fw / 2),
        (TOP * 0.75) / 2 - 1,
        z,
      );
      G.add(big);
      G.add(mesh(new THREE.BoxGeometry(fw + 8, 0.3, 30), waterM, -(x0 + fw / 2), 0.1, z - 15));
      const bow = new THREE.Group();
      ['#ff4a4a', '#ff9a2a', '#ffe23a', '#4ad65a', '#3a8aff', '#8a4aff'].forEach((col, n) =>
        bow.add(
          mesh(
            new THREE.TorusGeometry(14 - n * 0.6, 0.35, 4, 40, Math.PI),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false }),
          ),
        ),
      );
      bow.position.set(-(x0 + fw / 2), 0, z - 14);
      G.add(bow);
    }
    for (let s = f.s - 40; s < f.s + L + 40; s += 8) {
      const p = tr.point(s, 0);
      reserve(p.x, p.z, X + 10);
    }
    roadSign(f.s - 60, 1, 'GURARA FALLS', 12);
    place('GURARA FALLS', 'Into the cave of falling water', tr.point(f.s, 0), f.s, { back: 70, h: 6, lookH: 14 });
    place('INSIDE GURARA', 'Waterfalls either side of you', tr.point(mid, 0), mid, { back: 30, h: 3, lookH: 4 });
  }

  /* ---------- Nnamdi Azikiwe Airport: the runway, a jet taking off over you, the terminal's canopy ---------- */
  for (const f of fOf('runway')) {
    const sd = -1,
      OFF = W / 2 + 46,
      RW = 45;
    // the runway alongside: a broad strip of tarmac, white centre dashes, the threshold bars, edge lights
    const runT = tile(
      (x, w, hh) => {
        x.fillStyle = '#3a3d42';
        x.fillRect(0, 0, w, hh);
        x.fillStyle = '#f4f4f0';
        x.fillRect(w / 2 - 2, 0, 4, hh * 0.5);
        x.fillRect(4, 0, 3, hh);
        x.fillRect(w - 7, 0, 3, hh);
      },
      128,
      128,
    );
    const runM = lam('#ffffff', { map: runT });
    for (let s = f.s; s < f.s + f.len; s += 10) {
      const fr = frame(s, sd, OFF);
      if (!openGround(fr.x, fr.z, RW / 2)) continue;
      fr.put(new THREE.PlaneGeometry(RW, 10.4).rotateX(-Math.PI / 2).translate(0, 0.07, 0), runM);
      reserve(fr.x, fr.z, RW / 2 + 2);
    }
    // the jet: rolls down the runway, lifts off, and climbs away over the road
    const j = frame(f.s + 20, sd, OFF),
      G = group(j.x, j.z, j.a),
      jet = new THREE.Group(),
      body = lam('#f4f6f8'),
      tail = lam(flagGreen);
    jet.add(mesh(new THREE.CylinderGeometry(1.9, 1.9, 34, 16).rotateX(Math.PI / 2), body));
    jet.add(mesh(new THREE.SphereGeometry(1.9, 16, 10).scale(1, 1, 2), body, 0, 0, 17));
    jet.add(mesh(new THREE.BoxGeometry(34, 0.5, 6).translate(0, -0.6, 1), body));
    jet.add(mesh(new THREE.BoxGeometry(12, 0.4, 3.5).translate(0, 0.6, -15), body));
    jet.add(mesh(new THREE.BoxGeometry(0.5, 7, 5).translate(0, 4, -15), tail));
    for (const x of [-7, 7])
      jet.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 10).rotateX(Math.PI / 2), lam('#c9ced4'), x, -1.6, 3));
    G.add(jet);
    const RUN = Math.min(f.len, 300);
    animated.push(tt => {
      const u = (tt % 18) / 18,
        z = -40 + u * (RUN + 260),
        lift = Math.max(0, z - RUN * 0.55);
      jet.position.set(sd * Math.min(lift * 0.25, OFF) * -1, 2.2 + lift * 0.18, z);
      jet.rotation.x = -Math.min(0.25, lift * 0.002);
    });
    roadSign(f.s - 30, 1, "NNAMDI AZIKIWE INT'L AIRPORT", 18);
    place('THE RUNWAY', 'A jet taking off over you', tr.point(f.s + RUN * 0.6, 0), f.s + RUN * 0.6, {
      back: 50,
      h: 3,
      lookH: 14,
    });
  }
  for (const f of fOf('terminal')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      G = group(o.x, o.z, head(mid)),
      X = W / 2 + 3,
      ROOF = 15;
    G.position.set(o.x, o.y, o.z);
    const roofM = lam('#f2f4f6', { emissive: '#7d8186' }), // (the canopy's underside: lit, not lost in shadow)
      glassM = new THREE.MeshPhongMaterial({ color: '#9fc9e6', transparent: true, opacity: 0.45, shininess: 90 });
    for (let z = -L / 2; z <= L / 2; z += 14)
      for (const sd of [-1, 1]) G.add(mesh(cy(0.6, 0.7, ROOF, 10), steelM, sd * X, 0, z));
    // the canopy: a wide wave of white roof over the road and the kerbside
    const g = new THREE.BoxGeometry(2 * X + 40, 0.8, L + 6, 24, 1, 1),
      p = g.attributes.position;
    for (let n = 0; n < p.count; n++) p.setY(n, p.getY(n) + Math.cos((p.getX(n) / (2 * X + 40)) * Math.PI) * 2.2);
    g.computeVertexNormals();
    G.add(mesh(g, roofM, 0, ROOF + 0.4, 0));
    // the terminal's glass front on one side, the jets at their gates beyond it on the other
    G.add(mesh(new THREE.BoxGeometry(1, ROOF - 1, L).translate(0, (ROOF - 1) / 2, 0), glassM, X + 18, 0, 0));
    G.add(mesh(new THREE.BoxGeometry(30, ROOF + 6, L).translate(0, (ROOF + 6) / 2, 0), lam('#dfe3e8'), X + 34, 0, 0));
    for (let z = -L / 2 + 20; z < L / 2 - 10; z += 45) {
      const pl = new THREE.Group();
      pl.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, 30, 14).rotateX(Math.PI / 2), roofM, 0, 3.4, 0));
      pl.add(mesh(new THREE.BoxGeometry(30, 0.5, 5), roofM, 0, 2.8, 2));
      pl.add(mesh(new THREE.BoxGeometry(0.5, 6, 4.5).translate(0, 3, 0), lam(flagGreen), 0, 4.4, -13));
      for (const x of [-1.2, 1.2]) pl.add(mesh(cy(0.18, 0.18, 2, 6), darkM, x, 0, 6));
      pl.add(mesh(cy(0.18, 0.18, 2, 6), darkM, 0, 0, 12));
      pl.position.set(-(X + 36), 0, z);
      pl.rotation.y = Math.PI / 2;
      G.add(pl);
    }
    const sign = mesh(
      new THREE.PlaneGeometry(26, 2.6),
      board('NNAMDI AZIKIWE INTERNATIONAL AIRPORT', 26, 2.6, '#ffffff', '#123a2a', { italic: false }),
      0,
      ROOF - 2.4,
      -L / 2 - 0.2,
    );
    sign.rotation.y = Math.PI;
    G.add(sign);
    for (const sx of [-10, 10]) G.add(mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), steelM, sx, ROOF - 1.2, -L / 2 - 0.2));
    for (let s = f.s - 10; s < f.s + L + 10; s += 8) {
      const q = tr.point(s, 0);
      reserve(q.x, q.z, W / 2 + 60);
    }
    place('THE TERMINAL', 'Under the airport canopy', tr.point(f.s + 20, 0), f.s + 20, { back: 30, h: 3, lookH: 6 });
  }

  /* ---------- Zuma Rock: the tunnel through the giant, the cavern of falling water inside ---------- */
  for (const f of fOf('tunnel'))
    tunnel(k, f, {
      place,
      look: {
        hill: ['#7f8f52', '#9a9184', '#8a8276', '#a39a8c', '#948a7e'], // (a skirt of scrub, then the bare streaked granite)
        rockFrom: 0.2,
        hillH: 70,
        board: 'ZUMA ROCK TUNNEL',
        exit: 'EXIT',
      },
    });
  for (const f of fOf('zuma').filter(z => z.len)) {
    const mid = f.s + f.len / 2,
      i = tr.idx(mid),
      c = tr.P[i],
      a = head(mid);
    // the giant itself, standing over the tunnel's middle: the streaked dome rising far above the hill the bore runs
    // through (its foot sits round the road, never on it: the bore is under it)
    const faceT = tile(
      (cx, w, hh) => {
        cx.fillStyle = '#9a9184';
        cx.fillRect(0, 0, w, hh);
        for (let n = 0; n < 40; n++) {
          cx.fillStyle = `rgba(${40 + rand() * 30},${36 + rand() * 20},30,${0.25 + rand() * 0.35})`;
          cx.fillRect(rand() * w, 0, 2 + rand() * 6, hh * (0.4 + rand() * 0.6));
        }
      },
      256,
      256,
    );
    faceT.repeat.set(3, 1);
    // it stands beside the bore, never over it: its whole foot (noise and all) clear of every road, the tunnel's hill
    // running in under its flank
    const dx = Math.cos(a),
      dz = -Math.sin(a);
    stand: for (const R of [110, 95, 80, 65])
      for (const sd of [1, -1]) {
        const d = R * 1.36 + W / 2 + 8,
          x = c.x + dx * sd * d,
          z = c.z + dz * sd * d;
        if (k.roadGap(x, z) < R * 1.36 + W / 2 + 6) continue;
        scene.add(mesh(rockGeo(R, 170, 7.7, 4), lam('#ffffff', { map: faceT, flatShading: true }), x, 0, z, a));
        reserve(x, z, R * 1.3);
        break stand;
      }
    // the cavern halfway through: the bore opens out, a sheet of water pours down one wall from a crack in the roof into
    // a channel beside the road, lit blue from below
    const G = group(c.x, c.z, a),
      fallT = tile(
        (x, w, hh) => {
          x.fillStyle = '#9fd6e8';
          x.fillRect(0, 0, w, hh);
          for (let n = 0; n < 80; n++) {
            x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`;
            x.fillRect(Math.random() * w, Math.random() * hh, 1 + Math.random() * 3, 10 + Math.random() * 40);
          }
        },
        128,
        128,
      );
    fallT.repeat.set(4, 2);
    const fallM = glow(
      new THREE.MeshLambertMaterial({ map: fallT, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      null,
      '#5fc4ff',
      0.9,
    );
    fallM.emissive.set('#2a7fb0');
    for (const sd of [-1, 1]) {
      const sheet = mesh(new THREE.PlaneGeometry(40, 12.5), fallM, sd * (W / 2 + 2.1), 6.25, 0);
      sheet.rotation.y = Math.PI / 2;
      G.add(sheet);
      G.add(
        mesh(
          new THREE.BoxGeometry(0.6, 0.3, 40),
          glow(lam('#1d6f9a'), null, '#3fd0ff', 2),
          sd * (W / 2 + 1.6),
          0.15,
          0,
        ),
      );
    }
    animated.push(tt => (fallT.offset.y = tt * 1.6));
    reserve(c.x, c.z, f.len * 0.45);
    place('ZUMA ROCK', 'Into the giant, a waterfall inside', tr.point(f.s + 10, 0), f.s + 10, {
      back: 120,
      h: 8,
      lookH: 60,
    });
    place('INSIDE ZUMA ROCK', 'The cavern of falling water', tr.point(mid - 20, 0), mid - 20, {
      back: 10,
      h: 3,
      lookH: 4,
    });
  }

  /* ---------- the Abuja Knot: the lawns under its tangle of decks ---------- */
  for (const f of fOf('knot')) {
    loopIsland(f.s + 60, 520, 'THE ABUJA KNOT'); // (the first loop's middle)
    place('THE ABUJA KNOT', 'Three loops stacked over each other', tr.point(f.s + 60 + 2600, 36), f.s + 2600, {
      back: 80,
      h: 12,
      lookH: 16,
    });
  }

  /* ---------- the flyover through a tower: the road on its deck runs in one side and out the other ---------- */
  for (const f of fOf('towerthru')) {
    const mid = f.s + f.len / 2,
      o = tr.point(mid, 0),
      y = o.y, // the deck, 14 m up
      G = group(o.x, o.z, head(mid)),
      DW = 2 * (W / 2 + 6), // the building's width across the road
      D = 56, // its depth along it
      TOP = 120,
      SLOT = 10; // the opening's height over the deck
    const glass = glassMat(['#6fd0e8', '#1f5f7a'], '#dfe8ee', 0.55),
      box = (w, hh, d, x, yy, z, mat) => G.add(mesh(boxM(w, hh, d, 16).translate(0, 0, 0), mat, x, yy, z));
    const side = W / 2 + 1.5; // (the walls stand clear of the deck's barriers)
    box(DW / 2 - side + 14, TOP, D, side + (DW / 2 - side + 14) / 2, 0, 0, glass);
    box(DW / 2 - side + 14, TOP, D, -(side + (DW / 2 - side + 14) / 2), 0, 0, glass);
    box(2 * side, y - 3, D, 0, 0, 0, glass); // under the deck: the lower floors
    box(2 * side, TOP - (y + SLOT), D, 0, y + SLOT, 0, glass); // over the opening: the floors above
    // the opening lit round its edge, the tower's crown, LED edges
    const rimM = glow(lam('#203a44'), null, '#5fe8ff', 2.4);
    for (const zf of [-D / 2 - 0.2, D / 2 + 0.2]) {
      G.add(mesh(new THREE.BoxGeometry(2 * side, 0.5, 0.4), rimM, 0, y + SLOT, zf));
      for (const sd of [-1, 1])
        G.add(mesh(new THREE.BoxGeometry(0.4, SLOT, 0.4).translate(0, SLOT / 2, 0), rimM, sd * side, y, zf));
    }
    G.add(mesh(new THREE.BoxGeometry(DW + 30, 3, D + 2), concrete, 0, TOP, 0));
    for (const [x, z] of [
      [DW / 2 + 14, D / 2],
      [-DW / 2 - 14, D / 2],
      [DW / 2 + 14, -D / 2],
      [-DW / 2 - 14, -D / 2],
    ])
      G.add(mesh(new THREE.BoxGeometry(0.4, TOP, 0.4).translate(0, TOP / 2, 0), ledGreen, x, 0, z));
    const sign = mesh(
      new THREE.PlaneGeometry(24, 3),
      board('ABUJA TECH TOWER', 24, 3, '#ffffff', '#0f2a36', { italic: false }),
      0,
      y + SLOT + 4,
      -D / 2 - 0.3,
    );
    sign.rotation.y = Math.PI;
    G.add(sign);
    reserve(o.x, o.z, DW / 2 + 30);
    place('THROUGH THE TOWER', 'Fourteen metres up, in one side and out the other', tr.point(f.s + 60, 10), f.s + 60, {
      back: 40,
      h: 3,
      lookH: 4,
    });
  }

  /* ---------- the ledge on Aso Rock: the cliff rising beside the road, the rock carrying it ---------- */
  for (const f of fOf('asoledge')) {
    const sd = 1;
    for (let s = f.s; s < f.s + f.len; s += 7) {
      const i = tr.idx(s),
        y = tr.P[i].y;
      // the cliff on the inside, towering over the road
      const p = P(s, sd * (W / 2 + rr(10, 16)));
      add(rockGeo(rr(8, 12), y + rr(26, 40), rand() * 9, 1), granite, p.x, 0, p.z, rand() * TAU, 1, false);
      // the rock the ledge is cut from, under the road and falling away on the outside
      if (y > 3) {
        const q = P(s, -sd * (W / 2 + rr(4, 9)));
        add(rockGeo(rr(7, 10), y - 1.5, rand() * 9, 1), granite, q.x, 0, q.z, rand() * TAU, 1, false);
      }
    }
    roadSign(f.s - 20, -1, 'ASO ROCK', 10);
    place('ASO ROCK LEDGE', 'Up the cliff, the city below', tr.point(f.s + f.len / 2, 18), f.s + f.len / 2, {
      back: 50,
      h: 4,
      lookH: 6,
    });
  }

  /* ---------- Centenary City: curved glass towers, the monorail, lit bridges over the road ---------- */
  for (const f of fOf('centenary')) {
    const twist = (w, hh, turn, seg = 24) => {
      const g = new THREE.BoxGeometry(w, hh, w, 1, seg, 1).translate(0, hh / 2, 0),
        p = g.attributes.position,
        v = new THREE.Vector3();
      for (let n = 0; n < p.count; n++) {
        v.fromBufferAttribute(p, n);
        const a2 = (v.y / hh) * turn,
          sc = 1 - 0.18 * Math.sin((v.y / hh) * Math.PI);
        p.setXYZ(
          n,
          (v.x * Math.cos(a2) - v.z * Math.sin(a2)) * sc,
          v.y,
          (v.x * Math.sin(a2) + v.z * Math.cos(a2)) * sc,
        );
      }
      g.computeVertexNormals();
      const uv = g.attributes.uv;
      for (let n = 0; n < uv.count; n++) uv.setXY(n, uv.getX(n) * (w / 16), uv.getY(n) * (hh / 16));
      return g;
    };
    const futures = [
      glassMat(['#9fe8ff', '#2a6f9a'], '#eef4f8', 0.6),
      glassMat(['#c0f2dc', '#2a7a62'], '#f2f6f4', 0.6),
      glassMat(['#f2e0b8', '#8a6a3a'], '#f4f0e8', 0.6),
    ];
    let made = 0;
    for (let n = 0; n < 60 && made < 14; n++) {
      const s = f.s + rand() * f.len,
        sd = rand() < 0.5 ? 1 : -1,
        p = P(s, sd * (W / 2 + rr(50, 140)));
      if (!free(p.x, p.z, 16, W / 2 + 40)) continue;
      reserve(p.x, p.z, 18);
      const hh = rr(70, 150),
        w = rr(16, 24);
      add(twist(w, hh, rr(0.6, 1.6) * (rand() < 0.5 ? 1 : -1)), pick(futures), p.x, 0, p.z, rand() * TAU, 1, false);
      add(new THREE.CylinderGeometry(w * 0.5, w * 0.6, 3, 16).translate(0, hh, 0), ledWhite, p.x, 0, p.z, 0, 1, false);
      made++;
    }
    // the monorail: a beam on T-piers alongside the road, then curving across over it, a train on it
    const mono = [];
    for (let s = f.s; s < f.s + f.len; s += 4)
      mono.push(
        P(
          s,
          (s - f.s < f.len * 0.55 ? 1 : -1) *
            (W / 2 + 26) *
            Math.cos(Math.min(1, Math.max(0, (s - f.s - f.len * 0.45) / (f.len * 0.2))) * Math.PI),
        ),
      );
    const pts = mono.map(q => new THREE.Vector3(q.x, 13, q.z)),
      curve = new THREE.CatmullRomCurve3(pts);
    scene.add(mesh(new THREE.TubeGeometry(curve, pts.length, 1.1, 6), glow(lam('#e9eef2'), null, '#9fe8ff', 0.6)));
    for (let n = 0; n < pts.length; n += 7) {
      const q = pts[n];
      if (k.roadGap(q.x, q.z) < W / 2 + 2) continue; // (no pier on the road: the beam spans it)
      add(cy(0.9, 1.2, 12, 10), concrete, q.x, 0, q.z, 0, 1, false);
      reserve(q.x, q.z, 3);
    }
    const train = new THREE.Group(),
      trainM = glow(lam('#f4f6f8'), null, '#bff4ff', 0.5);
    for (let n = 0; n < 3; n++) train.add(mesh(new THREE.BoxGeometry(3, 3.2, 12).translate(0, 0, n * -12.6), trainM));
    scene.add(train);
    const v = new THREE.Vector3();
    animated.push(tt => {
      const u = (Math.sin(tt * 0.12) * 0.5 + 0.5) * 0.98;
      train.position.copy(curve.getPointAt(u)).setY(15.4);
      train.lookAt(v.copy(curve.getPointAt(Math.min(1, u + 0.01))).setY(15.4));
    });
    // the lit footbridges over the road: a deck on two legs, an arc of light over it
    for (let s = f.s + 60; s < f.s + f.len - 40; s += 150) {
      const fr = frame(s, 1, 0),
        put = fr.put,
        X = W / 2 + 5;
      for (const x of [-X, X]) put(bx(1.4, 8, 1.4).translate(x, 0, 0), white);
      put(new THREE.BoxGeometry(2 * X + 2, 0.8, 4).translate(0, 8.4, 0), white);
      put(new THREE.TorusGeometry(X, 0.3, 6, 32, Math.PI).translate(0, 8.8, 0), ledGreen);
    }
    roadSign(f.s - 20, -1, 'CENTENARY CITY', 12);
    place('CENTENARY CITY', 'The new city of glass', tr.point(f.s + f.len * 0.5, 0), f.s + f.len * 0.5, {
      back: 60,
      h: 4,
      lookH: 40,
    });
  }

  /* ---------- The Gateway ---------- */
  // the City Gate: a great white arch over the road on two legs, a green band on its crown, the welcome on a board
  for (const f of fOf('citygate')) {
    const i = tr.idx(f.s),
      c = tr.P[i],
      X = W / 2 + 6, // (the legs: clear of the road and its kerbs)
      LEG = 20,
      G = group(c.x, c.y, c.z);
    G.position.set(c.x, 0, c.z);
    G.rotation.y = head(f.s);
    const gateM = lam('#f6f4ee'),
      bandM = lam(flagGreen);
    for (const sd of [1, -1]) {
      G.add(mesh(new THREE.BoxGeometry(4.5, LEG, 6).translate(0, LEG / 2, 0), gateM, sd * X, 0, 0));
      G.add(mesh(new THREE.BoxGeometry(6, 1.6, 7.5), lam('#d9d4c8'), sd * X, 0.8, 0)); // the footing
    }
    // the arch: half a ring from leg top to leg top, square in section
    const arch = new THREE.TorusGeometry(X, 2.4, 6, 40, Math.PI);
    G.add(mesh(arch, gateM, 0, LEG, 0));
    G.add(mesh(new THREE.TorusGeometry(X, 2.5, 6, 40, Math.PI * 0.3).rotateZ(Math.PI * 0.35), bandM, 0, LEG, 0));
    // the board hangs under the crown from two hangers
    const bw = 22,
      by = LEG + X - 8;
    for (const sd of [-1, 1]) G.add(mesh(new THREE.BoxGeometry(0.25, 6, 0.25), steelM, sd * 8, by + 1.8, 0));
    signBoth(
      G,
      board('WELCOME TO ABUJA', bw, 3.2, '#ffffff', flagGreen, { italic: false, border: '#f2cf63' }),
      bw,
      3.2,
      0,
      by - 3.2,
      0,
      0,
      0.4,
    );
    place('THE CITY GATE', 'Under the arch into the capital', { x: c.x, y: 10, z: c.z }, f.s, {
      back: 70,
      h: 4,
      lookH: 18,
    });
  }
  // the National Stadium: the bowl, the white roof ring on its masts, the floodlights
  for (const f of fOf('stadium')) {
    for (const off of [120, 140, 170]) {
      const fr = frame(f.s + 60, 1, W / 2 + off);
      if (!free(fr.x, fr.z, 96, W / 2 + 12)) continue;
      reserve(fr.x, fr.z, 100);
      const put = fr.put,
        R = 82;
      const wallT = tile((x, w, hh) => {
        x.fillStyle = '#e9e6de';
        x.fillRect(0, 0, w, hh);
        x.fillStyle = flagGreen;
        x.fillRect(0, hh * 0.78, w, hh * 0.1);
        x.fillStyle = '#9fa8b0';
        for (let n = 0; n < 8; n++) x.fillRect(n * 16 + 3, hh * 0.2, 10, hh * 0.45);
      });
      const wallG = new THREE.CylinderGeometry(R, R, 26, 64, 1, true);
      {
        const uv = wallG.attributes.uv;
        for (let n = 0; n < uv.count; n++) uv.setX(n, uv.getX(n) * 30);
      }
      put(wallG.translate(0, 13, 0), lam('#ffffff', { map: wallT, side: THREE.DoubleSide })); // (free() cleared its ground: the road test samples its whole square)
      // the stands: one sweep of seating all the way round, green seats and a crowd, an aisle every few metres
      const seatsT = standTex({ seat: '#1f8a4c', seat2: '#f2f2f2', rows: 26 });
      seatsT.repeat.set(40, 1);
      put(
        new THREE.CylinderGeometry(R - 2, R - 40, 22, 64, 1, true).translate(0, 12, 0),
        lam('#ffffff', { map: seatsT, side: THREE.DoubleSide }),
      );
      put(new THREE.CylinderGeometry(R - 40, R - 40, 0.4, 48).translate(0, 0.3, 0), lawnM);
      // and on the grass a real pitch: stripes, the lines, the goals and their nets (src/stadium.js)
      const pitch = footballPitch({ L: 60, Wd: 38, run: 2 });
      pitch.position.set(fr.x, 0.53, fr.z);
      pitch.rotation.y = fr.a;
      scene.add(pitch);
      put(new THREE.RingGeometry(R - 43, R - 40.2, 64, 1).rotateX(-Math.PI / 2).translate(0, 0.54, 0), lam('#b4553a')); // the running track round it
      // the roof: a flat white ring over the stands, open over the pitch
      put(
        new THREE.TorusGeometry(R - 6, 9, 4, 64)
          .rotateX(Math.PI / 2)
          .scale(1, 0.12, 1)
          .translate(0, 30, 0),
        white,
      );
      for (let n = 0; n < 16; n++) {
        const t = (n / 16) * TAU;
        put(cy(0.9, 1.1, 30, 8).translate(Math.cos(t) * (R + 2), 0, Math.sin(t) * (R + 2)), white);
      }
      for (const t of [0.25, 1.85, 3.4, 4.95]) {
        put(cy(0.7, 0.9, 52, 8).translate(Math.cos(t) * (R + 14), 0, Math.sin(t) * (R + 14)), steelM);
        put(bx(9, 5, 1.2).translate(Math.cos(t) * (R + 14), 52, Math.sin(t) * (R + 14)), lam('#f4f6f8'));
      }
      place('NATIONAL STADIUM', 'Round the bowl', { x: fr.x, z: fr.z }, f.s + 60, { back: 80, h: 6, lookH: 16 });
      break;
    }
  }
  // the Apo-Karshi road: through a cut in the granite, walls of boulders both sides rising over the road
  for (const f of fOf('rockcut')) {
    for (let s = f.s; s < f.s + f.len; s += 5)
      for (const sd of [1, -1])
        for (const row of [0, 1, 2]) {
          const i = tr.idx(s),
            y = tr.P[i].y,
            off = W / 2 + 9 + row * 8 + rr(0, 3),
            p = P(s + rr(-2, 2), sd * off);
          if (!k.land(p.x, p.z)) continue;
          const r = rr(4.5, 7.5),
            hh = y + rr(6, 12) + row * 3;
          add(rockGeo(r, hh, rand() * 9, 1), granite, p.x, 0, p.z, rand() * TAU, 1, true);
        }
    roadSign(f.s - 30, 1, 'APO – KARSHI ROAD', 14);
    place('APO-KARSHI ROAD', 'Through the rock cut', tr.point(f.s + f.len / 2, 7), f.s + f.len / 2, {
      back: 40,
      h: 3,
      lookH: 6,
    });
  }
  // the skyway: the S-flyover sweeping high over the expressway
  for (const f of fOf('skyway')) {
    roadSign(f.s - 20, 1, 'ABUJA SKYWAY', 12);
    place('THE SKYWAY', 'High over the expressway', tr.point(f.s + f.len * 0.5, 15), f.s + f.len * 0.5, {
      back: 60,
      h: 8,
      lookH: 10,
    });
  }
  // the Outer Southern Expressway's cloverleaf: the lawn inside the loop, its sign
  for (const f of fOf('clover')) {
    loopIsland(f.s + 40, Math.min(f.len, 600), 'OUTER SOUTHERN EXPRESSWAY');
    place('THE CLOVERLEAF', 'Round and over the expressway', tr.point(f.s + 380, 13), f.s + 380, {
      back: 50,
      h: 14,
      lookH: 10,
    });
  }
  // Zuma Rock: the giant monolith with its streaked face, far out ahead as you come off the cloverleaf
  for (const f of fOf('zuma').filter(z => !z.len)) {
    const i = tr.idx(f.s),
      t = tr.T[i];
    const tries = [];
    for (const ahead of [520, 440, 380, 320, 600])
      for (const turn of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8]) tries.push([ahead, turn]);
    for (const [ahead, turn] of tries) {
      const c = tr.P[i],
        ca = Math.cos(turn),
        sa = Math.sin(turn),
        x = c.x + (t.x * ca - t.z * sa) * ahead,
        z = c.z + (t.x * sa + t.z * ca) * ahead;
      if (!k.land(x, z) || k.roadGap(x, z) < 150) continue;
      const faceT = tile(
        (cx, w, hh) => {
          cx.fillStyle = '#9a9184';
          cx.fillRect(0, 0, w, hh);
          for (let n = 0; n < 40; n++) {
            cx.fillStyle = `rgba(${40 + rand() * 30},${36 + rand() * 20},${30},${0.25 + rand() * 0.35})`;
            const sx = rand() * w;
            cx.fillRect(sx, 0, 2 + rand() * 6, hh * (0.4 + rand() * 0.6)); // the dark streaks down its face
          }
        },
        256,
        256,
      );
      faceT.repeat.set(3, 1);
      const g = rockGeo(120, 190, 7.7, 4);
      add(g, lam('#ffffff', { map: faceT, flatShading: true }), x, 0, z, rand() * TAU, 1, false);
      reserve(x, z, 130);
      place('ZUMA ROCK', 'The giant at the gate', { x, y: 90, z }, f.s, { back: 60, h: 14, lookH: 90 });
      break;
    }
  }

  /* ---------- the hills round the capital: green ridges and bare granite domes on the horizon all round ---------- */
  {
    const hillM = lam('#6d8f47', { flatShading: true }),
      farM = lam('#7c9a63', { flatShading: true });
    for (let n = 0; n < 46; n++) {
      const t = (n / 46) * TAU + rr(-0.05, 0.05),
        r = k.R0 + rr(220, 700),
        x = k.C.x + Math.cos(t) * r,
        z = k.C.z + Math.sin(t) * r,
        big = rand() < 0.35;
      add(
        rockGeo(big ? rr(140, 220) : rr(90, 150), big ? rr(110, 180) : rr(50, 100), rand() * 9, 3),
        rand() < 0.3 ? granite : r > k.R0 + 450 ? farM : hillM,
        x,
        0,
        z,
        rand() * TAU,
        1,
        false,
      );
    }
  }

  /* ---------- the leafy districts: Maitama, Asokoro, Wuse II. Walled villas under terracotta roofs, palms, lawns ---------- */
  const villaWalls = [lam('#f4f0e6'), lam('#efe4cf'), lam('#e9ddc8'), lam('#f6f6f2')],
    tileRoof = [lam('#a6492e'), lam('#8f3b25'), lam('#b5583a'), lam('#5a4a44')],
    gateM = lam('#2d3a33');
  const villa = (x, z, a) => {
    const put = at(x, z, a),
      w = rr(14, 20),
      d = rr(12, 16),
      fl = rand() < 0.65 ? 2 : 1,
      hh = fl * 3.6;
    // the compound wall and its gate
    const S = Math.max(w, d) + 10;
    for (const [sx, sz, lw, ld] of [
      [0, S / 2, S, 0.4],
      [0, -S / 2, S, 0.4],
      [S / 2, 0, 0.4, S],
      [-S / 2, 0, 0.4, S],
    ])
      if (!put(bx(lw, 2.4, ld).translate(sx, 0, sz), villaWalls[0], 0, 0, 0, 0, true)) return false;
    put(bx(4, 2.2, 0.5).translate(0, 0, S / 2 + 0.1), gateM);
    // the house: walls, a hipped tile roof, a deep porch on columns
    const wm = pick(villaWalls);
    put(boxM(w, hh, d, 12), wm, 0, 0, -1);
    put(
      new THREE.ConeGeometry(1, 1, 4)
        .rotateY(Math.PI / 4)
        .scale(w * 0.8, 3.2, d * 0.8)
        .translate(0, hh + 1.6, -1),
      pick(tileRoof),
    );
    put(bx(w * 0.5, 0.4, 4).translate(0, 3.4, d / 2 + 1), wm);
    for (const sx of [-w / 4 + 0.5, w / 4 - 0.5]) put(cy(0.3, 0.3, 3.4, 8).translate(sx, 0, d / 2 + 2.6), white);
    // its lawn, a palm or two inside the wall, a bougainvillea over it
    put(new THREE.BoxGeometry(S - 1, 0.08, S - 1).translate(0, 0.04, 0), lawnM);
    tree(x + Math.cos(a) * (S / 2 - 3), z - Math.sin(a) * (S / 2 - 3), 'doum', rr(0.8, 1.1));
    put(new THREE.SphereGeometry(1.6, 8, 6).scale(1.4, 0.9, 1).translate(S / 2 - 2, 2.2, S / 2 - 1.5), pick(bloom));
    return true;
  };
  const bloom = [lam('#d6327a'), lam('#e8559a'), lam('#f07a2a'), lam('#c42a5a'), lam('#f5d24a')];
  // which districts this circuit runs through: villas fill the land between the roads, as Maitama's and Asokoro's do
  {
    const want = CIRC === 'gateway' ? 160 : 300;
    let made = 0;
    for (let n = 0; n < want * 6 && made < want; n++) {
      const s = rand() * tr.len,
        i = tr.idx(s),
        sd = rand() < 0.5 ? 1 : -1,
        off = W / 2 + rr(40, 420),
        p = P(s, sd * off);
      if (tr.elevated[i]) continue;
      if (!free(p.x, p.z, 16, W / 2 + 30)) continue;
      if (!villa(p.x, p.z, head(s) + (rand() < 0.5 ? 0 : Math.PI / 2))) continue;
      reserve(p.x, p.z, 16);
      made++;
    }
  }
  // the districts named on the road, Abuja's green signs
  const districts =
    { central: ['ASOKORO', 'CENTRAL AREA'], jabi: ['MAITAMA', 'WUSE II'], gateway: ['GARKI', 'APO'] }[CIRC] || [];
  districts.forEach((d, n) => roadSign(tr.len * (0.15 + n * 0.45), n % 2 ? 1 : -1, d, 12));

  /* ---------- Abuja's boulevards: palms and neem in rows, federal office blocks set back on their lawns ---------- */
  for (const f of fOf('abway')) {
    for (let s = f.s; s < f.s + f.len; s += 22)
      for (const sd of [1, -1]) {
        const p = P(s, sd * (W / 2 + 9));
        tryTree(p.x, p.z, 2.5, (s / 22) % 2 < 1 ? 'doum' : 'neem', 1.05, W / 2 + 6);
        // and between them, bougainvillea and clipped hedges in bloom along the verge
        const q = P(s + 11, sd * (W / 2 + 8));
        if (free(q.x, q.z, 2, W / 2 + 5)) {
          reserve(q.x, q.z, 2);
          add(
            new THREE.SphereGeometry(1.5, 8, 6).scale(1.6, 0.8, 1.2).translate(0, 0.9, 0),
            pick(bloom),
            q.x,
            0,
            q.z,
            head(s),
            1,
            false,
          );
        }
      }
    for (let s = f.s + 10; s < f.s + f.len; s += rr(40, 60))
      for (const sd of [1, -1]) {
        if (rand() < 0.3) continue;
        const p = P(s, sd * (W / 2 + rr(42, 70)));
        tryTower(p.x, p.z, head(s), rr(22, 34), rr(16, 22), rr(14, 32), pick([gridMat, greenGlass, blueGlass]));
      }
  }

  /* ---------- the expressway: carriageways running alongside, flyovers crossing over it ---------- */
  for (const f of fOf('expressway')) {
    for (const sd of [1, -1]) sideRoad(f.s, f.s + f.len, sd * (W / 2 + 21), 14);
    for (let s = f.s + 10; s < f.s + f.len; s += 30) {
      const sd = rand() < 0.5 ? 1 : -1,
        p = P(s, sd * (W / 2 + 33));
      tryTree(p.x, p.z, 2.5, pick(['neem', 'doum', 'mahogany']), 1, W / 2 + 28);
    }
  }
  // the flyovers: one every 300 m or so along the expressway, wherever there's room for its embankments
  {
    let lastS = -1e9;
    for (const f of fOf('expressway'))
      for (let s = f.s + 60; s < f.s + f.len - 40; s += 20) {
        if (s - lastS < 300) continue;
        if (overpass(s)) lastS = s;
      }
  }

  void [night, bx, darkM, rr, scene, CIRC];
}
