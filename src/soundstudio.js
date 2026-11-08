// The sound studio: one vehicle on a live 3D stage with Buddy at the wheel, driven by the same engine sound as the game.
// Hold the gas, brake, jump, drift, fire the nitro, or play a scene (cruising at 90, flat out through the gears, lifting
// off, a jump, being passed); the car acts it out (wheels, squat and dive, exhaust flames, crackle flashes, sparks,
// smoke) while you hear it. Switch between the Supra recording and our synthesised engine, tune either live, compare
// spectrums with the recording, and save the result for the game. Open /sound.html. A design tool, not in the build.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTextures, setAniso } from './textures.js';
import { makeKart, RACERS, ENV, setFace, DEFAULT_CUSTOM } from './buddy.js';
import { Sound, engineParams, ENGINE_BASE, VEHICLE_SOUND, engineMode } from './audio.js';
import { store } from './util.js';

const $ = s => document.querySelector(s);
const TOP = 66, KMH = 3.2;
let type = 'monster', speed = 0, gas = false, brake = false, airT = 0, drift = false, boostT = 0, scene = null, rival = null;

/* ---------- the stage ---------- */
const canvas = $('#gl'), R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.NeutralToneMapping; setAniso(8);
ENV.tex = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), .04).texture;
const S = new THREE.Scene(); S.background = new THREE.Color('#0a1028'); S.fog = new THREE.Fog('#0a1028', 26, 70);
S.add(new THREE.HemisphereLight('#dfe8ff', '#2a2440', 1.5));
const key = new THREE.DirectionalLight('#fff1dd', 3); key.position.set(6, 10, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); S.add(key);
const rim = new THREE.DirectionalLight('#6fa0ff', 2); rim.position.set(-6, 4, -8); S.add(rim);
const tex = buildTextures();
// the road under it, running past at the car's speed, kerbs either side
const roadT = tex.road.clone(); roadT.needsUpdate = true; roadT.wrapS = roadT.wrapT = THREE.RepeatWrapping; roadT.repeat.set(1, 6);
const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 120).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: roadT })); road.receiveShadow = true; S.add(road);
const kerbT = tex.curb.clone(); kerbT.needsUpdate = true; kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping; kerbT.repeat.set(1, 40);
for (const sx of [-1, 1]) { const k = new THREE.Mesh(new THREE.PlaneGeometry(2, 120).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: kerbT })); k.position.set(sx * 9, .01, 0); k.receiveShadow = true; S.add(k); }
const cam = new THREE.PerspectiveCamera(36, 16 / 9, .1, 200); cam.position.set(8, 3.2, 8.5);   // front three-quarter: Buddy, the face of the car, an exhaust
const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 1.2, 0); orbit.enableDamping = true; orbit.enablePan = false; orbit.minDistance = 6; orbit.maxDistance = 18; orbit.maxPolarAngle = Math.PI * .48;

// the car, rebuilt when you change vehicle
let car = null; const rig = new THREE.Group(); S.add(rig);
function buildCar(){
  if (car) rig.remove(car.root);
  car = makeKart(RACERS[0], tex, 14, type, DEFAULT_CUSTOM[type]);
  car.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.add(car.root); setFace(car, 'happy');
  const box = new THREE.Box3().setFromObject(car.root), h = box.getSize(new THREE.Vector3()).y;
  orbit.target.set(0, h * .45, 0); cam.position.setLength(Math.max(9, h * 3.2)).add(new THREE.Vector3(0, 0, 0));
}
// smoke puffs from the rear tyres and the exhaust
const puffT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const puffs = Array.from({ length: 60 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; S.add(s); return { s, life: 0, v: new THREE.Vector3() }; });
let puffI = 0;
function puff(at, col, size, vel){ const p = puffs[puffI++ % puffs.length]; p.s.position.copy(at); p.s.material.color.set(col); p.s.scale.setScalar(size); p.life = 1; p.v.copy(vel); p.s.visible = true; }
let popFlash = 0, bovPuff = 0;

/* ---------- controls ---------- */
$('#veh').innerHTML = Object.keys(VEHICLE_SOUND).map(v => `<button class="slant ${v === type ? 'on' : ''}" data-v="${v}">${v.toUpperCase()}</button>`).join('');
$('#veh').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; type = b.dataset.v; document.querySelectorAll('#veh button').forEach(x => x.classList.toggle('on', x === b)); buildCar(); buildSliders(); });
const paintMode = () => document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.m === engineMode()));
$('#mode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; store.set('engineMode', b.dataset.m); paintMode(); });
paintMode();

const SL = [['pitch', 'PITCH', .5, 1.6, .01], ['half', 'RUMBLE ½', 0, .3, .005], ['tone', 'BRIGHT', .4, 1.6, .01], ['load', 'LOAD OPEN', 0, 1, .01], ['rumble', 'EXHAUST', 0, 1.5, .01],
  ['rasp', 'RASP', 0, 1, .01], ['turbo', 'TURBO', 0, 1, .01], ['bov', 'BLOW-OFF', 0, 1, .01], ['pops', 'CRACKLE', 0, 1, .01], ['idle', 'IDLE RPM', 600, 1500, 10], ['redline', 'REDLINE', 5000, 9000, 50], ['vol', 'VOLUME', 0, 2, .01]];
let params = engineParams(type);
function buildSliders(){
  params = engineParams(type);
  $('#sliders').innerHTML = SL.map(([k, n, a, b, st]) => `<div class="sl"><span>${n}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${params[k]}"><output>${(+params[k]).toFixed(st < 1 ? 2 : 0)}</output></div>`).join('');
}
$('#sliders').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; params[k] = +e.target.value; e.target.nextElementSibling.textContent = (+e.target.value).toFixed(+e.target.step < 1 ? 2 : 0); });
const diff = () => { const base = { ...ENGINE_BASE, ...(VEHICLE_SOUND[type] || {}) }, out = {}; for (const [k] of SL) if (Math.abs(params[k] - base[k]) > 1e-6) out[k] = params[k]; return out; };
$('#save').onclick = () => { store.set('engineTune.' + type, diff()); $('#msg').textContent = `Saved ${type.toUpperCase()} (${engineMode() === 'supra' ? 'Supra' : 'our engine'}). The game uses it in this browser now.`; };
$('#reset').onclick = () => { store.remove('engineTune.' + type); buildSliders(); $('#msg').textContent = `${type.toUpperCase()} is back to its default sound.`; };
$('#copy').onclick = async () => { const txt = JSON.stringify({ mode: engineMode(), [type]: diff() }); try { await navigator.clipboard.writeText(txt); $('#msg').textContent = 'Copied: ' + txt; } catch { $('#msg').textContent = txt; } };

const start = () => { Sound.init(); };
const clearScene = () => { scene = null; rival = null; document.querySelectorAll('#scenes button').forEach(x => x.classList.remove('on')); };
const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.preventDefault(); start(); clearScene(); on(); el.classList.add('on'); }); const up = () => { off(); el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up); };
hold($('#gas'), () => { gas = true; }, () => { gas = false; });
hold($('#brk'), () => { brake = true; }, () => { brake = false; });
hold($('#dft'), () => { drift = true; }, () => { drift = false; });
$('#jmp').onclick = () => { start(); if (airT <= 0) airT = 1.35; };
$('#nit').onclick = () => { start(); boostT = 2.6; Sound.boost(); };
const keyMap = { Space: '#gas', KeyB: '#brk', KeyD: '#dft' };
addEventListener('keydown', e => { if (e.repeat) return; if (keyMap[e.code]) { e.preventDefault(); $(keyMap[e.code]).dispatchEvent(new PointerEvent('pointerdown')); } if (e.code === 'KeyJ') $('#jmp').click(); if (e.code === 'KeyN') $('#nit').click(); });
addEventListener('keyup', e => { if (keyMap[e.code]) $(keyMap[e.code]).dispatchEvent(new PointerEvent('pointerup')); });
$('#spd').addEventListener('input', e => { start(); clearScene(); speed = +e.target.value / KMH; });

// scenes: a script of what the driver does over time
const SCENES = [
  ['idle', 'IDLE', 'On the grid, a blip', t => ({ v0: 0, gas: (t > 1 && t < 1.3) || (t > 2.2 && t < 2.5), until: 4 })],
  ['cruise', 'CRUISE 90', 'Holding 90 km/h', t => ({ v0: 90, hold: 90, until: 8 })],
  ['flat', 'FLAT OUT', '0 to top, every gear', t => ({ v0: 0, gas: true, until: 11 })],
  ['lift', 'SLOW DOWN', 'Off the throttle at 180', t => ({ v0: 180, until: 7 })],
  ['brake', 'HARD BRAKE', 'From 160, stand on it', t => ({ v0: 160, brake: true, until: 3.5 })],
  ['jump', 'JUMP', 'Off a kicker at 130', t => ({ v0: 130, gas: true, jump: 1, until: 5 })],
  ['drift', 'DRIFT', 'A long slide at 110', t => ({ v0: 110, hold: 110, drift: t > .8 && t < 4.2, until: 5.5 })],
  ['nitro', 'NITRO', 'Bottle fired at 120', t => ({ v0: 120, gas: true, nitro: 1, until: 6 })],
  ['pass', 'OVERTAKE', 'You come past a rival', t => ({ v0: 150, hold: 165, rival: { at: -40, rel: -14 }, until: 7 })],
  ['passed', 'GET PASSED', 'A rival flies by you', t => ({ v0: 130, hold: 130, rival: { at: 40, rel: 18 }, until: 7 })],
];
// where each scene happens in the Supra recording (seconds); null = the recording has nothing like it
const REAL = { idle: [5.3, 7.2], cruise: [10.8, 16.4], flat: [.8, 5.1], lift: [18.6, 21.4], brake: null, jump: [7.6, 9.2], drift: [16.7, 19], nitro: [2.6, 5.1], pass: [22, 26.6], passed: null };
let listen = 'ours', realEnd = 0;
$('#listen').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; listen = b.dataset.l; document.querySelectorAll('#listen button').forEach(x => x.classList.toggle('on', x === b)); if (listen === 'ours') ref.pause(); });
function playReal(id){
  const r = REAL[id]; if (!r) { $('#msg2').textContent = 'The Supra recording has nothing for this scene: this one is ours alone.'; return false; }
  hookRef(); ref.currentTime = r[0]; realEnd = r[1]; ref.play(); $('#msg2').textContent = `Playing the recording, ${r[0].toFixed(1)}s to ${r[1].toFixed(1)}s.`; return true;
}
$('#scenes').innerHTML = SCENES.map(([id, n, sub]) => `<button data-s="${id}"><b>${n}</b><small>${sub.toUpperCase()}${REAL[id] ? '' : ' · NOT IN RECORDING'}</small></button>`).join('');
$('#scenes').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; start(); const sc = SCENES.find(s => s[0] === b.dataset.s), f0 = sc[3](0);
  scene = { fn: sc[3], t: 0, fired: false }; speed = f0.v0 / KMH; rival = f0.rival ? { dist: -f0.rival.at, rel: f0.rival.rel, car: null } : null;
  document.querySelectorAll('#scenes button').forEach(x => x.classList.toggle('on', x === b));
  if (listen === 'real') playReal(sc[0]); else { ref.pause(); $('#msg2').textContent = ''; } });

// the rival in the overtake scenes: a second car in the next lane
let rivalCar = null;
function rivalMesh(){ if (rivalCar) return rivalCar; rivalCar = makeKart(RACERS[1], tex, 10, type === 'monster' ? 'muscle' : 'monster'); rivalCar.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); setFace(rivalCar, 'laugh'); S.add(rivalCar.root); return rivalCar; }

/* ---------- spectrograms ---------- */
function spectro(cv, an){
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, d = new Uint8Array(an.frequencyBinCount);
  return () => { an.getByteFrequencyData(d); x.drawImage(cv, -2, 0); const binHz = an.context.sampleRate / 2 / d.length;
    for (let y = 0; y < H; y++) { const f = 40 * Math.pow(6000 / 40, 1 - y / H), v = d[Math.min(d.length - 1, Math.round(f / binHz))] / 255; x.fillStyle = `hsl(${30 + (1 - v) * 220}, 100%, ${Math.round(v * v * 62)}%)`; x.fillRect(W - 2, y, 2, 1); } };
}
let anOurs = null, drawOurs = null, anRef = null, drawRef = null; const ref = $('#ref');
function hookRef(){ start(); if (!anRef) { anRef = Sound.ctx.createAnalyser(); anRef.fftSize = 4096; const src = Sound.ctx.createMediaElementSource(ref); src.connect(anRef); anRef.connect(Sound.master); drawRef = spectro($('#specRef'), anRef); } }   // through the game's own volume, so the comparison is level
$('#refPlay').onclick = () => { realEnd = 0; hookRef(); ref.currentTime = 0; ref.play(); };
$('#refStop').onclick = () => ref.pause();

/* ---------- the loop ---------- */
buildCar(); buildSliders();
let last = performance.now(), pitchV = 0, pitch = 0, yaw = 0, hopY = 0, hopV = 0, wasAir = false, hookedVoice = null;
const v3 = new THREE.Vector3();
function resize(){ const r = canvas.getBoundingClientRect(); if (canvas.width !== Math.round(r.width * R.getPixelRatio())) { R.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); } }
function tick(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now; resize();
  let thr = gas ? 1 : 0, brk = brake, dr = drift;
  if (scene) {
    scene.t += dt; const f = scene.fn(scene.t);
    thr = f.gas ? 1 : 0; brk = !!f.brake; dr = !!f.drift;
    if (f.hold != null) { const want = f.hold / KMH; thr = speed < want ? 1 : .3; if (speed > want + .5) speed -= dt * 6; }
    if (!scene.fired && scene.t > 1) { scene.fired = true; if (f.jump) airT = 1.35; if (f.nitro) { boostT = 2.6; Sound.boost(); } }
    if (f.until && scene.t > f.until) clearScene();
  }
  const inAir = airT > 0, bst = boostT > 0; airT -= dt; boostT -= dt;
  const top = TOP * (bst ? 1.2 : 1), prev = speed;
  if (!inAir) speed += (thr * 27 * (1 - speed / top) * (bst ? 1.6 : 1) - (brk ? 70 : 0) - (thr ? 0 : 6) - (dr ? 4 : 0)) * dt;
  speed = Math.max(0, Math.min(top, speed)); const acc = (speed - prev) / Math.max(dt, 1e-3);

  // the sound
  if (Sound.ctx) {
    const hearReal = listen === 'real' && !ref.paused;
    if (realEnd && ref.currentTime >= realEnd) { ref.pause(); realEnd = 0; }
    Sound.drive({ type, speed: speed / TOP, throttle: thr, brake: brk, air: inAir, drift: dr, boost: bst, running: !hearReal }, dt);
    const v = Sound.voice;
    if (v) { if (v.p !== params) v.set(params); if (hookedVoice !== v) { hookedVoice = v; v.onPop = () => { popFlash = .07; }; v.onBov = () => { bovPuff = .25; }; } }
    if (rival) { rival.dist += rival.rel * dt; Sound.rivals([{ type: type === 'monster' ? 'muscle' : 'monster', speed: (speed + rival.rel) / TOP, dist: rival.dist, side: .7, rel: rival.rel }], dt); } else Sound.rivals([], dt);
    if (!anOurs) { anOurs = Sound.ctx.createAnalyser(); anOurs.fftSize = 4096; Sound.master.connect(anOurs); drawOurs = spectro($('#specOurs'), anOurs); }
  }
  drawOurs?.(); if (!ref.paused) drawRef?.();

  // the car acts it out
  if (car) {
    const rpmN = Sound.voice ? (Sound.voice.rpm - params.idle) / (params.redline - params.idle) : 0;
    roadT.offset.y -= speed * dt / 20; kerbT.offset.y -= speed * dt / 3;                             // the road runs under it
    for (const w of car.wheels) w.spin.rotation.x += (speed + (inAir && thr ? 25 : 0)) * dt / (w.r || .4);
    // squat under power, dive under braking, on a spring
    const wantPitch = THREE.MathUtils.clamp(-acc * .0035, -.07, .09) + (brk && speed > 1 ? .07 : 0);
    pitchV += ((wantPitch - pitch) * 60 - pitchV * 9) * dt; pitch += pitchV * dt;
    // the jump: up, a float, down with a squash
    if (inAir && !wasAir) hopV = 9; wasAir = inAir;
    if (hopY > 0 || hopV > 0) { hopV -= 30 * dt; hopY += hopV * dt; if (hopY <= 0) { hopY = 0; hopV = 0; Sound.land(.7); pitchV += 1.4; for (let i = 0; i < 6; i++) puff(v3.set((Math.random() - .5) * 3, .3, (Math.random() - .5) * 3), '#d8c8a8', 1.5, new THREE.Vector3((Math.random() - .5) * 3, 1, -2)); } }
    yaw += ((dr ? .5 : 0) - yaw) * Math.min(1, dt * 4);
    const shake = Sound.voice ? (.006 + rpmN * .01) * (thr ? 1 : .5) : 0;
    rig.position.y = hopY + (Math.random() - .5) * shake; rig.rotation.set(pitch + (hopY > 0 ? -hopV * .012 : 0), yaw, (Math.random() - .5) * shake * .6);
    for (const p of car.steer || []) p.rotation.y = dr ? -.35 : 0;
    // exhaust: flames on nitro, a flash on each crackle, a puff on the blow-off
    car.flames.forEach((fl, j) => {
      const on = bst || popFlash > 0;
      fl.visible = on; if (on) { fl.material.color.set(bst ? car.nitroCol : '#ff8a2a'); const len = bst ? 1.1 + Math.random() * .7 : .5 + Math.random() * .4; fl.scale.set(bst ? 1.2 : .8, len, bst ? 1.2 : .8); }
      if (bovPuff > 0 && Math.random() < .5) { car.pipes[j].getWorldPosition(v3); puff(v3, '#c8ccd8', .5, new THREE.Vector3((Math.random() - .5), .6, -1.5)); }
    });
    popFlash -= dt; bovPuff -= dt;
    // drift: sparks and tyre smoke from the back wheels
    for (const s of car.sparks) { s.visible = dr && speed > 5; if (s.visible) { s.material.color.set('#ff9a1f'); const sc = .7 + Math.random() * .6; s.scale.set(sc, sc, 1); } }
    if (((dr && speed > 5) || (brk && speed > 15)) && Math.random() < .6) for (const sx of [-1, 1]) puff(car.root.localToWorld(v3.set(sx * 1.2, .3, -1.6)), '#e8e8ee', 1 + Math.random(), new THREE.Vector3(sx * .8, .8, -speed * .15));
    // Buddy reacts
    car.robot.update(dt, { t: now / 1000, steer: dr ? .8 : 0, boost: bst, air: inAir ? 1 : 0, wheel: car.wheelRing, wheelR: car.wheelR, speed: Math.min(1, speed / TOP) });
    setFace(car, inAir ? 'laugh' : bst ? 'happy' : brk && speed > 10 ? 'hit' : speed > 30 ? 'happy' : 'calm');
    // the rival lane
    if (rival) { const rc = rivalMesh(); rc.root.visible = true; rc.root.position.set(-5.5, 0, rival.dist * .5); for (const w of rc.wheels) w.spin.rotation.x += (speed + rival.rel) * dt / (w.r || .4); }
    else if (rivalCar) rivalCar.root.visible = false;
    // the gauges
    const kmh = Math.round(speed * KMH);
    $('#kmh').textContent = kmh; $('#gear').textContent = Sound.voice ? Sound.voice.gear + 1 : 'N';
    $('#rpm').textContent = (Sound.voice ? Math.round(Sound.voice.rpm / 50) * 50 : 0) + ' RPM';
    $('#tachArc').setAttribute('stroke-dasharray', `${Math.max(0, Math.min(1, Sound.voice ? Sound.voice.rpm / (params.redline * 1.05) : 0)) * 100} 100`);
    const st = !Sound.ctx ? 'TAP A SCENE OR HOLD GAS' : inAir ? 'IN THE AIR' : bst ? 'NITRO' : dr ? 'DRIFTING' : brk && speed > 1 ? 'BRAKING' : rival ? (rival.rel < 0 ? 'OVERTAKING' : 'BEING PASSED') : thr > .5 ? 'ON THROTTLE' : speed > 1 ? 'COASTING' : 'IDLE';
    $('#state').textContent = st; $('#state').classList.toggle('hot', ['NITRO', 'IN THE AIR', 'DRIFTING'].includes(st));
    if (document.activeElement !== $('#spd')) $('#spd').value = kmh; $('#spdO').textContent = kmh;
  }
  for (const p of puffs) if (p.life > 0) { p.life -= dt * 1.2; p.s.position.addScaledVector(p.v, dt); p.s.scale.multiplyScalar(1 + dt * 1.5); p.s.material.opacity = Math.max(0, p.life) * .5; if (p.life <= 0) p.s.visible = false; }
  orbit.update(); R.render(S, cam);
  requestAnimationFrame(tick);
}
// keep each slider's stripe fill at its value
const fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
document.addEventListener('input', e => { if (e.target.type === 'range') fill(e.target); });
setInterval(() => document.querySelectorAll('input[type=range]').forEach(fill), 100);   // (the speed bar moves on its own)
window.__sound = Sound;   // for poking at from the console
requestAnimationFrame(tick);
