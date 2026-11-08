// Gukart's motion system: one place for how things move, so every screen feels the same.
//
// The rules:
//  1. A SCREEN only fades. The things ON it move (rise in, slide out). Never move and blur a whole screen as well as
//     its contents: two motions on top of each other read as a flicker.
//  2. Start an animation in the same task that shows the element (before the browser paints), with fill 'backwards',
//     so the first frame drawn is already the animation's first frame. Never start it a frame later.
//  3. Things come in with a strong ease-out and leave faster than they came. Nothing starts from scale(0).
//  4. Lists of things arrive one after another (STEP apart), not all at once.
//  5. Reduced motion: fades only, no movement.
// Use these helpers rather than writing keyframes per screen.

export const EASE = { out: 'cubic-bezier(0.23, 1, 0.32, 1)', inOut: 'cubic-bezier(0.77, 0, 0.175, 1)' };
export const DUR = { press: 120, quick: 180, enter: 320, leave: 220 };
export const STEP = 55;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const FROM = { up: 'translateY(32px) scale(.96)', down: 'translateY(-24px)', left: 'translateX(-40px)', right: 'translateX(40px)', grow: 'scale(.94)' };

// a screen appears: unhide it and fade it in, in this same task
export function screenIn(el, dur = DUR.quick){
  el.hidden = false;
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: EASE.out, fill: 'backwards' });
}
// a screen goes: fade it out, then hide it
export function screenOut(el, dur = DUR.quick){
  const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: EASE.out, fill: 'forwards' });
  return a.finished.then(() => { el.hidden = true; a.cancel(); });
}
// one thing arrives from a direction and ends wherever its own CSS puts it
export function enter(el, { from = 'up', delay = 0, dur = DUR.enter } = {}){
  // offset 0 matters: a lone keyframe is otherwise taken as the END, and the thing would fade OUT then snap back
  const k = reduced() || from === 'fade' ? [{ opacity: 0, offset: 0 }] : [{ opacity: 0, transform: FROM[from], offset: 0 }];
  return el.animate(k, { duration: dur, delay, easing: EASE.out, fill: 'backwards' });
}
// several things arrive one after another
export function stagger(els, opts = {}, step = STEP){ return [...els].map((el, i) => enter(el, { ...opts, delay: (opts.delay || 0) + i * step })); }
// one thing leaves towards a transform (say 'translateX(-60px) scale(.9)'), holding its last frame
export function leave(el, to = 'scale(.96)', { delay = 0, dur = DUR.leave } = {}){
  const k = reduced() ? [{ opacity: 0 }] : [{ opacity: 0, transform: to }];
  return el.animate(k, { duration: dur, delay, easing: EASE.out, fill: 'forwards' });
}
