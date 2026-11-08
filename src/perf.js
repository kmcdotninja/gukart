// A performance readout for finding stutters on a real phone. Open the game with ?perf=1 (it stays on; ?perf=0 turns it
// off). It shows the frame rate, every frame that took too long (a freeze) with how long and where you were, the sound's
// state and every time it changed, memory, and how much is being drawn. Screenshot it when something goes wrong.
import { Sound } from './audio.js';
import { store } from './util.js';

export function perfHud(renderer, getState){
  let on = false;
  const q = new URLSearchParams(location.search).get('perf'); if (q !== null) store.set('perf', q === '1'); on = store.get('perf', false) === true;
  if (!on) return () => {};
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top) + 56px);z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.3 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre;max-width:60vw';
  document.body.append(el);
  const log = [], frames = []; let prev = performance.now(), lastPaint = 0, audioState = '', t0 = performance.now();
  const note = s => { log.unshift(`${((performance.now() - t0) / 1000).toFixed(1)}s ${s}`); log.length = Math.min(log.length, 8); };
  // long tasks the browser itself reports (Chrome): work on the page that blocked it
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.duration > 80) note(`busy ${Math.round(e.duration)}ms`); }).observe({ type: 'longtask', buffered: false }); } catch { /* this browser doesn't report long tasks */ }
  document.addEventListener('visibilitychange', () => note(document.hidden ? 'tab hidden' : 'tab back'));
  return () => {
    const now = performance.now(), ft = now - prev; prev = now;
    frames.push(ft); if (frames.length > 120) frames.shift();
    if (ft > 70) note(`freeze ${Math.round(ft)}ms in ${getState()}`);
    const st = Sound.ctx ? Sound.ctx.state : 'none'; if (st !== audioState) { note(`sound ${audioState || '-'} > ${st}`); audioState = st; }
    if (now - lastPaint < 500) return; lastPaint = now;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length, worst = Math.max(...frames), i = renderer.info, mem = performance.memory;
    el.textContent = [
      `fps ${(1000 / avg).toFixed(0)}  worst ${worst.toFixed(0)}ms  state ${getState()}`,
      `sound ${st}${Sound.on ? '' : ' (off)'}  vol ${Sound.vol}`,
      `draws ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k  tex ${i.memory.textures}  geo ${i.memory.geometries}  progs ${i.programs?.length ?? '-'}`,
      mem ? `heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : 'heap -',
      ...log,
    ].join('\n');
  };
}
