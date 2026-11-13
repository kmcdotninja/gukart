// Kano City, the metropolis (Kano's third circuit): its own landmarks, built on top of the modern Nigerian city that
// kaduna.js lays out (shops, billboards, keke napep, bungalows, towers). From photographs of each:
//  - the Golden Jubilee monument at the Government House roundabout: a tall maroon gate of two leaning slabs patterned in
//    green, a gold spike laid across its top, on a round stepped plinth ringed in green and white; across the road the
//    Government House gate (white, green trim), its long white wall banded in green, and Coronation Hall (white, red roof)
//  - the red Kwankwasiyya flyover: red pillars, its parapets white with a band of red Hausa diamonds, sweeping round over a
//    roundabout whose island is chequered black and white
//  - a fountain roundabout
//  - the Muhammadu Buhari Interchange: four brick clock towers round the flyover, Hausa pattern panels, I ❤ KANO, and two
//    steel trusses crossing over the road in an X, one spelling KANO, a tall flag over it all
//  - the Kano Club golf course on the Race Course (West Africa's oldest, 1903): fairways, greens and flags, bunkers,
//    trees, the white clubhouse
//  - the Ring Road roundabout
import * as THREE from 'three';
import { canvasTex, diamondBand, starKnot } from './textures.js';

const TAU = Math.PI * 2;
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

export function dressKanoCity(k, h) {
  const { scene, tr, W, rand, rr, reserve } = k;
  const { lam, bx, cy, frame, group, mesh, place, board, signBoth, fOf, P, head, inside, white, steelM, tryTree } = h;
  const MAROON = '#7a2420',
    KGREEN = '#1f7a3e';

  /* ---------- the Golden Jubilee monument and Government House ---------- */
  for (const f of fOf('govhouse')) {
    const sm = f.s + 40,
      fr = frame(sm, 1, W / 2 + 26),
      G = group(fr.x, fr.z, fr.a);
    // the plinth: round steps, a ring of green and white kerb stones
    for (let k2 = 0; k2 < 4; k2++)
      G.add(mesh(cy(13 - k2 * 2.2, 13 - k2 * 2.2, 0.5, 40), lam('#d8d2c6'), 0, k2 * 0.5, 0));
    const kerbT = canvasTex(256, 32, (x, w, hh) => {
      for (let i = 0; i < 16; i++) {
        x.fillStyle = i % 2 ? '#ffffff' : '#2a8a4a';
        x.fillRect((i * w) / 16, 0, w / 16 + 1, hh);
      }
    });
    kerbT.wrapS = THREE.RepeatWrapping;
    kerbT.repeat.set(6, 1);
    G.add(
      mesh(
        new THREE.CylinderGeometry(13.4, 13.4, 0.6, 48, 1, true).translate(0, 0.3, 0),
        lam('#ffffff', { map: kerbT, side: THREE.DoubleSide }),
      ),
    );
    // the gate: two tall slabs leaning a little apart, maroon, patterned in green
    const patT = canvasTex(256, 768, (x, w, hh) => {
      x.fillStyle = MAROON;
      x.fillRect(0, 0, w, hh);
      const pal = ['rgba(0,20,10,.35)', 'rgba(255,255,255,.25)', '#2f9a55'];
      for (let y = hh * 0.12; y < hh * 0.9; y += hh * 0.2) starKnot(x, w / 2, y, w * 0.3, pal);
      diamondBand(x, 0, w, hh * 0.05, hh * 0.025, pal);
    });
    const patM = lam('#ffffff', { map: patT });
    for (const sx of [-1, 1]) {
      const slab = mesh(new THREE.BoxGeometry(3.2, 18, 1.4).translate(0, 9, 0), [
        patM,
        patM,
        lam(MAROON),
        lam(MAROON),
        patM,
        patM,
      ]);
      slab.position.set(sx * 2.6, 2, 0);
      slab.rotation.z = -sx * 0.07;
      G.add(slab);
    }
    G.add(mesh(bx(9, 1.4, 2), lam(MAROON), 0, 19.2, 0)); // the lintel joining them
    // the gold spike laid across the top
    const spike = mesh(
      new THREE.ConeGeometry(0.45, 16, 8).rotateZ(Math.PI / 2),
      lam('#d9b25a', { emissive: '#3a2c0c' }),
      0,
      21,
      0,
    );
    spike.rotation.y = 0.5;
    spike.rotation.z = 0.25;
    G.add(spike);
    reserve(fr.x, fr.z, 16);
    place('GOLDEN JUBILEE', 'Round the monument at Government House', { x: fr.x, z: fr.z }, sm, {
      back: 50,
      lookH: 12,
    });
    // across the road: Government House's long white wall banded in green, its gate, Coronation Hall behind
    const go = frame(f.s + 70, -1, W / 2 + 18),
      G2 = group(go.x, go.z, go.a),
      wallT = canvasTex(256, 64, (x, w, hh) => {
        x.fillStyle = '#f4f2ec';
        x.fillRect(0, 0, w, hh);
        x.fillStyle = KGREEN;
        x.fillRect(0, hh * 0.78, w, hh * 0.22);
        x.fillRect(0, 0, w, hh * 0.08);
        for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 6, hh);
      });
    wallT.wrapS = THREE.RepeatWrapping;
    wallT.repeat.set(12, 1);
    const wallM = lam('#ffffff', { map: wallT });
    for (const z of [-45, 45]) G2.add(mesh(bx(0.6, 3.2, 70), wallM, 0, 0, z));
    // the gate: two white pillars and an arch over the drive, trimmed in green, a sentry box beside it
    for (const z of [-6, 6]) {
      G2.add(mesh(bx(1.6, 6.5, 1.6), white, 0, 0, z));
      G2.add(mesh(bx(1.9, 0.5, 1.9), lam(KGREEN), 0, 6.5, z));
    }
    const arch = new THREE.Shape();
    arch.moveTo(-6.8, 0);
    arch.lineTo(6.8, 0);
    arch.lineTo(6.8, 2.6);
    arch.lineTo(-6.8, 2.6);
    arch.lineTo(-6.8, 0);
    const ah = new THREE.Path();
    ah.moveTo(-5.2, 0);
    ah.quadraticCurveTo(0, 2.2, 5.2, 0);
    ah.lineTo(-5.2, 0);
    arch.holes.push(ah);
    const archM = mesh(
      new THREE.ExtrudeGeometry(arch, { depth: 1.2, bevelEnabled: false }).translate(0, 0, -0.6),
      white,
      0,
      4.6,
      0,
    );
    archM.rotation.y = Math.PI / 2;
    G2.add(archM);
    signBoth(
      G2,
      board('GOVERNMENT HOUSE KANO', 10, 0.9, '#ffffff', KGREEN, { italic: false }),
      10,
      0.9,
      0,
      7.3,
      0,
      Math.PI / 2,
      0.8,
    );
    G2.add(mesh(bx(0.7, 0.8, 11), lam(KGREEN), 0, 7.1, 0)); // the board it's on
    G2.add(mesh(bx(2.2, 2.6, 2.2), white, -go.rx * 3, 0, 9.5)); // the sentry box
    // Coronation Hall: white, a red roof, its name over the door
    const ch = new THREE.Group();
    ch.position.set(-go.rx * 34, 0, 40);
    ch.add(mesh(bx(22, 9, 36), white));
    ch.add(
      mesh(
        new THREE.ConeGeometry(1, 1, 4)
          .rotateY(Math.PI / 4)
          .scale(17, 4, 27)
          .translate(0, 11, 0),
        lam('#b5452f'),
      ),
    );
    signBoth(
      ch,
      board('CORONATION HALL', 12, 1.2, '#2a2a2a', '#f4f2ec', { italic: false }),
      12,
      1.2,
      go.rx * 11.05,
      6,
      0,
      (Math.PI / 2) * go.rx,
      0.02,
    );
    G2.add(ch);
    // Government House itself, deep in the grounds
    G2.add(mesh(bx(40, 10, 24), white, -go.rx * 70, 0, -10));
    G2.add(
      mesh(
        new THREE.ConeGeometry(1, 1, 4)
          .rotateY(Math.PI / 4)
          .scale(30, 4, 18)
          .translate(0, 12, 0),
        lam('#b5452f'),
        -go.rx * 70,
        0,
        -10,
      ),
    );
    for (const [x, z] of [
      [-go.rx * 50, -40],
      [-go.rx * 90, 30],
      [-go.rx * 30, -30],
    ]) {
      const w = new THREE.Vector3(x, 0, z)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), go.a)
        .add(new THREE.Vector3(go.x, 0, go.z));
      reserve(w.x, w.z, 30);
    }
    place('GOVERNMENT HOUSE', 'The gate and Coronation Hall', { x: go.x, z: go.z }, f.s + 70, { back: 40, lookH: 6 });
  }

  /* ---------- the red flyover: red pillars, white parapets with a band of red Hausa diamonds ---------- */
  const parT = canvasTex(512, 64, (x, w, hh) => {
    x.fillStyle = '#f6f4ef';
    x.fillRect(0, 0, w, hh);
    x.fillStyle = '#c62828';
    x.fillRect(0, hh * 0.18, w, hh * 0.06);
    x.fillRect(0, hh * 0.76, w, hh * 0.06);
    for (let i = 0; i < 16; i++) {
      const cx = (i + 0.5) * (w / 16);
      x.beginPath();
      x.moveTo(cx, hh * 0.28);
      x.lineTo(cx + w / 40, hh * 0.5);
      x.lineTo(cx, hh * 0.72);
      x.lineTo(cx - w / 40, hh * 0.5);
      x.fill();
    }
  });
  parT.wrapS = THREE.RepeatWrapping;
  const parM = lam('#ffffff', { map: parT, side: THREE.DoubleSide }),
    redM = lam('#c62828');
  for (const f of fOf('redflyover')) {
    const panels = [],
      pillars = [];
    for (let s = f.s; s < f.s + f.len; s += 3) {
      const i = tr.idx(s),
        y = tr.P[i].y;
      if (!tr.elevated[i] || y < 2) continue;
      const a = head(s);
      for (const sd of [-1, 1]) {
        const q = tr.beside(i, sd * (W / 2 + 1.1));
        panels.push(new THREE.PlaneGeometry(3.05, 1.5).rotateY(a + Math.PI / 2).translate(q.x, y + 0.2, q.z));
      }
      if (Math.round(s - f.s) % 15 === 0)
        for (const sd of [-1, 1]) {
          const q = tr.beside(i, sd * (W / 2 - 4));
          pillars.push(new THREE.BoxGeometry(2.4, y - 1.6, 2.4).translate(q.x, (y - 1.6) / 2, q.z));
        }
    }
    const pm = new THREE.Mesh(mergeAll(panels), parM);
    const uv = pm.geometry.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setX(v, uv.getX(v) * 0.35);
    scene.add(pm);
    const pl = new THREE.Mesh(mergeAll(pillars), redM);
    pl.castShadow = true;
    scene.add(pl);
    place('THE RED FLYOVER', 'Round the palm garden, Kofar Nassarawa', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 40,
      h: 5,
      lookH: 6,
    });
  }
  // the garden the loop sweeps round (as at the Kofar Nassarawa bridge): a round lawn ringed with palms, paths across it,
  // and in the middle a patterned monument, a white drum banded in blue and gold under a domed cap
  for (const f of fOf('chequered')) {
    const fr = frame(f.s + 120, 1, W / 2 + 40),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(cy(24, 24, 0.45, 48), lam('#6fae45')));
    G.add(mesh(cy(24.4, 24.6, 0.55, 48), lam('#e9e6df')));
    for (const ry of [0, Math.PI / 2])
      G.add(mesh(new THREE.BoxGeometry(46, 0.1, 2.2).translate(0, 0.47, 0).rotateY(ry), lam('#d8c7a6')));
    const monT = canvasTex(256, 256, (x, w, hh) => {
      x.fillStyle = '#f4f2ec';
      x.fillRect(0, 0, w, hh);
      for (const [y, c] of [
        [0.1, '#1d5fbf'],
        [0.42, '#d9b25a'],
        [0.74, '#1d5fbf'],
      ]) {
        x.fillStyle = c;
        x.fillRect(0, hh * y, w, hh * 0.12);
        x.fillStyle = '#f4f2ec';
        for (let i = 0; i < 8; i++) {
          x.beginPath();
          x.moveTo(i * 32 + 16, hh * (y + 0.01));
          x.lineTo(i * 32 + 26, hh * (y + 0.06));
          x.lineTo(i * 32 + 16, hh * (y + 0.11));
          x.lineTo(i * 32 + 6, hh * (y + 0.06));
          x.fill();
        }
      }
    });
    G.add(mesh(cy(4.2, 4.2, 1, 24), lam('#d8d2c6'), 0, 0.45, 0));
    G.add(mesh(cy(2.6, 3, 6, 24), lam('#ffffff', { map: monT }), 0, 1.45, 0));
    G.add(mesh(new THREE.SphereGeometry(2.7, 20, 12, 0, TAU, 0, Math.PI / 2), lam('#d9b25a'), 0, 7.45, 0));
    for (let k2 = 0; k2 < 12; k2++) {
      const a = (k2 / 12) * TAU,
        w = new THREE.Vector3(Math.cos(a) * 19, 0, Math.sin(a) * 19)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), fr.a)
          .add(new THREE.Vector3(fr.x, 0, fr.z));
      tryTree(w.x, w.z, 1, 'doum', 1.1, 0);
    }
    reserve(fr.x, fr.z, 26);
  }

  /* ---------- the fountain roundabout and the Ring Road roundabout ---------- */
  for (const f of fOf('fountain')) {
    const fr = frame(f.s + 20, 1, W / 2 + 24),
      G = group(fr.x, fr.z, fr.a),
      water = new THREE.MeshPhongMaterial({ color: '#4fa9c8', shininess: 90, specular: '#e6f6ff' });
    G.add(mesh(cy(11, 11.5, 0.9, 40), lam('#d8d2c6')));
    G.add(mesh(cy(10, 10, 1, 40), water));
    G.add(mesh(cy(1.2, 1.6, 4, 12), white));
    const jetM = new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.7 });
    const jets = [];
    for (let k2 = 0; k2 < 8; k2++) {
      const a = (k2 / 8) * TAU,
        j = mesh(new THREE.ConeGeometry(0.4, 3.5, 6).translate(0, 1.75, 0), jetM, Math.cos(a) * 6, 1, Math.sin(a) * 6);
      jets.push(j);
      G.add(j);
    }
    G.add(mesh(new THREE.ConeGeometry(0.6, 6, 8).translate(0, 3, 0), jetM, 0, 4, 0));
    h.animated.push(t => jets.forEach((j, n) => (j.scale.y = 0.8 + 0.25 * Math.sin(t * 3 + n))));
    reserve(fr.x, fr.z, 13);
    place('THE FOUNTAIN', 'Round the roundabout', { x: fr.x, z: fr.z }, f.s + 20, { back: 40, lookH: 4 });
  }
  for (const f of fOf('ringroad')) {
    const fr = frame(f.s + 30, 1, W / 2 + 26),
      G = group(fr.x, fr.z, fr.a);
    G.add(mesh(cy(14, 14.4, 0.6, 40), lam('#7fa64f')));
    G.add(mesh(cy(14.6, 14.8, 0.7, 40), lam('#e9e6df')));
    for (let k2 = 0; k2 < 5; k2++) {
      const a = (k2 / 5) * TAU;
      tryTree(fr.x + Math.cos(a) * 8, fr.z + Math.sin(a) * 8, 1, 'doum', 1, 0);
    }
    G.add(mesh(bx(0.3, 3, 0.3), steelM, 0, 0.6, -10));
    signBoth(
      G,
      board('RING ROAD', 5, 1.1, '#ffffff', '#00703c', { italic: false, border: '#ffffff' }),
      5,
      1.1,
      0,
      2.6,
      -10,
      0,
      0.1,
    );
    reserve(fr.x, fr.z, 16);
  }

  /* ---------- the Muhammadu Buhari Interchange ---------- */
  for (const f of fOf('buhari')) {
    // the island the road circles: the middle of the spiral's points (it climbs right round it, 360 degrees)
    const [o0, oL] = f.spiral || [0, f.len];
    let cxs = 0,
      czs = 0,
      cn = 0;
    for (let s = f.s + o0; s < f.s + o0 + oL; s += 4) {
      const q = tr.point(s, 0);
      cxs += q.x;
      czs += q.z;
      cn++;
    }
    const o = new THREE.Vector3(cxs / cn, 0, czs / cn),
      sm = f.s + o0 + oL / 2,
      G = group(o.x, o.z, head(f.s)),
      deckY = 11;
    // the island: paved, ringed in a white kerb, the cross road's underpass beneath shown by its two lit mouths
    G.add(mesh(cy(30, 30, 0.35, 48), lam('#cfc8bc')));
    G.add(mesh(cy(30.4, 30.6, 0.6, 48), lam('#e9e6df')));
    // the four brick towers round the flyover: brick, a band of Hausa pattern, a clock on each face, KANO down one side
    const brickT = canvasTex(256, 1024, (x, w, hh) => {
      x.fillStyle = '#8a4a2e';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = 'rgba(40,15,5,.35)';
      for (let y = 0; y < hh; y += 12) x.fillRect(0, y, w, 2);
      for (let y = 0; y < hh; y += 24) for (let xx = (y / 24) % 2 ? 0 : 20; xx < w; xx += 40) x.fillRect(xx, y, 2, 12);
      // the pattern band
      x.fillStyle = '#c9a26a';
      x.fillRect(w * 0.08, hh * 0.42, w * 0.84, hh * 0.18);
      diamondBand(x, w * 0.1, w * 0.9, hh * 0.51, hh * 0.05, ['rgba(60,25,5,.4)', 'rgba(255,240,210,.4)', '#7a3a1c']);
      // the clock
      x.fillStyle = '#f2ead8';
      x.beginPath();
      x.arc(w / 2, hh * 0.2, w * 0.3, 0, TAU);
      x.fill();
      x.strokeStyle = '#2a1a10';
      x.lineWidth = 6;
      x.stroke();
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(w / 2, hh * 0.2);
      x.lineTo(w / 2, hh * 0.2 - w * 0.22);
      x.moveTo(w / 2, hh * 0.2);
      x.lineTo(w / 2 + w * 0.15, hh * 0.2 + w * 0.05);
      x.stroke();
      // KANO down the face, I ❤ above it
      x.fillStyle = '#ffffff';
      x.font = `700 ${w * 0.3}px ${FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      'KANO'.split('').forEach((c, n) => x.fillText(c, w / 2, hh * (0.66 + n * 0.08)));
      x.fillText('I ♥', w / 2, hh * 0.36);
    });
    // (they stand round the road where you go into the loop and, a lap of it later, cross back over it on the flyover:
    // the steel X spans the road, so you drive under it twice and see it across the circle all the way round. Set in
    // the island's middle they were always off to one side, out of view)
    // where the climbing loop crosses over the road below: the two points along the feature closest in plan with a
    // deck's height between them (found, not assumed: the loop's eased ends don't bring it back to where it started)
    let X = null;
    for (let s1 = f.s; s1 < f.s + f.len; s1 += 2)
      for (let s2 = s1 + 40; s2 < f.s + f.len; s2 += 2) {
        const p1 = tr.point(s1, 0),
          p2 = tr.point(s2, 0),
          dd = Math.hypot(p1.x - p2.x, p1.z - p2.z);
        if (Math.abs(p1.y - p2.y) > 6 && (!X || dd < X.dd)) X = { dd, s1, s2, p: p1 };
      }
    X ||= { s1: f.s + o0, s2: f.s + o0, p: tr.point(f.s + o0, 0) };
    const GE = group(X.p.x, X.p.z, 0),
      dir = s0 => {
        const t0 = tr.T[tr.idx(s0)],
          l = Math.hypot(t0.x, t0.z) || 1;
        return new THREE.Vector2(t0.x / l, t0.z / l);
      },
      dA = dir(X.s1),
      dB = dir(X.s2),
      roadsClear = (x, z) => {
        for (let s1 = f.s - 60; s1 < f.s + f.len + 60; s1 += 2) {
          const q = tr.point(s1, 0);
          if (Math.hypot(q.x - x, q.z - z) < W / 2 + 5) return false;
        }
        return true;
      };
    const brickM = lam('#ffffff', { map: brickT, emissive: '#2a1408', emissiveMap: brickT }),
      TH = deckY + 16,
      towers = [];
    // the four towers in the four angles between the crossing roads, each pushed out until it stands clear of both
    for (const [sa, sb] of [
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
    ]) {
      const v = dA.clone().multiplyScalar(sa).add(dB.clone().multiplyScalar(sb)).normalize();
      let r = 16;
      while (r < 60 && !roadsClear(X.p.x + v.x * r, X.p.z + v.y * r)) r += 1;
      const tx = v.x * r,
        tz = v.y * r,
        tw = mesh(new THREE.BoxGeometry(5, TH, 5).translate(0, TH / 2, 0), brickM, tx, 0, tz);
      tw.rotation.y = Math.atan2(v.x, v.y);
      GE.add(tw);
      GE.add(mesh(new THREE.ConeGeometry(2.2, 2.4, 3).rotateY(0.3).translate(0, 1.2, 0), lam('#e9e3d6'), tx, TH, tz)); // the triangle emblem on top
      towers.push(new THREE.Vector3(tx, TH - 1.5, tz));
    }
    // the two steel trusses crossing in an X between opposite towers, high over the deck, the words along their sides
    const truss = (a, b, words) => {
      const len = a.distanceTo(b),
        g = new THREE.Group(),
        steel = lam('#3a3e44');
      g.position.copy(a).add(b).multiplyScalar(0.5);
      g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      for (const y of [-1, 1])
        for (const z of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(len, 0.3, 0.3), steel, 0, y * 1.2, z * 1.2));
      for (let x = -len / 2; x < len / 2; x += 2.4)
        for (const z of [-1.2, 1.2]) {
          const d = mesh(new THREE.BoxGeometry(0.15, 3.4, 0.15), steel, x + 1.2, 0, z);
          d.rotation.z = 0.78;
          g.add(d);
        }
      const wordsM = new THREE.MeshBasicMaterial({
        map: canvasTex(2048, 160, (x, w, hh) => {
          x.fillStyle = '#1c1f24';
          x.fillRect(0, 0, w, hh);
          x.fillStyle = '#ffffff';
          x.font = `800 ${hh * 0.66}px ${FONT}`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(words, w / 2, hh * 0.54);
        }),
      });
      for (const z of [-1, 1]) {
        const p2 = new THREE.Mesh(new THREE.PlaneGeometry(len - 6, 1.9), wordsM);
        p2.position.set(0, 0, z * 1.25);
        if (z < 0) p2.rotation.y = Math.PI;
        g.add(p2);
      }
      GE.add(g);
    };
    truss(towers[0], towers[2], 'K  A  N  O');
    truss(towers[1], towers[3], 'MUHAMMADU BUHARI ROAD INTERCHANGE');
    GE.updateMatrixWorld(true);
    for (const t2 of towers) {
      const w = t2.clone().applyMatrix4(GE.matrixWorld);
      reserve(w.x, w.z, 5);
    }
    // the flag, high over it all, on its own pole beside the roundabout
    G.add(mesh(cy(0.25, 0.35, 40, 8), steelM, 0, 0, 22));
    const flagT = canvasTex(96, 64, (x, w, hh) => {
      x.fillStyle = '#008751';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = '#ffffff';
      x.fillRect(w / 3, 0, w / 3, hh);
    });
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 4).translate(3, 0, 0),
      new THREE.MeshLambertMaterial({ map: flagT, side: THREE.DoubleSide }),
    );
    flag.position.set(0, 37.5, 22);
    G.add(flag);
    h.animated.push(t => (flag.rotation.y = Math.sin(t * 1.3) * 0.25));
    reserve(o.x, o.z, 34);
    place('THE INTERCHANGE', 'Round the clock towers, 360 degrees', { x: o.x, z: o.z }, sm, {
      back: 60,
      h: 6,
      lookH: 14,
    });
  }

  /* ---------- Nassarawa GRA: walled compounds and modern villas along a leafy avenue ---------- */
  const villaWall = ['#f1ebdf', '#e4dccb', '#d9d6cf', '#efe6d2'].map(c => lam(c)),
    carCols = ['#f4f4f2', '#1c1c1e', '#8a8f96', '#7a1f1f', '#1f3f7a'].map(c => lam(c)),
    VL = ['#ffd49a', '#ffe6bd'];
  // the modern Nassarawa duplex, from photographs of new houses there: a two-storey box in beige, cream or white, thin
  // roof slabs overhanging it, a tall strip of dark grey cladding with vertical fins, tall narrow windows, a glass
  // balcony over the porch; the compound paved in grey interlocking stones behind a high wall and a dark laser-cut gate
  const paveT = canvasTex(128, 128, (x, w, hh) => {
    x.fillStyle = '#b9b6ae';
    x.fillRect(0, 0, w, hh);
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        x.fillStyle = (r + c) % 3 ? '#c8c5bd' : '#a9a69e';
        x.fillRect(c * 16 + 1, r * 16 + 1, 14, 14);
      }
  });
  paveT.wrapS = paveT.wrapT = THREE.RepeatWrapping;
  const gateT = canvasTex(128, 64, (x, w, hh) => {
    x.fillStyle = '#1e1f22';
    x.fillRect(0, 0, w, hh);
    x.fillStyle = '#c8a45a';
    for (let c = 0; c < 8; c++)
      for (let r = 0; r < 3; r++) {
        x.beginPath();
        x.arc(c * 16 + 8, r * 20 + 12, 4, 0, TAU);
        x.fill();
      }
  });
  const gateM = lam('#ffffff', { map: gateT }),
    cladM = lam('#3c3f44'),
    slabM = lam('#f6f4ef'),
    railGlass = new THREE.MeshPhongMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.45, shininess: 90 }),
    BODY = ['#dcc9a8', '#efe4cc', '#f4f3ef', '#e6d6b8'];
  const tallWin = canvasTex(128, 128, (x, w, hh) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, hh);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) {
        x.fillStyle = '#222a33';
        x.fillRect(c * 42 + 14, r * 64 + 10, 14, 44);
        x.fillStyle = 'rgba(255,255,255,.3)';
        x.fillRect(c * 42 + 14, r * 64 + 10, 3, 44);
      }
  });
  tallWin.wrapS = tallWin.wrapT = THREE.RepeatWrapping;
  const tallLit = canvasTex(128, 128, (x, w, hh) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, hh);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++)
        if (Math.random() < 0.55) {
          x.fillStyle = VL[(r + c) % 2];
          x.fillRect(c * 42 + 14, r * 64 + 10, 14, 44);
        }
  });
  tallLit.wrapS = tallLit.wrapT = THREE.RepeatWrapping;
  const bodyMs = BODY.map(c => {
    const m = lam(c, { map: tallWin, emissiveMap: tallLit, emissive: '#000000' });
    h.glow?.(m, null, '#ffffff', 0.9);
    return m;
  });
  // a box whose windows repeat every 4 m across and up a floor (3.6 m)
  const boxW = (w, hh, d) => {
    const g = new THREE.BoxGeometry(w, hh, d),
      uv = g.attributes.uv,
      n = g.attributes.normal;
    for (let v = 0; v < uv.count; v++) {
      if (Math.abs(n.getY(v)) > 0.5) {
        uv.setXY(v, 0.02, 0.02);
        continue;
      }
      const ax = Math.abs(n.getX(v)) > 0.5 ? d : w;
      uv.setXY(v, (uv.getX(v) * ax) / 4, (uv.getY(v) * hh) / 7.2);
    }
    return g.translate(0, hh / 2, 0);
  };
  const compound = (x, z, a, big) => {
    const G = group(x, z, a),
      pw = big ? 30 : 24,
      pd = big ? 32 : 26, // the plot, across and back from the road (its +z faces the road)
      wm = villaWall[(rand() * villaWall.length) | 0];
    // the paved compound, the wall round it, the gate in the road side
    paveT.repeat.set(pw / 4, pd / 4);
    G.add(
      mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2).translate(0, 0.22, 0), lam('#ffffff', { map: paveT })),
    );
    for (const [w2, d2, ox, oz] of [
      [0.4, pd, -pw / 2, 0],
      [0.4, pd, pw / 2, 0],
      [pw, 0.4, 0, -pd / 2],
    ])
      G.add(mesh(bx(w2, 3, d2), wm, ox, 0, oz));
    for (const sx of [-1, 1]) G.add(mesh(bx(pw / 2 - 3, 3, 0.4), wm, sx * (pw / 4 + 1.5), 0, pd / 2));
    for (const sx of [-1, 1]) G.add(mesh(bx(0.8, 3.4, 0.8), cladM, sx * 3.1, 0, pd / 2));
    G.add(mesh(new THREE.BoxGeometry(5.4, 2.8, 0.15).translate(0, 1.4, 0), gateM, 0, 0, pd / 2));
    // the house: a ground floor and an upper floor stepped a little, thin slabs over each, the cladding strip with fins
    const vw = big ? 16 : 13,
      vd = big ? 12 : 10,
      vz = -pd / 2 + vd / 2 + 3,
      bm = bodyMs[(rand() * bodyMs.length) | 0],
      step = rr(-1.5, 1.5);
    G.add(mesh(boxW(vw, 3.6, vd), bm, 0, 0, vz));
    G.add(mesh(boxW(vw - 2, 3.6, vd - 1), bm, step, 3.6, vz - 0.5));
    G.add(mesh(bx(vw + 2.4, 0.3, vd + 2), slabM, 0, 3.6, vz + 0.6)); // the slab between the floors, overhanging
    G.add(mesh(bx(vw + 1.6, 0.35, vd + 1.6), slabM, step, 7.2, vz)); // the roof slab
    const cx = (rand() < 0.5 ? -1 : 1) * (vw / 2 - 1.6);
    G.add(mesh(bx(2.4, 8.4, 0.5), cladM, cx, 0, vz + vd / 2 + 0.2)); // the cladding strip, up past the roof
    for (let f2 = -0.9; f2 <= 0.9; f2 += 0.45)
      G.add(mesh(bx(0.08, 6, 0.25), lam('#6a6e74'), cx + f2, 1.4, vz + vd / 2 + 0.55)); // its fins
    // the porch, the glass balcony over it
    G.add(mesh(bx(4.4, 0.3, 2.4), slabM, -cx * 0.5, 3.3, vz + vd / 2 + 1.2));
    G.add(
      mesh(new THREE.BoxGeometry(4.4, 1.1, 0.06).translate(0, 0.55, 0), railGlass, -cx * 0.5, 3.6, vz + vd / 2 + 2.35),
    );
    // a car on the paving
    const cm = carCols[(rand() * carCols.length) | 0],
      carX = rr(-pw / 2 + 4, pw / 2 - 4);
    G.add(mesh(bx(1.9, 0.9, 4.4), cm, carX, 0.35, pd / 2 - 6));
    G.add(mesh(bx(1.7, 0.6, 2.4), lam('#1f2c3a'), carX, 1.25, pd / 2 - 6.3));
    // a palm in the corner
    tryTree(
      ...new THREE.Vector3(pw / 2 - 2.5, 0, pd / 2 - 2.5)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), a)
        .add(new THREE.Vector3(x, 0, z))
        .toArray()
        .filter((_, i2) => i2 !== 1),
      1,
      'doum',
      1,
      0,
    );
    return G;
  };
  for (const f of fOf('gra')) {
    for (let s = f.s; s < f.s + f.len; s += 34)
      for (const sd of [1, -1]) {
        const off = W / 2 + rr(23, 26),
          i = tr.idx(s),
          p = tr.beside(i, sd * off),
          big = rand() < 0.4;
        if (!k.free(p.x, p.z, big ? 19 : 16, W / 2 + 4)) continue;
        reserve(p.x, p.z, big ? 22 : 19);
        // face the road: the plot's +z toward it
        const a = Math.atan2(tr.P[i].x - p.x, tr.P[i].z - p.z);
        compound(p.x, p.z, a, big);
        // a second row behind
        const q = tr.beside(i, sd * (off + 36));
        if (k.free(q.x, q.z, 17, W / 2 + 30)) {
          reserve(q.x, q.z, 20);
          compound(q.x, q.z, Math.atan2(tr.P[i].x - q.x, tr.P[i].z - q.z), rand() < 0.4);
        }
      }
    // the avenue's trees and palms, close to the kerb, the crowns over the pavement
    for (let s = f.s; s < f.s + f.len; s += 12)
      for (const sd of [1, -1]) {
        const p = P(s + rr(-2, 2), sd * (W / 2 + rr(7, 10)));
        tryTree(p.x, p.z, 1.5, rand() < 0.45 ? 'doum' : rand() < 0.5 ? 'mahogany' : 'neem', rr(1, 1.25), W / 2 + 4);
      }
    place('NASSARAWA GRA', 'The leafy avenue between the villas', tr.point(f.s + 60, 0), f.s + 60, {
      back: 30,
      h: 4,
      lookH: 5,
    });
  }

  /* ---------- Kano Railway Station: in through the old front, along the platform under the canopy, out ---------- */
  // From photographs of the station: the old front, cream, a row of round arches, NIGERIAN RAILWAY in raised letters
  // across it and KANO on a plaque on top, a balustrade along the roofline; behind it the platform under a long steel
  // canopy on Y-shaped columns, corrugated roofing, and a train standing at the platform: grey and cream coaches, the
  // locomotive in yellow and black. The road runs through the middle arch, along the platform's edge and out
  for (const f of fOf('railway')) {
    const L = f.len,
      mid = f.s + L / 2,
      o = tr.point(mid, 0),
      a = head(mid),
      G = group(o.x, o.z, a),
      sd = 1, // the tracks on this side (local +x)
      FRONT = -L / 2, // the station front across the way in
      CAN0 = FRONT + 30, // the canopy starts behind the concourse
      RH = 12.5; // the canopy's height over the road
    const cream = lam('#ece2c8'),
      creamD = lam('#d9cba8'),
      steel = lam('#5a6068'),
      roofM = lam('#9aa1a8', { side: THREE.DoubleSide }),
      platM = lam('#c9c2b3'),
      edgeM = lam('#f2c230');
    // the front: a wide cream block over the way in, a row of round arches (the middle one spans the road)
    const FW = W + 44,
      FH = 15,
      FD = 8;
    const front = new THREE.Shape();
    front.moveTo(-FW / 2, 0);
    front.lineTo(FW / 2, 0);
    front.lineTo(FW / 2, FH);
    front.lineTo(-FW / 2, FH);
    front.lineTo(-FW / 2, 0);
    const arch = (cx, hw, spring) => {
      const p2 = new THREE.Path();
      p2.moveTo(cx - hw, 0);
      p2.lineTo(cx - hw, spring);
      p2.absarc(cx, spring, hw, Math.PI, 0, true);
      p2.lineTo(cx + hw, 0);
      p2.lineTo(cx - hw, 0);
      return p2;
    };
    front.holes.push(arch(0, W / 2 + 1, 1.2)); // the road's arch (to 15.2: the plaque band sits over it)
    for (const sx of [-1, 1]) for (const k2 of [0, 1]) front.holes.push(arch(sx * (W / 2 + 6 + k2 * 8.5), 2.6, 4.4));
    const fm = mesh(
      new THREE.ExtrudeGeometry(front, { depth: FD, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -FD / 2),
      cream,
    );
    fm.rotation.y = Math.PI / 2; // (built across x, the road along z: turned so its face looks down the road)
    const FG = new THREE.Group();
    FG.position.set(0, 0, FRONT);
    FG.rotation.y = -Math.PI / 2;
    FG.add(fm);
    G.add(FG);
    // over it: the band with NIGERIAN RAILWAY, the balustrade, the KANO plaque in the middle
    G.add(mesh(bx(FW + 0.6, 2.4, FD + 0.6), creamD, 0, FH, FRONT));
    const nameT = canvasTex(2048, 160, (x, w, hh) => {
      x.fillStyle = '#d9cba8';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = '#4a3e2c';
      x.font = `700 ${hh * 0.66}px ${FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('NIGERIAN          RAILWAY', w / 2, hh * 0.55);
    });
    const nameM = new THREE.MeshLambertMaterial({ map: nameT });
    for (const ez of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(FW - 4, 2.1), nameM);
      pl.position.set(0, FH + 1.2, FRONT + ez * (FD / 2 + 0.31));
      if (ez < 0) pl.rotation.y = Math.PI;
      G.add(pl);
    }
    for (let x = -FW / 2 + 1; x <= FW / 2 - 1; x += 1.2)
      G.add(mesh(bx(0.35, 1.3, 0.35), creamD, x, FH + 2.4, FRONT - FD / 2 + 0.3));
    G.add(mesh(bx(FW, 0.3, 0.6), creamD, 0, FH + 3.7, FRONT - FD / 2 + 0.3));
    G.add(mesh(bx(8, 2, 1), creamD, 0, FH + 2.4, FRONT - FD / 2 + 0.5));
    signBoth(
      G,
      board('KANO', 6, 1.4, '#3a2f22', '#efe4cc', { italic: false }),
      6,
      1.4,
      0,
      FH + 2.7,
      FRONT - FD / 2 + 0.5,
      0,
      1,
    );
    // the concourse behind the front: a roofed hall over the road, booking windows down one side
    G.add(mesh(bx(FW, 0.6, CAN0 - FRONT - FD / 2), creamD, 0, RH + 1, (CAN0 + FRONT + FD / 2) / 2));
    for (const sx of [-1, 1])
      G.add(mesh(bx(0.6, RH + 1, CAN0 - FRONT - FD / 2), cream, sx * (FW / 2 - 0.3), 0, (CAN0 + FRONT + FD / 2) / 2));
    const booking = board('BOOKING OFFICE', 8, 1, '#ffffff', '#1f5a34', { italic: false });
    signBoth(G, booking, 8, 1, -(W / 2 + 6), 4, (CAN0 + FRONT) / 2, Math.PI / 2, 0.1);
    G.add(mesh(bx(0.1, 1, 8.2), lam('#1f5a34'), -(W / 2 + 6), 4, (CAN0 + FRONT) / 2));
    for (let z = FRONT + FD / 2 + 3; z < CAN0 - 2; z += 4) G.add(mesh(bx(0.4, 3, 0.4), creamD, -(W / 2 + 6), 0, z));
    // the platform beside the road, the tracks beyond it, and the canopy over road and platform on Y columns
    const PL0 = W / 2 + 1.5,
      PL1 = W / 2 + 9,
      TR = W / 2 + 12.5; // the track's middle
    for (const sd2 of [sd, -sd]) {
      G.add(mesh(bx(PL1 - PL0, 1, L - 30), platM, sd2 * ((PL0 + PL1) / 2), 0, (CAN0 + L / 2) / 2));
      G.add(mesh(bx(0.5, 1.02, L - 30), edgeM, sd2 * (PL1 - 0.25), 0, (CAN0 + L / 2) / 2));
      // the tracks: ballast, sleepers, two rails
      G.add(mesh(bx(4.6, 0.25, L + 80), lam('#6e6658'), sd2 * TR, 0, 0));
      for (let z = -L / 2 - 40; z < L / 2 + 40; z += 1)
        G.add(mesh(bx(2.8, 0.14, 0.3), lam('#4a3e30'), sd2 * TR, 0.25, z));
      for (const rx of [-0.72, 0.72]) G.add(mesh(bx(0.12, 0.16, L + 80), steelM, sd2 * TR + rx, 0.39, 0));
    }
    // the canopy: columns down the middle of the platform branching into a Y under the roof, and on the far side of
    // the road; corrugated roofing over both
    const colX = [sd * ((PL0 + PL1) / 2), -sd * ((PL0 + PL1) / 2)];
    for (let z = CAN0 + 4; z < L / 2 - 2; z += 10)
      for (const cx of colX) {
        G.add(mesh(cy(0.35, 0.4, RH - 3, 8), steel, cx, 1, z));
        for (const lean of [-1, 1]) {
          const arm = mesh(
            new THREE.BoxGeometry(0.3, 4.4, 0.3).translate(0, 2.2, 0),
            steel,
            cx,
            RH - 3 + (cx === colX[0] ? 1 : 0) - 0.3,
            z,
          );
          arm.rotation.z = lean * 0.75;
          G.add(arm);
        }
      }
    const roofT = canvasTex(128, 128, (x, w, hh) => {
      x.fillStyle = '#a7aeb5';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = 'rgba(0,0,0,.12)';
      for (let i = 0; i < w; i += 8) x.fillRect(i, 0, 3, hh);
    });
    roofT.wrapS = roofT.wrapT = THREE.RepeatWrapping;
    roofT.repeat.set(8, (L / 2 - CAN0) / 8);
    const span0 = -(TR + 4),
      span1 = TR + 4;
    G.add(
      mesh(
        new THREE.BoxGeometry(span1 - span0, 0.25, L / 2 - CAN0).translate(
          ((span0 + span1) / 2) * sd,
          RH + 0.5,
          (CAN0 + L / 2) / 2,
        ),
        lam('#ffffff', { map: roofT, side: THREE.DoubleSide, emissive: '#6a6e74', emissiveMap: roofT }),
      ),
    );
    void roofM;
    // the train at the platform: the locomotive in yellow and black, then grey-and-cream coaches with their windows
    const coachT = canvasTex(512, 128, (x, w, hh) => {
      x.fillStyle = '#c9ccd0';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = '#ece6d6';
      x.fillRect(0, hh * 0.2, w, hh * 0.4);
      x.fillStyle = '#2a3440';
      for (let i = 0; i < 10; i++) x.fillRect(20 + i * 48, hh * 0.26, 34, hh * 0.26);
      x.fillStyle = '#1f5a34';
      x.fillRect(0, hh * 0.68, w, hh * 0.08);
    });
    const coachM = lam('#ffffff', { map: coachT }),
      locoT = canvasTex(256, 128, (x, w, hh) => {
        x.fillStyle = '#f2a516';
        x.fillRect(0, 0, w, hh);
        x.fillStyle = '#1c1c1e';
        for (let i = -4; i < 12; i++) {
          x.beginPath();
          x.moveTo(i * 32, hh);
          x.lineTo(i * 32 + 16, hh);
          x.lineTo(i * 32 + 48, hh * 0.55);
          x.lineTo(i * 32 + 32, hh * 0.55);
          x.fill();
        }
        x.fillStyle = '#1c1c1e';
        x.fillRect(0, hh * 0.18, w, hh * 0.12);
      }),
      locoM = lam('#ffffff', { map: locoT });
    let z = L / 2 - 14;
    G.add(mesh(bx(3, 4.2, 18), locoM, sd * TR, 0.55, z));
    G.add(mesh(bx(2.6, 0.6, 16), lam('#2a2a2c'), sd * TR, 4.75, z));
    for (let c = 0; c < 8; c++) {
      z -= 22;
      if (z < CAN0 - 30) break;
      G.add(mesh(bx(3, 3.9, 20.5), coachM, sd * TR, 0.55, z));
      G.add(mesh(bx(2.8, 0.35, 20.5), lam('#8a9096'), sd * TR, 4.45, z));
    }
    // a second train across the platform: green and cream coaches, shorter
    const coach2T = canvasTex(512, 128, (x, w, hh) => {
      x.fillStyle = '#2f7a4a';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = '#ece6d6';
      x.fillRect(0, hh * 0.2, w, hh * 0.4);
      x.fillStyle = '#2a3440';
      for (let i = 0; i < 10; i++) x.fillRect(20 + i * 48, hh * 0.26, 34, hh * 0.26);
    });
    const coach2M = lam('#ffffff', { map: coach2T });
    let z2 = CAN0 + 16;
    G.add(mesh(bx(3, 4.2, 18), locoM, -sd * TR, 0.55, z2));
    for (let c = 0; c < 6; c++) {
      z2 += 22;
      if (z2 > L / 2 - 10) break;
      G.add(mesh(bx(3, 3.9, 20.5), coach2M, -sd * TR, 0.55, z2));
      G.add(mesh(bx(2.8, 0.35, 20.5), lam('#8a9096'), -sd * TR, 4.45, z2));
    }
    // people waiting on the platforms
    for (let n2 = 0; n2 < 18; n2++) {
      const pz = rr(CAN0 + 4, L / 2 - 6),
        px = (n2 % 2 ? sd : -sd) * rr(PL0 + 1.5, PL1 - 1.5),
        robe = lam(['#ffffff', '#1f3f9e', '#c8352e', '#1f8a4c', '#e0a42a', '#6a4a8a'][n2 % 6]);
      G.add(mesh(cy(0.28, 0.42, 1.5, 8), robe, px, 1, pz));
      G.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), lam('#5a3a26'), px, 2.72, pz));
    }
    for (let s2 = f.s - 20; s2 <= f.s + L + 20; s2 += 10) {
      const q = tr.point(s2, 0);
      reserve(q.x, q.z, W / 2 + 34);
    }
    place('KANO RAILWAY', 'Through the station, along the platform', tr.point(f.s + 70, 0), f.s + 70, {
      back: 40,
      h: 4,
      lookH: 5,
    });
  }

  /* ---------- the Kano Club golf course on the Race Course ---------- */
  for (const f of fOf('golf')) {
    const sd = -1, // (out away from the loop)
      fairM = lam('#5f9a3a'),
      greenM = lam('#7cc04f'),
      sandM = lam('#e8d6a6'),
      flagM = lam('#e53935', { side: THREE.DoubleSide }),
      roughM = lam('#4f8030');
    for (let s = f.s + 10; s < f.s + f.len - 10; s += 70) {
      const fr = frame(s + 35, sd, W / 2 + 85),
        G = group(fr.x, fr.z, fr.a);
      // a fairway running away from the road, its green at the far end with the flag, a bunker or two
      G.add(mesh(new THREE.PlaneGeometry(110, 64).rotateX(-Math.PI / 2).translate(0, 0.21, 0), roughM));
      const fw = mesh(
        new THREE.CircleGeometry(1, 32)
          .rotateX(-Math.PI / 2)
          .scale(42, 1, 14)
          .translate(0, 0.24, 0),
        fairM,
      );
      fw.rotation.y = Math.PI / 2 + rr(-0.3, 0.3);
      G.add(fw);
      const gx = -fr.rx * 40,
        gz = rr(-12, 12);
      G.add(mesh(new THREE.CircleGeometry(8, 32).rotateX(-Math.PI / 2).translate(gx, 0.27, gz), greenM));
      G.add(mesh(cy(0.05, 0.05, 2.6, 5), white, gx, 0.27, gz));
      G.add(mesh(new THREE.PlaneGeometry(1, 0.6).translate(0.5, 2.5, 0), flagM, gx, 0.27, gz));
      for (let b = 0; b < 2; b++)
        G.add(
          mesh(
            new THREE.CircleGeometry(1, 20)
              .rotateX(-Math.PI / 2)
              .scale(rr(3, 5), 1, rr(2, 3))
              .translate(gx + rr(-12, 12), 0.25, gz + rr(-10, 10)),
            sandM,
          ),
        );
      for (let t2 = 0; t2 < 4; t2++) {
        const q = P(s + rr(0, 70), sd * inside(s) * (W / 2 + rr(28, 110)));
        tryTree(q.x, q.z, 3, rand() < 0.5 ? 'mahogany' : 'neem', rr(0.9, 1.2), W / 2 + 20);
      }
      for (let z = -30; z <= 30; z += 20) {
        const w = new THREE.Vector3(0, 0, z)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), fr.a)
          .add(new THREE.Vector3(fr.x, 0, fr.z));
        reserve(w.x, w.z, 34);
      }
    }
    // the clubhouse: white, a green roof, a veranda on posts, its name
    // (somewhere clear of the sky bridge out over the course)
    let cl = null;
    for (const u of [0.1, 0.85, 0.3, 0.6]) {
      const c2 = frame(f.s + f.len * u, sd, W / 2 + 26);
      if (k.free(c2.x, c2.z, 17, W / 2 + 12)) {
        cl = c2;
        cl.u = u;
        break;
      }
    }
    if (!cl) continue;
    const G = group(cl.x, cl.z, cl.a);
    G.add(mesh(bx(14, 6, 28), white));
    G.add(
      mesh(
        new THREE.ConeGeometry(1, 1, 4)
          .rotateY(Math.PI / 4)
          .scale(12, 3, 22)
          .translate(0, 7.5, 0),
        lam(KGREEN),
      ),
    );
    G.add(mesh(bx(4, 0.3, 28), white, cl.rx * 9, 3.6, 0));
    for (let z = -12; z <= 12; z += 4) G.add(mesh(cy(0.15, 0.15, 3.6, 6), white, cl.rx * 10.6, 0, z));
    signBoth(
      G,
      board('KANO CLUB', 6, 1.2, '#ffffff', KGREEN, { italic: false }),
      6,
      1.2,
      cl.rx * 11.2,
      3.95,
      0,
      Math.PI / 2,
      0.2,
    );
    reserve(cl.x, cl.z, 18);
    place('KANO CLUB', 'The golf course on the Race Course', { x: cl.x, z: cl.z }, f.s + f.len * cl.u, {
      back: 40,
      lookH: 4,
    });
  }
}

function mergeAll(list) {
  const pos = [],
    nrm = [],
    uv = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
    uv.push(...g.attributes.uv.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
