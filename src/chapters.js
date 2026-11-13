// Each chapter is an island. Kano and Doha are built; the rest wait on the horizon.
// A track is drawn with a turtle (src/turtle.js): straights, banked arcs, a vertical loop, and features (gates, jumps,
// pads…) dropped along the way at distances from the start. The two long straights are solved so the circuit closes.
import { turtle, closer } from './turtle.js';
import { dalaTrack } from './kano2.js';
import { marinaTrack, gardensTrack, riverTrack, changiTrack } from './sgtracks.js';
import { abuTrack, kdTrack, zazzauTrack } from './kdtracks.js';

// Kano is a figure of eight: the two lobes meet at one crossing, where the flyover leg rides 12 m over the start straight.
// No spirals, no loops: straight ramps up and down, humps that throw you in the air, jumps over the canals.
function kanoTrack(Lr, Lf) {
  const t = turtle();
  const hump = (L, h, list) => {
    t.straight(L / 2, h, list);
    t.straight(L / 2, -h);
  }; // at racing speed you fly off the crest
  t.straight(200, 0, [
    [70, 'gate', { name: 'KOFAR NASSARAWA' }],
    [100, 'coins', { lat: 0 }],
    [140, 'items'],
    [180, 'pad', { lat: 0 }],
  ]);
  t.arc(90, 135, 0, [
    [10, 'walls', { len: 200 }],
    [40, 'coins', { lat: 4, wave: 1 }],
    [100, 'gate', { name: 'KOFAR KANSAKALI' }],
  ]);
  // the underpass: down a ramp between retaining walls, 130 m of lit tunnel 10 m under the city (two bores, pick one), and up again
  t.straight(25);
  t.straight(60, -10, [[15, 'coins', { lat: -6, n: 7 }]]);
  t.straight(130, 0, [
    [25, 'items', { lats: [-9, -5, 5, 9] }],
    [70, 'coins', { lat: 6, n: 10, gap: 6 }],
  ]);
  t.straight(60, 10);
  t.straight(25, 0, [
    [10, 'coins', { lat: 0, wave: 1 }],
    [15, 'gate', { name: "KOFAR NA'ISA" }],
  ]);
  hump(60, 5);
  t.arc(90, 135, 0);
  // the flyover leg: up a straight ramp, over the start straight, down again
  t.straight(40, 0, [
    [5, 'pad', { lat: 0 }],
    [26, 'gate', { name: 'KOFAR DAN AGUNDI' }],
  ]);
  t.straight(116, 22, [[50, 'coins', { lat: 0, n: 8 }]]); // (22 m up: room to breathe for whoever's on the road below)
  t.straight(90, 0, [[30, 'items']]);
  t.straight(Lr - 246, -13);
  t.straight(60, -9);
  t.arc(80, -135, 0, [
    [20, 'market', { len: 160 }],
    [60, 'items'],
  ]);
  t.straight(30, 0, [[8, 'kicker']]);
  hump(70, 7, [[0, 'coins', { lat: -3, n: 10, gap: 6 }]]);
  t.straight(50, 0, [
    [12, 'gate', { name: 'KOFAR MATA' }],
    [25, 'dye', { len: 120 }],
  ]);
  t.arc(80, -135, 0, [
    [40, 'coins', { lat: -4, wave: 1 }],
    [90, 'palace'],
  ]);
  t.straight(Lf, 0, [
    [20, 'walls', { len: Lf * 0.5 }],
    [35, 'kicker'],
    [100, 'items'],
    [Lf - 45, 'pad', { lat: 0 }],
    [Lf - 175, 'gate', { name: 'KOFAR WAMBAI' }],
    [Lf - 85, 'gate', { name: 'KOFAR DAWANAU' }],
  ]);
  return t;
}
// close the circuit: the flyover leg (heading 270°) and the last straight (heading 0°) are solved so the end meets the start
function closedKano() {
  const e = kanoTrack(1000, 1000).pts.at(-1);
  const t = kanoTrack(1000 + e[0], 1000 - e[2]);
  t.pts.pop();
  return { pts: t.pts, feats: t.feats, loops: t.loops, len: t.len };
}

// Doha is three circuits, each its own part of the city. Features carry the scenery (doha.js) and the coast (world.js):
// 'shore' puts water beyond d metres on one side ('in' = inside the loop) along a stretch; 'marina' floods the whole inside
// of the loop beyond d; 'blob' raises a patch of land out in the water. The last two straights are solved so each closes.

// Msheireb: from Msheireb Downtown past the old Souq Waqif and the spiral Fanar, out onto the Corniche (the dhows, the
// Pearl Monument, the Museum of Islamic Art on its islet, West Bay across the water), over the flyover and back down
// past the Amiri Diwan and through the airport's departures hall
function msheirebTrack(La, Lb) {
  const t = turtle();
  // the downtown streets: tight right-left-right corners between the blocks
  t.straight(150, 0, [
    [0, 'msheireb', { len: 150 }],
    [60, 'barahat'],
    [40, 'coins', { lat: 0 }],
    [110, 'items'],
    [135, 'pad', { lat: 0 }],
  ]);
  t.arc(40, 90, 0, [[0, 'msheireb', { len: 60 }]]);
  t.straight(110, 0, [
    [0, 'souq', { len: 110 }],
    [50, 'coins', { lat: -3, n: 7 }],
    [90, 'items'],
  ]);
  t.arc(40, -90, 0, [[0, 'souq', { len: 60 }]]);
  t.straight(90, 0, [
    [0, 'souq', { len: 50 }],
    [60, 'fanar'],
  ]);
  t.arc(40, 90, 0, [[20, 'coins', { lat: 3, wave: 1 }]]);
  t.straight(110, 0, [
    [0, 'msheireb', { len: 110 }],
    [50, 'items'],
    [90, 'pad', { lat: 0 }],
  ]);
  t.arc(60, 45, 0);
  // out onto the Corniche: the bay on the outside, West Bay across it
  t.straight(220, 0, [
    [0, 'shore', { side: 'out', len: 400, d: 30 }],
    [0, 'dhows', { len: 220 }],
    [50, 'pearlmon'],
    [60, 'westbay', { len: 400 }],
    [40, 'items'],
    [70, 'fork', { len: 230, tunnel: 'in' }],
  ]); // the sky bridge out over the bay, the subway under the city
  t.arc(220, 45, 0, [
    [0, 'dhows', { len: 160 }],
    [130, 'mia'],
    [110, 'items'],
    [150, 'coins', { lat: -4, wave: 1 }],
  ]);
  // the flyover over the junction
  t.straight(70, 12, [[20, 'coins', { lat: 0, n: 8 }]]);
  t.straight(60, 0, [[30, 'items']]);
  t.straight(70, -12);
  t.arc(90, 90, 0, [[30, 'kicker']]);
  // straight through Hamad International: in at the departures doors, down the hall between the check-in desks and the
  // travellers, and out the far end past the jets on the apron (a pad just inside the doors, so you burst out)
  const A0 = 105,
    AL = 200;
  t.straight(La, 0, [
    [20, 'diwan'],
    [A0, 'airport', { len: AL }],
    [La * 0.45, 'items'],
    [La * 0.3, 'coins', { lat: 0, wave: 1 }],
    [A0 + AL - 40, 'pad', { lat: 0 }],
    [La - 50, 'pad', { lat: 0 }],
    [A0 + AL + 40, 'msheireb', { len: Math.max(0, La - A0 - AL - 60) }],
  ]);
  t.arc(90, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(Lb, 0, [[0, 'msheireb', { len: Lb }]]);
  return t;
}

// The Pearl: round the Porto Arabia marina on La Croisette, under the marina mouth in the aquarium tunnel, through the
// Qanat Quartier (jumps over its canals, the pastel houses close either side), the Medina Centrale piazza, and home
// along the beach at Viva Bahriya
function pearlTrack(La, Lb) {
  const t = turtle(),
    hump = (L, h, list) => {
      t.straight(L / 2, h, list);
      t.straight(L / 2, -h);
    };
  t.straight(160, 0, [
    [0, 'portoarabia', { len: 160 }],
    [0, 'marina', { d: 30 }],
    [50, 'coins', { lat: 0 }],
    [110, 'items'],
    [145, 'pad', { lat: 0 }],
  ]);
  t.arc(130, 90, 0, [
    [0, 'portoarabia', { len: 200 }],
    [70, 'coins', { lat: 4, wave: 1 }],
    [150, 'items'],
  ]);
  t.straight(40, 0, [[0, 'portoarabia', { len: 40 }]]);
  // across the marina mouth by the aquarium tunnel: a deck on piles dips until it rides half a metre off the sea
  // (spray off the tyres, the planks thumping), then the road dives in a glass tube to the sea bed, fish all round,
  // and climbs out the far side
  t.straight(30, 0, [
    [0, 'lowbridge', { len: 480 }],
    [10, 'coins', { lat: 0, n: 7 }],
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
  // a long open right-hander off the tunnel: you come out of it fast (it was an 80 m corner, too sharp for that speed)
  t.arc(140, 90, 0, [[60, 'coins', { lat: -4, wave: 1 }]]);
  // the Qanat Quartier: a zig-zag between the canals, a jump over each
  t.straight(60, 0, [
    [0, 'qanat', { len: 60 }],
    [25, 'kicker'],
  ]);
  t.arc(50, -90, 0, [[0, 'qanat', { len: 79 }]]);
  t.straight(60, 0, [
    [0, 'qanat', { len: 60 }],
    [25, 'kicker'],
    [50, 'items'],
  ]);
  t.arc(50, 90, 0, [[0, 'qanat', { len: 79 }]]);
  t.straight(110, 0, [
    [0, 'medina', { len: 110 }],
    [40, 'pad', { lat: 0 }],
    [80, 'coins', { lat: 0, wave: 1 }],
  ]);
  hump(60, 6);
  t.arc(100, 90, 0, [
    [0, 'shore', { side: 'out', len: 160, d: 40 }],
    [60, 'items'],
  ]);
  t.straight(La, 0, [
    [0, 'shore', { side: 'out', len: La, d: 40 }],
    [0, 'beach', { len: La }],
    [30, 'items'],
    [60, 'fork', { len: 250, tunnel: 'in' }],
    [La - 30, 'pad', { lat: 0 }],
  ]); // the sky bridge out over the sea, the subway under the beach towers
  t.arc(90, 90, 0, [
    [0, 'portoarabia', { len: 140 }],
    [40, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(Lb, 0, [[0, 'portoarabia', { len: Lb }]]);
  return t;
}

// Lusail: down Lusail Boulevard, all the way round Lusail Stadium, between the two golden Katara Towers on the waterfront,
// under the boulevard in the Lusail tunnel, along the marina promenade (yachts one side, towers the other), and back
function lusailTrack(La, Lb, K = -40, LOOP = 200, RL = 140, S0 = 80) {
  const t = turtle(),
    hump = (L, h, list) => {
      t.straight(L / 2, h, list);
      t.straight(L / 2, -h);
    };
  t.straight(S0, 0, [
    [0, 'boulevard', { len: S0 }],
    [50, 'coins', { lat: 0 }],
    [120, 'items'],
    [S0 - 20, 'pad', { lat: 0 }],
  ]);
  // a kink left, then one long right-hander all the way round Lusail Stadium
  t.arc(70, K, 0);
  t.arc(RL, LOOP, 0, [
    [0, 'stadium', { r: RL, deg: LOOP }],
    [60, 'items'],
    [200, 'coins', { lat: -4, wave: 1 }],
    [380, 'items'],
  ]);
  t.straight(80, 0, [
    [0, 'shore', { side: 'out', len: 520, d: 40 }],
    [40, 'kataratowers'],
    [65, 'coins', { lat: 0, n: 7 }],
  ]);
  // the Lusail tunnel
  t.straight(25);
  t.straight(60, -10, [[15, 'coins', { lat: -6, n: 7 }]]);
  t.straight(120, 0, [
    [25, 'items', { lats: [-9, -5, 5, 9] }],
    [70, 'coins', { lat: 6, n: 10, gap: 6 }],
  ]);
  t.straight(60, 10);
  t.straight(25);
  t.arc(90, 270 - K - LOOP, 0);
  t.straight(La, 0, [
    [0, 'lusailmarina', { len: La }],
    [0, 'shore', { side: 'out', len: La, d: 34 }],
    [40, 'kicker'],
    [70, 'items'],
    [85, 'fork', { len: 205, tunnel: 'in' }],
  ]); // the sky bridge over the marina, the subway under the towers
  t.arc(90, 90, 0);
  // down the boulevard and round a loop-the-loop: 24 m up and over, the road stepping 30 m sideways so it clears itself
  t.straight(Lb * 0.45, 0, [
    [0, 'boulevard', { len: Lb * 0.45 }],
    [Lb * 0.2, 'items'],
    [Lb * 0.45 - 30, 'coins', { lat: 0, n: 6 }],
  ]);
  t.loop(24, 30);
  t.straight(Lb * 0.55, 0, [
    [0, 'boulevard', { len: Lb * 0.55 }],
    [40, 'pad', { lat: 0 }],
  ]);
  void hump;
  return t;
}
export const DOHA_CIRCUITS = [
  { id: 'msheireb', name: 'Msheireb', track: closer(msheirebTrack), fn: msheirebTrack },
  { id: 'pearl', name: 'The Pearl', track: closer(pearlTrack), fn: pearlTrack },
  { id: 'lusail', name: 'Lusail', track: closer(lusailTrack), fn: lusailTrack },
];

// Singapore is four circuits (src/sgtracks.js): Marina Bay at night, Gardens by the Bay, Downtown and the River, and
// Changi Airport with Jewel
export const SINGAPORE_CIRCUITS = [
  { id: 'marina', name: 'Marina Bay', track: closer(marinaTrack), fn: marinaTrack },
  { id: 'gardens', name: 'The Gardens', track: closer(gardensTrack), fn: gardensTrack },
  { id: 'river', name: 'The River', track: closer(riverTrack), fn: riverTrack },
  { id: 'changi', name: 'Changi', track: closer(changiTrack), fn: changiTrack },
];

// Kaduna is three circuits (src/kdtracks.js): ABU Zaria (through the Department of Computer Science), the City Centre
// (round Murtala Square's old racecourse) and Zazzau, the old walled city of Zaria
export const KADUNA_CIRCUITS = [
  { id: 'abu', name: 'ABU Zaria', track: closer(abuTrack), fn: abuTrack },
  { id: 'city', name: 'City Centre', track: closer(kdTrack), fn: kdTrack },
  { id: 'zazzau', name: 'Zazzau', track: closer(zazzauTrack), fn: zazzauTrack },
];

// Kano is two circuits: the Old City figure of eight (its records keep the plain 'kano' key they always had) and Dala Hill
export const KANO_CIRCUITS = [
  { id: 'old', name: 'Old City', track: closedKano, fn: kanoTrack, rid: 'kano' },
  { id: 'dala', name: 'Dala Hill', track: closer(dalaTrack), fn: dalaTrack },
];

export const CHAPTERS = [
  {
    id: 'kano',
    n: 1,
    name: 'Kano',
    local: 'Birnin Kano',
    tagline: 'The Walled City',
    reward: 500,
    playable: true,
    desc: 'A figure of eight with a flyover: race under it, then over it. Fly the humps, jump the canals at Kofar Mata and fight through Kurmi market.',
    track: closedKano,
    circuits: KANO_CIRCUITS,
  },
  {
    id: 'doha',
    n: 2,
    name: 'Doha',
    local: 'Qatar',
    tagline: 'City on the Bay',
    reward: 800,
    playable: true,
    desc: 'Round Doha Bay: the Corniche and its dhows, the West Bay towers, Katara and Lusail, then out over the bridges to The Pearl and home along the causeway.',
    circuits: DOHA_CIRCUITS,
  },
  {
    id: 'kaduna',
    n: 3,
    name: 'Kaduna',
    local: 'Nigeria',
    tagline: 'The Garrison Town',
    reward: 1300,
    playable: true,
    desc: 'Through Ahmadu Bello University and down the corridor of its Computer Science department, round the old racecourse at Murtala Square, and through the gates of old Zazzau past the Emir and his horsemen.',
    circuits: KADUNA_CIRCUITS,
  },
  {
    id: 'abudhabi',
    n: 4,
    name: 'Abu Dhabi',
    local: 'UAE',
    tagline: 'City of Islands',
    reward: 1000,
    playable: false,
    desc: 'Round the marina circuit on Yas Island, over the bridges between the islands, and along the Corniche past the white domes of the Grand Mosque.',
  },
  {
    id: 'singapore',
    n: 5,
    name: 'Singapore',
    local: 'Marina Bay',
    tagline: 'The Garden City',
    reward: 1100,
    playable: true,
    desc: 'Round Marina Bay under the lights, through the Supertrees and the Cloud Forest, along the river past Boat Quay, and through Jewel at Changi round the Rain Vortex.',
    circuits: SINGAPORE_CIRCUITS,
  },
  {
    id: 'lagos',
    n: 6,
    name: 'Lagos',
    local: 'Nigeria',
    tagline: 'City on the Lagoon',
    reward: 1200,
    playable: false,
    desc: 'Eleven kilometres of bridge over the lagoon, bus traffic to dodge, and a night run along the Marina.',
  },
];
