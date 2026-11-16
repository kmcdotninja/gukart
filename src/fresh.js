// NEW labels: a circuit marked fresh in src/chapters.js carries a NEW label (on the map's chips, the Quick Race cards,
// the home MAP tile) until you've raced it once
import { CHAPTERS } from './chapters.js';
import { store } from './util.js';

const seen = () => store.get('seen.circ', []);
export const isFresh = (city, circ) => {
  const c = CHAPTERS.find(x => x.id === city);
  const x = c?.circuits?.find(y => y.id === circ);
  return !!(c?.playable && (x?.fresh || (c.fresh && x)) && !seen().includes(`${city}.${circ}`));
};
// a city is new while any of its circuits is
export const cityFresh = city => (CHAPTERS.find(x => x.id === city)?.circuits || []).some(x => isFresh(city, x.id));
export const anyFresh = () => CHAPTERS.some(c => cityFresh(c.id));
export function markRaced(city, circ) {
  if (!circ || !isFresh(city, circ)) return;
  store.set('seen.circ', [...seen(), `${city}.${circ}`]);
}
