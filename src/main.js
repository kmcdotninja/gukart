import { ICON } from './icons.js';
import { Haptics } from './haptics.js';
import { screenIn, screenOut, stagger, leave, enter, DUR, EASE } from './motion.js';
import { ModesRoom } from './modesroom.js';
import { Feedback } from './feedback.js';
import { perfHud } from './perf.js';
import { Tilt } from './tilt.js';
document.documentElement.classList.remove('booting');   // the styles are in (imported above): lift the navy first-frame cover (index.html)
import './style.css';
import './screens.css';
import * as THREE from 'three';
import { buildTextures, setAniso } from './textures.js';
import { buildTrack, buildRoad, buildForks, buildForkRoads } from './track.js';
import { buildWorld } from './world.js';
import { Race, LAPS, WEAPONS, VSTATS } from './race.js';
import { SUN, VEHICLES, ENV, clearance, PARTS, DEFAULT_CUSTOM, decalTex, plateTex, makeKart, RACERS } from './buddy.js';
import { Garage, vehicleThumbs, partThumbs, racerPortraits } from './garage.js';
import { buildMap } from './mapscreen.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHAPTERS } from './chapters.js';
import { dressDoha } from './doha.js';
import { Sound } from './audio.js';
import { clamp, lerp, isTouch, store, fmtTime, ordinal } from './util.js';

const $ = s => document.querySelector(s);
const low = isTouch || Math.min(screen.width, screen.height) < 700;
const quality = { layers: low ? 10 : 14, aiLayers: low ? 6 : 9, shadow: low ? 1024 : 2048, dpr: Math.min(devicePixelRatio, low ? 1.75 : 2) };

/* ---------- renderer, scene, light ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.dpr);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;   // keeps the hues true and saturated (ACES bleached the reds to pink)
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e9d9bf', 140, 1700);   // a warm harmattan haze: near enough to give the city depth
const cam = new THREE.PerspectiveCamera(65, 1, .5, 7000);
scene.add(new THREE.HemisphereLight('#cfe2ff', '#8a6a48', 1.35));
const sun = new THREE.DirectionalLight('#ffe2b8', 3.6);
sun.castShadow = true; sun.shadow.mapSize.set(quality.shadow, quality.shadow);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 420 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
// day or night: the sun becomes moonlight, the light drops and cools, the city and the karts' headlights come on
let night = 0;
const hemi = scene.children.find(o => o.isHemisphereLight);
function setNight(on){
  night = on ? 1 : 0;
  // Kano's night is dark: moonlight and lamplit windows. Doha's is a big city's: the sky glows, the streets are lit end to
  // end, the towers blaze, so the light is brighter and warmer and the haze is a lit purple rather than black
  const city = on && chapter.id === 'doha';
  sun.color.set(on ? (city ? '#b4bfff' : '#8fa8ff') : '#ffe2b8'); sun.intensity = on ? (city ? 1.5 : 1.0) : 3.6;
  hemi.color.set(on ? (city ? '#9a90d8' : '#4a5f9e') : '#cfe2ff'); hemi.groundColor.set(on ? (city ? '#6a4a34' : '#3a2a1c') : '#8a6a48'); hemi.intensity = on ? (city ? 1.75 : 1.05) : 1.35;
  scene.fog.color.set(on ? (city ? '#2c2148' : '#0a0f22') : '#e9d9bf'); scene.environmentIntensity = on ? (city ? .7 : .45) : 1;
  renderer.toneMappingExposure = on ? (city ? 1.4 : 1.3) : 1.0;
  world?.setNight(night); race?.setNight?.(night);
  $('#nightBtn')?.classList.toggle('on', on); store.set('night', on);
}
// studio reflections for the vehicles' paint and chrome
ENV.tex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
let garage = null, modesRoom = null;
function resize(){ renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); garage?.resize(cam.aspect); modesRoom?.resize(cam.aspect); }
addEventListener('resize', resize); resize();

/* ---------- HUD ---------- */
const hud = {
  pos: $('#pos'), posSfx: $('#posSfx'), lap: $('#lap'), coins: $('#coins'), kos: $('#kos'), timer: $('#timer'), score: $('#score'), combo: $('#combo'),
  weapon: $('#weapon'), wicon: $('#wicon'), wname: $('#wname'), wammo: $('#wammo'), center: $('#center'), wrong: $('#wrong'),
  toasts: $('#toasts'), map: $('#minimap'), speed: $('#speed'), lines: $('#speedlines'), prog: $('#progFill'),
};
const ICONS = {
  blaster: '<svg viewBox="0 0 48 48"><path d="M6 20h26l6-4h4v16h-4l-6-4H6z" fill="currentColor"/><path d="M12 28v8h8l2-8" fill="currentColor" opacity=".7"/></svg>',
  rocket: '<svg viewBox="0 0 48 48"><path d="M8 24l10-8h18c4 0 6 4 6 8s-2 8-6 8H18z" fill="currentColor"/><path d="M8 24l-4-6v12z" fill="#ffc400"/></svg>',
  shock: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 10l-8 16h8l-4 12 10-18h-8z" fill="currentColor"/></svg>',
  mines: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="30" rx="16" ry="6" fill="currentColor"/><path d="M8 30v-4c0-4 7-7 16-7s16 3 16 7v4" fill="currentColor" opacity=".8"/><circle cx="24" cy="17" r="3" fill="#ff2b2b"/></svg>',
  yaji: '<svg viewBox="0 0 48 48"><path d="M30 10c4-4 9-3 10 1" stroke="#7bd36a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M32 14c6 6 2 18-8 24S6 42 8 38s14-6 18-14 2-12 6-10z" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 48 48"><path d="M24 5l16 6v11c0 10-7 18-16 21C15 40 8 32 8 22V11z" fill="currentColor"/><path d="M24 12l9 3.5v6.8c0 6-4 10.8-9 12.7z" fill="#fff" opacity=".45"/></svg>',
};
let rollingIcon = false, rollFlip = 0;
function setWeapon(w, ammo, rolling){
  rollingIcon = rolling;
  hud.weapon.classList.toggle('empty', !w && !rolling);
  hud.weapon.classList.toggle('rolling', rolling);
  if (rolling) { hud.wname.textContent = 'LOADING'; hud.wammo.textContent = ''; return; }
  hud.wicon.innerHTML = w ? ICONS[w] : '';
  hud.wicon.style.color = w ? WEAPONS[w].color : '';
  hud.wname.textContent = w ? WEAPONS[w].name.toUpperCase() : 'NO WEAPON';
  hud.wammo.textContent = w ? `×${ammo}` : '';
}
function toast(label, pts){
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = pts ? `<span>${label}</span><b>+${pts}</b>` : `<span>${label}</span>`;
  hud.toasts.prepend(el); setTimeout(() => el.remove(), 1700);
  while (hud.toasts.children.length > 3) hud.toasts.lastChild.remove();
}
let centerTimer = 0;
function banner(text, kind = '', ms = 1200){
  hud.center.className = 'center ' + kind;
  hud.center.innerHTML = `<span class="pop">${text}</span>`;
  clearTimeout(centerTimer); if (ms) centerTimer = setTimeout(() => { hud.center.innerHTML = ''; }, ms);
}
const events = {
  score(total, combo, label, got){
    hud.score.textContent = total.toLocaleString('en');
    hud.combo.textContent = combo >= 2 ? `×${combo}` : '';
    if (label && label !== 'Coin' && label !== 'Crate' && label !== 'Hit') toast(label, got);
  },
  weapon: setWeapon,
  coins(n, at){ if (at) { flyCoin(at); Haptics.coin(); } else hud.coins.textContent = n; },
  lap(n){ hud.lap.textContent = mode === 'free' ? n : `${n}/${LAPS}`; banner(mode !== 'free' && n === LAPS ? 'FINAL LAP' : `LAP ${n}`, 'small'); Sound.beep(true); Haptics.big(); },
  // Time trial: every time over the line closes a lap; a new best lap becomes the ghost you chase
  cross(lap, t){
    if (mode !== 'tt' || lap <= TT.last) return;
    if (TT.last >= 0) {
      const lt = t - TT.start, best = store.get('bestlap.' + RID, null); TT.laps.push(lt);
      if (!best || lt < best) { TT.newBest = true; store.set('bestlap.' + RID, lt); TT.ghost = { d: lt, s: TT.rec }; store.set('ghost.' + RID, TT.ghost); setTimeout(() => banner('BEST LAP', 'ko', 1100), 900); Haptics.big(); }
      toast(`Lap ${TT.laps.length} · ${fmtTime(lt)}`);
    }
    TT.last = lap; TT.start = t; TT.rec = []; TT.recT = 0;
  },
  finish(){
    state = 'finish'; finishAt = clock; Sound.beep(true); Haptics.big(); hide($('#hud'));
    const p = race.player, el = $('#youCame');
    el.innerHTML = mode === 'tt' ? `<span>${TT.newBest ? 'NEW BEST LAP' : 'YOUR TIME'}</span><b class="tm">${fmtTime(TT.laps.reduce((a, b) => a + b, 0))}</b>` : `<span>YOU CAME</span><b>${p.rank}<em>${ordinal(p.rank)}</em></b>`; show(el);
    // Buddy celebrates in his seat: pops up and spins, a backflip, then cheers
    const moves = p.rank === 1 ? [['flip', 1.15], ['pop', .9], ['flip', 1.15], ['cheer', 9]] : p.rank <= 3 ? [['pop', .9], ['flip', 1.15], ['cheer', 9]] : [['sad', 9]];
    el.classList.toggle('low', p.rank > 3);
    let t = 0; for (const [m, d] of moves) { setTimeout(() => { p.move = null; p.moveT = 0; race.act(p, m, d); if (m === 'flip') { p.move = 'flip'; } }, t * 1000); t += Math.min(d, 1.2); }
    setTimeout(() => hide(el, null, -1), 4600); setTimeout(showResults, 5200);
  },
  takedown(name, n){ hud.kos.textContent = n; banner('TAKEDOWN', 'ko', 900); },
  flash(text){ banner(text.toUpperCase(), 'ko', 700); },
  toast,
  hurt(){ Haptics.hit(); },
  shield(){ Haptics.boost(); },
  nitro(v){ $('#nLiq').style.transform = `translateY(${(46 * (1 - Math.max(0, Math.min(1, v)))).toFixed(1)}px)`; $('#nitroBtn').classList.toggle('ready', v >= .3); },
};

// the race running behind the home screen raises the same events; nobody needs to hear them
const QUIET = { score(){}, weapon(){}, coins(){}, lap(){}, finish(){}, takedown(){}, flash(){}, toast(){}, hurt(){}, shield(){}, nitro(){} };

/* ---------- transitions, after GRIP: the scene whips sideways in a motion blur and the panel arrives out of it ---------- */
function wipe(swap){ const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); setTimeout(swap, 300); setTimeout(() => w.classList.remove('go'), 680); }
function whip(dir = 1){ canvas.style.setProperty('--wd', dir); canvas.classList.remove('whip'); void canvas.offsetWidth; canvas.classList.add('whip'); }
function show(el, dir = 1){
  el.hidden = false; el.style.setProperty('--wd', dir); el.classList.remove('leave', 'enter'); void el.offsetWidth; el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 420);
}
// one menu card to the next in the same spot (pause > controls, pause > settings and back): no new overlay
function swap(from, to, dir = 1){
  // one menu card to the next in the same spot (pause > controls, pause > settings and back), in sequence so two cards
  // never overlap: the old card leaves the way you're going, then the new one arrives from the other side (motion.js)
  if (swap.busy) return; swap.busy = true;
  const out = from.querySelector('.card'), inc = to.querySelector('.card');
  for (const el of [from, to]) el.classList.remove('enter', 'leave');
  leave(out, `translateX(${-dir * 40}px)`, { dur: 130 }).finished.then(a => {
    to.hidden = false; from.hidden = true; a.cancel?.();
    enter(inc, { from: dir > 0 ? 'right' : 'left', dur: 260 }).finished.then(() => { swap.busy = false; });
  });
}
function hide(el, then, dir = 1){
  if (el.hidden) { then?.(); return; }
  el.style.setProperty('--wd', dir); el.classList.remove('enter'); el.classList.add('leave');
  setTimeout(() => { el.hidden = true; el.classList.remove('leave'); then?.(); }, 200);
}
// the round speed gauge: its arc fills with speed and glows orange on a boost
const gArc = $('#gArc'), speedoEl = document.querySelector('.speedo'), GLEN = 245;
function gauge(kmh, boost){ gArc.style.strokeDashoffset = (GLEN * (1 - clamp(kmh / 320, 0, 1))).toFixed(1); speedoEl.classList.toggle('boost', boost); }
// a picked-up coin flies from where it was on the road up into the counter
function flyCoin(world){
  const v = new THREE.Vector3().copy(world).project(cam), x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight;
  const to = $('#coinChip .coin-icon').getBoundingClientRect(), el = document.createElement('i');
  el.className = 'coin-icon flycoin'; el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.append(el);
  requestAnimationFrame(() => { el.style.transform = `translate(${to.left + to.width / 2 - x}px, ${to.top + to.height / 2 - y}px) scale(.8)`; });
  setTimeout(() => { el.remove(); hud.coins.textContent = race.player.coins; const c = $('#coinChip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }, 560);
}

/* ---------- minimap ---------- */
let mapTf = null, mapPts = null;
function drawMap(){
  const c = hud.map, x = c.getContext('2d'), w = c.width;
  if (!mapPts) {
    const b = track.box, s = (w - 40) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    mapTf = (px, pz) => [w / 2 - (px - (b.min.x + b.max.x) / 2) * s, w / 2 - (pz - (b.min.z + b.max.z) / 2) * s];
    mapPts = track.P.map((p, i) => [...mapTf(p.x, p.z), track.closed && track.closed[i] ? 99 : p.y]);
  }
  x.clearRect(0, 0, w, w); x.lineJoin = x.lineCap = 'round';
  const path = (filter) => { x.beginPath(); let on = false; mapPts.forEach(([a, b, y]) => { const ok = filter(y); if (ok && on) x.lineTo(a, b); else if (ok) x.moveTo(a, b); on = ok; }); };
  // ground first, then the flyover over it
  path(y => y < 3 || y === 99 ? y !== 99 && y < 3 : false); x.strokeStyle = 'rgba(8,14,40,.65)'; x.lineWidth = 18; x.stroke(); x.strokeStyle = 'rgba(244,247,255,.92)'; x.lineWidth = 8; x.stroke();
  path(y => y >= 3); x.strokeStyle = 'rgba(8,14,40,.65)'; x.lineWidth = 20; x.stroke(); x.strokeStyle = '#6fd3ff'; x.lineWidth = 8; x.stroke();
  path(y => y < -6); x.setLineDash([6, 6]); x.strokeStyle = '#ff6a00'; x.lineWidth = 6; x.stroke(); x.setLineDash([]);   // the underpass
  for (const f of track.forks || []) { x.beginPath(); f.P.forEach((q, i) => { const [a2, b2] = mapTf(q.x, q.z); i ? x.lineTo(a2, b2) : x.moveTo(a2, b2); }); x.setLineDash(f.tunnel ? [5, 5] : []); x.strokeStyle = f.tunnel ? '#ff6a00' : 'rgba(244,247,255,.92)'; x.lineWidth = 6; x.stroke(); x.setLineDash([]); }
  const [sx, sy] = mapPts[0]; x.fillStyle = '#ff6a00'; x.fillRect(sx - 9, sy - 3, 18, 6);
  for (const k of [...race.karts].reverse()) {
    const p = k.m.root.position, [a, b] = mapTf(p.x, p.z), me = k === race.player;
    x.beginPath(); x.arc(a, b, me ? 11 : 7.5, 0, Math.PI * 2); x.fillStyle = k.color; x.fill();
    x.lineWidth = me ? 4 : 2.5; x.strokeStyle = me ? '#ffffff' : '#0b1330'; x.stroke();
  }
}

/* ---------- input ---------- */
const keys = {};
let touchSteer = 0, touchId = null, x0 = 0, kbSteer = 0, driftTouch = false, brakeTouch = false, fireTouch = false, btnSteer = 0, btnTarget = 0, hardT = 0;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (['KeyF', 'KeyE', 'KeyJ'].includes(e.code) && state === 'race') race.input.firePressed = true;
  if (['ArrowUp', 'KeyW', 'KeyN'].includes(e.code) && state === 'race') race.input.nitroPressed = true;
  if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code) && state === 'race') race.input.driftPressed = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'menu') startRace();
});
addEventListener('keyup', e => { keys[e.code] = false; });
let gDrag = null;
canvas.addEventListener('pointerdown', e => { if (state === 'garage') gDrag = e.clientX; });
addEventListener('pointermove', e => { if (gDrag !== null && state === 'garage') { garage.spin(e.clientX - gDrag); gDrag = e.clientX; } });
addEventListener('pointerup', () => { gDrag = null; });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || touchId !== null) return;
  touchId = e.pointerId; x0 = e.clientX; canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== touchId) return;
  const range = Math.min(innerWidth, 600) * .17;
  let dx = e.clientX - x0;
  if (Math.abs(dx) > range) { x0 = e.clientX - Math.sign(dx) * range; dx = Math.sign(dx) * range; }
  touchSteer = clamp(-dx / range, -1, 1);
});
const endTouch = e => { if (e.pointerId === touchId) { touchId = null; touchSteer = 0; } };
canvas.addEventListener('pointerup', endTouch); canvas.addEventListener('pointercancel', endTouch);
function holdButton(el, on, off){
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('on'); on(); });
  // (lostpointercapture only counts on the button itself: it also fires, and bubbles up, when the press moves from the
  // icon inside to the button, which switched the arrows and the pedal straight back off)
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, e => { if (ev === 'lostpointercapture' && e.target !== el) return; el.classList.remove('on'); off(); });
}
holdButton($('#brakeBtn'), () => { brakeTouch = true; }, () => { brakeTouch = false; });   // the brake: hold to slow, keep holding to reverse
holdButton($('#nitroBtn'), () => { if (state === 'race') race.input.nitroPressed = true; }, () => {});
holdButton($('#fireBtn'), () => { fireTouch = true; if (state === 'race') race.input.firePressed = true; }, () => { fireTouch = false; });
hud.weapon.addEventListener('pointerdown', () => { if (state === 'race') race.input.firePressed = true; });
// the steer buttons: holding one eases the steering in, like turning a wheel
holdButton($('#leftBtn'), () => { btnTarget = 1; }, () => { if (btnTarget > 0) btnTarget = 0; });
holdButton($('#rightBtn'), () => { btnTarget = -1; }, () => { if (btnTarget < 0) btnTarget = 0; });
document.addEventListener('touchmove', e => { if (state !== 'menu' && !e.target.closest?.('.m-cards, .cust-grid, .sheet .card')) e.preventDefault(); }, { passive: false });   // scrollable lists keep their swipe
document.addEventListener('contextmenu', e => e.preventDefault());
function readInput(dt){
  const kb = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0);
  kbSteer += (kb - kbSteer) * Math.min(1, dt * (kb ? 9 : 14));
  const inp = race.input;
  btnSteer += (btnTarget - btnSteer) * Math.min(1, dt * (btnTarget ? 7 : 14));
  inp.steer = clamp(kbSteer + touchSteer + btnSteer + (Tilt.on ? Tilt.value() : 0), -1, 1);
  // on a phone, holding a turn at speed drifts by itself (let go of the turn to fire the boost)
  const hard = Math.abs(btnSteer + touchSteer + (Tilt.on ? Tilt.value() : 0)) > .85 && race.player.speed > 28;
  hardT = hard ? hardT + dt : 0;
  inp.drift = !!(keys.Space || keys.ShiftLeft || keys.ShiftRight || driftTouch || hardT > .35);
  inp.fire = !!(keys.KeyF || keys.KeyE || keys.KeyJ || fireTouch);
  inp.brake = !!(keys.ArrowDown || keys.KeyS || brakeTouch);
}

/* ---------- first-race coach: points at each control the first time you need it ---------- */
const coach = { step: null, t: 0, done: 0, el: $('#coach'), text: $('#coachText') };
const COACH = {
  steer: { touch: `HOLD ${ICON.left}${ICON.right} TO STEER`, keys: `${ICON.left}${ICON.right} TO STEER`, at: '#steerPad', btn: ['#leftBtn', '#rightBtn'] },
  brake: { touch: 'HOLD THE BRAKE TO SLOW DOWN', keys: 'HOLD DOWN TO BRAKE', at: '#brakeBtn', btn: ['#brakeBtn'] },
  drift: { touch: 'HOLD THE TURN TO DRIFT, LET GO TO BOOST', keys: 'HOLD SPACE IN A TURN, LET GO TO BOOST', at: '#steerPad', btn: ['#leftBtn', '#rightBtn'] },
  fire: { touch: 'TAP FIRE TO SHOOT', keys: 'PRESS F TO FIRE', at: '#fireBtn', btn: ['#fireBtn'] },
};
function coachShow(step){
  if (coach.seen?.[step]) return;
  coach.step = step; coach.t = 0; coach.done = 0;
  const c = COACH[step], el = coach.el;
  document.querySelectorAll('.hint').forEach(b => b.classList.remove('hint'));
  coach.text.innerHTML = Tilt.on && step === 'steer' ? 'TILT YOUR PHONE TO STEER' : isTouch ? c.touch : c.keys;   // (our own strings: they carry the arrow icons)
  el.classList.toggle('swipe', false);
  if (isTouch && !(Tilt.on && c.at === '#steerPad')) {
    const r = $(c.at).getBoundingClientRect();
    el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top - (c.at === '#steerPad' ? 190 : 96)) + 'px';
    c.btn.forEach(q => $(q).classList.add('hint'));
  } else { el.style.left = '50%'; el.style.top = '19%'; }   // up in the sky, clear of your kart and the road ahead
  el.querySelector('.hand').style.display = isTouch ? '' : 'none';
  el.hidden = false;
}
function coachEnd(){
  if (!coach.step) return;
  coach.seen[coach.step] = true; store.set('coach', coach.seen);
  coach.step = null; coach.el.hidden = true;
  document.querySelectorAll('.hint').forEach(b => b.classList.remove('hint'));
}
function coachUpdate(dt){
  if (!coach.seen) return;
  const p = race.player, inp = race.input;
  if (!coach.step) {
    if (!coach.seen.steer && (state === 'count' || state === 'race')) coachShow('steer');
    else if (!coach.seen.brake && state === 'race' && race.time > 4 && isTouch) coachShow('brake');
    else if (!coach.seen.drift && state === 'race' && race.time > 5 && Math.abs(track.K[track.idx(p.s)]) > .008) coachShow('drift');
    else if (!coach.seen.fire && state === 'race' && p.weapon) coachShow('fire');
    return;
  }
  coach.t += dt;
  // each prompt goes once you've done it (or after a while, so it never nags)
  if (coach.step === 'steer' && state === 'race') { if (Math.abs(inp.steer) > .5) coach.done += dt; if (coach.done > .4 || coach.t > 12) coachEnd(); }
  else if (coach.step === 'brake') { if (inp.brake) coach.done += dt; if (coach.done > .3 || coach.t > 6) coachEnd(); }
  else if (coach.step === 'drift') { if (p.drift) coach.done += dt; if (coach.done > .6 || coach.t > 8) coachEnd(); }
  else if (coach.step === 'fire') { if (!p.weapon || coach.t > 8) coachEnd(); }
}

/* ---------- camera ---------- */
const camPos = new THREE.Vector3(0, 400, 600), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
const want = new THREE.Vector3(), wantLook = new THREE.Vector3(), wantUp = new THREE.Vector3();
const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3() }, fwd = new THREE.Vector3();
let camRh = 0, lastShot = -1, shadowSpan = 70, loopW = 0, upRate = 6;
const camBack = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3(), i: 0 }, camAhead = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3(), i: 0 };
let finishAt = 0; const W2C = 13;
const director = { shot: 'drone', t0: -99, k: null, ev: null, anchor: null, cut: null };
function updateCamera(dt){
  const k = race.player, kp = k.m.root.position;
  let rate = 8;
  if (state === 'intro') {
    // a slow drone sweep down the starting grid, from high in front of the gate to low behind the pack
    introT += dt; const u = Math.min(1, introT / (INTRO - .3)), e2 = u * u * (3 - 2 * u), wide = cam.aspect < 1 ? 1.5 : 1;
    track.frame(track.len - 20, F);
    want.copy(F.p).addScaledVector(F.t, (40 - e2 * 46) * wide).addScaledVector(F.l, (-18 + e2 * 12) * wide).addScaledVector(F.u, (22 - e2 * 15) * wide);
    wantLook.copy(F.p).addScaledVector(F.t, 4).addScaledVector(F.u, 1); wantUp.set(0, 1, 0); rate = introT < .1 ? 60 : 4;
  } else if (state === 'tomap' || state === 'map') {
    const C = track.center; fly.t += dt;
    if (mapFly) {   // flying to another island: rise, cross the sea, settle over it
      mapFly.t = Math.min(1, mapFly.t + dt / mapFly.dur); const t = mapFly.t, e = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      mapPan.x = mapFly.a.x + (mapFly.b.x - mapFly.a.x) * e; mapPan.z = mapFly.a.z + (mapFly.b.z - mapFly.a.z) * e;
      mapPan.h = mapFly.a.h + (mapFly.b.h - mapFly.a.h) * e + Math.sin(Math.PI * e) * mapFly.lift;
      if (t >= 1) { const done = mapFly.done; mapFly = null; done?.(); }
    }
    const mh = mapPan.h || track.radius * 2.25;
    // a false-3D aerial: the camera stands back to the south and looks down at about 50 degrees, so the island reads
    // as land with height, the far coast and sea melt into haze, north still at the top of the screen
    const tilt = .68, d = mh * 1.3;
    wantLook.set(C.x + mapPan.x, 0, C.z + mapPan.z - mh * .16); want.set(wantLook.x, Math.sin(tilt) * d, wantLook.z + Math.cos(tilt) * d); wantUp.set(0, 1, 0); rate = state === 'map' ? (mapFly ? 30 : 10) : 5;
    if (fly.t > 1.6) state = 'map';
  } else if (state === 'menu') {
    // the home screen is a highlights reel: when something happens (a jump, a dive into the underpass, a shot fired, a
    // Yaji boost) it cuts to whoever did it; between moments, the drone over the pack, a side tracking shot, an orbit, a hero
    const d = director;
    if (clock - d.t0 > 2.6) {
      const prio = { jump: 4, tunnel: 3, taunt: 3, fire: 2, boost: 2, hit: 1 };
      const ev = race.events.filter(e => race.clock - e.t < .35 && (!d.ev || e !== d.ev)).sort((a, b) => prio[b.type] - prio[a.type])[0];
      if (ev) { d.ev = ev; d.k = ev.k; d.shot = ev.type; d.t0 = clock; d.anchor = null; }
      else if (clock - d.t0 > 6) {
        const crowd = kk => race.karts.filter(o => o !== kk && Math.abs(race.dS(o.s, kk.s)) < 30).length;
        const pool = ['drone', 'side', 'orbit', 'chase', 'drone', 'hero', 'side'];
        let next = pool[(pool.indexOf(d.shot) + 1) % pool.length] || 'drone';
        d.k = crowd(k) ? k : race.karts.reduce((a, b) => (crowd(b) > crowd(a) ? b : a));
        if (next === 'drone' && !crowd(d.k)) next = 'side';
        d.shot = next; d.t0 = clock; d.anchor = null;
      }
    }
    const tk = d.k || k, tp = tk.m.root.position, st = clock - d.t0, side = (tk.n % 2 ? 1 : -1), back = cam.aspect < 1 ? 1.35 : 1;
    race.frameOf(tk, F);
    fwd.copy(F.t).multiplyScalar(Math.cos(tk.rh)).addScaledVector(F.l, Math.sin(tk.rh));
    let near = null, nd = 40; for (const o of race.karts) if (o !== tk) { const dd = Math.abs(race.dS(o.s, tk.s)); if (dd < nd) { nd = dd; near = o; } }
    const mid = near ? new THREE.Vector3().addVectors(tp, near.m.root.position).multiplyScalar(.5) : tp.clone();
    const under = track.covered[track.idx(tk.s)];
    const around = (a, r) => new THREE.Vector3().copy(fwd).multiplyScalar(Math.cos(a) * r).addScaledVector(F.l, Math.sin(a) * r);
    let shot = d.shot;
    if ((under && shot !== 'tunnel') || (shot === 'tunnel' && tk.br)) shot = 'chase';
    if (shot === 'taunt') shot = 'hero';
    if (shot === 'jump' || shot === 'tunnel') {
      // a fixed camera: beside the ramp for a jump, inside the tunnel looking back up for a dive underground
      if (!d.anchor) {
        if (shot === 'jump') d.anchor = tp.clone().addScaledVector(fwd, 16).addScaledVector(F.l, side * 11).addScaledVector(F.u, 2.2);
        else { let i = track.idx(tk.s); while (!track.covered[i] && i - track.idx(tk.s) < 200) i = (i + 1) % track.N; const P = track.frame(i * track.seg + 26, track.newFrame()); d.anchor = P.p.clone().addScaledVector(P.l, side * 6).addScaledVector(P.u, 3.2); }
      }
      want.copy(d.anchor); wantLook.copy(tp).addScaledVector(F.u, 1.2);
    }
    else if (shot === 'low') { want.copy(tp).addScaledVector(F.l, side * 5.5 * back).addScaledVector(fwd, 7 - st * 2.2).addScaledVector(F.u, .55); wantLook.copy(tp).addScaledVector(F.u, 1.3); }
    else if (shot === 'drone') { want.copy(mid).add(around(Math.PI + st * .12, 10)).addScaledVector(F.u, 28 * back); wantLook.copy(mid).addScaledVector(fwd, 4); }
    else if (shot === 'side') { want.copy(mid).addScaledVector(F.l, side * 12 * back).addScaledVector(fwd, 3 - st * .6).addScaledVector(F.u, 2.6); wantLook.copy(mid).addScaledVector(F.u, .8); }
    else if (shot === 'orbit') { want.copy(tp).add(around(side * (.4 + st * .35), 11 * back)).addScaledVector(F.u, 3.2); wantLook.copy(tp).addScaledVector(F.u, 1.4); }
    else if (shot === 'hero' || shot === 'boost') { want.copy(tp).addScaledVector(fwd, 15 * back).addScaledVector(F.l, side * 3).addScaledVector(F.u, 3.4); wantLook.copy(tp).addScaledVector(F.u, 1); }
    else if (shot === 'fire' || shot === 'hit') { want.copy(tp).addScaledVector(fwd, -7 * back).addScaledVector(F.l, side * 1.5).addScaledVector(F.u, 2.6); wantLook.copy(tp).addScaledVector(fwd, 22).addScaledVector(F.u, 1); }
    else { want.copy(tp).addScaledVector(fwd, -10 * back).addScaledVector(F.u, 3.2); wantLook.copy(tp).addScaledVector(fwd, 18).addScaledVector(F.u, .8); }
    if (fly?.down) { fly.t += dt; rate = 2.4; if (fly.t > 1.4) fly = null; lastShot = shot; d.cut = d.t0; }
    else if (shot !== lastShot || d.t0 !== d.cut) { lastShot = shot; d.cut = d.t0; camPos.copy(want); camLook.copy(wantLook); }
    wantUp.set(0, 1, 0); rate = fly?.down ? 2.4 : 9;   // (the swoop down from the map or onto a new city glides; the race shots cut)
    if (shot !== lastShot) { lastShot = shot; camPos.copy(want); camLook.copy(wantLook); }
  } else if (state === 'finish') {
    // a fixed camera at the line: low beside the arch, watching you cross and roll away; then it rises to look down on the finish
    const t = clock - finishAt, Fl = track.frame(0, track.newFrame()), side = 1;
    const low = Fl.p.clone().addScaledVector(Fl.t, 22).addScaledVector(Fl.l, side * (W2C + 6)).addScaledVector(Fl.u, 2.2);
    const high = Fl.p.clone().addScaledVector(Fl.t, 10).addScaledVector(Fl.l, side * 6).addScaledVector(Fl.u, 34);
    const u = Math.min(1, Math.max(0, (t - 1.6) / 2.2)), e3 = u * u * (3 - 2 * u);
    want.lerpVectors(low, high, e3); wantLook.copy(kp).lerp(Fl.p.clone().addScaledVector(Fl.t, 30), e3 * .5).addScaledVector(Fl.u, 1.2); wantUp.set(0, 1, 0); rate = t < .1 ? 60 : 5;
  } else if (state === 'results' || state === 'garage') {
    race.frameOf(k, F);
    const a = k.rh + .5 * Math.sin(clock * .25);
    fwd.copy(F.t).multiplyScalar(Math.cos(a)).addScaledVector(F.l, Math.sin(a));
    const lift = k.m.V.cam, far = state === 'garage' ? 9 + lift * 2 : 7 + lift;
    want.copy(kp).addScaledVector(fwd, far).addScaledVector(F.u, 2.6 + lift); wantLook.copy(kp).addScaledVector(F.u, 1.4 + lift * .6);
    if (state === 'garage') wantLook.addScaledVector(F.u, -2.2 - lift);   // sit the vehicle above the garage panel
    wantUp.copy(F.u); rate = 2;
  } else {
    race.frameOf(k, F);
    camRh += (k.rh * .55 + k.visYaw * .3 - camRh) * Math.min(1, dt * 5);
    fwd.copy(F.t).multiplyScalar(Math.cos(camRh)).addScaledVector(F.l, Math.sin(camRh));
    const d = 8.6 + Math.max(0, k.speed) * .025;
    const lift = k.m.V.cam;
    want.copy(kp).addScaledVector(fwd, -d - lift).addScaledVector(F.u, 3.5 + lift + k.air * .2);
    wantLook.copy(kp).addScaledVector(fwd, 6).addScaledVector(F.u, 1.6 + lift * .6);
    // follow the road's up (upside down in the loop), but only lean part-way into banked corners
    wantUp.set(0, 1, 0).lerp(F.u, track.inLoop[track.idx(k.s)] || F.u.y < .7 ? 1 : .55).normalize();
    rate = state === 'count' && clock - countStart < 2.2 ? 2.2 : 9; upRate = 6;
    // a loop-the-loop: the camera rides the road like the next car of a rollercoaster. It sits on the track the same
    // distance behind (not on a straight line out the back, which cuts across the inside of the loop), looks at the road
    // a few metres ahead (up into the loop going in, round over the top), and turns over with the kart, quickly, so the
    // kart stays stuck to the road and the world turns round it. It blends in just before the loop and out after it
    const nearLoop = track.inLoop[track.idx(k.s)] || track.inLoop[track.idx(k.s + 10)] || track.inLoop[track.idx(k.s + 20)];
    loopW += ((nearLoop ? 1 : 0) - loopW) * Math.min(1, dt * 3.5);
    if (loopW > .002) {
      const back = track.frame(k.s - d - lift, camBack), ahead = track.frame(k.s + 7, camAhead);
      const pb = back.p.clone().addScaledVector(back.l, k.lat).addScaledVector(back.u, 3.2 + lift);
      const la = ahead.p.clone().addScaledVector(ahead.l, k.lat).addScaledVector(ahead.u, 1.5 + lift * .6);
      want.lerp(pb, loopW); wantLook.lerp(la, loopW);
      wantUp.lerp(back.u.clone().add(F.u).normalize(), loopW).normalize();   // halfway between the camera's road and the kart's: no lag, no snap
      rate = 9 + 16 * loopW; upRate = 6 + 14 * loopW;
    }
  }
  const e = 1 - Math.exp(-dt * rate);
  camPos.lerp(want, e); camLook.lerp(wantLook, e); camUp.lerp(wantUp, Math.min(1, dt * (state === 'tomap' ? 3 : state === 'race' || state === 'count' ? upRate : 6))).normalize();
  cam.position.copy(camPos);
  if (state === 'race') {   // haptics from what the race already feels: a fresh jolt of camera shake, a boost starting
    const P = race.player;
    if (race.shake > hapt.shake + .08) Haptics.bump(race.shake);
    if (P.boost > 0 && hapt.boost <= 0) Haptics.boost();
    hapt.shake = race.shake; hapt.boost = P.boost;
  }
  if (race.shake > 0) cam.position.add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(race.shake * .9));
  cam.up.copy(camUp); cam.lookAt(camLook);
  if (state === 'results') { const w = innerWidth, h = innerHeight, wide = w >= 820; cam.setViewOffset(w, h, wide ? w * .2 : 0, wide ? 0 : h * .26, w, h); }
  else if (state === 'menu' && !fly) { const w = innerWidth, h = innerHeight, wide = w >= 820; cam.setViewOffset(w, h, wide ? w * .16 : 0, wide ? h * .02 : h * .1, w, h); }
  else if (cam.view?.enabled) cam.clearViewOffset();
  const racing = state === 'race' || state === 'count' || state === 'finish';
  const base = cam.aspect < 1 ? clamp(48 / cam.aspect, 62, 84) : 62;
  const fov = state === 'tomap' || state === 'map' ? 50 : state === 'menu' ? (cam.aspect < 1 ? 62 : 44) : base + (racing ? clamp(k.speed, 0, 90) * .12 + (k.boost > 0 ? 8 : 0) : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
  const up = state === 'tomap' || state === 'map';
  // racing: a warm harmattan haze close enough to give the city depth. From the air the haze turns to sea-blue far off,
  // so the far coast and the open sea melt into the distance
  const md = (mapPan.h || track.radius * 2.25) * 1.3;
  scene.fog.near = up ? md * .85 : 140; scene.fog.far = up ? md * 2.4 : 1700;
  scene.fog.color.set(night ? '#0a0f22' : up ? '#2d8aa3' : '#e9d9bf');
  if (routeLine) routeLine.visible = state === 'map';
  shadowSpan += ((up ? track.radius * 1.25 : 70) - shadowSpan) * Math.min(1, dt * 2.5);   // grows and shrinks smoothly (no flash)
  const span = shadowSpan, sd = 160 + (span - 70) * 1.6, focus = new THREE.Vector3().lerpVectors(kp, track.center, clamp((span - 70) / (track.radius * 1.25 - 70), 0, 1));
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: sd * 3 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(focus.x + SUN.x * sd, SUN.y * sd, focus.z + SUN.z * sd); sun.target.position.set(focus.x, 0, focus.z);
}

/* ---------- game flow ---------- */
const hapt = { shake: 0, boost: 0 };
let state = 'menu', prevState = 'race', cd = 0, lastCd = 0, clock = 0, countStart = 0, track, race, world, chIndex = 0;
// one city is built at a time: the one you last chose (going to another reloads the game behind the loading screen)
// a big city has several circuits (Doha: Msheireb, The Pearl, Lusail); one is built at a time, like the city
const chapter = CHAPTERS.find(c => c.id === store.get('city', 'kano') && c.playable) || CHAPTERS[0], CITY = chapter.name.toUpperCase();
const circuitOf = c => c.circuits ? c.circuits.find(x => x.id === store.get('circuit.' + c.id, '')) || c.circuits[0] : null;
let circuit = circuitOf(chapter), RID = chapter.id + (circuit ? '.' + circuit.id : '');   // records are kept per circuit
let PLACE = circuit ? `${CITY} · ${circuit.name.toUpperCase()}` : CITY;                       // what the headers say
chIndex = CHAPTERS.indexOf(chapter);
const pickedCirc = {};   // the circuit chosen on the home card, per chapter, before you go
function travelTo(id, then = '', circ = null){
  const c = CHAPTERS.find(x => x.id === id), want = circ || (c.circuits ? (pickedCirc[id] || circuitOf(c).id) : null);
  if (id === chapter.id && (!want || want === circuit?.id)) return false;
  if (id === chapter.id) { swapCircuit(want, then); return true; }   // another circuit in this city: swapped in place, no reload
  store.set('city', id); if (want) store.set('circuit.' + id, want); store.set('afterBoot', then);
  store.set('travelTo', { name: (c.circuits ? c.circuits.find(x => x.id === want).name : c.name).toUpperCase(), then });   // the loader says what's coming (index.html)
  location.reload(); return true;
}

function renderChapter(){
  const c = CHAPTERS[chIndex], rid = c.id + (c.circuits ? '.' + (pickedCirc[c.id] || circuitOf(c).id) : ''), best = store.get('best.' + rid, null), stars = store.get('stars.' + rid, 0);
  $('#chNum').textContent = `CHAPTER ${c.n}`;
  $('#chName').textContent = c.name.toUpperCase();
  $('#chTag').textContent = c.tagline;
  { const box = $('#chCirc'); box.hidden = !c.circuits;
    if (c.circuits) { const on = pickedCirc[c.id] || circuitOf(c).id; box.innerHTML = c.circuits.map(x => `<button data-circ="${x.id}" class="${x.id === on ? 'on' : ''}"><span>${x.name.toUpperCase()}</span></button>`).join(''); } }
  $('#chStars').innerHTML = [0, 1, 2].map(i => `<svg viewBox="0 0 24 24" class="${i < stars ? 'won' : ''}"><path d="M12 2l3 6.6 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.8z"/></svg>`).join('');
  $('#chReward').innerHTML = c.playable ? `<i class="coin-icon"></i><b>+${c.reward}</b>` : '<b>LOCKED</b>';
  $('#dots').innerHTML = CHAPTERS.map((x, i) => `<li class="${i === chIndex ? 'on' : ''} ${x.playable ? '' : 'locked'}"><button data-ch="${i}" data-n="${x.n}" aria-label="Chapter ${x.n}">${x.n}</button></li>`).join('');
  const go = $('#goBtn');
  go.disabled = !c.playable;
  go.querySelector('span').textContent = c.playable ? 'PLAY' : 'SOON';
  go.querySelector('small').textContent = c.playable ? `RACE · ${c.circuits ? c.circuits.find(x => x.id === (pickedCirc[c.id] || circuitOf(c).id)).name.toUpperCase() : c.name.toUpperCase()}` : 'CHAPTER LOCKED';
  $('#menu').classList.toggle('locked', !c.playable);
  const gp = $('#gPlay'); gp.disabled = !c.playable; gp.querySelector('span').textContent = c.playable ? 'PLAY' : 'SOON'; gp.querySelector('small').textContent = c.playable ? c.name.toUpperCase() : 'CHAPTER LOCKED';
  $('#wallet').textContent = store.get('wallet', 0).toLocaleString('en');
}
$('#chCirc').addEventListener('click', e => { const b = e.target.closest('[data-circ]'); if (!b) return; pickedCirc[CHAPTERS[chIndex].id] = b.dataset.circ; renderChapter(); });
$('#dots').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) { chIndex = +b.dataset.ch; renderChapter(); } });
$('#prevCh').addEventListener('click', () => { chIndex = (chIndex + CHAPTERS.length - 1) % CHAPTERS.length; renderChapter(); });
$('#nextCh').addEventListener('click', () => { chIndex = (chIndex + 1) % CHAPTERS.length; renderChapter(); });
$('#goBtn').addEventListener('click', () => { if (CHAPTERS[chIndex].playable) { if (travelTo(CHAPTERS[chIndex].id, 'modes')) return; Sound.init(); screenOut($('#menu')); openModes('menu'); } else Feedback.say('deny'); });
// the controls card: each action with its keys drawn as key caps in the race type, our own arrows on them
{
  const cap = (k, wide) => `<kbd class="kc${wide ? ' wide' : ''}">${k}</kbd>`;
  const rows = isTouch
    ? [[cap(ICON.left) + cap(ICON.right), 'STEER', 'Hold either side of the screen'],
       [cap('HOLD', 1), 'DRIFT', 'Hold a turn, let go to boost'],
       [cap('FIRE', 1), 'FIRE', 'Shoot what you picked up'],
       [cap('NITRO', 1), 'NITRO', 'When the bottle is full'],
       [cap(ICON.pause), 'PAUSE', '']]
    : [[cap(ICON.left) + cap(ICON.right), 'STEER', ''],
       [cap(ICON.up), 'NITRO', 'When the bottle is full'],
       [cap(ICON.down), 'BRAKE', ''],
       [cap('SPACE', 1), 'DRIFT', 'Hold in a turn, let go to boost'],
       [cap('SPACE', 1), 'TRICK', 'In the air'],
       [cap('F'), 'FIRE', ''],
       [cap('P'), 'PAUSE', '']];
  $('#ctrlList').innerHTML = rows.map(([k, a, sub]) => `<li><span class="kcs">${k}</span><b>${a}</b>${sub ? `<small>${sub}</small>` : ''}</li>`).join('');
}
const soundBtn = $('#soundBtn');
const paintSound = () => { soundBtn.classList.toggle('off', !Sound.on); soundBtn.setAttribute('aria-label', Sound.on ? 'Sound on' : 'Sound off'); };
$('#nightBtn').addEventListener('click', () => setNight(!night));
soundBtn.addEventListener('click', () => { Sound.init(); Sound.toggle(); paintSound(); }); paintSound();
// settings: master volume, engine volume, which engine sound, vibration. From home it returns home; from pause, to pause
{
  let from = null;
  const pct = v => Math.round(v * 100) + '%', fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  const paint = () => {
    const v = $('#setVol'), e = $('#setEng'); v.value = Sound.vol; e.value = Sound.engVol; fill(v); fill(e); $('#setVolO').textContent = pct(Sound.vol); $('#setEngO').textContent = pct(Sound.engVol);
    const m = (() => { try { return localStorage.getItem('gudu.engineMode') || 'supra'; } catch { return 'supra'; } })();
    document.querySelectorAll('#setMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    document.querySelectorAll('#setHap button').forEach(b => b.classList.toggle('on', (b.dataset.h === '1') === Haptics.on));
    document.querySelectorAll('#setSteer button').forEach(b => b.classList.toggle('on', b.dataset.s === Tilt.mode));
    $('#setSteerRow').hidden = !isTouch;
  };
  const open = src => { Sound.init(); from = src; paint(); if (src.id === 'pause') swap(src, $('#settings'), 1); else { hide(src); show($('#settings'), 1); } };
  $('#setBtn').addEventListener('click', () => open($('#menu')));
  $('#setBtn2').addEventListener('click', () => open($('#pause')));
  $('#setBack').addEventListener('click', () => { const to = from || $('#menu'); if (to.id === 'pause') swap($('#settings'), to, -1); else { hide($('#settings')); show(to, -1); } });
  $('#setVol').addEventListener('input', e => { Sound.setVolume(+e.target.value); if (!Sound.on && +e.target.value > 0) { Sound.toggle(); paintSound(); } paint(); });
  $('#setEng').addEventListener('input', e => { Sound.setEngineVolume(+e.target.value); paint(); });
  $('#setMode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; Sound.setEngineMode(b.dataset.m); paint();
    Sound.drive({ type: vehicle, speed: .35, throttle: 1, running: true }, .016); setTimeout(() => { if (state !== 'race') Sound.drive({ type: vehicle, speed: 0, throttle: 0, running: false }); }, 700); });   // a short rev to hear it
  // steering: the arrows, or tilting the phone. If tilt can't work here it says why and stays on the arrows
  $('#setSteer').addEventListener('click', async e => { const b = e.target.closest('[data-s]'); if (!b) return;
    const why = await Tilt.set(b.dataset.s), note = $('#setSteerNote'); note.textContent = why; note.hidden = !why;
    if (why) await Tilt.set('buttons'); paint(); });
  $('#setHap').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; Haptics.on = b.dataset.h === '1'; store.set('haptics', Haptics.on); paint(); });
}

/* ---------- garage ---------- */
const VEH_ART = {
  kart: '<svg viewBox="0 0 64 36"><path d="M8 24h48l-4-8H34l-4-6h-8l-4 6h-6z" fill="currentColor"/><circle cx="16" cy="26" r="6" fill="currentColor"/><circle cx="48" cy="26" r="7" fill="currentColor"/></svg>',
  buggy: '<svg viewBox="0 0 64 36"><path d="M10 20h44l-6-8H36l-6-8h-6l-2 8h-8z" fill="currentColor"/><path d="M24 4l14 0" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="24" r="8" fill="currentColor"/><circle cx="48" cy="24" r="9" fill="currentColor"/></svg>',
  muscle: '<svg viewBox="0 0 64 36"><path d="M6 22c0-6 4-8 10-9l6-7h16l8 7c6 1 12 3 12 9z" fill="currentColor"/><circle cx="18" cy="24" r="7" fill="currentColor"/><circle cx="46" cy="24" r="7" fill="currentColor"/><path d="M22 4h20" stroke="currentColor" stroke-width="3" stroke-dasharray="3 2"/></svg>',
  monster: '<svg viewBox="0 0 64 36"><path d="M8 14h48l-4-7H34l-3-5h-8l-3 5h-8z" fill="currentColor"/><circle cx="16" cy="25" r="11" fill="currentColor"/><circle cx="48" cy="25" r="11" fill="currentColor"/></svg>',
};
let vehicle = store.get('veh', 'kart'), THUMBS = {}, TEX = null;
if (!VEHICLES[vehicle]) vehicle = 'kart';   // (the rally car became the muscle car)
const VKEYS = Object.keys(VEHICLES);
function renderGarage(){
  const i = VKEYS.indexOf(vehicle), v = VEHICLES[vehicle], st = VSTATS[vehicle];
  $('#tiles').innerHTML = VKEYS.map(id => `<button class="tile${id === vehicle ? ' on' : ''}" data-veh="${id}"><span class="n">${VEHICLES[id].name.toUpperCase()}</span><img src="${THUMBS[id] || ''}" alt=""></button>`).join('');
  const rows = [['SPEED', (st.top - .9) * 10], ['ACCEL', (st.acc - .8) * 3], ['GRIP', (st.turn - .8) * 4], ['OFF-ROAD', st.off], ['WEIGHT', st.mass / 2]];
  $('#gStats').innerHTML = rows.map(([a, x]) => { const pc = Math.round(clamp(x, .05, 1) * 100); return `<dt>${a}</dt><dd><div class="stripebar thin"><i style="width:${pc}%"></i></div></dd><span class="pc">${pc}%</span>`; }).join('');
  $('#gName').textContent = v.name.toUpperCase();
  $('#garageBtn').setAttribute('aria-label', `Open the garage, ${v.name}`);   // (the tile's picture is a fixed one: the kart on its own, public/tile-garage.png) renderCustom(); $('#gWallet').textContent = store.get('wallet', 0).toLocaleString('en');
}
// your vehicle's paint, wheels and tyres, bought with coins
const custom = id => ({ ...DEFAULT_CUSTOM[id], plate: 'kano', ...store.get('custom.' + id, {}) });
const owned = () => store.get('owned', []);
// a vehicle's factory part is always its own, even when that part costs coins in the shop (the Muscle's Midnight paint)
const isFactory = (id, tab, v) => DEFAULT_CUSTOM[id]?.[tab] === v;
// v2 defaults gave each vehicle its own colour: drop paint saved before then, once, so the new defaults show
if (store.get('paintDefaults', 1) < 2) { for (const id of Object.keys(DEFAULT_CUSTOM)) { const c = store.get('custom.' + id, null); if (c && 'paint' in c) { delete c.paint; store.set('custom.' + id, c); } } store.set('paintDefaults', 2); }
// decals that left the shop (Arewa Knot, Star): take them off every vehicle and refund anyone who bought them, once
for (const [key, part, price] of [['knotRetired', 'knot', 400], ['starRetired', 'star', 350]]) if (!store.get(key, false)) { for (const id of Object.keys(DEFAULT_CUSTOM)) { const c = store.get('custom.' + id, null); if (c?.decal === part) { delete c.decal; store.set('custom.' + id, c); } }
  const own = owned(); if (own.includes('decal:' + part)) { store.set('owned', own.filter(o => o !== 'decal:' + part)); store.set('wallet', store.get('wallet', 0) + price); } store.set(key, true); }
let custTab = 'body', PTH = null, draft = null, FACES = {};
const TABS = [['body', 'BODY'], ['paint', 'PAINT'], ['decal', 'DECALS'], ['rim', 'WHEELS'], ['tyre', 'TYRES'], ['plate', 'PLATES'], ['nitro', 'NITRO']];
const decalPreview = {};
function tilePic(tab, v){
  if (tab === 'decal') { const k = draft.paint + v; return decalPreview[k] ||= (v === 'none' ? (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = draft.paint; x.fillRect(0, 0, 64, 64); return c.toDataURL(); })() : decalTex(draft.paint, v).image.toDataURL()); }
  if (tab === 'plate') return plateTex(v).image.toDataURL();
  return PTH[tab][v];
}
function renderCustom(){
  if (!draft) return;
  if (custTab === 'body') {   // the bodies: every vehicle as a card; picking one swaps the car on the stand
    document.querySelectorAll('#custTabs [data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === 'body'));
    $('#custTitle').textContent = `BODY · ${VKEYS.length} OWNED`;
    $('#custList').innerHTML = VKEYS.map(id => `<button class="tile2 body ${id === vehicle ? 'worn sel' : ''}" data-body="${id}" aria-label="${VEHICLES[id].name}"><img src="${THUMBS[id]}" alt=""><span class="tl">${VEHICLES[id].name}</span></button>`).join('');
    return;
  }
  PTH ||= partThumbs();
  const saved = custom(vehicle), own = owned();
  document.querySelectorAll('#custTabs [data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === custTab));
  $('#custTitle').textContent = TABS.find(t => t[0] === custTab)[1];
  $('#custList').innerHTML = PARTS[custTab].map(([v, name, price]) => {
    const has = !price || own.includes(custTab + ':' + v) || isFactory(vehicle, custTab, v), pic = tilePic(custTab, v);
    const face = custTab === 'plate' ? `<i class="pv plate" style="background-image:url(${pic})"></i>` : custTab === 'decal' ? `<i class="pv" style="background-image:url(${pic})"></i>` : `<img src="${pic}" alt="">`;
    return `<button class="tile2 ${saved[custTab] === v ? 'worn' : ''} ${draft[custTab] === v ? 'sel' : ''} ${has ? '' : 'locked'}" data-part="${v}" aria-label="${name}">${face}${has ? '' : `<span class="tp"><i class="coin-icon"></i>${price}</span>`}<span class="tl">${name}</span></button>`;
  }).join('');
}
function costOf(d){ const own = owned(); let c = 0, items = []; for (const [tab] of TABS) { if (!PARTS[tab]) continue; const it = PARTS[tab].find(q => q[0] === d[tab]); if (it && it[2] && !own.includes(tab + ':' + it[0]) && !isFactory(vehicle, tab, it[0])) { c += it[2]; items.push(tab + ':' + it[0]); } } return { c, items }; }
function openCustom(){ draft = { ...custom(vehicle) }; $('#garage').classList.add('customising'); show($('#cust')); renderCustom(); }
function closeCustom(){ $('#garage').classList.remove('customising'); hide($('#cust')); draft = null; garage.focus(null); garage.setVehicle(vehicle, 0, custom(vehicle)); }
$('#custTabs').addEventListener('click', e => { const b = e.target.closest('[data-ct]'); if (b) { custTab = b.dataset.ct; garage.focus(null); renderCustom(); } });
$('#custPrev').addEventListener('click', () => { const i = TABS.findIndex(t => t[0] === custTab); custTab = TABS[(i + TABS.length - 1) % TABS.length][0]; garage.focus(null); renderCustom(); });
$('#custNext').addEventListener('click', () => { const i = TABS.findIndex(t => t[0] === custTab); custTab = TABS[(i + 1) % TABS.length][0]; garage.focus(null); renderCustom(); });
$('#custList').addEventListener('click', e => {
  const bb = e.target.closest('[data-body]'); if (bb) { if (bb.dataset.body !== vehicle) { pickVehicle(bb.dataset.body); draft = { ...custom(vehicle) }; } renderCustom(); return; }
  const b = e.target.closest('[data-part]'); if (!b) return;
  draft[custTab] = b.dataset.part; garage.setVehicle(vehicle, 0, draft); garage.focus(custTab); renderCustom();   // picking a part closes in on it
  const { c } = costOf(draft); $('#custSave').textContent = c ? `SAVE · ${c}` : 'SAVE';
});
$('#custCancel').addEventListener('click', () => { $('#custSave').textContent = 'SAVE'; closeCustom(); });
$('#custSave').addEventListener('click', () => {
  const { c, items } = costOf(draft), w = store.get('wallet', 0);
  if (c > w) { $('#custTitle').textContent = `NEED ${c - w} MORE COINS`; Feedback.say('deny'); return; }
  if (c) { store.set('wallet', w - c); store.set('owned', [...owned(), ...items]); Feedback.say('buy'); $('#gWallet').textContent = (w - c).toLocaleString('en'); }
  store.set('custom.' + vehicle, draft); race.setVehicle(vehicle, draft); if (TEX) { Object.assign(THUMBS, vehicleThumbs(TEX, [vehicle], custom)); renderGarage(); } $('#custSave').textContent = 'SAVE'; closeCustom();
});

function pickVehicle(id){
  if (id === vehicle) return;
  const dir = VKEYS.indexOf(id) > VKEYS.indexOf(vehicle) ? -1 : 1;
  vehicle = id; store.set('veh', vehicle); race.setVehicle(vehicle, custom(vehicle)); garage.setVehicle(vehicle, dir, custom(vehicle)); renderGarage(); Sound.init();
  const card = $('.g-card'); card.classList.remove('enter'); void card.offsetWidth; card.style.setProperty('--wd', -dir); card.classList.add('enter');
}
$('#tiles').addEventListener('click', e => { const b = e.target.closest('[data-veh]'); if (b) pickVehicle(b.dataset.veh); });
$('#gPrev').addEventListener('click', () => pickVehicle(VKEYS[(VKEYS.indexOf(vehicle) + VKEYS.length - 1) % VKEYS.length]));
$('#gNext').addEventListener('click', () => pickVehicle(VKEYS[(VKEYS.indexOf(vehicle) + 1) % VKEYS.length]));
// into the garage: the roller door lifts and the camera glides in; the controls show once you're inside
$('#garageBtn').addEventListener('click', () => { Sound.init(); $('#menu').hidden = true; openGarage(); });
// each city's garage keeps its own lights (Kano's room starts dark, Doha's workshop in daylight)
// each city has its own garage room (Kano's navy room, Doha's workshop); the garage you open is the one for the chapter
// on the home card, built on the spot if it isn't the one built (the garage is its own scene: no reload)
const garageCity = () => (CHAPTERS[chIndex]?.playable ? CHAPTERS[chIndex].id : chapter.id);
const roomOf = id => (id === 'doha' ? 'workshop' : 'navy');
const LIGHTS_KEY = (id = garage?.city || chapter.id) => id === 'kano' ? 'garageLights' : 'garageLights.' + id;
function makeGarage(id){
  if (garage) { garage.scene.traverse(o => { if (o.isReflector) o.dispose?.(); o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) m.dispose?.(); }); }
  garage = new Garage(TEX, { room: roomOf(id) }); garage.city = id;
  garage.setLights(store.get(LIGHTS_KEY(id), id === 'doha')); $('#gLights').classList.toggle('on', garage.lightsOn);
  garage.setVehicle(vehicle, 0, custom(vehicle)); garage.resize(cam.aspect);
}
function openGarage(){
  const id = garageCity(); if (!garage || roomOf(garage.city) !== roomOf(id)) makeGarage(id); else garage.city = id;
  state = 'garage'; renderGarage(); garage.jumpIn(); show($('#garage'), 1);
}
$('#gLights').addEventListener('click', () => { const on = !garage.lightsOn; garage.setLights(on); store.set(LIGHTS_KEY(), on); $('#gLights').classList.toggle('on', on); });
$('#gBack').addEventListener('click', () => {
  $('#garage').hidden = true; state = 'menu'; renderChapter(); show($('#menu'), -1);
});
// the garage's big button races (pick it, dress it, go); customising is the button above it
$('#custOpen').addEventListener('click', openCustom);
$('#gPlay').addEventListener('click', () => { if (!CHAPTERS[chIndex].playable) return Feedback.say('deny'); if (travelTo(CHAPTERS[chIndex].id, 'modes')) return; Sound.init(); screenOut($('#garage')); openModes('garage'); });

/* ---------- the modes ---------- */
let mode = store.get('mode', 'gp'), modesFrom = 'garage';
// the 3D scene under a screen changes: bring the new one up out of the navy rather than cutting
const sceneIn = () => canvas.animate([{ opacity: 0, offset: 0 }], { duration: 260, easing: EASE.out });
const TT = { last: -1, start: 0, laps: [], rec: [], recT: 0, ghost: null, newBest: false };
const FREE = { top: 0 };
const MODES = [
  { id: 'gp', name: 'RACE', en: 'Against the crew', line: () => `${LAPS} laps · 6 racers · win +${chapter.reward}` },
  { id: 'tt', name: 'TIME TRIAL', en: 'Against the clock', line: () => { const b = store.get('bestlap.' + RID, null); return b ? `Best lap ${fmtTime(b)} · race your ghost` : `${LAPS} laps · set your best lap`; } },
  { id: 'free', name: 'FREE DRIVE', en: `Cruise ${chapter.name}`, line: () => 'No rivals · no clock · keep the coins' },
];
function modePic(id){
  const P = mapShot?.places || [];
  if (id === 'gp') return mapShot?.pack || kanoSnap || '';
  if (id === 'tt') return mapShot?.tunnel || kanoSnap || '';
  return mapShot?.cruise || kanoSnap || '';
}
function openModes(from){
  modesFrom = from; $('#modes .m-tag span').textContent = PLACE;
  const box = $('#mCards');
  box.innerHTML = MODES.map(M => `<button class="mcard ${M.id === mode ? 'on' : ''}" data-mode="${M.id}" aria-label="${M.name}, ${M.en}"><img src="${modePic(M.id)}" alt=""><span class="mc-body"><span class="mc-name">${M.name}</span><span class="mc-en">${M.en}</span><span class="mc-line">${M.line()}</span><span class="mc-play">PLAY</span></span></button>`).join('');
  // all in this one task, before anything is painted: the underpass comes up, the screen fades, the cards are put in place, then they rise in
  state = 'modes'; modesRoom.resize(innerWidth / innerHeight); modesRoom.dirty = 4; sceneIn();
  screenIn($('#modes'));
  box.querySelector('.mcard.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); flowCards();
  stagger(box.children, { from: 'up', delay: 40 });
}
// phone: as you swipe, each card grows and lights up the nearer it gets to the middle, and the one in the middle is chosen
function flowCards(){
  const box = $('#mCards'); if (innerWidth >= 820) { for (const c of box.children) { c.style.removeProperty('--k'); c.style.removeProperty('--b'); } return; }
  const mid = box.getBoundingClientRect().left + box.clientWidth / 2; let best = null, bd = 1e9;
  for (const c of box.children) { const r = c.getBoundingClientRect(), d = (r.left + r.width / 2 - mid) / r.width, a = Math.min(1, Math.abs(d));
    c.style.setProperty('--k', (1 - .08 * a).toFixed(3)); c.style.setProperty('--b', (1 - .4 * a).toFixed(3)); if (Math.abs(d) < bd) { bd = Math.abs(d); best = c; } }
  if (best && best.dataset.mode !== mode) { pickMode(best.dataset.mode); Haptics.buzz(8); }
}
// go: the chosen card pushes forward, the others slide off to their sides, then the race card takes over
function launchMode(card){
  if (launchMode.busy) return; launchMode.busy = true;
  const cards = [...$('#mCards').children], i = cards.indexOf(card);
  Haptics.buzz(16); Sound.init();
  cards.forEach((c, j) => { if (c !== card) leave(c, `translateX(${(j < i ? -1 : 1) * 60}px) scale(.92)`); });   // the others slide off to their sides
  leave(card, 'scale(1.08)', { delay: 70 });                                                                     // the chosen one pushes towards you
  screenOut($('#modes'), DUR.leave + 70).then(() => { launchMode.busy = false; if (modesFrom === 'menu') $('#menu').hidden = true; raceIntro(startRace); });
}
function pickMode(id){ mode = id; store.set('mode', id); document.querySelectorAll('#mCards .mcard').forEach(c => c.classList.toggle('on', c.dataset.mode === id)); }
$('#mCards').addEventListener('click', e => {
  const c = e.target.closest('.mcard'); if (!c) return;
  if (!c.classList.contains('on')) { pickMode(c.dataset.mode); c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); Haptics.buzz(8); return; }
  launchMode(c);
});
// on a phone the carousel picks whichever card you swipe into the middle
{ let q = 0; $('#mCards').addEventListener('scroll', () => { if (!q) q = requestAnimationFrame(() => { q = 0; flowCards(); }); }, { passive: true }); addEventListener('resize', () => { if (!$('#modes').hidden) flowCards(); }); }
$('#mBack').addEventListener('click', () => { screenOut($('#modes')); state = modesFrom === 'garage' ? 'garage' : 'menu'; sceneIn(); if (modesFrom === 'garage') screenIn($('#garage')); else screenIn($('#menu')); });

/* ---------- the world map ---------- */
let mapUI = null, kanoSnap = null, mapShot = null, routeLine = null;
// opening the map: the camera flies straight up out of the race until it's looking down on the whole island, and the map
// fades in over exactly that view; closing dives back down to the racing
let fly = null, introT = 0, scHints = []; const mapPan = { x: 0, z: 0, h: 0 }, pv = new THREE.Vector3(); let mapFly = null;
function openMap(){
  Sound.init(); Sound.blip(120, .9, 'sawtooth', .04, 3);
  mapUI ||= buildMap($('#map'), { places: mapShot.places, wallet: store.get('wallet', 0).toLocaleString('en'),
    onPan: (dx, dy) => { const k = track.radius * 2.25 / innerHeight * 1.1; mapPan.x -= dx * k; mapPan.z -= dy * k; const r = track.radius * 2.6; mapPan.x = clamp(mapPan.x, -r, r); mapPan.z = clamp(mapPan.z, -r, r); },
    title: PLACE, islands: [],   // one race's map: the circuit chosen on the home card (Map loads it first if it isn't the one built)
    onAction: p => {
      if (p.kind === 'race') { $('#map').hidden = true; state = 'menu'; mode = 'gp'; raceIntro(startRace); }
      else if (p.kind === 'garage') { $('#map').hidden = true; openGarage(); }
    } });
  hide($('#menu'));
  state = 'tomap'; fly = { t: 0 };
  mapPan.x = 0; mapPan.z = 0; mapPan.h = 0; mapFly = null;
  setTimeout(() => { const m = $('#map'); m.hidden = false; m.classList.remove('fadeout'); m.classList.add('fadein'); show(m.querySelector('.nfs-top')); setTimeout(() => show(m.querySelector('.nfs-card')), 90); }, 650);
  $('#map').querySelector('#mapBack').onclick = closeMap;
}
function closeMap(){
  Sound.blip(300, .8, 'sawtooth', .04, .3);
  const m = $('#map'); m.classList.remove('fadein'); m.classList.add('fadeout');
  setTimeout(() => { m.hidden = true; m.classList.remove('fadeout'); state = 'menu'; fly = { t: 0, down: true }; lastShot = 'fly'; show($('#menu'), -1); }, 280);
}
// the map is the chosen race's map: pick The Pearl on the home card, tap Map, and it's The Pearl. Only one circuit is
// built at a time, so a different one is loaded first (behind the loading screen), then its map opens
$('#mapBtn').addEventListener('click', () => {
  const c = CHAPTERS[chIndex]; if (!c.playable) return Feedback.say('deny');
  if (travelTo(c.id, 'map')) return;
  openMap();
});

// pictures from the live scene: the island from straight above for the map, a close look at each place for its card
function snapshots(){
  for (const it of [...race.fx.items, ...race.fx.rings]) { it.life = 0; it.s.visible = false; }   // no weapon blasts left over from the race behind the menu (they save as black blobs)
  const C = track.center, R = track.radius * 1.12, a = innerWidth / innerHeight, fog = scene.fog; scene.fog = null;
  const halfH = a < 1 ? R / a * .62 : R, halfW = halfH * a;   // on a phone the map is taller than the screen: you pan it
  const top = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 4000);
  top.position.set(C.x, 1500, C.z); top.up.set(0, 0, -1); top.lookAt(C.x, 0, C.z);
  world.sky.visible = false; renderer.render(scene, top); const image = canvas.toDataURL('image/jpeg', .6); world.sky.visible = true;   // (the home tile's picture)
  const uv = (x, z) => ({ x, z });
  const pc = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .5, 8000);   // the screen's own shape, so nothing is stretched; far enough to take in the whole sky dome (at 3000 its far side was cut off, a black hole in the sky)
  const shot = (x, y, z, d = 60, h = 26) => { pc.position.set(x + d * .7, y + h, z + d * .7); pc.lookAt(x, y + 2, z); renderer.render(scene, pc); return canvas.toDataURL('image/jpeg', .6); };
  // a postcard from the road: stand on the circuit a little way back, eye height, look at the place
  const Fq = track.newFrame();
  const fromRoad = (s0, back, lat, h, target, lookH = 4) => { const F0 = track.frame(s0 - back, Fq); pc.position.copy(F0.p).addScaledVector(F0.l, lat); pc.position.y += h; pc.lookAt(target.x, (target.y || 0) + lookH, target.z); renderer.render(scene, pc); return canvas.toDataURL('image/jpeg', .7); };
  scene.fog = fog;
  const at = s0 => track.point(s0, 0), places = [];
  const startP = at(0);
  kanoSnap = chapter.id === 'kano' ? shot(startP.x, 0, startP.z, 70, 30) : fromRoad(70, 0, 0, 9, at(0), 4);   // (in Doha's tall streets a camera off to the side lands inside a tower: look back down the road at the start)
  places.push({ kind: 'race', name: (circuit ? circuit.name.toUpperCase() : CITY) + ' GRAND PRIX', sub: `3 laps · win +${chapter.reward} coins`, action: 'RACE', isNew: !store.get('best.' + RID, null), img: kanoSnap, ...uv(startP.x + 30, startP.z) });
  const gp = track.beside(track.idx(40), track.out[track.idx(40)] * 60); places.push({ kind: 'garage', name: 'GARAGE', sub: 'Pick your ride', action: 'OPEN', ...uv(gp.x, gp.z) });
  const seen = new Set();
  for (const f of track.feats) {
    const name = f.type === 'gate' ? f.name : f.type === 'market' ? 'KURMI MARKET' : f.type === 'dye' ? 'KOFAR MATA DYE PITS' : null;
    if (!name || seen.has(name)) continue; seen.add(name);
    const q = at(f.s + (f.len || 0) / 2), off = f.type === 'gate' ? 0 : track.out[track.idx(f.s)] * 40, b = track.beside(track.idx(f.s + (f.len || 0) / 2), off);
    const sm = f.s + (f.len || 0) / 2;
    const img = f.type === 'gate' ? fromRoad(f.s, 46, -3, 3.2, at(f.s + 30), 5)                       // down the road, through the arch
      : f.type === 'palace' ? fromRoad(f.s, 10, -track.out[track.idx(f.s)] * 4, 4, b, 7)               // the front of the palace
      : fromRoad(sm, 24, track.out[track.idx(sm)] * 8, 3.6, b, 2.5);                                      // from the roadside, among the stalls or pits
    places.push({ kind: 'place', name, sub: { gate: 'An old gate in the city wall', market: 'Stalls, umbrellas and bunting', dye: 'Indigo dye pits, centuries old', palace: 'Gidan Rumfa, home of the Emir' }[f.type], img, ...uv(b.x, b.z) });
    void q;
  }
  if (world.palace) { const pa = world.palace; places.push({ kind: 'place', name: "EMIR'S PALACE", sub: 'Gidan Rumfa, home of the Emir', img: shot(pa.x, 14, pa.z, 110, 40), ...uv(pa.x, pa.z) }); }
  // the city's own landmarks (Doha hands these over from doha.js): each pictured from the stretch of road it's seen from
  for (const pl of world.places || []) places.push({ kind: 'place', name: pl.name, sub: pl.sub, img: fromRoad(pl.s, pl.back, pl.lat, pl.h, pl, pl.lookH), ...uv(pl.x, pl.z) });
  if (chapter.id === 'kano') places.push({ kind: 'place', name: 'DALA HILL', sub: 'The hill old Kano grew around', img: shot(world.hill.x, 10, world.hill.z, 140, 60), ...uv(world.hill.x, world.hill.z) });
  { const fog = scene.fog; scene.fog = null;   // the other islands, each pictured from the air
    for (const is of world.islands) if (false) places.push({ kind: 'island', island: is, name: is.name, sub: 'Coming soon', img: shot(is.x, 0, is.z, 300, 210), ...uv(is.x, is.z) });
    scene.fog = fog; }
  { let i0 = 0; for (let i = 0; i < track.N; i++) if (track.covered[i]) { i0 = i; break; } const q = track.P[i0]; places.push({ kind: 'place', name: CITY + ' UNDERPASS', sub: 'Two lit bores, 10 m under the city', img: shot(q.x, 0, q.z, 50, 20), ...uv(q.x, q.z), bore: true }); }
  { let i0 = 0; for (let i = 0; i < track.N; i++) if (track.P[i].y > track.P[i0].y) i0 = i; const q = track.P[i0]; places.push({ kind: 'place', name: 'THE FLYOVER', sub: chapter.id === 'kano' ? 'Over the start straight' : 'Up over the city', img: shot(q.x, q.y, q.z, 60, 24), ...uv(q.x, q.z) }); }
  // the Time Trial card: a driver's-eye view down one of the underpass's lit bores
  let tunnelShot = null;
  { let i0 = -1; for (let i = 0; i < track.N; i++) if (track.covered[i]) { i0 = i; break; }
    if (i0 >= 0) { const s0 = i0 * track.len / track.N; const vis = [...race.all.map(k => k.m.root), ...race.boxes.map(b => b.m)].map(o => [o, o.visible]); vis.forEach(([o]) => { o.visible = false; });   // an empty road: no kart or crate in the lens
      tunnelShot = fromRoad(s0 + 52, 0, -5, 2.0, track.point(s0 + 110, -5), 1.5); vis.forEach(([o, v]) => { o.visible = v; }); } }
  // the Free Drive card: Dodo's monster truck coming round the curve inside the Kano Subway (the tiled walls with the red bands)
  let cruiseShot = null;
  { const sub = track.forks.find(f => f.tunnel);
    if (sub) {
      const others = [...race.all.map(k => k.m.root), ...race.boxes.map(b => b.m), ...race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean)), race.coinMesh].map(o => [o, o.visible]);
      others.forEach(([o]) => { o.visible = false; });
      const def = RACERS.find(r => r.veh === 'monster') || RACERS[0], truck = makeKart(def, TEX, quality.layers, 'monster', DEFAULT_CUSTOM.monster); scene.add(truck.root);
      const SF = () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3() }), basis = new THREE.Matrix4();
      const at = sub.frame(48 * sub.seg, SF()), cam2 = sub.frame(66 * sub.seg, SF());
      truck.root.position.copy(at.p); basis.makeBasis(new THREE.Vector3().crossVectors(at.u, at.t), at.u, at.t); truck.root.quaternion.setFromRotationMatrix(basis); truck.root.updateMatrixWorld(true);
      pc.position.copy(cam2.p).addScaledVector(cam2.l, 1.5); pc.position.y += 2.8; pc.lookAt(at.p.x, at.p.y + 2, at.p.z); renderer.render(scene, pc); cruiseShot = canvas.toDataURL('image/jpeg', .75);
      scene.remove(truck.root); others.forEach(([o, v]) => { o.visible = v; });
    } }
  // the Race card: the whole crew bunched up, coming at you down the road
  let packShot = null;
  { race.ev = QUIET; race.reset();   // a clean grid: no shields up, nothing mid-air
    const basis = new THREE.Matrix4(), boxes = [...race.boxes.map(b => b.m), ...race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean))].map(o => [o, o.visible]); boxes.forEach(([o]) => { o.visible = false; });
    const S0 = 1150, put = (o, ds, lat) => { const f = track.frame(S0 + ds, track.newFrame()); o.position.copy(f.p).addScaledVector(f.l, lat); o.position.y = f.p.y; basis.makeBasis(new THREE.Vector3().crossVectors(f.u, f.t), f.u, f.t); o.quaternion.setFromRotationMatrix(basis); o.visible = true; o.updateMatrixWorld(true); };
    const spots = [[0, -1], [-4, 2.6], [-5.5, -3.2], [-10, .6], [-13, 3.4], [-14.5, -2.6]];
    for (let n = 0; n < 30; n++) race.all.forEach(k => race.poseDriver(k, .1));   // everyone eyes front: no head still turned from a taunt in the race behind the menu
    race.all.forEach((k, i) => put(k.m.root, ...spots[i]));
    const F = track.frame(S0, track.newFrame()), at = F.p.clone().addScaledVector(F.t, -6); at.y += .8;
    pc.position.copy(F.p).addScaledVector(F.t, 17).addScaledVector(F.l, 1.6); pc.position.y += 2.6; pc.lookAt(at); renderer.render(scene, pc); packShot = canvas.toDataURL('image/jpeg', .75);
    boxes.forEach(([o, v]) => { o.visible = v; }); attract(); }
  // circuits without an underpass or a subway (Doha's): the Time Trial and Free Drive cards come from the city's own landmarks,
  // so the three cards never show the same picture
  { const L = world.places || [], find = names => names.map(n => L.find(p => p.name === n)).find(Boolean);
    const hideAll = () => { const v = [...race.all.map(k => k.m.root), ...race.boxes.map(b => b.m), ...race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean)), race.coinMesh].filter(Boolean).map(o => [o, o.visible]); v.forEach(([o]) => { o.visible = false; }); return () => v.forEach(([o, vis]) => { o.visible = vis; }); };
    const tt = !tunnelShot && find(['SOUQ WAQIF', 'QANAT QUARTIER', 'MSHEIREB DOWNTOWN', 'MEDINA CENTRALE', 'LUSAIL BOULEVARD']);
    if (tt) { const back = hideAll(); tunnelShot = fromRoad(tt.s, 34, 0, 1.9, track.point(tt.s + 40, 0), 1.6); back(); }   // an empty street from the driver's seat
    const cr = !cruiseShot && find(['WEST BAY', 'PORTO ARABIA', 'KATARA TOWERS', 'LUSAIL MARINA', 'THE CORNICHE']);
    if (cr) {   // Dodo's monster truck cruising, the landmark standing behind it
      const back = hideAll(), def = RACERS.find(r => r.veh === 'monster') || RACERS[0], truck = makeKart(def, TEX, quality.layers, 'monster', DEFAULT_CUSTOM.monster); scene.add(truck.root);
      // find the stretch of road where the landmark lines up straight behind the truck, seen from 14 m off its nose (or tail)
      let best = null;
      for (let s0 = 0; s0 < track.len; s0 += 4) { const i = track.idx(s0); if (track.covered[i] || track.trench[i]) continue;
        const T = track.frame(s0, track.newFrame());
        for (const dir of [1, -1]) { const cx = T.p.x + T.t.x * 14 * dir, cz = T.p.z + T.t.z * 14 * dir, d = Math.hypot(cr.x - cx, cr.z - cz); if (d < 60 || d > 420) continue;
          const a = Math.abs(Math.atan2((T.p.x - cx) * (cr.z - cz) - (T.p.z - cz) * (cr.x - cx), (T.p.x - cx) * (cr.x - cx) + (T.p.z - cz) * (cr.z - cz)));
          if (!best || a < best.a) best = { a, s0, dir }; } }
      const F = track.frame(best.s0, track.newFrame()), basis = new THREE.Matrix4();
      truck.root.position.copy(F.p); basis.makeBasis(new THREE.Vector3().crossVectors(F.u, F.t), F.u, F.t); truck.root.quaternion.setFromRotationMatrix(basis); truck.root.updateMatrixWorld(true);
      pc.position.copy(F.p).addScaledVector(F.t, 14 * best.dir); pc.position.y += 3;
      pc.lookAt(F.p.x, F.p.y + 3.6, F.p.z); renderer.render(scene, pc); cruiseShot = canvas.toDataURL('image/jpeg', .75);
      scene.remove(truck.root); back();
    } }
  if (chapter.id !== 'kano' && tunnelShot) for (const pl of places) if (pl.bore) pl.img = tunnelShot;   // Doha's underpass from the driver's seat (from above it's a slot in the sand)
  mapShot = { image, aspect: (halfW / halfH).toFixed(4), places, tunnel: tunnelShot, cruise: cruiseShot, pack: packShot };
  void image;   // (the home Map tile has one fixed picture: public/tile-map.jpg)
}

// the loading card before a race (Asphalt): the chapter, the goal, pictures of its places, a filling diamond
const INTRO = location.hash === '#capture' ? 2.4 : 5.2;   // seconds: long enough to read the card and see the grid
function raceIntro(then){
  const c = chapter, el = $('#raceLoad');
  $('#rlTitle').textContent = c.tagline.toUpperCase();
  const bl = store.get('bestlap.' + RID, null);
  const T = { gp: [`${LAPS} LAPS · 6 RACERS`, `FINISH 1ST TO WIN +${c.reward}`, `${c.reward} COINS · 3 STARS`],
    tt: [`${LAPS} LAPS · SOLO`, bl ? `BEAT ${fmtTime(bl)}` : 'SET YOUR BEST LAP', bl ? 'RACE YOUR GHOST' : 'YOUR BEST LAP BECOMES YOUR GHOST'],
    free: ['NO CLOCK · NO RIVALS', `CRUISE ${CITY}`, 'EVERY COIN YOU PICK UP IS YOURS'] }[mode];
  $('#rlCity').textContent = `${c.name.toUpperCase()} · ${MODES.find(M => M.id === mode).name}`;
  $('#rlLaps').textContent = T[0]; $('#rlChip').textContent = T[1]; $('#rlGoal').textContent = T[2];
  race.ev = events; race.setMode(mode); race.reset(); Sound.quiet = false; state = 'intro'; introT = 0;   // the grid lines up; the camera sweeps over it
  const fg = el.querySelector('.dia-fg'); fg.style.transition = 'none'; fg.style.strokeDasharray = '0 100'; void fg.getBoundingClientRect();
  fg.style.transition = `stroke-dasharray ${INTRO - .4}s ease-in-out`; requestAnimationFrame(() => { fg.style.strokeDasharray = '100 100'; });
  whip(1); show(el);
  setTimeout(() => { hide(el, null, -1); then(); }, INTRO * 1000);
}

// full screen on phones: Android goes full screen on the first touch; iPhone can only do it from the home screen, so say how once
const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isTouch && !standalone) {
  addEventListener('pointerdown', () => { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); screen.orientation?.lock?.('portrait').catch(() => {}); }, { once: true });
  if (iOS && !store.get('fsTip', false)) { $('#fsTip').hidden = false; $('#fsTipX').onclick = () => { $('#fsTip').hidden = true; store.set('fsTip', true); }; }
}

function startRace(){
  Sound.init();
  if (isTouch) { document.documentElement.requestFullscreen?.().catch(() => {}); screen.orientation?.lock?.('portrait').catch(() => {}); }
  whip(1); $('#menu').hidden = true; $('#map').hidden = true; $('#results').hidden = true; $('#pause').hidden = true; $('#controls').hidden = true; show($('#hud'));
  race.ev = events; race.setMode(mode); race.reset(); Sound.quiet = false; $('#hud').dataset.mode = mode;
  TT.last = -1; TT.laps = []; TT.rec = []; TT.recT = 0; TT.newBest = false; FREE.top = 0;
  if (mode === 'tt') { TT.ghost = store.get('ghost.' + RID, null); race.makeGhost(vehicle, custom(vehicle)); }
  $('#quitBtn').textContent = mode === 'free' ? 'END DRIVE' : 'QUIT';   // (quitting goes back to the chapters) $('#restartBtn').textContent = mode === 'free' ? 'START AGAIN' : 'RESTART RACE';
  $('#againBtn').textContent = mode === 'free' ? 'DRIVE AGAIN' : 'RACE AGAIN';
  hud.lap.textContent = mode === 'free' ? '1' : `1/${LAPS}`; hud.coins.textContent = '0'; hud.kos.textContent = '0'; hud.score.textContent = '0'; hud.combo.textContent = '';
  setWeapon(null, 0, false); events.nitro(0); hud.toasts.innerHTML = ''; hud.center.innerHTML = ''; lastPos = 0;
  state = 'count'; cd = 3.99; lastCd = 0; countStart = clock;
  coach.seen = store.get('coach', {}); coach.step = null; coach.el.hidden = true;
}
function attract(){
  race.ev = QUIET; race.setMode('gp'); race.reset(); race.player.ai = true; Sound.quiet = true;
  for (let i = 0; i < 140; i++) race.update(.05, 'race');   // run it on a few seconds so the pack has spread out
}
function toMenu(){
  state = 'menu'; attract(); renderChapter();
  whip(-1); $('#hud').hidden = true; $('#results').hidden = true; $('#pause').hidden = true; $('#controls').hidden = true; show($('#menu'), -1);
}
function togglePause(){
  if (state === 'race' || state === 'count') { prevState = state; state = 'paused'; $('#hud').style.visibility = 'hidden'; show($('#pause')); Sound.drive({ type: Sound.voiceType || 'kart', speed: 0, throttle: 0, running: false }); Sound.rivals([]); }
  else if (state === 'paused') { state = prevState; $('#hud').style.visibility = ''; hide($('#pause'), null, -1); $('#controls').hidden = true; $('#settings').hidden = true; }
}
$('#pauseBtn').addEventListener('click', togglePause);
$('#ctrlBtn').addEventListener('click', () => swap($('#pause'), $('#controls'), 1));
$('#ctrlBack').addEventListener('click', () => swap($('#controls'), $('#pause'), -1));
$('#resumeBtn').addEventListener('click', togglePause);
$('#restartBtn').addEventListener('click', () => { $('#hud').style.visibility = ''; startRace(); });
// quitting a race asks first (Free Drive's END DRIVE just ends it: it shows your drive, nothing is lost)
$('#quitBtn').addEventListener('click', () => { if (mode === 'free' && state === 'paused') { $('#hud').style.visibility = ''; $('#pause').hidden = true; endDrive(); } else swap($('#pause'), $('#quitAsk'), 1); });
$('#quitNo').addEventListener('click', () => swap($('#quitAsk'), $('#pause'), -1));
$('#quitYes').addEventListener('click', () => { $('#hud').style.visibility = ''; $('#quitAsk').hidden = true; toMenu(); });
$('#againBtn').addEventListener('click', startRace);
$('#menuBtn').addEventListener('click', toMenu);
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'race' || state === 'count')) togglePause(); });

let resultsTimer = 0;
// Free drive has no finish line: ending the drive banks the coins
function endDrive(){
  state = 'results'; race.player.ai = true; resultsTimer = 0;
  const p = race.player, from = store.get('wallet', 0), total = p.coins; store.set('wallet', from + total);
  $('#hud').hidden = true; whip(1); show($('#results'));
  $('#results .tag span').textContent = `${PLACE} · FREE DRIVE`; $('.place-big').hidden = true; $('#resChapter').textContent = 'DRIVE OVER';
  $('#standings').innerHTML = ''; $('#standings').className = 'standings';
  $('#resStats').innerHTML = [['Time', fmtTime(race.time)], ['Laps', Math.max(0, p.lap)], ['Top speed', `${Math.round(FREE.top * 3.2)} km/h`]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  $('#resWallet').textContent = from.toLocaleString('en');
  $('#prize').innerHTML = p.coins ? `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${p.coins}</b></div>` : '';
  setTimeout(() => payOut(from, total), 900);
}
function showResults(){
  if (state !== 'finish') return;
  state = 'results';
  $('#results .tag span').textContent = `${PLACE} · ${MODES.find(M => M.id === mode).name}`; $('.place-big').hidden = mode !== 'gp'; $('#standings').className = mode === 'tt' ? 'standings laps' : 'standings';
  if (mode === 'tt') {   // Time trial: your laps, the best one lit, a bonus for a new record
    const p = race.player, total = TT.laps.reduce((a, b) => a + b, 0), best = Math.min(...TT.laps), from = store.get('wallet', 0), bonus = TT.newBest ? 150 : 0, pay = bonus + p.coins;
    store.set('wallet', from + pay);
    $('#hud').hidden = true; whip(1); show($('#results'));
    $('#resChapter').textContent = TT.newBest ? 'NEW BEST LAP' : `BEST LAP ${fmtTime(store.get('bestlap.' + RID, best))}`;
    $('#standings').innerHTML = TT.laps.map((lt, i) => `<li class="${lt === best ? 'me' : ''}"><span class="nm">LAP ${i + 1}</span><span class="t">${fmtTime(lt)}</span></li>`).join('');
    $('#resStats').innerHTML = [['Time', fmtTime(total)], ['Best lap', fmtTime(best)]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    $('#resWallet').textContent = from.toLocaleString('en');
    $('#prize').innerHTML = bonus + p.coins ? `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${bonus + p.coins}</b></div>` : '';
    setTimeout(() => payOut(from, pay), 900);
    return;
  }
  const p = race.player, best = store.get('best.' + RID, null), newBest = !best || p.finishTime < best;
  if (newBest) store.set('best.' + RID, p.finishTime);
  if (p.rank === 1) store.set('wins.' + vehicle, store.get('wins.' + vehicle, 0) + 1);
  const earned = p.rank === 1 ? 3 : p.rank <= 3 ? 2 : 1; if (earned > store.get('stars.' + RID, 0)) store.set('stars.' + RID, earned);
  // prize money for where you finished, plus every coin picked up on the way; it lands in the bank once the coins fly
  const PRIZE = [chapter.reward, 300, 200, 120, 80, 50], prize = PRIZE[p.rank - 1] ?? 30, from = store.get('wallet', 0), total = prize + p.coins;
  store.set('wallet', from + total);
  $('#hud').hidden = true; whip(1); show($('#results'));
  $('#resPlace').textContent = p.rank; $('#resSfx').textContent = ordinal(p.rank).toUpperCase();
  $('#resChapter').textContent = newBest ? 'NEW BEST TIME' : '';
  $('#resStats').innerHTML = '';   // (your time is in your row of the standings; the coins are in the prize)
  paintStandings();
  $('#resWallet').textContent = from.toLocaleString('en');
  $('#prize').innerHTML = `<div class="pz"><span>PRIZE</span><b><i class="coin-icon"></i>+${total}</b></div>`;   // the place prize and the coins picked up, as one
  setTimeout(() => payOut(from, total), 900);
}
// the coins fly from the prize lines into the bank in the corner: a stream of them on a curve, each one ticking the
// total up with a chime and a buzz, the bank jumping as they land
function payOut(from, total){
  const src = [...document.querySelectorAll('#prize .coin-icon')], bank = $('#resWalletChip'), to = bank.querySelector('.coin-icon').getBoundingClientRect();
  if (!src.length || !total) return;
  const n = Math.min(18, 6 + Math.round(total / 40)), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let landed = 0;
  for (let i = 0; i < n; i++) setTimeout(() => {
    const a = src[i % src.length].getBoundingClientRect(), el = document.createElement('i'); el.className = 'coin-icon paycoin'; document.body.append(el);
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2, lift = 80 + Math.random() * 80, dx = (Math.random() - .5) * 60;
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    const kf = reduce ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${(x1 - x0) * .35 + dx}px), calc(-50% + ${(y1 - y0) * .35 - lift}px)) scale(1.25)`, opacity: 1, offset: .35 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.8)`, opacity: 1 }];
    el.animate(kf, { duration: reduce ? 200 : 620 + Math.random() * 120, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' }).onfinish = () => {
      el.remove(); landed++;
      $('#resWallet').textContent = Math.round(from + total * landed / n).toLocaleString('en');
      bank.classList.remove('bump'); void bank.offsetWidth; bank.classList.add('bump');
      Sound.coin(); Haptics.coin();
    };
  }, i * 70);
}
function paintStandings(){
  $('#standings').innerHTML = race.rank().map(k => `
    <li class="${k === race.player ? 'me' : ''}"><span class="place">${k.rank}</span><span class="face" style="--c:${k.color}"><img src="${FACES[k.def.id] || ''}" alt=""></span>
    <span class="nm">${k.name.toUpperCase()}</span><span class="t">${k.finished ? fmtTime(k.finishTime) : 'RACING'}</span></li>`).join('');
}

// Time trial: record this lap 15 times a second; replay the best one on the ghost, in step with the lap clock
const gq = new THREE.Quaternion(), gq2 = new THREE.Quaternion();
function ghostStep(p){
  const g = race.ghost; if (!g) return;
  const lapT = race.time - TT.start, timing = TT.last >= 0 && !p.finished;
  if (timing && state === 'race' && lapT >= TT.recT) { TT.recT += 1 / 15; const r = p.m.root, q = r.quaternion; TT.rec.push(+lapT.toFixed(3), +r.position.x.toFixed(2), +r.position.y.toFixed(2), +r.position.z.toFixed(2), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4)); }
  const G = TT.ghost, S = G?.s;
  if (!timing || !S || S.length < 16 || lapT > G.d || lapT > S[S.length - 8]) { g.root.visible = false; return; }
  let lo = 0, hi = S.length / 8 - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid * 8] <= lapT) lo = mid; else hi = mid; }
  const a = lo * 8, b = hi * 8, u = clamp((lapT - S[a]) / Math.max(1e-4, S[b] - S[a]), 0, 1);
  g.root.position.set(lerp(S[a + 1], S[b + 1], u), lerp(S[a + 2], S[b + 2], u), lerp(S[a + 3], S[b + 3], u));
  gq.set(S[a + 4], S[a + 5], S[a + 6], S[a + 7]); gq2.set(S[b + 4], S[b + 5], S[b + 6], S[b + 7]); g.root.quaternion.slerpQuaternions(gq, gq2, u);
  g.root.visible = g.root.position.distanceTo(p.m.root.position) > 2.5;   // it fades out of the way when you're on top of it
}

/* ---------- loop ---------- */
let lastPos = 0, last = performance.now();
const CAPTURE = location.hash === '#capture';
const perfTick = perfHud(renderer, () => state);   // ?perf=1: the stutter readout (src/perf.js)
function frame(now){
  if (!CAPTURE) requestAnimationFrame(frame);
  perfTick();
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'paused') { renderer.render(scene, cam); return; }
  clock += dt;
  if (state === 'modes') { if (modesRoom.dirty > 0) { modesRoom.dirty--; renderer.render(modesRoom.scene, modesRoom.cam); } return; }   // a still room: drawn for a few frames when it opens (so nothing can paint over it), then left
  if (state === 'garage') {
    garage.update(dt);
    { const w = innerWidth, h = innerHeight, cust = $('#garage').classList.contains('customising');   // customising: the car sits above the panel
      if (cust) { garage.cam.setViewOffset(w, h, w >= 820 ? -w * .2 : 0, w >= 820 ? 0 : h * .26, w, h); garage.pull = w < 820 ? 1 + (garage.kart?.V.cam || 0) * .45 : 1; } else { garage.pull = 1; if (garage.cam.view?.enabled) garage.cam.clearViewOffset(); } }
    renderer.render(garage.scene, garage.cam);
    return;
  }
  readInput(dt);
  if (state === 'count') {
    cd -= dt;
    const n = Math.ceil(cd - 1);
    if (n !== lastCd && n >= 1) { banner(String(n), 'count', 900); Sound.beep(false); Haptics.count(); }
    lastCd = n;
    world.startLights(Math.min(5, Math.ceil((3.99 - cd) / .58)));   // the gantry lights come on red one by one
    if (cd <= 1) { state = 'race'; banner('GO!', 'count', 900); Sound.beep(true); Haptics.big(); world.startLights('go'); setTimeout(() => world.startLights(0), 3000); }
  }
  if (['menu', 'tomap', 'map'].includes(state) && race.karts.some(k => k.finished)) attract();
  race.update(dt, ['race', 'finish', 'results', 'menu', 'tomap', 'map'].includes(state) ? 'race' : 'idle');
  world.update(dt, clock, cam); world.others.visible = false;   // the other cities' islands stay out of sight: the map is this race's only
  updateCamera(dt);

  if (state === 'race' || state === 'finish' || state === 'count') {
    const p = race.player;
    if (p.rank !== lastPos) { hud.pos.textContent = p.rank; hud.posSfx.textContent = ordinal(p.rank).toUpperCase(); const b = $('#posBig'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); lastPos = p.rank; }
    hud.timer.textContent = fmtTime(mode === 'tt' && TT.last >= 0 && !p.finished ? race.time - TT.start : race.time);   // Time trial: the lap you're on
    if (mode === 'free') FREE.top = Math.max(FREE.top, p.speed);
    if (mode === 'tt') ghostStep(p);
    hud.speed.textContent = Math.round(Math.max(0, p.speed) * 3.2);
    hud.prog.style.width = (clamp(p.prog / (LAPS * track.len), 0, 1) * 100).toFixed(1) + '%';
    gauge(Math.max(0, p.speed) * 3.2, p.boost > 0);
    hud.wrong.hidden = race.wrongT < 1;
    hud.lines.style.opacity = clamp((p.speed - 60) / 30, 0, 1) * (p.boost > 0 ? 1 : .5);
    if (rollingIcon && (rollFlip += dt) > .08) { rollFlip = 0; const w = Object.keys(ICONS)[(Math.random() * Object.keys(ICONS).length) | 0]; hud.wicon.innerHTML = ICONS[w]; hud.wicon.style.color = WEAPONS[w].color; }
    drawMap();
    coachUpdate(dt);
    { const Fk = track.forks || [], d = Fk.length ? Fk[0].sA - p.s : -1, on = Fk.length && !p.br && state === 'race' && d > 0 && d < 170;   // a hand over each way at the fork
      Fk.forEach((f, j) => { const h = scHints[j]; if (!on) { h.hidden = true; return; }
        const q = f.frame(16, { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3() }).p.clone(); q.y += 7; q.project(cam);
        if (q.z < 1) { h.hidden = false; h.style.left = ((q.x * .5 + .5) * innerWidth) + 'px'; h.style.top = ((-q.y * .5 + .5) * innerHeight) + 'px'; } else h.hidden = true; }); }
    Sound.drive({ type: p.m.type, speed: Math.max(0, p.speed) / 66, throttle: state === 'race' ? (race.input.brake ? 0 : 1) : .15, brake: race.input.brake, air: p.fly && p.airT > .12,
      drift: !!p.drift, boost: p.boost > 0, running: true }, dt);
    // the two nearest rivals, heard where they are: ahead or behind, left or right, coming past
    Sound.rivals(race.karts.filter(k => k !== p).map(k => ({ type: k.m.type, speed: Math.max(0, k.speed) / 66, dist: race.dS(k.s, p.s), side: Math.max(-1, Math.min(1, (p.lat - k.lat) / 8)), rel: k.speed - p.speed }))
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist)).slice(0, 2), dt);
  } else { Sound.drive({ type: Sound.voiceType || 'kart', speed: 0, throttle: 0, running: false }, dt); Sound.rivals([], dt); }
  if (state === 'map' && mapUI && !$('#map').hidden) mapUI.place((x, z) => { pv.set(x, 0, z).project(cam); return { x: (pv.x * .5 + .5) * innerWidth, y: (-pv.y * .5 + .5) * innerHeight, on: pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1 }; });
  if (state === 'results' && mode === 'gp' && (resultsTimer += dt) > .5) { resultsTimer = 0; paintStandings(); }
  renderer.render(scene, cam);
}

// builds the chosen circuit into the scene: the road, the city round it, and the race on it (boot, and swapCircuit)
let baseKids = null;
async function buildCircuit(tex, step = async () => {}){
  track = buildTrack((circuit || chapter).track()); track.cityName = circuit ? circuit.name.toUpperCase() : CITY; track.city = chapter.id;
  track.forks = buildForks(track);
  scHints = track.forks.map(f => { const h = $('#scHint').cloneNode(true); h.removeAttribute('id'); h.querySelector('span').textContent = f.tunnel ? 'SUBWAY' : 'BYPASS'; $('#hud').append(h); return h; });
  buildRoad(scene, track, tex); buildForkRoads(scene, track, tex);
  // the race route for the map: a glowing orange ribbon just over the road, shown only from the air
  {
    const pos = [], idx = [], { N, P, L, U } = track;
    for (let i = 0; i <= N; i++) { const k = i % N; for (const sg of [1, -1]) pos.push(P[k].x + L[k].x * sg * 2.4 + U[k].x * 1.6, P[k].y + L[k].y * sg * 2.4 + U[k].y * 1.6, P[k].z + L[k].z * sg * 2.4 + U[k].z * 1.6); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    routeLine = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffb020', side: THREE.DoubleSide, fog: false, transparent: true, opacity: .95, depthWrite: false }));
    routeLine.visible = false; routeLine.renderOrder = 5; scene.add(routeLine);
  }
  await step(48, 'BUILDING ' + (circuit ? circuit.name.toUpperCase() : CITY));
  world = buildWorld(scene, track, tex, { low, city: chapter.id, title: (circuit ? circuit.name.toUpperCase() : CITY) + ' GRAND PRIX', dress: chapter.id === 'doha' ? dressDoha : null });
  await step(66, 'WAKING UP BUDDY');
  race = new Race(scene, track, tex, quality, events);
  race.setVehicle(vehicle, custom(vehicle));
}
// another circuit in the same city (Msheireb to The Pearl): the old one is cleared out of the scene and the new one built
// in its place behind a short veil, then whatever you asked for (the modes, the map) opens. No page reload
let swapping = false;
async function swapCircuit(id, then = ''){
  const c = chapter.circuits?.find(x => x.id === id); if (!c || swapping) return; swapping = true;
  const veil = $('#swapVeil'); veil.querySelector('b').textContent = c.name.toUpperCase(); veil.hidden = false; veil.classList.add('in');
  await new Promise(r => setTimeout(r, 220));   // the veil fades up before the work starts
  for (const o of [...scene.children]) if (!baseKids.has(o)) { scene.remove(o); o.traverse(m => { m.geometry?.dispose?.(); for (const x of [].concat(m.material || [])) x.dispose?.(); }); }
  for (const h of scHints) h.remove(); scHints = [];
  mapPts = null; mapUI = null; mapShot = null;
  circuit = c; RID = chapter.id + '.' + c.id; PLACE = `${CITY} · ${c.name.toUpperCase()}`; store.set('circuit.' + chapter.id, c.id);
  try {
    await buildCircuit(TEX);
    window.gudu = { ...window.gudu, race, track, world };
    setNight(store.get('night', false)); state = 'menu'; attract(); renderChapter();
    try { updateCamera(1); snapshots(); } catch (e) { console.warn('snapshots', e); }
    updateCamera(1); renderer.compile(scene, cam);
  } catch (e) { console.error('circuit swap failed, reloading', e); store.set('afterBoot', then); location.reload(); return; }
  $('#garage').hidden = true;
  if (then === 'modes') { $('#menu').hidden = true; openModes('menu'); }
  else if (then === 'map') { show($('#menu')); openMap(); }
  else show($('#menu'));
  veil.classList.remove('in'); setTimeout(() => { veil.hidden = true; swapping = false; }, 260);
}

async function boot(){
  const fill = $('#loadFill');
  const step = async (pct) => { fill.style.width = pct + '%'; await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30))); };
  await step(6, 'STARTING ENGINES');
  // the canvas-drawn signs use the web fonts, so wait for them (but never for long)
  await Promise.race([Promise.all(['800 italic 92px "Barlow Condensed"', '150px "Permanent Marker"'].map(f => document.fonts?.load(f))), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  await step(18, 'PAINTING THE WALLS');
  const tex = buildTextures(); TEX = tex;
  await step(32, 'LAYING THE ROAD');
  baseKids = new Set(scene.children);   // the lights and the like: everything else in the scene belongs to the circuit
  await buildCircuit(tex, step);
  await step(80, 'OPENING THE GARAGE');
  makeGarage(chapter.id);   // the loaded city's garage; another chapter's is built when you open it
  garage.jumpIn(); garage.update(.016); renderer.compile(garage.scene, garage.cam); renderer.render(garage.scene, garage.cam);   // ready before anyone opens it
  modesRoom = new ModesRoom(); modesRoom.resize(cam.aspect); modesRoom.update(0); renderer.compile(modesRoom.scene, modesRoom.cam);
  PTH = partThumbs();
  FACES = racerPortraits();
  THUMBS = vehicleThumbs(tex, Object.keys(VEHICLES), custom);
  renderGarage();
  window.gudu = { race, track, scene, cam, garage, clearance, world, events, renderer }; // handy from the browser console while building
  await step(92, 'WARMING THE TYRES');
  setNight(store.get('night', false));
  attract(); renderChapter();
  try { updateCamera(1); snapshots(); } catch (e) { console.warn('snapshots', e); }
  updateCamera(1);
  renderer.compile(scene, cam);
  await step(100, 'READY');
  { const wait = 1800 - performance.now(); if (wait > 0 && !CAPTURE) await new Promise(r => setTimeout(r, wait)); }   // on a fast machine, still long enough to see the poster
  $('#loading').classList.add('done'); whip(1);
  store.set('travelTo', '');
  if (store.get('afterBoot', '') === 'modes') { store.set('afterBoot', ''); $('#menu').hidden = true; openModes('menu'); }
  else if (store.get('afterBoot', '') === 'map') { store.set('afterBoot', ''); $('#menu').hidden = true; openMap(); }   // (straight to the map: the home screen no longer flashes up first)
  else if (store.get('afterBoot', '') === 'arrive') { store.set('afterBoot', ''); state = 'menu'; fly = { t: 0, down: true }; lastShot = 'fly'; { const C = track.center; camPos.set(C.x, track.radius * 2.2, C.z + track.radius * .35); camLook.set(C.x, 0, C.z); cam.position.copy(camPos); cam.lookAt(camLook); } show($('#menu'), -1); }   // arriving from the map: down out of the sky onto the new city
  else show($('#menu'));
  if (CAPTURE) { last = 0; window.gudu.frame = frame; window.gudu.ready = true; } else requestAnimationFrame(t => { last = t; frame(t); });
}
Sound.keepAlive(); Feedback.init();
if (isTouch && Tilt.mode === 'tilt') Tilt.set('tilt');   // tilt steering, if it was chosen (src/tilt.js)   // every button's sound and buzz (src/feedback.js)
boot();
if (import.meta.env.DEV) window.__g = { get race(){ return race; }, get state(){ return state; }, set state(v){ state = v; }, get mapShot(){ return mapShot; }, TT, Sound };   // for the dev test scripts only
