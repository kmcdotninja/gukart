// The vehicle studio: one vehicle with Buddy at the wheel, seen from four sides at once, and a list of any part that
// reaches into his head. Open /studio.html?v=kart (or buggy, monster, muscle). Used to design the vehicles.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildTextures, setAniso } from './textures.js';
import { makeKart, RACERS, ENV, VEHICLES, clearance, setFace } from './buddy.js';

const type = new URLSearchParams(location.search).get('v') || 'kart';
const bar = document.getElementById('bar');
bar.innerHTML =
  Object.keys(VEHICLES)
    .map(v => `<a href="?v=${v}" class="${v === type ? 'on' : ''}">${v.toUpperCase()}</a>`)
    .join('') + '<span id="hits"></span>';
const canvas = document.getElementById('c');
const R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(devicePixelRatio);
R.shadowMap.enabled = true;
setAniso(8);
ENV.tex = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a2346');
scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3550', 1.6));
const key = new THREE.DirectionalLight('#fff1dd', 3);
key.position.set(5, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
scene.add(key);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#3d4049', roughness: 0.9 }),
);
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(40, 40, '#55607f', '#2c3352'));
const tex = buildTextures();
const k = makeKart(RACERS[0], tex, 16, type);
k.root.traverse(o => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(k.root);
for (let i = 0; i < 60; i++) k.robot.update(0.05, { t: 1, steer: 0, wheel: k.wheelRing, wheelR: k.wheelR, speed: 0.4 });
setFace(k, 'happy');
if (new URLSearchParams(location.search).has('gun')) k.gun.visible = true; // ?gun shows the weapon mount
if (new URLSearchParams(location.search).has('shield'))
  import('./race.js').then(({ shieldBubble }) => {
    shieldBubble(k).material.uniforms.uT.value = 1.3;
    draw();
  }); // ?shield shows the shield bubble
const hits = clearance(k);
document.getElementById('hits').textContent = hits.length
  ? `${hits.length} part(s) touching Buddy's head: ${hits.join(' | ')}`
  : 'clear: nothing touches Buddy';
window.__hits = hits;
window.__dbg = () => {
  const out = [];
  k.root.traverse(o => {
    if (o.isMesh && o.material.type === 'MeshPhysicalMaterial') {
      const bb = new THREE.Box3().setFromObject(o);
      out.push(
        o.geometry.attributes.position.count +
          ' verts, visible ' +
          o.visible +
          ', mat ' +
          o.material.type +
          ' opacity ' +
          o.material.opacity +
          ' color ' +
          o.material.color?.getHexString() +
          ' box ' +
          bb.min.toArray().map(v => v.toFixed(1)) +
          ' ' +
          bb.max.toArray().map(v => v.toFixed(1)),
      );
    }
  });
  return out;
};
const box = new THREE.Box3().setFromObject(k.root),
  c = box.getCenter(new THREE.Vector3()),
  sz = box.getSize(new THREE.Vector3()),
  d = Math.max(sz.x, sz.y, sz.z) * 1.7;
const views = [
  ['FRONT 3/4', [c.x + d * 0.6, c.y + d * 0.35, c.z + d * 0.8]],
  ['SIDE', [c.x + d * 1.05, c.y + d * 0.12, c.z]],
  ['REAR 3/4', [c.x - d * 0.55, c.y + d * 0.45, c.z - d * 0.8]],
  ['LOW (wheels)', [c.x + d * 0.75, c.y * 0.25, c.z + d * 0.45]],
];
const cams = views.map(([n, p]) => {
  const cm = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  cm.position.set(...p);
  cm.lookAt(n.startsWith('LOW') ? new THREE.Vector3(c.x, c.y * 0.55, c.z) : c);
  return cm;
});
const labels = views.map(([n]) => {
  const l = document.createElement('div');
  l.className = 'lbl';
  l.textContent = n;
  document.body.append(l);
  return l;
});
function draw() {
  const w = innerWidth,
    h = innerHeight;
  R.setSize(w, h, false);
  R.setScissorTest(true);
  cams.forEach((cm, i) => {
    const x = ((i % 2) * w) / 2,
      y = i < 2 ? h / 2 : 0;
    cm.aspect = w / 2 / (h / 2);
    cm.updateProjectionMatrix();
    R.setViewport(x, y, w / 2, h / 2);
    R.setScissor(x, y, w / 2, h / 2);
    R.render(scene, cm);
    labels[i].style.left = x + 12 + 'px';
    labels[i].style.top = h - y - h / 2 + 52 + 'px';
  });
}
addEventListener('resize', draw);
draw();
