// The camera: the race chase cam (and its loop-the-loop ride), the home screen highlights reel, the drone sweep before a
// race, the finish line, the results and garage orbits, and the flight up to the map. Also moves the sun's shadow with you.
import { Haptics } from './haptics.js';
import * as THREE from 'three';
import { SUN } from './buddy.js';
import { clamp } from './util.js';
import { scene, cam, sun } from './scene.js';
import { mapPan } from './worldmap.js';
import { INTRO } from './race-flow.js';
import { game } from './game.js';

export const camPos = new THREE.Vector3(0, 400, 600),
  camLook = new THREE.Vector3(),
  camUp = new THREE.Vector3(0, 1, 0);
const want = new THREE.Vector3(),
  wantLook = new THREE.Vector3(),
  wantUp = new THREE.Vector3();
const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3() },
  fwd = new THREE.Vector3();
let camRh = 0,
  shadowSpan = 70,
  loopW = 0,
  upRate = 6;
const camBack = {
    p: new THREE.Vector3(),
    t: new THREE.Vector3(),
    u: new THREE.Vector3(),
    l: new THREE.Vector3(),
    i: 0,
  },
  camAhead = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3(), i: 0 };

const W2C = 13;
const director = { shot: 'drone', t0: -99, k: null, ev: null, anchor: null, cut: null };
export function updateCamera(dt) {
  const k = game.race.player,
    kp = k.m.root.position;
  let rate;
  if (game.state === 'intro') {
    // a slow drone sweep down the starting grid, from high in front of the gate to low behind the pack
    game.introT += dt;
    const u = Math.min(1, game.introT / (INTRO - 0.3)),
      e2 = u * u * (3 - 2 * u),
      wide = cam.aspect < 1 ? 1.5 : 1;
    game.track.frame(game.track.len - 20, F);
    want
      .copy(F.p)
      .addScaledVector(F.t, (40 - e2 * 46) * wide)
      .addScaledVector(F.l, (-18 + e2 * 12) * wide)
      .addScaledVector(F.u, (22 - e2 * 15) * wide);
    wantLook.copy(F.p).addScaledVector(F.t, 4).addScaledVector(F.u, 1);
    wantUp.set(0, 1, 0);
    rate = game.introT < 0.1 ? 60 : 4;
  } else if (game.state === 'tomap' || game.state === 'map') {
    const C = game.track.center;
    game.fly.t += dt;
    if (game.mapFly) {
      // flying to another island: rise, cross the sea, settle over it
      game.mapFly.t = Math.min(1, game.mapFly.t + dt / game.mapFly.dur);
      const t = game.mapFly.t,
        e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      mapPan.x = game.mapFly.a.x + (game.mapFly.b.x - game.mapFly.a.x) * e;
      mapPan.z = game.mapFly.a.z + (game.mapFly.b.z - game.mapFly.a.z) * e;
      mapPan.h = game.mapFly.a.h + (game.mapFly.b.h - game.mapFly.a.h) * e + Math.sin(Math.PI * e) * game.mapFly.lift;
      if (t >= 1) {
        const done = game.mapFly.done;
        game.mapFly = null;
        done?.();
      }
    }
    const mh = mapPan.h || game.track.radius * 2.25;
    // a false-3D aerial: the camera stands back to the south and looks down at about 50 degrees, so the island reads
    // as land with height, the far coast and sea melt into haze, north still at the top of the screen
    const tilt = 0.68,
      d = mh * 1.3;
    wantLook.set(C.x + mapPan.x, 0, C.z + mapPan.z - mh * 0.16);
    want.set(wantLook.x, Math.sin(tilt) * d, wantLook.z + Math.cos(tilt) * d);
    wantUp.set(0, 1, 0);
    rate = game.state === 'map' ? (game.mapFly ? 30 : 10) : 5;
    if (game.fly.t > 1.6) game.state = 'map';
  } else if (game.state === 'menu') {
    // the home screen is a highlights reel: when something happens (a jump, a dive into the underpass, a shot fired, a
    // Yaji boost) it cuts to whoever did it; between moments, the drone over the pack, a side tracking shot, an orbit, a hero
    const d = director;
    if (game.clock - d.t0 > 2.6) {
      const prio = { jump: 4, tunnel: 3, taunt: 3, fire: 2, boost: 2, hit: 1 };
      const ev = game.race.events
        .filter(e => game.race.clock - e.t < 0.35 && (!d.ev || e !== d.ev))
        .sort((a, b) => prio[b.type] - prio[a.type])[0];
      if (ev) {
        d.ev = ev;
        d.k = ev.k;
        d.shot = ev.type;
        d.t0 = game.clock;
        d.anchor = null;
      } else if (game.clock - d.t0 > 6) {
        const crowd = kk => game.race.karts.filter(o => o !== kk && Math.abs(game.race.dS(o.s, kk.s)) < 30).length;
        const pool = ['drone', 'side', 'orbit', 'chase', 'drone', 'hero', 'side'];
        let next = pool[(pool.indexOf(d.shot) + 1) % pool.length] || 'drone';
        d.k = crowd(k) ? k : game.race.karts.reduce((a, b) => (crowd(b) > crowd(a) ? b : a));
        if (next === 'drone' && !crowd(d.k)) next = 'side';
        d.shot = next;
        d.t0 = game.clock;
        d.anchor = null;
      }
    }
    const tk = d.k || k,
      tp = tk.m.root.position,
      st = game.clock - d.t0,
      side = tk.n % 2 ? 1 : -1,
      back = cam.aspect < 1 ? 1.35 : 1;
    game.race.frameOf(tk, F);
    fwd.copy(F.t).multiplyScalar(Math.cos(tk.rh)).addScaledVector(F.l, Math.sin(tk.rh));
    let near = null,
      nd = 40;
    for (const o of game.race.karts)
      if (o !== tk) {
        const dd = Math.abs(game.race.dS(o.s, tk.s));
        if (dd < nd) {
          nd = dd;
          near = o;
        }
      }
    const mid = near ? new THREE.Vector3().addVectors(tp, near.m.root.position).multiplyScalar(0.5) : tp.clone();
    const under = game.track.covered[game.track.idx(tk.s)];
    const around = (a, r) =>
      new THREE.Vector3()
        .copy(fwd)
        .multiplyScalar(Math.cos(a) * r)
        .addScaledVector(F.l, Math.sin(a) * r);
    let shot = d.shot;
    if ((under && shot !== 'tunnel') || (shot === 'tunnel' && tk.br)) shot = 'chase';
    if (shot === 'taunt') shot = 'hero';
    if (shot === 'jump' || shot === 'tunnel') {
      // a fixed camera: beside the ramp for a jump, inside the tunnel looking back up for a dive underground
      if (!d.anchor) {
        if (shot === 'jump')
          d.anchor = tp
            .clone()
            .addScaledVector(fwd, 16)
            .addScaledVector(F.l, side * 11)
            .addScaledVector(F.u, 2.2);
        else {
          let i = game.track.idx(tk.s);
          while (!game.track.covered[i] && i - game.track.idx(tk.s) < 200) i = (i + 1) % game.track.N;
          const P = game.track.frame(i * game.track.seg + 26, game.track.newFrame());
          d.anchor = P.p
            .clone()
            .addScaledVector(P.l, side * 6)
            .addScaledVector(P.u, 3.2);
        }
      }
      want.copy(d.anchor);
      wantLook.copy(tp).addScaledVector(F.u, 1.2);
    } else if (shot === 'low') {
      want
        .copy(tp)
        .addScaledVector(F.l, side * 5.5 * back)
        .addScaledVector(fwd, 7 - st * 2.2)
        .addScaledVector(F.u, 0.55);
      wantLook.copy(tp).addScaledVector(F.u, 1.3);
    } else if (shot === 'drone') {
      want
        .copy(mid)
        .add(around(Math.PI + st * 0.12, 10))
        .addScaledVector(F.u, 28 * back);
      wantLook.copy(mid).addScaledVector(fwd, 4);
    } else if (shot === 'side') {
      want
        .copy(mid)
        .addScaledVector(F.l, side * 12 * back)
        .addScaledVector(fwd, 3 - st * 0.6)
        .addScaledVector(F.u, 2.6);
      wantLook.copy(mid).addScaledVector(F.u, 0.8);
    } else if (shot === 'orbit') {
      want
        .copy(tp)
        .add(around(side * (0.4 + st * 0.35), 11 * back))
        .addScaledVector(F.u, 3.2);
      wantLook.copy(tp).addScaledVector(F.u, 1.4);
    } else if (shot === 'hero' || shot === 'boost') {
      want
        .copy(tp)
        .addScaledVector(fwd, 15 * back)
        .addScaledVector(F.l, side * 3)
        .addScaledVector(F.u, 3.4);
      wantLook.copy(tp).addScaledVector(F.u, 1);
    } else if (shot === 'fire' || shot === 'hit') {
      want
        .copy(tp)
        .addScaledVector(fwd, -7 * back)
        .addScaledVector(F.l, side * 1.5)
        .addScaledVector(F.u, 2.6);
      wantLook.copy(tp).addScaledVector(fwd, 22).addScaledVector(F.u, 1);
    } else {
      want
        .copy(tp)
        .addScaledVector(fwd, -10 * back)
        .addScaledVector(F.u, 3.2);
      wantLook.copy(tp).addScaledVector(fwd, 18).addScaledVector(F.u, 0.8);
    }
    if (game.fly?.down) {
      game.fly.t += dt;
      if (game.fly.t > 1.4) game.fly = null;
      game.lastShot = shot;
      d.cut = d.t0;
    } else if (shot !== game.lastShot || d.t0 !== d.cut) {
      game.lastShot = shot;
      d.cut = d.t0;
      camPos.copy(want);
      camLook.copy(wantLook);
    }
    wantUp.set(0, 1, 0);
    rate = game.fly?.down ? 2.4 : 9; // (the swoop down from the map or onto a new city glides; the race shots cut)
    if (shot !== game.lastShot) {
      game.lastShot = shot;
      camPos.copy(want);
      camLook.copy(wantLook);
    }
  } else if (game.state === 'finish') {
    // a fixed camera at the line: low beside the arch, watching you cross and roll away; then it rises to look down on the finish
    const t = game.clock - game.finishAt,
      Fl = game.track.frame(0, game.track.newFrame()),
      side = 1;
    const low = Fl.p
      .clone()
      .addScaledVector(Fl.t, 22)
      .addScaledVector(Fl.l, side * (W2C + 6))
      .addScaledVector(Fl.u, 2.2);
    const high = Fl.p
      .clone()
      .addScaledVector(Fl.t, 10)
      .addScaledVector(Fl.l, side * 6)
      .addScaledVector(Fl.u, 34);
    const u = Math.min(1, Math.max(0, (t - 1.6) / 2.2)),
      e3 = u * u * (3 - 2 * u);
    want.lerpVectors(low, high, e3);
    wantLook
      .copy(kp)
      .lerp(Fl.p.clone().addScaledVector(Fl.t, 30), e3 * 0.5)
      .addScaledVector(Fl.u, 1.2);
    wantUp.set(0, 1, 0);
    rate = t < 0.1 ? 60 : 5;
  } else if (game.state === 'results' || game.state === 'garage') {
    game.race.frameOf(k, F);
    const a = k.rh + 0.5 * Math.sin(game.clock * 0.25);
    fwd.copy(F.t).multiplyScalar(Math.cos(a)).addScaledVector(F.l, Math.sin(a));
    const lift = k.m.V.cam,
      far = game.state === 'garage' ? 9 + lift * 2 : 7 + lift;
    want
      .copy(kp)
      .addScaledVector(fwd, far)
      .addScaledVector(F.u, 2.6 + lift);
    wantLook.copy(kp).addScaledVector(F.u, 1.4 + lift * 0.6);
    if (game.state === 'garage') wantLook.addScaledVector(F.u, -2.2 - lift); // sit the vehicle above the garage panel
    wantUp.copy(F.u);
    rate = 2;
  } else {
    game.race.frameOf(k, F);
    camRh += (k.rh * 0.55 + k.visYaw * 0.3 - camRh) * Math.min(1, dt * 5);
    fwd.copy(F.t).multiplyScalar(Math.cos(camRh)).addScaledVector(F.l, Math.sin(camRh));
    const d = 8.6 + Math.max(0, k.speed) * 0.025;
    const lift = k.m.V.cam;
    want
      .copy(kp)
      .addScaledVector(fwd, -d - lift)
      .addScaledVector(F.u, 3.5 + lift + k.air * 0.2);
    wantLook
      .copy(kp)
      .addScaledVector(fwd, 6)
      .addScaledVector(F.u, 1.6 + lift * 0.6);
    // follow the road's up (upside down in the loop), but only lean part-way into banked corners
    wantUp
      .set(0, 1, 0)
      .lerp(F.u, game.track.inLoop[game.track.idx(k.s)] || F.u.y < 0.7 ? 1 : 0.55)
      .normalize();
    rate = game.state === 'count' && game.clock - game.countStart < 2.2 ? 2.2 : 9;
    upRate = 6;
    // a loop-the-loop: the camera rides the road like the next car of a rollercoaster. It sits on the track the same
    // distance behind (not on a straight line out the back, which cuts across the inside of the loop), looks at the road
    // a few metres ahead (up into the loop going in, round over the top), and turns over with the kart, quickly, so the
    // kart stays stuck to the road and the world turns round it. It blends in just before the loop and out after it
    const nearLoop =
      game.track.inLoop[game.track.idx(k.s)] ||
      game.track.inLoop[game.track.idx(k.s + 10)] ||
      game.track.inLoop[game.track.idx(k.s + 20)];
    loopW += ((nearLoop ? 1 : 0) - loopW) * Math.min(1, dt * 3.5);
    if (loopW > 0.002) {
      const back = game.track.frame(k.s - d - lift, camBack),
        ahead = game.track.frame(k.s + 7, camAhead);
      const pb = back.p
        .clone()
        .addScaledVector(back.l, k.lat)
        .addScaledVector(back.u, 3.2 + lift);
      const la = ahead.p
        .clone()
        .addScaledVector(ahead.l, k.lat)
        .addScaledVector(ahead.u, 1.5 + lift * 0.6);
      want.lerp(pb, loopW);
      wantLook.lerp(la, loopW);
      wantUp.lerp(back.u.clone().add(F.u).normalize(), loopW).normalize(); // halfway between the camera's road and the kart's: no lag, no snap
      rate = 9 + 16 * loopW;
      upRate = 6 + 14 * loopW;
    }
  }
  const e = 1 - Math.exp(-dt * rate);
  camPos.lerp(want, e);
  camLook.lerp(wantLook, e);
  camUp
    .lerp(
      wantUp,
      Math.min(1, dt * (game.state === 'tomap' ? 3 : game.state === 'race' || game.state === 'count' ? upRate : 6)),
    )
    .normalize();
  cam.position.copy(camPos);
  if (game.state === 'race') {
    // haptics from what the race already feels: a fresh jolt of camera shake, a boost starting
    const P = game.race.player;
    if (game.race.shake > hapt.shake + 0.08) Haptics.bump(game.race.shake);
    if (P.boost > 0 && hapt.boost <= 0) Haptics.boost();
    hapt.shake = game.race.shake;
    hapt.boost = P.boost;
  }
  if (game.race.shake > 0)
    cam.position.add(
      new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(
        game.race.shake * 0.9,
      ),
    );
  cam.up.copy(camUp);
  cam.lookAt(camLook);
  if (game.state === 'results') {
    const w = innerWidth,
      h = innerHeight,
      wide = w >= 820;
    cam.setViewOffset(w, h, wide ? w * 0.2 : 0, wide ? 0 : h * 0.26, w, h);
  } else if (game.state === 'menu' && !game.fly) {
    const w = innerWidth,
      h = innerHeight,
      wide = w >= 820;
    cam.setViewOffset(w, h, wide ? w * 0.16 : 0, wide ? h * 0.02 : h * 0.1, w, h);
  } else if (cam.view?.enabled) cam.clearViewOffset();
  const racing = game.state === 'race' || game.state === 'count' || game.state === 'finish';
  const base = cam.aspect < 1 ? clamp(48 / cam.aspect, 62, 84) : 62;
  const fov =
    game.state === 'tomap' || game.state === 'map'
      ? 50
      : game.state === 'menu'
        ? cam.aspect < 1
          ? 62
          : 44
        : base + (racing ? clamp(k.speed, 0, 90) * 0.12 + (k.boost > 0 ? 8 : 0) : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  cam.updateProjectionMatrix();
  const up = game.state === 'tomap' || game.state === 'map';
  // racing: a warm harmattan haze close enough to give the city depth. From the air the haze turns to sea-blue far off,
  // so the far coast and the open sea melt into the distance
  const md = (mapPan.h || game.track.radius * 2.25) * 1.3;
  scene.fog.near = up ? md * 0.85 : 140;
  scene.fog.far = up ? md * 2.4 : 1700;
  scene.fog.color.set(game.night ? '#0a0f22' : up ? '#2d8aa3' : '#e9d9bf');
  if (game.routeLine) game.routeLine.visible = game.state === 'map';
  shadowSpan += ((up ? game.track.radius * 1.25 : 70) - shadowSpan) * Math.min(1, dt * 2.5); // grows and shrinks smoothly (no flash)
  const span = shadowSpan,
    sd = 160 + (span - 70) * 1.6,
    focus = new THREE.Vector3().lerpVectors(
      kp,
      game.track.center,
      clamp((span - 70) / (game.track.radius * 1.25 - 70), 0, 1),
    );
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: sd * 3 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(focus.x + SUN.x * sd, SUN.y * sd, focus.z + SUN.z * sd);
  sun.target.position.set(focus.x, 0, focus.z);
}

const hapt = { shake: 0, boost: 0 };
