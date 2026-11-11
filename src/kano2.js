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
