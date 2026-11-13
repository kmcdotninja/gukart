// Kaduna is three circuits, each its own part of the state. Features carry the scenery (kaduna.js) and the river
// (world.js: every 'lowbridge' has open water under it and either side). Kano's own pieces work here too: 'gate' (the
// old mud gates), 'walls' (the Ganuwa), 'market' (stalls under umbrellas). Each ends on two straights (heading 270°
// then 0°) that closer() solves so the circuit closes.
import { turtle } from './turtle.js';
import { corner } from './sgtracks.js';

const hump = (t, L, h, list) => {
  t.straight(L / 2, h, list);
  t.straight(L / 2, -h);
};

// ABU Zaria, the Samaru campus of Ahmadu Bello University: off the line under the green horn arches of the Main Gate,
// round the waterfall roundabout, up Senate Avenue in a tunnel of trees to the terracotta Senate tower, an S past
// Kashim Ibrahim Library, along Physical Sciences and straight through the Department of Computer Science (in at the
// door, down the corridor between the labs, out the far end), past the Long Halls of Education, the halls of residence
// and the Social Centre, and a jump over the storm drain
export function abuTrack(La, Lb) {
  const t = turtle();
  t.straight(230, 0, [
    [0, 'abuway', { len: 230 }],
    [70, 'abugate', { name: 'AHMADU BELLO UNIVERSITY' }],
    [40, 'coins', { lat: 0 }],
    [140, 'items'],
    [205, 'pad', { lat: 0 }],
  ]);
  corner(t, 90, 90, 0, [
    [20, 'waterfall', { len: 120 }],
    [60, 'coins', { lat: 4, wave: 1 }],
  ]);
  // Senate Avenue: trees close over the road both sides, the Senate tower at the top
  t.straight(240, 0, [
    [0, 'avenue', { len: 240 }],
    [190, 'senate', { len: 50 }],
    [60, 'coins', { lat: 0, n: 8 }],
    [120, 'items'],
  ]);
  corner(t, 85, 55, 0, [[30, 'library', { len: 140 }]]);
  t.straight(50, 0, [[20, 'items']]);
  corner(t, 85, -55, 0, [[40, 'coins', { lat: -4, wave: 1 }]]);
  corner(t, 90, 90, 0, [[60, 'pad', { lat: 0 }]]);
  // Physical Sciences, then the Department of Computer Science: the road runs straight through the building
  t.straight(130, 0, [
    [0, 'physci', { len: 130 }],
    [40, 'coins', { lat: 3, n: 7 }],
    [95, 'items'],
  ]);
  hump(t, 50, 4);
  t.straight(210, 0, [
    [20, 'hall', { len: 170 }],
    [20, 'compsci', { len: 170 }],
    [60, 'coins', { lat: 0, n: 10, gap: 7 }],
    [110, 'items'],
    [160, 'pad', { lat: 0 }],
  ]);
  corner(t, 85, 90, 0, [[30, 'items']]);
  // the Long Halls of Education, the halls of residence, the Social Centre; a jump over the storm drain
  t.straight(La, 0, [
    [20, 'longhalls', { len: 200 }],
    [240, 'hostels', { len: Math.max(60, La - 300) }],
    [140, 'coins', { lat: 0, wave: 1 }],
    [La * 0.55, 'kicker'],
    [La * 0.75, 'items'],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 85, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(Lb, 0, [
    [0, 'abuway', { len: Lb }],
    [Lb * 0.4, 'items'],
  ]);
  return t;
}

// Kaduna City Centre, late afternoon: off the line on Ahmadu Bello Way (keke napep, yellow buses, phone billboards),
// round the Stadium roundabout and its giant football, in through the gates of Murtala Square and along the old
// racecourse between its white rails, under the cable footbridge, past the grandstand and the gazebo, out round Lugard
// Hall, up and over the Queen Amina flyover, through the blue arch of the Central Market and down its lane of stalls,
// across the River Kaduna (the old steel railway bridge alongside), and back to the line
export function kdTrack(La, Lb) {
  const t = turtle();
  t.straight(230, 0, [
    [0, 'citystreet', { len: 230 }],
    [40, 'coins', { lat: 0 }],
    [140, 'items'],
    [205, 'pad', { lat: 0 }],
  ]);
  corner(t, 90, 90, 0, [
    [30, 'football', { len: 120 }],
    [70, 'coins', { lat: 4, wave: 1 }],
  ]);
  t.straight(60, 0, [[30, 'squaregate']]);
  // Murtala Square: in along the old racecourse (rails either side, the oval of grass inside), then up the access ramp
  // onto the suspension footbridge, along its deck high over the course between the cables, and down the far ramp
  t.straight(60, 0, [
    [0, 'racecourse', { len: 60 + 360 + 300 }],
    [20, 'coins', { lat: 0, n: 6 }],
  ]);
  t.straight(90, 11, [
    [0, 'skywalk', { len: 90 + 180 + 90 }],
    [10, 'pad', { lat: 0 }],
  ]);
  t.straight(180, 0, [
    [40, 'coins', { lat: 0, n: 10, gap: 7 }],
    [110, 'items'],
  ]);
  t.straight(90, -11, [[60, 'grandstand']]);
  t.straight(40, 0, [[20, 'items']]);
  corner(t, 150, 90, 0, [
    [80, 'gazebo'],
    [60, 'coins', { lat: 4, wave: 1 }],
    [150, 'items'],
  ]);
  t.straight(40, 0, [[20, 'pad', { lat: 0 }]]);
  // the crescent at Lugard Hall
  corner(t, 85, -60, 0, [[20, 'lugard', { len: 180 }]]);
  corner(t, 85, 60, 0, [[40, 'items']]);
  // the Queen Amina flyover
  t.straight(30, 0, [[10, 'citystreet', { len: 30 }]]);
  t.straight(110, 12, [
    [0, 'flyover', { len: 290 }],
    [40, 'coins', { lat: 0, n: 8 }],
  ]);
  t.straight(70, 0, [[30, 'items']]);
  t.straight(110, -12);
  t.straight(20);
  corner(t, 90, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  // the Central Market, then the river
  t.straight(La, 0, [
    [20, 'gumiarch'],
    [40, 'market', { len: 150 }],
    [60, 'coins', { lat: -3, n: 7 }],
    [130, 'items'],
    [220, 'lowbridge', { len: 110 }],
    [220, 'railbridge', { len: 110 }],
    [240, 'coins', { lat: 0, n: 8 }],
    [Math.max(350, La - 60), 'citystreet', { len: Math.max(0, La - 350) }],
    [La - 40, 'pad', { lat: 0 }],
  ]);
  corner(t, 90, 90, 0, [[40, 'items']]);
  t.straight(Lb, 0, [
    [0, 'citystreet', { len: Lb }],
    [Lb * 0.4, 'coins', { lat: 0, wave: 1 }],
    [Lb * 0.62, 'flowerring'], // the ring of flowers over Ahmadu Bello Way
  ]);
  return t;
}

// Zazzau, the old walled city of Zaria, bright midday: off the line outside Kofar Doka, in through the gate, down the
// lanes of earth houses (humps to fly), round the great square in front of the Emir's palace (its painted front, the
// durbar horsemen lined up), past the minarets of the Emirate mosque, through the Malam Yamusa gate and its Z, along
// the wall with a jump over the old ditch, up the shoulder of the granite rock and down again, and back to Kofar Doka
export function zazzauTrack(La, Lb) {
  const t = turtle();
  t.straight(220, 0, [
    [90, 'gate', { name: 'KOFAR DOKA' }],
    [40, 'coins', { lat: 0 }],
    [150, 'items'],
    [195, 'pad', { lat: 0 }],
  ]);
  corner(t, 85, 90, 0, [[30, 'coins', { lat: 4, wave: 1 }]]);
  // the lanes of the old city
  t.straight(40, 0, [[0, 'oldcity', { len: 430 }]]);
  hump(t, 50, 4.5, [[0, 'coins', { lat: 0, n: 6 }]]);
  t.straight(40, 0, [[20, 'items']]);
  hump(t, 50, 4.5);
  t.straight(60, 0, [[30, 'pad', { lat: 0 }]]);
  // a jink through the lanes, left then right between the houses
  corner(t, 85, -40, 0, [[20, 'coins', { lat: -3, wave: 1 }]]);
  t.straight(30, 0, [[15, 'items']]);
  corner(t, 85, 40, 0);
  hump(t, 50, 4.5, [[10, 'coins', { lat: 3, n: 6 }]]);
  // round the square: the palace on the inside of the bend, the horsemen lined up in front of it
  corner(t, 120, 90, 0, [
    [0, 'palacesq', { len: 190 }],
    [60, 'coins', { lat: 4, wave: 1 }],
    [140, 'items'],
  ]);
  t.straight(400, 0, [
    [40, 'mosque', { len: 60 }],
    [110, 'oldcity', { len: 190 }],
    [60, 'coins', { lat: -3, n: 7 }],
    [200, 'items'],
    [350, 'zgate'],
  ]);
  corner(t, 85, 90, 0, [[40, 'items']]);
  // along the wall, over the ditch, then over the rock
  t.straight(150, 0, [
    [10, 'walls', { len: 140 }],
    [60, 'kicker'],
    [120, 'items'],
  ]);
  // up the rock's shoulder, along it, and down
  t.straight(70, 8, [
    [0, 'rock', { len: 180 }],
    [20, 'coins', { lat: 0, n: 7 }],
  ]);
  t.straight(40, 0, [[20, 'items']]);
  t.straight(70, -8);
  t.straight(La - 330, 0, [[Math.max(10, La - 370), 'pad', { lat: 0 }]]);
  corner(t, 85, 90, 0, [[40, 'coins', { lat: 4, wave: 1 }]]);
  t.straight(Lb, 0, [
    [20, 'walls', { len: Lb * 0.45 }],
    [Lb * 0.4, 'items'],
  ]);
  return t;
}
