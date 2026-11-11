// The race. Karts live in road space: distance along the track (s), distance left of centre (lat), heading relative to
// the road (rh), and height above it (air). That's what lets them climb the spiral, cross the flyover, run the loop
// upside down and fly off the ramps. Plus drifting and mini-turbos, weapons, rival AI, coins, laps and positions.
import * as THREE from 'three';
import { W } from './track.js';
import { makeKart, setFace, RACERS, ENV, nitroBottle } from './buddy.js';
import { clamp, lerp, wrapA, store } from './util.js';
import { Sound } from './audio.js';
const _spray = new THREE.Vector3();

export const LAPS = 3;
const MAX = 66,
  ACC = 27,
  TURN = 1.75,
  GRAV = 30;
const SKILL = [1, 0.955, 0.94, 0.965, 0.925, 0.945];
// the shield: a round bubble over the whole vehicle, glowing at its rim (fresnel), a honeycomb of light sliding over it
const SHIELD_GEO = new THREE.SphereGeometry(1, 48, 32);
export function shieldBubble(m) {
  m.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(m.root.matrixWorld).invert(),
    box = new THREE.Box3();
  m.root.traverse(o => {
    // the solid vehicle only: see-through effects (flames, glows, light cones) made the bubble far too big
    const mt = o.material;
    if (
      o.isMesh &&
      o.visible &&
      o.geometry &&
      !o.isSprite &&
      !mt?.transparent &&
      mt?.blending !== THREE.AdditiveBlending
    ) {
      o.geometry.computeBoundingBox?.();
      if (o.geometry.boundingBox)
        box.union(
          o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)),
        );
    }
  });
  const c = box.getCenter(new THREE.Vector3()),
    sz = box.getSize(new THREE.Vector3());
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uT: { value: 0 },
      uFlash: { value: 0 },
      uAlpha: { value: 1 },
      uCol: { value: new THREE.Color('#4fe3ff') },
    },
    vertexShader:
      'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 w = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }',
    fragmentShader: `uniform float uT, uFlash, uAlpha; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float hexEdge(vec2 p){ p *= 9.; vec2 r = vec2(1., 1.732), h = r * .5; vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;
        g = abs(g); float d = max(dot(g, normalize(vec2(1., 1.732))), g.x); return smoothstep(.43, .5, d); }
      void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec2 uv = vec2(atan(vP.z, vP.x) * .6, vP.y * 1.2 - uT * .25);
        float hx = hexEdge(uv) * (.35 + .65 * smoothstep(-1., 1., sin(vP.y * 6. - uT * 3.)));
        float a = (f * .9 + hx * .35 + .06 + uFlash * (.5 + f)) * uAlpha;
        gl_FragColor = vec4(mix(uCol, vec3(1.), uFlash * .6 + f * .2) * a, a); }`,
  });
  const b = new THREE.Mesh(SHIELD_GEO, mat);
  b.position.copy(c);
  // a bubble shaped to the vehicle (longer than it is tall), just clear of the body: a sphere round the whole diagonal
  // was far bigger than the kart inside it. A little sits under the road, so it reads as a bubble on the ground
  b.scale.set(sz.x * 0.62 + 0.15, sz.y * 0.7 + 0.2, sz.z * 0.62 + 0.15);
  b.renderOrder = 3;
  m.root.add(b);
  return b;
}
// a weapon crate, as it stands on the road: a wooden supply crate with orange steel corners, a hazard band and a stencil
// (also the chest that opens on the home screen, src/chest.js). The texture and materials are made once
let CRATE = null;
export function itemCrate() {
  if (!CRATE) {
    const crateT = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#d9a466';
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5; i++) {
        x.fillStyle = i % 2 ? '#cf9a5c' : '#e3b277';
        x.fillRect(0, i * 51, 256, 49);
        x.fillStyle = 'rgba(40,20,5,.5)';
        x.fillRect(0, i * 51 + 49, 256, 2);
      }
      for (let i = 0; i < 300; i++) {
        x.fillStyle = `rgba(50,25,8,${Math.random() * 0.25})`;
        x.fillRect(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 30, 1);
      }
      x.save();
      x.beginPath();
      x.rect(0, 104, 256, 48);
      x.clip();
      x.fillStyle = '#ffc400';
      x.fillRect(0, 104, 256, 48);
      x.fillStyle = '#16181d';
      for (let i = -48; i < 300; i += 36) {
        x.beginPath();
        x.moveTo(i, 152);
        x.lineTo(i + 18, 152);
        x.lineTo(i + 66, 104);
        x.lineTo(i + 48, 104);
        x.fill();
      }
      x.restore();
      x.fillStyle = 'rgba(15,15,20,.85)';
      x.font = '900 italic 64px "Barlow Condensed", Impact, sans-serif';
      x.textAlign = 'center';
      x.fillText('GK', 128, 86);
      x.strokeStyle = 'rgba(40,20,5,.7)';
      x.lineWidth = 10;
      x.strokeRect(5, 5, 246, 246);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const crateBody = new THREE.BoxGeometry(2.1, 2.1, 2.1),
      crateMat = new THREE.MeshStandardMaterial({
        map: crateT,
        roughness: 0.65,
        envMap: ENV.tex,
        envMapIntensity: 0.9,
        emissive: '#5a3a18',
        emissiveIntensity: 0.35,
      });
    const capGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5),
      capMat = new THREE.MeshStandardMaterial({
        color: '#ff6a00',
        metalness: 0.5,
        roughness: 0.3,
        envMap: ENV.tex,
        emissive: '#7a2a00',
        emissiveIntensity: 0.4,
      });
    const makeCrate = () => {
      const g = new THREE.Group(),
        b = new THREE.Mesh(crateBody, crateMat);
      b.castShadow = true;
      g.add(b);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            const c = new THREE.Mesh(capGeo, capMat);
            c.position.set(sx * 0.95, sy * 0.95, sz * 0.95);
            g.add(c);
          }
      return g;
    };

    CRATE = makeCrate;
  }
  return CRATE();
}

export const WEAPONS = {
  blaster: { name: 'Blaster', ammo: 16, color: '#6fd3ff' },
  rocket: { name: 'Rocket', ammo: 2, color: '#ff6a00' },
  shock: { name: 'Shockwave', ammo: 1, color: '#b18cff' },
  mines: { name: 'Mines', ammo: 3, color: '#ffc400' },
  yaji: { name: 'Yaji boost', ammo: 3, color: '#ff3b3b' },
  fire: { name: 'Fire', ammo: 1, color: '#ff4d1f' }, // rare: sets you on fire the moment it lands (fire mode, below)
  shield: { name: 'Shield', ammo: 1, color: '#4fe3ff' }, // goes up the moment it lands: blocks everything for 10 s, or 3 big hits
};
// how each vehicle drives
export const VSTATS = {
  kart: { top: 1, acc: 1, turn: 1, off: 0.55, mass: 1 },
  buggy: { top: 0.975, acc: 1.1, turn: 0.97, off: 0.85, mass: 1.2 },
  monster: { top: 0.955, acc: 0.92, turn: 0.9, off: 0.95, mass: 1.8 },
  muscle: { top: 1.02, acc: 0.97, turn: 0.92, off: 0.6, mass: 1.4 },
};
const DRIFT_COL = ['#ffffff', '#6fd3ff', '#ff9a1f', '#d65cff'];
const FLAME_COL = ['#ff9a1f', '#6fd3ff', '#ff9a1f', '#d65cff', '#ff3b1f', '#9fe4ff', '#ffd23a'];
const Y = new THREE.Vector3(0, 1, 0);

// one-shot effects: flashes, rings, sparks
class FX {
  constructor(scene, tex) {
    const sprite = map => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      s.visible = false;
      scene.add(s);
      return s;
    };
    this.items = Array.from({ length: 120 }, () => ({ s: sprite(tex.glow), life: 0 }));
    this.rings = Array.from({ length: 10 }, () => ({ s: sprite(tex.ring), life: 0 }));
    this.n = 0;
    this.r = 0;
  }
  spark(pos, color, size, life, vel) {
    const it = this.items[this.n++ % this.items.length];
    it.s.position.copy(pos);
    it.s.material.color.set(color);
    it.life = it.max = life;
    it.size = size;
    it.v = vel ? vel.clone() : null;
    it.s.visible = true;
  }
  ring(pos, color, size) {
    const it = this.rings[this.r++ % this.rings.length];
    it.s.position.copy(pos);
    it.s.material.color.set(color);
    it.life = it.max = 0.5;
    it.size = size;
    it.s.visible = true;
  }
  boom(pos, big = true) {
    this.spark(pos, '#fff3c0', big ? 9 : 4, 0.25);
    this.spark(pos, '#ff6a00', big ? 14 : 6, 0.5);
    if (big) this.ring(pos, '#ffb23a', 22);
    const v = new THREE.Vector3();
    for (let i = 0; i < (big ? 18 : 6); i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(8 + Math.random() * 14);
      this.spark(pos, i % 2 ? '#ffb23a' : '#ff5a1f', 0.9, 0.7, v);
    }
  }
  zap(pos) {
    this.spark(pos, '#9fe4ff', 3.2, 0.18);
    const v = new THREE.Vector3();
    for (let i = 0; i < 5; i++) {
      v.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(14);
      this.spark(pos, '#6fd3ff', 0.6, 0.35, v);
    }
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      const k = 1 - it.life / it.max;
      if (it.v) {
        it.v.y -= 25 * dt;
        it.s.position.addScaledVector(it.v, dt);
      }
      const sc = it.v ? it.size * (1 - k * 0.5) : it.size * (0.4 + k * 0.8);
      it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = Math.max(0, 1 - k);
      if (it.life <= 0) it.s.visible = false;
    }
    for (const it of this.rings) {
      if (it.life <= 0) continue;
      it.life -= dt;
      const k = 1 - it.life / it.max,
        sc = it.size * (0.2 + k);
      it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = Math.max(0, 1 - k);
      if (it.life <= 0) it.s.visible = false;
    }
  }
}

// confetti: paper squares in five colours, tumbling and fluttering down
class Confetti {
  constructor(scene) {
    this.n = 500;
    this.m = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.32, 0.2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      this.n,
    );
    this.m.frustumCulled = false;
    scene.add(this.m);
    this.p = [];
    const c = new THREE.Color(),
      cols = ['#ff6a00', '#ffc400', '#ffffff', '#2ec4b6', '#e8336a', '#4f6bff', '#008751'];
    for (let i = 0; i < this.n; i++) {
      this.p.push({
        pos: new THREE.Vector3(0, -99, 0),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(),
        life: 0,
      });
      this.m.setColorAt(i, c.set(cols[i % cols.length]));
    }
    this.o = new THREE.Object3D();
    this.i = 0;
  }
  burst(at, n = 260, up = 16) {
    for (let k = 0; k < n; k++) {
      const q = this.p[this.i++ % this.n];
      q.pos.copy(at);
      q.pos.x += (Math.random() - 0.5) * 6;
      q.pos.z += (Math.random() - 0.5) * 6;
      q.v.set((Math.random() - 0.5) * 16, up * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 16);
      q.vt = 3.2 + Math.random() * 2.8; // its own terminal fall speed: heavier bits drop faster
      q.ph = Math.random() * 6.3;
      q.fr = 4 + Math.random() * 4;
      q.amp = 0.8 + Math.random() * 1.6; // the flutter: a swing side to side as it falls
      q.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 12);
      q.life = 1;
      q.ground = 0;
    }
  }
  update(dt) {
    this.p.forEach((q, i) => {
      if (q.life > 0) {
        if (q.ground > 0) {
          // lying on the road a moment, then gone
          q.ground -= dt;
          if (q.ground <= 0) q.life = 0;
        } else {
          const drag = Math.exp(-1.6 * dt);
          q.v.x *= drag;
          q.v.z *= drag;
          q.v.y = Math.max(q.v.y - 22 * dt, -q.vt); // falls properly, at its own speed
          q.ph += q.fr * dt;
          const sw = Math.cos(q.ph) * q.amp * (q.v.y < 0 ? 1 : 0.2);
          q.pos.addScaledVector(q.v, dt);
          q.pos.x += sw * dt;
          q.pos.z += Math.sin(q.ph * 0.7 + i) * q.amp * 0.5 * dt;
          q.r.x += q.w.x * dt;
          q.r.y += q.w.y * dt;
          q.r.z = Math.sin(q.ph) * 0.9; // tips with the swing, like paper
          if (q.pos.y <= 0.04) {
            q.pos.y = 0.04;
            q.r.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
            q.r.z = 0;
            q.ground = 2.5 + Math.random() * 2;
          }
        }
      }
      if (q.life > 0) {
        this.o.position.copy(q.pos);
        this.o.rotation.copy(q.r);
        this.o.scale.setScalar(q.ground > 0 ? Math.min(1, q.ground / 0.6) : 1);
      } else {
        this.o.position.set(0, -99, 0);
        this.o.scale.setScalar(0);
      }
      this.o.updateMatrix();
      this.m.setMatrixAt(i, this.o.matrix);
    });
    this.m.instanceMatrix.needsUpdate = true;
  }
}

// the finish, dressed for the last lap: an arch with a chequered FINISH banner, flags, balloon clusters
function finishArch(tr) {
  const g = new THREE.Group(),
    F = tr.frame(0, tr.newFrame());
  g.position.copy(F.p);
  g.rotation.y = Math.atan2(F.t.x, F.t.z);
  const chk = (() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 160;
    const x = c.getContext('2d');
    for (let i = 0; i < 32; i++)
      for (let j = 0; j < 5; j++) {
        x.fillStyle = (i + j) % 2 ? '#15161b' : '#ffffff';
        x.fillRect(i * 32, j * 32, 32, 32);
      }
    x.fillStyle = 'rgba(11,19,48,.92)';
    x.fillRect(300, 18, 424, 124);
    x.fillStyle = '#ffffff';
    x.font = '900 italic 104px "Barlow Condensed", Impact, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('FINISH', 512, 84);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const W2 = W / 2 + 3,
    pil = new THREE.MeshLambertMaterial({ color: '#ff6a00' });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 11, 1.2), pil);
    p.position.set(sx * W2, 5.5, 0);
    p.castShadow = true;
    g.add(p);
  }
  const ban = new THREE.Mesh(new THREE.BoxGeometry(W2 * 2 + 1.2, 2.6, 0.4), [
    pil,
    pil,
    pil,
    pil,
    new THREE.MeshBasicMaterial({ map: chk }),
    new THREE.MeshBasicMaterial({ map: chk }),
  ]);
  ban.position.y = 11;
  g.add(ban);
  const cols = ['#ff6a00', '#ffc400', '#ffffff', '#e8336a', '#2ec4b6', '#008751'],
    bg = new THREE.SphereGeometry(0.8, 14, 10);
  for (const sx of [-1, 1])
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(bg, new THREE.MeshPhongMaterial({ color: cols[k % cols.length], shininess: 90 }));
      b.position.set(sx * W2 + (Math.random() - 0.5) * 2.4, 12.6 + Math.random() * 2.6, (Math.random() - 0.5) * 1.6);
      b.scale.y = 1.15;
      g.add(b);
    }
  for (let k = -6; k <= 6; k++) {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.2),
      new THREE.MeshLambertMaterial({ color: cols[(k + 6) % cols.length], side: THREE.DoubleSide }),
    );
    f.position.set((k * W2) / 6.5, 9.4 - Math.cos(((k / 6) * Math.PI) / 2) * 0.5, 0);
    g.add(f);
  }
  g.visible = false;
  return g;
}

export class Race {
  constructor(scene, tr, tex, quality, ev) {
    this.scene = scene;
    this.tr = tr;
    this.tex = tex;
    this.ev = ev;
    this.quality = quality;
    this.F = tr.newFrame();
    this.fx = new FX(scene, tex);
    this.confetti = new Confetti(scene);
    this.arch = finishArch(tr);
    scene.add(this.arch);
    this.karts = RACERS.map((def, n) => {
      const m = makeKart(def, tex, n === 0 ? quality.layers : quality.aiLayers);
      scene.add(m.root);
      return { def, m, n, name: def.name, color: def.fur };
    });
    this.player = this.karts[0];
    this.all = this.karts;
    this.mode = 'gp';
    this.input = { steer: 0, drift: false, brake: false, fire: false, firePressed: false, driftPressed: false };
    const pt = (s, lat, h) => tr.point(s, lat, h);

    // weapon crates in rows across the road, coins, boost pads
    const makeCrate = itemCrate; // (one crate, shared with the chests on the home screen: src/chest.js)
    const glowMat = new THREE.MeshBasicMaterial({
      map: tex.glow,
      color: '#ffb340',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowGeo = new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2);
    this.boxes = [];
    this.coins = [];
    this.pads = [];
    const basis = (s, lat, h, m) => {
      const F = tr.frame(s, tr.newFrame());
      m.matrix.makeBasis(F.l, F.u, F.t).setPosition(F.p.clone().addScaledVector(F.l, lat).addScaledVector(F.u, h));
      m.matrixAutoUpdate = false;
    };
    const padGeo = new THREE.PlaneGeometry(4.6, 7).rotateX(-Math.PI / 2),
      padMat = new THREE.MeshBasicMaterial({ map: tex.pad, transparent: true });
    for (const f of tr.feats) {
      if (tr.closed && tr.closed[tr.idx(f.s)]) continue; // (on the closed straight at the fork)
      if (f.type === 'items')
        for (const lat of f.lats || [-8, -4, 0, 4, 8]) {
          const m = makeCrate();
          m.position.copy(pt(f.s, lat, 1.9));
          scene.add(m);
          const gl = new THREE.Mesh(glowGeo, glowMat);
          gl.position.copy(pt(f.s, lat, 0.14));
          scene.add(gl);
          m.userData.glow = gl;
          this.boxes.push({ s: f.s, lat, m, t: 0, ph: Math.random() * 6, base: m.position.clone() });
        }
      if (f.type === 'coins') {
        const n = f.n || 8,
          gap = f.gap || 5;
        for (let k = 0; k < n; k++) {
          const s = tr.wrapS(f.s + k * gap),
            lat = (f.lat || 0) + (f.wave ? Math.sin(k * 0.9) * 5 : 0);
          this.coins.push({ s, lat, p: pt(s, lat, 1.3), t: 0 });
        }
      }
      if (f.type === 'pad') {
        const m = new THREE.Mesh(padGeo, padMat);
        basis(f.s, f.lat || 0, 0.13, m);
        scene.add(m);
        this.pads.push({ s: f.s, lat: f.lat || 0 });
      }
    }
    const coinFace = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(100, 90, 10, 128, 128, 128);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.5, '#e7b23a');
      g.addColorStop(1, '#a8701a');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#8a5a12';
      x.lineWidth = 14;
      x.beginPath();
      x.arc(128, 128, 112, 0, 7);
      x.stroke();
      x.strokeStyle = '#ffe9a0';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(128, 128, 100, 0, 7);
      x.stroke();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const edgeT = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 16;
      const x = c.getContext('2d');
      x.fillStyle = '#c9902c';
      x.fillRect(0, 0, 256, 16);
      x.fillStyle = '#8a5a12';
      for (let i = 0; i < 64; i++) x.fillRect(i * 4, 0, 2, 16);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(3, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const gold = o =>
      new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.28, envMap: ENV.tex, envMapIntensity: 1.3, ...o });
    this.coinMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.16, 32).rotateX(Math.PI / 2),
      [
        gold({ map: edgeT, bumpMap: edgeT, bumpScale: 2 }),
        gold({ map: coinFace, bumpMap: coinFace, bumpScale: 3 }),
        gold({ map: coinFace, bumpMap: coinFace, bumpScale: 3 }),
      ],
      this.coins.length,
    );
    this.coinMesh.castShadow = true;
    scene.add(this.coinMesh);
    // nitro canisters: a blue bottle with a chrome cap; pick them up to fill the nitro meter
    this.nitros = [];
    // a proper nitrous bottle: a turned body (domed base, rounded shoulders) in candy-blue clearcoat, a wrapped label
    // with the N2O mark and racing stripes, a chrome neck and valve block, a red hand-wheel, a chrome foot ring;
    // standing in a soft blue ring of light on the road so it reads from far off
    const bottle = new THREE.Group();
    {
      const b = nitroBottle('#4fb0ff');
      b.position.y = -0.95;
      bottle.add(b);
    } // the classic blue bottle
    const ringT = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d'),
        g = x.createRadialGradient(64, 64, 20, 64, 64, 64);
      g.addColorStop(0, 'rgba(80,170,255,0)');
      g.addColorStop(0.55, 'rgba(80,170,255,.75)');
      g.addColorStop(0.7, 'rgba(160,215,255,.9)');
      g.addColorStop(1, 'rgba(80,170,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const ringM = new THREE.MeshBasicMaterial({
      map: ringT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const f of tr.feats)
      if (f.type === 'coins' && !f.wave && !(tr.closed && tr.closed[tr.idx(f.s)])) {
        const s0 = tr.wrapS(f.s + (f.n || 8) * (f.gap || 5) + 10),
          lat = -(f.lat || 0) * 0.6,
          m = bottle.clone();
        m.position.copy(pt(s0, lat, 1.4));
        scene.add(m);
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2), ringM);
        ring.position.copy(pt(s0, lat, 0.08));
        scene.add(ring);
        this.nitros.push({ s: s0, lat, m, ring, t: 0, base: m.position.clone() });
      }

    // projectile and mine meshes
    this.boltGeo = new THREE.CylinderGeometry(0.13, 0.13, 2.6, 6).rotateX(Math.PI / 2);
    this.boltMat = new THREE.MeshBasicMaterial({
      color: '#9fe4ff',
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.rocketGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.8, 10).rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshPhongMaterial({ color: '#ff6a00', emissive: '#5a1d00', shininess: 80 });
    this.mineGeo = new THREE.CylinderGeometry(1, 1.1, 0.4, 14);
    this.mineMat = new THREE.MeshPhongMaterial({ color: '#ffc400', emissive: '#3a2a00', shininess: 60 });
    this.mineLightGeo = new THREE.SphereGeometry(0.25, 8, 6);
    this.mineLight = new THREE.MeshBasicMaterial({ color: '#ff2b2b' });
    this.projs = [];
    this.mines = [];
    this.dust = Array.from({ length: 70 }, () => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex.dust, color: '#e2c79c', transparent: true, depthWrite: false }),
      );
      s.visible = false;
      scene.add(s);
      return { s, life: 0, v: new THREE.Vector3() };
    });
    this.dustI = 0;
    this.tq = new THREE.Quaternion();
    this.yq = new THREE.Quaternion();
    this.mx = new THREE.Matrix4();
    this.v1 = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.v3 = new THREE.Vector3();
    this.v4 = new THREE.Vector3();
    this.up = new THREE.Vector3();
    // tyre marks: dark streaks on asphalt, ruts in the sand
    this.marks = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.55, 1.3).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      700,
    );
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.marks.frustumCulled = false;
    this.markI = 0;
    {
      const z = new THREE.Matrix4().makeScale(0, 0, 0),
        c = new THREE.Color('#222');
      for (let i = 0; i < 700; i++) {
        this.marks.setMatrixAt(i, z);
        this.marks.setColorAt(i, c);
      }
    }
    scene.add(this.marks);
    this.mq = new THREE.Matrix4();
    this.ms = new THREE.Vector3(1, 1, 1);
    this.mc = new THREE.Color();
    this.reset();
  }

  dS(a, b) {
    const L = this.tr.len;
    return ((((a - b) % L) + L * 1.5) % L) - L / 2;
  } // signed road distance a - b

  reset() {
    const tr = this.tr;
    const slots = [4, 0, 1, 2, 3, 5]; // Buddy starts 5th
    this.karts.forEach((k, n) => {
      const g = slots[n],
        row = Math.floor(g / 2),
        col = g % 2;
      Object.assign(k, {
        s: tr.len - (8 + row * 9 + col * 4),
        lat: col ? -5 : 5,
        rh: 0,
        lap: -1,
        prog: 0,
        speed: 0,
        steer: 0,
        steerS: 0,
        throttle: 0,
        driftHeld: false,
        drift: 0,
        charge: 0,
        boost: 0,
        boostLvl: 0,
        spin: 0,
        spinA: 0,
        yawRate: 0,
        wheelA: 0,
        hop: 0,
        hopV: 0,
        air: 0,
        fly: false,
        Y: 0,
        vy: 0,
        airT: 0,
        squash: 0,
        sqT: 9,
        markD: 0,
        trick: 0,
        trickA: 0,
        trickDone: false,
        tumble: 0,
        tumbleA: 0,
        visYaw: 0,
        finished: false,
        finishTime: Infinity,
        weapon: null,
        pending: null,
        ammo: 0,
        rolling: 0,
        cool: 0,
        wT: 0,
        flashT: 0,
        zapN: 0,
        zapT: 0,
        coins: 0,
        offroad: false,
        padT: 0,
        rubber: 1,
        skill: SKILL[n],
        takedowns: 0,
        lane: (Math.random() - 0.5) * 12,
        laneT: Math.random() * 6,
        ai: n !== 0,
        rank: n + 1,
        prevRank: 0,
        blinkT: Math.random() * 3,
        move: null,
        moveT: 0,
        moveD: 1,
        moveSide: n % 2 ? 1 : -1,
        br: false,
        brI: 0,
        bs: 0,
        ghost: 0,
        nitro: 0,
        shield: 0,
        shieldFlash: 0,
        heat: 0, // fire mode: the HEAT meter, 0 to 1
        fire: 0, // seconds left on fire
      });
      k.prog = k.lap * tr.len + k.s;
      k.Y = tr.point(k.s, k.lat).y;
      setFace(k.m, 'calm');
      if (k.m.shieldBubble) k.m.shieldBubble.visible = false; // a new race starts with no shield up
    });
    this.arch.visible = false;
    for (const b of this.boxes) {
      b.t = 0;
      b.m.visible = b.m.userData.glow.visible = this.mode === 'gp';
    } // weapon crates are for racing the crew only
    for (const c of this.coins) c.t = 0;
    for (const n of this.nitros || []) {
      n.t = 0;
      n.m.visible = true;
      if (n.ring) n.ring.visible = true;
    }
    for (const p of this.projs) this.scene.remove(p.m);
    for (const m of this.mines) this.scene.remove(m.m);
    this.projs = [];
    this.mines = [];
    this.events = [];
    {
      const z = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < 700; i++) this.marks.setMatrixAt(i, z);
      this.marks.instanceMatrix.needsUpdate = true;
    }
    this.time = 0;
    // the upgrades won from chests (src/chest.js): they make your vehicle better, for good
    this.upg = new Set(store.get('upgrades', []));
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.wrongT = 0;
    this.shake = 0;
    this.playerRank = 5;
    this.rank();
    this.place(0, true);
  }

  note(type, k) {
    this.events.push({ type, k, t: this.clock || 0 });
    if (this.events.length > 20) this.events.shift();
  }

  addScore(pts, label) {
    this.combo = this.comboT > 0 ? Math.min(10, this.combo + 1) : 1;
    this.comboT = 3;
    const P = this.player,
      got = pts * Math.min(this.combo, 8) * (P.fire > 0 ? 2 : 1); // on fire, every point counts double
    // FIRE MODE: everything you chain (drifts, overtakes, takedowns, jumps, coins) heats you up; a full HEAT meter sets
    // you on fire. Bigger moves heat you more; a long chain gets there fastest
    if (P.fire <= 0 && this.mode !== 'free') {
      P.heat = Math.min(1, P.heat + Math.min(0.24, 0.06 + pts / 650) * (1 + Math.min(this.combo, 5) * 0.08));
      if (P.heat >= 1) this.ignite(P);
    }
    this.score += got;
    this.ev.score(this.score, this.combo, label, got);
  }

  /* ---------- weapons ---------- */
  giveWeapon(k) {
    if (k.weapon || k.rolling > 0) return;
    const r = k.rank,
      x = Math.random();
    const table =
      r <= 2
        ? [
            ['fire', 0.04],
            ['mines', 0.3],
            ['blaster', 0.25],
            ['shield', 0.2],
            ['shock', 0.15],
            ['rocket', 0.07],
            ['yaji', 0.03],
          ] // leaders get shields: they're the ones being shot at
        : r >= 5
          ? [
              ['fire', 0.08],
              ['rocket', 0.3],
              ['yaji', 0.26],
              ['blaster', 0.22],
              ['shock', 0.14],
              ['shield', 0.08],
            ]
          : [
              ['fire', 0.05],
              ['blaster', 0.3],
              ['rocket', 0.18],
              ['shield', 0.14],
              ['mines', 0.13],
              ['shock', 0.13],
              ['yaji', 0.12],
            ];
    let acc = 0,
      pick = table[0][0];
    for (const [w, p] of table) {
      acc += p;
      if (x < acc) {
        pick = w;
        break;
      }
    }
    if (k === this.player) {
      k.rolling = 0.9;
      k.pending = pick;
      this.ev.weapon(null, 0, true);
      Sound.item();
    } else if (pick === 'shield') this.raiseShield(k);
    else if (pick === 'fire') this.ignite(k);
    else {
      k.weapon = pick;
      k.ammo = WEAPONS[pick].ammo;
      k.wT = 0.6 + Math.random() * 2.5;
    }
  }
  // ON FIRE: red-hot tyres and a flame trail, about 15% faster, nothing slows you (no spin-outs, no slow ground),
  // every point doubled. 8 seconds (11 with the Hot Tyres upgrade)
  ignite(k) {
    const P = k === this.player;
    k.fire = 8 + (P && this.upg.has('hot') ? 3 : 0);
    k.heat = 0;
    k.boost = Math.max(k.boost, 0.8);
    this.note('boost', k);
    if (P) {
      Sound.boost();
      this.shake = 0.25;
      this.ev.fire?.(true);
      this.ev.heat?.(0);
    }
  }
  raiseShield(k) {
    k.shield = k === this.player && this.upg.has('armour') ? 14 : 10;
    k.shieldHits = 3;
    k.shieldFlash = 0.4;
    k.weapon = null;
    k.ammo = 0;
    if (k === this.player) {
      this.ev.weapon(null, 0, false);
      this.ev.toast('Shield up');
      this.ev.shield?.();
      Sound.blip(520, 0.35, 'sine', 0.12, 2.2);
    }
  }
  targetAhead(k, range = 260, latWin = 99) {
    let best = null,
      bd = range;
    for (const o of this.karts) {
      if (o === k) continue;
      const d = this.dS(o.s, k.s);
      if (d > 1 && d < bd && Math.abs(o.lat - k.lat) < latWin) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
  fire(k) {
    if (!k.weapon || k.cool > 0 || k.spin > 0) return;
    const w = k.weapon,
      P = k === this.player;
    this.note(w === 'yaji' ? 'boost' : 'fire', k);
    if (w === 'blaster') {
      const m = new THREE.Mesh(this.boltGeo, this.boltMat);
      this.scene.add(m);
      this.projs.push({
        type: 'bolt',
        s: k.s + 2.5,
        lat: k.lat,
        v: Math.max(0, k.speed) + 130,
        owner: k,
        life: 1.1,
        m,
        h: 1.6,
        target: this.targetAhead(k, 140, 12),
      });
      k.cool = 0.13;
      k.flashT = 0.06;
      if (P) Sound.blip(1400, 0.07, 'square', 0.05, 0.4);
    } else if (w === 'rocket') {
      const m = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      m.castShadow = true;
      this.scene.add(m);
      this.projs.push({
        type: 'rocket',
        s: k.s + 3,
        lat: k.lat,
        v: Math.max(0, k.speed) + 80,
        owner: k,
        life: 4,
        m,
        h: 1.7,
        target: this.targetAhead(k),
      });
      k.cool = 0.5;
      k.flashT = 0.12;
      if (P) Sound.blip(160, 0.5, 'sawtooth', 0.14, 2.5);
    } else if (w === 'shock') {
      const pos = this.tr.point(k.s, k.lat, 1.5);
      this.fx.ring(pos, '#b18cff', 46);
      this.fx.spark(pos, '#d9c8ff', 12, 0.3);
      for (const o of this.karts)
        if (o !== k && Math.abs(this.dS(o.s, k.s)) < 24 && Math.abs(o.lat - k.lat) < 20) this.hit(o, 'shock', k);
      k.cool = 0.5;
      if (P) {
        Sound.blip(90, 0.6, 'sawtooth', 0.18, 0.3);
        this.shake = 0.3;
      }
    } else if (w === 'mines') {
      const m = new THREE.Group(),
        body = new THREE.Mesh(this.mineGeo, this.mineMat),
        light = new THREE.Mesh(this.mineLightGeo, this.mineLight);
      body.castShadow = true;
      light.position.y = 0.35;
      m.add(body, light);
      this.scene.add(m);
      const s = this.tr.wrapS(k.s - 4),
        F = this.tr.frame(s, this.tr.newFrame());
      m.matrix.makeBasis(F.l, F.u, F.t).setPosition(F.p.clone().addScaledVector(F.l, k.lat).addScaledVector(F.u, 0.25));
      m.matrixAutoUpdate = false;
      this.mines.push({ s, lat: k.lat, m, light, arm: 0.5, life: 50 });
      k.cool = 0.35;
      if (P) Sound.blip(300, 0.15, 'triangle', 0.12, 0.6);
    } else if (w === 'yaji') {
      k.boost = Math.max(k.boost, 1.3);
      k.boostLvl = 4;
      k.cool = 0.45;
      if (P) Sound.boost();
    }
    k.ammo--;
    if (k.ammo <= 0) k.weapon = null;
    if (P) this.ev.weapon(k.weapon, k.ammo, false);
  }

  hit(k, type, by) {
    if (k.finished && k !== this.player) return;
    const pos = this.tr.point(k.s, k.lat, 1.5 + k.air);
    if (k.fire > 0) {
      // too hot to touch: it bursts off you in sparks
      this.fx.spark(pos, '#ff7a1f', 8, 0.3);
      if (k === this.player) this.ev.toast('Too hot to stop');
      return;
    }
    if (k.shield > 0) {
      // the shield takes it: a ripple of light, nothing gets through; big hits wear it down
      k.shieldFlash = 0.35;
      this.fx.ring(pos, '#4fe3ff', type === 'zap' ? 8 : 20);
      this.fx.spark(pos, '#bff6ff', type === 'zap' ? 3 : 8, 0.25);
      if (type !== 'zap' && --k.shieldHits <= 0) {
        k.shield = Math.min(k.shield, 0.01);
      }
      if (k === this.player) {
        this.ev.toast(type === 'zap' ? 'Blocked' : 'Shield hit');
        this.shake = Math.max(this.shake, 0.08);
      } else if (by === this.player) this.ev.toast(`${k.name} blocked it`);
      return;
    }
    if (type === 'zap') {
      this.fx.zap(pos);
      k.speed *= 0.8;
      k.zapN++;
      k.zapT = 2.5;
      if (k.zapN >= 4 && k.spin <= 0) {
        k.zapN = 0;
        k.spin = 0.9;
        k.drift = 0;
        this.knocked(k, by);
      } else if (by === this.player) this.addScore(10, 'Hit');
    } else {
      if (k.spin > 0) return;
      if (type === 'boom') {
        const heavy = k.m.type === 'monster';
        this.fx.boom(pos);
        k.vy = Math.max(k.vy, heavy ? 5 : 8);
        k.fly = true;
        k.spin = heavy ? 0.9 : 1.3;
        k.speed *= heavy ? 0.6 : 0.4;
        this.note('hit', k);
      } else {
        k.vy = Math.max(k.vy, 7);
        k.fly = true;
        k.spin = 0.9;
        k.speed *= 0.5;
      }
      if (k === this.player && this.upg?.has('armour')) k.spin *= 0.7; // the Armour upgrade: back on it sooner
      k.drift = 0;
      k.charge = 0;
      k.boost = 0;
      if (by && by !== k) {
        k.speed *= 0.45;
        k.ghost = 1.6;
        k.lane = ((k.lat - by.lat >= 0 ? 1 : -1) * W) / 2.6;
      } // dropped back and off the line of whoever hit them
      this.knocked(k, by);
      const pp = this.player.m.root.position;
      if (k === this.player || by === this.player || Math.hypot(pos.x - pp.x, pos.z - pp.z) < 40) Sound.hit();
    }
    if (k === this.player) this.shake = Math.max(this.shake, type === 'zap' ? 0.15 : 0.6);
  }
  knocked(k, by) {
    if (by === this.player && k !== this.player) {
      this.act(this.player, 'fist', 1);
      this.player.takedowns++;
      this.addScore(150, `Takedown · ${k.name}`);
      this.ev.takedown(k.name, this.player.takedowns);
    }
    if (k === this.player && by && by !== k) this.ev.toast(`Hit by ${by.name}`);
    if (k === this.player) this.ev.hurt?.();
  }

  rank() {
    const s = [...this.karts].sort((a, b) =>
      a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.finishTime - b.finishTime : b.prog - a.prog,
    );
    s.forEach((k, i) => {
      k.rank = i + 1;
    });
    return s;
  }

  /* ---------- the frame ---------- */
  update(dt, phase) {
    const tr = this.tr,
      racing = phase === 'race',
      P = this.player,
      inp = this.input;
    if (racing) this.time += dt;
    this.clock = (this.clock || 0) + dt;
    this.comboT -= dt;
    // the HEAT meter cools: slowly while you keep the chain going, quickly once it's broken
    if (P.fire <= 0 && P.heat > 0) {
      P.heat = Math.max(0, P.heat - dt * (this.comboT > 0 ? 0.03 : 0.16));
      if (Math.abs(P.heat - (this.heatShown ?? -1)) > 0.01 || P.heat === 0) {
        if (this.heatShown !== P.heat) this.ev.heat?.(P.heat);
        this.heatShown = P.heat;
      }
    }
    for (const k of this.karts)
      if (k.fire > 0) {
        k.fire -= dt;
        if (k.fire <= 0 && k === P) this.ev.fire?.(false);
      }
    if (this.comboT <= 0 && this.combo) {
      this.combo = 0;
      this.ev.score(this.score, 0);
    }

    for (const k of this.karts) {
      // ---- controls
      if (!racing) {
        k.throttle = 0;
        k.steer = 0;
        k.driftHeld = false;
      } else if (k.ai || k.finished) this.drive(k, dt);
      else {
        k.throttle = inp.brake ? -1 : 1;
        k.steer = inp.steer;
        k.driftHeld = inp.drift;
        if (inp.firePressed || (inp.fire && k.weapon === 'blaster')) this.fire(k);
        if (inp.nitroPressed && k.nitro >= 0.3 && k.spin <= 0) {
          k.nitro -= 0.33;
          k.boost = Math.max(k.boost, this.upg.has('nitro') ? 1.7 : 1.3); // (longer with the Big Nitro upgrade)
          k.boostLvl = 5;
          Sound.boost();
          this.shake = 0.15;
          this.ev.nitro(k.nitro);
          this.note('boost', k);
        }
        if (inp.driftPressed && k.air > 0.5 && !k.trickDone && k.spin <= 0) {
          k.trick = 0.45;
          k.trickDone = true;
          Sound.blip(600, 0.2, 'triangle', 0.1, 1.8);
        }
      }
      k.cool -= dt;
      k.flashT -= dt;
      k.zapT -= dt;
      if (k.zapT <= 0) k.zapN = 0;
      if (k.rolling > 0) {
        k.rolling -= dt;
        if (k.rolling <= 0) {
          if (k.pending === 'shield') this.raiseShield(k);
          else if (k.pending === 'fire') this.ignite(k);
          else {
            k.weapon = k.pending;
            k.ammo = WEAPONS[k.weapon].ammo;
            this.ev.weapon(k.weapon, k.ammo, false);
          }
        }
      }
      if (k.shield > 0) {
        k.shield -= dt;
        k.shieldFlash -= dt;
        if (k.shield <= 0 && k === this.player) this.ev.toast('Shield down');
      }

      const grounded = !k.fly;
      // ---- drift: hold through a turn, let go for a mini-turbo (blue, orange, purple)
      if (grounded && k.driftHeld && !k.drift && Math.abs(k.steer) > 0.25 && k.speed > 22 && k.spin <= 0) {
        k.drift = Math.sign(k.steer);
        k.charge = 0;
        k.hopV = 5;
      }
      if (k.drift && (!k.driftHeld || k.speed < 14 || k.spin > 0)) {
        const lvl = k.charge > 2.7 ? 3 : k.charge > 1.6 ? 2 : k.charge > 0.75 ? 1 : 0;
        if (lvl && k.spin <= 0) {
          k.boost = Math.max(k.boost, [0, 0.55, 0.95, 1.4][lvl]);
          k.boostLvl = lvl;
          if (k === P) {
            Sound.boost();
            this.addScore([0, 30, 60, 100][lvl], ['', 'Mini-turbo', 'Super turbo', 'Ultra turbo'][lvl]);
            if (lvl === 3) this.act(k, 'pop', 0.8);
          }
        }
        k.drift = 0;
        k.charge = 0;
      }
      let steer = k.steer;
      if (k.drift) {
        steer = k.drift * (0.55 + 0.5 * clamp(k.steer * k.drift, -1, 1));
        if (grounded) k.charge += dt * (0.8 + 0.7 * Math.abs(k.steer));
      }

      // ---- speed
      const i = tr.idx(k.s);
      const Fk = tr.forks || [],
        Bq = k.br ? Fk[k.brI] : null;
      k.offroad = k.br ? Math.abs(k.lat) > 20 / 2 + 1.5 : !tr.elevated[i] && Math.abs(k.lat) > W / 2 + 1.5;
      const st = VSTATS[k.m.type];
      let top = MAX * st.top * (k.ai ? k.skill * k.rubber : 1) * (1 + 0.008 * Math.min(k.coins, 10));
      if (k === P && this.upg.has('turbo')) top *= 1.05; // the Turbo Kit upgrade
      if (k.offroad && k.boost <= 0 && !(k.fire > 0)) top *= st.off;
      if (k.fire > 0) top = Math.max(top, MAX * st.top) * 1.15;
      if (k.boost > 0) {
        top = Math.max(top, MAX) * (k.boostLvl === 4 ? 1.38 : 1.3);
        k.boost -= dt;
      }
      if (k.finished) top = Math.min(top, 14 + Math.max(0, 1 - (this.time - k.finishTime) / 3) * 30); // over the line: easing off to a coast
      if (k.spin > 0) {
        k.spin -= dt;
        k.spinT = (k.spinT || 0) + dt;
        k.spinA = 0.75 * Math.sin(k.spinT * 8) * Math.exp(-k.spinT * 2.4) * (k.n % 2 ? 1 : -1);
        top *= 0.35;
      } else {
        k.spinA *= Math.max(0, 1 - dt * 8);
        k.spinT = 0;
      }
      const target = k.throttle > 0 ? top : k.throttle < 0 ? -14 : 0;
      if (grounded || k.boost > 0) {
        if (k.speed < target)
          k.speed = Math.min(target, k.speed + (k.boost > 0 ? 70 : ACC * st.acc * (1 - (0.4 * k.speed) / MAX)) * dt);
        else k.speed = Math.max(target, k.speed - (k.spin > 0 ? 60 : k.throttle < 0 ? 45 : 20) * dt);
      }
      const rh0 = k.rh;
      if (k.spin <= 0) {
        const grip = clamp(Math.abs(k.speed) / 16, 0, 1) * Math.sign(k.speed || 1) * (grounded ? 1 : 0.35);
        k.rh += steer * TURN * st.turn * (k.drift ? 1.2 : 1) * grip * (k === P && this.upg.has('grip') ? 1.08 : 1) * dt;
      }
      // how fast it's really turning: the front wheels, the steering wheel and the body's lean all follow this, not the raw input
      k.yawRate += ((k.rh - rh0) / Math.max(dt, 1e-3) - k.yawRate) * Math.min(1, dt * 10);
      const wantA = k.drift
        ? -k.drift * 0.3 + k.steer * 0.12 // countersteer in a drift
        : clamp(Math.atan2(k.yawRate * 2.7, Math.max(6, Math.abs(k.speed))), -0.5, 0.5);
      k.wheelA += (wantA - k.wheelA) * Math.min(1, dt * 12);

      // ---- move along the road
      const s0 = k.s;
      if (k.br) {
        // on the shortcut: drive along its own curve; k.s tracks the matching point of the circuit (for places)
        const bi = Bq.idx(k.bs),
          kb = Bq.K[bi],
          dsb = (k.speed * Math.cos(k.rh) * dt) / Math.max(0.35, 1 - kb * k.lat);
        k.bs += dsb;
        k.lat += k.speed * Math.sin(k.rh) * dt;
        k.rh = wrapA(k.rh - kb * dsb);
        k.s = Bq.sA + clamp(k.bs / Bq.len, 0, 1) * (Bq.sB - Bq.sA);
        if (k.bs >= Bq.len) {
          k.br = false;
          k.s = Bq.sB + 1;
          k.lat = Bq.off + k.lat;
        }
      } else {
        const kc = tr.K[i],
          denom = Math.max(0.35, 1 - kc * k.lat);
        const ds = (k.speed * Math.cos(k.rh) * dt) / denom;
        k.s += ds;
        k.lat += k.speed * Math.sin(k.rh) * dt;
        k.rh = wrapA(k.rh - kc * ds);
        // the turn-off: cross its line on its side of the road and you're on the shortcut
        // the fork: whichever side of the road you're on when you reach it is the way you go
        if (Fk.length && s0 < Fk[0].sA && k.s >= Fk[0].sA) {
          const j = k.lat > 0 || (k.lat === 0 && k.n % 2) ? 0 : 1,
            f = Fk[j];
          k.br = true;
          k.brI = j;
          k.bs = k.s - f.sA;
          k.lat -= f.off;
          this.note('tunnel', k);
        }
      }
      if (k.s >= tr.len) {
        k.s -= tr.len;
        k.lap++;
        if (k === P && racing && k.lap > 0 && (this.mode === 'free' || k.lap < LAPS)) this.ev.lap(k.lap + 1);
        if (k === P && racing) this.ev.cross?.(k.lap, this.time);
        if (k === P && k.lap === LAPS - 1 && this.mode !== 'free') this.arch.visible = true;
      } else if (k.s < 0) {
        k.s += tr.len;
        k.lap--;
      }
      // ---- up and down: on the road you ride it; where it drops away faster than gravity (a crest, a ramp) you fly
      const Fv = this.frameOf(k, this.F),
        roadY = Fv.p.y + Fv.l.y * k.lat;
      for (const kk of tr.kickers)
        if (!k.br && !k.fly && s0 < kk.s && k.s >= kk.s && k.speed > 10) {
          this.note('jump', k);
          k.fly = true;
          k.vy = Math.max(k.vy, 7 + k.speed * 0.13);
          k.airT = 0;
          k.trickDone = false;
          k.drift = 0;
          k.charge = 0;
          if (k === P) Sound.blip(220, 0.3, 'triangle', 0.1, 2);
        }
      if (!k.fly) {
        const vyRoad = (roadY - k.Y) / Math.max(dt, 1e-3);
        // (never inside a loop-the-loop: over its top the road always falls away, and you ride it round)
        if (!tr.inLoop[tr.idx(k.s)] && vyRoad < k.vy - GRAV * dt - 3 && k.speed > 18) {
          this.note('jump', k);
          k.fly = true;
          k.airT = 0;
          k.trickDone = false;
          k.drift = 0;
          k.charge = 0;
        } else {
          k.vy = vyRoad;
          k.Y = roadY;
        }
      }
      if (k.fly) {
        k.vy -= GRAV * dt;
        k.Y += k.vy * dt;
        k.airT += dt;
        if (k.Y <= roadY) {
          const hard = k.vy < -12;
          k.squash = clamp(-k.vy / 22, 0.15, 0.75);
          k.sqT = 0;
          if (k === this.player && k.airT > 0.25) Sound.land(clamp(-k.vy / 25, 0, 1));
          k.Y = roadY;
          k.vy = 0;
          k.fly = false;
          if (tr.inGap[tr.idx(k.s)]) {
            // short of the far bank: splash, then back on the road
            const g = tr.kickers.find(g => this.dS(k.s, g.gap[0]) >= -1 && this.dS(k.s, g.gap[1]) <= 1);
            if (g) {
              k.s = tr.wrapS(g.gap[1] + 3);
              k.Y = tr.point(k.s, k.lat).y;
            }
            k.speed = 18;
            k.spin = 0.8;
            this.fx.spark(tr.point(k.s, k.lat, 1), '#9fd8ff', 8, 0.4);
            if (k === P) this.ev.toast('Splash!');
          } else if (k === P) {
            if (k.trickDone && k.spin <= 0) {
              k.boost = Math.max(k.boost, 0.9);
              k.boostLvl = 6;
              Sound.boost();
              this.addScore(80, 'Trick landing');
              this.ev.flash('Trick!');
              this.act(k, 'pop', 0.8);
            } else if (k.airT > 0.9) this.addScore(40, 'Big air');
            if (hard) this.shake = Math.max(this.shake, 0.18);
          }
          k.trickDone = false;
          k.tumble = 0;
          if (k.airT > 0.25)
            for (let n = 0; n < 4 + k.squash * 14; n++) this.puff(k, k.offroad ? '#e2c79c' : '#e8dcc6');
        }
      }
      k.air = Math.max(0, k.Y - roadY);
      // the road's edge: dirt shoulders on the ground, barriers on the decks
      const wi = tr.idx(k.s),
        lim = k.br
          ? (() => {
              const f = Fk[k.brI],
                j = f.idx(k.bs),
                walled = f.inT[j] || f.deck[j];
              return walled ? 20 / 2 + 0.2 - (k.m.V.track + k.m.V.ww / 2) - 0.05 : f.limit[j];
            })()
          : tr.wall[wi]
            ? tr.wall[wi] - (k.m.V.track + k.m.V.ww / 2) - 0.05
            : tr.limit[wi]; // a wall stops your tyres, not your middle
      if (Math.abs(k.lat) > lim) {
        const s = Math.sign(k.lat),
          into = Math.abs(Math.sin(k.rh));
        k.lat = s * lim;
        if (into > 0.12) k.speed *= 1 - clamp(into * 0.5, 0, 0.4) * Math.min(1, dt * 30); // glancing touches just slide along
        k.rh = lerp(k.rh, 0, Math.min(1, dt * 6));
        if (k === P && into > 0.25) {
          this.shake = Math.max(this.shake, 0.2);
          if (Math.random() < 0.3) this.fx.spark(tr.point(k.s, k.lat, 1), '#ffd28a', 1.2, 0.25);
        }
      }
      // the water bridge (the deck, not the tube under the sea): every few metres a plank thumps and the tyres throw
      // spray up off the sea either side
      if (tr.lowb[wi] && tr.P[wi].y > -1.2 && !k.fly && k.speed > 8) {
        k.plankD = (k.plankD || 0) - k.speed * dt;
        if (k.plankD <= 0) {
          k.plankD = 6.5;
          const v = clamp(k.speed / 45, 0, 1);
          if (k === P || Math.abs(this.dS(k.s, P.s)) < 60)
            for (const sd of [-1, 1])
              this.fx.spark(
                tr.point(k.s - 1.5, sd * (W / 2 + 1.4 + Math.random() * 1.5), -0.2),
                Math.random() < 0.5 ? '#f2fbff' : '#bfe9f7',
                1.6 + v * 2.2,
                0.5,
                _spray.set((Math.random() - 0.5) * 2, 5 + v * 5, (Math.random() - 0.5) * 2),
              );
          if (k === P) Sound.plank(v);
        }
      }
      // the central wall between the two bores of the underpass
      {
        const inT = !!tr.trench[tr.idx(k.s)];
        if (inT && !k.inTrench) this.note('tunnel', k);
        k.inTrench = inT;
      }
      const dwi = tr.divW[tr.idx(k.s)],
        half = k.m.V.track + k.m.V.ww / 2;
      if (!k.br && dwi > 0 && Math.abs(k.lat) < dwi + half) {
        // the barrier is solid: you're pushed off its nose to one side, losing speed by how square you hit it
        const sd = Math.sign(k.lat) || (k.lane >= 0 ? 1 : -1),
          push = dwi + half - Math.abs(k.lat);
        k.lat = sd * (dwi + half);
        const hit = clamp(push * 2.5 + Math.abs(Math.sin(k.rh)) * 0.6, 0, 0.7);
        k.speed *= 1 - hit * Math.min(1, dt * 20);
        k.rh = lerp(k.rh, sd * 0.05, Math.min(1, dt * 6));
        if (k === P && push > 0.15) {
          this.shake = Math.max(this.shake, 0.25);
          if (Math.random() < 0.5) this.fx.spark(tr.point(k.s, sd * dwi, 1), '#ffd28a', 1.4, 0.25);
        }
      }
      k.prog = k.lap * tr.len + k.s;
      if (racing && !k.finished && k.lap >= LAPS && this.mode !== 'free') {
        k.finished = true;
        k.finishTime = this.time;
        this.confetti.burst(tr.point(0, 0, 12), k === P ? 420 : 90, k === P ? 18 : 12);
        if (k === P) {
          k.ai = true;
          this.ev.finish();
        }
      }
      k.hopV -= 30 * dt;
      k.hop = Math.max(0, k.hop + k.hopV * dt);
      if (k.hop === 0) k.hopV = 0;
      k.padT -= dt;
      k.ghost -= dt;
      k.slamT = (k.slamT || 0) - dt;
      if (k.moveT > 0) k.moveT -= dt;
      else k.move = null;
      if (k.finished && k !== P && k.move !== 'cheer') this.act(k, 'cheer', 1e9);
      if (k.trick > 0) {
        k.trick -= dt;
        k.trickA = (1 - Math.max(0, k.trick) / 0.45) * Math.PI * 2;
      } else k.trickA = 0;
      if (k.tumble > 0) k.tumbleA += dt * 7;
      else k.tumbleA = 0;
    }
    inp.firePressed = false;
    inp.driftPressed = false;
    inp.nitroPressed = false;

    // ---- vehicles are solid boxes: side by side they shove apart, nose to tail they trade speed (by mass)
    const ks = this.karts;
    for (let a = 0; a < ks.length; a++)
      for (let b = a + 1; b < ks.length; b++) {
        const A = ks[a],
          B = ks[b];
        if ((A.br ? A.brI : -1) !== (B.br ? B.brI : -1)) continue; // on different roads
        if (A.ghost > 0 || B.ghost > 0) continue; // just taken down: no blocking
        if (A.finished || B.finished) continue; // the race is over for them: nobody rams a finisher
        if (Math.abs(A.air - B.air) > 2.5) continue;
        const ds = this.dS(B.s, A.s),
          dl = B.lat - A.lat;
        const hl = (A.m.type === 'monster' ? 2.5 : 2.2) + (B.m.type === 'monster' ? 2.5 : 2.2),
          hw = A.m.V.track + A.m.V.ww / 2 + B.m.V.track + B.m.V.ww / 2;
        const ox = hl - Math.abs(ds),
          oy = hw - Math.abs(dl);
        if (ox <= 0 || oy <= 0) continue;
        const ma = VSTATS[A.m.type].mass,
          mb = VSTATS[B.m.type].mass,
          wa = mb / (ma + mb),
          wb = ma / (ma + mb);
        const me = A === P ? A : B === P ? B : null,
          them = me === A ? B : A;
        if (me && !them.finished && (me.slamT || 0) <= 0) {
          const sideOf = Math.sign(them.lat - me.lat) || 1,
            alongside = Math.abs(this.dS(them.s, me.s)) < 3.2;
          // a slam: steering into someone alongside, or running up behind someone slower
          const sideSlam = alongside && me.steer * sideOf > 0.3,
            punt = !alongside && this.dS(them.s, me.s) > 0 && me.speed - them.speed > 3;
          if (sideSlam || punt) {
            const away = punt ? (them.lat >= me.lat ? 1 : -1) : sideOf,
              heavy = VSTATS[me.m.type].mass / VSTATS[them.m.type].mass;
            them.lat += away * (punt ? 3.2 : 2.6) * clamp(heavy, 0.6, 1.6);
            them.rh += away * 0.28;
            them.speed *= punt ? 0.78 : 0.82;
            them.ghost = 0.7;
            if (them.spin <= 0) {
              them.spin = 0.45;
              them.spinT = 0;
            }
            me.speed *= 0.97;
            me.slamT = 0.5;
            this.shake = Math.max(this.shake, 0.3);
            Sound.blip(110, 0.18, 'square', 0.14, 0.5);
            this.fx.spark(tr.point(me.s, (me.lat + them.lat) / 2, 1.2), '#ffd28a', 2.2, 0.25);
            this.addScore(punt ? 40 : 60, punt ? 'Punt' : 'Slam');
            continue;
          }
        }
        if (oy < ox) {
          // side by side: shoved apart, turned a little away
          const sg = Math.sign(dl) || 1;
          A.lat -= sg * oy * wa;
          B.lat += sg * oy * wb;
          A.rh -= sg * 0.05 * wa;
          B.rh += sg * 0.05 * wb;
          A.speed *= 0.995;
          B.speed *= 0.995;
        } else {
          // nose to tail: pushed apart along the road, and the speeds meet
          const sg = Math.sign(ds) || 1,
            back = sg > 0 ? A : B,
            front = sg > 0 ? B : A;
          A.s = tr.wrapS(A.s - sg * ox * wa);
          B.s = tr.wrapS(B.s + sg * ox * wb);
          if (back.speed > front.speed) {
            const mbk = VSTATS[back.m.type].mass,
              mfr = VSTATS[front.m.type].mass,
              v = (back.speed * mbk + front.speed * mfr) / (mbk + mfr);
            back.speed = v - ((back.speed - front.speed) * 0.15 * mfr) / (mbk + mfr);
            front.speed = v + (back.speed - front.speed) * 0.1;
            if ((back === P || front === P) && Math.abs(back.speed - front.speed) > 4) {
              this.shake = Math.max(this.shake, 0.2);
              Sound.blip(120, 0.12, 'square', 0.08, 0.6);
            }
          }
        }
      }

    // ---- pickups
    for (const b of this.mode === 'gp' ? this.boxes : []) {
      if (b.t > 0) {
        b.t -= dt;
        b.m.visible = b.m.userData.glow.visible = b.t <= 0;
        continue;
      }
      for (const k of ks)
        if (!k.br && Math.abs(this.dS(k.s, b.s)) < 2.6 && Math.abs(k.lat - b.lat) < 2.6 && k.air < 3) {
          b.t = 2.5;
          b.m.visible = b.m.userData.glow.visible = false;
          this.fx.spark(b.m.position, '#6fd3ff', 4, 0.25);
          this.giveWeapon(k);
          if (k === P) this.addScore(20, 'Crate');
          break;
        }
    }
    for (const c of this.coins) {
      if (c.t > 0) {
        c.t -= dt;
        continue;
      }
      for (const k of ks)
        if (!k.br && Math.abs(this.dS(k.s, c.s)) < 2.4 && Math.abs(k.lat - c.lat) < 2.4 && k.air < 3) {
          c.t = 9;
          k.coins++;
          if (k === P) {
            Sound.coin();
            this.ev.coins(k.coins, c.p.clone().setY(c.p.y + 0.6));
            this.addScore(10, 'Coin');
          }
          break;
        }
    }
    for (const n of this.nitros) {
      if (n.t > 0) {
        n.t -= dt;
        n.m.visible = n.t <= 0;
        if (n.ring) n.ring.visible = n.m.visible;
        continue;
      }
      if (Math.abs(this.dS(P.s, n.s)) < 2.6 && Math.abs(P.lat - n.lat) < 2.6 && !P.br && P.air < 3) {
        n.t = 8;
        n.m.visible = false;
        if (n.ring) n.ring.visible = false;
        P.nitro = Math.min(1, P.nitro + 0.34);
        Sound.blip(900, 0.2, 'sine', 0.12, 1.8);
        this.ev.nitro(P.nitro);
      }
    }
    for (const pd of this.pads)
      for (const k of ks) {
        if (!k.br && k.padT <= 0 && Math.abs(this.dS(k.s, pd.s)) < 3.6 && Math.abs(k.lat - pd.lat) < 2.6 && k.air < 1) {
          k.boost = Math.max(k.boost, 1);
          k.boostLvl = 5;
          k.padT = 0.6;
          if (k === P) {
            Sound.boost();
            this.addScore(15, 'Boost pad');
          }
        }
      }

    // ---- projectiles and mines
    for (const p of this.projs) {
      p.life -= dt;
      const step = p.v * dt;
      p.s = tr.wrapS(p.s + step);
      if (p.target && !p.target.finished) {
        const ahead = this.dS(p.target.s, p.s);
        if (ahead > -2 && ahead < 200)
          p.lat = lerp(p.lat, p.target.lat, Math.min(1, dt * (p.type === 'rocket' ? 5 : 2.5)));
      }
      p.lat = clamp(p.lat, -W / 2 - 2, W / 2 + 2);
      const F = tr.frame(p.s, this.F);
      p.m.position.copy(F.p).addScaledVector(F.l, p.lat).addScaledVector(F.u, p.h);
      this.mx.makeBasis(F.l, F.u, F.t);
      p.m.quaternion.setFromRotationMatrix(this.mx);
      if (p.type === 'rocket') this.fx.spark(p.m.position, '#ff9a1f', 1.4, 0.2);
      for (const k of ks) {
        if (k === p.owner || k.br || (k.finished && k !== P)) continue;
        const d = this.dS(k.s, p.s);
        if (d > -step - 2 && d < 2.2 && Math.abs(k.lat - p.lat) < 2.6 && k.air < 3) {
          this.hit(k, p.type === 'bolt' ? 'zap' : 'boom', p.owner);
          p.life = 0;
          break;
        }
      }
      if (p.life <= 0 && p.type === 'rocket') this.fx.boom(p.m.position, false);
    }
    this.projs = this.projs.filter(p => {
      if (p.life > 0) return true;
      this.scene.remove(p.m);
      return false;
    });
    for (const mn of this.mines) {
      mn.arm -= dt;
      mn.life -= dt;
      mn.light.visible = Math.sin(this.clock * 12) > 0;
      if (mn.arm <= 0)
        for (const k of ks)
          if (!k.br && Math.abs(this.dS(k.s, mn.s)) < 2.2 && Math.abs(k.lat - mn.lat) < 2.4 && k.air < 1.5) {
            this.hit(k, 'boom', null);
            mn.life = 0;
            break;
          }
    }
    this.mines = this.mines.filter(m => {
      if (m.life > 0) return true;
      this.scene.remove(m.m);
      return false;
    });

    // ---- positions; whoever just passed someone turns round and laughs at them
    const order = this.rank();
    if (racing && this.time > 2)
      for (const k of ks) {
        if (k.prevRank && k.rank < k.prevRank && !k.finished) {
          const passed = order[k.rank];
          if (passed && Math.abs(this.dS(k.s, passed.s)) < 30 && k.spin <= 0) {
            if (k === P) this.act(k, Math.random() < 0.5 ? 'pop' : 'taunt', Math.random() < 0.5 ? 0.8 : 1.6);
            else if (Math.random() < 0.8) {
              this.act(k, 'taunt', 1.6);
              if (passed === P) {
                this.ev.toast(`${k.name}: ha ha!`);
                Sound.laugh();
              }
            }
          }
        }
        k.prevRank = k.rank;
      }
    if (racing && !P.finished && P.rank < this.playerRank && this.time > 3)
      this.addScore(50 * (this.playerRank - P.rank), 'Overtake');
    this.playerRank = P.rank;
    if (racing && !P.finished && Math.cos(P.rh) < -0.3 && P.speed > 4) this.wrongT += dt;
    else this.wrongT = 0;

    this.shake = Math.max(0, this.shake - dt);
    this.place(dt);
    this.animate(dt);
    this.fx.update(dt);
    this.confetti.update(dt);
    if (this.head && this.night) {
      const r = P.m.root;
      this.head.position.copy(r.localToWorld(this.v4.set(0, 1.4, 2.2)));
      this.head.target.position.copy(r.localToWorld(this.v4.set(0, 0, 22)));
    }
  }

  // headlights: a beam of light on the road ahead of each kart (a real spotlight on yours)
  setNight(n) {
    this.night = n;
    for (const k of this.karts) {
      if (!k.beam) {
        // worked out per pixel like a real lamp on tarmac: the canvas top lands at the kart's nose, the bottom 18 m up the
        // road. Each of the two lamps throws a cone with soft edges and a brighter core; the light pools a few metres
        // ahead and fades with distance, and the two cones blend into one patch further out
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 256;
        const x = c.getContext('2d'),
          img = x.createImageData(128, 256),
          D = img.data;
        const ss = (e0, e1, v) => {
          const q = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
          return q * q * (3 - 2 * q);
        };
        const HALF = 0.38; // the cone's half-angle, in radians (about 22 degrees)
        for (let py = 0; py < 256; py++)
          for (let px = 0; px < 128; px++) {
            const u = (px / 127 - 0.5) * 9,
              d = (py / 255) * 18;
            let I = 0;
            for (const lx of [-0.6, 0.6]) {
              const a = Math.atan2(Math.abs(u - lx), d + 0.9); // from a lamp just behind the plane's edge
              I += ss(HALF, HALF * 0.45, a) * (0.75 + 0.5 * ss(HALF * 0.5, 0, a)); // soft edge, brighter core
            }
            I *= ((0.35 + 0.65 * ss(0, 3, d)) / (1 + (d / 7.5) ** 2)) * ss(4.5, 3, Math.abs(u)) * ss(18, 14, d); // dim at the bumper, a pool ahead, falloff; no hard edge at the patch's sides or end
            const o = (py * 128 + px) * 4;
            D[o] = 255;
            D[o + 1] = 238;
            D[o + 2] = 205;
            D[o + 3] = Math.min(255, I * 120);
          }
        x.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        k.beam = new THREE.Mesh(
          new THREE.PlaneGeometry(9, 18).rotateX(-Math.PI / 2).translate(0, 0.12, 11),
          new THREE.MeshBasicMaterial({
            map: t,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        k.m.root.add(k.beam);
      }
      k.beam.visible = n > 0.5;
      if (k.beam.parent !== k.m.root) k.m.root.add(k.beam);
    }
    if (!this.head) {
      this.head = new THREE.SpotLight('#fff1d6', 0, 70, 0.5, 0.55, 1.2);
      this.head.target = new THREE.Object3D();
      this.scene.add(this.head, this.head.target);
    }
    this.head.intensity = n * 260;
  }

  frameOf(k, F) {
    return k.br ? this.tr.forks[k.brI].frame(k.bs, F) : this.tr.frame(k.s, F);
  }

  drive(k, dt) {
    const Fk = this.tr.forks || [],
      Bq = k.br ? Fk[k.brI] : null;
    if (k.br) {
      // on the shortcut: follow its middle
      const lane = ((k.n % 3) - 1) * 4.5,
        look = 12 + Math.max(0, k.speed) * 0.4,
        want = Math.atan2(lane - k.lat, look),
        grip = clamp(Math.abs(k.speed) / 16, 0.2, 1);
      const aim = clamp((want - k.rh) * 2.6 + (Bq.K[Bq.idx(k.bs + look * 0.5)] * k.speed) / (TURN * grip), -1, 1);
      k.steer += (aim - k.steer) * Math.min(1, dt * 7);
      k.throttle = 1;
      k.driftHeld = false;
      return;
    }
    const tr = this.tr,
      look = 14 + Math.max(0, k.speed) * 0.45,
      i = tr.idx(k.s);
    k.laneT += dt * 0.35;
    const edge = Math.min(W / 2, tr.limit[tr.idx(k.s + look)]) - 2.5;
    let lane = k.lane + Math.sin(k.laneT) * 3;
    for (const m of this.mines) {
      const d = this.dS(m.s, k.s);
      if (d > 0 && d < 45 && Math.abs(m.lat - lane) < 3.2) lane += lane > m.lat ? 5 : -5;
    }
    // someone right ahead in my lane: pull out and go round them, the side with more room
    for (const o of this.karts) {
      if (o === k) continue;
      const d = this.dS(o.s, k.s);
      if (d > 0 && d < 16 && Math.abs(o.lat - lane) < 3.4) {
        lane = o.lat + (o.lat > 0 ? -4.6 : 4.6);
        k.lane = clamp(lane, -edge, edge);
        break;
      }
    }
    if (Fk.length) {
      const d = Fk[0].sA - k.s;
      if (d > 0 && d < 90) lane = ((k.n % 2 ? 1 : -1) * W) / 4;
    } // pick a way at the fork
    lane = clamp(lane, -edge, edge);
    if ((tr.divider[tr.idx(k.s + look)] || tr.divider[tr.idx(k.s + look * 2)]) && Math.abs(lane) < 5.5)
      lane = (k.lane >= 0 ? 1 : -1) * 7; // pick a bore well before the barrier
    const want = Math.atan2(lane - k.lat, look),
      grip = clamp(Math.abs(k.speed) / 16, 0.2, 1);
    const aim = clamp((want - k.rh) * 2.6 + (tr.K[i] * k.speed) / (TURN * grip), -1, 1);
    k.steer += (aim - k.steer) * Math.min(1, dt * 7); // hands, not a switch
    k.throttle = 1;
    k.driftHeld = false;
    // weapons, after a short think
    if (k.weapon) {
      k.wT -= dt;
      if (k.wT <= 0) {
        const w = k.weapon,
          ahead = this.targetAhead(k, 90, 6),
          behind = this.karts.some(o => o !== k && this.dS(k.s, o.s) > 2 && this.dS(k.s, o.s) < 40);
        const near = this.karts.some(o => o !== k && Math.abs(this.dS(o.s, k.s)) < 18 && Math.abs(o.lat - k.lat) < 16);
        if (
          (w === 'blaster' && ahead) ||
          (w === 'rocket' && this.targetAhead(k)) ||
          (w === 'shock' && near) ||
          (w === 'mines' && behind) ||
          w === 'yaji'
        ) {
          this.fire(k);
          if (w !== 'blaster') k.wT = 0.8 + Math.random() * 2;
        } else k.wT = 0.3;
      }
    }
    // keep the pack close to Buddy so the race stays a race
    const gap = (k.prog - this.player.prog) / tr.seg;
    k.rubber = this.player.finished ? 1 : clamp(1 - gap * 0.00035, 0.9, 1.12);
  }

  puff(k, color) {
    const d = this.dust[this.dustI++ % this.dust.length];
    d.s.position.copy(k.m.root.position);
    d.s.position.x += (Math.random() - 0.5) * 2.6;
    d.s.position.z += (Math.random() - 0.5) * 2.6;
    d.s.position.y += 0.4;
    d.v.set((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
    d.life = 1;
    d.s.material.color.set(color);
    d.s.visible = true;
  }

  // where each kart is drawn, from its road-space state
  place(dt, snap = false) {
    const e = dt ? 1 - Math.exp(-dt * 8) : 1,
      v1 = this.v1,
      v2 = this.v2;
    for (const k of this.karts) {
      const m = k.m,
        F = this.frameOf(k, this.F);
      k.steerS = lerp(k.steerS, k.drift ? k.drift * 0.6 + k.steer * 0.4 : k.steer, e);
      k.visYaw = lerp(k.visYaw, k.drift * 0.42, e);
      v1.copy(F.t).multiplyScalar(Math.cos(k.rh)).addScaledVector(F.l, Math.sin(k.rh)); // forward
      v2.crossVectors(F.u, v1).normalize(); // left
      m.root.position
        .copy(F.p)
        .addScaledVector(F.l, k.lat)
        .addScaledVector(F.u, k.air + k.hop);
      if (k.fly) {
        // in the air the kart follows its own arc (nose up leaving, nose down falling), not the road under it
        const fl = this.v4.copy(v1);
        fl.y = 0;
        if (fl.lengthSq() < 1e-4) fl.copy(v1);
        fl.normalize();
        const pitch = Math.atan2(k.vy, Math.max(10, Math.abs(k.speed))) * 0.9;
        v1.copy(fl).multiplyScalar(Math.cos(pitch)).addScaledVector(Y, Math.sin(pitch)).normalize();
        this.up.copy(Y).addScaledVector(v1, -v1.y).normalize();
        v2.crossVectors(this.up, v1).normalize();
        this.mx.makeBasis(v2, this.up, v1);
      } else this.mx.makeBasis(v2, F.u, v1);
      this.tq.setFromRotationMatrix(this.mx);
      this.yq.setFromAxisAngle(Y, k.visYaw + k.spinA);
      this.tq.multiply(this.yq);
      if (snap || !dt) m.root.quaternion.copy(this.tq);
      else m.root.quaternion.slerp(this.tq, Math.min(1, dt * (k.fly ? 6 : 22)));
      // tyre marks while drifting or on the sand
      if (dt && !k.fly && (k.drift || k.offroad) && Math.abs(k.speed) > 8) {
        k.markD += Math.abs(k.speed) * dt;
        if (k.markD > 0.9) {
          k.markD = 0;
          this.mc.set(k.offroad ? '#b89a6c' : '#15161b');
          for (const sx of [-1, 1]) {
            this.v4
              .copy(m.root.position)
              .addScaledVector(v2, sx * m.V.track)
              .addScaledVector(v1, -m.V.base)
              .addScaledVector(F.u, 0.09 - k.air);
            this.ms.set(m.V.ww * 1.6, 1, 1);
            this.mq.compose(this.v4, m.root.quaternion, this.ms);
            const j = this.markI++ % 700;
            this.marks.setMatrixAt(j, this.mq);
            this.marks.setColorAt(j, this.mc);
          }
          this.marks.instanceMatrix.needsUpdate = true;
          this.marks.instanceColor.needsUpdate = true;
        }
      }
      const sp = clamp(Math.abs(k.speed) / MAX, 0, 1);
      m.body.rotation.z = lerp(m.body.rotation.z, clamp(k.yawRate * Math.abs(k.speed) * 0.0035, -0.11, 0.11), e); // leans out of the corner
      // flips and tricks turn the whole vehicle; the body alone leans, pitches and bounces on its suspension
      m.rig.rotation.x = k.tumble > 0 ? k.tumbleA : 0;
      m.rig.rotation.y = k.trickA;
      m.body.rotation.x = lerp(
        m.body.rotation.x,
        k.fly
          ? 0
          : k.boost > 0
            ? -0.04
            : clamp((-(k.speed - (k.prevSpeed ?? k.speed)) / Math.max(dt || 0.016, 1e-3)) * 0.0012, -0.05, 0.05),
        e,
      );
      k.prevSpeed = k.speed;
      k.sqT += dt || 0;
      const land = -k.squash * 0.5 * Math.exp(-k.sqT * 6) * Math.cos(k.sqT * 18);
      m.body.position.y =
        (k.fly
          ? 0
          : Math.sin((this.clock || 0) * 30 + k.n) * 0.02 * sp +
            (k.offroad
              ? (Math.sin((this.clock || 0) * 47 + k.n) * 0.06 + Math.sin((this.clock || 0) * 13) * 0.04) * sp
              : 0)) + land;
      m.body.rotation.x += k.offroad && !k.fly ? Math.sin((this.clock || 0) * 23 + k.n) * 0.02 * sp : 0;
      for (const w of m.wheels) w.spin.rotation.x += (k.speed * (dt || 0)) / w.r;
      for (const s of m.steer) s.rotation.y = k.wheelA;
      this.poseDriver(k, dt);
    }
  }

  // Buddy's moves: pop up out of the seat and back, turn round laughing, cheer at the finish
  act(k, move, dur) {
    if (k.move === 'cheer' && !(k === this.player && k.finished)) return;
    if (move === 'pop' && !k.finished && Math.random() < 0.45) {
      move = 'flip';
      dur = 1.15;
    } // sometimes a backflip instead
    k.move = move;
    k.moveT = k.moveD = dur;
    if (move === 'taunt' || move === 'flip' || move === 'pop') this.note('taunt', k);
    if (move === 'pop' && k === this.player) Sound.blip(500, 0.25, 'triangle', 0.1, 2.2);
  }
  poseDriver(k, dt) {
    const u = k.moveD ? clamp(1 - k.moveT / k.moveD, 0, 1) : 0;
    k.m.wheelRing.rotation.z = -k.wheelA * 2.6;
    // glance at whoever is right alongside
    let look = 0;
    for (const o of this.karts)
      if (o !== k) {
        const d = this.dS(o.s, k.s);
        if (Math.abs(d) < 7) look += clamp((o.lat - k.lat) / 6, -1, 1) * 0.5;
      }
    k.m.robot.update(dt || 0.016, {
      t: (this.clock || 0) + k.n * 1.7,
      steer: clamp(k.wheelA * 2, -1, 1),
      boost: k.boost > 0,
      air: k.fly && !(k === this.player && this.fpView) ? k.air + 0.3 : 0,
      hit: k.spin > 0 && !k.move && !(k === this.player && this.fpView),
      move: k === this.player && this.fpView ? null : k.move, // (in the cockpit view his paws stay on the wheel)
      u,
      side: k.moveSide,
      wheel: k.m.wheelRing,
      wheelR: k.m.wheelR,
      speed: clamp(Math.abs(k.speed) / MAX, 0, 1),
      look: clamp(look, -0.8, 0.8),
    });
  }
  // the modes: Race is against the whole crew; Time Trial and Free Drive are you alone on the road
  setMode(mode) {
    this.mode = mode;
    const solo = mode !== 'gp';
    this.karts = solo ? [this.player] : this.all;
    for (const k of this.all) if (k !== this.player) k.m.root.visible = !solo;
    if (this.ghost) this.ghost.root.visible = false;
  }
  // the ghost: your best lap, driven again in see-through blue by a copy of your own car
  makeGhost(type, custom) {
    if (this.ghost) this.scene.remove(this.ghost.root);
    const g = makeKart(this.player.def, this.tex, 1, type, custom),
      mat = new THREE.MeshBasicMaterial({
        color: '#8fd6ff',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    g.root.traverse(o => {
      if (o.isMesh || o.isPoints || o.isSprite) {
        o.material = mat;
        o.castShadow = o.receiveShadow = false;
      }
    });
    for (const f of g.flames || []) f.visible = false;
    for (const s of g.sparks || []) s.visible = false;
    g.root.visible = false;
    this.scene.add(g.root);
    this.ghost = g;
    return g;
  }
  setVehicle(type, custom) {
    const k = this.player;
    this.scene.remove(k.m.root);
    k.m = makeKart(k.def, this.tex, this.quality.layers, type, custom);
    this.scene.add(k.m.root);
    if (k.beam) k.m.root.add(k.beam);
    this.place(0, true);
  }

  animate(dt) {
    const t = this.clock || 0,
      P = this.player;
    for (const k of this.karts) {
      const m = k.m;
      const hot = k.fire > 0,
        big = k.boost > 0 || hot,
        rev = clamp(Math.max(0, k.speed) / MAX, 0, 1);
      // on fire: the tyres throw red-hot sparks, a flame trail along the road behind you
      if (hot)
        for (const w of m.wheels)
          if (Math.random() < 0.65) {
            w.spin.getWorldPosition(this.v3);
            this.fx.spark(this.v3, Math.random() < 0.5 ? '#ff3a12' : '#ffb21f', 1.7, 0.32);
          }
      m.flames.forEach((fl, j) => {
        fl.material.color.set(
          hot ? '#ff3a12' : big ? (k.boostLvl === 5 ? m.nitroCol : FLAME_COL[k.boostLvl] || FLAME_COL[0]) : '#ff8a2a',
        );
        const len = big ? 1.1 + Math.random() * 0.7 : 0.12 + Math.random() * 0.12 + rev * 0.1,
          w = big ? 1.2 : 0.55;
        fl.visible = big;
        fl.scale.set(w, len, w);
        fl.material.opacity = 0.95;
        if (big && Math.random() < 0.8) {
          m.pipes[j].getWorldPosition(this.v3);
          this.fx.spark(this.v3, k.boostLvl === 5 ? m.nitroCol : FLAME_COL[k.boostLvl] || '#ff9a1f', 1.8, 0.25);
        }
      });
      const lvl = k.charge > 2.7 ? 3 : k.charge > 1.6 ? 2 : k.charge > 0.75 ? 1 : 0;
      for (const s of m.sparks) {
        s.visible = !!k.drift && lvl > 0;
        if (s.visible) {
          s.material.color.set(DRIFT_COL[lvl]);
          const sc = 0.6 + Math.random() * 0.6 + lvl * 0.15;
          s.scale.set(sc, sc, 1);
        }
      }
      // the shield bubble: up while k.shield runs, blinking in its last two seconds, flaring when it takes a hit
      if (k.shield > 0 || m.shieldBubble?.visible) {
        const b = m.shieldBubble || (m.shieldBubble = shieldBubble(m));
        b.visible = k.shield > 0;
        const u = b.material.uniforms;
        u.uT.value = t;
        u.uFlash.value = Math.max(0, k.shieldFlash || 0) / 0.4;
        u.uAlpha.value = k.shield < 2 ? (Math.sin(t * 22) > 0 ? 1 : 0.25) : 1;
      }
      m.gun.visible = !!k.weapon || k.rolling > 0;
      if (m.gun.visible) m.gunMat.color.set(WEAPONS[k.weapon || k.pending]?.color || '#6fd3ff');
      m.muzzle.visible = k.flashT > 0;
      k.blinkT -= dt;
      let face = Math.abs(k.speed) > 45 && Math.sin(t * 0.8 + k.n) > -0.2 ? 'happy' : 'calm';
      if (k.move === 'sad') face = 'sad';
      else if (k.spin > 0) face = 'hit';
      else if (k.move === 'taunt' || (k.move === 'cheer' && Math.sin(t * 3) > 0)) face = 'laugh';
      else if (k.move) face = 'happy';
      else if (k.boost > 0 || k.air > 1) face = 'boost';
      else if (k.drift || (k.finished && k.rank <= 3)) face = 'happy';
      else if (k.blinkT < 0.12) {
        face = 'blink';
        if (k.blinkT < 0) k.blinkT = 2 + Math.random() * 3;
      }
      setFace(m, face);
      if (k.air <= 0 && (k.offroad || k.drift) && Math.abs(k.speed) > 12 && Math.random() < (k === P ? 0.9 : 0.4))
        this.puff(k, k.offroad ? '#e2c79c' : '#eceef4');
    }
    for (const d of this.dust) {
      if (d.life <= 0) continue;
      d.life -= dt * 1.4;
      d.s.position.addScaledVector(d.v, dt);
      const s = 1 + (1 - d.life) * 3;
      d.s.scale.set(s, s, 1);
      d.s.material.opacity = Math.max(0, d.life) * 0.7;
      if (d.life <= 0) d.s.visible = false;
    }
    for (const n of this.nitros) {
      n.m.rotation.y += dt * 1.6;
      n.m.rotation.z = Math.sin(t * 1.7 + n.s) * 0.12;
      n.m.position.copy(n.base);
      n.m.position.y += Math.sin(t * 2.4 + n.s) * 0.2;
      if (n.ring) n.ring.scale.setScalar(1 + Math.sin(t * 3 + n.s) * 0.08);
    }
    for (const b of this.boxes) {
      b.m.rotation.y += dt * 1.2;
      b.m.rotation.x = Math.sin(t * 1.3 + b.ph) * 0.12;
      b.m.position.copy(b.base);
      b.m.position.y += Math.sin(t * 2 + b.ph) * 0.25;
    }
    const o = new THREE.Object3D();
    this.coins.forEach((c, i) => {
      o.position.copy(c.p);
      o.position.y += Math.sin(t * 3 + i) * 0.15;
      o.rotation.set(0, t * 3 + i * 0.3, 0);
      const s = c.t > 0 ? 0 : 1;
      o.scale.set(s, s, s);
      o.updateMatrix();
      this.coinMesh.setMatrixAt(i, o.matrix);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }
}
