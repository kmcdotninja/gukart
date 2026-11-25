// The Vehicle Studio's DESIGN view: the vehicle on its own (no Buddy), seen from four sides at once on a grid floor,
// the way the vehicles were designed. It draws into the studio's own stage with the studio's own renderer, so DRIVE
// and DESIGN are one page: flip between them and the same vehicle stays. Drag in a view to turn it, scroll to move in
// and out, double-click (or its RESET) to put it back; RESET ALL puts all four back.
import * as THREE from 'three';
import { makeKart, RACERS } from './buddy.js';

const VIEWS = [
  ['FRONT 3/4', (c, d) => [c.x + d * 0.6, c.y + d * 0.35, c.z + d * 0.8]],
  ['SIDE', (c, d) => [c.x + d * 1.05, c.y + d * 0.12, c.z]],
  ['REAR 3/4', (c, d) => [c.x - d * 0.55, c.y + d * 0.45, c.z - d * 0.8]],
  ['LOW', (c, d) => [c.x + d * 0.75, c.y * 0.25, c.z + d * 0.45]],
];

export function createDesign({ R, canvas, host, tex }) {
  // the room: the studio's navy, a floor with a grid, the same kind of light
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1028');
  scene.fog = new THREE.Fog('#0a1028', 14, 40); // the floor fades into the room, no edge
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2440', 1.6));
  const key = new THREE.DirectionalLight('#fff1dd', 3);
  key.position.set(5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6fa0ff', 1.6);
  rim.position.set(-6, 4, -8);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#141c3c', roughness: 0.95 }),
  );
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(200, 200, '#3d5aa8', '#1f2c5c');
  grid.position.y = 0.002;
  scene.add(grid);

  // the four views, each its own cell over the stage, with its name and a RESET in the studio's own look
  const pad = document.createElement('div');
  pad.className = 'dpad';
  pad.innerHTML =
    VIEWS.map(([n], i) => `<div class="dcell" data-i="${i}"><div class="tag"><span>${n}</span><i></i><i></i></div><button class="dreset" data-i="${i}">RESET</button></div>`).join('') +
    '<button class="dresetall">RESET ALL</button>';
  host.append(pad);

  let k = null,
    cams = [],
    d = 1;
  const sph = new THREE.Spherical(),
    off = new THREE.Vector3();

  function setVehicle(type) {
    if (k) scene.remove(k.root);
    k = makeKart(RACERS[0], tex, 16, type);
    k.robot.root.removeFromParent(); // the car on its own, so it can be seen whole
    k.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(k.root);
    const box = new THREE.Box3().setFromObject(k.root),
      c = box.getCenter(new THREE.Vector3()),
      sz = box.getSize(new THREE.Vector3());
    d = Math.max(sz.x, sz.y, sz.z) * 1.7;
    cams = VIEWS.map(([n, at]) => {
      const cm = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
      cm.userData.target = n === 'LOW' ? new THREE.Vector3(c.x, c.y * 0.55, c.z) : c.clone();
      cm.userData.home = new THREE.Vector3(...at(c, d));
      cm.position.copy(cm.userData.home);
      cm.lookAt(cm.userData.target);
      return cm;
    });
  }

  const resetView = i => {
    cams[i].position.copy(cams[i].userData.home);
    cams[i].lookAt(cams[i].userData.target);
  };
  // move view i round its target by (dx, dy) pixels, and in or out by `zoom`
  const orbit = (i, dx, dy, zoom = 1) => {
    const cm = cams[i],
      t = cm.userData.target;
    sph.setFromVector3(off.copy(cm.position).sub(t));
    sph.theta -= dx * 0.008;
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi - dy * 0.008));
    sph.radius = Math.min(d * 4, Math.max(d * 0.15, sph.radius * zoom));
    cm.position.copy(t).add(off.setFromSpherical(sph));
    cm.lookAt(t);
  };

  let drag = -1,
    lx = 0,
    ly = 0;
  const cellOf = e => {
    const c = e.target.closest('.dcell');
    return c ? Number(c.dataset.i) : -1;
  };
  pad.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    drag = cellOf(e);
    lx = e.clientX;
    ly = e.clientY;
    if (drag >= 0) pad.setPointerCapture(e.pointerId);
  });
  pad.addEventListener('pointermove', e => {
    if (drag < 0) return;
    orbit(drag, e.clientX - lx, e.clientY - ly);
    lx = e.clientX;
    ly = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, () => (drag = -1));
  pad.addEventListener('dblclick', e => {
    const i = cellOf(e);
    if (i >= 0) resetView(i);
  });
  pad.addEventListener(
    'wheel',
    e => {
      const i = cellOf(e);
      if (i < 0) return;
      e.preventDefault();
      orbit(i, 0, 0, Math.exp(e.deltaY * 0.0012));
    },
    { passive: false },
  );
  pad.addEventListener('click', e => {
    const b = e.target.closest('.dreset');
    if (b) resetView(Number(b.dataset.i));
    if (e.target.closest('.dresetall')) cams.forEach((_, i) => resetView(i));
  });

  // each frame: the four views side by side in the stage, a thin line of the page between them
  function draw() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight,
      pr = R.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) R.setSize(w, h, false);
    const g = 3,
      cw = (w - g) / 2,
      ch = (h - g) / 2;
    R.setScissorTest(true);
    R.setClearColor('#060a1c');
    R.clear();
    cams.forEach((cm, i) => {
      const x = (i % 2) * (cw + g),
        y = i < 2 ? ch + g : 0;
      cm.aspect = cw / ch;
      cm.updateProjectionMatrix();
      R.setViewport(x, y, cw, ch);
      R.setScissor(x, y, cw, ch);
      R.render(scene, cm);
    });
    R.setScissorTest(false);
    R.setViewport(0, 0, w, h);
  }

  return {
    setVehicle,
    draw,
    show(on) {
      pad.style.display = on ? '' : 'none';
    },
  };
}
