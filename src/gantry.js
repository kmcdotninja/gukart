// The start/finish gantry, after a Formula 1 grid's: a branded banner across the track, the start lights hung under it
// (five pods of two, facing the grid), the timing board (TIME and LAP), a position tower down one post, screens.
// Four builds, after real ones, and each circuit dresses one in its own colours and name (no real sponsors):
//  - 'board': a wide flat board on two slim posts, the timing board and the lights under it
//  - 'banner': one heavy lattice tower on one side, a slim post on the other, a long banner in panels between
//  - 'frame': a portal with rounded corners all round the track, a dark banner inside its top with chequered flags
//  - 'arch': a long dark LED banner hung under a shallow white steel arch, a big number at each end (Bahrain's), and a
//    clock tower standing on its own beside the grid
// And the pit straight round it (pitStraight): the pit building with its garages and a wing of a roof cantilevered
// over them, the pit wall in the circuit's colours, its name painted big on the run-off (Shanghai's).
// Built in its own frame: x across the road, z along it (the grid is at -z), y up; world.js sets it on the start line.
import * as THREE from 'three';
import { canvasTex, drawLogo } from './textures.js';

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

// the circuits' gantries: style, colours, and the words on the banner panels [text, background, ink]
export const GANTRIES = {
  'kano.old': { style: 'board', board: '#ff6a00', ink: '#0f1a42', text: 'KANO GRAND PRIX', frame: '#2a2f3a' },
  'kano.dala': {
    style: 'banner',
    panels: [
      ['DALA HILL', '#008751', '#ffffff'],
      ['GRAND PRIX OF KANO', '#ffffff', '#008751'],
      ['GUKART', '#008751', '#ffffff'],
    ],
    frame: '#d8dde3',
  },
  'kano.metro': {
    style: 'arch',
    frame: '#f2f2ee',
    banner: '#8a1f1f',
    ink: '#ffffff',
    text: 'KANO CITY GRAND PRIX',
    num: '1967',
  },
  'doha.msheireb': { style: 'frame', frame: '#7a1430', banner: '#141014', ink: '#d9b25a', text: 'MSHEIREB GRAND PRIX' },
  'doha.pearl': { style: 'board', board: '#f2efe8', ink: '#0e7c86', text: 'THE PEARL GRAND PRIX', frame: '#c9ced6' },
  'doha.lusail': {
    style: 'arch',
    frame: '#f2f2ee',
    banner: '#101216',
    ink: '#e8c46a',
    text: 'QATAR GRAND PRIX',
    num: '22',
  },
  // Kaduna: ABU's green, Murtala Square's flags, the old city's earth and gold
  'kaduna.abu': { style: 'board', board: '#1f7a3e', ink: '#ffffff', text: 'ABU ZARIA GRAND PRIX', frame: '#e9e3d6' },
  'kaduna.city': {
    style: 'banner',
    panels: [
      ['MURTALA SQUARE', '#1d3f8f', '#ffffff'],
      ['KADUNA GRAND PRIX', '#ffffff', '#008751'],
      ['GUKART', '#1d3f8f', '#ffffff'],
    ],
    frame: '#d8dde3',
  },
  'kaduna.zazzau': { style: 'frame', frame: '#b0714a', banner: '#1a1410', ink: '#e8c46a', text: 'ZAZZAU GRAND PRIX' },
  'singapore.marina': {
    style: 'frame',
    frame: '#e2231a',
    banner: '#0e0f14',
    ink: '#ffffff',
    text: 'MARINA BAY GRAND PRIX',
    crescent: true,
  },
  'singapore.gardens': {
    style: 'banner',
    panels: [
      ['THE GARDENS', '#6a2c91', '#ffffff'],
      ['SINGAPORE GRAND PRIX', '#0f5c3a', '#ffffff'],
      ['GUKART', '#6a2c91', '#ffffff'],
    ],
    frame: '#e9ecf0',
  },
  'singapore.river': { style: 'board', board: '#f3ead6', ink: '#0d5b5b', text: 'RIVER GRAND PRIX', frame: '#3a4a4a' },
  'singapore.changi': {
    style: 'arch',
    frame: '#eef1f5',
    banner: '#0b1230',
    ink: '#9fe0ff',
    text: 'CHANGI GRAND PRIX',
    num: '1981',
  },
};

export function buildGantry(key, title, W) {
  const T = GANTRIES[key] || { style: 'board', board: '#ff6a00', ink: '#0f1a42', text: title, frame: '#2a2f3a' };
  const g = new THREE.Group(),
    glow = [],
    pods = [];
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  // a lit face: its own texture is its glow, so at night the words and colours shine (LED)
  const face = (tex, w, h, x, y, z, k = 0.85) => {
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    glow.push([m, k]);
    for (const [zz, ry] of [
      [z - 0.01, Math.PI],
      [z + 0.01, 0],
    ]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, y, zz + (ry ? -0.32 : 0.32));
      p.rotation.y = ry;
      g.add(p);
    }
    return m;
  };
  // words on a panel, sized to fit
  const words = (w, h, bg, ink, text, deco, room = 0.78) =>
    canvasTex(w, h, x => {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      deco?.(x, w, h);
      if (text === 'GUKART' && drawLogo(x, w / 2, h / 2, Math.min(h * 0.78, ((w * 0.8) / 627) * 237))) return; // (the logo, not the word)
      x.fillStyle = ink;
      let px = h * 0.62;
      x.font = `900 italic ${px}px ${FONT}`;
      while (x.measureText(text).width > w * room && px > 20) x.font = `900 italic ${(px -= 4)}px ${FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, w / 2, h / 2 + h * 0.03);
    });
  const flag = (x, cx, cy, s) => {
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) {
        x.fillStyle = (r + c) % 2 ? '#ffffff' : '#111111';
        x.save();
        x.translate(cx, cy);
        x.transform(1, 0.12 * Math.sin(c), 0, 1, 0, 0);
        x.fillRect(c * s - 3 * s, r * s - 2 * s + Math.sin(c * 0.9) * s * 0.3, s, s);
        x.restore();
      }
  };
  const crescent = (x, cx, cy, r) => {
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#e2231a';
    x.beginPath();
    x.arc(cx + r * 0.32, cy - r * 0.05, r * 0.84, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#ffffff';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5,
        sx = cx + r * 0.62 + Math.cos(a) * r * 0.42,
        sy = cy + Math.sin(a) * r * 0.42;
      x.beginPath();
      for (let j = 0; j < 10; j++) {
        const b = -Math.PI / 2 + (j * Math.PI) / 5,
          rr = j % 2 ? r * 0.06 : r * 0.14;
        x.lineTo(sx + Math.cos(b) * rr, sy + Math.sin(b) * rr);
      }
      x.fill();
    }
  };
  const frameM = new THREE.MeshStandardMaterial({ color: T.frame, metalness: 0.4, roughness: 0.5 }),
    darkM = lam('#111318');
  const X = W / 2 + 5; // the posts stand this far out from the middle of the road
  let low; // the underside of the banner: the lights and the timing board hang below it

  if (T.style === 'board') {
    for (const sx of [-1, 1]) box(1, 13, 1, frameM, sx * X, 6.5, 0);
    box(X * 2 + 1.6, 4, 0.6, lam(T.board), 0, 11, 0);
    face(words(1536, 192, T.board, T.ink, T.text), X * 2 + 1.4, 3.8, 0, 11, 0);
    low = 9;
  } else if (T.style === 'banner') {
    // the lattice tower on one side (a box of uprights and braces), a plain post on the other
    const tx = -X - 1;
    for (const ux of [-1, 1]) for (const uz of [-1, 1]) box(0.35, 15, 0.35, frameM, tx + ux * 1.1, 7.5, uz * 1.1);
    for (let y = 1; y < 15; y += 2.2) {
      box(2.5, 0.2, 0.2, frameM, tx, y, 1.1);
      box(2.5, 0.2, 0.2, frameM, tx, y, -1.1);
      box(0.2, 0.2, 2.5, frameM, tx - 1.1, y + 1.1, 0);
      box(0.2, 0.2, 2.5, frameM, tx + 1.1, y + 1.1, 0);
    }
    box(0.9, 13, 0.9, frameM, X, 6.5, 0);
    // the banner: panels side by side, the middle one widest
    const widths = [0.24, 0.52, 0.24].map(f => f * (X * 2 + 2));
    // (laid out from +x: seen from the grid, +x is on the left, so the panels read left to right)
    let x0 = X + 1;
    T.panels.forEach(([text, bg, ink], k) => {
      const w = widths[k];
      box(w, 4.2, 0.6, lam(bg), x0 - w / 2, 11.6, 0);
      face(words(Math.round(w * 48), 192, bg, ink, text), w - 0.1, 4, x0 - w / 2, 11.6, 0);
      x0 -= w;
    });
    box(X * 2 + 2.4, 0.5, 0.8, frameM, -0.2, 9.3, 0);
    low = 9;
  } else if (T.style === 'arch') {
    // two truss posts, the LED banner between them, and over it a shallow arch of twin white tubes laced together
    const ax = X + 1.5;
    for (const sx of [-1, 1]) {
      for (const ux of [-0.6, 0.6]) for (const uz of [-0.6, 0.6]) box(0.25, 14, 0.25, frameM, sx * ax + ux, 7, uz);
      for (let y = 1; y < 14; y += 1.6)
        (box(1.45, 0.14, 0.14, frameM, sx * ax, y, 0.6), box(1.45, 0.14, 0.14, frameM, sx * ax, y + 0.8, -0.6));
    }
    const bw = ax * 2 - 1.2,
      bh = 3.6,
      by = 12;
    box(bw, bh, 0.6, lam(T.banner), 0, by, 0);
    face(
      words(
        1792,
        192,
        T.banner,
        T.ink,
        T.text,
        (x, w, h) => {
          x.fillStyle = T.ink;
          x.font = `900 italic ${h * 0.6}px ${FONT}`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(T.num || '', 150, h / 2 + 4);
          x.fillText(T.num || '', w - 150, h / 2 + 4);
          x.font = `700 ${h * 0.16}px ${FONT}`;
          for (const lx of [150, w - 150]) drawLogo(x, lx, h * 0.86, h * 0.2) || x.fillText('GUKART', lx, h * 0.86);
        },
        0.62,
      ),
      bw - 0.2,
      bh - 0.2,
      0,
      by,
      0,
    );
    const archPts = z => {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const u = k / 40,
          xx = -ax + u * ax * 2;
        pts.push(new THREE.Vector3(xx, by + bh / 2 + 0.2 + Math.sin(u * Math.PI) * 3.6, z));
      }
      return pts;
    };
    for (const z of [-0.6, 0.6])
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(z)), 60, 0.26, 8), frameM));
    const A = archPts(0);
    for (let k = 2; k < 40; k += 3) {
      const q = A[k];
      box(0.1, q.y - (by + bh / 2), 0.1, frameM, q.x, (q.y + by + bh / 2) / 2, 0); // the hangers
      box(0.1, 0.1, 1.2, frameM, q.x, q.y, 0); // the lacing between the tubes
    }
    // the clock tower beside the grid: a black post, a clock face and a screen
    const ct = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#0b0c10';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#111111';
      x.lineWidth = 8;
      x.beginPath();
      x.moveTo(w / 2, h / 2);
      x.lineTo(w / 2, h * 0.2);
      x.moveTo(w / 2, h / 2);
      x.lineTo(w * 0.72, h * 0.58);
      x.stroke();
    });
    const cx = X + 4,
      cz = -14;
    box(0.8, 7, 0.8, darkM, cx, 3.5, cz);
    box(2.6, 2.6, 1, darkM, cx, 8.2, cz);
    face(ct, 2.4, 2.4, cx, 8.2, cz, 0.8);
    low = by - bh / 2 - 0.2;
  } else {
    // the portal: one rounded frame round the track, the banner set in its top
    const ow = X + 1.4,
      oh = 13.5,
      r = 3,
      t = 1.4;
    const outer = new THREE.Shape();
    outer.moveTo(-ow, 0);
    outer.lineTo(-ow, oh - r);
    outer.quadraticCurveTo(-ow, oh, -ow + r, oh);
    outer.lineTo(ow - r, oh);
    outer.quadraticCurveTo(ow, oh, ow, oh - r);
    outer.lineTo(ow, 0);
    outer.lineTo(ow - t, 0);
    outer.lineTo(ow - t, oh - r);
    outer.quadraticCurveTo(ow - t, oh - t, ow - r, oh - t);
    outer.lineTo(-ow + r, oh - t);
    outer.quadraticCurveTo(-ow + t, oh - t, -ow + t, oh - r);
    outer.lineTo(-ow + t, 0);
    outer.closePath();
    const fg = new THREE.ExtrudeGeometry(outer, {
      depth: 1.6,
      bevelEnabled: true,
      bevelSize: 0.25,
      bevelThickness: 0.25,
      bevelSegments: 3,
    });
    fg.translate(0, 0, -0.8);
    const fr = new THREE.Mesh(fg, frameM);
    fr.castShadow = true;
    g.add(fr);
    const bw = (ow - t) * 2,
      bh = 3.8;
    box(bw, bh, 0.5, lam(T.banner), 0, oh - t - bh / 2 - 0.1, 0);
    face(
      words(
        1536,
        192,
        T.banner,
        T.ink,
        T.text,
        (x, w, h) => {
          flag(x, 120, h / 2, 22);
          flag(x, w - 120, h / 2, 22);
          if (T.crescent) crescent(x, 250, h / 2, 54);
        },
        T.crescent ? 0.58 : 0.7,
      ),
      bw - 0.2,
      bh - 0.2,
      0,
      oh - t - bh / 2 - 0.1,
      0,
    );
    low = oh - t - bh - 0.2;
  }

  // the timing board: black, TIME and LAP in white, a lit row of digits
  const timing = canvasTex(1024, 128, (x, w, h) => {
    x.fillStyle = '#0b0c10';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = `800 72px ${FONT}`;
    x.textBaseline = 'middle';
    x.fillText('TIME', 30, h / 2 + 3);
    x.fillText('LAP', w * 0.56, h / 2 + 3);
    x.fillStyle = '#ffcf3a';
    x.font = '700 64px "Courier New", monospace';
    x.fillText('1:24.567', 210, h / 2 + 4);
    x.fillText('1/3', w * 0.56 + 150, h / 2 + 4);
  });
  const tbw = X * 0.95;
  box(tbw, 1.5, 0.4, darkM, -X + tbw / 2 + 1, low - 0.9, 0);
  face(timing, tbw - 0.1, 1.4, -X + tbw / 2 + 1, low - 0.9, 0, 1);
  // a screen on the right, the start lights between
  box(3.6, 2.2, 0.3, darkM, X - 3.2, low - 1.3, 0);
  const scr = canvasTex(256, 160, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#1d4fa0');
    gr.addColorStop(1, '#0b1a3a');
    x.fillStyle = gr;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = `900 italic 52px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    drawLogo(x, w / 2, h / 2, h * 0.62) || x.fillText('GUKART', w / 2, h / 2);
  });
  face(scr, 3.4, 2, X - 3.2, low - 1.3, 0, 0.9);
  // the start lights: a black housing, five pods of two lamps facing the grid (-z)
  const lx = 2.2,
    ly = low - 1.4;
  box(9.4, 2.4, 0.7, darkM, lx, ly, -0.2);
  for (const sx of [-1, 1]) box(0.12, low - ly - 1.2, 0.12, darkM, lx + sx * 4, low - (low - ly - 1.2) / 2, -0.2);
  const lampG = new THREE.CircleGeometry(0.42, 24);
  for (let k = 0; k < 5; k++) {
    const pod = [];
    for (const yy of [0.5, -0.5]) {
      const m = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: '#3a0c10' }));
      m.position.set(lx + (k - 2) * 1.75, ly + yy, -0.6);
      m.rotation.y = Math.PI;
      g.add(m);
      pod.push(m);
    }
    pods.push(pod);
  }
  // the position tower down the post on the left, grid side: 1 to 10, lit
  const tower = canvasTex(96, 640, (x, w, h) => {
    x.fillStyle = '#0b0c10';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = `800 52px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let k = 0; k < 10; k++) x.fillText(String(k + 1), w / 2, 34 + k * 62);
  });
  box(1.4, 7, 0.4, darkM, -X + 1.4, low - 4, -0.9);
  face(tower, 1.3, 6.9, -X + 1.4, low - 4, -0.9, 0.9);
  return { group: g, pods, glow, wallX: X - 0.6 };
}

// The pit straight round the start (Shanghai's): on the outside, the pit building, a long row of garages with their
// doors up, a glass floor of hospitality above and a wing of a roof cantilevered out over the pit lane; along both
// sides the pit wall wrapped in the circuit's colours with its name; and the name painted big on the run-off.
// Laid along the road from s = -L0 to +L1 wherever it's straight enough; at(s, lat) gives a point beside the road.
export function pitStraight(key, title, W, tr, add) {
  const T = GANTRIES[key] || {},
    bg = T.board || T.banner || (T.panels && T.panels[1][1]) || '#0f1a42',
    ink = T.ink || (T.panels && T.panels[1][2]) || '#ffffff',
    name = (T.text || title || 'GUKART').replace(' GRAND PRIX', '');
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  // (the circuit's name and the Gukart logo in turn along the wall)
  const wallT = canvasTex(2048, 128, (x, w, h) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = ink;
    x.font = `900 italic 92px ${FONT}`;
    x.textBaseline = 'middle';
    for (let k = 0; k < 4; k++)
      if (k % 2) drawLogo(x, k * 512 + 200, h / 2, h * 0.86) || x.fillText('GUKART', 40 + k * 512, h / 2 + 4);
      else x.fillText(name, 40 + k * 512, h / 2 + 4);
  });
  wallT.wrapS = THREE.RepeatWrapping;
  const wallM = new THREE.MeshLambertMaterial({
    map: wallT,
    emissive: '#ffffff',
    emissiveMap: wallT,
    emissiveIntensity: 0,
  });
  const glow = [[wallM, 0.5]];
  // the pit wall, both sides, just beyond the kerb
  for (const sd of [-1, 1])
    for (let s = -150; s < 150; s += 8) {
      const i = tr.idx(tr.wrapS(s)),
        p = tr.beside(i, sd * (W / 2 + 2.9)),
        a = Math.atan2(tr.T[i].x, tr.T[i].z);
      const g = new THREE.BoxGeometry(0.4, 1.1, 8.05);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.25 + ((s + 150) / 8) * 0.25);
      add(g.translate(0, 0.55, 0), wallM, p.x, 0, p.z, a);
    }
  // the name painted on the run-off either side of the grid
  const paintT = canvasTex(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = bg;
    x.globalAlpha = 0.9;
    x.fillRect(0, 0, w, h);
    x.globalAlpha = 1;
    x.fillStyle = ink;
    x.font = `900 italic 170px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(name, w / 2, h / 2 + 8);
  });
  const paintM = new THREE.MeshLambertMaterial({
    map: paintT,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  for (const sd of [-1, 1])
    for (const s of [-60, 40]) {
      const i = tr.idx(tr.wrapS(s)),
        p = tr.beside(i, sd * (W / 2 + 7)),
        a = Math.atan2(tr.T[i].x, tr.T[i].z);
      add(
        new THREE.PlaneGeometry(6, 24).rotateX(-Math.PI / 2).rotateY(sd > 0 ? 0 : Math.PI),
        paintM,
        p.x,
        0.12,
        p.z,
        a,
      );
    }
  // the pit building on the outside, where the road runs straight: garages, the glass floor, the wing roof
  const out = tr.out[0],
    pts = [];
  for (let s = -110; s <= 70; s += 10) pts.push(tr.beside(tr.idx(tr.wrapS(s)), out * (W / 2 + 26)));
  const A = pts[0],
    B = pts.at(-1),
    L = Math.hypot(B.x - A.x, B.z - A.z),
    dev = Math.max(...pts.map(q => Math.abs((B.x - A.x) * (A.z - q.z) - (A.x - q.x) * (B.z - A.z)) / L));
  if (dev > 4) return { glow, building: null };
  const garageT = canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = '#e9ecf0';
    x.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) {
      x.fillStyle = '#2a2f38';
      x.fillRect(k * 128 + 10, 30, 108, h - 30);
      x.fillStyle = bg;
      x.fillRect(k * 128 + 10, 10, 108, 16);
      x.fillStyle = '#ffffff';
      x.font = `800 20px ${FONT}`;
      x.fillText(String(k + 1), k * 128 + 14, 24);
      x.fillStyle = 'rgba(255,240,210,.35)';
      x.fillRect(k * 128 + 20, 50, 88, h - 50);
    }
  });
  garageT.wrapS = THREE.RepeatWrapping;
  const garageM = new THREE.MeshLambertMaterial({
    map: garageT,
    emissive: '#ffffff',
    emissiveMap: garageT,
    emissiveIntensity: 0,
  });
  glow.push([garageM, 0.6]);
  const glassM = new THREE.MeshPhongMaterial({
    color: '#4a6a8a',
    shininess: 110,
    specular: '#ffffff',
    emissive: '#ffe0b0',
    emissiveIntensity: 0,
  });
  glow.push([glassM, 0.5]);
  const roofM = lam('#f4f5f7');
  const G = new THREE.Group(),
    mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 },
    a = Math.atan2(B.x - A.x, B.z - A.z);
  G.position.set(mid.x, 0, mid.z);
  G.rotation.y = a;
  // (the building's local x points away from the road: its garage face looks back at it)
  const toRoad =
    new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).dot(new THREE.Vector3(-tr.L[0].x * out, 0, -tr.L[0].z * out)) > 0
      ? 1
      : -1;
  const body = new THREE.BoxGeometry(18, 6, L);
  const uv = body.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (L / 24));
  const m1 = new THREE.Mesh(body.translate(0, 3, 0), garageM);
  G.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(16, 4, L).translate(-toRoad * 1, 8, 0), glassM);
  G.add(m2);
  // the wing: a thin roof sweeping out over the pit lane towards the road, its tip turned up
  const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, L + 6).translate(toRoad * 6, 10.6, 0), roofM);
  G.add(wing);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, L + 6).translate(toRoad * 19, 11.2, 0), lam(bg));
  G.add(lip);
  G.traverse(o => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return { glow, building: G, mid, r: Math.max(L / 2, 20) };
}
