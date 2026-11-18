// The Physics Studio (physics.html): the single source of truth for how things look and behave in a race. Everything
// here is the race's own: the same models (src/rocket.js, mine.js, bolt.js, chili.js, the item crate), the same looks
// (the race's FX, shockwave.js, the tyre fire, the shield bubble), the same impacts (src/impacts.js) and the same rules
// and numbers for the cars (src/race.js: a hit, a blast, a landing, a wall, a punt, a slam, a splash). Change one of
// those files and both change. Three stages: the TEST FACILITY (a road, a canal, the props a scenario stands up), IN
// THE CITY (the Old City round its start straight, Kofar Nassarawa ahead) and THE ITEMS (a showroom: every item a crate
// gives, turning on a plinth, and SEE IT IN ACTION). A design tool, like the Vehicle Studio: not part of the game.
//
// Everything is worked out in the stage's own frame (x across the road, y up, z down the road, the road at y 0):
//   shots    fly at their aim (locked on to a car, as the race's do); each step a ray against everything solid (the
//            props, the city's buildings, walls and gates); whatever they meet first, they hit
//   cars     the race's rules: a speed along a heading, held by its driver; thrown up by a hit or a blast and tumbling
//            about its middle, landing with a squash and no bounce; slowed and turned along a wall; side by side shoved
//            apart, nose to tail the speeds meeting, by the vehicles' own mass; the player's punt and slam
//   crates   tumbling boxes that break into their planks; everything lands on its lowest corner, never in the ground
// The sliders change the game's own numbers (PHYS) live.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTextures, setAniso } from './textures.js';
import { makeKart, RACERS, ENV, DEFAULT_CUSTOM } from './buddy.js';
import { FX, itemCrate, carBoom, shieldBubble } from './race.js';
import { makeBolt } from './bolt.js';
import { popChili, updateChilis, clearChilis, makeChili } from './chili.js';
import { makeTyreFire } from './tyrefire.js';
import { VSTATS } from './vehicles.js';
import { Impacts, PHYS, blastKick } from './impacts.js';
import { makeRocket } from './rocket.js';
import { makeMine } from './mine.js';
import { Sound } from './audio.js';
import { buildTrack, buildRoad, buildForks, buildForkRoads } from './track.js';
import { buildWorld } from './world.js';
import { CHAPTERS } from './chapters.js';

const $ = s => document.querySelector(s);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const gl = $('#gl');
const Rr = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
Rr.setPixelRatio(Math.min(2, devicePixelRatio));
Rr.shadowMap.enabled = true;
Rr.toneMapping = THREE.NeutralToneMapping;
setAniso(Rr.capabilities.getMaxAnisotropy());
ENV.tex = new THREE.PMREMGenerator(Rr).fromScene(new RoomEnvironment(), 0.04).texture;
const tex = buildTextures();
const S = new THREE.Scene();
S.background = new THREE.Color('#9fc4e8');
S.fog = new THREE.Fog('#dfe5ea', 120, 900);
S.add(new THREE.HemisphereLight('#e2efff', '#8a6a48', 1.5));
const sun = new THREE.DirectionalLight('#fff1d6', 3);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
sun.shadow.mapSize.set(2048, 2048);
S.add(sun, sun.target);
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
const orbit = new OrbitControls(cam, gl);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI / 2 - 0.08; // (the camera stays above the ground: you never see under the stage)
orbit.minDistance = 4;
orbit.maxDistance = 110;
const fx = new FX(S, tex),
  imp = new Impacts(S, fx);

/* ---------- the two stages ---------- */
// the stage's frame: everything of the scenarios hangs from it (the origin on the plain stage; the start straight in
// the city)
const root = new THREE.Group();
S.add(root);
const plain = new THREE.Group();
S.add(plain);
const CANAL = { z0: 88, z1: 96 };
// the plain stage is a test facility: a concrete proving ground marked out in a 5 m and 10 m grid, a stretch of the
// game's own road (its asphalt, edge lines, a dashed middle, red-and-white kerbs) with distance boards every 10 m, a
// canal cut across it, and all round, at the edge of the ground, the facility's walls (panels, the GUKART PHYSICS LAB
// name, an orange stripe) and floodlight towers: there's something in every direction you turn the camera
const solids = []; // the solid boxes in the stage's frame: cars, crates and debris bounce off them ({ min, max })
const ROAD_W = 26;
let rippleT = null; // (the canal's moving water)
{
  const gridT = canvasGrid();
  gridT.wrapS = gridT.wrapT = THREE.RepeatWrapping;
  gridT.repeat.set(36, 36);
  // the ground, in two halves with the canal cut between them right across the facility (one sheet laid over it
  // would hide the water)
  for (const [z0, z1] of [
    [-180, CANAL.z0],
    [CANAL.z1, 180],
  ]) {
    const t = gridT.clone();
    t.repeat.set(36, (z1 - z0) / 10);
    t.needsUpdate = true;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(360, z1 - z0),
      new THREE.MeshLambertMaterial({ color: '#ffffff', map: t }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, (z0 + z1) / 2);
    ground.receiveShadow = true;
    plain.add(ground);
  }
  // the road, in two runs either side of the canal
  const roadT = tex.road.clone();
  roadT.needsUpdate = true;
  roadT.wrapS = roadT.wrapT = THREE.RepeatWrapping;
  for (const [z0, z1] of [
    [-90, CANAL.z0],
    [CANAL.z1, 140],
  ]) {
    const t = roadT.clone();
    t.repeat.set(1, (z1 - z0) / 24);
    t.needsUpdate = true;
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_W, 0.4, z1 - z0),
      [0, 0, 1, 0, 0, 0].map(i =>
        i ? new THREE.MeshLambertMaterial({ map: t }) : new THREE.MeshLambertMaterial({ color: '#3b3d42' }),
      ),
    );
    r.position.set(0, -0.2, (z0 + z1) / 2);
    r.receiveShadow = true;
    plain.add(r);
    // the kerbs, red and white, either side
    const kerbT = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 16;
        const x = c.getContext('2d');
        for (let i = 0; i < 4; i++) {
          x.fillStyle = i % 2 ? '#ffffff' : '#d62b2b';
          x.fillRect(i * 32, 0, 32, 16);
        }
        return c;
      })(),
    );
    kerbT.colorSpace = THREE.SRGBColorSpace;
    kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping;
    kerbT.repeat.set((z1 - z0) / 8, 1);
    kerbT.rotation = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.12, z1 - z0),
        new THREE.MeshLambertMaterial({ map: kerbT }),
      );
      k.position.set(sx * (ROAD_W / 2 + 0.6), 0.02, (z0 + z1) / 2);
      plain.add(k);
    }
  }
  // distance boards every 10 m down the left side
  for (let z = -80; z <= 130; z += 10) {
    if (z > CANAL.z0 - 2 && z < CANAL.z1 + 2) continue;
    const bt = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 64;
        const x = c.getContext('2d');
        x.fillStyle = '#0b1330';
        x.fillRect(0, 0, 128, 64);
        x.fillStyle = '#ff6a00';
        x.fillRect(0, 54, 128, 10);
        x.fillStyle = '#ffffff';
        x.font = 'italic 800 40px "Barlow Condensed", sans-serif';
        x.textAlign = 'center';
        x.fillText(`${z} M`, 64, 42);
        return c;
      })(),
    );
    bt.colorSpace = THREE.SRGBColorSpace;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshLambertMaterial({ map: bt }));
    b.position.set(-ROAD_W / 2 - 3, 1.6, z);
    b.rotation.y = Math.PI / 2;
    plain.add(b);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: '#c9ccd4' }),
    );
    post.position.set(-ROAD_W / 2 - 3, 0.5, z);
    plain.add(post);
  }
  // the canal: right across the facility, a cut 8 m wide with stone walls down to the water 1.6 m below the road,
  // its bed under the water, and the water moving (its ripples drift down the canal and glint)
  const CW = 340,
    cz = (CANAL.z0 + CANAL.z1) / 2,
    cl = CANAL.z1 - CANAL.z0;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(CW, cl), new THREE.MeshLambertMaterial({ color: '#1d4a52' }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, -3.4, cz);
  plain.add(bed);
  rippleT = new THREE.CanvasTexture(
    (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#2f93b0';
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 140; i++) {
        const y = Math.random() * 256,
          w = 20 + Math.random() * 60;
        x.strokeStyle = `rgba(${Math.random() < 0.5 ? '220,248,255' : '20,90,120'},${0.15 + Math.random() * 0.3})`;
        x.lineWidth = 1 + Math.random() * 2.5;
        x.beginPath();
        const x0 = Math.random() * 256;
        x.moveTo(x0, y);
        x.quadraticCurveTo(x0 + w / 2, y - 4, x0 + w, y);
        x.stroke();
      }
      return c;
    })(),
  );
  rippleT.colorSpace = THREE.SRGBColorSpace;
  rippleT.wrapS = rippleT.wrapT = THREE.RepeatWrapping;
  rippleT.repeat.set(CW / 8, 1);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CW, cl),
    new THREE.MeshPhongMaterial({
      map: rippleT,
      specular: '#e8fbff',
      shininess: 90,
      transparent: true,
      opacity: 0.88,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.6, cz);
  water.userData.water = true;
  plain.add(water);
  for (const z of [CANAL.z0, CANAL.z1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(CW, 3.4, 0.4),
      new THREE.MeshLambertMaterial({ color: '#9a8f80' }),
    );
    wall.position.set(0, -1.7, z + (z === CANAL.z0 ? -0.2 : 0.2));
    plain.add(wall);
    // a stone coping along its top edge
    const cap = new THREE.Mesh(new THREE.BoxGeometry(CW, 0.15, 0.7), new THREE.MeshLambertMaterial({ color: '#c8c0b2' }));
    cap.position.set(0, 0.02, z + (z === CANAL.z0 ? -0.35 : 0.35));
    plain.add(cap);
  }
  // the facility's walls, all the way round at the edge of the ground, and floodlight towers at the corners
  const RW = 170,
    panelT = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas');
        c.width = 1024;
        c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#1b2550';
        x.fillRect(0, 0, 1024, 128);
        x.fillStyle = '#ff6a00';
        x.fillRect(0, 100, 1024, 12);
        x.fillStyle = 'rgba(255,255,255,.08)';
        for (let i = 0; i < 1024; i += 64) x.fillRect(i, 0, 2, 100);
        x.fillStyle = '#ffffff';
        x.font = 'italic 900 56px "Barlow Condensed", sans-serif';
        x.fillText('GUKART PHYSICS LAB', 40, 76);
        return c;
      })(),
    );
  panelT.colorSpace = THREE.SRGBColorSpace;
  panelT.wrapS = THREE.RepeatWrapping;
  panelT.repeat.set(4, 1);
  for (let k = 0; k < 4; k++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(RW * 2, 14, 2), new THREE.MeshLambertMaterial({ map: panelT }));
    const a = (k * Math.PI) / 2;
    w.position.set(Math.sin(a) * RW, 7, Math.cos(a) * RW);
    w.rotation.y = a;
    w.receiveShadow = true;
    plain.add(w);
  }
  for (const [x, z] of [
    [-RW + 6, -RW + 6],
    [RW - 6, -RW + 6],
    [-RW + 6, RW - 6],
    [RW - 6, RW - 6],
    [-60, -RW + 6],
    [60, RW - 6],
  ]) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 34, 8),
      new THREE.MeshLambertMaterial({ color: '#c9ccd4' }),
    );
    mast.position.set(x, 17, z);
    plain.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 1), new THREE.MeshBasicMaterial({ color: '#fff8e0' }));
    head.position.set(x, 34, z);
    head.lookAt(0, 0, 0);
    plain.add(head);
  }
}
// the proving ground's concrete, marked in a grid: a fine line every 5 m, a bolder one every 10 m (one tile 10 m)
function canvasGrid() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c4c7cd';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,95,105' : '230,232,236'},${0.05 + Math.random() * 0.06})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  x.fillStyle = '#9ea3ad';
  x.fillRect(0, 126, 256, 2);
  x.fillRect(126, 0, 2, 256);
  x.fillStyle = '#7e848f';
  x.fillRect(0, 0, 256, 4);
  x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let city = null, // { tr, box } once built
  stage = 'plain';
const CITY_S = 20; // where on the Old City's lap the stage stands: the start straight, Kofar Nassarawa 50 m ahead
function useStage(which) {
  if (which === 'city' && !city) {
    const tr = buildTrack(CHAPTERS[0].track());
    tr.forks = buildForks(tr);
    const box = new THREE.Group();
    S.add(box);
    buildRoad(box, tr, tex);
    buildForkRoads(box, tr, tex);
    buildWorld(box, tr, tex, { low: false, city: 'kano', gantry: 'kano.old' }).sky.visible = false;
    city = { tr, box };
  }
  const inCity = which === 'city',
    items = which === 'items';
  stage = which;
  plain.visible = which === 'plain';
  if (city) city.box.visible = inCity;
  show.visible = items;
  S.background.set(items ? '#070a18' : '#9fc4e8');
  S.fog.far = items ? 1e5 : 900;
  sun.castShadow = true;
  if (inCity) {
    const F = city.tr.frame(CITY_S, city.tr.newFrame());
    root.position.copy(F.p);
    root.rotation.set(0, Math.atan2(F.t.x, F.t.z), 0);
  } else {
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
  }
  root.updateMatrixWorld(true);
  sun.position.copy(root.localToWorld(V(-30, 60, 10)));
  sun.target.position.copy(root.localToWorld(V(0, 0, 20)));
  for (const b of document.querySelectorAll('#stages button')) b.classList.toggle('on', b.dataset.st === which);
  renderButtons();
  if (items) {
    imp.clear();
    for (const sh of shots) root.remove(sh.m);
    shots.length = 0;
    clearProps();
    clearChilis();
    showItem(curItem);
    return;
  }
  for (const b of document.querySelectorAll('#scen button'))
    b.disabled = inCity && !!SCEN.find(s => s.id === b.dataset.id)?.plainOnly;
  if (inCity && cur.plainOnly) cur = SCEN[0];
  play(cur);
}

/* ---------- props: what each scenario stands on the stage (gone when the next one starts) ---------- */
const props = new THREE.Group();
root.add(props);
const WALL_Z = 30,
  WALL_COL = '#c98d55';
function wallProp() {
  solids.push({ min: V(-11, 0, WALL_Z), max: V(11, 9.4, WALL_Z + 1.6) });
  const m = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 1.6), new THREE.MeshLambertMaterial({ color: WALL_COL }));
  m.position.set(0, 4, WALL_Z + 0.8);
  m.castShadow = m.receiveShadow = true;
  props.add(m);
  for (let x = -10.4; x <= 10.4; x += 2.6) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.7), m.material);
    c.position.set(x, 8.7, WALL_Z + 0.8);
    c.castShadow = true;
    props.add(c);
  }
}
// a concrete barrier down the side of the road, as the race's walls run
const BARRIER = { x: 7, z0: -6, z1: 50 };
function barrierProp() {
  solids.push({ min: V(BARRIER.x, 0, BARRIER.z0), max: V(BARRIER.x + 0.9, 1.1, BARRIER.z1) });
  const len = BARRIER.z1 - BARRIER.z0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, len), new THREE.MeshLambertMaterial({ color: '#d4d1c8' }));
  m.position.set(BARRIER.x + 0.45, 0.55, (BARRIER.z0 + BARRIER.z1) / 2);
  m.castShadow = m.receiveShadow = true;
  props.add(m);
  for (let z = BARRIER.z0; z < BARRIER.z1; z += 2) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.25, 1), new THREE.MeshLambertMaterial({ color: '#e0302a' }));
    st.position.set(BARRIER.x + 0.45, 0.95, z + 0.5);
    props.add(st);
  }
}
const RAMP = { z0: 4, z1: 12, h: 2.4 }; // a kicker: up 2.4 m over 8 m
function rampProp() {
  const sh = new THREE.Shape();
  sh.moveTo(RAMP.z0, 0);
  sh.lineTo(RAMP.z1, RAMP.h);
  sh.lineTo(RAMP.z1, 0);
  sh.lineTo(RAMP.z0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: false }).translate(0, 0, -4).rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#f2c230' }));
  m.castShadow = m.receiveShadow = true;
  props.add(m);
}
let rampOn = false;
const rampY = (x, z) =>
  rampOn && Math.abs(x) < 4 && z > RAMP.z0 && z < RAMP.z1 ? ((z - RAMP.z0) / (RAMP.z1 - RAMP.z0)) * RAMP.h : 0;
const overCanal = (x, z) => stage === 'plain' && z > CANAL.z0 && z < CANAL.z1;
function clearProps() {
  for (const c of [...props.children]) props.remove(c);
  rampOn = false;
  solids.length = 0;
}
// is a point (stage frame) inside a solid box? (debris and crates bounce off them)
const inSolid = p =>
  solids.some(b => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z);
/* ---------- cars: the race's own rules (src/race.js), on the stage's straight (x across it, z along it) ---------- */
// Every number here is the race's: its gravity, how a car lands (a squash, no bounce), how a rocket throws it (blown
// up, keeping some of its speed, tumbling over the top until it lands, a wobble, then driving on), how a mine does,
// the shove further out, how it meets a wall (slowed by how square it hits, turned to slide along it), how two cars
// meet (side by side shoved apart, nose to tail the speeds meeting, by the vehicles' own mass; a punt and a slam) and
// a splash short of the far bank. The cars here have a driver like the race's rivals: after a hit they get going again
const GRAV = 30,
  MAXV = 66,
  ACC = 27;
const MASS = id => VSTATS[id]?.mass || 1;
const cars = [];
// the box round what you can see of a car and is solid: not its hidden parts (the flames, the boost glow), not its see-through
// ones (the shadow under it, the glass glow)
function solidBox(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3(),
    b = new THREE.Box3();
  obj.traverse(o => {
    if (!o.isMesh) return;
    for (let q = o; q; q = q.parent) if (!q.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && (m.transparent || m.blending === THREE.AdditiveBlending || m.depthWrite === false)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}
function car(i, type, x, z, { y = 0, speed = 0, yaw = 0, player = false } = {}) {
  const k = makeKart(RACERS[i % RACERS.length], tex, 10, type, DEFAULT_CUSTOM[type]);
  const box = solidBox(k.root); // (its shape upright: where it touches the ground tipped)
  root.add(k.root);
  const c = {
    k,
    type,
    m: MASS(type),
    player,
    p: V(x, y, z), // (where its wheels touch the ground, upright; the model hangs off it, turned about its middle)
    yaw,
    speed,
    cruise: speed, // (the speed its driver holds)
    slide: 0, // m/s across the road (a blast's shove; the race's blastV)
    vy: 0,
    fly: y > 0.01,
    tumble: 0,
    tumbleA: 0,
    tumbleX: 1,
    tumbleZ: 0,
    spin: 0,
    spinT: 0,
    spinA: 0,
    squash: 0,
    sqT: 9,
    boost: 0, // (a Yaji boost's surge)
    fire: 0, // (on fire: the Fire item)
    shield: 0, // (the Shield item: up while this runs, and it takes this many big hits)
    shieldHits: 0,
    shieldFlash: 0,
    zapN: 0, // (blaster hits in a row: four and it spins out)
    zapT: 0,
    ghost: 0,
    slamT: 0,
    hw: (box.max.x - box.min.x) / 2, // half its width
    hl: type === 'monster' ? 2.5 : 2.2, // half its length, as the race has it
    size: box.getSize(V()),
    mid: box.getCenter(V()),
    base: box.min.y,
  };
  cars.push(c);
  return c;
}
function clearCars() {
  for (const c of cars) {
    c.tf?.dispose();
    root.remove(c.k.root);
  }
  cars.length = 0;
}
// how far its lowest corner hangs below its wheels, tipped as it is (0 upright): a tumbling car touches down there
const _e = new THREE.Euler(),
  _cq = new THREE.Quaternion();
// (it turns about its middle, as a car thrown into the air does: upside down its roof is as high as its wheels were)
function drop(c) {
  _cq.setFromEuler(_e.set(c.tumbleA * c.tumbleX, c.yaw, c.tumbleA * c.tumbleZ, 'YXZ'));
  let lo = Infinity;
  for (const k of CORNERS) lo = Math.min(lo, _c.copy(k).multiply(c.size).applyQuaternion(_cq).y);
  return Math.min(0, c.mid.y + lo - c.base);
}
const fwdOf = c => V(Math.sin(c.yaw), 0, Math.cos(c.yaw));
function dust(c, n, colour = '#e8dcc6') {
  for (let i = 0; i < n; i++)
    fx.spark(
      root.localToWorld(c.p.clone().add(V((Math.random() - 0.5) * 2.6, 0.4, (Math.random() - 0.5) * 2.6))),
      colour,
      1.6 + Math.random(),
      0.6,
    );
}
// the race's hit(k, type): 'boom' (a rocket on it, or a mine under it: blast { kick, at } for a rocket), 'zap' (a
// blaster bolt) or 'shock' (a Shockwave). On fire it's too hot to touch; a shield takes it (big hits wear it down)
function hitCar(c, blast = null, byShooter = false, type = 'boom') {
  const heavy = c.type === 'monster',
    pos = root.localToWorld(c.p.clone().setY(c.p.y + 1.5));
  if (c.fire > 0) {
    fx.spark(pos, '#ff7a1f', 8, 0.3); // (it bursts off in sparks)
    Sound.hit();
    return;
  }
  if (c.shield > 0) {
    c.shieldFlash = 0.35;
    fx.ring(pos, '#4fe3ff', type === 'zap' ? 8 : 20);
    fx.spark(pos, '#bff6ff', type === 'zap' ? 3 : 8, 0.25);
    if (type !== 'zap' && --c.shieldHits <= 0) c.shield = Math.min(c.shield, 0.01);
    Sound.hitMark(false);
    return;
  }
  if (type === 'zap') {
    fx.zap(pos);
    c.speed *= 0.8;
    c.zapN++;
    c.zapT = 2.5;
    if (c.zapN >= 4 && c.spin <= 0) {
      c.zapN = 0;
      c.spin = 0.9;
      c.spinT = 0;
    }
    Sound.hitMark(false);
    return;
  }
  if (c.spin > 0) return; // (already going over: the race lets that one finish)
  if (type === 'boom') {
    carBoom(fx, pos);
    imp.carHit(pos, c.k.paintCol, blast ? c.p.clone().sub(blast.at).setY(0).transformDirection(root.matrixWorld) : null);
    Sound.explode(1);
    shake = Math.max(shake, 0.6);
    c.vy = Math.max(c.vy, blast ? blast.kick.up : heavy ? 9 : 13);
    c.tumble = 1;
    c.tumbleA = 0;
    c.settle = false;
    c.tumbleX = 1;
    c.tumbleZ = 0;
    c.fly = true;
    c.spin = heavy ? 0.9 : 1.3;
    c.spinT = 0;
    c.speed *= heavy ? 0.6 : 0.4;
    if (blast) {
      const { t, l } = blastAway(c, blast);
      c.tumbleX = Math.abs(l) > Math.abs(t) ? 0 : t >= 0 ? 1 : -1;
      c.tumbleZ = c.tumbleX ? 0 : -(Math.sign(l) || 1);
    }
  } else {
    // a Shockwave: knocked up off the road and spun, half its speed gone
    c.vy = Math.max(c.vy, 7);
    c.fly = true;
    c.spin = 0.9;
    c.spinT = 0;
    c.speed *= 0.5;
    Sound.hit();
  }
  if (byShooter) {
    c.speed *= 0.45;
    c.ghost = 1.6;
  }
  if (blast) c.speed += blast.kick.push * blast.t * 0.5;
}
// the race's blastAway: its sideways part a slide across the road; returned split along the road and across it
function blastAway(c, blast) {
  const d = c.p.clone().sub(blast.at).setY(0);
  if (d.lengthSq() < 0.01) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  d.normalize();
  blast.t = d.z;
  c.slide += blast.kick.push * d.x;
  return { t: d.z, l: d.x };
}
// the race's blastCars: a rocket's blast at a point on the cars round it
function blastCars(at, skip = null) {
  for (const c of cars) {
    if (c === skip) continue;
    const kick = blastKick(c.p.distanceTo(at), c.m);
    if (!kick) continue;
    const blast = { kick, at };
    if (kick.near) hitCar(c, blast, true);
    else if (!c.fly) {
      c.vy = Math.max(c.vy, kick.up);
      c.fly = true;
      c.speed *= 0.85;
      blastAway(c, blast);
      c.speed += kick.push * blast.t * 0.5;
    }
  }
}
function stepCar(c, dt) {
  const grounded = !c.fly;
  // knocked spinning: the wobble, and the speed cut to a third while it lasts
  let target = c.cruise;
  if (c.spin > 0) {
    c.spin -= dt;
    c.spinT += dt;
    c.spinA = 0.75 * Math.sin(c.spinT * 8) * Math.exp(-c.spinT * 2.4) * (cars.indexOf(c) % 2 ? 1 : -1);
    target *= 0.35;
  } else {
    c.spinA *= Math.max(0, 1 - dt * 8);
    c.spinT = 0;
  }
  // a Yaji boost: the race's 1.38 times the speed, and 70 m/s² to get there; on fire, 1.15 times
  if (c.boost > 0) {
    c.boost -= dt;
    target = Math.max(target, c.cruise) * 1.38;
  }
  if (c.fire > 0) {
    c.fire -= dt;
    target = Math.max(target, c.cruise * 1.15);
  }
  c.zapT -= dt;
  if (c.zapT <= 0) c.zapN = 0;
  if (grounded || c.boost > 0) {
    if (c.speed < target)
      c.speed = Math.min(target, c.speed + (c.boost > 0 ? 70 : ACC * (1 - (0.4 * c.speed) / MAXV)) * dt);
    else c.speed = Math.max(target, c.speed - (c.spin > 0 ? 60 : 20) * dt);
  }
  c.ghost = Math.max(0, c.ghost - dt);
  c.slamT = Math.max(0, c.slamT - dt);
  // along its heading, and any slide across
  c.p.addScaledVector(fwdOf(c), c.speed * dt);
  if (c.slide) {
    c.p.x += c.slide * dt;
    c.slide *= Math.max(0, 1 - dt * 2.5);
    if (Math.abs(c.slide) < 0.1) c.slide = 0;
  }
  // up and down
  const ground = rampY(c.p.x, c.p.z);
  if (c.fly) {
    c.vy -= GRAV * dt;
    c.p.y += c.vy * dt;
    if (c.tumble > 0) c.tumbleA += dt * 7;
    if (overCanal(c.p.x, c.p.z) && c.p.y < -1.5) {
      // short of the far bank: a splash, then back on the road on the far side (the race's)
      const at = root.localToWorld(c.p.clone().setY(-1.5));
      for (let i = 0; i < 16; i++)
        fx.spark(
          at.clone().add(V((Math.random() - 0.5) * 4, Math.random() * 3.5, (Math.random() - 0.5) * 4)),
          i % 2 ? '#ffffff' : '#9fd8ff',
          2 + Math.random() * 2.5,
          0.9,
        );
      fx.ring(at, '#dff6ff', 16);
      Sound.land(1);
      c.p.set(c.p.x, 0, CANAL.z1 + 3);
      c.vy = 0;
      c.fly = false;
      c.tumble = 0;
      c.tumbleA = 0;
      c.settle = false;
      c.speed = 18;
      c.spin = 0.8;
      c.spinT = 0;
    } else if (!overCanal(c.p.x, c.p.z) && c.vy > 0) {
      c.p.y = Math.max(c.p.y, ground - drop(c)); // (going up: tipping over, its corners kept out of the road)
    } else if (!overCanal(c.p.x, c.p.z) && c.p.y + drop(c) <= ground) {
      // down: a squash on its springs, no bounce, any tumble over (the race's landing)
      c.squash = Math.min(0.75, Math.max(0.15, -c.vy / 22));
      c.sqT = 0;
      if (c.vy < -4) Sound.land(Math.min(1, -c.vy / 25));
      if (c.vy < -6) dust(c, 4 + c.squash * 14);
      c.p.y = ground;
      c.vy = 0;
      c.fly = false;
      c.tumble = 0;
      c.settle = true; // (the rest of the turn back onto its wheels)
    }
  } else if (ground > 0) {
    c.p.y = ground;
    c.onRamp = true;
  } else if (c.onRamp) {
    // off the ramp's lip: thrown up at its angle
    c.onRamp = false;
    c.fly = true;
    c.vy = c.speed * (RAMP.h / (RAMP.z1 - RAMP.z0));
  } else if (overCanal(c.p.x, c.p.z)) {
    c.fly = true; // (over the canal's edge)
    c.vy = 0;
  }
  // landed part way round: rolled on onto its wheels (the nearest way)
  if (c.settle) {
    const up = Math.round(c.tumbleA / (Math.PI * 2)) * Math.PI * 2;
    c.tumbleA += (up - c.tumbleA) * Math.min(1, dt * 14);
    if (Math.abs(up - c.tumbleA) < 0.01) {
      c.tumbleA = 0;
      c.settle = false;
    }
    if (!c.fly) c.p.y = ground - drop(c); // (resting on whichever corner's down as it rolls back)
  }
  // the squash springs back
  c.sqT += dt;
  const sq = c.squash * Math.exp(-c.sqT * 6) * Math.cos(c.sqT * 18);
  const onRamp = !c.fly && ground > 0 ? -Math.atan(RAMP.h / (RAMP.z1 - RAMP.z0)) : 0;
  c.k.root.rotation.set(c.tumbleA * c.tumbleX + onRamp, c.yaw + c.spinA, c.tumbleA * c.tumbleZ, 'YXZ');
  // turned about its middle: the model's origin swung round it
  const pivot = V(0, c.mid.y, 0);
  c.k.root.position.copy(c.p).add(pivot).sub(pivot.applyEuler(c.k.root.rotation));
  c.k.root.scale.set(1, 1 - sq * 0.4, 1);
  for (const w of c.k.wheels) w.spin.rotation.x += (c.speed * dt) / (w.r || 0.4);
  carLooks(c, dt);
}
// what a car shows of its items: the pipes' flames, the tyre fire, the shield's bubble (the race's own looks)
function carLooks(c, dt) {
  // the pipes: the boost's red flames (the Yaji's colour), or the fire's
  const hot = c.fire > 0,
    big = c.boost > 0 || hot;
  c.k.flames.forEach((fl, j) => {
    fl.material.color.set(hot ? '#ff3a12' : '#ff3b1f');
    fl.visible = big;
    fl.scale.set(1.2, 1.1 + Math.random() * 0.7, 1.2);
    if (big && Math.random() < 0.8) fx.spark(c.k.pipes[j].getWorldPosition(V()), '#ff3b1f', 1.8, 0.25);
  });
  // on fire: the race's tyre fire, pouring off the back tyres
  if (hot || c.tf) {
    c.tf ||= makeTyreFire(c.k.root, c.k.wheels);
    c.tf.update(dt, hot && !c.fly, Math.max(c.showRev || 0, Math.min(1, c.speed / MAXV)));
  }
  // the shield's bubble: the race's, blinking in its last two seconds, flaring when it takes a hit
  if (c.shield > 0 || c.bubble?.visible) {
    c.shield -= dt;
    c.shieldFlash -= dt;
    const b = (c.bubble ||= shieldBubble(c.k));
    b.visible = c.shield > 0;
    const u = b.material.uniforms,
      tt = performance.now() / 1000;
    u.uT.value = tt;
    u.uFlash.value = Math.max(0, c.shieldFlash) / 0.4;
    u.uAlpha.value = c.shield < 2 ? (Math.sin(tt * 22) > 0 ? 1 : 0.25) : 1;
  }
}
// a car against the walls (the race's): the solid boxes on the stage, the city's barriers. Pushed back out of it,
// slowed by how square it hits it (a glancing touch just slides along), its heading eased round along the wall
function collideSolids(c, dt) {
  const into = face => {
    const f = fwdOf(c),
      a = Math.abs(f.dot(face));
    if (a > 0.12) c.speed *= 1 - Math.min(0.4, a * 0.5) * Math.min(1, dt * 30);
    // turned along the wall
    const along = V(-face.z, 0, face.x);
    const want = Math.atan2(along.x * Math.sign(f.dot(along) || 1), along.z * Math.sign(f.dot(along) || 1));
    let d = want - c.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    c.yaw += d * Math.min(1, dt * 6);
    if (a > 0.25) {
      const at = root.localToWorld(c.p.clone().setY(0.8).addScaledVector(face, -c.hw));
      fx.spark(at, '#ffd27a', 1.4, 0.3);
      if (!c.scrape || performance.now() - c.scrape > 250) {
        c.scrape = performance.now();
        Sound.hit();
      }
    }
  };
  for (const b of solids) {
    if (c.p.y > b.max.y) continue;
    // the car as a box round its middle (its half width, its half length), turned only by its heading's sign
    const ex = c.hw,
      ez = c.hl;
    const ox = Math.min(c.p.x + ex, b.max.x) - Math.max(c.p.x - ex, b.min.x),
      oz = Math.min(c.p.z + ez, b.max.z) - Math.max(c.p.z - ez, b.min.z);
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) {
      const sx = c.p.x < (b.min.x + b.max.x) / 2 ? -1 : 1;
      c.p.x += sx * ox;
      if (c.slide * sx < 0) c.slide = 0;
      into(V(sx, 0, 0));
    } else {
      const sz = c.p.z < (b.min.z + b.max.z) / 2 ? -1 : 1;
      c.p.z += sz * oz;
      into(V(0, 0, sz));
    }
  }
  if (stage === 'city') {
    const lim = ROAD_W / 2 - c.hw;
    if (Math.abs(c.p.x) > lim) {
      const sx = Math.sign(c.p.x);
      c.p.x = sx * lim;
      if (c.slide * sx > 0) c.slide = 0;
      into(V(-sx, 0, 0));
    }
  }
}
// two cars (the race's): side by side shoved apart, nose to tail pushed apart with the speeds meeting, by mass; and
// the player's slam (steering into someone alongside) and punt (running up behind someone slower)
function carsCollide() {
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const A = cars[i],
        B = cars[j];
      if (A.ghost > 0 || B.ghost > 0 || Math.abs(A.p.y - B.p.y) > 2.5) continue;
      const ds = B.p.z - A.p.z,
        dl = B.p.x - A.p.x,
        ox = A.hl + B.hl - Math.abs(ds),
        oy = A.hw + B.hw - Math.abs(dl);
      if (ox <= 0 || oy <= 0) continue;
      const wa = B.m / (A.m + B.m),
        wb = A.m / (A.m + B.m);
      const me = A.player ? A : B.player ? B : null,
        them = me === A ? B : A;
      if (me && me.slamT <= 0) {
        const sideOf = Math.sign(them.p.x - me.p.x) || 1,
          alongside = Math.abs(them.p.z - me.p.z) < 3.2,
          steer = Math.sin(me.yaw);
        const sideSlam = alongside && steer * sideOf > 0.05,
          punt = !alongside && them.p.z > me.p.z && me.speed - them.speed > 3;
        if (sideSlam || punt) {
          const away = punt ? (them.p.x >= me.p.x ? 1 : -1) : sideOf,
            heavy = me.m / them.m;
          them.p.x += away * (punt ? 3.2 : 2.6) * Math.min(1.6, Math.max(0.6, heavy));
          them.yaw += away * 0.28;
          them.speed *= punt ? 0.78 : 0.82;
          them.ghost = 0.7;
          if (them.spin <= 0) {
            them.spin = 0.45;
            them.spinT = 0;
          }
          me.speed *= 0.97;
          me.slamT = 0.5;
          shake = Math.max(shake, 0.3);
          Sound.blip(110, 0.18, 'square', 0.14, 0.5);
          fx.spark(root.localToWorld(me.p.clone().add(them.p).multiplyScalar(0.5).setY(1.2)), '#ffd28a', 2.2, 0.25);
          continue;
        }
      }
      if (oy < ox) {
        const sg = Math.sign(dl) || 1;
        A.p.x -= sg * oy * wa;
        B.p.x += sg * oy * wb;
        A.yaw -= sg * 0.05 * wa;
        B.yaw += sg * 0.05 * wb;
        A.speed *= 0.995;
        B.speed *= 0.995;
      } else {
        const sg = Math.sign(ds) || 1,
          back = sg > 0 ? A : B,
          front = sg > 0 ? B : A;
        A.p.z -= sg * ox * wa;
        B.p.z += sg * ox * wb;
        if (back.speed > front.speed) {
          const v = (back.speed * back.m + front.speed * front.m) / (back.m + front.m),
            dv = back.speed - front.speed;
          back.speed = v - (dv * 0.15 * front.m) / (back.m + front.m);
          front.speed = v + dv * 0.1;
          if (dv > 4) {
            shake = Math.max(shake, 0.2);
            Sound.blip(120, 0.12, 'square', 0.08, 0.6);
          }
        }
      }
    }
}

/* ---------- boxes that tumble: the crates, and the planks a crate breaks into ---------- */
// each is a box (size) with a position, a velocity, an orientation and a spin. Against the ground it's the box's lowest
// corner that touches (so a box on its edge rests on its edge, never sunk into the floor), it bounces, slides with
// friction and, slowing, topples flat onto its nearest face. It bounces off the solid boxes and stands on the crates
// under it
const CORNERS = [];
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) CORNERS.push(V(x, y, z));
const AXES = [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)];
const _c = V(),
  _q = new THREE.Quaternion(),
  _w = V(),
  UP = V(0, 1, 0);
function lowest(q, size) {
  let lo = Infinity;
  for (const k of CORNERS) lo = Math.min(lo, _c.copy(k).multiply(size).applyQuaternion(q).y);
  return lo;
}
function stepBox(b, dt, floor) {
  b.v.y -= PHYS.gravity * dt;
  b.p.addScaledVector(b.v, dt);
  const wl = b.w.length();
  if (wl > 1e-4) b.q.premultiply(_q.setFromAxisAngle(_w.copy(b.w).divideScalar(wl), wl * dt));
  if (inSolid(b.p)) {
    b.p.x -= b.v.x * dt;
    b.p.z -= b.v.z * dt;
    b.v.x *= -0.35;
    b.v.z *= -0.35;
    b.w.multiplyScalar(0.7);
  }
  const lo = lowest(b.q, b.size);
  let hit = 0;
  if (b.p.y + lo <= floor) {
    hit = -b.v.y;
    b.p.y = floor - lo;
    b.v.y = hit > 2 ? hit * PHYS.bounce : 0;
    b.v.x *= PHYS.friction;
    b.v.z *= PHYS.friction;
    b.w.multiplyScalar(0.55);
    // slowing on the ground: topples flat onto whichever face is nearest down
    if (hit < 4) {
      let best = null,
        bd = -1;
      for (const a of AXES) {
        const wa = _c.copy(a).applyQuaternion(b.q),
          d = Math.abs(wa.y);
        if (d > bd) {
          bd = d;
          best = wa.clone().multiplyScalar(Math.sign(wa.y) || 1);
        }
      }
      const flat = new THREE.Quaternion().setFromUnitVectors(best, UP).multiply(b.q);
      b.q.slerp(flat, Math.min(1, dt * 6));
      b.p.y = floor - lowest(b.q, b.size);
      if (b.v.lengthSq() < 0.3 && bd > 0.999) b.rest = true;
    }
  }
  return hit;
}

/* crates: item crates (the race's own) scaled to 1.4 m, stacked */
const CR = 1.4,
  CRATE_SCALE = CR / 2.2;
const crates = [];
function crate(x, y, z) {
  const m = itemCrate();
  m.scale.setScalar(CRATE_SCALE);
  m.position.set(x, y + CR / 2, z);
  props.add(m);
  crates.push({ m, p: m.position, q: m.quaternion, v: V(0, 0, 0), w: V(0, 0, 0), size: V(CR, CR, CR), awake: false });
}
// what a crate stands on: the ground, or the top of a crate under it
function crateFloor(c) {
  let f = 0;
  for (const o of crates)
    if (o !== c && !o.gone && o.p.y < c.p.y - 0.3 && Math.abs(o.p.x - c.p.x) < CR * 0.9 && Math.abs(o.p.z - c.p.z) < CR * 0.9)
      f = Math.max(f, o.p.y + CR / 2);
  return f;
}
function stepCrates(dt) {
  for (const c of crates) {
    if (c.gone) continue;
    const floor = crateFloor(c);
    if (!c.awake) {
      // the crate under it gone: it falls
      if (c.p.y - CR / 2 > floor + 0.05) c.awake = true;
      else continue;
    }
    c.rest = false;
    const hit = stepBox(c, dt, floor);
    if (hit > 13) smash(c, V(0, 1, 0));
    else if (hit > 4) Sound.thump(140, 70, 0.15, Math.min(0.5, hit / 30));
    if (c.rest) c.awake = false;
  }
}
// a crate breaks: gone, and in its place its planks (three to a side), flung out from where it was hit, with
// splinters and dust and the crack of it
const plankGeo = new THREE.BoxGeometry(1, 1, 1),
  plankMats = ['#d9a466', '#cf9a5c', '#e3b277', '#b98447'].map(c => new THREE.MeshLambertMaterial({ color: c }));
const planks = [];
function smash(c, push) {
  if (c.gone) return;
  c.gone = true;
  props.remove(c.m);
  const faces = [
    [V(1, 0, 0), V(0, 1, 0)],
    [V(-1, 0, 0), V(0, 1, 0)],
    [V(0, 1, 0), V(1, 0, 0)],
    [V(0, -1, 0), V(1, 0, 0)],
    [V(0, 0, 1), V(0, 1, 0)],
    [V(0, 0, -1), V(0, 1, 0)],
  ];
  for (const [n, across] of faces)
    for (let i = -1; i <= 1; i++) {
      const b = {
        m: new THREE.Mesh(plankGeo, plankMats[(Math.random() * 4) | 0]),
        v: V(),
        w: V((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        size: V(CR, CR / 3 - 0.04, 0.09),
      };
      b.m.castShadow = true;
      b.m.userData.noHit = true;
      // the plank lies in its face: its length across the face, its thin side along the face's normal
      const local = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          V().crossVectors(across, n).normalize(),
          across.clone(),
          n.clone(),
        ),
      );
      b.m.quaternion.copy(c.q).multiply(local);
      b.m.position.copy(n).multiplyScalar(CR / 2).addScaledVector(across, (i * CR) / 3).applyQuaternion(c.q).add(c.p);
      b.m.scale.copy(b.size);
      b.p = b.m.position;
      b.q = b.m.quaternion;
      const out = b.p.clone().sub(c.p).normalize();
      b.v.copy(c.v).addScaledVector(out, 3 + Math.random() * 5).addScaledVector(push, 4 + Math.random() * 6);
      b.v.y += 3 + Math.random() * 4;
      props.add(b.m);
      planks.push(b);
    }
  const at = root.localToWorld(c.p.clone());
  imp.impact(at, push.clone().transformDirection(root.matrixWorld), 'bolt', '#c9965a', { scorch: false });
  for (let i = 0; i < 6; i++) fx.spark(at.clone().add(V(0, i * 0.2, 0)), '#cdb48c', 2.5 + i * 0.4, 0.9);
  Sound.hit();
  Sound.thump(220, 60, 0.3, 0.6);
}
function stepPlanks(dt) {
  for (const b of planks) if (!b.rest) stepBox(b, dt, 0);
}

/* ---------- shots ---------- */
let hitList = null;
const ray = new THREE.Raycaster();
function solid() {
  if (hitList) return hitList;
  hitList = [];
  const walk = o => {
    if (!o.visible || o.userData.noHit) return;
    if ((o.isMesh || o.isInstancedMesh) && !o.isSprite && o.geometry && !o.material?.transparent) {
      const g = o.geometry,
        tris = (g.index ? g.index.count : g.attributes.position?.count || 0) / 3;
      if (tris < 30000) hitList.push(o);
    }
    for (const ch of o.children) walk(ch);
  };
  walk(props);
  if (stage === 'city' && city) walk(city.box);
  else walk(plain);
  return hitList;
}
// a ray from a (stage frame) along dir for len: the first solid thing, as a world point, its normal and its colour
function rayHit(a, dir, len) {
  const wa = root.localToWorld(a.clone()),
    wd = dir.clone().transformDirection(root.matrixWorld);
  ray.set(wa, wd);
  ray.far = len + 0.3;
  const h = ray.intersectObjects(solid(), false)[0];
  if (!h) return null;
  const o = h.object,
    n = (h.face?.normal || V(0, 1, 0)).clone();
  if (o.isInstancedMesh && h.instanceId != null) {
    const im = new THREE.Matrix4();
    o.getMatrixAt(h.instanceId, im);
    n.transformDirection(im);
  }
  n.transformDirection(o.matrixWorld);
  if (n.dot(wd) > 0) n.negate();
  let colour = '#9a8a78';
  if (o.isInstancedMesh && o.instanceColor && h.instanceId != null) {
    const cc = new THREE.Color();
    o.getColorAt(h.instanceId, cc);
    colour = '#' + cc.getHexString();
  } else {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.color) colour = '#' + m.color.getHexString();
  }
  return { point: h.point, normal: n, colour };
}
const shots = [];
let rocketSpeed = 80;
let shake = 0; // (the camera's shake: a big hit nearby)
const blinkers = []; // (armed mines: their lens and warning ring blink, as the race's do)
function fire(kind, from, to, target = null) {
  const m = kind === 'rocket' ? makeRocket() : makeBolt(); // (the race's own: src/rocket.js, src/bolt.js)
  m.userData.noHit = true;
  const dir = to.clone().sub(from).normalize();
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
  root.add(m);
  shots.push({ kind, m, p: from.clone(), dir, target, v: kind === 'rocket' ? rocketSpeed : 140, life: 3 });
  if (kind === 'rocket') Sound.rocket();
  else Sound.zap();
}
// a blast at a point (stage frame): cars and crates near it thrown out from it, harder the nearer and the lighter
function blast(at, skip = null) {
  blastCars(at, skip);
  for (const c of crates) {
    if (c.gone) continue;
    const d = c.p.distanceTo(at);
    if (d > PHYS.blast * 1.2) continue;
    const dir = c.p.clone().sub(at).normalize(),
      f = 1 - d / (PHYS.blast * 1.2);
    if (d < PHYS.blast * 0.45) {
      smash(c, dir.clone().multiplyScalar(1.5 * f + 0.5));
      continue;
    }
    c.awake = true;
    c.v.addScaledVector(dir, 20 * f).setY(c.v.y + 10 * f);
    c.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  }
  for (const b of planks) {
    const d = b.p.distanceTo(at);
    if (d > PHYS.blast) continue;
    b.rest = false;
    b.v.addScaledVector(b.p.clone().sub(at).normalize(), 14 * (1 - d / PHYS.blast)).y += 6 * (1 - d / PHYS.blast);
  }
}
function boom(s, point, normal, colour, onThing = false) {
  root.remove(s.m);
  s.life = 0;
  imp.impact(point, normal, s.kind, colour, { scorch: !onThing });
  if (s.kind === 'rocket') {
    Sound.explode(1);
    blast(root.worldToLocal(point.clone()));
  } else Sound.hitMark(false);
}
function stepShots(dt) {
  for (const s of shots) {
    if (s.life <= 0) continue;
    s.life -= dt;
    // locked on, as the race's are: turning after its target
    if (s.target) {
      const want = s.target.p.clone().setY(s.target.p.y + 1.1).sub(s.p).normalize();
      s.dir.lerp(want, Math.min(1, dt * (s.kind === 'rocket' ? 4 : 10))).normalize();
      s.m.quaternion.setFromUnitVectors(V(0, 0, 1), s.dir);
    }
    const from = s.p.clone(),
      step = s.v * dt;
    s.p.addScaledVector(s.dir, step);
    s.m.position.copy(s.p);
    const wp = root.localToWorld(s.p.clone());
    if (s.kind === 'rocket') {
      const tail = root.localToWorld(s.p.clone().addScaledVector(s.dir, -2));
      fx.spark(tail, Math.random() < 0.5 ? '#ffd27a' : '#ff8a1f', 2.2, 0.18);
      fx.spark(tail, '#c9c4bc', 2.6, 0.6);
    } else fx.spark(wp, '#9fe4ff', 0.9, 0.12);
    const back = () => root.localToWorld(from.clone()).sub(wp).normalize();
    const hit = cars.find(
      c =>
        c.p
          .clone()
          .setY(c.p.y + 1)
          .distanceTo(s.p) <
        (s.kind === 'bolt' ? 2.6 : 2.3),
    );
    if (hit) {
      root.remove(s.m);
      s.life = 0;
      if (s.kind === 'rocket') {
        // a direct hit, as the race does it: thrown on the way the rocket was going, the cars round it caught
        hitCar(hit, { kick: blastKick(0, hit.m), at: hit.p.clone().addScaledVector(s.dir, -3) }, true);
        blast(hit.p.clone(), hit);
      } else hitCar(hit, null, true, 'zap'); // (a blaster bolt: the race's zap)
      continue;
    }
    if (crates.some(c => !c.gone && c.p.distanceTo(s.p) < 1.2)) {
      boom(s, wp, back(), '#c08a4a', true);
      continue;
    }
    const w = rayHit(from, s.dir, step);
    if (w) {
      boom(s, w.point, w.normal, w.colour);
      continue;
    }
    if (s.p.y <= 0.05) boom(s, root.localToWorld(s.p.clone().setY(0.02)), V(0, 1, 0), '#4a4c52');
    else if (s.life <= 0) root.remove(s.m);
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
}

/* ---------- THE ITEMS: a showroom, each item turning on a plinth ---------- */
// every item a crate can give, as the race draws it (the same models and looks, from the same files), turning slowly
// in a dark studio under the lights; SEE IT IN ACTION plays its scenario on the test facility
const show = new THREE.Group();
show.visible = false;
S.add(show);
const turn = new THREE.Group();
turn.position.y = 0.5;
{
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader:
        'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader:
        'varying float vY; void main(){ gl_FragColor = vec4(mix(vec3(.03,.04,.1), vec3(.1,.13,.3), smoothstep(-.05,.7,vY)), 1.); }',
    }),
  );
  show.add(bg);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#0c1230', roughness: 0.3, metalness: 0.4 }),
  );
  floor.receiveShadow = true;
  show.add(floor);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.2, 0.5, 64),
    new THREE.MeshStandardMaterial({ color: '#1b2550', roughness: 0.35, metalness: 0.5 }),
  );
  plinth.position.y = 0.25;
  plinth.receiveShadow = true;
  show.add(plinth);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(3.02, 0.05, 8, 96).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ff6a00' }),
  );
  band.position.y = 0.5;
  show.add(band);
  // a rim light from behind, so every edge of the item reads against the dark
  const rim = new THREE.DirectionalLight('#9fc0ff', 2.2);
  rim.position.set(-6, 8, -10);
  show.add(rim);
  show.add(turn);
}
const ITEMS = [
  {
    id: 'rocket',
    name: 'ROCKET',
    play: 'car',
    about:
      'Two to a crate. Locks on to someone ahead within 150 m and flies at them trailing smoke. A direct hit throws them up and over and catches the cars round them; into a wall or the road it blows chunks out of it.',
    make: () => {
      const m = makeRocket();
      m.rotation.set(0, Math.PI / 2, 0.12);
      m.position.y = 1.4;
      return m;
    },
    cam: [0, 2.6, 6.5],
  },
  {
    id: 'mine',
    name: 'MINE',
    play: 'mine',
    about:
      "Three to a crate, dropped behind you for whoever's following. Armed half a second after it's down, its red lens blinking; drive over it and you're blown up and flipped.",
    make: () => {
      const { root: m, light, ring } = makeMine();
      blinkers.push({ light, ring });
      return m;
    },
    cam: [0, 2.6, 4.2],
  },
  {
    id: 'bolt',
    name: 'BLASTER',
    play: 'zap',
    about:
      'Sixteen bolts to a crate, as fast as you can fire them, locking on to whoever is ahead. Each hit takes a fifth of their speed; four in a row and they spin out.',
    make: () => {
      const m = makeBolt();
      m.rotation.y = Math.PI / 2;
      m.position.y = 1.4;
      return m;
    },
    cam: [0, 2.2, 6],
  },
  {
    id: 'yaji',
    name: 'YAJI BOOST',
    play: 'yaji',
    about:
      "Three to a crate. Yaji is suya's hot spice: its pepper pops up over your car and bursts, red flames roar out of your pipes and you surge to 1.38 times your speed for 1.3 seconds.",
    make: () => {
      const m = makeChili();
      m.scale.setScalar(1.9);
      m.position.y = 2.6;
      m.rotation.z = -0.5;
      return m;
    },
    cam: [0, 2.8, 6],
  },
  {
    id: 'shock',
    name: 'SHOCKWAVE',
    play: 'shock',
    about:
      'One to a crate. A dome of violet energy bursts out from your car to 24 m: everyone inside it is knocked up off the road and spun, half their speed gone.',
    car: c => (c.pulse = 0.6),
    cam: [0, 6, 15],
  },
  {
    id: 'fire',
    name: 'FIRE',
    play: 'fire',
    about:
      "Rare. You catch fire the moment it lands: flames pour off your back tyres for 8 seconds, you're 15% faster, nothing slows you and you're too hot to touch: rockets and bolts burst off you.",
    car: c => {
      c.fire = 1e9;
      c.showRev = 0.8; // (burning as it would at speed)
    },
    cam: [0, 3.4, 9],
  },
  {
    id: 'shield',
    name: 'SHIELD',
    play: 'shield',
    about:
      'Goes up the moment it lands: a bubble of light round your car that blocks everything for 10 seconds, or three big hits. It blinks as it runs out.',
    car: c => {
      c.shield = 1e9;
      c.shieldHits = 1e9;
    },
    cam: [0, 3.4, 9],
  },
  {
    id: 'crate',
    name: 'ITEM CRATE',
    play: 'crates',
    about:
      'Where they all come from: a wooden supply crate with orange steel corners and a hazard band, on the road in rows. Drive through one and the item rolls; a rocket breaks them into their planks.',
    make: () => {
      const m = itemCrate();
      m.position.y = 1.25;
      return m;
    },
    cam: [0, 2.8, 6.5],
  },
];
let curItem = ITEMS[0];
function showItem(it) {
  curItem = it;
  for (const c of [...turn.children]) turn.remove(c);
  blinkers.length = 0;
  clearCars();
  if (it.make) turn.add(it.make());
  else {
    const c = car(1, 'kart', 0, 0);
    c.k.root.position.set(0, 0.5, 0);
    it.car(c);
  }
  cam.position.set(...it.cam);
  orbit.target.set(0, 1.4, 0);
  $('#scName').textContent = it.name;
  $('#abName').textContent = it.name;
  $('#abText').textContent = it.about;
  for (const b of document.querySelectorAll('#scen button')) b.classList.toggle('on', b.dataset.id === it.id);
}
// the showroom's frame: turning, and the cars' item looks running
function stepShow(dt) {
  turn.rotation.y += dt * 0.5;
  for (const c of cars) {
    c.yaw += dt * 0.5;
    c.k.root.rotation.set(0, c.yaw, 0);
    carLooks(c, dt);
    if (c.pulse != null && (c.pulse -= dt) <= 0) {
      c.pulse = 2.6;
      fx.shock(V(0, 0.55, 0), V(0, 2, 0), 9);
      Sound.blip(90, 0.6, 'sawtooth', 0.12, 0.3);
    }
  }
}

/* ---------- the scenarios ---------- */
const L = V(0, 1.7, -22); // the launcher, down the road
// in the city, a shot at "the wall" goes for Kofar Nassarawa's gatehouse instead (its left pier, 50 m ahead)
const wallAim = (x, y) => (stage === 'city' ? V(-19 + x * 0.3, y + 2, 50) : V(x, y, WALL_Z));
const SCEN = [
  {
    id: 'wall',
    name: 'ROCKET INTO A WALL',
    about:
      "A rocket fired at a mud-brick wall. It explodes against the face: a fireball and a ring of shock flat on the wall, chunks of the wall in its own colour blown out in a cone, falling, tumbling and bouncing across the road, a billow of dust, and a black scorch burned on that fades over half a minute. In the city it hits Kofar Nassarawa's gatehouse.",
    set: () => stage === 'plain' && wallProp(),
    at: [[0.3, () => fire('rocket', L, wallAim(-2, 3.2))]],
    cam: [-20, 9, -4],
    look: [0, 3, 24],
    cityCam: [9, 8, 4],
    cityLook: [-12, 5, 50],
  },
  {
    id: 'bolt',
    name: 'BLASTER INTO A WALL',
    about:
      'A burst of six blaster bolts across a wall. Each one: a shower of sparks off the surface, a few small chips, a small scorch, a ricochet tink.',
    set: () => stage === 'plain' && wallProp(),
    at: [0, 1, 2, 3, 4, 5].map(i => [0.3 + i * 0.14, () => fire('bolt', L, wallAim(-4 + i * 1.6, 2 + (i % 3) * 1.2))]),
    cam: [-16, 7, 4],
    look: [0, 3, 26],
    cityCam: [8, 7, 12],
    cityLook: [-14, 4, 50],
  },
  {
    id: 'car',
    name: 'ROCKET INTO A CAR',
    about:
      "As in a race: a kart at race speed, and a rocket locked on from behind. A big fireball and an orange shockwave; the blast throws it on the way the rocket was going, keeping some of its speed, flipping end over end over the top, a wobble as it lands on its springs, then its driver gets going again. Cars near it are caught in the blast.",
    set: () => car(1, 'kart', 0, -20, { speed: 24 }),
    at: [[0.3, () => fire('rocket', V(0, 1.7, -46), V(0, 1, -10), cars[0])]],
    cam: [-16, 6, -8],
    look: [0, 2, 8],
  },
  {
    id: 'blast',
    name: 'BLAST BESIDE CARS',
    about:
      "The race's own blast. A rocket into the road among three cars. Inside half the blast radius a car is thrown away from it and tumbles the way it's thrown: rolled over from a blast beside it, flipped end over end from one ahead or behind. Out to the radius it hops and slides away. Lighter cars go further.",
    set: () => {
      car(1, 'kart', 2.5, 10);
      car(2, 'buggy', -5.5, 12);
      car(3, 'kart', 9, 17);
    },
    at: [[0.3, () => fire('rocket', L, V(0, 0, 10))]],
    cam: [-24, 14, -2],
    look: [0, 1, 12],
  },
  {
    id: 'crates',
    name: 'CRATE STACK',
    about:
      'A rocket into a stack of item crates. The ones near the blast break apart into their planks, flung out, tumbling and landing flat. The ones further off are thrown whole, and a crate that lands hard breaks too. The crates above fall when the ones under them go.',
    set: () => {
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 4 - row; i++) crate(-2.25 + i * 1.5 + row * 0.75, row * CR, 14);
    },
    at: [[0.3, () => fire('rocket', L, V(0, 1.5, 14))]],
    cam: [-16, 7, 2],
    look: [0, 2, 14],
  },
  {
    id: 'crash',
    name: 'WALL CRASH',
    about:
      'A kart steered into the barrier at 100 km/h, as in a race. The harder it meets it, the more speed it loses (a glancing touch just slides along); it is turned along the wall and scrapes down it with sparks.',
    set: () => {
      barrierProp();
      car(1, 'kart', -2, -20, { speed: 28, yaw: 0.3 });
    },
    at: [],
    cam: [-5, 5, -8],
    look: [7, 1, 16],
  },
  {
    id: 'shunt',
    name: 'REAR-END SHUNT',
    about:
      "Running up behind someone slower, as in a race: a punt. Your kart into the back of a slower kart: it's punted aside, slowed and set wobbling; yours barely loses anything. Then a rival's monster truck runs into the back of a slower one: no punt, their speeds just meet, by mass.",
    set: () => {
      car(1, 'kart', 0, -24, { speed: 34, player: true });
      car(2, 'kart', 0, 0, { speed: 16 });
      car(3, 'monster', 8, -30, { speed: 30 });
      car(4, 'buggy', 8, -6, { speed: 14 });
    },
    coast: 1.8,
    at: [],
    cam: [-18, 7, 6],
    look: [0, 1, 14],
  },
  {
    id: 'swipe',
    name: 'SIDE-SWIPE',
    about:
      "Steering into someone alongside, as in a race: a slam. Your heavy Brute turns into the light kart beside it: the kart is thrown across the road (further the heavier you are than it), turned away and set wobbling, and slowed; you hardly lose anything.",
    set: () => {
      car(1, 'brute', -2.6, -10, { speed: 22, yaw: 0.12, player: true });
      car(2, 'kart', 2.6, -10, { speed: 22 });
    },
    at: [],
    cam: [-4, 16, -24],
    look: [0, 0, 10],
    cityCam: [0, 13, -6],
    cityLook: [0, 0, 18],
  },
  {
    id: 'mine',
    name: 'MINE UNDER A CAR',
    about:
      "A kart drives over a mine, as in a race. A big fireball and an orange shockwave; it's blown up and flipped end over end, keeping some of its speed, lands on its springs with a wobble, and its driver gets going again. A scorch is left on the road.",
    set: () => {
      car(1, 'kart', 0, -14, { speed: 20 });
      const { root: mine, light, ring } = makeMine(); // (the race's mine: src/mine.js)
      mine.position.set(0, 0, 6);
      props.add(mine);
      blinkers.push({ light, ring });
    },
    at: [
      [
        0.98,
        () => {
          props.children.at(-1)?.removeFromParent();
          blinkers.length = 0;
          imp.impact(root.localToWorld(V(0, 0.05, 6)), V(0, 1, 0).transformDirection(root.matrixWorld), 'bolt', '#4a4c52');
          hitCar(cars[0]);
        },
      ],
    ],
    cam: [-16, 6, -2],
    look: [0, 4, 8],
  },
  {
    id: 'zap',
    name: 'BLASTER INTO A CAR',
    about:
      "The Blaster, as in a race: a stream of bolts locked on to a kart ahead. Each hit crackles and takes a fifth of its speed; four in a row and it spins out. Its driver gets going again.",
    set: () => car(1, 'kart', 0, -10, { speed: 20 }),
    at: [0, 1, 2, 3, 4, 5].map(i => [0.3 + i * 0.13, () => fire('bolt', V(0, 1.6, -34 + i * 2.6), cars[0].p.clone().setY(1.4), cars[0])]),
    cam: [-14, 6, -6],
    look: [0, 1.5, 10],
  },
  {
    id: 'shock',
    name: 'SHOCKWAVE',
    about:
      "The Shockwave, as in a race: a dome of violet energy bursts out from your car to 24 m. Every car inside it is knocked up off the road and spun, half its speed gone; anyone further off is untouched.",
    set: () => {
      car(1, 'brute', 0, -6, { speed: 18, player: true });
      car(2, 'kart', -6, -2, { speed: 18 });
      car(3, 'buggy', 6, -12, { speed: 18 });
      car(4, 'kart', 4, 6, { speed: 18 });
      car(5, 'kart', -5, 40, { speed: 18 }); // (out of its reach)
    },
    at: [
      [
        0.7,
        () => {
          const me = cars[0];
          fx.shock(root.localToWorld(me.p.clone()), root.localToWorld(me.p.clone().setY(1.5)), 24);
          for (const o of cars)
            if (o !== me && Math.abs(o.p.z - me.p.z) < 24 && Math.abs(o.p.x - me.p.x) < 20) hitCar(o, null, true, 'shock');
          Sound.blip(90, 0.6, 'sawtooth', 0.18, 0.3);
          shake = Math.max(shake, 0.3);
        },
      ],
    ],
    cam: [-26, 16, -20],
    look: [0, 1, 14],
  },
  {
    id: 'yaji',
    name: 'YAJI BOOST',
    about:
      "The Yaji Boost, as in a race: yaji is suya's hot spice. Its pepper pops up over the car and bursts in a shower of spice, red flames roar out of the pipes and the kart surges away at 1.38 times its speed for 1.3 seconds, leaving the kart beside it behind.",
    set: () => {
      car(1, 'kart', -3, -16, { speed: 20 });
      car(2, 'kart', 3, -16, { speed: 20 });
    },
    at: [
      [
        0.5,
        () => {
          popChili(cars[0].k.root, fx);
          cars[0].boost = 1.3;
          Sound.boost();
        },
      ],
    ],
    coast: 3,
    cam: [-16, 6, -14],
    look: [0, 2, 8],
  },
  {
    id: 'fire',
    name: 'FIRE',
    about:
      "Fire, as in a race: your kart catches fire. Flames pour off its back tyres and it runs 15% faster, and it's too hot to touch: a rocket that hits it just bursts off it in sparks.",
    set: () => car(1, 'kart', 0, -14, { speed: 20 }),
    at: [
      [
        0.3,
        () => {
          cars[0].fire = 8;
          cars[0].boost = 0.8;
          Sound.boost();
        },
      ],
      [1.2, () => fire('rocket', V(0, 1.7, -30), cars[0].p.clone().setY(1), cars[0])],
    ],
    coast: 3.2,
    cam: [-16, 6, -6],
    look: [0, 2, 16],
  },
  {
    id: 'shield',
    name: 'SHIELD',
    about:
      "The Shield, as in a race: a bubble of light round the car that blocks everything for 10 seconds, or three big hits. Two rockets flash off it; the third breaks it; the fourth gets through and throws the car.",
    set: () => {
      const c = car(1, 'kart', 0, -14, { speed: 18 });
      c.shield = 10;
      c.shieldHits = 3;
    },
    at: [0, 1, 2, 3].map(i => [0.3 + i * 0.8, () => fire('rocket', V(0, 1.7, -38 + i * 14), cars[0].p.clone().setY(1), cars[0])]),
    len: 7,
    coast: 4,
    cam: [-16, 6, -4],
    look: [0, 2, 20],
  },
  {
    id: 'jump',
    name: 'RAMP JUMP',
    about:
      "A kart takes a kicker at 115 km/h. It leaves the lip at the ramp's angle, flies under the race's gravity, and lands on its springs with a squash and a puff of dust, no bounce. Test facility only.",
    plainOnly: true,
    set: () => {
      rampProp();
      rampOn = true;
      car(1, 'kart', 0, -24, { speed: 32 });
    },
    coast: 1.6,
    at: [],
    cam: [-26, 8, 18],
    look: [0, 2, 24],
  },
  {
    id: 'splash',
    name: 'CANAL SPLASH',
    about:
      "A kart drops into the canal, short of the far bank, as in a race: a splash of spray and a ring on the water, and it's put back on the road on the far bank, slowed and wobbling, to carry on. Test facility only.",
    plainOnly: true,
    set: () => car(1, 'kart', 0, 60, { speed: 14 }),
    at: [],
    coast: 9,
    cam: [-18, 6, 80],
    look: [0, -1, 92],
  },
  {
    id: 'drop',
    name: 'CAR DROP',
    about:
      "A car dropped from 20 m onto the road. The race's gravity takes it down; it lands as a car in the race does, with a thud, a squash of its springs and dust, no bounce.",
    set: () => car(4, 'kart', 0, 6, { y: 20 }),
    at: [],
    cam: [-16, 8, -6],
    look: [0, 4, 6],
  },
];
let cur = SCEN[0],
  t = 0,
  done = new Set();
function play(sc) {
  Sound.init();
  cur = sc;
  t = 0;
  done = new Set();
  imp.clear();
  for (const s of shots) root.remove(s.m);
  shots.length = 0;
  shake = 0;
  blinkers.length = 0;
  clearChilis();
  clearCars();
  clearProps();
  crates.length = 0;
  planks.length = 0;
  sc.set();
  hitList = null;
  // in the city the camera stands over the road (out past its barriers they'd fill the view); the shots at the wall
  // look at the gatehouse they hit
  let cp = sc.cam,
    lp = sc.look;
  if (stage === 'city') {
    if (sc.cityCam) [cp, lp] = [sc.cityCam, sc.cityLook];
    else {
      const x = THREE.MathUtils.clamp(cp[0], -9, 9);
      cp = [x, Math.max(cp[1], 7), cp[2] - (Math.abs(cp[0]) - Math.abs(x)) * 0.8];
    }
  }
  cam.position.copy(root.localToWorld(V(...cp)));
  orbit.target.copy(root.localToWorld(V(...lp)));
  $('#scName').textContent = sc.name;
  $('#abName').textContent = sc.name;
  $('#abText').textContent = sc.about;
  for (const b of document.querySelectorAll('#scen button')) b.classList.toggle('on', b.dataset.id === sc.id);
}
// the buttons: the scenarios, or in the showroom the items
function renderButtons() {
  const list = stage === 'items' ? ITEMS : SCEN;
  $('#scen').innerHTML = list.map(s => `<button data-id="${s.id}"><b>${s.name}</b></button>`).join('');
  $('#scenTag').textContent = stage === 'items' ? 'THE ITEMS' : 'SCENARIOS';
  $('#scLabel').textContent = stage === 'items' ? 'ITEM' : 'SCENARIO';
  paintStop();
}
$('#scen').onclick = e => {
  const b = e.target.closest('button[data-id]');
  if (!b || b.disabled) return;
  if (stage === 'items') return showItem(ITEMS.find(s => s.id === b.dataset.id));
  looping = true;
  paintStop();
  play(SCEN.find(s => s.id === b.dataset.id));
};
$('#stages').onclick = e => {
  const b = e.target.closest('button[data-st]');
  if (!b) return;
  if (b.dataset.st === 'city' && !city) {
    $('#scName').textContent = 'BUILDING THE CITY...';
    setTimeout(() => useStage('city'), 30); // (a moment for the words to show: the city takes a few seconds)
  } else useStage(b.dataset.st);
};
// it plays over and over until STOP; PLAY starts it again
let looping = true;
const paintStop = () => {
  $('#stop').textContent = stage === 'items' ? 'SEE IT IN ACTION' : looping ? 'STOP' : 'PLAY';
  $('#stop').classList.toggle('stopped', stage !== 'items' && !looping);
};
$('#stop').onclick = () => {
  if (stage === 'items') {
    // to the test facility, playing this item's scenario
    cur = SCEN.find(s => s.id === curItem.play);
    looping = true;
    useStage('plain');
    return;
  }
  looping = !looping;
  if (looping) play(cur);
  paintStop();
};

// the sliders: the game's own numbers
const SL = [
  ['gravity', 'GRAVITY', 5, 60, 1],
  ['bounce', 'BOUNCE', 0, 0.9, 0.01],
  ['friction', 'GRIP', 0.1, 1, 0.01],
  ['debris', 'DEBRIS', 0, 60, 1],
  ['blast', 'BLAST RADIUS', 2, 20, 0.5],
];
$('#sliders').innerHTML =
  SL.map(
    ([k, name, lo, hi, st]) =>
      `<label class="sl"><span>${name}</span><input type="range" min="${lo}" max="${hi}" step="${st}" value="${PHYS[k]}" data-k="${k}"><output>${PHYS[k]}</output></label>`,
  ).join('') +
  `<label class="sl"><span>ROCKET SPEED</span><input type="range" min="30" max="200" step="5" value="${rocketSpeed}" data-k="speed"><output>${rocketSpeed}</output></label>` +
  '<p class="note">These are the race’s own numbers: change one and play a scenario again to see it. They reset when the page reloads.</p>';
$('#sliders').oninput = e => {
  const k = e.target.dataset.k;
  if (!k) return;
  const v = +e.target.value;
  if (k === 'speed') rocketSpeed = v;
  else PHYS[k] = v;
  e.target.nextElementSibling.textContent = v;
};

// the camera and what it looks at kept above the ground and inside the facility's walls (or near the start in the city)
function keepCam() {
  if (stage === 'city') {
    // low down, over the road: out past its barriers they'd fill the view
    const lc = root.worldToLocal(cam.position.clone());
    if (lc.y < 14 && Math.abs(lc.x) > 12) {
      lc.x = Math.sign(lc.x) * 12;
      cam.position.copy(root.localToWorld(lc));
    }
  }
  const g = root.position.y,
    lim = stage === 'city' ? 90 : stage === 'items' ? 40 : 150,
    o = root.position;
  for (const v of [orbit.target, cam.position]) {
    v.x = o.x + THREE.MathUtils.clamp(v.x - o.x, -lim, lim);
    v.z = o.z + THREE.MathUtils.clamp(v.z - o.z, -lim, lim);
  }
  orbit.target.y = Math.max(orbit.target.y, g + 0.3);
  cam.position.y = Math.max(cam.position.y, g + 1);
}
function resize() {
  const w = gl.clientWidth,
    h = gl.clientHeight;
  Rr.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  t += dt;
  const showing = stage === 'items';
  if (!showing && looping && t > (cur.len || 6.5)) play(cur);
  if (!showing)
    for (const [at, fn] of cur.at)
      if (t >= at && !done.has(fn)) {
        done.add(fn);
        fn();
      }
  stepShots(dt);
  for (const b of blinkers) {
    const on = Math.sin(now / 1000 * 12) > 0;
    b.light.visible = on;
    b.ring.material.opacity = 0.3 + (on ? 0.3 : 0);
  }
  // the action over, the drivers ease off (so nobody carries on down the stage into the canal)
  if (showing) stepShow(dt);
  else {
    if (t > (cur.coast ?? 2.6)) for (const c of cars) c.cruise = 0;
    for (const c of cars) {
      stepCar(c, dt);
      collideSolids(c, dt);
    }
    carsCollide();
  }
  stepCrates(dt);
  stepPlanks(dt);
  imp.update(
    dt,
    () => root.position.y,
    wp => inSolid(root.worldToLocal(wp.clone())),
  );
  fx.update(dt);
  updateChilis(dt);
  if (rippleT) rippleT.offset.set(rippleT.offset.x + dt * 0.04, rippleT.offset.y + dt * 0.02);
  keepCam();
  orbit.update();
  // the shake of a big hit (the race's): the camera knocked about for a moment, then put back
  const sh = V();
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.6);
    sh.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.9);
    cam.position.add(sh);
  }
  Rr.render(S, cam);
  cam.position.sub(sh);
}
useStage('plain');
if (import.meta.env.DEV) window.studio = { cars, play, SCEN }; // (dev: the tools look in)
requestAnimationFrame(frame);
