// Holes shot through things (a locked-on rocket or blaster bolt going straight through a wall on its way to a car):
// you see through the hole to what's on the other side. The wall itself isn't cut; its material is taught to leave
// out every pixel inside the hole's tube (from where the shot went in to where it came out, a ragged circle round
// the line), so the far side, the sky and the street beyond show through. In the tube, a charred lining, the wall's
// thickness, glowing orange at first and cooling. Every patched material shares the same list of holes, so one hole
// cuts whatever it went through and the scorch marks round it (src/impacts.js), and nothing else nearby.
import * as THREE from 'three';

const MAX = 24;
const A = Array.from({ length: MAX }, () => new THREE.Vector4()), // entry xyz, radius (0: no hole)
  B = Array.from({ length: MAX }, () => new THREE.Vector4()); // exit xyz
const U = { holeA: { value: A }, holeB: { value: B } };
const patched = new WeakSet();
let next = 0;

// teach a material the holes (once; it keeps any patch it already had)
export function holeMaterial(m) {
  if (!m || patched.has(m) || m.isShaderMaterial || m.isRawShaderMaterial) return;
  patched.add(m);
  const prev = m.onBeforeCompile,
    key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.holeA = U.holeA;
    sh.uniforms.holeB = U.holeB;
    sh.vertexShader =
      'varying vec3 vHoleW;\n' +
      sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        { vec4 hw = vec4(transformed, 1.);
          #ifdef USE_INSTANCING
          hw = instanceMatrix * hw;
          #endif
          vHoleW = (modelMatrix * hw).xyz; }`,
      );
    sh.fragmentShader =
      `varying vec3 vHoleW; uniform vec4 holeA[${MAX}]; uniform vec4 holeB[${MAX}];\n` +
      sh.fragmentShader.replace(
        'void main() {',
        `void main() {
        for (int i = 0; i < ${MAX}; i++) {
          vec4 a = holeA[i];
          if (a.w <= 0.) continue;
          vec3 ab = holeB[i].xyz - a.xyz, ap = vHoleW - a.xyz;
          float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-4), 0., 1.);
          vec3 q = ap - ab * t, d = normalize(ab + vec3(0., 1e-5, 0.)),
            u = normalize(cross(d, abs(d.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), v = cross(d, u);
          float ang = atan(dot(q, v), dot(q, u)),
            r = a.w * (.84 + .1 * sin(ang * 5. + a.x * 3.) + .07 * sin(ang * 11. + a.z * 5.)); // (a torn edge, not a drilled one)
          if (length(q) < r) discard;
        }`,
      );
  };
  m.customProgramCacheKey = () => (key ? key.call(m) : '') + '|holes';
  m.needsUpdate = true;
}

// the linings: the inside of each hole, charred, glowing at first
const liners = [];
const linerGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2); // (along z)
const Z = new THREE.Vector3(0, 0, 1);
export function initHoles(scene) {
  for (const l of liners) l.m.parent?.remove(l.m);
  liners.length = 0;
  for (let i = 0; i < MAX; i++) {
    const m = new THREE.Mesh(
      linerGeo,
      new THREE.MeshStandardMaterial({
        color: '#2b2622',
        roughness: 1,
        emissive: '#ff6a1a',
        emissiveIntensity: 0,
        side: THREE.BackSide, // (only its inside, the far wall of the tube: looking in at an angle, you see through)
      }),
    );
    m.visible = false;
    m.userData.noHit = true;
    scene.add(m);
    liners.push({ m, t: 0 });
  }
  clearHoles();
}

// a hole from entry to exit (world points), radius r; the thing it went through (its material learns the holes)
export function punch(entry, exit, r, object) {
  if (object) for (const m of [].concat(object.material || [])) holeMaterial(m);
  const i = next++ % MAX,
    dir = exit.clone().sub(entry),
    len = Math.max(0.05, dir.length());
  dir.divideScalar(len);
  // (a little before the entry and past the exit: the faces themselves go, not just what's between them)
  const a = entry.clone().addScaledVector(dir, -0.05),
    b = exit.clone().addScaledVector(dir, 0.05);
  A[i].set(a.x, a.y, a.z, r);
  B[i].set(b.x, b.y, b.z, 0);
  const l = liners[i];
  if (l) {
    l.m.position.copy(entry).add(exit).multiplyScalar(0.5);
    l.m.quaternion.setFromUnitVectors(Z, dir);
    l.m.scale.set(r * 0.86, r * 0.86, len);
    l.m.visible = true;
    l.t = 0;
  }
}

// each frame: the linings cool from orange to charred
export function stepHoles(dt) {
  for (const l of liners) {
    if (!l.m.visible) continue;
    l.t += dt;
    l.m.material.emissiveIntensity = 0.08 + 1.8 * Math.exp(-l.t * 2.2);
  }
}

// a new race: the walls are whole again
export function clearHoles() {
  for (const v of A) v.w = 0;
  for (const l of liners) l.m.visible = false;
  next = 0;
}
