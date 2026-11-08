// The race modes: Race, Time Trial and Free Drive as cards (a carousel on a phone), and launching the one you pick.
import { Haptics } from './haptics.js';
import { screenIn, screenOut, stagger, leave, DUR } from './motion.js';
import { LAPS } from './race.js';
import { Sound } from './audio.js';
import { store, fmtTime } from './util.js';
import { $, sceneIn } from './dom.js';
import { chapter, game } from './game.js';
import { raceIntro, startRace } from './race-flow.js';

let modesFrom = 'garage';
export const MODES = [
  { id: 'gp', name: 'RACE', en: 'Against the crew', line: () => `${LAPS} laps · 6 racers · win +${chapter.reward}` },
  {
    id: 'tt',
    name: 'TIME TRIAL',
    en: 'Against the clock',
    line: () => {
      const b = store.get('bestlap.' + game.RID, null);
      return b ? `Best lap ${fmtTime(b)} · race your ghost` : `${LAPS} laps · set your best lap`;
    },
  },
  { id: 'free', name: 'FREE DRIVE', en: `Cruise ${chapter.name}`, line: () => 'No rivals · no clock · keep the coins' },
];
function modePic(id) {
  if (id === 'gp') return game.mapShot?.pack || game.kanoSnap || '';
  if (id === 'tt') return game.mapShot?.tunnel || game.kanoSnap || '';
  return game.mapShot?.cruise || game.kanoSnap || '';
}
export function openModes(from) {
  modesFrom = from;
  $('#modes .m-tag span').textContent = game.PLACE;
  const box = $('#mCards');
  box.innerHTML = MODES.map(
    M =>
      `<button class="mcard ${M.id === game.mode ? 'on' : ''}" data-mode="${M.id}" aria-label="${M.name}, ${M.en}"><img src="${modePic(M.id)}" alt=""><span class="mc-body"><span class="mc-name">${M.name}</span><span class="mc-en">${M.en}</span><span class="mc-line">${M.line()}</span><span class="mc-play">PLAY</span></span></button>`,
  ).join('');
  // all in this one task, before anything is painted: the underpass comes up, the screen fades, the cards are put in place, then they rise in
  game.state = 'modes';
  game.modesRoom.resize(innerWidth / innerHeight);
  game.modesRoom.dirty = 4;
  sceneIn();
  screenIn($('#modes'));
  box.querySelector('.mcard.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  flowCards();
  stagger(box.children, { from: 'up', delay: 40 });
}
// phone: as you swipe, each card grows and lights up the nearer it gets to the middle, and the one in the middle is chosen
function flowCards() {
  const box = $('#mCards');
  if (innerWidth >= 820) {
    for (const c of box.children) {
      c.style.removeProperty('--k');
      c.style.removeProperty('--b');
    }
    return;
  }
  const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
  let best = null,
    bd = 1e9;
  for (const c of box.children) {
    const r = c.getBoundingClientRect(),
      d = (r.left + r.width / 2 - mid) / r.width,
      a = Math.min(1, Math.abs(d));
    c.style.setProperty('--k', (1 - 0.08 * a).toFixed(3));
    c.style.setProperty('--b', (1 - 0.4 * a).toFixed(3));
    if (Math.abs(d) < bd) {
      bd = Math.abs(d);
      best = c;
    }
  }
  if (best && best.dataset.mode !== game.mode) {
    pickMode(best.dataset.mode);
    Haptics.buzz(8);
  }
}
// go: the chosen card pushes forward, the others slide off to their sides, then the race card takes over
function launchMode(card) {
  if (launchMode.busy) return;
  launchMode.busy = true;
  const cards = [...$('#mCards').children],
    i = cards.indexOf(card);
  Haptics.buzz(16);
  Sound.init();
  cards.forEach((c, j) => {
    if (c !== card) leave(c, `translateX(${(j < i ? -1 : 1) * 60}px) scale(.92)`);
  }); // the others slide off to their sides
  leave(card, 'scale(1.08)', { delay: 70 }); // the chosen one pushes towards you
  screenOut($('#modes'), DUR.leave + 70).then(() => {
    launchMode.busy = false;
    if (modesFrom === 'menu') $('#menu').hidden = true;
    raceIntro(startRace);
  });
}
function pickMode(id) {
  game.mode = id;
  store.set('mode', id);
  document.querySelectorAll('#mCards .mcard').forEach(c => c.classList.toggle('on', c.dataset.mode === id));
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initModes() {
  $('#mCards').addEventListener('click', e => {
    const c = e.target.closest('.mcard');
    if (!c) return;
    if (!c.classList.contains('on')) {
      pickMode(c.dataset.mode);
      c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      Haptics.buzz(8);
      return;
    }
    launchMode(c);
  });
  // on a phone the carousel picks whichever card you swipe into the middle
  {
    let q = 0;
    $('#mCards').addEventListener(
      'scroll',
      () => {
        if (!q)
          q = requestAnimationFrame(() => {
            q = 0;
            flowCards();
          });
      },
      { passive: true },
    );
    addEventListener('resize', () => {
      if (!$('#modes').hidden) flowCards();
    });
  }
  $('#mBack').addEventListener('click', () => {
    screenOut($('#modes'));
    game.state = modesFrom === 'garage' ? 'garage' : 'menu';
    sceneIn();
    if (modesFrom === 'garage') screenIn($('#garage'));
    else screenIn($('#menu'));
  });
}
