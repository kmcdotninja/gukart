// Gidan Rumfa, the Emir's palace, driven through: on the Old City circuit the road turns off the last straight and runs
// 300 m straight through the palace, from its great gate to its back gate, then hairpins round and comes back past it.
// In order down the road:
//  - the great gate tower (Kofar Fada): palace red, yellow crenellations with horned corners, the tall pointed arch in
//    its toothed yellow frame, a balcony over it, a green plinth; the outer walls run off either side
//  - the durbar court: the walls stand back, and horsemen line both sides in their robes and turbans on caparisoned
//    horses, spears up, trumpeters with the long kakaki, the Emir's great umbrella
//  - the inner gate, smaller, the same arch
//  - the Emir's hall: the road runs through the throne room under its painted vaulted ceiling (crossing ribs, every
//    panel in Hausa patterns), lanterns hung from the ribs, the throne on its dais under an umbrella beside the road
//  - the garden court: palms, a long pool beside the road, fountains
//  - the back gate, and out
// In 2070 the reliefs glow gold, like the city gates. Walls stand at the road's edges (a 'hall' in track.js), so it's
// one long room you race through; nothing solid stands on the road.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, loopKnot, starKnot, diamondBand } from './textures.js';

const RED = '#b5524a',
  RED2 = '#9c4038',
  YEL = '#ecc96e',
  GRN = '#2a7d52',
  GOLD = ['rgba(90,50,10,.45)', 'rgba(255,250,228,.8)', '#f2b544'];

// the painted vault of the Emir's hall, after the reliefs in Gidan Rumfa: on a gold ground, a lattice of big diamonds,
// each framed in nested lines of dark blue, sky blue and olive gold, chevrons in its corners, and in its middle an
// orange square with a red cross-flower; between them smaller diamonds framed in pink, gold and green round a blue
// square, and in the gaps orange crescents and little blue meanders. Every line is raised (a shadow under it, a lit
// edge on it), as the real ones are modelled in plaster. The Dala tunnel's vault uses it too (dalahollow.js)
export function paintedVault() {
  const S = 512;
  const t = canvasTex(S, S, x => {
    const GOLD = '#e8b92e',
      OLIVE = '#9c8a2c',
      NAVY = '#1d2f8a',
      SKY = '#8fd6ea',
      RED = '#c8202e',
      ORANGE = '#f2a33a',
      GREEN = '#1f7a3e',
      PINK = '#f3d3df',
      SLATE = '#8fa3d6';
    x.fillStyle = GOLD;
    x.fillRect(0, 0, S, S);
    x.lineJoin = 'miter';
    // a raised line: its shadow, then the line, then a thin lit edge along it
    const raised = (path, col, lw) => {
      x.save();
      x.translate(2.2, 2.6);
      x.strokeStyle = 'rgba(60,40,0,.45)';
      x.lineWidth = lw;
      path();
      x.stroke();
      x.restore();
      x.strokeStyle = col;
      x.lineWidth = lw;
      path();
      x.stroke();
      x.save();
      x.translate(-0.8, -0.8);
      x.strokeStyle = 'rgba(255,255,240,.35)';
      x.lineWidth = Math.max(1, lw * 0.25);
      path();
      x.stroke();
      x.restore();
    };
    const diamond = (cx, cy, r) => () => {
      x.beginPath();
      x.moveTo(cx, cy - r);
      x.lineTo(cx + r, cy);
      x.lineTo(cx, cy + r);
      x.lineTo(cx - r, cy);
      x.closePath();
    };
    // every motif is drawn at its tile position and its wrapped copies, so the pattern repeats seamlessly
    const each = (cx, cy, fn) => {
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(cx + dx, cy + dy);
    };
    // The lattice: diamonds that tile the plane (half-diagonal 128, a centre every 128 px on the diagonals), the big
    // ones (A) on a square grid and the small ones' cells (B) in the gaps between them, sharing their frame lines, so
    // the frames run on unbroken
    const A = [
        [0, 0],
        [256, 0],
        [0, 256],
        [256, 256],
      ],
      B = [
        [128, 128],
        [384, 128],
        [128, 384],
        [384, 384],
      ];
    // B cells: a small framed diamond in the middle, crescents to either side of it, meanders above and below
    for (const [bx, by] of B)
      each(bx, by, (cx, cy) => {
        for (const sx of [-1, 1]) {
          x.fillStyle = ORANGE;
          x.beginPath();
          x.arc(cx + sx * 74, cy, 26, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? Math.PI / 2 : -Math.PI / 2, true);
          x.fill();
          x.fillStyle = SLATE;
          x.beginPath();
          x.arc(cx + sx * 80, cy, 15, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? Math.PI / 2 : -Math.PI / 2, true);
          x.fill();
        }
        for (const sy of [-1, 1])
          raised(
            () => {
              const my = cy + sy * 84;
              x.beginPath();
              x.moveTo(cx - 18, my - 8);
              x.lineTo(cx - 5, my - 8);
              x.lineTo(cx - 5, my + 5);
              x.lineTo(cx + 5, my + 5);
              x.moveTo(cx + 18, my + 8);
              x.lineTo(cx + 5, my + 8);
              x.lineTo(cx + 5, my - 5);
              x.lineTo(cx - 5, my - 5);
            },
            NAVY,
            5,
          );
        raised(diamond(cx, cy, 62), PINK, 9);
        raised(diamond(cx, cy, 50), OLIVE, 6);
        raised(diamond(cx, cy, 38), GREEN, 9);
        raised(diamond(cx, cy, 26), OLIVE, 5);
        x.fillStyle = SLATE;
        x.fillRect(cx - 12, cy - 12, 24, 24);
        raised(
          () => {
            x.beginPath();
            x.rect(cx - 12, cy - 12, 24, 24);
          },
          GREEN,
          4,
        );
      });
    // A cells: the big diamonds, nested frames to the cell's edge, chevrons in from the corners, the cross-flower
    for (const [ax, ay] of A)
      each(ax, ay, (cx, cy) => {
        raised(diamond(cx, cy, 126), NAVY, 9);
        raised(diamond(cx, cy, 113), SKY, 8);
        raised(diamond(cx, cy, 101), OLIVE, 6);
        raised(diamond(cx, cy, 90), SKY, 5);
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2,
            dx = Math.sin(a),
            dy = -Math.cos(a);
          for (const d of [70, 56]) {
            const px = cx + dx * d,
              py = cy + dy * d;
            raised(
              () => {
                x.beginPath();
                x.moveTo(px - dy * 13 + dx * 9, py + dx * 13 + dy * 9);
                x.lineTo(px, py);
                x.lineTo(px + dy * 13 + dx * 9, py - dx * 13 + dy * 9);
              },
              d === 70 ? SKY : OLIVE,
              5,
            );
          }
        }
        for (let k = 0; k < 4; k++) {
          x.save();
          x.translate(cx, cy);
          x.rotate((k * Math.PI) / 2);
          for (const [off, col] of [
            [2.5, 'rgba(60,20,0,.4)'],
            [0, RED],
          ]) {
            x.fillStyle = col;
            x.beginPath();
            x.moveTo(-12 + off, -13 + off);
            x.lineTo(12 + off, -13 + off);
            x.lineTo(26 + off, -46 + off);
            x.lineTo(9 + off, -39 + off);
            x.lineTo(0 + off, -48 + off);
            x.lineTo(-9 + off, -39 + off);
            x.lineTo(-26 + off, -46 + off);
            x.closePath();
            x.fill();
          }
          x.restore();
        }
        x.fillStyle = ORANGE;
        x.fillRect(cx - 13, cy - 13, 26, 26);
        raised(
          () => {
            x.beginPath();
            x.rect(cx - 13, cy - 13, 26, 26);
          },
          OLIVE,
          3,
        );
      });
    // a fleck of gold leaf here and there
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(255,240,180,${0.15 + Math.random() * 0.3})`;
      x.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildEmirDrive(scene, tr, f, W, reserve) {
  const L = f.len,
    p0 = tr.point(f.s, 0),
    t0 = tr.T[tr.idx(f.s + 2)],
    a = Math.atan2(t0.x, t0.z);
  const G = new THREE.Group();
  G.position.set(p0.x, p0.y, p0.z);
  G.rotation.y = a;
  scene.add(G);
  // keep the city clear of the compound
  for (let z = 0; z <= L; z += 20) {
    const q = tr.point(f.s + z, 0);
    reserve(q.x, q.z, 60);
  }
  // geometries gathered by material and merged at the end (a few draw calls for the whole palace)
  const bins = new Map();
  const put = (geo, mat, x = 0, y = 0, z = 0, ry = 0) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).rotateY(ry).translate(x, y, z);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv)
      g.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count * 2) | 0), 2),
      );
    (bins.get(mat) || bins.set(mat, []).get(mat)).push(g);
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);

  // the mud render: red, rough, rubbed darker low down
  const mudT = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = RED;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,30,20' : '255,210,180'},${0.04 + Math.random() * 0.07})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  });
  mudT.wrapS = mudT.wrapT = THREE.RepeatWrapping;
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const mud = lam('#ffffff', { map: mudT }),
    yel = lam(YEL),
    grn = lam(GRN),
    dark = lam('#2a1a14'),
    wood = lam('#6b4426'),
    white = lam('#f4f1ea');
  // walls get their texture tiled in metres
  const wallGeo = (w, h, d) => {
    const g = box(w, h, d),
      uv = g.attributes.uv,
      p = g.attributes.position,
      n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)) > 0.5;
      uv.setXY(i, (ax ? p.getZ(i) : p.getX(i)) / 8, p.getY(i) / 8);
    }
    return g;
  };
  // the gold relief panels (lit, 2070), each its own little drawing
  const glowMats = [];
  const relief = (w, h, draw) => {
    const PX = 48,
      t = canvasTex(Math.round(w * PX), Math.round(h * PX), (x, cw, ch) => draw(x, cw, ch, PX));
    const m = new THREE.MeshLambertMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      emissive: '#ffffff',
      emissiveMap: t,
    });
    glowMats.push(m);
    return m;
  };
  const panel = (m, w, h, x, y, z, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y + h / 2, z);
    p.rotation.y = ry;
    G.add(p);
  };

  const HW = W / 2 + 0.6; // the walls' inner face, at the road's edge
  /* ---------- a gate tower across the road: the tall pointed arch in its toothed yellow frame ---------- */
  const gateTower = (z, H, depth, wide, name) => {
    const aw = W / 2 + 0.6,
      spring = H * 0.42,
      apex = H * 0.72;
    const sh = new THREE.Shape();
    sh.moveTo(-wide / 2, 0);
    sh.lineTo(wide / 2, 0);
    sh.lineTo(wide / 2, H);
    sh.lineTo(-wide / 2, H);
    sh.lineTo(-wide / 2, 0);
    const hole = new THREE.Path();
    hole.moveTo(-aw, 0);
    hole.lineTo(-aw, spring);
    hole.quadraticCurveTo(-aw, apex - 2, 0, apex);
    hole.quadraticCurveTo(aw, apex - 2, aw, spring);
    hole.lineTo(aw, 0);
    hole.lineTo(-aw, 0);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 18 }).translate(
      0,
      0,
      z - depth / 2,
    );
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
    put(g, mud);
    // the yellow toothed frame round the arch, both faces
    const frame = new THREE.Shape(
      hole.getPoints(30).map(v => new THREE.Vector2(v.x * (1 + 2.2 / aw), v.y < 0.01 ? 0 : v.y + 2.2)),
    );
    frame.holes.push(hole);
    for (const e of [-1, 1])
      put(
        new THREE.ExtrudeGeometry(frame, { depth: 0.4, bevelEnabled: false }),
        yel,
        0,
        0,
        z + e * (depth / 2) + (e > 0 ? 0 : -0.4),
      );
    for (const e of [-1, 1])
      for (let k = -8; k <= 8; k++) {
        const t = (k + 8) / 16,
          pt = hole.getPointAt(Math.min(0.999, 0.02 + t * 0.96));
        if (pt.y < 1) continue;
        put(box(0.9, 0.9, 0.5), yel, pt.x * (1 + 2.6 / aw), pt.y + 2.3, z + e * (depth / 2 + 0.2));
      }
    // crenellations along the top, horns at the corners, a green plinth along the foot
    for (let x = -wide / 2 + 0.8; x <= wide / 2 - 0.8; x += 2.2) put(box(1.2, 1.4, depth * 0.9), yel, x, H, z);
    for (const sx of [-1, 1])
      for (const e of [-1, 1])
        put(
          new THREE.ConeGeometry(0.7, 4, 6).translate(0, 2, 0),
          yel,
          sx * (wide / 2 - 0.7),
          H + 1.2,
          z + e * (depth / 2 - 0.7),
        );
    for (const e of [-1, 1]) {
      put(box((wide - 2 * aw) / 2, 1.6, 0.3), grn, -(wide / 2 + aw) / 2, 0, z + e * (depth / 2 + 0.15));
      put(box((wide - 2 * aw) / 2, 1.6, 0.3), grn, (wide / 2 + aw) / 2, 0, z + e * (depth / 2 + 0.15));
    }
    // the balcony over the arch: a projecting box on beams, a little window
    for (const e of [-1, 1]) {
      put(box(8, 3.4, 1.8), mud, 0, apex + 3.6, z + e * (depth / 2 + 0.9));
      put(box(8.6, 0.4, 2.2), yel, 0, apex + 7, z + e * (depth / 2 + 1));
      put(box(3, 1.8, 0.2), dark, 0, apex + 4.4, z + e * (depth / 2 + 1.85));
      for (const bx of [-3, -1, 1, 3]) put(box(0.35, 0.35, 2.6), wood, bx, apex + 3.2, z + e * (depth / 2 + 1));
    }
    // stakes out of the faces
    for (const y of [spring * 0.5, H * 0.86])
      for (let x = -wide / 2 + 2; x <= wide / 2 - 2; x += 3.2) {
        if (Math.abs(x) < aw + 2.6 && y < apex + 3) continue;
        for (const e of [-1, 1])
          put(
            new THREE.CylinderGeometry(0.16, 0.16, 1.8, 5).rotateX(Math.PI / 2),
            wood,
            x,
            y,
            z + e * (depth / 2 + 0.8),
          );
      }
    // gold relief down both piers, both faces
    const rm = relief(3, H * 0.55, (x, w, h, k) => {
      starKnot(x, w / 2, 1.8 * k, 1.9 * k, GOLD);
      loopKnot(x, w / 2, 4.8 * k, 1.9 * k, GOLD);
      for (let y = 7.6; y < h / k - 1; y += 2.3) diamondBand(x, 0.1 * k, w - 0.1 * k, y * k, 0.9 * k, GOLD);
    });
    for (const sx of [-1, 1])
      for (const e of [-1, 1])
        panel(rm, 3, H * 0.55, sx * (aw + 3.4), 1.8, z + e * (depth / 2 + 0.05), e < 0 ? Math.PI : 0);
    // the name on a board over the arch
    if (name) {
      const nt = canvasTex(1024, 128, (x, w, h) => {
        x.fillStyle = YEL;
        x.fillRect(0, 0, w, h);
        x.fillStyle = RED2;
        x.font = `italic 800 ${h * 0.66}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(name, w / 2, h * 0.55);
      });
      const nm = lam('#ffffff', { map: nt });
      for (const e of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), nm);
        p.position.set(0, H - 2, z + e * (depth / 2 + 0.06));
        if (e < 0) p.rotation.y = Math.PI;
        G.add(p);
      }
    }
  };

  /* ---------- the walls along the road, stepping back round the courts ---------- */
  // [z0, z1, how far out the wall stands]: tight to the road through the gates and the hall, wide round the courts
  const runs = [
    [-6, 14, HW, 9],
    [14, 106, HW + 30, 8],
    [106, 124, HW, 9],
    [124, 206, HW + 9, 15],
    [206, 274, HW + 22, 7],
    [274, L, HW, 9],
  ];
  for (const [z0, z1, off, hgt] of runs)
    for (const sx of [-1, 1]) {
      put(wallGeo(1.6, hgt, z1 - z0), mud, sx * (off + 0.8), 0, (z0 + z1) / 2);
      for (let z = z0 + 1; z < z1 - 0.5; z += 2.4) put(box(1, 1, 1.4), yel, sx * (off + 0.8), hgt, z);
      put(box(0.5, 1.2, z1 - z0), grn, sx * (off + 0.05), 0, (z0 + z1) / 2);
      // framed windows and stakes along the face
      for (let z = z0 + 5; z < z1 - 4; z += 9) {
        put(box(0.2, 2.4, 2), dark, sx * (off + 0.02), hgt * 0.45, z);
        put(box(0.25, 3.2, 2.8), yel, sx * (off + 0.05), hgt * 0.45 - 0.4, z);
        put(
          new THREE.CylinderGeometry(0.15, 0.15, 1.6, 5).rotateZ(Math.PI / 2),
          wood,
          sx * (off - 0.4),
          hgt * 0.8,
          z + 4,
        );
      }
    }
  // the cross walls joining the steps (between runs of different depth)
  for (let i = 1; i < runs.length; i++) {
    const [z] = runs[i],
      o0 = runs[i - 1][2],
      o1 = runs[i][2],
      hgt = Math.max(runs[i - 1][3], runs[i][3]);
    if (o0 === o1) continue;
    for (const sx of [-1, 1]) put(wallGeo(Math.abs(o1 - o0) + 1.6, hgt, 1.6), mud, sx * ((o0 + o1) / 2 + 0.8), 0, z);
  }
  // the courts' floor: packed sand inside the walls, either side of the road
  for (const [z0, z1, off] of runs)
    if (off > HW + 1)
      for (const sx of [-1, 1])
        put(box(off - HW, 0.12, z1 - z0), lam('#e2c99a'), sx * ((off + HW) / 2), 0, (z0 + z1) / 2);

  /* ---------- the gates ---------- */
  gateTower(0, 26, 12, W + 30, 'GIDAN SARKI');
  gateTower(115, 19, 8, W + 14, null);
  gateTower(L - 8, 21, 10, W + 18, null);
  // corner towers on the compound, squat, horned
  for (const [z, off] of [
    [14, HW + 30],
    [106, HW + 30],
    [206, HW + 22],
    [274, HW + 22],
  ])
    for (const sx of [-1, 1]) {
      put(wallGeo(5, 12, 5), mud, sx * (off + 1.6), 0, z);
      for (const ex of [-1, 1])
        for (const ez of [-1, 1])
          put(new THREE.ConeGeometry(0.6, 3, 6).translate(0, 1.5, 0), yel, sx * (off + 1.6) + ex * 2, 12, z + ez * 2);
    }

  /* ---------- the durbar court: horsemen down both sides, trumpeters, the great umbrella ---------- */
  const ROBES = ['#ffffff', '#1f3f9e', '#c8352e', '#1f8a4c', '#e0a42a', '#6a2a8a', '#f2f2f2'],
    CAPS = ['#c8352e', '#1f3f9e', '#e0a42a', '#1f8a4c', '#ffffff'];
  const horseM = [lam('#5a3a26'), lam('#2a1f1a'), lam('#e8e0d0'), lam('#8a5a3a')],
    skin = lam('#5a3a26');
  const robeM = ROBES.map(c => lam(c)),
    capM = CAPS.map(c => lam(c));
  const rider = (x, z, ry, k) => {
    const hm = horseM[k % horseM.length],
      at = (gx, gy, gz) => [x + Math.cos(ry) * gx + Math.sin(ry) * gz, gy, z - Math.sin(ry) * gx + Math.cos(ry) * gz];
    // the horse: body, neck, head, legs, tail; its caparison over the back
    put(new THREE.CapsuleGeometry(0.75, 1.9, 4, 10).rotateX(Math.PI / 2), hm, ...at(0, 2.1, 0), ry);
    put(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 8).rotateX(-0.7), hm, ...at(0, 3.0, 1.35), ry);
    put(new THREE.BoxGeometry(0.42, 0.5, 1.1), hm, ...at(0, 3.55, 1.95), ry);
    for (const lx of [-0.42, 0.42])
      for (const lz of [-1, 1]) put(cyl(0.13, 0.11, 1.8, 6), hm, ...at(lx, 0, lz * 0.95), ry);
    put(new THREE.CylinderGeometry(0.06, 0.2, 1.3, 6).rotateX(0.5), hm, ...at(0, 2.0, -1.65), ry);
    put(new THREE.BoxGeometry(1.75, 1.0, 2.2), capM[k % capM.length], ...at(0, 2.2, -0.1), ry);
    // the rider: robe, turban, the spear held up
    put(new THREE.CylinderGeometry(0.32, 0.6, 1.6, 10), robeM[k % robeM.length], ...at(0, 3.4, -0.2), ry);
    put(new THREE.SphereGeometry(0.24, 10, 8), skin, ...at(0, 4.4, -0.15), ry);
    put(new THREE.SphereGeometry(0.34, 10, 8).scale(1, 0.8, 1), robeM[(k + 3) % robeM.length], ...at(0, 4.6, -0.2), ry);
    put(cyl(0.04, 0.04, 4.2, 5), wood, ...at(0.55, 2.6, 0.1), ry);
    put(new THREE.ConeGeometry(0.1, 0.5, 5).translate(0, 0.25, 0), white, ...at(0.55, 6.8, 0.1), ry);
  };
  let n = 0;
  for (const sx of [-1, 1])
    for (let z = 22; z <= 98; z += 7.5)
      for (const row of [0, 1]) rider(sx * (HW + 6 + row * 9), z + row * 3.5, sx < 0 ? Math.PI / 2 : -Math.PI / 2, n++);
  // the trumpeters at the inner gate, long kakaki raised; the Emir's great umbrella by the hall door
  for (const sx of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const x = sx * (HW + 3 + k * 2.2),
        z = 104;
      put(cyl(0.3, 0.45, 1.6, 8), robeM[k % robeM.length], x, 0, z);
      put(new THREE.SphereGeometry(0.24, 10, 8), skin, x, 1.85, z);
      put(new THREE.SphereGeometry(0.32, 10, 8).scale(1, 0.8, 1), white, x, 2.1, z);
      put(
        new THREE.CylinderGeometry(0.04, 0.12, 3.4, 6).rotateX(-1.1).translate(0, 0, 0),
        lam('#e6c26a'),
        x,
        2.6,
        z - 1.4,
      );
    }

  /* ---------- the Emir's hall: through the throne room under its painted vault ---------- */
  {
    const z0 = 124,
      z1 = 206,
      hl = z1 - z0,
      off = HW + 9,
      VH = 15,
      vault = paintedVault();
    vault.wrapS = vault.wrapT = THREE.RepeatWrapping;
    vault.repeat.set(3, hl / 12);
    // the vault: a half cylinder, squashed, painted inside, mud outside
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(off, off, hl, 32, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
      lam('#ffffff', { map: vault, side: THREE.BackSide }),
    );
    inner.scale.set(1, 0.45, 1);
    inner.position.set(0, VH - 6, (z0 + z1) / 2);
    G.add(inner);
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(off + 1.2, off + 1.2, hl, 32, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
      mud,
    );
    outer.scale.set(1, 0.45, 1);
    outer.position.copy(inner.position);
    outer.castShadow = true;
    G.add(outer);
    // the crossing ribs: arches over the hall, and the pillars they stand on beyond the road's edges
    for (let z = z0 + 6; z < z1 - 3; z += 10) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(off - 0.6, 0.55, 6, 32, Math.PI), lam('#7a3a26'));
      rib.scale.set(1, 0.45, 1);
      rib.position.set(0, VH - 6, z);
      G.add(rib);
      for (const sx of [-1, 1]) {
        put(cyl(0.9, 1.1, VH - 6, 10), mud, sx * (off - 1.2), 0, z);
        put(cyl(1.3, 1.3, 0.8, 10), yel, sx * (off - 1.2), VH - 6.8, z);
      }
    }
    // lanterns hung on chains from the vault's crown (2070: they glow)
    const lantM = new THREE.MeshLambertMaterial({ color: '#ffd28a', emissive: '#ffb050', emissiveIntensity: 0.9 });
    for (let z = z0 + 11; z < z1 - 4; z += 10) {
      const top = VH - 6 + off * 0.45 - 0.5;
      put(cyl(0.04, 0.04, 4, 4), dark, 0, top - 4, z);
      put(new THREE.SphereGeometry(0.7, 10, 8), lantM, 0, top - 4.5, z);
    }
    // the throne on its dais beside the road, under the umbrella; carpets along the floor either side
    const tz = (z0 + z1) / 2;
    put(box(6, 1.2, 8), lam('#c8352e'), -(HW + 4), 0, tz);
    put(box(2.4, 1.2, 1.8), lam('#e0a42a'), -(HW + 4.5), 1.2, tz);
    put(box(2.4, 2.6, 0.4), lam('#e0a42a'), -(HW + 5.6), 1.2, tz, Math.PI / 2);
    put(cyl(0.6, 0.9, 1.6, 10), white, -(HW + 4.5), 2.4, tz);
    put(new THREE.SphereGeometry(0.28, 10, 8), skin, -(HW + 4.5), 4.25, tz);
    put(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.85, 1), white, -(HW + 4.5), 4.5, tz);
    put(cyl(0.08, 0.08, 6, 6), wood, -(HW + 3), 1.2, tz);
    put(
      new THREE.ConeGeometry(3.2, 1.4, 16, 1, true).translate(0, 7.6, 0),
      lam('#c8352e', { side: THREE.DoubleSide }),
      -(HW + 3),
      0,
      tz,
    );
    for (const sx of [-1, 1]) put(box(4, 0.08, hl - 6), lam(sx < 0 ? '#7a1f2a' : '#1f3f6e'), sx * (HW + 2.2), 0, tz);
  }

  /* ---------- the garden court: palms, a long pool beside the road, fountains ---------- */
  {
    const z0 = 206,
      z1 = 274;
    const water = new THREE.MeshPhongMaterial({ color: '#2a9ac0', specular: '#ffffff', shininess: 90 });
    for (const sx of [-1, 1]) {
      put(box(8, 0.5, z1 - z0 - 10), lam('#efe2c6'), sx * (HW + 9), 0, (z0 + z1) / 2);
      put(box(6.6, 0.55, z1 - z0 - 12), water, sx * (HW + 9), 0, (z0 + z1) / 2);
      for (let z = z0 + 10; z < z1 - 6; z += 16) {
        put(cyl(0.25, 0.35, 2.2, 8), white, sx * (HW + 9), 0.5, z);
        put(new THREE.SphereGeometry(0.6, 10, 8), lam('#bfeaff'), sx * (HW + 9), 2.9, z);
      }
      for (let z = z0 + 4; z < z1 - 2; z += 9) {
        const px = sx * (HW + 17);
        put(cyl(0.3, 0.42, 9, 7), lam('#7a5a3a'), px, 0, z);
        for (let q = 0; q < 7; q++) {
          const ang = (q / 7) * Math.PI * 2;
          put(new THREE.BoxGeometry(0.3, 0.1, 3.4).translate(0, 0, 1.6).rotateX(-0.45), lam('#3f8a3a'), px, 9, z, ang);
        }
      }
    }
  }

  // build the merged meshes
  for (const [mat, geos] of bins) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = m.receiveShadow = true;
    G.add(m);
  }
  G.updateMatrixWorld(true);
  return {
    at: { x: tr.point(f.s + L / 2, 0).x, z: tr.point(f.s + L / 2, 0).z, a },
    night(nv) {
      for (const m of glowMats) m.emissiveIntensity = 0.2 + nv * 0.9;
    },
  };
}
