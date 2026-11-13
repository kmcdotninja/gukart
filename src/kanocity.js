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
    place('THE RED FLYOVER', 'Over the chequered roundabout', tr.point(f.s + f.len / 2, 0), f.s + f.len / 2, {
      back: 40,
      h: 5,
      lookH: 6,
    });
  }
  // the roundabout under it, its island chequered black and white, a little white kiosk with a red roof on it
  for (const f of fOf('chequered')) {
    const fr = frame(f.s + 120, 1, W / 2 + 40),
      G = group(fr.x, fr.z, fr.a),
      chT = canvasTex(256, 256, (x, w, hh) => {
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 8; j++) {
            x.fillStyle = (i + j) % 2 ? '#111111' : '#f2f2f2';
            x.fillRect((i * w) / 8, (j * hh) / 8, w / 8, hh / 8);
          }
      });
    G.add(mesh(cy(16, 16, 0.5, 40), lam('#ffffff', { map: chT })));
    G.add(mesh(cy(4, 4.2, 3, 8), white, 0, 0.5, 0));
    G.add(mesh(new THREE.ConeGeometry(5, 2.4, 8).translate(0, 4.7, 0), lam('#c62828')));
    reserve(fr.x, fr.z, 18);
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
    const sm = f.s + f.len / 2,
      i = tr.idx(sm),
      o = tr.point(sm, 0),
      G = group(o.x, o.z, head(sm)),
      deckY = tr.P[i].y;
    // the roundabout at street level under the flyover: a ring of road, and the cross road passing under
    const ringM = lam('#3a3a3e');
    G.add(mesh(new THREE.RingGeometry(26, 40, 48).rotateX(-Math.PI / 2).translate(0, 0.08, 0), ringM));
    G.add(mesh(new THREE.PlaneGeometry(200, 18).rotateX(-Math.PI / 2).translate(0, 0.07, 0), ringM));
    G.add(mesh(cy(25.5, 25.8, 0.4, 48), lam('#e9e6df')));
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
    const brickM = lam('#ffffff', { map: brickT, emissive: '#2a1408', emissiveMap: brickT }),
      TH = deckY + 16,
      towers = [];
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const tx = sx * (W / 2 + 7),
        tz = sz * 16,
        tw = mesh(new THREE.BoxGeometry(5, TH, 5).translate(0, TH / 2, 0), brickM, tx, 0, tz);
      tw.rotation.y = Math.PI / 4 + (sx * sz > 0 ? 0 : Math.PI / 2);
      G.add(tw);
      G.add(mesh(new THREE.ConeGeometry(2.2, 2.4, 3).rotateY(0.3).translate(0, 1.2, 0), lam('#e9e3d6'), tx, TH, tz)); // the triangle emblem on top
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
      G.add(g);
    };
    truss(towers[0], towers[2], 'K  A  N  O');
    truss(towers[1], towers[3], 'MUHAMMADU BUHARI ROAD INTERCHANGE');
    // the flag, high over it all, on its own pole beside the roundabout
    G.add(mesh(cy(0.25, 0.35, 40, 8), steelM, W / 2 + 22, 0, -30));
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
    flag.position.set(W / 2 + 22, 37.5, -30);
    G.add(flag);
    h.animated.push(t => (flag.rotation.y = Math.sin(t * 1.3) * 0.25));
    for (const [x, z] of [
      [0, 0],
      [W / 2 + 22, -30],
    ]) {
      const w = new THREE.Vector3(x, 0, z)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), head(sm))
        .add(new THREE.Vector3(o.x, 0, o.z));
      reserve(w.x, w.z, x ? 4 : 44);
    }
    place('THE INTERCHANGE', 'Muhammadu Buhari: under the KANO X', tr.point(sm, 0), sm, { back: 45, h: 4, lookH: 14 });
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
    const cl = frame(f.s + f.len * 0.3, sd, W / 2 + 26),
      G = group(cl.x, cl.z, cl.a);
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
    place('KANO CLUB', 'The golf course on the Race Course', { x: cl.x, z: cl.z }, f.s + f.len * 0.3, {
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
