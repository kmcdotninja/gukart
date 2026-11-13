// QUICK RACE: pick a mode (Race, Time Trial, Free Drive: three cards, an accordion where the one you tap opens and the
// others close), then a short setup on the same screen (DIFFICULTY for a race, CITY, CIRCUIT, DAY or NIGHT) and GO. Each step starts on what's
// already set, so NEXT, NEXT, NEXT goes straight to the race. A new circuit or city is only built when you press GO.
import { Haptics } from './haptics.js';
import { screenIn, screenOut, stagger, leave, DUR } from './motion.js';
import { Sound } from './audio.js';
import { store } from './util.js';
import { $, sceneIn } from './dom.js';
import { CHAPTERS } from './chapters.js';
import { chapter, circuitOf, game } from './game.js';
import { setNight } from './scene.js';
import { raceIntro, startRace } from './race-flow.js';
import { travelTo } from './home.js';
import './quick.css';

let modesFrom = 'garage';
// QUICK RACE's three: one race, a time trial, a free drive (the World Tour starts from the home screen, src/cup.js)
export const MODES = [
  { id: 'gp', name: 'RACE', en: 'Against the crew' },
  {
    id: 'tt',
    name: 'TIME TRIAL',
    en: 'Against the clock',
  },
  { id: 'free', name: 'FREE DRIVE', en: 'Just cruise' },
];
export const modeName = id => (id === 'cup' ? 'WORLD TOUR' : MODES.find(M => M.id === id)?.name || '');
// the game's own arrow icon (no text arrows)
const ARROW =
  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8.9 4.4a1.6 1.6 0 0 1 2.3 0l6.4 6.4a1.7 1.7 0 0 1 0 2.4l-6.4 6.4a1.6 1.6 0 1 1-2.3-2.3l5.3-5.3-5.3-5.3a1.6 1.6 0 0 1 0-2.3z"/></svg>';
// (a race against the crew also asks how hard they should be; a time trial and a free drive have nobody to beat)
const ALL_STEPS = ['mode', 'level', 'city', 'circ', 'time'];
let STEPS = ALL_STEPS;
const stepsFor = mode => (mode === 'gp' ? ALL_STEPS : ALL_STEPS.filter(s => s !== 'level'));
const TITLE = { mode: 'QUICK RACE', level: 'DIFFICULTY', city: 'CITY', circ: 'CIRCUIT', time: 'DAY OR NIGHT' };
// each level a real shot from the game, like every other card: a sunny cruise, the pack on the grid, the Final at night
const LEVEL_CARDS = [
  ['easy', 'EASY', 'The crew takes it easy', '/places/kano-old.jpg'],
  ['normal', 'NORMAL', 'A fair fight', '/modes/race.jpg'],
  ['hard', 'HARD', 'They give no ground', '/places/singapore-marina-night.jpg'],
];
const cities = () => CHAPTERS.filter(c => c.playable);
// what's being set up: starts on what the game is already on
const pick = { city: '', circ: '', night: false, level: 'normal' };
let step = 0;

// each mode has one fixed picture, whatever circuit is built; each city, circuit and time of day has its own (real shots
// from the game, made by tools/place-shots.mjs: public/modes/, public/places/)
const MODE_PIC = { gp: '/modes/race.jpg', tt: '/modes/time-trial.jpg', free: '/modes/free-drive.jpg' };
const modePic = id => MODE_PIC[id];
const placePic = (city, circ, night) => `/places/${city}${circ ? '-' + circ : ''}${night ? '-night' : ''}.jpg`;
const card = (cls, data, img, name, sub) =>
  `<button class="q-card ${cls}" ${data}><img src="${img}" alt=""><span class="q-body"><b class="q-name">${name}</b><span class="q-sub">${sub}</span></span></button>`;

export function openModes(from) {
  modesFrom = from;
  if (game.mode === 'cup' || !MODES.some(M => M.id === game.mode)) pickMode('gp');
  pick.city = chapter.id;
  pick.circ = game.circuit?.id || '';
  pick.night = !!game.night;
  pick.level = store.get('level', 'normal');
  const box = $('#mCards');
  box.innerHTML = MODES.map(
    M =>
      `<button class="mcard" data-mode="${M.id}" aria-expanded="false" aria-label="${M.name}, ${M.en}"><img src="${modePic(M.id)}" alt=""><span class="mc-body"><span class="mc-name">${M.name}</span><span class="mc-more"><span class="mc-in"><span class="mc-en">${M.en}</span><span class="mc-play">NEXT ${ARROW}</span></span></span></span></button>`,
  ).join('');
  // all in this one task, before anything is painted: the underpass comes up, the screen fades, the cards are put in place, then they rise in
  game.state = 'modes';
  game.modesRoom.resize(innerWidth / innerHeight);
  game.modesRoom.dirty = 4;
  sceneIn();
  screenIn($('#modes'));
  goStep(0, 0);
  stagger(box.children, { from: 'up', delay: 40 });
}

// the setup's choices, drawn for the step you're on
// each card's name and line on one line, brought down in size until it fits the card (a long city on a narrow card)
function fitCards() {
  for (const el of document.querySelectorAll(
    '#modes .q-step:not([hidden]) .q-name, #modes .q-step:not([hidden]) .q-sub',
  )) {
    el.style.fontSize = '';
    let px = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && px > 14) el.style.fontSize = `${(px -= 2)}px`;
  }
}
addEventListener('resize', () => requestAnimationFrame(fitCards));
function render(name) {
  const on = x => (x ? 'on' : '');
  if (name === 'level')
    $('#qLevel').innerHTML = LEVEL_CARDS.map(
      ([id, nm, sub, img], n) =>
        `<button class="q-card lvl lvl-${id} ${on(id === pick.level)}" data-level="${id}"><img src="${img}" alt=""><span class="lvl-bars">${'<i></i>'.repeat(n + 1)}${'<i class="off"></i>'.repeat(2 - n)}</span><span class="q-body"><b class="q-name">${nm}</b><span class="q-sub">${sub}</span></span></button>`,
    ).join('');
  if (name === 'city')
    $('#qCity').innerHTML = cities()
      .map(c => card(on(c.id === pick.city), `data-city="${c.id}"`, placePic(c.id), c.name.toUpperCase(), c.tagline))
      .join('');
  if (name === 'circ') {
    const c = CHAPTERS.find(x => x.id === pick.city);
    $('#qCirc').innerHTML = (c.circuits || [])
      .map(x => card(on(x.id === pick.circ), `data-circ="${x.id}"`, placePic(c.id, x.id), x.name.toUpperCase(), c.name))
      .join('');
  }
  if (name === 'time')
    $('#qTime').innerHTML = [false, true]
      .map(n =>
        card(
          on(n === pick.night),
          `data-night="${n ? 1 : 0}"`,
          placePic(pick.city, pick.circ, n),
          n ? 'NIGHT' : 'DAY',
          n ? 'Under the lights' : 'In the sun',
        ),
      )
      .join('');
}

// go to a step (dir: 1 forwards, -1 back, 0 just show it)
function goStep(i, dir = 1) {
  step = i;
  STEPS = stepsFor(game.mode);
  const name = STEPS[i],
    m = $('#modes');
  m.dataset.step = name;
  $('#modes .m-tag span').textContent = TITLE[name];
  $('#qDots').innerHTML = '<li></li>'.repeat(STEPS.length);
  document.querySelectorAll('#qDots li').forEach((d, j) => {
    d.className = j < i ? 'done' : j === i ? 'now' : '';
  });
  for (const s of document.querySelectorAll('#modes .q-step')) s.hidden = s.dataset.step !== name;
  $('#qFoot').hidden = !i;
  $('#qNext').classList.toggle('go', name === 'time');
  $('#qNext span').textContent = name === 'time' ? 'GO' : 'NEXT';
  if (i) {
    render(name);
    const panel = document.querySelector(`#modes .q-step[data-step="${name}"]`);
    if (dir) stagger(panel.children, { from: dir > 0 ? 'right' : 'left' }, 45);
    requestAnimationFrame(fitCards);
  }
}
function next() {
  Haptics.buzz(10);
  if (step < STEPS.length - 1) goStep(step + 1, 1);
  else launch();
}
function back() {
  if (step > 0) {
    goStep(step - 1, -1);
    return;
  }
  screenOut($('#modes'));
  game.state = modesFrom === 'garage' ? 'garage' : 'menu';
  sceneIn();
  if (modesFrom === 'garage') screenIn($('#garage'));
  else screenIn($('#menu'));
}

// GO: the same circuit starts at once; another circuit is built first (in place, or the page reloads for another city),
// and the race starts once it's there (quickGo, from src/circuit.js or src/main.js)
function launch() {
  if (launch.busy) return;
  launch.busy = true;
  Haptics.buzz(16);
  Sound.init();
  const changed = pick.city !== chapter.id || (pick.circ && pick.circ !== game.circuit?.id);
  if (changed) {
    store.set('quickPick', { mode: game.mode, night: pick.night });
    launch.busy = false;
    travelTo(pick.city, 'quick', pick.circ || null);
    return;
  }
  const cards = [...document.querySelectorAll('#qTime .q-card')],
    card = cards.find(c => c.classList.contains('on'));
  cards.forEach(c => c !== card && leave(c, 'scale(.92)'));
  if (card) leave(card, 'scale(1.06)', { delay: 70 });
  screenOut($('#modes'), DUR.leave + 70).then(() => {
    launch.busy = false;
    if (modesFrom === 'menu') $('#menu').hidden = true;
    setNight(pick.night);
    raceIntro(startRace);
  });
}
// after a swap or a reload for a quick race: the mode and the time of day it was set up with, then the race
export function quickGo() {
  const q = store.get('quickPick', null);
  store.set('quickPick', '');
  if (q?.mode && MODES.some(M => M.id === q.mode)) pickMode(q.mode);
  if (q) setNight(!!q.night);
  $('#menu').hidden = true;
  $('#modes').hidden = true;
  raceIntro(startRace);
}

function pickMode(id) {
  game.mode = id;
  store.set('mode', id);
  document.querySelectorAll('#mCards .mcard').forEach(c => {
    c.classList.toggle('on', c.dataset.mode === id);
    c.setAttribute('aria-expanded', c.dataset.mode === id);
  });
}
// one choice in a setup step: it lights up, the others dim (tapping the lit one again goes on, like NEXT)
function choose(box, sel, attr, val) {
  box.querySelectorAll(sel).forEach(c => c.classList.toggle('on', c.dataset[attr] === val));
  Haptics.buzz(8);
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initModes() {
  // the accordion: it opens with every card closed; tap one and it opens (the others close), tap the open one to go on
  $('#mCards').addEventListener('click', e => {
    const c = e.target.closest('.mcard');
    if (!c) return;
    if (!c.classList.contains('on')) {
      pickMode(c.dataset.mode);
      Haptics.buzz(8);
      return;
    }
    next();
  });
  $('#qCity').addEventListener('click', e => {
    const c = e.target.closest('.q-card');
    if (!c) return;
    if (c.classList.contains('on')) return next(); // the chosen one again: go on
    if (pick.city !== c.dataset.city) {
      pick.city = c.dataset.city;
      const ch = CHAPTERS.find(x => x.id === pick.city);
      pick.circ = ch.id === chapter.id ? game.circuit?.id || '' : circuitOf(ch)?.id || '';
    }
    choose($('#qCity'), '.q-card', 'city', pick.city);
  });
  $('#qLevel').addEventListener('click', e => {
    const c = e.target.closest('.q-card');
    if (!c) return;
    if (c.classList.contains('on')) return next();
    pick.level = c.dataset.level;
    store.set('level', pick.level);
    choose($('#qLevel'), '.q-card', 'level', pick.level);
  });
  $('#qCirc').addEventListener('click', e => {
    const c = e.target.closest('.q-card');
    if (!c) return;
    if (c.classList.contains('on')) return next();
    pick.circ = c.dataset.circ;
    choose($('#qCirc'), '.q-card', 'circ', pick.circ);
  });
  $('#qTime').addEventListener('click', e => {
    const c = e.target.closest('.q-card');
    if (!c) return;
    if (c.classList.contains('on')) return next();
    pick.night = c.dataset.night === '1';
    choose($('#qTime'), '.q-card', 'night', c.dataset.night);
  });
  $('#qNext').addEventListener('click', next);
  $('#mBack').addEventListener('click', back);
}
