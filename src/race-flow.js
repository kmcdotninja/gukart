// Starting, pausing, restarting and leaving a race: the loading card before it, the countdown, the pause menu and the
// quit question, and the attract race that runs behind the home screen.
import { LAPS } from './race.js';
import { Sound } from './audio.js';
import { isTouch, store, fmtTime } from './util.js';
import { $, whip, show, swap, hide } from './dom.js';
import { hud, setWeapon, events, QUIET } from './hud.js';
import { coach } from './coach.js';
import { chapter, CITY, game } from './game.js';
import { renderChapter } from './home.js';
import { custom } from './garage-screen.js';
import { TT, FREE } from './timetrial.js';
import { MODES } from './modes.js';
import { endDrive } from './results.js';

// the loading card before a race (Asphalt): the chapter, the goal, pictures of its places, a filling diamond
export const INTRO = location.hash === '#capture' ? 2.4 : 5.2; // seconds: long enough to read the card and see the grid
export function raceIntro(then) {
  const c = chapter,
    el = $('#raceLoad');
  $('#rlTitle').textContent = c.tagline.toUpperCase();
  const bl = store.get('bestlap.' + game.RID, null);
  const T = {
    gp: [`${LAPS} LAPS · 6 RACERS`, `FINISH 1ST TO WIN +${c.reward}`, `${c.reward} COINS · 3 STARS`],
    tt: [
      `${LAPS} LAPS · SOLO`,
      bl ? `BEAT ${fmtTime(bl)}` : 'SET YOUR BEST LAP',
      bl ? 'RACE YOUR GHOST' : 'YOUR BEST LAP BECOMES YOUR GHOST',
    ],
    free: ['NO CLOCK · NO RIVALS', `CRUISE ${CITY}`, 'EVERY COIN YOU PICK UP IS YOURS'],
  }[game.mode];
  $('#rlCity').textContent = `${c.name.toUpperCase()} · ${MODES.find(M => M.id === game.mode).name}`;
  $('#rlLaps').textContent = T[0];
  $('#rlChip').textContent = T[1];
  $('#rlGoal').textContent = T[2];
  game.race.ev = events;
  game.race.setMode(game.mode);
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

export function startRace() {
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
  game.race.setMode(game.mode);
  game.race.reset();
  Sound.quiet = false;
  $('#hud').dataset.mode = game.mode;
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
  hud.lap.textContent = game.mode === 'free' ? '1' : `1/${LAPS}`;
  hud.coins.textContent = '0';
  hud.kos.textContent = '0';
  hud.score.textContent = '0';
  hud.combo.textContent = '';
  setWeapon(null, 0, false);
  events.nitro(0);
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
  game.race.ev = QUIET;
  game.race.setMode('gp');
  game.race.reset();
  game.race.player.ai = true;
  Sound.quiet = true;
  for (let i = 0; i < 140; i++) game.race.update(0.05, 'race'); // run it on a few seconds so the pack has spread out
}
function toMenu() {
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
    } else swap($('#pause'), $('#quitAsk'), 1);
  });
  $('#quitNo').addEventListener('click', () => swap($('#quitAsk'), $('#pause'), -1));
  $('#quitYes').addEventListener('click', () => {
    $('#hud').style.visibility = '';
    $('#quitAsk').hidden = true;
    toMenu();
  });
  $('#againBtn').addEventListener('click', startRace);
  $('#menuBtn').addEventListener('click', toMenu);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'race' || game.state === 'count')) togglePause();
  });
}
