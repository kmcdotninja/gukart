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
  bladeZ = new THREE.Box3().setFromObject(car.root).max.z;
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
  for (const r of rivals) Object.assign(r, { x: r.x0, z: r.z0, ko: null });
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
const puffs = Array.from({ length: 360 }, () => {
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
// SUPERSONIC: the boom (a ring flung out from the nose) and the streaks rushing past
const boom = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 64), additive('#e8f6ff', 0.9));
boom.visible = false;
rig.add(boom);
const streaks = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2,
    m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6 + Math.random() * 6), additive('#ffffff', 0.5));
  m.position.set(Math.cos(a) * (2.4 + Math.random()), 1.2 + Math.sin(a) * 1.6, -2 - Math.random() * 6);
  streaks.add(m);
}
streaks.visible = false;
rig.add(streaks);
// SURF'S UP: a wall of water across the road, rising from flat behind to its crest under the buggy, the lip curling
// forward, white foam along the crest (a profile drawn once and pushed out across the road's width)
const wave = new THREE.Group();
{
  const prof = new THREE.Shape();
  prof.moveTo(-14, 0);
  prof.bezierCurveTo(-8, 0.2, -3, 1.5, -1, 3.4);
  prof.bezierCurveTo(0, 4.2, 1.6, 4.4, 2.6, 3.6); // the crest, curling over
  prof.bezierCurveTo(3.2, 3.1, 3, 2.4, 2.3, 2.5); // the lip's underside
  prof.bezierCurveTo(1.6, 1.4, 2.5, 0.4, 4, 0);
  prof.lineTo(-14, 0);
  const g = new THREE.ExtrudeGeometry(prof, { depth: 24, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -12);
  g.rotateY(-Math.PI / 2); // (the profile along the road, pushed out across it)
  const water = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      color: '#1c8fd6',
      transparent: true,
      opacity: 0.88,
      roughness: 0.12,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  const fg = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(-12, 4.25, 0.6), new THREE.Vector3(12, 4.25, 0.6)),
    1,
    0.35,
    8,
  );
  const foam = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
  wave.add(water, foam);
}
wave.visible = false;
S.add(wave);
// DUST DEVIL: a funnel of sand, rings spinning, wide at the top
const devil = new THREE.Group();
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.6 + i * 0.45, 0.22 + i * 0.03, 6, 24).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#c9a46a', transparent: true, opacity: 0.55, depthWrite: false }),
  );
  m.position.y = 0.4 + i * 1.3;
  devil.add(m);
}
devil.visible = false;
S.add(devil);
// BULLDOZER: the plough blade that unfolds on the front
const blade = new THREE.Group();
{
  const steel = new THREE.MeshStandardMaterial({ color: '#f2b705', metalness: 0.4, roughness: 0.4 }),
    dark = new THREE.MeshStandardMaterial({ color: '#2a2e36', metalness: 0.7, roughness: 0.3 });
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 3.8, 24, 1, true, -0.7, 1.4).rotateZ(Math.PI / 2),
    steel,
  );
  plate.material.side = THREE.DoubleSide;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 0.3), dark);
  edge.position.set(0, -0.95, 0.6);
  for (const sx of [-1.2, 1.2]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.4), dark);
    arm.position.set(sx, -0.2, -0.6);
    blade.add(arm);
  }
  blade.add(plate, edge);
}
blade.visible = false;
rig.add(blade);

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
  bladeZ = 2.4; // (where the front of the car is, for the plough blade)
const stop = () => {
  playT = -1;
  $('#play').textContent = 'PLAY THE POWER';
};
$('#play').onclick = () => {
  playT = 0;
  resetRivals();
  // (powers that act on the road ahead are watched from behind the car, so you see them roll away down it)
  if (type === 'rail') cam.position.set(7, 6, -15);
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
    for (const w of car.wheels) w.spin.rotation.x += (speed * dt) / (w.r || 0.4);
    rig.position.y = p.y;
    rig.rotation.set(-p.pitch, p.yaw, p.roll, 'YXZ');
    rig.scale.set(1, p.squash, 1);
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
    // SUPERSONIC: the boom flung out from the nose, the streaks rushing past
    boom.visible = p.fx.sonic != null && p.fx.sonic < 0.8;
    if (boom.visible) {
      const u = p.fx.sonic / 0.8;
      boom.position.set(0, 1.2, 2.5 + u * 10);
      boom.scale.setScalar(1 + u * 9);
      boom.material.opacity = 1 - u;
    }
    streaks.visible = p.fx.sonic != null;
    if (streaks.visible) for (const m of streaks.children) m.position.z = ((m.position.z - dt * 60 + 14) % 14) - 10;
    // SURF'S UP: the wave rising under the buggy
    wave.visible = (p.fx.wave || 0) > 0.01;
    if (wave.visible) {
      const h = (P.height / 4) * ease(p.fx.wave);
      wave.scale.set(1, h, 1);
      wave.position.set(0, 0, -1.5);
      if (Math.random() < 0.7)
        puff(v3.set((Math.random() - 0.5) * 22, h * 4, -1), '#ffffff', 1.2, new THREE.Vector3(0, 1, -8), 1.4);
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
    // HARMATTAN: the sandstorm rolling down the road ahead
    if (p.fx.storm) {
      const front = Math.min(P.reach, playT * 40);
      for (let i = 0; i < 6; i++)
        puff(
          v3.set((Math.random() - 0.5) * 26, 1 + Math.random() * 5, 6 + Math.random() * front),
          '#cfa766',
          4 + Math.random() * 4,
          new THREE.Vector3((Math.random() - 0.5) * 6, 0.5, 4),
          0.4,
          0.8,
          0.2,
        );
      S.fog.color.lerp(new THREE.Color('#6b4a22'), 0.06 * p.fx.storm);
      S.fog.near = 6;
      S.fog.far = 60;
    } else {
      S.fog.color.lerp(new THREE.Color('#0a1028'), 0.08);
      S.fog.near += (30 - S.fog.near) * 0.05;
      S.fog.far += (90 - S.fog.far) * 0.05;
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
    // DUST DEVIL: the whirlwind off down the road after the leader
    devil.visible = p.fx.devil != null;
    if (devil.visible) {
      const L = rivals.find(r => r.leader),
        z = Math.min(L.z, 4 + p.fx.devil * P.speed);
      devil.position.set(L.x * Math.min(1, z / Math.max(1, L.z)), 0, z);
      devil.children.forEach((m, i) => (m.rotation.y += dt * (6 + i)));
      if (Math.random() < 0.6)
        puff(v3.set(devil.position.x, 0.5, z), '#c9a46a', 2, new THREE.Vector3((Math.random() - 0.5) * 4, 3, 0), 1.2);
      if (z >= L.z - 1) knock(L, 'lift');
    }
    // BULLDOZER: the blade on the front
    blade.visible = (p.fx.blade || 0) > 0.01;
    if (blade.visible) {
      blade.position.set(0, 0.9, bladeZ + 0.6);
      blade.scale.setScalar(Math.max(0.01, p.fx.blade));
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
    else if (playT < 0 && !r.ko) {
      r.z += (r.z0 - r.z) * Math.min(1, dt * 0.8);
      r.x += (r.x0 - r.x) * Math.min(1, dt * 0.8);
    }
    const d = Math.hypot(r.x, r.z),
      passed = was > 0 && r.z <= 0;
    if (pose) {
      if (type === 'kart' && passed && Math.abs(r.x) < P.wake + 2) knock(r, 'blown');
      if (type === 'buggy' && passed && (p.fx.wave || 0) > 0.3) knock(r, 'blown');
      if (type === 'brute' && passed && Math.abs(r.x) < 8 && (p.fx.blade || 0) > 0.5) knock(r, 'flip');
      if (type === 'monster' && p.fx.quake != null && p.fx.quake * P.radius > d - 2) knock(r, 'flip');
      if (type === 'roadster' && p.fx.land != null && p.fx.land < 0.4 && d < P.blast) knock(r, 'flip');
      if (type === 'rail' && p.fx.storm && r.z > 0 && r.z < Math.min(P.reach, 16 + playT * 40)) knock(r, 'spin');
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
