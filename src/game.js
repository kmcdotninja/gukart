// The game's shared state: which screen is showing, the city and circuit, the race, the vehicle you drive. Several
// modules read and change these, so they live on one object (game.state, game.race, ...) rather than in loose variables
// each module would need its own copy of.
import { VEHICLES } from './buddy.js';
import { CHAPTERS } from './chapters.js';
import { store } from './util.js';

// One city is built at a time: the one you last chose (going to another reloads the game behind the loading screen).
// A big city has several circuits (Doha: Msheireb, The Pearl, Lusail), and one of those is built at a time too.
export const chapter = CHAPTERS.find(c => c.id === store.get('city', 'kano') && c.playable) || CHAPTERS[0];
export const CITY = chapter.name.toUpperCase();
// the circuit last chosen in a city (null for a city with one road, like Kano)
export const circuitOf = c =>
  c.circuits ? c.circuits.find(x => x.id === store.get('circuit.' + c.id, '')) || c.circuits[0] : null;

const circuit = circuitOf(chapter);
let vehicle = store.get('veh', 'kart');
if (!VEHICLES[vehicle]) vehicle = 'kart'; // (an old save may name a vehicle that's gone: the rally car became the muscle car)

export const game = {
  // ---- what's on screen: 'menu', 'garage', 'modes', 'tomap', 'map', 'intro', 'count', 'race', 'paused', 'finish', 'results'
  state: 'menu',
  prevState: 'race', // the state to go back to when the pause menu closes
  clock: 0, // seconds since the game started (stops while paused)

  // ---- the city and circuit that are built
  chIndex: CHAPTERS.indexOf(chapter), // the chapter on the home card (you can step to others before you go)
  circuit,
  RID: chapter.id + (circuit ? '.' + circuit.id : ''), // the key records are kept under: one per circuit
  PLACE: circuit ? `${CITY} · ${circuit.name.toUpperCase()}` : CITY, // what the headers say
  track: null, // the road (src/track.js)
  world: null, // the city round it (src/world.js)
  race: null, // the karts and the rules (src/race.js)
  routeLine: null, // the orange route ribbon shown on the map
  scHints: [], // the hands over each way at a fork
  night: 0, // 1 at night

  // ---- the race
  mode: store.get('mode', 'gp'), // 'gp' (Race), 'tt' (Time Trial) or 'free' (Free Drive)
  cd: 0, // the countdown before the start, in seconds
  lastCd: 0, // the countdown number last shown
  countStart: 0, // the clock when the countdown began
  finishAt: 0, // the clock when you crossed the line
  lastPos: 0, // your place, as last shown on the HUD
  resultsTimer: 0, // repaints the standings on the results card as the others finish
  rollingIcon: false, // the weapon slot is rolling through icons (a crate was just picked up)
  rollFlip: 0,

  // ---- you and your vehicle
  vehicle,
  TEX: null, // the shared canvas textures (src/textures.js)
  THUMBS: {}, // a picture of each vehicle, for the garage tiles
  PTH: null, // pictures of each customise part
  FACES: {}, // each racer's head, for the results
  garage: null, // the garage room for the city on the home card (src/garage.js)
  modesRoom: null, // the 3D room behind the race mode cards

  // ---- the map and the camera moves round it
  mapUI: null, // the map's pins and cards (src/mapscreen.js)
  mapShot: null, // the pictures taken from the scene (src/snapshots.js)
  kanoSnap: null, // a picture of the start line, used when a place has none of its own
  mapPts: null, // the minimap's points, worked out once per circuit
  fly: null, // the camera flying up to the map or back down
  mapFly: null, // the camera flying across the map
  introT: 0, // how far into the drone sweep before a race
  lastShot: -1, // the home screen's last camera shot
};
