// Singapore is four circuits, each its own part of the city. Features carry the scenery (singapore.js) and the water
// (world.js): 'marina' floods the inside of the loop beyond d, 'shore' puts water beyond d on one side along a stretch,
// and every 'lowbridge' has open water under it and either side (the river and the channels, crossed on bridges).
// Each ends on two straights (heading 270° then 0°) that closer() solves so the circuit closes.
import { turtle } from './turtle.js';

// A corner that eases in and out, as real roads and circuits do: the bend tightens over its first quarter to its full
// radius R and opens out again over its last, so you feel it coming and turn in progressively instead of the wheel
// snapping from straight to full lock. Drawn as twelve short arcs whose curvature follows that ramp, scaled so the
// whole corner turns exactly deg degrees. (No corner here is tighter than 80 m; the spirals stay true circles.)
const MIN_R = 80;
// a true circle (round the Cloud Forest's mountain, Jewel's vortex) with eased ends: the curvature ramps up over the
// first `ramp` degrees and down over the last, the circle of radius R between them (its features go in `list`, at its
// start). Returns the lengths: the whole thing, and the true circle.
export function spiral(t, R, deg, dy, list, ramp = 30) {
  const n = 6,
    rr = (ramp * Math.PI) / 180,
    Lr = 2 * rr * R, // a ramp from straight to 1/R turns half as much as the same length of circle
    mid = ((deg - 2 * ramp) * Math.PI * R) / 180,
    total = Lr * 2 + mid;
  const ease = up => {
    for (let i = 0; i < n; i++) {
      const k = (up ? i + 0.5 : n - i - 0.5) / n / R,
        ang = ((k * Lr) / n) * (180 / Math.PI);
      t.arc(1 / k, ang, (dy * (Lr / n)) / total);
    }
  };
  ease(true);
  t.arc(R, deg - 2 * ramp, (dy * mid) / total, list);
  ease(false);
  return { total, mid };
}
export function corner(t, R, deg, dy = 0, list) {
  R = Math.max(R, MIN_R);
  const n = 12,
    th = (Math.abs(deg) * Math.PI) / 180,
    L = (th * R) / 0.75, // the whole corner's length: a trapezoid of curvature with 25% ramps
    shape = u => Math.min(1, u / 0.25, (1 - u) / 0.25),
    ks = Array.from({ length: n }, (_, i) => shape((i + 0.5) / n)),
    sum = ks.reduce((a, b) => a + b, 0);
  ks.forEach((k, i) => {
    const ang = (deg * k) / sum; // this piece's share of the turn
    const r = L / n / ((Math.abs(ang) * Math.PI) / 180); // the radius that turns it over its length
    t.arc(r, ang, dy / n, i === 0 ? list : undefined);
  });
}

// Marina Bay, at night: round the whole bay, the water inside the loop. The grid lines up under Marina Bay Sands, the
// Supertrees glowing behind; past the ArtScience lotus and through the Helix Bridge's steel spiral; along Raffles Avenue
// under the Singapore Flyer, The Float out on the water; the Esplanade's durian domes; over the Esplanade Bridge with
// the Merlion spouting below; the Fullerton; down Marina Boulevard between the towers and home
export function marinaTrack(La, Lb) {
  const t = turtle();
  t.straight(240, 0, [
    [0, 'marina', { d: 34 }],
    [0, 'mbs'],
    [40, 'street', { name: 'Bayfront Ave' }],
    [
      175,
      'gantry',
      {
        signs: [
          { bg: 'blue', code: 'ECP', text: 'Changi Airport' },
          { bg: 'brown', text: 'Gardens by the Bay', arrow: -1 },
        ],
      },
    ],
    [120, 'supertrees', { len: 130, far: 1 }],
    [40, 'coins', { lat: 0 }],
    [120, 'items'],
    [200, 'pad', { lat: 0 }],
  ]);
  corner(t, 70, 90, 0, [
    [30, 'artscience'],
    [70, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(90, 0, [[40, 'items']]);
  // the Helix: the road through the double spiral, over the channel
  t.straight(190, 0, [
    [0, 'lowbridge', { len: 190 }],
    [10, 'helix', { len: 170 }],
    [60, 'coins', { lat: 0, n: 10, gap: 7 }],
    [150, 'items'],
  ]);
  // up onto the viaduct: 20 m over the shore, sweeping round past the Flyer with the whole bay below, and down again
  t.straight(40, 0, [[20, 'pad', { lat: 0 }]]);
  t.straight(120, 20, [[50, 'coins', { lat: 0, n: 8 }]]);
  corner(t, 110, 90, 0, [
    [60, 'skyline'],
    [20, 'flyer'],
    [90, 'items'],
    [120, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(60, 0, [[30, 'pad', { lat: 0 }]]);
  t.straight(120, -20);
  // Raffles Avenue: The Float on the water, a kink round the grandstand
  t.straight(170, 0, [
    [10, 'street', { name: 'Raffles Ave' }],
    [40, 'float'],
    [80, 'coins', { lat: -3, n: 7 }],
    [130, 'kicker'],
  ]);
  corner(t, 90, -30, 0);
  corner(t, 90, 30, 0, [[10, 'items']]);
  t.straight(150, 0, [
    [30, 'items'],
    [80, 'esplanade'],
    [70, 'coins', { lat: 3, wave: 1 }],
  ]);
  corner(t, 70, 90, 0, [[60, 'items']]);
  // the Esplanade Bridge over the river mouth, the Merlion below on the bay side, then the Fullerton
  t.straight(La, 0, [
    [20, 'lowbridge', { len: 150 }],
    [8, 'street', { name: 'Esplanade Dr' }],
    [40, 'merlion'],
    [70, 'coins', { lat: 0, n: 8 }],
    [190, 'fullerton'],
    [La * 0.75, 'items'],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 80, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  // Marina Boulevard: the glass towers close either side
  // (two humps that throw you into the air between the towers)
  t.straight(Lb - 140, 0, [
    [0, 'cbd', { len: Lb }],
    [10, 'street', { name: 'Marina Blvd' }],
    [40, 'erp'],
    [Math.max(60, Lb * 0.3), 'items'],
  ]);
  t.straight(35, 5, [[10, 'coins', { lat: 0, n: 6 }]]);
  t.straight(35, -5);
  t.straight(35, 5);
  t.straight(35, -5);
  return t;
}

// Gardens by the Bay: off the line under the Supertrees, then up a long ramp into their crowns and along a deck 22 m up
// among them, down again and into the Cloud Forest, where the road spirals 28 m up round the mountain (over itself) and
// through the waterfall pouring off the top, out through the glass and down; straight through the Flower Dome between
// the beds; over Dragonfly Lake with a jump at the end; and home along the bay, Marina Bay Sands across the water
export function gardensTrack(La, Lb) {
  const t = turtle(),
    CR = 46, // the spiral round the mountain
    CRAMP = 30,
    SPL = 2 * ((CRAMP * Math.PI) / 180) * CR * 2 + ((360 - 2 * CRAMP) * Math.PI * CR) / 180, // its whole length
    C = ((360 - 2 * CRAMP) * Math.PI * CR) / 180; // its true circle
  t.straight(160, 0, [
    [0, 'supertrees', { len: 160 }],
    [20, 'street', { name: 'Marina Gardens Dr' }],
    [40, 'coins', { lat: 0 }],
    [110, 'items'],
    [140, 'pad', { lat: 0 }],
  ]);
  corner(t, 60, 90, 0, [[30, 'coins', { lat: 4, wave: 1 }]]);
  // up into the crowns
  t.straight(30, 0, [
    [
      10,
      'gantry',
      {
        signs: [
          { bg: 'brown', text: 'Supertree Grove' },
          { bg: 'green', text: 'Bay East' },
        ],
      },
    ],
  ]);
  t.straight(110, 22, [
    [0, 'skyway', { len: 420 }],
    [60, 'coins', { lat: 0, n: 8 }],
  ]);
  t.straight(40, 0, [[20, 'items']]);
  corner(t, 90, -55, 0, [[30, 'coins', { lat: -3, wave: 1 }]]);
  corner(t, 90, 55, 0, [[40, 'pad', { lat: 0 }]]);
  t.straight(110, -22);
  t.straight(20, 0, [[10, 'items']]);
  // the Cloud Forest: in, once round the mountain climbing 16 m, then on and down out of the glass
  t.straight(60, 0, [
    [0, 'hall', { len: 60 + SPL + 290 }],
    [30, 'coins', { lat: 0, n: 7 }],
  ]);
  spiral(
    t,
    CR,
    360,
    28,
    [
      [0, 'cloudforest', { r: CR, len: C }],
      [C * 0.3, 'items'],
      [C * 0.5, 'coins', { lat: 4, wave: 1 }],
    ],
    CRAMP,
  );
  t.straight(90, 0); // (level until it's clear of the turn below, then down)
  t.straight(200, -28, [[140, 'pad', { lat: 0 }]]);
  t.straight(20);
  corner(t, 70, 90, 0, [[40, 'items']]);
  t.straight(330, 0, [
    [0, 'supertrees', { len: 330, far: 1 }],
    [80, 'coins', { lat: 0, wave: 1 }],
    [160, 'kicker'],
    [240, 'items'],
  ]);
  corner(t, 70, 90, 0, [[30, 'coins', { lat: 4, wave: 1 }]]);
  // the Flower Dome down the middle, then Dragonfly Lake low over the water with a jump off the end, then the bay
  // front with Marina Bay Sands across the water
  t.straight(La, 0, [
    [30, 'hall', { len: 170 }],
    [30, 'flowerdome', { len: 170 }],
    [80, 'coins', { lat: 0, wave: 1 }],
    [150, 'items'],
    [250, 'lowbridge', { len: 150 }],
    [270, 'dragonfly', { len: 110 }],
    [310, 'coins', { lat: -3, n: 8 }],
    [410, 'kicker'],
    [440, 'shore', { side: 'out', len: Math.max(20, La - 440), d: 30 }],
    [460, 'street', { name: 'Bayfront Ave' }],
    [Math.max(470, La * 0.8), 'mbsfar'],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 80, 90, 0, [[40, 'items']]);
  t.straight(Lb, 0, [[0, 'supertrees', { len: Lb }]]);
  return t;
}

// Downtown and the River: Boat Quay's shophouses along the river with Raffles Place's towers behind, over the river on
// Cavenagh Bridge by the Fullerton, past the Victoria clock tower, along the Padang and the domes of the old Supreme
// Court and City Hall, Clarke Quay's coloured warehouses, back over the river, and Lau Pa Sat's clock tower and satay
// street before the towers again
export function riverTrack(La, Lb) {
  const t = turtle();
  t.straight(260, 0, [
    [0, 'shore', { side: 'in', len: 300, d: 48 }],
    [0, 'boatquay', { len: 260 }],
    [0, 'cbd', { len: 260 }],
    [20, 'street', { name: 'Boat Quay' }],
    [90, 'erp'],
    [
      180,
      'gantry',
      {
        signs: [
          { bg: 'blue', code: 'ECP', text: 'Marina Bay' },
          { bg: 'green', text: 'Raffles Place', arrow: -1 },
        ],
      },
    ],
    [40, 'coins', { lat: 0 }],
    [140, 'items'],
    [210, 'fullerton'],
    [235, 'pad', { lat: 0 }],
  ]);
  corner(t, 60, 90, 0, [[30, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(60);
  // over the river past Cavenagh Bridge, then down: the road dives into a glass tube along the river bed (fish, weed,
  // the light from the surface above) and climbs out on the far side
  t.straight(60, 0, [
    [0, 'lowbridge', { len: 60 + 450 }],
    [0, 'cavenagh', { len: 60 }],
    [20, 'coins', { lat: 0, n: 6 }],
  ]);
  t.straight(15, -0.9);
  t.straight(20);
  t.straight(100, -15.6);
  t.straight(150, 0, [
    [10, 'pad', { lat: 0 }],
    [50, 'items'],
    [90, 'coins', { lat: 0, wave: 1 }],
  ]);
  t.straight(100, 15.6);
  t.straight(20);
  t.straight(15, 0.9);
  t.straight(30);
  t.straight(90, 0, [
    [40, 'clocktower'],
    [60, 'items'],
  ]);
  corner(t, 70, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  // along the Padang, two humps that throw you into the air
  t.straight(220, 0, [
    [0, 'padang', { len: 580 }],
    [10, 'street', { name: 'Connaught Dr' }],
    [60, 'items'],
    [150, 'coins', { lat: 0, wave: 1 }],
  ]);
  t.straight(35, 6, [[5, 'coins', { lat: 0, n: 6 }]]);
  t.straight(35, -6);
  t.straight(35, 6);
  t.straight(35, -6);
  t.straight(255, 0, [
    [80, 'items'],
    [180, 'coins', { lat: 0, wave: 1 }],
  ]);
  corner(t, 70, 90, 0, [[60, 'items']]);
  // Clarke Quay: then down a slipway and onto the river itself, racing on the water past the warehouses (the karts
  // are amphibious), the bumboats moored alongside, and up the far slipway
  t.straight(50, 0, [
    [0, 'clarkequay', { len: La }],
    [10, 'street', { name: 'River Valley Rd' }],
    [50, 'waterway', { side: 'out', len: La - 100 }],
  ]);
  t.straight(30, -1.1, [[10, 'coins', { lat: 0, n: 5 }]]);
  t.straight(La - 160, 0, [
    [0, 'river', { len: La - 160 }],
    [40, 'items'],
    [120, 'coins', { lat: -4, wave: 1 }],
    [Math.max(160, La - 260), 'items'],
    [Math.max(200, La - 220), 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(30, 1.1);
  t.straight(50, 0, [[20, 'pad', { lat: 0 }]]);
  corner(t, 60, 90, 0, [[30, 'items']]);
  // Robinson Road past Lau Pa Sat, then down into the tunnel under Raffles Place and up into the light
  t.straight(80, 0, [
    [0, 'cbd', { len: Lb }],
    [10, 'street', { name: 'Robinson Rd' }],
    [30, 'laupasat'],
  ]);
  t.straight(50, -10, [[15, 'coins', { lat: -6, n: 7 }]]);
  t.straight(Lb - 260, 0, [
    [20, 'items', { lats: [-9, -5, 5, 9] }],
    [Math.max(30, (Lb - 260) / 2), 'coins', { lat: 6, n: 8, gap: 6 }],
  ]);
  t.straight(50, 10);
  t.straight(80);
  return t;
}

// Changi: along the apron with the jets at their gates and the control tower over them, down the terminal, then into
// Jewel: in through the glass, a long right-hander round the Rain Vortex (the waterfall pouring through the hole in the
// roof into its pool) with the Forest Valley's terraces climbing all round and the Skytrain crossing overhead, out the
// far side and along the runway as a jet takes off beside you, and home along the coast with the ships at anchor
export function changiTrack(La, Lb) {
  const t = turtle(),
    JR = 70, // the curve round the vortex (opened out from 52: it was a tight, endless turn high on the deck)
    JS = 70; // the straight in and out under the glass
  t.straight(240, 0, [
    [0, 'apron', { len: 240 }],
    [20, 'street', { name: 'Airport Blvd' }],
    [150, 'tower'],
    [
      190,
      'gantry',
      {
        signs: [
          { bg: 'blue', code: 'PIE', text: 'City' },
          { bg: 'brown', text: 'Jewel', arrow: -1 },
        ],
      },
    ],
    [40, 'coins', { lat: 0 }],
    [120, 'items'],
    [210, 'pad', { lat: 0 }],
  ]);
  corner(t, 70, 90, 0, [[30, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(260, 0, [
    [0, 'terminal', { len: 260 }],
    [60, 'items'],
    [160, 'kicker'],
    [210, 'coins', { lat: 0, wave: 1 }],
  ]);
  // Jewel
  // up round the Rain Vortex: a turn and a quarter, climbing 32 m (so where it passes over its own start there's at least
  // 20 m of air between the two levels), then out through the glass and down a long ramp to the runway
  const JRAMP = 40, // (long ramps in and out of the turn, so it eases in rather than snapping)
    JM = ((450 - 2 * JRAMP) * Math.PI * JR) / 180,
    JT = 4 * ((JRAMP * Math.PI) / 180) * JR + JM;
  t.straight(JS, 0, [
    [0, 'hall', { len: JS + JT + 340 }],
    [20, 'coins', { lat: 0, n: 8 }],
  ]);
  spiral(
    t,
    JR,
    450,
    32,
    [
      [0, 'jewel', { r: JR, len: JM }],
      [JM * 0.25, 'items'],
      [JM * 0.55, 'coins', { lat: 4, wave: 1 }],
    ],
    JRAMP,
  );
  t.straight(90, 0); // (level until it's clear of the turn below, then down)
  // the ramp down: eased in and out (its slope rises and falls smoothly, like a real flyover's), so a kart at full
  // speed rolls over the top of it instead of launching off the crest and landing hard at the bottom
  for (let q = 0; q < 10; q++) {
    const sm = u => u * u * (3 - 2 * u);
    t.straight(25, -32 * (sm((q + 1) / 10) - sm(q / 10)), q === 7 ? [[15, 'pad', { lat: 0 }]] : undefined);
  }
  // the runway: a jet rolling and lifting off alongside
  t.straight(430, 0, [
    [0, 'runway', { len: 430 }],
    [150, 'taxiway'],
    [60, 'items'],
    [200, 'coins', { lat: 0, n: 7 }],
    [300, 'items'],
    [380, 'pad', { lat: 0 }],
  ]);
  corner(t, 70, 90, 0, [[40, 'items']]);
  // the coast road: the sea on the outside, ships at anchor
  t.straight(La, 0, [
    [0, 'shore', { side: 'out', len: La, d: 34 }],
    [0, 'ships', { len: La }],
    [12, 'street', { name: 'Changi Coast Rd' }],
    [La * 0.4, 'items'],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 70, 90, 0, [[30, 'items']]);
  t.straight(Lb, 0, [[0, 'apron', { len: Lb }]]);
  return t;
}
