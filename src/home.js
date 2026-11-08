// The home screen: the chapter card (city, circuit, stars, prize), the chapter stepper, PLAY, and the sound and night
// buttons. Also travelTo(): going to another city reloads the game; another circuit in the same city swaps in place.
import { screenOut } from './motion.js';
import { Feedback } from './feedback.js';
import { CHAPTERS } from './chapters.js';
import { Sound } from './audio.js';
import { store } from './util.js';
import { $ } from './dom.js';
import { setNight } from './scene.js';
import { chapter, circuitOf, game } from './game.js';
import { openModes } from './modes.js';
import { swapCircuit } from './circuit.js';

const pickedCirc = {}; // the circuit chosen on the home card, per chapter, before you go
export function travelTo(id, then = '', circ = null) {
  const c = CHAPTERS.find(x => x.id === id),
    want = circ || (c.circuits ? pickedCirc[id] || circuitOf(c).id : null);
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

export function renderChapter() {
  const c = CHAPTERS[game.chIndex],
    rid = c.id + (c.circuits ? '.' + (pickedCirc[c.id] || circuitOf(c).id) : ''),
    stars = store.get('stars.' + rid, 0);
  $('#chNum').textContent = `CHAPTER ${c.n}`;
  $('#chName').textContent = c.name.toUpperCase();
  $('#chTag').textContent = c.tagline;
  {
    const box = $('#chCirc');
    box.hidden = !c.circuits;
    if (c.circuits) {
      const on = pickedCirc[c.id] || circuitOf(c).id;
      box.innerHTML = c.circuits
        .map(
          x =>
            `<button data-circ="${x.id}" class="${x.id === on ? 'on' : ''}"><span>${x.name.toUpperCase()}</span></button>`,
        )
        .join('');
    }
  }
  $('#chStars').innerHTML = [0, 1, 2]
    .map(
      i =>
        `<svg viewBox="0 0 24 24" class="${i < stars ? 'won' : ''}"><path d="M12 2l3 6.6 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.8z"/></svg>`,
    )
    .join('');
  $('#chReward').innerHTML = c.playable ? `<i class="coin-icon"></i><b>+${c.reward}</b>` : '<b>LOCKED</b>';
  $('#dots').innerHTML = CHAPTERS.map(
    (x, i) =>
      `<li class="${i === game.chIndex ? 'on' : ''} ${x.playable ? '' : 'locked'}"><button data-ch="${i}" data-n="${x.n}" aria-label="Chapter ${x.n}">${x.n}</button></li>`,
  ).join('');
  const go = $('#goBtn');
  go.disabled = !c.playable;
  go.querySelector('span').textContent = c.playable ? 'PLAY' : 'SOON';
  go.querySelector('small').textContent = c.playable
    ? `RACE · ${c.circuits ? c.circuits.find(x => x.id === (pickedCirc[c.id] || circuitOf(c).id)).name.toUpperCase() : c.name.toUpperCase()}`
    : 'CHAPTER LOCKED';
  $('#menu').classList.toggle('locked', !c.playable);
  const gp = $('#gPlay');
  gp.disabled = !c.playable;
  gp.querySelector('span').textContent = c.playable ? 'PLAY' : 'SOON';
  gp.querySelector('small').textContent = c.playable ? c.name.toUpperCase() : 'CHAPTER LOCKED';
  $('#wallet').textContent = store.get('wallet', 0).toLocaleString('en');
}
const soundBtn = $('#soundBtn');
export const paintSound = () => {
  soundBtn.classList.toggle('off', !Sound.on);
  soundBtn.setAttribute('aria-label', Sound.on ? 'Sound on' : 'Sound off');
};

// wire up this screen's buttons and listeners (called once, from main.js)
export function initHome() {
  $('#chCirc').addEventListener('click', e => {
    const b = e.target.closest('[data-circ]');
    if (!b) return;
    pickedCirc[CHAPTERS[game.chIndex].id] = b.dataset.circ;
    renderChapter();
  });
  $('#dots').addEventListener('click', e => {
    const b = e.target.closest('[data-ch]');
    if (b) {
      game.chIndex = +b.dataset.ch;
      renderChapter();
    }
  });
  $('#prevCh').addEventListener('click', () => {
    game.chIndex = (game.chIndex + CHAPTERS.length - 1) % CHAPTERS.length;
    renderChapter();
  });
  $('#nextCh').addEventListener('click', () => {
    game.chIndex = (game.chIndex + 1) % CHAPTERS.length;
    renderChapter();
  });
  $('#goBtn').addEventListener('click', () => {
    if (CHAPTERS[game.chIndex].playable) {
      if (travelTo(CHAPTERS[game.chIndex].id, 'modes')) return;
      Sound.init();
      screenOut($('#menu'));
      openModes('menu');
    } else Feedback.say('deny');
  });
  $('#nightBtn').addEventListener('click', () => setNight(!game.night));
  soundBtn.addEventListener('click', () => {
    Sound.init();
    Sound.toggle();
    paintSound();
  });
  paintSound();
}
