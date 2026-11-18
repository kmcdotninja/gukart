// Tyre fire, as the loader poster draws it (src/poster.js), but alive: fire pouring off the back tyres from where they
// meet the road, ragged tongues licking up round the tyre and streaming away behind it, flickering, a hot pool of
// light on the road under them. Used when you're ON FIRE, for the Sand Rail's WHEELIE LAUNCH (src/race.js,
// src/powers-race.js) and in the Vehicle Studio. Built onto the car itself (its back wheels' contact patches, in the
// car's own space), so it goes where the car goes; the embers are thrown by whoever uses it.
import * as THREE from 'three';

// the flame textures: tongues grown from turbulence noise, white-yellow at the root, orange, then red going clear
const NOI = (() => {
  const hash = (x, y, s) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const n = (x, y, s) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    return (
      (hash(xi, yi, s) * (1 - u) + hash(xi + 1, yi, s) * u) * (1 - v) +
      (hash(xi, yi + 1, s) * (1 - u) + hash(xi + 1, yi + 1, s) * u) * v
    );
  };
  return (x, y, s) =>
    n(x, y, s) * 0.5 +
    n(x * 2.03, y * 2.03, s) * 0.25 +
    n(x * 4.1, y * 4.1, s) * 0.125 +
    n(x * 8.3, y * 8.3, s) * 0.0625;
})();
let TEX = null,
  GLOW = null;
export function fireTextures() {
  if (TEX) return TEX;
  TEX = [1, 2, 3, 4, 5, 6].map(seed => {
    const W = 128,
      H = 256,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d'),
      im = x.createImageData(W, H);
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const u = px / W - 0.5,
          v = 1 - py / H; // v: 0 at the root, 1 at the tip
        const turb = NOI(px / 22, py / 26 + seed * 3, seed),
          sway = (NOI(v * 3, seed * 7, seed + 9) - 0.5) * 0.5 * v;
        const width = (0.42 - v * 0.34) * (0.7 + turb * 0.8);
        let f = 1 - Math.abs(u - sway) / Math.max(0.01, width);
        f *= (1 - v * 0.85) * (0.55 + turb * 0.9);
        f = Math.max(0, Math.min(1, (f - 0.18) / 0.6));
        if (f <= 0) continue;
        const q = (py * W + px) * 4;
        im.data[q] = 255;
        im.data[q + 1] = Math.min(255, 70 + f * 230);
        im.data[q + 2] = Math.min(255, f > 0.75 ? (f - 0.75) * 900 : 0);
        im.data[q + 3] = Math.min(255, f * 330);
      }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  return TEX;
}
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,120,1)');
  g.addColorStop(0.4, 'rgba(255,120,30,.5)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  GLOW = new THREE.CanvasTexture(c);
  GLOW.colorSpace = THREE.SRGBColorSpace;
  return GLOW;
}

// fire for a car: root is the car's root, wheels its wheels ({ spin, r }); the back ones burn. The fire stands on the
// road, not on the car: each back tyre's patch of fire sits where the tyre meets the ground and trails straight back
// along the road the way the car is heading, so it stays upright whatever the car does (a wheelie, a lean, a drift).
// Returns { update(dt, on, speed01), contacts } (contacts: where each back tyre meets the road, in world space)
export function makeTyreFire(root, wheels) {
  const tex = fireTextures();
  let world = root;
  while (world.parent) world = world.parent; // (the scene)
  root.updateMatrixWorld(true);
  const back = wheels.filter(w => root.worldToLocal(w.spin.getWorldPosition(new THREE.Vector3())).z < 0);
  const patches = [];
  for (const w of back) {
    const r = w.r || 0.4,
      side = Math.sign(root.worldToLocal(w.spin.getWorldPosition(new THREE.Vector3())).x) || 1,
      group = new THREE.Group(),
      tongues = [];
    world.add(group);
    // tongues round the tyre itself: from under it, up its back and a short lick behind (local -z is behind), never
    // wider than the tyre, so it burns on the tyre rather than spilling over the road
    const N = 12;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1),
        sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex[i % tex.length],
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
          }),
        );
      sp.center.set(0.5, 0.04); // (anchored at its root: each tongue rises from where it burns)
      // (kept to the tyre: within its width, from under it round its back, and only a short lick behind)
      const along = r * 0.45 - t * r * 1.7,
        out = side * (r * 0.25 + Math.random() * r * 0.25) * (i % 3 ? 1 : -1), // (on its outer wall, a few on its inner)
        h = r * (2.3 + Math.random() * 1.2) * (1 - Math.abs(t - 0.35) * 0.45); // (up the tyre and over its top)
      sp.position.set(out, Math.random() * 0.1, along);
      sp.visible = false;
      group.add(sp);
      tongues.push({ sp, h, w: h * (0.5 + Math.random() * 0.25), ph: Math.random() * 10, k: i });
    }
    // the heat pooled on the road under the tyre
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2.4, r * 3).rotateX(-Math.PI / 2), // (a small glow just under the tyre)
      new THREE.MeshBasicMaterial({
        map: glowTex(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        opacity: 0,
      }),
    );
    pool.position.set(0, 0.05, -r * 0.5);
    pool.visible = false;
    group.add(pool);
    patches.push({ w, r, group, tongues, pool, at: new THREE.Vector3() });
  }
  const fwd = new THREE.Vector3();
  let on = 0,
    t = 0;
  return {
    contacts: patches.map(p => p.at),
    // on: is it burning (fades in and out); speed01 stretches the flames back as the car goes faster
    update(dt, burning, speed01 = 0.5) {
      t += dt;
      on += ((burning ? 1 : 0) - on) * Math.min(1, dt * (burning ? 10 : 5));
      const vis = on > 0.02;
      // which way the car's heading, flat on the road
      fwd.set(0, 0, 1).transformDirection(root.matrixWorld);
      const yaw = Math.atan2(fwd.x, fwd.z);
      for (const p of patches) {
        p.group.visible = vis;
        if (!vis) continue;
        // the tyre's lowest point: its hub straight down by its radius
        p.w.spin.getWorldPosition(p.at);
        p.at.y -= p.r - 0.04;
        p.group.position.copy(p.at);
        p.group.rotation.set(0, yaw, 0);
        for (const q of p.tongues) {
          q.sp.visible = true;
          // flicker: each tongue breathes and swaps its shape now and then
          const f = 0.7 + 0.35 * Math.sin(t * 17 + q.ph) + 0.15 * Math.sin(t * 31 + q.ph * 2);
          q.sp.scale.set(q.w * (0.8 + 0.3 * Math.sin(t * 11 + q.ph)), q.h * f * (0.9 + speed01 * 0.15) * on, 1);
          q.sp.material.opacity = Math.min(1, 0.85 * on * (0.8 + 0.2 * Math.sin(t * 23 + q.ph)));
          if (Math.random() < dt * 12) q.sp.material.map = tex[(q.k + ((t * 9) | 0)) % tex.length];
        }
        p.pool.visible = true;
        p.pool.material.opacity = 0.5 * on * (0.85 + 0.15 * Math.sin(t * 19));
      }
    },
    dispose() {
      for (const p of patches) p.group.parent?.remove(p.group);
    },
  };
}
