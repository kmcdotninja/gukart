// The home screen: the World Tour tile, QUICK RACE, GARAGE, MAP, and the sound and night buttons. Also travelTo():
// going to another city reloads the game; another circuit in the same city swaps in place.
import { screenOut } from './motion.js';
import { CHAPTERS } from './chapters.js';
import { Sound } from './audio.js';
import { store } from './util.js';
import { $ } from './dom.js';
import { setNight } from './scene.js';
import { chapter, circuitOf, game } from './game.js';
import { openModes } from './modes.js';
import { swapCircuit } from './circuit.js';
import { cupOf, playCup, trophyOf, TOUR, raceName, isFinal, showRoute, hideRoute } from './cup.js';
import { maybeChest } from './chest.js';
import { paintBadge } from './garage-screen.js';

export function travelTo(id, then = '', circ = null) {
  const c = CHAPTERS.find(x => x.id === id),
    want = circ || (c.circuits ? circuitOf(c).id : null);
  if (id === chapter.id && (!want || want === game.circuit?.id)) return false;
  if (id === chapter.id) {
    swapCircuit(want, then);
    return true;
  } // another circuit in this city: swapped in place, no reload
  store.set('city', id);
  if (want) store.set('circuit.' + id, want);
  store.set('afterBoot', then);
  store.set('travelTo', { name: (c.circuits ? c.circuits.find(x => x.id === want).name : c.name).toUpperCase(), then }); // the loader says what's coming (index.html)
  location.reload();
  return true;
}

// The home screen is a few big things (Destruction AllStars' menu: a big picture, big tiles, almost no small print):
// the World Tour tile (its name, which race is next, a mark per race), then QUICK RACE, GARAGE and MAP. Picking a city
// and circuit for a quick race is on the QUICK RACE screen (src/modes.js); the tour picks its own
export function renderChapter() {
  paintBadge(); // (a red number on GARAGE: cars you can afford now)
  const c = CHAPTERS[game.chIndex],
    t = cupOf(),
    won = trophyOf(),
    n = TOUR.races.length;
  $('#tourSub').textContent = !t
    ? won
      ? `${['GOLD', 'SILVER', 'BRONZE'][won - 1]} WON`
      : `${n} RACES`
    : isFinal(t)
      ? 'THE FINAL'
      : `RACE ${t.i + 1} OF ${n}`;
  // a mark per race: done (orange), next (white), the Final (a gold flag)
  $('#tourMarks').innerHTML = TOUR.races
    .map(
      (r, i) =>
        `<li class="${t && i < t.i ? 'done' : ''} ${(t ? t.i : 0) === i ? 'next' : ''} ${i === n - 1 ? 'fin' : ''}"></li>`,
    )
    .join('');
  $('#tourGo').firstChild.textContent = t ? 'CONTINUE' : 'START';
  $('#goBtn').setAttribute(
    'aria-label',
    t ? `World Tour: continue, race ${t.i + 1} of ${n}, ${raceName(t.races[t.i])}` : `World Tour: start, ${n} races`,
  );
  const gp = $('#gPlay');
  gp.disabled = !c.playable;
  gp.querySelector('span').textContent = c.playable ? 'PLAY' : 'SOON';
  {
    // (no city under PLAY: the line only shows to say why the button is off)
    const sub = gp.querySelector('small');
    sub.textContent = c.playable ? '' : 'CHAPTER LOCKED';
    sub.hidden = c.playable;
  }
  $('#wallet').textContent = store.get('wallet', 0).toLocaleString('en');
  maybeChest(); // a chest earned since you were last here drops in
}
const soundBtn = $('#soundBtn');
export const paintSound = () => {
  soundBtn.classList.toggle('off', !Sound.on);
  soundBtn.setAttribute('aria-label', Sound.on ? 'Sound on' : 'Sound off');
};

// wire up this screen's buttons and listeners (called once, from main.js)
export function initHome() {
  // the World Tour: start it, or carry on (in another city, the game goes there first)
  $('#goBtn').addEventListener('click', () => {
    Sound.init();
    if (!cupOf()) return showRoute(); // a new tour: its route first
    screenOut($('#menu'));
    playCup(); // (it goes to the race's city and circuit first, if they aren't the ones built)
  });
  $('#trBack').addEventListener('click', hideRoute);
  $('#trGo').addEventListener('click', () => {
    hideRoute();
    screenOut($('#menu'));
    playCup();
  });
  // QUICK RACE: the modes, with the city and circuit to race on along the top
  $('#quickBtn').addEventListener('click', () => {
    Sound.init();
    screenOut($('#menu'));
    openModes('menu');
  });
  $('#nightBtn').addEventListener('click', () => setNight(!game.night));
  soundBtn.addEventListener('click', () => {
    Sound.init();
    Sound.toggle();
    paintSound();
  });
  paintSound();
}
