// The Driving School: a minute's practice on the circuit you're on, no rivals. One lesson at a time (steer, brake,
// drift and boost, nitro, a crate and fire), each pointed at its own button (or key, or the phone tilting) and ticked
// off the moment you've done it. Offered once, the first time the game opens (START or SKIP); after that it's in
// Settings. Finishing it (or skipping it) also puts away the first-race tips: you've learnt them here.
import { ICON } from './icons.js';
import { Tilt } from './tilt.js';
import { isTouch, store } from './util.js';
import { $, show, hide } from './dom.js';
import { game } from './game.js';
import { coachPoint, coachHide } from './coach.js';
import { events } from './hud.js';
import { raceIntro, startRace, goHome } from './race-flow.js';

const L = ICON.left + ICON.right;
// each lesson: what to do on a phone, with tilt steering, on a keyboard; where it points; when it's done
const ALL = [
  {
    touch: `HOLD ${L} TO STEER`,
    tilt: 'TILT YOUR PHONE TO STEER',
    keys: `${L} TO STEER`,
    at: '#steerPad',
    btn: ['#leftBtn', '#rightBtn'],
    // both ways, a moment each
    check: (s, p, inp, dt) => {
      if (inp.steer < -0.5) s.l += dt;
      if (inp.steer > 0.5) s.r += dt;
      return s.l > 0.3 && s.r > 0.3;
    },
  },
  {
    keysOnly: true, // (phones have no brake button: a keyboard lesson only)
    touch: 'HOLD THE BRAKE',
    keys: 'HOLD ↓ TO BRAKE',
    at: '#brakeBtn',
    btn: ['#brakeBtn'],
    check: (s, p, inp, dt) => (inp.brake ? (s.t += dt) : 0) > 0.4,
  },
  {
    touch: 'HOLD A TURN TO DRIFT',
    tilt: 'TILT HARD TO DRIFT',
    keys: 'HOLD SPACE IN A TURN',
    at: '#steerPad',
    btn: ['#leftBtn', '#rightBtn'],
    // two steps: drift, hold it until it's charged, then let go for the boost
    check: (s, p) => {
      if (p.drift && p.charge > 0.75 && !s.ready) {
        s.ready = true;
        say('LET GO TO BOOST');
      }
      if (s.was && !p.drift) {
        if (p.boost > 0.2) return true;
        s.ready = false;
        say('HOLD THE DRIFT LONGER'); // (let go too soon: no boost)
      }
      s.was = !!p.drift;
      return false;
    },
  },
  {
    touch: 'TAP NITRO',
    keys: 'PRESS ↑ FOR NITRO',
    at: '#nitroBtn',
    btn: ['#nitroBtn'],
    start: p => {
      p.nitro = 1; // (a full bottle to try it with)
      events.nitro(1);
    },
    check: (s, p) => p.nitro < 0.9,
  },
  {
    touch: 'DRIVE INTO A CRATE',
    keys: 'DRIVE INTO A CRATE',
    check: (s, p) => !!(p.weapon || p.pending || p.rolling > 0),
  },
  {
    touch: 'TAP FIRE',
    keys: 'PRESS F TO FIRE',
    at: '#fireBtn',
    btn: ['#fireBtn'],
    // (the crate's prize is still rolling: wait for it)
    check: (s, p) => {
      if (p.weapon && !(p.rolling > 0) && s.ammo == null) s.ammo = p.ammo;
      return s.ammo != null && (!p.weapon || p.ammo < s.ammo); // (one shot is enough: a rocket has two)
    },
  },
];

const LESSONS = ALL.filter(l => !(l.keysOnly && isTouch));
const S = { i: -1, st: null, wait: 0 };
const say = html => coachPoint(html, LESSONS[S.i].at, LESSONS[S.i].btn || []);
const text = l => (Tilt.on && l.tilt ? l.tilt : isTouch ? l.touch : l.keys);

function paintSteps() {
  $('#schSteps').innerHTML = LESSONS.map((_, i) => `<i class="${i < S.i ? 'done' : i === S.i ? 'on' : ''}"></i>`).join(
    '',
  );
}
function lesson(i) {
  S.i = i;
  S.st = { l: 0, r: 0, t: 0 };
  S.wait = 0;
  paintSteps();
  const l = LESSONS[i];
  l.start?.(game.race.player);
  say(text(l));
}

export function startSchool() {
  store.set('school.offered', true);
  game.school = true;
  game.prevMode = game.mode;
  game.mode = 'free';
  game.race.school = true; // (crates out on the road, though it's a drive on your own)
  game.flybyDone = true; // (no circuit introduction: straight to the grid)
  $('#menu').hidden = true;
  $('#schoolAsk').hidden = true;
  $('#settings').hidden = true;
  raceIntro(startRace);
}
// a new start (from startRace): back to the first lesson
export function schoolReset() {
  S.i = -1;
  coachHide();
  $('#schoolDone').hidden = true;
  show($('#schoolBar'));
  paintSteps();
}

// called every frame from main.js
export function schoolUpdate(dt) {
  if (!game.school || game.state !== 'race') return;
  if (S.i < 0) return lesson(0);
  if (S.i >= LESSONS.length) return;
  const p = game.race.player;
  if (S.wait > 0) {
    // NICE! for a moment, then the next lesson
    if ((S.wait -= dt) <= 0) {
      if (S.i + 1 < LESSONS.length) lesson(S.i + 1);
      else finish();
    }
    return;
  }
  if (LESSONS[S.i].check(S.st, p, game.race.input, dt)) {
    S.wait = 0.9;
    coachPoint('NICE!', null, []);
    $('#schSteps').children[S.i]?.classList.add('done');
  }
}

function finish() {
  S.i = LESSONS.length;
  coachHide();
  store.set('school.done', true);
  store.set('coach', { steer: true, brake: true, drift: true, fire: true }); // (the first-race tips: learnt here)
  game.state = 'paused';
  game.prevState = 'race';
  hide($('#schoolBar'));
  $('#hud').style.visibility = 'hidden';
  show($('#schoolDone'));
}

// leaving the school (done, or quit from pause): home, everything as it was
export function endSchool() {
  if (!game.school) return;
  game.school = false;
  game.race.school = false;
  game.mode = game.prevMode || 'gp';
  S.i = -1;
  coachHide();
  $('#schoolBar').hidden = true;
  $('#schoolDone').hidden = true;
  $('#hud').style.visibility = '';
}

// the first time the game opens: offered once, START or SKIP. Not for anyone who has raced already, and never in a test run
export function offerSchool() {
  if (store.get('school.offered', false) || location.search.includes('gktest') || location.hash === '#capture') return;
  store.set('school.offered', true);
  if (Object.keys(store.get('coach', {})).length) return; // (they've raced before this was here)
  hide($('#menu'));
  show($('#schoolAsk'), 1);
}

export function initSchool() {
  $('#schoolGo').addEventListener('click', startSchool);
  $('#schoolSkip').addEventListener('click', () => {
    hide($('#schoolAsk'));
    show($('#menu'), -1);
  });
  $('#setSchool').addEventListener('click', startSchool);
  $('#schoolHome').addEventListener('click', () => {
    endSchool();
    goHome();
  });
  $('#schoolRace').addEventListener('click', () => {
    endSchool();
    goHome();
    $('#quickBtn').click(); // straight on to pick a race
  });
}
