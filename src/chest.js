// Chests: the coins you earn over all time (spending doesn't count against it) open a chest at 500, 1,500, 3,000,
// 5,000 and 8,000. It drops onto the home screen; tap OPEN and it shakes, bursts open in a flash of light, and one of
// the five upgrades rises out of it. Upgrades make your vehicle better for good (src/race.js reads them):
// HOT TYRES (fire mode lasts longer), TURBO KIT (top speed), GRIP (corners), BIG NITRO (longer boosts), ARMOUR
// (longer shields, shorter spin-outs).
import { store } from './util.js';
import { $ } from './dom.js';
import { game } from './game.js';
import { Sound } from './audio.js';
import { Haptics } from './haptics.js';
import * as THREE from 'three';
import { buildWheel, wheelMats, nitroBottle, ENV } from './buddy.js';
import { itemCrate } from './race.js';

export const MILESTONES = [500, 1500, 3000, 5000, 8000];
export const UPGRADES = [
  {
    id: 'hot',
    name: 'HOT TYRES',
    short: '+3 S ON FIRE',
    line: 'Fire mode lasts 3 s longer',
  },
  {
    id: 'turbo',
    name: 'TURBO KIT',
    short: '+5% SPEED',
    line: '+5% top speed',
  },
  {
    id: 'grip',
    name: 'GRIP',
    short: '+8% GRIP',
    line: 'Tighter corners and drifts',
  },
  {
    id: 'nitro',
    name: 'BIG NITRO',
    short: 'LONGER NITRO',
    line: 'Nitro boosts last longer',
  },
  {
    id: 'armour',
    name: 'ARMOUR',
    short: 'TOUGHER',
    line: 'Longer shields, shorter spin-outs',
  },
];

// every coin earned goes through here: into the wallet, and onto the all-time count the chests are opened by
export function earn(n) {
  if (!n) return;
  store.set('wallet', store.get('wallet', 0) + n);
  store.set('earned', earned() + n);
}
// (a player from before chests counts what's in their wallet as earned)
export const earned = () => store.get('earned', null) ?? store.get('wallet', 0);
const opened = () => store.get('chests', 0);
export const chestsDue = () => MILESTONES.filter(m => earned() >= m).length - opened();
export const nextMilestone = () => MILESTONES.find(m => earned() < m) ?? null;

/* ---- the 3D stage: the game's own question-mark item box, and a real part of a vehicle rising out of it ---- */
let R3 = null;
function stage() {
  if (R3) return R3;
  const canvas = $('#chestGL'),
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 1.2, 9);
  cam.lookAt(0, 0.6, 0);
  scene.environment = ENV.tex;
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2050', 1.6));
  const key = new THREE.DirectionalLight('#fff1dc', 2.6);
  key.position.set(3, 5, 6);
  scene.add(key);
  // a front fill, so a black tyre still reads against the dark
  const fill = new THREE.DirectionalLight('#ffffff', 1.6);
  fill.position.set(0, 1, 8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ff8a3a', 3);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  // the chest: the very crate that stands on the road (wood, hazard band, GK stencil, orange steel corners), with its own
  // copy of the materials so fading it out here never touches the crates in the race
  const box = itemCrate(),
    mats = [];
  box.traverse(o => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      mats.push(o.material);
    }
  });
  scene.add(box);
  // the flash when it bursts
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(flash);
  // a warm glow behind the part when it comes out: its silhouette stands out against it
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const gx = gc.getContext('2d'),
    grd = gx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,214,120,1)');
  grd.addColorStop(0.35, 'rgba(255,150,40,.55)');
  grd.addColorStop(1, 'rgba(255,110,20,0)');
  gx.fillStyle = grd;
  gx.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, opacity: 0 }),
  );
  glow.scale.setScalar(5.5);
  glow.position.set(0, 0.6, -1.5);
  scene.add(glow);
  R3 = {
    glow,
    mats,
    renderer,
    scene,
    cam,
    box,
    flash,
    item: null,
    t: 0,
    phase: 'idle',
    raf: 0,
  };
  return R3;
}
// fire: glowing particles that rise off the part, flickering, yellow at the heart going orange then red as they fade
// (blue-white for the turbo's nitro flame). Each is a soft glow sprite; they loop for as long as the part is shown
let glowTex = null;
function fire(cols, r) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const grp = new THREE.Group(),
    C = cols.map(c => new THREE.Color(c));
  for (let i = 0; i < 90; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sp.userData.p = { life: Math.random(), speed: 0.7 + Math.random() * 0.6, a: Math.random() * Math.PI * 2, rr: r };
    grp.add(sp);
  }
  grp.userData.fire = { C, r };
  return grp;
}
function stepFire(grp, dt) {
  const { C, r } = grp.userData.fire,
    col = new THREE.Color();
  for (const sp of grp.children) {
    const q = sp.userData.p;
    q.life += dt * q.speed;
    if (q.life > 1) {
      q.life -= 1;
      q.a = Math.random() * Math.PI * 2;
    }
    const L = q.life,
      // born round the tyre's lower half, licking up and in, wavering
      x = Math.cos(q.a) * r * 0.95 * (1 - L * 0.45) + Math.sin(L * 9 + q.a * 3) * 0.14,
      z = 0.35 + Math.abs(Math.sin(q.a)) * r * 0.45 * (1 - L * 0.5); // licking up in front of the tyre
    sp.position.set(x, -r * 0.9 + L * r * 2.3, z);
    // tall tongues of flame, narrowing as they rise
    const w = (0.32 + (1 - L) * 0.32) * (1 - L * 0.35);
    sp.scale.set(w, w * 2.1, 1);
    // the heart's colour to the tip's colour to the fading colour
    if (L < 0.4) col.copy(C[0]).lerp(C[1], L / 0.4);
    else col.copy(C[1]).lerp(C[2], (L - 0.4) / 0.6);
    sp.material.color.copy(col);
    sp.material.opacity = Math.min(1, L * 6) * Math.pow(1 - L, 0.8) * 0.95;
  }
}

// the part that comes out, made from the game's own pieces
function itemFor(id) {
  const g = new THREE.Group(),
    m = wheelMats('#ff6a00');
  const wheel = (tread = 'off', rim = 'turbo') => {
    const w = buildWheel(0.95, 0.7, rim, tread, m.trim, m.chrome, m.black);
    w.rotation.y = Math.PI / 2 - 0.75; // a three-quarter view: the rim and the tread both show
    return w;
  };
  if (id === 'hot') {
    g.add(wheel('off', 'turbo'), fire(['#fff7c2', '#ff8a12', '#d42a0c'], 1));
  } else if (id === 'turbo') {
    g.add(wheel('slick', 'mesh'), fire(['#ffffff', '#7cc4ff', '#2a5bd8'], 1));
  } else if (id === 'grip') {
    const w = wheel('off', 'disc');
    w.rotation.z = 0.25;
    g.add(w);
  } else if (id === 'nitro') {
    const b = nitroBottle('#4fb0ff');
    b.scale.setScalar(1.45); // (fits the frame with room above it)
    b.position.y = -0.85;
    g.add(b);
  } else if (id === 'armour') {
    // a wheel inside the shield: the bubble's cyan glass, its rim glowing
    g.add(wheel('road', 'classic'));
    g.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.45, 40, 28),
        new THREE.MeshPhysicalMaterial({
          color: '#4fe3ff',
          emissive: '#1a8fb0',
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.32,
          roughness: 0.1,
          clearcoat: 1,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }
  return g;
}
function loop() {
  const S = R3,
    dt = 1 / 60;
  S.t += dt;
  const t = S.t,
    el = $('#chestGL'),
    w = el.clientWidth,
    h = el.clientHeight;
  if (S.renderer.domElement.width !== Math.round(w * S.renderer.getPixelRatio())) {
    S.renderer.setSize(w, h, false);
    S.cam.aspect = w / h;
    S.cam.updateProjectionMatrix();
  }
  const B = S.box;
  if (S.phase === 'drop') {
    // falls in, bounces, settles
    const u = Math.min(1, t / 0.7),
      bounce = Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * 1.4;
    B.position.y = (1 - u) * (1 - u) * 5 + bounce;
    if (u >= 1) S.phase = 'wait';
  }
  if (S.phase === 'wait' || S.phase === 'drop') {
    B.rotation.y += dt * 0.9;
    B.rotation.x = Math.sin(t * 1.3) * 0.12;
    if (S.phase === 'wait') B.position.y = Math.sin(t * 2.2) * 0.12;
  }
  if (S.phase === 'shake') {
    const k = Math.min(1, (t - S.t0) / 0.9);
    B.rotation.z = Math.sin(t * 42) * 0.12 * (0.4 + k);
    B.rotation.y += dt * (2 + k * 10);
    B.scale.setScalar(1 + k * 0.12);
  }
  if (S.phase === 'open') {
    const k = Math.min(1, (t - S.t0) / 0.5);
    // the box blows apart into the flash; the part rises out spinning
    B.scale.setScalar(1.12 + k * 1.2);
    for (const m of S.mats) m.opacity = 1 - k;
    B.visible = k < 1; // (gone once it's burst)
    S.flash.scale.setScalar(0.5 + k * 3);
    S.flash.material.opacity = k < 0.3 ? k * 3 : Math.max(0, 1 - (k - 0.3) * 1.6);
    const it = S.item,
      e = Math.min(1, (t - S.t0) / 0.8),
      ease = 1 - Math.pow(1 - e, 3);
    it.visible = true;
    it.scale.setScalar(0.25 + ease * 1.2);
    S.glow.material.opacity = ease;
    it.position.y = -0.4 + ease * 1;
    it.rotation.y += dt * 1.2;
    it.rotation.x = Math.sin(t * 1.1) * 0.15;
    it.traverse(o => {
      if (o.userData.fire) stepFire(o, dt);
    });
  }
  S.renderer.render(S.scene, S.cam);
  S.raf = requestAnimationFrame(loop);
}

// on the home screen, a chest that's due drops in (one at a time; the next waits for COLLECT)
let showing = false;
export function maybeChest() {
  if (showing || chestsDue() <= 0) return;
  setTimeout(() => {
    if (showing || chestsDue() <= 0 || game.state !== 'menu' || $('#menu').hidden) return;
    showChest();
  }, 700);
}
function showChest() {
  showing = true;
  const el = $('#chest'),
    n = opened(),
    owned = store.get('upgrades', []),
    left = UPGRADES.filter(u => !owned.includes(u.id)),
    up = left[Math.floor(Math.random() * left.length)] || UPGRADES[n % UPGRADES.length];
  $('#chestTitle').textContent = `${MILESTONES[n].toLocaleString('en')} COINS EARNED`;
  $('#chestSub').textContent = 'A CHEST FOR YOU';
  const S = stage();
  if (S.item) S.scene.remove(S.item);
  S.item = itemFor(up.id);
  S.item.visible = false;
  S.scene.add(S.item);
  S.box.scale.setScalar(1);
  S.box.rotation.set(0, 0.6, 0);
  for (const m of S.mats) m.opacity = 1;
  S.box.visible = true;
  S.flash.material.opacity = 0;
  S.glow.material.opacity = 0;
  S.t = 0;
  S.phase = 'drop';
  cancelAnimationFrame(S.raf);
  $('#chestName').textContent = up.name;
  $('#chestLine').textContent = up.line;
  $('#chestGo').textContent = 'OPEN';
  el.className = 'chest in';
  el.hidden = false;
  S.raf = requestAnimationFrame(loop);
  Sound.init();
  Sound.blip(180, 0.25, 'triangle', 0.12, 0.6);
  Haptics.buzz(12);
  let step = 0;
  $('#chestGo').onclick = () => {
    if (step === 0) {
      // shake, then burst open: the upgrade rises out of it
      step = 1;
      $('#chestGo').disabled = true;
      el.className = 'chest in shake';
      S.phase = 'shake';
      S.t0 = S.t;
      setTimeout(() => {
        el.className = 'chest in open';
        S.phase = 'open';
        S.t0 = S.t;
        store.set('upgrades', [...new Set([...owned, up.id])]);
        store.set('chests', n + 1);
        $('#chestSub').textContent = 'UNLOCKED';
        $('#chestGo').textContent = 'COLLECT';
        $('#chestGo').disabled = false;
        Sound.boost();
        Haptics.big();
        step = 2;
      }, 900);
    } else if (step === 2) {
      el.className = 'chest out';
      Sound.coin();
      setTimeout(() => {
        el.hidden = true;
        cancelAnimationFrame(S.raf);
        showing = false;
        maybeChest(); // another one due? it drops in next
      }, 320);
    }
  };
}
