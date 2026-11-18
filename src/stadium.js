// A football ground, built properly: the pitch (mown in stripes, every line where it belongs, goals with their nets,
// corner flags) for any stadium, and the inside of Lusail Stadium round it: two tiers of stepped seating all the way
// round with aisles, the dark mouths of the vomitories and a crowd in the seats, LED boards along the pitch wall and
// on the band between the tiers, the white roof ring with its open middle over the pitch, the floodlights along its
// inner edge, and a big screen hung over each end.
// Everything is merged per material (the stands are one mesh, coloured per step), so the whole ground is a dozen draw
// calls and runs on a phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';

const TAU = Math.PI * 2;
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

// the pitch's paint, drawn to scale: L by Wd metres of play with `run` metres of grass round it. A real pitch is 105 by 68;
// a smaller one keeps the same proportions for its boxes and circles, so it still reads as football
function pitchTex(L, Wd, run) {
  const PX = 1024 / (L + run * 2),
    w = 1024,
    h = Math.round((Wd + run * 2) * PX),
    k = L / 105;
  return canvasTex(w, h, x => {
    // mown in bands across the pitch, two greens
    const bands = 18;
    for (let b = 0; b < bands; b++) {
      x.fillStyle = b % 2 ? '#3f9a3e' : '#4aa847';
      x.fillRect((b * w) / bands, 0, w / bands + 1, h);
    }
    const m = v => v * PX,
      X0 = m(run),
      Y0 = m(run),
      PL = m(L),
      PW = m(Wd),
      cx = X0 + PL / 2,
      cy = Y0 + PW / 2;
    x.strokeStyle = '#ffffff';
    x.fillStyle = '#ffffff';
    x.lineWidth = Math.max(2, m(0.18));
    x.strokeRect(X0, Y0, PL, PW); // touchlines and goal lines
    x.beginPath();
    x.moveTo(cx, Y0);
    x.lineTo(cx, Y0 + PW);
    x.stroke(); // halfway line
    x.beginPath();
    x.arc(cx, cy, m(9.15 * k), 0, TAU);
    x.stroke(); // centre circle
    const spot = (px, py) => {
      x.beginPath();
      x.arc(px, py, Math.max(2.5, m(0.25)), 0, TAU);
      x.fill();
    };
    spot(cx, cy);
    for (const sd of [-1, 1]) {
      const gx = sd < 0 ? X0 : X0 + PL, // this end's goal line
        into = -sd; // towards the middle
      const box = (d, wd) => {
        x.strokeRect(into > 0 ? gx : gx - m(d), cy - m(wd) / 2, m(d), m(wd));
      };
      box(16.5 * k, 40.3 * k); // penalty area
      box(5.5 * k, 18.3 * k); // goal area
      const px = gx + into * m(11 * k);
      spot(px, cy); // penalty spot
      // the arc on the edge of the box: the part of the 9.15 m circle round the spot that lies outside the area
      const a = Math.acos(Math.min(1, (16.5 - 11) / 9.15));
      x.beginPath();
      if (into > 0) x.arc(px, cy, m(9.15 * k), -a, a);
      else x.arc(px, cy, m(9.15 * k), Math.PI - a, Math.PI + a);
      x.stroke();
      // corner arcs
      for (const cyy of [Y0, Y0 + PW]) {
        x.beginPath();
        x.arc(gx, cyy, Math.max(4, m(1 * k)), 0, TAU);
        x.stroke();
      }
    }
    // (the corner arcs were drawn as whole circles: the grass outside the lines covers what shouldn't show)
    x.fillStyle = '#3c943b';
    x.fillRect(0, 0, w, Y0 - x.lineWidth / 2);
    x.fillRect(0, Y0 + PW + x.lineWidth / 2, w, h);
    x.fillRect(0, 0, X0 - x.lineWidth / 2, h);
    x.fillRect(X0 + PL + x.lineWidth / 2, 0, w, h);
  });
}

// a goal net: white cord in a square mesh, see-through between
let netTexCache = null;
function netTex() {
  if (netTexCache) return netTexCache;
  netTexCache = canvasTex(
    64,
    64,
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,0.95)';
      x.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        x.beginPath();
        x.moveTo((i * w) / 4, 0);
        x.lineTo((i * w) / 4, h);
        x.stroke();
        x.beginPath();
        x.moveTo(0, (i * h) / 4);
        x.lineTo(w, (i * h) / 4);
        x.stroke();
      }
    },
    { repeat: true },
  );
  return netTexCache;
}

// The pitch, its goals and corner flags, centred on the group's origin with the pitch along x, the grass at y = 0.
// L by Wd: the field of play; run: the grass round it. Returns the group
export function footballPitch({ L = 68, Wd = 44, run = 4 } = {}) {
  const G = new THREE.Group();
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(L + run * 2, Wd + run * 2).rotateX(-Math.PI / 2),
    lam('#ffffff', { map: pitchTex(L, Wd, run) }),
  );
  grass.receiveShadow = true;
  G.add(grass);
  // the goals: posts and crossbar, the frame back along the ground, the net over it all. A real goal is 7.32 by 2.44;
  // these keep at least the size a kart would expect
  const k = Math.max(0.75, L / 105),
    gw = 7.32 * k,
    gh = 2.44 * k,
    gd = 2 * k,
    t = 0.14,
    frame = [],
    net = [],
    flags = [],
    flagCloth = [];
  for (const sd of [-1, 1]) {
    const gx = (sd * L) / 2;
    for (const z of [-gw / 2, gw / 2]) {
      frame.push(new THREE.BoxGeometry(t, gh, t).translate(gx, gh / 2, z)); // post
      frame.push(new THREE.BoxGeometry(t * 0.6, gh, t * 0.6).translate(gx + sd * gd * 0.35, gh / 2, z)); // back stay
      frame.push(new THREE.BoxGeometry(gd, t * 0.6, t * 0.6).translate(gx + (sd * gd) / 2, 0.05, z)); // along the ground
    }
    frame.push(new THREE.BoxGeometry(t, t, gw + t).translate(gx, gh, 0)); // crossbar
    frame.push(new THREE.BoxGeometry(t * 0.6, t * 0.6, gw).translate(gx + sd * gd * 0.35, gh, 0)); // the top of the back
    frame.push(new THREE.BoxGeometry(t * 0.6, t * 0.6, gw).translate(gx + sd * gd, 0.05, 0));
    // the net: the roof, the back sloping down to the ground and the two sides
    const back = new THREE.PlaneGeometry(gw, Math.hypot(gh, gd * 0.65));
    back.rotateX(-Math.atan2(gd * 0.65, gh)).rotateY((sd * Math.PI) / 2);
    back.translate(gx + sd * (gd * 0.35 + gd * 0.325), gh / 2, 0);
    net.push(back);
    net.push(new THREE.PlaneGeometry(gd * 0.35, gw).rotateX(-Math.PI / 2).translate(gx + (sd * gd * 0.35) / 2, gh, 0));
    for (const z of [-gw / 2, gw / 2]) {
      const side = new THREE.Shape();
      side.moveTo(0, 0);
      side.lineTo(gd, 0);
      side.lineTo(gd * 0.35, gh);
      side.lineTo(0, gh);
      side.closePath();
      const g = new THREE.ShapeGeometry(side);
      if (sd < 0) g.scale(-1, 1, 1);
      net.push(g.translate(gx, 0, z));
    }
    // corner flags
    for (const z of [-Wd / 2, Wd / 2]) {
      flags.push(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5).translate(gx, 0.8, z));
      flagCloth.push(new THREE.PlaneGeometry(0.5, 0.35).translate(gx + 0.25 * -sd, 1.4, z));
    }
  }
  // (net UVs in metres, the texture once a metre: the cord every 0.25 m)
  for (const g of net) {
    const p = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) + p.getX(i), p.getY(i));
  }
  const white = lam('#ffffff');
  G.add(new THREE.Mesh(mergeGeometries(frame), white));
  G.add(
    new THREE.Mesh(
      mergeGeometries(net.map(g => (g.index ? g.toNonIndexed() : g))),
      lam('#ffffff', { map: netTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    ),
  );
  G.add(new THREE.Mesh(mergeGeometries(flags), white));
  G.add(new THREE.Mesh(mergeGeometries(flagCloth), lam('#ffd21f', { side: THREE.DoubleSide })));
  G.traverse(o => o.isMesh && (o.receiveShadow = true));
  return G;
}

// where a rounded rectangle (half sizes a, b, corner radius rc) is crossed by the ray from its centre at angle th
function roundedRectR(th, a, b, rc) {
  const cx = Math.cos(th),
    sz = Math.sin(th);
  const sdf = r => {
    const qx = Math.abs(cx * r) - (a - rc),
      qz = Math.abs(sz * r) - (b - rc);
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc;
  };
  let lo = 0,
    hi = a + b;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (sdf(mid) > 0) hi = mid;
    else lo = mid;
  }
  return lo;
}

// LED boards: panels of colour and lettering, repeated round a band; by night they glow
function boardTex(words, cols) {
  return canvasTex(
    1024,
    64,
    (x, w, h) => {
      const n = words.length;
      for (let i = 0; i < n; i++) {
        const [bg, fg] = cols[i % cols.length];
        x.fillStyle = bg;
        x.fillRect((i * w) / n, 0, w / n, h);
        x.fillStyle = fg;
        x.font = `700 ${h * 0.62}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(words[i], ((i + 0.5) * w) / n, h * 0.54);
      }
      x.fillStyle = 'rgba(0,0,0,.35)';
      for (let i = 0; i < n; i++) x.fillRect((i * w) / n, 0, 2, h);
    },
    { repeat: true },
  );
}

// The inside of Lusail Stadium, centred on the group's origin, the pitch along x. bowlR(h): the bowl's radius at height
// h (the gold skin it sits in), top: the height of its rim. Returns { group, night(n) } — night brings the floodlights,
// the boards and the screens up
export function lusailInside({ bowlR, top = 34 }) {
  const G = new THREE.Group();
  const L = 68,
    Wd = 44,
    run = 4;
  const pitch = footballPitch({ L, Wd, run });
  pitch.position.y = 0.32;
  G.add(pitch);

  // the stands' front edge: a rounded rectangle round the grass; the back meets the bowl
  const A = L / 2 + run + 1.5,
    B = Wd / 2 + run + 1.5,
    RC = 15,
    rIn = th => roundedRectR(th, A, B, RC),
    H1 = 13, // the lower tier's top
    H2 = 15.6, // the upper tier's front
    HT = top - 3, // the upper tier's top, just under the rim
    rTop = bowlR(HT) - 0.4,
    T1 = 0.42, // how far back (of the whole depth) the lower tier reaches
    T2 = 0.45, // and where the upper tier starts, over the band between them
    N1 = 18, // rows in the lower tier
    N2 = 22, // and the upper
    SEG = 144, // round the bowl
    AISLE = 9; // an aisle every this many columns
  // the profile of the stands, front to back: [t (share of the depth), height, kind] at each corner of the steps
  const prof = [[0, 0, 'wall']];
  prof.push([0, 1.2, 'wall']);
  for (let j = 0; j < N1; j++) {
    const t1 = ((j + 1) / N1) * T1,
      h = 1.2 + ((j + 1) / N1) * (H1 - 1.2);
    prof.push([t1, 1.2 + (j / N1) * (H1 - 1.2), 'seat', j]); // tread
    prof.push([t1, h, 'riser', j]);
  }
  prof.push([T1 + 0.004, H1, 'lip']); // the edge of the walkway behind the lower tier
  prof.push([T1 + 0.004, H2, 'band']); // the band between the tiers (the boards go on it)
  prof.push([T2, H2, 'lip']);
  for (let j = 0; j < N2; j++) {
    const t1 = T2 + ((j + 1) / N2) * (1 - T2),
      h = H2 + ((j + 1) / N2) * (HT - H2);
    prof.push([t1, H2 + (j / N2) * (HT - H2), 'seat', N1 + j]);
    prof.push([t1, h, 'riser', N1 + j]);
  }
  prof.push([1, top + 0.2, 'back']);
  const ring = [];
  for (let s = 0; s <= SEG; s++) {
    const th = (s / SEG) * TAU;
    ring.push({ c: Math.cos(th), s: Math.sin(th), r0: rIn(th) });
  }
  const at = (s, t, h) => {
    const q = ring[s],
      r = q.r0 + (rTop - q.r0) * t;
    return [q.c * r, h, q.s * r];
  };
  const pos = [],
    col = [];
  const C = c => new THREE.Color(c);
  const SEAT = C('#7d1d3c'), // Qatar maroon
    SEAT2 = C('#9a2a4b'),
    RISER = C('#4a3a36'),
    AISLEC = C('#cfc6b8'),
    WALK = C('#bdb3a3'),
    BAND = C('#2a2522'),
    BACK = C('#e8e1d3'),
    VOM = C('#140e0c'),
    CROWD = ['#ffffff', '#f2f2f2', '#7d1d3c', '#a8233f', '#2b2b2b', '#c9a27a', '#8a5a3c', '#3d5a8a', '#e8d27a'].map(C);
  const tmpC = new THREE.Color();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let s = 0; s < SEG; s++) {
    const aisle = s % AISLE === 0,
      nearAisle = (s % AISLE === 1 || s % AISLE === AISLE - 1) && Math.floor(s / AISLE) % 2 === 0; // every other aisle has a vomitory
    for (let p = 0; p < prof.length - 1; p++) {
      const [t0, h0] = prof[p],
        [t1, h1, kind, row] = prof[p + 1];
      if (t0 === t1 && h0 === h1) continue;
      let c;
      if (kind === 'wall') c = BAND;
      else if (kind === 'band') c = BAND;
      else if (kind === 'lip') c = WALK;
      else if (kind === 'back') c = BACK;
      else if (nearAisle && row >= 6 && row <= 9)
        c = VOM; // the mouth of a vomitory, halfway up the lower tier
      else if (aisle) c = kind === 'seat' ? AISLEC : WALK;
      else {
        // a seat, or someone in it: seen from the pitch it's the riser that shows (the seat backs and the people), so
        // that is coloured too, a shade darker than the step
        c = rnd() < 0.62 ? CROWD[(rnd() * CROWD.length) | 0] : rnd() < 0.5 ? SEAT : SEAT2;
        if (kind === 'riser') c = tmpC.copy(c).lerp(RISER, 0.3);
      }
      const a0 = at(s, t0, h0),
        a1 = at(s + 1, t0, h0),
        b0 = at(s, t1, h1),
        b1 = at(s + 1, t1, h1);
      // (wound so the face looks in, towards the pitch and the sky)
      pos.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
      for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sg.computeVertexNormals();
  // the grass between the pitch and the wall, out to the stands' front edge
  {
    const sh = new THREE.Shape();
    for (let s = 0; s < SEG; s++) {
      const q = ring[s];
      if (s) sh.lineTo(q.c * q.r0, -q.s * q.r0);
      else sh.moveTo(q.c * q.r0, -q.s * q.r0);
    }
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), lam('#3a8f3a'));
    floor.position.y = 0.28;
    floor.receiveShadow = true;
    G.add(floor);
  }
  // (a little light of their own: under the roof the stands would otherwise sink into its shade)
  const stands = new THREE.Mesh(sg, lam('#ffffff', { vertexColors: true, emissive: '#2a2622' }));
  stands.receiveShadow = true;
  G.add(stands);

  // a band of boards following the stands' front edge (t) between two heights, its texture by the metre
  const band = (t, h0, h1, tile) => {
    const p2 = [],
      uv = [];
    let u = 0;
    for (let s = 0; s < SEG; s++) {
      const a0 = at(s, t, h0),
        a1 = at(s + 1, t, h0),
        b0 = at(s, t, h1),
        b1 = at(s + 1, t, h1),
        du = Math.hypot(a1[0] - a0[0], a1[2] - a0[2]) / tile;
      p2.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
      uv.push(u, 0, u + du, 0, u, 1, u + du, 0, u + du, 1, u, 1);
      u += du;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  const boardsT = boardTex(
    ['LUSAIL', 'GUKART', 'QATAR', 'DOHA', 'LUSAIL', 'KANO', 'GUKART', 'QATAR'],
    [
      ['#7d1d3c', '#ffffff'],
      ['#111111', '#ffd27a'],
      ['#ffffff', '#7d1d3c'],
      ['#0d3b66', '#ffffff'],
    ],
  );
  const boardsM = new THREE.MeshLambertMaterial({ map: boardsT, emissiveMap: boardsT, emissive: '#000000' });
  // pitch-side boards a little in front of the wall, and the ring between the tiers
  const pitchBoards = band(-0.012, 0.32, 1.25, 12);
  const tierBoards = band(T1 + 0.001, H1 + 0.4, H2 - 0.3, 16);
  G.add(new THREE.Mesh(mergeGeometries([pitchBoards, tierBoards]), boardsM));

  // the inside of the gold skin, where it shows over the back row: plain pale render
  {
    const pts = [];
    for (let k2 = 0; k2 <= 12; k2++) {
      const h = (k2 / 12) * top;
      pts.push(new THREE.Vector2(bowlR(h) - 0.25, h));
    }
    G.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 96), lam('#e9e2d4', { side: THREE.BackSide })));
  }

  // the roof: a white ring from the rim in towards the pitch, sloping gently down, open in the middle in the pitch's own
  // rounded shape. Ribs under it (the cable net) run out to the gold compression ring on the rim
  const OA = L / 2 + 9,
    OB = Wd / 2 + 10,
    oRC = 20,
    rOut = bowlR(top) + 1.2;
  {
    const RS = 5,
      p2 = [],
      idx = [];
    for (let s = 0; s <= SEG; s++) {
      const th = (s / SEG) * TAU,
        ri = roundedRectR(th, OA, OB, oRC);
      for (let q = 0; q <= RS; q++) {
        const u = q / RS,
          r = ri + (rOut - ri) * u,
          y = top + 0.6 - (1 - u) * 2.6 + Math.sin(u * Math.PI) * 0.6;
        p2.push(Math.cos(th) * r, y, Math.sin(th) * r);
      }
    }
    for (let s = 0; s < SEG; s++)
      for (let q = 0; q < RS; q++) {
        const a = s * (RS + 1) + q,
          b = a + RS + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    // (lit a little from below too: the floodlit, sunlit bowl bounces light up onto the membrane)
    const roof = new THREE.Mesh(rg, lam('#f6f4ef', { side: THREE.DoubleSide, emissive: '#6d6a64' }));
    G.add(roof);
    // ribs under the membrane, and the dark tension ring round the opening
    const ribs = [];
    for (let s = 0; s < SEG; s += 3) {
      const th = (s / SEG) * TAU,
        ri = roundedRectR(th, OA, OB, oRC),
        len = rOut - ri;
      ribs.push(
        new THREE.BoxGeometry(len, 0.35, 0.3)
          .rotateZ(Math.atan2(2.6, len))
          .translate(ri + len / 2, top - 1.05, 0)
          .rotateY(-th),
      );
    }
    G.add(new THREE.Mesh(mergeGeometries(ribs), lam('#c9ccd1')));
    G.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(rOut - 0.4, 0.9, 6, 96).rotateX(Math.PI / 2).translate(0, top + 0.5, 0),
        new THREE.MeshPhongMaterial({ color: '#d9a640', specular: '#fff1c0', shininess: 60 }),
      ),
    );
  }
  // the floodlights: a band of lamps along the opening's edge, under the roof, aimed at the pitch
  const lampsM = new THREE.MeshBasicMaterial({ color: '#e9e4d6' });
  {
    const lamps = [];
    for (let s = 0; s < SEG; s += 2) {
      const th = ((s + 0.5) / SEG) * TAU,
        r = roundedRectR(th, OA, OB, oRC) + 1.2;
      lamps.push(
        new THREE.BoxGeometry(0.5, 0.5, 1.6).rotateY(-th).translate(Math.cos(th) * r, top - 2.3, Math.sin(th) * r),
      );
    }
    G.add(new THREE.Mesh(mergeGeometries(lamps), lampsM));
  }
  // a big screen hung under the roof over each end, facing the pitch
  const scrT = canvasTex(512, 224, (x, w, h) => {
    x.fillStyle = '#05070a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#7d1d3c';
    x.fillRect(0, 0, w, 56);
    x.fillStyle = '#ffd27a';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '700 40px "Barlow Condensed", "Arial Narrow", sans-serif';
    x.fillText('LUSAIL STADIUM', w / 2, 30);
    x.fillStyle = '#ffffff';
    x.font = '700 92px "Barlow Condensed", "Arial Narrow", sans-serif';
    x.fillText('QAT 2 - 2 NGA', w / 2, 128);
    x.fillStyle = '#9fd36b';
    x.font = '700 34px "Barlow Condensed", "Arial Narrow", sans-serif';
    x.fillText("90+3'", w / 2, 196);
  });
  const scrM = new THREE.MeshBasicMaterial({ map: scrT, color: '#d8d8d8' });
  const darkM = lam('#1c1f24');
  const frames = [];
  for (const sd of [-1, 1]) {
    const X = sd * (A + 6),
      y = top - 9;
    const face = new THREE.PlaneGeometry(16, 7).rotateY((-sd * Math.PI) / 2).translate(X - sd * 0.42, y, 0);
    G.add(new THREE.Mesh(face, scrM));
    frames.push(new THREE.BoxGeometry(0.8, 7.8, 16.8).translate(X, y, 0));
    for (const z of [-6, 6]) frames.push(new THREE.BoxGeometry(0.15, top - y - 3, 0.15).translate(X, (top + y) / 2, z));
  }
  G.add(new THREE.Mesh(mergeGeometries(frames), darkM));

  // by night the floodlights blaze, a wash of light on the grass, the boards glow
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(L + run * 2, Wd + run * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: '#fff8e6',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  wash.position.y = 0.4;
  G.add(wash);
  const night = n => {
    wash.material.opacity = n * 0.22;
    lampsM.color.set(n > 0.5 ? '#fffbea' : '#e9e4d6');
    boardsM.emissive.setScalar(n * 0.9);
    scrM.color.setScalar(0.85 + n * 0.15);
  };
  return { group: G, night };
}

// Stepped seating as a picture, for a stand that is one plain surface (a cone, a slope): one bay of `rows` rows between
// two aisles, a crowd in most of the seats, each row's riser a shade darker. Repeat it round the stand (repeat.x bays)
export function standTex({ seat = '#1f8a4c', seat2 = '#2aa05a', rows = 24, crowd = 0.6 } = {}) {
  const CROWD = ['#ffffff', '#f2f2f2', '#1f8a4c', '#2b2b2b', '#c9a27a', '#8a5a3c', '#e8d27a', '#d9473a', '#3d5a8a'];
  return canvasTex(
    128,
    512,
    (x, w, h) => {
      const rh = h / rows,
        AW = 10; // the aisle
      x.fillStyle = '#5a5550';
      x.fillRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        for (let c = AW; c < w; c += 6) {
          x.fillStyle =
            Math.random() < crowd ? CROWD[(Math.random() * CROWD.length) | 0] : Math.random() < 0.5 ? seat : seat2;
          x.fillRect(c, y + rh * 0.12, 5, rh * 0.6);
        }
        x.fillStyle = 'rgba(0,0,0,.35)';
        x.fillRect(AW, y + rh * 0.72, w - AW, rh * 0.28); // the riser
      }
      x.fillStyle = '#cfc8bc';
      x.fillRect(0, 0, AW, h); // the aisle's steps
      x.fillStyle = 'rgba(0,0,0,.18)';
      for (let r = 0; r < rows * 2; r++) x.fillRect(0, (r * rh) / 2, AW, 1.5);
    },
    { repeat: true },
  );
}
