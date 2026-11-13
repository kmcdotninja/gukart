// Chapter 3, Kaduna: three circuits, each after the real place (from photographs of each). world.js lays the ground (red
// laterite, dry grass), the river, the road furniture, the start, and Kano's own pieces where Zaria shares them (the mud
// gates, the Ganuwa wall, the market stalls); this builds the rest:
//  - ABU Zaria: the Main Gate's green horn arches, the waterfall roundabout and its knot, Senate Avenue under its trees,
//    the Senate tower (a deep terracotta grid), Kashim Ibrahim Library, the cream-and-blue Physical Sciences blocks, the
//    Department of Computer Science (the road runs down its corridor between the labs), the Long Halls of Education and
//    their covered walkway, the halls of residence, the North Gate
//  - the City Centre: Ahmadu Bello Way's shops and billboards, keke napep and yellow buses parked up, the Stadium
//    roundabout's football, Murtala Square (the old racecourse: white rails, the cable footbridge, the grandstand, the
//    gazebo on the lawn), Lugard Hall's green domes, the Queen Amina flyover, the blue arch of the Central Market, the
//    River Kaduna and the old steel railway bridge
//  - Zazzau: the earth houses of old Zaria, the Emir's palace and its painted front, the durbar horsemen, the Emirate
//    mosque's minarets, the Malam Yamusa gate and its Z, the granite rock
// Every piece stands on the ground or on something that does: nothing hangs in the air.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, starKnot, loopKnot, diamondBand } from './textures.js';
import { boxM } from './doha.js';
import { fbm } from './util.js';

const TAU = Math.PI * 2;
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

export function dressKaduna(k) {
  const { scene, tr, rand, rr, pick, free, reserve, W } = k;
  const CIRC = k.circuit; // 'abu' | 'city' | 'zazzau'
  // the River Kaduna (and the water all round) is brown-green, not the sea
  k.water.material.color.set('#6c7a55');
  k.water.material.specular?.set('#c9cfae');
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

  // pieces gathered per material and merged into one mesh each at the end
  const bins = new Map();
  const T4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(sx, sy, sz),
    );
  const putM = (geo, mat, m, check = false, label = 'building') => {
    geo.boundingBox || geo.computeBoundingBox();
    if (check && !k.clearOfRoad(geo.boundingBox, m, label)) return false;
    (bins.get(mat) || bins.set(mat, []).get(mat)).push(geo.clone().applyMatrix4(m));
    return true;
  };
  const add = (geo, mat, x, y, z, ry = 0, s = 1, check = true) => putM(geo, mat, T4(x, y, z, ry, s, s, s), check);
  // a local frame at (x, z) turned by a: pieces placed in it at local coordinates
  const at = (x, z, a, y = 0) => {
    const m0 = T4(x, y, z, a);
    return (geo, mat, lx = 0, ly = 0, lz = 0, ry = 0, check = false) =>
      putM(geo, mat, m0.clone().multiply(T4(lx, ly, lz, ry)), check);
  };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cy = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(0, h / 2, 0);
  const fOf = type => tr.feats.filter(f => f.type === type);
  const inside = s => -tr.out[tr.idx(s)]; // +1/-1: the side of the road towards the inside of the loop
  const P = (s, off) => tr.beside(tr.idx(s), off);
  const head = s => {
    const t = tr.T[tr.idx(s)];
    return Math.atan2(t.x, t.z);
  };
  // a landmark's own frame beside the road at s: `side` +1 inside the loop, -1 outside, `off` metres out. Local z runs
  // along the road; rx is the local x that points back at the road (its front faces that way)
  const frame = (s, side, off, along = 0) => {
    const lat = side * inside(s),
      i = tr.idx(s),
      p = tr.beside(i, lat * off),
      a = head(s),
      t = tr.T[i];
    const x = p.x + t.x * along,
      z = p.z + t.z * along;
    return { x, z, a, rx: -lat, put: at(x, z, a), lat };
  };
  // a whole Group set down in a frame (for pieces that are animated or carry their own materials)
  const group = (x, z, a) => {
    const G = new THREE.Group();
    G.position.set(x, 0, z);
    G.rotation.y = a;
    scene.add(G);
    return G;
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  /* ---------- night: the lit things carry a glow ---------- */
  const glowing = [];
  const glow = (mat, map, col = '#ffffff', str = 1) => {
    if (map) mat.emissiveMap = map;
    const base = mat.emissive ? mat.emissive.clone() : new THREE.Color(0);
    mat.emissive = base.clone();
    glowing.push({ mat, base, col: new THREE.Color(col), str });
    return mat;
  };
  const animated = [];

  k.places = [];
  const place = (name, sub, p, s, o = {}) => {
    if (!k.places.some(q => q.name === name))
      k.places.push({ name, sub, x: p.x, y: p.y || 0, z: p.z, s, back: 30, lat: 0, h: 4, lookH: 10, ...o });
  };

  // words painted on a board: fitted to its width
  const words = (text, w, h, fg, bg, { weight = 800, italic = true, pad = 0.08, border } = {}) => {
    const cw = 1024,
      ch = Math.max(32, Math.round((cw * h) / w));
    return canvasTex(cw, ch, (x, W2, H2) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, W2, H2);
      if (border) {
        x.strokeStyle = border;
        x.lineWidth = H2 * 0.08;
        x.strokeRect(H2 * 0.06, H2 * 0.06, W2 - H2 * 0.12, H2 - H2 * 0.12);
      }
      let fs = H2 * 0.62;
      x.font = `${italic ? 'italic ' : ''}${weight} ${fs}px ${FONT}`;
      const room = W2 * (1 - pad * 2);
      const tw = x.measureText(text).width;
      if (tw > room) {
        fs *= room / tw;
        x.font = `${italic ? 'italic ' : ''}${weight} ${fs}px ${FONT}`;
      }
      x.fillStyle = fg;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, W2 / 2, H2 * 0.54);
    });
  };
  const board = (text, w, h, fg, bg, o) => new THREE.MeshLambertMaterial({ map: words(text, w, h, fg, bg, o) });
  // a sign face on both sides of a slab (w x h, its foot at y), in a local frame
  const signBoth = (G, mat, w, h, x, y, z, ry = 0, d = 0.3) => {
    for (const sd of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x + Math.sin(ry) * sd * (d / 2 + 0.02), y + h / 2, z + Math.cos(ry) * sd * (d / 2 + 0.02));
      p.rotation.y = ry + (sd < 0 ? Math.PI : 0);
      G.add(p);
    }
  };

  /* ---------- the textures ---------- */
  const tile = (draw, w = 128, h = 128) => canvasTex(w, h, draw, { repeat: true });
  const grain = (x, w, h, n = 300, a = 0.06) => {
    for (let i = 0; i < n; i++) {
      x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      const r = 1 + Math.random() * 2;
      x.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
  };
  const WIN_LIT = ['#ffd49a', '#ffe6bd', '#ffc978', '#fff2dc'];
  // the windows' night glow: the same grid, a share of the panes lit warm
  const litOf = (w, h, cells, share = 0.5) =>
    tile(
      (x, W2, H2) => {
        x.fillStyle = '#000';
        x.fillRect(0, 0, W2, H2);
        for (const [cx, cy, cw, ch] of cells)
          if (Math.random() < share) {
            x.fillStyle = pick(WIN_LIT);
            x.fillRect(cx, cy, cw, ch);
          }
      },
      w,
      h,
    );
  // ABU's campus blocks: cream walls, a deep blue band along each floor, ribbon windows behind louvres
  const campusCells = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) campusCells.push([c * 32 + 4, r * 64 + 18, 24, 26]);
  const campusT = tile((x, w, h) => {
    x.fillStyle = '#efe3c6';
    x.fillRect(0, 0, w, h);
    grain(x, w, h);
    for (let r = 0; r < 2; r++) {
      x.fillStyle = '#2f5d9e';
      x.fillRect(0, r * 64 + 48, w, 8);
      for (let c = 0; c < 4; c++) {
        x.fillStyle = '#2b3138';
        x.fillRect(c * 32 + 4, r * 64 + 18, 24, 26);
        x.fillStyle = 'rgba(200,220,235,.35)';
        for (let l = 0; l < 6; l++) x.fillRect(c * 32 + 4, r * 64 + 20 + l * 4, 24, 1.5); // louvres
      }
    }
  });
  const campusM = glow(lam('#ffffff', { map: campusT }), litOf(128, 128, campusCells, 0.45), '#ffffff', 0.9);
  // the Senate tower: a deep grid of terracotta concrete fins, dark glass far back in each cell
  const senCells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) senCells.push([c * 32 + 6, r * 32 + 6, 20, 20]);
  const senateT = tile((x, w, h) => {
    x.fillStyle = '#b4532f';
    x.fillRect(0, 0, w, h);
    grain(x, w, h, 400, 0.08);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        x.fillStyle = '#5b2414';
        x.fillRect(c * 32 + 4, r * 32 + 4, 24, 24);
        x.fillStyle = '#1f2a33';
        x.fillRect(c * 32 + 7, r * 32 + 7, 18, 18);
        x.fillStyle = 'rgba(150,190,220,.25)';
        x.fillRect(c * 32 + 7, r * 32 + 7, 18, 5);
      }
  });
  const senateM = glow(lam('#ffffff', { map: senateT }), litOf(128, 128, senCells, 0.4), '#ffffff', 0.9);
  // Kaduna's shop blocks: painted walls, roller shutters and a signboard at the street, barred windows above
  const SHOP = ['#efe6d0', '#f3d9a8', '#d8ead9', '#e9c9bb', '#d9e2ef', '#f1efe9', '#e8d39a'];
  const SIGNS = ['#d7262f', '#1d5fbf', '#f2c230', '#1f8a4c', '#7a2b8f', '#ff7a1a', '#13204f'];
  const shopCells = [];
  for (let c = 0; c < 3; c++) shopCells.push([c * 42 + 8, 18, 26, 26]);
  for (let c = 0; c < 3; c++) shopCells.push([c * 42 + 6, 84, 30, 30]);
  const shopMs = SHOP.map(col => {
    const t = tile((x, w, h) => {
      x.fillStyle = col;
      x.fillRect(0, 0, w, h);
      grain(x, w, h, 300, 0.05);
      // upstairs: windows with burglar bars
      for (let c = 0; c < 3; c++) {
        x.fillStyle = '#2d3640';
        x.fillRect(c * 42 + 8, 18, 26, 26);
        x.fillStyle = 'rgba(230,230,230,.7)';
        for (let b = 1; b < 5; b++) x.fillRect(c * 42 + 8 + b * 5.2, 18, 1.5, 26);
        x.fillRect(c * 42 + 8, 30, 26, 1.5);
      }
      // the street: a painted signboard, shutters under it
      x.fillStyle = pick(SIGNS);
      x.fillRect(0, 56, w, 18);
      x.fillStyle = 'rgba(255,255,255,.9)';
      for (let l = 0; l < 3; l++) x.fillRect(8 + l * 40, 61, 18 + Math.random() * 14, 8); // lettering, unreadable at speed
      for (let c = 0; c < 3; c++) {
        x.fillStyle = '#8d949c';
        x.fillRect(c * 42 + 6, 80, 32, 44);
        x.fillStyle = 'rgba(40,45,50,.35)';
        for (let l = 0; l < 44; l += 3) x.fillRect(c * 42 + 6, 80 + l, 32, 1);
      }
    });
    return glow(lam('#ffffff', { map: t }), litOf(128, 128, shopCells, 0.4), '#ffffff', 0.8);
  });
  const roofZinc = lam('#9aa1a6'),
    roofRust = lam('#9b5a3a'),
    concrete = lam('#cfc8bc'),
    white = lam('#f4f2ec'),
    darkM = lam('#262a30'),
    steelM = new THREE.MeshStandardMaterial({ color: '#7e8790', metalness: 0.6, roughness: 0.45 }),
    railWhite = lam('#f7f7f4'),
    grassM = lam('#6f9a3e'),
    lawnM = lam('#78a845');
  // the screens in the labs, always lit
  const screenM = new THREE.MeshBasicMaterial({
    map: tile((x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2c6fd6');
      g.addColorStop(1, '#0b2a63');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.75)';
      for (let l = 0; l < 7; l++) x.fillRect(12, 14 + l * 14, 30 + Math.random() * 70, 5); // code
      x.fillStyle = '#ffd34d';
      x.fillRect(12, 14, 14, 5);
    }),
  });

  /* ---------- trees: neem and mango round the houses, mahogany and neem down the avenues, doum palms ---------- */
  const tree = (x, z, kind = 'neem', s = 1) => {
    if (kind === 'mahogany') {
      const h = rr(6, 8) * s;
      k.trunks.add(x, 0, z, 0, 0.6 * s, h, 0.6 * s, '#5d4632');
      k.canopy.add(x, h + 3 * s, z, rand() * 6, 6.5 * s, 4 * s, 6.5 * s, pick(['#2f6b30', '#3a7a35', '#2a5f2c']));
      k.canopy.add(x + rr(-2, 2), h + 5.5 * s, z + rr(-2, 2), rand() * 6, 4.5 * s, 3 * s, 4.5 * s, '#3f8238');
    } else if (kind === 'mango') {
      const h = rr(2.5, 3.5) * s;
      k.trunks.add(x, 0, z, 0, 0.5 * s, h, 0.5 * s, '#5a4330');
      k.canopy.add(x, h + 3 * s, z, rand() * 6, 5 * s, 4 * s, 5 * s, pick(['#245a28', '#2c6a2e', '#1f4f24']));
    } else k.tree(x, z, kind);
  };
  const tryTree = (x, z, r, kind, s, mr) => {
    if (!free(x, z, r, mr)) return false;
    reserve(x, z, r * 0.8);
    tree(x, z, kind, s);
    return true;
  };

  // the halls the road runs through: nothing else is built there
  for (const f of fOf('hall'))
    for (let s = f.s - 30; s <= f.s + f.len + 30; s += 10) {
      const p = tr.point(s, 0);
      reserve(p.x, p.z, W / 2 + 30);
    }

  /* ---------- the bridges over the River Kaduna: a concrete deck on piers ---------- */
  for (const f of fOf('lowbridge')) {
    const parts = [],
      rails = [],
      piers = [];
    for (let s = f.s - 6; s < f.s + f.len + 6; s += 4) {
      const i = tr.idx(s),
        p = tr.point(s, 0),
        a = head(s);
      parts.push(new THREE.BoxGeometry(W + 4, 1.6, 4.2).translate(0, -0.85, 0).rotateY(a).translate(p.x, p.y, p.z));
      for (const sd of [1, -1]) {
        const q = tr.beside(i, sd * (W / 2 + 1.4));
        rails.push(
          new THREE.BoxGeometry(0.35, 1.1, 4.1)
            .translate(0, 0.55 + p.y, 0)
            .rotateY(a)
            .translate(q.x, 0, q.z),
        );
      }
      if (Math.round(s - f.s) % 24 === 0)
        for (const sd of [1, -1]) {
          const q = tr.beside(i, sd * (W / 2 - 3));
          piers.push(new THREE.CylinderGeometry(1.4, 1.7, 9, 10).translate(q.x, -6, q.z));
        }
    }
    for (const [list, m] of [
      [parts, concrete],
      [rails, lam('#e9e6df')],
      [piers, lam('#b9b2a6')],
    ])
      if (list.length) {
        const me = new THREE.Mesh(mergeGeometries(list), m);
        me.receiveShadow = me.castShadow = true;
        scene.add(me);
      }
    place('RIVER KADUNA', 'The old railway bridge alongside', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 40,
      h: 5,
      lat: -6,
    });
  }

  /* ---------- the old railway bridge: steel trusses on stone piers, a little upstream ---------- */
  for (const f of fOf('railbridge')) {
    const side = -1,
      off = W / 2 + 26,
      s0 = f.s - 70,
      s1 = f.s + f.len + 70; // (it runs on past the banks on an embankment)
    const truss = [],
      deck = [],
      stone = [],
      ballast = [],
      railsG = [];
    const DY = 1.2,
      H = 7,
      BW = 5.2; // the deck's height over the river, the trusses' height, their spacing
    const at2 = s => {
      const i = tr.idx(s),
        p = tr.beside(i, side * inside(s) * off);
      return { p, a: head(s) };
    };
    const onBridge = s => s >= f.s - 4 && s <= f.s + f.len + 4;
    const STEP = 6;
    for (let s = s0; s < s1; s += STEP) {
      const { p, a } = at2(s),
        L = STEP + 0.1;
      // rails all the way
      for (const sd of [-0.75, 0.75])
        railsG.push(
          new THREE.BoxGeometry(0.12, 0.16, L)
            .translate(sd, DY + 0.38, 0)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        );
      for (let q = -L / 2; q < L / 2; q += 1.2)
        ballast.push(
          new THREE.BoxGeometry(2.6, 0.14, 0.3)
            .translate(0, DY + 0.24, q)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        ); // sleepers
      if (!onBridge(s)) {
        // the embankment: a bank of ballast and earth under the line, down to the ground
        ballast.push(
          new THREE.CylinderGeometry(2.2, 4.2, DY + 2.2, 4, 1)
            .rotateY(Math.PI / 4)
            .scale(1, 1, L / 4.2)
            .translate(0, (DY + 2.2) / 2 - 2, 0)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        );
        continue;
      }
      deck.push(new THREE.BoxGeometry(BW + 0.6, 0.7, L).translate(0, DY, 0).rotateY(a).translate(p.x, 0, p.z));
      // each side truss: top and bottom chords, a Warren diagonal and a post per panel
      for (const sd of [-1, 1]) {
        const xo = (sd * BW) / 2;
        for (const y of [DY + 0.3, DY + H])
          truss.push(new THREE.BoxGeometry(0.45, 0.5, L).translate(xo, y, 0).rotateY(a).translate(p.x, 0, p.z));
        truss.push(
          new THREE.BoxGeometry(0.3, H, 0.3)
            .translate(xo, DY + 0.3 + H / 2, -L / 2)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        );
        const dl = Math.hypot(H, L),
          tilt = Math.atan2(L, H) * (Math.floor((s - s0) / STEP) % 2 ? 1 : -1);
        truss.push(
          new THREE.BoxGeometry(0.28, dl, 0.28)
            .rotateX(tilt)
            .translate(xo, DY + 0.3 + H / 2, 0)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        );
      }
      // the bracing across the top
      truss.push(
        new THREE.BoxGeometry(BW, 0.3, 0.3)
          .translate(0, DY + H, 0)
          .rotateY(a)
          .translate(p.x, 0, p.z),
      );
      // a stone pier every other span, down into the river bed
      if (Math.floor((s - s0) / STEP) % 6 === 0)
        stone.push(
          new THREE.BoxGeometry(BW + 1.6, DY + 8, 3.4)
            .translate(0, (DY + 8) / 2 - 8.2, 0)
            .rotateY(a)
            .translate(p.x, 0, p.z),
        );
    }
    // the portals at the ends: masonry abutments
    for (const s of [f.s - 4, f.s + f.len + 4]) {
      const { p, a } = at2(s);
      stone.push(
        new THREE.BoxGeometry(BW + 3, DY + 6, 5)
          .translate(0, (DY + 6) / 2 - 6, 0)
          .rotateY(a)
          .translate(p.x, 0, p.z),
      );
    }
    for (const [list, m] of [
      [truss, lam('#56606a')],
      [deck, lam('#3d3a36')],
      [stone, lam('#a89c88')],
      [ballast, lam('#7a6e62')],
      [railsG, steelM],
    ])
      if (list.length) {
        const me = new THREE.Mesh(mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g))), m);
        me.castShadow = me.receiveShadow = true;
        scene.add(me);
      }
    for (let s = s0; s < s1; s += 8) {
      const { p } = at2(s);
      reserve(p.x, p.z, 7);
    }
  }

  /* ======================================================================================================== */
  /* ---------- ABU Zaria ---------- */

  // ABU's Main Gate: one cream masonry facade across the way in, a great round arch over the road, a green band right
  // across its top with AHMADU BELLO UNIVERSITY in white, the university's green crest standing on top, a smaller arch
  // each side for people on foot (lined in green), lower wings out to the ends, a red boom barrier raised beside the road
  const gateCream = lam('#efd986', { emissive: '#5a4c26' }), // (lit a little from within: it reads cream in its own shade)
    gateGreen = lam('#1f7a3e', { emissive: '#0c2a16' }),
    deepGreen = '#17603a';
  // an arch-shaped opening: straight jambs up to `spring`, a semicircle over
  const archPath = (P2, cx, hw, spring, back = false) => {
    if (!back) {
      P2.moveTo(cx - hw, 0);
      P2.lineTo(cx - hw, spring);
      P2.absarc(cx, spring, hw, Math.PI, 0, true);
      P2.lineTo(cx + hw, 0);
      P2.lineTo(cx - hw, 0);
    } else {
      P2.moveTo(cx + hw, 0);
      P2.lineTo(cx + hw, spring);
      P2.absarc(cx, spring, hw, 0, Math.PI, false);
      P2.lineTo(cx - hw, 0);
    }
    return P2;
  };
  // words on a see-through plane, both faces of a wall
  const lettering = (G, draw, w, h, x, y, zf, cw = 2048) => {
    const t = canvasTex(cw, Math.round((cw * h) / w), (x2, W2, H2) => {
      x2.clearRect(0, 0, W2, H2);
      draw(x2, W2, H2);
    });
    const m = new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, emissive: '#000000' });
    for (const sz of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      pl.position.set(x, y, sz * zf);
      if (sz < 0) pl.rotation.y = Math.PI;
      G.add(pl);
    }
  };
  // the crest: ABU's green badge, a peaked top, a cream border, the knot on it
  const crestMesh = (cw, chh) => {
    const sh = new THREE.Shape();
    sh.moveTo(-cw / 2, 0);
    sh.lineTo(cw / 2, 0);
    sh.lineTo(cw / 2, chh * 0.62);
    sh.lineTo(0, chh);
    sh.lineTo(-cw / 2, chh * 0.62);
    sh.lineTo(-cw / 2, 0);
    const T = canvasTex(256, 300, (x, w, h) => {
      x.fillStyle = '#f3e7b8';
      x.fillRect(0, 0, w, h);
      x.fillStyle = deepGreen;
      x.beginPath();
      x.moveTo(14, h - 14);
      x.lineTo(w - 14, h - 14);
      x.lineTo(w - 14, h * 0.38 + 8);
      x.lineTo(w / 2, 16);
      x.lineTo(14, h * 0.38 + 8);
      x.closePath();
      x.fill();
      loopKnot(x, w / 2, h * 0.6, w * 0.28, ['rgba(0,30,10,.5)', 'rgba(255,255,255,.4)', '#f3e7b8']);
    });
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false });
    const uv = g.attributes.uv,
      nrm = g.attributes.normal;
    for (let v = 0; v < uv.count; v++)
      if (Math.abs(nrm.getZ(v)) > 0.5) uv.setXY(v, (uv.getX(v) + cw / 2) / cw, uv.getY(v) / chh);
      else uv.setXY(v, 0.02, 0.5);
    return mesh(
      g.translate(0, 0, -0.45),
      new THREE.MeshLambertMaterial({ map: T, emissive: '#222222', emissiveMap: T }),
    );
  };
  for (const f of fOf('abugate')) {
    const i = tr.idx(f.s),
      p = tr.point(f.s, 0),
      a = head(f.s),
      G = group(p.x, p.z, a),
      north = !!f.north,
      k5 = north ? 0.85 : 1,
      sp = W / 2 + 1.5, // the main arch's half span (the road under it)
      PIER = 3 * k5, // solid wall either side of the main arch
      PA = 4.4 * k5, // a walkway arch's width
      WING = 3 * k5,
      half = sp + PIER + PA + WING,
      WT = 7.5 * k5, // the wings' height
      D = 3.6,
      SPRING = 1;
    const xa = sp + PIER, // where the wings start
      pc = xa + PA / 2; // a walkway arch's middle
    const CROWN = SPRING + sp; // the main arch's crown
    const NAME = north ? ['AHMADU BELLO', 'NORTH GATE'] : ['AHMADU BELLO', 'UNIVERSITY'];
    // the facade's outline, by design
    const sh = new THREE.Shape();
    sh.moveTo(-half, 0);
    sh.lineTo(-half, WT);
    sh.lineTo(-xa, WT);
    const top = CROWN + 6; // the wall's top
    sh.lineTo(-xa, top);
    sh.lineTo(xa, top);
    sh.lineTo(xa, WT);
    sh.lineTo(half, WT);
    sh.lineTo(half, 0);
    sh.lineTo(-half, 0);
    sh.holes.push(archPath(new THREE.Path(), 0, sp, SPRING));
    for (const sx of [-1, 1]) sh.holes.push(archPath(new THREE.Path(), sx * pc, PA / 2 - 0.5, 2.6 * k5));
    G.add(
      mesh(
        new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, -D / 2),
        gateCream,
      ),
    );
    // a plinth along the foot of the walls either side, a shade deeper (not across the road)
    const plinthM = lam('#d9c070', { emissive: '#4a3e1e' });
    for (const sx of [-1, 1]) G.add(mesh(bx(half - sp + 0.3, 0.7, D + 0.3), plinthM, (sx * (half + sp)) / 2, 0, 0));
    // the green lining of each walkway arch
    for (const sx of [-1, 1]) {
      const hw = PA / 2 - 0.5,
        r = archPath(new THREE.Shape(), sx * pc, hw, 2.6 * k5);
      r.lineTo(sx * pc + hw - 0.4, 0);
      archPath(r, sx * pc, hw - 0.4, 2.6 * k5, true);
      r.lineTo(sx * pc - hw, 0);
      G.add(
        mesh(
          new THREE.ExtrudeGeometry(r, { depth: D + 0.2, bevelEnabled: false, curveSegments: 16 }).translate(
            0,
            0,
            -(D + 0.2) / 2,
          ),
          gateGreen,
        ),
      );
    }
    // a green band right across, the name big in white on it, a thin cream line either edge
    const by = CROWN + 1.3,
      bh = 3.4;
    G.add(mesh(bx(xa * 2 + 0.2, bh, D + 0.16), gateGreen, 0, by, 0));
    lettering(
      G,
      (x, w, h) => {
        x.fillStyle = '#ffffff';
        x.font = `700 ${h * 0.66}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(`${NAME[0]} ${NAME[1]}`, w / 2, h * 0.54);
        x.fillStyle = '#efd986';
        x.fillRect(0, h * 0.04, w, h * 0.04);
        x.fillRect(0, h * 0.92, w, h * 0.04);
      },
      xa * 2,
      bh,
      0,
      by + bh / 2,
      D / 2 + 0.12,
    );
    const crestY = top;
    // the crest, standing on the top
    const cr = crestMesh(4.4 * k5, 5.6 * k5);
    cr.position.y = crestY;
    G.add(cr);
    // the red boom barrier, raised, on its post on the verge beside the road
    if (!north) {
      const bxp = -(half + 2);
      G.add(mesh(bx(0.5, 1.4, 0.5), lam('#d23b2e'), bxp, 0, D / 2 + 3));
      const boom = mesh(new THREE.BoxGeometry(0.22, 7, 0.22).translate(0, 3.5, 0), lam('#d23b2e'), bxp, 1.2, D / 2 + 3);
      boom.rotation.z = -0.55;
      G.add(boom);
    }
    for (let o = -6; o <= 6; o++) {
      const j = tr.wrap(i + o);
      tr.limit[j] = Math.min(tr.limit[j], sp - 1.2);
      tr.wall[j] = sp - 0.4;
    } // (the arch's sides are solid)
    for (const sx of [-1, 1]) {
      const q = tr.beside(i, sx * (sp + half) * 0.5);
      reserve(q.x, q.z, (half - sp) / 2 + 4);
    }
    if (!north) place('THE MAIN GATE', 'Under the arch', p, f.s, { back: 12, h: 4, lookH: 9 });
  }

  // the waterfall roundabout: a round pool, a stepped cascade of rock in the middle, ABU's knot on a plinth on top
  for (const f of fOf('waterfall')) {
    const fr = frame(f.s + 20, 1, W / 2 + 30),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(cy(16, 16.5, 0.8, 40), concrete));
    const water = new THREE.MeshPhongMaterial({
      color: '#4fa9c8',
      shininess: 90,
      specular: '#e6f6ff',
      transparent: true,
      opacity: 0.9,
    });
    G.add(mesh(cy(15, 15, 0.9, 40), water));
    const rockM = lam('#8b7f74', { flatShading: true });
    for (const [r, h] of [
      [9, 2],
      [6.5, 3.6],
      [4.2, 5.2],
    ])
      G.add(mesh(cy(r * 0.9, r, h, 9), rockM));
    // the falls: white water down each step
    const fallM = new THREE.MeshBasicMaterial({
      color: '#e8f6ff',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const fall = mesh(new THREE.CylinderGeometry(4.3, 9.1, 5.2, 24, 1, true).translate(0, 2.6, 0), fallM);
    G.add(fall);
    animated.push(t => (fallM.opacity = 0.6 + 0.15 * Math.sin(t * 6)));
    const plinth = mesh(bx(3, 4, 3), white, 0, 5.2, 0);
    G.add(plinth);
    const knot = new THREE.MeshLambertMaterial({
      map: canvasTex(256, 256, (x, w, h) => {
        x.fillStyle = '#1f7a3e';
        x.fillRect(0, 0, w, h);
        loopKnot(x, w / 2, h / 2, w * 0.36, ['rgba(0,30,10,.5)', 'rgba(255,255,255,.5)', '#f2d36b']);
      }),
    });
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), knot);
      p2.position.set(Math.sin(ry) * 1.52, 7.2, Math.cos(ry) * 1.52);
      p2.rotation.y = ry;
      G.add(p2);
    }
    reserve(fr.x, fr.z, 20);
    place('THE WATERFALL', 'Round the roundabout', { x: fr.x, z: fr.z }, f.s, { back: 40, lookH: 6 });
  }

  // Senate Avenue: neem and mahogany close on both sides, their crowns meeting high over the road
  for (const f of fOf('avenue'))
    for (let s = f.s; s < f.s + f.len; s += 11)
      for (const sd of [1, -1]) {
        const p = P(s + rr(-2, 2), sd * (W / 2 + rr(5, 7)));
        tryTree(p.x, p.z, 1.5, rand() < 0.6 ? 'mahogany' : 'neem', rr(1.1, 1.35), W / 2 + 3);
        const q = P(s + rr(-4, 4), sd * (W / 2 + rr(14, 22)));
        tryTree(q.x, q.z, 3, rand() < 0.5 ? 'mahogany' : 'mango', rr(0.9, 1.2), W / 2 + 10);
      }

  // the Senate building: a tower in a deep terracotta grid over a long low podium, the flags out front on the lawn
  for (const f of fOf('senate')) {
    const fr = frame(f.s, -1, W / 2 + 46),
      pt = fr.put;
    const tw = 34,
      td = 20,
      th = 48;
    pt(boxM(tw, th, td, 4), senateM, 0, 0, 0, 0, true);
    pt(bx(tw + 1.2, 1.4, td + 1.2), white, 0, th, 0);
    pt(bx(tw * 0.5, 3.5, td * 0.6), white, 0, th + 1.4, 0); // the plant room on the roof
    pt(boxM(70, 7, 30, 8), campusM, 0, 0, -fr.rx * 4, 0, true); // the podium (its front toward the road)
    pt(bx(72, 0.8, 32), white, 0, 7, -fr.rx * 4);
    // three flagpoles on the lawn in front
    for (const z of [-8, 0, 8]) {
      pt(cy(0.12, 0.15, 14, 6), white, fr.rx * 22, 0, z);
      pt(bx(0.06, 1.6, 2.6).translate(0, 0, 1.3), z ? lam('#008751') : lam('#1f7a3e'), fr.rx * 22, 12.2, z); // (flags on the pole)
    }
    reserve(fr.x, fr.z, 44);
    const s2 = f.s;
    place('THE SENATE', 'Up Senate Avenue', { x: fr.x, z: fr.z }, s2, { back: 70, lookH: 30, h: 6 });
  }

  // Kashim Ibrahim Library: long and low, a deep overhanging roof slab on round columns, a brown brick face behind
  for (const f of fOf('library')) {
    const fr = frame(f.s + 30, -1, W / 2 + 34),
      pt = fr.put;
    const brickT = tile((x, w, h) => {
      x.fillStyle = '#8a4a2c';
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,220,190,.12)';
      for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 1);
      for (let r = 0; r < 2; r++) {
        x.fillStyle = '#20282f';
        x.fillRect(10, r * 64 + 14, w - 20, 30);
      }
    });
    const brickM = glow(
      lam('#ffffff', { map: brickT }),
      litOf(
        128,
        128,
        [
          [10, 14, 108, 30],
          [10, 78, 108, 30],
        ],
        0.7,
      ),
      '#ffffff',
      0.8,
    );
    pt(boxM(26, 14, 70, 8).rotateY(0), brickM, 0, 0, 0, 0, true);
    pt(bx(36, 1.4, 80), white, 0, 14, 0); // the roof slab, deep
    for (let z = -36; z <= 36; z += 6)
      for (const sx of [-1, 1]) pt(cy(0.5, 0.5, 14, 10), white, sx * 16.5, 0, z, 0, true);
    // the name along the roof slab's edge
    const nm = board('KASHIM IBRAHIM LIBRARY', 24, 1.2, '#f4f2ec', '#5a2c18', { italic: false });
    const G = group(fr.x, fr.z, fr.a);
    signBoth(G, nm, 24, 1.2, fr.rx * 18, 14.1, 0, (Math.PI / 2) * fr.rx, 0.04);
    reserve(fr.x, fr.z, 42);
    place('KASHIM IBRAHIM LIBRARY', 'Past the library', { x: fr.x, z: fr.z }, f.s + 30, { back: 40, lookH: 10 });
  }

  // a campus block: cream walls, blue bands, a roof slab
  const campusBlock = (x, z, a, w, d, floors) => {
    const h = floors * 4;
    if (!add(boxM(w, h, d, 8), campusM, x, 0, z, a)) return false;
    add(bx(w + 1, 0.6, d + 1), white, x, h, z, a, 1, false);
    return true;
  };
  for (const f of fOf('physci')) {
    for (let s = f.s; s < f.s + f.len; s += 45)
      for (const sd of [1, -1]) {
        const p = P(s + 20, sd * (W / 2 + 26));
        if (!free(p.x, p.z, 20, W / 2 + 12)) continue;
        reserve(p.x, p.z, 21);
        campusBlock(p.x, p.z, head(s), 16, 38, 3);
      }
    const fr = frame(f.s + 10, -1, W / 2 + 9),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(bx(0.3, 3.4, 0.3), steelM, 0, 0, -3.5), mesh(bx(0.3, 3.4, 0.3), steelM, 0, 0, 3.5));
    signBoth(
      G,
      board('FACULTY OF PHYSICAL SCIENCES', 8, 1.3, '#ffffff', '#1d3f8f', { italic: false }),
      8,
      1.3,
      0,
      2.2,
      0,
      Math.PI / 2,
      0.2,
    );
  }

  /* ---------- the Department of Computer Science: the road runs down its corridor, the labs either side ---------- */
  // In at the door under the department's name, down a long corridor between glass partitions (rows of computers in
  // the labs behind them, their screens lit), notice boards, strip lights in the ceiling, and out the far end. Built in
  // the hall's own frame (z along the road, x across it) and set down on the road.
  for (const f of fOf('compsci')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      a = head(mid),
      RW = W / 2 + 0.5, // the glass partitions, right at the road's edge
      HW = W / 2 + 18, // the outer walls
      CH = 11; // the ceiling
    const G = group(o.x, o.z, a);
    G.position.set(o.x, 0, o.z);
    const ab = new Map(),
      put = (geo, mat, x = 0, y = 0, z = 0, ry = 0) =>
        (ab.get(mat) || ab.set(mat, []).get(mat)).push(geo.clone().rotateY(ry).translate(x, y, z));
    // the floor either side: terrazzo
    const terr = tile((x, w, h) => {
      x.fillStyle = '#d9d4c8';
      x.fillRect(0, 0, w, h);
      for (let n = 0; n < 500; n++) {
        x.fillStyle = pick(['#9c968a', '#ece8de', '#b6aa96', '#7c8a86']);
        x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      x.fillStyle = 'rgba(80,70,60,.4)';
      x.fillRect(0, 0, w, 2);
      x.fillRect(0, 0, 2, h);
    });
    terr.repeat.set(4, Math.round(L / 6));
    const floorM = lam('#ffffff', { map: terr });
    for (const sd of [-1, 1]) put(bx(HW - RW, 0.14, L + 8), floorM, sd * (RW + (HW - RW) / 2), 0, 0);
    floorM.emissive.set('#3a3833');
    // the ceiling and its strip lights
    const ceilT = tile((x, w, h) => {
      x.fillStyle = '#efece6';
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(0,0,0,.08)';
      for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 1, h);
      for (let i = 0; i < h; i += 32) x.fillRect(0, i, w, 1);
    });
    ceilT.repeat.set(10, Math.round(L / 4));
    put(
      new THREE.BoxGeometry(HW * 2 + 2, 0.5, L + 8).translate(0, CH + 0.25, 0),
      lam('#ffffff', { map: ceilT, emissive: '#b9b4aa', emissiveMap: ceilT }), // (lit by its own strip lights)
    );
    const stripM = new THREE.MeshBasicMaterial({ color: '#f4fbff' });
    for (let z = -L / 2 + 6; z < L / 2 - 4; z += 8)
      for (const x of [-W / 4, W / 4, -RW - 8, RW + 8])
        put(new THREE.BoxGeometry(0.5, 0.12, 3.2).translate(x, CH - 0.06, z), stripM);
    // the partitions: glass between white posts, a rail at hand height
    const glassM = new THREE.MeshPhongMaterial({
      color: '#bfe3f2',
      transparent: true,
      opacity: 0.28,
      shininess: 90,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const sd of [-1, 1]) {
      put(bx(0.08, CH - 1, L), glassM, sd * RW, 0.14, 0);
      put(bx(0.16, 1, L), white, sd * RW, 0, 0); // a low white upstand under the glass
      for (let z = -L / 2; z <= L / 2; z += 6) put(bx(0.3, CH, 0.3), white, sd * RW, 0, z);
      put(bx(0.3, 0.3, L), white, sd * RW, CH - 1.2, 0);
    }
    // the labs: rows of desks across each room, a monitor and a chair at every place; walls between the labs
    const deskM = lam('#c8a77a'),
      chairM = lam('#2a3b5a'),
      caseM = lam('#2a2d33');
    const LAB = 28;
    let labN = 1;
    for (let z0 = -L / 2 + 4; z0 + LAB <= L / 2 - 2; z0 += LAB + 2) {
      for (const sd of [-1, 1]) {
        for (let r = 0; r < 4; r++) {
          const x = sd * (RW + 3 + r * 3.6);
          put(bx(1.1, 0.8, LAB - 4), deskM, x, 0.14, z0 + LAB / 2);
          for (let z = z0 + 3; z < z0 + LAB - 2; z += 2) {
            put(bx(0.18, 0.62, 0.95), caseM, x + sd * 0.25, 0.94, z); // monitor body
            put(new THREE.PlaneGeometry(0.85, 0.52), screenM, x + sd * 0.15 - sd * 0.0, 1.25, z, (-sd * Math.PI) / 2); // screen, facing the corridor
            put(bx(0.55, 0.55, 0.5), chairM, x - sd * 0.85, 0.14, z);
            put(bx(0.1, 0.6, 0.5), chairM, x - sd * 1.15, 0.69, z);
          }
        }
        // the wall at the end of each lab, a door into the next; a noticeboard on the corridor glass's post
        put(bx(HW - RW - 0.4, CH - 0.2, 0.3), lam('#e9e3d6'), sd * (RW + (HW - RW) / 2), 0.14, z0 + LAB + 1);
      }
      // the lab's name over its glass, both sides
      for (const sd of [-1, 1]) {
        const nm = board(`LAB ${labN}`, 4, 0.9, '#ffffff', '#1d3f8f', { italic: false });
        const p2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), nm);
        p2.position.set(sd * (RW - 0.05), CH - 2.2, z0 + LAB / 2);
        p2.rotation.y = -sd * (Math.PI / 2);
        G.add(p2);
        labN++;
      }
    }
    // the outer walls and the roof over it all, cream with the blue band, outside and in
    for (const sd of [-1, 1]) {
      put(new THREE.BoxGeometry(0.6, CH + 3, L + 8).translate(sd * HW, (CH + 3) / 2, 0), lam('#e9e3d6'));
      const ext = boxM(0.4, CH + 3, L + 8, 8);
      put(ext, campusM, sd * (HW + 0.5), 0, 0);
    }
    put(new THREE.BoxGeometry(HW * 2 + 3, 1.2, L + 10).translate(0, CH + 1.1, 0), white);
    for (const sd of [-1, 1])
      put(new THREE.BoxGeometry(0.8, 1.2, L + 10).translate(sd * (HW + 1.1), CH + 2.4, 0), lam('#2f5d9e')); // the blue fascia
    put(new THREE.BoxGeometry(HW * 2 + 1.4, 0.4, L + 9).translate(0, CH + 1.9, 0), concrete); // the roof
    // the two ends: the facade above the doorway, the department's name across it, glass doors folded back
    const nameM = glow(
      board('DEPARTMENT OF COMPUTER SCIENCE', 24, 2.2, '#ffffff', '#1d3f8f', { italic: false }),
      null,
      '#9fc2ff',
      0.6,
    );
    for (const ez of [-1, 1]) {
      const z = ez * (L / 2 + 4);
      for (const sd of [-1, 1])
        put(
          new THREE.BoxGeometry(HW - RW - 0.5, CH + 3, 0.6).translate(
            sd * (RW + (HW - RW) / 2 + 0.25),
            (CH + 3) / 2,
            z,
          ),
          campusM,
        );
      put(new THREE.BoxGeometry(RW * 2, 4, 0.6).translate(0, CH + 1, z), white);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.2), nameM);
      p2.position.set(0, CH + 1, z + ez * 0.32);
      if (ez < 0) p2.rotation.y = Math.PI;
      G.add(p2);
      // the doors folded back against the walls
      for (const sd of [-1, 1]) put(bx(0.12, 6, 3), glassM, sd * (RW + 0.4), 0.14, z - ez * 2);
    }
    for (const [mat, geos] of ab) {
      const m = new THREE.Mesh(mergeGeometries(geos.map(g => (g.index ? g.toNonIndexed() : g))), mat);
      m.receiveShadow = true;
      m.castShadow = mat !== glassM && mat !== stripM && mat !== screenM;
      G.add(m);
    }
    place('COMPUTER SCIENCE', 'Down the corridor between the labs', o, mid, {
      back: 30,
      lat: 0,
      h: 4,
      lookH: 4,
    });
  }

  // the Long Halls of Education: long single-storey halls behind a covered walkway along the road
  for (const f of fOf('longhalls')) {
    for (let s = f.s; s < f.s + f.len; s += 55)
      for (const sd of [1, -1]) {
        const p = P(s + 27, sd * (W / 2 + 24)),
          a = head(s + 27);
        if (!free(p.x, p.z, 24, W / 2 + 10)) continue;
        reserve(p.x, p.z, 26);
        if (!add(boxM(14, 6, 50, 8), campusM, p.x, 0, p.z, a)) continue;
        add(bx(17, 0.7, 52), roofRust, p.x, 6, p.z, a, 1, false);
        // the walkway: a slab roof on posts, between the hall and the road
        const q = P(s + 27, sd * (W / 2 + 13.5)),
          pt = at(q.x, q.z, a);
        pt(bx(4, 0.4, 50), white, 0, 3.4, 0);
        for (let z = -24; z <= 24; z += 6) for (const x of [-1.6, 1.6]) pt(cy(0.15, 0.15, 3.4, 6), white, x, 0, z);
      }
    place('THE LONG HALLS', 'Faculty of Education', tr.point(f.s + 60, 0), f.s + 60, { back: 30, lat: 6, lookH: 4 });
  }

  // the halls of residence: four-storey blocks with balconies and washing out, their names on the end walls; the
  // Social Centre's canopies between them
  const hostelCells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) hostelCells.push([c * 32 + 8, r * 32 + 6, 16, 18]);
  const hostelT = tile((x, w, h) => {
    x.fillStyle = '#f1ead8';
    x.fillRect(0, 0, w, h);
    grain(x, w, h);
    for (let r = 0; r < 4; r++) {
      x.fillStyle = '#c9c0ac';
      x.fillRect(0, r * 32 + 26, w, 6); // the balcony slabs
      for (let c = 0; c < 4; c++) {
        x.fillStyle = '#4a3a2c';
        x.fillRect(c * 32 + 8, r * 32 + 6, 16, 18);
        if (Math.random() < 0.5) {
          x.fillStyle = pick(['#e8336a', '#2ec4b6', '#ffc22e', '#3a7bfd', '#ffffff', '#ff6a00']);
          x.fillRect(c * 32 + 4 + Math.random() * 8, r * 32 + 20, 10, 7); // washing on the balcony rail
        }
      }
    }
  });
  const hostelM = glow(lam('#ffffff', { map: hostelT }), litOf(128, 128, hostelCells, 0.6), '#ffffff', 0.9);
  for (const f of fOf('hostels')) {
    const names = ['ALEXANDER HALL', 'RIBADU HALL', 'SULEIMAN HALL', 'DANFODIO HALL', 'AMINA HALL'];
    let n = 0;
    for (let s = f.s; s < f.s + f.len; s += 50)
      for (const sd of [1, -1]) {
        const p = P(s + 25, sd * (W / 2 + 30)),
          a = head(s + 25);
        if (!free(p.x, p.z, 22, W / 2 + 12)) continue;
        reserve(p.x, p.z, 23);
        if (!add(boxM(14, 16, 40, 8), hostelM, p.x, 0, p.z, a)) continue;
        add(bx(15, 0.6, 41), white, p.x, 16, p.z, a, 1, false);
        // the name on the end wall that faces the oncoming road
        const nm = board(names[n++ % names.length], 12, 1.6, '#1f7a3e', '#f1ead8', { italic: false });
        const G = group(p.x, p.z, a),
          pl = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.6), nm);
        pl.position.set(0, 12.5, -20.05);
        pl.rotation.y = Math.PI;
        G.add(pl);
      }
    // the Social Centre: umbrellas and tables on a paved court beside the road
    const fr = frame(f.s + f.len / 2, 1, W / 2 + 22);
    if (free(fr.x, fr.z, 14, W / 2 + 10)) {
      reserve(fr.x, fr.z, 15);
      for (let u = 0; u < 7; u++) {
        const lx = rr(-10, 10),
          lz = rr(-10, 10);
        fr.put(cy(0.06, 0.06, 2.6, 6), white, lx, 0, lz);
        fr.put(
          new THREE.ConeGeometry(1.8, 0.7, 10).translate(0, 2.8, 0),
          lam(pick(['#e8336a', '#1f7a3e', '#ffc22e', '#2f5d9e'])),
          lx,
          0,
          lz,
        );
        fr.put(cy(0.8, 0.8, 0.75, 10), lam('#d9d2c4'), lx, 0, lz);
      }
    }
    place('THE HALLS', 'Alexander, Ribadu, Suleiman', tr.point(f.s + 40, 0), f.s + 40, { back: 30, lat: 5, lookH: 8 });
  }

  /* ======================================================================================================== */
  /* ---------- Kaduna City Centre ---------- */

  // a shop block: two to four storeys, painted, a signboard at the street, a zinc roof
  const shopBlock = (x, z, a, w, d, floors) => {
    const h = floors * 3.6;
    if (!add(boxM(w, h, d, 12), pick(shopMs), x, 0, z, a)) return false;
    add(bx(w + 0.6, 0.5, d + 0.6), concrete, x, h, z, a, 1, false);
    if (rand() < 0.4) add(bx(2.2, 2.2, 1.6), lam('#e9edf1'), x + rr(-2, 2), h + 0.5, z, a, 1, false); // a water tank on the roof
    return true;
  };
  // keke napep and the yellow buses, parked up on the verge
  const kekeM = lam('#f2c230'),
    kekeG = lam('#1f8a4c'),
    tyreM = lam('#1c1c1e');
  const keke = (x, z, a) => {
    const pt = at(x, z, a);
    pt(bx(1.2, 0.5, 2.4), kekeM, 0, 0.35, 0);
    pt(bx(1.2, 1.1, 1.5), kekeG, 0, 0.85, -0.3);
    pt(bx(1.3, 0.12, 2.2), darkM, 0, 1.95, -0.1); // the canopy (on its frame)
    for (const [wx, wz] of [
      [0, 1.05],
      [-0.55, -0.85],
      [0.55, -0.85],
    ])
      pt(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10).rotateZ(Math.PI / 2).translate(0, 0.3, 0), tyreM, wx, 0, wz);
  };
  const bus = (x, z, a) => {
    const pt = at(x, z, a);
    pt(bx(2.2, 2.2, 5.6), kekeM, 0, 0.45, 0);
    pt(bx(2.25, 0.7, 4.4), darkM, 0, 1.7, -0.3); // the windows
    pt(bx(2.25, 0.2, 5.65), lam('#1c1c1e'), 0, 1.2, 0); // the black stripe
    for (const wz of [-1.8, 1.8])
      for (const wx of [-1, 1])
        pt(
          new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(Math.PI / 2).translate(0, 0.42, 0),
          tyreM,
          wx,
          0,
          wz,
        );
  };
  // billboards: a big board on two legs, phones and drinks with made-up names
  const ADS = [
    ['GUKART MOBILE', '#ff6a00', '#13204f'],
    ['ZAKI MALT', '#7a2b8f', '#ffd34d'],
    ['SAMARU DATA 5G', '#1d5fbf', '#ffffff'],
    ['KADA RICE', '#1f8a4c', '#ffffff'],
    ['TALLY FOAM', '#d7262f', '#ffffff'],
  ];
  const billboard = (x, z, a) => {
    const [t, bg, fg] = pick(ADS),
      G = group(x, z, a);
    for (const sx of [-3.5, 3.5]) G.add(mesh(cy(0.3, 0.35, 9, 8), steelM, sx, 0, 0));
    G.add(mesh(bx(12, 5, 0.4), darkM, 0, 7, 0));
    signBoth(G, glow(board(t, 11.6, 4.6, fg, bg), null, '#ffffff', 0.5), 11.6, 4.6, 0, 7.2, 0, 0, 0.4);
  };
  for (const f of fOf('citystreet')) {
    for (let s = f.s; s < f.s + f.len; s += rr(12, 16))
      for (const sd of [1, -1])
        for (const row of [0, 1]) {
          const p = P(s, sd * (W / 2 + (row ? rr(36, 42) : rr(17, 20))));
          if (!free(p.x, p.z, 6.5, W / 2 + 9)) continue;
          reserve(p.x, p.z, 7);
          shopBlock(p.x, p.z, head(s), rr(10, 13), rr(10, 13), row ? rr(3, 6) | 0 : rr(2, 4) | 0);
        }
    for (let s = f.s + 10; s < f.s + f.len; s += rr(26, 40)) {
      const sd = rand() < 0.5 ? 1 : -1,
        p = P(s, sd * (W / 2 + rr(6, 8)));
      if (!free(p.x, p.z, 3, W / 2 + 4)) continue;
      reserve(p.x, p.z, 3);
      rand() < 0.65 ? keke(p.x, p.z, head(s) + rr(-0.3, 0.3)) : bus(p.x, p.z, head(s));
    }
    for (let s = f.s + 30; s < f.s + f.len; s += 90) {
      const sd = rand() < 0.5 ? 1 : -1,
        p = P(s, sd * (W / 2 + 11));
      if (!free(p.x, p.z, 6, W / 2 + 8)) continue;
      reserve(p.x, p.z, 6);
      billboard(p.x, p.z, head(s) + Math.PI / 2 + rr(-0.4, 0.4));
    }
  }

  // the Stadium roundabout: a giant football on a plinth in a round island, the Ahmadu Bello Stadium behind
  for (const f of fOf('football')) {
    const fr = frame(f.s + 20, 1, W / 2 + 26),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(cy(13.8, 14, 0.5, 40), concrete));
    G.add(mesh(cy(13, 13, 0.7, 40), lawnM));
    G.add(mesh(cy(3.2, 4, 3, 16), white));
    const ballT = canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#16181c';
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 8; c++) {
          const px = (c + (r % 2) * 0.5) * (w / 8),
            py = (r + 0.5) * (h / 4);
          x.beginPath();
          for (let v = 0; v < 5; v++) {
            const an = (v / 5) * TAU - Math.PI / 2;
            x.lineTo(px + Math.cos(an) * 18, py + Math.sin(an) * 18 * (r === 0 || r === 3 ? 0.6 : 1));
          }
          x.fill();
        }
    });
    const ball = mesh(new THREE.SphereGeometry(5, 32, 20), lam('#ffffff', { map: ballT }), 0, 3 + 4.6, 0); // (resting in the plinth's cup)
    G.add(ball);
    animated.push(t => (ball.rotation.y = t * 0.3));
    reserve(fr.x, fr.z, 16);
    // the stadium: a ring of stands, floodlight masts
    const st = frame(f.s + 20, -1, W / 2 + 110);
    if (free(st.x, st.z, 70, W / 2 + 40)) {
      reserve(st.x, st.z, 72);
      const G2 = group(st.x, st.z, st.a),
        standM = lam('#d6d0c4'),
        seatM = lam('#1f8a4c');
      for (let k2 = 0; k2 < 28; k2++) {
        const an = (k2 / 28) * TAU,
          rx = Math.cos(an) * 56,
          rz = Math.sin(an) * 40;
        G2.add(mesh(bx(13, 14, 7), standM, rx, 0, rz, -an + Math.PI / 2));
        G2.add(mesh(bx(13.2, 1, 5), seatM, rx * 0.97, 14, rz * 0.97, -an + Math.PI / 2));
      }
      G2.add(mesh(new THREE.CylinderGeometry(48, 48, 0.3, 40).translate(0, 0.15, 0).scale(1, 1, 0.68), lawnM));
      for (const [sx, sz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        G2.add(mesh(cy(0.5, 0.8, 34, 8), steelM, sx * 62, 0, sz * 46));
        G2.add(
          mesh(bx(6, 3, 0.6), glow(lam('#e9edf1'), null, '#ffffff', 1.5), sx * 62, 34, sz * 46, Math.atan2(sx, sz)),
        );
      }
    }
    place('STADIUM ROUNDABOUT', 'Round the football', { x: fr.x, z: fr.z }, f.s + 20, { back: 40, lookH: 6 });
  }

  // the gate of Murtala Muhammed Square, as it stands: a great grey box frame over the way in, the name in dark letters
  // on a white band across its top, white pillars and black steel gates in the bays either side of the road, a
  // traffic light on the post, and low walls running off each side in a diamond pattern of grey, red and white
  for (const f of fOf('squaregate')) {
    const i = tr.idx(f.s),
      p = tr.point(f.s, 0),
      G = group(p.x, p.z, head(f.s)),
      grey = lam('#5d6168'),
      gateM = lam('#1d1f22'),
      sp = W / 2 + 2.5, // half the opening over the road
      PW = 2, // the frame's posts
      BAY = 9, // each side bay
      half = sp + PW + BAY + PW,
      D = 6,
      H = 15;
    for (const x of [sp + PW / 2, half - PW / 2])
      for (const sx of [-1, 1]) G.add(mesh(bx(PW, H, D), grey, sx * x, 0, 0));
    G.add(mesh(bx(half * 2, 4, D), grey, 0, H - 4, 0)); // the top beam
    signBoth(
      G,
      board('MURTALA MUHAMMED SQUARE', half * 2 - 4, 2.2, '#2a2d33', '#f4f4f0', { italic: false, weight: 700 }),
      half * 2 - 4,
      2.2,
      0,
      H - 3.4,
      0,
      0,
      D,
    );
    for (const sx of [-1, 1]) {
      const bx0 = sx * (sp + PW + BAY / 2);
      G.add(mesh(bx(1.2, H - 4, 1.2), white, bx0, 0, 0)); // the white pillar in the bay
      for (const dx of [-1, 1]) G.add(mesh(bx(BAY / 2 - 0.6, 8, 0.25), gateM, bx0 + (dx * BAY) / 4, 0, 0)); // a gate leaf, shut
      // the wall running off: grey, red and white diamonds
      const wallT = tile((x, w, h) => {
        x.fillStyle = '#6a6e75';
        x.fillRect(0, 0, w, h);
        x.lineWidth = 7;
        for (const [col, o] of [
          ['#c8352e', 0],
          ['#f2f2ee', 12],
        ]) {
          x.strokeStyle = col;
          x.beginPath();
          x.moveTo(o, h);
          x.lineTo(w / 2 + o, 0);
          x.lineTo(w + o, h);
          x.stroke();
        }
      });
      wallT.repeat.set(4, 1);
      G.add(
        mesh(
          new THREE.BoxGeometry(20, 6, 0.8).translate(0, 3, 0),
          lam('#ffffff', { map: wallT }),
          sx * (half + 10),
          0,
          0,
        ),
      );
    }
    // the traffic light on the post at the road's edge
    const tl = new THREE.Group();
    tl.add(mesh(bx(0.7, 2, 0.5), gateM));
    for (const [y, c] of [
      [1.6, '#3a0c10'],
      [1.0, '#3a300c'],
      [0.4, '#2bff6a'],
    ]) {
      const l = mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: c }), 0, y, -0.3);
      tl.add(l);
    }
    tl.position.set(-(sp + PW + 0.35), 5, -1);
    G.add(tl);
    for (let o = -4; o <= 4; o++) tr.wall[tr.wrap(i + o)] = Math.min(tr.wall[tr.wrap(i + o)] || 99, sp - 0.2);
    for (const sx of [-1, 1])
      for (const d of [sp + 6, half - 3, half + 10]) {
        const q = tr.beside(i, sx * d);
        reserve(q.x, q.z, 7);
      }
    place('THE SQUARE GATE', 'In through the gate', p, f.s, { back: 40, h: 3, lookH: 9 });
  }

  // the racecourse: white rails on both sides of the road all the way round, the lawn of the oval inside, the old
  // grandstand outside, the cable footbridge over the course, the gazebo on the grass
  for (const f of fOf('racecourse')) {
    const posts = [],
      rails = [];
    for (let s = f.s; s < f.s + f.len; s += 3) {
      const i = tr.idx(s),
        a = head(s);
      if (tr.elevated[i]) continue;
      for (const sd of [1, -1]) {
        const q = tr.beside(i, sd * (W / 2 + 4));
        posts.push(new THREE.BoxGeometry(0.16, 1.2, 0.16).translate(q.x, 0.6, q.z));
        for (const y of [1.15, 0.6])
          rails.push(new THREE.BoxGeometry(0.1, 0.14, 3.05).translate(0, y, 0).rotateY(a).translate(q.x, 0, q.z));
      }
      reserve(tr.beside(i, W / 2 + 4).x, tr.beside(i, W / 2 + 4).z, 1.5);
      reserve(tr.beside(i, -W / 2 - 4).x, tr.beside(i, -W / 2 - 4).z, 1.5);
    }
    for (const [list, m] of [
      [posts, railWhite],
      [rails, railWhite],
    ]) {
      const me = new THREE.Mesh(mergeGeometries(list), m);
      me.castShadow = true;
      scene.add(me);
    }
    // the horses' sand track on the field side, between the rail by the road and a second rail; the paved promenade
    // on the other side with its benches (both laid on the flat shoulder, off the road)
    const ribbon = (lat0, lat1, mat) => {
      const pos = [],
        idx = [];
      let n = 0;
      for (let s = f.s; s <= f.s + f.len; s += 3) {
        const i = tr.idx(s);
        if (tr.elevated[i]) {
          n = 0;
          continue;
        }
        const sd = inside(s);
        for (const l of [lat0, lat1]) {
          const q = tr.beside(i, sd * l);
          pos.push(q.x, 0.14, q.z);
        }
        const v = pos.length / 3;
        if (n++) idx.push(v - 4, v - 3, v - 2, v - 3, v - 1, v - 2, v - 4, v - 2, v - 3, v - 3, v - 2, v - 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      scene.add(m);
    };
    ribbon(W / 2 + 4.3, W / 2 + 11.2, lam('#d9b98a', { side: THREE.DoubleSide }));
    ribbon(-(W / 2 + 4.3), -(W / 2 + 11.2), lam('#cfcac0', { side: THREE.DoubleSide }));
    const posts2 = [],
      rails2 = [],
      benches = [];
    for (let s = f.s; s < f.s + f.len; s += 3) {
      const i = tr.idx(s),
        a = head(s);
      if (tr.elevated[i]) continue;
      const q = tr.beside(i, inside(s) * (W / 2 + 11.4));
      posts2.push(new THREE.BoxGeometry(0.16, 1.2, 0.16).translate(q.x, 0.6, q.z));
      rails2.push(new THREE.BoxGeometry(0.1, 0.14, 3.05).translate(0, 1.15, 0).rotateY(a).translate(q.x, 0, q.z));
      if (Math.round(s - f.s) % 27 === 0) {
        const b2 = tr.beside(i, -inside(s) * (W / 2 + 8));
        benches.push(new THREE.BoxGeometry(0.6, 0.45, 2.4).translate(0, 0.37, 0).rotateY(a).translate(b2.x, 0, b2.z));
        benches.push(new THREE.BoxGeometry(0.12, 0.5, 2.4).translate(-0.3, 0.8, 0).rotateY(a).translate(b2.x, 0, b2.z));
      }
    }
    for (const [list, m] of [
      [posts2, railWhite],
      [rails2, railWhite],
      [benches, lam('#7a5a3a')],
    ])
      if (list.length) {
        const me = new THREE.Mesh(mergeGeometries(list), m);
        me.castShadow = true;
        scene.add(me);
      }
    // the ground inside the square: ten fenced football pitches in two rows beside the course, a red running track
    // round them, and further in the polo club (its long green field, the low white boards, the posts at each end,
    // the clubhouse). All laid out in one frame: z along the course, x in across the square
    const sm = f.s + f.len * 0.32,
      o = P(sm, 0),
      IN = inside(sm),
      FG = group(o.x, o.z, head(sm)),
      X = d => IN * d; // (local x, measured in from the road)
    const pitchT = canvasTex(512, 320, (x, w, h) => {
      for (let k2 = 0; k2 < 10; k2++) {
        x.fillStyle = k2 % 2 ? '#2f8f3a' : '#3a9c44';
        x.fillRect((k2 * w) / 10, 0, w / 10 + 1, h);
      }
      x.strokeStyle = '#ffffff';
      x.lineWidth = 4;
      x.strokeRect(14, 14, w - 28, h - 28);
      x.beginPath();
      x.moveTo(w / 2, 14);
      x.lineTo(w / 2, h - 14);
      x.stroke();
      x.beginPath();
      x.arc(w / 2, h / 2, 40, 0, TAU);
      x.stroke();
      x.strokeRect(14, h / 2 - 60, 60, 120);
      x.strokeRect(w - 74, h / 2 - 60, 60, 120);
    });
    const pitchM = lam('#ffffff', { map: pitchT }),
      netM = new THREE.MeshLambertMaterial({
        color: '#d9e4e8',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      fencePosts = [];
    const PL = 40, // a pitch's length (along the course)
      PWd = 25, // and width
      C0 = W / 2 + 46, // the first row's middle, in from the road
      ROWS = [C0, C0 + 31],
      ZS = [-96, -48, 0, 48, 96];
    // the dry grass the whole complex sits on, the red running track round it
    const x0 = C0 - 22,
      x1 = C0 + 31 + 22,
      z0 = -126,
      z1 = 126;
    FG.add(
      mesh(
        new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate(X((x0 + x1) / 2), 0.2, 0),
        lam('#a3a35c'),
      ),
    );
    const ring = (w2, d2, r) => {
      const sh = new THREE.Shape();
      sh.moveTo(-w2 / 2 + r, -d2 / 2);
      sh.lineTo(w2 / 2 - r, -d2 / 2);
      sh.quadraticCurveTo(w2 / 2, -d2 / 2, w2 / 2, -d2 / 2 + r);
      sh.lineTo(w2 / 2, d2 / 2 - r);
      sh.quadraticCurveTo(w2 / 2, d2 / 2, w2 / 2 - r, d2 / 2);
      sh.lineTo(-w2 / 2 + r, d2 / 2);
      sh.quadraticCurveTo(-w2 / 2, d2 / 2, -w2 / 2, d2 / 2 - r);
      sh.lineTo(-w2 / 2, -d2 / 2 + r);
      sh.quadraticCurveTo(-w2 / 2, -d2 / 2, -w2 / 2 + r, -d2 / 2);
      return sh;
    };
    {
      const outer = ring(x1 - x0 - 2, z1 - z0 - 2, 22),
        inner = ring(x1 - x0 - 10, z1 - z0 - 10, 18);
      outer.holes.push(inner);
      FG.add(
        mesh(
          new THREE.ShapeGeometry(outer, 24).rotateX(-Math.PI / 2).translate(X((x0 + x1) / 2), 0.23, 0),
          lam('#b45a3c'),
        ),
      );
    }
    for (const cx of ROWS)
      for (const dz of ZS) {
        FG.add(
          mesh(
            new THREE.PlaneGeometry(PL, PWd)
              .rotateX(-Math.PI / 2)
              .rotateY(Math.PI / 2)
              .translate(X(cx), 0.25, dz),
            pitchM,
          ),
        );
        // the fence round it: a see-through net on posts
        for (const [w2, d2, ox, oz] of [
          [PWd, 0.05, 0, PL / 2],
          [PWd, 0.05, 0, -PL / 2],
          [0.05, PL, PWd / 2, 0],
          [0.05, PL, -PWd / 2, 0],
        ]) {
          FG.add(mesh(new THREE.BoxGeometry(w2, 3, d2).translate(0, 1.5, 0), netM, X(cx) + ox, 0, dz + oz));
          const n2 = Math.round(Math.max(w2, d2) / 5);
          for (let k2 = 0; k2 <= n2; k2++) {
            const u = k2 / n2 - 0.5;
            fencePosts.push(
              cy(0.06, 0.06, 3, 5).translate(X(cx) + ox + (w2 > 1 ? u * w2 : 0), 0, dz + oz + (d2 > 1 ? u * d2 : 0)),
            );
          }
        }
        for (const gz of [-PL / 2 + 0.8, PL / 2 - 0.8]) FG.add(mesh(bx(5, 2, 0.1), netM, X(cx), 0, dz + gz)); // the goals
        // a floodlight at the corner
        fencePosts.push(cy(0.12, 0.15, 10, 6).translate(X(cx + PWd / 2), 0, dz + PL / 2));
        fencePosts.push(bx(1.6, 0.8, 0.3).translate(X(cx + PWd / 2), 10, dz + PL / 2));
      }
    FG.add(mesh(mergeGeometries(fencePosts.map(g => (g.index ? g.toNonIndexed() : g))), steelM));
    // the polo club: a long green field in across the square, white boards down its sides, the posts at each end, the
    // clubhouse beside it with its veranda
    const PX = x1 + 70,
      PFL = 200,
      PFW = 110;
    const pc = tr.beside(tr.idx(sm), IN * PX);
    if (free(pc.x, pc.z, 60, W / 2 + 40)) {
      FG.add(mesh(new THREE.PlaneGeometry(PFW, PFL).rotateX(-Math.PI / 2).translate(X(PX), 0.22, 0), grassM));
      for (const sx of [-1, 1]) FG.add(mesh(bx(0.15, 0.5, PFL), white, X(PX) + (sx * PFW) / 2, 0, 0)); // the boards
      for (const ez of [-1, 1])
        for (const sx of [-1, 1]) FG.add(mesh(cy(0.18, 0.18, 3.2, 8), white, X(PX) + sx * 3.7, 0, (ez * PFL) / 2)); // the posts
      const ch = X(PX + PFW / 2 + 16);
      FG.add(mesh(bx(14, 6, 36), white, ch, 0, 0));
      FG.add(
        mesh(
          new THREE.ConeGeometry(1, 1, 4)
            .rotateY(Math.PI / 4)
            .scale(12, 3, 28)
            .translate(0, 7.5, 0),
          lam('#1f7a3e'),
          ch,
          0,
          0,
        ),
      );
      FG.add(mesh(bx(4, 0.3, 36), white, ch - IN * 9, 3.6, 0)); // the veranda roof
      for (let z = -16; z <= 16; z += 4) FG.add(mesh(cy(0.15, 0.15, 3.6, 6), white, ch - IN * 10.6, 0, z));
      FG.add(mesh(bx(0.2, 1.4, 6), white, ch - IN * 7.1, 4.2, 0));
      signBoth(
        FG,
        board('KADUNA POLO CLUB', 6, 1.2, '#ffffff', '#1f7a3e', { italic: false }),
        6,
        1.2,
        ch - IN * 7.1,
        4.3,
        0,
        Math.PI / 2,
        0.2,
      );
      for (let z = -PFL / 2; z <= PFL / 2; z += 30) {
        const q = tr.beside(tr.idx(sm + z), IN * PX);
        reserve(q.x, q.z, 60);
      }
      place('THE POLO CLUB', 'Across the square', pc, sm, { back: 20, lat: 0, h: 6, lookH: 3 });
    }
    for (let z = z0; z <= z1; z += 20) {
      const q = tr.beside(tr.idx(sm + z), IN * ((x0 + x1) / 2));
      reserve(q.x, q.z, (x1 - x0) / 2 + 4);
    }
    place('MURTALA SQUARE', 'Along the old racecourse', tr.point(f.s + 60, 0), f.s + 60, { back: 30, h: 4, lookH: 6 });
  }
  // the footbridge over the racecourse, as it stands: a dark grey steel suspension bridge. The road itself climbs its
  // access ramp, runs along the deck between the cables and comes down the far ramp. Two H-frame pylons stand on the
  // ground either side of the deck (a crossbeam under it, one over it), the main cables sag between their tops and run
  // down to anchor blocks on the ground at each end, hangers drop from them to steel edge girders along the deck, and
  // a steel railing runs all the way up, along and down. Every piece reaches the ground or the deck
  for (const f of fOf('skywalk')) {
    const steel = lam('#3f464d'),
      anchorM = lam('#8d8a84'),
      UP = new THREE.Vector3(0, 1, 0),
      rods = [],
      boxes = [],
      blocks = [];
    const rod = (a, b, r) => {
      const len = a.distanceTo(b);
      if (len < 0.01) return;
      const g = new THREE.CylinderGeometry(r, r, len, 6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      rods.push(g);
    };
    const deckY = s => tr.P[tr.idx(s)].y;
    const at3 = (s, lat, y) => {
      const q = tr.beside(tr.idx(s), lat);
      return new THREE.Vector3(q.x, y, q.z);
    };
    const s0 = f.s,
      s1 = f.s + f.len,
      CL = W / 2 + 2.6; // the cables' and hangers' line, either side
    // the railing, up the ramp, along the deck and down: posts every 2.5 m, a top and a middle rail
    for (const sd of [-1, 1]) {
      let prev = null;
      for (let s = s0; s <= s1; s += 2.5) {
        const y = deckY(s),
          foot = at3(s, sd * (W / 2 + 0.9), y + 0.9),
          top = at3(s, sd * (W / 2 + 0.9), y + 2.1);
        rod(foot, top, 0.06);
        if (prev) {
          rod(prev[0], top, 0.07);
          rod(prev[1], at3(s, sd * (W / 2 + 0.9), y + 1.5), 0.04);
        }
        prev = [top, at3(s, sd * (W / 2 + 0.9), y + 1.5)];
      }
    }
    // the edge girders the hangers hang from, either side of the deck along its level top
    const t0 = s0 + 90,
      t1 = s1 - 90;
    for (let s = t0 - 4; s < t1 + 4; s += 4) {
      const i = tr.idx(s),
        a = head(s),
        y = deckY(s);
      for (const sd of [-1, 1]) {
        const q = tr.beside(i, sd * (W / 2 + 1.8));
        boxes.push(
          new THREE.BoxGeometry(2.2, 1.1, 4.05)
            .translate(0, y - 0.7, 0)
            .rotateY(a)
            .translate(q.x, 0, q.z),
        );
      }
    }
    // the pylons: two legs each side of the deck, from the ground to 14 m over it, crossbeams under and over the deck
    const H = 11 + 14,
      towers = [t0 + 12, t1 - 12];
    for (const s of towers) {
      const i = tr.idx(s),
        a = head(s);
      for (const sd of [-1, 1])
        for (const dz of [-0.9, 0.9]) {
          const q = tr.beside(i, sd * CL),
            t = tr.T[i];
          boxes.push(new THREE.BoxGeometry(0.8, H, 0.8).translate(q.x + t.x * dz, H / 2, q.z + t.z * dz));
        }
      const c = tr.beside(i, 0);
      boxes.push(
        new THREE.BoxGeometry(CL * 2 + 0.8, 0.9, 2.6)
          .translate(0, deckY(s) - 1.4, 0)
          .rotateY(a)
          .translate(c.x, 0, c.z),
      );
      boxes.push(
        new THREE.BoxGeometry(CL * 2 + 0.8, 0.9, 2.6)
          .translate(0, H - 0.45, 0)
          .rotateY(a)
          .translate(c.x, 0, c.z),
      );
    }
    // the main cables: from an anchor block on the ground, up to the first pylon, sagging to just over the deck, up to
    // the second, and down to the far anchor; hangers every 5 m between the pylons down to the edge girders
    const sag = (s, sa, sb, ya, yb, low) => {
      const u = (s - sa) / (sb - sa);
      return ya + (yb - ya) * u - 4 * (Math.min(ya, yb) - low) * u * (1 - u);
    };
    for (const sd of [-1, 1]) {
      const anchors = [s0 - 18, s1 + 18];
      for (const s of anchors) {
        const i = tr.idx(s),
          q = tr.beside(i, sd * CL);
        blocks.push(new THREE.BoxGeometry(3, 1.6, 3).rotateY(head(s)).translate(q.x, 0.8, q.z));
        reserve(q.x, q.z, 3);
      }
      const pts = [];
      for (let s = anchors[0]; s <= towers[0]; s += 6)
        pts.push(at3(s, sd * CL, 1.4 + ((H - 1.4) * (s - anchors[0])) / (towers[0] - anchors[0])));
      for (let s = towers[0]; s <= towers[1]; s += 3)
        pts.push(at3(s, sd * CL, sag(s, towers[0], towers[1], H, H, 11 + 2.2)));
      for (let s = towers[1]; s <= anchors[1]; s += 6)
        pts.push(at3(s, sd * CL, H - ((H - 1.4) * (s - towers[1])) / (anchors[1] - towers[1])));
      pts.push(at3(anchors[1], sd * CL, 1.4));
      for (let k2 = 1; k2 < pts.length; k2++) rod(pts[k2 - 1], pts[k2], 0.16);
      for (let s = towers[0] + 5; s < towers[1] - 2; s += 5) {
        const y = sag(s, towers[0], towers[1], H, H, 11 + 2.2);
        rod(at3(s, sd * CL, y), at3(s, sd * CL, deckY(s) - 0.2), 0.05);
      }
    }
    // "ACCESS RAMP" on a post at the foot of each ramp, as on the real one
    const accessM = board('ACCESS RAMP', 2.6, 0.9, '#1a1a1a', '#f2c230', { italic: false, weight: 900 });
    for (const [s, sd] of [
      [s0 - 4, 1],
      [s1 + 4, -1],
    ]) {
      const q = tr.beside(tr.idx(s), sd * (W / 2 + 4)),
        G = group(q.x, q.z, head(s));
      G.add(mesh(cy(0.08, 0.08, 2.6, 6), steel));
      signBoth(G, accessM, 2.6, 0.9, 0, 2.1, 0, 0, 0.06);
      reserve(q.x, q.z, 2);
    }
    for (const [list, m] of [
      [rods, steel],
      [boxes, steel],
      [blocks, anchorM],
    ]) {
      const me = new THREE.Mesh(mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g))), m);
      me.castShadow = me.receiveShadow = true;
      scene.add(me);
    }
    for (let s = s0 - 20; s <= s1 + 20; s += 8)
      for (const sd of [-1, 1]) {
        const q = tr.beside(tr.idx(s), sd * (CL + 2));
        reserve(q.x, q.z, 5);
      }
    const mid = (t0 + t1) / 2;
    place('THE FOOTBRIDGE', 'Up the ramp and over the course', tr.point(mid, 0), mid, { back: 70, h: 6, lookH: 14 });
  }
  // the grandstand, as it stands now: concrete tiers with rows of red and blue seats, a steel handrail along the
  // front, and at its end a building of grey panels with a tall wedge of white lattice and a roof cantilevered out
  for (const f of fOf('grandstand')) {
    const fr = frame(f.s, -1, W / 2 + 20),
      pt = fr.put,
      L = 70;
    const seatT = tile((x, w, h) => {
      x.fillStyle = '#c9c4ba';
      x.fillRect(0, 0, w, h);
      for (let k2 = 0; k2 < 8; k2++) {
        x.fillStyle = Math.floor(k2 / 4) % 2 ? '#2b4fae' : '#9c2234';
        x.fillRect(k2 * 16 + 2, 4, 12, h - 8);
      }
    });
    seatT.repeat.set(L / 8, 1);
    const seatM = lam('#ffffff', { map: seatT });
    for (let r = 0; r < 8; r++) {
      const ox = -fr.rx * r * 1.8,
        h = 0.6 + r * 0.75;
      pt(bx(1.8, h, L), concrete, ox, 0, 0, 0, true);
      pt(bx(0.9, 0.45, L), seatM, ox - fr.rx * 0.2, h, 0);
    }
    // the handrail along the front
    for (let z = -L / 2; z <= L / 2; z += 3) pt(cy(0.05, 0.05, 1.6, 5), darkM, fr.rx * 1.1, 0, z);
    pt(bx(0.08, 0.08, L), darkM, fr.rx * 1.1, 1.6, 0);
    // the end building: grey panels, the lattice wedge, the roof slab
    const panelT = tile((x, w, h) => {
      x.fillStyle = '#9aa0a6';
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(40,45,50,.35)';
      for (let k2 = 0; k2 < w; k2 += 32) x.fillRect(k2, 0, 1.5, h);
      for (let k2 = 0; k2 < h; k2 += 24) x.fillRect(0, k2, w, 1.5);
    });
    const latticeT = tile((x, w, h) => {
      x.fillStyle = '#f2f2ee';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#8d939a';
      x.lineWidth = 3;
      for (let k2 = -h; k2 < w + h; k2 += 14) {
        x.beginPath();
        x.moveTo(k2, 0);
        x.lineTo(k2 + h, h);
        x.moveTo(k2, h);
        x.lineTo(k2 + h, 0);
        x.stroke();
      }
    });
    const ez = L / 2 + 9,
      bxo = -fr.rx * 8;
    pt(boxM(16, 13, 18, 6), lam('#ffffff', { map: panelT }), bxo, 0, ez, 0, true);
    const wedge = new THREE.Shape();
    wedge.moveTo(-8, 0);
    wedge.lineTo(8, 0);
    wedge.lineTo(8, 15);
    wedge.lineTo(-8, 13);
    wedge.lineTo(-8, 0);
    const wg = new THREE.ExtrudeGeometry(wedge, { depth: 1, bevelEnabled: false });
    wg.scale(1 / 16, 1 / 15, 1); // (UVs come out in shape units: the lattice repeats)
    wg.scale(16, 15, 1);
    pt(wg, lam('#ffffff', { map: latticeT }), bxo, 0, ez - 9.5);
    pt(bx(20, 0.6, 24), white, bxo + fr.rx * 2, 13, ez);
    reserve(fr.x, fr.z, 10);
    for (let z = -L / 2; z <= ez + 10; z += 12) {
      const q = P(f.s + z, -inside(f.s) * (W / 2 + 28));
      reserve(q.x, q.z, 12);
    }
    place('THE GRANDSTAND', 'Past the red and blue seats', { x: fr.x, z: fr.z }, f.s, { back: 40, lookH: 5 });
  }
  for (const f of fOf('gazebo')) {
    const fr = frame(f.s, 1, W / 2 + 26),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(cy(5.4, 5.6, 0.6, 8), white));
    for (let k2 = 0; k2 < 8; k2++) {
      const an = (k2 / 8) * TAU;
      G.add(mesh(cy(0.22, 0.22, 4, 8), white, Math.cos(an) * 4.6, 0.6, Math.sin(an) * 4.6));
    }
    G.add(mesh(new THREE.ConeGeometry(6, 3, 8).translate(0, 6.1, 0), lam('#1f7a3e')));
    G.add(mesh(bx(9.6, 0.4, 9.6).rotateY(0), white, 0, 4.4, 0).rotateY(Math.PI / 8));
    reserve(fr.x, fr.z, 8);
  }

  // Lugard Hall: the white hall on the crescent, its big green dome over the middle and a little one at each corner,
  // an arcade of arches along the front
  for (const f of fOf('lugard')) {
    const fr = frame(f.s + 30, 1, W / 2 + 36),
      G = group(fr.x, fr.z, fr.a),
      domeM = lam('#2f8a4c');
    const arcT = tile((x, w, h) => {
      x.fillStyle = '#f6f4ee';
      x.fillRect(0, 0, w, h);
      grain(x, w, h, 200, 0.04);
      x.fillStyle = '#3a3a3a';
      for (let c = 0; c < 2; c++) {
        x.beginPath();
        const cx = c * 64 + 32;
        x.moveTo(cx - 18, h);
        x.lineTo(cx - 18, 60);
        x.arc(cx, 60, 18, Math.PI, 0);
        x.lineTo(cx + 18, h);
        x.fill();
      }
    });
    const arcM = glow(lam('#ffffff', { map: arcT }), null, '#ffd49a', 0.25);
    const blkM = new THREE.Mesh(boxM(30, 14, 56, 8), arcM);
    blkM.castShadow = blkM.receiveShadow = true;
    G.add(blkM);
    G.add(mesh(bx(31, 1, 57), white, 0, 14, 0));
    // the drum and the big dome
    G.add(mesh(cy(8, 8, 4, 24), white, 0, 15, 0));
    G.add(mesh(new THREE.SphereGeometry(8, 24, 14, 0, TAU, 0, Math.PI / 2), domeM, 0, 19, 0));
    G.add(mesh(cy(0.5, 0.5, 3, 8), lam('#d9b25a'), 0, 27, 0));
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      G.add(mesh(cy(2.6, 2.6, 3, 12), white, sx * 12, 15, sz * 25));
      G.add(mesh(new THREE.SphereGeometry(2.6, 16, 10, 0, TAU, 0, Math.PI / 2), domeM, sx * 12, 18, sz * 25));
    }
    // the name over the door (facing the road)
    signBoth(
      G,
      board('LUGARD HALL', 14, 1.6, '#1f5a34', '#f6f4ee', { italic: false }),
      14,
      1.6,
      fr.rx * 15.2,
      10.5,
      0,
      (Math.PI / 2) * fr.rx,
      0.1,
    );
    reserve(fr.x, fr.z, 34);
    // lawns and palms round it
    for (let n = 0; n < 8; n++) {
      const q = P(f.s + rr(-10, 70), inside(f.s) * (W / 2 + rr(10, 16)));
      tryTree(q.x, q.z, 1.5, 'doum', 1, W / 2 + 6);
    }
    place('LUGARD HALL', 'Round the crescent', { x: fr.x, z: fr.z }, f.s + 30, { back: 50, lookH: 16, h: 5 });
  }

  // the flyover: the name on a board beside the foot of the ramp
  for (const f of fOf('flyover')) {
    const fr = frame(f.s - 10, -1, W / 2 + 6),
      G = group(fr.x, fr.z, fr.a);
    for (const z of [-3, 3]) G.add(mesh(cy(0.18, 0.2, 5, 8), steelM, 0, 0, z));
    signBoth(
      G,
      board('QUEEN AMINA FLYOVER', 8, 1.4, '#ffffff', '#00703c', { italic: false, border: '#ffffff' }),
      8,
      1.4,
      0,
      3.4,
      0,
      Math.PI / 2,
      0.2,
    );
    place('QUEEN AMINA FLYOVER', 'Up and over', tr.point(f.s + 140, 12), f.s + 140, { back: 30, h: 4, lookH: 4 });
  }

  // the Central Market: the blue arch of the Sheikh Abubakar Gumi market over the road, the market's sheds behind
  for (const f of fOf('gumiarch')) {
    const i = tr.idx(f.s),
      p = tr.point(f.s, 0),
      G = group(p.x, p.z, head(f.s)),
      blue = lam('#1f62c4'),
      sp = W / 2 + 2.5,
      H = 13;
    for (const sx of [-1, 1]) {
      G.add(mesh(bx(3, H, 3), blue, sx * (sp + 1.5), 0, 0));
      G.add(
        mesh(
          new THREE.ConeGeometry(1.6, 2.5, 4).rotateY(Math.PI / 4).translate(0, H + 1.25, 0),
          white,
          sx * (sp + 1.5),
          0,
          0,
        ),
      );
    }
    // the pointed arch across the top, a panel of the name under its crown
    const sh = new THREE.Shape();
    sh.moveTo(-sp - 3, H - 4.5);
    sh.lineTo(-sp, H - 4.5);
    sh.quadraticCurveTo(-sp * 0.5, H - 0.5, 0, H + 1.4);
    sh.quadraticCurveTo(sp * 0.5, H - 0.5, sp, H - 4.5);
    sh.lineTo(sp + 3, H - 4.5);
    sh.lineTo(sp + 3, H);
    sh.lineTo(0, H + 4);
    sh.lineTo(-sp - 3, H);
    sh.lineTo(-sp - 3, H - 4.5);
    G.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2), blue));
    G.add(mesh(bx(sp * 2 + 0.4, 2, 2.4), blue, 0, H - 6.5, 0)); // the beam between the pillars, the name on it
    signBoth(
      G,
      board('SHEIKH ABUBAKAR GUMI CENTRAL MARKET', 20, 1.6, '#ffffff', '#1f62c4', { italic: false }),
      20,
      1.6,
      0,
      H - 6.3,
      0,
      0,
      2.4,
    );
    for (let o = -3; o <= 3; o++) tr.wall[tr.wrap(i + o)] = Math.min(tr.wall[tr.wrap(i + o)] || 99, sp - 0.2);
    for (const sx of [-1, 1]) {
      const q = tr.beside(i, sx * (sp + 2));
      reserve(q.x, q.z, 4);
    }
    place('CENTRAL MARKET', 'Through the blue arch', p, f.s, { back: 40, h: 3, lookH: 9 });
  }
  for (const f of fOf('market'))
    if (CIRC === 'city')
      for (let s = f.s; s < f.s + f.len; s += 26)
        for (const sd of [1, -1]) {
          // the market's sheds: long low roofs of zinc on posts, stalls under them
          const p = P(s + 13, sd * (W / 2 + 34)),
            a = head(s + 13);
          if (!free(p.x, p.z, 12, W / 2 + 20)) continue;
          reserve(p.x, p.z, 12);
          const pt = at(p.x, p.z, a);
          pt(bx(14, 0.3, 22), pick([roofZinc, roofRust]), 0, 4.2, 0);
          for (const x of [-6.5, 6.5]) for (const z of [-10, 0, 10]) pt(cy(0.15, 0.15, 4.2, 6), steelM, x, 0, z);
          for (let n = 0; n < 6; n++) pt(bx(2.6, 1, 1.6), lam(pick(['#8d6a4b', '#a07a52'])), rr(-5, 5), 0, rr(-9, 9));
        }

  // the ring of flowers over Ahmadu Bello Way: a round walkway on columns, high over the road, its two edges heaped
  // with pink bougainvillea in long planters, white railings, a stair down to the pavement at each corner
  for (const f of fOf('flowerring')) {
    const i = tr.idx(f.s),
      p = tr.point(f.s, 0),
      G = group(p.x, p.z, head(f.s)),
      R = W / 2 + 22, // the ring's middle line
      HW = 2.6, // half the walkway's width
      Y = 7.2, // the deck's height
      SEG = 96,
      deckM = lam('#e9e4da'),
      railM = lam('#f7f7f4'),
      planterM = lam('#c9c2b4'),
      leafM = lam('#3f7a32', { flatShading: true }),
      PINK = ['#e8336a', '#f04a7c', '#d81b60', '#ff5c8a', '#c2185b'].map(c => lam(c, { flatShading: true }));
    // the deck: a flat annulus, and its edge a little deeper
    const ring = new THREE.RingGeometry(R - HW, R + HW, SEG, 1).rotateX(-Math.PI / 2);
    G.add(mesh(ring.clone().translate(0, Y + 0.5, 0), deckM));
    const under = new THREE.Mesh(
      new THREE.RingGeometry(R - HW, R + HW, SEG, 1).rotateX(Math.PI / 2).translate(0, Y - 0.3, 0),
      deckM,
    );
    G.add(under);
    for (const r of [R - HW, R + HW])
      G.add(mesh(new THREE.CylinderGeometry(r, r, 0.8, SEG, 1, true).translate(0, Y + 0.1, 0), deckM));
    // the planters along both edges, the flowers in them, the railings outside them
    const blobs = new Map(),
      leaves = [],
      rails = [],
      posts = [];
    for (let k = 0; k < SEG * 2; k++) {
      const a = (k / (SEG * 2)) * TAU;
      for (const [r, sd] of [
        [R - HW + 0.5, -1],
        [R + HW - 0.5, 1],
      ]) {
        const x = Math.cos(a) * r,
          z = Math.sin(a) * r;
        if (k % 2 === 0) {
          const g = new THREE.BoxGeometry(0.9, 0.7, (TAU * r) / SEG + 0.05).rotateY(-a).translate(x, Y + 0.85, z);
          (blobs.get(planterM) || blobs.set(planterM, []).get(planterM)).push(g);
        }
        // a mound of leaves and flowers spilling over the edge
        leaves.push(
          new THREE.IcosahedronGeometry(0.75, 0).translate(
            x + Math.cos(a) * sd * 0.2,
            Y + 1.45,
            z + Math.sin(a) * sd * 0.2,
          ),
        );
        const pm = PINK[(k * 7 + (sd > 0 ? 3 : 0)) % PINK.length];
        for (let b = 0; b < 2; b++) {
          const off = sd * (0.25 + b * 0.35);
          (blobs.get(pm) || blobs.set(pm, []).get(pm)).push(
            new THREE.IcosahedronGeometry(0.55 + (b ? 0 : 0.15), 0).translate(
              x + Math.cos(a) * off,
              Y + 1.6 - b * 0.55,
              z + Math.sin(a) * off,
            ),
          );
        }
      }
      // the railing on the inside edge (the outside is heaped with flowers)
      const r2 = R - HW + 0.05,
        x2 = Math.cos(a) * r2,
        z2 = Math.sin(a) * r2;
      if (k % 4 === 0) posts.push(new THREE.BoxGeometry(0.08, 1.1, 0.08).translate(x2, Y + 1.05, z2));
    }
    rails.push(new THREE.TorusGeometry(R - HW + 0.05, 0.05, 4, SEG).rotateX(Math.PI / 2).translate(0, Y + 1.6, 0));
    for (const [m, list] of [
      [leafM, leaves],
      [railM, rails.concat(posts)],
    ])
      G.add(mesh(mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g))), m));
    for (const [m, list] of blobs) G.add(mesh(mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g))), m));
    // the columns: round, white, wherever the ring is clear of the road (never over it), a capital under the deck
    const clearLat = W / 2 + 4;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU + TAU / 48,
        x = Math.cos(a) * R,
        z = Math.sin(a) * R;
      if (Math.abs(x) < clearLat + 1.2) continue; // (x is across the road in this frame)
      G.add(mesh(cy(0.7, 0.85, Y - 0.3, 14), railM, x, 0, z));
    }
    // the stairs: four flights from the ring down to the pavements, out on the diagonals
    const stairM = lam('#d9d3c6');
    for (const a of [TAU / 8, (3 * TAU) / 8, (5 * TAU) / 8, (7 * TAU) / 8]) {
      const ox = Math.cos(a) * (R + HW),
        oz = Math.sin(a) * (R + HW),
        SG = new THREE.Group();
      SG.position.set(ox, 0, oz);
      SG.rotation.y = -a + Math.PI / 2;
      const steps = 16,
        run = 14;
      for (let k = 0; k < steps; k++) {
        const h = Y + 0.5 - ((k + 1) * (Y + 0.5)) / steps;
        SG.add(mesh(bx(3, h, run / steps + 0.02), stairM, 0, 0, (k + 0.5) * (run / steps)));
      }
      for (const sx of [-1.55, 1.55]) {
        const rl = mesh(new THREE.BoxGeometry(0.08, 0.08, Math.hypot(run, Y)).translate(0, 0, 0), railM);
        rl.position.set(sx, Y / 2 + 1.5, run / 2);
        rl.rotation.x = Math.atan2(Y, run);
        SG.add(rl);
        for (let k = 0; k <= 4; k++) {
          const z = (k / 4) * run,
            h = Y + 0.5 - (z / run) * (Y + 0.5);
          SG.add(mesh(bx(0.08, 1.1, 0.08), railM, sx, h, z));
        }
      }
      G.add(SG);
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU,
        x = Math.cos(a) * (R + 6),
        z = Math.sin(a) * (R + 6),
        q = new THREE.Vector3(x, 0, z)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), head(f.s))
          .add(new THREE.Vector3(p.x, 0, p.z));
      if (Math.abs(x) > W / 2 + 6) reserve(q.x, q.z, 10);
    }
    for (let o = -12; o <= 12; o++) {
      const j = tr.wrap(i + o);
      tr.wall[j] = Math.min(tr.wall[j] || 99, W / 2 + 3); // (the columns stand off the kerb)
    }
    place('THE FLOWER RING', 'Under the bougainvillea', p, f.s, { back: 50, h: 4, lookH: 8 });
  }

  /* ======================================================================================================== */
  /* ---------- Zazzau ---------- */

  // the Emir's palace on the square: a long front wall, cream, painted in the zanen gida (knots, diamond bands, in
  // green, blue, red and ochre) round a tall gate tower, horned pinnacles along the top; the durbar horsemen lined up on
  // the square in front of it
  const ZPAL = [
    ['rgba(10,40,20,.4)', 'rgba(255,255,255,.5)', '#1f8a4c'],
    ['rgba(10,15,50,.4)', 'rgba(255,255,255,.5)', '#2b4fae'],
    ['rgba(60,10,10,.4)', 'rgba(255,255,255,.5)', '#c8352e'],
    ['rgba(60,40,0,.4)', 'rgba(255,255,255,.5)', '#e0a42a'],
  ];
  for (const f of fOf('palacesq')) {
    const sm = f.s + 70,
      fr = frame(sm, 1, W / 2 + 62),
      G = group(fr.x, fr.z, fr.a),
      FW = 90, // the front's width
      rx = fr.rx;
    // its face: zanen gida across a cream wall, a band of colour at the foot
    const faceT = canvasTex(2048, 360, (x, w, h) => {
      x.fillStyle = '#f2e6cc';
      x.fillRect(0, 0, w, h);
      grain(x, w, h, 900, 0.05);
      x.fillStyle = '#1f8a4c';
      x.fillRect(0, h - 26, w, 26);
      const step = w / 18;
      for (let c = 0; c < 18; c++) {
        const cx = (c + 0.5) * step,
          pal = ZPAL[c % 4];
        if (Math.abs(c - 8.5) < 1.6) continue; // (the gate tower stands there)
        if (c % 2) starKnot(x, cx, h * 0.38, step * 0.34, pal);
        else loopKnot(x, cx, h * 0.38, step * 0.32, pal);
      }
      diamondBand(x, 0, w, h * 0.72, h * 0.07, ZPAL[1]);
      diamondBand(x, 0, w, h * 0.1, h * 0.05, ZPAL[3]);
    });
    const faceM = lam('#ffffff', { map: faceT }),
      wallM = lam('#e9dcc0'),
      mudR = lam('#c98f5c');
    // the front wall, faced on the square side
    const front = mesh(new THREE.BoxGeometry(FW, 9, 3).translate(0, 4.5, 0), [
      wallM,
      wallM,
      wallM,
      wallM,
      faceM,
      faceM,
    ]);
    front.rotation.y = (Math.PI / 2) * -rx;
    G.add(front);
    // the gate tower in the middle: taller, an arch, the painted knot over it, pinnacles
    const towT = canvasTex(512, 768, (x, w, h) => {
      x.fillStyle = '#f2e6cc';
      x.fillRect(0, 0, w, h);
      grain(x, w, h, 500, 0.05);
      x.fillStyle = '#2b1c12';
      x.beginPath();
      x.moveTo(w * 0.3, h);
      x.lineTo(w * 0.3, h * 0.62);
      x.quadraticCurveTo(w * 0.3, h * 0.44, w * 0.5, h * 0.4);
      x.quadraticCurveTo(w * 0.7, h * 0.44, w * 0.7, h * 0.62);
      x.lineTo(w * 0.7, h);
      x.fill();
      starKnot(x, w / 2, h * 0.2, w * 0.24, ZPAL[0]);
      diamondBand(x, 0, w, h * 0.34, h * 0.03, ZPAL[2]);
      loopKnot(x, w * 0.14, h * 0.6, w * 0.1, ZPAL[1]);
      loopKnot(x, w * 0.86, h * 0.6, w * 0.1, ZPAL[1]);
    });
    const towM = lam('#ffffff', { map: towT });
    const tower = mesh(new THREE.BoxGeometry(16, 18, 6).translate(0, 9, 0), [wallM, wallM, wallM, wallM, towM, towM]);
    tower.rotation.y = (Math.PI / 2) * -rx;
    tower.position.x = rx * 1.5;
    G.add(tower);
    const zG = new THREE.ConeGeometry(0.6, 2.4, 6).translate(0, 1.2, 0);
    for (let z = -FW / 2 + 2; z <= FW / 2 - 2; z += 4) G.add(mesh(zG, wallM, 0, 9, z));
    for (const z of [-7, -2.5, 2.5, 7]) for (const xx of [-1.5, 4.5]) G.add(mesh(zG, wallM, rx * xx, 18, z));
    // the compound behind: halls of red earth, a green dome
    for (const [lx, lz, w, h, d] of [
      [-28, -20, 20, 8, 26],
      [-28, 20, 20, 8, 26],
      [-50, 0, 18, 11, 30],
    ])
      G.add(mesh(bx(w, h, d), mudR, rx * lx, 0, lz)); // (behind the front wall, away from the square)
    G.add(mesh(new THREE.SphereGeometry(6, 20, 12, 0, TAU, 0, Math.PI / 2), lam('#2f8a4c'), -rx * 50, 11, 0));
    // the square: beaten earth, the horsemen in a line facing the road, their robes and caparisons in colour
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(40, FW).rotateX(-Math.PI / 2), lam('#d8b98e'));
    sq.position.set(rx * 20, 0.04, 0);
    sq.receiveShadow = true;
    G.add(sq);
    const ROBE = ['#ffffff', '#1f3f9e', '#c8352e', '#1f8a4c', '#e0a42a', '#7a2b8f'];
    const horseC = ['#5a3a24', '#2a1c14', '#efe6d6', '#8a5a34'];
    const hr = new THREE.Group();
    const horseman = (lx, lz, k3) => {
      const H2 = new THREE.Group(),
        hc = lam(horseC[k3 % horseC.length]),
        robe = lam(ROBE[k3 % ROBE.length]),
        cap = lam(ROBE[(k3 + 2) % ROBE.length]);
      // the horse, side on to the road: legs to the ground, body, neck and head toward the gate
      for (const [x, z] of [
        [-0.35, -0.9],
        [0.35, -0.9],
        [-0.35, 0.9],
        [0.35, 0.9],
      ])
        H2.add(mesh(cy(0.12, 0.1, 1.5, 6), hc, x, 0, z));
      H2.add(mesh(new THREE.BoxGeometry(0.95, 0.95, 2.4).translate(0, 1.85, 0), hc));
      H2.add(mesh(new THREE.BoxGeometry(1.05, 0.7, 1.6).translate(0, 1.7, 0), cap)); // the caparison
      const neck = mesh(new THREE.BoxGeometry(0.45, 1.2, 0.5).translate(0, 0.6, 0), hc, 0, 2.1, 1.05);
      neck.rotation.x = 0.5;
      H2.add(neck);
      H2.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.9).translate(0, 0, 0.3), hc, 0, 3.05, 1.65));
      // the rider: robe, turban
      H2.add(mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.3, 8).translate(0, 0.65, 0), robe, 0, 2.3, -0.1));
      H2.add(mesh(new THREE.SphereGeometry(0.26, 10, 8), lam('#5a3a26'), 0, 3.8, -0.1));
      H2.add(
        mesh(
          new THREE.SphereGeometry(0.34, 10, 8).scale(1, 0.75, 1),
          lam(k3 % 3 ? '#ffffff' : '#e0a42a'),
          0,
          4.05,
          -0.1,
        ),
      );
      // the spear upright in his hand, its butt resting on the stirrup
      H2.add(mesh(cy(0.04, 0.04, 3.4, 5), lam('#6a4c33'), 0.5, 1.6, 0.1));
      H2.position.set(lx, 0, lz);
      hr.add(H2);
    };
    let n3 = 0;
    for (let z = -FW / 2 + 8; z <= FW / 2 - 8; z += 4.2) if (Math.abs(z) > 8) horseman(rx * 12, z, n3++);
    for (let z = -FW / 2 + 10; z <= FW / 2 - 10; z += 5) if (Math.abs(z) > 8) horseman(rx * 19, z + 2, n3++);
    G.add(hr);
    reserve(fr.x, fr.z, 50);
    place("THE EMIR'S PALACE", 'The horsemen on the square', { x: fr.x, z: fr.z }, sm, { back: 60, lookH: 10, h: 5 });
  }

  // the Emirate mosque: a prayer hall with a green dome, and two tall minarets, white with green bands and balconies
  for (const f of fOf('mosque')) {
    const fr = frame(f.s, -1, W / 2 + 34),
      G = group(fr.x, fr.z, fr.a),
      grn = lam('#2f8a4c');
    G.add(mesh(boxM(28, 10, 34, 8), lam('#f4f2ec')));
    G.add(mesh(cy(8, 8, 3, 24), white, 0, 10, 0));
    G.add(mesh(new THREE.SphereGeometry(8, 24, 14, 0, TAU, 0, Math.PI / 2), grn, 0, 13, 0));
    G.add(mesh(cy(0.2, 0.2, 2.6, 6), lam('#d9b25a'), 0, 21, 0));
    for (const z of [-15, 15]) {
      const x = fr.rx * 13;
      G.add(mesh(cy(1.8, 2.1, 34, 12), white, x, 0, z));
      for (const y of [12, 22, 30]) {
        G.add(mesh(cy(2.6, 2.6, 0.6, 12), grn, x, y, z)); // the balconies (round the shaft)
        G.add(mesh(cy(2.15, 2.15, 1.2, 12), lam('#e9e3d6'), x, y + 0.6, z));
      }
      G.add(mesh(new THREE.ConeGeometry(1.9, 5, 12).translate(0, 2.5, 0), grn, x, 34, z));
      G.add(mesh(cy(0.12, 0.12, 2, 6), lam('#d9b25a'), x, 39, z));
    }
    reserve(fr.x, fr.z, 26);
    place('THE EMIRATE MOSQUE', 'Under the minarets', { x: fr.x, z: fr.z }, f.s, { back: 50, lookH: 24, h: 5 });
  }

  // the Malam Yamusa gate: a modern gate across the road, ochre and white, a Z in green on each tower and over the arch
  for (const f of fOf('zgate')) {
    const i = tr.idx(f.s),
      p = tr.point(f.s, 0),
      G = group(p.x, p.z, head(f.s)),
      sp = W / 2 + 1.6,
      H = 14,
      och = lam('#d79a4e');
    const zT = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#f2e6cc';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f8a4c';
      x.beginPath();
      x.moveTo(w * 0.2, h * 0.18);
      x.lineTo(w * 0.8, h * 0.18);
      x.lineTo(w * 0.8, h * 0.32);
      x.lineTo(w * 0.42, h * 0.68);
      x.lineTo(w * 0.8, h * 0.68);
      x.lineTo(w * 0.8, h * 0.82);
      x.lineTo(w * 0.2, h * 0.82);
      x.lineTo(w * 0.2, h * 0.68);
      x.lineTo(w * 0.58, h * 0.32);
      x.lineTo(w * 0.2, h * 0.32);
      x.fill();
    });
    const zM = lam('#ffffff', { map: zT });
    for (const sx of [-1, 1]) {
      const cx = sx * (sp + 3);
      G.add(mesh(bx(6, H + 3, 6), och, cx, 0, 0));
      for (const sz of [-1, 1]) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), zM);
        pl.position.set(cx, H - 3, sz * 3.02);
        if (sz < 0) pl.rotation.y = Math.PI;
        G.add(pl);
      }
      for (const ex of [-1, 1])
        for (const ez of [-1, 1])
          G.add(mesh(new THREE.ConeGeometry(0.6, 2.4, 6).translate(0, 1.2, 0), och, cx + ex * 2.4, H + 3, ez * 2.4));
    }
    G.add(mesh(bx(sp * 2, 4, 5), och, 0, H - 4, 0));
    G.add(mesh(bx(sp * 2, 0.4, 5.2), white, 0, H - 4, 0));
    signBoth(
      G,
      board('KOFAR MALAM YAMUSA', 16, 1.6, '#1f5a34', '#f2e6cc', { italic: false }),
      16,
      1.6,
      0,
      H - 3.2,
      0,
      0,
      5,
    );
    for (let o = -6; o <= 6; o++) {
      const j = tr.wrap(i + o);
      tr.limit[j] = Math.min(tr.limit[j], sp - 1.2);
      tr.wall[j] = sp;
    }
    for (const sx of [-1, 1]) {
      const q = tr.beside(i, sx * (sp + 3));
      reserve(q.x, q.z, 6);
    }
    place('MALAM YAMUSA GATE', 'Through the Z', p, f.s, { back: 40, h: 3, lookH: 10 });
  }

  // the granite rock beside the climb: a great rounded whaleback of pink-grey stone, the road over its shoulder
  for (const f of fOf('rock')) {
    const sm = f.s + f.len / 2,
      fr = frame(sm, 1, W / 2 + 46),
      g = new THREE.SphereGeometry(1, 48, 24),
      pp = g.attributes.position,
      cols = new Float32Array(pp.count * 3),
      c = new THREE.Color(),
      a1 = new THREE.Color('#a99486'),
      a2 = new THREE.Color('#8a786c'),
      a3 = new THREE.Color('#c4b0a0');
    for (let v = 0; v < pp.count; v++) {
      let x = pp.getX(v),
        y = pp.getY(v),
        z = pp.getZ(v);
      const n = fbm(x * 1.6 + 3, z * 1.6 + y);
      x *= 34 * (1 + (n - 0.45) * 0.3);
      z *= 70 * (1 + (n - 0.45) * 0.3);
      y = Math.max(y, -0.1) * 26 * (0.8 + n * 0.4);
      pp.setXYZ(v, x, y, z);
      c.copy(a1)
        .lerp(a2, Math.min(1, Math.max(0, fbm(x * 0.08, z * 0.08) * 1.6 - 0.4)))
        .lerp(a3, Math.max(0, n - 0.55) * 2);
      cols.set([c.r, c.g, c.b], v * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), fr.x, -2, fr.z, fr.a);
    m.position.set(fr.x, -2, fr.z);
    m.rotation.y = fr.a;
    scene.add(m);
    // a few loose boulders round its foot
    for (let n = 0; n < 10; n++) {
      const q = P(sm + rr(-80, 80), inside(sm) * (W / 2 + rr(14, 24)));
      if (!free(q.x, q.z, 3, W / 2 + 10)) continue;
      reserve(q.x, q.z, 3);
      const b = mesh(
        new THREE.DodecahedronGeometry(rr(1.5, 3), 0),
        lam('#9c897c', { flatShading: true }),
        q.x,
        rr(0.5, 1),
        q.z,
      );
      scene.add(b);
    }
    for (let o = -60; o <= 60; o += 12) {
      const q = P(sm + o, inside(sm) * (W / 2 + 46));
      reserve(q.x, q.z, 30);
    }
    place('THE ROCK', 'Over the granite', tr.point(sm, 8), sm, { back: 40, h: 5, lookH: 8 });
  }

  /* ---------- the land round each circuit ---------- */
  if (CIRC === 'zazzau') {
    // old Zaria: earth houses close along the lanes and thick across the city, doum palms and neem between them
    for (const f of fOf('oldcity'))
      for (let s = f.s; s < f.s + f.len; s += 5)
        for (const sd of [1, -1]) {
          const i = tr.idx(s);
          const q = tr.beside(i, sd * (W / 2 + 18));
          if (!k.land(q.x, q.z)) continue;
          k.tryHouse(i, sd, W / 2 + rr(15, 40), rand() < 0.4);
        }
    for (let n = 0; n < 3000; n++) {
      const s = rand() * tr.len,
        i = tr.idx(s),
        sd = rand() < 0.5 ? 1 : -1,
        off = W / 2 + rr(16, 300),
        q = tr.beside(i, sd * off);
      if (!k.land(q.x, q.z)) continue;
      k.tryHouse(i, sd, off, rand() < 0.3);
    }
    for (let n = 0; n < 400; n++) {
      const s = rand() * tr.len,
        q = P(s, (rand() < 0.5 ? 1 : -1) * (W / 2 + rr(20, 300)));
      tryTree(q.x, q.z, 3, pick(['neem', 'doum', 'doum', 'baobab', 'mango']), 1, W / 2 + 8);
    }
    k.bunting(60);
  } else {
    // modern Kaduna and the campus: bungalows under zinc roofs, a few bigger blocks, the odd mosque or church
    const bungalow = (x, z, a) => {
      const w = rr(10, 16),
        d = rr(9, 13),
        h = rr(3.2, 4);
      if (!add(boxM(w, h, d, 12), pick(CIRC === 'abu' ? [campusM] : shopMs), x, 0, z, a)) return;
      // a hipped roof of zinc
      const roof = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
      add(
        roof
          .clone()
          .scale((w * 0.78) / 1, 2.2, (d * 0.78) / 1)
          .translate(0, h + 1.1, 0),
        rand() < 0.6 ? roofZinc : roofRust,
        x,
        0,
        z,
        a,
        1,
        false,
      );
    };
    for (let n = 0; n < 2600; n++) {
      const s = rand() * tr.len,
        i = tr.idx(s),
        sd = rand() < 0.5 ? 1 : -1,
        off = rr(24, 320),
        p = P(s, sd * (W / 2 + off));
      if (tr.elevated[i]) continue;
      const a = head(s) + (rand() < 0.3 ? rr(-0.4, 0.4) : 0),
        roll = rand();
      if (roll < (CIRC === 'abu' ? 0.5 : 0.35)) {
        if (!free(p.x, p.z, 4, W / 2 + 8)) continue;
        reserve(p.x, p.z, 4);
        tree(p.x, p.z, pick(['neem', 'neem', 'mango', 'mahogany', 'doum']), rr(0.9, 1.2));
      } else if (roll < 0.8) {
        if (!free(p.x, p.z, 10, W / 2 + 14)) continue;
        reserve(p.x, p.z, 10);
        bungalow(p.x, p.z, a);
      } else if (CIRC === 'city') {
        if (!free(p.x, p.z, 12, W / 2 + 18)) continue;
        reserve(p.x, p.z, 12);
        shopBlock(p.x, p.z, a, rr(14, 22), rr(14, 20), rr(3, 7) | 0);
      } else {
        if (!free(p.x, p.z, 16, W / 2 + 18)) continue;
        reserve(p.x, p.z, 16);
        campusBlock(p.x, p.z, a, rr(14, 18), rr(26, 36), rr(2, 4) | 0);
      }
    }
    // a few towers downtown, and a mosque's dome and minaret among the roofs
    if (CIRC === 'city') {
      for (let n = 0; n < 40; n++) {
        const s = rand() * tr.len,
          sd = rand() < 0.5 ? 1 : -1,
          p = P(s, sd * (W / 2 + rr(80, 240)));
        if (!free(p.x, p.z, 14, W / 2 + 40)) continue;
        reserve(p.x, p.z, 14);
        const h = rr(30, 60),
          w = rr(16, 22);
        add(boxM(w, h, w, 12), pick(shopMs), p.x, 0, p.z, head(s));
        add(bx(w + 0.6, 1, w + 0.6), concrete, p.x, h, p.z, head(s), 1, false);
      }
      for (let n = 0; n < 4; n++) {
        const s = rand() * tr.len,
          sd = rand() < 0.5 ? 1 : -1,
          p = P(s, sd * (W / 2 + rr(50, 150)));
        if (!free(p.x, p.z, 14, W / 2 + 20)) continue;
        reserve(p.x, p.z, 14);
        const pt = at(p.x, p.z, head(s));
        pt(bx(18, 8, 18), white, 0, 0, 0, 0, true);
        pt(new THREE.SphereGeometry(6, 18, 10, 0, TAU, 0, Math.PI / 2), lam('#2f8a4c'), 0, 8, 0);
        pt(cy(1.2, 1.4, 24, 10), white, 11, 0, 11);
        pt(new THREE.ConeGeometry(1.4, 3.5, 10).translate(0, 1.75, 0), lam('#2f8a4c'), 11, 24, 11);
      }
    }
  }
  // trees down the roadsides everywhere: neem, mango, the odd doum palm
  for (let s = 0; s < tr.len; s += 20) {
    const i = tr.idx(s);
    if (tr.lowb[i] || tr.hall[i] || tr.elevated[i] || Math.abs(tr.P[i].y) > 0.5) continue;
    const sd = rand() < 0.5 ? 1 : -1,
      p = P(s + rr(-4, 4), sd * (W / 2 + rr(9, 13)));
    tryTree(
      p.x,
      p.z,
      2.5,
      CIRC === 'zazzau' ? pick(['neem', 'doum', 'baobab']) : pick(['neem', 'mango', 'doum']),
      1,
      W / 2 + 6,
    );
  }

  // night: each glow comes up to its colour
  const tmp = new THREE.Color();
  k.night = n => {
    for (const g of glowing) g.mat.emissive.copy(g.base).lerp(tmp.copy(g.col).multiplyScalar(g.str), n);
  };
  k.update = t => {
    for (const a of animated) a(t);
  };

  // merge each material's pieces into one mesh
  for (const [mat, geos] of bins) {
    const g = mergeGeometries(geos.map(x => (x.index ? x.toNonIndexed() : x)));
    if (!g) continue;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
}
