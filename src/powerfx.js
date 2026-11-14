// The special powers' effects, shared by the Vehicle Studio (src/studio.js) and the race (src/powers-race.js), so a
// power looks the same in both: the Roadster's thrusters, the Kart's vapour cone and shock diamonds, the Vintage's beach
// balls, the Raider's boom and claw, the Brute's cannon and its cannonballs, and the soft sprite every puff of smoke,
// sand, spray and fire is made of. Each is built by a function and placed by whoever uses it.
import * as THREE from 'three';

// a soft round sprite (smoke, dust, spray, fire)
export const puffT = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

// a vertical fade, bright at the top to nothing at the bottom, for the thrusters' jets
const fadeTex = (() => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();

// the Roadster's four thrusters, hidden under the car: a nozzle at each corner of the floor that drops out and fires a
// jet straight down (a hot core inside a soft pink column). Added to the car's root; returns [{ g, core, jet }]
// the car's own box, as if it stood at the origin facing +z (wherever it is in the world right now)
export function localBox(root) {
  const p = root.position.clone(),
    q = root.quaternion.clone();
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.copy(p);
  root.quaternion.copy(q);
  root.updateMatrixWorld(true);
  return box;
}
// placed from the car's own wheels (one just inside each, tucked up under the floor at axle height), so they sit on
// the body whatever else is attached to the car; without the wheels, from the car's box
export function makeThrusters(root, wheels) {
  const box = localBox(root),
    sz = box.getSize(new THREE.Vector3()),
    metal = new THREE.MeshStandardMaterial({ color: '#2a2e36', metalness: 0.9, roughness: 0.3 }),
    rim = new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 1, roughness: 0.2 }),
    out = [];
  root.updateMatrixWorld(true);
  const spots = wheels?.length
    ? wheels.slice(0, 4).map(w => {
        const p = root.worldToLocal(w.spin.getWorldPosition(new THREE.Vector3()));
        return [p.x * 0.6, p.y + 0.05, p.z * 0.78];
      })
    : [
        [sz.x * 0.3, box.min.y + 0.32, sz.z * 0.3],
        [-sz.x * 0.3, box.min.y + 0.32, sz.z * 0.3],
        [sz.x * 0.3, box.min.y + 0.32, -sz.z * 0.3],
        [-sz.x * 0.3, box.min.y + 0.32, -sz.z * 0.3],
      ];
  for (const [x, y0, z] of spots) {
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.34, 20, 1, true), metal);
    bell.material.side = THREE.DoubleSide;
    bell.position.y = -0.17;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 24).rotateX(Math.PI / 2), rim);
    ring.position.y = -0.34;
    // the jet: a soft column of light (a hot core inside a wider glow), bright at the nozzle and fading as it reaches
    // the ground; 1 m long, stretched to the ground each frame
    const col = (r0, r1, op) =>
      new THREE.Mesh(
        new THREE.CylinderGeometry(r0, r1, 1, 24, 1, true).translate(0, -0.5, 0),
        new THREE.MeshBasicMaterial({
          color: '#ff7ad9',
          map: fadeTex,
          transparent: true,
          opacity: op,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
    const jet = col(0.3, 0.42, 0.75),
      core = col(0.14, 0.2, 1);
    core.material.color.set('#ffe1f6');
    jet.position.y = core.position.y = -0.34;
    g.add(bell, ring, core, jet);
    g.scale.setScalar(0.001);
    root.add(g);
    out.push({ g, core, jet });
  }
  return out;
}

const additive = (color, o = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: o,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
// SUPERSONIC: the vapour cone (the white cloud that wraps a jet at the sound barrier: a cone of mist from the nose back,
// shimmering) and shock diamonds in the exhaust. Returns { vapour, diamonds, mistTex }, both to add to the car
export function makeVapour() {
  const mistTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const v = Math.random();
      x.fillStyle = `rgba(255,255,255,${0.04 + v * 0.1})`;
      x.beginPath();
      x.arc(Math.random() * 128, Math.random() * 64, 2 + v * 6, 0, Math.PI * 2);
      x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const vapour = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 4.2, 48, 6, true).rotateX(-Math.PI / 2).translate(0, 1.1, -0.8),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: mistTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const diamonds = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22 - i * 0.025, 0).scale(1, 1, 2.4),
      additive(i % 2 ? '#ffd9a0' : '#9fe4ff', 0.9),
    );
    d.position.z = -2.3 - i * 0.55;
    diamonds.add(d);
  }
  diamonds.position.y = 0.55;
  diamonds.visible = false;
  return { vapour, diamonds, mistTex };
}

// BEACH BALL: a giant striped beach ball, the i-th of the volley in its own colours (radius 1: scale it)
const ballTex = cols => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  cols.forEach((col, i) => {
    x.fillStyle = col;
    x.fillRect((i * 512) / cols.length, 0, 512 / cols.length + 1, 256);
  });
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 512, 18);
  x.fillRect(0, 238, 512, 18);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const BALL_COLS = [
  ['#e8232b', '#ffffff', '#1f6fe8', '#ffd21f', '#ffffff', '#21b04b'],
  ['#ff7ac2', '#ffffff', '#24c6e0', '#ffffff'],
  ['#ff8a1f', '#ffffff', '#7a3fe0', '#ffffff', '#ffd21f', '#ffffff'],
  ['#21b04b', '#ffd21f', '#e8232b', '#ffffff'],
];
export function makeBall(i) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshStandardMaterial({ map: ballTex(BALL_COLS[i % BALL_COLS.length]), roughness: 0.35 }),
  );
  m.castShadow = true;
  return m;
}

// HARPOON: a heavy telescopic boom (three nested steel sections, yellow on the middle one) with a big claw of two curved
// steel jaws. Returns { boom, set(base, yaw, L) }: at base, turned to yaw, L long, its sections sliding out one inside
// the next and the claw on the end
export function makeBoom() {
  const boom = new THREE.Group(),
    boomParts = [];
  {
    const steel = new THREE.MeshStandardMaterial({ color: '#59606b', metalness: 0.85, roughness: 0.3 }),
      paint = new THREE.MeshStandardMaterial({ color: '#f2b705', metalness: 0.3, roughness: 0.5 }),
      chrome = new THREE.MeshStandardMaterial({ color: '#e8ecf2', metalness: 1, roughness: 0.12 });
    // three sections, each 1 m long along +z (stretched to share the length), thinner as they go
    [0.34, 0.26, 0.19].forEach((r, i) => {
      const sec = new THREE.Mesh(new THREE.BoxGeometry(r * 2, r * 2, 1).translate(0, 0, 0.5), i === 1 ? paint : steel);
      boom.add(sec);
      boomParts.push(sec);
    });
    const claw = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16).rotateZ(Math.PI / 2), steel);
    claw.add(hub);
    for (const sd of [-1, 1]) {
      const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.13, 8, 20, Math.PI * 0.85), chrome);
      jaw.rotation.set(0, sd > 0 ? 0 : Math.PI, Math.PI / 2);
      jaw.position.set(sd * 0.25, 0, 0.55);
      claw.add(jaw);
    }
    boom.add(claw);
    boomParts.push(claw);
  }
  const set = (base, yaw, L) => {
    L = Math.max(0.3, L);
    boom.position.copy(base);
    boom.rotation.set(0, yaw, 0);
    boomParts.forEach((m, i) => {
      if (i < 3) {
        m.position.z = (L / 3) * i * 0.92;
        m.scale.z = L / 3 + 0.25;
      } else m.position.z = L;
    });
  };
  return { boom, set };
}

// CANNON FIRE: a real cannon for the car's weapon mount: a black iron barrel with reinforcing rings, a swelled muzzle and
// the knob at its breech, on trunnions in a wooden carriage bolted to the mount. userData: { barrel, muzzle }
export function makeCannon() {
  const g = new THREE.Group(),
    iron = new THREE.MeshStandardMaterial({ color: '#1f2228', metalness: 0.8, roughness: 0.42 }),
    wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.8 }),
    bolt = new THREE.MeshStandardMaterial({ color: '#9aa1ab', metalness: 1, roughness: 0.3 });
  // the barrel: a lathe profile from the breech knob to the swelled muzzle, along +z
  const prof = [
    [0, -0.95],
    [0.1, -0.95],
    [0.12, -0.88],
    [0.07, -0.82],
    [0.24, -0.78],
    [0.3, -0.7],
    [0.3, -0.55],
    [0.27, -0.5],
    [0.27, -0.2],
    [0.24, -0.15],
    [0.22, 0.6],
    [0.25, 0.66],
    [0.25, 0.72],
    [0.21, 0.76],
    [0.24, 0.86],
    [0.27, 0.95],
    [0.16, 0.95],
    [0.16, 0.6],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 28).rotateX(Math.PI / 2), iron);
  barrel.position.y = 0.42;
  barrel.castShadow = true;
  const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.72, 12).rotateZ(Math.PI / 2), iron);
  trunnion.position.set(0, 0.42, -0.1);
  // the carriage: two cheeks of timber, iron straps over the trunnions, a bed bolted down to the mount
  for (const sx of [-0.3, 0.3]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 1.1), wood);
    cheek.position.set(sx, 0.2, -0.2);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), iron);
    strap.position.set(sx, 0.43, -0.1);
    g.add(cheek, strap);
  }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.1), wood);
  bed.position.set(0, 0, -0.2);
  for (const [bx, bz] of [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, -0.65],
    [0.25, -0.65],
  ]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), bolt);
    b.position.set(bx, 0.07, bz);
    g.add(b);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.42, 1.0);
  g.add(barrel, trunnion, bed, muzzle);
  g.userData = { barrel, muzzle };
  return g;
}

// an iron cannonball
export function makeCannonball() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 20, 14),
    new THREE.MeshStandardMaterial({ color: '#1d2026', metalness: 0.7, roughness: 0.4 }),
  );
  m.castShadow = true;
  return m;
}
