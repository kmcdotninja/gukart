// The bend trail: a glowing ribbon laid on the road through every real corner, starting a little before it, chevrons
// flowing forward along it, so you see the road bend coming and which way. Its look is the route ribbon from DeFleet's
// driver map (lime, teal, blue, violet; soft glow either side; chevrons with smooth edges at any distance), faded in
// and out at each end. On the road itself, banked and up on the bridges with it; never over a jump's gap, round a loop,
// or on the main line where a fork splits off (you might not be on it).
import * as THREE from 'three';

const AHEAD = 40, // metres of trail before the bend starts
  AFTER = 8, // and after it ends
  WIN = 20, // the window the turn is measured over, either side
  TURN = 0.38, // radians over 40 m: a real bend, not a kink
  W = 8, // the ribbon's width, about a third of the road (wide: easy to read at speed)
  GLOW = 1.6; // the glow either side, as a share of the ribbon

const VS = `
attribute float along; attribute float side; attribute float run;
varying float vAlong; varying float vSide; varying float vRun; varying float vFog;
void main(){ vAlong = along; vSide = side; vRun = run; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFog = -mv.z; gl_Position = projectionMatrix * mv; }`;
const FS = `
uniform float uFlow; uniform float uT;
varying float vAlong; varying float vSide; varying float vRun; varying float vFog;
vec3 grad(float t){
  vec3 a = vec3(.78,.95,.21), b = vec3(.18,.85,.64), c = vec3(.24,.55,1.), d = vec3(.58,.45,1.);   // lime, teal, blue, violet
  t = clamp(t, 0., 1.);
  if (t < .34) return mix(a, b, t / .34);
  if (t < .67) return mix(b, c, (t - .34) / .33);
  return mix(c, d, (t - .67) / .33);
}
void main(){
  float s = abs(vSide);                                  // 0 = the middle, 1 = the outer edge of the glow
  float aaS = fwidth(s) * 1.2;
  float core = 1. - smoothstep(.62 - aaS, .62 + aaS, s); // the ribbon, a crisp edge
  float glow = (1. - smoothstep(.62, 1., s)) * .3;       // a soft halo either side
  vec3 col = grad(vAlong / max(vRun, 1.));               // lime into the bend, violet out of it
  // chevrons pointing the way, flowing forward
  float u = (vAlong + s * 6. - uFlow) / 9.;
  float f = fract(u), aa = fwidth(u) * 1.5;
  float band = smoothstep(0., aa, f) * (1. - smoothstep(.42 - aa, .42 + aa, f)) * core;
  col = mix(col * .6, min(col * 1.22 + .08, vec3(1.)), band);
  col += (1. - smoothstep(0., .16, s)) * .1 * core;
  // a bright shimmer sweeping along the ribbon into the bend, again and again
  float sw = fract(vAlong / 70. - uT * .55);
  col += vec3(.55) * smoothstep(.0, .06, sw) * (1. - smoothstep(.06, .16, sw)) * core;
  float a = (core * .78 + glow) * (.86 + .14 * sin(uT * 4.)); // (and it breathes)
  a *= smoothstep(0., 12., vAlong) * (1. - smoothstep(vRun - 10., vRun, vAlong)); // in and out softly at each end
  a *= 1. - smoothstep(260., 520., vFog);                // gone in the distance
  gl_FragColor = vec4(col, a);
}`;

export function bendTrail(scene, tr) {
  const { N, K, seg, inLoop, inGap, wrap } = tr,
    w = Math.max(1, Math.round(WIN / seg));
  // the turn around each point, over the window either side
  const turn = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let h = 0;
    for (let d = -w; d <= w; d++) h += K[wrap(i + d)] * seg;
    turn[i] = h;
  }
  const forkAt = i => (tr.forks || []).some(f => i * seg >= f.sA - 10 && i * seg <= f.sB + 10);
  const bad = i => inLoop[i] || inGap[i] || forkAt(i);
  // which points carry the trail: each bend, from AHEAD metres before it to AFTER metres past it
  const on = new Uint8Array(N),
    pre = Math.round(AHEAD / seg),
    post = Math.round(AFTER / seg);
  for (let i = 0; i < N; i++) if (Math.abs(turn[i]) > TURN) for (let d = -pre; d <= post; d++) on[wrap(i + d)] = 1;
  for (let i = 0; i < N; i++) if (bad(i)) on[i] = 0;
  // one ribbon per run of points, its texture running along it
  const pos = [],
    along = [],
    side = [],
    runOf = [],
    index = [],
    F = tr.newFrame();
  let runStart = 0;
  const endRun = () => {
    for (let j = runStart; j < along.length; j++) runOf[j] = along[along.length - 1];
  };
  let start = 0;
  while (start < N && on[start]) start++; // (begin outside a run, so none is cut in two at the start line)
  let v = 0,
    prev = -1;
  for (let k = 0; k <= N; k++) {
    const i = wrap(start + k);
    if (!on[i] || k === N) {
      if (prev >= 0) endRun();
      prev = -1;
      continue;
    }
    tr.frame(i * seg, F);
    const lift = F.u.clone().multiplyScalar(0.07),
      a = F.p
        .clone()
        .addScaledVector(F.l, (W * GLOW) / 2)
        .add(lift),
      b = F.p
        .clone()
        .addScaledVector(F.l, (-W * GLOW) / 2)
        .add(lift);
    const n = pos.length / 3;
    if (prev < 0) {
      v = 0;
      runStart = along.length;
    }
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    along.push(v, v);
    side.push(1, -1);
    if (prev >= 0) index.push(prev, prev + 1, n, prev + 1, n + 1, n);
    prev = n;
    v += seg;
  }
  if (!index.length) return { update() {} };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('run', new THREE.Float32BufferAttribute(runOf, 1));
  g.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: { uFlow: { value: 0 }, uT: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    // the chevrons flow forward along the road
    update(dt) {
      mat.uniforms.uFlow.value += dt * 22; // (metres a second: quick enough to see moving at racing speed)
      mat.uniforms.uT.value += dt;
    },
  };
}
