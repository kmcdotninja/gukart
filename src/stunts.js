// The stunts: what the car does in the air, defined once for the race (src/race.js) and the Vehicle Studio
// (src/studio.js). They happen by themselves on a big jump: what you're doing as you fly picks the stunt, and a long
// enough jump chains a second (and a third) into a combo. Only a stunt there's time to finish is started, so they
// always land clean:
//   neither                SPIN          a flat 360
//   steering               BARREL ROLL   a full roll to that side
//   braking                BACKFLIP      end over end, nose up and over
//   steering + braking     TORNADO       a double spin with a corkscrew roll through it
//   then, still high       SUPERMAN      Buddy flies out flat over the car, a paw on the wheel
//   then, steering         CROWD WAVE    up on two wheels, Buddy standing on the seat waving both arms
// Landing pays: a boost (bigger for the harder stunts, multiplied by the combo) and points. (A stunt cut short by
// coming down early, onto a roof say, is a wobble and lost speed instead.)
// Each stunt's pose(u, side) gives the car's turn at u (0..1 through it): yaw, pitch, roll in radians, and lift (m).
const TAU = Math.PI * 2;
const eio = u => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2); // ease in and out
const bell = u => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));

export const STUNTS = {
  spin: {
    name: 'SPIN',
    how: 'ANY JUMP',
    dur: 0.45,
    boost: 0.9,
    score: 80,
    pose: u => ({ yaw: TAU * eio(u), pitch: 0, roll: 0, lift: 0 }),
  },
  roll: {
    name: 'BARREL ROLL',
    how: 'STEER',
    dur: 0.6,
    boost: 1.2,
    score: 120,
    pose: (u, s) => ({ yaw: 0, pitch: 0, roll: -s * TAU * eio(u), lift: 0.6 * bell(u) }),
  },
  backflip: {
    name: 'BACKFLIP',
    how: 'BRAKE',
    dur: 0.75,
    boost: 1.5,
    score: 160,
    pose: u => ({ yaw: 0, pitch: TAU * eio(u), roll: 0, lift: 1 * bell(u) }),
  },
  tornado: {
    name: 'TORNADO',
    how: 'STEER + BRAKE',
    dur: 0.95,
    boost: 2.0,
    score: 250,
    pose: (u, s) => ({
      yaw: s * 2 * TAU * eio(u),
      pitch: 0,
      roll: -s * TAU * eio(Math.min(1, u * 1.25)),
      lift: 1.2 * bell(u),
    }),
  },
  superman: {
    name: 'SUPERMAN',
    how: 'BIG AIR, 2ND',
    dur: 1.0,
    boost: 1.6,
    score: 200,
    buddy: 'superman', // (the car rides level; Buddy does the stunt: robot.js)
    pose: u => ({ yaw: 0, pitch: -0.12 * bell(u), roll: 0, lift: 0 }),
  },
  wave: {
    name: 'CROWD WAVE',
    how: 'BIG AIR, 2ND, STEER',
    dur: 1.05,
    boost: 1.8,
    score: 220,
    buddy: 'standwave',
    pose: (u, s) => {
      const k = Math.min(1, u / 0.18, (1 - u) / 0.15);
      return { yaw: 0, pitch: 0, roll: -s * 0.62 * Math.max(0, k), lift: 0 };
    },
  },
};
export const STUNT_ORDER = ['spin', 'roll', 'backflip', 'tornado', 'superman', 'wave'];

// which stunt comes next: what's held, and whether it's the first in this jump
export function pickStunt(steer, brake, nth) {
  const st = Math.abs(steer) > 0.3;
  if (nth > 0) return st ? 'wave' : 'superman';
  if (st && brake) return 'tornado';
  if (brake) return 'backflip';
  if (st) return 'roll';
  return 'spin';
}
// a clean landing's reward for the stunts done in a jump: the boost (seconds) and the points, the combo multiplying both
export function stuntReward(ids) {
  if (!ids.length) return null;
  const mult = 1 + 0.35 * (ids.length - 1),
    b = ids.reduce((a, id) => a + STUNTS[id].boost, 0),
    sc = ids.reduce((a, id) => a + STUNTS[id].score, 0);
  return { boost: Math.min(3.2, b * (ids.length > 1 ? 0.7 : 1) * mult), score: Math.round(sc * mult), mult };
}
