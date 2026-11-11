// Chapter 2, Doha: the city round Doha Bay. world.js lays the ground, the sea, the road furniture and the start; this
// builds the city on it, each landmark after the real one:
//  - the Corniche: date palms, wooden dhows moored in the bay, the Pearl Monument (the open oyster with its pearl)
//  - the Museum of Islamic Art (I. M. Pei): cream limestone blocks stepping up square-octagon-square to an octagonal
//    drum, on its own islet in the bay
//  - West Bay: Doha Tower (Jean Nouvel: a 45 m cylinder in a silver mashrabiya lattice, a dome, a light on top), the
//    Tornado Tower (an hourglass in a white diagonal lattice), and a cluster of glass towers round them
//  - Katara: the white amphitheatre, the mud pigeon towers, the golden mosque
//  - Lusail: the Katara Towers (two golden crescents, the crossed swords of the emblem, either side of the road),
//    Lusail Stadium (the burnished golden bowl, triangular openings, a white roof with an open middle), the boulevard
//  - The Pearl: Porto Arabia's ring of towers round the marina with its yachts, the pastel Qanat Quartier on its canal
//  - Hamad International: the departures hall under its wave roof, which the Msheireb circuit drives straight through
//  - and the low city behind it all
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';
import { renderer } from './scene.js';
import { qaSign, QA_BROWN } from './doharoad.js';

// a facade drawn once and repeated by the metre (the geometry's UVs are in metres / the tile size)
function facade(draw, w = 128, h = 128) {
  return canvasTex(w, h, draw, { repeat: true });
}
const GLASS = {
  blue: ['#1f4f7a', '#5d9cc9'],
  teal: ['#1d5a5e', '#5fb3ae'],
  silver: ['#6f7f8f', '#c9d6e2'],
  dark: ['#152234', '#4a6f93'],
  green: ['#2a5c4f', '#7fbfa6'],
};
function glassTex([a, b]) {
  return facade((x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, a);
    g.addColorStop(0.5, b);
    g.addColorStop(1, a);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.18)';
    for (let y = 0; y < h; y += 32) x.fillRect(0, y, w, 3); // floor lines every 4 m
    x.fillStyle = 'rgba(0,0,0,.18)';
    for (let xx = 0; xx < w; xx += 16) x.fillRect(xx, 0, 2, h); // mullions every 2 m
  });
}
// UVs in metres: a box w x h x d whose texture repeats every `tile` metres
function boxM(w, h, d, tile = 16) {
  const g = new THREE.BoxGeometry(w, h, d),
    uv = g.attributes.uv,
    n = g.attributes.normal;
  // roofs and floors sample one spot near the foot of the tile, below every row of windows, so a roof never shows lit windows at night
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) {
      uv.setXY(i, 0.3, 0.015);
      continue;
    }
    const ax = Math.abs(n.getX(i)) > 0.5 ? d : w;
    uv.setXY(i, (uv.getX(i) * ax) / tile, (uv.getY(i) * h) / tile);
  }
  return g.translate(0, h / 2, 0);
}
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
function cylM(r0, r1, h, seg = 24, tile = 16, open = false) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, open),
    uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * Math.PI * 2 * Math.max(r0, r1)) / tile, (uv.getY(i) * h) / tile);
  return g.translate(0, h / 2, 0);
}

export function dressDoha(k) {
  const { scene, tr, rand, rr, pick, free, reserve, roadGap, clearOfRoad, trunks, canopy, W } = k,
    occ = []; // (occ: spots taken out on the water, where free() doesn't look)
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const phong = o => new THREE.MeshPhongMaterial({ shininess: 80, specular: '#dfeeff', ...o });
  // pieces are gathered per material and merged into one mesh each at the end: a city in a handful of draw calls
  const bins = new Map();
  // (every piece passes clearOfRoad first: anything that would stand on the road is left out and logged, see world.js)
  const add = (geo, mat, x, y, z, ry = 0, s = 1) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(s, s, s),
    );
    geo.boundingBox || geo.computeBoundingBox();
    if (!clearOfRoad(geo.boundingBox, m, 'building')) return;
    const g = geo.clone().applyMatrix4(m);
    (bins.get(mat) || bins.set(mat, []).get(mat)).push(g);
  };
  const addG = (geo, mat) => (bins.get(mat) || bins.set(mat, []).get(mat)).push(geo);
  // where things go: a road distance, and which way is the bay (inside the loop) or the city (outside)
  const fOf = type => tr.feats.filter(f => f.type === type);
  const inside = s => -tr.out[tr.idx(s)]; // +1/-1: the sign of the offset towards the inside of the loop
  const shores = tr.feats.filter(f => f.type === 'shore');
  const waterSide = s => {
    for (const f of shores) if (tr.wrapS(s - f.s) <= f.len) return f.side === 'in' ? inside(s) : -inside(s);
    return inside(s);
  }; // towards the sea
  const P = (s, off) => tr.beside(tr.idx(s), off); // a point on the ground beside the road
  const head = s => {
    const i = tr.idx(s),
      t = tr.T[i];
    return Math.atan2(t.x, t.z);
  };
  const forkGap = (x, z) => Math.min(Infinity, ...(tr.forks || []).map(f => f.dist(x, z))); // how far from a sky bridge or subway (boats keep out from under the bridges)
  const facing = (x, z, s) => {
    const q = tr.P[tr.idx(s)];
    return Math.atan2(q.x - x, q.z - z);
  }; // turned to face the road

  const yachtG = mergeGeometries([
    new THREE.CylinderGeometry(1.6, 0.6, 12, 8, 1).rotateX(Math.PI / 2).scale(1, 0.55, 1),
    new THREE.BoxGeometry(2.4, 1.3, 5).translate(0, 1.3, -1.2),
  ]);
  const mats = {
    blue: phong({ map: glassTex(GLASS.blue) }),
    teal: phong({ map: glassTex(GLASS.teal) }),
    silver: phong({ map: glassTex(GLASS.silver) }),
    dark: phong({ map: glassTex(GLASS.dark) }),
    green: phong({ map: glassTex(GLASS.green) }),
    cream: lam('#efe3cc'),
    stone: lam('#e6d6b8'),
    white: lam('#f4f2ec'),
    wood: lam('#8a5a32'),
    woodDark: lam('#5e3a1e'),
    mud: lam('#c9a77a'),
    gold: phong({ color: '#d9a640', specular: '#fff1c0', shininess: 60 }),
    terracotta: lam('#c7643a'),
  };

  /* ---------- night: every lit thing carries a glow map ---------- */
  // A lit material keeps its day look and gets a glow map drawn to the same tile as its facade: the window cells, a random
  // share of them lit warm or cool. By day the glow is off; night(n) brings each one up to its own colour and strength.
  // The glow map covers 2 x 2 facade tiles, so the pattern of lit windows repeats half as often.
  const glowing = [];
  const glow = (mat, map, col = '#ffffff', str = 1) => {
    if (map) mat.emissiveMap = map;
    const base = mat.emissive ? mat.emissive.clone() : new THREE.Color(0);
    mat.emissive = base.clone();
    glowing.push({ mat, base, col: new THREE.Color(col), str });
    return mat;
  };
  const LIT = ['#ffd49a', '#ffe6bd', '#fff2dc', '#ffc978', '#e4f1ff'],
    WARMLIT = ['#ffd49a', '#ffc070', '#ffe0a8', '#ffb35c'];
  // (a big city at night: about a third more windows lit than they'd otherwise be, and brighter)
  const litTex = (w, h, cells, share0 = 0.55, pal = LIT, bg = '#000000') => {
    const share = Math.min(0.92, share0 * 1.35);
    const t = canvasTex(
      w * 2,
      h * 2,
      x => {
        x.fillStyle = bg;
        x.fillRect(0, 0, w * 2, h * 2);
        for (let ty = 0; ty < 2; ty++)
          for (let tx = 0; tx < 2; tx++)
            for (const [cx, cy, cw, ch] of cells)
              if (Math.random() < share) {
                x.globalAlpha = 0.5 + Math.random() * 0.5;
                x.fillStyle = pal[(Math.random() * pal.length) | 0];
                x.fillRect(tx * w + cx, ty * h + cy, cw, ch);
              }
        x.globalAlpha = 1;
      },
      { repeat: true },
    );
    t.repeat.set(0.5, 0.5);
    return t;
  };
  const grid = (cols, rows, w, h, mx, my) => {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push([(c * w) / cols + mx, (r * h) / rows + my, w / cols - mx * 2, h / rows - my * 2]);
    return out;
  };
  // office glass: 8 bays by 4 floors per tile; two patterns so neighbouring towers don't match
  const glassLit = [
    litTex(128, 128, grid(8, 4, 128, 128, 1, 4), 0.5),
    litTex(128, 128, grid(8, 4, 128, 128, 1, 4), 0.62),
  ];
  for (const [i, key] of ['blue', 'teal', 'silver', 'dark', 'green'].entries())
    glow(mats[key], glassLit[i % 2], '#ffffff', 1.05);
  glow(mats.gold, null, '#7a5212', 1);
  glow(mats.cream, null, '#3d3428', 1); // the mosques' domes and stone, floodlit

  // the places on the map: each landmark, where it stands and the stretch of road it's seen from
  k.places = [];
  const place = (name, sub, at, s, o = {}) => {
    if (!k.places.some(p => p.name === name))
      k.places.push({ name, sub, x: at.x, y: at.y || 0, z: at.z, s, back: 30, lat: 0, h: 4, lookH: 8, ...o });
  };

  // the airport hall stands over its stretch of road: nothing else is planted or built there (it's built further down)
  for (const f of fOf('airport'))
    for (let s = f.s - 24; s <= f.s + f.len + 24; s += 12) {
      const p = tr.point(s, 0);
      reserve(p.x, p.z, W / 2 + 30);
    }

  /* ---------- palms down the Corniche and the boulevards ---------- */
  const PALM = ['#4f7d3a', '#5b8a40', '#467334'];
  const palm = (x, z) => {
    const h = rr(7, 10);
    trunks.add(x, 0, z, 0, 0.32, h, 0.32, '#8a6a4a');
    for (let j = 0; j < 6; j++) {
      const a = j * 1.05 + rand();
      canopy.add(x + Math.cos(a) * 1.5, h + 0.1, z + Math.sin(a) * 1.5, -a, 2.6, 0.45, 1, pick(PALM), 0, 0.4);
    }
    canopy.add(x, h + 0.5, z, 0, 1, 0.8, 1, pick(PALM));
  };
  for (let s = 0; s < tr.len; s += 18) {
    const i = tr.idx(s);
    if (tr.trench[i] || tr.elevated[i] || Math.abs(tr.P[i].y) > 0.3) continue;
    for (const sd of [-1, 1]) {
      const p = tr.beside(i, sd * (W / 2 + 7));
      if (!free(p.x, p.z, 1.2, W / 2 + 5) || roadGap(p.x, p.z) < W / 2 + 5) continue;
      reserve(p.x, p.z, 1.5);
      palm(p.x, p.z);
    }
  }

  /* ---------- Hamad International: the road runs straight through the departures hall ---------- */
  // In at the doors under the wave roof, down the hall between the rails (check-in islands, the departures board, the
  // travellers walking the concourse either side), past the shops and the palm garden, and out the far doors with the
  // jets nosed up to the glass. Built in the hall's own frame (z along the road, x across it) and set down on the road.
  const walkers = [];
  for (const f of fOf('airport')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      a = head(mid),
      HW = W / 2 + 24, // half the hall's width
      RW = W / 2 + 0.5, // the rails
      DW = W / 2 + 1.6, // half the doorway
      WH = 14.6; // the glass walls
    const G = new THREE.Group();
    G.position.set(o.x, 0, o.z);
    G.rotation.y = a;
    G.updateMatrixWorld(true);
    const world = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(G.matrixWorld);
    const roofY = z => 17 + 2 * Math.sin((z / 40) * Math.PI);
    const ab = new Map(),
      put = (geo, mat, x = 0, y = 0, z = 0, ry = 0) =>
        (ab.get(mat) || ab.set(mat, []).get(mat)).push(geo.clone().rotateY(ry).translate(x, y, z));
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    const lit = (w, h, draw) => new THREE.MeshBasicMaterial({ map: canvasTex(w, h, draw) });
    const SANS = '"Barlow Condensed", "Arial Narrow", sans-serif',
      ARABIC = '"Geeza Pro", "Noto Kufi Arabic", "Noto Naskh Arabic", "Arial", sans-serif',
      MAROON = '#7a1430';

    // the wave roof: warm slats with rows of skylights, its underside lit
    const roofG = new THREE.PlaneGeometry(HW * 2 + 14, L + 28, 2, 64).rotateX(-Math.PI / 2),
      rp = roofG.attributes.position;
    for (let i = 0; i < rp.count; i++) rp.setY(i, roofY(rp.getZ(i)));
    roofG.computeVertexNormals();
    const roofT = canvasTex(
      256,
      256,
      (x, w, h) => {
        x.fillStyle = '#efe4cf';
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(150,120,80,.22)';
        for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 2); // the slats
        x.fillStyle = '#ffffff';
        for (let c = 0; c < 4; c++) x.fillRect(c * 64 + 14, 96, 36, 64); // skylights
        x.fillStyle = 'rgba(120,190,235,.55)';
        for (let c = 0; c < 4; c++) x.fillRect(c * 64 + 18, 100, 28, 56);
      },
      { repeat: true },
    );
    roofT.repeat.set(4, Math.round(L / 20));
    const roofM = glow(
      new THREE.MeshLambertMaterial({ map: roofT, side: THREE.DoubleSide, emissive: '#6b655c', emissiveMap: roofT }),
      null,
      '#fff0d2',
      0.55,
    );
    G.add(new THREE.Mesh(roofG, roofM));

    // the floor either side of the road: pale polished stone
    const floorT = canvasTex(
      128,
      128,
      (x, w, h) => {
        x.fillStyle = '#e9e2d3';
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,.5)';
        x.fillRect(4, 4, w - 8, h - 8);
        x.fillStyle = 'rgba(120,105,85,.35)';
        x.fillRect(0, 0, w, 2);
        x.fillRect(0, 0, 2, h);
      },
      { repeat: true },
    );
    floorT.repeat.set(6, Math.round(L / 4));
    const floorM = glow(new THREE.MeshLambertMaterial({ map: floorT, emissive: '#000000' }), null, '#6d6455', 1),
      fw = HW - RW;
    for (const sd of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.14, L + 24).translate(sd * (RW + fw / 2), 0.07, 0), floorM);
      m.receiveShadow = true;
      G.add(m);
    }

    const white = mats.white,
      steel = lam('#b9c2cc'),
      darkM = lam('#22262e'),
      maroon = lam(MAROON),
      seatM = lam('#3b4658'),
      glassM = new THREE.MeshPhongMaterial({
        color: '#a9d6ee',
        transparent: true,
        opacity: 0.32,
        shininess: 90,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    // the rails: glass between steel posts, a handrail on top
    for (const sd of [-1, 1]) {
      put(box(0.06, 0.95, L), glassM, sd * RW, 0.14, 0);
      put(box(0.14, 0.08, L), steel, sd * RW, 1.1, 0);
      for (let z = -L / 2; z <= L / 2; z += 4) put(box(0.1, 1.1, 0.1), steel, sd * RW, 0.1, z);
    }
    // the glass walls down both sides, white mullions
    for (const sd of [-1, 1]) {
      put(box(0.2, WH, L), glassM, sd * HW, 0, 0);
      for (let z = -L / 2; z <= L / 2; z += 5) put(box(0.5, WH, 0.3), white, sd * HW, 0, z);
      for (const y of [4.6, 9.2, WH - 0.3]) put(box(0.4, 0.3, L), white, sd * HW, y, 0);
    }
    // the two ends: glass either side of the doorway, deep maroon door posts, a white header carrying the sign
    const signT = (big, small, ar) =>
      lit(1024, 176, (x, w, h) => {
        x.fillStyle = '#f7f4ee';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#c9a24a';
        x.fillRect(0, h - 10, w, 10);
        x.fillStyle = MAROON;
        x.textBaseline = 'middle';
        x.textAlign = 'left';
        // a short name sits beside its Arabic; a long one takes the top line and the Arabic the line under it
        x.font = `800 ${small ? 84 : 100}px ${SANS}`;
        const wide = !small && x.measureText(big).width > w * 0.5;
        if (wide) x.font = `800 80px ${SANS}`;
        x.fillText(big, 36, small ? 62 : wide ? 50 : 84, w - 72);
        if (small) {
          x.font = `600 40px ${SANS}`;
          x.fillStyle = '#5b5148';
          x.fillText(small, 38, 128);
        }
        x.fillStyle = MAROON;
        x.textAlign = 'right';
        x.font = `700 ${wide ? 60 : 76}px ${ARABIC}`;
        x.fillText(ar, w - 36, wide ? 124 : 84);
      });
    const outSign = signT('HAMAD INTERNATIONAL AIRPORT', '', 'مطار حمد الدولي'),
      depSign = signT('DEPARTURES', 'ALL GATES · STRAIGHT ON', 'المغادرون'),
      arrSign = signT('WELCOME TO DOHA', '', 'مرحبا بكم في الدوحة');
    const HD = 8.2, // the doorway's height
      hh = WH - HD;
    for (const e of [-1, 1]) {
      const z = (e * L) / 2;
      for (const sd of [-1, 1]) {
        const w = HW - DW - 1.2;
        put(box(w, WH, 0.2), glassM, sd * (DW + 1.2 + w / 2), 0, z);
        for (let x = DW + 1.2; x <= HW; x += 4.6) put(box(0.3, WH, 0.5), white, sd * x, 0, z);
        for (const y of [4.6, 9.2, WH - 0.3]) put(box(w, 0.3, 0.4), white, sd * (DW + 1.2 + w / 2), y, z);
        put(box(1.2, WH, 1.6), maroon, sd * (DW + 0.6), 0, z);
        put(box(1.3, 0.25, 1.7), mats.gold, sd * (DW + 0.6), HD, z);
      }
      put(box(DW * 2, hh, 1.2), white, 0, HD, z);
      // the sign on each face of the header (the plane faces +z; turned about for the face that looks back up the road)
      const sg = new THREE.PlaneGeometry(DW * 2 - 1, hh - 0.9);
      const outer = new THREE.Mesh(sg, outSign),
        inner = new THREE.Mesh(sg, e < 0 ? arrSign : depSign);
      outer.position.set(0, HD + hh / 2, z + e * 0.63);
      outer.rotation.y = e > 0 ? 0 : Math.PI;
      inner.position.set(0, HD + hh / 2, z - e * 0.63);
      inner.rotation.y = e > 0 ? Math.PI : 0;
      G.add(outer, inner);
      // the canopy's columns out front
      for (const sd of [-1, 1]) put(cylM(0.55, 0.7, roofY(z + e * 11), 12), white, sd * (DW + 8), 0, z + e * 11);
    }
    // columns down the hall, two rows a side, up to the roof
    for (let z = -L / 2 + 14; z < L / 2 - 6; z += 24)
      for (const sd of [-1, 1])
        for (const x of [W / 2 + 8.5, HW - 3.5]) put(cylM(0.42, 0.6, roofY(z) - 0.2, 10), white, sd * x, 0, z);

    // the departures board, hung over the road a third of the way in (the tour's cities are all on it)
    const FL = [
      ['08:05', 'KANO', 'GK 101', 'A3', 'BOARDING'],
      ['08:20', 'LAGOS', 'GK 214', 'B7', 'GO TO GATE'],
      ['08:45', 'ABU DHABI', 'GK 330', 'A1', 'ON TIME'],
      ['09:10', 'SINGAPORE', 'GK 472', 'C4', 'ON TIME'],
      ['09:30', 'ABUJA', 'GK 118', 'B2', 'ON TIME'],
      ['09:55', 'LONDON', 'GK 007', 'C9', 'DELAYED'],
    ];
    const boardM = lit(1024, 320, (x, w, h) => {
      x.fillStyle = '#0b0f16';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffc400';
      x.fillRect(0, 0, w, 50);
      x.fillStyle = '#0b0f16';
      x.textBaseline = 'middle';
      x.font = `800 38px ${SANS}`;
      x.fillText('DEPARTURES', 22, 27);
      x.textAlign = 'right';
      x.font = `700 34px ${ARABIC}`;
      x.fillText('المغادرون', w - 22, 27);
      x.textAlign = 'left';
      x.font = `700 34px ${SANS}`;
      FL.forEach((r, i) => {
        const y = 78 + i * 41;
        x.fillStyle = i % 2 ? '#121a26' : '#0b0f16';
        x.fillRect(0, y - 20, w, 41);
        x.fillStyle = '#ffd97a';
        x.fillText(r[0], 22, y);
        x.fillStyle = '#f4f7ff';
        x.fillText(r[1], 150, y);
        x.fillStyle = '#9fb2c8';
        x.fillText(r[2], 470, y);
        x.fillText(r[3], 640, y);
        x.fillStyle = r[4] === 'DELAYED' ? '#ff6a4a' : r[4] === 'ON TIME' ? '#7fe08a' : '#ffd97a';
        x.fillText(r[4], 760, y);
      });
    });
    const bz = -L / 2 + L * 0.3;
    put(box(18.4, 6.1, 0.5), darkM, 0, 8.3, bz);
    for (const sd of [-1, 1]) put(box(0.12, roofY(bz) - 14.3, 0.12), steel, sd * 7, 14.3, bz);
    for (const e of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.7), boardM);
      m.position.set(0, 11.35, bz + e * 0.27);
      m.rotation.y = e > 0 ? 0 : Math.PI;
      G.add(m);
    }
    // a yellow way sign over the road further on
    const wayM = lit(768, 96, (x, w, h) => {
      x.fillStyle = '#ffc400';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#14161a';
      x.textBaseline = 'middle';
      x.font = `800 60px ${SANS}`;
      x.fillText('↑  GATES A · B · C', 24, 50);
      x.textAlign = 'right';
      x.fillText('TO THE CITY  ↑', w - 24, 50);
    });
    const wz = L * 0.2;
    put(box(16.3, 2.3, 0.4), darkM, 0, 9, wz);
    for (const sd of [-1, 1]) put(box(0.12, roofY(wz) - 11.3, 0.12), steel, sd * 6, 11.3, wz);
    {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), wayM);
      m.position.set(0, 10.15, wz - 0.22);
      m.rotation.y = Math.PI;
      G.add(m);
    }

    // the first half: check-in islands, a row of desks facing the doors, a screen band over them, a belt behind
    const rowM = c =>
      lit(512, 64, (x, w, h) => {
        x.fillStyle = '#10151d';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#ffc400';
        x.fillRect(0, 0, 70, h);
        x.fillStyle = '#10151d';
        x.textBaseline = 'middle';
        x.textAlign = 'center';
        x.font = `800 52px ${SANS}`;
        x.fillText(c, 35, 34);
        x.fillStyle = '#f4f7ff';
        x.textAlign = 'left';
        x.font = `700 36px ${SANS}`;
        x.fillText('CHECK-IN · BAG DROP', 90, 34);
      });
    const cx = (W / 2 + 8.5 + HW - 3.5) / 2, // the middle of each concourse
      queues = [];
    let row = 0;
    for (let z = -L / 2 + 26; z < -8; z += 26)
      for (const sd of [-1, 1]) {
        const x0 = sd * cx;
        for (let d = -3; d <= 3; d++) {
          put(box(1.7, 1.1, 0.9), white, x0 + d * 2.2, 0.14, z);
          put(box(1.7, 0.9, 0.06), maroon, x0 + d * 2.2, 0.2, z - 0.48);
          put(box(0.5, 0.45, 0.1), darkM, x0 + d * 2.2 + 0.4, 1.24, z);
          if (d % 2) queues.push([x0 + d * 2.2, z - 1.6]);
        }
        put(box(16.2, 0.5, 1.3), darkM, x0, 0.14, z + 1.7); // the belt
        put(box(16.2, 0.25, 0.5), steel, x0, 3.7, z);
        for (const dx of [-7.8, 7.8]) put(box(0.18, 3.6, 0.18), steel, x0 + dx, 0.14, z);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 1.1), rowM('ABCDEFGH'[row++ % 8]));
        m.position.set(x0, 3.05, z - 0.3);
        m.rotation.y = Math.PI;
        G.add(m);
      }
    // the second half: shops along the glass, seats, and a palm garden by the rail
    const SHOPS = [
      ['DUTY FREE', '#7a1430'],
      ['KARAK & CHAI', '#b8691c'],
      ['SOUQ GIFTS', '#1d6a5c'],
      ['DATES & SWEETS', '#8a5a1e'],
      ['BOOKS', '#27457e'],
      ['PEARLS', '#5b3f86'],
    ];
    const shopLit = glow(lam('#ffe9bf', { emissive: '#8a744a' }), null, '#ffdf9c', 1);
    let shop = 0;
    for (let z = 14; z < L / 2 - 12; z += 21)
      for (const sd of [-1, 1]) {
        const [name, col] = SHOPS[shop++ % SHOPS.length],
          x0 = sd * (HW - 4.5);
        put(box(7, 5, 15), white, x0, 0.14, z);
        put(box(0.3, 2.9, 12.4), shopLit, x0 - sd * 3.45, 0.3, z);
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(13, 1.5),
          lit(512, 60, (x, w, h) => {
            x.fillStyle = col;
            x.fillRect(0, 0, w, h);
            x.fillStyle = '#fff6e2';
            x.textBaseline = 'middle';
            x.textAlign = 'center';
            x.font = `800 44px ${SANS}`;
            x.fillText(name, w / 2, 32);
          }),
        );
        m.position.set(x0 - sd * 3.56, 4.2, z);
        m.rotation.y = (-sd * Math.PI) / 2;
        G.add(m);
        // two rows of seats back to back, facing the shops and the road
        for (const dx of [-0.5, 0.5]) {
          put(box(0.9, 0.45, 9), seatM, sd * (cx - 2) + dx, 0.14, z);
        }
        put(box(0.16, 1, 9), seatM, sd * (cx - 2), 0.14, z);
      }
    for (let z = 10; z < L / 2 - 10; z += 13)
      for (const sd of [-1, 1]) {
        const p = world(sd * (W / 2 + 4.2), z);
        palm(p.x, p.z);
        put(cylM(1.5, 1.2, 0.7, 12), white, sd * (W / 2 + 4.2), 0.14, z); // its planter
      }

    // outside: the apron on whichever side has room, a jet nosed up to the glass at each end of the hall, a jet bridge
    // to its door; and the control tower
    const jet = () => {
      const g = [],
        mk = (geo, x, y, z) => g.push(geo.translate(x, y, z));
      mk(new THREE.CylinderGeometry(2.1, 2.1, 28, 14).rotateZ(Math.PI / 2), 19, 4.7, 0);
      mk(new THREE.SphereGeometry(2.1, 14, 10).scale(2.3, 1, 1), 5, 4.7, 0);
      mk(new THREE.CylinderGeometry(2.1, 0.5, 9, 14).rotateZ(-Math.PI / 2), 37.5, 5.1, 0);
      for (const sd of [-1, 1]) {
        mk(new THREE.BoxGeometry(6.5, 0.4, 17).rotateY(sd * 0.42), 21.5, 3.9, sd * 10);
        mk(new THREE.BoxGeometry(3.6, 0.3, 6.5).rotateY(sd * 0.45), 39, 5.6, sd * 4.2);
      }
      return mergeGeometries(g.map(x => (x.index ? x.toNonIndexed() : x)));
    };
    const jetBody = jet(),
      jetTail = new THREE.BoxGeometry(6, 8, 0.45)
        .applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0.55, 0, 0, 0))
        .translate(38.6, 10.6, 0),
      jetDark = mergeGeometries(
        [
          new THREE.BoxGeometry(24, 0.4, 4.26).translate(19, 5.3, 0), // the windows
          new THREE.BoxGeometry(1.6, 0.6, 3.6).translate(4.2, 5.5, 0), // the cockpit
          ...[-1, 1].flatMap(sd => [
            new THREE.CylinderGeometry(1.15, 1, 4.6, 12).rotateZ(Math.PI / 2).translate(17.5, 2.6, sd * 7.2),
            new THREE.CylinderGeometry(0.55, 0.55, 1, 10).rotateX(Math.PI / 2).translate(21.5, 0.6, sd * 3),
            new THREE.BoxGeometry(0.3, 2.2, 0.3).translate(21.5, 1.7, sd * 3),
          ]),
          new THREE.CylinderGeometry(0.45, 0.45, 0.8, 10).rotateX(Math.PI / 2).translate(6.5, 0.5, 0),
          new THREE.BoxGeometry(0.25, 2.4, 0.25).translate(6.5, 1.6, 0),
        ].map(x => (x.index ? x.toNonIndexed() : x)),
      );
    const apronM = lam('#9aa0a6'),
      okAt = (x, z) => {
        const p = world(x, z);
        return k.land(p.x, p.z) && roadGap(p.x, p.z) > W / 2 + 8;
      };
    for (const sd of [-1, 1]) {
      const room = [HW + 10, HW + 30, HW + 52].every(x => [-L / 2, 0, L / 2].every(z => okAt(sd * x, z)));
      if (!room) continue;
      put(box(58, 1.3, L + 30), apronM, sd * (HW + 29.5), -0.5, 0); // (a thick slab: its top stands well clear of the sand)
      for (const z of [-L * 0.28, L * 0.28]) {
        const ry = sd > 0 ? 0 : Math.PI; // nose to the glass
        put(jetBody, white, sd * (HW + 7), 0.8, z, ry);
        put(jetTail, maroon, sd * (HW + 7), 0.8, z, ry);
        put(jetDark, darkM, sd * (HW + 7), 0.8, z, ry);
        put(box(11, 2.6, 2.6), steel, sd * (HW + 5.6), 3.4, z - 4.2); // the jet bridge
        put(box(0.5, 3.4, 0.5), darkM, sd * (HW + 10.4), 0, z - 4.2);
      }
      for (let z = -L / 2; z <= L / 2; z += 30) {
        const p = world(sd * (HW + 30), z);
        reserve(p.x, p.z, 34);
      }
    }
    for (const sd of [1, -1]) {
      const tx = sd * (HW + 16),
        tz = -L / 2 - 34;
      if (![-8, 0, 8].every(d => okAt(tx + d, tz) && okAt(tx, tz + d))) continue;
      put(cylM(3.2, 4.2, 40, 16), white, tx, 0, tz);
      put(cylM(7.2, 5, 5, 16), darkM, tx, 40, tz);
      put(cylM(6.2, 7.4, 1, 16), white, tx, 45, tz);
      put(cylM(0.2, 0.2, 7, 6), steel, tx, 46, tz);
      const p = world(tx, tz);
      reserve(p.x, p.z, 12);
      break;
    }

    for (const [mat, geos] of ab) {
      const m = new THREE.Mesh(mergeGeometries(geos.map(x => (x.index ? x.toNonIndexed() : x))), mat);
      if (mat === glassM) m.renderOrder = 2;
      else m.castShadow = m.receiveShadow = true;
      G.add(m);
    }

    // the travellers: walking the concourse either side of the road, both ways, some with a case rolling behind;
    // and a few standing in line at the desks
    const CLOTHES = [
        '#f3f1ea',
        '#f3f1ea',
        '#1c1c20',
        '#1c1c20',
        '#c8553d',
        '#2f6f9f',
        '#e2b23c',
        '#3f8f6a',
        '#7a4f9a',
        '#d98a3a',
      ],
      SKIN = ['#8d5a3b', '#a8744e', '#c99a72', '#6f4630', '#e0b890'],
      CASES = ['#d23b3b', '#2a2f3a', '#2f7fbf', '#e2a21c', '#3a8f5a'],
      n = 56 + queues.length;
    const pm = glow(new THREE.MeshLambertMaterial(), null, '#55504a', 1),
      body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.27, 0.85, 3, 8).translate(0, 0.84, 0), pm, n),
      heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.68, 0), pm, n),
      cases = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.62, 0.26).translate(0, 0.4, -0.55), pm, n);
    const col = new THREE.Color(),
      who = [];
    for (let i = 0; i < n; i++) {
      const q = queues[i - 56],
        sd = rand() < 0.5 ? -1 : 1,
        near = rand() < 0.6; // the walkway by the rail, or the one by the glass
      who.push(
        q
          ? { x: q[0], z: q[1], v: 0, dir: 1, ph: rand() * 6, bag: rand() < 0.7 }
          : {
              x: sd * (near ? rr(W / 2 + 1.6, W / 2 + 6.4) : rr(HW - 9.5, HW - 8.4)),
              z: rr(-L / 2 + 3, L / 2 - 3),
              v: rr(1.1, 1.7),
              dir: rand() < 0.5 ? -1 : 1,
              ph: rand() * 6,
              bag: rand() < 0.55,
            },
      );
      body.setColorAt(i, col.set(pick(CLOTHES)));
      heads.setColorAt(i, col.set(pick(SKIN)));
      cases.setColorAt(i, col.set(pick(CASES)));
    }
    for (const m of [body, heads, cases]) {
      m.frustumCulled = false;
      G.add(m);
    }
    const M4 = new THREE.Matrix4(),
      Q = new THREE.Quaternion(),
      V = new THREE.Vector3(),
      S1 = new THREE.Vector3(1, 1, 1),
      S0 = new THREE.Vector3(0, 0, 0),
      UP = new THREE.Vector3(0, 1, 0),
      span = L - 6;
    const walk = t => {
      for (let i = 0; i < n; i++) {
        const w = who[i],
          z = w.v ? ((((w.z + L / 2 - 3 + w.dir * w.v * t) % span) + span) % span) - span / 2 : w.z;
        V.set(w.x, 0.14 + (w.v ? Math.abs(Math.sin(t * w.v * 3.4 + w.ph)) * 0.06 : 0), z);
        Q.setFromAxisAngle(UP, w.dir > 0 ? 0 : Math.PI);
        M4.compose(V, Q, S1);
        body.setMatrixAt(i, M4);
        heads.setMatrixAt(i, M4);
        cases.setMatrixAt(i, w.bag ? M4 : M4.compose(V, Q, S0));
      }
      body.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = cases.instanceMatrix.needsUpdate = true;
    };
    walk(0);
    walkers.push(walk);

    scene.add(G);
    place(
      'HAMAD AIRPORT',
      'Straight through the departures hall and out past the jets',
      world(0, -L * 0.1),
      mid - L * 0.1,
      {
        back: 62,
        h: 3.2,
        lookH: 6,
      },
    );
  }

  /* ---------- the aquarium tunnel (The Pearl): a timber deck half a metre off the sea, then a glass tube under it ---------- */
  // The deck rides on piles; where the road dives, a glass tube carries it down to the sea bed and up again. The sea
  // you see from inside is built round the tube: its blue walls, a sandy bed with coral and weed, the surface
  // shimmering overhead, and fish swimming by. The real sheet of sea has a slot cut in it over the tube (clipped
  // away), so no water shows inside the glass.
  const swimmers = [];
  for (const f of fOf('lowbridge')) {
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
    for (let s = f.s; s < f.s + f.len; s += step, n++) {
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
      place('THE WATER BRIDGE', 'A deck half a metre off the sea', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
        back: 55,
        h: 3,
        lookH: 1,
      });
      continue;
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
    const both = { side: THREE.DoubleSide },
      HT = W / 2 + 0.9, // half the tube's width
      ARCH = [
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
        color: '#c9f1f6',
        transparent: true,
        opacity: 0.2,
        shininess: 120,
        depthWrite: false,
        ...both,
      }),
      3,
    );
    const ribs = [];
    for (let s = sA + 4.5; s < sB; s += 9) ribs.push(skin(inset(0.992), s - 0.3, s + 0.3, 1));
    for (const s of [sA, sB]) ribs.push(skin(inset(1.03), s - 0.9, s + 0.9, 1), skin(inset(0.97), s - 0.9, s + 0.9, 1)); // the two mouths: a deep white frame
    mesh(ribs, glow(lam('#f4f7f9', { emissive: '#30363a', ...both }), null, '#cfeff5', 0.9));
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
        new THREE.MeshBasicMaterial({ map: qaSign('AQUARIUM TUNNEL', 0, undefined, QA_BROWN) }), // brown: a place to visit
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
      deep = h => new THREE.Color('#57cfdc').lerp(new THREE.Color('#0a4d6e'), (TOP - h) / (TOP - BED));
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
        x.fillStyle = '#5c9ea3'; // pale sand, seen through a few metres of sea
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
        x.fillStyle = '#86dbe6';
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
        new THREE.MeshBasicMaterial({ map: surfT, color: '#58b9c9', fog: false, ...both }),
      );
    mesh(surf, new THREE.MeshBasicMaterial({ map: surfT, fog: false, ...both }));

    // Everything out in the water is painted by hand rather than lit: shaded by which way each face looks, and faded
    // towards the colour of the water the further it is from the glass, the way things are lost in real sea.
    const HAZE = new THREE.Color('#2b93a9'),
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
    const NB = 170,
      bub = new Float32Array(NB * 3),
      bubs = [];
    for (let c = 0; c < 17; c++) {
      const p = tr.point(lo + rand() * span, (c % 2 ? 1 : -1) * rr(HT + 2, FAR - 18), 0);
      for (let q = 0; q < 10; q++)
        bubs.push({ x: p.x, z: p.z, y0: rand() * (TOP - BED), v: rr(1.2, 2.2), ph: rand() * 6 });
    }
    const bubG = new THREE.BufferGeometry();
    bubG.setAttribute('position', new THREE.BufferAttribute(bub, 3));
    const bubP = new THREE.Points(
      bubG,
      new THREE.PointsMaterial({ color: '#eafcff', size: 0.2, transparent: true, opacity: 0.75, fog: false }),
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
        const eyes = [-1, 1].map(sd =>
          new THREE.SphereGeometry(0.035, 6, 4).translate(sd * sx * 0.56, sy * 0.12, 0.33),
        );
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
    place('THE AQUARIUM TUNNEL', 'Down a glass tube under the marina mouth, fish all round', tr.point(mid, 0), mid, {
      back: 45,
      h: 3,
      lookH: 2.5,
    });
  }

  /* ---------- the Corniche: dhows in the bay ---------- */
  // a dhow: a deep wooden hull, high square stern, raked prow, a mast leaning forward with the lateen yard and a furled sail
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-7, 3.2);
  hullShape.lineTo(-6.2, 0);
  hullShape.lineTo(5, 0);
  hullShape.quadraticCurveTo(7.5, 0.6, 9, 2.6);
  hullShape.lineTo(-7, 2.6);
  hullShape.lineTo(-7, 3.2);
  const hullG = new THREE.ExtrudeGeometry(hullShape, { depth: 3.4, bevelEnabled: false })
    .translate(0, 0, -1.7)
    .rotateY(Math.PI / 2);
  const rail = new THREE.BoxGeometry(3.5, 0.25, 15).translate(0, 2.7, -0.8);
  const mastG = new THREE.CylinderGeometry(0.14, 0.18, 11, 6).translate(0, 5.5, 0).rotateX(0.18).translate(0, 2, 1.5);
  const yardG = new THREE.CylinderGeometry(0.1, 0.1, 13, 5).rotateX(Math.PI / 2 - 0.5).translate(0, 10, 1);
  const sailG = new THREE.CylinderGeometry(0.35, 0.35, 11, 6).rotateX(Math.PI / 2 - 0.5).translate(0, 9.6, 1);
  for (const f of fOf('dhows'))
    place(
      'THE CORNICHE',
      'Wooden dhows moored along the bay',
      P(f.s + f.len / 2, waterSide(f.s + f.len / 2) * (W / 2 + 55)),
      f.s + f.len / 2,
      { back: 34, h: 3, lookH: 2 },
    );
  for (const f of fOf('dhows'))
    for (let s = f.s; s < f.s + f.len; s += 26) {
      const sd = waterSide(s),
        off = sd * (W / 2 + rr(46, 70)),
        p = P(s, off),
        a = head(s) + (rand() - 0.5) * 0.5;
      if (forkGap(p.x, p.z) < 22) continue;
      add(hullG, mats.wood, p.x, -1.6, p.z, a);
      add(rail, mats.woodDark, p.x, -1.6, p.z, a);
      add(mastG, mats.woodDark, p.x, -1.6, p.z, a);
      add(yardG, mats.woodDark, p.x, -1.6, p.z, a);
      add(sailG, mats.white, p.x, -1.6, p.z, a);
    }

  /* ---------- the Pearl Monument: an open oyster on a fountain plinth, its pearl inside ---------- */
  for (const f of fOf('pearlmon')) {
    const sd = waterSide(f.s),
      p = P(f.s, sd * (W / 2 + 18)),
      a = facing(p.x, p.z, f.s);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = a;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 1.2, 28), lam('#e9e4da'));
    plinth.position.y = 0.6;
    g.add(plinth);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 28), phong({ color: '#58c6d8' }));
    pool.position.y = 1.25;
    g.add(pool);
    const shellM = glow(lam('#f7f3ea', { side: THREE.DoubleSide }), null, '#6f7480', 1),
      shell = r => new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.3);
    const low = new THREE.Mesh(shell(4.2), shellM);
    low.scale.set(1, 0.45, 1.15);
    low.rotation.x = Math.PI;
    low.position.y = 3.2;
    g.add(low);
    const up = new THREE.Mesh(shell(4.2), shellM);
    up.scale.set(1, 0.5, 1.15);
    up.position.set(0, 3.3, -1.2);
    up.rotation.x = -0.85;
    g.add(up);
    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 24, 16),
      phong({ color: '#fbf6ee', specular: '#ffffff', shininess: 140 }),
    );
    pearl.position.set(0, 4.2, 0.6);
    g.add(pearl);
    g.traverse(o => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(g);
    reserve(p.x, p.z, 9);
    place('PEARL MONUMENT', 'The oyster and its pearl on the Corniche', p, f.s, { back: 26, h: 3, lookH: 3 });
  }

  /* ---------- the Museum of Islamic Art, on its islet out in the bay ---------- */
  for (const f of fOf('mia')) {
    const sd = waterSide(f.s),
      p = P(f.s, sd * (W / 2 + 120)),
      a = facing(p.x, p.z, f.s);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = a;
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 3, 8), lam('#e8dcc2'));
    isle.position.y = -1;
    isle.rotation.y = Math.PI / 8;
    g.add(isle);
    const lime = glow(lam('#efe4cf'), null, '#5e4c30', 1),
      shade = lam('#d9cbb0');
    const tier = (w, h, y, rot) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), lime);
      m.position.y = y + h / 2;
      m.rotation.y = rot;
      g.add(m);
    };
    // square to octagon to square: each block turned 45° on the one below, stepping up to the drum and its little dome
    tier(40, 14, 0.5, 0);
    tier(32, 10, 14.5, Math.PI / 4);
    tier(25, 9, 24.5, 0);
    tier(18, 7, 33.5, Math.PI / 4);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 6, 8), lime);
    drum.position.y = 43.5;
    drum.rotation.y = Math.PI / 8;
    g.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shade);
    dome.position.y = 46.5;
    dome.scale.y = 0.55;
    g.add(dome);
    // the tall window wall facing the bay (here, facing the road) and the deep-set "eye" up on the blocks
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 22),
      glow(phong({ color: '#36506e' }), null, '#ffc983', 0.9),
    );
    win.position.set(0, 12, 20.05);
    g.add(win);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(2.2, 8), lam('#3a2e22'));
    eye.position.set(0, 29, 12.6);
    g.add(eye);
    for (const sx of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 1), shade);
      arch.position.set(sx * 11, 4.5, 20.3);
      g.add(arch);
    }
    g.traverse(o => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(g);
    // the palm-lined causeway out to it
    const q = P(f.s, sd * (W / 2 + 26)),
      dx = p.x - q.x,
      dz = p.z - q.z,
      L = Math.hypot(dx, dz);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, L - 40), lam('#e3d6bb'));
    cw.position.set(q.x + (dx * (L - 40)) / L / 2, -0.6, q.z + (dz * (L - 40)) / L / 2);
    cw.rotation.y = Math.atan2(dx, dz);
    scene.add(cw);
    for (let t = 6; t < L - 46; t += 10)
      for (const o of [-1, 1]) palm(q.x + (dx / L) * t + (dz / L) * o * 4, q.z + (dz / L) * t - (dx / L) * o * 4);
    place('MUSEUM OF ISLAMIC ART', "I. M. Pei's stone blocks on their own island", p, f.s, {
      back: 70,
      h: 6,
      lookH: 20,
    });
  }

  /* ---------- West Bay: Doha Tower, the Tornado Tower and the cluster round them ---------- */
  const lattice = facade((x, w, h) => {
    // the mashrabiya: silver diamonds over dark glass, small and large together
    x.fillStyle = '#1d2c44';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#d8dee6';
    x.lineWidth = 5;
    for (let k2 = -2; k2 < 3; k2++) {
      x.beginPath();
      x.moveTo((k2 * w) / 2, 0);
      x.lineTo((k2 * w) / 2 + w, h);
      x.stroke();
      x.beginPath();
      x.moveTo((k2 * w) / 2 + w, 0);
      x.lineTo((k2 * w) / 2, h);
      x.stroke();
    }
    x.lineWidth = 2;
    x.strokeStyle = 'rgba(216,222,230,.7)';
    for (let k2 = -4; k2 < 5; k2++) {
      x.beginPath();
      x.moveTo((k2 * w) / 4, 0);
      x.lineTo((k2 * w) / 4 + w / 2, h);
      x.stroke();
      x.beginPath();
      x.moveTo((k2 * w) / 4 + w / 2, 0);
      x.lineTo((k2 * w) / 4, h);
      x.stroke();
    }
  });
  // by night the glass behind the lattice is lit and the mashrabiya stands out dark against it, cool blue-white
  const latticeLit = facade((x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7fb2ff');
    g.addColorStop(1, '#cfe3ff');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#000';
    x.lineWidth = 5;
    for (let k2 = -2; k2 < 3; k2++) {
      x.beginPath();
      x.moveTo((k2 * w) / 2, 0);
      x.lineTo((k2 * w) / 2 + w, h);
      x.stroke();
      x.beginPath();
      x.moveTo((k2 * w) / 2 + w, 0);
      x.lineTo((k2 * w) / 2, h);
      x.stroke();
    }
    x.lineWidth = 2;
    for (let k2 = -4; k2 < 5; k2++) {
      x.beginPath();
      x.moveTo((k2 * w) / 4, 0);
      x.lineTo((k2 * w) / 4 + w / 2, h);
      x.stroke();
      x.beginPath();
      x.moveTo((k2 * w) / 4 + w / 2, 0);
      x.lineTo((k2 * w) / 4, h);
      x.stroke();
    }
  });
  // the Tornado Tower's night: its LED skin, the diagonals bright over a softly lit core; night() sweeps it through colours
  const tornadoLit = facade((x, w, h) => {
    x.fillStyle = '#2a2a2a';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 8;
    for (let k2 = -1; k2 < 2; k2++) {
      x.beginPath();
      x.moveTo(k2 * w, 0);
      x.lineTo(k2 * w + w, h);
      x.stroke();
      x.beginPath();
      x.moveTo(k2 * w + w, 0);
      x.lineTo(k2 * w, h);
      x.stroke();
    }
  });
  let tornadoM = null;
  const tornadoT = facade((x, w, h) => {
    // white steel diagonals over blue glass
    x.fillStyle = '#2d5d86';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.15)';
    for (let y = 0; y < h; y += 16) x.fillRect(0, y, w, 2);
    x.strokeStyle = '#f2f4f7';
    x.lineWidth = 6;
    for (let k2 = -1; k2 < 2; k2++) {
      x.beginPath();
      x.moveTo(k2 * w, 0);
      x.lineTo(k2 * w + w, h);
      x.stroke();
      x.beginPath();
      x.moveTo(k2 * w + w, 0);
      x.lineTo(k2 * w, h);
      x.stroke();
    }
  });
  for (const f of fOf('westbay')) {
    // West Bay stands across the water from the Corniche, on its own stretch of shore (world.js raises the land)
    const mid = f.s + f.len * 0.5,
      cI = tr.idx(mid),
      ctr = tr.beside(cI, tr.out[cI] * (W / 2 + 330));
    const WB = (along, across) => {
      const t = tr.T[cI],
        l = tr.L[cI];
      return new THREE.Vector3(
        ctr.x + t.x * along + l.x * tr.out[cI] * across,
        0,
        ctr.z + t.z * along + l.z * tr.out[cI] * across,
      );
    };
    // Doha Tower: a cylinder in the lattice, the dome and the light on top
    {
      const p = WB(-20, -60),
        dt = new THREE.Group();
      dt.position.set(p.x, 0, p.z);
      const tm = glow(
        new THREE.MeshPhongMaterial({ map: lattice, shininess: 70, specular: '#ffffff' }),
        latticeLit,
        '#ffffff',
        1,
      );
      lattice.repeat.set(1, 1);
      const body = new THREE.Mesh(cylM(14, 14, 118, 36, 14), tm);
      dt.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(14, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), tm);
      cap.position.y = 118;
      cap.scale.y = 0.62;
      dt.add(cap);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 14, 8), lam('#dfe5ec'));
      spire.position.y = 133;
      dt.add(spire);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#cfe9ff' }),
      );
      beacon.position.y = 140.5;
      dt.add(beacon);
      dt.traverse(o => {
        if (o.isMesh) o.castShadow = true;
      });
      scene.add(dt);
      reserve(p.x, p.z, 18);
    }
    // the Tornado Tower: an hourglass, narrow at the waist, flaring out at the top
    {
      const p = WB(70, -50),
        pts = [];
      for (let k2 = 0; k2 <= 24; k2++) {
        const y = (k2 / 24) * 104,
          u = (y - 58) / 30;
        pts.push(new THREE.Vector2(8 * Math.sqrt(1 + u * u * 0.8), y));
      }
      const lg = new THREE.LatheGeometry(pts, 40),
        uv = lg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 6.5);
      tornadoM = new THREE.MeshPhongMaterial({
        map: tornadoT,
        emissiveMap: tornadoLit,
        emissive: '#000000',
        shininess: 90,
        specular: '#ffffff',
      });
      const tw = new THREE.Mesh(lg, tornadoM);
      tw.position.set(p.x, 0, p.z);
      tw.castShadow = true;
      scene.add(tw);
      const lid = new THREE.Mesh(new THREE.CircleGeometry(pts.at(-1).x, 40).rotateX(-Math.PI / 2), lam('#dfe5ec'));
      lid.position.set(p.x, 104, p.z);
      scene.add(lid);
      reserve(p.x, p.z, 18);
    }
    // the cluster: glass towers of all heights behind and between, a few cylinders and a few with cut tops
    place('WEST BAY', 'Doha Tower and the skyline across the water', WB(-20, -60), mid, {
      back: 0,
      lat: 0,
      h: 5,
      lookH: 55,
    });
    const keys = ['blue', 'teal', 'silver', 'dark', 'green'];
    occ.push([WB(-20, -60).x, WB(-20, -60).z, 20], [WB(70, -50).x, WB(70, -50).z, 18]);
    for (let n = 0; n < 40; n++) {
      const p = WB(rr(-150, 150), rr(-110, 90)),
        w = rr(14, 24),
        h = rr(45, 105);
      if (!k.land(p.x, p.z) || occ.some(o => Math.hypot(o[0] - p.x, o[1] - p.z) < o[2] + w * 0.75)) continue;
      occ.push([p.x, p.z, w * 0.75]);
      const m = mats[pick(keys)],
        r = rand();
      if (r < 0.3) add(cylM(w / 2, w / 2, h, 20), m, p.x, 0, p.z);
      else if (r < 0.45) {
        add(boxM(w, h, w), m, p.x, 0, p.z, rand() * Math.PI);
        add(boxM(w * 0.6, h * 0.2, w * 0.6), m, p.x, h, p.z, rand() * Math.PI);
      } // a stepped crown
      else add(boxM(w, h, w * rr(0.7, 1)), m, p.x, 0, p.z, rand() * Math.PI);
    }
  }

  /* ---------- Katara: the amphitheatre, the pigeon towers, the golden mosque ---------- */
  for (const f of fOf('katara')) {
    const sd = -inside(f.s);
    place(
      'KATARA',
      'The amphitheatre, the pigeon towers, the golden mosque',
      P(f.s + 30, sd * (W / 2 + 45)),
      f.s + 30,
      { lookH: 6 },
    );
    {
      const p = P(f.s + 30, sd * (W / 2 + 45)),
        a = facing(p.x, p.z, f.s + 30),
        g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = a + Math.PI;
      for (let r2 = 0; r2 < 9; r2++) {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(10 + r2 * 2.2, 10 + r2 * 2.2, 1 + r2 * 1.1, 32, 1, false, -Math.PI / 2, Math.PI),
          mats.white,
        );
        m.position.y = (1 + r2 * 1.1) / 2;
        g.add(m);
      }
      const stage = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 0.8, 24, 1, false, Math.PI / 2, Math.PI),
        lam('#d8cbb2'),
      );
      stage.position.y = 0.4;
      g.add(stage);
      for (let c2 = 0; c2 <= 14; c2++) {
        const t = -Math.PI / 2 + (c2 / 14) * Math.PI,
          col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8), mats.white);
        col.position.set(Math.sin(t) * 29.5, 11 + 2.5, Math.cos(t) * 29.5);
        g.add(col);
      }
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(30.2, 30.2, 1, 40, 1, true, -Math.PI / 2, Math.PI),
        mats.white,
      );
      ring.material = lam('#f4f2ec', { side: THREE.DoubleSide });
      ring.position.y = 16.5;
      g.add(ring);
      g.traverse(o => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      scene.add(g);
      reserve(p.x, p.z, 32);
    }
    // the pigeon towers: tapering mud towers, pierced with holes, sticks poking out for perches
    const holes = facade((x, w, h) => {
      x.fillStyle = '#c9a77a';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#4a3020';
      for (let r2 = 0; r2 < 8; r2++)
        for (let c2 = 0; c2 < 8; c2++) x.fillRect(c2 * 16 + (r2 % 2) * 8 + 5, r2 * 16 + 5, 5, 6);
    });
    const pig = new THREE.MeshLambertMaterial({ map: holes });
    for (let n = 0; n < 3; n++) {
      const p = P(f.s + 70 + n * 9, sd * (W / 2 + 24 + n * 7));
      add(cylM(1.6, 3.4, 15, 14, 4), pig, p.x, 0, p.z);
      add(new THREE.ConeGeometry(1.9, 2.4, 14).translate(0, 16.2, 0), mats.mud, p.x, 0, p.z);
      reserve(p.x, p.z, 4.5);
    }
    // the golden mosque: a dome in gold tiles and a slim minaret
    {
      const p = P(f.s + 100, sd * (W / 2 + 40));
      add(boxM(16, 9, 16), mats.cream, p.x, 0, p.z);
      const d2 = new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      add(d2.translate(0, 9, 0), mats.gold, p.x, 0, p.z);
      add(cylM(1.4, 1.6, 26, 10), mats.cream, p.x + 10, 0, p.z);
      add(new THREE.ConeGeometry(1.6, 4, 10).translate(0, 28, 0), mats.gold, p.x + 10, 0, p.z);
      reserve(p.x, p.z, 13);
    }
  }

  /* ---------- Lusail: the Katara Towers either side of the road ---------- */
  const goldGlass = glow(
    phong({ map: glassTex(['#8a6326', '#e2b55a']), specular: '#fff3cf' }),
    litTex(128, 128, grid(8, 4, 128, 128, 1, 4), 0.75, WARMLIT, '#4a2c08'),
    '#ffffff',
    1.1,
  );
  for (const f of fOf('kataratowers')) {
    // a crescent standing on its tip: the plan is a thin slab, the elevation a curved blade; the two curve away from each
    // other like the crossed swords, so the road runs through the gap between their feet
    // a crescent between two equal circles offset by its thickness: fat in the middle, tapering to points top and bottom;
    // the convex back faces the road and the tips curve away, so the pair reads as the crossed blades
    const R = 120,
      th = 40,
      pts = [];
    const lim = Math.acos(th / 2 / R);
    for (let k2 = 0; k2 <= 40; k2++) {
      const a2 = Math.PI - lim + (2 * lim * k2) / 40;
      pts.push(new THREE.Vector2(R + R * Math.cos(a2), R * Math.sin(a2)));
    }
    for (let k2 = 40; k2 >= 0; k2--) {
      const a2 = Math.PI - lim + (2 * lim * k2) / 40;
      pts.push(new THREE.Vector2(th + R + R * Math.cos(a2) + 0, R * Math.sin(a2)));
    }
    const bg = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 34, bevelEnabled: false })
      .translate(-th / 2 + 2, 34, -17)
      .scale(1, 0.72, 1); // the lower tip buried, ~110 m standing
    {
      const uv = bg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 16, uv.getY(i) / 16);
    }
    const p0 = tr.point(f.s, 0),
      a = head(f.s),
      l = tr.L[tr.idx(f.s)];
    place('KATARA TOWERS', 'Two golden crescents, the crossed swords', p0, f.s, { back: 170, h: 7, lookH: 40 });
    for (const sd of [-1, 1]) {
      const m = new THREE.Mesh(bg, goldGlass);
      m.position.set(p0.x + l.x * sd * (W / 2 + 34), 0, p0.z + l.z * sd * (W / 2 + 34));
      m.rotation.y = a + (sd > 0 ? Math.PI / 2 : -Math.PI / 2);
      m.scale.setScalar(0.78);
      m.castShadow = true;
      scene.add(m); // turned so the tips curve away from the road (they never meet)
      reserve(m.position.x, m.position.z, 16);
      const pod = new THREE.Mesh(boxM(40, 8, 34), mats.cream);
      pod.position.copy(m.position);
      pod.rotation.y = a;
      scene.add(pod);
    }
    // their podium: a low cream block under each, by the water
  }

  /* ---------- Lusail Stadium: the golden bowl ---------- */
  const stadT = facade(
    (x, w, h) => {
      // burnished gold with rows of triangular openings, dark by day
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f0c66a');
      g.addColorStop(1, '#b8862e');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#3a2410';
      for (let r2 = 0; r2 < 4; r2++)
        for (let c2 = 0; c2 < 8; c2++) {
          const ox = c2 * 16 + (r2 % 2) * 8,
            oy = r2 * 32 + 6;
          x.beginPath();
          x.moveTo(ox + 2, oy + 22);
          x.lineTo(ox + 8, oy + 4);
          x.lineTo(ox + 14, oy + 22);
          x.fill();
        }
    },
    128,
    128,
  );
  // by night the bowl is a lantern: the triangles glow from the stands inside, the gold skin warm around them
  const stadLit = facade(
    (x, w, h) => {
      x.fillStyle = '#4a2a08';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffd27a';
      for (let r2 = 0; r2 < 4; r2++)
        for (let c2 = 0; c2 < 8; c2++) {
          const ox = c2 * 16 + (r2 % 2) * 8,
            oy = r2 * 32 + 6;
          x.beginPath();
          x.moveTo(ox + 2, oy + 22);
          x.lineTo(ox + 8, oy + 4);
          x.lineTo(ox + 14, oy + 22);
          x.fill();
        }
    },
    128,
    128,
  );
  const stadM = glow(
    new THREE.MeshPhongMaterial({ map: stadT, emissiveMap: stadLit, shininess: 60, specular: '#fff0c4' }),
    null,
    '#ffffff',
    1.2,
  );
  for (const f of fOf('stadium')) {
    // the bowl sits in the middle of the left-hander: find the turn's centre (the point the arc stays 100 m from)
    const R = f.r || 100,
      sm = f.s + (R * (f.deg || 90) * Math.PI) / 360,
      i = tr.idx(sm),
      l = tr.L[i],
      pm = tr.P[i];
    // the true centre is R from the start, the middle and the end of the bend at once (the far side only matches the middle)
    const arcEnd = f.s + (R * (f.deg || 90) * Math.PI) / 180,
      ends = [f.s + 5, sm, arcEnd - 5].map(s => tr.P[tr.idx(s)]);
    let c = null;
    for (const sd of [-1, 1]) {
      const q = { x: pm.x + l.x * sd * R, z: pm.z + l.z * sd * R };
      const e = ends.reduce((acc, e2) => acc + Math.abs(Math.hypot(e2.x - q.x, e2.z - q.z) - R), 0);
      if (!c || e < c.e) c = { x: q.x, z: q.z, e };
    }
    const pts = [];
    for (let k2 = 0; k2 <= 12; k2++) {
      const t = k2 / 12;
      pts.push(new THREE.Vector2(52 + 18 * Math.sin(t * Math.PI * 0.55), t * 34));
    }
    const bowl = new THREE.LatheGeometry(pts, 64);
    {
      const uv = bowl.attributes.uv;
      for (let n = 0; n < uv.count; n++) uv.setXY(n, uv.getX(n) * 26, uv.getY(n) * 2.6);
    }
    const st = new THREE.Mesh(bowl, stadM);
    st.position.set(c.x, 0, c.z);
    st.castShadow = true;
    scene.add(st);
    // the roof: a white ring sloping gently in, open in the middle over the pitch
    const roof = new THREE.Mesh(
      new THREE.RingGeometry(24, 69, 64, 1).rotateX(-Math.PI / 2),
      lam('#f5f3ee', { side: THREE.DoubleSide }),
    );
    roof.position.set(c.x, 34.5, c.z);
    scene.add(roof);
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(24, 32).rotateX(-Math.PI / 2), lam('#4f9a3c'));
    pitch.position.set(c.x, 2, c.z);
    scene.add(pitch);
    // floodlights over the pitch at night, seen through the open roof
    const flood = new THREE.Mesh(
      new THREE.CircleGeometry(24, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: '#fff8e6',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    flood.position.set(c.x, 2.1, c.z);
    scene.add(flood);
    glowing.push({
      fn: n => {
        flood.material.opacity = n * 0.5;
      },
    });
    reserve(c.x, c.z, 72);
    k.stadium = { x: c.x, z: c.z };
    void free;
    place('LUSAIL STADIUM', 'The golden bowl where the 2022 final was played', { x: c.x, y: 0, z: c.z }, f.s - 40, {
      back: 0,
      h: 6,
      lookH: 14,
    });
  }

  /* ---------- the Lusail boulevard: towers along the east side, flags on the lamp line ---------- */
  for (const f of fOf('boulevard'))
    place(
      'LUSAIL BOULEVARD',
      'Towers down both sides of the avenue',
      tr.point(f.s + f.len * 0.6, 0),
      f.s + f.len * 0.6,
      { back: 60, h: 2.4, lookH: 6 },
    );
  for (const f of fOf('boulevard'))
    for (let s = f.s; s < f.s + f.len; s += 22) {
      const sd = -inside(s),
        p = P(s, sd * (W / 2 + rr(28, 60))),
        w = rr(14, 20),
        h = rr(40, 80);
      if (!free(p.x, p.z, w * 0.6, W / 2 + 6)) continue;
      reserve(p.x, p.z, w * 0.6);
      add(boxM(w, h, w), mats[pick(['blue', 'silver', 'teal'])], p.x, 0, p.z, head(s));
    }

  /* ---------- The Pearl: Porto Arabia round the marina, yachts, and the Qanat Quartier ---------- */
  const resT = facade((x, w, h) => {
    // Mediterranean flats: pale render, arched windows framed in white, a balcony rail under each
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h);
    for (let r2 = 0; r2 < 4; r2++)
      for (let c2 = 0; c2 < 4; c2++) {
        const ox = c2 * 32 + 8,
          oy = r2 * 32 + 6;
        x.fillStyle = '#f7f3ea';
        x.fillRect(ox - 3, oy - 2, 22, 24);
        x.fillStyle = '#3d4a5a';
        x.beginPath();
        x.moveTo(ox, oy + 20);
        x.lineTo(ox, oy + 8);
        x.arc(ox + 8, oy + 8, 8, Math.PI, 0);
        x.lineTo(ox + 16, oy + 20);
        x.fill();
        x.fillStyle = '#e9e2d4';
        x.fillRect(ox - 4, oy + 21, 24, 3);
      }
  });
  const resCells = [];
  for (let r2 = 0; r2 < 4; r2++) for (let c2 = 0; c2 < 4; c2++) resCells.push([c2 * 32 + 8, r2 * 32 + 6, 16, 20]);
  const resLit = [litTex(128, 128, resCells, 0.5, WARMLIT), litTex(128, 128, resCells, 0.4, WARMLIT)];
  const WARM = ['#e6b98a', '#efcfa0', '#d99b74', '#f0dcc0', '#e3a98e'],
    resMs = WARM.map((c, i) =>
      glow(new THREE.MeshLambertMaterial({ color: c, map: resT }), resLit[i % 2], '#ffffff', 1),
    ),
    resM = resMs[1];
  const tops = [lam('#c7643a'), lam('#d9a640'), lam('#e6d6b8')];
  for (const f of fOf('portoarabia'))
    place(
      'PORTO ARABIA',
      'Towers round the marina and its yachts',
      P(f.s + f.len / 2, inside(f.s + f.len / 2) * (W / 2 + 60)),
      f.s + f.len / 2 - 20,
      { back: 30, h: 5, lookH: 6 },
    );
  for (const f of fOf('portoarabia'))
    for (let s = f.s; s < f.s + f.len; s += 24) {
      const sd = -inside(s),
        p = P(s, sd * (W / 2 + rr(24, 36))),
        w = rr(16, 20),
        h = rr(26, 44),
        a = facing(p.x, p.z, s);
      if (!free(p.x, p.z, w * 0.55, W / 2 + 6)) continue;
      reserve(p.x, p.z, w * 0.55);
      add(boxM(w, h, w * 0.7), pick(resMs), p.x, 0, p.z, a);
      add(
        new THREE.CylinderGeometry(w * 0.35, w * 0.35, w * 0.7, 16, 1, false, 0, Math.PI)
          .rotateZ(Math.PI / 2)
          .rotateY(Math.PI / 2)
          .translate(0, h, 0),
        pick(tops),
        p.x,
        0,
        p.z,
        a,
      ); // the arched crown
    }
  // yachts in the marina inside the hairpin
  for (const f of fOf('portoarabia'))
    for (let n = 0; n < 40; n++) {
      const s = f.s + 40 + rand() * (f.len - 40),
        sd = inside(s),
        p = P(s, sd * (W / 2 + rr(40, 90)));
      if (roadGap(p.x, p.z) < W / 2 + 36 || forkGap(p.x, p.z) < 18) continue;
      add(yachtG, mats.white, p.x, -1.1, p.z, rand() * Math.PI * 2);
    }
  const QANAT = ['#e9b98c', '#e3a8a0', '#c9d3b0', '#efdfc0', '#d8b0c4', '#b9cfd6'];
  const qT = facade(
    (x, w, h) => {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, h);
      for (let r2 = 0; r2 < 3; r2++)
        for (let c2 = 0; c2 < 3; c2++) {
          const ox = c2 * 42 + 12,
            oy = r2 * 42 + 8;
          x.fillStyle = '#6f8f86';
          x.fillRect(ox - 7, oy, 6, 24);
          x.fillRect(ox + 19, oy, 6, 24);
          x.fillStyle = '#3e3a36';
          x.beginPath();
          x.moveTo(ox, oy + 24);
          x.lineTo(ox, oy + 9);
          x.arc(ox + 9, oy + 9, 9, Math.PI, 0);
          x.lineTo(ox + 18, oy + 24);
          x.fill();
          x.fillStyle = '#f2ece2';
          x.fillRect(ox - 2, oy + 24, 22, 3);
        }
    },
    128,
    128,
  );
  const qCells = [];
  for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 3; c2++) qCells.push([c2 * 42 + 12, r2 * 42 + 10, 18, 22]);
  const qLit = litTex(128, 128, qCells, 0.55, WARMLIT);
  const qMats = QANAT.map(c => glow(new THREE.MeshLambertMaterial({ color: c, map: qT }), qLit, '#ffffff', 1));
  for (const f of fOf('qanat'))
    for (let s = f.s; s < f.s + f.len; s += 13)
      for (const sd of [-1, 1]) {
        const p = P(s, sd * (W / 2 + rr(18, 24))),
          w = rr(10, 13),
          h = rr(10, 15),
          a = facing(p.x, p.z, s);
        if (!free(p.x, p.z, w * 0.5, W / 2 + 4)) continue;
        reserve(p.x, p.z, w * 0.5);
        if (s > f.s + f.len * 0.55)
          place('QANAT QUARTIER', 'Pastel houses along the canals', p, s, { back: 30, h: 3, lookH: 7 }); // (the first house past halfway)
        add(boxM(w, h, 9, 14), pick(qMats), p.x, 0, p.z, a);
        add(
          new THREE.ConeGeometry(w * 0.72, 3, 4)
            .rotateY(Math.PI / 4)
            .scale(1, 1, 9 / w)
            .translate(0, h + 1.5, 0),
          mats.terracotta,
          p.x,
          0,
          p.z,
          a,
        ); // the terracotta roof
      }

  /* ---------- Msheireb Downtown: pale stone blocks, deep-set slot windows, shaded ground floors ---------- */
  const mshT = facade((x, w, h) => {
    x.fillStyle = '#e6d3b0';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#d4bf98';
    for (let y = 60; y < h; y += 64) x.fillRect(0, y, w, 4);
    for (let r2 = 0; r2 < 2; r2++)
      for (let c2 = 0; c2 < 4; c2++) {
        const ox = c2 * 32 + 9,
          oy = r2 * 64 + 16;
        x.fillStyle = '#c4ab80';
        x.fillRect(ox - 2, oy - 2, 18, 34);
        x.fillStyle = '#5a4634';
        x.fillRect(ox, oy, 14, 30);
        x.fillStyle = 'rgba(255,240,210,.25)';
        for (let yy = oy + 4; yy < oy + 30; yy += 6) x.fillRect(ox, yy, 14, 2);
      }
  });
  const mshCells = [];
  for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 4; c2++) mshCells.push([c2 * 32 + 9, r2 * 64 + 16, 14, 30]);
  const mshM = glow(
      new THREE.MeshLambertMaterial({ map: mshT }),
      litTex(128, 128, mshCells, 0.55, WARMLIT),
      '#ffffff',
      1,
    ),
    finM = lam('#d2bd96');
  for (const f of fOf('msheireb'))
    place(
      'MSHEIREB DOWNTOWN',
      'Old Doha rebuilt in pale stone and shade',
      tr.point(f.s + f.len / 2, 0),
      f.s + f.len / 2,
      { back: 30, h: 3, lookH: 8 },
    );
  for (const f of fOf('msheireb'))
    for (let s = f.s; s < f.s + f.len; s += 17)
      for (const sd of [-1, 1]) {
        const p = P(s, sd * (W / 2 + rr(16, 22))),
          w = rr(13, 17),
          h = rr(12, 26);
        const a = facing(p.x, p.z, s);
        if (!free(p.x, p.z, w * 0.5, W / 2 + 4)) continue;
        reserve(p.x, p.z, w * 0.5);
        add(boxM(w, h, w * 0.8), mshM, p.x, 0, p.z, a);
        add(boxM(w * 0.45, h * 0.25, w * 0.45), mshM, p.x, h, p.z, a); // a roof pavilion
        if (rand() < 0.5) add(boxM(1.2, h + 6, 2.4), finM, p.x, 0, p.z, a); // a wind-tower fin
      }
  for (const f of fOf('barahat')) {
    // Barahat Msheireb: the town square under its great white canopy
    const sd = -inside(f.s),
      p = P(f.s, sd * (W / 2 + 32)),
      a = head(f.s);
    add(
      boxM(46, 0.8, 34).translate(0, 15, 0),
      glow(new THREE.MeshLambertMaterial({ color: '#f6f3ec', emissive: '#6d6a63' }), null, '#fff0d2', 0.85),
      p.x,
      0,
      p.z,
      a,
    );
    place('BARAHAT MSHEIREB', 'The town square under its great white canopy', p, f.s, { back: 40, h: 6, lookH: 13 }); // a white canopy, lit from under by the square
    for (const [u, v] of [
      [-20, -14],
      [20, -14],
      [-20, 14],
      [20, 14],
      [0, -14],
      [0, 14],
    ]) {
      const c = Math.cos(a),
        s2 = Math.sin(a);
      add(cylM(0.45, 0.45, 15, 8), mats.white, p.x + u * c + v * s2, 0, p.z - u * s2 + v * c);
    }
    add(boxM(44, 0.2, 32), lam('#d9cdb4'), p.x, 0, p.z, a);
    reserve(p.x, p.z, 26);
  }

  /* ---------- Souq Waqif: mud-rendered walls, the roof beams sticking out, wooden doors ---------- */
  const souqM = glow(lam('#c9a374'), null, '#4a2c10', 1),
    souqWin = glow(lam('#4a2e18'), null, '#ffb35c', 0.95),
    beamG = new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6).rotateX(Math.PI / 2);
  for (const f of fOf('souq'))
    place('SOUQ WAQIF', 'The old market: mud walls and timber beams', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 26,
      h: 2.6,
      lookH: 4,
    });
  for (const f of fOf('souq'))
    for (let s = f.s; s < f.s + f.len; s += 11)
      for (const sd of [-1, 1]) {
        const p = P(s, sd * (W / 2 + rr(13, 16))),
          w = rr(9, 12),
          h = rr(6.5, 8.5),
          a = facing(p.x, p.z, s);
        if (!free(p.x, p.z, w * 0.45, W / 2 + 4)) continue;
        reserve(p.x, p.z, w * 0.45);
        add(boxM(w, h, 8), souqM, p.x, 0, p.z, a);
        add(boxM(w, 0.9, 8.2).translate(0, h, 0), lam('#b8915f'), p.x, 0, p.z, a); // the parapet
        for (let b = -w / 2 + 1; b < w / 2; b += 1.3)
          add(beamG.clone().translate(b, h - 1.1, 4.4), mats.woodDark, p.x, 0, p.z, a);
        add(boxM(2, 3, 0.3).translate(rr(-w / 4, w / 4), 0, 4.05), mats.wood, p.x, 0, p.z, a);
        for (let wx = -w / 2 + 2; wx < w / 2 - 1; wx += 3)
          add(boxM(1, 1.3, 0.25).translate(wx, h - 3.3, 4.05), souqWin, p.x, 0, p.z, a); // small windows up top, lamplit at night
      }

  /* ---------- the Fanar: the spiral minaret, a ramp winding round a tapering tower ---------- */
  for (const f of fOf('fanar')) {
    const sd = -inside(f.s),
      p = P(f.s, sd * (W / 2 + 30)),
      sand = glow(lam('#dcb98a'), null, '#6e4618', 1);
    place('THE FANAR', 'The spiral minaret', p, f.s, { back: 40, h: 3, lookH: 18 });
    add(cylM(7, 7, 3, 24), sand, p.x, 0, p.z);
    add(cylM(2.2, 6, 34, 20), sand, p.x, 3, p.z);
    const helix = [];
    for (let n = 0; n <= 160; n++) {
      const t = n / 160,
        ang = t * Math.PI * 2 * 4.5,
        r2 = 6.6 - t * 4.2;
      helix.push(new THREE.Vector3(Math.cos(ang) * r2, 3 + t * 33, Math.sin(ang) * r2));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 320, 0.9, 6), souqM, p.x, 0, p.z);
    add(new THREE.ConeGeometry(1.2, 5, 10).translate(0, 39.5, 0), lam('#e8d6b2'), p.x, 0, p.z);
    const m2 = P(f.s + 22, sd * (W / 2 + 30));
    add(boxM(20, 10, 20), mats.cream, m2.x, 0, m2.z, head(f.s));
    add(
      new THREE.SphereGeometry(7, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 10, 0),
      mats.cream,
      m2.x,
      0,
      m2.z,
    );
    reserve(p.x, p.z, 9);
    reserve(m2.x, m2.z, 14);
  }

  /* ---------- the Amiri Diwan: a long white arcade and its clock tower ---------- */
  const arcT = facade((x, w, h) => {
    x.fillStyle = '#f6f4ee';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#8c9aa8';
    for (let c2 = 0; c2 < 4; c2++) {
      x.beginPath();
      x.moveTo(c2 * 32 + 6, h);
      x.lineTo(c2 * 32 + 6, 60);
      x.arc(c2 * 32 + 16, 60, 10, Math.PI, 0);
      x.lineTo(c2 * 32 + 26, h);
      x.fill();
    }
  });
  for (const f of fOf('diwan')) {
    const arcCells = [];
    for (let c2 = 0; c2 < 4; c2++) arcCells.push([c2 * 32 + 6, 52, 20, 76]);
    const sd = -inside(f.s),
      p = P(f.s + 40, sd * (W / 2 + 34)),
      a = head(f.s + 40),
      arcM = glow(new THREE.MeshLambertMaterial({ map: arcT }), litTex(128, 128, arcCells, 1, WARMLIT), '#ffffff', 0.9);
    place('AMIRI DIWAN', 'The clock tower and its white arcade', p, f.s + 10, { back: 20, h: 3, lookH: 14 });
    // (a turns local z along the road, so the long arcade takes a + 90 deg to run beside it, not across it; the tower turns its clock to the road)
    const al = a + Math.PI / 2,
      fa = facing(p.x, p.z, f.s + 40);
    add(boxM(90, 12, 22, 16), arcM, p.x, 0, p.z, al);
    add(boxM(92, 1.2, 24).translate(0, 12, 0), lam('#c8b27a'), p.x, 0, p.z, al);
    add(boxM(9, 30, 9), mats.white, p.x, 0, p.z, fa);
    add(new THREE.ConeGeometry(6.5, 6, 4).rotateY(Math.PI / 4).translate(0, 33, 0), lam('#2f7d5a'), p.x, 0, p.z, fa);
    const face = new THREE.CircleGeometry(2.6, 24).translate(0, 25, 4.55);
    add(face, lam('#fdfbf4'), p.x, 0, p.z, fa);
    add(new THREE.RingGeometry(2.6, 3, 24).translate(0, 25, 4.56), lam('#c8a24a'), p.x, 0, p.z, fa);
    reserve(p.x, p.z, 48);
  }

  /* ---------- The Pearl: Medina Centrale's piazza, Viva Bahriya's beach ---------- */
  for (const f of fOf('medina'))
    place('MEDINA CENTRALE', 'The piazza at the heart of The Pearl', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 30,
      h: 3,
      lookH: 9,
    });
  for (const f of fOf('medina'))
    for (let s = f.s; s < f.s + f.len; s += 18)
      for (const sd of [-1, 1]) {
        const p = P(s, sd * (W / 2 + rr(18, 24))),
          w = rr(14, 18),
          h = rr(18, 26),
          a = facing(p.x, p.z, s);
        if (!free(p.x, p.z, w * 0.5, W / 2 + 4)) continue;
        reserve(p.x, p.z, w * 0.5);
        add(boxM(w, h, 12), pick(resMs), p.x, 0, p.z, a);
        add(boxM(w + 1, 1.2, 13).translate(0, h, 0), pick(tops), p.x, 0, p.z, a);
      }
  const UMB = ['#ff6a00', '#2ec4b6', '#ffc22e', '#f4f2ec', '#3a7bfd'];
  for (const f of fOf('beach'))
    place(
      'THE BEACH',
      'Umbrellas on the sand by the water',
      P(f.s + f.len / 2, -inside(f.s + f.len / 2) * (W / 2 + 20)),
      f.s + f.len / 2,
      { back: 30, h: 3, lookH: 1 },
    );
  for (const f of fOf('beach'))
    for (let s = f.s; s < f.s + f.len; s += 9) {
      const sd = -inside(s),
        p = P(s, sd * (W / 2 + rr(14, 26)));
      if (roadGap(p.x, p.z) < W / 2 + 8) continue;
      add(cylM(0.08, 0.08, 2.6, 5), mats.white, p.x, 0, p.z);
      add(new THREE.ConeGeometry(1.8, 0.7, 10).translate(0, 2.8, 0), lam(pick(UMB)), p.x, 0, p.z);
    }
  for (const f of fOf('beach'))
    for (let s = f.s + 20; s < f.s + f.len; s += 40) {
      // the beach towers behind, Moroccan arches on top
      const sd = inside(s),
        p = P(s, sd * (W / 2 + rr(26, 40))),
        w = rr(15, 19),
        h = rr(36, 52),
        a = head(s);
      if (!free(p.x, p.z, w * 0.55, W / 2 + 6)) continue;
      reserve(p.x, p.z, w * 0.55);
      add(boxM(w, h, w * 0.8), resM, p.x, 0, p.z, a);
      add(
        new THREE.CylinderGeometry(w * 0.3, w * 0.3, w * 0.8, 16, 1, false, 0, Math.PI)
          .rotateZ(Math.PI / 2)
          .rotateY(Math.PI / 2)
          .translate(0, h, 0),
        mats.terracotta,
        p.x,
        0,
        p.z,
        a,
      );
    }

  /* ---------- Lusail Marina: towers on the land side, yachts moored on the water side ---------- */
  for (const f of fOf('lusailmarina'))
    place('LUSAIL MARINA', 'Glass towers over the yacht moorings', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 50,
      h: 4,
      lookH: 22,
    });
  for (const f of fOf('lusailmarina'))
    for (let s = f.s; s < f.s + f.len; s += 24) {
      const sd = inside(s),
        p = P(s, sd * (W / 2 + rr(26, 46))),
        w = rr(16, 22),
        h = rr(55, 95);
      if (free(p.x, p.z, w * 0.7)) {
        reserve(p.x, p.z, w * 0.7);
        add(
          rand() < 0.3 ? cylM(w / 2, w / 2, h, 20) : boxM(w, h, w),
          mats[pick(['blue', 'teal', 'silver', 'dark'])],
          p.x,
          0,
          p.z,
          head(s),
        );
      }
      for (let y = 0; y < 2; y++) {
        const q = P(s + rr(-8, 8), -sd * (W / 2 + rr(44, 70)));
        if (forkGap(q.x, q.z) < 18) continue;
        add(yachtG, mats.white, q.x, -1.1, q.z, head(s) + Math.PI / 2 + rr(-0.2, 0.2));
      }
    }

  /* ---------- the low city: everything behind the landmarks ---------- */
  // Doha between its icons: flat-roofed villas and walk-ups in sand, cream and white, parapets round every roof and the
  // white water tanks that sit on all of them; some with a set-back top floor, some with mashrabiya screens; a
  // neighbourhood mosque (dome and minaret) every so often; and further back, mid-rise flats and offices
  const lowW = facade((x, w, h) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.06)';
    x.fillRect(0, h - 4, w, 4);
    for (let r2 = 0; r2 < 4; r2++)
      for (let c2 = 0; c2 < 4; c2++) {
        const ox = c2 * 32 + 10,
          oy = r2 * 32 + 8;
        x.fillStyle = 'rgba(0,0,0,.12)';
        x.fillRect(ox - 2, oy - 2, 16, 20);
        x.fillStyle = '#5c6b7a';
        x.fillRect(ox, oy, 12, 16);
        x.fillStyle = 'rgba(255,255,255,.35)';
        x.fillRect(ox, oy, 12, 2);
      }
  });
  const lowS = facade((x, w, h) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h); // mashrabiya: tall timber screens over the windows
    for (let r2 = 0; r2 < 4; r2++)
      for (let c2 = 0; c2 < 3; c2++) {
        const ox = c2 * 42 + 11,
          oy = r2 * 32 + 5;
        x.fillStyle = '#7a5434';
        x.fillRect(ox, oy, 20, 24);
        x.strokeStyle = 'rgba(255,230,190,.45)';
        x.lineWidth = 1;
        for (let d = -24; d < 24; d += 5) {
          x.beginPath();
          x.moveTo(ox + d, oy);
          x.lineTo(ox + d + 24, oy + 24);
          x.stroke();
          x.beginPath();
          x.moveTo(ox + d + 24, oy);
          x.lineTo(ox + d, oy + 24);
          x.stroke();
        }
        x.fillStyle = '#ffffff';
        x.fillRect(ox - 11, oy, 11, 24);
        x.fillRect(ox + 20, oy, 11, 24);
      }
  });
  const wCells = [],
    sCells = [];
  for (let r2 = 0; r2 < 4; r2++) {
    for (let c2 = 0; c2 < 4; c2++) wCells.push([c2 * 32 + 10, r2 * 32 + 8, 12, 16]);
    for (let c2 = 0; c2 < 3; c2++) sCells.push([c2 * 42 + 13, r2 * 32 + 7, 16, 20]);
  }
  const wLit = litTex(128, 128, wCells, 0.45, WARMLIT),
    sLit = litTex(128, 128, sCells, 0.5, ['#ffb35c', '#ffc070', '#ff9f45']);
  const TINT = ['#f1e8d6', '#e6d2ae', '#f6f3ec', '#dcc29a', '#eadcc2'];
  const lowMs = TINT.map(c => glow(new THREE.MeshLambertMaterial({ color: c, map: lowW }), wLit, '#ffffff', 1)),
    scrMs = TINT.slice(0, 3).map(c => glow(new THREE.MeshLambertMaterial({ color: c, map: lowS }), sLit, '#ffffff', 1));
  const parM = lam('#d9cdb6'),
    tankM = lam('#f7f7f4'),
    acM = lam('#b9bec4'),
    domeMs = [mats.cream, lam('#f4f2ec'), lam('#3f8a78'), mats.gold];
  const tankG = new THREE.CylinderGeometry(0.65, 0.65, 1.3, 10).translate(0, 0.65, 0),
    acG = new THREE.BoxGeometry(1.2, 0.8, 0.9).translate(0, 0.4, 0);
  const roofKit = (w, d, h, x, z, a) => {
    // the parapet, then tanks and AC units scattered on the roof
    add(boxM(w + 0.3, 0.9, d + 0.3).translate(0, h, 0), parM, x, 0, z, a);
    const c = Math.cos(a),
      s2 = Math.sin(a),
      n = 1 + ((rand() * 3) | 0);
    for (let j = 0; j < n; j++) {
      const u = rr(-w / 2 + 1.2, w / 2 - 1.2),
        v = rr(-d / 2 + 1.2, d / 2 - 1.2);
      add(rand() < 0.65 ? tankG : acG, rand() < 0.65 ? tankM : acM, x + u * c + v * s2, h, z - u * s2 + v * c, a);
    }
  };
  let mosqueGap = 0;
  for (let n = 0; n < 1300; n++) {
    const s = rand() * tr.len,
      i = tr.idx(s),
      sd = rand() < 0.5 ? 1 : -1,
      off = rr(34, 280),
      p = P(s, sd * (W / 2 + off)); // both sides, wherever there's dry land
    if (tr.elevated[i]) continue;
    const a = head(s) + (rand() < 0.15 ? rr(-0.4, 0.4) : 0);
    // a neighbourhood mosque: a cream prayer hall, a dome, a slim minaret at one corner
    if (++mosqueGap > 45 && off > 50 && free(p.x, p.z, 13, W / 2 + 10)) {
      mosqueGap = 0;
      reserve(p.x, p.z, 13);
      add(boxM(18, 8, 18), mats.cream, p.x, 0, p.z, a);
      add(boxM(18.6, 0.8, 18.6).translate(0, 8, 0), parM, p.x, 0, p.z, a);
      add(
        new THREE.SphereGeometry(6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 8.4, 0),
        pick(domeMs),
        p.x,
        0,
        p.z,
        a,
      );
      const c = Math.cos(a),
        s2 = Math.sin(a),
        mx = p.x + 8 * c + 8 * s2,
        mz = p.z - 8 * s2 + 8 * c;
      add(cylM(1.1, 1.3, 24, 10), mats.cream, mx, 0, mz);
      add(cylM(1.7, 1.7, 1, 10).translate(0, 18, 0), parM, mx, 0, mz);
      add(new THREE.ConeGeometry(1.2, 3.5, 10).translate(0, 25.7, 0), mats.gold, mx, 0, mz);
      continue;
    }
    // further back, now and then: a mid-rise block of flats or an office tower
    if (off > 140 && rand() < 0.22) {
      const w = rr(16, 24),
        d = w * rr(0.7, 1),
        h = rr(26, 58);
      if (!free(p.x, p.z, w * 0.6, W / 2 + 6)) continue;
      reserve(p.x, p.z, w * 0.6);
      if (rand() < 0.5) add(boxM(w, h, d), mats[pick(['blue', 'teal', 'silver', 'dark', 'green'])], p.x, 0, p.z, a);
      else {
        add(boxM(w, h, d), pick(resMs), p.x, 0, p.z, a);
        roofKit(w, d, h, p.x, p.z, a);
      }
      continue;
    }
    const tall = rand() < 0.35,
      w = rr(11, 20),
      d = w * rr(0.6, 1),
      h = tall ? rr(11, 20) : rr(4.5, 9);
    if (!free(p.x, p.z, w * 0.55, W / 2 + 6)) continue;
    reserve(p.x, p.z, w * 0.55);
    const m = rand() < 0.25 ? pick(scrMs) : pick(lowMs);
    add(boxM(w, h, d), m, p.x, 0, p.z, a);
    if (rand() < 0.35) {
      const w2 = w * rr(0.45, 0.65),
        d2 = d * rr(0.5, 0.7),
        h2 = rr(3, 4.5);
      add(boxM(w2, h2, d2).translate(rr(-1, 1), h, rr(-1, 1)), m, p.x, 0, p.z, a);
      roofKit(w2, d2, h + h2, p.x, p.z, a);
    } // a set-back top floor
    roofKit(w, d, h, p.x, p.z, a);
  }

  // night: each glow comes up to its colour; the Tornado Tower runs through its colours
  let night = 0;
  const tmp = new THREE.Color();
  k.night = n => {
    night = n;
    for (const g of glowing) {
      if (g.fn) {
        g.fn(n);
        continue;
      }
      g.mat.emissive.copy(g.base).lerp(tmp.copy(g.col).multiplyScalar(g.str * 1.3), n);
    }
    if (!n && tornadoM) tornadoM.emissive.set(0);
  };
  k.update = t => {
    for (const w of walkers) w(t);
    for (const w of swimmers) w(t);
    if (night && tornadoM) tornadoM.emissive.setHSL((t * 0.04) % 1, 0.85, 0.55).multiplyScalar(night * 1.2);
  };

  // merge each material's pieces into one mesh
  for (const [mat, geos] of bins) {
    const g = mergeGeometries(geos.map(x => (x.index ? x.toNonIndexed() : x)));
    if (!g) continue;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  void addG;
}
