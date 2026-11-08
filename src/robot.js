// Buddy, the DeFleet robot, ported from DeFleet's robot3d.js: the same signed-distance shapes (the pear of a body, the
// big helmet head, short thick legs on rounded feet, mitten paws), meshed the same way (surface nets), the squircle
// glass visor with the eyes laid on it, Headset 1's ear cups, arms that are smooth tubes reaching their paws through the
// same two-bone solve, and the same pose vocabulary (hand targets in body space, head nod/turn/tilt, body lean, sit,
// kicks). The fur is shells, one instanced draw per part, light enough for six of them on a phone.
// Moves are built the way DeFleet's moves.js builds them: each a function of its progress laying poses over the base
// pose and turning the whole figure, with the same beats (crouch, take-off, air, a soft landing squash, a follow-through).
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function rbox(x, y, z, bx, by, bz, r){
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
function cap(x, y, z, a, b, r){
  const px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - r;
}
function blob(x, y, z, rx, ry, rz){
  const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / rx / rx, y / ry / ry, z / rz / rz);
  return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
// naive surface nets: a smooth welded mesh of where f crosses zero, normals from the shape (robot3d.js)
function mesh(f, lo, hi, s){
  const nx = Math.ceil((hi[0] - lo[0]) / s) + 1, ny = Math.ceil((hi[1] - lo[1]) / s) + 1, nz = Math.ceil((hi[2] - lo[2]) / s) + 1;
  const at = (i, j, k) => i + nx * (j + ny * k), v = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[at(i, j, k)] = f(lo[0] + i * s, lo[1] + j * s, lo[2] + k * s);
  const cell = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cv[c] = v[at(i + C[c][0], j + C[c][1], k + C[c][2])]; if (cv[c] < 0) neg++; }
    if (!neg || neg === 8) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      px += C[a][0] + (C[b][0] - C[a][0]) * t; py += C[a][1] + (C[b][1] - C[a][1]) * t; pz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    cell[at(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + px / n) * s, lo[1] + (j + py / n) * s, lo[2] + (k + pz / n) * s);
  }
  const I = [];
  const quad = (a, b, c, d, flip) => { if ([a, b, c, d].some(q => q < 0)) return; flip ? I.push(a, d, c, a, c, b) : I.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const in0 = v[at(i, j, k)] < 0;
    if (in0 !== (v[at(i + 1, j, k)] < 0)) quad(cell[at(i, j - 1, k - 1)], cell[at(i, j, k - 1)], cell[at(i, j, k)], cell[at(i, j - 1, k)], !in0);
    if (in0 !== (v[at(i, j + 1, k)] < 0)) quad(cell[at(i - 1, j, k - 1)], cell[at(i - 1, j, k)], cell[at(i, j, k)], cell[at(i, j, k - 1)], !in0);
    if (in0 !== (v[at(i, j, k + 1)] < 0)) quad(cell[at(i - 1, j - 1, k)], cell[at(i, j - 1, k)], cell[at(i, j, k)], cell[at(i - 1, j, k)], !in0);
  }
  const N = new Float32Array(P.length), e = s * .25, g = [0, 0, 0];
  const grad = (x, y, z) => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    g[0] = a - b - c + d; g[1] = -a - b + c + d; g[2] = -a + b - c + d; const l = Math.hypot(g[0], g[1], g[2]) || 1; g[0] /= l; g[1] /= l; g[2] /= l;
  };
  for (let q = 0; q < P.length; q += 3) {
    for (let it = 0; it < 2; it++) { const d = f(P[q], P[q + 1], P[q + 2]); grad(P[q], P[q + 1], P[q + 2]); P[q] -= g[0] * d; P[q + 1] -= g[1] * d; P[q + 2] -= g[2] * d; }
    grad(P[q], P[q + 1], P[q + 2]); N[q] = g[0]; N[q + 1] = g[1]; N[q + 2] = g[2];
  }
  return { P: new Float32Array(P), N, I };
}
function frontZ(f, x, y){
  let z = 1.2;
  for (; z > -.3; z -= .01) if (f(x, y, z) < 0) break;
  if (z <= -.3) return null;
  let a = z, b = z + .01;
  for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (f(x, y, m) < 0) a = m; else b = m; }
  return (a + b) / 2;
}

/* ---- the shapes (robot3d.js) ---- */
const HC = .53, VA = .6, VB = .35, VC = .53, VN = 3.6;
const headSkin = (x, y, z) => { const t = clamp((y - HC) / .5, -1, 1), w = 1 + .05 * t; return rbox(x / w, y - HC, z / (1 + .03 * t), .7, .5, .52, .47); };
const visorR = (x, y) => (Math.abs(x / VA) ** VN + Math.abs((y - VC) / VB) ** VN) ** (1 / VN);
function visorZ(x, y){
  const r = visorR(x, y), zs = frontZ(headSkin, x, y) ?? .45, r0 = .95;
  const rise = .014 + .05 * (1 - Math.min(1, r) ** 2.4);
  if (r <= r0) return zs + rise;
  const t = Math.min(1, (r - r0) / (1 - r0));
  return zs + rise - (rise + .012) * (1 - Math.sqrt(1 - t * t));
}
function visorGeo(){
  const NR = 18, NA = 72, P = [], I = [];
  P.push(0, VC, visorZ(0, VC));
  for (let i = 1; i <= NR; i++) {
    const r = Math.min(1, 1 - (1 - i / NR) ** 1.6);
    for (let j = 0; j < NA; j++) {
      const a = j / NA * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const x = VA * r * Math.sign(c) * Math.abs(c) ** (2 / VN), y = VC + VB * r * Math.sign(s) * Math.abs(s) ** (2 / VN);
      P.push(x, y, visorZ(x, y));
    }
  }
  const at = (i, j) => 1 + (i - 1) * NA + (j % NA);
  for (let j = 0; j < NA; j++) I.push(0, at(1, j), at(1, j + 1));
  for (let i = 1; i < NR; i++) for (let j = 0; j < NA; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  const g = new THREE.BufferGeometry(); g.setIndex(I); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  return g;
}
function eyesGeo(){
  const g = new THREE.PlaneGeometry(1.12, .66, 28, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + VC; p.setY(i, y); p.setZ(i, visorZ(x, y) + .006); }
  return g;
}
function cupGeo(){
  const pr = [[0, .1], [.3, .098], [.56, .092], [.6, .078], [.66, .076], [.7, .086], [.76, .09], [.86, .082], [.94, .062], [.99, .035], [1, .01], [.97, -.01], [.6, -.02], [0, -.02]];
  const g = new THREE.LatheGeometry(pr.map(([r, h]) => new THREE.Vector2(Math.max(1e-4, r), h)).reverse(), 40);
  g.scale(.25, 1, .19); g.computeVertexNormals();
  return g;
}
const legF = (x, y, z) => {
  const leg = cap(x, y, z, [0, 0, 0], [0, -.16, 0], .135);
  const c = Math.cos(.18), sn = Math.sin(.18), fx = x - .02, fz = z - .07, rx = fx * c - fz * sn, rz = fx * sn + fz * c;
  const foot = smax(rbox(rx, y + .25, rz, .155, .09, .21, .09), -(y + .33), .05);
  return smin(leg, foot, .09);
};
const torsoF = (x, y, z) => {
  const k = clamp(y / .62, 0, 1), w = 1.18 - .3 * k, dz = 1.1 - .14 * k;
  let d = rbox(x / w, y - .23, z / dz, .36, .31, .26, .26);
  [-1, 1].forEach(s => { d = smin(d, blob(x - s * .3, y - .42, z - .05, .16, .15, .16), .16); });
  [-1, 1].forEach(s => { d = smin(d, blob(x - s * .2, y + .04, z - .02, .15, .12, .15), .12); });
  return smin(d, blob(x, y - .6, z + .01, .34, .2, .26), .14);
};
const fistF = s => (x, y, z) => smin(blob(x, y - .01, z + .015, .1, .1, .085), blob(x - s * .075, y - .02, z - .035, .04, .05, .04), .05);
const UP = .26, FORE = .32, ARM = .175, NSEG = 4, SEG = .14, S0 = [.3, .42, .06];

/* ---- fur: shells pushed out along the skin, one instanced draw per part ---- */
const FUR_VS = `attribute float layer; attribute float fl; attribute float ao;
uniform float uN, uLen; varying vec3 vO; varying vec3 vN; varying float vH, vAo, vFl;
void main(){
  float h = layer / max(uN - 1., 1.); vH = h; vFl = fl; vAo = ao; vO = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec3 down = normalize((vec4(0., -1., 0., 0.) * modelMatrix).xyz);
  vec3 p = position + normal * uLen * fl * h + down * uLen * fl * h * h * .4;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const FUR_FS = `uniform float uF; uniform vec3 uC, uSun; varying vec3 vO; varying vec3 vN; varying float vH, vAo, vFl;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  if (vH > .001) {
    if (vFl < .03) discard;
    vec3 q = vO * uF; vec3 c = floor(q); float n = h3(c);
    vec3 f = fract(q) - .5 - (vec3(h3(c + 3.1), h3(c + 7.7), h3(c + 1.3)) - .5) * .45;
    if (n < vH * .85) discard;
    if (length(f) > (1. - vH) * .78 + .08) discard;
  }
  vec3 N = normalize(vN);
  float d = max((dot(N, uSun) + .5) / 1.5, 0.);
  vec3 col = uC * (.5 + .62 * vH) * (.42 + .78 * d + .12 * N.y) * vAo;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
export const SUN_DIR = new THREE.Vector3(-.45, .8, .4).normalize();
function shells(raw, layers, look){
  const n = raw.P.length / 3, fl = new Float32Array(n), ao = new Float32Array(n);
  for (let i = 0; i < n; i++) { const [a, b] = look ? look(raw.P[i * 3], raw.P[i * 3 + 1], raw.P[i * 3 + 2], raw.N[i * 3 + 1]) : [1, 1]; fl[i] = a; ao[i] = b; }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(raw.I); g.setAttribute('position', new THREE.BufferAttribute(raw.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(raw.N, 3));
  g.setAttribute('fl', new THREE.BufferAttribute(fl, 1)); g.setAttribute('ao', new THREE.BufferAttribute(ao, 1));
  g.setAttribute('layer', new THREE.InstancedBufferAttribute(new Float32Array(layers).map((_, i) => i), 1));
  g.instanceCount = layers;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  return g;
}
function mirrorRaw({ P, N, I }){
  const P2 = P.slice(), N2 = N.slice(), I2 = Array.from(I);
  for (let i = 0; i < P2.length; i += 3) { P2[i] = -P2[i]; N2[i] = -N2[i]; }
  for (let i = 0; i < I2.length; i += 3) { const t = I2[i + 1]; I2[i + 1] = I2[i + 2]; I2[i + 2] = t; }
  return { P: P2, N: N2, I: I2 };
}

// the raw shapes are meshed once and shared by every robot; shells are made per fur density (player, rivals)
let RAW = null;
const SH = {};
function raw(){
  if (RAW) return RAW;
  const leg = mesh(legF, [-.28, -.42, -.25], [.28, .18, .38], .024);
  const fist = mesh(fistF(1), [-.2, -.18, -.18], [.22, .2, .18], .016);
  RAW = {
    head: mesh(headSkin, [-.78, -.02, -.56], [.78, 1.06, .56], .028),
    torso: mesh(torsoF, [-.62, -.2, -.45], [.62, .84, .45], .026),
    legR: leg, legL: mirrorRaw(leg),
    seg: mesh((x, y, z) => cap(x, y, z, [0, -SEG / 2, 0], [0, SEG / 2, 0], ARM), [-.22, -.3, -.22], [.22, .3, .22], .028),
    fistR: fist, fistL: mirrorRaw(fist),
  };
  return RAW;
}
const CUP = (y, z) => Math.hypot((y - .5) / .25, (z + .02) / .19);
const headLook = (x, y, z, ny) => {   // no fur under the glass or the ear cups; a fuller crown; the fur round the glass lit
  let fl = 1 + .45 * sstep(.2, .9, ny), ao = 1 - .4 * sstep(-.2, -.85, ny);
  const r = z > 0 ? visorR(x, y) : 9;
  if (r < 1.3) { fl *= r < .985 ? 0 : mix(.75, 1, sstep(.985, 1.1, r)); ao = Math.max(ao, 1.1 - .2 * sstep(1, 1.3, r)); }
  if (Math.abs(x) > .45) { const c = CUP(y, z); fl *= c < .74 ? 0 : mix(.7, 1.1, sstep(.74, .95, c)); }
  return [fl, ao];
};
function parts(layers){
  if (SH[layers]) return SH[layers];
  const R = raw();
  return (SH[layers] = {
    head: shells(R.head, layers, headLook), torso: shells(R.torso, layers, (x, y) => [1 + .25 * sstep(.16, -.04, y), 1 - .2 * sstep(.45, .7, y)]),
    legR: shells(R.legR, Math.max(4, layers - 4), (x, y, z, ny) => [y < -.16 ? (ny < -.5 ? .15 : .8) : 1, 1 - .35 * sstep(-.03, .05, y)]),
    legL: shells(R.legL, Math.max(4, layers - 4), (x, y, z, ny) => [y < -.16 ? (ny < -.5 ? .15 : .8) : 1, 1 - .35 * sstep(-.03, .05, y)]),
    seg: shells(R.seg, Math.max(4, layers - 2)), fistR: shells(R.fistR, Math.max(4, layers - 4)), fistL: shells(R.fistL, Math.max(4, layers - 4)),
  });
}
let VIS = null;
const shared = () => VIS ||= { visor: visorGeo(), eyes: eyesGeo(), cup: cupGeo(), dot: new THREE.SphereGeometry(.02, 10, 8),
  glass: new THREE.MeshPhongMaterial({ color: '#050505', shininess: 150, specular: '#b8b8b8' }), dotMat: new THREE.MeshPhongMaterial({ color: '#1a0802', shininess: 30 }) };

/* ---- the poses (poses.js / moves.js): body space, x to the robot's left as the viewer sees it, y up from the hips,
   z forward. A hand: where it goes and which way its elbow points ---- */
const H = (t, pole = [-1, -.6, -.5]) => ({ t, pole });
const mir = h => ({ t: [-h.t[0], h.t[1], h.t[2]], pole: [-h.pole[0], h.pole[1], h.pole[2]] });
const HANG = H([-.58, .1, .14]), BACK = H([-.5, .16, -.26], [-1, -.3, -.6]), UPV = H([-.88, .98, .16], [-.3, -1, -.4]),
  TA = H([-.92, .84, .32], [-.4, -1, -.3]), TUCK = H([-.28, .1, .5], [-1, -.5, 0]), HUG = H([-.18, .32, .56], [-1, -.5, 0]),
  CHEEK = H([-.46, .64, .54], [-1, -1, -.2]), WAVE = H([-.84, .92, .2], [-.3, -1, -.4]), FIST = H([-.8, .66, .2], [-.4, -1, -.3]),
  OUT = H([-.94, .48, .12], [-.3, -1, -.5]);
const WHEEL = [0, .4, .52], WR = .2;   // the steering wheel's centre and radius, body space
const TAU = Math.PI * 2;
const c01 = v => clamp(v, 0, 1), seg = (p, a, b) => c01((p - a) / (b - a)), sm = x => x * x * (3 - 2 * x);
const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const pl = (p, a, b, c, d) => sm(seg(p, a, b)) * (1 - sm(seg(p, c, d)));
const arc = (p, a, b, Hh) => { const x = seg(p, a, b); return 4 * Hh * x * (1 - x); };
const bell = x => Math.sin(Math.PI * c01(x));

function basePose(){ return { L: H([-.2, .4, .5]), R: H([.2, .4, .5]), head: [0, 0, 0], body: [0, 0], sit: 1, kickL: 0, kickR: 0, legs: [0, 0, 0, 0] }; }
const lerpA = (a, b, w) => a.map((x, i) => (b[i] == null ? x : x + (b[i] - x) * w));
const setH = (c, side, h, w) => { if (w > 1e-4) c[side] = { t: lerpA(c[side].t, h.t, w), pole: lerpA(c[side].pole, h.pole, w) }; };
const setHs = (c, h, w) => { setH(c, 'L', h, w); setH(c, 'R', mir(h), w); };

export class Robot {
  constructor(color, cupColor, layers = 10){
    const P = parts(layers), V = shared();
    this.root = new THREE.Group();
    this.mover = new THREE.Group(); this.root.add(this.mover);
    this.rig = new THREE.Group(); this.rig.position.y = -.55; this.mover.add(this.rig); this.mover.position.y = .55;   // turns about the middle of the figure
    const uC = { value: new THREE.Color(color) }, uSun = { value: SUN_DIR };
    const mat = (len, n, f = 52) => new THREE.ShaderMaterial({ uniforms: { uN: { value: n }, uLen: { value: len }, uF: { value: f }, uC, uSun }, vertexShader: FUR_VS, fragmentShader: FUR_FS });
    const furMesh = (g, m) => { const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.castShadow = true; return o; };
    const mBody = mat(.05, layers), mFoot = mat(.035, Math.max(4, layers - 4)), mArm = mat(.05, Math.max(4, layers - 2)), mHand = mat(.04, Math.max(4, layers - 4));
    this.hips = new THREE.Group(); this.hips.position.y = .32; this.rig.add(this.hips);
    this.legs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * .2, .03, 0); g.add(furMesh(s > 0 ? P.legR : P.legL, mFoot)); this.hips.add(g); return g; });
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    this.torso.add(furMesh(P.torso, mBody));
    for (const x of [-.06, 0, .06]) { const d = new THREE.Mesh(V.dot, V.dotMat); d.position.set(x, .14, (frontZ(torsoF, x, .14) ?? .25) + .04); this.torso.add(d); }
    this.arms = [-1, 1].map(s => {
      const segs = Array.from({ length: NSEG }, () => furMesh(P.seg, mArm)), hand = new THREE.Group();
      hand.add(furMesh(s > 0 ? P.fistR : P.fistL, mHand)); hand.children[0].scale.setScalar(1.8);
      this.torso.add(...segs, hand);
      return { s, segs, hand, S: new THREE.Vector3(s * S0[0], S0[1], S0[2]), E: new THREE.Vector3(), T: new THREE.Vector3(), P: Array.from({ length: NSEG + 1 }, () => new THREE.Vector3()) };
    });
    this.head = new THREE.Group(); this.head.position.set(0, .55, 0); this.head.scale.setScalar(1.07); this.torso.add(this.head);
    this.head.add(furMesh(P.head, mat(.055, layers)));
    const glass = new THREE.Mesh(V.visor, V.glass); this.head.add(glass);
    const fc = document.createElement('canvas'); fc.width = 256; fc.height = 160;
    this.fc = fc; this.ftex = new THREE.CanvasTexture(fc); this.ftex.colorSpace = THREE.SRGBColorSpace;
    const eyes = new THREE.Mesh(V.eyes, new THREE.MeshBasicMaterial({ map: this.ftex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    eyes.renderOrder = 2; this.head.add(eyes);
    const cupMat = new THREE.MeshPhongMaterial({ color: cupColor, shininess: 70, specular: '#664433' });
    for (const s of [-1, 1]) { const c = new THREE.Mesh(V.cup, cupMat); c.rotation.set(0, s * .3, -s * Math.PI / 2, 'YXZ'); c.scale.set(1, 1.35, 1); c.position.set(s * .72, .5, -.02); c.castShadow = true; this.head.add(c); }
    this.cur = basePose(); this.tq = new THREE.Vector3(); this.tu = new THREE.Vector3(); this.tv = new THREE.Vector3(); this.tw = new THREE.Vector3(); this.tm = new THREE.Matrix4();
    this.apply(this.cur, {}, 0);
  }

  // two-bone reach (robot3d.js): the hand gets as near the target as the arm allows, the elbow bending toward the pole
  reach(arm, t, pole){
    const S = arm.S, T = arm.T.set(t[0], t[1], t[2]), u = this.tu.copy(T).sub(S);
    let d = u.length(); u.normalize();
    d = clamp(d, Math.abs(UP - FORE) + .02, UP + FORE - .002);
    T.copy(S).addScaledVector(u, d);
    const pv = this.tv.set(pole[0], pole[1], pole[2]); pv.addScaledVector(u, -pv.dot(u)); if (pv.lengthSq() < 1e-6) pv.set(0, -1, 0); pv.normalize();
    const ca = (UP * UP + d * d - FORE * FORE) / (2 * UP * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    const E = arm.E.copy(S).addScaledVector(u, UP * ca).addScaledVector(pv, UP * sa);
    arm.P.forEach((p, i) => { const k = i / NSEG; p.copy(S).multiplyScalar((1 - k) ** 2).addScaledVector(E, 2 * (1 - k) * k).addScaledVector(T, k * k); });
    arm.segs.forEach((m, i) => {
      const a = arm.P[i], b = arm.P[i + 1];
      m.position.copy(a).add(b).multiplyScalar(.5);
      const w = this.tw.copy(b).sub(a); m.scale.set(1, Math.max(.3, w.length() / SEG), 1);
      m.quaternion.setFromUnitVectors(Y, w.normalize());
    });
    arm.hand.position.copy(T);
    const y = this.tw.copy(E).sub(T).normalize(), hang = clamp(y.y, 0, 1), z = this.tv.set(-arm.s * hang, 0, 1 - hang * .6);
    z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-4) z.set(0, -1, 0); z.normalize();
    arm.hand.quaternion.setFromRotationMatrix(this.tm.makeBasis(this.tq.crossVectors(y, z), y, z));
  }
  apply(c, g, t){
    this.mover.position.set(g.x || 0, .55 + (g.y || 0), g.z || 0);
    this.mover.rotation.set(g.rx || 0, g.ry || 0, g.rz || 0);
    this.mover.scale.set(g.sx ?? 1, g.sy ?? 1, g.sz ?? 1);
    const breathe = Math.sin(t * 2.1) * .012;
    this.hips.position.y = .32 - c.sit * .18 + breathe * .5;
    this.legs.forEach((lg, k) => {
      const kick = k ? c.kickR : c.kickL, sd = k ? 1 : -1, lp = c.legs[k * 2], lr = c.legs[k * 2 + 1];
      lg.rotation.set(-c.sit * 1.45 - kick * .35 - lp, 0, sd * (c.sit * .55 + kick * .5 + lr));
    });
    this.torso.rotation.set(c.body[0] + c.sit * .04, 0, c.body[1] - (c.kickR - c.kickL) * .06);
    this.torso.position.y = breathe;
    this.reach(this.arms[0], c.L.t, c.L.pole);
    this.reach(this.arms[1], c.R.t, c.R.pole);
    this.head.rotation.set(c.head[0], c.head[1], c.head[2] + Math.sin(t * 1.3) * .015, 'YXZ');
  }

  // one frame: the driving pose (paws on the wheel, turning it), any move laid over it, then the rig
  update(dt, o){
    const t = o.t, c = basePose(), g = {}, a = -o.steer * .7, sp = o.speed ?? .6;
    // paws on the wheel at ten to two: the rim's real points, carried into the body's own space, so they hold on as it turns
    if (o.wheel) { this.root.updateMatrixWorld(true); o.wheel.updateMatrixWorld(true); }
    for (const [side, ang] of [['L', Math.PI * .86], ['R', Math.PI * .14]]) {
      let tp;
      if (o.wheel) { this.tq.set(Math.cos(ang) * o.wheelR, Math.sin(ang) * o.wheelR, 0); o.wheel.localToWorld(this.tq); this.torso.worldToLocal(this.tq); tp = [this.tq.x, this.tq.y, this.tq.z]; }
      else { const q = ang + a; tp = [WHEEL[0] + Math.cos(q) * WR, WHEEL[1] + Math.sin(q) * WR, WHEEL[2]]; }
      c[side] = H(tp, [side === 'L' ? -1 : 1, -.7, -.2]);
    }
    // alive at the wheel: the head bobs to the engine, leans into turns and glances about; the body sways with the corners
    const bob = Math.sin(t * 9) * .025 * sp, glance = Math.sin(t * .7) * Math.sin(t * .31) * .35 + (o.look || 0);
    c.head = [.02 + bob, o.steer * .3 + glance, -o.steer * .14 + Math.sin(t * 1.7) * .03];
    c.body = [.14 + (o.boost ? -.12 : 0) + bob * .5, -o.steer * .12];
    if (o.air && !o.move) { const w = c01(o.air / 1.2); setHs(c, UPV, w); c.kickR = w; c.head[0] -= .12 * w; }   // arms up on the jumps
    if (o.hit) { setHs(c, CHEEK, 1); c.head = [.1, Math.sin(t * 40) * .3, Math.sin(t * 31) * .2]; }
    const p = o.u ?? 0, s = o.side || 1;
    switch (o.move) {
      case 'pop': {   // crouch, spring up out of the seat, spin, arms up, drop back in with a squash
        const cr = pl(p, 0, .12, .16, .26); setHs(c, BACK, cr); g.sy = 1 - .1 * cr;
        const up = pl(p, .2, .3, .72, .86); c.sit = 1 - up; setHs(c, UPV, pl(p, .2, .34, .6, .8)); c.kickL = c.kickR = .6 * up;
        g.y = arc(p, .18, .86, 1.5); g.ry = TAU * eio(seg(p, .26, .78));
        const ld = seg(p, .86, 1); g.sy = (g.sy || 1) * (1 - .12 * bell(ld));
        break;
      }
      case 'flip': {  // a backflip clear of the seat
        const cr = pl(p, 0, .1, .14, .22); setHs(c, BACK, cr); g.sy = 1 - .1 * cr;
        const air = pl(p, .18, .28, .74, .86); setHs(c, TUCK, air); c.legs = [.9 * air, 0, .9 * air, 0];
        g.y = arc(p, .16, .88, 1.9); g.rx = -TAU * eio(seg(p, .22, .8)); setHs(c, TA, pl(p, .8, .9, .95, 1) * .7);
        break;
      }
      case 'taunt': { // turn right round in the seat and laugh at whoever's behind, one paw waving
        const k = pl(p, 0, .15, .78, 1);
        c.head = lerpA(c.head, [-.06, s * 2.4, .26 * s], k); g.ry = s * .55 * k;
        setH(c, s > 0 ? 'L' : 'R', s > 0 ? WAVE : mir(WAVE), k);
        const wav = Math.sin(p * TAU * 4) * .14 * k; (s > 0 ? c.L : c.R).t[0] += wav;
        g.y = Math.abs(Math.sin(p * TAU * 3)) * .08 * k; c.body[1] += Math.sin(p * TAU * 3) * .06 * k;
        break;
      }
      case 'cheer': { // standing on the seat, arms up, bouncing
        c.sit = .2; const b = Math.abs(Math.sin(t * 6)); g.y = .15 + b * .35; g.sy = 1 - .06 * (1 - b);
        setH(c, 'L', Math.sin(t * 6) > 0 ? UPV : TA, 1); setH(c, 'R', mir(Math.sin(t * 6) > 0 ? TA : UPV), 1);
        c.kickR = b; c.head = [-.1, Math.sin(t * 2) * .4, Math.sin(t * 3) * .2];
        break;
      }
      case 'wave': {  // a wave at you: one paw up by the head, waving, head tilted
        const k = pl(p, 0, .12, .82, 1); setH(c, 'R', mir(WAVE), k); c.R.t[0] += Math.sin(p * TAU * 4) * .12 * k;
        c.head = lerpA(c.head, [-.04, -.1, .22], k); c.kickL = .5 * k;
        break;
      }
      case 'nod': { const k = pl(p, 0, .15, .8, 1); c.head[0] += Math.sin(p * TAU * 2.5) * .18 * k; c.head[2] += .1 * k; break; }
      case 'sad': {   // slumped in the seat, head down, arms limp, a slow shake of the head
        const k = pl(p, 0, .03, .98, 1) || 1;
        setHs(c, HANG, k); c.head = [.38, Math.sin(t * 1.2) * .25, .12]; c.body = [.3, 0]; g.y = -.04;
        break;
      }
      case 'fist': { // a fist pump after a takedown
        const k = pl(p, 0, .15, .7, 1); setH(c, s > 0 ? 'R' : 'L', s > 0 ? mir(FIST) : FIST, k);
        (s > 0 ? c.R : c.L).t[1] += Math.sin(p * TAU * 3) * .08 * k; c.head[0] -= .1 * k;
        break;
      }
    }
    // ease the pose a little so nothing snaps
    const k = Math.min(1, dt * 14), cur = this.cur;
    for (const side of ['L', 'R']) { cur[side] = { t: lerpA(cur[side].t, c[side].t, k), pole: lerpA(cur[side].pole, c[side].pole, k) }; }
    cur.head = lerpA(cur.head, c.head, Math.min(1, dt * 10)); cur.body = lerpA(cur.body, c.body, k);
    cur.sit += (c.sit - cur.sit) * k; cur.kickL += (c.kickL - cur.kickL) * k; cur.kickR += (c.kickR - cur.kickR) * k; cur.legs = lerpA(cur.legs, c.legs, k);
    this.apply(cur, g, t);
  }
}
const Y = new THREE.Vector3(0, 1, 0);
export { mesh, rbox, blob, cap, smin, smax };
