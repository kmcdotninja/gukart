// The stunt cam's flair (src/race.js slowScale runs the slow motion, src/camera.js the shot round the kart): the moment
// made into a fighting game's finishing blow.
//   the grade: the world drained toward grey and hard in contrast while it's slow (desktop: a filter on the canvas)
//   speed lines: thin white rays round the edge of the screen, turning slowly
//   the stamp: the stunt's name slammed down big in gold across the screen, again for each stunt in a combo; at
//     touchdown it punches out and fades (the landing's own banner gives way to it)
//   afterimages: copies of the kart itself (its own paint, Buddy in it) left along its arc in the air, see-through and
//     fading, so the whole stunt hangs there
// The race says what's happening in race.sm: w (how far into the slow motion), on, and counters it bumps: flash (it
// starts), stamp (a stunt's name, sm.name), landed (touchdown). This only draws.
import { isTouch } from './util.js';

let box = null,
  linesEl,
  stampEl,
  grade = -1,
  offT = 0;
const seen = { flash: 0, stamp: 0, landed: 0, of: null };

function dom() {
  if (box) return;
  box = document.createElement('div');
  box.className = 'sc';
  box.innerHTML = '<i class="sc-lines"></i><b class="sc-stamp"></b>';
  document.body.append(box);
  linesEl = box.querySelector('.sc-lines');
  stampEl = box.querySelector('.sc-stamp');
}
const replay = (el, cls) => {
  el.classList.remove('slam', 'land', 'out', 'go');
  void el.offsetWidth;
  el.classList.add(cls);
};

/* ---------- the afterimages ---------- */
const N = 4,
  ghosts = [];
let ghostOf = null,
  snapT = 0,
  gi = 0;
function makeGhosts(race, root) {
  for (const g of ghosts) g.root.parent?.remove(g.root);
  ghosts.length = 0;
  const src = [];
  root.traverse(o => src.push(o));
  for (let i = 0; i < N; i++) {
    // (the kart itself, its own paint, Buddy and all: each material copied, made see-through so the copy can fade)
    const own = new Map(),
      mats = [];
    const fade = m => {
      if (!m) return m;
      if (!own.has(m)) {
        const f = m.clone();
        f.transparent = true;
        f.depthWrite = true; // (its own front hides its insides: a clean copy, not a jumble of every part)
        f.userData.base = m.transparent ? m.opacity : 1;
        own.set(m, f);
        mats.push(f);
      }
      return own.get(m);
    };
    const c = root.clone(true),
      dst = [];
    c.traverse(o => dst.push(o));
    for (const o of dst) {
      if (o.isLight || o.isSprite || o.isPoints || o.isLine) o.visible = false;
      if (o.isMesh) {
        o.material = Array.isArray(o.material) ? o.material.map(fade) : fade(o.material);
        o.castShadow = o.receiveShadow = false;
      }
      o.userData.noHit = true;
    }
    c.matrixAutoUpdate = true;
    race.scene.add(c);
    // (drawn once, unseen, so their shaders are ready: built and compiled at the first jump, they stuttered it)
    for (const m of mats) m.opacity = 0;
    c.visible = true;
    ghosts.push({ root: c, mats, dst, src, age: 1.39 });
  }
  ghostOf = root;
}
// a copy of the kart as it is this instant, pose and all
function snap(g, root) {
  const n = Math.min(g.src.length, g.dst.length);
  for (let i = 1; i < n; i++) {
    const a = g.src[i],
      b = g.dst[i];
    b.position.copy(a.position);
    b.quaternion.copy(a.quaternion);
    b.scale.copy(a.scale);
    if (!(b.isLight || b.isSprite || b.isPoints || b.isLine)) b.visible = a.visible;
  }
  root.updateMatrixWorld();
  root.matrixWorld.decompose(g.root.position, g.root.quaternion, g.root.scale);
  g.root.visible = true;
  g.age = 0;
}

// each frame of a race: dt the race's (slowed) step, rdt the real one; gl the game's canvas
export function stuntCam(race, dt, rdt, gl, cam) {
  const sm = race?.sm;
  if (!sm) return;
  sm.cleared = false;
  dom();
  // (a new race starts its counters again: catch up with them, nothing replayed)
  if (seen.of !== sm) Object.assign(seen, { flash: sm.flash, stamp: sm.stamp, landed: sm.landed, of: sm });
  const w = sm.w || 0,
    P = race.player;
  // the grade (not on phones: a filter on the whole canvas costs them too much)
  const g = isTouch ? 0 : Math.round(w * 40) / 40;
  if (g !== grade && gl) {
    grade = g;
    gl.style.filter = g > 0 ? `saturate(${(1 - 0.6 * g).toFixed(3)}) contrast(${(1 + 0.2 * g).toFixed(3)})` : '';
  }
  linesEl.style.opacity = (w * 0.55).toFixed(3);
  box.hidden = w <= 0 && !stampEl.className.includes('land') && !stampEl.className.includes('slam');
  // the hit
  if (sm.flash !== seen.flash) seen.flash = sm.flash; // (no white flash: it read as a glitch)
  // the stunt's name, slammed down (again for each one chained on)
  if (sm.stamp !== seen.stamp) {
    seen.stamp = sm.stamp;
    stampEl.textContent = sm.name || '';
    replay(stampEl, 'slam');
    offT = 0;
  }
  // touchdown: it punches out
  if (sm.landed !== seen.landed) {
    seen.landed = sm.landed;
    replay(stampEl, 'land');
  }
  // the slow motion let go and no clean landing (a crash, the race over): it just fades
  if (!sm.on && stampEl.classList.contains('slam')) {
    offT += rdt;
    if (offT > 0.9) replay(stampEl, 'out');
  }

  // the afterimages, left along the arc while it's slow
  if (P?.m?.root) {
    if (ghostOf !== P.m.root) makeGhosts(race, P.m.root);
    // (only once the camera has swung out beside the kart: behind it, the copies were left between it and the kart)
    if (sm.on && sm.w > 0.6 && sm.held > 0.6 && P.fly) {
      snapT -= dt;
      if (snapT <= 0) {
        snapT = 0.13;
        snap(ghosts[gi++ % N], P.m.root);
      }
    }
    for (const gh of ghosts) {
      if (!gh.root.visible) continue;
      gh.age += rdt;
      // (in only once the kart has moved off it, so the kart itself is never washed over)
      const o = 0.35 * Math.min(1, Math.max(0, (gh.age - 0.2) / 0.25)) * Math.max(0, 1 - gh.age / 1.4);
      // (and one the camera comes close to fades away rather than filling the screen)
      const near = cam ? Math.min(1, Math.max(0, (cam.position.distanceTo(gh.root.position) - 3) / 3)) : 1;
      for (const m of gh.mats) m.opacity = o * near * m.userData.base;
      if (gh.age > 1.4) gh.root.visible = false;
    }
  }
}
// a new race, or out of one: nothing left on screen
export function stuntCamClear(gl) {
  for (const g of ghosts) g.root.visible = false;
  if (gl && grade !== 0) gl.style.filter = '';
  grade = 0;
  if (box) {
    box.hidden = true;
    stampEl.className = 'sc-stamp';
  }
}
