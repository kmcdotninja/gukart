// Controls: keyboard, the touch steer pad and buttons (left, right, brake, nitro, fire), and the garage drag-to-spin.
// readInput() turns them into the race's input every frame.
import { Tilt } from './tilt.js';
import { clamp } from './util.js';
import { $ } from './dom.js';
import { canvas } from './scene.js';
import { hud } from './hud.js';
import { startRace, togglePause } from './race-flow.js';
import { game } from './game.js';

const keys = {};
let touchSteer = 0,
  touchId = null,
  x0 = 0,
  kbSteer = 0,
  brakeTouch = false,
  fireTouch = false,
  btnSteer = 0,
  btnTarget = 0,
  hardT = 0;
let gDrag = null;
const endTouch = e => {
  if (e.pointerId === touchId) {
    touchId = null;
    touchSteer = 0;
  }
};
function holdButton(el, on, off) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('on');
    on();
  });
  // (lostpointercapture only counts on the button itself: it also fires, and bubbles up, when the press moves from the
  // icon inside to the button, which switched the arrows and the pedal straight back off)
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    el.addEventListener(ev, e => {
      if (ev === 'lostpointercapture' && e.target !== el) return;
      el.classList.remove('on');
      off();
    });
}
const wheel = (v, to, dt) => {
  const rate = to && Math.sign(to) === Math.sign(v || to) && Math.abs(to) > Math.abs(v) ? 2.6 : 6;
  return v + clamp(to - v, -rate * dt, rate * dt);
};
// let go of everything: every key, touch and button counts as released, the wheel back to the centre. Called whenever
// the game pauses or resumes and whenever the page loses focus (a tab switch, a phone call, the app sent to the back):
// the browser never delivers the keyup or the end of a touch that happens while we're away, so without this a turn held
// at that moment stayed held after resuming and steered the kart into the wall
export function releaseInput() {
  for (const k in keys) keys[k] = false;
  touchId = null;
  touchSteer = 0;
  kbSteer = 0;
  btnSteer = 0;
  btnTarget = 0;
  brakeTouch = false;
  fireTouch = false;
  hardT = 0;
  for (const el of document.querySelectorAll('#leftBtn, #rightBtn, #brakeBtn, #fireBtn, #nitroBtn'))
    el.classList.remove('on');
  const inp = game.race?.input;
  if (inp) {
    inp.steer = 0;
    inp.drift = inp.fire = inp.brake = false;
    inp.firePressed = inp.nitroPressed = inp.driftPressed = false;
  }
}

export function readInput(dt) {
  const kb = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0);
  // the keys and the phone's arrows turn a steering wheel, not a switch: it winds on steadily (full lock after about
  // 0.4 s held, so a tap is a nudge) and springs back to the centre quicker when let go
  kbSteer = wheel(kbSteer, kb, dt);
  const inp = game.race.input;
  btnSteer = wheel(btnSteer, btnTarget, dt);
  inp.steer = clamp(kbSteer + touchSteer + btnSteer + (Tilt.on ? Tilt.value() : 0), -1, 1);
  // on a phone, holding a turn at speed drifts by itself (let go of the turn to fire the boost)
  const hard = Math.abs(btnSteer + touchSteer + (Tilt.on ? Tilt.value() : 0)) > 0.85 && game.race.player.speed > 28;
  hardT = hard ? hardT + dt : 0;
  // (a deliberate hold of most of a second, not every ordinary turn, and the slide it starts is no tighter than a normal
  // full turn: a phone button is all-or-nothing, so it can't ease the drift off before the wall)
  const auto = hardT > 0.75;
  inp.drift = !!(keys.Space || keys.ShiftLeft || keys.ShiftRight || auto);
  if (auto && !kb) inp.steer *= 0.45;
  inp.fire = !!(keys.KeyF || keys.KeyE || keys.KeyJ || fireTouch);
  inp.brake = !!(keys.ArrowDown || keys.KeyS || brakeTouch);
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initInput() {
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (['KeyF', 'KeyE', 'KeyJ'].includes(e.code) && game.state === 'race') game.race.input.firePressed = true;
    if (['ArrowUp', 'KeyW', 'KeyN'].includes(e.code) && game.state === 'race') game.race.input.nitroPressed = true;
    if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code) && game.state === 'race')
      game.race.input.driftPressed = true;
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'Enter' && game.state === 'menu') startRace();
  });
  addEventListener('keyup', e => {
    keys[e.code] = false;
  });
  addEventListener('blur', releaseInput);
  addEventListener('pagehide', releaseInput);
  document.addEventListener('visibilitychange', () => document.hidden && releaseInput());
  canvas.addEventListener('pointerdown', e => {
    if (game.state === 'garage') gDrag = e.clientX;
  });
  addEventListener('pointermove', e => {
    if (gDrag !== null && game.state === 'garage') {
      game.garage.spin(e.clientX - gDrag);
      gDrag = e.clientX;
    }
  });
  addEventListener('pointerup', () => {
    gDrag = null;
  });
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || touchId !== null) return;
    touchId = e.pointerId;
    x0 = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== touchId) return;
    const range = Math.min(innerWidth, 600) * 0.17;
    let dx = e.clientX - x0;
    if (Math.abs(dx) > range) {
      x0 = e.clientX - Math.sign(dx) * range;
      dx = Math.sign(dx) * range;
    }
    touchSteer = clamp(-dx / range, -1, 1);
  });
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  holdButton(
    $('#brakeBtn'),
    () => {
      brakeTouch = true;
    },
    () => {
      brakeTouch = false;
    },
  ); // the brake: hold to slow, keep holding to reverse
  holdButton(
    $('#nitroBtn'),
    () => {
      if (game.state === 'race') game.race.input.nitroPressed = true;
    },
    () => {},
  );
  holdButton(
    $('#fireBtn'),
    () => {
      fireTouch = true;
      if (game.state === 'race') game.race.input.firePressed = true;
    },
    () => {
      fireTouch = false;
    },
  );
  hud.weapon.addEventListener('pointerdown', () => {
    if (game.state === 'race') game.race.input.firePressed = true;
  });
  // the steer buttons: holding one eases the steering in, like turning a wheel
  holdButton(
    $('#leftBtn'),
    () => {
      btnTarget = 1;
    },
    () => {
      if (btnTarget > 0) btnTarget = 0;
    },
  );
  holdButton(
    $('#rightBtn'),
    () => {
      btnTarget = -1;
    },
    () => {
      if (btnTarget < 0) btnTarget = 0;
    },
  );
  document.addEventListener(
    'touchmove',
    e => {
      if (
        game.state !== 'menu' &&
        !e.target.closest?.('.m-cards, .cust-grid, .sheet .card, .isl-list, .nfs-tabs, .tiles, .tr-route')
      )
        e.preventDefault();
    },
    { passive: false },
  ); // scrollable lists keep their swipe (the map's circuit row and tabs, the garage's car row, the tour's cities)
  document.addEventListener('contextmenu', e => e.preventDefault());
}
