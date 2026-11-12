// Starting, pausing, restarting and leaving a race: the loading card before it, the countdown, the pause menu and the
// quit question, and the attract race that runs behind the home screen.
import { LAPS, LEVELS } from './race.js';
import { Sound } from './audio.js';
import { isTouch, store, fmtTime } from './util.js';
import { $, whip, show, swap, hide } from './dom.js';
import { hud, setWeapon, events, QUIET } from './hud.js';
import { coach } from './coach.js';
import { chapter, CITY, game } from './game.js';
import { renderChapter } from './home.js';
import { custom } from './garage-screen.js';
import { TT, FREE } from './timetrial.js';
import { modeName } from './modes.js';
import { endDrive } from './results.js';
import { hidePodium } from './podium.js';
import { setNight } from './scene.js';
import { introLines, cupNext, retryCupRace, newCup, cupOf, endTour, isFinal, tourLevel } from './cup.js';
import { rivalNames } from './buddy.js';

// the loading card before a race (Asphalt): the chapter, the goal, pictures of its places, a filling diamond
export const INTRO = location.hash === '#capture' ? 2.4 : 5.2; // seconds: long enough to read the card and see the grid
export function raceIntro(then) {
  const c = chapter,
    el = $('#raceLoad');
  // the World Tour's Final dresses up: a gold card with a trophy, THE FINAL; fireworks and the crowd at the start
  // (src/main.js); a gold badge on the HUD all race
  const t = game.mode === 'cup' && cupOf();
  game.final = !!(t && isFinal(t));
  el.classList.toggle('final', game.final);
  $('#finalBadge').hidden = !game.final;
  $('#rlTitle').textContent = game.final ? 'THE FINAL' : c.tagline.toUpperCase();
  const bl = store.get('bestlap.' + game.RID, null);
  const T = {
    gp: [`${LAPS} LAPS`, `WIN +${c.reward}`, `${c.reward} COINS`],
    tt: [`${LAPS} LAPS`, bl ? `BEAT ${fmtTime(bl)}` : 'SET YOUR BEST LAP', bl ? 'RACE YOUR GHOST' : 'MAKE YOUR GHOST'],
    free: ['NO RIVALS', `CRUISE ${CITY}`, 'KEEP THE COINS'],
    cup: game.mode === 'cup' ? introLines() : null,
  }[game.mode];
  $('#rlCity').textContent = modeName(game.mode);
  $('#rlLaps').textContent = T[0];
  $('#rlChip').textContent = T[1];
  $('#rlGoal').textContent = T[2];
  game.race.ev = events;
  game.race.setMode(raceMode());
  // how hard the rivals are: the World Tour's own (harder city by city), or what was picked in QUICK RACE
  game.race.setLevel(game.mode === 'cup' ? tourLevel() : LEVELS[store.get('level', 'normal')]);
  game.race.reset();
  Sound.quiet = false;
  game.state = 'intro';
  game.introT = 0; // the grid lines up; the camera sweeps over it
  const fg = el.querySelector('.dia-fg');
  fg.style.transition = 'none';
  fg.style.strokeDasharray = '0 100';
  void fg.getBoundingClientRect();
  fg.style.transition = `stroke-dasharray ${INTRO - 0.4}s ease-in-out`;
  requestAnimationFrame(() => {
    fg.style.strokeDasharray = '100 100';
  });
  whip(1);
  show(el);
  fitTitle();
  setTimeout(() => {
    hide(el, null, -1);
    then();
  }, INTRO * 1000);
}

// full screen on phones: Android goes full screen on the first touch; iPhone can only do it from the home screen, so say how once
const standalone =
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  navigator.standalone;
const iOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// a cup race is run as a Race (6 racers, 3 laps); the cup is kept round it (src/cup.js)
const raceMode = () => (game.mode === 'cup' ? 'gp' : game.mode);
export function startRace() {
  hidePodium();
  Sound.init();
  if (isTouch) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    screen.orientation?.lock?.('portrait').catch(() => {});
  }
  whip(1);
  $('#menu').hidden = true;
  $('#map').hidden = true;
  $('#results').hidden = true;
  $('#pause').hidden = true;
  $('#controls').hidden = true;
  show($('#hud'));
  game.race.ev = events;
  game.race.setMode(raceMode());
  // how hard the rivals are: the World Tour's own (harder city by city), or what was picked in QUICK RACE
  game.race.setLevel(game.mode === 'cup' ? tourLevel() : LEVELS[store.get('level', 'normal')]);
  game.race.reset();
  // the rivals' names: a World Tour keeps the ones it drew at its start; any other race draws new ones
  game.race.setNames(game.mode === 'cup' ? cupOf()?.names : rivalNames());
  Sound.quiet = false;
  $('#hud').dataset.mode = raceMode();
  TT.last = -1;
  TT.laps = [];
  TT.rec = [];
  TT.recT = 0;
  TT.newBest = false;
  FREE.top = 0;
  if (game.mode === 'tt') {
    TT.ghost = store.get('ghost.' + game.RID, null);
    game.race.makeGhost(game.vehicle, custom(game.vehicle));
  }
  $('#quitBtn').textContent = game.mode === 'free' ? 'END DRIVE' : 'QUIT'; // (quitting goes back to the chapters)
  $('#restartBtn').textContent = game.mode === 'free' ? 'START AGAIN' : 'RESTART RACE';
  $('#againBtn').textContent = game.mode === 'free' ? 'DRIVE AGAIN' : 'RACE AGAIN';
  $('#menuBtn').textContent = 'HOME';
  $('#retryBtn').hidden = true;
  hud.lap.textContent = game.mode === 'free' ? '1' : `1/${LAPS}`;
  hud.coins.textContent = '0';
  hud.kos.textContent = '0';
  hud.score.textContent = '0';
  hud.combo.textContent = '';
  setWeapon(null, 0, false);
  events.nitro(0);
  events.heat(0);
  document.body.classList.remove('onfire');
  hud.toasts.innerHTML = '';
  hud.center.innerHTML = '';
  game.lastPos = 0;
  game.state = 'count';
  game.cd = 3.99;
  game.lastCd = 0;
  game.countStart = game.clock;
  coach.seen = store.get('coach', {});
  coach.step = null;
  coach.el.hidden = true;
}
export function attract() {
  hidePodium();
  game.race.ev = QUIET;
  game.race.setMode('gp');
  game.race.reset();
  game.race.player.ai = true;
  Sound.quiet = true;
  for (let i = 0; i < 140; i++) game.race.update(0.05, 'race'); // run it on a few seconds so the pack has spread out
}
// home again. After a race you finished, day turns to night (or night to day), so everyone gets to race both
function toMenu(raced = false) {
  if (raced === true) setNight(!game.night);
  game.state = 'menu';
  attract();
  renderChapter();
  whip(-1);
  $('#hud').hidden = true;
  $('#results').hidden = true;
  $('#pause').hidden = true;
  $('#controls').hidden = true;
  show($('#menu'), -1);
}
// the quit question: a race asks to confirm; a World Tour race offers to save the tour and come back to this race
// later (SAVE & EXIT), to drop it (END TOUR), or to carry on (KEEP RACING)
function paintQuitAsk() {
  const t = game.mode === 'cup' && cupOf();
  $('#quitAsk .tag span').textContent = t ? 'LEAVE THE WORLD TOUR?' : 'QUIT RACE?';
  $('#quitAsk .ask-text').textContent = t
    ? 'Save the tour for later, or end it.'
    : "You'll lose this race and go back to the chapters.";
  $('#quitNo').textContent = t ? 'KEEP RACING' : 'BACK';
  $('#quitYes').textContent = t ? 'SAVE & EXIT' : 'QUIT';
  $('#quitEnd').hidden = !t;
}
export function togglePause() {
  if (game.state === 'race' || game.state === 'count') {
    game.prevState = game.state;
    game.state = 'paused';
    $('#hud').style.visibility = 'hidden';
    show($('#pause'));
    Sound.drive({ type: Sound.voiceType || 'kart', speed: 0, throttle: 0, running: false });
    Sound.rivals([]);
  } else if (game.state === 'paused') {
    game.state = game.prevState;
    $('#hud').style.visibility = '';
    hide($('#pause'), null, -1);
    $('#controls').hidden = true;
    $('#settings').hidden = true;
  }
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initRaceFlow() {
  if (isTouch && !standalone) {
    addEventListener(
      'pointerdown',
      () => {
        document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
        screen.orientation?.lock?.('portrait').catch(() => {});
      },
      { once: true },
    );
    if (iOS && !store.get('fsTip', false)) {
      $('#fsTip').hidden = false;
      $('#fsTipX').onclick = () => {
        $('#fsTip').hidden = true;
        store.set('fsTip', true);
      };
    }
  }
  $('#pauseBtn').addEventListener('click', togglePause);
  $('#ctrlBtn').addEventListener('click', () => swap($('#pause'), $('#controls'), 1));
  $('#ctrlBack').addEventListener('click', () => swap($('#controls'), $('#pause'), -1));
  $('#resumeBtn').addEventListener('click', togglePause);
  $('#restartBtn').addEventListener('click', () => {
    $('#hud').style.visibility = '';
    startRace();
  });
  // quitting a race asks first (Free Drive's END DRIVE just ends it: it shows your drive, nothing is lost)
  $('#quitBtn').addEventListener('click', () => {
    if (game.mode === 'free' && game.state === 'paused') {
      $('#hud').style.visibility = '';
      $('#pause').hidden = true;
      endDrive();
    } else {
      paintQuitAsk();
      swap($('#pause'), $('#quitAsk'), 1);
    }
  });
  $('#quitNo').addEventListener('click', () => swap($('#quitAsk'), $('#pause'), -1));
  // END TOUR: the tour is dropped (the home tile goes back to START)
  $('#quitEnd').addEventListener('click', () => {
    endTour();
    $('#hud').style.visibility = '';
    $('#quitAsk').hidden = true;
    toMenu();
  });
  $('#quitYes').addEventListener('click', () => {
    $('#hud').style.visibility = '';
    $('#quitAsk').hidden = true;
    toMenu();
  });
  // in a cup the results card's buttons go on through it: NEXT RACE, FINAL STANDINGS, NEW CUP; RETRY RACE runs it again
  $('#againBtn').addEventListener('click', () => {
    if (game.mode !== 'cup') return startRace();
    if (game.cupFinal) newCup();
    else cupNext();
  });
  $('#retryBtn').addEventListener('click', retryCupRace);
  $('#menuBtn').addEventListener('click', () => toMenu(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'race' || game.state === 'count')) togglePause();
  });
}

// the card's big title stays on one line: shrunk until it fits the card's width (a long name on a small phone)
function fitTitle() {
  const h = $('#rlTitle');
  h.style.fontSize = '';
  requestAnimationFrame(() => {
    let px = parseFloat(getComputedStyle(h).fontSize);
    while (h.scrollWidth > h.clientWidth + 1 && px > 24) h.style.fontSize = `${(px -= 2)}px`;
  });
}
