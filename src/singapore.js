// Chapter 5, Singapore: the city round Marina Bay, its gardens, its river and its old quarters. world.js lays the
// ground, the water, the road furniture and the start; this builds the city on it, each landmark after the real one:
//  - Marina Bay Sands: three towers, each two leaning slabs, with the ship of the SkyPark across their tops (its bow
//    cantilevered out past the last tower), the beams of the light show over it at night
//  - the ArtScience Museum: the white lotus of ten petals; the Helix Bridge: a double spiral of steel round the road
//  - the Singapore Flyer, turning; The Float on the water and its grandstand; the Esplanade's two spiky durian domes;
//    the Merlion spouting into the bay; the Fullerton's colonnade; the glass towers of Marina Boulevard
//  - Gardens by the Bay: the Supertrees (and their light show), the skyway between two of them, the Cloud Forest (a
//    glass dome the road runs through, round a mountain of green with a waterfall pouring down it), the Flower Dome,
//    the dragonflies on the lake
//  - the river: Boat Quay's shophouses, the bumboats, Cavenagh Bridge, the Victoria clock tower, the Padang and the
//    domes of the old Supreme Court, the new Supreme Court's disc, Clarke Quay's coloured warehouses under their
//    canopies, Lau Pa Sat's octagon and clock tower
//  - Changi: the jets at their gates, the control tower, the terminal's green wall, Jewel (the glass doughnut, the Rain
//    Vortex pouring through its eye, the Forest Valley's terraces), the taxiway bridge, a jet taking off, the ships
//  - and the city behind: rain trees and palms down every road, the tall slab flats, condo towers, and more glass
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, signTex } from './textures.js';
import { facade, GLASS, glassTex, boxM, cylM } from './doha.js';
import { aquarium } from './aquarium.js';

const TAU = Math.PI * 2;

export function dressSingapore(k) {
  const { scene, tr, rand, rr, pick, free, reserve, W } = k;
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const phong = o => new THREE.MeshPhongMaterial({ shininess: 80, specular: '#dfeeff', ...o });

  // pieces gathered per material and merged into one mesh each at the end
  const bins = new Map();
  const add = (geo, mat, x, y, z, ry = 0, s = 1, check = true) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(s, s, s),
    );
    geo.boundingBox || geo.computeBoundingBox();
    if (check && !k.clearOfRoad(geo.boundingBox, m, 'building')) return;
    (bins.get(mat) || bins.set(mat, []).get(mat)).push(geo.clone().applyMatrix4(m));
  };
  const fOf = type => tr.feats.filter(f => f.type === type);
  const inside = s => -tr.out[tr.idx(s)]; // +1/-1: the side of the road towards the inside of the loop
  const P = (s, off) => tr.beside(tr.idx(s), off);
  const head = s => {
    const t = tr.T[tr.idx(s)];
    return Math.atan2(t.x, t.z);
  };
  // a landmark's own frame: a group standing beside the road at s, `side` (+1 inside, -1 outside) and `off` metres
  // out, its z along the road. rx is the local x that points back at the road.
  const frame = (s, side, off, along = 0) => {
    const i = tr.idx(s),
      p = tr.beside(i, side * inside(s) * off),
      a = head(s),
      t = tr.T[i];
    const G = new THREE.Group();
    G.position.set(p.x + t.x * along, 0, p.z + t.z * along);
    G.rotation.y = a;
    const l = tr.L[i],
      lx = Math.cos(a) * l.x - Math.sin(a) * l.z; // the local x axis against the road's sideways vector
    const rx = -Math.sign(lx || 1) * side * inside(s);
    scene.add(G);
    return { G, rx, p: G.position };
  };
  const shade = G =>
    G.traverse(o => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };

  /* ---------- night: every lit thing carries a glow ---------- */
  const glowing = [];
  const glow = (mat, map, col = '#ffffff', str = 1) => {
    if (map) mat.emissiveMap = map;
    const base = mat.emissive ? mat.emissive.clone() : new THREE.Color(0);
    mat.emissive = base.clone();
    glowing.push({ mat, base, col: new THREE.Color(col), str });
    return mat;
  };
  const LIT = ['#ffd49a', '#ffe6bd', '#fff2dc', '#ffc978', '#e4f1ff', '#cfe6ff'],
    WARM = ['#ffd49a', '#ffc070', '#ffe0a8', '#ffb35c'];
  const litTex = (w, h, cells, share0 = 0.55, pal = LIT, bg = '#000') => {
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
  // a box whose facade texture repeats every tw metres across and th metres up (one shophouse bay, one floor band...)
  const boxT = (w, h, d, tw, th) => {
    const g = new THREE.BoxGeometry(w, h, d),
      uv = g.attributes.uv,
      n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(n.getY(i)) > 0.5) {
        uv.setXY(i, 0.3, 0.02);
        continue;
      }
      const ax = Math.abs(n.getX(i)) > 0.5 ? d : w;
      uv.setXY(i, (uv.getX(i) * ax) / tw, (uv.getY(i) * h) / th);
    }
    return g.translate(0, h / 2, 0);
  };

  // glass towers: five glasses, each lit by night
  // (Singapore never sleeps: most windows lit, and the glass between them glowing a soft blue, so whole towers shine)
  const glassLit = [
    litTex(128, 128, grid(8, 4, 128, 128, 1, 4), 0.72, LIT, '#081226'),
    litTex(128, 128, grid(8, 4, 128, 128, 1, 4), 0.85, LIT, '#0a1430'),
  ];
  const towerMs = ['blue', 'teal', 'silver', 'dark', 'green'].map((key, i) =>
    glow(phong({ map: glassTex(GLASS[key]) }), glassLit[i % 2], '#ffffff', 1.5),
  );
  const white = lam('#f4f3ef'),
    cream = lam('#efe6d2');
  // floodlit stone: Singapore's old buildings and white landmarks are lit warm gold from below all night
  glow(white, null, '#e0b878', 0.8);
  glow(cream, null, '#f0b860', 0.9);

  k.places = [];
  const place = (name, sub, at, s, o = {}) => {
    if (!k.places.some(p => p.name === name))
      k.places.push({ name, sub, x: at.x, y: at.y || 0, z: at.z, s, back: 30, lat: 0, h: 4, lookH: 10, ...o });
  };
  const animated = []; // update(t) hooks
  const colourCycle = []; // materials that run through the colours at night (the Supertrees, the canopies, the Flyer)

  // the halls the road runs through, and the bridges: nothing else is built there
  for (const f of fOf('hall'))
    for (let s = f.s - 30; s <= f.s + f.len + 30; s += 10) {
      const p = tr.point(s, 0);
      reserve(p.x, p.z, W / 2 + 40);
    }

  // where a crossing dives under the river, a glass tube along the bed (the same aquarium as The Pearl's, aquarium.js)
  for (const f of fOf('lowbridge'))
    aquarium(k, f, {
      lam,
      glow,
      place,
      head,
      swimmers: animated,
      deck: false,
      sign: signTex('River Tube', 0, 'singapore'),
      names: { tube: ['THE RIVER TUBE', 'Under the Singapore River in glass'], bridge: null },
      // (its own look, not The Pearl's: a round tube in silver hoops on steel rails, deep clear blue, pale sand, bubbles)
      look: {
        round: true,
        hoop: 5,
        rails: true,
        rib: '#e6edf4',
        ribGlow: '#56616e',
        glass: '#d6ecff',
        top: '#3fa3e6',
        bed: '#062a66',
        haze: '#1d64b0',
        sand: '#9cc7e2',
        surf: '#7cc4f2',
        surfDeep: '#3f8fd0',
        bubble: 0.45,
        bubbleCols: 30,
      },
    });

  /* ---------- the bridges: a deck on piers over the water, railings, lamps; the Helix's spiral round the road ---------- */
  const deckM = lam('#cfd3d8'),
    pierM = lam('#b6bcc4'),
    railM = new THREE.MeshStandardMaterial({ color: '#d9dee6', metalness: 0.7, roughness: 0.35 });
  for (const f of fOf('lowbridge')) {
    const parts = [],
      rails = [],
      piers = [];
    for (let s = f.s; s < f.s + f.len; s += 4) {
      const i = tr.idx(s),
        p = tr.point(s, 0),
        a = head(s);
      if (tr.inGap?.[i]) continue; // (a jump across the water: nothing under you there)
      if (p.y < -0.8) continue; // (where the road dives under the river the glass tube carries it: aquarium.js)
      parts.push(new THREE.BoxGeometry(W + 4, 1.6, 4.2).translate(0, -0.85, 0).rotateY(a).translate(p.x, p.y, p.z));
      for (const sd of [1, -1]) {
        const q = tr.beside(i, sd * (W / 2 + 1.4));
        rails.push(
          new THREE.BoxGeometry(0.3, 1.1, 4.1)
            .translate(0, 0.55 + p.y, 0)
            .rotateY(a)
            .translate(q.x, 0, q.z),
        );
      }
      if (Math.round(s - f.s) % 24 === 0)
        for (const sd of [1, -1]) {
          const q = tr.beside(i, sd * (W / 2 - 3));
          piers.push(new THREE.CylinderGeometry(1.4, 1.6, 9, 10).translate(q.x, -6, q.z));
        }
    }
    for (const [list, m] of [
      [parts, deckM],
      [rails, railM],
      [piers, pierM],
    ])
      if (list.length) {
        const me = new THREE.Mesh(mergeGeometries(list), m);
        me.receiveShadow = true;
        scene.add(me);
      }
  }
  // the Helix, Marina Bay's signature: you drive inside it. Two steel strands spiralling round the road (tight coils, so
  // it reads as a tube), rings binding them, LED pearls along them, arches of light over the road that chase away ahead
  // of you, and a portal at each end standing on the deck
  for (const f of fOf('helix')) {
    const R = W / 2 + 4,
      cy = R * 0.62,
      pitch = 18;
    const strandM = glow(
      new THREE.MeshStandardMaterial({ color: '#e6ebf2', metalness: 0.85, roughness: 0.3 }),
      null,
      '#9ff3ff',
      0.9,
    );
    const pearlM = glow(lam('#dfe9f5'), null, '#ffffff', 0);
    const pearls = [];
    for (const ph of [0, Math.PI]) {
      const pts = [];
      for (let s = f.s; s <= f.s + f.len; s += 1.5) {
        const i = tr.idx(s),
          p = tr.point(s, 0),
          l = tr.L[i],
          th = ((s - f.s) / pitch) * TAU + ph;
        pts.push(
          new THREE.Vector3(p.x + l.x * R * Math.cos(th), p.y + cy + R * Math.sin(th), p.z + l.z * R * Math.cos(th)),
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.75, 8), strandM));
      // a finer strand just inside the main one
      const inner = pts.map((v, j) => {
        const s = f.s + j * 1.5,
          p = tr.point(s, 0);
        return v.clone().sub(p).multiplyScalar(0.86).add(p);
      });
      scene.add(
        new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner), pts.length * 2, 0.25, 6), strandM),
      );
      for (let j = 0; j < pts.length; j += 3)
        pearls.push(new THREE.SphereGeometry(0.42, 8, 6).translate(pts[j].x, pts[j].y, pts[j].z));
    }
    // the struts between the outer and inner strands every 3 m, and the canopy ribs over the top half only (it's a
    // walkway with a roof, open at the sides): arcs from one side over to the other, glass panels between them
    const struts = [],
      ribs = [],
      panes = [];
    for (let s = f.s; s <= f.s + f.len; s += 3) {
      const i = tr.idx(s),
        p = tr.point(s, 0),
        l = tr.L[i],
        a = head(s);
      for (const ph of [0, Math.PI]) {
        const th = ((s - f.s) / pitch) * TAU + ph,
          o = new THREE.Vector3(
            p.x + l.x * R * Math.cos(th),
            p.y + cy + R * Math.sin(th),
            p.z + l.z * R * Math.cos(th),
          ),
          n = o
            .clone()
            .sub(new THREE.Vector3(p.x, p.y + cy, p.z))
            .multiplyScalar(0.86)
            .add(new THREE.Vector3(p.x, p.y + cy, p.z));
        const d = n.clone().sub(o),
          g = new THREE.CylinderGeometry(0.09, 0.09, d.length(), 5).translate(0, d.length() / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
        struts.push(g.translate(o.x, o.y, o.z));
      }
      if (Math.round(s - f.s) % 6 === 0) {
        ribs.push(
          new THREE.TorusGeometry(R * 0.8, 0.12, 5, 24, Math.PI * 0.7)
            .rotateZ(Math.PI * 0.15)
            .rotateY(a)
            .translate(p.x, p.y + cy, p.z),
        );
        panes.push(
          new THREE.CylinderGeometry(R * 0.79, R * 0.79, 6.02, 18, 1, true, -Math.PI * 0.35, Math.PI * 0.7)
            .rotateX(Math.PI / 2)
            .rotateY(a)
            .translate(p.x, p.y + cy, p.z),
        );
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(struts), strandM));
    scene.add(new THREE.Mesh(mergeGeometries(ribs), strandM));
    scene.add(
      new THREE.Mesh(
        mergeGeometries(panes),
        new THREE.MeshPhongMaterial({
          color: '#bfe2f5',
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
          shininess: 120,
        }),
      ),
    );
    scene.add(new THREE.Mesh(mergeGeometries(pearls), pearlM));
    colourCycle.push({ mat: pearlM, hue: 0.5, sat: 0.6, speed: 0.07, str: 1.4 });
    // the chase: an arch of light over the road every 4 m, in 8 groups lit one after another so a wave of light runs
    // away from you down the tube (faint by day, bright at night)
    const G = 8,
      chase = Array.from(
        { length: G },
        () => new THREE.MeshBasicMaterial({ color: '#6fd3ff', transparent: true, opacity: 0.2 }),
      ),
      arches = Array.from({ length: G }, () => []);
    let ai = 0;
    for (let s = f.s + 2; s <= f.s + f.len - 2; s += 4, ai++) {
      const p = tr.point(s, 0);
      arches[ai % G].push(
        new THREE.TorusGeometry(R * 0.72, 0.16, 5, 28, Math.PI * 0.62)
          .rotateZ(Math.PI * 0.19)
          .rotateY(head(s))
          .translate(p.x, p.y + cy, p.z),
      );
    }
    arches.forEach((list, g) => list.length && scene.add(new THREE.Mesh(mergeGeometries(list), chase[g])));
    animated.push(t => {
      for (let g = 0; g < G; g++) {
        const wave = Math.pow(Math.max(0, Math.cos(TAU * (t * 0.9 - g / G))), 6);
        chase[g].opacity = 0.18 + wave * (0.35 + night * 0.6);
      }
    });
    // the portals: two pylons standing on the deck at its edges, a beam across at 10 m, lit cyan; the way in carries
    // the name, facing you as you come
    const pylonM = glow(lam('#e8edf3'), null, '#9ff3ff', 0.6),
      nameT = canvasTex(1024, 192, (x, w, h) => {
        x.fillStyle = '#0b1330';
        x.fillRect(0, 0, w, h);
        x.strokeStyle = '#6fd3ff';
        x.lineWidth = 8;
        x.strokeRect(14, 14, w - 28, h - 28);
        x.fillStyle = '#ffffff';
        x.font = 'italic 900 112px "Barlow Condensed", "Arial Narrow", sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('THE HELIX', w / 2, h / 2 + 6);
      });
    for (const [s, named] of [
      [f.s - 6, true],
      [f.s + f.len + 6, false],
    ]) {
      const p = tr.point(s, 0),
        a = head(s),
        g = new THREE.Group(),
        X = W / 2 + 1.9; // (on the deck, just inside its edge)
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = a;
      for (const sd of [1, -1]) {
        const py = new THREE.Mesh(new THREE.BoxGeometry(1.2, 11, 1.2), pylonM);
        py.position.set(sd * X, 5.5, 0);
        py.castShadow = true;
        g.add(py);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * X + 1.2, 1.2, 1.2), pylonM);
      beam.position.y = 10.4;
      g.add(beam);
      if (named) {
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 2.6),
          glow(lam('#ffffff', { map: nameT }), nameT, '#ffffff', 0.9),
        );
        sign.position.set(0, 8.4, -0.7); // (hung under the beam, on its face toward you)
        sign.rotation.y = Math.PI;
        g.add(sign);
        for (const sd of [1, -1]) {
          const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), pylonM);
          hanger.position.set(sd * 5, 9.95, -0.7);
          g.add(hanger);
        }
      }
      scene.add(g);
    }
    place('THE HELIX', 'Through the steel spiral', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, { back: 40, h: 6 });
  }

  /* ---------- Marina Bay Sands: three towers of two leaning slabs, the SkyPark ship across their tops ---------- */
  // the towers' glass: blue-grey, a pale floor slab every 3.2 m, faint mullions; by night the floors glow in bands
  const mbsGlass = glow(
    phong({
      map: facade((x, w, h) => {
        const g = x.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#5d7084');
        g.addColorStop(0.5, '#9fb4c8');
        g.addColorStop(1, '#6a7f94');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#e6ecf2';
        for (let y = 0; y < h; y += 26) x.fillRect(0, y, w, 4); // the floor slabs (5 floors to the 16 m tile)
        x.fillStyle = 'rgba(30,40,55,.25)';
        for (let xx = 0; xx < w; xx += 12) x.fillRect(xx, 0, 1, h);
      }),
      shininess: 110,
    }),
    litTex(128, 128, grid(10, 5, 128, 128, 0, 5), 0.85, WARM, '#2a2a30'),
    '#ffffff',
    1.1,
  );
  const podM = glow(lam('#ece8e0'), null, '#e0b878', 0.5),
    podRoofM = glow(lam('#f6f6f4'), null, '#cfe4ff', 0.6);
  const shipM = glow(lam('#f4f6f8', { emissive: '#8a8e96' }), null, '#cfe4ff', 0.9), // (a white hull, lit from below even by day)
    poolM = glow(phong({ color: '#3fb7e6', shininess: 120 }), null, '#6fe3ff', 1.3),
    greenM = lam('#3f7d3a');
  function marinaBaySands(G, scale = 1) {
    const H = 150 * scale;
    for (const z of [-70, 0, 70].map(v => v * scale)) {
      for (const sd of [-1, 1]) {
        const slab = new THREE.Mesh(boxM(16 * scale, H, 30 * scale, 16), mbsGlass);
        slab.position.set(sd * 13 * scale, 0, z);
        slab.rotation.z = sd * 0.075; // the two legs lean together and meet at the top
        G.add(slab);
      }
    }
    // the SkyPark: a long hull on top, its bow cantilevered out past the last tower
    const hull = new THREE.Shape();
    const L0 = -110 * scale,
      L1 = 205 * scale,
      HW = 21 * scale;
    hull.moveTo(-HW, L0);
    hull.lineTo(HW, L0);
    hull.lineTo(HW, L1 - 40 * scale);
    hull.quadraticCurveTo(HW * 0.6, L1, 0, L1);
    hull.quadraticCurveTo(-HW * 0.6, L1, -HW, L1 - 40 * scale);
    hull.closePath();
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 7 * scale, bevelEnabled: false }).rotateX(Math.PI / 2);
    const ship = new THREE.Mesh(hg, shipM);
    ship.position.y = H + 8 * scale;
    G.add(ship);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(5 * scale, 0.6, 140 * scale), poolM);
    pool.position.set(HW * 0.55, H + 8.3 * scale, 110 * scale);
    G.add(pool);
    for (let j = 0; j < 22; j++) {
      const tre = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 * scale, 0), greenM);
      tre.position.set(rr(-HW + 4, -2) * 1, H + 10 * scale, rr(L0 + 10, L1 - 50 * scale));
      G.add(tre);
    }
    // the podium: the mall and the theatres, low along the front of the towers, under a run of wave-shaped roofs
    const pod = new THREE.Mesh(boxM(56 * scale, 12 * scale, 230 * scale, 16), podM);
    pod.position.set(0, 0, 0);
    G.add(pod);
    // (a run of low barrel vaults along it, each a long half-cylinder flattened down)
    for (let k2 = -2; k2 <= 2; k2++) {
      const wave = new THREE.Mesh(
        new THREE.CylinderGeometry(28 * scale, 28 * scale, 44 * scale, 32, 1, false, Math.PI / 2, Math.PI)
          .rotateX(Math.PI / 2)
          .scale(1, 0.28, 1),
        podRoofM,
      );
      wave.position.set(0, 12 * scale, k2 * 45 * scale);
      G.add(wave);
    }
    // the SkyPark's railing and its lit underside
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(HW * 2, 1.4 * scale, (L1 - L0) * 0.85).translate(0, 0, (L0 + L1) / 2 - 15 * scale),
      glow(phong({ color: '#cfe6f5', transparent: true, opacity: 0.5 }), null, '#ffffff', 0.4),
    );
    rail.position.y = H + 8.7 * scale;
    G.add(rail);
    // the light show: beams fanning out from the SkyPark at night
    const beamM = new THREE.MeshBasicMaterial({
      color: '#7fe8ff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const beams = new THREE.Group();
    beams.position.set(0, H + 10 * scale, 60 * scale);
    for (let j = 0; j < 8; j++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3, 420, 6, 1, true).translate(0, 210, 0), beamM);
      b.rotation.set(0.5 + (j % 3) * 0.2, (j / 8) * TAU, 0);
      beams.add(b);
    }
    G.add(beams);
    glowing.push({
      fn: n => {
        beamM.opacity = n * 0.22;
        beams.visible = n > 0.05;
      },
    });
    animated.push(t => {
      if (!beams.visible) return;
      beams.rotation.y = t * 0.25;
      beamM.color.setHSL((t * 0.03) % 1, 0.9, 0.62);
    });
    shade(G);
  }
  let mbsAt = null;
  for (const f of fOf('mbs')) {
    const s = f.s + 100,
      { G } = frame(s, -1, 120);
    marinaBaySands(G);
    mbsAt = G.position.clone();
    reserve(G.position.x, G.position.z, 140);
    place('MARINA BAY SANDS', 'The ship on three towers', G.position, s, { back: 60, lookH: 70, h: 8, lat: -4 });
  }
  // the postcard: from up on the viaduct, across the bay to Marina Bay Sands and the towers
  for (const f of fOf('skyline'))
    if (mbsAt) place('THE SKYLINE', 'Over the bay', mbsAt, f.s, { back: 0, lat: 0, h: 5, lookH: 55 });
  for (const f of fOf('mbsfar')) {
    const { G } = frame(f.s, -1, 330);
    G.rotation.y += Math.PI / 2;
    marinaBaySands(G);
    place('MARINA BAY SANDS', 'Across the bay', G.position, f.s, { back: 40, lookH: 60, h: 6 });
  }

  /* ---------- the ArtScience Museum: the white lotus ---------- */
  const lotusM = glow(lam('#f6f5f1'), null, '#e9f3ff', 0.6);
  for (const f of fOf('artscience')) {
    // set back on the water's edge: a stone landing, a lily pond round it, a shallow bowl, and from the bowl ten white
    // fingers opening outward like a lotus, the longest at the back (away from the road), the shortest towards it
    const { G, rx } = frame(f.s, 1, 66);
    G.add(mesh(new THREE.CylinderGeometry(30, 30, 3, 40), lam('#d7dbe0'), 0, -0.4, 0));
    G.add(mesh(new THREE.CylinderGeometry(27, 27, 0.4, 40), phong({ color: '#2f6f9a' }), 0, 1.2, 0));
    const bowl = mesh(new THREE.SphereGeometry(13, 32, 12, 0, TAU, Math.PI / 2, Math.PI / 2), lotusM, 0, 9, 0);
    bowl.scale.y = 0.55;
    G.add(bowl);
    G.add(mesh(new THREE.CylinderGeometry(4, 6, 4, 16), lam('#c9ced6'), 0, 1.5, 0));
    const uBack = rx > 0 ? Math.PI : 0; // the direction away from the road (local x = -rx)
    for (let j = 0; j < 10; j++) {
      const u = (j / 10) * TAU + 0.31,
        back = 0.5 + 0.5 * Math.cos(u - uBack),
        L = 14 + 20 * back,
        tilt = 0.42 + 0.35 * (1 - back);
      const g = new THREE.CapsuleGeometry(2.6, L, 6, 16)
        .translate(0, L / 2 + 1, 0)
        .scale(1.9, 1, 0.7) // broad across, thin from front to back: a petal
        .rotateX(tilt) // leaning outward
        .rotateY(Math.atan2(Math.cos(u), Math.sin(u)))
        .translate(Math.cos(u) * 8, 7, Math.sin(u) * 8);
      G.add(new THREE.Mesh(g, lotusM));
    }
    shade(G);
    reserve(G.position.x, G.position.z, 36);
    place('ARTSCIENCE', 'The lotus on the bay', G.position, f.s, { lookH: 16, back: 50 });
  }

  /* ---------- the Singapore Flyer, turning ---------- */
  for (const f of fOf('flyer')) {
    const { G, rx } = frame(f.s, -1, 150);
    const R = 72,
      CY = 92;
    const rimM = glow(
        new THREE.MeshStandardMaterial({ color: '#e8edf3', metalness: 0.6, roughness: 0.35 }),
        null,
        '#6fd3ff',
        1.2,
      ),
      podM = glow(phong({ color: '#cfe9ff', transparent: true, opacity: 0.85 }), null, '#ffe8b0', 1);
    const wheel = new THREE.Group();
    wheel.position.set(0, CY, 0);
    wheel.add(mesh(new THREE.TorusGeometry(R, 1.1, 8, 96).rotateY(Math.PI / 2), rimM));
    wheel.add(mesh(new THREE.TorusGeometry(R - 5, 0.5, 6, 96).rotateY(Math.PI / 2), rimM));
    const spokes = [];
    for (let j = 0; j < 28; j++) {
      const a = (j / 28) * TAU;
      spokes.push(
        new THREE.CylinderGeometry(0.18, 0.18, R, 4)
          .translate(0, R / 2, 0)
          .rotateX(a)
          .translate(0, 0, 0),
      );
      wheel.add(
        mesh(
          new THREE.CapsuleGeometry(2.2, 4, 4, 10).rotateZ(Math.PI / 2),
          podM,
          0,
          Math.cos(a) * (R + 3),
          Math.sin(a) * (R + 3),
        ),
      );
    }
    wheel.add(new THREE.Mesh(mergeGeometries(spokes), rimM));
    wheel.add(mesh(new THREE.CylinderGeometry(3, 3, 8, 16).rotateZ(Math.PI / 2), rimM));
    G.add(wheel);
    // the A-frame legs and the terminal under it
    for (const sd of [-1, 1])
      for (const fz of [-1, 1]) {
        const leg = mesh(new THREE.CylinderGeometry(1.2, 1.6, CY + 6, 8), rimM, sd * 6, CY / 2, fz * 26);
        leg.rotation.x = fz * 0.27;
        G.add(leg);
      }
    G.add(mesh(boxM(40, 12, 90, 16), towerMs[0], rx * -30, 0, 0));
    animated.push(t => (wheel.rotation.x = t * 0.03));
    colourCycle.push({ mat: rimM, hue: 0.55, sat: 0.7, speed: 0.02, str: 1.1 });
    shade(G);
    reserve(G.position.x, G.position.z, 60);
    place('SINGAPORE FLYER', 'The great wheel', G.position, f.s, { back: 50, lookH: 70, h: 6 });
  }

  /* ---------- The Float: the stage on the water, its grandstand on the shore ---------- */
  for (const f of fOf('float')) {
    const { G, rx } = frame(f.s, 1, 105);
    const pitchT = canvasTex(256, 160, (x, w, h) => {
      x.fillStyle = '#2e7d4f';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffffff';
      x.lineWidth = 3;
      x.strokeRect(10, 10, w - 20, h - 20);
      x.beginPath();
      x.moveTo(w / 2, 10);
      x.lineTo(w / 2, h - 10);
      x.stroke();
      x.beginPath();
      x.arc(w / 2, h / 2, 22, 0, TAU);
      x.stroke();
    });
    const deck = new THREE.BoxGeometry(70, 1.6, 120);
    deck.translate(0, 0.2, 0);
    G.add(
      mesh(deck, [
        lam('#8d96a3'),
        lam('#8d96a3'),
        lam('#2e7d4f', { map: pitchT }),
        lam('#8d96a3'),
        lam('#8d96a3'),
        lam('#8d96a3'),
      ]),
    );
    const mastM = lam('#d0d5dc'),
      headM = glow(lam('#4a4f58'), null, '#ffffff', 2);
    for (const x0 of [-36, 36])
      for (const z0 of [-62, 62]) {
        G.add(mesh(new THREE.CylinderGeometry(0.6, 0.9, 26, 8).translate(0, 13, 0), mastM, x0, 0, z0));
        G.add(mesh(new THREE.BoxGeometry(4, 2.4, 4), headM, x0, 26, z0));
      }
    // the grandstand: tiers of seats on the shore, facing the water
    const seatM = lam('#e04a3a'),
      seatM2 = lam('#f2f2f2');
    for (let r = 0; r < 6; r++)
      add(
        new THREE.BoxGeometry(5, 1.6 + r * 1.6, 110).translate(0, (1.6 + r * 1.6) / 2, 0),
        r % 2 ? seatM : seatM2,
        ...(() => {
          const p = G.position.clone(),
            i = tr.idx(f.s),
            q = tr.beside(i, inside(f.s) * (W / 2 + 8 + r * 4));
          void p;
          return [q.x, 0, q.z, head(f.s)];
        })(),
      );
    void rx;
    shade(G);
    place('THE FLOAT', 'The stage on the water', G.position, f.s, { lookH: 8 });
  }

  /* ---------- the Esplanade: two durian domes of spiky sunshades ---------- */
  const durianM = glow(lam('#c9b88f'), null, '#ffb35c', 0.7),
    spikeM = lam('#a99a74');
  for (const f of fOf('esplanade')) {
    const { G, rx } = frame(f.s, -1, 80);
    for (const [z0, R] of [
      [-34, 30],
      [32, 24],
    ]) {
      const dome = mesh(new THREE.SphereGeometry(R, 40, 20, 0, TAU, 0, Math.PI / 2), durianM, 0, 0, z0);
      dome.scale.set(1, 0.78, 1.18);
      G.add(dome);
      const spikes = [];
      for (let j = 0; j < 260; j++) {
        const u = rand() * TAU,
          v = Math.acos(rand() * 0.96),
          n = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
        const g = new THREE.ConeGeometry(1.5, 3.4, 3).translate(0, 1.4, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
        g.translate(n.x * R, n.y * R * 0.78, n.z * R * 1.18 + z0);
        spikes.push(g);
      }
      G.add(new THREE.Mesh(mergeGeometries(spikes), spikeM));
    }
    G.add(mesh(boxM(30, 8, 30, 16), cream, rx * 26, 0, 0));
    shade(G);
    reserve(G.position.x, G.position.z, 60);
    place('THE ESPLANADE', 'The durian domes', G.position, f.s, { lookH: 18 });
  }

  /* ---------- the Merlion: a lion's head on a fish's body, spouting into the bay ---------- */
  const merM = glow(lam('#f3f2ec'), null, '#d9e8ff', 0.7),
    sprayM = new THREE.MeshPhongMaterial({ color: '#dff4ff', transparent: true, opacity: 0.7, emissive: '#000000' });
  glow(sprayM, null, '#9fe7ff', 0.8);
  for (const f of fOf('merlion')) {
    const { G, rx } = frame(f.s, 1, W / 2 + 14);
    const out = -rx; // he faces the water, away from the road
    G.add(mesh(new THREE.CylinderGeometry(4.5, 5, 4, 16), lam('#b8bcc2'), 0, 0, 0));
    G.add(mesh(new THREE.CylinderGeometry(2.6, 3.4, 8, 14), merM, 0, 6, 0));
    // the tail curling up behind
    const tail = mesh(new THREE.TorusGeometry(3, 1.2, 8, 16, Math.PI * 1.2), merM, -out * 3, 5, 0);
    tail.rotation.y = Math.PI / 2;
    G.add(tail);
    G.add(mesh(new THREE.SphereGeometry(3.3, 16, 12), merM, out * 0.6, 12.2, 0)); // the head
    G.add(mesh(new THREE.TorusGeometry(3.2, 1.1, 8, 18).rotateY(Math.PI / 2), merM, out * -0.4, 12, 0)); // the mane
    // the jet: an arc of water out into the bay
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const u = j / 16;
      pts.push(new THREE.Vector3(out * (3.2 + u * 20), 11.4 + u * 3 - u * u * 13, 0));
    }
    const jet = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.55, 8), sprayM);
    G.add(jet);
    animated.push(t => jet.scale.set(1, 1, 1 + Math.sin(t * 9) * 0.08));
    shade(G);
    place('THE MERLION', 'Spouting into the bay', G.position, f.s, { lookH: 10, back: 26 });
  }

  /* ---------- the Fullerton: a granite colonnade ---------- */
  const fullT = facade((x, w, h) => {
    x.fillStyle = '#ece4d0';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#d6cbb0';
    for (let c = 0; c < w; c += 32) x.fillRect(c + 4, 18, 9, h - 18); // the columns
    x.fillStyle = '#2d3a4a';
    for (let c = 0; c < w; c += 32) x.fillRect(c + 18, 30, 10, 22);
    x.fillStyle = '#c4b896';
    x.fillRect(0, 0, w, 16); // the cornice
  });
  const fullM = glow(lam('#ffffff', { map: fullT }), fullT, '#ffcf8a', 0.75); // (the whole colonnade floodlit gold)
  for (const f of fOf('fullerton')) {
    const p = P(f.s, -inside(f.s) * 62),
      a = head(f.s);
    add(boxM(44, 26, 130, 16), fullM, p.x, 0, p.z, a);
    add(boxM(46, 2, 132, 16).translate(0, 26, 0), cream, p.x, 0, p.z, a);
    reserve(p.x, p.z, 66);
    place('THE FULLERTON', 'The old post office', p, f.s, { lookH: 14 });
  }

  /* ---------- Gardens by the Bay: the Supertrees ---------- */
  const trunkT = facade((x, w, h) => {
    x.fillStyle = '#4a2f4a';
    x.fillRect(0, 0, w, h);
    for (let j = 0; j < 260; j++) {
      x.fillStyle = ['#3f7d3a', '#5a9a3c', '#8b3a7a', '#c2508f', '#2f6a3a'][j % 5];
      x.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 6, 3 + Math.random() * 5);
    }
    x.strokeStyle = '#7a5a8a';
    x.lineWidth = 2;
    for (let d = -w; d < w * 2; d += 16) {
      x.beginPath();
      x.moveTo(d, 0);
      x.lineTo(d + w, h);
      x.stroke();
      x.beginPath();
      x.moveTo(d + w, 0);
      x.lineTo(d, h);
      x.stroke();
    }
  });
  const trunkM = glow(lam('#ffffff', { map: trunkT, side: THREE.DoubleSide }), null, '#5a2a7a', 0.5);
  // the crown: an open funnel of steel lattice (the sky shows through it), its bars lighting up in colours at night
  const crownT = canvasTex(
    128,
    64,
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = '#ffffff';
      x.lineWidth = 3;
      for (let d = -w; d < w * 2; d += 21) {
        x.beginPath();
        x.moveTo(d, h);
        x.lineTo(d + h * 0.8, 0);
        x.moveTo(d, h);
        x.lineTo(d - h * 0.8, 0);
        x.stroke();
      }
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, 4);
      x.fillRect(0, h - 3, w, 3);
    },
    { repeat: true },
  );
  crownT.repeat.set(6, 2);
  const crownMs = [0.83, 0.92, 0.6].map(hue => {
    const m = new THREE.MeshLambertMaterial({
      color: '#5a4a6a',
      map: crownT,
      emissiveMap: crownT,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      emissive: '#000000',
    });
    colourCycle.push({ mat: m, hue, sat: 0.85, speed: 0.05, str: 1.4 });
    return m;
  });
  const footBox = new THREE.Box3(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 1, 3));
  const supertree = (x, z, h) => {
    // (judged by its foot: the crown may reach out over the road, high above it)
    if (!k.clearOfRoad(footBox, new THREE.Matrix4().makeTranslation(x, 0, z), 'supertree')) return;
    const s = h / 40;
    const prof = [
      [2.4, 0],
      [1.7, 6],
      [1.3, h * 0.55],
      [1.6, h * 0.72],
      [2.6, h * 0.8],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    add(new THREE.LatheGeometry(prof, 18), trunkM, x, 0, z, rand() * TAU, 1, false);
    const cm = pick(crownMs);
    const crown = [
      [2.6, h * 0.8],
      [4.5 * s + 1.5, h * 0.88],
      [7.5 * s + 2, h * 0.95],
      [9 * s + 2.5, h],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    add(new THREE.LatheGeometry(crown, 28), cm, x, 0, z, 0, 1, false);
    add(
      new THREE.TorusGeometry(9 * s + 2.5, 0.35, 6, 28).rotateX(Math.PI / 2).translate(0, h, 0),
      cm,
      x,
      0,
      z,
      0,
      1,
      false,
    );
    // the crown's branches
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * TAU,
        L = Math.hypot(9 * s, h * 0.2);
      add(
        new THREE.CylinderGeometry(0.16, 0.22, L, 4)
          .translate(0, L / 2, 0)
          .rotateZ(-Math.atan2(9 * s, h * 0.2))
          .translate(2.6, h * 0.8, 0)
          .rotateY(a),
        cm,
        x,
        0,
        z,
        0,
        1,
        false,
      );
    }
  };
  for (const f of fOf('supertrees')) {
    const far = !!f.far;
    for (let s = f.s; s < f.s + f.len; s += far ? 30 : 24) {
      for (const sd of far ? [-1] : [1, -1]) {
        const off = far ? rr(70, 150) : rr(W / 2 + 14, W / 2 + 46),
          p = P(s + rr(-6, 6), sd * inside(s) * off),
          h = rr(25, 50);
        if (!free(p.x, p.z, 10, W / 2 + 6)) continue;
        reserve(p.x, p.z, 10);
        supertree(p.x, p.z, h);
      }
    }
    if (!far) place('SUPERTREE GROVE', 'The giant trees', P(f.s + f.len / 2, 0), f.s + f.len / 2, { lookH: 30, h: 3 });
  }
  // the skyway: a walkway strung 22 m up between two of the tallest, across the road
  // the skyway: the road climbs up among the crowns; tall Supertrees close either side, their crowns at your eye level
  for (const f of fOf('skyway')) {
    for (let s = f.s; s < f.s + f.len; s += 16)
      for (const sd of [1, -1]) {
        const i = tr.idx(s + rr(-3, 3)),
          q = tr.beside(i, sd * rr(W / 2 + 9, W / 2 + 16)),
          y = tr.P[i].y;
        supertree(q.x, q.z, Math.max(25, y + rr(4, 16)));
      }
    const c = tr.point(f.s + f.len / 2, 0);
    place('THE SKYWAY', 'Up among the Supertrees', c, f.s + f.len / 2, { lookH: 4, back: 40, h: 3 });
  }

  /* ---------- a glass dome the road runs through: an opening cut in the glass, and an entrance at each end ---------- */
  // Where the road meets the dome the glass is cut away (every panel low over the road), and an entrance hall stands
  // there: two steel portal frames, a glass canopy between them, the glass doors slid open to either side, the dome's
  // name lit over the road. Inside, a glass balustrade either side of the road and a pale stone floor out to the plants.
  const steelM = new THREE.MeshStandardMaterial({ color: '#d5dbe3', metalness: 0.75, roughness: 0.3 }),
    paneM = new THREE.MeshPhongMaterial({
      color: '#cfeaff',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      shininess: 120,
      specular: '#ffffff',
    }),
    floorM = glow(lam('#e4e0d6'), null, '#3a362e', 1);
  const signM = name => {
    const t = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = '#16302a';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff';
      x.font = 'italic 900 64px "Barlow Condensed", "Arial Narrow", sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(name, w / 2, h / 2 + 3);
    });
    // by night the letters light up (the texture is its own glow map), the board stays dark
    return glow(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }), t, '#ffffff', 0.9);
  };
  // the glass cut away over the road: geo is the dome's geometry, M the matrix that takes it to the world
  const openGlass = (geo, M) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(),
      p = g.attributes.position,
      keep = [],
      v = new THREE.Vector3();
    for (let t = 0; t < p.count; t += 3) {
      v.set(0, 0, 0);
      for (let j = 0; j < 3; j++) v.add(new THREE.Vector3().fromBufferAttribute(p, t + j).applyMatrix4(M));
      v.multiplyScalar(1 / 3);
      const n = tr.nearest(v.x, v.z),
        ry = tr.P[n.i].y;
      if (n.d < W / 2 + 4.2 && v.y > ry - 3 && v.y < ry + 13.5) continue; // (at whatever height the road passes)
      keep.push(t);
    }
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) {
      const a = g.attributes[name],
        n = a.itemSize,
        arr = new Float32Array(keep.length * 3 * n);
      keep.forEach((t, k2) => arr.set(a.array.subarray(t * n, (t + 3) * n), k2 * 3 * n));
      out.setAttribute(name, new THREE.BufferAttribute(arr, n));
    }
    return out;
  };
  // the entrance at road distance s; out = +1 if the outside is further along the road (the exit), -1 for the way in
  const entrance = (s, out, name) => {
    const p = tr.point(s, 0),
      E = new THREE.Group();
    E.position.set(p.x, p.y, p.z);
    E.rotation.y = head(s);
    const X = W / 2 + 3.4,
      D = 10; // the canopy reaches 10 m out from the glass
    // the posts stand on the ground: where the road is up on its deck they run all the way down past it (nothing over
    // the drop is left hanging), on a concrete footing
    const drop = Math.max(0, p.y);
    for (const z of [0, out * D]) {
      for (const sd of [-1, 1]) {
        E.add(
          mesh(new THREE.BoxGeometry(1.1, 11.5 + drop, 1.1).translate(0, (11.5 - drop) / 2, 0), steelM, sd * X, 0, z),
        );
        E.add(mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8).translate(0, 0.25 - drop, 0), steelM, sd * X, 0, z)); // its footing
        if (drop > 0.5)
          E.add(
            mesh(
              new THREE.BoxGeometry(sd * 0 + (X - W / 2 - 0.3), 0.5, 0.6).translate(
                -sd * ((X - W / 2 - 0.3) / 2 - 0.05),
                -0.6,
                0,
              ),
              steelM,
              sd * X,
              0,
              z,
            ),
          ); // a bracket back to the deck's edge
      }
      E.add(mesh(new THREE.BoxGeometry(X * 2 + 1.1, 1.1, 1.1), steelM, 0, 11.5, z));
    }
    for (const sd of [-1, 1]) E.add(mesh(new THREE.BoxGeometry(0.5, 0.5, D), steelM, sd * X, 11.5, (out * D) / 2));
    E.add(mesh(new THREE.BoxGeometry(X * 2, 0.25, D), paneM, 0, 11.7, (out * D) / 2));
    // the glass walls of the vestibule, and the doors slid open against them
    for (const sd of [-1, 1]) {
      E.add(mesh(new THREE.BoxGeometry(0.15, 11, D), paneM, sd * (X - 0.3), 5.5, (out * D) / 2));
      E.add(mesh(new THREE.BoxGeometry(0.12, 9, 4.2), paneM, sd * (W / 2 + 1.4), 4.5, out * 1.2));
    }
    // the name, lit, over the road on the outer frame: one board on each face of its beam, each turned to read the right
    // way round from its own side (one double-sided board read backwards to everyone coming at it)
    const sign = mesh(new THREE.PlaneGeometry(X * 1.4, 2.6), signM(name), 0, 13.6, out * D);
    sign.rotation.y = out < 0 ? Math.PI : 0;
    E.add(sign);
    const back = mesh(new THREE.PlaneGeometry(X * 1.4, 2.6), signM(name), 0, 13.6, out * D - out * 0.5);
    back.rotation.y = out < 0 ? 0 : Math.PI;
    E.add(back);
    E.add(mesh(new THREE.BoxGeometry(X * 1.4 + 0.4, 3, 0.3), steelM, 0, 13.6, out * D - out * 0.25));
    scene.add(E);
    shade(E);
  };
  // the dome over [sA, sB] of road: find where the road crosses its rim, open the glass there, build both entrances,
  // and lay the balustrades and the floor in between. inside(x, z) says whether a ground point is under the dome.
  const domeRoad = (sA, sB, isIn, name) => {
    let s0 = null,
      s1 = null;
    for (let s = sA - 60; s <= sB + 60; s += 1) {
      const q = tr.point(s, 0);
      if (isIn(q.x, q.z)) {
        s0 ??= s;
        s1 = s;
      }
    }
    if (s0 === null) return;
    entrance(s0, -1, name);
    entrance(s1, 1, name);
    const rails = [],
      floors = [];
    for (let s = s0 + 1; s < s1 - 1; s += 3) {
      const i = tr.idx(s),
        a = head(s);
      if (tr.P[i].y > 0.5) continue; // (up on a deck the bridge has its own barriers)
      for (const sd of [-1, 1]) {
        const q = tr.beside(i, sd * (W / 2 + 0.7));
        rails.push(new THREE.BoxGeometry(0.1, 1.1, 3.05).translate(0, 0.55, 0).rotateY(a).translate(q.x, 0, q.z));
        const r2 = tr.beside(i, sd * (W / 2 + 4.6));
        floors.push(new THREE.BoxGeometry(7.6, 0.16, 3.05).translate(0, 0.02, 0).rotateY(a).translate(r2.x, 0, r2.z));
      }
    }
    if (rails.length) {
      scene.add(new THREE.Mesh(mergeGeometries(rails), paneM));
      const fl = new THREE.Mesh(mergeGeometries(floors), floorM);
      fl.receiveShadow = true;
      scene.add(fl);
    }
  };

  /* ---------- the Cloud Forest: a glass dome round a mountain of green, the waterfall pouring down it ---------- */
  const latticeT = canvasTex(
    128,
    128,
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = 'rgba(235,245,255,.95)';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(w, h);
      x.moveTo(w, 0);
      x.lineTo(0, h);
      x.moveTo(0, h / 2);
      x.lineTo(w, h / 2);
      x.stroke();
    },
    { repeat: true },
  );
  const fallT = canvasTex(
    64,
    256,
    (x, w, h) => {
      x.fillStyle = '#bfe8ff';
      x.fillRect(0, 0, w, h);
      for (let j = 0; j < 90; j++) {
        x.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`;
        x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 20 + Math.random() * 50);
      }
    },
    { repeat: true },
  );
  fallT.repeat.set(2, 3);
  // The road spirals up round the mountain (the feature's s is where the circle starts, len its length, r its radius):
  // the dome stands over the circle's middle, the mountain in it; one more waterfall pours across the road up there.
  for (const f of fOf('cloudforest')) {
    const A = tr.point(f.s, 0),
      B = tr.point(f.s + Math.PI * f.r, 0), // half way round the true circle: the far side of it
      G = new THREE.Group(),
      R = f.r + 50;
    G.position.set((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
    scene.add(G);
    const glassM = new THREE.MeshPhongMaterial({
      color: '#d8efff',
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      shininess: 120,
      specular: '#ffffff',
    });
    const ribM = glow(
      new THREE.MeshLambertMaterial({ map: latticeT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      latticeT,
      '#b9e6ff',
      0.6,
    );
    latticeT.repeat.set(30, 8);
    G.updateMatrixWorld(true);
    const DS = new THREE.Vector3(1, 0.62, 1),
      DM = G.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(DS.x, DS.y, DS.z));
    const domeG = openGlass(new THREE.SphereGeometry(R, 180, 44, 0, TAU, 0, Math.PI / 2), DM);
    for (const m of [glassM, ribM]) {
      const d = mesh(domeG, m);
      d.scale.copy(DS);
      G.add(d);
    }
    const hall = fOf('hall').find(h => h.s <= f.s && h.s + h.len >= f.s);
    if (hall)
      domeRoad(hall.s, hall.s + hall.len, (x, z) => Math.hypot(x - G.position.x, z - G.position.z) < R, 'CLOUD FOREST');
    // the mountain in the middle, green all over with flowers in it
    const mg = new THREE.CylinderGeometry(13, 22, 56, 28, 14),
      mp = mg.attributes.position,
      mc = new Float32Array(mp.count * 3),
      col = new THREE.Color();
    for (let j = 0; j < mp.count; j++) {
      const x = mp.getX(j),
        y = mp.getY(j),
        z = mp.getZ(j),
        n = 1 + 0.12 * Math.sin(y * 0.4 + Math.atan2(z, x) * 5) + 0.08 * Math.sin(y * 1.3);
      mp.setXYZ(j, x * n, y, z * n);
      col.set(['#2f6a3a', '#3f7d3a', '#4f9a44', '#2a5c35'][j % 4]);
      if (Math.random() < 0.08) col.set(['#e85a9a', '#f2b33d', '#c45ae0', '#ffffff'][j % 4]);
      mc.set([col.r, col.g, col.b], j * 3);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    mg.computeVertexNormals();
    const mtnM = glow(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), null, '#2a4a7a', 0.45);
    G.add(mesh(mg.translate(0, 28, 0), mtnM));
    const walkM = glow(lam('#dfe4ea'), null, '#bfe9ff', 0.7);
    for (const [y, r] of [
      [24, 21],
      [42, 17],
    ])
      G.add(mesh(new THREE.TorusGeometry(r, 0.7, 6, 40).rotateX(Math.PI / 2), walkM, 0, y, 0));
    // the waterfall down the mountain into its pool, and a second one pouring off the top across the road
    const fallM = new THREE.MeshLambertMaterial({
      map: fallT,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      emissive: '#000000',
    });
    glow(fallM, fallT, '#cfefff', 0.9);
    G.add(mesh(new THREE.PlaneGeometry(11, 50), fallM, 0, 27, 20.5));
    G.add(mesh(new THREE.CylinderGeometry(9, 9, 0.6, 24), phong({ color: '#3b8fc4' }), 0, 0.3, 24));
    animated.push(t => (fallT.offset.y = t * 0.9));
    {
      const sc = f.s + f.len * 0.62,
        p = tr.point(sc, 0),
        curtain = mesh(new THREE.PlaneGeometry(W + 8, 34), fallM, p.x, p.y + 17, p.z);
      curtain.rotation.y = head(sc);
      scene.add(curtain);
      const lip = mesh(new THREE.BoxGeometry(W + 10, 1.4, 3), walkM, p.x, p.y + 34, p.z);
      lip.rotation.y = head(sc);
      scene.add(lip);
      place('THE WATERFALL', 'Straight through it', p, sc, { lookH: 10, back: 30, h: 2 });
    }
    // the garden floor: ferns and flowers round the mountain and out to the glass
    const fernM = lam('#3f8a40'),
      flowerMs = ['#e85a9a', '#f2b33d', '#c45ae0', '#ff7a4a'].map(c => glow(lam(c), null, c, 0.4));
    for (let j = 0; j < 260; j++) {
      const u = rand() * TAU,
        r = rr(24, R - 6),
        x = G.position.x + Math.cos(u) * r,
        z = G.position.z + Math.sin(u) * r,
        n = tr.nearest(x, z);
      if (n.d < W / 2 + 2 && tr.P[n.i].y < 6) continue;
      add(new THREE.IcosahedronGeometry(rr(1.2, 2.6), 0), rand() < 0.7 ? fernM : pick(flowerMs), x, 1, z, 0, 1, false);
    }
    shade(G);
    place('CLOUD FOREST', 'Up round the mountain', tr.point(f.s + f.len * 0.3, 0), f.s + f.len * 0.3, {
      lookH: 10,
      back: 40,
      h: 4,
    });
  }

  /* ---------- the Flower Dome: a long low glass dome, flowers inside ---------- */
  // the road runs down the middle of it, the flower beds either side
  for (const f of fOf('flowerdome')) {
    const mid = f.s + f.len / 2,
      c = tr.point(mid, 0),
      G = new THREE.Group(),
      R = 50,
      DS = new THREE.Vector3(1, 0.62, 1.9);
    G.position.set(c.x, 0, c.z);
    G.rotation.y = head(mid);
    scene.add(G);
    G.updateMatrixWorld(true);
    const glassM = new THREE.MeshPhongMaterial({
      color: '#d8efff',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      shininess: 120,
    });
    const ribM = glow(
      new THREE.MeshLambertMaterial({ map: latticeT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      latticeT,
      '#ffd9f0',
      0.55,
    );
    const domeG = openGlass(
      new THREE.SphereGeometry(R, 120, 36, 0, TAU, 0, Math.PI / 2),
      G.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(DS.x, DS.y, DS.z)),
    );
    for (const m of [glassM, ribM]) {
      const d = mesh(domeG, m);
      d.scale.copy(DS);
      G.add(d);
    }
    const inv = G.matrixWorld.clone().invert(),
      v = new THREE.Vector3();
    domeRoad(
      f.s,
      f.s + f.len,
      (x, z) => {
        v.set(x, 0, z).applyMatrix4(inv);
        return (v.x / R) ** 2 + (v.z / (R * DS.z)) ** 2 < 1;
      },
      'FLOWER DOME',
    );
    // the beds: drifts of colour either side of the road, a few trees, a baobab in the middle of one side
    const bloom = ['#ff5ca8', '#ffd23f', '#ff7a4a', '#c45ae0', '#ffffff', '#ff3b3b'].map(cc =>
      glow(lam(cc), null, cc, 0.5),
    );
    for (let j = 0; j < 520; j++) {
      const sd = rand() < 0.5 ? -1 : 1,
        xx = sd * rr(W / 2 + 9, R - 4),
        zz = rr(-R * DS.z * 0.85, R * DS.z * 0.85);
      if ((xx / R) ** 2 + (zz / (R * DS.z)) ** 2 > 0.85) continue;
      const band = Math.floor((zz + 200) / 14) % bloom.length;
      G.add(
        mesh(
          new THREE.IcosahedronGeometry(rr(0.7, 1.5), 0),
          bloom[(band + (sd > 0 ? 2 : 0)) % bloom.length],
          xx,
          0.8,
          zz,
        ),
      );
    }
    for (const [xx, zz] of [
      [W / 2 + 22, -30],
      [-(W / 2 + 22), 25],
      [W / 2 + 26, 45],
    ]) {
      G.add(mesh(new THREE.CylinderGeometry(1.6, 2.6, 10, 8).translate(0, 5, 0), lam('#7a5a3a'), xx, 0, zz));
      G.add(mesh(new THREE.IcosahedronGeometry(6, 1), lam('#3f7d3a'), xx, 13, zz));
    }
    shade(G);
    place('FLOWER DOME', 'Through the flowers', c, mid, { lookH: 10, back: 40, h: 3 });
  }

  /* ---------- Dragonfly Lake: the dragonflies on their stalks over the water ---------- */
  const dragonM = new THREE.MeshStandardMaterial({ color: '#c9d3dc', metalness: 0.8, roughness: 0.3 }),
    wingM = glow(
      new THREE.MeshPhongMaterial({ color: '#9fe3ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      null,
      '#6fd3ff',
      1,
    );
  for (const f of fOf('dragonfly'))
    for (let s = f.s; s < f.s + f.len; s += 28)
      for (const sd of [1, -1]) {
        const { G } = frame(s + rr(-6, 6), sd, rr(W / 2 + 12, W / 2 + 28));
        G.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 6).translate(0, 4, 0), dragonM));
        const body = mesh(new THREE.CylinderGeometry(0.35, 0.18, 6, 8).rotateX(Math.PI / 2), dragonM, 0, 8, 0);
        G.add(body);
        for (const w of [-1, 1])
          for (const z0 of [0.8, -0.4]) {
            const wing = mesh(new THREE.PlaneGeometry(4.5, 1.2), wingM, w * 2.4, 8.2, z0);
            wing.rotation.x = -Math.PI / 2;
            G.add(wing);
          }
        G.rotation.y += rr(-0.6, 0.6);
      }

  /* ---------- shophouses: the facade drawn once in white, tinted by each house's paint ---------- */
  // one bay: 6 m wide, 12 m up: the five-foot way's arches on the ground floor, two floors of tall shuttered windows,
  // the pilasters between, a cornice at the top
  const shopT = facade(
    (x, w, h) => {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, h);
      const fy = h - 64; // the ground floor (the bottom of the texture is the street)
      x.fillStyle = '#3a3026';
      x.beginPath();
      x.moveTo(10, h);
      x.lineTo(10, fy + 22);
      x.arc(w / 2, fy + 22, w / 2 - 10, Math.PI, 0);
      x.lineTo(w - 10, h);
      x.fill();
      for (const [y0, hh] of [
        [26, 52],
        [96, 52],
      ])
        for (const cx of [20, w - 44]) {
          x.fillStyle = '#e8e2d8';
          x.fillRect(cx - 3, y0 - 3, 30, hh + 6);
          x.fillStyle = '#2f6a5a';
          x.fillRect(cx, y0, 24, hh);
          x.fillStyle = 'rgba(255,255,255,.35)';
          for (let yy = y0 + 4; yy < y0 + hh; yy += 6) x.fillRect(cx + 2, yy, 20, 2); // the louvres
        }
      x.fillStyle = 'rgba(0,0,0,.12)';
      x.fillRect(0, 0, 6, h);
      x.fillRect(w - 6, 0, 6, h);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.fillRect(0, 0, w, 14);
      x.fillStyle = 'rgba(0,0,0,.15)';
      x.fillRect(0, 14, w, 3);
      x.fillRect(0, fy - 4, w, 4);
    },
    96,
    192,
  );
  const shopLit = litTex(
    96,
    192,
    [
      [20, 26, 24, 52],
      [52, 26, 24, 52],
      [20, 96, 24, 52],
      [52, 96, 24, 52],
      [14, 150, 68, 42],
    ],
    0.55,
    WARM,
  );
  const PALS = {
    river: ['#f3d9a6', '#f7c6a0', '#d9ecd0', '#cfe0f2', '#f9e6c6', '#f2c6c6'],
    clarke: ['#ff6fa8', '#ffcf3f', '#4fc3f7', '#7ed957', '#ff8a3d', '#b07cff'],
  };
  const shopMs = {};
  for (const [key, cols] of Object.entries(PALS))
    shopMs[key] = cols.map(c => glow(new THREE.MeshLambertMaterial({ color: c, map: shopT }), shopLit, '#ffffff', 1));
  const roofM = lam('#b5523a'),
    roofM2 = lam('#9a4532');
  // a row of shophouses along a stretch, both sides, their fronts on the pavement
  function shopRow(f, pal, o = {}) {
    const front = o.front ?? W / 2 + 3,
      depth = o.depth ?? 16;
    for (const sd of o.sides || [1, -1]) {
      let s = f.s + rr(0, 4);
      while (s < f.s + f.len) {
        const w = pick([6, 6, 6, 5, 7]),
          i = tr.idx(s);
        if (tr.lowb[i] || tr.hall[i] || tr.elevated[i]) {
          s += 6;
          continue;
        }
        const p = P(s, sd * inside(s) * (front + depth / 2)),
          a = head(s),
          h = pick([9, 12, 12, 12, 13.5]);
        if (!free(p.x, p.z, w * 0.45, front + depth / 2 - w * 0.5)) {
          s += w;
          continue;
        }
        reserve(p.x, p.z, w * 0.5);
        const m = pick(o.mats || shopMs[pal]);
        add(boxT(w, h, depth, 6, h === 9 ? 9 : 12).rotateY(Math.PI / 2), m, p.x, 0, p.z, a, 1, false);
        // the clay roof: a low ridge along the row
        add(
          new THREE.CylinderGeometry(depth / 2 + 0.6, depth / 2 + 0.6, w + 0.2, 3, 1)
            .rotateZ(Math.PI / 2)
            .rotateX(Math.PI / 6)
            .scale(1, 0.32, 1)
            .rotateY(Math.PI / 2)
            .translate(0, h + 0.4, 0),
          rand() < 0.5 ? roofM : roofM2,
          p.x,
          0,
          p.z,
          a,
          1,
          false,
        );
        s += w;
      }
    }
  }
  for (const f of fOf('boatquay')) shopRow(f, 'river', { sides: [1], front: W / 2 + 6 });
  const wireM = lam('#2a2a2a');

  const hipRoof = (w, d, h) =>
    new THREE.CylinderGeometry(0.5, 1, h, 4, 1)
      .rotateY(Math.PI / 4)
      .scale(w / Math.SQRT2, 1, d / Math.SQRT2)
      .translate(0, h / 2, 0);
  /* ---------- the river: bumboats, Cavenagh Bridge, the Victoria clock tower, the Padang, Clarke Quay, Lau Pa Sat ---------- */
  const boatM = lam('#7a3b22'),
    boatTopM = glow(lam('#d33a2c'), null, '#ff7a3a', 1.2);
  for (const f of fOf('boatquay')) {
    for (let s = f.s + 20; s < f.s + f.len; s += 34) {
      const p = P(s, inside(s) * rr(62, 90)),
        a = head(s) + rr(-0.3, 0.3);
      add(
        new THREE.CylinderGeometry(1.4, 0.8, 11, 8).rotateX(Math.PI / 2).scale(1.3, 0.6, 1),
        boatM,
        p.x,
        -0.6,
        p.z,
        a,
        1,
        false,
      );
      add(new THREE.BoxGeometry(3.4, 0.25, 7).translate(0, 2.6, 0), boatTopM, p.x, 0, p.z, a, 1, false);
    }
    // the riverside umbrellas between the shophouses and the water
    const umbM = glow(lam('#f2f2f2'), null, '#ffd49a', 0.6),
      umbM2 = glow(lam('#d8432c'), null, '#ff8a3a', 0.6);
    for (let s = f.s + 6; s < f.s + f.len; s += 9) {
      const p = P(s, inside(s) * (W / 2 + 26));
      if (!free(p.x, p.z, 2, W / 2 + 10)) continue;
      add(new THREE.CylinderGeometry(0.08, 0.08, 3, 4).translate(0, 1.5, 0), wireM, p.x, 0, p.z);
      add(new THREE.ConeGeometry(2.4, 1, 8).translate(0, 3.2, 0), rand() < 0.5 ? umbM : umbM2, p.x, 0, p.z);
    }
    place('BOAT QUAY', 'The shophouses on the river', P(f.s + f.len / 2, 0), f.s + f.len / 2, { lookH: 10 });
  }
  for (const f of fOf('cavenagh')) {
    const pylonM = glow(lam('#f4f4f2'), null, '#e8f0ff', 0.7),
      chainM = lam('#e9e9e6');
    const chains = [];
    for (const sd of [1, -1]) {
      const ends = [f.s + 6, f.s + f.len - 6].map(s => tr.beside(tr.idx(s), sd * (W / 2 + 1.8)));
      for (const e of ends) {
        add(boxM(1.6, 11, 1.6, 4), pylonM, e.x, 0, e.z, 0, 1, false);
        add(
          new THREE.ConeGeometry(1.2, 2, 4).rotateY(Math.PI / 4).translate(0, 12, 0),
          pylonM,
          e.x,
          0,
          e.z,
          0,
          1,
          false,
        );
      }
      const pts = [];
      for (let j = 0; j <= 20; j++) {
        const u = j / 20,
          s = f.s + 6 + (f.len - 12) * u,
          q = tr.beside(tr.idx(s), sd * (W / 2 + 1.8));
        pts.push(new THREE.Vector3(q.x, 11 - Math.sin(u * Math.PI) * 9, q.z));
      }
      chains.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.22, 6));
    }
    scene.add(new THREE.Mesh(mergeGeometries(chains), chainM));
    place('CAVENAGH BRIDGE', 'Over the river', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, { lookH: 8 });
  }
  const clockT = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#f4f2ec';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#fffdf6';
    x.beginPath();
    x.arc(64, 64, 50, 0, TAU);
    x.fill();
    x.strokeStyle = '#2a2a2a';
    x.lineWidth = 4;
    x.stroke();
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(64, 64);
    x.lineTo(64, 26);
    x.moveTo(64, 64);
    x.lineTo(92, 70);
    x.stroke();
  });
  const clockM = glow(new THREE.MeshLambertMaterial({ map: clockT }), clockT, '#fff2d0', 0.9);
  const clockTower = (x, z, a, h, w) => {
    add(boxM(w, h, w, 8), white, x, 0, z, a, 1, false);
    add(new THREE.BoxGeometry(w + 0.4, w * 0.8, w + 0.4).translate(0, h + w * 0.4, 0), clockM, x, 0, z, a, 1, false);
    add(hipRoof(w + 1, w + 1, w * 1.4).translate(0, h + w * 0.8, 0), lam('#5a6a7a'), x, 0, z, a, 1, false);
  };
  for (const f of fOf('clocktower')) {
    const p = P(f.s, -inside(f.s) * 58),
      a = head(f.s);
    if (!free(p.x, p.z, 30, W / 2 + 4)) continue;
    reserve(p.x, p.z, 36);
    add(boxM(30, 20, 56, 16), white, p.x, 0, p.z, a);
    add(hipRoof(32, 58, 6).translate(0, 20, 0), lam('#6a7480'), p.x, 0, p.z, a);
    clockTower(p.x, p.z, a, 44, 9);
    place('VICTORIA THEATRE', 'The clock tower', p, f.s, { lookH: 30 });
  }
  for (const f of fOf('padang')) {
    // the field, inside the loop: a green with a white line round it and the cricket pavilion
    const a = head(f.s + f.len / 2),
      c = P(f.s + f.len / 2, inside(f.s + f.len / 2) * (W / 2 + 60));
    const fieldM = lam('#5fae4a');
    add(new THREE.BoxGeometry(90, 0.3, f.len * 0.8).translate(0, 0.15, 0), fieldM, c.x, 0, c.z, a, 1, false);
    add(new THREE.BoxGeometry(84, 0.32, 0.6).translate(0, 0.16, f.len * 0.38), white, c.x, 0, c.z, a, 1, false);
    add(new THREE.BoxGeometry(84, 0.32, 0.6).translate(0, 0.16, -f.len * 0.38), white, c.x, 0, c.z, a, 1, false);
    reserve(c.x, c.z, Math.min(90, f.len * 0.4));
    // across the road: the old Supreme Court's green dome, City Hall's columns, and the new Supreme Court's disc
    const s1 = f.s + f.len * 0.3,
      p1 = P(s1, -inside(s1) * 56),
      a1 = head(s1);
    add(boxM(36, 24, 110, 16), cream, p1.x, 0, p1.z, a1);
    for (let j = -8; j <= 8; j++) {
      const q = P(s1 + j * 6, -inside(s1) * (56 - 19));
      add(cylM(1.1, 1.1, 18, 10).translate(0, 2, 0), white, q.x, 0, q.z, 0, 1, false);
    }
    const s2 = f.s + f.len * 0.62,
      p2 = P(s2, -inside(s2) * 58),
      a2 = head(s2);
    add(boxM(40, 22, 70, 16), cream, p2.x, 0, p2.z, a2);
    add(cylM(9, 9, 6, 24).translate(0, 22, 0), cream, p2.x, 0, p2.z, a2);
    add(
      new THREE.SphereGeometry(9.5, 24, 12, 0, TAU, 0, Math.PI / 2).scale(1, 1.25, 1).translate(0, 28, 0),
      glow(lam('#5aa58c'), null, '#2a5a4a', 1),
      p2.x,
      0,
      p2.z,
      a2,
    );
    const s3 = f.s + f.len * 0.85,
      p3 = P(s3, -inside(s3) * 70);
    add(boxM(34, 46, 30, 16), towerMs[2], p3.x, 0, p3.z, head(s3));
    add(cylM(26, 26, 3, 36).translate(0, 48, 0), white, p3.x, 0, p3.z);
    reserve(p1.x, p1.z, 60);
    reserve(p2.x, p2.z, 40);
    reserve(p3.x, p3.z, 30);
    place('THE PADANG', 'The green and the domes', c, f.s + f.len / 2, { lookH: 16 });
  }
  // the river run: the road under a skin of moving water, orange buoys marking its edges, bumboats moored off it
  const riverT = canvasTex(
    128,
    256,
    (x, w, h) => {
      x.fillStyle = '#2a9ab8';
      x.fillRect(0, 0, w, h);
      for (let j = 0; j < 140; j++) {
        x.fillStyle = `rgba(${200 + Math.random() * 55},${230 + Math.random() * 25},255,${0.15 + Math.random() * 0.35})`;
        x.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 26, 1.5 + Math.random() * 2);
      }
    },
    { repeat: true },
  );
  riverT.repeat.set(2, 1);
  // (the same water as the river round it, laid just over the road and drawn after it, so the road never shows through)
  const riverM = glow(
    new THREE.MeshPhongMaterial({
      color: '#5fbcd4',
      map: riverT,
      shininess: 120,
      specular: '#dff6ff',
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    }),
    riverT,
    '#2a7a9a',
    0.45,
  );
  animated.push(t => (riverT.offset.y = -t * 0.35));
  const buoyM = glow(lam('#ff7a1a'), null, '#ff8a2a', 0.8);
  for (const f of fOf('waterway')) {
    const pos = [],
      uv = [],
      idx = [],
      buoys = [];
    let n = 0;
    for (let s = f.s; s <= f.s + f.len; s += 2) {
      const i = tr.idx(s),
        p = tr.point(s, 0);
      for (const sd of [-1, 1]) {
        const q = tr.beside(i, sd * (W / 2 + 0.5));
        pos.push(q.x, p.y + 0.14, q.z);
        uv.push(sd < 0 ? 0 : 1, (s - f.s) / 24);
      }
      if (n > 0) {
        const a2 = (n - 1) * 2;
        idx.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2);
      }
      n++;
      if (Math.round(s - f.s) % 8 === 0)
        for (const sd of [-1, 1]) {
          const q = tr.beside(i, sd * (W / 2 + 1));
          buoys.push(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 0.8, 1).translate(q.x, -1.15, q.z));
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const skin = new THREE.Mesh(g, riverM);
    skin.renderOrder = 2;
    scene.add(skin);
    scene.add(new THREE.Mesh(mergeGeometries(buoys), buoyM));
  }
  // bumboats moored along the river run, on its open side
  for (const f of fOf('river'))
    for (let s = f.s + 20; s < f.s + f.len; s += 45) {
      const p = P(s, -inside(s) * rr(W / 2 + 12, W / 2 + 22)),
        a = head(s) + rr(-0.2, 0.2);
      add(
        new THREE.CylinderGeometry(1.4, 0.8, 11, 8).rotateX(Math.PI / 2).scale(1.3, 0.6, 1),
        boatM,
        p.x,
        -0.6,
        p.z,
        a,
        1,
        false,
      );
      add(new THREE.BoxGeometry(3.4, 0.25, 7).translate(0, 2.6, 0), boatTopM, p.x, 0, p.z, a, 1, false);
      for (const z0 of [-2.8, 2.8])
        add(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4).translate(1.5, 1.4, z0), wireM, p.x, 0, p.z, a, 1, false);
    }
  for (const f of fOf('river'))
    place('THE RIVER', 'Racing on the water', tr.point(f.s + f.len * 0.5, 0), f.s + f.len * 0.5, {
      lookH: 4,
      back: 30,
      h: 3,
    });

  for (const f of fOf('clarkequay')) {
    shopRow(f, 'clarke', { sides: [1], front: W / 2 + 4, depth: 18 });
    // the canopies: great translucent mushrooms over the lanes, lit in changing colours at night
    const canM = new THREE.MeshPhongMaterial({
      color: '#f2f6ff',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      emissive: '#000000',
    });
    colourCycle.push({ mat: canM, hue: 0.9, sat: 0.8, speed: 0.06, str: 1.2 });
    for (let s = f.s + 14; s < f.s + f.len; s += 30) {
      const p = P(s, inside(s) * (W / 2 + 34)); // (behind the warehouses: the river's on the other side)
      if (!free(p.x, p.z, 8, W / 2 + 6)) continue;
      reserve(p.x, p.z, 9);
      add(new THREE.CylinderGeometry(0.5, 0.8, 10, 8).translate(0, 5, 0), lam('#d8dde4'), p.x, 0, p.z);
      add(new THREE.ConeGeometry(9, 3, 16, 1, true).rotateX(Math.PI).translate(0, 11, 0), canM, p.x, 0, p.z);
    }
    place('CLARKE QUAY', 'The coloured warehouses', P(f.s + f.len / 2, 0), f.s + f.len / 2, { lookH: 10 });
  }
  for (const f of fOf('laupasat')) {
    const p = P(f.s, -inside(f.s) * 50),
      a = head(f.s);
    if (!free(p.x, p.z, 30, W / 2 + 4)) continue;
    reserve(p.x, p.z, 36);
    const ironM = glow(lam('#8a9bb0'), null, '#ffc070', 0.5);
    for (let j = 0; j < 16; j++) {
      const u = (j / 16) * TAU;
      add(cylM(0.5, 0.5, 9, 6), ironM, p.x + Math.cos(u) * 26, 0, p.z + Math.sin(u) * 26, 0, 1, false);
    }
    add(new THREE.CylinderGeometry(4, 30, 7, 8).translate(0, 12.5, 0), ironM, p.x, 0, p.z, a + Math.PI / 8, 1, false);
    add(new THREE.CylinderGeometry(28, 28, 0.8, 8).translate(0, 9, 0), cream, p.x, 0, p.z, a + Math.PI / 8, 1, false);
    clockTower(p.x, p.z, a, 24, 6);
    // the satay stalls along the road: smoking grills under red awnings
    const stallM = glow(lam('#c8322a'), null, '#ff8a3a', 1);
    for (let j = -3; j <= 3; j++) {
      const q = P(f.s + j * 8, -inside(f.s) * (W / 2 + 9));
      add(boxM(5, 3, 4, 4), lam('#d9d2c4'), q.x, 0, q.z, a, 1, false);
      add(new THREE.BoxGeometry(6, 0.3, 5).translate(0, 3.4, 0), stallM, q.x, 0, q.z, a, 1, false);
    }
    place('LAU PA SAT', 'The satay street', p, f.s, { lookH: 14 });
  }

  /* ---------- Changi: the jets at their gates, the control tower, the terminal, Jewel, the runway, the ships ---------- */
  // a jet: white, a navy belly line and a gold-and-navy tail, the windows a lit band at night (built once, placed many times)
  const jetBody = glow(
    new THREE.MeshPhongMaterial({
      map: canvasTex(256, 64, (x, w, h) => {
        x.fillStyle = '#f6f7f9';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#1d2c5a';
        x.fillRect(0, h * 0.62, w, h * 0.08);
        x.fillStyle = '#2a3446';
        for (let c = 8; c < w - 8; c += 6) x.fillRect(c, h * 0.38, 3, 4);
      }),
      shininess: 90,
    }),
    canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = '#000';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffe6b0';
      for (let c = 8; c < w - 8; c += 6) x.fillRect(c, h * 0.38, 3, 4);
    }),
    '#ffffff',
    1,
  );
  const jetWing = lam('#d9dde3'),
    jetTail = glow(lam('#1d2c5a'), null, '#2a4aa0', 0.6),
    jetGold = lam('#e0b03a'),
    jetEng = lam('#b9bfc8');
  const jetParts = () => {
    const out = [];
    const fus = new THREE.CylinderGeometry(2.7, 2.7, 40, 20, 1, true).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
    // (the fuselage's texture wraps round it: the windows on both sides)
    out.push([fus, jetBody]);
    out.push([
      new THREE.SphereGeometry(2.7, 20, 12, 0, TAU, 0, Math.PI / 2)
        .rotateX(Math.PI / 2)
        .scale(1, 1, 2.2)
        .translate(0, 0, 20),
      jetBody,
    ]);
    out.push([
      new THREE.ConeGeometry(2.7, 10, 20)
        .rotateX(-Math.PI / 2)
        .scale(1, 0.8, 1)
        .translate(0, 0.6, -25),
      jetBody,
    ]);
    const wing = new THREE.Shape();
    wing.moveTo(0, 6);
    wing.lineTo(22, -6);
    wing.lineTo(22, -9);
    wing.lineTo(0, -4);
    wing.closePath();
    for (const sd of [1, -1]) {
      const g = new THREE.ExtrudeGeometry(wing, { depth: 0.5, bevelEnabled: false })
        .rotateX(Math.PI / 2)
        .scale(sd, 1, -1)
        .translate(0, -1, 0);
      out.push([g, jetWing]);
      out.push([new THREE.CylinderGeometry(1.4, 1.2, 5, 14).rotateX(Math.PI / 2).translate(sd * 8, -2.6, 1.5), jetEng]);
      const st = new THREE.ExtrudeGeometry(wing, { depth: 0.3, bevelEnabled: false })
        .rotateX(Math.PI / 2)
        .scale(sd * 0.4, 1, -0.5)
        .translate(0, 1, -24);
      out.push([st, jetWing]);
    }
    const fin = new THREE.Shape();
    fin.moveTo(0, 0);
    fin.lineTo(9, 0);
    fin.lineTo(4, 11);
    fin.lineTo(0, 11);
    fin.closePath();
    out.push([
      new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false })
        .rotateY(Math.PI / 2)
        .translate(-0.2, 1.5, -18),
      jetTail,
    ]);
    out.push([new THREE.BoxGeometry(0.5, 2, 3).translate(0, 9, -27.5), jetGold]);
    return out;
  };
  const JET = jetParts();
  const parkJet = (x, z, a) => {
    for (const [g, m] of JET) add(g, m, x, 3.4, z, a, 1, false);
    add(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 6).translate(0, 1.6, 14), jetEng, x, 0, z, a, 1, false); // the nose gear
  };
  const concreteM = lam('#b7b9bc'),
    lineM = lam('#f2c230');
  for (const f of fOf('apron')) {
    const side = -1,
      gate = W / 2 + 46,
      termOff = W / 2 + 100;
    for (let s = f.s + 30; s < f.s + f.len - 20; s += 62) {
      const i = tr.idx(s),
        p = P(s, side * inside(s) * gate),
        q = P(s, side * inside(s) * termOff),
        a = Math.atan2(q.x - p.x, q.z - p.z); // nose in to the terminal
      if (!free(p.x, p.z, 22, W / 2 + 6)) continue;
      reserve(p.x, p.z, 24);
      parkJet(p.x, p.z, a);
      // the jet bridge, out from the terminal to the door
      const jb = P(s + 6, side * inside(s) * (gate + 30));
      add(boxM(3.4, 3.2, 26, 4).translate(0, 4.2, 0), white, jb.x, 0, jb.z, a, 1, false);
      void i;
    }
    // the apron itself, and the terminal along the back of it
    for (let s = f.s; s < f.s + f.len; s += 20) {
      const c = P(s, side * inside(s) * (W / 2 + 62)),
        a = head(s);
      add(
        new THREE.BoxGeometry(80, 0.2, 20.5).translate(0, 0.05, 0),
        concreteM,
        c.x,
        0,
        c.z,
        a + Math.PI / 2,
        1,
        false,
      );
      add(new THREE.BoxGeometry(0.4, 0.22, 20.5).translate(0, 0.06, 0), lineM, c.x, 0, c.z, a, 1, false);
      const t = P(s, side * inside(s) * (termOff + 22));
      if (free(t.x, t.z, 12, W / 2 + 6)) add(boxM(36, 18, 20.2, 16), towerMs[2], t.x, 0, t.z, a, 1, false);
    }
    place('THE GATES', 'The jets at Changi', P(f.s + f.len / 2, side * inside(f.s) * gate), f.s + f.len / 2, {
      lookH: 6,
    });
  }
  for (const f of fOf('tower')) {
    // Changi's control tower: a tall shaft, the cab flaring out at the top like a glass held up
    const p = P(f.s, inside(f.s) * 56);
    if (!free(p.x, p.z, 14, W / 2 + 4)) continue;
    reserve(p.x, p.z, 16);
    const cabM = glow(phong({ color: '#1f3a5a', shininess: 120 }), null, '#7fd8ff', 1.4);
    add(cylM(4.5, 6, 66, 20), white, p.x, 0, p.z, 0, 1, false);
    add(new THREE.CylinderGeometry(11, 5, 9, 24).translate(0, 70.5, 0), white, p.x, 0, p.z, 0, 1, false);
    add(cylM(11.5, 11, 7, 24).translate(0, 75, 0), cabM, p.x, 0, p.z, 0, 1, false);
    add(new THREE.CylinderGeometry(9, 12.5, 2.5, 24).translate(0, 83.2, 0), white, p.x, 0, p.z, 0, 1, false);
    add(new THREE.CylinderGeometry(0.3, 0.5, 12, 6).translate(0, 90, 0), jetEng, p.x, 0, p.z, 0, 1, false);
    place('CONTROL TOWER', 'Over the airfield', p, f.s, { lookH: 60, back: 60 });
  }
  for (const f of fOf('terminal')) {
    // a terminal: a long glass hall, its roof a row of skylight louvres, a green wall of plants along its face
    const side = -1,
      off = W / 2 + 46,
      roofM = glow(lam('#e9ecf0'), null, '#cfe6ff', 0.5),
      greenWall = glow(
        new THREE.MeshLambertMaterial({
          map: facade((x, w, h) => {
            x.fillStyle = '#2f6a3a';
            x.fillRect(0, 0, w, h);
            for (let j = 0; j < 400; j++) {
              x.fillStyle = ['#3f8a40', '#5aa044', '#2a5c35', '#7ab84a', '#c45ae0'][j % 5];
              x.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 4, 3 + Math.random() * 4);
            }
          }),
        }),
        null,
        '#1a3a2a',
        0.6,
      );
    for (let s = f.s; s < f.s + f.len; s += 20) {
      const p = P(s, side * inside(s) * (off + 20)),
        a = head(s);
      if (!free(p.x, p.z, 10, W / 2 + 6)) continue;
      add(boxM(40, 20, 20.2, 16), towerMs[2], p.x, 0, p.z, a, 1, false);
      add(boxM(42, 1.2, 20.6, 8).translate(0, 20, 0), roofM, p.x, 0, p.z, a, 1, false);
      for (let j = -2; j <= 2; j++) {
        const g = new THREE.BoxGeometry(40, 0.4, 3).translate(0, 0, 0);
        g.rotateX(0.5).translate(0, 22, j * 4);
        add(g, roofM, p.x, 0, p.z, a, 1, false);
      }
      const gw = P(s, side * inside(s) * (off - 0.6));
      add(boxM(0.8, 14, 20.2, 8).translate(0, 3, 0), greenWall, gw.x, 0, gw.z, a, 1, false);
    }
    place('TERMINAL 3', 'Glass and green', P(f.s + f.len / 2, -inside(f.s) * off), f.s + f.len / 2, { lookH: 12 });
  }

  /* ---------- Jewel: the glass doughnut, the Rain Vortex pouring through its eye, the Forest Valley all round ---------- */
  const vortexT = canvasTex(
    128,
    256,
    (x, w, h) => {
      x.fillStyle = '#9fd8f5';
      x.fillRect(0, 0, w, h);
      for (let j = 0; j < 220; j++) {
        x.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
        x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 30 + Math.random() * 80);
      }
    },
    { repeat: true },
  );
  vortexT.repeat.set(6, 2);
  for (const f of fOf('jewel')) {
    const sm = f.s + f.len / 2,
      c = P(sm, inside(sm) * f.r),
      R = 112,
      H = 58; // (tall enough over the spiral that the top of it never feels the glass)
    const G = new THREE.Group();
    G.position.set(c.x, 0, c.z);
    scene.add(G);
    // the shell: glass on a diagonal steel grid, open at the eye
    G.updateMatrixWorld(true);
    const shellG = openGlass(
      new THREE.SphereGeometry(R, 200, 44, 0, TAU, 0.11, Math.PI / 2 - 0.11),
      G.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(1, H / R, 1)),
    );
    {
      const hall = fOf('hall').find(h => h.s <= f.s && h.s + h.len >= f.s);
      if (hall) domeRoad(hall.s, hall.s + hall.len, (x, z) => Math.hypot(x - c.x, z - c.z) < R, 'JEWEL');
    }
    const glassM = new THREE.MeshPhongMaterial({
      color: '#d8efff',
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
      shininess: 120,
      specular: '#ffffff',
    });
    const gridT = latticeT.clone();
    gridT.needsUpdate = true;
    gridT.repeat.set(44, 9);
    const ribM = glow(
      new THREE.MeshLambertMaterial({ map: gridT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      gridT,
      '#cfe9ff',
      0.55,
    );
    for (const m of [glassM, ribM]) {
      const d = new THREE.Mesh(shellG, m);
      d.scale.set(1, H / R, 1);
      G.add(d);
    }
    // the Rain Vortex: a column of water from the eye down into its pool, lit in colours at night
    const vM = new THREE.MeshLambertMaterial({
      map: vortexT,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      emissive: '#000000',
    });
    colourCycle.push({ mat: vM, hue: 0.55, sat: 0.75, speed: 0.04, str: 1.1 });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, H + 2, 40, 1, true).translate(0, (H + 2) / 2, 0), vM);
    G.add(col);
    const vM2 = new THREE.MeshLambertMaterial({
      map: vortexT,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    G.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 8, H + 2, 32, 1, true).translate(0, (H + 2) / 2, 0), vM2));
    animated.push(t => {
      vortexT.offset.y = t * 1.4;
      col.rotation.y = t * 0.15;
    });
    const poolM = glow(phong({ color: '#2f7fb8', shininess: 120 }), null, '#3fc8ff', 0.9);
    G.add(mesh(new THREE.CylinderGeometry(20, 20, 0.5, 48), poolM, 0, 0.1, 0));
    G.add(mesh(new THREE.TorusGeometry(20, 0.8, 8, 64).rotateX(Math.PI / 2), white, 0, 0.5, 0));
    // the mist rising off the pool
    const mistM = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const mists = [];
    for (let j = 0; j < 10; j++) {
      const m = mesh(new THREE.SphereGeometry(rr(5, 9), 12, 8), mistM, rr(-10, 10), rr(1, 6), rr(-10, 10));
      G.add(m);
      mists.push(m);
    }
    animated.push(t => mists.forEach((m, j) => (m.position.y = 2 + ((t * 1.5 + j * 1.3) % 10))));
    // the Forest Valley: terraces of green stepping up the inside of the shell, wherever the road isn't
    const terraceM = lam('#3f7d3a'),
      ledgeM = lam('#d9d4c8'),
      bloomMs = ['#e85a9a', '#f2b33d', '#ffffff', '#c45ae0'].map(cc => glow(lam(cc), null, cc, 0.5));
    for (let ring = 0; ring < 7; ring++) {
      const r = 66 + ring * 6,
        h = 1.5 + ring * 3.2,
        n = Math.round((TAU * r) / 7);
      for (let j = 0; j < n; j++) {
        const u = (j / n) * TAU,
          x = c.x + Math.cos(u) * r,
          z = c.z + Math.sin(u) * r;
        if (tr.nearest(x, z).d < W / 2 + 6 + ring * 0.5) continue;
        add(
          new THREE.BoxGeometry(7.4, h, 6).translate(0, h / 2, 0),
          ring % 2 ? terraceM : ledgeM,
          x,
          0,
          z,
          -u,
          1,
          false,
        );
        if (rand() < 0.6)
          add(
            new THREE.IcosahedronGeometry(rr(1.4, 2.6), 0).translate(0, h + 1, 0),
            rand() < 0.8 ? terraceM : pick(bloomMs),
            x,
            0,
            z,
            0,
            1,
            false,
          );
      }
    }
    shade(G);
    place('JEWEL', 'The Rain Vortex', c, f.s + f.len * 0.35, { lookH: 16, back: 0, h: 4 }); // (from the spiral, the vortex ahead)
  }

  /* ---------- the runway, and a jet taking off beside you ---------- */
  const tarmacM = lam('#3d4048'),
    edgeLightM = glow(lam('#9aa0aa'), null, '#ffd27a', 2.5);
  for (const f of fOf('runway')) {
    const side = -1,
      off = W / 2 + 95,
      a = head(f.s + f.len / 2),
      p0 = P(f.s - 60, side * inside(f.s) * off),
      p1 = P(f.s + f.len + 60, side * inside(f.s) * off),
      L = Math.hypot(p1.x - p0.x, p1.z - p0.z),
      mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
    add(new THREE.BoxGeometry(48, 0.2, L).translate(0, 0.06, 0), tarmacM, mid.x, 0, mid.z, a, 1, false);
    for (let d = -L / 2 + 10; d < L / 2 - 10; d += 30)
      add(new THREE.BoxGeometry(0.9, 0.24, 14).translate(0, 0.08, d), white, mid.x, 0, mid.z, a, 1, false);
    for (let d = -L / 2; d < L / 2; d += 15)
      for (const e of [-24, 24])
        add(new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(e, 0.4, d), edgeLightM, mid.x, 0, mid.z, a, 1, false);
    reserve(mid.x, mid.z, 30);
    // the jet: rolls down the runway, lifts off, climbs away; then the next one
    const jet = new THREE.Group();
    for (const [g, m] of JET) jet.add(new THREE.Mesh(g, m));
    jet.visible = false; // (until its first frame puts it on the runway)
    scene.add(jet);
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    animated.push(t => {
      const T = (t % 26) / 26,
        d = -L / 2 + T * T * (L + 900),
        lift = Math.max(0, d + L * 0.1),
        y = 3.4 + lift * lift * 0.0006,
        pitch = Math.min(0.22, lift * 0.0009);
      jet.position.set(mid.x + dir.x * d, y, mid.z + dir.z * d);
      jet.rotation.set(0, a, 0);
      jet.rotateX(-pitch);
      jet.visible = T < 0.97;
    });
    place('THE RUNWAY', 'A jet taking off', mid, f.s + f.len / 2, { lookH: 10 });
  }
  // the taxiway bridge: the road dips under the airfield, a jet rolling across the bridge over your head
  for (const f of fOf('taxiway')) {
    const p = tr.point(f.s, 0),
      E = new THREE.Group();
    E.position.set(p.x, 0, p.z);
    E.rotation.y = head(f.s);
    scene.add(E);
    const conc = lam('#c4c6c9'),
      span = W + 70;
    E.add(mesh(new THREE.BoxGeometry(span, 2.2, 46).translate(0, 16.1, 0), conc)); // (15 m of air over the road)
    E.add(mesh(new THREE.BoxGeometry(span, 0.3, 46).translate(0, 17.35, 0), lam('#4a4d54'))); // the taxiway's tarmac
    E.add(mesh(new THREE.BoxGeometry(0.4, 0.32, 46).translate(0, 17.4, 0), lam('#f2c230'))); // its centre line
    for (const sd of [-1, 1]) {
      E.add(mesh(new THREE.BoxGeometry(3, 16, 46).translate(sd * (W / 2 + 4), 8, 0), conc)); // the abutments
      E.add(mesh(new THREE.BoxGeometry(span, 1.4, 0.4).translate(0, 18.1, sd * 23), lam('#e8eaee'))); // its parapets
    }
    const under = glow(lam('#9a9ea6'), null, '#fff2d6', 0.9);
    for (let z = -18; z <= 18; z += 12)
      E.add(mesh(new THREE.BoxGeometry(W - 2, 0.2, 1.4).translate(0, 14.9, z), under));
    // the jet: rolls across, waits, rolls back
    const jet = new THREE.Group();
    for (const [g, m] of JET) jet.add(new THREE.Mesh(g, m));
    jet.rotation.y = Math.PI / 2;
    jet.position.set(0, 17.5 + 3.4, 0);
    E.add(jet);
    animated.push(t => {
      const u = (t % 24) / 24,
        x = u < 0.5 ? -span / 2 + 10 + (span - 20) * (u * 2) : span / 2 - 10 - (span - 20) * ((u - 0.5) * 2);
      jet.position.x = x;
      jet.rotation.y = u < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    });
    shade(E);
    reserve(p.x, p.z, 40);
    place('THE TAXIWAY', 'A jet over your head', p, f.s, { lookH: 14, back: 50, h: 2 });
  }
  for (const f of fOf('ships')) {
    const hullMs = ['#7a1f1f', '#1f2a3a', '#2a4a6a'].map(c2 => lam(c2)),
      boxMs = ['#d8432c', '#2a7fd9', '#f2b33d', '#3fa05a', '#e6e6e6'].map(c2 => lam(c2));
    for (let s = f.s + 40; s < f.s + f.len; s += 120) {
      const p = P(s, -inside(s) * rr(160, 320)),
        a = head(s) + rr(-0.5, 0.5);
      add(new THREE.BoxGeometry(14, 8, 90).translate(0, 1, 0), pick(hullMs), p.x, 0, p.z, a, 1, false);
      add(new THREE.BoxGeometry(12, 10, 10).translate(0, 10, -36), white, p.x, 0, p.z, a, 1, false);
      for (let j = -3; j <= 2; j++)
        add(new THREE.BoxGeometry(12, 6, 10).translate(0, 8, j * 11), pick(boxMs), p.x, 0, p.z, a, 1, false);
    }
  }

  /* ---------- Singapore's road signs ---------- */
  // After the island's own: white on blue for destinations by expressway (its code in a white box: ECP, PIE), white on
  // green for those by other roads, white on brown for the sights, all in a white rounded border, upright lettering in
  // mixed case. Overhead on a grey gantry before the junctions; green street name plates at the corners; and the ERP
  // gantry (road pricing) across the downtown roads. They catch the headlights at night.
  const SIGN_BG = { blue: '#1d3f95', green: '#00703c', brown: '#7b4a22' };
  const signFont = px => `700 ${px}px "Barlow", "Arial", sans-serif`;
  const arrow = (x, cx, cy, sz, dir) => {
    x.save();
    x.translate(cx, cy);
    x.rotate((dir * Math.PI) / 2);
    x.beginPath();
    x.moveTo(0, -sz);
    x.lineTo(sz * 0.62, -sz * 0.2);
    x.lineTo(sz * 0.2, -sz * 0.2);
    x.lineTo(sz * 0.2, sz);
    x.lineTo(-sz * 0.2, sz);
    x.lineTo(-sz * 0.2, -sz * 0.2);
    x.lineTo(-sz * 0.62, -sz * 0.2);
    x.closePath();
    x.fill();
    x.restore();
  };
  const panelTex = sg =>
    canvasTex(768, 288, (x, w, h) => {
      x.fillStyle = SIGN_BG[sg.bg] || SIGN_BG.green;
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffffff';
      x.lineWidth = 9;
      x.beginPath();
      x.roundRect(16, 16, w - 32, h - 32, 26);
      x.stroke();
      x.fillStyle = '#ffffff';
      x.textBaseline = 'middle';
      let tx = 60;
      if (sg.code) {
        x.font = signFont(84);
        const cw = x.measureText(sg.code).width + 44;
        x.lineWidth = 6;
        x.strokeRect(54, h / 2 - 58, cw, 116);
        x.textAlign = 'left';
        x.fillText(sg.code, 76, h / 2 + 4);
        tx = 54 + cw + 34;
      }
      x.textAlign = 'left';
      let px = 92;
      x.font = signFont(px);
      while (x.measureText(sg.text).width > w - tx - 170 && px > 50) x.font = signFont((px -= 4));
      x.fillText(sg.text, tx, h / 2 + 4);
      arrow(x, w - 100, h / 2, 64, sg.arrow || 0);
    });
  const signMat = sg => {
    const t = panelTex(sg);
    return glow(new THREE.MeshLambertMaterial({ map: t }), t, '#ffffff', 0.55);
  };
  const greyM = lam('#8a929c'),
    greyDark = lam('#5d6570');
  // a sign gantry across the road at s: grey posts on the verges, a twin beam, the panels over the lanes facing you
  for (const f of fOf('gantry')) {
    const p = tr.point(f.s, 0),
      E = new THREE.Group();
    E.position.set(p.x, 0, p.z);
    E.rotation.y = head(f.s);
    const X = W / 2 + 4.5;
    for (const sd of [-1, 1])
      E.add(mesh(new THREE.BoxGeometry(0.7, 11, 0.7).translate(0, 5.5, 0), greyM, sd * X, 0, 0));
    for (const y of [7.4, 10.4]) E.add(mesh(new THREE.BoxGeometry(X * 2 + 0.7, 0.4, 0.4), greyDark, 0, y, 0.6));
    const n = f.signs.length,
      pw = (W + 4) / n - 0.8;
    f.signs.forEach((sg, j) => {
      const panel = mesh(
        new THREE.PlaneGeometry(pw, (pw * 288) / 768),
        signMat(sg),
        -X + 2.4 + (j + 0.5) * ((X * 2 - 4.8) / n),
        8.9,
        0.1,
      );
      panel.rotation.y = Math.PI; // facing the traffic coming up the road
      E.add(panel);
      E.add(mesh(new THREE.BoxGeometry(pw + 0.2, (pw * 288) / 768 + 0.2, 0.15), greyDark, panel.position.x, 8.9, 0.24));
    });
    scene.add(E);
    shade(E);
  }
  // the green street name plates, on a short grey post at the corner
  for (const f of fOf('street')) {
    const t = canvasTex(512, 112, (x, w, h) => {
      x.fillStyle = '#00703c';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffffff';
      x.lineWidth = 5;
      x.beginPath();
      x.roundRect(8, 8, w - 16, h - 16, 12);
      x.stroke();
      x.fillStyle = '#ffffff';
      x.font = signFont(64);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(f.name, w / 2, h / 2 + 3);
    });
    const m = glow(new THREE.MeshLambertMaterial({ map: t }), t, '#ffffff', 0.45),
      i = tr.idx(f.s),
      q = tr.beside(i, -inside(f.s) * (W / 2 + 6.5)),
      E = new THREE.Group();
    E.position.set(q.x, 0, q.z);
    E.rotation.y = head(f.s);
    E.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8).translate(0, 1.7, 0), greyM));
    for (const r of [0, Math.PI]) {
      const pl = mesh(new THREE.PlaneGeometry(2.6, 0.57), m, 0, 3.2, r ? -0.03 : 0.03);
      pl.rotation.y = r;
      E.add(pl);
    }
    scene.add(E);
  }
  // the ERP gantry: a steel frame across the road, its readers hanging under the beam, the panel lit when it charges
  for (const f of fOf('erp')) {
    const p = tr.point(f.s, 0),
      E = new THREE.Group();
    E.position.set(p.x, 0, p.z);
    E.rotation.y = head(f.s);
    const X = W / 2 + 3;
    for (const sd of [-1, 1]) E.add(mesh(new THREE.BoxGeometry(0.9, 7, 0.9).translate(0, 3.5, 0), greyM, sd * X, 0, 0));
    E.add(mesh(new THREE.BoxGeometry(X * 2 + 0.9, 1.3, 1.1), greyM, 0, 6.6, 0));
    for (let j = -3; j <= 3; j++) E.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), greyDark, j * 3.4, 5.7, 0));
    const t = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = '#10141c';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff';
      x.fillRect(10, 12, 120, h - 24);
      x.fillStyle = '#1d3f95';
      x.font = signFont(60);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('ERP', 70, h / 2 + 2);
      x.fillStyle = '#ff9d2a';
      x.font = '700 50px "Courier New", monospace';
      x.fillText('IN OPERATION', 320, h / 2 + 2);
    });
    const panel = mesh(
      new THREE.PlaneGeometry(9, 1.7),
      glow(new THREE.MeshLambertMaterial({ map: t }), t, '#ffffff', 0.9),
      0,
      8.2,
      -0.1,
    );
    panel.rotation.y = Math.PI;
    E.add(panel);
    E.add(mesh(new THREE.BoxGeometry(9.3, 2, 0.3), greyDark, 0, 8.2, 0.1));
    scene.add(E);
    shade(E);
  }

  /* ---------- the glass towers of the business district ---------- */
  const crownM = glow(lam('#2a2f3a'), null, '#ffffff', 1.5);
  colourCycle.push({ mat: crownM, hue: 0.55, sat: 0.6, speed: 0.01, str: 1.3 });
  // the towers' LED edges: strips up the corners and a band or two round them, cycling through the colours at night
  const neonMs = [0.9, 0.52, 0.75, 0.12].map(hue => {
    const m = new THREE.MeshLambertMaterial({ color: '#2a2e38', emissive: '#000000' });
    colourCycle.push({ mat: m, hue, sat: 1, speed: 0.03, str: 2.4 });
    return m;
  });
  const ledEdges = (x, z, a, h, w, d, round) => {
    const m = pick(neonMs);
    if (round) {
      for (const y of [h * 0.33, h * 0.66])
        add(cylM(w / 2 + 0.5, w / 2 + 0.5, 1.4, 24).translate(0, y, 0), m, x, 0, z, a, 1, false);
      return;
    }
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      add(
        new THREE.BoxGeometry(1.1, h, 1.1).translate(u * (w / 2 + 0.3), h / 2, v * (d / 2 + 0.3)),
        m,
        x,
        0,
        z,
        a,
        1,
        false,
      );
    for (const y of rand() < 0.5 ? [h * 0.5] : [h * 0.3, h * 0.62])
      add(boxM(w + 1.2, 1.2, d + 1.2, 8).translate(0, y, 0), m, x, 0, z, a, 1, false);
  };
  const tower = (x, z, a, h, w, d) => {
    const m = pick(towerMs),
      kind = rand();
    if (rand() < 0.75) ledEdges(x, z, a, kind < 0.25 ? h : kind < 0.6 ? h * 0.75 : h, w, d, kind < 0.25);
    if (kind < 0.25) {
      add(cylM(w / 2, w / 2, h, 24, 16), m, x, 0, z, a, 1, false);
      add(cylM(w / 2 + 0.3, w / 2 + 0.3, 1.2, 24).translate(0, h, 0), crownM, x, 0, z, a, 1, false);
    } else if (kind < 0.6) {
      // set back near the top
      add(boxM(w, h * 0.75, d, 16), m, x, 0, z, a, 1, false);
      add(boxM(w * 0.7, h * 0.25, d * 0.7, 16).translate(0, h * 0.75, 0), m, x, 0, z, a, 1, false);
      add(boxM(w * 0.72, 1.2, d * 0.72, 8).translate(0, h, 0), crownM, x, 0, z, a, 1, false);
    } else {
      add(boxM(w, h, d, 16), m, x, 0, z, a, 1, false);
      add(boxM(w + 0.4, 1.4, d + 0.4, 8).translate(0, h, 0), crownM, x, 0, z, a, 1, false);
    }
  };
  for (const f of fOf('cbd'))
    for (let s = f.s; s < f.s + f.len; s += 16)
      for (const sd of [1, -1]) {
        const off = rr(W / 2 + 22, W / 2 + 90),
          p = P(s + rr(-5, 5), sd * off),
          w = rr(22, 36),
          d = w * rr(0.7, 1),
          h = rr(70, 210);
        if (!free(p.x, p.z, w * 0.62, W / 2 + 6)) continue;
        reserve(p.x, p.z, w * 0.62);
        tower(p.x, p.z, head(s), h, w, d);
      }

  /* ---------- the Garden City: rain trees and palms down every road ---------- */
  const barkM = lam('#5e4a3a'),
    leafMs = ['#3f7d3a', '#4f8a40', '#356e33', '#5a9a44'].map(c => lam(c)),
    palmLeafM = lam('#4f8a3a');
  const rainTree = (x, z, sc) => {
    add(new THREE.CylinderGeometry(0.5 * sc, 0.8 * sc, 6 * sc, 6).translate(0, 3 * sc, 0), barkM, x, 0, z, 0, 1, false);
    add(
      new THREE.IcosahedronGeometry(5.5 * sc, 1).scale(1.4, 0.55, 1.4).translate(0, 7.5 * sc, 0),
      pick(leafMs),
      x,
      0,
      z,
      rand() * TAU,
      1,
      false,
    );
  };
  const palm = (x, z) => {
    const h = rr(8, 12);
    add(new THREE.CylinderGeometry(0.25, 0.4, h, 6).translate(0, h / 2, 0), barkM, x, 0, z, 0, 1, false);
    for (let j = 0; j < 7; j++)
      add(
        new THREE.ConeGeometry(0.6, 5, 3)
          .rotateZ(Math.PI / 2 + 0.5)
          .translate(2.2, h - 0.4, 0)
          .rotateY((j / 7) * TAU),
        palmLeafM,
        x,
        0,
        z,
        0,
        1,
        false,
      );
  };
  const garden = fOf('cloudforest').length > 0,
    airport = fOf('jewel').length > 0;
  for (let s = 0; s < tr.len; s += 14) {
    const i = tr.idx(s);
    if (tr.lowb[i] || tr.hall[i] || tr.elevated[i]) continue;
    for (const sd of [1, -1]) {
      const p = P(s + rr(-3, 3), sd * rr(W / 2 + 6, W / 2 + 10));
      if (!free(p.x, p.z, 3, W / 2 + 3)) continue;
      reserve(p.x, p.z, 3);
      if (rand() < 0.3) palm(p.x, p.z);
      else rainTree(p.x, p.z, rr(0.8, 1.2));
    }
  }

  /* ---------- the city behind: slab flats, condos, glass, shophouses near the road in the old quarters ---------- */
  const hdbT = facade((x, w, h) => {
    x.fillStyle = '#f3f1ea';
    x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      x.fillStyle = '#c9ccd2';
      x.fillRect(0, r * 32 + 22, w, 4); // the corridor ledges
      x.fillStyle = '#3b4656';
      for (let c = 0; c < 4; c++) x.fillRect(c * 32 + 6, r * 32 + 6, 20, 14);
    }
  });
  const hdbAccent = ['#e86a5a', '#4fa3d9', '#f2b33d', '#5ab47a', '#9b6ad9', '#f27aa0'].map(c => lam(c));
  const hdbM = glow(
    lam('#ffffff', { map: hdbT }),
    litTex(128, 128, grid(4, 4, 128, 128, 6, 9), 0.8, WARM, '#2a2620'),
    '#ffffff',
    1,
  );
  for (let n = 0; n < (garden ? 500 : airport ? 260 : 1400); n++) {
    const s = rand() * tr.len,
      i = tr.idx(s),
      sd = rand() < 0.5 ? 1 : -1,
      off = rr(60, 300),
      p = P(s, sd * (W / 2 + off));
    if (tr.elevated[i]) continue;
    const a = head(s) + (rand() < 0.2 ? rr(-0.5, 0.5) : 0),
      roll = rand();
    if (roll < (garden ? 0.55 : 0.22)) {
      // a rain tree in a park
      if (!free(p.x, p.z, 7, W / 2 + 8)) continue;
      reserve(p.x, p.z, 6);
      rainTree(p.x, p.z, rr(1, 1.6));
    } else if (roll < 0.5) {
      // a block of slab flats: long, tall, white, a stripe of colour up the stair core
      const w = rr(40, 60),
        d = 14,
        h = rr(36, 60);
      if (!free(p.x, p.z, w * 0.55, W / 2 + 20)) continue;
      reserve(p.x, p.z, w * 0.55);
      add(boxM(w, h, d, 16), hdbM, p.x, 0, p.z, a, 1, false);
      add(boxM(5, h + 2, d + 0.6, 8), pick(hdbAccent), p.x, 0, p.z, a, 1, false);
    } else if (roll < 0.72) {
      // a condo tower
      const w = rr(18, 26),
        h = rr(60, 120);
      if (!free(p.x, p.z, w * 0.6, W / 2 + 20)) continue;
      reserve(p.x, p.z, w * 0.6);
      tower(p.x, p.z, a, h, w, w);
    } else {
      const w = rr(26, 40),
        h = rr(90, 200);
      if (off < 120 || !free(p.x, p.z, w * 0.62, W / 2 + 30)) continue;
      reserve(p.x, p.z, w * 0.62);
      tower(p.x, p.z, a, h, w, w * rr(0.7, 1));
    }
  }

  // night: each glow comes up to its colour; the Supertrees, the canopies and the crowns run through their colours
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
    for (const c of colourCycle) c.mat.emissive.setHSL(c.hue, c.sat, 0.5).multiplyScalar(n * c.str);
  };
  k.update = t => {
    for (const a of animated) a(t);
    if (night)
      for (const c of colourCycle)
        c.mat.emissive.setHSL((c.hue + t * c.speed) % 1, c.sat, 0.5).multiplyScalar(night * c.str);
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
