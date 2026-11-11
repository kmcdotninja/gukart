// The podium: when a race (or a whole cup) ends, the top three stand on a three-step podium just past the finish line,
// facing back down the straight towards the arch, and celebrate: the winner bounces and backflips, second and third
// bounce, pop and spin, confetti comes down. The karts are hidden while it's up; the results card then comes in over it.
import * as THREE from 'three';
import { Robot } from './robot.js';
import { setFace } from './buddy.js';
import { game } from './game.js';
import { scene } from './scene.js';

const AT = 26; // metres past the line
const STEPS = [
  // place: x across the podium (viewer's left is -x), height, top colour
  { x: 0, h: 1.5, top: '#ffc400' },
  { x: -2.7, h: 1.0, top: '#c9d1dc' },
  { x: 2.7, h: 0.65, top: '#e0904f' },
];
const W = 2.5,
  D = 2.4;
const BOT = 1.4; // the racers' size on the podium (1.3 in the karts)
const FEET = -0.42; // from a figure's origin (its seat) down to its feet when it stands, at that size
const SOLO_LIFT = 0.22; // the let-down pose stands a little lower than the cheer: lifted so his feet are on the road

let P = null,
  P_plinth = null;
export const podium = {
  on: false,
  t: 0,
  at: new THREE.Vector3(), // the middle of the podium, for the camera
  facing: new THREE.Vector3(), // the way the podium faces (towards the camera)
  cup: false,
};

function numberTex(n, col) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1d2a6b';
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#ff6a00';
  x.fillRect(0, 0, 256, 18); // the orange band under the top
  x.font = 'italic 900 170px "Barlow Condensed", "Arial Narrow", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = col;
  x.shadowColor = 'rgba(5,9,28,.6)';
  x.shadowBlur = 12;
  x.fillText(String(n), 128, 144);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function build() {
  const root = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ color: '#1d2a6b', roughness: 0.6, metalness: 0.1 });
  const steps = STEPS.map((S, i) => {
    const g = new THREE.Group();
    g.position.x = S.x;
    const front = new THREE.MeshStandardMaterial({ map: numberTex(i + 1, S.top), roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ color: S.top, roughness: 0.35, metalness: 0.35 });
    // a box: +x, -x, +y (top), -y, +z (the front, with its number), -z
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, S.h, D), [side, side, top, side, front, side]);
    box.position.y = S.h / 2;
    box.castShadow = box.receiveShadow = true;
    g.add(box);
    // the number face is square: stretch its texture to the front's shape without squashing the digit
    front.map.repeat.set(1, 1);
    root.add(g);
    return { g, S };
  });
  // a low navy plinth under all three, so the podium reads as one thing on the road
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * 3 + 1.2, 0.18, D + 1.2), side);
  plinth.position.y = 0.09;
  plinth.receiveShadow = true;
  root.add(plinth);
  P_plinth = plinth;
  root.visible = false;
  scene.add(root);
  game.baseKids?.add(root); // it stays when the circuit is swapped (src/circuit.js clears everything else)
  return { root, steps, plinth: P_plinth, bots: {}, cast: [] };
}
function botFor(def) {
  let b = P.bots[def.id];
  if (!b) {
    const r = new Robot(def.fur, def.ear, 12);
    r.root.scale.setScalar(BOT);
    b = P.bots[def.id] = { r, face: { fc: r.fc, ftex: r.ftex, expr: null }, moveT: 0, move: 'cheer', u: 0 };
  }
  return b;
}

// the tag that floats over you, so you can see which one is you: an orange slanted label, YOU, with a point under it
let youTag = null;
function makeYouTag() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#ff6a00';
  x.beginPath();
  x.moveTo(40, 10);
  x.lineTo(246, 10);
  x.lineTo(216, 100);
  x.lineTo(10, 100);
  x.closePath();
  x.fill();
  x.beginPath();
  x.moveTo(108, 100);
  x.lineTo(148, 100);
  x.lineTo(128, 132);
  x.closePath();
  x.fill();
  x.font = 'italic 900 78px "Barlow Condensed", "Arial Narrow", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  x.fillText('YOU', 128, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.3, 0.81, 1);
  s.renderOrder = 10;
  return s;
}

// karts: the three to stand up, in order (first, second, third). You (Buddy) wear the YOU tag. If you finished
// outside the top three, it's you alone instead, on the road where the podium would be, let down (solo)
export function showPodium(karts, { cup = false, solo = null } = {}) {
  P ||= build();
  // scene children are cleared when a circuit is swapped: put the podium back in if it was taken out
  if (P.root.parent !== scene) scene.add(P.root);
  const F = game.track.frame(AT, game.track.newFrame());
  podium.at.copy(F.p);
  podium.facing.set(-F.t.x, 0, -F.t.z).normalize(); // it faces back down the straight, towards the arch
  P.root.position.copy(F.p);
  P.root.lookAt(F.p.clone().add(podium.facing));
  for (const c of P.cast) c.b.r.root.removeFromParent();
  youTag ||= makeYouTag();
  youTag.removeFromParent();
  for (const st of P.steps) st.g.visible = !solo;
  P.plinth.visible = !solo;
  if (solo) {
    const b = botFor(solo.def);
    b.r.root.position.set(0, FEET + SOLO_LIFT, 1.2); // (standing, slumped: his feet sit lower than when he bounces)
    b.r.root.rotation.set(0, 0, 0);
    P.root.add(b.r.root);
    setFace(b.face, 'sad');
    P.cast = [{ b, i: 0, k: solo, solo: true }];
  } else
    P.cast = karts.slice(0, 3).map((k, i) => {
      const b = botFor(k.def),
        st = P.steps[i];
      b.r.root.position.set(0, st.S.h + FEET, 0);
      b.r.root.rotation.set(0, 0, 0);
      st.g.add(b.r.root);
      b.move = 'cheer';
      b.moveT = 0;
      b.next = 0.6 + i * 0.5; // each starts its first trick at a different moment
      setFace(b.face, i === 0 ? 'laugh' : 'happy');
      if (k.def.id === 'buddy') b.r.root.add(youTag);
      return { b, i, k };
    });
  youTag.position.set(0, 2.15, 0);
  for (const k of game.race.all) k.m.root.visible = false;
  P.root.visible = true;
  podium.on = true;
  podium.t = 0;
  podium.cup = cup;
  podium.solo = !!solo;
  if (!solo) game.race.confetti.burst(F.p.clone().addScaledVector(F.u, 9), 420, 16);
}
export function hidePodium() {
  if (!podium.on) return;
  podium.on = false;
  P.root.visible = false;
  for (const k of game.race.all) k.m.root.visible = true;
}
// each frame while it's up: the moves, and more confetti now and then
export function updatePodium(dt) {
  if (!podium.on) return;
  podium.t += dt;
  const tricks = [
    ['flip', 1.15],
    ['pop', 0.9],
  ];
  if (youTag?.parent) youTag.position.y = 2.15 + Math.sin(podium.t * 3) * 0.08; // a gentle bob
  for (const { b, i, solo } of P.cast) {
    if (solo) {
      b.r.update(dt, { t: game.clock, steer: 0, move: 'mope', u: 0, speed: 0 });
      continue;
    }
    if (b.move !== 'cheer') {
      b.moveT += dt;
      if (b.moveT >= b.moveD) {
        b.move = 'cheer';
        b.next = podium.t + 1.4 + Math.random() * 1.6 + i * 0.4;
      }
    } else if (podium.t >= b.next) {
      // the winner mostly backflips; second and third mostly pop and spin
      const [m, d] = tricks[i === 0 ? (Math.random() < 0.7 ? 0 : 1) : Math.random() < 0.75 ? 1 : 0];
      b.move = m;
      b.moveD = d;
      b.moveT = 0;
    }
    b.r.update(dt, {
      t: game.clock + i * 1.3,
      steer: 0,
      move: b.move,
      u: b.move === 'cheer' ? 0 : Math.min(1, b.moveT / b.moveD),
      side: i === 2 ? -1 : 1,
      speed: 0,
    });
  }
  if (!podium.solo && podium.t % 2.6 < dt) game.race.confetti.burst(podium.at.clone().setY(podium.at.y + 10), 160, 10);
}
