// Kano's second circuit, Dala Hill. Drawn with the turtle (src/turtle.js) as dalaTrack(La, Lb); closer() in
// src/chapters.js solves La and Lb so the lap closes.
//
// Where the Old City stays near the ground, Dala Hill goes up: out through the Ganuwa and up a ramp onto a viaduct
// (under its own top deck), then three quarters of the way round Dala Hill on a banked spiral bridge, climbing to 30 m,
// over the viaduct you just came along, off the crest and down a long sweeping descent, a jump over a canal, a
// loop-the-loop, and home through Kurmi market and past the dye pits. The spiral is a lobe of its own (it turns the
// other way to the rest of the lap), so the widest open ground inside the lap, where world.js puts the hill, is its middle.
import { turtle } from './turtle.js';

export function dalaTrack(La, Lb) {
  const t = turtle();
  t.straight(180, 0, [
    [60, 'gate', { name: 'KOFAR KABUGA' }],
    [90, 'coins', { lat: 0 }],
    [130, 'items'],
    [165, 'pad', { lat: 0 }],
  ]);
  t.arc(80, 90, 0, [[10, 'walls', { len: 160 }]]);
  // up onto the viaduct; the spiral's top deck crosses over it on the way down
  t.straight(40, 0, [[20, 'gate', { name: 'KOFAR RUWA' }]]);
  t.straight(130, 14, [[30, 'coins', { lat: 0, n: 8 }]]);
  t.straight(100, 0, [[50, 'items']]);
  // round Dala Hill: 270° on a bridge, climbing from 14 m to 30 m
  t.arc(135, -270, 16, [
    [60, 'coins', { lat: -4, wave: 1 }],
    [250, 'items'],
    [420, 'coins', { lat: 4, wave: 1 }],
  ]);
  // across the top deck, a boost into the crest, and down: you fly off the top
  t.straight(150, 0, [
    [40, 'items'],
    [120, 'pad', { lat: 0 }],
  ]);
  t.straight(60, -8, [[20, 'coins', { lat: 0, n: 8, gap: 6 }]]);
  t.arc(180, 35, -11, [[60, 'items']]);
  t.arc(180, -35, -11, [[30, 'coins', { lat: -4, wave: 1 }]]);
  // at the foot of the hill: a jump over the canal, then the loop-the-loop
  t.straight(60, 0, [[10, 'kicker']]);
  t.straight(40, 0, [[20, 'coins', { lat: 0, n: 6 }]]);
  t.loop(24, 30);
  t.straight(60, 0, [[20, 'pad', { lat: 0 }]]);
  t.arc(70, 90, 0, [[20, 'market', { len: 160 }]]);
  t.straight(La, 0, [[La / 2, 'items']]); // heading 270°
  t.arc(70, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(Lb, 0, [
    [20, 'dye', { len: 80 }],
    [Lb - 40, 'gate', { name: 'KOFAR DUKAWUYA' }],
  ]); // heading 0°: back to the start
  return t;
}

// Kano's third circuit, Kano City: the modern metropolis. Off the line on State Road (palms down the middle, keke
// napep), round the Golden Jubilee monument at the Government House gate, along Ahmadu Bello Way, up onto the red
// Kwankwasiyya flyover sweeping round over its chequered roundabout, round the fountain at the next roundabout, over
// the Muhammadu Buhari Interchange (the four brick clock towers, the steel X spelling KANO), past the Kano Club's golf
// course on the Race Course, round the Ring Road roundabout and back to State Road. Features are dressed by kaduna.js
// (the modern Nigerian city) and its own pieces; closer() solves La and Lb.
import { corner } from './sgtracks.js';
// how high the interchange's loop climbs: high enough that where it crosses back over the road below there's a clear
// sky's worth of room under the deck (about 20 m, like the bridges over the road at Changi), not a low tunnel
export const BUHARI_RISE = 24;
const sstep = u => u * u * (3 - 2 * u);
// a straight climbing or dropping dy over L, the slope easing in from flat and out to flat (no kink at either end)
function easedRamp(t, L, dy, n = 12, list) {
  for (let i = 0; i < n; i++) t.straight(L / n, dy * (sstep((i + 1) / n) - sstep(i / n)), i === 0 ? list : undefined);
}
// spiral() (src/sgtracks.js), the same eased turn-in and turn-out, but cut into short pieces so the climb can ease in
// and out too: flat as it turns in, steepest halfway round, flat again as it turns out
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
export function kanoCityTrack(La, Lb) {
  const t = turtle();
  // State Road
  t.straight(240, 0, [
    [0, 'citystreet', { len: 240, palms: 1 }],
    [40, 'coins', { lat: 0 }],
    [140, 'items'],
    [215, 'pad', { lat: 0 }],
  ]);
  // round the Golden Jubilee monument at the Government House gate
  corner(t, 100, 90, 0, [
    [0, 'govhouse', { len: 160 }],
    [60, 'coins', { lat: 4, wave: 1 }],
  ]);
  // Nassarawa GRA: a leafy avenue between walled compounds and modern villas, jinking left and right, two humps to fly
  t.straight(50, 0, [
    [0, 'gra', { len: 50 + 120 + 70 + 120 + 90 }],
    [20, 'coins', { lat: 0, n: 6 }],
  ]);
  corner(t, 85, -35, 0, [[30, 'items']]);
  t.straight(35, 3.5, [[5, 'coins', { lat: 0, n: 5 }]]);
  t.straight(35, -3.5);
  corner(t, 85, 35, 0, [[40, 'coins', { lat: 3, wave: 1 }]]);
  t.straight(35, 3.5);
  t.straight(35, -3.5, [[20, 'items']]);
  t.straight(30, 0, [[10, 'pad', { lat: 0 }]]);
  // Ahmadu Bello Way, a jump over the storm drain, then up onto the red flyover
  t.straight(200, 0, [
    [0, 'citystreet', { len: 200 }],
    [40, 'items'],
    [70, 'kicker'],
    [140, 'coins', { lat: 0, wave: 1 }],
  ]);
  easedRamp(t, 140, 11.5, 12, [
    [0, 'redflyover', { len: 140 + 236 + 140 }],
    [30, 'coins', { lat: 0, n: 8 }],
  ]);
  corner(t, 112, 90, 0, [
    [0, 'chequered'],
    [80, 'items'],
    [150, 'coins', { lat: 4, wave: 1 }],
  ]);
  easedRamp(t, 140, -11.5);
  t.straight(60, 0, [
    [0, 'citystreet', { len: 60 }],
    [30, 'pad', { lat: 0 }],
  ]);
  // the Muhammadu Buhari Interchange: in at street level and all the way round the four clock towers, 360 degrees, the
  // ramp rising as it goes, until you're high above the way you came in and cross over it; then the long ramp down.
  // A big, sweeping loop (as wide as the game's widest corners) and the climb and the drop eased in and out, so the
  // road never kinks up or down under you at speed
  const R = 80,
    DOWN = 300, // (the ramp back down: long, so even eased it's no steeper than the flyover's)
    spl = 2 * ((30 * Math.PI) / 180) * R * 2 + ((360 - 60) * Math.PI * R) / 180; // the whole spiral's length
  t.straight(40, 0, [
    [0, 'buhari', { len: 40 + spl + 60 + DOWN, spiral: [40, spl] }],
    [10, 'coins', { lat: 0, n: 5 }],
  ]);
  easedSpiral(t, R, 360, BUHARI_RISE, [
    [spl * 0.3, 'items'],
    [spl * 0.6, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(60, 0, [[30, 'pad', { lat: 0 }]]);
  easedRamp(t, DOWN, -BUHARI_RISE);
  // straight on into Kano Railway Station: in under the arches of the old station front, through the concourse and
  // along the platform under the long steel canopy, a train standing beside you, and out the far end
  t.straight(320, 0, [
    [30, 'hall', { len: 270 }],
    [30, 'railway', { len: 270 }],
    [60, 'coins', { lat: 0, n: 10, gap: 7 }],
    [160, 'items'],
    [240, 'pad', { lat: 0 }],
  ]);
  t.straight(40, 0, [[0, 'citystreet', { len: 40 }]]);
  // the fountain roundabout, then the Race Course past the golf
  corner(t, 95, 90, 0, [
    [0, 'fountain'],
    [40, 'items'],
  ]);
  t.straight(La, 0, [
    [10, 'golf', { len: Math.max(60, La - 20) }],
    [40, 'fork', { len: Math.min(220, La - 90), tunnel: 'in' }], // (the sky bridge out over the golf, or the dune subway)
    [La / 2, 'coins', { lat: 0, wave: 1 }],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  // the Ring Road roundabout, then back down State Road
  corner(t, 100, 90, 0, [
    [0, 'ringroad'],
    [60, 'items'],
  ]);
  t.straight(Lb, 0, [
    [0, 'citystreet', { len: Lb, palms: 1 }],
    [Lb * 0.4, 'items'],
  ]);
  return t;
}
