// The Yaji boost's pepper: yaji is the hot spice rubbed on suya, and its fire is a chili's. A long red chili, glossy,
// fat at the shoulder and curving to a point, under a green cap of sepals with its curled stem. Used, it pops up over
// the car, swelling with a wobble and spinning, then bursts in a shower of red and orange spice as the red flames roar
// out of the pipes. One model (the race's, the Physics Studio's). About 1.3 m long, its stem up.
import * as THREE from 'three';

let proto = null;
export function makeChili() {
  if (!proto) proto = build();
  return proto.clone();
}
function build() {
  const g = new THREE.Group();
  // the pod: turned round its length (fat just under the cap, a long taper to the tip), then bent into its curve
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, // (0 the tip, 1 the shoulder)
      r = 0.26 * Math.pow(Math.sin(u * Math.PI * 0.5), 0.8) * (1 - 0.12 * Math.max(0, u - 0.85) / 0.15);
    pts.push(new THREE.Vector2(Math.max(0.004, r), -1.15 + u * 1.15));
  }
  pts.push(new THREE.Vector2(0.001, 0.02));
  const pod = new THREE.LatheGeometry(pts, 28),
    p = pod.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); // (0 at the shoulder, -1.15 at the tip)
    p.setX(i, p.getX(i) + 0.42 * y * y); // (the curve: the tip swept round)
    p.setZ(i, p.getZ(i) * 0.92); // (a little flattened, as a real one is)
  }
  pod.computeVertexNormals();
  const red = new THREE.MeshPhysicalMaterial({
    color: '#d81e14',
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.3,
    emissive: '#3a0400',
  });
  const body = new THREE.Mesh(pod, red);
  body.castShadow = true;
  g.add(body);
  // the cap: five sepals, a little star of green folded down over the shoulder
  const green = new THREE.MeshStandardMaterial({ color: '#3f8a2a', roughness: 0.45 });
  const s = new THREE.Shape();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2,
      r = 0.2 + 0.08 * Math.cos(a * 5);
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const cap = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
      .rotateX(-Math.PI / 2),
    green,
  );
  cap.position.y = 0.0;
  cap.scale.set(1, 1, 1);
  g.add(cap);
  // the stem: up out of the cap and curling over
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(0.02, 0.2, 0),
        new THREE.Vector3(-0.06, 0.34, 0),
        new THREE.Vector3(-0.18, 0.38, 0),
      ]),
      16,
      0.045,
      8,
    ),
    green,
  );
  g.add(stem);
  g.traverse(o => (o.userData.noHit = true));
  return g;
}

// a pepper popped over a car (parent: the car's root) by its Yaji boost: up, swelling with a wobble, spinning; then a
// burst of spice. fx: the race's effects (its sparks)
const pops = [];
export function popChili(parent, fx) {
  const m = makeChili();
  m.position.set(0, 3.4, 0);
  m.scale.setScalar(0.01);
  parent.add(m);
  pops.push({ m, parent, fx, t: 0 });
}
export function updateChilis(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const c = pops[i];
    c.t += dt;
    const t = c.t;
    // swelling in with an overshoot, a wobble, rising and spinning
    const grow = t < 0.25 ? (t / 0.25) * 1.35 : 1.35 - 0.25 * Math.min(1, (t - 0.25) / 0.15);
    c.m.scale.setScalar(Math.max(0.01, grow) * (1 + 0.06 * Math.sin(t * 30) * Math.exp(-t * 5)));
    c.m.position.y = 3.4 + t * 1.2;
    c.m.rotation.set(0.3 * Math.sin(t * 6), t * 9, 0.4);
    if (t > 0.7) {
      // the burst: hot red and orange spice in every direction
      const at = new THREE.Vector3();
      c.m.getWorldPosition(at);
      const v = new THREE.Vector3();
      c.fx.spark(at, '#ffd27a', 4, 0.2);
      for (let k = 0; k < 16; k++) {
        v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(6 + Math.random() * 8);
        c.fx.spark(at, ['#ff3b1f', '#ff7a1a', '#c81414', '#ffb23a'][k % 4], 0.7, 0.6, v);
      }
      c.parent.remove(c.m);
      pops.splice(i, 1);
    }
  }
}
// a new race: any still showing taken down
export function clearChilis() {
  for (const c of pops) c.parent.remove(c.m);
  pops.length = 0;
}
