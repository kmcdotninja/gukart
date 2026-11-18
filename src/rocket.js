// The rocket, as the user's reference draws it: a long olive-green body in sections (raised bands at the joins, rivet
// lines), a black ogive nose cone, a conduit running down one side with its clamps, a ring of four smaller swept fins
// part way along and four big swept fins at the tail, a dark nozzle at the back with the flame coming out of it.
// Built once and cloned for each shot (the race's and the Physics Studio's). Points along +z, about 3 m long.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let proto = null;
export function makeRocket() {
  if (!proto) proto = build();
  return proto.clone();
}
function build() {
  const g = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({ color: '#7d8a4e', metalness: 0.35, roughness: 0.55 }),
    oliveD = new THREE.MeshStandardMaterial({ color: '#636f3b', metalness: 0.35, roughness: 0.6 }),
    black = new THREE.MeshStandardMaterial({ color: '#16181c', metalness: 0.6, roughness: 0.25 }),
    steel = new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.8, roughness: 0.35 });
  const R = 0.2,
    L = 2.2; // the body's radius and length (z from -L/2 to L/2)
  const along = geo => geo.rotateX(Math.PI / 2); // (a cylinder along z)
  // the body
  g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(R, R * 0.96, L, 24)), olive));
  // the nose: an ogive, black
  {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push(new THREE.Vector2(R * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - u * 0.15), u * 0.9));
    }
    const nose = new THREE.Mesh(new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2), black);
    nose.position.z = L / 2;
    g.add(nose);
  }
  // raised bands at the joins
  const bands = [];
  for (const z of [-0.85, -0.3, 0.25, L / 2 - 0.02])
    bands.push(along(new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.05, 24)).translate(0, 0, z));
  g.add(new THREE.Mesh(mergeGeometries(bands), oliveD));
  // the conduit down one side, with its clamps
  const cond = [along(new THREE.CylinderGeometry(0.035, 0.035, L * 0.8, 8)).translate(0, R + 0.035, -0.05)];
  for (const z of [-0.7, -0.15, 0.4]) cond.push(new THREE.BoxGeometry(0.1, 0.06, 0.06).translate(0, R + 0.03, z));
  g.add(new THREE.Mesh(mergeGeometries(cond), oliveD));
  // the fins: a swept plate, four round the body at each ring (the tail's big, the middle's small)
  const fin = (span, root, tip, sweep) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(span, -sweep);
    s.lineTo(span, -sweep - tip);
    s.lineTo(0, -root);
    s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.0125);
  };
  const fins = [];
  for (const [z, span, root, tip, sweep, off] of [
    [-0.72, 0.42, 0.46, 0.2, 0.28, Math.PI / 4],
    [0.05, 0.22, 0.3, 0.12, 0.16, 0],
  ])
    for (let k = 0; k < 4; k++) {
      const f = fin(span, root, tip, sweep); // (in xy: out along x, back along -y)
      f.rotateX(Math.PI / 2); // (back along -z now, flat in xz)
      f.rotateZ(off + (k * Math.PI) / 2); // (round the body)
      const out = new THREE.Vector3(
        Math.cos(off + (k * Math.PI) / 2),
        Math.sin(off + (k * Math.PI) / 2),
        0,
      ).multiplyScalar(R * 0.95);
      f.translate(out.x, out.y, z);
      fins.push(f);
    }
  g.add(new THREE.Mesh(mergeGeometries(fins), olive));
  // the nozzle and its glow
  const noz = new THREE.Mesh(along(new THREE.CylinderGeometry(R * 0.7, R * 0.85, 0.22, 20, 1, true)), steel);
  noz.material.side = THREE.DoubleSide;
  noz.position.z = -L / 2 - 0.1;
  g.add(noz);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.68, 20).rotateY(Math.PI),
    new THREE.MeshBasicMaterial({ color: '#ffd27a' }),
  );
  glow.position.z = -L / 2 - 0.2;
  g.add(glow);
  // the flame: a hot cone out of the nozzle
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(R * 0.65, 1.1, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.55),
    new THREE.MeshBasicMaterial({
      color: '#ff9a2a',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flame.position.z = -L / 2 - 0.2;
  g.add(flame);
  g.traverse(o => {
    if (o.isMesh) o.castShadow = true;
    o.userData.noHit = true;
  });
  g.scale.setScalar(1.35); // (about 3 m nose to nozzle: big enough to follow down the road)
  return g;
}
