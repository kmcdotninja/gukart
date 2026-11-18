// The feeling of speed: streaks of air rushing past the edges of the screen once you're really moving, thicker and
// orange-white on a boost, cyan in a slipstream; a kick of camera shake as a boost lights. (The view widening with
// speed is camera.js; the wind rising with it is audio.js.) A 2D canvas laid over the 3D view, under the HUD.
import { game } from './game.js';
import { $ } from './dom.js';

const N = 56;
let cv = null,
  cx = null,
  streaks = [],
  shown = false,
  lastBoost = 0;
const seedStreak = s => {
  s.a = Math.random() * Math.PI * 2;
  s.r = 0.25 + Math.random() * 0.8;
  s.v = 0.9 + Math.random() * 1.4;
  s.len = 0.06 + Math.random() * 0.1;
  return s;
};
export function speedFx(dt, racing) {
  const P = game.race?.player;
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'speedfx';
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    const gl = $('#gl');
    (gl?.parentNode || document.body).insertBefore(cv, gl?.nextSibling || null);
    cx = cv.getContext('2d');
    streaks = Array.from({ length: N }, () => seedStreak({}));
  }
  const sp = P ? Math.max(0, P.speed) / 66 : 0,
    boost = P && P.boost > 0 ? 1 : 0,
    slip = P?.slip ? 1 : 0,
    level =
      racing && P && !P.finished ? Math.min(1, Math.max(0, (sp - 0.7) / 0.35) * 0.55 + boost * 0.55 + slip * 0.45) : 0;
  // a boost lighting: a kick of the camera
  if (racing && P && P.boost > 0 && lastBoost <= 0) game.race.shake = Math.max(game.race.shake || 0, 0.12);
  lastBoost = P?.boost || 0;
  if (level < 0.02) {
    if (shown) {
      cx.clearRect(0, 0, cv.width, cv.height);
      shown = false;
    }
    return;
  }
  const dpr = Math.min(2, devicePixelRatio || 1),
    W = Math.round(innerWidth * dpr),
    H = Math.round(innerHeight * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  cx.clearRect(0, 0, W, H);
  shown = true;
  // the streaks run out from a point a little above the middle (where the road meets the sky), clear of the centre
  const ox = W / 2,
    oy = H * 0.44,
    R = Math.hypot(W, H) * 0.6,
    col = slip ? '159,232,255' : boost ? '255,226,170' : '255,255,255';
  cx.lineCap = 'round';
  for (const s of streaks) {
    s.r += s.v * dt * (0.8 + level * 2.4);
    if (s.r > 1.15) seedStreak(s).r = 0.3 + Math.random() * 0.2;
    const r0 = s.r * R,
      r1 = (s.r + s.len * (1 + level * 2)) * R,
      ca = Math.cos(s.a),
      sa = Math.sin(s.a);
    const fade = Math.min(1, (s.r - 0.3) / 0.25);
    if (fade <= 0) continue;
    cx.strokeStyle = `rgba(${col},${(0.12 + 0.4 * level) * fade})`;
    cx.lineWidth = (1 + level * 2.5) * dpr;
    cx.beginPath();
    cx.moveTo(ox + ca * r0, oy + sa * r0);
    cx.lineTo(ox + ca * r1, oy + sa * r1);
    cx.stroke();
  }
}
