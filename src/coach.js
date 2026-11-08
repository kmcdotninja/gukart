// The first-race coach: points at each control the first time you need it, and goes once you've used it.
import { ICON } from './icons.js';
import { Tilt } from './tilt.js';
import { isTouch, store } from './util.js';
import { $ } from './dom.js';
import { game } from './game.js';

export const coach = { step: null, t: 0, done: 0, el: $('#coach'), text: $('#coachText') };
const COACH = {
  steer: {
    touch: `HOLD ${ICON.left}${ICON.right} TO STEER`,
    keys: `${ICON.left}${ICON.right} TO STEER`,
    at: '#steerPad',
    btn: ['#leftBtn', '#rightBtn'],
  },
  brake: { touch: 'HOLD THE BRAKE TO SLOW DOWN', keys: 'HOLD DOWN TO BRAKE', at: '#brakeBtn', btn: ['#brakeBtn'] },
  drift: {
    touch: 'HOLD THE TURN TO DRIFT, LET GO TO BOOST',
    keys: 'HOLD SPACE IN A TURN, LET GO TO BOOST',
    at: '#steerPad',
    btn: ['#leftBtn', '#rightBtn'],
  },
  fire: { touch: 'TAP FIRE TO SHOOT', keys: 'PRESS F TO FIRE', at: '#fireBtn', btn: ['#fireBtn'] },
};
function coachShow(step) {
  if (coach.seen?.[step]) return;
  coach.step = step;
  coach.t = 0;
  coach.done = 0;
  const c = COACH[step],
    el = coach.el;
  document.querySelectorAll('.hint').forEach(b => b.classList.remove('hint'));
  coach.text.innerHTML = Tilt.on && step === 'steer' ? 'TILT YOUR PHONE TO STEER' : isTouch ? c.touch : c.keys; // (our own strings: they carry the arrow icons)
  el.classList.toggle('swipe', false);
  if (isTouch && !(Tilt.on && c.at === '#steerPad')) {
    const r = $(c.at).getBoundingClientRect();
    el.style.left = r.left + r.width / 2 + 'px';
    el.style.top = r.top - (c.at === '#steerPad' ? 190 : 96) + 'px';
    c.btn.forEach(q => $(q).classList.add('hint'));
  } else {
    el.style.left = '50%';
    el.style.top = '19%';
  } // up in the sky, clear of your kart and the road ahead
  el.querySelector('.hand').style.display = isTouch ? '' : 'none';
  el.hidden = false;
}
function coachEnd() {
  if (!coach.step) return;
  coach.seen[coach.step] = true;
  store.set('coach', coach.seen);
  coach.step = null;
  coach.el.hidden = true;
  document.querySelectorAll('.hint').forEach(b => b.classList.remove('hint'));
}
export function coachUpdate(dt) {
  if (!coach.seen) return;
  const p = game.race.player,
    inp = game.race.input;
  if (!coach.step) {
    if (!coach.seen.steer && (game.state === 'count' || game.state === 'race')) coachShow('steer');
    else if (!coach.seen.brake && game.state === 'race' && game.race.time > 4 && isTouch) coachShow('brake');
    else if (
      !coach.seen.drift &&
      game.state === 'race' &&
      game.race.time > 5 &&
      Math.abs(game.track.K[game.track.idx(p.s)]) > 0.008
    )
      coachShow('drift');
    else if (!coach.seen.fire && game.state === 'race' && p.weapon) coachShow('fire');
    return;
  }
  coach.t += dt;
  // each prompt goes once you've done it (or after a while, so it never nags)
  if (coach.step === 'steer' && game.state === 'race') {
    if (Math.abs(inp.steer) > 0.5) coach.done += dt;
    if (coach.done > 0.4 || coach.t > 12) coachEnd();
  } else if (coach.step === 'brake') {
    if (inp.brake) coach.done += dt;
    if (coach.done > 0.3 || coach.t > 6) coachEnd();
  } else if (coach.step === 'drift') {
    if (p.drift) coach.done += dt;
    if (coach.done > 0.6 || coach.t > 8) coachEnd();
  } else if (coach.step === 'fire') {
    if (!p.weapon || coach.t > 8) coachEnd();
  }
}
