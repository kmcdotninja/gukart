// Tilt steering: turn the phone like a steering wheel. Chosen in Settings (STEERING: ARROWS or TILT), remembered in
// store 'steer'. The phone's tilt comes from deviceorientation: gamma when it's held upright, beta when it's on its side
// (which way round depends on which side is down). A small dead zone keeps the kart straight while you hold still;
// full lock at about 20 degrees. Browsers only give a page the tilt over https (and iPhone asks permission first, from a tap).
import { store, clamp } from './util.js';

const DEAD = 2.5,
  FULL = 20;
let last = null;
function onTilt(e) {
  last = e;
}

export const Tilt = {
  mode: store.get('steer', 'buttons'), // 'buttons' or 'tilt'
  live: false, // tilt readings are arriving
  get on() {
    return this.mode === 'tilt' && this.live;
  },
  // the steering it asks for: +1 full left, -1 full right (the game's own sign)
  value() {
    if (!last) return 0;
    const a = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
    const raw = a === 90 ? last.beta : a === 270 ? -last.beta : a === 180 ? -last.gamma : last.gamma; // degrees, + = right side down
    if (raw == null) return 0;
    const m = Math.abs(raw) < DEAD ? 0 : ((Math.abs(raw) - DEAD) * Math.sign(raw)) / (FULL - DEAD);
    return clamp(-m, -1, 1);
  },
  // choose a mode (from a tap, so iPhone can ask permission). Resolves with '' when tilt works, or why it can't
  async set(mode) {
    const why = await this.start(mode);
    document.body.classList.toggle('tilt-steer', this.on); // the arrows hide only once tilt really works
    return why;
  },
  async start(mode) {
    this.mode = mode;
    store.set('steer', mode);
    if (mode !== 'tilt') {
      removeEventListener('deviceorientation', onTilt);
      this.live = false;
      return '';
    }
    if (!window.isSecureContext) {
      this.live = false;
      return 'Tilt needs the game opened over a secure (https) link';
    }
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') {
          this.live = false;
          return 'Allow motion access to steer by tilting';
        }
      } catch {
        return 'Allow motion access to steer by tilting';
      }
    }
    addEventListener('deviceorientation', onTilt);
    // make sure readings really arrive (some phones have no sensor, or block it)
    last = null;
    await new Promise(r => setTimeout(r, 600));
    this.live = !!(last && (last.gamma != null || last.beta != null));
    return this.live ? '' : "This phone isn't sending its tilt";
  },
};
