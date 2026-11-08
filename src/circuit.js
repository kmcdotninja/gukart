// Building a circuit into the scene: the road, the city round it and the race on it (at boot), and swapping to another
// circuit in the same city without reloading the page.
import * as THREE from 'three';
import { buildTrack, buildRoad, buildForks, buildForkRoads } from './track.js';
import { buildWorld } from './world.js';
import { Race } from './race.js';
import { dressDoha } from './doha.js';
import { store } from './util.js';
import { $, show } from './dom.js';
import { low, quality, renderer, scene, cam, setNight } from './scene.js';
import { events } from './hud.js';
import { updateCamera } from './camera.js';
import { chapter, CITY, game } from './game.js';
import { renderChapter } from './home.js';
import { custom } from './garage-screen.js';
import { openModes } from './modes.js';
import { openMap } from './worldmap.js';
import { snapshots } from './snapshots.js';
import { attract } from './race-flow.js';

// builds the chosen circuit into the scene: the road, the city round it, and the race on it (boot, and swapCircuit)

export async function buildCircuit(tex, step = async () => {}) {
  game.track = buildTrack((game.circuit || chapter).track());
  game.track.cityName = game.circuit ? game.circuit.name.toUpperCase() : CITY;
  game.track.city = chapter.id;
  game.track.forks = buildForks(game.track);
  game.scHints = game.track.forks.map(f => {
    const h = $('#scHint').cloneNode(true);
    h.removeAttribute('id');
    h.querySelector('span').textContent = f.tunnel ? 'SUBWAY' : 'BYPASS';
    $('#hud').append(h);
    return h;
  });
  buildRoad(scene, game.track, tex);
  buildForkRoads(scene, game.track, tex);
  // the race route for the map: a glowing orange ribbon just over the road, shown only from the air
  {
    const pos = [],
      idx = [],
      { N, P, L, U } = game.track;
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      for (const sg of [1, -1])
        pos.push(
          P[k].x + L[k].x * sg * 2.4 + U[k].x * 1.6,
          P[k].y + L[k].y * sg * 2.4 + U[k].y * 1.6,
          P[k].z + L[k].z * sg * 2.4 + U[k].z * 1.6,
        );
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    game.routeLine = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: '#ffb020',
        side: THREE.DoubleSide,
        fog: false,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    game.routeLine.visible = false;
    game.routeLine.renderOrder = 5;
    scene.add(game.routeLine);
  }
  await step(48, 'BUILDING ' + (game.circuit ? game.circuit.name.toUpperCase() : CITY));
  game.world = buildWorld(scene, game.track, tex, {
    low,
    city: chapter.id,
    title: (game.circuit ? game.circuit.name.toUpperCase() : CITY) + ' GRAND PRIX',
    dress: chapter.id === 'doha' ? dressDoha : null,
  });
  await step(66, 'WAKING UP BUDDY');
  game.race = new Race(scene, game.track, tex, quality, events);
  game.race.setVehicle(game.vehicle, custom(game.vehicle));
}
// another circuit in the same city (Msheireb to The Pearl): the old one is cleared out of the scene and the new one built
// in its place behind a short veil, then whatever you asked for (the modes, the map) opens. No page reload
let swapping = false;
export async function swapCircuit(id, then = '') {
  const c = chapter.circuits?.find(x => x.id === id);
  if (!c || swapping) return;
  swapping = true;
  const veil = $('#swapVeil');
  veil.querySelector('b').textContent = c.name.toUpperCase();
  veil.hidden = false;
  veil.classList.add('in');
  await new Promise(r => setTimeout(r, 220)); // the veil fades up before the work starts
  for (const o of [...scene.children])
    if (!game.baseKids.has(o)) {
      scene.remove(o);
      o.traverse(m => {
        m.geometry?.dispose?.();
        for (const x of [].concat(m.material || [])) x.dispose?.();
      });
    }
  for (const h of game.scHints) h.remove();
  game.scHints = [];
  game.mapPts = null;
  game.mapUI = null;
  game.mapShot = null;
  game.circuit = c;
  game.RID = chapter.id + '.' + c.id;
  game.PLACE = `${CITY} · ${c.name.toUpperCase()}`;
  store.set('circuit.' + chapter.id, c.id);
  try {
    await buildCircuit(game.TEX);
    setNight(store.get('night', false));
    game.state = 'menu';
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
  } catch (e) {
    console.error('circuit swap failed, reloading', e);
    store.set('afterBoot', then);
    location.reload();
    return;
  }
  $('#garage').hidden = true;
  if (then === 'modes') {
    $('#menu').hidden = true;
    openModes('menu');
  } else if (then === 'map') {
    show($('#menu'));
    openMap();
  } else show($('#menu'));
  veil.classList.remove('in');
  setTimeout(() => {
    veil.hidden = true;
    swapping = false;
  }, 260);
}
