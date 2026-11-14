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

// each vehicle's special power: a knockout, once a race (ready after the opening seconds), each delivered its own way
// and each taking rivals out (flipped, spun, blown off the road, lifted), and every one a burst of speed while it runs
// (its SPEED). What it's called, a line on what it does, who
// it hits, and the numbers that shape it (each with its name and range, for the studio). Its motion is powerPose below;
// what it does to the rivals is said in `hits` and acted out by the studio and the game.
export const POWERS_BASE = {
  monster: {
    name: 'EARTHQUAKE',
    line: 'It leaps and slams down: the ground shakes in a wave that rolls out and flips every rival it reaches',
    hits: 'EVERYONE NEAR',
    p: {
      height: [7, 'JUMP (M)', 2, 10, 0.5],
      air: [1.6, 'AIR TIME (S)', 0.6, 2, 0.1],
      radius: [70, 'WAVE (M)', 15, 80, 1],
      boost: [3, 'SPEED', 1.1, 3, 0.05],
    },
  },
  roadster: {
    name: 'SKY ROCKET',
    line: 'Four thrusters blast it into the sky: it flies flat out over the pack for a few seconds, twirls once as it comes down, and the landing blast flips anyone close',
    hits: 'WHERE IT LANDS',
    p: {
      height: [16, 'HEIGHT (M)', 6, 30, 1],
      dur: [4, 'FLIGHT (S)', 2, 6, 0.1],
      boost: [3, 'SPEED IN THE AIR', 1.2, 3, 0.05],
      rolls: [1, 'TWIRLS COMING DOWN', 0, 2, 1],
      blast: [18, 'LANDING BLAST (M)', 5, 30, 1],
    },
  },
  kart: {
    name: 'SUPERSONIC',
    line: 'It breaks the sound barrier: a white vapour cone wraps it, a sonic boom, double speed, and every rival it passes is blown off the road',
    hits: 'ANYONE IT PASSES',
    p: { dur: [4, 'HOW LONG (S)', 2, 6, 0.5], boost: [3, 'SPEED', 1.4, 3, 0.1], wake: [11, 'WAKE (M)', 3, 15, 1] },
  },
  buggy: {
    name: 'BEACH BALL',
    line: 'It throws a volley of giant beach balls across the whole road: they bound ahead and any rival who hits one is flipped over',
    hits: 'ANYONE IN ITS PATH',
    p: {
      size: [4, 'BALL (M)', 1.5, 6, 0.1],
      speed: [120, 'BALL SPEED (M/S)', 30, 180, 1],
      boost: [3, 'SPEED', 1.1, 3, 0.05],
    },
  },
  rail: {
    name: 'WHEELIE LAUNCH',
    line: 'A huge nitrous launch: front wheels high in a long wheelie, flames out the back, smashing anyone in its path',
    hits: 'ANYONE IN ITS PATH',
    p: {
      dur: [4, 'HOW LONG (S)', 2, 6, 0.5],
      boost: [3, 'SPEED', 1.4, 3, 0.05],
      lift: [0.9, 'WHEELIE', 0.2, 0.9, 0.05],
    },
  },
  muscle: {
    name: 'FIRE TRAIL',
    line: 'Its tyres lay a burning trail: any rival who drives into the flames spins out',
    hits: 'ANYONE BEHIND',
    p: {
      dur: [4, 'LAYING IT (S)', 2, 6, 0.5],
      burn: [10, 'BURNS FOR (S)', 3, 12, 0.5],
      boost: [3, 'SPEED', 1.1, 3, 0.05],
    },
  },
  raider: {
    name: 'HARPOON',
    line: 'It surges forward at speed; as it reaches the car ahead a heavy boom snaps out, catches it and throws it off the road',
    hits: 'THE CAR AHEAD',
    p: {
      swing: [100, 'THROW (DEGREES)', 40, 120, 5],
      boost: [3, 'SPEED', 1.4, 3, 0.05],
    },
  },
  brute: {
    name: 'CANNON FIRE',
    line: 'It charges at speed while the gun on its nose fires a barrage of iron cannonballs that hunt down rivals wherever they are, ahead or behind',
    hits: 'EVERYONE, WHEREVER THEY ARE',
    p: {
      dur: [3.5, 'HOW LONG (S)', 1.5, 5, 0.5],
      shots: [9, 'CANNONBALLS', 3, 12, 1],
      shot: [120, 'SHOT SPEED (M/S)', 50, 150, 5],
      boost: [3, 'SPEED', 1.1, 3, 0.05],
    },
  },
};
// (once a race, ready this many seconds after the start)
export const READY_AFTER = 30;

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
    POWERS[id] = { name: b.name, line: b.line, hits: b.hits, ...p };
  }
}
applyTunes();

const ease = u => u * u * (3 - 2 * u);
const clamp01 = u => Math.max(0, Math.min(1, u));
// a power's motion, t seconds after it's fired: how high the vehicle is (y), how it's turned (pitch nose up, roll,
// yaw), squashed (squash, 1 = none), how much faster (boost, 1 = none) and which effects are on (fx). Shared by the
// studio and the game, so what you see in the studio is what happens in a race. Returns null once it's over.
export function powerPose(id, t, P = POWERS[id]) {
  const o = { y: 0, pitch: 0, roll: 0, yaw: 0, squash: 1, boost: 1, fx: {} };
  switch (id) {
    case 'monster': {
      if (t > P.air + 1.6) return null;
      if (t <= P.air) {
        const u = t / P.air;
        o.y = 4 * P.height * u * (1 - u);
        o.pitch = 0.25 * Math.cos(u * Math.PI);
        o.boost = P.boost;
      } else {
        const v = (t - P.air) / 1.6;
        o.squash = 1 - 0.3 * Math.max(0, Math.sin(Math.min(1, v * 4) * Math.PI));
        o.boost = P.boost;
        o.fx.quake = v; // the shaking wave, rolling out from 0 to the full radius
      }
      return o;
    }
    case 'roadster': {
      if (t > P.dur + 0.9) return null;
      if (t > P.dur) {
        o.fx.land = (t - P.dur) / 0.9; // the landing blast
        return o;
      }
      const u = t / P.dur,
        up = ease(clamp01(u / 0.25)),
        down = ease(clamp01((u - 0.72) / 0.28));
      o.y = P.height * (up - down);
      o.pitch = 0.35 * Math.sin(clamp01(u / 0.3) * Math.PI) - 0.25 * Math.sin(clamp01((u - 0.7) / 0.3) * Math.PI);
      o.roll = ease(clamp01((u - 0.7) / 0.26)) * Math.PI * 2 * P.rolls; // (level and flat out in the air; one twirl on the way down)
      o.boost = P.boost;
      o.fx.flame = 1;
      o.fx.rocket = 1;
      // its four thrusters under the car: out as it fires, full blast lifting off, a steady push holding it up, a hard
      // burst again to set it down softly, then back in
      o.fx.deploy = Math.min(1, u / 0.06, (1 - u) / 0.06);
      o.fx.thrust = u < 0.28 ? 1 : u > 0.7 ? 0.9 : 0.45;
      return o;
    }
    case 'kart': {
      if (t > P.dur) return null;
      o.boost = P.boost;
      o.pitch = -0.05;
      o.fx.sonic = t; // the boom at the start, the streaks all through
      o.fx.flame = 1;
      return o;
    }
    case 'buggy': {
      if (t > 3) return null;
      o.boost = P.boost;
      o.pitch = t < 0.3 ? 0.12 * Math.sin((t / 0.3) * Math.PI) : 0; // (a kick back as it lets the ball go)
      o.fx.ball = t; // the ball, out and away down the road
      return o;
    }
    case 'rail': {
      if (t > P.dur) return null;
      const up = ease(clamp01(t / 0.35)),
        down = ease(clamp01((t - (P.dur - 0.45)) / 0.45));
      o.pitch = P.lift * (up - down) * (1 + 0.06 * Math.sin(t * 7)); // the front up, wavering, then slammed down
      // (it pivots on its back wheels: whoever shows it keeps the lowest wheel on the road, so the body rises as the nose
      // goes up)
      o.squash = t > P.dur - 0.1 ? 0.88 : 1;
      o.boost = 1 + (P.boost - 1) * up;
      o.fx.flame = 1;
      o.fx.smoke = t < 0.4 ? 1 : 0;
      o.fx.tyreFire = 1; // (fire pouring off the back tyres as they spin it up)
      return o;
    }
    case 'muscle': {
      if (t > P.dur) return null;
      o.boost = P.boost;
      o.pitch = 0.05;
      o.fx.fire = 1;
      o.fx.smoke = t < 0.5 ? 1 : 0;
      return o;
    }
    case 'raider': {
      // it surges forward at speed; as it reaches the car ahead the boom snaps out, catches it and throws it off the
      // road in one move (the catch is timed by the distance, so the studio and the game decide when; fx.harpoon is
      // just how long it's been running)
      if (t > 2.6) return null;
      o.boost = P.boost;
      o.pitch = t < 0.15 ? -0.08 : -0.03;
      o.fx.harpoon = t;
      o.fx.flame = 1;
      return o;
    }
    case 'brute': {
      if (t > P.dur + 0.6) return null;
      // a shot every dur/shots seconds while it charges; each one kicks it back for a moment (the recoil)
      const gap = P.dur / P.shots,
        n = Math.min(P.shots, Math.floor(t / gap) + 1),
        since = t - (n - 1) * gap;
      o.boost = P.boost;
      o.fx.cannon = t;
      o.fx.shots = t <= P.dur ? n : P.shots; // how many fired so far
      o.pitch = t <= P.dur ? 0.06 * Math.exp(-since * 14) : 0; // (the kick)
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
