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
  // Ahmadu Bello Way, then up onto the red flyover
  t.straight(200, 0, [
    [0, 'citystreet', { len: 200 }],
    [60, 'items'],
    [120, 'coins', { lat: 0, wave: 1 }],
  ]);
  t.straight(100, 11.5, [
    [0, 'redflyover', { len: 100 + 236 + 100 }],
    [30, 'coins', { lat: 0, n: 8 }],
  ]);
  corner(t, 112, 90, 0, [
    [0, 'chequered'],
    [80, 'items'],
    [150, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(100, -11.5);
  t.straight(60, 0, [
    [0, 'citystreet', { len: 60 }],
    [30, 'pad', { lat: 0 }],
  ]);
  // over the Muhammadu Buhari Interchange: up onto the flyover, through the clock towers under the steel X, and down
  t.straight(80, 10.5, [
    [0, 'buhari', { len: 80 + 120 + 80 }],
    [20, 'coins', { lat: 0, n: 7 }],
  ]);
  t.straight(120, 0, [[50, 'items']]);
  t.straight(80, -10.5);
  t.straight(40, 0, [[0, 'citystreet', { len: 40 }]]);
  // the fountain roundabout, then the Race Course past the golf
  corner(t, 95, 90, 0, [
    [0, 'fountain'],
    [40, 'items'],
  ]);
  t.straight(La, 0, [
    [10, 'golf', { len: Math.max(60, La - 20) }],
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
