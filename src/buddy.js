// Buddy, the DeFleet robot, at the wheel of a chunky buggy. Same character as DeFleet's robot3d.js: a big rounded head in
// dense orange fur, a glossy black glass visor with glowing eyes, glossy ear cups, a small furry body with three dots.
// The fur is drawn as stacked shells (each one keeps only the strands that reach it), the same idea as the original,
// kept light enough for a phone.
import * as THREE from 'three';
import { clamp } from './util.js';
import { starKnot, loopKnot, diamondBand, kanoHorns } from './textures.js';
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
// the monster's pickup body: cab and bed on one tub, a raised hood, the cab open (a roll cage goes over it)
const monsterF = (x, y, z) => {
  let d = rbox(x, y - 0.55, z, 1.22, 0.42, 2.25, 0.3);
  d = smin(d, rbox(x, y - 1.0, z - 1.25, 1.05, 0.24, 0.9, 0.2), 0.2); // the hood
  d = smax(d, -rbox(x, y - 1.25, z + 0.45, 0.9, 0.55, 0.75, 0.2), 0.08); // the cab, open
  d = smax(d, -rbox(x, y - 1.15, z + 1.55, 1.0, 0.45, 0.55, 0.12), 0.06); // the bed
  return d;
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
// the rally car, as a distance field: x to the left, y up, z forward
const rallyF = (x, y, z) => {
  let d = rbox(x, y - 0.95, z, 1.12, 0.42, 2.15, 0.4);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) d = smin(d, blob(x - sx * 1.22, y - 1.0, z - sz * 1.48, 0.5, 0.52, 0.9), 0.35);
  d = smin(d, blob(x, y - 1.15, z - 1.55, 0.95, 0.32, 0.75), 0.3); // the hood, rising to the windscreen
  let cab = blob(x, y - 1.35, z + 0.35, 1.02, 0.82, 1.4);
  cab = smax(cab, -(y - 1.05), 0.12);
  d = smin(d, cab, 0.3);
  d = smax(d, -rbox(x, y - 2.0, z + 0.45, 1.0, 0.9, 0.95, 0.32), 0.14); // the open roof where Buddy sits
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      d = smax(d, -cap(x, y, z, [sx * 0.95, 0.62, sz * 1.48], [sx * 2.2, 0.62, sz * 1.48], 0.8), 0.07); // wheel arches
  return smax(d, -(y - 0.38), 0.06);
};

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
  { id: 'zaki', name: 'Zaki', fur: '#e8336a', ear: '#ff7a9a', kart: '#f2c654', trim: '#1d2a6b', veh: 'monster' },
  { id: 'tauraro', name: 'Tauraro', fur: '#3a7bfd', ear: '#7cc4ff', kart: '#f6f0e4', trim: '#e8336a', veh: 'buggy' },
  { id: 'kibiya', name: 'Kibiya', fur: '#2ec4b6', ear: '#9bf6ff', kart: '#ff6a00', trim: '#f6f0e4', veh: 'kart' },
  { id: 'gimbiya', name: 'Gimbiya', fur: '#ff6a00', ear: '#ff8a2a', kart: '#1f8a4c', trim: '#ffe066', veh: 'muscle' },
  { id: 'dodo', name: 'Dodo', fur: '#5c677d', ear: '#a3c4f3', kart: '#6fd3ff', trim: '#131517', veh: 'monster' },
];

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
const furVS = `uniform float uL, uLen; varying vec3 vO; varying vec3 vN;
void main(){ vO = position; vN = normalize(mat3(modelMatrix) * normal);
  vec3 p = position + normal * uL * uLen; p.y -= uL * uL * uLen * .35;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;
const furFS = `uniform float uL, uF; uniform vec3 uC, uSun; varying vec3 vO; varying vec3 vN;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 q = vO * uF; vec3 c = floor(q); float n = h3(c); vec3 f = fract(q) - .5 - (vec3(h3(c + 3.1), h3(c + 7.7), h3(c + 1.3)) - .5) * .45;
  if (uL > 0.) { if (n < uL * .9) discard; if (length(f) > (1. - uL) * .8 + .06) discard; }
  float d = max(dot(normalize(vN), uSun), 0.);
  vec3 col = uC * (.45 + .7 * uL) * (.55 + .8 * d + .12 * vN.y);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
function furMats(color, layers, len, freq = 38) {
  const uC = { value: new THREE.Color(color) },
    uSun = { value: SUN };
  return Array.from(
    { length: layers },
    (_, l) =>
      new THREE.ShaderMaterial({
        uniforms: { uL: { value: l / (layers - 1) }, uLen: { value: len }, uF: { value: freq }, uC, uSun },
        vertexShader: furVS,
        fragmentShader: furFS,
      }),
  );
}
function furry(parent, geo, mats, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  mats.forEach((m, l) => {
    const s = new THREE.Mesh(geo, m);
    if (l === 0) s.castShadow = true;
    g.add(s);
  });
  parent.add(g);
  return g;
}

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
  paint: [
    ['#d63a2f', 'Kano Red', 0],
    ['#2ec4b6', 'Lagoon', 0],
    ['#ffc22e', 'Harmattan', 0],
    ['#1d2a6b', 'Indigo', 0],
    ['#f4f1ea', 'Chalk', 120],
    ['#16181d', 'Midnight', 150],
    ['#1f8a4c', 'Naija Green', 0],
    ['#8a5cff', 'Grape', 180],
    ['#ff6a00', 'Buddy Orange', 200],
    ['#c0c6d0', 'Chrome', 300],
  ],
  rim: [
    ['classic', 'Classic', 0],
    ['mesh', 'Mesh', 250],
    ['disc', 'Disc', 250],
    ['turbo', 'Turbo', 400],
  ],
  tyre: [
    ['road', 'Road', 0],
    ['off', 'Off-road', 0],
    ['slick', 'Slick', 200],
    ['white', 'Whitewall', 300],
  ],
  decal: [
    ['none', 'None', 0],
    ['stripes', 'Racing Stripes', 0],
    ['flames', 'Flames', 250],
    ['tiger', 'Tiger', 300],
    ['camo', 'Camo', 300],
    ['starknot', 'Star Knot', 350],
    ['loopknot', 'Loop Knot', 350],
    ['band', 'Diamond Band', 300],
    ['horns', 'Kano Horns', 400],
    ['checker', 'Chequer', 350],
  ],
  plate: [
    ['kano', 'Kano', 0],
    ['silver', 'Silver', 150],
    ['midnight', 'Midnight', 200],
    ['naija', 'Naija', 250],
    ['buddy', 'Buddy Orange', 250],
    ['gold', 'Gold', 500],
  ],
  nitro: [
    ['#4fb0ff', 'Blue', 0],
    ['#ff7a1a', 'Fire', 150],
    ['#b45cff', 'Violet', 200],
    ['#3dff8a', 'Toxic', 250],
    ['#ff3b6b', 'Ruby', 250],
    ['#ffffff', 'White Hot', 400],
  ],
};
// number plates: the Kano plate and its special editions. One drawing, painted twice: once in colour (the map) and once
// in white-on-grey (the bump), so the border, the badge and every letter stand up off the plate like a pressed tin plate
const plateCache = {};
export function plateTex(style = 'kano') {
  if (plateCache[style]) return plateCache[style];
  const F = '"Barlow Condensed", Arial Narrow, sans-serif';
  const P = {
    kano: {
      bg: ['#ffffff', '#eef6f0'],
      line: 'rgba(31,138,76,.10)',
      rim: '#1f8a4c',
      head: '#1f8a4c',
      num: '#13204f',
      foot: '#1f8a4c',
    },
    naija: {
      bg: ['#ffffff', '#f1f8f3'],
      line: 'rgba(0,135,81,.13)',
      rim: '#008751',
      head: '#008751',
      num: '#0b3d24',
      foot: '#008751',
      band: true,
    },
    silver: {
      bg: ['#f4f6fa', '#b9c0cc', '#e9edf3'],
      line: 'rgba(40,48,62,.08)',
      rim: '#4a5262',
      head: '#4a5262',
      num: '#1b1f28',
      foot: '#4a5262',
      shine: true,
    },
    gold: {
      bg: ['#fff1b0', '#d9a632', '#f6d978'],
      line: 'rgba(90,55,0,.10)',
      rim: '#7a4d06',
      head: '#7a4d06',
      num: '#3a2400',
      foot: '#7a4d06',
      shine: true,
    },
    midnight: {
      bg: ['#141b2e', '#0b0f1a'],
      line: 'rgba(111,211,255,.07)',
      rim: '#6fd3ff',
      head: '#6fd3ff',
      num: '#e9f6ff',
      foot: '#6fd3ff',
    },
    buddy: {
      bg: ['#ff8a1f', '#ff6a00'],
      line: 'rgba(255,255,255,.09)',
      rim: '#fff4dc',
      head: '#fff4dc',
      num: '#ffffff',
      foot: '#fff4dc',
    },
  }[style];
  const draw = (x, bump) => {
    const ink = c => (bump ? '#fff' : c);
    if (bump) {
      x.fillStyle = '#5a5a5a';
      x.fillRect(0, 0, 512, 256);
    } else {
      const g = x.createLinearGradient(0, 0, 0, 256);
      P.bg.forEach((c, i) => g.addColorStop(i / (P.bg.length - 1), c));
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 256);
      x.strokeStyle = P.line;
      x.lineWidth = 3; // the fine security waves printed under everything
      for (let k = -4; k < 22; k++) {
        x.beginPath();
        for (let i = 0; i <= 64; i++) {
          const px = i * 8,
            py = k * 14 + Math.sin(i * 0.22 + k * 0.5) * 9 + px * 0.12;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
    }
    if (P.band) {
      // Naija: a green header band that is part of the plate, not a sticker on it
      x.save();
      x.beginPath();
      x.roundRect(16, 16, 480, 224, 18);
      x.clip();
      x.fillStyle = bump ? '#6a6a6a' : '#008751';
      x.fillRect(16, 16, 480, 58);
      x.restore();
    }
    x.strokeStyle = ink(P.rim);
    x.lineWidth = 10;
    x.beginPath();
    x.roundRect(16, 16, 480, 224, 18);
    x.stroke(); // the pressed rim
    // the badge on the left: the green-white-green flag in a shield
    {
      const bx = 34,
        by = P.band ? 96 : 84,
        bw = 54,
        bh = 70;
      x.save();
      x.beginPath();
      x.moveTo(bx, by);
      x.lineTo(bx + bw, by);
      x.lineTo(bx + bw, by + bh * 0.62);
      x.quadraticCurveTo(bx + bw, by + bh, bx + bw / 2, by + bh);
      x.quadraticCurveTo(bx, by + bh, bx, by + bh * 0.62);
      x.closePath();
      if (bump) {
        x.fillStyle = '#c8c8c8';
        x.fill();
      } else {
        x.clip();
        x.fillStyle = '#008751';
        x.fillRect(bx, by, bw / 3, bh);
        x.fillStyle = '#ffffff';
        x.fillRect(bx + bw / 3, by, bw / 3, bh);
        x.fillStyle = '#008751';
        x.fillRect(bx + (bw * 2) / 3, by, bw / 3, bh);
      }
      x.restore();
      x.strokeStyle = ink(P.rim);
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(bx, by);
      x.lineTo(bx + bw, by);
      x.lineTo(bx + bw, by + bh * 0.62);
      x.quadraticCurveTo(bx + bw, by + bh, bx + bw / 2, by + bh);
      x.quadraticCurveTo(bx, by + bh, bx, by + bh * 0.62);
      x.closePath();
      x.stroke();
    }
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    if (P.band) {
      x.fillStyle = bump ? '#fff' : '#ffffff';
      x.font = `800 34px ${F}`;
      x.fillText('FEDERAL REPUBLIC OF NIGERIA', 256, 58);
    } else {
      x.fillStyle = ink(P.head);
      x.font = `800 40px ${F}`;
      x.fillText('KANO', 280, 66);
    }
    x.fillStyle = ink(P.num);
    x.font = `900 ${P.band ? 86 : 108}px ${F}`;
    x.fillText(P.band ? 'KAN 001 GUK' : 'GUK 001', P.band ? 296 : 284, 176);
    x.fillStyle = ink(P.foot);
    x.font = `700 26px ${F}`;
    x.fillText(P.band ? 'KANO · CENTRE OF COMMERCE' : 'CENTRE OF COMMERCE', 280, 222);
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
// a decal pattern drawn over the paint colour (box-projected over the body)
const decalTexCache = {};
export function decalTex(paint, decal) {
  const key = paint + decal;
  if (decalTexCache[key]) return decalTexCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d'),
    ink = DECAL_INK(paint),
    R = (a, b) => a + Math.random() * (b - a);
  x.fillStyle = paint;
  x.fillRect(0, 0, 512, 512);
  x.fillStyle = x.strokeStyle = ink;
  if (decal === 'stripes') {
    x.fillRect(196, 0, 44, 512);
    x.fillRect(272, 0, 44, 512);
  } else if (decal === 'checker') {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
  } else if (decal === 'tiger') {
    x.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y = i * 38 + R(-8, 8);
      x.lineWidth = R(10, 22);
      x.beginPath();
      x.moveTo(0, y);
      x.quadraticCurveTo(R(120, 260), y + R(-30, 30), R(220, 380), y + R(10, 40));
      x.stroke();
    }
  } else if (decal === 'camo') {
    for (let i = 0; i < 70; i++) {
      x.globalAlpha = 0.9;
      x.beginPath();
      x.ellipse(R(0, 512), R(0, 512), R(20, 60), R(12, 34), R(0, 3), 0, 7);
      x.fill();
    }
    x.globalAlpha = 1;
  } else if (decal === 'flames') {
    for (let i = 0; i < 9; i++) {
      const y0 = i * 60;
      x.beginPath();
      x.moveTo(0, y0);
      for (let k = 0; k < 5; k++) {
        x.quadraticCurveTo(80 + k * 70, y0 - 30 + (k % 2) * 60, 140 + k * 70, y0 + (k % 2 ? 10 : -10));
      }
      x.lineTo(0, y0 + 40);
      x.fill();
    }
  } else if (decal === 'starknot' || decal === 'loopknot') {
    const pal = ['rgba(0,0,0,.28)', 'rgba(255,255,255,.18)', ink],
      f = decal === 'starknot' ? starKnot : loopKnot;
    for (const [cx, cy] of [
      [128, 128],
      [384, 384],
    ])
      f(x, cx, cy, 190, pal);
  } else if (decal === 'band') {
    const pal = ['rgba(0,0,0,.28)', 'rgba(255,255,255,.18)', ink];
    diamondBand(x, 0, 512, 150, 110, pal);
    diamondBand(x, 0, 512, 406, 110, pal);
  } else if (decal === 'horns') {
    for (const [cx, cy] of [
      [128, 128],
      [384, 384],
    ])
      kanoHorns(x, cx, cy, 170, ink);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (decalTexCache[key] = t);
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
};

// the three vehicles: wheel sizes, ride height, how the body is built. Stats live in race.js
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
    tilt: -0.42,
    wheelR: 0.27,
  },
  buggy: {
    name: 'Buggy',
    note: 'Big tyres, happy off the road',
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
    tilt: -0.42,
    wheelR: 0.27,
  },
  monster: {
    name: 'Monster',
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
    tilt: -0.42,
    wheelR: 0.27,
  },
  muscle: {
    name: 'Muscle',
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
    tilt: -0.42,
    wheelR: 0.27,
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
  const faceMat = rs === 'mesh' ? chrome : rs === 'disc' ? silver : rs === 'turbo' ? black : gun;
  g.barrel ||= new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).rotateZ(Math.PI / 2);
  part(g.barrel, black, ww * 0.78, R0 * 0.98, R0 * 0.98); // the barrel, deep inside
  for (const sx of [-1, 1]) {
    const lip = part(g.lip, chrome, ww * 1.2, R0, R0);
    lip.position.x = sx * face; // the polished lip
    const plate = part(g.rim, faceMat, 0.06, R0 * 0.3, R0 * 0.3);
    plate.position.x = sx * (face - 0.05); // the hub plate
    if (rs === 'disc') {
      const d = part(g.rim, faceMat, 0.05, R0 * 0.94, R0 * 0.94);
      d.position.x = sx * (face - 0.07);
    } else {
      const n = rs === 'mesh' ? 12 : rs === 'turbo' ? 7 : 5,
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
  const paintCol = custom?.paint || def.kart,
    chromePaint = paintCol === '#c0c6d0';
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
    color: def.trim,
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
  const plate = (x, y, z, ry = Math.PI, rx = 0) => {
    const p = new THREE.Mesh(g.plate, new THREE.MeshBasicMaterial({ map: tex.plate }));
    p.position.set(x, y, z);
    p.rotation.set(rx, ry, 0);
    chassis.add(p);
  };
  const T = V.track,
    B = V.base;

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
  } else {
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
  }

  {
    const py = { kart: 0.5, buggy: 0.74, monster: 0.66, muscle: 0.62 }[type];
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
      const filt = add((g.bFilt ||= new THREE.CylinderGeometry(0.24, 0.24, 0.14, 20)), chrome, 0, 1.12, -1.62); // the chrome air filter
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
    spin.add(buildWheel(r, V.ww, rs, tk, trim, chrome, black));
    // a brake drum inside the rim (it doesn't turn with the wheel's steering here: it rides the pivot)
    const drum = new THREE.Mesh((g.drum ||= new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(Math.PI / 2)), frame);
    drum.scale.set(V.ww * 0.5, r * 0.42, r * 0.42);
    pivot.add(drum); // the brake disc
    const cal = new THREE.Mesh((g.caliper ||= roundedBox(0.5, 0.5, 0.5, 0.1, 2)), trim);
    cal.scale.set(V.ww * 0.55, r * 0.22, r * 0.3);
    cal.position.set(0, r * 0.4, -r * 0.12);
    pivot.add(cal); // the caliper, in the accent colour
    wheels.push({ spin, r });
    if (front) steer.push(pivot);
  }

  // the running gear: an axle across under the body at each end, and two arms out to each wheel's hub, so every wheel
  // is held by the car (in the wheels' own frame, so they stay true while the body rocks on its springs)
  {
    const bodyHalf = { kart: 0.5, buggy: 0.85, monster: 1.1, muscle: 0.95 }[type];
    for (const sz of [-1, 1]) {
      const r = sz > 0 ? V.wf : V.wr,
        hy = r + 0.07,
        hubX = V.track - V.ww / 2 - 0.1,
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
  const shell = (g.seatShell ||= new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.55, metalness: 0.1 }));
  const leather = (g.seatLeather ||= new THREE.MeshStandardMaterial({ color: '#b98a5c', roughness: 0.6 }));
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
      type === 'kart' ? new THREE.Vector3(0, 0.22, 1.12) : new THREE.Vector3(0, V.wheel[1] - 0.35, V.wheel[2] + 0.55);
    tube([hub.x, hub.y, hub.z], [toward.x, toward.y, toward.z], 0.045, frame);
    if (type !== 'kart') box(1.4, 0.3, 0.4, 0.1, black, 0, toward.y - 0.05, toward.z + 0.1); // the dash it runs into
  }

  // roll cages (buggy, monster) built round Buddy's head, so they always clear him, tied down to the body
  root.updateMatrixWorld(true);
  const hb = new THREE.Box3().setFromObject(robot.head);
  if (type === 'buggy' || type === 'monster' || type === 'muscle') {
    // a roll hoop behind the seat, its feet inside the body (never over a wheel), braced back to the body
    const half = type === 'monster' ? 1.05 : type === 'muscle' ? 0.9 : 0.8,
      base = type === 'monster' ? 0.95 : type === 'muscle' ? 1.02 : 0.78,
      top =
        (type === 'monster'
          ? hb.min.y + (hb.max.y - hb.min.y) * 0.45
          : type === 'muscle'
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
  const gunAt = { kart: [0.55, 1.8], buggy: [1.3, 1.6], monster: [1.45, 1.6], muscle: [1.22, 1.9] }[type];
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
    for (const o of meshes) custom.decal === 'stripes' ? topUV(o, chassis) : boxUV(o.geometry);
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
