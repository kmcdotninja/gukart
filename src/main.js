// GUKART starts here: wires up every screen, then boot() builds the city and the race behind the loading screen, and
// frame() runs the game every frame: input, the race, the camera, the HUD, the sound, then draws it.
import { Haptics } from './haptics.js';
import { ModesRoom } from './modesroom.js';
import { Feedback } from './feedback.js';
import { perfHud } from './perf.js';
import { Tilt } from './tilt.js';
import * as THREE from 'three';
import { buildTextures } from './textures.js';
import { LAPS, WEAPONS } from './race.js';
import { VEHICLES, clearance } from './buddy.js';
import { vehicleThumbs, partThumbs, racerPortraits } from './garage.js';
import { Sound } from './audio.js';
import { clamp, isTouch, store, fmtTime, ordinal } from './util.js';
import { $, whip, show } from './dom.js';
import { renderer, scene, cam, setNight } from './scene.js';
import { hud, ICONS, banner, events, gauge, drawMap } from './hud.js';
import { readInput } from './input.js';
import { coachUpdate } from './coach.js';
import { camPos, camLook, updateCamera } from './camera.js';
import { chapter, game } from './game.js';
import { renderChapter } from './home.js';
import { renderGarage, custom, makeGarage } from './garage-screen.js';
import { TT, FREE, ghostStep } from './timetrial.js';
import { openModes } from './modes.js';
import { pv, openMap } from './worldmap.js';
import { snapshots } from './snapshots.js';
import { attract } from './race-flow.js';
import { paintStandings } from './results.js';
import { buildCircuit } from './circuit.js';
import { initInput } from './input.js';
import { initHome } from './home.js';
import { initSettings } from './settings.js';
import { initGarageScreen } from './garage-screen.js';
import { initModes } from './modes.js';
import { initWorldmap } from './worldmap.js';
import { initRaceFlow } from './race-flow.js';
import { inject } from '@vercel/analytics';
import './style.css';
import './screens.css';

document.documentElement.classList.remove('booting'); // the styles are in (imported above): lift the navy first-frame cover (index.html)

// every screen's buttons and listeners
initInput();
initHome();
initSettings();
initGarageScreen();
initModes();
initWorldmap();
initRaceFlow();

// ---- the frame loop
let last = performance.now();
const CAPTURE = location.hash === '#capture';
// Vercel Web Analytics: page views on the live site only (its script exists only there: not on this machine, in the
// smoke test or in a recording)
const LOCAL = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname);
if (!CAPTURE && !LOCAL) inject();
const perfTick = perfHud(renderer, () => game.state); // ?perf=1: the stutter readout (src/perf.js)
function frame(now) {
  if (!CAPTURE) requestAnimationFrame(frame);
  perfTick();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (document.body.dataset.state !== game.state) document.body.dataset.state = game.state; // what's on screen, for the smoke test (tools/smoke.mjs)
  if (game.state === 'paused') {
    renderer.render(scene, cam);
    return;
  }
  game.clock += dt;
  if (game.state === 'modes') {
    if (game.modesRoom.dirty > 0) {
      game.modesRoom.dirty--;
      renderer.render(game.modesRoom.scene, game.modesRoom.cam);
    }
    return;
  } // a still room: drawn for a few frames when it opens (so nothing can paint over it), then left
  if (game.state === 'garage') {
    game.garage.update(dt);
    {
      const w = innerWidth,
        h = innerHeight,
        cust = $('#garage').classList.contains('customising'); // customising: the car sits above the panel
      if (cust) {
        game.garage.cam.setViewOffset(w, h, w >= 820 ? -w * 0.2 : 0, w >= 820 ? 0 : h * 0.26, w, h);
        game.garage.pull = w < 820 ? 1 + (game.garage.kart?.V.cam || 0) * 0.45 : 1;
      } else {
        game.garage.pull = 1;
        if (game.garage.cam.view?.enabled) game.garage.cam.clearViewOffset();
      }
    }
    renderer.render(game.garage.scene, game.garage.cam);
    return;
  }
  readInput(dt);
  if (game.state === 'count') {
    game.cd -= dt;
    const n = Math.ceil(game.cd - 1);
    if (n !== game.lastCd && n >= 1) {
      banner(String(n), 'count', 900);
      Sound.beep(false);
      Haptics.count();
    }
    game.lastCd = n;
    game.world.startLights(Math.min(5, Math.ceil((3.99 - game.cd) / 0.58))); // the gantry lights come on red one by one
    if (game.cd <= 1) {
      game.state = 'race';
      banner('GO!', 'count', 900);
      Sound.beep(true);
      Haptics.big();
      game.world.startLights('go');
      setTimeout(() => game.world.startLights(0), 3000);
    }
  }
  if (['menu', 'tomap', 'map'].includes(game.state) && game.race.karts.some(k => k.finished)) attract();
  game.race.update(dt, ['race', 'finish', 'results', 'menu', 'tomap', 'map'].includes(game.state) ? 'race' : 'idle');
  game.world.update(dt, game.clock, cam);

  updateCamera(dt);

  if (game.state === 'race' || game.state === 'finish' || game.state === 'count') {
    const p = game.race.player;
    if (p.rank !== game.lastPos) {
      hud.pos.textContent = p.rank;
      hud.posSfx.textContent = ordinal(p.rank).toUpperCase();
      const b = $('#posBig');
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
      game.lastPos = p.rank;
    }
    hud.timer.textContent = fmtTime(
      game.mode === 'tt' && TT.last >= 0 && !p.finished ? game.race.time - TT.start : game.race.time,
    ); // Time trial: the lap you're on
    if (game.mode === 'free') FREE.top = Math.max(FREE.top, p.speed);
    if (game.mode === 'tt') ghostStep(p);
    hud.speed.textContent = Math.round(Math.max(0, p.speed) * 3.2);
    hud.prog.style.width = (clamp(p.prog / (LAPS * game.track.len), 0, 1) * 100).toFixed(1) + '%';
    gauge(Math.max(0, p.speed) * 3.2, p.boost > 0);
    hud.wrong.hidden = game.race.wrongT < 1;
    hud.lines.style.opacity = clamp((p.speed - 60) / 30, 0, 1) * (p.boost > 0 ? 1 : 0.5);
    if (game.rollingIcon && (game.rollFlip += dt) > 0.08) {
      game.rollFlip = 0;
      const w = Object.keys(ICONS)[(Math.random() * Object.keys(ICONS).length) | 0];
      hud.wicon.innerHTML = ICONS[w];
      hud.wicon.style.color = WEAPONS[w].color;
    }
    drawMap();
    coachUpdate(dt);
    {
      const Fk = game.track.forks || [],
        d = Fk.length ? Fk[0].sA - p.s : -1,
        on = Fk.length && !p.br && game.state === 'race' && d > 0 && d < 170; // a hand over each way at the fork
      Fk.forEach((f, j) => {
        const h = game.scHints[j];
        if (!on) {
          h.hidden = true;
          return;
        }
        const q = f
          .frame(16, { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), l: new THREE.Vector3() })
          .p.clone();
        q.y += 7;
        q.project(cam);
        if (q.z < 1) {
          h.hidden = false;
          h.style.left = (q.x * 0.5 + 0.5) * innerWidth + 'px';
          h.style.top = (-q.y * 0.5 + 0.5) * innerHeight + 'px';
        } else h.hidden = true;
      });
    }
    Sound.drive(
      {
        type: p.m.type,
        speed: Math.max(0, p.speed) / 66,
        throttle: game.state === 'race' ? (game.race.input.brake ? 0 : 1) : 0.15,
        brake: game.race.input.brake,
        air: p.fly && p.airT > 0.12,
        drift: !!p.drift,
        boost: p.boost > 0,
        running: true,
      },
      dt,
    );
    // the two nearest rivals, heard where they are: ahead or behind, left or right, coming past
    Sound.rivals(
      game.race.karts
        .filter(k => k !== p)
        .map(k => ({
          type: k.m.type,
          speed: Math.max(0, k.speed) / 66,
          dist: game.race.dS(k.s, p.s),
          side: Math.max(-1, Math.min(1, (p.lat - k.lat) / 8)),
          rel: k.speed - p.speed,
        }))
        .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))
        .slice(0, 2),
      dt,
    );
  } else {
    Sound.drive({ type: Sound.voiceType || 'kart', speed: 0, throttle: 0, running: false }, dt);
    Sound.rivals([], dt);
  }
  if (game.state === 'map' && game.mapUI && !$('#map').hidden)
    game.mapUI.place((x, z) => {
      pv.set(x, 0, z).project(cam);
      return {
        x: (pv.x * 0.5 + 0.5) * innerWidth,
        y: (-pv.y * 0.5 + 0.5) * innerHeight,
        on: pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1,
      };
    });
  if (game.state === 'results' && game.mode === 'gp' && (game.resultsTimer += dt) > 0.5) {
    game.resultsTimer = 0;
    paintStandings();
  }
  renderer.render(scene, cam);
}

async function boot() {
  const fill = $('#loadFill'),
    stepEl = $('#ldStep'),
    pctEl = $('#ldPct');
  // under the bar: what's being built right now, and how far along. The number is set outright, not counted up: the
  // heavier steps hold the page for seconds, and a count frozen halfway would disagree with the bar.
  // Hidden until the race font is in, so it never flashes up in another one.
  // The percentage is true to time: each step's share of the bar is how long it took on this device last time (stored
  // after every boot, weighted 70% to the latest so a font download on the first visit soon drops out), or on a first visit the average of a desktop and a phone-speed
  // run. The numbers the steps are called with (6, 18 ... 92, also from buildCircuit) only name the checkpoint
  const ORDER = [6, 18, 32, 48, 66, 80, 92],
    FIRST = { 6: 700, 18: 120, 32: 160, 48: 670, 66: 5200, 80: 820, 92: 1570 }, // ms: fonts, textures, road, city, racers, garage, warm-up
    saved = store.get('bootTimes', null),
    ms = ORDER.map(k => Math.max(1, +(saved && saved[k]) || FIRST[k])),
    total = ms.reduce((a, b) => a + b, 0),
    startAt = {},
    began = {};
  ORDER.reduce((acc, k, i) => ((startAt[k] = (acc / total) * 100), acc + ms[i]), 0);
  const step = async (key, label) => {
    began[key] = performance.now();
    if (key >= 100 && !CAPTURE) {
      const took = {};
      ORDER.forEach((k, i) => (took[k] = Math.round((began[ORDER[i + 1]] ?? began[100]) - began[k])));
      if (ORDER.every(k => took[k] >= 0))
        store.set(
          'bootTimes',
          Object.fromEntries(ORDER.map(k => [k, saved?.[k] ? Math.round(saved[k] * 0.3 + took[k] * 0.7) : took[k]])),
        );
    }
    const pct = key >= 100 ? 100 : Math.round(startAt[key] ?? key);
    fill.style.width = pct + '%';
    pctEl.textContent = pct + '%';
    if (label) $('#ldStepTxt').textContent = label;
    if (document.fonts?.check('800 italic 16px "Barlow Condensed"')) stepEl.classList.add('on');
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  };
  await step(6, 'STARTING ENGINES');
  // the canvas-drawn signs use the web fonts, so wait for them (but never for long)
  await Promise.race([
    Promise.all(['800 italic 92px "Barlow Condensed"', '150px "Permanent Marker"'].map(f => document.fonts?.load(f))),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});
  await step(18, 'PAINTING THE WALLS');
  const tex = buildTextures();
  game.TEX = tex;
  await step(32, 'LAYING THE ROAD');
  game.baseKids = new Set(scene.children); // the lights and the like: everything else in the scene belongs to the circuit
  await buildCircuit(tex, step);
  await step(80, 'OPENING THE GARAGE');
  makeGarage(chapter.id); // the loaded city's garage; another chapter's is built when you open it
  game.garage.jumpIn();
  game.garage.update(0.016);
  renderer.compile(game.garage.scene, game.garage.cam);
  renderer.render(game.garage.scene, game.garage.cam); // ready before anyone opens it
  game.modesRoom = new ModesRoom();
  game.modesRoom.resize(cam.aspect);
  game.modesRoom.update(0);
  renderer.compile(game.modesRoom.scene, game.modesRoom.cam);
  game.PTH = partThumbs();
  game.FACES = racerPortraits();
  game.THUMBS = vehicleThumbs(tex, Object.keys(VEHICLES), custom);
  renderGarage();
  await step(92, 'WARMING THE TYRES');
  setNight(store.get('night', false));
  attract();
  renderChapter();
  try {
    updateCamera(1);
    snapshots();
  } catch (e) {
    console.warn('snapshots', e);
  }
  updateCamera(1);
  renderer.compile(scene, cam);
  await step(100, 'READY');
  {
    const wait = 1800 - performance.now();
    if (wait > 0 && !CAPTURE) await new Promise(r => setTimeout(r, wait));
  } // on a fast machine, still long enough to see the poster
  $('#loading').classList.add('done');
  whip(1);
  store.set('travelTo', '');
  if (store.get('afterBoot', '') === 'modes') {
    store.set('afterBoot', '');
    $('#menu').hidden = true;
    openModes('menu');
  } else if (store.get('afterBoot', '') === 'map') {
    store.set('afterBoot', '');
    $('#menu').hidden = true;
    openMap();
  } // (straight to the map: the home screen no longer flashes up first)
  else if (store.get('afterBoot', '') === 'arrive') {
    store.set('afterBoot', '');
    game.state = 'menu';
    game.fly = { t: 0, down: true };
    game.lastShot = 'fly';
    {
      const C = game.track.center;
      camPos.set(C.x, game.track.radius * 2.2, C.z + game.track.radius * 0.35);
      camLook.set(C.x, 0, C.z);
      cam.position.copy(camPos);
      cam.lookAt(camLook);
    }
    show($('#menu'), -1);
  } // arriving from the map: down out of the sky onto the new city
  else show($('#menu'));
  if (CAPTURE) {
    last = 0;
    window.gukart.ready = true; // the capture script steps frame() itself
  } else
    requestAnimationFrame(t => {
      last = t;
      frame(t);
    });
}
// A handle on the game from the browser console (window.gukart.game.race, ...), only while building it (npm run dev) or
// capturing pictures (#capture): never in the game players get. tools/road-check.mjs uses it too.
if (import.meta.env.DEV || CAPTURE)
  window.gukart = { game, scene, cam, renderer, events, clearance, Sound, TT, frame, ready: false };

Sound.keepAlive(); // wake the sound after the phone sleeps or the tab comes back
Feedback.init(); // every button's sound and buzz (src/feedback.js)
if (isTouch && Tilt.mode === 'tilt') Tilt.set('tilt'); // tilt steering, if it was chosen (src/tilt.js)
boot();
