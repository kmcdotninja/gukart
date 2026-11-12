// Fireworks for the World Tour's Final: bursts over the start, gold, orange, white, cyan and pink, opening into a sphere
// of glowing sparks that slow, fall and fade. A burst during each number of the countdown, a salvo at GO, and a few more
// as the race gets away (src/main.js). One set of points, drawn in a single call.
import * as THREE from 'three';
import { scene } from './scene.js';
import { game } from './game.js';
import { Sound } from './audio.js';

const N = 1600,
  COLS = ['#ffc400', '#ff6a00', '#ffffff', '#6fd3ff', '#ff5ca8', '#ffe066'].map(c => new THREE.Color(c));
let F = null;
function make() {
  const g = new THREE.BufferGeometry(),
    pos = new Float32Array(N * 3).fill(0),
    col = new Float32Array(N * 3).fill(0);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  const pts = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size: 3.4,
      map: new THREE.CanvasTexture(c),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  pts.frustumCulled = false;
  scene.add(pts);
  game.baseKids?.add(pts); // it stays when the circuit is swapped
  F = { pts, pos, col, v: new Float32Array(N * 3), life: new Float32Array(N), base: new Float32Array(N * 3), i: 0 };
  return F;
}

// one burst at a point in the sky
export function burst(at, color = COLS[Math.floor(Math.random() * COLS.length)], n = 160) {
  F ||= make();
  if (F.pts.parent !== scene) scene.add(F.pts);
  const sp = 14 + Math.random() * 8;
  for (let k = 0; k < n; k++) {
    const i = F.i++ % N,
      // even round a sphere: a random direction
      u = Math.random() * 2 - 1,
      a = Math.random() * Math.PI * 2,
      r = Math.sqrt(1 - u * u),
      s = sp * (0.75 + Math.random() * 0.25);
    F.pos.set([at.x, at.y, at.z], i * 3);
    F.v.set([Math.cos(a) * r * s, u * s, Math.sin(a) * r * s], i * 3);
    F.base.set([color.r, color.g, color.b], i * 3);
    F.life[i] = 1;
  }
  Sound.blip(90 + Math.random() * 60, 0.35, 'triangle', 0.09, 0.35); // the boom
}
// a few bursts at once over the start line, ahead of the grid
export function salvo(n = 3) {
  const tr = game.track;
  if (!tr) return;
  const fr = tr.frame(0, tr.newFrame());
  for (let k = 0; k < n; k++) {
    const at = fr.p
      .clone()
      .addScaledVector(fr.t, 28 + Math.random() * 30)
      .addScaledVector(fr.l, (Math.random() - 0.5) * 50)
      .addScaledVector(fr.u, 20 + Math.random() * 16); // close over the start: big in the sky
    setTimeout(() => burst(at), k * 140);
  }
}
export function updateFireworks(dt) {
  if (!F) return;
  let alive = false;
  for (let i = 0; i < N; i++) {
    if (F.life[i] <= 0) continue;
    alive = true;
    const j = i * 3;
    F.life[i] -= dt * 0.62;
    const drag = Math.exp(-2.2 * dt);
    F.v[j] *= drag;
    F.v[j + 1] = F.v[j + 1] * drag - 5.5 * dt; // they slow, then fall
    F.v[j + 2] *= drag;
    F.pos[j] += F.v[j] * dt;
    F.pos[j + 1] += F.v[j + 1] * dt;
    F.pos[j + 2] += F.v[j + 2] * dt;
    // bright, then a flicker as they die
    const L = Math.max(0, F.life[i]),
      fl = L < 0.35 ? (Math.random() < 0.5 ? 0.2 : 1) : 1,
      k = Math.min(1, L * 1.6) * fl;
    F.col[j] = F.base[j] * k;
    F.col[j + 1] = F.base[j + 1] * k;
    F.col[j + 2] = F.base[j + 2] * k;
    if (F.life[i] <= 0) F.col[j] = F.col[j + 1] = F.col[j + 2] = 0;
  }
  F.pts.visible = alive;
  if (alive) {
    F.pts.geometry.attributes.position.needsUpdate = true;
    F.pts.geometry.attributes.color.needsUpdate = true;
  }
}
