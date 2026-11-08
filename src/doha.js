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
//  - and the low city behind it all
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';

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
    const sd = -inside(f.s),
      mid = f.s + f.len * 0.5,
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
