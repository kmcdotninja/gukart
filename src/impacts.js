// What a shot does to the world when it hits something that isn't a car (src/race.js flies the shots; this is the
// impact): a wall, a building, a barrier, a gate, the road, the ground.
//   a rocket: the fireball and a shockwave ring flat against the surface; pieces of that surface (in its own colour:
//     jagged chips and flat flakes of a wall's render, flat flakes of the road) blown out in a cone round the surface's
//     normal, and the rocket's own pieces (torn olive skin, its fins, its black nose cone) thrown back off it; all of it
//     falling under gravity, tumbling, bouncing, skidding and lying down flat, then shrinking away; a billow of dust; a
//     black scorch burned onto the surface that fades over half a minute
//   a rocket on a car: pieces of the car's own paintwork knocked off it, and the rocket's pieces (carHit)
//   a blaster bolt: a shower of sparks off the surface, a few small chips, a small scorch
// The race adds the rest: the blast's push on cars near it, the sound and the camera's shake by distance.
import * as THREE from 'three';
import { initHoles, holeMaterial, punch, stepHoles, clearHoles } from './holes.js';

// the numbers of it, shared with the Physics Studio (physics.html), whose sliders change them live
export const PHYS = {
  gravity: 30, // m/s², as the cars have it
  bounce: 0.32, // how much of a chunk's fall comes back up when it hits the ground (0 a thud, 1 a superball)
  friction: 0.62, // how much of its slide a chunk keeps at each bounce
  debris: 22, // chunks a rocket blows out of a surface (a bolt chips a few)
  blast: 10, // m: a rocket's blast throws a car within half of this and shoves one within all of it
};
// what a rocket's blast does to a car d m from it, the race's and the Physics Studio's alike: within half the blast
// radius a direct hit (blown up and over, tumbling, thrown away from the blast), out to the radius a shove (a hop and a
// slide away from it). By 1/sqrt(mass) (the vehicles' own, VSTATS): the Brute barely leaves the ground where a kart goes flying.
//   up: m/s up; push: m/s away from the blast (along the ground); spin: rad/s of tumble (0: no tumble)
export function blastKick(d, mass = 1) {
  const R = PHYS.blast;
  if (d >= R) return null;
  const f = 1 - d / R,
    kick = 1 / Math.sqrt(mass),
    near = d < R * 0.5;
  return {
    near,
    up: (near ? 13 : 1 + 5 * f) * kick,
    push: (near ? 9 : 2 + 6 * f) * kick,
    spin: near ? 7 : 0,
  };
}
const MAXS = 24; // scorch marks

// the shapes the pieces come in, each made to fit a 1 m box (scaled per piece, and differently along each side, so no
// two look alike): jagged chips, flat flakes, a torn curve of the rocket's skin, one of its fins, its nose cone
const rnd = (a, b) => a + Math.random() * (b - a);
function fitBox(g) {
  g.computeBoundingBox();
  const b = g.boundingBox,
    c = b.getCenter(new THREE.Vector3()),
    sz = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.scale(1 / Math.max(sz.x, 1e-3), 1 / Math.max(sz.y, 1e-3), 1 / Math.max(sz.z, 1e-3));
  g.computeVertexNormals();
  return g;
}
function chipGeo() {
  // a rock chip: a twenty-sided lump, every corner pushed in or out
  const g = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed(),
    p = g.attributes.position,
    seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, rnd(0.6, 1.25));
    const f = seen.get(key);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  return fitBox(g);
}
function flakeGeo() {
  // a flake: a jagged slab, broken edges all round
  const s = new THREE.Shape(),
    n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      r = rnd(0.3, 0.55);
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  return fitBox(new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }).rotateX(Math.PI / 2));
}
function shellGeo() {
  // a torn piece of the rocket's skin: a curve of its body with ragged ends
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 3, true, 0, 1.3),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) > 0.4) p.setY(i, p.getY(i) * rnd(0.55, 1.1));
  return fitBox(g);
}
function finGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.42, -0.28);
  s.lineTo(0.42, -0.48);
  s.lineTo(0, -0.46);
  s.lineTo(0, 0);
  return fitBox(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }));
}
function noseGeo() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push(new THREE.Vector2(0.2 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - u * 0.15), u * 0.9));
  }
  pts.unshift(new THREE.Vector2(0, 0));
  return fitBox(new THREE.LatheGeometry(pts, 14));
}
// each shape: its geometry, how many can be flying at once, and its material (the rocket's are its own colours;
// the chips, flakes and panels take the colour of what they came off)
const SHAPES = {
  chip: { geo: chipGeo, max: 140, mat: () => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }) },
  flake: { geo: flakeGeo, max: 140, mat: () => new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }) },
  panel: {
    geo: flakeGeo,
    max: 40,
    mat: () => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.3, flatShading: true }),
  },
  shell: {
    geo: shellGeo,
    max: 30,
    mat: () =>
      new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide, flatShading: true }),
  },
  fin: {
    geo: finGeo,
    max: 20,
    mat: () => new THREE.MeshStandardMaterial({ color: '#6f7b44', roughness: 0.55, metalness: 0.35 }),
  },
  nose: { geo: noseGeo, max: 8, mat: () => new THREE.MeshStandardMaterial({ color: '#16181c', metalness: 0.6, roughness: 0.3 }) },
};
const CORNERS = [];
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) CORNERS.push(new THREE.Vector3(x, y, z));
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const UP = new THREE.Vector3(0, 1, 0);

let scorchTex = null;
function scorchTexture() {
  if (scorchTex) return scorchTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(12,8,6,.95)');
  g.addColorStop(0.45, 'rgba(25,18,12,.7)');
  g.addColorStop(1, 'rgba(30,20,12,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  // ragged: soot streaks thrown out from the middle
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 30 + Math.random() * 30;
    x.strokeStyle = `rgba(20,14,10,${0.25 + Math.random() * 0.3})`;
    x.lineWidth = 2 + Math.random() * 4;
    x.beginPath();
    x.moveTo(64, 64);
    x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    x.stroke();
  }
  scorchTex = new THREE.CanvasTexture(c);
  scorchTex.colorSpace = THREE.SRGBColorSpace;
  return scorchTex;
}

export class Impacts {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    // the pieces: one instanced mesh per shape, each piece with its own colour, size, spin and life
    this.kinds = {};
    const o = new THREE.Object3D();
    o.scale.setScalar(0);
    o.updateMatrix();
    for (const [k, S] of Object.entries(SHAPES)) {
      const m = new THREE.InstancedMesh(S.geo(), S.mat(), S.max);
      m.castShadow = true;
      m.userData.noHit = true; // (shots pass through the pieces)
      m.frustumCulled = false;
      for (let i = 0; i < S.max; i++) {
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, new THREE.Color('#ffffff'));
      }
      scene.add(m);
      this.kinds[k] = {
        m,
        i: 0,
        bits: Array.from({ length: S.max }, () => ({
          life: 0,
          p: new THREE.Vector3(),
          v: new THREE.Vector3(),
          q: new THREE.Quaternion(),
          w: new THREE.Vector3(),
          s: new THREE.Vector3(1, 1, 1),
          rest: false,
        })),
      };
    }
    // the scorch marks: a pool of planes laid flat against whatever was hit
    this.scorch = Array.from({ length: MAXS }, () => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: scorchTexture(),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
        }),
      );
      holeMaterial(m.material); // (a hole shot through the wall goes through its scorch too)
      m.visible = false;
      m.renderOrder = 2;
      m.userData.noHit = true;
      scene.add(m);
      return { m, life: 0 };
    });
    this.si = 0;
    initHoles(scene); // (the holes shot through walls: src/holes.js)
    this.o = o;
    this.z = new THREE.Vector3(0, 0, 1);
    this._c = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._w = new THREE.Vector3();
  }
  // one piece: of a shape, at a point, flung at a velocity, its size (x, y, z), its colour
  piece(kind, at, vel, size, colour) {
    const K = this.kinds[kind],
      i = K.i++ % K.bits.length,
      b = K.bits[i];
    b.p.copy(at);
    b.v.copy(vel);
    b.q.setFromEuler(new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)));
    b.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14));
    b.s.copy(size);
    b.life = rnd(3, 4.5);
    b.rest = false;
    if (colour) K.m.setColorAt(i, new THREE.Color(colour).offsetHSL(0, 0, rnd(-0.08, 0.06)));
    K.m.instanceColor.needsUpdate = true;
  }
  // out from a surface: a direction in a cone round its normal (spread: how wide), at a speed
  cone(n, spread, speed) {
    const side = new THREE.Vector3()
        .crossVectors(n, Math.abs(n.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0))
        .normalize(),
      up = new THREE.Vector3().crossVectors(side, n).normalize(),
      a = Math.random() * Math.PI * 2,
      sp = Math.random() * spread;
    return n
      .clone()
      .multiplyScalar(Math.cos(sp))
      .addScaledVector(side, Math.cos(a) * Math.sin(sp))
      .addScaledVector(up, Math.sin(a) * Math.sin(sp))
      .multiplyScalar(speed);
  }
  // the rocket breaks up where it goes off: torn pieces of its olive skin, a fin or two, its black nose cone, thrown
  // back off what it hit (n: out of the surface) and up
  rocketParts(at, n) {
    const olive = ['#7d8a4e', '#636f3b', '#4a5230']; // (its paint, and scorched)
    for (let i = 0; i < 5; i++) {
      const v = this.cone(n, 1.2, rnd(5, 12));
      v.y += rnd(3, 7);
      this.piece('shell', at, v, new THREE.Vector3(rnd(0.25, 0.45), rnd(0.25, 0.5), rnd(0.08, 0.14)), olive[i % 3]);
    }
    for (let i = 0; i < 2; i++) {
      const v = this.cone(n, 1.3, rnd(6, 13));
      v.y += rnd(4, 8);
      this.piece('fin', at, v, new THREE.Vector3(0.55, 0.62, 0.04), null);
    }
    const v = this.cone(n, 0.9, rnd(4, 8));
    v.y += rnd(5, 9);
    this.piece('nose', at, v, new THREE.Vector3(0.36, 0.42, 0.36), null);
  }
  // a locked-on shot going straight through a wall on its way to its target (src/race.js, the Physics Studio): a hole
  // punched in where it goes in (a scorched ring, a few chips back at you) and blown out where it comes out on the far
  // side (the pieces of the wall thrown on the way it was going, a burnt ring round that side too). It flies on.
  // entry/exit: world points; nIn: out of the near face (back at the shot); nOut: out of the far face (the shot's way)
  // object: what it went through; the hole is cut in it, and you see through it to the other side (src/holes.js)
  pierce(entry, nIn, exit, nOut, colour, rocket = true, object = null) {
    // (the hole: a rocket's wider than a man is tall, torn and burnt round; a bolt's a big as a tyre)
    const r = rocket ? 1.4 : 0.55;
    punch(entry, exit, r, object);
    this.impact(entry, nIn, 'bolt', colour, { mark: r * 3.2 });
    this.impact(exit, nOut, 'bolt', colour, { mark: r * 3.8 });
    const n = nOut.clone().normalize(),
      at = exit.clone().addScaledVector(n, 0.2);
    for (let i = 0; i < (rocket ? 3 : 1); i++) this.fx.spark(at.clone().addScaledVector(n, i * 0.8), '#b8ab98', rocket ? 3 + i : 1.5, 0.8);
    const count = rocket ? Math.round(PHYS.debris * 0.6) : 3;
    for (let i = 0; i < count; i++) {
      const v = this.cone(n, 0.5, (rocket ? 10 : 6) + Math.random() * 8);
      v.y += 2;
      const sz = rocket ? rnd(0.15, 0.45) : rnd(0.08, 0.18);
      this.piece(i % 2 ? 'flake' : 'chip', at, v, new THREE.Vector3(sz, sz * rnd(0.5, 1), sz * rnd(0.6, 1)), colour);
    }
  }
  // a shot hits a surface at point (world), its normal pointing out of the surface; colour: the surface's own
  // (scorch: false when it's a car that was hit: the burn mark is for walls and the road)
  impact(point, normal, kind, colour = '#9a8a78', { scorch = true, mark = 0 } = {}) {
    const big = kind === 'rocket',
      n = normal.clone().normalize(),
      at = point.clone().addScaledVector(n, 0.15),
      road = n.y > 0.8; // (the road or the ground: flat flakes of it; a wall: chips and flakes of its render)
    if (big) {
      this.fx.boom(at, true);
      this.fx.ring(at, '#ffb24a', 22);
      // the dust: a billow of the surface's colour, out from it
      for (let i = 0; i < 6; i++) this.fx.spark(at.clone().addScaledVector(n, 1 + i * 0.4), '#b8ab98', 4 + i, 1.2);
    }
    // sparks off it
    for (let i = 0; i < (big ? 4 : 3); i++) this.fx.spark(at, i % 2 ? '#ffd27a' : '#fff2c8', big ? 2.4 : 1.1, 0.35);
    // pieces of it, thrown out in a cone round the normal
    const count = big ? Math.round(PHYS.debris) : Math.max(1, Math.round(PHYS.debris / 6));
    for (let i = 0; i < count; i++) {
      const v = this.cone(n, big ? 0.9 : 0.6, (big ? 9 : 5) + Math.random() * (big ? 12 : 5));
      v.y += big ? 4 : 2;
      const sz = big ? rnd(0.18, 0.6) : rnd(0.08, 0.2),
        flat = road || i % 2;
      this.piece(
        flat ? 'flake' : 'chip',
        at,
        v,
        flat
          ? new THREE.Vector3(sz, sz * rnd(0.15, 0.3), sz * rnd(0.6, 1))
          : new THREE.Vector3(sz, sz * rnd(0.6, 1), sz * rnd(0.6, 1)),
        colour,
      );
    }
    if (big) this.rocketParts(at, n);
    // the scorch on the surface
    if (!scorch) return;
    const s = this.scorch[this.si++ % MAXS];
    s.m.position.copy(point).addScaledVector(n, 0.04);
    s.m.quaternion.setFromUnitVectors(this.z, n);
    s.m.rotateZ(Math.random() * Math.PI * 2);
    s.m.scale.setScalar(mark || (big ? 3.6 + Math.random() : 0.9)); // (mark: a hole's own size)
    s.m.material.opacity = 1;
    s.m.visible = true;
    s.life = big ? 30 : 12;
    s.max = s.life;
  }
  // a rocket (dir: the way it was going; none for a mine under it) goes off on a car at point: pieces of its
  // paintwork knocked off it, out and up, and the rocket's own pieces
  carHit(point, paint, dir = null) {
    const n = dir ? dir.clone().setY(0).normalize() : UP.clone();
    for (let i = 0; i < 7; i++) {
      const v = this.cone(UP, 1.3, rnd(5, 11)).addScaledVector(n, rnd(2, 6));
      v.y += rnd(2, 5);
      const sz = rnd(0.25, 0.5);
      this.piece('panel', point, v, new THREE.Vector3(sz, sz * 0.12, sz * rnd(0.5, 0.9)), paint);
    }
    for (let i = 0; i < 4; i++) {
      const v = this.cone(UP, 1.4, rnd(4, 9));
      this.piece('chip', point, v, new THREE.Vector3(0.14, 0.1, 0.12).multiplyScalar(rnd(0.8, 1.6)), '#2a2c30');
    }
    if (dir) this.rocketParts(point, n.clone().negate().add(UP).normalize());
  }
  // groundAt(x, z): the height of the road or ground under a point (the pieces land on it)
  // (inside(p): is a world point inside something solid? A piece that flies into it bounces back off. Optional)
  // A piece lands on its lowest corner (never sunk into the ground), bounces, skids with friction and, slowing, lies
  // down flat on its nearest side; it lies there, then shrinks away
  update(dt, groundAt, inside) {
    stepHoles(dt);
    const o = this.o,
      c = this._c;
    for (const K of Object.values(this.kinds)) {
      let moved = false;
      for (let i = 0; i < K.bits.length; i++) {
        const b = K.bits[i];
        if (b.life <= 0) continue;
        moved = true;
        b.life -= dt;
        if (!b.rest) {
          b.v.y -= PHYS.gravity * dt;
          b.p.addScaledVector(b.v, dt);
          const wl = b.w.length();
          if (wl > 1e-4) b.q.premultiply(this._q.setFromAxisAngle(this._w.copy(b.w).divideScalar(wl), wl * dt));
          if (inside?.(b.p)) {
            b.p.addScaledVector(b.v, -dt);
            b.v.x *= -0.35;
            b.v.z *= -0.35;
          }
          let lo = Infinity;
          for (const k of CORNERS) lo = Math.min(lo, c.copy(k).multiply(b.s).applyQuaternion(b.q).y);
          const gy = groundAt(b.p.x, b.p.z);
          if (b.p.y + lo <= gy) {
            const hit = -b.v.y;
            b.p.y = gy - lo;
            b.v.y = hit > 1.5 ? hit * PHYS.bounce : 0;
            b.v.x *= PHYS.friction;
            b.v.z *= PHYS.friction;
            b.w.multiplyScalar(0.55);
            if (hit < 3) {
              // slowing: down flat on whichever side is nearest down
              let best = null,
                bd = -1;
              for (const a of AXES) {
                const wa = c.copy(a).applyQuaternion(b.q),
                  d = Math.abs(wa.y) * (1 + (a.y ? 0 : 0)) * (b.s.getComponent(AXES.indexOf(a)) < 0.6 * Math.max(b.s.x, b.s.y, b.s.z) ? 1.5 : 1);
                if (d > bd) {
                  bd = d;
                  best = wa.clone().multiplyScalar(Math.sign(wa.y) || 1);
                }
              }
              const flat = new THREE.Quaternion().setFromUnitVectors(best, UP).multiply(b.q);
              b.q.slerp(flat, Math.min(1, dt * 8));
              let lo2 = Infinity;
              for (const k of CORNERS) lo2 = Math.min(lo2, c.copy(k).multiply(b.s).applyQuaternion(b.q).y);
              b.p.y = gy - lo2;
              if (b.v.lengthSq() < 0.4 && b.q.angleTo(flat) < 0.02) b.rest = true;
            }
          }
        }
        const shrink = Math.min(1, b.life / 0.6);
        o.position.copy(b.p);
        o.quaternion.copy(b.q);
        o.scale.copy(b.s).multiplyScalar(Math.max(0.0001, shrink));
        if (b.life <= 0) o.scale.setScalar(0);
        o.updateMatrix();
        K.m.setMatrixAt(i, o.matrix);
      }
      if (moved) K.m.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.scorch) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.m.material.opacity = Math.min(1, s.life / (s.max * 0.4));
      if (s.life <= 0) s.m.visible = false;
    }
  }
  // a new race: everything cleared away
  clear() {
    this.o.scale.setScalar(0);
    this.o.position.set(0, 0, 0);
    this.o.quaternion.identity();
    this.o.updateMatrix();
    for (const K of Object.values(this.kinds)) {
      for (let i = 0; i < K.bits.length; i++) {
        K.bits[i].life = 0;
        K.m.setMatrixAt(i, this.o.matrix);
      }
      K.m.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.scorch) {
      s.life = 0;
      s.m.visible = false;
    }
    clearHoles();
  }
}
