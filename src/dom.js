// Small screen helpers every screen uses: find an element, show or hide a card with its slide, swap one card for
// another in place. It imports nothing from the game, so any module can use it.
import { leave, enter, EASE } from './motion.js';

export const $ = s => document.querySelector(s);

// transitions (after GRIP): the scene whips sideways in a motion blur and the panel arrives out of it
export function whip(dir = 1) {
  const canvas = document.querySelector('#gl'); // (the 3D canvas: looked up here so this file needs nothing else from the game)
  canvas.style.setProperty('--wd', dir);
  canvas.classList.remove('whip');
  void canvas.offsetWidth;
  canvas.classList.add('whip');
}
export function show(el, dir = 1) {
  clearTimeout(el.hideTimer); // showing it again cancels a hide still in progress (a quick tap back)
  el.hidden = false;
  el.style.setProperty('--wd', dir);
  el.classList.remove('leave', 'enter');
  void el.offsetWidth;
  el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 420);
}
export function swap(from, to, dir = 1) {
  // one menu card to the next in the same spot (pause > controls, pause > settings and back), in sequence so two cards
  // never overlap: the old card leaves the way you're going, then the new one arrives from the other side (motion.js)
  if (swap.busy) {
    swap.next = () => swap(from, to, dir); // a tap while a card is still sliding: do it once the slide ends
    return;
  }
  swap.busy = true;
  const out = from.querySelector('.card'),
    inc = to.querySelector('.card');
  for (const el of [from, to]) el.classList.remove('enter', 'leave');
  leave(out, `translateX(${-dir * 40}px)`, { dur: 130 }).finished.then(a => {
    to.hidden = false;
    from.hidden = true;
    a.cancel?.();
    enter(inc, { from: dir > 0 ? 'right' : 'left', dur: 260 }).finished.then(() => {
      swap.busy = false;
      const next = swap.next;
      swap.next = null;
      next?.();
    });
  });
}
export function hide(el, then, dir = 1) {
  if (el.hidden) {
    then?.();
    return;
  }
  el.style.setProperty('--wd', dir);
  el.classList.remove('enter');
  el.classList.add('leave');
  clearTimeout(el.hideTimer);
  el.hideTimer = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('leave');
    then?.();
  }, 200);
}
// the 3D scene under a screen changes: bring the new one up out of the navy rather than cutting
export const sceneIn = () =>
  document.querySelector('#gl').animate([{ opacity: 0, offset: 0 }], { duration: 260, easing: EASE.out });
