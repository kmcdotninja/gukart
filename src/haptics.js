// Haptics: short buzzes through the phone. Android browsers have navigator.vibrate. iPhone Safari has no vibrate API,
// but from iOS 18 it gives one light tick when a switch-style checkbox flips, so there we flip a hidden one (one strength
// only). Both only work from inside a real tap: a 'click' or 'pointerup', never 'pointerdown' on a touchscreen, which the
// browser doesn't count as the person having tapped. Off on desktop; can be turned off with store 'haptics'.
// The UI's buzzes are chosen in feedback.js; the race's (coins, bumps, hits) are called straight from main.js.
import { isTouch, store } from './util.js';

let ios = null,
  last = 0;
function iosTick() {
  if (!ios) {
    ios = document.createElement('label');
    ios.setAttribute('aria-hidden', 'true');
    ios.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.setAttribute('switch', '');
    i.tabIndex = -1;
    ios.append(i);
    document.body.append(ios);
  }
  ios.click();
}
export const Haptics = {
  on: store.get('haptics', true),
  // pattern: ms, or [buzz, gap, buzz, ...]. iPhone can only tick, so a pattern becomes that many ticks
  // ui: a buzz from a button (inside a real tap). The race's own buzzes (coins, bumps) pass false: on iPhone the switch
  // trick only ticks inside a tap anyway, and flipping it from the game loop many times a second made the race stutter
  buzz(pattern, gap = 70, ui = false) {
    if (!this.on || !isTouch) return;
    const now = performance.now();
    if (now - last < gap) return;
    last = now; // never a constant rattle
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* vibration blocked (no tap yet, or turned off) */
      }
      return;
    }
    if (!ui) return; // iPhone: buttons only
    iosTick();
    if (Array.isArray(pattern)) {
      let t = 0;
      for (let k = 1; k < pattern.length; k += 2) {
        t += pattern[k - 1] + pattern[k];
        setTimeout(iosTick, t);
      }
    }
  },
  // the UI (see feedback.js)
  tap() {
    (this.buzz(8, 40), true);
  }, // any button
  tick() {
    (this.buzz(4, 35), true);
  }, // a notch on a slider
  select() {
    (this.buzz(10, 40), true);
  }, // picking a tab, a tile, an option
  step() {
    (this.buzz(7, 40), true);
  }, // next / previous
  open() {
    (this.buzz(10, 40), true);
  }, // opening a screen
  back() {
    (this.buzz(6, 40), true);
  }, // going back, closing
  toggle() {
    (this.buzz([8, 40, 8], 60), true);
  }, // a switch flipping
  confirm() {
    (this.buzz([16, 45, 28], 80), true);
  }, // GO, PLAY, RACE AGAIN, SAVE
  deny() {
    (this.buzz([30, 50, 30], 120), true);
  }, // locked, or not enough coins
  buy() {
    (this.buzz([10, 35, 10, 35, 30], 120), true);
  }, // coins spent
  // the race
  coin() {
    this.buzz(5, 90);
  }, // each coin picked up
  bump(s = 0.3) {
    this.buzz(Math.round(10 + Math.min(1, s) * 40));
  }, // a knock, a landing, scraping a wall: harder for harder
  boost() {
    this.buzz([18, 30, 26]);
  }, // a boost kicking in
  hit() {
    this.buzz([40, 50, 40], 200);
  }, // you got hit
  count() {
    this.buzz(14, 200);
  }, // 3, 2, 1
  big() {
    this.buzz([30, 60, 60], 300);
  }, // GO, a new lap, the finish
  press() {
    this.buzz(6, 40);
  }, // a race control (fire, drift, nitro) pressed
};
