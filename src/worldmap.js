// The map: the camera flies up out of the city, the circuit's places show as pins, and it dives back down when you close it.
import { Feedback } from './feedback.js';
import * as THREE from 'three';
import { buildMap } from './mapscreen.js';
import { CHAPTERS } from './chapters.js';
import { Sound } from './audio.js';
import { clamp, store } from './util.js';
import { $, show, hide } from './dom.js';
import { travelTo } from './home.js';
import { openGarage } from './garage-screen.js';
import { raceIntro, startRace } from './race-flow.js';
import { game, chapter } from './game.js';

// opening the map: the camera flies straight up out of the race until it's looking down on the whole island, and the map
// fades in over exactly that view; closing dives back down to the racing

export const mapPan = { x: 0, z: 0, h: 0 },
  pv = new THREE.Vector3();

export function openMap() {
  Sound.init();
  Sound.blip(120, 0.9, 'sawtooth', 0.04, 3);
  game.mapUI ||= buildMap($('#map'), {
    places: game.mapShot.places,
    wallet: store.get('wallet', 0).toLocaleString('en'),
    onPan: (dx, dy) => {
      const k = ((game.track.radius * 2.25) / innerHeight) * 1.1;
      mapPan.x -= dx * k;
      mapPan.z -= dy * k;
      const r = game.track.radius * 2.6;
      mapPan.x = clamp(mapPan.x, -r, r);
      mapPan.z = clamp(mapPan.z, -r, r);
    },
    title: game.PLACE,
    // the places to race, as chips along the map: every circuit in every city that's built. The lit one is this map;
    // another flies you there (another circuit swaps in place, another city loads), and its map opens
    islands: CHAPTERS.filter(c => c.playable).flatMap(c =>
      (c.circuits || [{ id: null, name: c.name }]).map(x => ({
        name: `${c.name} · ${x.name}`.toUpperCase(),
        city: c.id,
        circ: x.id,
        ch: c.n,
        open: c.id === chapter.id && (!x.id || x.id === game.circuit?.id),
        built: true,
      })),
    ),
    onIsland: is => {
      if (!is.open) setTimeout(() => travelTo(is.city, 'map', is.circ), 500);
    },
    onAction: p => {
      if (p.kind === 'race') {
        $('#map').hidden = true;
        game.state = 'menu';
        game.mode = 'gp';
        raceIntro(startRace);
      } else if (p.kind === 'garage') {
        $('#map').hidden = true;
        openGarage();
      }
    },
  });
  hide($('#menu'));
  game.state = 'tomap';
  game.fly = { t: 0 };
  mapPan.x = 0;
  mapPan.z = 0;
  mapPan.h = 0;
  game.mapFly = null;
  setTimeout(() => {
    const m = $('#map');
    m.hidden = false;
    m.classList.remove('fadeout');
    m.classList.add('fadein');
    show(m.querySelector('.nfs-top'));
    setTimeout(() => show(m.querySelector('.nfs-card')), 90);
  }, 650);
  $('#map').querySelector('#mapBack').onclick = closeMap;
}
function closeMap() {
  Sound.blip(300, 0.8, 'sawtooth', 0.04, 0.3);
  const m = $('#map');
  m.classList.remove('fadein');
  m.classList.add('fadeout');
  setTimeout(() => {
    m.hidden = true;
    m.classList.remove('fadeout');
    game.state = 'menu';
    game.fly = { t: 0, down: true };
    game.lastShot = 'fly';
    show($('#menu'), -1);
  }, 280);
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initWorldmap() {
  // the map is the chosen race's map: pick The Pearl on the home card, tap Map, and it's The Pearl. Only one circuit is
  // built at a time, so a different one is loaded first (behind the loading screen), then its map opens
  $('#mapBtn').addEventListener('click', () => {
    const c = CHAPTERS[game.chIndex];
    if (!c.playable) return Feedback.say('deny');
    if (travelTo(c.id, 'map')) return;
    openMap();
  });
}
