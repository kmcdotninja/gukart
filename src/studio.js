// The vehicle studio: one vehicle with Buddy at the wheel, seen from four sides at once, and a list of any part that
// reaches into his head. Open /studio.html?v=kart (or any other vehicle: the bar across the top lists them). Drag in a
// view to turn it, scroll to move in and out, double-click to put it back. Used to design the vehicles.
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
// each view turns about its own target: drag to rotate it, the wheel to move in and out, double-click (or its RESET) to
// put it back where it started. RESET ALL in the bar puts all four back.
const cams = views.map(([n, p]) => {
  const cm = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  cm.userData.target = n.startsWith('LOW') ? new THREE.Vector3(c.x, c.y * 0.55, c.z) : c.clone();
  cm.userData.home = new THREE.Vector3(...p);
  cm.position.copy(cm.userData.home);
  cm.lookAt(cm.userData.target);
  return cm;
});
const resetView = i => {
  cams[i].position.copy(cams[i].userData.home);
  cams[i].lookAt(cams[i].userData.target);
  draw();
};
const labels = views.map(([n], i) => {
  const l = document.createElement('div');
  l.className = 'lbl';
  l.innerHTML = `${n} <button title="Put this view back">RESET</button>`;
  l.querySelector('button').addEventListener('click', () => resetView(i));
  document.body.append(l);
  return l;
});
{
  const all = document.createElement('button');
  all.id = 'resetAll';
  all.textContent = 'RESET ALL';
  all.addEventListener('click', () => cams.forEach((_, i) => resetView(i)));
  bar.insertBefore(all, document.getElementById('hits'));
  const viewAt = e => (e.clientX < innerWidth / 2 ? 0 : 1) + (e.clientY < innerHeight / 2 ? 0 : 2);
  const sph = new THREE.Spherical(),
    off = new THREE.Vector3();
  let drag = -1,
    lx = 0,
    ly = 0;
  // move view i's camera round its target by (dx, dy) pixels, and in or out by `zoom`
  const orbit = (i, dx, dy, zoom = 1) => {
    const cm = cams[i],
      t = cm.userData.target;
    sph.setFromVector3(off.copy(cm.position).sub(t));
    sph.theta -= dx * 0.008;
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi - dy * 0.008));
    sph.radius = Math.min(d * 4, Math.max(d * 0.15, sph.radius * zoom));
    cm.position.copy(t).add(off.setFromSpherical(sph));
    cm.lookAt(t);
    draw();
  };
  canvas.addEventListener('pointerdown', e => {
    drag = viewAt(e);
    lx = e.clientX;
    ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (drag < 0) return;
    orbit(drag, e.clientX - lx, e.clientY - ly);
    lx = e.clientX;
    ly = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => (drag = -1));
  canvas.addEventListener('dblclick', e => resetView(viewAt(e)));
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      orbit(viewAt(e), 0, 0, Math.exp(e.deltaY * 0.0012));
    },
    { passive: false },
  );
}
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
