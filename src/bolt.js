// The blaster's bolt: a slug of plasma. A white-hot core, long and pointed at both ends, inside a cyan glow, and a tail
// streaming off behind it that thins and fades; all of it light (it glows, it casts no shadow). Built once and cloned for
// each shot (the race's, the Physics Studio's). Points along +z, about 4 m long with its tail.
import * as THREE from 'three';

let proto = null;
export function makeBolt() {
  if (!proto) proto = build();
  return proto.clone();
}
const glow = (color, opacity) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
// a long spindle: round in the middle, drawn to a point at both ends (front short, back long)
function spindle(r, front, back, seg = 16) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg,
      z = -back + u * (back + front),
      t = z < 0 ? -z / back : z / front;
    pts.push(new THREE.Vector2(Math.max(0.001, r * Math.sqrt(Math.max(0, 1 - t * t))), z));
  }
  return new THREE.LatheGeometry(pts, 14).rotateX(Math.PI / 2);
}
function build() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(spindle(0.13, 0.35, 0.9), new THREE.MeshBasicMaterial({ color: '#ffffff' }))); // the core
  g.add(new THREE.Mesh(spindle(0.3, 0.55, 1.4), glow('#6fd3ff', 0.75))); // its glow
  g.add(new THREE.Mesh(spindle(0.55, 0.7, 1.9), glow('#2f9bff', 0.28))); // the haze round it
  // the tail: a fading streak behind it
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 2.6, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -2.1),
    glow('#9fe4ff', 0.45),
  );
  g.add(tail);
  g.traverse(o => (o.userData.noHit = true));
  return g;
}
