// The World Tour: the game's championship, raced from city to city (Tour 1: Kano's Old City, Doha's Msheireb, Kano's
// Dala Hill, Doha's The Pearl, then the Final at Lusail, at night). Each race pays 10, 7, 5, 3, 2, 1 points; 20 points
// from the first four unlock the Final (about third place on average). After the Final the top three overall go up on
// the podium, and if you're one of them you take home its trophy (gold, silver, bronze) and the prize.
// Forgiving: a bad race never knocks you out; quitting halfway means that race is run again when you come back (the
// home screen's CONTINUE); after any finish you can retry the race, twice per tour. Short of 20 points after race 4,
// a retry is the way to the Final, or START OVER. The tour is saved after every race.
// Shaped for multiplayer later: a tour is plain data (the races, then each race's finishing order by racer id) and the
// table is worked out from those orders, so the AI racers can one day be swapped for people.
import { store, ordinal } from './util.js';
import { $, show, hide, whip } from './dom.js';
import { chapter, game } from './game.js';
import { CHAPTERS } from './chapters.js';
import { swapCircuit } from './circuit.js';
import { raceIntro, startRace } from './race-flow.js';
import { showPodium } from './podium.js';
import { RACERS, rivalNames } from './buddy.js';
import { paintTop } from './results.js';
import { earn } from './chest.js';
import { Sound } from './audio.js';
import { Haptics } from './haptics.js';
import { setNight } from './scene.js';
import { travelTo } from './home.js';

export const POINTS = [10, 7, 5, 3, 2, 1];
export const RETRIES = 2;
export const TROPHY = ['GOLD', 'SILVER', 'BRONZE'],
  TROPHY_PRIZE = [1500, 800, 400];
// the tours, each a list of [city, circuit]; the last race is the Final, opened by `gate` points from the others
export const TOURS = [
  {
    id: 'tour1',
    name: 'World Tour 1',
    races: [
      ['kano', 'old'],
      ['doha', 'msheireb'],
      ['kano', 'dala'],
      ['doha', 'pearl'],
      ['doha', 'lusail'],
    ],
    gate: 20,
  },
];
export const TOUR = TOURS[0]; // (the one there is, for now: Abu Dhabi, Singapore and Lagos bring the next)

const KEY = 'tour';
export const cupOf = () => {
  const t = store.get(KEY, null);
  return t && t.id === TOUR.id ? t : null;
};
const save = t => store.set(KEY, t);
// a racer's name in this tour (drawn when it started; older saved tours fall back to the defaults)
const nameOf = (id, t = cupOf()) =>
  (id === 'buddy' ? 'Buddy' : t?.names?.[id] || RACERS.find(r => r.id === id)?.name || id).toUpperCase();
export const raceName = ([city, circ]) => {
  const c = CHAPTERS.find(x => x.id === city);
  return c.circuits?.find(x => x.id === circ)?.name || c.name;
};
export const isFinal = t => t.i === t.races.length - 1;

// your best trophy in a tour: 1 gold, 2 silver, 3 bronze, 0 none yet
export const trophyOf = (id = TOUR.id) => store.get('trophy.' + id, 0);

// the table: every racer's points, best first (a tie goes to whoever finished higher in the latest race)
export function table(t) {
  const pts = Object.fromEntries(RACERS.map(r => [r.id, 0]));
  t.res.forEach(order => order.forEach((id, i) => (pts[id] += POINTS[i] ?? 0)));
  const last = t.res.at(-1) || [];
  return RACERS.map(r => r.id)
    .sort((a, b) => pts[b] - pts[a] || last.indexOf(a) - last.indexOf(b))
    .map((id, i) => ({
      id,
      pts: pts[id],
      place: i + 1,
      gained: last.length ? (POINTS[last.indexOf(id)] ?? 0) : 0,
    }));
}
export const youIn = t => table(t).find(r => r.id === 'buddy');
// your points from the races before the Final (what opens it)
export const toGatePts = t => {
  let p = 0;
  t.res.slice(0, t.races.length - 1).forEach(order => (p += POINTS[order.indexOf('buddy')] ?? 0));
  return p;
};
export const qualified = t => toGatePts(t) >= TOUR.gate;

// the race card's three lines
export function introLines() {
  const t = cupOf(),
    n = t.races.length,
    me = youIn(t);
  return [
    isFinal(t) ? 'THE FINAL' : `RACE ${t.i + 1} OF ${n}`,
    t.i === 0
      ? `${TOUR.gate} PTS FROM RACES 1-4 OPEN THE FINAL`
      : isFinal(t)
        ? `YOU'RE ${me.place}${ordinal(me.place).toUpperCase()}`
        : `${toGatePts(t)} / ${TOUR.gate} PTS TO THE FINAL`,
    isFinal(t) ? 'TOP 3 WIN A TROPHY' : `${POINTS[0]} PTS FOR A WIN`,
  ];
}

// a new tour's route, before its first race: the five stops across the islands, a plane between cities, the Final in
// gold with the points it needs. START sets off; back returns home
const PLANE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-6z"/></svg>';
export function showRoute() {
  const n = TOUR.races.length;
  $('#trRoute').innerHTML = TOUR.races
    .map(([city, circ], i) => {
      const fin = i === n - 1,
        c = CHAPTERS.find(x => x.id === city),
        name = (c.circuits?.find(x => x.id === circ)?.name || c.name).toUpperCase(),
        hop = i && TOUR.races[i - 1][0] !== city ? `<i class="tr-fly">${PLANE}</i>` : '';
      return `${hop}<div class="tr-stop${fin ? ' fin' : ''}"><img src="/places/${city}-${circ}${fin ? '-night' : ''}.jpg" alt=""><b class="tr-n"><span>${fin ? 'F' : i + 1}</span></b>${fin ? `<em class="tr-pts">${TOUR.gate} PTS</em>` : ''}<p class="tr-t"><small>${fin ? 'THE FINAL' : c.name.toUpperCase()}</small><span>${name}</span></p></div>`;
    })
    .join('');
  show($('#tourRoute'));
}
export function hideRoute() {
  hide($('#tourRoute'), null, -1);
}

// start the tour, or carry on with it: the next race's city and circuit are built if they aren't (another city loads
// behind the loading screen; another circuit in this city swaps in place), then its race card
export function playCup() {
  let t = cupOf();
  if (!t) {
    t = { id: TOUR.id, races: TOUR.races, i: 0, res: [], retries: RETRIES, names: rivalNames() };
    save(t);
  }
  game.mode = 'cup';
  store.set('mode', 'cup');
  game.cupFinal = false;
  const [city, circ] = t.races[t.i];
  if (city !== chapter.id) {
    travelTo(city, 'cup', circ);
    return;
  }
  if (circ && game.circuit?.id !== circ) {
    swapCircuit(circ, 'cup');
    return;
  }
  $('#menu').hidden = true;
  if (isFinal(t)) setNight(true); // the Final is the night race, under the lights
  raceIntro(startRace);
}

// after a tour race (called by the results card): the points go on the table, the card shows the table and what's next
export function afterCupRace() {
  const t = cupOf();
  if (!t || t.res.length > t.i) return;
  t.res.push(game.race.rank().map(k => k.def.id));
  t.i++;
  save(t);
  paintTable(t);
  const n = t.races.length,
    done = t.i >= n,
    gateNow = t.i === n - 1, // the four are done: the Final is next, if the points are there
    ok = qualified(t);
  // one line on what the race meant: the points it won, and how near the Final is
  const me = youIn(t);
  $('#resChapter').textContent = done
    ? `${me.place}${ordinal(me.place).toUpperCase()} OVERALL`
    : gateNow
      ? ok
        ? "YOU'RE IN THE FINAL"
        : 'NOT IN THE FINAL'
      : ok
        ? 'FINAL UNLOCKED'
        : `${toGatePts(t)} / ${TOUR.gate} TO THE FINAL`;
  // the button says what's next in big words; where it is goes small underneath (one line each, never wrapped)
  const where = raceName(t.races[t.i < n ? t.i : n - 1]).toUpperCase();
  $('#againBtn').innerHTML = done
    ? 'FINAL STANDINGS'
    : gateNow && !ok
      ? 'START OVER'
      : `${gateNow ? 'TO THE FINAL' : 'NEXT RACE'}<small>${where}</small>`;
  $('#menuBtn').textContent = 'HOME';
  const r = $('#retryBtn');
  r.hidden = !t.retries;
  r.textContent = 'RETRY';
}
// the card's top three: this race's, with the points each won; after the Final, the tour's, with their totals
function paintTable(t, final = false) {
  if (final)
    paintTop(
      table(t).map(r => ({
        place: r.place,
        id: r.id,
        name: nameOf(r.id),
        fur: RACERS.find(x => x.id === r.id).fur,
        right: `${r.pts} PTS`,
        me: r.id === 'buddy',
      })),
    );
  else
    paintTop(
      (t.res.at(-1) || []).map((id, i) => ({
        place: i + 1,
        id,
        name: nameOf(id),
        fur: RACERS.find(x => x.id === id).fur,
        right: `+${POINTS[i] ?? 0} PTS`,
        me: id === 'buddy',
      })),
    );
}

// RETRY RACE: that race's points come off the table and it's run again
export function retryCupRace() {
  const t = cupOf();
  if (!t || !t.retries || !t.res.length) return;
  t.res.pop();
  t.i--;
  t.retries--;
  save(t);
  $('#retryBtn').hidden = true;
  startRace();
}

// the results card's big button: on to the next race, the Final, the final standings; or, short of the points for
// the Final, a fresh start
export function cupNext() {
  const t = cupOf();
  $('#retryBtn').hidden = true;
  if (t && t.i >= t.races.length) return finalStandings(t);
  if (t && t.i === t.races.length - 1 && !qualified(t)) return newCup();
  hide($('#results'), null, -1);
  playCup();
}

// the end of the tour: the top three overall on the podium, then your trophy and its prize
function finalStandings(t) {
  const tb = table(t),
    me = tb.find(r => r.id === 'buddy'),
    won = me.place <= 3 ? me.place : 0,
    prize = won ? TROPHY_PRIZE[won - 1] : 0;
  if (won && (!trophyOf() || won < trophyOf())) store.set('trophy.' + TOUR.id, won);
  store.set(KEY, null); // the tour is over: the next one starts fresh
  const from = store.get('wallet', 0);
  earn(prize);
  hide($('#results'), null, -1);
  game.state = 'podium';
  const kartOf = id => game.race.all.find(k => k.def.id === id);
  showPodium(
    tb.slice(0, 3).map(r => kartOf(r.id)),
    won ? { cup: true } : { cup: true, solo: kartOf('buddy') },
  );
  let shown = false;
  const card = () => {
    if (shown) return;
    shown = true;
    removeEventListener('pointerdown', card);
    game.state = 'results';
    game.cupFinal = true;
    whip(1);
    show($('#results'));
    $('#results .tag span').textContent = 'FINAL STANDINGS';
    $('.place-big').hidden = false;
    $('#resPlace').textContent = me.place;
    $('#resSfx').textContent = ordinal(me.place).toUpperCase();
    $('#resChapter').textContent = won ? `${me.pts} PTS OVERALL` : 'THE TOP 3 WIN A TROPHY';
    $('#resStats').innerHTML = '';
    paintTable(t, true);
    $('#resWallet').textContent = (from + prize).toLocaleString('en');
    $('#prize').innerHTML = won
      ? `<div class="pz trophy t${won}"><span>${TROPHY[won - 1]} TROPHY</span><b><i class="coin-icon"></i>+${prize}</b></div>`
      : '';
    $('#againBtn').textContent = 'NEW TOUR';
    $('#menuBtn').textContent = 'HOME';
    if (won) {
      Sound.coin();
      Haptics.big();
    }
  };
  addEventListener('pointerdown', card, { once: true });
  setTimeout(card, 6500);
}
// END TOUR (from the quit question): the tour is dropped
export function endTour() {
  store.set(KEY, null);
  game.cupFinal = false;
}
// a fresh tour from race 1 (NEW TOUR after the Final, START OVER when the Final is out of reach)
export function newCup() {
  store.set(KEY, null);
  game.cupFinal = false;
  hide($('#results'), null, -1);
  playCup();
}
