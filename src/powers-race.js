// The special powers in a race. Every car has its vehicle's power (src/vehicles.js), once a race, ready after the
// opening READY_AFTER seconds: you fire it with the POWER button or Q, the rivals fire theirs when they see a chance.
// While it runs the power's motion (powerPose, the same as the Vehicle Studio's) lifts and turns the car, its speed
// multiplies the car's top speed, its effects are drawn from src/powerfx.js (the same as the studio's), and its
// knockout lands on whichever rivals it reaches (race.hit: flipped up and spun out). Wired in from src/race.js:
//   initPowers(race)            once, when the race is built
//   resetPowers(race)           at each start
//   firePower(race, k)          the button, Q, or a rival's choice
//   updatePowers(race, dt)      every frame (after the karts have moved)
//   posePower(race, k, F)       when each kart's model is placed (lifts and turns it)
import * as THREE from 'three';
import { POWERS, READY_AFTER, powerPose } from './vehicles.js';
import { puffT, makeThrusters, makeVapour, makeBall, makeBoom, makeCannon, makeCannonball } from './powerfx.js';

const V = new THREE.Vector3(),
  V2 = new THREE.Vector3(),
  E = new THREE.Euler(),
  Q = new THREE.Quaternion();

export function initPowers(race) {
  const S = race.scene;
  // the soft sprites every puff of smoke, dust, spray and fire is made of
  race.pwPuffs = Array.from({ length: 420 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false }));
    s.visible = false;
    S.add(s);
    return { s, life: 0, v: new THREE.Vector3(), grow: 1, decay: 1 };
  });
  race.pwPi = 0;
  // the beach balls, the cannonballs, the boom (one set for the race: one car fires each at a time)
  race.pwBalls = Array.from({ length: 9 }, (_, i) => {
    const m = makeBall(i);
    m.visible = false;
    S.add(m);
    return { m, t: -1 };
  });
  race.pwShots = Array.from({ length: 12 }, () => {
    const m = makeCannonball();
    m.visible = false;
    S.add(m);
    return { m, t: -1 };
  });
  const b = makeBoom();
  b.boom.visible = false;
  S.add(b.boom);
  race.pwBoom = b;
  race.pwFire = []; // the Muscle's burning trail: patches on the road { s, lat, life, owner }
}

const puff = (race, at, col, size, vel, grow = 1.6, decay = 1.2) => {
  const p = race.pwPuffs[race.pwPi++ % race.pwPuffs.length];
  p.s.position.copy(at);
  p.s.material.color.set(col);
  p.s.scale.setScalar(size);
  p.life = 1;
  p.v.copy(vel);
  p.grow = grow;
  p.decay = decay;
  p.s.visible = true;
};

export function resetPowers(race) {
  for (const k of race.all) {
    k.pw = { used: false, t: -1, pose: null, shots: 0, catchT: -1, target: null };
    k.pwBoost = 1;
    k.pwImmune = false;
    if (k.pwFx?.thrusters)
      k.pwFx.thrusters.forEach(t => (t.g.scale.setScalar(0.001), (t.jet.visible = t.core.visible = false)));
    if (k.pwFx?.vapour) ((k.pwFx.vapour.material.opacity = 0), (k.pwFx.diamonds.visible = false));
    if (k.pwFx?.cannon) k.pwFx.cannon.visible = false;
  }
  for (const b of race.pwBalls) ((b.t = -1), (b.m.visible = false));
  for (const c of race.pwShots) ((c.t = -1), (c.m.visible = false));
  race.pwBoom.boom.visible = false;
  race.pwFire.length = 0;
  for (const p of race.pwPuffs) ((p.life = 0), (p.s.visible = false));
}

// a power's end: everything it made goes with it, on the car and on the road (the car exactly as it was)
function endPower(race, k) {
  if (k.pw.lifting) ((k.pw.lifting = false), (k.fly = true), (k.vy = Math.min(k.vy, -2)));
  k.pw.t = -1;
  k.pw.pose = null;
  k.pwBoost = 1;
  k.pwImmune = false;
  const f = k.pwFx || {};
  f.thrusters?.forEach(t => (t.g.scale.setScalar(0.001), (t.jet.visible = t.core.visible = false)));
  if (f.vapour) ((f.vapour.material.opacity = 0), (f.diamonds.visible = false));
  if (f.cannon) f.cannon.visible = false;
  for (const b of race.pwBalls) if (b.owner === k) ((b.owner = null), (b.t = -1), (b.m.visible = false));
  for (const c of race.pwShots) if (c.owner === k) ((c.t = -1), (c.m.visible = false));
  race.pwFire = race.pwFire.filter(p => p.owner !== k);
  if (k.pw.thrown != null || k.pw.catchT >= 0) race.pwBoom.boom.visible = false;
  k.pw.thrown = null;
}

// is k's power ready to fire?
export const powerReady = (race, k) =>
  race.mode === 'gp' && !!k.pw && !k.pw.used && race.time >= READY_AFTER && !k.finished; // (races only: not alone in Time Trial or Free Drive)

export function firePower(race, k) {
  if (!powerReady(race, k) || k.spin > 0) return false;
  k.pw.used = true;
  k.pw.t = 0;
  k.pw.shots = 0;
  k.pw.catchT = -1;
  k.pw.target = null;
  const type = k.m.type;
  // what it needs built on the car, the first time (the thrusters under the floor, the vapour cone, the cannon on
  // its weapon mount)
  k.pwFx ||= {};
  if (type === 'roadster' && !k.pwFx.thrusters) k.pwFx.thrusters = makeThrusters(k.m.root, k.m.wheels);
  if (type === 'kart' && !k.pwFx.vapour) {
    const v = makeVapour();
    k.m.root.add(v.vapour, v.diamonds);
    Object.assign(k.pwFx, v);
  }
  if (type === 'brute' && !k.pwFx.cannon && k.m.gun) {
    const c = makeCannon();
    c.position.copy(k.m.gun.position);
    k.m.gun.parent.add(c);
    k.pwFx.cannon = c;
  }
  if (type === 'buggy')
    race.pwBalls.forEach((b, i) =>
      Object.assign(b, {
        t: -i * 0.08,
        owner: k,
        s: k.s + 3,
        lat: k.lat - 10 + (i / 8) * 20,
        r: (0.8 + Math.random() * 0.9) * (POWERS.buggy.size / 3.2),
        v: 0.8 + Math.random() * 0.5,
        hop: 4 + Math.random() * 3,
      }),
    );
  if (k === race.player) race.ev.toast?.(POWERS[type].name);
  return true;
}

// the rivals' choice: once ready, a rival fires when someone's close ahead (or, for the ones that hit behind, close
// behind), now and then, so the pack doesn't all go at once
function rivalsChoose(race, dt) {
  for (const k of race.karts) {
    if (k === race.player || !powerReady(race, k) || k.spin > 0) continue;
    const near = race.karts.some(o => {
      if (o === k) return false;
      const d = race.dS(o.s + o.lap * race.tr.len, k.s + k.lap * race.tr.len);
      return k.m.type === 'muscle' ? d < 0 && d > -30 : d > 0 && d < 45;
    });
    if (Math.random() < dt * (near ? 0.35 : 0.03)) firePower(race, k);
  }
}

// a knockout on rival r from k: flipped up and spun out (through the race's own hit, so shields and fire still count)
const ko = (race, r, k) => {
  if (r === k || r.pwImmune || r.spin > 0) return;
  race.hit(r, 'boom', k);
};

export function updatePowers(race, dt) {
  rivalsChoose(race, dt);
  const tr = race.tr;
  for (const k of race.all) {
    const pw = k.pw;
    if (!pw || pw.t < 0) {
      if (pw) ((pw.pose = null), (k.pwBoost = 1), (k.pwImmune = false));
      continue;
    }
    const type = k.m.type,
      P = POWERS[type],
      t0 = pw.t;
    pw.t += dt;
    const pose = powerPose(type, pw.t);
    pw.pose = pose;
    if (!pose) {
      endPower(race, k);
      continue;
    }
    k.pwBoost = pose.boost;
    k.pwImmune = pose.y > 1.5; // (up in the air: nothing on the road can touch it)
    // a power that lifts the car (the Roadster's flight, the Monster's jump) carries it for real, so where it comes down
    // is real too: on the road, or on a roof over it (src/roofs.js), which it then rides along
    if (pose.y > 0.05 || pw.lifting) {
      const road = tr.point(k.s, k.lat, 0).y,
        rh = race.roofH ? race.roofH[tr.idx(k.s)] : 0,
        top = rh > 0 ? road + rh : null,
        want = road + pose.y - (top != null && k.Y < top - 0.3 ? Math.max(0, road + pose.y - (top - 2.6)) : 0); // (under a roof: no higher than its ceiling)
      if (pose.y > 0.05 && !(top != null && k.Y >= top - 0.3 && want < top)) {
        pw.lifting = true;
        k.fly = true;
        k.onRoof = false;
        k.vy = 0;
        k.Y = want;
        k.airT = Math.max(k.airT || 0, 0.3);
      } else if (pw.lifting) {
        pw.lifting = false; // (coming down: the race's own fall puts it on the road or the roof under it)
        k.fly = true;
        k.vy = Math.min(k.vy, -2);
      }
    }
    const fx = pose.fx,
      here = k.m.root.position;
    // every power's speed, seen: dust and grit thrown up behind
    if (pose.boost > 1.05 && pose.y < 0.5 && Math.random() < 0.6)
      puff(race, V.copy(here).add(V2.set(0, 0.4, 0)), '#c9bfae', 1 + Math.random(), V2.set(0, 1.2, 0), 1.8, 1.8);
    // the others it reaches
    for (const r of race.karts) {
      if (r === k || r.finished) continue;
      const d = race.dS(r.s, k.s),
        dl = Math.abs(r.lat - k.lat);
      if (type === 'kart' || type === 'rail') {
        // passed while it runs, close enough across the road: blown off by the wake, smashed by the wheelie
        if (d < 1.5 && d > -3 && dl < (type === 'kart' ? P.wake : 6)) ko(race, r, k);
      } else if (type === 'monster' && fx.quake != null) {
        if (Math.abs(d) < fx.quake * P.radius && dl < 30) ko(race, r, k);
      } else if (type === 'roadster' && fx.land != null && fx.land < 0.35) {
        if (Math.hypot(d, dl) < P.blast) ko(race, r, k);
      }
    }
    // EARTHQUAKE: the slam's shockwave on the ground
    if (type === 'monster' && fx.quake != null && t0 <= P.air) {
      race.fx.ring(tr.point(k.s, k.lat, 0.5), '#ffd23a', P.radius);
      race.fx.boom(tr.point(k.s, k.lat, 0.6));
      if (k === race.player) race.shake = Math.max(race.shake, 0.8);
    }
    if (type === 'roadster' && fx.land != null && t0 <= P.dur)
      race.fx.ring(tr.point(k.s, k.lat, 0.5), '#ff6a00', P.blast);
    // SKY ROCKET: the thrusters out and firing, smoke kicked off the road under them
    if (k.pwFx?.thrusters) {
      const dep = fx.deploy || 0,
        th = (fx.thrust || 0) * dep;
      for (const tt of k.pwFx.thrusters) {
        tt.g.scale.setScalar(Math.max(0.001, dep));
        tt.jet.visible = tt.core.visible = th > 0.02;
        if (!tt.jet.visible) continue;
        tt.g.getWorldPosition(V);
        const ground = tr.point(k.s, k.lat, 0).y,
          reach = Math.min(7, Math.max(0.6, V.y - ground));
        tt.jet.scale.set(1, reach, 1);
        tt.core.scale.set(1, reach * 0.85, 1);
        tt.jet.material.opacity = 0.75 * th;
        if (V.y - ground < 8 && Math.random() < 0.5 * th)
          puff(
            race,
            V.setY(ground + 0.4),
            '#d9dde8',
            2 + Math.random(),
            V2.set((Math.random() - 0.5) * 12, 0.6, (Math.random() - 0.5) * 12),
            1.8,
            0.8,
          );
      }
    }
    // SUPERSONIC: the vapour cone and shock diamonds
    if (k.pwFx?.vapour) {
      const on = fx.sonic != null;
      k.pwFx.vapour.material.opacity = on ? Math.min(0.32, fx.sonic * 1.2) * (0.85 + Math.random() * 0.15) : 0;
      k.pwFx.diamonds.visible = on;
      if (on) {
        k.pwFx.mistTex.offset.x += dt * 3;
        k.pwFx.mistTex.offset.y -= dt * 1.5;
      }
    }
    // WHEELIE LAUNCH: fire off the back tyres
    if (fx.tyreFire)
      for (const sx of [-0.9, 0.9])
        puff(
          race,
          k.m.root.localToWorld(V.set(sx, 0.4, -1.6)),
          Math.random() < 0.5 ? '#ff5a10' : '#ffc23a',
          0.7 + Math.random() * 0.6,
          V2.set(0, 2.5, 0),
          0.6,
          3,
        );
    // FIRE TRAIL: patches of fire laid behind the tyres
    if (fx.fire && Math.random() < dt * 30) race.pwFire.push({ s: k.s - 2.2, lat: k.lat, life: 99, owner: k }); // (out when the power ends)
    // HARPOON: within reach of the car ahead, the boom snaps out, catches it and throws it off the road
    if (fx.harpoon != null) {
      if (!pw.target)
        pw.target =
          race.karts
            .filter(o => o !== k && !o.finished && race.dS(o.s, k.s) > 0 && race.dS(o.s, k.s) < 60)
            .sort((a, b) => race.dS(a.s, k.s) - race.dS(b.s, k.s))[0] || null;
      const T = pw.target;
      if (T && pw.catchT < 0 && race.dS(T.s, k.s) < 12) pw.catchT = 0;
      if (T && pw.catchT >= 0) {
        pw.catchT += dt;
        const c = pw.catchT,
          out = Math.min(1, c / 0.15),
          thr = Math.min(1, Math.max(0, (c - 0.15) / 0.3)),
          base = k.m.root.localToWorld(V.set(0, 1.5, 1.6)).clone(),
          tp = T.m.root.position,
          aim = Math.atan2(tp.x - base.x, tp.z - base.z),
          L = Math.hypot(tp.x - base.x, tp.z - base.z) * out * (1 - Math.max(0, c - 0.45) / 0.4);
        race.pwBoom.boom.visible = c < 0.85;
        race.pwBoom.set(base, aim + ((P.swing * Math.PI) / 180) * thr * (T.lat > k.lat ? 1 : -1), L);
        if (thr >= 1 && !pw.thrown) {
          pw.thrown = true;
          ko(race, T, k);
          T.lane = (T.lat > k.lat ? 1 : -1) * 9; // (thrown off to the side)
        }
      }
    } else if (pw.thrown != null) {
      pw.thrown = null;
      race.pwBoom.boom.visible = false;
    }
    // CANNON FIRE: the cannon on the weapon mount; each shot from its muzzle, homing on a rival
    if (k.pwFx?.cannon) {
      const C = k.pwFx.cannon;
      C.visible = fx.cannon != null;
      if (k.m.gun) k.m.gun.visible = false;
      while (C.visible && pw.shots < (fx.shots || 0)) {
        const others = race.karts
          .filter(o => o !== k && !o.finished)
          .sort((a, b) => Math.abs(race.dS(a.s, k.s)) - Math.abs(race.dS(b.s, k.s)));
        const tgt = others[pw.shots % Math.max(1, Math.min(others.length, 4))],
          shot = race.pwShots.find(s => s.t < 0) || race.pwShots[0],
          at = C.userData.muzzle.getWorldPosition(new THREE.Vector3());
        Object.assign(shot, { t: 0, owner: k, tgt, pos: at.clone(), vel: V2.set(0, 0, 0).clone() });
        k.m.root.getWorldDirection(shot.vel);
        shot.vel.multiplyScalar(P.shot * 0.6);
        shot.m.visible = true;
        C.userData.barrel.position.z = -0.3;
        for (let i = 0; i < 6; i++)
          puff(
            race,
            at,
            i < 2 ? '#ffd27a' : '#cfd3da',
            i < 2 ? 1.2 : 1.6,
            V.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3),
            2,
            i < 2 ? 4 : 1.2,
          );
        pw.shots++;
      }
      C.userData.barrel.position.z += (0 - C.userData.barrel.position.z) * Math.min(1, dt * 8);
    }
  }
  // the beach balls, bounding down the road from the buggy that threw them
  for (const b of race.pwBalls) {
    if (b.t === -1 && !b.owner) continue;
    if (b.owner && b.t < 3.2) b.t += dt;
    else {
      b.m.visible = false;
      b.owner = null;
      b.t = -1;
      continue;
    }
    if (b.t < 0) continue;
    b.s += POWERS.buggy.speed * b.v * dt;
    const bounce = Math.abs(Math.sin(b.t * b.hop)) * 2.6 * Math.max(0.2, 1 - b.t / 3),
      p = tr.point(b.s, b.lat, b.r + bounce);
    b.m.visible = true;
    b.m.scale.setScalar(b.r);
    b.m.position.copy(p);
    b.m.rotation.x += dt * ((POWERS.buggy.speed * b.v) / b.r) * 0.5;
    for (const r of race.karts)
      if (r !== b.owner && Math.abs(race.dS(r.s, b.s)) < b.r + 1.5 && Math.abs(r.lat - b.lat) < b.r + 1.4)
        ko(race, r, b.owner);
  }
  // the cannonballs, homing in on their rivals wherever they are, trailing smoke
  for (const c of race.pwShots) {
    if (c.t < 0) continue;
    c.t += dt;
    const T = c.tgt && !c.tgt.finished && c.tgt.spin <= 0 ? c.tgt : null,
      sp = Math.max(40, POWERS.brute.shot);
    if (T) {
      V.copy(T.m.root.position)
        .add(V2.set(0, 1, 0))
        .sub(c.pos);
      const d = V.length() || 1;
      c.vel.lerp(V.multiplyScalar(sp / d), Math.min(1, dt * 6));
      if (d < 2.5) {
        ko(race, T, c.owner);
        race.fx.boom(c.pos.clone());
        c.t = 3;
      }
    }
    c.pos.addScaledVector(c.vel, dt);
    c.m.position.copy(c.pos);
    puff(race, c.pos, '#c9ccd4', 0.9, V2.set(0, 0.3, 0), 1.2, 0.8);
    if (c.t > 2.6) {
      c.t = -1;
      c.m.visible = false;
    }
  }
  // the fire trail: patches burning on the road; whoever drives into one spins out
  for (let i = race.pwFire.length - 1; i >= 0; i--) {
    const f = race.pwFire[i];
    f.life -= dt;
    if (f.life <= 0) {
      race.pwFire.splice(i, 1);
      continue;
    }
    if (Math.random() < 0.35)
      puff(
        race,
        tr.point(f.s, f.lat + (Math.random() - 0.5) * 1.5, 0.6),
        Math.random() < 0.5 ? '#ff6a1a' : '#ffc23a',
        1.3 + Math.random(),
        V2.set(0, 1.6, 0),
        0.4,
        2.2,
      );
    for (const r of race.karts)
      if (r !== f.owner && Math.abs(race.dS(r.s, f.s)) < 1.6 && Math.abs(r.lat - f.lat) < 1.8) ko(race, r, f.owner);
  }
  // the puffs drift, grow and fade
  for (const p of race.pwPuffs) {
    if (p.life <= 0) continue;
    p.life -= dt * p.decay;
    p.s.position.addScaledVector(p.v, dt);
    p.s.scale.multiplyScalar(1 + dt * p.grow);
    p.s.material.opacity = Math.max(0, Math.min(1, p.life)) * 0.8;
    if (p.life <= 0) p.s.visible = false;
  }
}

// when a kart's model is placed: the power lifts it (along the road's up, F.u) and turns it (pitch, yaw, roll about
// its own axes); a wheelie pivots on the back wheels
export function posePower(race, k, F) {
  const p = k.pw?.pose;
  if (!p) {
    k.pwBaseQ = null;
    return;
  }
  (k.pwBaseQ ||= new THREE.Quaternion()).copy(k.m.root.quaternion);
  const m = k.m,
    lift = p.pitch > 0 ? Math.sin(p.pitch) * (m.V.base || 1.2) : 0; // (its height off the road is real: k.Y, the race's own)
  m.root.position.addScaledVector(F.u, lift);
  E.set(-p.pitch, p.yaw, p.roll, 'YXZ');
  m.root.quaternion.multiply(Q.setFromEuler(E));
}

// the POWER button: its ring fills through the opening seconds, then it glows READY with the power's name; spent, it dims
export function paintPowerButton(race, el, arc, name) {
  const k = race.player;
  if (!k?.pw) return;
  const fill = Math.min(1, race.time / READY_AFTER),
    ready = powerReady(race, k),
    used = k.pw.used;
  arc.style.strokeDasharray = `${(used ? 0 : fill) * 100} 100`;
  el.classList.toggle('ready', ready);
  el.classList.toggle('used', used);
  const n = POWERS[k.m.type]?.name || 'POWER';
  if (name.textContent !== n) name.textContent = n;
}
