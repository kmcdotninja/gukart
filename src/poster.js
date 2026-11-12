// The loader poster: Buddy drifting the monster truck straight at you on the Kano start straight, two racers chasing,
// Kofar Nassarawa behind them. Rendered from the real game scene, then saved as a still (public/loader-*.jpg) so the
// loading screen can show it the instant the page opens. Open /poster.html?f=desk (1920x1080) or ?f=phone (1080x1920);
// window.__poster() returns the JPEG as a data URL. A design tool, like studio.html: not part of the game.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildTextures, setAniso, kanoHorns } from './textures.js';
import { buildTrack, buildRoad, buildForks, buildForkRoads } from './track.js';
import { buildWorld } from './world.js';
import { makeKart, RACERS, ENV, setFace, DEFAULT_CUSTOM } from './buddy.js';
import { CHAPTERS } from './chapters.js';

const fmt = new URLSearchParams(location.search).get('f') || 'desk';
const [PW, PH] = fmt === 'phone' ? [1080, 1920] : [1920, 1080];
const gl = document.getElementById('gl'),
  out = document.getElementById('out');
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
R.setPixelRatio(1);
R.setSize(PW, PH, false);
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.NeutralToneMapping;
R.toneMappingExposure = 1.18;
setAniso(Math.min(8, R.capabilities.getMaxAnisotropy()));
ENV.tex = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;

// the game's own light and haze, the sun a little lower and warmer: late afternoon
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#efd2a8', 120, 1500);
scene.add(new THREE.HemisphereLight('#e2efff', '#b08a60', 1.9));
const fill = new THREE.DirectionalLight('#fff4e6', 1.5);
scene.add(fill, fill.target); // from the camera's side, so tyres and faces read
const sun = new THREE.DirectionalLight('#ffd49a', 3.9);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.camera.layers.enableAll(); // the vehicles (layer 1) still throw their shadows onto the road in the background pass
scene.add(sun, sun.target);

console.log('poster: textures');
const tex = buildTextures();
const track = buildTrack(CHAPTERS[0].track());
track.forks = buildForks(track);
buildRoad(scene, track, tex);
buildForkRoads(scene, track, tex);
const world = buildWorld(scene, track, tex, { low: false });
world.sky.visible = false; // the sky is painted in the composite instead console.log('poster: world');

// the cast, all on layer 1 so the two passes can split them from the world
const shot = new URLSearchParams(location.search).get('shot') || 'drift',
  phone = fmt === 'phone';
const F = track.newFrame(),
  at = (s, lat, h = 0) => {
    track.frame(s, F);
    return {
      p: F.p.clone().addScaledVector(F.l, lat).addScaledVector(F.u, h),
      head: Math.atan2(F.t.x, F.t.z),
      t: F.t.clone(),
      l: F.l.clone(),
    };
  };
function racer(
  def,
  type,
  s,
  lat,
  yaw,
  steer,
  expr,
  { h = 0, pitch = 0, roll = 0, custom = DEFAULT_CUSTOM[type] } = {},
) {
  const k = makeKart(def, tex, 16, type, {
    ...custom,
    paint: def.kart && type !== 'monster' ? def.kart : custom.paint,
  });
  const q = at(s, lat, h);
  k.root.position.copy(q.p);
  k.root.rotation.set(pitch, q.head + yaw, roll, 'YXZ');
  for (const p of k.steer || []) p.rotation.y = steer;
  for (let i = 0; i < 60; i++)
    k.robot.update(0.05, {
      t: 1 + i * 0.05,
      steer: -steer * 1.4,
      wheel: k.wheelRing,
      wheelR: k.wheelR,
      speed: 1,
      boost: true,
      air: h > 1 ? 1 : 0,
    });
  setFace(k, expr);
  for (const w of k.wheels) w.spin.rotation.x = Math.random() * 6;
  // poster only: rubber a shade lighter than in the game, so the tread reads in a still instead of a black blob
  k.root.traverse(o => {
    if (o.isMesh && o.material?.bumpMap && o.material.roughness >= 0.85) {
      o.material = o.material.clone();
      o.material.color.setScalar(2.6);
      o.material.envMapIntensity = 0.7;
    }
  }); // the tread texture is near-black; lift it
  k.root.traverse(o => {
    o.layers.set(1);
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(k.root);
  return k;
}
const puff = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

// fire off the rear tyres of a drifting vehicle, at its real wheels whichever way it faces. The flames are textures grown
// from turbulence noise (ragged tongues, white-yellow at the root, orange, then red going transparent), licking up from
// the road round the tyre; a hot pool of light on the asphalt under them, grey smoke rising above, embers thrown out
const NOI = (() => {
  const hash = (x, y, s) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const n = (x, y, s) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    return (
      (hash(xi, yi, s) * (1 - u) + hash(xi + 1, yi, s) * u) * (1 - v) +
      (hash(xi, yi + 1, s) * (1 - u) + hash(xi + 1, yi + 1, s) * u) * v
    );
  };
  return (x, y, s) =>
    n(x, y, s) * 0.5 +
    n(x * 2.03, y * 2.03, s) * 0.25 +
    n(x * 4.1, y * 4.1, s) * 0.125 +
    n(x * 8.3, y * 8.3, s) * 0.0625;
})();
const fireTex = [1, 2, 3, 4].map(seed => {
  const W = 128,
    H = 256,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d'),
    im = x.createImageData(W, H);
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const u = px / W - 0.5,
        v = 1 - py / H; // v: 0 at the root, 1 at the tip
      const turb = NOI(px / 22, py / 26 + seed * 3, seed),
        sway = (NOI(v * 3, seed * 7, seed + 9) - 0.5) * 0.5 * v;
      const width = (0.42 - v * 0.34) * (0.7 + turb * 0.8); // narrowing upward, ragged
      let f = 1 - Math.abs(u - sway) / Math.max(0.01, width);
      f *= (1 - v * 0.85) * (0.55 + turb * 0.9);
      f = Math.max(0, Math.min(1, (f - 0.18) / 0.6));
      if (f <= 0) continue;
      const r = 255,
        g = Math.min(255, 70 + f * 230),
        b = Math.min(255, f > 0.75 ? (f - 0.75) * 900 : 0),
        q = (py * W + px) * 4;
      im.data[q] = r;
      im.data[q + 1] = g;
      im.data[q + 2] = b;
      im.data[q + 3] = Math.min(255, f * 330);
    }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,120,1)');
  g.addColorStop(0.4, 'rgba(255,120,30,.5)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function tyreFire(k, type) {
  const V = {
    monster: [1.6, 1.8, 1.28, 0.68],
    kart: [0.62, 1.26, 0.42, 0.3],
    buggy: [0.75, 1.5, 0.7, 0.31],
    muscle: [0.8, 1.62, 0.7, 0.35],
    rail: [2, 2.4, 1.25, 0.65],
    raider: [2.18, 1.9, 1.15, 0.52],
    roadster: [2.22, 2.05, 1.08, 0.5],
    brute: [2.05, 1.62, 1.25, 0.58],
  }[type]; // [half track, half wheelbase, tyre radius, half tyre width]
  k.root.updateMatrixWorld(true);
  const back = new THREE.Vector3(0, 0, -1).transformDirection(k.root.matrixWorld);
  for (const sx of [-1, 1]) {
    const hub = k.root.localToWorld(new THREE.Vector3(sx * V[0], V[2], -V[1])),
      side = new THREE.Vector3(sx, 0, 0).transformDirection(k.root.matrixWorld);
    const ground = hub.clone();
    ground.y -= V[2] - 0.05;
    // the flames: tongues along the outer wall of the tyre from just ahead of where it meets the road to behind it, and a
    // few low and wide at the contact patch itself, so they read from the front
    const half = V[3];
    for (let i = 0; i < 16; i++) {
      const t = i / 15,
        along = -0.9 + t * 3.2,
        out = half * (0.85 + Math.random() * 0.5) + (t > 0.6 ? (t - 0.6) * 1.5 : 0),
        h = (2.2 + Math.random() * 2.4) * (1 - Math.abs(t - 0.35) * 0.6);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: fireTex[i % 4],
          transparent: true,
          opacity: 0.85 + Math.random() * 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      sp.center.set(0.5, 0.04); // anchored at the root, so each tongue rises from where it burns
      sp.position.copy(ground).addScaledVector(back, along).addScaledVector(side, out);
      sp.position.y += Math.random() * 0.25;
      sp.scale.set(h * (0.5 + Math.random() * 0.25), h, 1);
      sp.layers.set(1);
      scene.add(sp);
    }
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: fireTex[(i + 1) % 4],
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      sp.center.set(0.5, 0.04);
      sp.position
        .copy(ground)
        .addScaledVector(back, -0.6 - Math.random() * 0.5)
        .addScaledVector(side, (Math.random() - 0.3) * half * 1.6);
      sp.position.y += 0.02;
      const h = 0.9 + Math.random() * 0.8;
      sp.scale.set(h * 0.9, h, 1);
      sp.layers.set(1);
      scene.add(sp);
    }
    // the heat pooled on the road under the tyre
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        opacity: 0.8,
      }),
    );
    pool.position.copy(ground).addScaledVector(back, 0.8);
    pool.position.y += 0.08;
    pool.layers.set(1);
    scene.add(pool);
    // smoke rising off the fire: grey-brown, darker low, thinning as it climbs and drifts back
    for (let i = 0; i < 9; i++) {
      const u = i / 8,
        sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: puff,
            color: new THREE.Color().setHSL(0.07, 0.1, 0.35 + u * 0.35),
            transparent: true,
            opacity: 0.45 - u * 0.25,
            depthWrite: false,
            fog: false,
          }),
        );
      sp.position
        .copy(ground)
        .addScaledVector(back, 1.5 + u * 4)
        .addScaledVector(side, u * 1.2);
      sp.position.y += 2.4 + u * 2.6;
      sp.scale.setScalar(2 + u * 4);
      sp.layers.set(1);
      scene.add(sp);
    }
    // embers flung up and out
    for (let i = 0; i < 36; i++) {
      const e = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 6, 4),
        new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? '#ffd27a' : '#ff8a2a', fog: false }),
      );
      e.position
        .copy(ground)
        .addScaledVector(back, Math.random() * 3)
        .addScaledVector(side, Math.random() * 2.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 3.4, 0));
      e.layers.set(1);
      scene.add(e);
    }
    const L = new THREE.PointLight('#ff8a2a', 70, 14, 1.6);
    L.position
      .copy(ground)
      .addScaledVector(back, 0.6)
      .add(new THREE.Vector3(0, 1, 0));
    scene.add(L); // fire light on the road and the truck
  }
}

// race banners on poles either side of the road: Kano red, a gold head bar, our star knot in cream, a swallowtail foot
const bannerTex = (() => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 768;
  const x = c.getContext('2d');
  x.fillStyle = '#d7263d';
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(256, 0);
  x.lineTo(256, 768);
  x.lineTo(128, 660);
  x.lineTo(0, 768);
  x.closePath();
  x.fill();
  x.fillStyle = 'rgba(0,0,0,.12)';
  x.fillRect(0, 0, 18, 768);
  x.fillRect(238, 0, 18, 768);
  x.fillStyle = '#ffc22e';
  x.fillRect(0, 0, 256, 34);
  kanoHorns(x, 128, 290, 190, '#f6e7c8'); // the Kano emblem from the top of Kofar Nassarawa
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function banner(s, lat) {
  const g = new THREE.Group(),
    pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 9, 10),
      new THREE.MeshStandardMaterial({ color: '#3a3f4d', roughness: 0.5, metalness: 0.6 }),
    );
  pole.position.y = 4.5;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.12), pole.material);
  arm.position.set(lat > 0 ? -0.95 : 0.95, 8.8, 0);
  g.add(arm);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 5.1),
    new THREE.MeshLambertMaterial({ map: bannerTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }),
  );
  flag.position.set(lat > 0 ? -1 : 1, 6.2, 0);
  g.add(flag);
  const q = at(s, lat);
  g.position.copy(q.p);
  g.rotation.y = q.head + Math.PI;
  g.traverse(o => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(g);
}
// dust: warm, sunlit clouds of grit kicked up round the tyres, low on the road
function dust(p, n = 18, r = 3) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: puff,
        color: new THREE.Color().setHSL(0.1, 0.95, 0.62 + Math.random() * 0.18),
        transparent: true,
        opacity: 0.45 + Math.random() * 0.25,
        depthWrite: false,
        fog: false,
      }),
    );
    sp.position
      .copy(p)
      .add(new THREE.Vector3((Math.random() - 0.5) * r * 2, 0.3 + Math.random() * 1.4, (Math.random() - 0.5) * r * 2));
    sp.scale.setScalar(0.9 + Math.random() * 1.8);
    sp.layers.set(1);
    scene.add(sp);
  }
}

// each shot: where the cast stands, where the camera stands and looks (all in road terms: metres round the lap, metres
// across, height) and its lens
let S0,
  camAt,
  lookAt,
  fov,
  HERO = null;
if (shot === 'drift') {
  // Buddy throws the monster sideways at you, rear tyres on fire, three rivals alongside
  S0 = 118;
  const fur = new URLSearchParams(location.search).get('fur'); // ?fur=2ec4b6,9bf6ff tries Buddy in another colour (fur, ears)
  const hero = racer(
    fur
      ? { ...RACERS[0], fur: '#' + fur.split(',')[0], ear: '#' + (fur.split(',')[1] || fur.split(',')[0]) }
      : RACERS[0],
    'monster',
    S0,
    0,
    -0.72,
    0.5,
    'happy',
    { roll: 0.04 },
  );
  HERO = hero;
  hero.root.traverse(o => o.layers.set(2)); // Buddy and his truck on a layer of their own, for the cut-out    // the star: big, centred, facing you
  racer(RACERS[3], 'kart', S0 - 5, -8.6, 0.2, -0.12, 'happy');
  racer(RACERS[2], 'buggy', S0 - 10, 8.2, -0.2, 0.15, 'happy');
  racer(RACERS[4], 'muscle', S0 - 16, -4.6, 0.08, 0, 'happy');
  tyreFire(hero, 'monster');
  hero.root.updateMatrixWorld(true);
  for (const x of [-1.6, 1.6]) dust(hero.root.localToWorld(new THREE.Vector3(x, 0, -1.9)), 12, 1.6);
  for (const [bs, bl] of [
    [S0 - 22, -15.5],
    [S0 - 25, 15.5],
    [S0 - 44, -15.5],
    [S0 - 47, 15.5],
  ])
    banner(bs, bl);
  camAt = phone ? [S0 + 13.5, 1.6, 2.4] : [S0 + 11.5, 2.6, 1.7];
  lookAt = phone ? [S0 - 4, 0, 2.8] : [S0 - 4, -0.2, 2.3];
  fov = phone ? 66 : 46;
} else if (shot === 'pack') {
  // three abreast, all flat out, nose to nose: who blinks first
  S0 = 125;
  racer(RACERS[0], 'kart', S0, 0, 0, 0, 'happy');
  racer(RACERS[4], 'muscle', S0 - 2.5, -6, 0.05, -0.05, 'happy');
  racer(RACERS[1], 'monster', S0 - 3.5, 6.2, -0.06, 0.05, 'happy');
  racer(RACERS[2], 'buggy', S0 - 16, 2.5, 0, 0, 'happy');
  camAt = phone ? [S0 + 12, 0, 2.2] : [S0 + 10, 0.5, 1.1];
  lookAt = phone ? [S0 - 4, 0, 2.2] : [S0 - 4, 0, 1.6];
  fov = phone ? 66 : 44;
} else if (shot === 'chase') {
  // over Buddy's shoulder as he dives through Kofar Nassarawa, a rival right on him
  S0 = 64;
  racer(RACERS[0], 'kart', S0, -1.5, -0.1, 0.12, 'happy');
  racer(RACERS[5], 'monster', S0 + 9, 5, 0.05, -0.05, 'happy');
  racer(RACERS[3], 'kart', S0 + 17, -4, 0, 0, 'happy');
  camAt = phone ? [S0 - 7, 3, 1.6] : [S0 - 6.5, 3.6, 1];
  lookAt = phone ? [S0 + 12, -1.5, 3.6] : [S0 + 12, -1.5, 2.6];
  fov = phone ? 60 : 40;
} else {
  // 'air': Buddy launched off the kicker over the canal, the city laid out below
  const kk = track.kickers[0];
  S0 = kk.gap[0] + 6;
  racer(RACERS[0], 'buggy', S0, 0, -0.35, 0.1, 'happy', { h: 4.2, pitch: 0.22, roll: -0.1 });
  racer(RACERS[3], 'kart', S0 - 14, -4, 0, 0, 'happy', { h: 1.2, pitch: -0.12 });
  camAt = phone ? [S0 + 11, 4, 2.6] : [S0 + 10, 6, 2.2];
  lookAt = phone ? [S0 - 1, 0, 5] : [S0 - 1, 0, 4.4];
  fov = phone ? 62 : 44;
}
const cam = new THREE.PerspectiveCamera(fov, PW / PH, 0.3, 7000); // past the sky dome (3000), or its far side is clipped
const c0 = at(...camAt).p,
  look = at(...lookAt).p;
cam.position.copy(c0);
cam.lookAt(look);
{
  const fp = at(S0, 0).p,
    toCam = c0.clone().sub(fp).setY(0).normalize(),
    side = new THREE.Vector3(-toCam.z, 0, toCam.x);
  sun.position.copy(fp).addScaledVector(toCam, 90).addScaledVector(side, -60).setY(140);
  sun.target.position.copy(fp); // high, behind the camera's left shoulder
  fill.position.copy(c0).setY(c0.y + 4);
  fill.target.position.copy(fp).setY(1.5);
}

// the sky: the game's own dome
scene.background = null;

// a painted sky: deep blue overhead to pale at the horizon, then cumulus clouds painted pixel by pixel. Each cloud is a
// bank of soft lobes (wide and flat along the base, smaller heaped on top) whose density is broken up by noise at the
// edge, cut flat and soft underneath, and lit from the sun's side: bright rims facing it, cool blue-grey in the hollows
function paintSky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, PH * 0.62);
  g.addColorStop(0, '#1679e6');
  g.addColorStop(0.5, '#46aef6');
  g.addColorStop(1, '#cdeeff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
  const S = 2,
    W2 = Math.ceil(PW / S),
    H2 = Math.ceil((PH * 0.62) / S),
    U = Math.max(PW, PH) / 1920 / S;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hash = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    return (
      (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) +
      (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v
    );
  };
  const fbm = (x, y) =>
    noise(x, y) * 0.5 +
    noise(x * 2.1, y * 2.1) * 0.25 +
    noise(x * 4.3, y * 4.3) * 0.125 +
    noise(x * 8.7, y * 8.7) * 0.0625;
  // the clouds: [centre x, base y (fractions of the frame), width in px at 1920]
  const banks = (
    PW > PH
      ? [
          [0.08, 0.42, 820],
          [0.9, 0.36, 900],
          [0.55, 0.22, 380],
          [0.32, 0.16, 300],
        ]
      : [
          [0.1, 0.3, 760],
          [0.92, 0.26, 700],
          [0.55, 0.14, 360],
        ]
  ).map(([cx, by, w]) => {
    const X = cx * W2,
      Y = (by * PH) / S,
      Wd = w * U,
      lobes = [];
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9 - 0.5;
      lobes.push([X + t * Wd * 0.95, Y - Wd * 0.05, Wd * (0.13 + rnd() * 0.05), Wd * 0.08]);
    } // the flat base row
    for (let i = 0; i < 7; i++) {
      const t = (rnd() - 0.5) * 0.7,
        h = 1 - Math.abs(t) * 1.6;
      lobes.push([
        X + t * Wd,
        Y - Wd * (0.1 + h * 0.14 * (0.6 + rnd() * 0.6)),
        Wd * (0.08 + h * 0.1) * (0.7 + rnd() * 0.5),
        Wd * (0.08 + h * 0.1) * (0.7 + rnd() * 0.5),
      ]);
    } // heaped tops
    return { X, Y, Wd, lobes };
  });
  const dens = (x, y, c) => {
    let d = 0;
    for (const [lx, ly, rx, ry] of c.lobes) {
      const dx = (x - lx) / rx,
        dy = (y - ly) / ry;
      d += Math.exp(-(dx * dx + dy * dy) * 1.6);
    }
    d += (fbm(x / (c.Wd * 0.09), y / (c.Wd * 0.09)) - 0.5) * 0.9; // the ragged, billowing edge
    return d * Math.min(1, Math.max(0, (c.Y + c.Wd * 0.02 - y) / (c.Wd * 0.05)));
  }; // a flat, soft underside
  const img = ctx.getImageData(0, 0, PW, Math.ceil(PH * 0.62)),
    px = img.data,
    sun = [-0.6, -0.8];
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      let best = 0,
        lit = 0,
        yn = 0;
      for (const c of banks) {
        if (Math.abs(x - c.X) > c.Wd * 0.7 || y > c.Y + c.Wd * 0.06 || y < c.Y - c.Wd * 0.45) continue;
        const d = dens(x, y, c);
        if (d <= best) continue;
        const o = c.Wd * 0.025;
        best = d;
        lit = d - dens(x + sun[0] * o, y + sun[1] * o, c);
        yn = (c.Y - y) / (c.Wd * 0.4);
      }
      const a = Math.min(1, Math.max(0, (best - 0.42) / 0.2));
      if (a <= 0) continue;
      const k = Math.min(1, Math.max(0, 0.5 - lit * 1.6 + yn * 0.35)); // 1 = full sun, 0 = shade
      const r = 168 + (255 - 168) * k,
        gg = 188 + (252 - 188) * k,
        b = 222 + (248 - 222) * k; // cool blue-grey up to warm white
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const X = x * S + sx,
            Y = y * S + sy;
          if (X >= PW || Y >= img.height) continue;
          const q = (Y * PW + X) * 4;
          px[q] += (r - px[q]) * a;
          px[q + 1] += (gg - px[q + 1]) * a;
          px[q + 2] += (b - px[q + 2]) * a;
        }
    }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = 'blur(' + (2 * U * S).toFixed(1) + 'px)';
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore(); // soften the pixel steps
}
function render() {
  const ctx = out.getContext('2d');
  out.width = PW;
  out.height = PH;
  paintSky(ctx);
  // pass 1: the world without the cast, the camera slid back along the road a little each time: a motion-blurred street
  const N = 14,
    dir = at(S0, 0).t,
    acc = document.createElement('canvas');
  acc.width = PW;
  acc.height = PH;
  const ac = acc.getContext('2d');
  cam.layers.set(0);
  R.setClearColor(0x000000, 0);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1) - 0.5;
    cam.position.copy(c0).addScaledVector(dir, u * 1.1);
    cam.lookAt(look.clone().addScaledVector(dir, u * 1.1));
    R.render(scene, cam);
    ac.globalAlpha = 1 / (i + 1);
    ac.drawImage(gl, 0, 0);
  }
  ctx.drawImage(acc, 0, 0);
  // pass 2: only the cast, sharp, laid over the blurred world
  cam.position.copy(c0);
  cam.lookAt(look);
  cam.layers.set(1);
  cam.layers.enable(2);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  ctx.globalAlpha = 1;
  ctx.drawImage(gl, 0, 0);
  // grade: punchier colour, warm light from the sun's side, a soft vignette to hold the eye on Buddy
  const tmp = document.createElement('canvas');
  tmp.width = PW;
  tmp.height = PH;
  const tc = tmp.getContext('2d');
  tc.filter = 'saturate(1.3) contrast(1.06) brightness(1.04)';
  tc.drawImage(out, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  const w = ctx.createLinearGradient(0, 0, PW, PH * 0.6);
  w.addColorStop(0, 'rgba(255,190,110,.14)');
  w.addColorStop(0.5, 'rgba(255,190,110,0)');
  ctx.fillStyle = w;
  ctx.fillRect(0, 0, PW, PH);
  const g = ctx.createRadialGradient(
    PW * 0.5,
    PH * 0.55,
    Math.min(PW, PH) * 0.3,
    PW * 0.5,
    PH * 0.5,
    Math.max(PW, PH) * 0.78,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,12,34,.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
  return out.toDataURL('image/jpeg', 0.86);
}
// the hero cut-out: Buddy and his truck alone on a transparent canvas, graded like the poster, so the loader can lay the
// logo between the poster and him. __hero() returns { png, head: [x, y] (the top of his head, as fractions of the frame) }
function hero() {
  if (!HERO) return null;
  cam.position.copy(c0);
  cam.lookAt(look);
  cam.layers.set(2);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const x = c.getContext('2d');
  x.filter = 'saturate(1.3) contrast(1.06) brightness(1.04)';
  x.drawImage(gl, 0, 0);
  x.filter = 'none';
  x.globalCompositeOperation = 'source-atop';
  const w = x.createLinearGradient(0, 0, PW, PH * 0.6);
  w.addColorStop(0, 'rgba(255,190,110,.14)');
  w.addColorStop(0.5, 'rgba(255,190,110,0)');
  x.fillStyle = w;
  x.fillRect(0, 0, PW, PH);
  const g = x.createRadialGradient(
    PW * 0.5,
    PH * 0.55,
    Math.min(PW, PH) * 0.3,
    PW * 0.5,
    PH * 0.5,
    Math.max(PW, PH) * 0.78,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,12,34,.45)');
  x.fillStyle = g;
  x.fillRect(0, 0, PW, PH);
  const b = new THREE.Box3().setFromObject(HERO.robot.root),
    top = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(cam);
  const mid = b.getCenter(new THREE.Vector3()).project(cam);
  return {
    png: c.toDataURL('image/png'),
    head: [(top.x + 1) / 2, (1 - top.y) / 2],
    headMid: [(mid.x + 1) / 2, (1 - mid.y) / 2],
  };
}
window.__hero = hero;
window.__poster = render;
console.log('poster: ready');
