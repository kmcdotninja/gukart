// The vehicles' single source of truth for how they drive and their special power. The Vehicle Studio (/studio.html)
// shows, plays and tunes everything here; the game reads it. What you SAVE in the studio is kept in this browser
// (vehicleTune.<id>) and laid over these defaults when the game starts; COPY gives the numbers to paste back here.
// (How they look, their names and prices are in src/buddy.js VEHICLES.)
import { store } from './util.js';

// how each vehicle drives
// (in the garage's order, which is also the price ladder: the further down, the faster and the stronger, and the more
// it costs. Each keeps its own character too: the Kart still corners best, the heavy ones still turn the slowest)
export const VSTATS_BASE = {
  kart: { top: 1, acc: 1, turn: 1, off: 0.55, mass: 1 }, // the best grip, the lightest
  buggy: { top: 1, acc: 1.06, turn: 0.98, off: 0.85, mass: 1.2 }, // quick off the line, happy off the road
  rail: { top: 1.012, acc: 1.12, turn: 0.97, off: 0.9, mass: 1.1 }, // the fastest away so far, light
  muscle: { top: 1.028, acc: 1.06, turn: 0.95, off: 0.7, mass: 1.4 }, // straight-line speed
  monster: { top: 1.036, acc: 1.04, turn: 0.93, off: 0.97, mass: 1.8 }, // the heavy hitter
  raider: { top: 1.046, acc: 1.1, turn: 0.96, off: 1, mass: 1.5 }, // goes anywhere at full speed
  roadster: { top: 1.06, acc: 1.14, turn: 0.98, off: 0.8, mass: 1.3 }, // the fastest on tarmac yet
  brute: { top: 1.07, acc: 1.12, turn: 0.95, off: 1, mass: 1.9 }, // the fastest and the heaviest of all
};
// what each number means, and the range the studio lets it move in
export const STAT_INFO = {
  top: { name: 'TOP SPEED', min: 0.9, max: 1.15, step: 0.002 },
  acc: { name: 'ACCELERATION', min: 0.85, max: 1.3, step: 0.01 },
  turn: { name: 'HANDLING', min: 0.85, max: 1.1, step: 0.005 },
  off: { name: 'OFF ROAD', min: 0.4, max: 1, step: 0.01 },
  mass: { name: 'WEIGHT', min: 0.8, max: 2.2, step: 0.05 },
};

// each vehicle's special power: what it's called, a line on what it does, how long it takes to charge, and the
// numbers that shape it (each with its name and range, for the studio). The motion itself is powerPose below.
export const POWERS_BASE = {
  kart: {
    name: 'ZIP',
    line: 'A burst of speed with grip like glue: take the corner flat out',
    charge: 16,
    p: {
      dur: [1.8, 'HOW LONG (S)', 0.5, 4, 0.1],
      boost: [1.35, 'SPEED', 1, 2, 0.05],
      grip: [1.6, 'GRIP', 1, 2.5, 0.05],
    },
  },
  buggy: {
    name: 'BOUNCE',
    line: 'A huge hop with a spin: over rockets, mines and anyone in the way',
    charge: 15,
    p: {
      height: [6, 'HEIGHT (M)', 2, 12, 0.5],
      dur: [1.3, 'AIR TIME (S)', 0.6, 2.5, 0.1],
      spins: [1, 'SPINS', 0, 3, 1],
    },
  },
  rail: {
    name: 'ROOSTER TAIL',
    line: 'Paddle tyres throw up a wall of sand: whoever is behind slows right down',
    charge: 18,
    p: {
      dur: [3, 'HOW LONG (S)', 1, 6, 0.5],
      reach: [16, 'REACH (M)', 6, 30, 1],
      slow: [0.6, 'SLOWS TO', 0.3, 0.9, 0.05],
    },
  },
  muscle: {
    name: 'BURNOUT',
    line: 'Wheels spinning in a cloud of smoke, then a launch down the straight',
    charge: 20,
    p: {
      smoke: [0.9, 'SMOKE (S)', 0.3, 2, 0.1],
      dur: [2.4, 'LAUNCH (S)', 1, 4, 0.1],
      boost: [1.55, 'SPEED', 1.1, 2.2, 0.05],
    },
  },
  monster: {
    name: 'STOMP',
    line: 'Up, and down hard: the shockwave spins out everyone close',
    charge: 22,
    p: {
      height: [5, 'HEIGHT (M)', 2, 10, 0.5],
      dur: [1.1, 'AIR TIME (S)', 0.6, 2, 0.1],
      radius: [18, 'SHOCKWAVE (M)', 8, 30, 1],
    },
  },
  raider: {
    name: 'FLOODLIGHTS',
    line: 'The lamp bar blazes: the rivals ahead are dazzled and wobble off line',
    charge: 18,
    p: {
      dur: [2.5, 'HOW LONG (S)', 1, 5, 0.5],
      reach: [60, 'REACH (M)', 20, 100, 5],
      wobble: [1, 'DAZZLE', 0.3, 2, 0.1],
    },
  },
  roadster: {
    name: 'SKY ROCKET',
    line: 'Four thrusters drop out from under the car and blast it off the road; it rolls right over in the air and lands far ahead',
    charge: 25,
    p: {
      height: [14, 'HEIGHT (M)', 6, 30, 1],
      dur: [3.2, 'FLIGHT (S)', 1.5, 5, 0.1],
      rolls: [1, 'BARREL ROLLS', 0, 3, 1],
      boost: [1.5, 'SPEED', 1, 2.2, 0.05],
    },
  },
  brute: {
    name: 'RAM',
    line: 'Armour glowing, it cannot be stopped: anyone it touches is knocked flying',
    charge: 22,
    p: {
      dur: [3, 'HOW LONG (S)', 1, 6, 0.5],
      boost: [1.3, 'SPEED', 1, 1.8, 0.05],
      knock: [1.6, 'KNOCK', 1, 3, 0.1],
    },
  },
};

// the numbers as they are now (the defaults with anything saved in the studio laid over them)
const saved = id => store.get('vehicleTune.' + id, null) || {};
export const VSTATS = {};
export const POWERS = {};
export function applyTunes() {
  for (const id of Object.keys(VSTATS_BASE)) {
    const t = saved(id),
      b = POWERS_BASE[id];
    VSTATS[id] = { ...VSTATS_BASE[id], ...(t.stats || {}) };
    const p = {};
    for (const [k, v] of Object.entries(b.p)) p[k] = t.power?.[k] ?? v[0];
    POWERS[id] = { name: b.name, line: b.line, charge: t.charge ?? b.charge, ...p };
  }
}
applyTunes();

const ease = u => u * u * (3 - 2 * u);
const clamp01 = u => Math.max(0, Math.min(1, u));
// a power's motion, t seconds after it's fired: how high the vehicle is (y), how it's turned (pitch nose up, roll,
// yaw), squashed (squash, 1 = none), how much faster (boost, 1 = none) and which effects are on. Shared by the studio
// and the game, so what you see in the studio is what happens in a race. Returns null once it's over.
export function powerPose(id, t, P = POWERS[id]) {
  const o = { y: 0, pitch: 0, roll: 0, yaw: 0, squash: 1, boost: 1, fx: {} };
  switch (id) {
    case 'kart': {
      if (t > P.dur) return null;
      o.boost = P.boost;
      o.pitch = -0.04;
      o.fx.sparkle = 1;
      o.fx.flame = 1;
      return o;
    }
    case 'buggy': {
      if (t > P.dur) return null;
      const u = t / P.dur;
      o.y = 4 * P.height * u * (1 - u);
      o.yaw = ease(u) * Math.PI * 2 * P.spins;
      o.pitch = 0.25 * Math.cos(u * Math.PI);
      o.squash = u > 0.92 ? 0.85 : 1;
      return o;
    }
    case 'rail': {
      if (t > P.dur) return null;
      o.yaw = Math.sin(t * 9) * 0.06;
      o.pitch = 0.05;
      o.fx.sand = 1;
      return o;
    }
    case 'muscle': {
      if (t > P.smoke + P.dur) return null;
      if (t < P.smoke) {
        o.pitch = 0.05 + Math.sin(t * 60) * 0.01;
        o.squash = 0.96;
        o.fx.smoke = 1;
        o.boost = 0.4;
      } else {
        const u = (t - P.smoke) / P.dur;
        o.pitch = 0.22 * (1 - ease(clamp01(u * 2.5)));
        o.boost = P.boost;
        o.fx.flame = 1;
        o.fx.smoke = u < 0.3 ? 1 : 0;
      }
      return o;
    }
    case 'monster': {
      if (t > P.dur + 0.5) return null;
      if (t <= P.dur) {
        const u = t / P.dur;
        o.y = 4 * P.height * u * (1 - u) * (u > 0.5 ? 1.15 - 0.15 * u : 1);
        o.pitch = 0.2 * Math.cos(u * Math.PI);
      } else {
        const v = (t - P.dur) / 0.5;
        o.squash = 1 - 0.25 * Math.sin(v * Math.PI);
        o.fx.ring = v; // the shockwave, spreading
      }
      return o;
    }
    case 'raider': {
      if (t > P.dur) return null;
      o.pitch = -0.03;
      o.fx.lights = Math.min(1, t * 6) * (0.8 + 0.2 * Math.sin(t * 30));
      return o;
    }
    case 'roadster': {
      if (t > P.dur) return null;
      const u = t / P.dur,
        up = ease(clamp01(u / 0.25)),
        down = ease(clamp01((u - 0.72) / 0.28));
      o.y = P.height * (up - down);
      o.pitch = 0.35 * Math.sin(clamp01(u / 0.3) * Math.PI) - 0.25 * Math.sin(clamp01((u - 0.7) / 0.3) * Math.PI);
      o.roll = ease(clamp01((u - 0.3) / 0.38)) * Math.PI * 2 * P.rolls;
      o.boost = P.boost;
      o.fx.flame = 1;
      o.fx.rocket = 1;
      // its four thrusters under the car: out as it fires, full blast lifting off, a steady push holding it up, a hard
      // burst again to set it down softly, then back in
      o.fx.deploy = Math.min(1, u / 0.06, (1 - u) / 0.06);
      o.fx.thrust = u < 0.28 ? 1 : u > 0.7 ? 0.9 : 0.45;
      return o;
    }
    case 'brute': {
      if (t > P.dur) return null;
      o.pitch = -0.06;
      o.boost = P.boost;
      o.fx.glow = 0.7 + 0.3 * Math.sin(t * 12);
      o.fx.flame = 1;
      return o;
    }
  }
  return null;
}
// how long a power lasts, in seconds (for the studio's timeline and the game's HUD)
export function powerLength(id, P = POWERS[id]) {
  for (let t = 0; t < 12; t += 0.05) if (!powerPose(id, t, P)) return t;
  return 12;
}
