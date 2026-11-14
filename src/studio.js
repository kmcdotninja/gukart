// The Vehicle Studio (/studio.html): each vehicle on a live 3D stage with Buddy at the wheel, the road running under it
// and two rivals beside it (one ahead, one behind) so its special power can be played out and seen working on someone.
// Every number about how it drives and what its power does lives in src/vehicles.js, the single source of truth: tune
// it here, PLAY to see it, SAVE TO GAME to race with it in this browser, COPY to paste it back into the code. The FIT
// card says whether any part reaches into Buddy's head. A design tool, not in the build.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTextures, setAniso } from './textures.js';
import { makeKart, RACERS, ENV, setFace, DEFAULT_CUSTOM, VEHICLES, clearance } from './buddy.js';
import { VSTATS, VSTATS_BASE, STAT_INFO, POWERS, POWERS_BASE, powerPose, powerLength, applyTunes } from './vehicles.js';
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
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 1.4, 16, 1, true).rotateX(Math.PI).translate(0, -0.7 - 0.34, 0),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 3, 20, 1, true).rotateX(Math.PI).translate(0, -1.5 - 0.34, 0),
      new THREE.MeshBasicMaterial({
        color: '#6fd3ff',
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
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
  const fit = clearance(car);
  $('#fit').className = 'fit ' + (fit.length ? 'bad' : 'ok');
  $('#fit').textContent = fit.length
    ? `${fit.length} part(s) touching: ${fit.join(', ')}`
    : 'CLEAR: nothing touches Buddy';
}
const rivals = [
  { def: RACERS[2], z: 14, x: -6 },
  { def: RACERS[4], z: -12, x: -6 },
].map(r => {
  const m = makeKart(r.def, tex, 10, 'kart', DEFAULT_CUSTOM.kart);
  shadowsOn(m.root);
  S.add(m.root);
  setFace(m, 'calm');
  return { ...r, m, spin: 0, wob: 0, fly: 0, slow: 0 };
});

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
const puffs = Array.from({ length: 140 }, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false }));
  s.visible = false;
  S.add(s);
  return { s, life: 0, v: new THREE.Vector3(), grow: 1 };
});
let puffI = 0;
function puff(at, col, size, vel, grow = 1.6) {
  const p = puffs[puffI++ % puffs.length];
  p.s.position.copy(at);
  p.s.material.color.set(col);
  p.s.scale.setScalar(size);
  p.life = 1;
  p.v.copy(vel);
  p.grow = grow;
  p.s.visible = true;
}
// the shockwave ring, the floodlight cone, the armour glow
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
);
ring.position.y = 0.15;
ring.visible = false;
S.add(ring);
const cone = new THREE.Mesh(
  new THREE.ConeGeometry(6, 30, 32, 1, true).rotateX(-Math.PI / 2).translate(0, 1.6, 16),
  new THREE.MeshBasicMaterial({
    color: '#fff6c8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }),
);
rig.add(cone);
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 16),
  new THREE.MeshBasicMaterial({
    color: '#ff6a00',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
glow.scale.set(2.4, 1.6, 3.4);
glow.position.y = 1.1;
rig.add(glow);

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
      `<span>CHARGES IN <b>${POWERS[type].charge} S</b></span><span>LASTS <b>${powerLength(type).toFixed(1)} S</b></span>`);
  chips();
  // the power's numbers, and how long it takes to charge
  $('#powSl').innerHTML =
    `<label class="sl"><span>CHARGE (S)</span><input type="range" data-k="charge" min="6" max="40" step="1" value="${P.charge}"><output>${P.charge}</output></label>` +
    Object.entries(B.p)
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
  if (POWERS[type].charge !== B.charge) out.charge = POWERS[type].charge;
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
let playT = -1;
const stop = () => {
  playT = -1;
  $('#play').textContent = 'PLAY THE POWER';
  for (const r of rivals) Object.assign(r, { spin: 0, wob: 0, fly: 0, slow: 0 });
};
$('#play').onclick = () => {
  playT = 0;
  $('#play').textContent = 'PLAYING';
  for (const r of rivals) Object.assign(r, { spin: 0, wob: 0, fly: 0, slow: 0 });
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
      for (let i = 0; i < 3; i++)
        puff(
          car.root.localToWorld(v3.set((Math.random() - 0.5) * 2.4, 0.4, -2)),
          '#d9b77a',
          1.2 + Math.random() * 1.2,
          new THREE.Vector3((Math.random() - 0.5) * 3, 4 + Math.random() * 3, -12 - Math.random() * 6),
          2.4,
        );
    if (p.fx.sparkle && Math.random() < 0.6)
      puff(
        car.root.localToWorld(v3.set((Math.random() - 0.5) * 2, 0.2, -1.4)),
        '#9fe4ff',
        0.5,
        new THREE.Vector3(0, 1, -8),
        0.5,
      );
    if (thrusters) {
      const dep = p.fx.deploy || 0,
        th = (p.fx.thrust || 0) * dep;
      for (const t of thrusters) {
        t.g.scale.setScalar(Math.max(0.001, dep));
        const fl = th * (0.85 + Math.random() * 0.3);
        t.jet.scale.set(1, Math.max(0.01, fl), 1);
        t.core.scale.set(1, Math.max(0.01, fl * 0.9), 1);
        t.jet.visible = t.core.visible = th > 0.02;
        if (th > 0.5 && Math.random() < 0.5) {
          // the blast kicking up the road when it's close to it
          t.g.getWorldPosition(v3);
          if (v3.y < 5)
            puff(
              v3.setY(0.3),
              '#dfe8f4',
              1.6,
              new THREE.Vector3((Math.random() - 0.5) * 8, 1.5, (Math.random() - 0.5) * 8),
              2.6,
            );
        }
      }
    }
    cone.material.opacity = (p.fx.lights || 0) * 0.28;
    glow.material.opacity = (p.fx.glow || 0) * 0.35;
    ring.visible = p.fx.ring != null;
    if (ring.visible) {
      const r = 1 + p.fx.ring * POWERS[type].radius;
      ring.scale.set(r, 1, r);
      ring.material.opacity = 1 - p.fx.ring;
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
  // the rivals react to the power
  const P = POWERS[type];
  for (const r of rivals) {
    const ahead = r.z > 0,
      d = Math.hypot(r.x, r.z);
    if (pose) {
      if (type === 'raider' && ahead && p.fx.lights) r.wob = P.wobble;
      if (type === 'rail' && !ahead && p.fx.sand) r.slow = 1;
      if (type === 'monster' && p.fx.ring != null && p.fx.ring * P.radius > d - 2) r.spin = Math.max(r.spin, 1);
      if (type === 'brute' && ahead && playT > 0.6) r.fly = Math.max(r.fly, 0.01);
    }
    r.wob = Math.max(0, r.wob - dt * 0.6);
    r.slow = Math.max(0, r.slow - dt * 0.5);
    r.spin = Math.max(0, r.spin - dt * 0.7);
    if (r.fly > 0) r.fly = Math.min(1.5, r.fly + dt);
    const fly = r.fly > 0 ? r.fly : 0;
    r.m.root.position.set(
      r.x + Math.sin(now / 90) * r.wob * 1.2 - fly * 6,
      Math.max(0, fly * 9 - fly * fly * 6),
      r.z - r.slow * 4 + fly * 4,
    );
    r.m.root.rotation.set(0, r.spin * Math.PI * 4 + Math.sin(now / 90) * r.wob * 0.3, fly * 3);
    if (fly >= 1.5) r.fly = 0;
    for (const w of r.m.wheels) w.spin.rotation.x += (BASE * (1 - r.slow * 0.6) * dt) / (w.r || 0.4);
    setFace(r.m, r.spin || r.fly || r.wob > 0.2 || r.slow > 0.3 ? 'hit' : 'calm');
    if (r.slow > 0.3 && Math.random() < 0.3)
      puff(v3.copy(r.m.root.position).add(new THREE.Vector3(0, 1.5, 0)), '#d9b77a', 1.4, new THREE.Vector3(0, 0.5, -4));
  }
  for (const q of puffs)
    if (q.life > 0) {
      q.life -= dt * 1.1;
      q.s.position.addScaledVector(q.v, dt);
      q.s.scale.multiplyScalar(1 + dt * q.grow);
      q.s.material.opacity = Math.max(0, q.life) * 0.8;
      q.s.position.z -= speed * dt * 0.6; // (left behind by the car)
      if (q.life <= 0) q.s.visible = false;
    }
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
