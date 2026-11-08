export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapA = a => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
export const fbm = (x, y) =>
  vnoise(x, y) * 0.5 + vnoise(x * 2.07 + 5.3, y * 2.07 + 1.7) * 0.25 + vnoise(x * 4.13 + 9.1, y * 4.13 + 3.3) * 0.125;

// seeded random (mulberry32) so the island is laid out the same every time
export function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

// Everything the game remembers (settings, coins, records, unlocks) lives in localStorage under "gukart.<key>", as JSON.
// Every read and write goes through here. Storage can be blocked (private browsing, full disk): reads then fall back to
// the default and writes are dropped, and the game still plays.
const PREFIX = 'gukart.';
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(PREFIX + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d; // storage blocked, or a value that isn't JSON: use the default
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch {
      // storage blocked or full: this setting just isn't remembered
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {
      // storage blocked: nothing to remove
    }
  },
};

// The game was called "gudu" while it was being built, and saves were kept under "gudu.<key>". Move them across to the
// new name once, so nobody loses their coins or records. (A few were saved as plain text, not JSON: those are wrapped.)
(function migrateOldSaves() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith('gudu.')) continue;
      const key = PREFIX + k.slice('gudu.'.length),
        v = localStorage.getItem(k);
      if (localStorage.getItem(key) === null) {
        let json = v;
        try {
          JSON.parse(v);
        } catch {
          json = JSON.stringify(v);
        }
        localStorage.setItem(key, json);
      }
      localStorage.removeItem(k);
    }
  } catch {
    // storage blocked: there's nothing saved to move
  }
})();

export const fmtTime = s => {
  if (!isFinite(s)) return '—';
  const m = Math.floor(s / 60),
    r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
};
export const ordinal = n => (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
