// The Vehicle Studio (/studio.html): each vehicle on a live 3D stage with Buddy at the wheel, the road running under it
// and three rivals round it (two ahead, the leader furthest, and one behind) so its special power, a knockout, can be
// played out and seen taking them out: flipped, spun, blown off the road, lifted.
// Every number about how it drives and what its power does lives in src/vehicles.js, the single source of truth: tune
// it here, PLAY to see it, SAVE TO GAME to race with it in this browser, COPY to paste it back into the code. The FIT
// card says whether any part reaches into Buddy's head. A design tool, not in the build.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTextures, setAniso } from './textures.js';
import { makeKart, RACERS, ENV, setFace, DEFAULT_CUSTOM, VEHICLES, clearance } from './buddy.js';
import {
  VSTATS,
  VSTATS_BASE,
  STAT_INFO,
  POWERS,
  POWERS_BASE,
  READY_AFTER,
  powerPose,
  powerLength,
  applyTunes,
} from './vehicles.js';
import { store } from './util.js';

const $ = s => document.querySelector(s);
const IDS = Object.keys(VSTATS_BASE);
let type = new URLSearchParams(location.search).get('v') || 'roadster';
if (!IDS.includes(type)) type = 'kart';

/* ---------- the stage ---------- */
const canvas = $('#gl'),
  R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.NeutralToneMapping;
setAniso(8);
ENV.tex = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
const S = new THREE.Scene();
S.background = new THREE.Color('#0a1028');
S.fog = new THREE.Fog('#0a1028', 30, 90);
S.add(new THREE.HemisphereLight('#dfe8ff', '#2a2440', 1.5));
const key = new THREE.DirectionalLight('#fff1dd', 3);
key.position.set(6, 14, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 60 });
S.add(key);
const rim = new THREE.DirectionalLight('#6fa0ff', 2);
rim.position.set(-6, 4, -8);
S.add(rim);
const tex = buildTextures();
const roadT = tex.road.clone();
roadT.needsUpdate = true;
roadT.wrapS = roadT.wrapT = THREE.RepeatWrapping;
roadT.repeat.set(1, 8);
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 160).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ map: roadT }),
);
road.receiveShadow = true;
S.add(road);
const kerbT = tex.curb.clone();
kerbT.needsUpdate = true;
kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping;
kerbT.repeat.set(1, 50);
for (const sx of [-1, 1]) {
  const k = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 160).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: kerbT }),
  );
  k.position.set(sx * 12, 0.01, 0);
  k.receiveShadow = true;
  S.add(k);
}
const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 300);
cam.position.set(11, 5, 12);
const orbit = new OrbitControls(cam, canvas);
orbit.target.set(0, 1.4, 0);
orbit.enableDamping = true;
orbit.enablePan = false;
orbit.minDistance = 7;
orbit.maxDistance = 40;
orbit.maxPolarAngle = Math.PI * 0.49;

const shadowsOn = root =>
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
// your car on a rig the power moves; the two rivals in the next lane, one ahead and one behind
const rig = new THREE.Group();
S.add(rig);
let car = null,
  thrusters = null;
// the Roadster's four thrusters, hidden under the car: a nozzle at each corner of the floor that drops out and fires a
// jet straight down (a hot core, a blue flame, a glow on the road under it)
// a vertical fade, bright at the top to nothing at the bottom, for the jets
const fadeTex = (() => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();
function makeThrusters(root) {
  const box = new THREE.Box3().setFromObject(root),
    sz = box.getSize(new THREE.Vector3()),
    xs = sz.x * 0.3,
    zs = sz.z * 0.3,
    y0 = box.min.y + 0.32,
    metal = new THREE.MeshStandardMaterial({ color: '#2a2e36', metalness: 0.9, roughness: 0.3 }),
    rim = new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 1, roughness: 0.2 }),
    out = [];
  for (const [x, z] of [
    [xs, zs],
    [-xs, zs],
    [xs, -zs],
    [-xs, -zs],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.34, 20, 1, true), metal);
    bell.material.side = THREE.DoubleSide;
    bell.position.y = -0.17;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 24).rotateX(Math.PI / 2), rim);
    ring.position.y = -0.34;
    // the jet: a soft column of light (a hot core inside a wider glow), bright at the nozzle and fading as it reaches
    // the ground; 1 m long, stretched to the ground each frame
    const col = (r0, r1, op) =>
      new THREE.Mesh(
        new THREE.CylinderGeometry(r0, r1, 1, 24, 1, true).translate(0, -0.5, 0),
        new THREE.MeshBasicMaterial({
          color: '#ff7ad9',
          map: fadeTex,
          transparent: true,
          opacity: op,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
    const jet = col(0.3, 0.42, 0.75),
      core = col(0.14, 0.2, 1);
    core.material.color.set('#ffe1f6');
    jet.position.y = core.position.y = -0.34;
    g.add(bell, ring, core, jet);
    g.scale.setScalar(0.001);
    root.add(g);
    out.push({ g, core, jet });
  }
  return out;
}
function buildCar() {
  if (car) rig.remove(car.root);
  car = makeKart(RACERS[0], tex, 14, type, DEFAULT_CUSTOM[type]);
  shadowsOn(car.root);
  rig.add(car.root);
  setFace(car, 'happy');
  for (let i = 0; i < 40; i++)
    car.robot.update(0.05, { t: i, steer: 0, wheel: car.wheelRing, wheelR: car.wheelR, speed: 0.4 });
  thrusters = type === 'roadster' ? makeThrusters(car.root) : null;
  // a soft disc over each wheel's face that fades in at speed: the spokes blurred
  for (const w of car.wheels) {
    const r = w.r || 0.4,
      blur = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.62, 24).rotateZ(Math.PI / 2), // (across the wheel, both faces)
        new THREE.MeshBasicMaterial({ color: '#2a2c33', transparent: true, opacity: 0, depthWrite: false }),
      );
    w.spin.parent.add(blur);
    blur.position.copy(w.spin.position);
    w.blur = blur;
  }
  bladeZ = new THREE.Box3().setFromObject(car.root).max.z;
  cannon = null;
  if (type === 'brute' && car.gun) {
    cannon = makeCannon();
    cannon.position.copy(car.gun.position);
    cannon.visible = false;
    car.gun.parent.add(cannon);
  }
  const fit = clearance(car);
  $('#fit').className = 'fit ' + (fit.length ? 'bad' : 'ok');
  $('#fit').textContent = fit.length
    ? `${fit.length} part(s) touching: ${fit.join(', ')}`
    : 'CLEAR: nothing touches Buddy';
}
// the rivals, at their place relative to you (x across the road, z ahead): one ahead in the next lane, the leader
// further on in yours, one behind. A power that makes you faster closes on them (they slip back); a knockout sets one
// tumbling (ko: flip, spin, blown, lift) and it picks itself up and drops back into place after
const RIV = [
  { def: RACERS[2], x: -6, z: 16 },
  { def: RACERS[3], x: 3, z: 30, leader: true },
  { def: RACERS[4], x: 4, z: -14 },
];
const rivals = RIV.map(r => {
  const m = makeKart(r.def, tex, 10, 'kart', DEFAULT_CUSTOM.kart);
  shadowsOn(m.root);
  S.add(m.root);
  setFace(m, 'calm');
  return { ...r, x0: r.x, z0: r.z, m, ko: null };
});
const resetRivals = () => {
  for (const r of rivals) Object.assign(r, { x: r.x0, z: r.z0, ko: null, harpooned: false, thrown: 0, aim: null });
};

/* ---------- effects ---------- */
const puffT = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const puffs = Array.from({ length: 800 }, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false }));
  s.visible = false;
  S.add(s);
  return { s, life: 0, v: new THREE.Vector3(), grow: 1, decay: 1.1, drift: 0.6 };
});
let puffI = 0;
// a soft sprite: colour, size, how fast it drifts and grows, how fast it fades (decay), and how much the road carries
// it back (drift: 1 stays where it was laid on the road, 0 keeps up with the car)
function puff(at, col, size, vel, grow = 1.6, decay = 1.1, drift = 0.6) {
  const p = puffs[puffI++ % puffs.length];
  p.s.position.copy(at);
  p.s.material.color.set(col);
  p.s.scale.setScalar(size);
  p.life = 1;
  p.v.copy(vel);
  p.grow = grow;
  p.decay = decay;
  p.drift = drift;
  p.s.visible = true;
}
const additive = (color, o = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: o,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
// the ground's shockwave (EARTHQUAKE's wave, SKY ROCKET's landing), and the crack racing along the road
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 1, 72).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
);
ring.position.y = 0.15;
ring.visible = false;
S.add(ring);
const ring2 = ring.clone();
ring2.material = ring.material.clone();
ring2.material.color.set('#ff6a00');
S.add(ring2);
const crack = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#1a1206', transparent: true }),
);
crack.position.y = 0.05;
crack.visible = false;
S.add(crack);
// SUPERSONIC: the vapour cone (the white cloud that wraps a jet at the sound barrier: a cone of mist from the nose
// back, densest at its edge, shimmering), the boom's burst of condensation, and shock diamonds in the exhaust
const mistTex = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const v = Math.random();
    x.fillStyle = `rgba(255,255,255,${0.04 + v * 0.1})`;
    x.beginPath();
    x.arc(Math.random() * 128, Math.random() * 64, 2 + v * 6, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();
const vapour = new THREE.Mesh(
  new THREE.ConeGeometry(2.4, 4.2, 48, 6, true).rotateX(-Math.PI / 2).translate(0, 1.1, -0.8),
  new THREE.MeshBasicMaterial({
    color: '#ffffff',
    map: mistTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
rig.add(vapour);
const diamonds = new THREE.Group();
for (let i = 0; i < 5; i++) {
  const d = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22 - i * 0.025, 0).scale(1, 1, 2.4),
    additive(i % 2 ? '#ffd9a0' : '#9fe4ff', 0.9),
  );
  d.position.z = -2.3 - i * 0.55;
  diamonds.add(d);
}
diamonds.position.y = 0.55;
diamonds.visible = false;
rig.add(diamonds);
// BEACH BALL: a volley of giant striped beach balls (each its own colours), thrown out across the whole road
const ballTex = cols => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  cols.forEach((col, i) => {
    x.fillStyle = col;
    x.fillRect((i * 512) / cols.length, 0, 512 / cols.length + 1, 256);
  });
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 512, 18);
  x.fillRect(0, 238, 512, 18);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const BALL_COLS = [
  ['#e8232b', '#ffffff', '#1f6fe8', '#ffd21f', '#ffffff', '#21b04b'],
  ['#ff7ac2', '#ffffff', '#24c6e0', '#ffffff'],
  ['#ff8a1f', '#ffffff', '#7a3fe0', '#ffffff', '#ffd21f', '#ffffff'],
  ['#21b04b', '#ffd21f', '#e8232b', '#ffffff'],
];
// where each goes: across the road, how big, when it's thrown, how fast, how high it bounces
const balls = Array.from({ length: 9 }, (_, i) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshStandardMaterial({ map: ballTex(BALL_COLS[i % BALL_COLS.length]), roughness: 0.35 }),
  );
  m.castShadow = true;
  m.visible = false;
  S.add(m);
  return {
    m,
    x: -10 + (i / 8) * 20 + (Math.random() - 0.5) * 2,
    r: 0.8 + Math.random() * 0.9,
    at: i * 0.08,
    v: 0.8 + Math.random() * 0.5,
    hop: 4 + Math.random() * 3,
    z: -99,
  };
});
// HARPOON: a heavy telescopic boom (three nested steel sections, yellow and black hazard bands on the last) with a big
// claw on its end: two curved steel jaws. It pivots at the Raider's nose; its length and swing are set each frame
const boom = new THREE.Group(),
  boomParts = [];
{
  const steel = new THREE.MeshStandardMaterial({ color: '#59606b', metalness: 0.85, roughness: 0.3 }),
    paint = new THREE.MeshStandardMaterial({ color: '#f2b705', metalness: 0.3, roughness: 0.5 }),
    chrome = new THREE.MeshStandardMaterial({ color: '#e8ecf2', metalness: 1, roughness: 0.12 });
  // three sections, each 1 m long along +z (stretched to share the length), thinner as they go
  [0.34, 0.26, 0.19].forEach((r, i) => {
    const sec = new THREE.Mesh(new THREE.BoxGeometry(r * 2, r * 2, 1).translate(0, 0, 0.5), i === 1 ? paint : steel);
    boom.add(sec);
    boomParts.push(sec);
  });
  const claw = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16).rotateZ(Math.PI / 2), steel);
  claw.add(hub);
  for (const sd of [-1, 1]) {
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.13, 8, 20, Math.PI * 0.85), chrome);
    jaw.rotation.set(0, sd > 0 ? 0 : Math.PI, Math.PI / 2);
    jaw.position.set(sd * 0.25, 0, 0.55);
    claw.add(jaw);
  }
  boom.add(claw);
  boomParts.push(claw);
}
boom.visible = false;
S.add(boom);
// the boom at base, turned to yaw, L long: its sections sliding out one inside the next, the claw on the end
function setBoom(base, yaw, L) {
  L = Math.max(0.3, L);
  boom.position.copy(base);
  boom.rotation.set(0, yaw, 0);
  boomParts.forEach((m, i) => {
    if (i < 3) {
      m.position.z = (L / 3) * i * 0.92;
      m.scale.z = L / 3 + 0.25;
    } else m.position.z = L;
  });
}

// CANNON FIRE: a real cannon on the car's own weapon mount (on its nose, where every weapon you pick up sits): a black
// iron barrel with reinforcing rings, a swelled muzzle and the knob at its breech, on trunnions in a wooden carriage
// bolted to the mount; and the iron cannonballs it fires
function makeCannon() {
  const g = new THREE.Group(),
    iron = new THREE.MeshStandardMaterial({ color: '#1f2228', metalness: 0.8, roughness: 0.42 }),
    wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.8 }),
    bolt = new THREE.MeshStandardMaterial({ color: '#9aa1ab', metalness: 1, roughness: 0.3 });
  // the barrel: a lathe profile from the breech knob to the swelled muzzle, along +z
  const prof = [
    [0, -0.95],
    [0.1, -0.95],
    [0.12, -0.88],
    [0.07, -0.82],
    [0.24, -0.78],
    [0.3, -0.7],
    [0.3, -0.55],
    [0.27, -0.5],
    [0.27, -0.2],
    [0.24, -0.15],
    [0.22, 0.6],
    [0.25, 0.66],
    [0.25, 0.72],
    [0.21, 0.76],
    [0.24, 0.86],
    [0.27, 0.95],
    [0.16, 0.95],
    [0.16, 0.6],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 28).rotateX(Math.PI / 2), iron);
  barrel.position.y = 0.42;
  barrel.castShadow = true;
  const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.72, 12).rotateZ(Math.PI / 2), iron);
  trunnion.position.set(0, 0.42, -0.1);
  // the carriage: two cheeks of timber, iron straps over the trunnions, a bed bolted down to the mount
  for (const sx of [-0.3, 0.3]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 1.1), wood);
    cheek.position.set(sx, 0.2, -0.2);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), iron);
    strap.position.set(sx, 0.43, -0.1);
    g.add(cheek, strap);
  }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.1), wood);
  bed.position.set(0, 0, -0.2);
  for (const [bx, bz] of [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, -0.65],
    [0.25, -0.65],
  ]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), bolt);
    b.position.set(bx, 0.07, bz);
    g.add(b);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.42, 1.0);
  g.add(barrel, trunnion, bed, muzzle);
  g.userData = { barrel, muzzle };
  return g;
}
let cannon = null;
const cannonballs = Array.from({ length: 12 }, () => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 20, 14),
    new THREE.MeshStandardMaterial({ color: '#1d2026', metalness: 0.7, roughness: 0.4 }),
  );
  m.castShadow = true;
  m.visible = false;
  S.add(m);
  return { m, t: -1, x: 0, z: 0, y: 0 };
});
let shotsFired = 0;
// the lock-on: a red ring with ticks over the rival a cannonball is hunting
const reticleTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#ff2a3a';
  x.lineWidth = 8;
  x.beginPath();
  x.arc(64, 64, 44, 0, Math.PI * 2);
  x.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
    x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
})();
const reticles = Array.from({ length: 3 }, () => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTex, transparent: true, depthTest: false }));
  sp.scale.setScalar(3.2);
  sp.visible = false;
  S.add(sp);
  return sp;
});

/* ---------- the panels ---------- */
$('#veh').innerHTML = IDS.map(
  v => `<button class="slant ${v === type ? 'on' : ''}" data-v="${v}">${VEHICLES[v].name.toUpperCase()}</button>`,
).join('');
$('#veh').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  type = b.dataset.v;
  history.replaceState(null, '', '?v=' + type);
  document.querySelectorAll('#veh button').forEach(x => x.classList.toggle('on', x === b));
  paint();
};
const fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
const fmt = (v, step) => (+v).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0);
function paint() {
  buildCar();
  stop();
  const V = VEHICLES[type],
    P = POWERS[type],
    B = POWERS_BASE[type];
  $('#vName').textContent = V.name.toUpperCase();
  $('#vNote').textContent = V.note;
  $('#vChips').innerHTML = `<span>${V.price ? 'PRICE <b>' + V.price.toLocaleString('en') + '</b>' : 'FREE'}</span>`;
  $('#powName').textContent = P.name;
  $('#powLine').textContent = P.line;
  const chips = () =>
    ($('#powChips').innerHTML =
      `<span>ONCE A RACE</span><span>READY AFTER <b>${READY_AFTER} S</b></span><span>LASTS <b>${powerLength(type).toFixed(1)} S</b></span><span>HITS <b>${POWERS[type].hits}</b></span>`);
  chips();
  // the power's numbers, and how long it takes to charge
  $('#powSl').innerHTML = Object.entries(B.p)
    .map(
      ([k, [, name, min, max, step]]) =>
        `<label class="sl"><span>${name}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${P[k]}"><output>${fmt(P[k], step)}</output></label>`,
    )
    .join('');
  // its handling
  $('#statSl').innerHTML = Object.entries(STAT_INFO)
    .map(
      ([k, I]) =>
        `<label class="sl"><span>${I.name}</span><input type="range" data-s="${k}" min="${I.min}" max="${I.max}" step="${I.step}" value="${VSTATS[type][k]}"><output>${fmt(VSTATS[type][k], I.step)}</output></label>`,
    )
    .join('');
  document.querySelectorAll('.sliders input').forEach(fill);
  lineup();
  $('#powSl').oninput = e => {
    const k = e.target.dataset.k;
    POWERS[type][k] = +e.target.value;
    e.target.nextElementSibling.textContent = fmt(e.target.value, +e.target.step);
    fill(e.target);
    chips();
  };
  $('#statSl').oninput = e => {
    VSTATS[type][e.target.dataset.s] = +e.target.value;
    e.target.nextElementSibling.textContent = fmt(e.target.value, +e.target.step);
    fill(e.target);
    lineup();
  };
}
// all eight side by side on each number, this one lit
function lineup() {
  $('#lineup').innerHTML = Object.entries(STAT_INFO)
    .map(([k, I]) => {
      const bars = IDS.map(id => {
        const u = (VSTATS[id][k] - I.min) / (I.max - I.min);
        return `<i class="${id === type ? 'me' : ''}" style="height:${Math.round(12 + u * 88)}%" title="${VEHICLES[id].name}"></i>`;
      }).join('');
      return `<div class="lr"><span>${I.name}</span><div class="bars">${bars}</div></div>`;
    })
    .join('');
}
// what's different from the defaults, to save or copy
function diff() {
  const out = { stats: {}, power: {} },
    B = POWERS_BASE[type];
  for (const k of Object.keys(STAT_INFO))
    if (Math.abs(VSTATS[type][k] - VSTATS_BASE[type][k]) > 1e-6) out.stats[k] = VSTATS[type][k];
  for (const [k, [v]] of Object.entries(B.p)) if (Math.abs(POWERS[type][k] - v) > 1e-6) out.power[k] = POWERS[type][k];
  return out;
}
$('#save').onclick = () => {
  store.set('vehicleTune.' + type, diff());
  $('#msg').textContent = `Saved the ${VEHICLES[type].name}. The game uses it in this browser now.`;
};
$('#reset').onclick = () => {
  store.remove('vehicleTune.' + type);
  applyTunes();
  paint();
  $('#msg').textContent = `The ${VEHICLES[type].name} is back to its defaults.`;
};
$('#copy').onclick = async () => {
  const txt = JSON.stringify({ [type]: { stats: VSTATS[type], power: POWERS[type] } });
  try {
    await navigator.clipboard.writeText(txt);
    $('#msg').textContent = 'Copied: ' + txt;
  } catch {
    $('#msg').textContent = txt;
  }
};

/* ---------- playing the power ---------- */
let playT = -1,
  surge = 0, // (how far the car has pulled ahead of its place, with a power's speed)
  bladeZ = 2.4; // (where the front of the car is)
const stop = () => {
  playT = -1;
  $('#play').textContent = 'PLAY THE POWER';
};
$('#play').onclick = () => {
  playT = 0;
  resetRivals();
  // (powers thrown at the road ahead are watched from behind the car, looking down the road after them)
  if (type === 'buggy' || type === 'raider') {
    cam.position.set(6, 6.5, -13);
    orbit.target.z = 9;
  } else if (type === 'brute') {
    // (from the side, a little behind: the cannon on its nose in view, and its shots away down the road)
    cam.position.set(13, 5, -5);
    orbit.target.z = 7;
  } else orbit.target.z = 0;
  $('#play').textContent = 'PLAYING';
};
addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    $('#play').click();
  }
});

/* ---------- the loop ---------- */
const v3 = new THREE.Vector3(),
  BASE = 28; // the road's speed under you
let last = performance.now();
const ease = u => u * u * (3 - 2 * u);
// a knockout landing on a rival: how it tumbles (flip, spin, blown, lift) and which way
const knock = (r, type, side = r.x >= 0 ? 1 : -1) => {
  if (!r.ko) r.ko = { type, t: 0, side };
};
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let pose = null;
  if (playT >= 0) {
    playT += dt;
    pose = powerPose(type, playT);
    $('#tl').style.width = Math.min(100, (playT / powerLength(type)) * 100) + '%';
    if (!pose) {
      stop();
      $('#tl').style.width = '0%';
    }
  }
  const p = pose || { y: 0, pitch: 0, roll: 0, yaw: 0, squash: 1, boost: 1, fx: {} },
    P = POWERS[type],
    speed = BASE * p.boost;
  roadT.offset.y -= (speed * dt) / 20;
  kerbT.offset.y -= (speed * dt) / 3;
  if (car) {
    // every power is a burst of speed, and it shows: the car surges ahead of where it sat, its tyres spin to a blur
    // (capped so they don't strobe backwards), and the rear wheels throw dust and grit up behind
    const fast = Math.max(0, p.boost - 1);
    for (const w of car.wheels) {
      w.spin.rotation.x += Math.min(0.9, (speed * dt) / (w.r || 0.4));
      if (w.blur) w.blur.material.opacity = Math.min(0.55, fast * 0.6);
    }
    surge += (fast * 3 - surge) * Math.min(1, dt * 3);
    rig.position.z = surge;
    if (fast > 0.05 && p.y < 0.5)
      for (const w of car.wheels) {
        w.spin.getWorldPosition(v3);
        if (v3.z < surge)
          puff(
            v3.setY(0.35),
            '#c9bfae',
            0.8 + fast,
            new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random(), -8 - fast * 10),
            1.8,
            1.8,
            0.9,
          );
      }
    rig.position.y = p.y;
    rig.rotation.set(-p.pitch, p.yaw, p.roll, 'YXZ');
    rig.scale.set(1, p.squash, 1);
    // on the road (not flying), never through it: the lowest wheel kept on the surface, so a wheelie pivots on the back
    // wheels and a dive on the front ones
    if (p.y < 0.5 && Math.abs(p.roll) < 0.3) {
      rig.updateMatrixWorld(true);
      let low = Infinity;
      for (const w of car.wheels) low = Math.min(low, w.spin.getWorldPosition(v3).y - (w.r || 0.4));
      if (low < 0) rig.position.y -= low;
    }
    car.flames.forEach(fl => {
      fl.visible = !!p.fx.flame;
      if (fl.visible) {
        fl.material.color.set(p.fx.rocket ? '#9fe4ff' : car.nitroCol || '#ff8a2a');
        fl.scale.set(1.3, (p.fx.rocket ? 2.2 : 1.2) + Math.random() * 0.7, 1.3);
      }
    });
    if (p.fx.rocket && Math.random() < 0.8)
      puff(
        car.root.localToWorld(v3.set((Math.random() - 0.5) * 1.2, 0.6, -2)),
        '#ffd9a8',
        0.9,
        new THREE.Vector3(0, -2, -10),
      );
    if (p.fx.smoke)
      for (const sx of [-1, 1])
        puff(
          car.root.localToWorld(v3.set(sx * 1.1, 0.3, -1.6)),
          '#e8e8ee',
          1.2 + Math.random(),
          new THREE.Vector3(sx * 1.5, 1.2, -6),
          2.2,
        );
    if (p.fx.sand)
      for (let i = 0; i < 2; i++)
        puff(
          car.root.localToWorld(v3.set((Math.random() - 0.5) * 2.4, 0.4, -2)),
          '#d9b77a',
          1.2 + Math.random(),
          new THREE.Vector3((Math.random() - 0.5) * 3, 3, -10),
          2.4,
        );
    // the Roadster's four thrusters
    if (thrusters) {
      const dep = p.fx.deploy || 0,
        th = (p.fx.thrust || 0) * dep;
      for (const t of thrusters) {
        t.g.scale.setScalar(Math.max(0.001, dep));
        t.jet.visible = t.core.visible = th > 0.02;
        if (!t.jet.visible) continue;
        // down to the ground (at most 7 m), flickering a little; a cloud of smoke spreading where it hits the road
        t.g.getWorldPosition(v3);
        const reach = Math.min(7, Math.max(0.6, v3.y)) * (0.8 + th * 0.2),
          fl = 0.94 + Math.random() * 0.12;
        t.jet.scale.set(fl, reach, fl);
        t.core.scale.set(1, reach * 0.85, 1);
        t.jet.material.opacity = 0.75 * th;
        if (v3.y < 8 && Math.random() < 0.7 * th)
          puff(
            v3.setY(0.4),
            '#d9dde8',
            2 + Math.random() * 1.5,
            new THREE.Vector3((Math.random() - 0.5) * 14, 0.6, (Math.random() - 0.5) * 14),
            1.8,
            0.7,
            0.5,
          );
      }
    }
    // SUPERSONIC: the vapour cone wrapping the car, shimmering; the boom's burst of condensation at the start; shock
    // diamonds in the exhaust; dust blasted off the road either side
    const son = p.fx.sonic;
    vapour.material.opacity = son != null ? Math.min(0.32, son * 1.2) * (0.85 + Math.random() * 0.15) : 0;
    if (son != null) {
      mistTex.offset.x += dt * 3;
      mistTex.offset.y -= dt * 1.5;
      vapour.scale.set(1 + Math.sin(now / 40) * 0.03, 1 + Math.sin(now / 40) * 0.03, 1);
    }
    diamonds.visible = son != null;
    if (son != null) {
      diamonds.children.forEach((d, i) => (d.material.opacity = 0.6 + 0.4 * Math.sin(now / 30 + i)));
      // the boom: a ring of condensation bursting out round the car, then mist clinging to the cone's rim
      if (son < 0.25)
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          puff(
            v3.set(Math.cos(a) * 2.2, 1.1 + Math.sin(a) * 1.8, -0.5),
            '#ffffff',
            1 + Math.random(),
            new THREE.Vector3(Math.cos(a) * 10, Math.sin(a) * 7, -3),
            1.8,
            2.2,
            0.3,
          );
        }
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        puff(
          car.root.localToWorld(v3.set(Math.cos(a) * 2.3, 1.1 + Math.sin(a) * 2, -2.6)),
          '#ffffff',
          0.7 + Math.random() * 0.6,
          new THREE.Vector3(Math.cos(a) * 2, Math.sin(a) * 2, -14),
          1.2,
          2.8,
          0.9,
        );
      }
      for (const sx of [-1, 1])
        puff(v3.set(sx * 2.4, 0.3, -1), '#d8cdb8', 1.2, new THREE.Vector3(sx * 10, 1, -4), 2, 1.4, 0.8);
    }
    // WHEELIE LAUNCH: fire pouring off the back tyres, licking up round them and streaming away behind
    if (p.fx.tyreFire)
      for (const w of car.wheels) {
        w.spin.getWorldPosition(v3);
        if (v3.z > surge - 0.2) continue; // (the back ones)
        const r = w.r || 0.4;
        for (let i = 0; i < 3; i++)
          puff(
            v3
              .clone()
              .add(new THREE.Vector3((Math.random() - 0.5) * 0.5, -r * 0.4 + Math.random() * r * 1.4, -r * 0.6)),
            ['#ff3d10', '#ff7a1a', '#ffc23a'][i],
            0.6 + Math.random() * 0.7,
            new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, -10 - Math.random() * 6),
            0.6,
            3.2,
            0.8,
          );
      }
    // FIRE TRAIL: flames left burning on the road behind the tyres
    if (p.fx.fire)
      for (const sx of [-0.9, 0.9])
        puff(
          car.root.localToWorld(v3.set(sx, 0.4, -1.8)).setY(0.6),
          Math.random() < 0.5 ? '#ff6a1a' : '#ffc23a',
          1.4 + Math.random(),
          new THREE.Vector3(0, 1.2, 0),
          0.3,
          1 / P.burn,
          1,
        );
    // BEACH BALL: the volley thrown out ahead, the balls bounding down the road, rolling, fanning out across it
    for (const b of balls) {
      const t = p.fx.ball != null ? p.fx.ball - b.at : -1;
      b.m.visible = t > 0;
      if (!b.m.visible) continue;
      const R = b.r * (P.size / 3.2),
        z = 2 + t * (P.speed * b.v - BASE * p.boost),
        bounce = Math.abs(Math.sin(t * b.hop)) * 2.6 * Math.max(0.2, 1 - t / 3);
      b.m.scale.setScalar(R);
      b.m.position.set(b.x * Math.min(1, t * 2), R + bounce, z);
      b.m.rotation.x += dt * ((P.speed * b.v) / R) * 0.5;
      b.z = z;
    }
    // EARTHQUAKE: the shaking wave rolling out, the crack racing ahead; SKY ROCKET's landing blast
    const q = p.fx.quake ?? (p.fx.land != null ? p.fx.land : null),
      qR = p.fx.quake != null ? P.radius : P.blast;
    ring.visible = ring2.visible = q != null;
    if (q != null) {
      const r = 1 + q * qR;
      ring.scale.set(r, 1, r);
      ring2.scale.set(r * 0.8, 1, r * 0.8);
      ring.material.opacity = ring2.material.opacity = 1 - q;
      if (Math.random() < 0.8)
        puff(v3.set(Math.cos(now) * r, 0.5, Math.sin(now) * r), '#d8c8a8', 2.5, new THREE.Vector3(0, 2, 0), 1.5);
    }
    crack.visible = p.fx.quake != null;
    if (crack.visible) {
      const L = p.fx.quake * P.radius;
      crack.scale.set(1, 1, L);
      crack.position.set(0, 0.05, L / 2);
    }
    // HARPOON: it surges up behind the car ahead; within reach the boom snaps out to it (0.15 s), the claw catches it and
    // throws it off the road to the side (0.3 s), then folds back in (0.4 s)
    let showBoom = false;
    if (p.fx.harpoon != null) {
      let T = rivals.find(r => r.harpooned);
      if (!T && !rivals.some(r => r.thrown)) {
        T = rivals
          .filter(r => r.z > 2 && !r.ko)
          .sort((a, b) => a.z - b.z)
          .pop(); // (the furthest ahead: the leader)
        if (T) Object.assign(T, { harpooned: true, side: -1, catchT: -1 });
      }
      const base = new THREE.Vector3(0, 1.5, bladeZ - 0.3);
      if (T && T.harpooned) {
        if (T.catchT < 0 && T.z - base.z < 11) T.catchT = 0; // (within the boom's reach: it fires)
        if (T.catchT >= 0) {
          T.catchT += dt;
          const c = T.catchT,
            out = Math.min(1, c / 0.15),
            thr = ease(Math.min(1, Math.max(0, (c - 0.15) / 0.3)));
          if (T.aim == null) {
            T.aim = Math.atan2(T.x - base.x, T.z - 1.5 - base.z);
            T.reach = Math.hypot(T.x - base.x, T.z - 1.5 - base.z);
          }
          const yaw = T.aim + T.side * ((P.swing * Math.PI) / 180) * thr,
            L = T.reach * out;
          setBoom(base, yaw, L);
          showBoom = true;
          if (out >= 1) {
            T.x = base.x + Math.sin(yaw) * L;
            T.z = base.z + Math.cos(yaw) * L + 1.5;
          }
          if (thr >= 1) {
            knock(T, 'blown', T.side);
            Object.assign(T, { harpooned: false, thrown: 0.4, aim: null, lastYaw: yaw, lastL: L });
          }
        }
      }
      const done = rivals.find(r => r.thrown > 0);
      if (done) {
        done.thrown -= dt;
        setBoom(base, done.lastYaw, done.lastL * Math.max(0, done.thrown / 0.4));
        showBoom = done.thrown > 0;
      }
    }
    boom.visible = showBoom;
    // CANNON FIRE: the cannon up on the mount; each shot leaves its muzzle with a flash and smoke, the barrel kicks
    // back, and the ball goes off after the rival it's locked onto (taking turns round all of them, ahead and behind)
    if (cannon) {
      cannon.visible = p.fx.cannon != null;
      const B = cannon.userData.barrel;
      if (p.fx.cannon != null)
        while (shotsFired < (p.fx.shots || 0)) {
          const live = rivals.filter(r => !r.ko),
            tgt = live.length ? live[shotsFired % live.length] : rivals[shotsFired % rivals.length],
            ball = cannonballs[shotsFired % cannonballs.length],
            at = cannon.userData.muzzle.getWorldPosition(new THREE.Vector3());
          Object.assign(ball, { t: 0, x: at.x, y: at.y, z: at.z, dir: 1, tgt, vx: 0, vz: P.shot * 0.6 });
          ball.m.visible = true;
          B.position.z = -0.3; // (the kick)
          for (let i = 0; i < 7; i++)
            puff(
              at,
              i < 2 ? '#ffd27a' : '#cfd3da',
              i < 2 ? 1.3 : 1.6 + Math.random(),
              new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, 5 + Math.random() * 4),
              2,
              i < 2 ? 4 : 1.2,
              0.6,
            );
          shotsFired++;
        }
      else shotsFired = 0;
      B.position.z += (0 - B.position.z) * Math.min(1, dt * 8);
    }
    // the cannonballs home in: each turns toward its rival every moment, wherever it goes, at the shot's speed (to
    // you, less your own), trailing smoke and a glowing core so you can follow it to them
    reticles.forEach(r => (r.visible = false));
    let ri = 0;
    for (const c of cannonballs) {
      if (c.t < 0) continue;
      c.t += dt;
      const T = c.tgt && !c.tgt.ko ? c.tgt : null,
        sp = Math.max(30, P.shot - BASE * p.boost * 0.5) * 0.8;
      if (T) {
        const dx = T.x - c.x,
          dz = T.z - c.z,
          d = Math.hypot(dx, dz) || 1,
          k = Math.min(1, dt * 6); // (how hard it turns onto them)
        c.vx += ((dx / d) * sp - c.vx) * k;
        c.vz += ((dz / d) * sp - c.vz) * k;
        if (ri < reticles.length) {
          const rt = reticles[ri++];
          rt.visible = true;
          rt.position.set(T.x, 3.2, T.z);
          rt.material.rotation += dt * 3;
        }
      }
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.y += (1.2 - c.y) * Math.min(1, dt * 3);
      c.m.position.set(c.x, c.y, c.z);
      puff(c.m.position, '#c9ccd4', 0.9, new THREE.Vector3(0, 0.3, 0), 1.2, 0.7, 0); // the smoke trail, hanging in the air
      if (Math.random() < 0.7) puff(c.m.position, '#ff9a3a', 0.5, new THREE.Vector3(0, 0, 0), 0.2, 3, 0); // its glowing core
      if (c.t > 3 || Math.abs(c.z) > 120) {
        c.t = -1;
        c.m.visible = false;
      }
    }
    car.robot.update(dt, {
      t: now / 1000,
      steer: 0,
      boost: p.boost > 1,
      air: p.y > 0.5 ? 1 : 0,
      wheel: car.wheelRing,
      wheelR: car.wheelR,
      speed: 0.6,
    });
    setFace(car, p.y > 1 ? 'laugh' : pose ? 'happy' : 'calm');
  }
  // the rivals: the faster you are, the more they slip back; the knockout lands on whoever it reaches
  for (const r of rivals) {
    const was = r.z;
    if (pose) r.z -= (p.boost - 1) * BASE * dt;
    if (r.harpooned && r.z < 3)
      r.z = 3; // (on the line: you're reeled right up behind it, no further)
    else if (playT < 0 && !r.ko) {
      r.z += (r.z0 - r.z) * Math.min(1, dt * 0.8);
      r.x += (r.x0 - r.x) * Math.min(1, dt * 0.8);
    }
    const d = Math.hypot(r.x, r.z),
      passed = was > 0 && r.z <= 0;
    if (pose) {
      if (type === 'kart' && passed && Math.abs(r.x) < P.wake + 2) knock(r, 'blown');
      if (type === 'buggy')
        for (const b of balls)
          if (
            b.m.visible &&
            Math.abs(r.z - b.z) < b.m.scale.x + 1.5 &&
            Math.abs(r.x - b.m.position.x) < b.m.scale.x + 1.4
          )
            knock(r, 'flip');
      if (type === 'rail' && passed && Math.abs(r.x) < 8) knock(r, 'flip');
      if (type === 'brute')
        for (const c of cannonballs)
          if (c.t >= 0 && Math.hypot(r.z - c.z, r.x - c.x) < 2) {
            knock(r, 'flip');
            for (let i = 0; i < 8; i++)
              puff(
                c.m.position,
                i < 3 ? '#ff9a2a' : '#8a8f99',
                2 + Math.random() * 2,
                new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 4, (Math.random() - 0.5) * 8),
                2,
                1.4,
                0.6,
              );
            c.t = -1;
            c.m.visible = false;
          }
      if (type === 'monster' && p.fx.quake != null && p.fx.quake * P.radius > d - 2) knock(r, 'flip');
      if (type === 'roadster' && p.fx.land != null && p.fx.land < 0.4 && d < P.blast) knock(r, 'flip');
      if (type === 'muscle' && p.fx.fire && r.z < 0 && playT > 0.7) knock(r, 'spin');
    }
    let y = 0,
      ry = 0,
      rz = 0,
      ox = 0;
    if (r.ko) {
      const K = r.ko,
        u = Math.min(1, (K.t += dt) / 2.2);
      if (K.type === 'flip') {
        y = 7 * Math.sin(Math.PI * u);
        rz = Math.PI * 3 * ease(u) * K.side;
        ox = K.side * 4 * u;
      } else if (K.type === 'spin') {
        ry = Math.PI * 5 * ease(u) * K.side;
        ox = K.side * 5 * u;
        r.z -= dt * 6;
      } else if (K.type === 'blown') {
        y = 4 * Math.sin(Math.PI * u);
        rz = Math.PI * ease(u) * K.side;
        ox = K.side * 12 * ease(u);
      } else {
        y = P.lift * Math.sin(Math.PI * u);
        ry = Math.PI * 8 * u;
      }
      if (u >= 1) {
        r.x += ox;
        ox = 0;
        r.ko = null;
      }
    }
    r.m.root.position.set(r.x + ox, y, r.z);
    r.m.root.rotation.set(0, ry, rz);
    for (const w of r.m.wheels) w.spin.rotation.x += (BASE * dt) / (w.r || 0.4);
    setFace(r.m, r.ko ? 'hit' : 'calm');
  }
  for (const q of puffs)
    if (q.life > 0) {
      q.life -= dt * q.decay;
      q.s.position.addScaledVector(q.v, dt);
      q.s.scale.multiplyScalar(1 + dt * q.grow);
      q.s.material.opacity = Math.max(0, Math.min(1, q.life)) * 0.8;
      q.s.position.z -= speed * dt * q.drift; // (left behind by the car; fire stays on the road)
      if (q.life <= 0) q.s.visible = false;
    }
  // EARTHQUAKE: the whole picture shakes as the wave rolls out
  if (p.fx.quake != null) {
    const k = (1 - p.fx.quake) * 0.5;
    orbit.target.x = (Math.random() - 0.5) * k;
  } else orbit.target.x = 0;
  // follow the car up when it flies
  orbit.target.y += (1.4 + p.y * 0.95 - orbit.target.y) * Math.min(1, dt * 9);
  orbit.update();
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * R.getPixelRatio()) || canvas.height !== Math.round(h * R.getPixelRatio())) {
    R.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  R.render(S, cam);
  requestAnimationFrame(frame);
}
paint();
requestAnimationFrame(frame);
