// Abuja is three circuits, each its own part of the capital, and each built round roads stacked in layers the way the
// city's are: flyovers over flyovers, interchange loops climbing over the road they left, the metro on its viaduct
// overhead. Features carry the scenery (abuja.js, on the modern Nigerian city kaduna.js lays out) and the water
// (world.js: 'shore' floods one side of a stretch, every 'lowbridge' has water under it). Each ends on two straights
// (heading 270° then 0°) that closer() solves so the circuit closes.
//  - Central Area: Eagle Square, the National Assembly with Aso Rock behind it, Shehu Shagari Way between the National
//    Mosque and the National Christian Centre, the Central Business District's towers (the CBN, the World Trade Center)
//    and its interchange climbing a full circle among them
//  - Jabi: Unity Fountain and the Transcorp Hilton, Millennium Park, Wuse Market, over the new N16 interchange at Jahi
//    and under the metro, then round Jabi Lake on the water's edge
//  - The Gateway: under the City Gate's arch on the Airport Road, round the National Stadium, through the rock cut of the
//    new Apo-Karshi road, and round the Outer Southern Expressway's cloverleaf, its loop climbing over the road it left,
//    Zuma Rock ahead
import { turtle } from './turtle.js';
import { corner } from './sgtracks.js';

const sstep = u => u * u * (3 - 2 * u);
// a straight climbing or dropping dy over L, the slope easing in from flat and out to flat (no kink at either end)
function easedRamp(t, L, dy, n = 12, list) {
  for (let i = 0; i < n; i++) t.straight(L / n, dy * (sstep((i + 1) / n) - sstep(i / n)), i === 0 ? list : undefined);
}
// a corner that climbs: corner()'s eased turn, cut into pieces so the climb eases in and out with it
function climbingCorner(t, R, deg, dy, list) {
  const parts = 6;
  for (let i = 0; i < parts; i++) {
    const h = dy * (sstep((i + 1) / parts) - sstep(i / parts));
    corner(t, R, deg / parts, h, i === 0 ? list : undefined);
  }
}
// a full circle that climbs (the same eased turn-in and turn-out as Kano City's interchange, src/kano2.js)
function easedSpiral(t, R, deg, dy, list, ramp = 30) {
  const n = 6,
    rr = (ramp * Math.PI) / 180,
    Lr = 2 * rr * R,
    midDeg = deg - 2 * ramp,
    mid = (midDeg * Math.PI * R) / 180,
    total = Lr * 2 + mid,
    pieces = [];
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n / R;
    pieces.push([1 / k, ((k * Lr) / n) * (180 / Math.PI), Lr / n]);
  }
  const m = 24;
  for (let i = 0; i < m; i++) pieces.push([R, midDeg / m, mid / m]);
  for (let i = 0; i < n; i++) {
    const k = (n - i - 0.5) / n / R;
    pieces.push([1 / k, ((k * Lr) / n) * (180 / Math.PI), Lr / n]);
  }
  let at = 0;
  pieces.forEach(([r, ang, len], i) => {
    const h = dy * (sstep((at + len) / total) - sstep(at / total));
    t.arc(r, ang, h, i === n ? list : undefined);
    at += len;
  });
}
const hump = (t, L, h, list) => {
  t.straight(L / 2, h, list);
  t.straight(L / 2, -h);
};

// how high the Central Area's interchange climbs: room for a clear sky over the road it crosses (as Kano City's)
export const CBD_RISE = 40; // (two full turns stacked: about 20 m between one turn and the next over it)

// Central Area, bright midday: off the line on Independence Avenue in front of Eagle Square, the grandstand and its
// flags; round past the National Assembly's green dome with Aso Rock filling the sky behind it; down Shehu Shagari Way,
// the National Mosque's golden dome on one side and the National Christian Centre's spire on the other; into the
// business district, the CBN tower beside the interchange, all the way round and up over the way you came in, the long
// ramp down between the towers; past the World Trade Center's twin towers, and back to Eagle Square
export function centralTrack(La, Lb) {
  const t = turtle();
  t.straight(260, 0, [
    [0, 'abway', { len: 260 }],
    [70, 'eaglesq', { len: 150 }],
    [40, 'coins', { lat: 0 }],
    [150, 'items'],
    [235, 'pad', { lat: 0 }],
  ]);
  // the Three Arms Zone: the National Assembly, Aso Rock behind it
  corner(t, 110, 90, 0, [
    [20, 'assembly'],
    [60, 'coins', { lat: 4, wave: 1 }],
    [120, 'items'],
  ]);
  // straight in through the National Assembly's front, down the hall under the green dome, and out the back into the
  // State House grounds at the foot of Aso Rock: the drive between the flags, the gardens and the fountain, the Villa
  t.straight(230, 0, [
    [20, 'hall', { len: 190 }],
    [20, 'nahall', { len: 190 }],
    [70, 'coins', { lat: 0, n: 10, gap: 7 }],
    [150, 'items'],
  ]);
  t.straight(270, 0, [
    [0, 'statehouse', { len: 270 }],
    [30, 'pad', { lat: 0 }],
    [80, 'coins', { lat: 0, wave: 1 }],
    [200, 'items'],
  ]);
  // Shehu Shagari Way: the mosque one side, the church the other, a hump in the middle
  t.straight(50, 0, [
    [0, 'abway', { len: 50 + 60 + 50 }],
    [0, 'abmosque', { len: 160 }],
    [0, 'abchurch', { len: 160 }],
    [20, 'coins', { lat: 0, n: 5 }],
  ]);
  hump(t, 60, 4, [[10, 'items']]);
  t.straight(50, 0, [[30, 'pad', { lat: 0 }]]);
  corner(t, 100, 90, 0, [
    [20, 'cbd', { len: 1400 }],
    [60, 'coins', { lat: 4, wave: 1 }],
  ]);
  // the business district's interchange: in at street level beside the CBN tower and right round, climbing, until
  // you cross high over the way you came in; then the long ramp down between the towers
  // the twisted helix: two full turns, one stacked over the other, climbing 40 m among the towers
  const R = 80,
    DOWN = 480,
    spl = 2 * ((30 * Math.PI) / 180) * R * 2 + ((720 - 60) * Math.PI * R) / 180;
  t.straight(40, 0, [
    [0, 'cbdspiral', { len: 40 + spl + 60 + DOWN, spiral: [40, spl] }],
    [10, 'coins', { lat: 0, n: 5 }],
  ]);
  easedSpiral(t, R, 720, CBD_RISE, [
    [spl * 0.3, 'items'],
    [spl * 0.6, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(60, 0, [[30, 'pad', { lat: 0 }]]);
  easedRamp(t, DOWN, -CBD_RISE);
  // Constitution Avenue: the split (the sky bridge over the district, or the subway under it)
  t.straight(270, 0, [
    [0, 'abway', { len: 270 }],
    [25, 'fork', { len: 210, tunnel: 'in' }],
  ]);
  corner(t, 100, 90, 0, [[40, 'items']]);
  // past the World Trade Center, then up onto Aso Rock
  t.straight(La - 440, 0, [
    [20, 'wtc'],
    [40, 'coins', { lat: 0, wave: 1 }],
  ]);
  // up onto Aso Rock: a ledge carved into the cliff, climbing 18 m along the rock face with the city below, and down
  easedRamp(t, 200, 18, 12, [
    [0, 'asoledge', { len: 200 + 160 + 200 }],
    [40, 'coins', { lat: 0, n: 6 }],
  ]);
  t.straight(160, 0, [[60, 'items']]);
  easedRamp(t, 200, -18, 12, [[150, 'pad', { lat: 0 }]]);

  corner(t, 100, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  // home past Wonderland: under the roller coaster's track, the Ferris wheel turning beside the road
  // up onto a flyover that runs straight through an office tower, 14 m up: in one side, through its lobby, out the other
  easedRamp(t, 130, 14, 12, [[0, 'towerthru', { len: 130 + 110 + 130 }]]);
  t.straight(110, 0, [[30, 'coins', { lat: 0, n: 6 }]]);
  easedRamp(t, 130, -14);
  t.straight(Lb - 370, 0, [
    [0, 'abway', { len: Lb - 370 }],
    [40, 'wonderland', { len: 260 }],
    [(Lb - 370) * 0.6, 'items'],
  ]);
  return t;
}

// Jabi, late afternoon: off the line beside Unity Fountain, the Transcorp Hilton over it; round Millennium Park; through
// the stalls of Wuse Market; up over the new N16 interchange at Jahi (its ramps crossing high over the road beneath)
// and under the metro's red train on its viaduct; then the long run round Jabi Lake, the water at your shoulder, over the
// bridge across the inlet, Jabi Lake Mall on the shore, and home
export function jabiTrack(La, Lb) {
  const t = turtle();
  t.straight(240, 0, [
    [0, 'abway', { len: 240 }],
    [60, 'unity'],
    [40, 'coins', { lat: 0 }],
    [140, 'items'],
    [215, 'pad', { lat: 0 }],
  ]);
  corner(t, 100, 90, 0, [
    [10, 'millennium', { len: 200 }],
    [60, 'coins', { lat: 4, wave: 1 }],
  ]);
  // along the park: the split (the sky bridge over the lawns, or the subway under them)
  t.straight(260, 0, [
    [0, 'abway', { len: 260 }],
    [25, 'fork', { len: 210, tunnel: 'in' }],
  ]);
  // Wuse: the market lane, then a jink between the blocks
  t.straight(150, 0, [
    [0, 'citystreet', { len: 150 + 170 }],
    [110, 'metro'],
    [30, 'market', { len: 150 }],
    [60, 'coins', { lat: -3, n: 7 }],
    [150, 'items'],
  ]);
  corner(t, 85, -40, 0, [[30, 'coins', { lat: 0, n: 5 }]]);
  corner(t, 85, 40, 0, [[30, 'pad', { lat: 0 }]]);
  corner(t, 100, 90, 0, [[40, 'items']]);
  // the N16 interchange: up the ramp and over the expressway below on the bridge, the metro crossing overhead beyond
  t.straight(40, 0, [[0, 'abway', { len: 40 }]]);
  easedRamp(t, 130, 12, 12, [
    [0, 'n16', { len: 130 + 120 + 130 }],
    [30, 'coins', { lat: 0, n: 8 }],
  ]);
  t.straight(120, 0, [[50, 'items']]);
  easedRamp(t, 130, -12);
  t.straight(120, 0, [
    [0, 'abway', { len: 120 }],
    [90, 'pad', { lat: 0 }],
  ]);
  // the Abuja Knot: three loops of interchange, one after another, each climbing 12 m and crossing over the one before,
  // until you're 36 m up over the tangle of decks; then the long ramp down
  t.straight(60, 0, [[0, 'knot', { len: 3 * 1130 + 560 }]]);
  for (let n = 0; n < 3; n++) {
    climbingCorner(t, 80, -270, 12, n === 0 ? [[150, 'coins', { lat: -4, wave: 1 }]] : [[200, 'items']]);
    t.straight(70, 0, [[30, 'coins', { lat: 0, n: 5 }]]);
  }
  easedRamp(t, 520, -36, 16, [[60, 'pad', { lat: 0 }]]);
  corner(t, 100, 90, 0, [[40, 'items']]);
  corner(t, 100, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  // into Jabi Lake: out onto a deck just over the water, then down into a glass tube along the bed of the lake, fish all
  // round, the light from the surface above, and up again onto the far shore
  t.straight(60, 0, [
    [0, 'lowbridge', { len: 60 + 470 }],
    [0, 'shore', { side: 'in', len: 600, d: 26 }],
    [0, 'jabi', { len: 600 }],
    [20, 'coins', { lat: 0, n: 6 }],
  ]);
  t.straight(15, -0.9);
  t.straight(20);
  t.straight(100, -15.6);
  t.straight(170, 0, [
    [10, 'pad', { lat: 0 }],
    [60, 'items'],
    [100, 'coins', { lat: 0, wave: 1 }],
  ]);
  t.straight(100, 15.6);
  t.straight(20);
  t.straight(15, 0.9);
  // Jabi Lake: the water on the inside all along, the mall, the boats
  t.straight(La, 0, [
    [0, 'shore', { side: 'in', len: La, d: 26 }],
    [0, 'jabi', { len: La }],
    [60, 'coins', { lat: 0, wave: 1 }],
    [Math.max(320, La * 0.62), 'items'],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 100, 90, 0, [[40, 'items']]);
  t.straight(Lb, 0, [
    [0, 'abway', { len: Lb }],
    [Lb * 0.5, 'coins', { lat: 0, wave: 1 }],
  ]);
  return t;
}

// The Gateway, morning: off the line on the Airport Road expressway and straight under the City Gate's white arch;
// round the National Stadium; through the rock cut on the new Apo-Karshi road (granite walls either side, the road
// climbing over the hill's shoulder); then the Outer Southern Expressway's cloverleaf: three quarters of a circle,
// climbing, until the loop carries you high over the road you came in on, Zuma Rock straight ahead; down, and home
export function gatewayTrack(La, Lb) {
  const t = turtle();
  t.straight(300, 0, [
    [0, 'expressway', { len: 300 }],
    [150, 'citygate'],
    [40, 'coins', { lat: 0 }],
    [200, 'items'],
    [275, 'pad', { lat: 0 }],
  ]);
  corner(t, 120, 90, 0, [
    [20, 'stadium'],
    [70, 'coins', { lat: 4, wave: 1 }],
    [150, 'items'],
  ]);
  // the Apo-Karshi road: in through the cut, up over the hill's shoulder, down the far side
  t.straight(60, 0, [[0, 'expressway', { len: 60 }]]);
  t.straight(120, 7, [
    [0, 'rockcut', { len: 120 + 60 + 120 }],
    [30, 'coins', { lat: 0, n: 6 }],
  ]);
  t.straight(60, 0, [[30, 'items']]);
  t.straight(120, -7, [[80, 'pad', { lat: 0 }]]);
  // the sky-high S: up onto a flyover that sweeps left then right high over the expressway, and down
  easedRamp(t, 110, 15, 12, [
    [0, 'skyway', { len: 110 + 2 * 170 + 110 }],
    [30, 'coins', { lat: 0, n: 6 }],
  ]);
  corner(t, 140, -45, 0, [[40, 'items']]);
  corner(t, 140, 45, 0, [[60, 'coins', { lat: 3, wave: 1 }]]);
  easedRamp(t, 110, -15, 12, [[80, 'pad', { lat: 0 }]]);
  // Gurara Falls: into a cave in the cliff, waterfalls pouring down both its walls beside the road, and out the far side
  // (long enough that the cave is done well before the cloverleaf's way off comes back over this road)
  t.straight(380, 0, [
    [30, 'hall', { len: 180 }],
    [30, 'gurara', { len: 180 }],
    [70, 'coins', { lat: 0, n: 8 }],
    [150, 'items'],
    [290, 'coins', { lat: 3, wave: 1 }],
  ]);
  // the cloverleaf: a left turn taken the cloverleaf way, three quarters of a circle the other way, climbing, until the
  // loop carries you high over the road you came in on; Zuma Rock straight ahead as you come off it
  climbingCorner(t, 95, -270, 13, [
    [0, 'clover', { len: 900 }],
    [120, 'coins', { lat: -4, wave: 1 }],
    [300, 'items'],
  ]);
  t.straight(120, 0, [[60, 'coins', { lat: 0, n: 6 }]]);
  easedRamp(t, 220, -13);
  // into Zuma Rock: a long bore straight through the giant, a cavern halfway where water falls through a crack in the
  // roof, and out the far side into the light
  t.straight(40, 0, [[10, 'pad', { lat: 0 }]]);
  t.straight(440, 0, [
    [20, 'hall', { len: 400 }],
    [20, 'tunnel', { len: 400, name: 'ZUMA ROCK TUNNEL' }],
    [20, 'zuma', { len: 400 }],
    [80, 'coins', { lat: 0, n: 10, gap: 7 }],
    [220, 'items'],
    [340, 'coins', { lat: 0, wave: 1 }],
  ]);
  // Centenary City: the new district on the Airport Road, its curved glass towers, the monorail, the lit bridges over the road
  t.straight(460, 0, [
    [0, 'centenary', { len: 460 }],
    [70, 'fork', { len: 230, tunnel: 'in' }],
    [340, 'pad', { lat: 0 }],
  ]);
  corner(t, 110, 90, 0, [[40, 'items']]);
  // the long straight home, a loop-the-loop halfway: 24 m up and over, stepping 30 m sideways so the road clears itself
  // Nnamdi Azikiwe Airport: down beside the runway (a jet taking off over you), a loop-the-loop, then under the
  // terminal's long canopy past the jets at their gates
  t.straight(La * 0.45, 0, [
    [0, 'runway', { len: La * 0.45 }],
    [60, 'coins', { lat: 0, wave: 1 }],
    [La * 0.45 - 30, 'coins', { lat: 0, n: 6 }],
  ]);
  t.loop(24, 30);
  t.straight(La * 0.55, 0, [
    [30, 'terminal', { len: Math.max(120, La * 0.55 - 80) }],
    [40, 'items'],
    [La * 0.55 - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 110, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(Lb, 0, [
    [0, 'expressway', { len: Lb }],
    [Lb * 0.5, 'items'],
  ]);
  return t;
}
