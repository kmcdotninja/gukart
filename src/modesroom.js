// The room behind the mode cards: the Kano underpass, the same lit bore you drive through in the race. Panelled
// concrete walls with the blue LED strip at wheel height, steel ribs with a light bar in each, a two-lane road with its
// dashes and orange edges, and the warm Kano evening glowing in the mouth at the far end. A still view.
import * as THREE from 'three';
import { canvasTex } from './textures.js';

const RIB = 8,
  LEN = 140,
  W = 14,
  H = 7.5; // rib spacing, tunnel length, inner width and height (metres)

export class ModesRoom {
  constructor() {
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color('#05081a');
    S.fog = new THREE.Fog('#0b1330', 40, 170);
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    S.add(new THREE.HemisphereLight('#8ea2e6', '#1a2244', 1.7));

    // the road: dark asphalt, white dashes down the middle, orange lines at both edges
    const roadT = canvasTex(
      256,
      512,
      (x, w, h) => {
        x.fillStyle = '#1b2031';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
          const g = 20 + Math.random() * 30;
          x.fillStyle = `rgba(${g},${g + 4},${g + 16},.5)`;
          x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        x.fillStyle = '#ff6a00';
        x.fillRect(10, 0, 8, h);
        x.fillRect(w - 18, 0, 8, h);
        x.fillStyle = '#e9eefc';
        x.fillRect(w / 2 - 4, 0, 8, h * 0.45);
      },
      { repeat: true },
    );
    roadT.repeat.set(1, LEN / RIB / 1.5);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(W, LEN).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.55, metalness: 0.15 }),
    );
    road.position.z = -LEN / 2 + 10;
    S.add(road);

    // the walls: big concrete panels with their joints
    const wallT = canvasTex(
      512,
      256,
      (x, w, h) => {
        x.fillStyle = '#3a4672';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 2; j++) {
            x.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
            x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
          }
        x.strokeStyle = 'rgba(6,9,24,.75)';
        x.lineWidth = 5;
        for (let i = 0; i <= 4; i++) {
          x.beginPath();
          x.moveTo(i * 128, 0);
          x.lineTo(i * 128, h);
          x.stroke();
        }
        x.beginPath();
        x.moveTo(0, 128);
        x.lineTo(w, 128);
        x.stroke();
      },
      { repeat: true },
    );
    wallT.repeat.set(LEN / 16, 1);
    const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.85 });
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(LEN, H), wallM);
      wall.rotation.y = (-sx * Math.PI) / 2;
      wall.position.set((sx * W) / 2, H / 2, -LEN / 2 + 10);
      S.add(wall);
      // the blue LED strip at wheel height, and the hazard kerb at the foot
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, LEN),
        new THREE.MeshBasicMaterial({ color: '#6fd3ff' }),
      );
      led.position.set(sx * (W / 2 - 0.05), 1.1, -LEN / 2 + 10);
      S.add(led);
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.3, LEN),
        new THREE.MeshStandardMaterial({ color: '#d9dde8', roughness: 0.7 }),
      );
      kerb.position.set(sx * (W / 2 - 0.25), 0.15, -LEN / 2 + 10);
      S.add(kerb);
    }
    // the ceiling, flat and dark
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(W, LEN).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#0d1122', roughness: 0.9 }),
    );
    ceil.position.set(0, H, -LEN / 2 + 10);
    S.add(ceil);

    // the ribs: steel frames every RIB metres, each with a white light bar overhead
    const steel = new THREE.MeshStandardMaterial({ color: '#141c3a', roughness: 0.5, metalness: 0.6 }),
      bar = new THREE.MeshBasicMaterial({ color: '#fff3dc' });
    const legG = new THREE.BoxGeometry(0.5, H, 0.5),
      beamG = new THREE.BoxGeometry(W, 0.45, 0.5),
      barG = new THREE.BoxGeometry(3.2, 0.1, 0.3);
    for (let z = 0; z > -LEN + 10; z -= RIB) {
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(legG, steel);
        l.position.set(sx * (W / 2 - 0.25), H / 2, z);
        S.add(l);
      }
      const b = new THREE.Mesh(beamG, steel);
      b.position.set(0, H - 0.22, z);
      S.add(b);
      const lb = new THREE.Mesh(barG, bar);
      lb.position.set(0, H - 0.5, z);
      S.add(lb);
    }
    // a few lights down the bore so the road and walls catch light in pools
    for (let z = -4; z > -120; z -= 16) {
      const p = new THREE.PointLight('#ffe6c4', 60, 30, 1.5);
      p.position.set(0, H - 1, z);
      S.add(p);
    }

    // the mouth: Kano's warm evening at the far end
    const sky = canvasTex(64, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffcf8a');
      g.addColorStop(0.6, '#ff8a3d');
      g.addColorStop(1, '#ffb070');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    });
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: sky, fog: false }));
    mouth.position.set(0, H / 2, -LEN + 10.5);
    S.add(mouth);
    this.t = 0;
  }
  // a still view down the bore: it's drawn once when the screen opens (and again on a resize), never animated
  resize(aspect) {
    this.cam.aspect = aspect;
    this.cam.fov = aspect < 1 ? 72 : 56;
    this.cam.updateProjectionMatrix();
    this.cam.position.set(0, 2.4, 4);
    this.cam.lookAt(0, 2.6, -36);
    this.dirty = 4;
  }
  update() {}
}
