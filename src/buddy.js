// Buddy, the DeFleet robot, at the wheel of a chunky buggy. Same character as DeFleet's robot3d.js: a big rounded head in
// dense orange fur, a glossy black glass visor with glowing eyes, glossy ear cups, a small furry body with three dots.
// The fur is drawn as stacked shells (each one keeps only the strands that reach it), the same idea as the original,
// kept light enough for a phone.
import * as THREE from 'three';
import { clamp } from './util.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Robot, mesh, rbox, blob, cap, smin, smax } from './robot.js';

// the studio reflections every vehicle's paint and chrome shows (main.js makes it from a RoomEnvironment)
export const ENV = { tex: null };
function sdfGeo(f, lo, hi, s) {
  const { P, N, I } = mesh(f, lo, hi, s),
    g = new THREE.BufferGeometry();
  g.setIndex(I);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
// the beach buggy: one fibreglass shell. A rounded tub, fenders swept out over all four wheels (their arches cut round
// the tyres), a rounded nose, lamp pods moulded into the front fenders, the cockpit and the engine bay open
const buggyF = (x, y, z) => {
  let d = rbox(x, y - 0.64, z - 0.15, 0.95, 0.3, 1.95, 0.28); // the tub
  d = smin(d, blob(x, y - 0.86, z - 1.45, 0.8, 0.26, 0.75), 0.3); // the nose
  for (const sx of [-1, 1]) {
    d = smin(d, blob(x - sx * 1.22, y - 0.84, z - 1.5, 0.5, 0.42, 0.9), 0.4); // front fender, swept out of the tub
    d = smin(d, blob(x - sx * 1.22, y - 0.95, z + 1.5, 0.52, 0.55, 1.0), 0.4); // rear fender
    d = smin(d, blob(x - sx * 1.22, y - 0.98, z - 2.02, 0.19, 0.18, 0.2), 0.14); // the lamp pod
  }
  d = smax(d, -rbox(x, y - 1.3, z + 0.45, 0.76, 0.58, 0.9, 0.25), 0.1); // the cockpit (a thick rim all round)
  d = smax(d, -rbox(x, y - 1.2, z + 1.6, 0.62, 0.5, 0.45, 0.15), 0.08); // the engine bay
  for (const sx of [-1, 1]) {
    // the wheel arches
    d = smax(d, -cap(x, y, z, [sx * 1.07, 0.44, 1.5], [sx * 2.2, 0.44, 1.5], 0.68), 0.05); // from the tyre's inner face out, so the nose keeps its thickness
    d = smax(d, -cap(x, y, z, [sx * 1.07, 0.58, -1.5], [sx * 2.2, 0.58, -1.5], 0.82), 0.05);
  }
  return smax(d, -(y - 0.32), 0.05);
};
// the muscle car: long low body, a long hood with a power bulge, wide rear haunches, a short deck with a ducktail lip,
// the cockpit open (a convertible), arches cut for the wheels
const muscleF = (x, y, z) => {
  // the safari muscle car: one crisp, square-edged shell (the buggy is the round one). Slab sides with a sharp
  // beltline, a long flat hood with a raised centre, boxy flares squared over all four wheels, a squared-off tail,
  // the cockpit open (a convertible), the arches cut round the big tyres
  let d = rbox(x, y - 0.78, z, 1.0, 0.3, 2.6, 0.07);
  for (const sx of [-1, 1]) {
    d = smin(d, rbox(x - sx * 1.1, y - 0.9, z - 1.62, 0.2, 0.36, 0.92, 0.06), 0.06); // front box flare
    d = smin(d, rbox(x - sx * 1.12, y - 0.94, z + 1.62, 0.22, 0.38, 0.95, 0.06), 0.06); // rear box flare
    d = smin(d, rbox(x - sx * 1.03, y - 1.0, z, 0.06, 0.05, 2.45, 0.04), 0.03); // the beltline crease
  }
  d = smax(d, -rbox(x, y - 1.42, z + 0.5, 0.86, 0.4, 0.95, 0.12), 0.04); // the open cockpit
  for (const sx of [-1, 1]) {
    d = smax(d, -cap(x, y, z, [sx * 1.12, 0.36, 1.62], [sx * 2.3, 0.36, 1.62], 0.7), 0.04);
    d = smax(d, -cap(x, y, z, [sx * 1.12, 0.4, -1.62], [sx * 2.3, 0.4, -1.62], 0.74), 0.04);
  } // the arches start at the tyre's inner face, so the hood keeps its full thickness
  return smax(d, -(y - 0.4), 0.03);
};

// The three big off-roaders are each one sculpted shell too (the wheels stand outside it on their arms, uncovered).
// the raider: hard edges. A slab body, the hood falling to a nose drawn in at the corners, the sides leaning in above
// the beltline, a fin rising down each side of the engine bay to carry the wing, the belly swept up at both ends
const raiderF = (x, y, z) => {
  const ax = Math.abs(x);
  let d = rbox(x, y - 0.76, z, 1.1, 0.44, 2.72, 0.05);
  d = smax(d, y - (1.2 - Math.max(0, z - 0.85) * 0.2), 0.03); // the hood falls to the nose
  d = smax(d, ax - (1.1 - Math.max(0, z - 1.9) * 0.42), 0.03); // the nose's corners cut back
  d = smax(d, ax - (1.1 - Math.max(0, y - 0.95) * 0.4), 0.02); // the sides lean in over the beltline
  for (const sx of [-1, 1]) {
    const fin = rbox(x - sx * 0.86, y - 1.3, z + 1.9, 0.2, 0.36, 0.86, 0.04);
    d = smin(d, smax(fin, y - (1.3 + Math.max(0, -z - 1.0) * 0.26), 0.03), 0.04); // a fin, rising to the tail
  }
  d = smax(d, -rbox(x, y - 1.4, z + 0.4, 0.8, 0.52, 0.95, 0.06), 0.04); // the cockpit
  d = smax(d, -rbox(x, y - 1.4, z + 2.0, 0.6, 0.4, 0.6, 0.05), 0.04); // the engine bay
  d = smax(d, -(y - 0.32 - Math.max(0, z - 2.0) * 0.55), 0.03); // the belly sweeps up to the nose
  return smax(d, -(y - 0.32 - Math.max(0, -z - 2.1) * 0.5), 0.03); // and to the tail
};
// the roadster: all curves. A deep rounded tub, a long hood swelling up and running down to a pointed nose, a shoulder
// over each front wheel's inner side, full haunches behind, a rounded tail deck
const roadsterF = (x, y, z) => {
  let d = rbox(x, y - 0.74, z + 0.1, 1.02, 0.38, 2.5, 0.3);
  d = smin(d, blob(x, y - 0.88, z - 1.7, 0.92, 0.3, 1.35), 0.3); // the hood
  d = smin(d, blob(x, y - 0.74, z - 2.8, 0.56, 0.22, 0.5), 0.3); // the nose, to a point
  for (const sx of [-1, 1]) {
    d = smin(d, blob(x - sx * 0.92, y - 0.96, z - 1.75, 0.3, 0.26, 0.95), 0.25); // a shoulder along the hood
    d = smin(d, blob(x - sx * 0.95, y - 1.02, z + 1.75, 0.36, 0.36, 1.0), 0.3); // a haunch
  }
  d = smin(d, blob(x, y - 1.0, z + 1.95, 0.85, 0.3, 0.9), 0.3); // the tail deck
  d = smax(d, -rbox(x, y - 1.5, z + 0.4, 0.78, 0.62, 0.92, 0.25), 0.1); // the cockpit
  return smax(d, -(y - 0.36), 0.06);
};
// the brute: chubby and tall, a wedge of armour. A deep body widest at the cockpit, the hood falling away to a
// narrow nose, the tail drawn in a little, every top edge cut off at an angle, the flanks tucked in under a crease,
// the belly swept up at both ends
const bruteF = (x, y, z) => {
  const ax = Math.abs(x),
    top = 1.68 - clamp((z - 0.3) / 0.5, 0, 1) * 0.2 - Math.max(0, z - 0.8) * 0.3, // level over the cockpit and tail, then down the hood
    half = 1.2 - Math.max(0, z - 0.9) * 0.24 - Math.max(0, -z - 1.4) * 0.15; // widest at the cockpit
  let d = rbox(x, y - 1.0, z + 0.0, 1.2, 0.68, 2.36, 0.06);
  d = smax(d, y - top, 0.03);
  d = smax(d, ax - half, 0.03);
  d = smax(d, ax - (half - Math.max(0, y - (top - 0.25)) * 0.6), 0.02); // the top edges chamfered
  d = smax(d, ax - (half - Math.max(0, 0.75 - y) * 0.5), 0.02); // the flanks tuck in under the crease
  d = smax(d, -rbox(x, y - 1.75, z + 0.35, 0.88, 0.62, 0.9, 0.05), 0.03); // the cockpit
  d = smax(d, -(y - 0.32 - Math.max(0, z - 1.7) * 0.5), 0.02);
  return smax(d, -(y - 0.32 - Math.max(0, -z - 1.7) * 0.5), 0.02);
};

// the racers: Buddy (you) and five rivals. A rival's name is only its default: each race draws them fresh from NICKNAMES
// (a World Tour draws them once and keeps them for all its races: src/cup.js)
export const RACERS = [
  {
    id: 'buddy',
    name: 'Buddy',
    fur: '#8a5cff',
    ear: '#c79bff', // purple: he stands out against the orange of the logo and the UI
    kart: '#1d2a6b',
    trim: '#ffc22e',
    veh: 'kart',
  },
  { id: 'zaki', name: 'Crush', fur: '#e8336a', ear: '#ff7a9a', kart: '#f2c654', trim: '#1d2a6b', veh: 'monster' },
  { id: 'tauraro', name: 'Nova', fur: '#3a7bfd', ear: '#7cc4ff', kart: '#f6f0e4', trim: '#e8336a', veh: 'buggy' },
  { id: 'kibiya', name: 'Zippy', fur: '#2ec4b6', ear: '#9bf6ff', kart: '#ff6a00', trim: '#f6f0e4', veh: 'kart' },
  { id: 'gimbiya', name: 'Blaze', fur: '#ff6a00', ear: '#ff8a2a', kart: '#1f8a4c', trim: '#ffe066', veh: 'muscle' },
  { id: 'dodo', name: 'Bolt', fur: '#5c677d', ear: '#a3c4f3', kart: '#6fd3ff', trim: '#131517', veh: 'monster' },
];

// rivals' racing names, drawn at random for each race
export const NICKNAMES = [
  'Crush',
  'Nova',
  'Zippy',
  'Blaze',
  'Bolt',
  'Dash',
  'Viper',
  'Rocket',
  'Flash',
  'Jinx',
  'Razor',
  'Spark',
  'Comet',
  'Turbo',
  'Storm',
  'Ace',
  'Blitz',
  'Riot',
  'Zoom',
  'Fury',
  'Echo',
  'Pulse',
  'Havoc',
  'Rogue',
];
// five different names for the five rivals: { zaki: 'Viper', ... }
export function rivalNames() {
  const pool = [...NICKNAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(RACERS.filter(r => r.id !== 'buddy').map((r, i) => [r.id, pool[i]]));
}

export function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position,
    n = g.attributes.normal,
    v = new THREE.Vector3(),
    c = new THREE.Vector3(),
    nn = new THREE.Vector3();
  const ix = w / 2 - r,
    iy = h / 2 - r,
    iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -ix, ix), clamp(v.y, -iy, iy), clamp(v.z, -iz, iz));
    nn.subVectors(v, c);
    if (nn.lengthSq() < 1e-10) nn.fromBufferAttribute(n, i);
    nn.normalize();
    v.copy(c).addScaledVector(nn, r);
    p.setXYZ(i, v.x, v.y, v.z);
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}

export const SUN = new THREE.Vector3(-0.6, 0.55, 0.45).normalize(); // late afternoon: long shadows

// shapes every kart shares
let G = null;
function shared() {
  if (G) return G;
  G = {
    head: roundedBox(1.55, 1.25, 1.3, 0.5, 6),
    body: roundedBox(1.0, 0.85, 0.8, 0.34, 4),
    arm: roundedBox(0.34, 0.34, 0.82, 0.16, 3),
    visor: roundedBox(1.2, 0.74, 0.3, 0.16, 4),
    face: new THREE.PlaneGeometry(1.08, 0.66),
    ear: new THREE.CylinderGeometry(0.3, 0.3, 0.24, 24).rotateZ(Math.PI / 2),
    earIn: new THREE.CylinderGeometry(0.2, 0.2, 0.28, 20).rotateZ(Math.PI / 2),
    tray: roundedBox(2.3, 0.42, 3.6, 0.18, 3),
    nose: roundedBox(1.9, 0.62, 1.3, 0.28, 3),
    bumper: roundedBox(2.8, 0.3, 0.5, 0.14, 2),
    pod: roundedBox(0.55, 0.5, 1.8, 0.2, 2),
    engine: roundedBox(1.4, 0.8, 0.9, 0.18, 2),
    spoiler: roundedBox(2.6, 0.14, 0.7, 0.06, 2),
    strut: new THREE.BoxGeometry(0.12, 0.7, 0.12),
    cage: new THREE.TorusGeometry(0.95, 0.08, 8, 20, Math.PI),
    tireF: new THREE.CylinderGeometry(0.5, 0.5, 0.5, 20).rotateZ(Math.PI / 2),
    tireR: new THREE.CylinderGeometry(0.66, 0.66, 0.66, 20).rotateZ(Math.PI / 2),
    hub: new THREE.CylinderGeometry(0.26, 0.26, 0.7, 5).rotateZ(Math.PI / 2),
    pipe: new THREE.CylinderGeometry(0.18, 0.23, 1.1, 12).rotateX(Math.PI / 2),
    wheel: new THREE.TorusGeometry(0.3, 0.05, 8, 20),
    lamp: new THREE.CircleGeometry(0.2, 16),
    dot: new THREE.SphereGeometry(0.05, 8, 6),
    flame: new THREE.ConeGeometry(0.3, 1.4, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.7),
    plate: new THREE.PlaneGeometry(0.8, 0.4),
    decal: new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
  };
  G.tireMat = new THREE.MeshLambertMaterial({ color: '#23201d' });
  G.metal = new THREE.MeshPhongMaterial({ color: '#d9a441', shininess: 110, specular: '#ffe0a0' });
  G.dark = new THREE.MeshPhongMaterial({ color: '#2a2724', shininess: 30 });
  G.visorMat = new THREE.MeshPhongMaterial({ color: '#060606', shininess: 140, specular: '#9a9a9a' });
  G.lampMat = new THREE.MeshBasicMaterial({ color: '#fff7d6' });
  return G;
}

// what you can buy for your vehicle in the garage (coins)
export const PARTS = {
  // (part prices raised about tenfold 2026-11-14: they were pocket money next to a tour's winnings; only two paints
  // are free, and every car keeps its own factory paint for nothing, garage-screen.js isFactory)
  paint: [
    ['#d63a2f', 'Kano Red', 0],
    ['#2ec4b6', 'Lagoon', 0],
    ['#ffc22e', 'Harmattan', 2000],
    ['#1d2a6b', 'Indigo', 2000],
    ['#f4f1ea', 'Chalk', 2400],
    ['#16181d', 'Midnight', 2600],
    ['#1f8a4c', 'Naija Green', 2200],
    ['#8a5cff', 'Grape', 2800],
    ['#ff6a00', 'Buddy Orange', 3000],
    ['#c0c6d0', 'Chrome', 5000],
    ['#d4a12a', 'Gold', 50000], // (polished metal like Chrome, the dearest paint in the shop)
  ],
  rim: [
    ['classic', 'Classic', 0],
    ['mesh', 'Mesh', 2500],
    ['disc', 'Disc', 2500],
    ['turbo', 'Turbo', 5000],
    ['gold', 'Gold', 40000], // (solid polished gold, rim and spokes)
  ],
  tyre: [
    ['road', 'Road', 0],
    ['off', 'Off-road', 0],
    ['slick', 'Slick', 2500],
    ['white', 'Whitewall', 4000],
  ],
  decal: [
    ['none', 'None', 0],
    ['stripes', 'Racing Stripes', 0],
    ['speed', 'Speed Stripes', 2000],
    ['pinstripe', 'Pinstripe', 1500],
    ['flames', 'Flames', 3000],
    ['bolt', 'Lightning', 3000],
    ['tribal', 'Tribal', 4000],
    ['claw', 'Claw', 4000],
    ['camo', 'Camo', 4000],
    ['checker', 'Chequer Fade', 5000],
  ],
  plate: [
    ['kano', 'Kano', 0],
    ['doha', 'Doha', 0],
    ['kaduna', 'Kaduna', 0],
    ['lagos', 'Lagos', 2000],
    ['singapore', 'Singapore', 3000],
    ['dubai', 'Dubai', 4000],
    ['abudhabi', 'Abu Dhabi', 4000],
    ['gold', 'Gold', 10000],
    ['vip', 'Number 1', 25000],
  ],
  nitro: [
    ['#4fb0ff', 'Blue', 0],
    ['#ff7a1a', 'Fire', 2000],
    ['#b45cff', 'Violet', 3000],
    ['#3dff8a', 'Toxic', 3500],
    ['#ff3b6b', 'Ruby', 3500],
    ['#ffffff', 'White Hot', 6000],
  ],
};
// number plates: the Kano plate and its special editions. One drawing, painted twice: once in colour (the map) and once
// in white-on-grey (the bump), so the border, the badge and every letter stand up off the plate like a pressed tin plate
// Number plates, one for each place the tour goes, each after the real thing: Nigeria's (a flag shield, the state's name
// and motto), Qatar's (a maroon panel with a serrated edge), Abu Dhabi's (a red block with the category), Dubai's, and
// Singapore's (white on black). And the plates money buys in the Gulf: a single digit, and one in gold.
const plateCache = {};
const PLATES = {
  kano: {
    kind: 'ng',
    bg: ['#ffffff', '#eef6f0'],
    rim: '#1f8a4c',
    ink: '#13204f',
    head: 'KANO',
    num: 'GUK 001',
    foot: 'CENTRE OF COMMERCE',
  },
  kaduna: {
    kind: 'ng',
    bg: ['#ffffff', '#eef3fb'],
    rim: '#1f62c4',
    ink: '#13204f',
    head: 'KADUNA',
    num: 'GUK 001',
    foot: 'LIBERAL CENTRE OF LEARNING',
  },
  lagos: {
    kind: 'ng',
    bg: ['#ffffff', '#f1f8f3'],
    rim: '#008751',
    ink: '#0b3d24',
    head: 'LAGOS',
    num: 'GUK 001',
    foot: 'CENTRE OF EXCELLENCE',
  },
  doha: { kind: 'qa', bg: ['#ffffff', '#f3f1ee'], rim: '#2a2a2e', ink: '#17181c', num: '700001' },
  abudhabi: { kind: 'ad', bg: ['#ffffff', '#f2f2f0'], rim: '#2a2a2e', ink: '#17181c', num: '70001' },
  dubai: { kind: 'dxb', bg: ['#ffffff', '#f2f2f0'], rim: '#2a2a2e', ink: '#17181c', num: '7001' },
  singapore: { kind: 'sg', bg: ['#17181c', '#0c0d10'], rim: '#e9ecf1', ink: '#f4f6f8', num: 'SGK 1 G' },
  vip: { kind: 'vip', bg: ['#ffffff', '#ecebe6'], rim: '#b8902e', ink: '#17181c', num: '1', shine: true },
  gold: { kind: 'vip', bg: ['#fff1b0', '#d9a632', '#f6d978'], rim: '#7a4d06', ink: '#3a2400', num: '7', shine: true },
};
export function plateTex(style = 'kano') {
  if (plateCache[style]) return plateCache[style];
  const P = PLATES[style] || PLATES.kano, // (a plate that has left the shop falls back to Kano's)
    F = '"Barlow Condensed", "Arial Narrow", sans-serif',
    AR = '"Geeza Pro", "Noto Kufi Arabic", "Noto Naskh Arabic", Arial, sans-serif';
  const draw = (x, bump) => {
    const ink = c => (bump ? '#fff' : c),
      flat = c => (bump ? '#8a8a8a' : c); // a printed panel: level with the plate, not pressed
    const text = (s, px, py, size, col = P.ink, weight = 900, font = F) => {
      x.fillStyle = ink(col);
      x.font = `${weight} ${size}px ${font}`;
      x.fillText(s, px, py);
    };
    if (bump) {
      x.fillStyle = '#5a5a5a';
      x.fillRect(0, 0, 512, 256);
    } else {
      const g = x.createLinearGradient(0, 0, 0, 256);
      P.bg.forEach((c, i) => g.addColorStop(i / (P.bg.length - 1), c));
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 256);
    }
    x.save();
    x.beginPath();
    x.roundRect(16, 16, 480, 224, 18);
    x.clip();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (P.kind === 'ng') {
      // Nigeria: the green-white-green shield on the left, the state over the number, its motto along the foot
      if (!bump) {
        x.strokeStyle = 'rgba(31,138,76,.10)';
        x.lineWidth = 3; // the fine security waves printed under everything
        for (let k = -4; k < 22; k++) {
          x.beginPath();
          for (let i = 0; i <= 64; i++) x.lineTo(i * 8, k * 14 + Math.sin(i * 0.22 + k * 0.5) * 9 + i * 0.96);
          x.stroke();
        }
      }
      const bx = 36,
        by = 86,
        bw = 54,
        bh = 70,
        shield = () => {
          x.beginPath();
          x.moveTo(bx, by);
          x.lineTo(bx + bw, by);
          x.lineTo(bx + bw, by + bh * 0.62);
          x.quadraticCurveTo(bx + bw, by + bh, bx + bw / 2, by + bh);
          x.quadraticCurveTo(bx, by + bh, bx, by + bh * 0.62);
          x.closePath();
        };
      x.save();
      shield();
      x.clip();
      for (let k = 0; k < 3; k++) {
        x.fillStyle = flat(k === 1 ? '#ffffff' : '#008751');
        x.fillRect(bx + (k * bw) / 3, by, bw / 3 + 1, bh);
      }
      x.restore();
      x.strokeStyle = ink(P.rim);
      x.lineWidth = 4;
      shield();
      x.stroke();
      text(P.head, 284, 52, 42, P.rim, 800);
      text(P.num, 290, 136, 108);
      text(P.foot, 284, 212, 26, P.rim, 700);
    } else if (P.kind === 'qa') {
      // Qatar: a maroon panel down the left, its edge cut in nine points like the flag's, QATAR in white on it
      x.fillStyle = flat('#8a1538');
      x.beginPath();
      x.moveTo(16, 16);
      x.lineTo(118, 16);
      for (let k = 0; k < 9; k++) {
        x.lineTo(146, 16 + (k + 0.5) * (224 / 9));
        x.lineTo(118, 16 + (k + 1) * (224 / 9));
      }
      x.lineTo(16, 240);
      x.fill();
      text('قطر', 68, 84, 46, '#ffffff', 700, AR);
      text('QATAR', 68, 150, 30, '#ffffff', 800);
      text(P.num, 322, 134, 124);
    } else if (P.kind === 'ad') {
      // Abu Dhabi: a red block on the left carrying the category, the emirate's name over the number
      x.fillStyle = flat('#d0202e');
      x.fillRect(16, 16, 124, 224);
      text('1', 78, 132, 150, '#ffffff');
      text('أبوظبي', 240, 60, 40, P.ink, 700, AR);
      text('ABU DHABI', 400, 60, 30, P.ink, 800);
      text(P.num, 318, 156, 124);
    } else if (P.kind === 'dxb') {
      // Dubai: the code letter on the left, DUBAI in both scripts in the middle, the number on the right
      text('G', 76, 134, 132);
      text('دبي', 190, 96, 50, P.ink, 700, AR);
      text('DUBAI', 190, 168, 34, P.ink, 800);
      text(P.num, 368, 134, 132);
    } else if (P.kind === 'sg') {
      text(P.num, 256, 136, 132); // Singapore: white on black, nothing else
    } else {
      // the plate money buys: one digit, a great deal of empty plate round it, the falcon's colours down the side
      for (const [k, c] of ['#d0202e', '#1f8a4c', '#ffffff', '#17181c'].entries()) {
        x.fillStyle = flat(c);
        k ? x.fillRect(56, 16 + (k - 1) * 74.7, 40, 75) : x.fillRect(16, 16, 40, 224);
      }
      text(P.num, 300, 138, 196);
    }
    x.restore();
    x.strokeStyle = ink(P.rim);
    x.lineWidth = 10;
    x.beginPath();
    x.roundRect(16, 16, 480, 224, 18);
    x.stroke(); // the pressed rim
    if (P.shine && !bump) {
      const g = x.createLinearGradient(0, 0, 512, 256);
      g.addColorStop(0.3, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,255,255,.55)');
      g.addColorStop(0.55, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 256);
    }
  };
  const mk = bump => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    draw(c.getContext('2d'), bump);
    const t = new THREE.CanvasTexture(c);
    if (!bump) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(1 / 0.8, 1 / 0.4);
    t.offset.set(0.5, 0.5);
    return t;
  };
  const t = mk(false);
  t.userData.bump = mk(true);
  return (plateCache[style] = t);
}
// the plate itself: one pressed piece with a rolled edge, its face carrying the drawing
export function plateGeo() {
  const s = new THREE.Shape(),
    w = 0.4,
    h = 0.2,
    r = 0.04;
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 6,
  }).translate(0, 0, -0.004);
}
export const DECAL_INK = paint => {
  const c = new THREE.Color(paint),
    l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return l > 0.55 ? '#16181d' : '#f4f1ea';
};
// A decal drawn over the paint colour. Stripes run over the top of the car and camouflage covers all of it; the rest
// are side graphics, the kind cut from vinyl: drawn once along the car's flank, nose to the right (sideUV lays them on).
const decalTexCache = {};
export const ALLOVER = new Set(['stripes', 'camo']);
export function decalTex(paint, decal) {
  const key = paint + decal;
  if (decalTexCache[key]) return decalTexCache[key];
  const side = !ALLOVER.has(decal),
    c = document.createElement('canvas');
  c.width = side ? 1024 : 512;
  c.height = 512;
  const x = c.getContext('2d'),
    ink = DECAL_INK(paint),
    R = (a, b) => a + Math.random() * (b - a);
  x.fillStyle = paint;
  x.fillRect(0, 0, c.width, 512);
  x.fillStyle = x.strokeStyle = ink;
  const shape = pts => {
    x.beginPath();
    for (const [px, py] of pts) x.lineTo(px, py);
    x.closePath();
    x.fill();
  };
  // a blade: a sliver from (x0, y0) to a point at (x1, y1), bowed by `bow`, `w` thick at its root
  const blade = (x0, y0, x1, y1, bow, w) => {
    const mx = (x0 + x1) / 2,
      my = (y0 + y1) / 2;
    x.beginPath();
    x.moveTo(x0, y0 - w / 2);
    x.quadraticCurveTo(mx, my - bow - w * 0.3, x1, y1);
    x.quadraticCurveTo(mx, my - bow + w * 0.9, x0, y0 + w / 2);
    x.closePath();
    x.fill();
  };
  if (decal === 'stripes') {
    x.fillRect(196, 0, 44, 512);
    x.fillRect(272, 0, 44, 512);
  } else if (decal === 'camo') {
    for (let i = 0; i < 70; i++) {
      x.globalAlpha = 0.9;
      x.beginPath();
      x.ellipse(R(0, 512), R(0, 512), R(20, 60), R(12, 34), R(0, 3), 0, 7);
      x.fill();
    }
    x.globalAlpha = 1;
  } else if (decal === 'flames') {
    // flames licking back from the nose: long tongues, each curling as it thins
    for (const [y, len, amp] of [
      [150, 560, 1],
      [215, 820, -0.8],
      [280, 680, 1.1],
      [345, 900, -1],
      [405, 520, 0.9],
    ]) {
      const n = 990;
      x.beginPath();
      x.moveTo(n, y - 30);
      x.bezierCurveTo(n - len * 0.3, y - 30 - 46 * amp, n - len * 0.62, y + 44 * amp, n - len, y + 14 * amp);
      x.bezierCurveTo(n - len * 0.62, y + 44 * amp + 30, n - len * 0.3, y + 26 - 30 * amp, n, y + 30);
      x.closePath();
      x.fill();
    }
  } else if (decal === 'tribal') {
    // sweeping blades, low at the tail and rising to points at the nose, with barbs hooked back off them
    blade(60, 400, 980, 170, 60, 70);
    blade(140, 330, 900, 250, -40, 40);
    blade(220, 440, 820, 330, 30, 30);
    blade(520, 300, 330, 150, 20, 34);
    blade(700, 250, 560, 120, 16, 28);
    blade(380, 400, 180, 250, 22, 30);
  } else if (decal === 'bolt') {
    shape([
      [50, 340],
      [330, 250],
      [300, 310],
      [560, 220],
      [530, 285],
      [985, 150],
      [640, 330],
      [668, 268],
      [410, 372],
      [440, 306],
    ]);
  } else if (decal === 'speed') {
    // three stripes along the sill that kick up behind the front wheel and run on to the nose
    x.lineJoin = 'miter';
    for (const [dy, w] of [
      [0, 46],
      [50, 20],
      [82, 10],
    ]) {
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(30, 360 + dy);
      x.lineTo(430 + dy * 0.9, 360 + dy);
      x.lineTo(620 + dy * 0.9, 170 + dy);
      x.lineTo(990, 170 + dy);
      x.stroke();
    }
  } else if (decal === 'checker') {
    // a chequered flag breaking up: full squares at the nose, shrinking to dots towards the tail
    const s = 46;
    for (let i = 0; i * s < 1024; i++)
      for (let j = 2; j < 9; j++) {
        if ((i + j) % 2) continue;
        const k = Math.pow(Math.max(0, (i * s - 120) / 860), 1.6),
          q = s * Math.min(1, k * 1.15);
        if (q > 3) x.fillRect(i * s + (s - q) / 2, j * s + (s - q) / 2, q, q);
      }
  } else if (decal === 'pinstripe') {
    // two fine lines the length of the car, crossing once, ending in a spearhead at the nose
    x.lineWidth = 7;
    for (const s of [1, -1]) {
      x.beginPath();
      x.moveTo(40, 290 + s * 26);
      x.bezierCurveTo(330, 290 + s * 70, 600, 290 - s * 70, 900, 280);
      x.stroke();
    }
    shape([
      [880, 250],
      [990, 280],
      [880, 310],
      [915, 280],
    ]);
  } else if (decal === 'claw') {
    // three slashes raked across the door
    for (const k of [0, 1, 2])
      shape([
        [330 + k * 120, 420 - k * 6],
        [520 + k * 120, 120 + k * 10],
        [560 + k * 120, 110 + k * 10],
        [585 + k * 120, 150 + k * 10],
        [420 + k * 120, 430 - k * 6],
      ]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (!side) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (decalTexCache[key] = t);
}
// a side graphic laid on the body, in the car's own space: on the flanks it runs tail to nose and sill to shoulder, the
// same way round on both sides; over the hood and the deck it folds across from each edge towards the middle, so the
// two sides meet in a mirror down the centreline; the nose and the tail stay plain (each mesh gets its own copy of its shape)
function sideUV(meshes, chassis) {
  const v = new THREE.Vector3(),
    nrm = new THREE.Vector3(),
    bb = new THREE.Box3(),
    mats = meshes.map(o => {
      o.updateWorldMatrix(true, false);
      chassis.updateWorldMatrix(true, false);
      const m = new THREE.Matrix4().copy(chassis.matrixWorld).invert().multiply(o.matrixWorld),
        p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
      return m;
    });
  const hx = Math.max(Math.abs(bb.min.x), bb.max.x) || 1,
    L = bb.max.z - bb.min.z || 1,
    H = bb.max.y - bb.min.y || 1;
  meshes.forEach((o, k) => {
    const geo = (o.geometry = o.geometry.clone()),
      p = geo.attributes.position,
      n = geo.attributes.normal,
      uv = new Float32Array(p.count * 2),
      nm = new THREE.Matrix3().getNormalMatrix(mats[k]);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mats[k]);
      nrm.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      // a flank takes the drawing sill to shoulder; a face that looks up takes it folded over from its edge towards
      // the middle of the car; the nose and the tail stay plain (the drawing's empty top edge)
      const sideV = (v.y - bb.min.y) / H,
        topV = 1 - 0.75 * (1 - Math.min(1, Math.abs(v.x) / hx)),
        up = Math.min(1, Math.max(0, (nrm.y - 0.5) / 0.35)),
        end = Math.min(1, Math.max(0, (Math.abs(nrm.z) - 0.5) / 0.35));
      uv[i * 2] = 0.03 + 0.94 * ((v.z - bb.min.z) / L);
      uv[i * 2 + 1] = Math.min(0.995, sideV + (topV - sideV) * up + (0.995 - sideV) * end);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });
}
// box-projected UVs on a body part (top, side or front by its normal), so a decal wraps over the paint
function boxUV(geo, scale = 0.32) {
  if (geo.userData.boxUV) return;
  geo.userData.boxUV = true;
  const p = geo.attributes.position,
    n = geo.attributes.normal,
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    const [u, v] =
      ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale + 0.5;
    uv[i * 2 + 1] = v * scale + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// racing stripes: projected straight down from above in the car's own space, so they run unbroken over every panel,
// the nose and the tail, with no seams where a curved surface changes direction (each mesh gets its own copy)
function topUV(mesh, chassis, scale = 0.32) {
  const geo = (mesh.geometry = mesh.geometry.clone()),
    p = geo.attributes.position,
    uv = new Float32Array(p.count * 2),
    v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  chassis.updateWorldMatrix(true, false);
  const m = new THREE.Matrix4().copy(chassis.matrixWorld).invert().multiply(mesh.matrixWorld);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(m);
    uv[i * 2] = v.x * scale + 0.5;
    uv[i * 2 + 1] = v.z * scale + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
export const DEFAULT_CUSTOM = {
  kart: { paint: '#d63a2f', rim: 'classic', tyre: 'slick', decal: 'stripes', nitro: '#4fb0ff', plate: 'kano' },
  buggy: { paint: '#2ec4b6', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
  monster: { paint: '#ffc22e', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
  muscle: { paint: '#16181d', rim: 'classic', tyre: 'off', decal: 'stripes', nitro: '#4fb0ff', plate: 'kano' },
  rail: { paint: '#ffc400', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
  raider: { paint: '#12a596', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
  roadster: { paint: '#c8102e', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
  brute: { paint: '#ff6a00', rim: 'classic', tyre: 'off', decal: 'none', nitro: '#4fb0ff', plate: 'kano' },
};

// the vehicles: wheel sizes, ride height, how the body is built. Stats live in race.js
// (in the order the garage shows them: the lightest first, the heaviest last)
export const VEHICLES = {
  kart: {
    name: 'Kart',
    note: 'Light and quick in the corners',
    wf: 0.38,
    wr: 0.42,
    ww: 0.6,
    track: 1.24,
    base: 1.26,
    ride: 0,
    cam: 0,
    buddy: 1.3,
    seat: [0, 0.3, -0.32],
    wheel: [0, 0.98, 0.5],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
  },
  buggy: {
    name: 'Vintage', // (the beach buggy: still 'buggy' in the code and in saved games)
    note: 'A classic beach buggy: big tyres, happy off the road',
    wf: 0.56,
    wr: 0.7,
    ww: 0.62,
    track: 1.38,
    base: 1.5,
    ride: 0.12,
    cam: 0.4,
    buddy: 1.3,
    seat: [0, 0.55, -0.4],
    wheel: [0, 1.22, 0.42],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true,
  },
  rail: {
    name: 'Sand Rail',
    price: 2000, // coins to unlock it in the garage (the Kart and the Vintage are free; all doubled 2026-11-14: a tour won outright pays about 15,000)
    paint: '#ffc400',
    accent: '#9b3fd0',
    spring: '#ffc400',
    seatCol: ['#22242a', '#7a3fb0'],
    note: 'All frame and engine, paddle tyres behind',
    wf: 0.62,
    wr: 1.25,
    ww: 1.3,
    wwf: 0.42, // (skinny front tyres: ww is the rear pair's width, and the car's for walls and bumps)
    track: 2.0,
    base: 2.4,
    ride: 0.25,
    cam: 0.8,
    buddy: 1.3,
    seat: [0, 0.43, -0.5],
    wheel: [0, 1.07, 0.45],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    bodyScale: 1.25,
    wheelStyle: [5, 0.16, 'dark'], // [spokes, how wide, 'dark' for dark spokes inside a coloured ring]
  },
  muscle: {
    name: 'Muscle',
    price: 3000,
    note: 'Long hood, big engine, straight-line speed',
    wf: 0.66,
    wr: 0.7,
    ww: 0.7,
    track: 1.5,
    base: 1.62,
    ride: 0.3,
    cam: 0.5,
    buddy: 1.3,
    seat: [0, 0.5, -0.6],
    wheel: [0, 1.15, 0.2],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true,
  },
  monster: {
    name: 'Monster',
    price: 5000,
    note: 'Heavy, tall, shrugs off hits',
    wf: 1.28,
    wr: 1.28,
    ww: 1.35,
    track: 2.25,
    base: 1.8,
    ride: 1.6,
    cam: 1.3,
    buddy: 1.3,
    seat: [0, 0.72, -0.5],
    wheel: [0, 1.4, 0.34],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true,
  },
  raider: {
    name: 'Raider',
    price: 8000,
    paint: '#12a596',
    accent: '#a436c9',
    rim: '#a436c9',
    spring: '#a436c9',
    seatCol: ['#1d1f24', '#8e2fb0'],
    note: "Rally lamps, tall tyres and a shark's grin",
    wf: 1.15,
    wr: 1.15,
    ww: 1.05,
    track: 2.18,
    base: 1.9,
    ride: 0.85,
    cam: 1.3,
    buddy: 1.3,
    seat: [0, 1.06, -0.66],
    wheel: [0, 1.71, 0.3],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true,
    bodyScale: 1.2,
    wheelStyle: [7, 0.2],
  },
  roadster: {
    name: 'Roadster',
    price: 12000,
    paint: '#c8102e',
    accent: '#d81e2c',
    rim: '#c3c8cf',
    spring: '#e02030',
    seatCol: ['#1d1f24', '#2a2c33'],
    note: 'Low, smooth and loud: two rocket pipes',
    wf: 1.0,
    wr: 1.08,
    ww: 1.0,
    track: 2.22,
    base: 2.05,
    ride: 0.7,
    cam: 1.1,
    buddy: 1.3,
    seat: [0, 1.01, -0.63],
    wheel: [0, 1.66, 0.29],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true,
    bodyScale: 1.15,
    wheelStyle: [10, 0.1],
  },
  brute: {
    name: 'Brute',
    price: 16000,
    paint: '#ff6a00',
    accent: '#9b3fd0',
    spring: '#9b3fd0',
    seatCol: ['#1d1f24', '#3a3140'],
    note: 'Armour plate and square lamps: hard to push around',
    wf: 1.25,
    wr: 1.25,
    ww: 1.15,
    track: 2.05,
    base: 1.62,
    ride: 0.95,
    cam: 1.5,
    buddy: 1.3,
    seat: [0, 1.15, -0.5],
    wheel: [0, 1.8, 0.3],
    tilt: 0.45, // (the wheel's top leans away from the driver, its face up towards him, square to its column)
    wheelR: 0.27,
    balloon: true, // fat tyres on small rims, big lugs standing off the tread
    wheelStyle: [6, 0.26, 'dark'],
  },
};
// a real tyre: a turned profile (bead, bulging sidewall, rounded shoulder, flat tread band), round the axle (x)
const tyreGeo = {};
const tyre = (r, w) =>
  (tyreGeo[r + ':' + w] ||= (() => {
    const h = w / 2,
      pr = [
        [0.6, -h * 0.9],
        [0.72, -h * 1.02],
        [0.86, -h * 1.06],
        [0.95, -h * 0.98],
        [0.995, -h * 0.8],
        [1, -h * 0.55],
        [1, h * 0.55],
        [0.995, h * 0.8],
        [0.95, h * 0.98],
        [0.86, h * 1.06],
        [0.72, h * 1.02],
        [0.6, h * 0.9],
      ];
    return new THREE.LatheGeometry(
      pr.map(([a, b]) => new THREE.Vector2(a * r, b)),
      40,
    ).rotateZ(Math.PI / 2);
  })());
// a show wheel for the big off-roaders and the sand rail: a dark barrel, and on each face a deep ring in the wheel's
// colour with a circle of bolts (a beadlock), spokes in from it, and a centre cap. One merged shape per colour part.
const showWheelGeo = {};
const showWheel = (R, w, n, sw) =>
  (showWheelGeo[[R, w, n, sw]] ||= (() => {
    const ring = [],
      bolts = [],
      spokes = [],
      caps = [];
    for (const f of [-1, 1]) {
      const x = f * w * 0.47;
      ring.push(
        new THREE.TorusGeometry(R * 0.86, R * 0.13, 10, 32)
          .rotateY(Math.PI / 2)
          .scale(0.55, 1, 1)
          .translate(x, 0, 0),
      );
      for (let q = 0; q < 16; q++) {
        const a = (q / 16) * Math.PI * 2;
        bolts.push(
          new THREE.CylinderGeometry(R * 0.035, R * 0.035, R * 0.1, 6)
            .rotateZ(Math.PI / 2)
            .translate(x + f * R * 0.06, Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86),
        );
      }
      for (let q = 0; q < n; q++)
        spokes.push(
          new THREE.BoxGeometry(R * 0.1, R * 0.74, R * sw)
            .translate(x - f * R * 0.04, R * 0.42, 0)
            .rotateX((q / n) * Math.PI * 2),
        );
      caps.push(new THREE.CylinderGeometry(R * 0.2, R * 0.24, R * 0.16, 16).rotateZ(Math.PI / 2).translate(x, 0, 0));
    }
    return {
      barrel: new THREE.CylinderGeometry(R * 0.8, R * 0.8, w * 0.9, 24).rotateZ(Math.PI / 2),
      ring: mergeGeometries(ring),
      bolts: mergeGeometries(bolts),
      spokes: mergeGeometries(spokes),
      caps: mergeGeometries(caps),
    };
  })());
// a balloon tyre: a fat round carcass on a small bead, and three staggered rows of square lugs round the tread
const balloonGeo = {};
const balloonTyre = (r, w) =>
  (balloonGeo[r + ':' + w] ||= (() => {
    const h = w / 2,
      pr = [
        [0.62, -h * 0.84],
        [0.66, -h * 0.99],
        [0.76, -h * 1.1],
        [0.9, -h * 1.04],
        [0.97, -h * 0.8],
        [0.985, -h * 0.45],
        [0.985, h * 0.45],
        [0.97, h * 0.8],
        [0.9, h * 1.04],
        [0.76, h * 1.1],
        [0.66, h * 0.99],
        [0.62, h * 0.84],
      ],
      tyre = new THREE.LatheGeometry(
        pr.map(([a, b]) => new THREE.Vector2(a * r, b)),
        40,
      ).rotateZ(Math.PI / 2),
      lugs = [],
      n = 11;
    for (let row = -1; row <= 1; row++)
      for (let q = 0; q < n; q++) {
        const a = ((q + (row ? 0.5 : 0)) / n) * Math.PI * 2,
          edge = row !== 0;
        lugs.push(
          new THREE.BoxGeometry(w * (edge ? 0.3 : 0.26), r * 0.1, r * 0.34)
            .rotateZ(row * -0.32) // the outer rows lean over the shoulder
            .translate(row * w * 0.36, r * (edge ? 0.955 : 0.995), 0)
            .rotateX(a),
        );
      }
    return { tyre, lugs: mergeGeometries(lugs) };
  })());
// the rubber: smooth sidewalls with a ring, and a tread band of blocks and grooves (road tread on the kart, knobbly off-road
// blocks on the rest); the same drawing gives the grooves their depth (bump)
const rubber = {};
function rubberMat(kind) {
  if (rubber[kind]) return rubber[kind];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#26272c';
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#1e1f23';
  x.fillRect(0, 0, 256, 72);
  x.fillRect(0, 184, 256, 72); // sidewalls
  x.fillStyle = '#34353b';
  x.fillRect(0, 30, 256, 3);
  x.fillRect(0, 222, 256, 3); // a moulded ring on each
  x.fillStyle = '#0c0c0f'; // grooves (dark = deep)
  if (kind === 'slick') {
    /* no grooves: a smooth racing slick */
  } else if (kind === 'road' || kind === 'white') {
    for (let i = 0; i < 8; i++) {
      const u = i * 32;
      x.beginPath();
      x.moveTo(u, 78);
      x.lineTo(u + 14, 128);
      x.lineTo(u, 178);
      x.lineTo(u + 6, 178);
      x.lineTo(u + 20, 128);
      x.lineTo(u + 6, 78);
      x.fill();
    }
    x.fillRect(0, 124, 256, 8);
  } else {
    x.fillRect(0, 74, 256, 108);
    x.fillStyle = '#2c2d33';
    for (let i = 0; i < 8; i++) {
      const u = i * 32;
      x.fillRect(u + 3, 78, 22, 44);
      x.fillRect(u + 19, 134, 22, 44);
      if (i % 2) x.fillRect(u + 8, 126, 10, 6);
    }
  }
  if (kind === 'white') {
    x.fillStyle = '#f2f2f0';
    x.fillRect(0, 36, 256, 22);
    x.fillRect(0, 198, 256, 22);
  } // the white band on each sidewall
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(kind === 'off' ? 3 : 4, 1);
  t.anisotropy = 4;
  const b = t.clone();
  b.colorSpace = THREE.NoColorSpace;
  b.needsUpdate = true;
  return (rubber[kind] = new THREE.MeshStandardMaterial({
    map: t,
    bumpMap: b,
    bumpScale: 2.5,
    roughness: 0.88,
    metalness: 0,
    envMap: ENV.tex,
    envMapIntensity: 0.25,
  }));
}

// one wheel: the tyre and the rim style, round the x axis (used on the vehicles and for the garage swatches)
export function buildWheel(r, ww, rs, tk, trim, chrome, black) {
  const g = shared(),
    w = new THREE.Group();
  const t = new THREE.Mesh(tyre(r, ww), rubberMat(tk));
  t.castShadow = true;
  t.receiveShadow = true;
  w.add(t);
  const part = (geo, mat, sx, sy, sz, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.rotation.x = rx;
    w.add(m);
    return m;
  };
  g.rim ||= new THREE.CylinderGeometry(1, 1, 1, 28).rotateZ(Math.PI / 2);
  g.lip ||= new THREE.TorusGeometry(1, 0.07, 8, 32).rotateY(Math.PI / 2);
  g.spoke ||= new THREE.BoxGeometry(1, 1, 1);
  g.hubC ||= new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);
  // an alloy rim: a dark barrel set back inside the tyre, a chrome lip at each face, a face with spokes, five lug nuts and
  // a centre cap. Gunmetal, chrome, silver or black depending on the style; the car's accent colour only on small parts
  const R0 = r * 0.64,
    face = ww * 0.36;
  const gun = (G.gunS ||= new THREE.MeshStandardMaterial({
    color: '#3b4049',
    metalness: 0.9,
    roughness: 0.32,
    envMap: ENV.tex,
  }));
  const silver = (G.silverS ||= new THREE.MeshStandardMaterial({
    color: '#d9dde4',
    metalness: 0.95,
    roughness: 0.2,
    envMap: ENV.tex,
  }));
  const goldM = (G.goldS ||= new THREE.MeshStandardMaterial({
    color: '#e3b23c',
    metalness: 0.95,
    roughness: 0.18,
    envMap: ENV.tex,
  }));
  const faceMat =
    rs === 'mesh' ? chrome : rs === 'disc' ? silver : rs === 'turbo' ? black : rs === 'gold' ? goldM : gun;
  g.barrel ||= new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).rotateZ(Math.PI / 2);
  part(g.barrel, black, ww * 0.78, R0 * 0.98, R0 * 0.98); // the barrel, deep inside
  for (const sx of [-1, 1]) {
    const lip = part(g.lip, rs === 'gold' ? goldM : chrome, ww * 1.2, R0, R0);
    lip.position.x = sx * face; // the polished lip
    const plate = part(g.rim, faceMat, 0.06, R0 * 0.3, R0 * 0.3);
    plate.position.x = sx * (face - 0.05); // the hub plate
    if (rs === 'disc') {
      const d = part(g.rim, faceMat, 0.05, R0 * 0.94, R0 * 0.94);
      d.position.x = sx * (face - 0.07);
    } else {
      const n = rs === 'mesh' ? 12 : rs === 'turbo' ? 7 : rs === 'gold' ? 10 : 5,
        wide = rs === 'mesh' ? 0.05 : rs === 'turbo' ? 0.16 : 0.16;
      for (let k = 0; k < n; k++) {
        const sp = part(
          g.spoke,
          rs === 'turbo' && k % 2 ? trim : faceMat,
          0.08,
          R0 * 0.66,
          R0 * wide,
          (k * Math.PI * 2) / n,
        );
        sp.position.x = sx * (face - 0.06);
        sp.position.y = Math.cos((k * Math.PI * 2) / n) * R0 * 0.42;
        sp.position.z = Math.sin((k * Math.PI * 2) / n) * R0 * 0.42;
        if (rs === 'turbo') sp.rotation.x += 0.45;
      }
    }
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5,
        nut = part(g.hubC, chrome, 0.05, R0 * 0.05, R0 * 0.05);
      nut.position.set(sx * (face - 0.02), Math.cos(a) * R0 * 0.18, Math.sin(a) * R0 * 0.18);
    }
    const cap = part(g.hubC, trim, 0.05, R0 * 0.1, R0 * 0.1);
    cap.position.x = sx * (face - 0.01); // the centre cap, in the accent colour
  }
  return w;
}
export const wheelMats = trimCol => ({
  trim: new THREE.MeshPhysicalMaterial({
    color: trimCol,
    metalness: 0.3,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMap: ENV.tex,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: '#eef1f6',
    metalness: 1,
    roughness: 0.12,
    envMap: ENV.tex,
    envMapIntensity: 1.2,
  }),
  black: new THREE.MeshStandardMaterial({
    color: '#1b1c20',
    metalness: 0.2,
    roughness: 0.55,
    envMap: ENV.tex,
    envMapIntensity: 0.6,
  }),
});

// Nitro bottles: one design per nitro option, used on the car, in the Customise tiles and on the track.
// Standing on y = 0, about 1.8 tall.
const NITRO_LOOK = {
  '#4fb0ff': { name: 'classic', r: 0.46, h: 1.3, seg: 32, label: 'n2o', valve: 'chrome', knob: '#e0302a' },
  '#ff7a1a': { name: 'fire', r: 0.46, h: 1.3, seg: 32, label: 'flames', valve: 'black', knob: '#ffc22e', twin: true },
  '#b45cff': {
    name: 'violet',
    r: 0.34,
    h: 1.6,
    seg: 32,
    label: 'rings',
    valve: 'chrome',
    knob: '#ffffff',
    carbon: true,
  },
  '#3dff8a': {
    name: 'toxic',
    r: 0.56,
    h: 1.0,
    seg: 32,
    label: 'hazard',
    valve: 'black',
    knob: '#16181d',
    gauge: true,
    glow: 0.45,
  },
  '#ff3b6b': { name: 'ruby', r: 0.48, h: 1.2, seg: 8, label: 'none', valve: 'gold', knob: '#ffc22e', gem: true },
  '#ffffff': {
    name: 'white',
    r: 0.44,
    h: 1.3,
    seg: 32,
    label: 'band',
    valve: 'chrome',
    knob: '#4fb0ff',
    chromeBody: true,
    glow: 0.2,
  },
};
const nitroCache = {};
function nitroLabel(kind, col) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const x = c.getContext('2d');
  if (kind === 'n2o') {
    x.fillStyle = '#f5f7fb';
    x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#e0302a';
    x.fillRect(0, 12, 512, 12);
    x.fillRect(0, 136, 512, 12);
    x.fillStyle = '#1d2a6b';
    x.font = 'italic 800 84px "Barlow Condensed", "Arial Narrow", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (const cx of [128, 384]) x.fillText('N2O', cx, 84);
  } else if (kind === 'flames') {
    x.fillStyle = '#16181d';
    x.fillRect(0, 0, 512, 160);
    for (let i = 0; i < 8; i++) {
      const g = x.createLinearGradient(0, 160, 0, 0);
      g.addColorStop(0, '#ffc22e');
      g.addColorStop(0.5, '#ff6a00');
      g.addColorStop(1, '#e0302a');
      x.fillStyle = g;
      const bx = i * 64;
      x.beginPath();
      x.moveTo(bx, 160);
      x.quadraticCurveTo(bx + 10, 80, bx + 34, 18);
      x.quadraticCurveTo(bx + 30, 80, bx + 64, 160);
      x.fill();
    }
  } else if (kind === 'rings') {
    x.fillStyle = col;
    x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#16181d';
    x.fillRect(0, 40, 512, 18);
    x.fillRect(0, 102, 512, 18);
  } else if (kind === 'hazard') {
    x.fillStyle = '#ffc22e';
    x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#16181d';
    for (let i = -160; i < 512; i += 56) {
      x.beginPath();
      x.moveTo(i, 160);
      x.lineTo(i + 28, 160);
      x.lineTo(i + 188, 0);
      x.lineTo(i + 160, 0);
      x.fill();
    }
  } else {
    x.fillStyle = '#4fb0ff';
    x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#ffffff';
    x.fillRect(0, 60, 512, 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function nitroBottle(col = '#4fb0ff') {
  const L = NITRO_LOOK[col] || NITRO_LOOK['#4fb0ff'],
    k = (nitroCache[col] ||= (() => {
      const r = L.r,
        h = L.h,
        prof = [
          [0, 0],
          [r * 0.7, 0.01],
          [r * 0.93, 0.06],
          [r, 0.16],
          [r, h],
          [r * 0.93, h + 0.14],
          [r * 0.7, h + 0.26],
          [r * 0.36, h + 0.33],
          [r * 0.3, h + 0.35],
          [r * 0.3, h + 0.44],
        ].map(([a, b]) => new THREE.Vector2(a, b));
      const body = new THREE.LatheGeometry(prof, L.seg);
      if (L.gem) body.computeVertexNormals();
      const envMap = ENV.tex;
      const bodyM = L.chromeBody
        ? new THREE.MeshPhysicalMaterial({
            color: '#f6f8fc',
            metalness: 0.15,
            roughness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            envMap,
            emissive: '#cfe6ff',
            emissiveIntensity: 0.25,
          }) // pearl white
        : L.carbon
          ? new THREE.MeshPhysicalMaterial({
              color: '#202330',
              metalness: 0.4,
              roughness: 0.3,
              clearcoat: 1,
              clearcoatRoughness: 0.05,
              envMap,
            })
          : new THREE.MeshPhysicalMaterial({
              color: col,
              metalness: L.gem ? 0.2 : 0.55,
              roughness: L.gem ? 0.05 : 0.18,
              clearcoat: 1,
              clearcoatRoughness: 0.04,
              envMap,
              envMapIntensity: 1.2,
              flatShading: !!L.gem,
              emissive: col,
              emissiveIntensity: L.glow || 0.12,
            });
      const valveM = new THREE.MeshStandardMaterial({
        color: L.valve === 'black' ? '#1b1c20' : L.valve === 'gold' ? '#ffc94a' : '#eef1f6',
        metalness: L.valve === 'black' ? 0.4 : 1,
        roughness: 0.15,
        envMap,
      });
      const knobM = new THREE.MeshPhysicalMaterial({ color: L.knob, roughness: 0.3, clearcoat: 1, envMap });
      const labelM =
        L.label === 'none'
          ? null
          : new THREE.MeshStandardMaterial({
              map: nitroLabel(L.label, col),
              roughness: 0.35,
              envMap,
              envMapIntensity: 0.6,
              emissive: L.label === 'flames' ? '#ff6a00' : '#000000',
              emissiveIntensity: L.label === 'flames' ? 0.25 : 0,
            });
      return { body, bodyM, valveM, knobM, labelM };
    })());
  const g = new THREE.Group(),
    r = L.r,
    h = L.h;
  const body = new THREE.Mesh(k.body, k.bodyM);
  body.castShadow = true;
  g.add(body);
  if (k.labelM) {
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.012, r * 1.012, h * 0.42, 32, 1, true), k.labelM);
    lb.position.y = h * 0.55;
    g.add(lb);
  }
  if (L.gem)
    for (const y of [0.35, h - 0.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.03, 6, 8).rotateX(Math.PI / 2), k.valveM);
      ring.position.y = y;
      ring.rotation.y = Math.PI / 8;
      g.add(ring);
    }
  const top = h + 0.44;
  const valve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.26), k.valveM);
  valve.position.y = top + 0.1;
  g.add(valve);
  const outs = L.twin ? [-1, 1] : [1];
  for (const sx of outs) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 10).rotateZ(Math.PI / 2), k.valveM);
    o.position.set(sx * 0.28, top + 0.1, 0);
    g.add(o);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8), k.valveM);
  stem.position.y = top + 0.3;
  g.add(stem);
  const knob = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 20).rotateX(Math.PI / 2), k.knobM);
  knob.position.y = top + 0.4;
  g.add(knob);
  for (const a of [0, Math.PI / 2]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), k.knobM);
    sp.position.y = top + 0.4;
    sp.rotation.y = a;
    g.add(sp);
  }
  if (L.gauge) {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#f5f7fb' }),
    );
    dial.position.set(0, top + 0.1, 0.16);
    g.add(dial);
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.1, 0.01),
      new THREE.MeshBasicMaterial({ color: '#e0302a' }),
    );
    needle.position.set(0.02, top + 0.13, 0.2);
    needle.rotation.z = -0.6;
    g.add(needle);
  }
  return g;
}

export function makeKart(def, tex, layers = 10, type = def.veh || 'kart', custom = null) {
  const g = shared(),
    V = VEHICLES[type];
  const root = new THREE.Group(),
    rig = new THREE.Group(),
    body = new THREE.Group();
  root.add(rig);
  rig.add(body);
  const chassis = new THREE.Group();
  chassis.position.y = V.ride + 0.07;
  body.add(chassis);
  // glossy clearcoat paint, chrome, a dark frame metal, rubber; all lit by a studio environment so they reflect
  const paintCol = custom?.paint || V.paint || def.kart, // (the newer vehicles come in their own colours)
    chromePaint = paintCol === '#c0c6d0' || paintCol === '#d4a12a'; // (Chrome and Gold: polished metal, not a clear coat over colour)
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintCol,
    metalness: chromePaint ? 0.9 : 0.05,
    roughness: chromePaint ? 0.12 : 0.42,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMap: ENV.tex,
    envMapIntensity: chromePaint ? 1 : 0.55,
  }); // a deep, saturated paint under a glossy clear coat
  const trim = new THREE.MeshPhysicalMaterial({
    color: V.accent || def.trim,
    metalness: 0.3,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMap: ENV.tex,
    envMapIntensity: 1,
  });
  const chrome = (G.chromeS ||= new THREE.MeshStandardMaterial({
    color: '#eef1f6',
    metalness: 1,
    roughness: 0.12,
    envMap: ENV.tex,
    envMapIntensity: 1.2,
  }));
  const black = (G.blackS ||= new THREE.MeshStandardMaterial({
    color: '#1b1c20',
    metalness: 0.2,
    roughness: 0.55,
    envMap: ENV.tex,
    envMapIntensity: 0.6,
  }));
  const frame = (G.frameS ||= new THREE.MeshStandardMaterial({
    color: '#33363f',
    metalness: 0.75,
    roughness: 0.35,
    envMap: ENV.tex,
    envMapIntensity: 0.9,
  }));
  const glass = (G.glassS ||= new THREE.MeshPhysicalMaterial({
    color: '#9fd8ff',
    metalness: 0,
    roughness: 0.05,
    transmission: 0,
    transparent: true,
    opacity: 0.35,
    envMap: ENV.tex,
    envMapIntensity: 1.2,
  }));
  const add = (geo, mat, x, y, z, parent = chassis) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const Y = new THREE.Vector3(0, 1, 0);
  // a tube from a to b (frame rails, bars, struts, columns): every part is attached at both ends
  const tube = (a, b, r, mat = frame, parent = chassis) => {
    const A = new THREE.Vector3(...a),
      B = new THREE.Vector3(...b),
      m = add((g.tube ||= new THREE.CylinderGeometry(1, 1, 1, 12)), mat, 0, 0, 0, parent);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.scale.set(r, A.distanceTo(B), r);
    m.quaternion.setFromUnitVectors(Y, B.clone().sub(A).normalize());
    return m;
  };
  const lamp = (x, y, z, r = 0.2, parent = chassis) => {
    // a round headlight: chrome bezel, glowing lens
    const b = add(
      (g.bezel ||= new THREE.CylinderGeometry(1, 1, 0.3, 20).rotateX(Math.PI / 2)),
      chrome,
      x,
      y,
      z,
      parent,
    );
    b.scale.set(r * 1.2, r * 1.2, r);
    const l = add((g.lens ||= new THREE.CircleGeometry(1, 20)), g.lampMat, x, y, z + r * 0.16, parent);
    l.scale.setScalar(r);
    l.castShadow = false;
  };
  const lightBar = (y, z, w, parent = chassis) => {
    // four rally lights on a bar
    tube([-w / 2, y, z], [w / 2, y, z], 0.045, black, parent);
    for (let i = 0; i < 4; i++) lamp(-w * 0.375 + (i * w) / 4, y + 0.13, z + 0.04, 0.13, parent);
  };
  const box = (w, h, d, r, mat, x, y, z, parent = chassis) =>
    add((g['rb' + [w, h, d, r]] ||= roundedBox(w, h, d, r, 2)), mat, x, y, z, parent);
  const pipes = [],
    flames = [];
  const exhaust = (a, b, r = 0.07) => {
    // a short pipe out of the engine, ending in a flame that shows only on a boost
    tube(a, b, r, chrome);
    const tip = new THREE.Object3D();
    tip.position.set(...b);
    tip.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());
    chassis.add(tip);
    pipes.push(tip);
    const fl = new THREE.Mesh(
      (g.flameUp ||= new THREE.ConeGeometry(0.22, 1.1, 10).translate(0, 0.55, 0)),
      new THREE.MeshBasicMaterial({
        color: '#ff9a1f',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    fl.visible = false;
    tip.add(fl);
    flames.push(fl);
  };
  const T = V.track,
    B = V.base;
  const silver = (G.silverS ||= new THREE.MeshStandardMaterial({
    color: '#b9bec6',
    metalness: 0.85,
    roughness: 0.32,
    envMap: ENV.tex,
    envMapIntensity: 1,
  }));

  const holes = (G.holesM ||= (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#1b1c20';
    for (let r = 0; r < 4; r++)
      for (let q = 0; q < 9; q++) {
        x.beginPath();
        x.arc(10 + q * 13.5 + (r % 2) * 6, 9 + r * 15, 4.2, 0, 7);
        x.fill();
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
  })());
  // the fittings every body is finished with: painted marks, slatted vents, mirrors, skid plates, shackles
  const mark = (key, w, h, draw) =>
    (G['mark' + key] ||= (() => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
    })());
  const poly = (x, col, pts) => {
    x.fillStyle = col;
    x.beginPath();
    for (const [px, py] of pts) x.lineTo(px, py);
    x.fill();
  };
  // a white chevron (for a hood), three slashes (for a door), a number roundel
  const vMark = () =>
    mark('V', 128, 128, x =>
      poly(x, '#f2f2ee', [
        [8, 14],
        [44, 14],
        [64, 78],
        [84, 14],
        [120, 14],
        [64, 122],
      ]),
    );
  const slashMark = () =>
    mark('slash', 256, 128, x => {
      for (const [u, col] of [
        [40, '#f2f2ee'],
        [104, '#f2f2ee'],
        [168, '#26272c'],
      ])
        poly(x, col, [
          [u, 120],
          [u + 46, 8],
          [u + 84, 8],
          [u + 38, 120],
        ]);
    });
  const roundel = () =>
    mark('roundel', 128, 128, x => {
      x.fillStyle = '#f2f2ee';
      x.beginPath();
      x.arc(64, 64, 58, 0, 7);
      x.fill();
      x.lineWidth = 6;
      x.strokeStyle = '#26272c';
      x.stroke();
      x.fillStyle = '#26272c';
      x.font = '900 italic 84px "Barlow Condensed", Impact, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('1', 60, 70);
    });
  const decalAt = (mat, w, h, x, y, z, rx = 0, ry = 0) => {
    const m = add((g['dq' + w + 'x' + h] ||= new THREE.PlaneGeometry(w, h)), mat, x, y, z);
    m.rotation.set(rx, ry, 0);
    m.castShadow = false;
    return m;
  };
  const darkPanel = (G.darkPanel ||= new THREE.MeshStandardMaterial({
    color: '#2f2c36',
    metalness: 0.35,
    roughness: 0.5,
    envMap: ENV.tex,
    envMapIntensity: 0.7,
  }));
  // a vent: a dark plate with chrome slats across it, lying at slope rx
  const slats = (w, d, n, x, y, z, rx = 0) => {
    box(w, 0.05, d, 0.02, black, x, y, z).rotation.x = rx;
    for (let v = 0; v < n; v++) {
      const o = (v - (n - 1) / 2) * (d / (n + 0.5));
      box(w * 0.86, 0.03, 0.04, 0.01, chrome, x, y + 0.035 - Math.sin(rx) * o, z + Math.cos(rx) * o).rotation.x = rx;
    }
  };
  const mirror = (sx, from, to, mat = chrome) => {
    tube(from, to, 0.028, black);
    box(0.07, 0.17, 0.26, 0.03, mat, to[0] + sx * 0.04, to[1] + 0.06, to[2]);
  };
  const skid = (w, h, y, z) => {
    box(w, h, 0.07, 0.03, chrome, 0, y, z).rotation.x = 0.6;
    for (const x of [-w * 0.27, 0, w * 0.27])
      box(0.1, h * 0.45, 0.09, 0.02, black, x, y - 0.02, z + 0.012).rotation.x = 0.6;
  };
  const shackle = (x, y, z) =>
    (add((g.bigShackle ||= new THREE.TorusGeometry(0.13, 0.045, 8, 16)), trim, x, y, z).rotation.y = Math.PI / 2);
  const firstPart = chassis.children.length;
  if (type === 'kart') {
    // a modern racing kart (CIK style): a wide low nose that wraps the front, a raised spine from the nose up to the
    // steering wheel carrying the number, long side pods between the wheels, a carbon floor, a high-back seat with
    // harness straps, a rear bumper and the engine beside the seat. Two-tone: the paint on top, carbon black below
    const carbon = (G.carbonS ||= new THREE.MeshPhysicalMaterial({
      color: '#16181d',
      metalness: 0.3,
      roughness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      envMap: ENV.tex,
    }));
    for (const sx of [-1, 1]) tube([sx * 0.45, 0.16, -1.3], [sx * 0.45, 0.16, 1.3], 0.045); // the chassis rails
    for (const z of [1.15, 0.25, -0.75]) tube([-0.45, 0.16, z], [0.45, 0.16, z], 0.04);
    box(0.95, 0.03, 2.4, 0.02, carbon, 0, 0.15, 0); // floor tray
    tube([-T, V.wr - 0.07, -B], [T, V.wr - 0.07, -B], 0.06, frame); // rear axle
    for (const sx of [-1, 1]) {
      tube([sx * 0.45, 0.16, 1.15], [sx * (T - 0.12), V.wf - 0.07, B], 0.04);
      tube([sx * 0.45, 0.16, -1.05], [sx * (T - 0.15), V.wr - 0.07, -B], 0.04);
    }
    // the nose: wide and low, sweeping up at the corners; a carbon lower lip under it
    add(
      (g.kNose2 ||= sdfGeo(
        (x, y, z) => {
          const ax = Math.abs(x),
            lift = 0.12 * Math.pow(ax / 1.1, 3);
          let d = rbox(x, y - 0.3 - lift, z - 1.95, 1.1, 0.16, 0.34, 0.12);
          d = smax(d, y - 0.3 - (2.3 - z) * 0.5 - 0.22, 0.06); // the top slopes back down to the tip
          return d;
        },
        [-1.3, 0.05, 1.45],
        [1.3, 0.7, 2.45],
        0.028,
      )),
      paint,
      0,
      0,
      0,
    );
    box(2.1, 0.06, 0.55, 0.03, carbon, 0, 0.13, 2.08); // the splitter lip
    // the spine: rises from the nose to the steering column, the number panel on top
    add(
      (g.kSpine ||= sdfGeo(
        (x, y, z) => {
          const t = Math.min(1, Math.max(0, (1.9 - z) / 1.2)),
            top = 0.38 + 0.5 * t,
            half = 0.2 - 0.05 * t;
          return Math.max(Math.abs(x) - half, y - top, 0.14 - y, z - 1.95, 0.6 - z) - 0.04;
        },
        [-0.4, 0.05, 0.4],
        [0.4, 1.05, 2.05],
        0.025,
      )),
      paint,
      0,
      0,
      0,
    );
    {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#16181d';
      x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#fff';
      x.font = '900 italic 96px "Barlow Condensed", Impact, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('1', 64, 70);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const n = add(
        (g.kNum ||= new THREE.PlaneGeometry(0.3, 0.3)),
        new THREE.MeshBasicMaterial({ map: t }),
        0,
        0.79,
        1.18,
      );
      n.rotation.x = -Math.PI / 2 + 0.39;
    }
    // side pods: long, flat on top, flicking up at the back, two-tone
    for (const sx of [-1, 1]) {
      add(
        (g.kPod ||= sdfGeo(
          (x, y, z) => {
            const flick = Math.max(0, -(z + 0.5)) * 0.25;
            return smax(
              rbox(x, y - 0.3 - flick * 0.5, z + 0.05, 0.24, 0.12 + flick * 0.4, 0.95, 0.1),
              -(y - 0.14),
              0.04,
            );
          },
          [-0.35, 0.05, -1.15],
          [0.35, 0.75, 1.05],
          0.025,
        )),
        paint,
        sx * 0.97,
        0,
        0,
      );
      box(0.5, 0.12, 1.95, 0.05, carbon, sx * 0.97, 0.2, 0.0); // the carbon lower half
    }
    tube([-1.2, 0.3, -1.78], [1.2, 0.3, -1.78], 0.07, carbon); // rear bumper
    for (const sx of [-1, 1]) {
      tube([sx * 1.2, 0.3, -1.78], [sx * 1.2, 0.3, -1.45], 0.06, carbon);
      tube([sx * 0.45, 0.16, -1.3], [sx * 0.6, 0.3, -1.78], 0.04);
    }
    box(0.5, 0.42, 0.48, 0.08, black, -0.8, 0.45, -0.85);
    box(0.42, 0.1, 0.4, 0.04, chrome, -0.8, 0.7, -0.85); // the engine and its head
    exhaust([-0.8, 0.48, -1.09], [-0.8, 0.42, -1.62], 0.06);
    // the finish: a chevron on the nose, slashes and a vent patch down each pod, end plates on the nose in the accent
    // colour, mirrors off the spine
    decalAt(vMark(), 0.5, 0.4, 0, 0.468, 1.85, -Math.PI / 2);
    for (const sx of [-1, 1]) {
      decalAt(slashMark(), 0.8, 0.2, sx * 1.214, 0.3, 0.0, 0, (sx * Math.PI) / 2);
      decalAt(holes, 0.34, 0.15, sx * 1.214, 0.31, 0.7, 0, (sx * Math.PI) / 2);
      box(0.05, 0.22, 0.55, 0.02, trim, sx * 1.12, 0.48, 1.95); // an end plate
      mirror(sx, [sx * 0.16, 0.8, 1.0], [sx * 0.5, 0.98, 1.06]);
    }
  } else if (type === 'buggy') {
    add((g.bTub5 ||= sdfGeo(buggyF, [-1.95, 0.28, -2.6], [1.95, 1.55, 2.5], 0.028)), paint, 0, 0, 0);
    for (const sx of [-1, 1]) lamp(sx * 1.2, 0.97, 2.43, 0.14); // the lamps, set into the fender pods
    tube([-1.25, 0.55, 2.32], [1.25, 0.55, 2.32], 0.07, chrome); // front bumper
    for (const sx of [-1, 1]) tube([sx * 0.75, 0.55, 2.32], [sx * 0.75, 0.62, 1.95], 0.05, chrome);
    tube([-0.72, 0.9, 0.95], [-0.72, 1.4, 0.8], 0.04, chrome);
    tube([0.72, 0.9, 0.95], [0.72, 1.4, 0.8], 0.04, chrome);
    tube([-0.72, 1.4, 0.8], [0.72, 1.4, 0.8], 0.04, chrome); // windscreen frame
    for (const sx of [-1, 1]) box(0.16, 0.05, 0.16, 0.02, chrome, sx * 0.72, 0.97, 0.94); // its chrome feet on the cowl
    add((g.bGlass ||= new THREE.PlaneGeometry(1.4, 0.5)), glass, 0, 1.15, 0.87).rotation.x = -0.3;
    box(0.9, 0.48, 0.55, 0.1, black, 0, 0.66, -1.72);
    box(0.5, 0.2, 0.3, 0.1, chrome, 0, 0.98, -1.72); // the engine out back
    exhaust([0.3, 0.7, -1.95], [0.42, 0.95, -2.25], 0.06);
    exhaust([-0.3, 0.7, -1.95], [-0.42, 0.95, -2.25], 0.06);
    // the finish: a number roundel on the nose, mirrors on the screen posts, shackles on the bumper, a skid plate under
    // the nose, slashes in the accent colour over the rear fenders
    decalAt(roundel(), 0.5, 0.5, 0, 1.185, 1.45, -Math.PI / 2 + 0.06); // (just proud of the curve of the hood)
    skid(1.3, 0.42, 0.36, 2.2);
    for (const sx of [-1, 1]) {
      mirror(sx, [sx * 0.72, 1.36, 0.82], [sx * 0.98, 1.44, 0.86]);
      shackle(sx * 0.45, 0.42, 2.36);
      for (let q = 0; q < 3; q++)
        box(0.44, 0.03, 0.08, 0.01, trim, sx * 1.22, 1.492, -1.25 - q * 0.2).rotation.y = sx * 0.5;
    }
  } else if (type === 'monster') {
    // a clean pickup body from smooth rounded panels: the main tub, the hood over the engine, the open cab's door
    // panels and dash, the bed's sides and tailgate
    box(2.44, 0.72, 4.5, 0.24, paint, 0, 0.56, 0); // the tub
    box(2.12, 0.42, 1.8, 0.2, paint, 0, 1.08, 1.32); // the hood
    box(2.24, 0.4, 0.36, 0.16, paint, 0, 1.1, 0.3); // the dash / cowl
    for (const sx of [-1, 1]) {
      box(0.16, 0.42, 1.35, 0.08, paint, sx * 1.14, 1.1, -0.2); // the cab's door panels
      box(0.16, 0.42, 1.15, 0.08, paint, sx * 1.14, 1.1, -1.6);
    } // the bed sides
    box(2.44, 0.42, 0.16, 0.08, paint, 0, 1.1, -2.18); // the tailgate
    box(1.9, 0.55, 0.1, 0.06, black, 0, 0.62, 2.27); // grille
    for (let i = -3; i <= 3; i++) tube([i * 0.26, 0.4, 2.33], [i * 0.26, 0.84, 2.33], 0.025, chrome);
    for (const sx of [-1, 1]) lamp(sx * 0.82, 0.98, 2.28, 0.19);
    tube([-1.35, 0.2, 2.4], [1.35, 0.2, 2.4], 0.1, chrome);
    tube([-1.35, 0.2, -2.4], [1.35, 0.2, -2.4], 0.1, chrome); // bumpers
    // the finish: a dark panel on the hood, slashes down each side of the tub, a black band at the
    // beltline, vent patches on the bed, mirrors, shackles on the bumper, a skid plate under the nose
    box(1.35, 0.04, 1.45, 0.02, darkPanel, 0, 1.295, 1.36);
    skid(1.7, 0.5, 0.08, 2.32);
    for (const sx of [-1, 1]) {
      decalAt(slashMark(), 1.7, 0.52, sx * 1.226, 0.58, -0.25, 0, (sx * Math.PI) / 2);
      decalAt(holes, 0.7, 0.3, sx * 1.226, 1.1, -1.6, 0, (sx * Math.PI) / 2);
      box(0.05, 0.07, 4.1, 0.02, black, sx * 1.215, 0.92, 0); // the beltline
      mirror(sx, [sx * 1.14, 1.32, 0.3], [sx * 1.4, 1.52, 0.36], paint);
      shackle(sx * 0.7, 0.2, 2.56);
    }
    // a real monster truck's running gear, in the wheels' frame: a frame under the body, a solid axle at each end
    // (hub to hub, a differential in the middle, a driveshaft to the gearbox), four trailing links tying each axle to
    // the frame, and two long coilovers per wheel standing from brackets on the axle up to a shock tower on the frame
    {
      const Y0 = V.ride + 0.07,
        hubX = V.track - V.ww / 2 - 0.02,
        fy = Y0 + 0.08;
      for (const sx of [-1, 1]) {
        box(0.22, 0.22, 4.9, 0.05, frame, sx * 0.82, fy, 0, rig);
      } // frame rails
      for (const z of [-2.1, -0.4, 0.9, 2.1]) box(1.86, 0.16, 0.16, 0.04, frame, 0, fy, z, rig); // cross-members
      const coil = (g.mCoil3 ||= (() => {
        const pts = [];
        for (let i = 0; i <= 200; i++) {
          const a = (i / 200) * Math.PI * 2 * 9;
          pts.push(new THREE.Vector3(Math.cos(a) * 0.19, i / 200, Math.sin(a) * 0.19));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.035, 6, false);
      })());
      const along = (lo, hi, geo, mat, t0, t1, r) => {
        // a part laid along the shock's line from t0 to t1
        const a = lo.clone().lerp(hi, t0),
          b = lo.clone().lerp(hi, t1),
          m = new THREE.Mesh(geo, mat);
        m.position.copy(a);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        m.scale.set(r, a.distanceTo(b), r);
        m.castShadow = true;
        rig.add(m);
        return m;
      };
      const cyl = (g.mCyl ||= new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0));
      for (const sz of [-1, 1]) {
        const z = sz * V.base,
          hy = (sz > 0 ? V.wf : V.wr) + 0.07;
        tube([-hubX, hy, z], [hubX, hy, z], 0.13, frame, rig); // the axle tube
        add((g.mDiff ||= new THREE.SphereGeometry(0.34, 16, 12)), frame, 0.25, hy, z, rig).scale.set(1, 1, 1.15); // the differential
        tube([0.25, hy + 0.05, z - sz * 0.2], [0, Y0 - 0.05, sz * 0.7], 0.07, chrome, rig); // driveshaft to the gearbox
        box(0.8, 0.3, 0.5, 0.06, black, 0, Y0 - 0.02, sz * 0.7 - sz * 0.25, rig);
        for (const sx of [-1, 1]) {
          tube([sx * (hubX - 0.15), hy, z], [sx * (hubX + 0.02), hy, z], 0.2, frame, rig); // the hub carrier
          // four-link: a lower and an upper link from the axle back to the frame rail
          tube([sx * 1.15, hy - 0.14, z], [sx * 0.82, fy - 0.02, z - sz * 1.15], 0.06, chrome, rig);
          tube([sx * 0.55, hy + 0.16, z], [sx * 0.72, fy + 0.02, z - sz * 0.95], 0.05, chrome, rig);
          for (const sx2 of [1.15, 0.55]) box(0.14, 0.3, 0.2, 0.03, frame, sx * sx2, hy, z, rig); // link brackets
          // the shock tower: a hoop off the frame rail, braced, carrying the two top mounts
          const tx = sx * 1.4,
            ty = Y0 + 1.55;
          tube([sx * 0.82, fy, z - 0.75], [tx, ty, z - 0.75], 0.07, frame, rig);
          tube([sx * 0.82, fy, z + 0.75], [tx, ty, z + 0.75], 0.07, frame, rig);
          tube([tx, ty, z - 0.78], [tx, ty, z + 0.78], 0.08, frame, rig);
          tube([sx * 0.82, fy + 0.02, z], [tx, ty - 0.02, z - 0.4], 0.045, frame, rig);
          for (const o of [-0.55, 0.55]) {
            const lo = new THREE.Vector3(sx * (hubX - 0.2), hy - 0.05, z + o),
              hi = new THREE.Vector3(tx, ty, z + o * 1.18);
            box(0.12, 0.36, 0.26, 0.03, frame, lo.x, hy, z + o * 0.55, rig); // the lower bracket welded to the axle
            tube([lo.x, hy, z + o * 0.3], [lo.x, lo.y, lo.z], 0.06, frame, rig);
            along(lo, hi, cyl, chrome, 0, 0.46, 0.05); // the chrome shaft
            along(lo, hi, cyl, frame, 0.42, 0.97, 0.1); // the shock body
            along(lo, hi, coil, trim, 0.16, 0.9, 1); // the coil spring, in the accent colour
            along(lo, hi, cyl, black, 0.14, 0.19, 0.2);
            along(lo, hi, cyl, black, 0.88, 0.93, 0.2); // spring seats
            along(lo, hi, cyl, frame, 0.62, 0.95, 0.07).position.x += sx * 0.2; // the piggyback reservoir
            add(
              (g.mEye ||= new THREE.TorusGeometry(0.08, 0.035, 6, 12).rotateY(Math.PI / 2)),
              chrome,
              hi.x,
              hi.y + 0.02,
              hi.z,
              rig,
            ); // the top eyelet
          }
        }
      }
    }
    {
      const spare = buildWheel(0.55, 0.42, 'classic', 'off', trim, chrome, black);
      spare.rotation.z = Math.PI / 2;
      spare.position.set(0, 0.98, -1.62);
      chassis.add(spare);
    } // the spare, lying in the bed
    for (const sx of [-1, 1]) {
      // twin stacks bolted to the back of the cab, a heat shield on each
      exhaust([sx * 1.18, 1.0, -2.0], [sx * 1.18, 2.15, -2.0], 0.1);
      tube([sx * 1.18, 1.3, -2.0], [sx * 1.18, 1.8, -2.0], 0.14, black);
      tube([sx * 1.18, 1.2, -2.0], [sx * 1.0, 1.0, -2.0], 0.04, frame);
    }
  } else if (type === 'muscle') {
    add((g.muscle8 ||= sdfGeo(muscleF, [-1.7, 0.35, -2.85], [1.7, 1.4, 2.85], 0.032)), paint, 0, 0, 0);
    // the nose: a black grille across the front with the headlights set into its ends, a chrome bumper under it
    box(2.0, 0.34, 0.08, 0.04, black, 0, 0.8, 2.62);
    for (let i = -6; i <= 6; i++) tube([i * 0.13, 0.67, 2.66], [i * 0.13, 0.93, 2.66], 0.012, frame);
    for (const sx of [-1, 1]) {
      lamp(sx * 0.78, 0.82, 2.67, 0.13); // round headlamps in the grille
    }
    // the bull bar: a tube guard round the nose, two spot lamps on it, a winch in the middle
    for (const sx of [-1, 1]) {
      tube([sx * 0.95, 0.38, 2.74], [sx * 0.95, 1.02, 2.84], 0.045, black);
      tube([sx * 0.95, 0.5, 2.74], [sx * 0.95, 0.5, 2.52], 0.04, black);
      tube([sx * 0.95, 1.0, 2.84], [sx * 0.82, 1.0, 2.67], 0.035, black);
    }
    tube([-0.95, 1.02, 2.84], [0.95, 1.02, 2.84], 0.045, black);
    tube([-0.95, 0.55, 2.78], [0.95, 0.55, 2.78], 0.045, black);
    for (const sx of [-1, 1]) lamp(sx * 0.38, 0.9, 2.88, 0.11);
    box(0.5, 0.2, 0.2, 0.04, black, 0, 0.44, 2.74);
    add((g.mDrum ||= new THREE.CylinderGeometry(0.07, 0.07, 0.36, 12).rotateZ(Math.PI / 2)), chrome, 0, 0.46, 2.86);
    // the rear tube bumper
    for (const sx of [-1, 1]) tube([sx * 0.95, 0.45, -2.5], [sx * 1.0, 0.45, -2.72], 0.04, black);
    tube([-1.0, 0.45, -2.72], [1.0, 0.45, -2.72], 0.05, black);
    tube([-1.0, 0.75, -2.66], [1.0, 0.75, -2.66], 0.04, black);
    for (const sx of [-1, 1]) tube([sx * 1.0, 0.45, -2.72], [sx * 1.0, 0.75, -2.66], 0.04, black);
    // the tail: a full-width red light bar, twin exhausts under the bumper
    const tail = add(
      (g.mTail ||= new THREE.PlaneGeometry(1.9, 0.12)),
      (G.tailMat ||= new THREE.MeshBasicMaterial({ color: '#ff2a3a' })),
      0,
      0.9,
      -2.47,
    );
    tail.rotation.y = Math.PI;
    tail.castShadow = false;
    tube([-0.8, 0.82, -2.46], [-0.8, 0.98, -2.46], 0.02, chrome);
    tube([0.8, 0.82, -2.46], [0.8, 0.98, -2.46], 0.02, chrome);
    exhaust([0.55, 0.42, -2.2], [0.6, 0.4, -2.62], 0.07);
    exhaust([-0.55, 0.42, -2.2], [-0.6, 0.4, -2.62], 0.07);
    {
      const spare = buildWheel(0.5, 0.36, 'classic', 'off', trim, chrome, black);
      spare.rotation.z = Math.PI / 2;
      spare.rotation.x = -0.18;
      spare.position.set(0, 1.28, -2.05);
      chassis.add(spare);
    } // the spare, strapped on the tail deck
    // the windscreen on its frame, raked back
    tube([-0.85, 1.08, 0.64], [-0.8, 1.5, 0.38], 0.035, black);
    tube([0.85, 1.08, 0.64], [0.8, 1.5, 0.38], 0.035, black);
    tube([-0.8, 1.5, 0.38], [0.8, 1.5, 0.38], 0.035, black);
    add((g.mGlass ||= new THREE.PlaneGeometry(1.6, 0.5)), glass, 0, 1.29, 0.51).rotation.x = -0.55;
    // the finish: a dark panel down the hood with a slatted vent and a chevron, slashes on each door, a pinstripe in
    // the accent colour along the crease, mirrors, shackles on the bull bar, a skid plate under the nose
    box(0.95, 0.03, 1.6, 0.01, darkPanel, 0, 1.085, 1.65);
    slats(0.62, 0.5, 4, 0, 1.11, 1.35);
    decalAt(vMark(), 0.5, 0.4, 0, 1.104, 2.15, -Math.PI / 2);
    skid(1.5, 0.45, 0.34, 2.6);
    for (const sx of [-1, 1]) {
      decalAt(slashMark(), 1.25, 0.42, sx * 1.006, 0.76, -0.1, 0, (sx * Math.PI) / 2);
      box(0.03, 0.04, 1.3, 0.01, trim, sx * 1.075, 1.0, -0.05); // the pinstripe
      mirror(sx, [sx * 0.88, 1.1, 0.6], [sx * 1.16, 1.3, 0.66]);
      shackle(sx * 0.6, 0.42, 2.84);
    }
  } else if (type === 'rail') {
    // the sand rail: no body at all, a frame of tubes drawn to a point at the nose, flat painted panels bolted in
    // between them, a single lamp on the tip, and a big twin-cylinder engine out in the open behind the seat with its
    // air filter standing up over everything. Skinny wheels in front, huge paddle tyres behind.
    const P = {
      n0: sx => [sx * 0.16, 0.12, 2.35], // the nose, low
      n1: sx => [sx * 0.14, 0.44, 2.3], // the nose, high
      f0: sx => [sx * 0.62, 0.1, 1.0], // the front of the cockpit, low
      f1: sx => [sx * 0.7, 0.84, 0.75], // and high (the dash bar)
      b0: sx => [sx * 0.76, 0.1, -0.9], // the back of the cockpit, low
      b1: sx => [sx * 0.8, 0.88, -0.95], // and high
      t0: sx => [sx * 0.6, 0.22, -2.25], // the tail, low
      t1: sx => [sx * 0.46, 1.02, -2.25], // and high
    };
    // a flat panel between four points of the frame (two faces, so it shows from inside the cockpit too)
    const panel = (a, b, c, d, th = 0.035) => {
      const v = [a, b, c, d].map(p => new THREE.Vector3(...p)),
        n = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[3].clone().sub(v[0])).normalize(),
        up = v.map(p => p.clone().addScaledVector(n, th / 2)),
        dn = v.map(p => p.clone().addScaledVector(n, -th / 2)),
        pos = [];
      for (const [i, j, k] of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        pos.push(...up[i].toArray(), ...up[j].toArray(), ...up[k].toArray());
        pos.push(...dn[i].toArray(), ...dn[k].toArray(), ...dn[j].toArray());
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      geo.computeVertexNormals();
      return add(geo, paint, 0, 0, 0);
    };
    // a black mark on a panel (the lightning bolt): drawn once, laid just off the paint
    const bolt = (G.railBolt ||= (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#16181d';
      x.beginPath();
      for (const [px, py] of [
        [74, 6],
        [30, 70],
        [58, 70],
        [44, 122],
        [100, 50],
        [70, 50],
        [92, 6],
      ])
        x.lineTo(px, py);
      x.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
    })());
    for (const sx of [-1, 1]) {
      tube(P.n0(sx), P.f0(sx), 0.05);
      tube(P.f0(sx), P.b0(sx), 0.05);
      tube(P.b0(sx), P.t0(sx), 0.05); // the lower rail, nose to tail
      tube(P.n1(sx), P.f1(sx), 0.05);
      tube(P.f1(sx), P.b1(sx), 0.05);
      tube(P.b1(sx), P.t1(sx), 0.05); // the upper rail
      tube(P.n0(sx), P.n1(sx), 0.045);
      tube(P.f0(sx), P.f1(sx), 0.045);
      tube(P.b0(sx), P.b1(sx), 0.045);
      tube(P.t0(sx), P.t1(sx), 0.045); // the uprights between them
      tube(P.f1(sx), P.b0(sx), 0.035);
      tube(P.b1(sx), P.t0(sx), 0.035); // the diagonals
      panel(P.n0(sx), P.f0(sx), P.f1(sx), P.n1(sx)); // the nose's side
      panel([sx * 0.66, 0.16, 0.86], [sx * 0.75, 0.16, -0.2], [sx * 0.77, 0.6, -0.5], [sx * 0.71, 0.8, 0.66]); // the cockpit's side
      panel([sx * 0.76, 0.16, -0.32], [sx * 0.78, 0.16, -0.86], [sx * 0.81, 0.84, -0.9], [sx * 0.79, 0.66, -0.6]); // and the one behind it
      const m = add((g.railMark ||= new THREE.PlaneGeometry(0.42, 0.42)), bolt, sx * 0.79, 0.44, 0.2);
      m.rotation.y = (sx * Math.PI) / 2;
      m.castShadow = false;
    }
    for (const k of ['n0', 'n1', 'f0', 'f1', 'b0', 'b1', 't0', 't1']) tube(P[k](-1), P[k](1), 0.045); // the cross tubes
    panel(P.n1(-1), P.n1(1), P.f1(1), P.f1(-1)); // the nose's top
    {
      const m = add((g.railBoltG ||= new THREE.PlaneGeometry(0.62, 0.9)), bolt, 0, 0.675, 1.5);
      m.rotation.x = -(Math.PI / 2 - 0.253); // laid on the slope of the nose
      m.castShadow = false;
    }
    box(1.3, 0.03, 1.9, 0.01, black, 0, 0.1, 0.05); // the floor pan
    lamp(0, 0.28, 2.42, 0.17); // the one lamp, on the tip
    // the engine: a block, two finned cylinders in a V, a pulley on its nose, the air filter on a stack, twin pipes
    box(0.72, 0.46, 0.76, 0.08, black, 0, 0.62, -1.7);
    for (const sx of [-1, 1]) {
      const bank = new THREE.Group();
      bank.position.set(sx * 0.14, 0.82, -1.7);
      bank.rotation.z = -sx * 0.5;
      chassis.add(bank);
      add((g.railCyl ||= new THREE.CylinderGeometry(0.19, 0.19, 0.46, 16)), frame, 0, 0.26, 0, bank);
      for (let f = 0; f < 4; f++)
        add((g.railFin ||= new THREE.CylinderGeometry(0.235, 0.235, 0.03, 16)), chrome, 0, 0.1 + f * 0.1, 0, bank);
      box(0.4, 0.13, 0.44, 0.04, chrome, 0, 0.55, 0, bank); // the head
      exhaust([sx * 0.42, 1.12, -1.8], [sx * 0.72, 1.3, -2.62], 0.1);
    }
    add((g.railPul ||= new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20).rotateX(Math.PI / 2)), paint, 0, 0.62, -1.29);
    add((g.railPulC ||= new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12).rotateX(Math.PI / 2)), chrome, 0, 0.62, -1.28);
    tube([0, 0.9, -1.7], [0, 1.46, -1.7], 0.08, chrome); // the stack
    add((g.railFilt ||= new THREE.CylinderGeometry(0.27, 0.27, 0.2, 22)), trim, 0, 1.54, -1.7);
    for (const y of [1.43, 1.65])
      add((g.railCap ||= new THREE.CylinderGeometry(0.29, 0.29, 0.03, 22)), chrome, 0, y, -1.7);
    add((g.railNut ||= new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12)), chrome, 0, 1.69, -1.7);
    box(0.95, 0.52, 0.05, 0.02, black, 0, 0.62, -2.3); // the plate's panel across the tail
  } else if (type === 'raider') {
    // the raider: a big faceted off-road body, hard-edged. A hood that falls to a narrowed nose with a vent in it,
    // three rally lamps on a bull bar over a steel skid plate, an open cockpit behind a short screen, two fins rising
    // to a wing over the engine, and a shark's grin down each side. The wheels stand well out on their arms.
    add((g.raiderShell ||= sdfGeo(raiderF, [-1.3, 0.25, -2.9], [1.3, 1.9, 2.9], 0.035)), paint, 0, 0, 0);
    box(0.95, 0.06, 0.8, 0.02, black, 0, 1.085, 1.55).rotation.x = 0.2; // the hood vent
    box(1.25, 0.3, 0.1, 0.03, black, 0, 0.6, 2.69); // the grille under the hood's lip
    for (let q = -4; q <= 4; q++) box(0.03, 0.24, 0.03, 0.01, frame, q * 0.13, 0.6, 2.75);
    for (let v = 0; v < 5; v++)
      box(0.8, 0.03, 0.05, 0.01, frame, 0, 1.165 - v * 0.03, 1.27 + v * 0.14).rotation.x = 0.2;
    for (const sx of [-1, 1]) {
      tube([sx * 1.2, 0.36, 1.0], [sx * 1.2, 0.36, -1.0], 0.08, chrome); // rock sliders
      for (const z of [0.8, -0.8]) tube([sx * 1.2, 0.36, z], [sx * 1.0, 0.46, z], 0.05, frame);
      box(0.3, 0.1, 0.24, 0.03, black, sx * 0.86, 1.2, 1.9); // hood latches
      box(0.07, 0.11, 3.5, 0.02, black, sx * 1.075, 1.13, -0.35); // a black band along the beltline
      for (let q = 0; q < 3; q++) {
        box(0.46, 0.02, 0.08, 0.01, trim, sx * 0.72, 1.115 - q * 0.04, 1.3 + q * 0.2).rotation.set(0.2, sx * 0.7, 0); // slashes on the hood
        box(0.02, 0.34, 0.09, 0.01, trim, sx * 1.11, 0.92, -1.25 - q * 0.17).rotation.x = 0.5; // and behind the grin
      }
      const hv = add((g.raiderHoles ||= new THREE.PlaneGeometry(0.62, 0.3)), holes, sx * 1.112, 1.0, 1.75); // vent holes ahead of the door
      hv.rotation.y = (sx * Math.PI) / 2;
      hv.castShadow = false;
      // the grin: an eye, and a mouth of teeth, opening towards the nose
      const key = 'raiderGrin' + sx,
        grin = (G[key] ||= (() => {
          const c = document.createElement('canvas');
          c.width = 512;
          c.height = 256;
          const x = c.getContext('2d');
          if (sx > 0) {
            x.translate(512, 0);
            x.scale(-1, 1);
          } // (drawn nose to the right; turned round for the other side)
          x.fillStyle = '#efe6f2';
          x.beginPath();
          x.moveTo(500, 96);
          x.quadraticCurveTo(300, 120, 60, 200);
          x.quadraticCurveTo(300, 250, 500, 236);
          x.fill(); // the open mouth
          x.globalCompositeOperation = 'destination-out';
          for (let t = 0; t < 8; t++) {
            const u = 110 + t * 50;
            x.beginPath(); // teeth cut out of it, top and bottom
            x.moveTo(u - 26, 250);
            x.lineTo(u, 176);
            x.lineTo(u + 26, 250);
            x.fill();
            x.beginPath();
            x.moveTo(u - 1, 90);
            x.lineTo(u + 25, 172 - t * 4);
            x.lineTo(u + 51, 90);
            x.fill();
          }
          x.globalCompositeOperation = 'source-over';
          x.beginPath();
          x.moveTo(330, 74);
          x.quadraticCurveTo(390, 20, 460, 40);
          x.quadraticCurveTo(400, 62, 330, 74);
          x.fill(); // the eye, narrowed
          x.fillStyle = '#16181d';
          x.beginPath();
          x.arc(404, 48, 9, 0, 7);
          x.fill();
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          return new THREE.MeshBasicMaterial({ map: t, transparent: true });
        })());
      const m = add((g.raiderGrinG ||= new THREE.PlaneGeometry(2.7, 0.78)), grin, sx * 1.112, 0.76, 0.35);
      m.rotation.y = (sx * Math.PI) / 2;
      m.castShadow = false;
      // the bull bar's side, a shackle, a wing strut, a pipe
      tube([sx * 0.78, 1.12, 2.78], [sx * 0.9, 0.62, 2.86], 0.07, black);
      tube([sx * 0.9, 0.62, 2.86], [sx * 0.86, 0.6, 2.4], 0.07, black);
      add((g.bigShackle ||= new THREE.TorusGeometry(0.13, 0.045, 8, 16)), trim, sx * 0.62, 0.36, 2.9).rotation.y =
        Math.PI / 2;
      tube([sx * 0.86, 1.62, -2.2], [sx * 0.86, 1.98, -2.42], 0.05, black);
      exhaust([sx * 0.5, 1.2, -2.1], [sx * 0.62, 1.34, -2.85], 0.1);
    }
    tube([-0.78, 1.12, 2.78], [0.78, 1.12, 2.78], 0.07, black);
    tube([-0.9, 0.62, 2.86], [0.9, 0.62, 2.86], 0.07, black);
    for (const x of [-0.5, 0, 0.5]) lamp(x, 1.17, 2.84, 0.23);
    {
      const skid = box(1.7, 0.75, 0.09, 0.03, chrome, 0, 0.3, 2.72);
      skid.rotation.x = 0.6;
      for (const x of [-0.42, 0, 0.42]) box(0.11, 0.3, 0.11, 0.02, black, x, 0.27, 2.735).rotation.x = 0.6; // its slots
    }
    tube([-1.0, 1.2, 0.86], [-0.93, 1.74, 0.56], 0.045, black);
    tube([1.0, 1.2, 0.86], [0.93, 1.74, 0.56], 0.045, black);
    tube([-0.93, 1.74, 0.56], [0.93, 1.74, 0.56], 0.045, black);
    add((g.bigGlass ||= new THREE.PlaneGeometry(1.88, 0.6)), glass, 0, 1.47, 0.71).rotation.x = -0.52; // the screen
    box(0.9, 0.3, 0.8, 0.06, black, 0, 1.12, -2.0); // the engine's top in its bay
    for (const sx of [-1, 1]) tube([sx * 0.3, 1.3, -1.7], [sx * 0.3, 1.3, -2.3], 0.08, chrome);
    add((g.raiderFilt ||= new THREE.CylinderGeometry(0.17, 0.17, 0.5, 16).rotateZ(Math.PI / 2)), trim, 0, 1.44, -1.9);
    box(2.1, 0.08, 0.56, 0.03, paint, 0, 2.02, -2.46).rotation.x = -0.1; // the wing
    for (const sx of [-1, 1]) box(0.06, 0.24, 0.6, 0.02, black, sx * 1.06, 2.04, -2.46);
    box(2.1, 0.16, 5.0, 0.05, black, 0, 0.3, -0.05); // the black lower body
  } else if (type === 'roadster') {
    // the roadster: a big, low, smooth body, all curves. A long hood that falls to a pointed nose under two silver
    // stripes and a scoop, slit lamps, a tube bull bar with two square work lamps, silver armour along the sills,
    // mirrors on stalks, and two rocket pipes lying on the rear deck.
    add((g.roadsterShell ||= sdfGeo(roadsterF, [-1.45, 0.25, -2.95], [1.45, 1.75, 3.3], 0.035)), paint, 0, 0, 0);
    box(0.62, 0.1, 0.7, 0.04, silver, 0, 1.2, 1.25).rotation.x = 0.14; // the scoop
    box(0.48, 0.05, 0.06, 0.02, black, 0, 1.17, 1.6).rotation.x = 0.14;
    for (const sx of [-1, 1]) {
      box(0.3, 0.03, 1.5, 0.01, silver, sx * 0.42, 1.115, 1.75).rotation.x = 0.2; // the stripes
      const hl = box(0.62, 0.06, 0.07, 0.02, g.lampMat, sx * 0.62, 0.82, 2.97); // a slit of light
      hl.rotation.set(0, sx * 0.5, sx * 0.2);
      hl.castShadow = false;
      box(0.1, 0.36, 2.5, 0.03, silver, sx * 1.13, 0.5, -0.1); // the armour along the sill
      box(0.1, 0.5, 0.95, 0.03, silver, sx * 1.12, 0.78, 1.15).rotation.x = -0.55; // rising to the front wheel
      box(0.1, 0.5, 0.95, 0.03, silver, sx * 1.14, 0.8, -1.4).rotation.x = 0.55; // and to the rear
      const rv = add((g.roadHoles ||= new THREE.PlaneGeometry(0.5, 0.24)), holes, sx * 1.185, 0.52, 0.5); // vent holes in it
      rv.rotation.y = (sx * Math.PI) / 2;
      rv.castShadow = false;
      for (let q = 0; q < 3; q++)
        box(0.02, 0.28, 0.08, 0.01, silver, sx * 1.13, 1.0, -0.62 - q * 0.16).rotation.x = 0.45; // three slashes on the door
      tube([sx * 1.0, 1.26, 0.8], [sx * 1.26, 1.56, 0.86], 0.035, black); // the mirror on its stalk
      box(0.09, 0.2, 0.32, 0.03, silver, sx * 1.3, 1.62, 0.86);
      tube([sx * 0.7, 1.0, 3.2], [sx * 1.0, 0.56, 3.26], 0.065, frame); // the bull bar's side
      tube([sx * 1.0, 0.56, 3.26], [sx * 0.95, 0.52, 2.6], 0.065, frame);
      add((g.bigShackle ||= new THREE.TorusGeometry(0.13, 0.045, 8, 16)), trim, sx * 0.58, 0.32, 3.26).rotation.y =
        Math.PI / 2;
      box(0.36, 0.28, 0.14, 0.03, black, sx * 0.46, 0.6, 3.28); // a square work lamp
      const wl = add((g.sqLampB ||= new THREE.PlaneGeometry(0.27, 0.2)), g.lampMat, sx * 0.46, 0.6, 3.355);
      wl.castShadow = false;
      // a rocket pipe on the deck: a fat tube with a dark nozzle
      exhaust([sx * 0.36, 1.42, -1.5], [sx * 0.36, 1.66, -2.95], 0.2);
      const nz = add(
        (g.rocketNozB ||= new THREE.CylinderGeometry(0.24, 0.24, 0.28, 18)),
        black,
        sx * 0.36,
        1.64,
        -2.82,
      );
      nz.quaternion.setFromUnitVectors(Y, new THREE.Vector3(0, 0.24, -1.45).normalize());
    }
    tube([-0.7, 1.0, 3.2], [0.7, 1.0, 3.2], 0.065, frame);
    tube([-1.0, 0.56, 3.26], [1.0, 0.56, 3.26], 0.065, frame);
    box(1.5, 0.6, 0.08, 0.03, chrome, 0, 0.3, 3.1).rotation.x = 0.6; // the skid plate
    for (const x of [-0.4, 0, 0.4]) box(0.12, 0.12, 0.1, 0.05, black, x, 0.3, 3.115).rotation.x = 0.6; // its holes
    box(1.0, 0.2, 0.14, 0.05, black, 0, 0.62, 3.14); // the grille low in the nose
    box(0.22, 0.09, 0.3, 0.03, (G.amberM ||= new THREE.MeshBasicMaterial({ color: '#ffb21a' })), 0, 1.52, -1.35); // the amber light on the pipes' housing
    box(1.2, 0.24, 0.9, 0.05, frame, 0, 1.36, -1.6); // what the pipes come out of
    tube([-1.0, 1.24, 0.86], [-0.93, 1.74, 0.56], 0.045, black);
    tube([1.0, 1.24, 0.86], [0.93, 1.74, 0.56], 0.045, black);
    tube([-0.93, 1.74, 0.56], [0.93, 1.74, 0.56], 0.045, black);
    add((g.bigGlass ||= new THREE.PlaneGeometry(1.88, 0.6)), glass, 0, 1.49, 0.71).rotation.x = -0.52; // the screen
  } else if (type === 'brute') {
    // the brute: chubby and tall. A wedge of armour riding high between four balloon tyres: a short hood falling to a
    // narrow nose, its middle dark with a slatted vent and a white chevron, square lamps in threes in painted pods
    // either side of a black grille, a bumper in two blades with a tow hook between, tall doors with chevrons, a dark
    // engine cover behind the seat and a silencer the size of an oil drum on each rear corner.
    const dark = (G.bruteDark ||= new THREE.MeshStandardMaterial({
      color: '#3b3542',
      metalness: 0.35,
      roughness: 0.5,
      envMap: ENV.tex,
      envMapIntensity: 0.7,
    }));
    add((g.bruteShell2 ||= sdfGeo(bruteF, [-1.35, 0.25, -2.5], [1.35, 1.8, 2.6], 0.035)), paint, 0, 0, 0);
    const SL = 0.29; // the hood's slope
    box(1.2, 0.07, 1.45, 0.03, dark, 0, 1.275, 1.6).rotation.x = SL; // the hood's dark middle
    box(0.8, 0.16, 0.52, 0.03, frame, 0, 1.47, 1.15).rotation.x = SL; // the vent
    for (let v = 0; v < 5; v++)
      box(0.66, 0.03, 0.045, 0.01, chrome, 0, 1.6 - v * 0.028, 0.96 + v * 0.095).rotation.x = SL;
    {
      // the white chevron on the hood
      const vm = (G.bruteV ||= (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#f2f2ee';
        x.beginPath();
        for (const [px, py] of [
          [8, 14],
          [44, 14],
          [64, 78],
          [84, 14],
          [120, 14],
          [64, 122],
        ])
          x.lineTo(px, py);
        x.fill();
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({ map: t, transparent: true });
      })());
      const m = add((g.bruteVG ||= new THREE.PlaneGeometry(0.62, 0.5)), vm, 0, 1.215, 1.98);
      m.rotation.x = -(Math.PI / 2 - SL);
      m.castShadow = false;
    }
    box(0.46, 0.4, 0.16, 0.04, black, 0, 0.8, 2.42); // the grille
    box(1.75, 0.09, 1.05, 0.03, dark, 0, 1.7, -1.75); // the engine cover behind the seat
    box(0.9, 0.2, 0.6, 0.05, paint, 0, 1.82, -1.7); // and the painted box on it
    box(1.9, 0.1, 4.0, 0.04, dark, 0, 0.34, -0.1); // the belly plate
    for (const sx of [-1, 1]) {
      box(0.62, 0.42, 0.2, 0.05, paint, sx * 0.56, 0.8, 2.42); // a lamp pod
      box(0.5, 0.26, 0.06, 0.02, black, sx * 0.56, 0.8, 2.52);
      for (const dx of [-0.15, 0, 0.15]) {
        const l = add((g.sqLed2 ||= new THREE.PlaneGeometry(0.13, 0.17)), g.lampMat, sx * 0.56 + dx, 0.8, 2.555);
        l.castShadow = false;
      }
      const blade = box(1.0, 0.44, 0.46, 0.05, dark, sx * 0.86, 0.36, 2.66); // a bumper blade, turned out and down
      blade.rotation.set(0.2, sx * 0.36, 0);
      // what holds it: a frame horn out of the nose, down to a plate bolted on the back of the blade
      tube([sx * 0.5, 0.86, 1.95], [sx * 0.62, 0.46, 2.46], 0.08, frame);
      box(0.34, 0.3, 0.1, 0.03, frame, sx * 0.66, 0.42, 2.46).rotation.y = sx * 0.36;
      tube([sx * 0.95, 0.8, 2.05], [sx * 1.1, 0.44, 2.5], 0.06, frame); // and a stay from the corner of the body to its outer end
      for (const dx of [0.14, 0.3])
        box(0.08, 0.3, 0.03, 0.01, paint, sx * (0.86 + dx), 0.33, 2.89 - dx * 0.36).rotation.z = sx * 0.3; // its stripes
      box(0.07, 0.24, 1.5, 0.02, chrome, sx * 1.04, 0.44, -0.2); // a steel sill plate
      box(0.05, 0.5, 0.5, 0.02, dark, sx * 1.2, 1.1, -1.7); // a dark panel towards the tail
      exhaust([sx * 0.82, 1.9, -1.05], [sx * 0.88, 1.98, -2.55], 0.21); // the silencer
      const tip = add((g.bruteTip2 ||= new THREE.CylinderGeometry(0.14, 0.17, 0.3, 16)), trim, sx * 0.885, 1.99, -2.66);
      tip.rotation.x = Math.PI / 2;
      // the chevron on the door: two white slashes and a dark one
      const chev = (G.bruteK ||= (() => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 128;
        const x = c.getContext('2d');
        // a big angular K: a leaning stem, an arm up and a leg down, in white on a dark slash
        x.fillStyle = '#3b3542';
        x.beginPath();
        for (const [px, py] of [
          [20, 124],
          [96, 4],
          [250, 4],
          [174, 124],
        ])
          x.lineTo(px, py);
        x.fill();
        x.fillStyle = '#f2f2ee';
        for (const pts of [
          [
            [60, 116],
            [112, 12],
            [146, 12],
            [94, 116],
          ],
          [
            [128, 62],
            [196, 12],
            [236, 12],
            [150, 76],
          ],
          [
            [134, 70],
            [160, 60],
            [206, 116],
            [168, 116],
          ],
        ]) {
          x.beginPath();
          for (const [px, py] of pts) x.lineTo(px, py);
          x.fill();
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({ map: t, transparent: true });
      })());
      const pv = add((g.bruteHoles ||= new THREE.PlaneGeometry(0.62, 0.36)), holes, sx * 1.207, 0.98, -1.1); // the perforated panel
      pv.rotation.y = (sx * Math.PI) / 2;
      pv.castShadow = false;
      const m = add((g.bruteChevG2 ||= new THREE.PlaneGeometry(1.5, 0.66)), chev, sx * 1.207, 1.08, -0.15);
      m.rotation.y = (sx * Math.PI) / 2;
      m.castShadow = false;
      tube([sx * 1.1, 1.56, 0.78], [sx * 1.34, 1.9, 0.84], 0.035, black); // a mirror on its stalk
      box(0.09, 0.24, 0.36, 0.03, paint, sx * 1.38, 1.98, 0.84);
      tube([sx * 1.05, 1.52, 0.86], [sx * 0.98, 2.08, 0.56], 0.045, black); // the screen's post
    }
    add((g.bigShackle ||= new THREE.TorusGeometry(0.13, 0.045, 8, 16)), paint, 0, 0.3, 2.78).rotation.y = Math.PI / 2; // the tow hook
    // (the hook hangs from the cross-beam that ties the two blades' horns together, under the grille)
    tube([-0.66, 0.46, 2.46], [0.66, 0.46, 2.46], 0.085, frame);
    box(0.3, 0.22, 0.16, 0.04, frame, 0, 0.46, 2.5);
    tube([0, 0.46, 2.5], [0, 0.36, 2.7], 0.06, frame);
    for (const sx of [-1, 1]) tube([sx * 0.3, 0.46, 2.46], [sx * 0.3, 0.72, 2.3], 0.06, frame); // the beam's hangers, up into the nose
    tube([-0.98, 2.08, 0.56], [0.98, 2.08, 0.56], 0.045, black);
    add((g.bruteGlass2 ||= new THREE.PlaneGeometry(1.98, 0.62)), glass, 0, 1.8, 0.71).rotation.x = -0.5; // the screen
  }

  if (V.bodyScale) {
    // these are big machines: the body above was drawn at a smaller size, and is built this much larger
    const bodyG = new THREE.Group();
    bodyG.scale.setScalar(V.bodyScale);
    for (const o of chassis.children.slice(firstPart)) bodyG.add(o);
    chassis.add(bodyG);
  }

  {
    const py = {
      kart: 0.5,
      buggy: 0.74,
      monster: 0.66,
      muscle: 0.62,
      rail: 0.78,
      raider: 0.96,
      roadster: 0.92,
      brute: 0.95,
    }[type];
    root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, py + V.ride + 0.07, -12), new THREE.Vector3(0, 0, 1)),
      hits = ray.intersectObjects(chassis.children, true);
    let z = hits.length ? hits[0].point.z - 0.03 : -V.base - 0.9;
    if (type === 'kart') {
      // the kart has no tail to carry it: a plate bracket stands on the rear bumper, out behind the engine
      const bz = -1.92;
      for (const sx of [-1, 1]) {
        tube([sx * 0.34, 0.3, -1.78], [sx * 0.34, 0.42, bz + 0.04], 0.035, frame);
        tube([sx * 0.34, 0.3, -1.78], [sx * 0.2, 0.3, bz + 0.04], 0.03, frame);
      }
      box(1.0, 0.6, 0.06, 0.03, black, 0, py + 0.05 - 0.3, bz + 0.04).position.y = py;
      z = bz;
    }
    const holder = new THREE.Mesh((g.plateHolder ||= roundedBox(0.86, 0.46, 0.05, 0.04, 2)), black);
    holder.position.set(0, py, z + 0.005);
    chassis.add(holder);
    const ps = custom?.plate || 'kano',
      metal = ps === 'gold' || ps === 'silver',
      pt = plateTex(ps);
    const face = new THREE.MeshStandardMaterial({
      map: pt,
      bumpMap: pt.userData.bump,
      bumpScale: 3,
      roughness: metal ? 0.25 : 0.45,
      metalness: metal ? 0.7 : 0.15,
      envMap: ENV.tex,
    });
    const edge = new THREE.MeshStandardMaterial({
      color: metal ? (ps === 'gold' ? '#c9962a' : '#aab2be') : '#d9dde4',
      roughness: 0.35,
      metalness: 0.8,
      envMap: ENV.tex,
    });
    const pl = new THREE.Mesh((g.plate3 ||= plateGeo()), [face, edge]);
    pl.name = 'plate';
    pl.position.set(0, py, z - 0.025);
    pl.rotation.y = Math.PI;
    chassis.add(pl);
  }
  // finishing detail per vehicle: a carbon-black lower half and the parts that make each one itself
  {
    const carbon = (G.carbonS ||= new THREE.MeshPhysicalMaterial({
      color: '#16181d',
      metalness: 0.3,
      roughness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      envMap: ENV.tex,
    }));
    if (type === 'buggy') {
      for (const sx of [-1, 1]) {
        // nerf bars between the wheels
        tube([sx * 1.02, 0.55, 1.0], [sx * 1.22, 0.5, 0.55], 0.05, chrome);
        tube([sx * 1.22, 0.5, 0.55], [sx * 1.22, 0.5, -0.95], 0.05, chrome);
        tube([sx * 1.22, 0.5, -0.95], [sx * 1.0, 0.55, -1.3], 0.05, chrome);
        box(0.12, 0.2, 2.0, 0.05, carbon, sx * 0.93, 0.45, -0.15); // the black rocker
      }
      const head = add(
        (g.bHead ||= new THREE.CylinderGeometry(0.16, 0.16, 0.55, 14).rotateZ(Math.PI / 2)),
        chrome,
        0,
        0.92,
        -1.55,
      );
      head.scale.set(1.4, 1, 1); // the engine's cylinder heads
      add((g.bFilt ||= new THREE.CylinderGeometry(0.24, 0.24, 0.14, 20)), chrome, 0, 1.12, -1.62); // the chrome air filter
      box(0.12, 0.26, 0.3, 0.04, carbon, 0, 0.4, 2.42); // tow hook mount
      tube([0, 0.42, 2.5], [0, 0.3, 2.62], 0.04, frame);
    } else if (type === 'monster') {
      for (const sx of [-1, 1]) {
        tube([sx * 1.32, 0.1, 0.9], [sx * 1.32, 0.1, -0.6], 0.07, chrome);
        box(0.3, 0.06, 1.4, 0.02, carbon, sx * 1.32, 0.14, 0.15);
      } // side steps
      for (const sx of [-1, 1]) tube([sx * 1.14, 1.36, -1.05], [sx * 1.14, 1.36, -2.15], 0.05, chrome); // bed rails
      box(0.7, 0.18, 0.55, 0.08, carbon, 0, 1.3, 1.25); // hood scoop
      box(2.3, 0.14, 4.3, 0.06, carbon, 0, 0.2, 0); // the black lower body
    } else if (type === 'muscle') {
      for (const sx of [-1, 1]) {
        tube([sx * 1.1, 0.4, 1.0], [sx * 1.1, 0.4, -1.0], 0.06, black);
        for (const z of [0.8, 0, -0.8]) tube([sx * 1.1, 0.4, z], [sx * 0.95, 0.5, z], 0.04, black); // rock sliders
        for (let k = 0; k < 3; k++) box(0.06, 0.05, 0.32, 0.02, carbon, sx * 1.2, 0.72 + k * 0.09, 0.95); // the side vents behind the front wheels
      }
    }
  }

  // wheels: pivot (steers) > spinner (rolls) > tyre + wheel
  const wheels = [],
    steer = [];
  for (const [sx, sz, front] of [
    [-1, 1, 1],
    [1, 1, 1],
    [-1, -1, 0],
    [1, -1, 0],
  ]) {
    const r = front ? V.wf : V.wr,
      pivot = new THREE.Group();
    pivot.position.set(sx * V.track, r + 0.07, sz * V.base);
    rig.add(pivot); // on the road's surface
    const spin = new THREE.Group();
    pivot.add(spin);
    const tk = custom?.tyre || (type === 'kart' ? 'slick' : type === 'muscle' ? 'off' : 'off'),
      rs = custom?.rim || 'classic';
    const ww = front ? V.wwf || V.ww : V.ww;
    // every vehicle wears a show wheel: a bolted ring in the wheel's colour, spokes by the rim style chosen in the
    // garage, a centre cap, deep inside the tyre
    // (the wheel's colour: the vehicle's own if it has one, otherwise its paint, so each car's wheels go with its body
    // and follow it when it's repainted)
    const hsl = new THREE.Color(paintCol).getHSL({}),
      gold = rs === 'gold',
      rimCol = gold ? '#e3b23c' : V.rim || (hsl.l < 0.16 ? '#c3c8cf' : paintCol), // (silver on a near-black car: dark wheels in dark tyres don't read; gold wheels are gold)
      rimMat = (G['rim' + rimCol + gold] ||= new THREE.MeshStandardMaterial({
        color: rimCol,
        metalness: gold ? 0.95 : 0.55,
        roughness: gold ? 0.18 : 0.3,
        envMap: ENV.tex,
        envMapIntensity: 1,
      }));
    {
      const RIMS = {
          classic: [5, 0.2, 'dark'],
          mesh: [12, 0.07],
          disc: [20, 0.17],
          turbo: [7, 0.18],
          gold: [10, 0.11],
        }, // [spokes, how wide, 'dark' for dark spokes inside a coloured ring]
        [nSpokes, spokeW, spokeIn] = rs === 'classic' && V.wheelStyle ? V.wheelStyle : RIMS[rs] || RIMS.classic,
        R = r * (V.balloon ? 0.66 : 0.62),
        sw = showWheel(R, ww * (V.balloon ? 1.0 : 0.96), nSpokes, spokeW),
        dark = (G.wheelDark ||= new THREE.MeshStandardMaterial({
          color: '#232428',
          metalness: 0.5,
          roughness: 0.5,
          envMap: ENV.tex,
        }));
      for (const [geo, mat] of [
        [sw.barrel, dark],
        [sw.ring, rimMat],
        [sw.bolts, chrome],
        [sw.spokes, spokeIn === 'dark' ? dark : rimMat],
        [sw.caps, spokeIn === 'dark' ? rimMat : trim],
      ]) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        spin.add(m);
      }
      if (V.balloon) {
        // a fat tyre; with off-road rubber, big lugs standing off the tread
        const bt = balloonTyre(r, ww),
          carcass = new THREE.Mesh(bt.tyre, rubberMat(tk));
        carcass.castShadow = carcass.receiveShadow = true;
        spin.add(carcass);
        if (tk === 'off') {
          const lugs = new THREE.Mesh(
            bt.lugs,
            (G.lugS ||= new THREE.MeshStandardMaterial({ color: '#2b2a2c', roughness: 0.92 })),
          );
          lugs.castShadow = true;
          spin.add(lugs);
        }
      } else {
        const t = new THREE.Mesh(tyre(r, ww), rubberMat(tk));
        t.castShadow = t.receiveShadow = true;
        spin.add(t);
      }
    }
    if (type === 'rail' && !front)
      // paddle tyres: scoops standing across the tread, all the way round
      for (let q = 0; q < 12; q++) {
        const a = (q / 12) * Math.PI * 2,
          pd = new THREE.Mesh((g.railPaddle ||= roundedBox(ww * 0.92, 0.2, 0.1, 0.03, 2)), black);
        pd.position.set(0, Math.cos(a) * (r + 0.03), Math.sin(a) * (r + 0.03));
        pd.rotation.x = a + 0.35; // leaning into the dig
        pd.castShadow = true;
        spin.add(pd);
      }
    // a brake drum inside the rim (it doesn't turn with the wheel's steering here: it rides the pivot)
    const drum = new THREE.Mesh((g.drum ||= new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(Math.PI / 2)), frame);
    drum.scale.set(ww * 0.5, r * 0.42, r * 0.42);
    pivot.add(drum); // the brake disc
    const cal = new THREE.Mesh((g.caliper ||= roundedBox(0.5, 0.5, 0.5, 0.1, 2)), trim);
    cal.scale.set(ww * 0.55, r * 0.22, r * 0.3);
    cal.position.set(0, r * 0.4, -r * 0.12);
    pivot.add(cal); // the caliper, in the accent colour
    wheels.push({ spin, r });
    if (front) steer.push(pivot);
  }

  // the running gear: an axle across under the body at each end, and two arms out to each wheel's hub, so every wheel
  // is held by the car (in the wheels' own frame, so they stay true while the body rocks on its springs)
  {
    const bodyHalf = {
      kart: 0.5,
      buggy: 0.85,
      monster: 1.1,
      muscle: 0.95,
      rail: 0.5,
      raider: 1.15,
      roadster: 1.1,
      brute: 1.0,
    }[type];
    for (const sz of [-1, 1]) {
      const r = sz > 0 ? V.wf : V.wr,
        hy = r + 0.07,
        hubX = V.track - (sz > 0 ? V.wwf || V.ww : V.ww) / 2 - 0.1,
        z = sz * V.base;
      if (type !== 'monster') tube([-hubX, hy, z], [hubX, hy, z], type === 'kart' ? 0.05 : 0.065, frame, rig); // the axle (the monster has its own)
      if (type !== 'monster')
        for (const sx of [-1, 1]) {
          const cy = V.ride + 0.07 + (type === 'kart' ? 0.2 : 0.45);
          tube([sx * hubX, hy + r * 0.25, z], [sx * bodyHalf, cy + 0.15, z + sz * 0.02], 0.035, frame, rig); // upper arm
          tube([sx * hubX, hy - r * 0.25, z], [sx * bodyHalf, cy - 0.15, z - sz * 0.12], 0.045, frame, rig); // lower arm
          if (type !== 'kart')
            tube(
              [sx * (hubX - 0.05), hy, z - sz * 0.05],
              [sx * (bodyHalf - 0.05), cy + 0.35, z - sz * 0.25],
              0.06,
              chrome,
              rig,
            ); // the shock absorber
          {
            // a coil spring round it, in the vehicle's colour (or the racer's accent)
            const a0 = new THREE.Vector3(sx * (hubX - 0.05), hy, z - sz * 0.05),
              b0 = new THREE.Vector3(sx * (bodyHalf - 0.05), cy + 0.35, z - sz * 0.25),
              dir = b0.clone().sub(a0).normalize(),
              sm = V.spring
                ? (G['spring' + V.spring] ||= new THREE.MeshStandardMaterial({
                    color: V.spring,
                    metalness: 0.4,
                    roughness: 0.35,
                    envMap: ENV.tex,
                  }))
                : trim;
            for (let q = 0; q < 7; q++) {
              const ring = new THREE.Mesh((g.coil ||= new THREE.TorusGeometry(0.115, 0.03, 8, 18)), sm);
              ring.position.lerpVectors(a0, b0, 0.22 + q * 0.09);
              ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
              ring.castShadow = true;
              rig.add(ring);
            }
          }
        }
    }
  }

  // Buddy in a bucket seat; the steering wheel on a column that runs down into the floor (kart) or the dash
  const seat = new THREE.Group();
  seat.position.set(...V.seat);
  chassis.add(seat);
  const robot = new Robot(def.fur, def.ear, layers);
  robot.root.scale.setScalar(V.buddy);
  seat.add(robot.root);
  // a real bucket seat you can see from any side: a tall charcoal shell leaning back, wrapped round him by side
  // bolsters, tan leather inserts on the back and the cushion, harness straps in the accent colour
  const [shellCol, leatherCol] = V.seatCol || ['#2b2f38', '#b98a5c'];
  const shell = (g['seatShell' + shellCol] ||= new THREE.MeshStandardMaterial({
    color: shellCol,
    roughness: 0.55,
    metalness: 0.1,
  }));
  const leather = (g['seatLeather' + leatherCol] ||= new THREE.MeshStandardMaterial({
    color: leatherCol,
    roughness: 0.6,
  }));
  {
    const back = new THREE.Group();
    back.position.set(0, 0.1, -0.5);
    back.rotation.x = -0.2;
    seat.add(back);
    box(1.0, 0.92, 0.14, 0.06, shell, 0, 0.46, 0, back); // the shell
    box(0.6, 0.74, 0.04, 0.02, leather, 0, 0.45, 0.08, back); // the leather insert
    for (const sx of [-1, 1]) {
      box(0.17, 0.78, 0.3, 0.07, shell, sx * 0.43, 0.4, 0.12, back); // side bolsters, round his ribs
      box(0.1, 0.7, 0.02, 0.01, trim, sx * 0.17, 0.48, 0.105, back); // harness straps
    }
  }
  box(1.0, 0.14, 0.86, 0.05, shell, 0, 0.07, -0.1, seat); // the base
  box(0.64, 0.08, 0.7, 0.04, leather, 0, 0.17, -0.08, seat); // the cushion
  for (const sx of [-1, 1]) box(0.17, 0.24, 0.82, 0.06, shell, sx * 0.43, 0.2, -0.1, seat); // thigh bolsters
  // the nitro kit: twin bottles strapped upright behind the seat, in the nitro colour, chrome valves, red hand-wheels
  const nitroKit = new THREE.Group();
  nitroKit.name = 'nitroKit';
  seat.add(nitroKit);
  {
    const col = custom?.nitro || '#4fb0ff';
    for (const sx of [-1, 1]) {
      const b = nitroBottle(col);
      b.scale.setScalar(0.33);
      b.position.set(sx * 0.2, 0.12, -0.9);
      nitroKit.add(b);
    }
    for (const y of [0.18, 0.4]) box(0.62, 0.04, 0.05, 0.02, black, 0, 0.12 + y, -0.74, nitroKit); // the straps across them
  }
  const wheelHub = new THREE.Group();
  wheelHub.position.set(...V.wheel);
  wheelHub.rotation.x = V.tilt;
  chassis.add(wheelHub);
  const wheelRing = add((g.wheelT ||= new THREE.TorusGeometry(V.wheelR, 0.045, 10, 28)), black, 0, 0, 0, wheelHub);
  add((g.wheelX ||= new THREE.BoxGeometry(V.wheelR * 1.9, 0.05, 0.04)), black, 0, 0, 0, wheelRing);
  add(
    (g.wheelC ||= new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14).rotateX(Math.PI / 2)),
    trim,
    0,
    0,
    0.02,
    wheelRing,
  );
  {
    // the column: from the wheel's centre straight out of its back to the floor or dash
    const hub = new THREE.Vector3(...V.wheel),
      dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), V.tilt); // the wheel faces the driver; its back points along -dir
    const end = hub.clone().addScaledVector(dir, -1).multiplyScalar(1);
    end.copy(hub).sub(dir.clone().multiplyScalar(1)); // placeholder, set below
    const toward =
      type === 'kart'
        ? new THREE.Vector3(0, 0.22, 1.12)
        : type === 'rail'
          ? new THREE.Vector3(0, 0.62, 1.75)
          : new THREE.Vector3(0, V.wheel[1] - 0.35, V.wheel[2] + 0.55);
    tube([hub.x, hub.y, hub.z], [toward.x, toward.y, toward.z], 0.045, frame);
    if (type !== 'kart' && type !== 'rail') box(1.4, 0.3, 0.4, 0.1, black, 0, toward.y - 0.05, toward.z + 0.1); // the dash it runs into
  }

  // roll cages (buggy, monster) built round Buddy's head, so they always clear him, tied down to the body
  root.updateMatrixWorld(true);
  const hb = new THREE.Box3().setFromObject(robot.head);
  const lowHoop = type === 'muscle' || type === 'raider' || type === 'roadster' || type === 'brute'; // a hoop behind the headrest, not over his head
  if (type !== 'kart') {
    // a roll hoop behind the seat, its feet inside the body (never over a wheel), braced back to the body
    const half = type === 'monster' ? 1.05 : type === 'rail' ? 1.0 : lowHoop ? 0.9 : 0.8,
      base = { monster: 0.95, muscle: 1.02, raider: 1.44, roadster: 1.4, brute: 1.7, rail: 1.1 }[type] || 0.78,
      top =
        (type === 'monster'
          ? hb.min.y + (hb.max.y - hb.min.y) * 0.45
          : lowHoop
            ? hb.min.y + (hb.max.y - hb.min.y) * 0.55
            : hb.max.y + 0.12) -
        V.ride -
        0.07,
      zb = hb.min.z - 0.22;
    for (const sx of [-1, 1]) {
      tube([sx * half, base, zb], [sx * half * 0.82, top - 0.25, zb], 0.06, black); // the hoop's legs
      tube([sx * half * 0.82, top - 0.25, zb], [sx * half * 0.6, top, zb], 0.06, black); // turning in over the top
      tube([sx * half * 0.75, top - 0.3, zb], [sx * half, base, zb - 1.0], 0.045, black); // brace back down to the body
      tube([sx * half, base, zb], [sx * half, base, zb - 1.0], 0.05, frame); // the rail it stands on
    }
    tube([-half * 0.6, top, zb], [half * 0.6, top, zb], 0.06, black);
    if (type === 'rail')
      for (const sx of [-1, 1]) tube([sx * 0.875, 1.05, 0.94], [sx * half * 0.6, top, zb], 0.05, black); // and forward over him to the dash bar
    if (type === 'monster') lightBar(0.95, 2.42, 1.3);
    if (type === 'muscle') for (let i = 0; i < 4; i++) lamp(-half * 0.45 + i * half * 0.3, top + 0.14, zb + 0.04, 0.12); // four lamps on the roll bar   // the monster's lights on the front bumper (the buggy's are in its fenders)
  }
  kartHead.set(root, hb);

  // drift sparks under the back wheels, the gun on the nose
  const sparks = [-1, 1].map(s => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex.glow,
        color: '#4cc3ff',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sp.position.set(s * V.track, 0.3, -V.base - 0.5);
    sp.visible = false;
    body.add(sp);
    return sp;
  });
  const gunAt = {
    kart: [0.55, 1.8],
    buggy: [1.3, 1.6],
    monster: [1.45, 1.6],
    muscle: [1.22, 1.9],
    rail: [1.25, 1.7],
    raider: [1.8, 2.1],
    roadster: [1.72, 1.95],
    brute: [1.6, 1.75],
  }[type];
  const gun = new THREE.Group();
  gun.position.set(0, gunAt[0], gunAt[1]);
  gun.scale.setScalar(0.8);
  gun.visible = false;
  chassis.add(gun);
  // the weapon pod: a pylon bolted to the nose, a rounded dark turret wearing an armour cowl in the weapon's colour
  // (gunMat: it changes with what you picked up), cooling vents across the cowl, and twin shrouded barrels with chrome
  // bores, dark muzzle brakes and tips that glow in the weapon colour
  const gunMat = new THREE.MeshPhongMaterial({
    color: '#6fd3ff',
    emissive: '#0b3a55',
    shininess: 100,
    specular: '#ffffff',
  });
  const gunGlow = new THREE.MeshBasicMaterial({ color: '#bff0ff' });
  const gpart = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    gun.add(m);
    return m;
  };
  gpart((g.gunPylon ||= roundedBox(0.26, 0.34, 0.36, 0.06, 2)), frame, 0, -0.24, -0.05); // the pylon
  gpart((g.gunBody ||= roundedBox(0.92, 0.34, 0.78, 0.15, 3)), frame, 0, 0, 0); // the turret
  gpart((g.gunCowl ||= roundedBox(0.8, 0.1, 0.66, 0.05, 2)), gunMat, 0, 0.2, 0.02); // its armour cowl
  for (const z of [-0.16, 0, 0.16]) gpart((g.gunVent ||= roundedBox(0.5, 0.04, 0.06, 0.02, 1)), G.dark, 0, 0.26, z); // cooling vents
  gpart((g.gunCap ||= roundedBox(0.7, 0.24, 0.1, 0.05, 2)), G.dark, 0, -0.01, -0.42); // the rear cap
  for (const sx of [-1, 1]) {
    gpart(
      (g.gunShroud ||= new THREE.CylinderGeometry(0.15, 0.17, 0.78, 16).rotateX(Math.PI / 2)),
      gunMat,
      sx * 0.32,
      0.02,
      0.32,
    ); // barrel shroud
    gpart(
      (g.gunBore ||= new THREE.CylinderGeometry(0.075, 0.075, 0.62, 14).rotateX(Math.PI / 2)),
      chrome,
      sx * 0.32,
      0.02,
      0.9,
    ); // the barrel
    gpart(
      (g.gunBrake ||= new THREE.CylinderGeometry(0.11, 0.11, 0.14, 14).rotateX(Math.PI / 2)),
      G.dark,
      sx * 0.32,
      0.02,
      1.14,
    ); // muzzle brake
    gpart(
      (g.gunTip ||= new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14).rotateX(Math.PI / 2)),
      gunGlow,
      sx * 0.32,
      0.02,
      1.22,
    ); // the glowing bore
    for (const bz of [-0.22, 0.22])
      gpart((g.gunBolt ||= new THREE.SphereGeometry(0.035, 8, 6)), chrome, sx * 0.4, 0.14, bz); // bolts
  }
  const muzzle = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex.glow, color: '#9fe4ff', blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  muzzle.position.set(0, 0.02, 1.32);
  muzzle.scale.set(1.6, 1.6, 1);
  muzzle.visible = false;
  gun.add(muzzle);

  // the decal over the paint
  if (custom?.decal && custom.decal !== 'none') {
    paint.map = decalTex(paintCol, custom.decal);
    paint.color.set('#ffffff');
    paint.needsUpdate = true;
    const meshes = [];
    root.traverse(o => {
      if (o.isMesh && o.material === paint) meshes.push(o);
    });
    if (custom.decal === 'stripes') for (const o of meshes) topUV(o, chassis);
    else if (custom.decal === 'camo') for (const o of meshes) boxUV(o.geometry);
    else sideUV(meshes, chassis);
  }
  const kart = {
    nitroCol: custom?.nitro || '#4fb0ff',
    type,
    V,
    root,
    rig,
    body,
    chassis,
    seat,
    robot,
    wheelRing,
    wheelR: V.wheelR,
    wheels,
    steer,
    pipes,
    flames,
    sparks,
    fc: robot.fc,
    ftex: robot.ftex,
    expr: '',
    gun,
    gunMat,
    muzzle,
  };
  setFace(kart, 'calm');
  return kart;
}

// for checking: every part of a vehicle that reaches into Buddy's head (should be none)
const kartHead = new WeakMap();
export function clearance(k) {
  const hb = kartHead.get(k.root).clone().expandByScalar(-0.08),
    hits = [],
    b = new THREE.Box3();
  k.root.updateMatrixWorld(true);
  k.root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p === k.robot.root) return; // Buddy himself
    b.setFromObject(o);
    if (!b.intersectsBox(hb)) return;
    const pos = o.geometry.attributes.position,
      v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (hb.containsPoint(v)) {
        hits.push(
          o.geometry.type +
            ' at ' +
            v
              .toArray()
              .map(q => q.toFixed(2))
              .join(','),
        );
        return;
      }
    }
  });
  return hits;
}

// the eyes on the visor
export function setFace(k, expr) {
  if (k.expr === expr) return;
  k.expr = expr;
  const x = k.fc.getContext('2d'),
    w = 256,
    h = 160,
    L = [84, 72],
    R = [172, 72];
  x.clearRect(0, 0, w, h);
  x.save();
  x.shadowColor = 'rgba(255,225,170,.95)';
  x.shadowBlur = 16;
  x.strokeStyle = x.fillStyle = '#fff4dc';
  x.lineCap = x.lineJoin = 'round';
  x.lineWidth = 14;
  const pill = (cx, cy) => {
    x.beginPath();
    x.roundRect(cx - 15, cy - 25, 30, 50, 15);
    x.fill();
  };
  const line = pts => {
    x.beginPath();
    pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.stroke();
  };
  if (expr === 'calm') {
    pill(...L);
    pill(...R);
  } else if (expr === 'blink') {
    line([
      [L[0] - 16, L[1]],
      [L[0] + 16, L[1]],
    ]);
    line([
      [R[0] - 16, R[1]],
      [R[0] + 16, R[1]],
    ]);
  } else if (expr === 'happy') {
    for (const [cx, cy] of [L, R]) {
      x.beginPath();
      x.arc(cx, cy + 14, 22, Math.PI * 1.15, Math.PI * 1.85);
      x.stroke();
    }
  } else if (expr === 'boost') {
    line([
      [L[0] - 14, L[1] - 20],
      [L[0] + 14, L[1]],
      [L[0] - 14, L[1] + 20],
    ]);
    line([
      [R[0] + 14, R[1] - 20],
      [R[0] - 14, R[1]],
      [R[0] + 14, R[1] + 20],
    ]);
  } else if (expr === 'laugh') {
    for (const [cx, cy] of [L, R]) {
      x.beginPath();
      x.arc(cx, cy + 16, 22, Math.PI * 1.1, Math.PI * 1.9);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(98, 104);
    x.quadraticCurveTo(128, 150, 158, 104);
    x.closePath();
    x.fill();
  } else if (expr === 'sad') {
    for (const [cx, cy] of [L, R]) {
      x.beginPath();
      x.arc(cx, cy - 4, 20, Math.PI * 0.15, Math.PI * 0.85);
      x.stroke();
    }
    x.beginPath();
    x.arc(128, 122, 16, Math.PI * 1.2, Math.PI * 1.8);
    x.stroke();
    x.fillStyle = '#6fd3ff';
    x.beginPath();
    x.ellipse(L[0] + 6, L[1] + 34, 5, 8, 0, 0, Math.PI * 2);
    x.fill();
  } else if (expr === 'hit') {
    for (const [cx, cy] of [L, R]) {
      line([
        [cx - 15, cy - 15],
        [cx + 15, cy + 15],
      ]);
      line([
        [cx + 15, cy - 15],
        [cx - 15, cy + 15],
      ]);
    }
  }
  if (['calm', 'happy', 'blink', 'boost'].includes(expr) && expr !== 'sad') {
    x.lineWidth = 9;
    x.beginPath();
    x.arc(128, 96, 20, Math.PI * 0.18, Math.PI * 0.82);
    x.stroke();
  } // the smile
  if (expr === 'hit') {
    x.lineWidth = 8;
    x.beginPath();
    for (let i = 0; i <= 6; i++) x.lineTo(104 + i * 8, 116 + (i % 2 ? -5 : 5));
    x.stroke();
  }
  x.restore();
  x.fillStyle = 'rgba(255,90,120,.5)';
  for (const cx of [56, 200]) {
    x.beginPath();
    x.ellipse(cx, 122, 20, 10, 0, 0, Math.PI * 2);
    x.fill();
  }
  k.ftex.needsUpdate = true;
}
