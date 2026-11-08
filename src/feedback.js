// Feedback: what every control sounds and feels like. One vocabulary for the whole UI, so the same kind of control
// always answers the same way:
//
//   tap      any other button          a short dry click                       one light buzz
//   select   a tab, tile, option, pin   two quick ticks, rising                 one buzz
//   step     next / previous arrows     a ratchet click, up or down             one short buzz
//   open     opening a screen           click + a short rising swoosh           one buzz
//   back     back, cancel, close        a lower click + a falling swoosh        one soft buzz
//   toggle   a switch (sound, night)    two ticks, rising for on, falling off   two light buzzes
//   confirm  GO, PLAY, RACE AGAIN, SAVE a low thump + a bright rising chord      a strong double buzz
//   deny     locked, not enough coins   two low buzzes                          a hard double buzz
//   buy      coins spent                the coin chime                          a rattle of buzzes
//   tick     each notch on a slider     a tiny click                            the faintest buzz
//
// It listens on the window, so no button needs wiring: the kind comes from RULES below (first match wins), or from a
// data-fx="kind" on the element. A handler that knows better (a locked GO, a purchase) calls Feedback.say(kind) and
// that is used instead. Everything fires on 'click', which the browser counts as a real tap; that is what lets the
// phone vibrate. Race controls (steer, fire, drift, nitro) only get a light buzz; the race makes its own sounds.
import { Sound } from './audio.js';
import { Haptics } from './haptics.js';

const RULES = [
  ['none', '.touch-btn, #steerPad *'],
  ['toggle', '#soundBtn, #nightBtn, #gLights'],
  [
    'back',
    '#gBack, #mBack, #setBack, #ctrlBack, #custCancel, #quitNo, #quitYes, #menuBtn, [aria-label="Back"], [data-close]',
  ],
  ['confirm', '.go, .btn.primary, #resumeBtn'],
  ['step', '.arrow, .g-arrow, #custPrev, #custNext'],
  ['select', '.mcard, .seg button, .tile, .pin, .isl, [data-ct], [data-ch], [data-part], [data-body], [data-tab]'],
  ['open', '#setBtn, #setBtn2, #ctrlBtn, #quitBtn, #garageBtn, #mapBtn, #custOpen, #pauseBtn'],
];
// a switch's state after the click, so it can sound "on" or "off"
const IS_ON = { soundBtn: el => !el.classList.contains('off') };

/* ---------- the sounds: all synthesised, short, and through the main volume ---------- */
let nbuf = null;
function noiseBuf(c) {
  if (nbuf) return nbuf;
  const n = Math.round(c.sampleRate * 0.3);
  nbuf = c.createBuffer(1, n, c.sampleRate);
  const d = nbuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return nbuf;
}
const ready = () => Sound.ctx && Sound.on && Sound.bus;
// a pitched blip: f0 sliding to f1 over dur seconds, starting `at` seconds from now
function tone(f0, f1, dur, vol, type = 'sine', at = 0) {
  const c = Sound.ctx,
    t = c.currentTime + at,
    o = c.createOscillator(),
    g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g);
  g.connect(Sound.bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}
// a click: a few milliseconds of filtered noise, the "body" of a physical button
function click(freq, dur, vol, at = 0) {
  const c = Sound.ctx,
    t = c.currentTime + at,
    s = c.createBufferSource(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = noiseBuf(c);
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.4;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(Sound.bus);
  s.start(t, Math.random() * 0.2);
  s.stop(t + dur + 0.01);
}
// a swoosh: noise swept through a band-pass, quieter and shorter than the race's
function sweep(f0, f1, dur, vol) {
  const c = Sound.ctx,
    t = c.currentTime,
    s = c.createBufferSource(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = noiseBuf(c);
  s.loop = true;
  f.type = 'bandpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0005, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(Sound.bus);
  s.start(t);
  s.stop(t + dur + 0.02);
}
const SOUNDS = {
  tap() {
    click(3200, 0.025, 0.22);
    tone(1500, 1100, 0.04, 0.05);
  },
  tick() {
    click(4200, 0.012, 0.1);
  },
  select() {
    click(3000, 0.02, 0.16);
    tone(880, 900, 0.05, 0.06, 'triangle');
    tone(1320, 1340, 0.07, 0.06, 'triangle', 0.055);
  },
  step(dir = 1) {
    click(2400, 0.03, 0.25);
    tone(dir > 0 ? 700 : 560, dir > 0 ? 900 : 440, 0.05, 0.06, 'square');
  },
  open() {
    click(3000, 0.02, 0.18);
    sweep(500, 2400, 0.28, 0.07);
  },
  back() {
    click(2000, 0.025, 0.2);
    tone(900, 620, 0.06, 0.05);
    sweep(2000, 450, 0.24, 0.05);
  },
  toggle(on = true) {
    click(3000, 0.02, 0.18);
    const [a, b] = on ? [660, 990] : [990, 560];
    tone(a, a, 0.05, 0.06, 'triangle');
    tone(b, b, 0.08, 0.06, 'triangle', 0.06);
  },
  confirm() {
    click(2600, 0.03, 0.28);
    tone(130, 55, 0.22, 0.22); // the thump
    for (const [f, d] of [
      [523, 0],
      [784, 0.045],
      [1047, 0.09],
    ])
      tone(f, f * 1.06, 0.22, 0.05, 'triangle', d); // the chord, rising
    sweep(400, 3000, 0.35, 0.05);
  },
  deny() {
    tone(190, 150, 0.09, 0.08, 'square');
    tone(170, 120, 0.12, 0.08, 'square', 0.11);
  },
  buy() {
    Sound.coin();
    tone(1047, 1100, 0.18, 0.05, 'triangle', 0.14);
  },
};

/* ---------- picking the kind, playing it ---------- */
let said = null,
  pre = null;
const sliderStep = new WeakMap();
function kindOf(el) {
  if (el.dataset.fx) return el.dataset.fx;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return 'deny';
  for (const [k, sel] of RULES) if (el.matches(sel)) return k;
  return 'tap';
}
function play(kind, el) {
  if (kind === 'none') return;
  if (kind === 'toggle') {
    const on = IS_ON[el?.id] ? IS_ON[el.id](el) : el?.classList.contains('on');
    Haptics.toggle();
    if (ready()) SOUNDS.toggle(on);
    return;
  }
  (Haptics[kind] || Haptics.tap).call(Haptics);
  if (!ready()) return;
  if (kind === 'step') SOUNDS.step(/left|prev/i.test((el?.id || '') + ' ' + el?.className) ? -1 : 1);
  else (SOUNDS[kind] || SOUNDS.tap)();
}

export const Feedback = {
  // a handler that knows the outcome: Feedback.say('deny') inside a click handler replaces the guessed kind;
  // outside a click it plays straight away
  say(kind) {
    if (pre) said = kind;
    else play(kind);
  },
  play,
  init() {
    // before anyone handles the click: wake the audio (it can only start inside a tap) and remember the state it was in
    addEventListener(
      'click',
      e => {
        Sound.init();
        const el = e.target.closest?.('button, [role="button"], [data-fx]');
        pre = el ? { el, on: el.classList.contains('on'), kind: kindOf(el) } : null;
        said = null;
      },
      true,
    );
    // after every handler has run: play what happened
    addEventListener('click', () => {
      if (!pre) return;
      const { el, on } = pre;
      let kind = said || pre.kind;
      if (!said) {
        if (el.classList.contains('nope'))
          kind = 'deny'; // the map's locked islands shake with 'nope'
        else if (el.matches('.mcard') && on) kind = 'confirm'; // the second tap on a mode card starts the race
      }
      pre = null;
      said = null;
      play(kind, el);
    });
    // race controls: just a light buzz the moment they're pressed
    addEventListener(
      'pointerdown',
      e => {
        if (e.target.closest?.('.touch-btn')) Haptics.press();
      },
      { passive: true, capture: true },
    );
    // sliders tick at every tenth
    addEventListener('input', e => {
      const r = e.target;
      if (r.type !== 'range') return;
      const n = Math.round(((r.value - r.min) / (r.max - r.min || 1)) * 10);
      if (sliderStep.get(r) !== n) {
        sliderStep.set(r, n);
        Haptics.tick();
        if (ready()) SOUNDS.tick();
      }
    });
  },
};
