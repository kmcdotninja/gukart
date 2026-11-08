// The garage screen: pick a vehicle, its stats, and Customise (paint, decals, wheels, tyres, plates, nitro) bought with
// coins. Each city has its own garage room (src/garage.js builds it).
import { screenOut } from './motion.js';
import { Feedback } from './feedback.js';
import { VSTATS } from './race.js';
import { VEHICLES, PARTS, DEFAULT_CUSTOM, decalTex, plateTex } from './buddy.js';
import { Garage, vehicleThumbs, partThumbs } from './garage.js';
import { CHAPTERS } from './chapters.js';
import { Sound } from './audio.js';
import { clamp, store } from './util.js';
import { $, show, hide } from './dom.js';
import { cam } from './scene.js';
import { chapter, game } from './game.js';
import { travelTo, renderChapter } from './home.js';
import { openModes } from './modes.js';

const VKEYS = Object.keys(VEHICLES);
export function renderGarage() {
  const v = VEHICLES[game.vehicle],
    st = VSTATS[game.vehicle];
  $('#tiles').innerHTML = VKEYS.map(
    id =>
      `<button class="tile${id === game.vehicle ? ' on' : ''}" data-veh="${id}"><span class="n">${VEHICLES[id].name.toUpperCase()}</span><img src="${game.THUMBS[id] || ''}" alt=""></button>`,
  ).join('');
  const rows = [
    ['SPEED', (st.top - 0.9) * 10],
    ['ACCEL', (st.acc - 0.8) * 3],
    ['GRIP', (st.turn - 0.8) * 4],
    ['OFF-ROAD', st.off],
    ['WEIGHT', st.mass / 2],
  ];
  $('#gStats').innerHTML = rows
    .map(([a, x]) => {
      const pc = Math.round(clamp(x, 0.05, 1) * 100);
      return `<dt>${a}</dt><dd><div class="stripebar thin"><i style="width:${pc}%"></i></div></dd><span class="pc">${pc}%</span>`;
    })
    .join('');
  $('#gName').textContent = v.name.toUpperCase();
  $('#garageBtn').setAttribute('aria-label', `Open the garage, ${v.name}`); // (the tile's picture is a fixed one: the kart on its own, public/tile-garage.png)
  renderCustom();
  $('#gWallet').textContent = store.get('wallet', 0).toLocaleString('en');
}
// your vehicle's paint, wheels and tyres, bought with coins
export const custom = id => ({ ...DEFAULT_CUSTOM[id], plate: 'kano', ...store.get('custom.' + id, {}) });
const owned = () => store.get('owned', []);
// a vehicle's factory part is always its own, even when that part costs coins in the shop (the Muscle's Midnight paint)
const isFactory = (id, tab, v) => DEFAULT_CUSTOM[id]?.[tab] === v;
let custTab = 'body',
  draft = null;
const TABS = [
  ['body', 'BODY'],
  ['paint', 'PAINT'],
  ['decal', 'DECALS'],
  ['rim', 'WHEELS'],
  ['tyre', 'TYRES'],
  ['plate', 'PLATES'],
  ['nitro', 'NITRO'],
];
const decalPreview = {};
function tilePic(tab, v) {
  if (tab === 'decal') {
    const k = draft.paint + v;
    return (decalPreview[k] ||=
      v === 'none'
        ? (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const x = c.getContext('2d');
            x.fillStyle = draft.paint;
            x.fillRect(0, 0, 64, 64);
            return c.toDataURL();
          })()
        : decalTex(draft.paint, v).image.toDataURL());
  }
  if (tab === 'plate') return plateTex(v).image.toDataURL();
  return game.PTH[tab][v];
}
function renderCustom() {
  if (!draft) return;
  if (custTab === 'body') {
    // the bodies: every vehicle as a card; picking one swaps the car on the stand
    document.querySelectorAll('#custTabs [data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === 'body'));
    $('#custTitle').textContent = `BODY · ${VKEYS.length} OWNED`;
    $('#custList').innerHTML = VKEYS.map(
      id =>
        `<button class="tile2 body ${id === game.vehicle ? 'worn sel' : ''}" data-body="${id}" aria-label="${VEHICLES[id].name}"><img src="${game.THUMBS[id]}" alt=""><span class="tl">${VEHICLES[id].name}</span></button>`,
    ).join('');
    return;
  }
  game.PTH ||= partThumbs();
  const saved = custom(game.vehicle),
    own = owned();
  document.querySelectorAll('#custTabs [data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === custTab));
  $('#custTitle').textContent = TABS.find(t => t[0] === custTab)[1];
  $('#custList').innerHTML = PARTS[custTab]
    .map(([v, name, price]) => {
      const has = !price || own.includes(custTab + ':' + v) || isFactory(game.vehicle, custTab, v),
        pic = tilePic(custTab, v);
      const face =
        custTab === 'plate'
          ? `<i class="pv plate" style="background-image:url(${pic})"></i>`
          : custTab === 'decal'
            ? `<i class="pv" style="background-image:url(${pic})"></i>`
            : `<img src="${pic}" alt="">`;
      return `<button class="tile2 ${saved[custTab] === v ? 'worn' : ''} ${draft[custTab] === v ? 'sel' : ''} ${has ? '' : 'locked'}" data-part="${v}" aria-label="${name}">${face}${has ? '' : `<span class="tp"><i class="coin-icon"></i>${price}</span>`}<span class="tl">${name}</span></button>`;
    })
    .join('');
}
function costOf(d) {
  const own = owned();
  let c = 0;
  const items = [];
  for (const [tab] of TABS) {
    if (!PARTS[tab]) continue;
    const it = PARTS[tab].find(q => q[0] === d[tab]);
    if (it && it[2] && !own.includes(tab + ':' + it[0]) && !isFactory(game.vehicle, tab, it[0])) {
      c += it[2];
      items.push(tab + ':' + it[0]);
    }
  }
  return { c, items };
}
function openCustom() {
  draft = { ...custom(game.vehicle) };
  $('#garage').classList.add('customising');
  show($('#cust'));
  renderCustom();
}
function closeCustom() {
  $('#garage').classList.remove('customising');
  hide($('#cust'));
  draft = null;
  game.garage.focus(null);
  game.garage.setVehicle(game.vehicle, 0, custom(game.vehicle));
}

function pickVehicle(id) {
  if (id === game.vehicle) return;
  const dir = VKEYS.indexOf(id) > VKEYS.indexOf(game.vehicle) ? -1 : 1;
  game.vehicle = id;
  store.set('veh', game.vehicle);
  game.race.setVehicle(game.vehicle, custom(game.vehicle));
  game.garage.setVehicle(game.vehicle, dir, custom(game.vehicle));
  renderGarage();
  Sound.init();
  const card = $('.g-card');
  card.classList.remove('enter');
  void card.offsetWidth;
  card.style.setProperty('--wd', -dir);
  card.classList.add('enter');
}
// each city's garage keeps its own lights (Kano's room starts dark, Doha's workshop in daylight)
// each city has its own garage room (Kano's navy room, Doha's workshop); the garage you open is the one for the chapter
// on the home card, built on the spot if it isn't the one built (the garage is its own scene: no reload)
const garageCity = () => (CHAPTERS[game.chIndex]?.playable ? CHAPTERS[game.chIndex].id : chapter.id);
const roomOf = id => (id === 'doha' ? 'workshop' : 'navy');
const LIGHTS_KEY = (id = game.garage?.city || chapter.id) => (id === 'kano' ? 'garageLights' : 'garageLights.' + id);
export function makeGarage(id) {
  if (game.garage) {
    game.garage.scene.traverse(o => {
      if (o.isReflector) o.dispose?.();
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) m.dispose?.();
    });
  }
  game.garage = new Garage(game.TEX, { room: roomOf(id) });
  game.garage.city = id;
  game.garage.setLights(store.get(LIGHTS_KEY(id), id === 'doha'));
  $('#gLights').classList.toggle('on', game.garage.lightsOn);
  game.garage.setVehicle(game.vehicle, 0, custom(game.vehicle));
  game.garage.resize(cam.aspect);
}
export function openGarage() {
  const id = garageCity();
  if (!game.garage || roomOf(game.garage.city) !== roomOf(id)) makeGarage(id);
  else game.garage.city = id;
  game.state = 'garage';
  renderGarage();
  game.garage.jumpIn();
  show($('#garage'), 1);
}

// wire up this screen's buttons and listeners (called once, from main.js)
export function initGarageScreen() {
  // v2 defaults gave each vehicle its own colour: drop paint saved before then, once, so the new defaults show
  if (store.get('paintDefaults', 1) < 2) {
    for (const id of Object.keys(DEFAULT_CUSTOM)) {
      const c = store.get('custom.' + id, null);
      if (c && 'paint' in c) {
        delete c.paint;
        store.set('custom.' + id, c);
      }
    }
    store.set('paintDefaults', 2);
  }
  // decals that left the shop (Arewa Knot, Star): take them off every vehicle and refund anyone who bought them, once
  for (const [key, part, price] of [
    ['knotRetired', 'knot', 400],
    ['starRetired', 'star', 350],
  ])
    if (!store.get(key, false)) {
      for (const id of Object.keys(DEFAULT_CUSTOM)) {
        const c = store.get('custom.' + id, null);
        if (c?.decal === part) {
          delete c.decal;
          store.set('custom.' + id, c);
        }
      }
      const own = owned();
      if (own.includes('decal:' + part)) {
        store.set(
          'owned',
          own.filter(o => o !== 'decal:' + part),
        );
        store.set('wallet', store.get('wallet', 0) + price);
      }
      store.set(key, true);
    }
  $('#custTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-ct]');
    if (b) {
      custTab = b.dataset.ct;
      game.garage.focus(null);
      renderCustom();
    }
  });
  $('#custPrev').addEventListener('click', () => {
    const i = TABS.findIndex(t => t[0] === custTab);
    custTab = TABS[(i + TABS.length - 1) % TABS.length][0];
    game.garage.focus(null);
    renderCustom();
  });
  $('#custNext').addEventListener('click', () => {
    const i = TABS.findIndex(t => t[0] === custTab);
    custTab = TABS[(i + 1) % TABS.length][0];
    game.garage.focus(null);
    renderCustom();
  });
  $('#custList').addEventListener('click', e => {
    const bb = e.target.closest('[data-body]');
    if (bb) {
      if (bb.dataset.body !== game.vehicle) {
        pickVehicle(bb.dataset.body);
        draft = { ...custom(game.vehicle) };
      }
      renderCustom();
      return;
    }
    const b = e.target.closest('[data-part]');
    if (!b) return;
    draft[custTab] = b.dataset.part;
    game.garage.setVehicle(game.vehicle, 0, draft);
    game.garage.focus(custTab);
    renderCustom(); // picking a part closes in on it
    const { c } = costOf(draft);
    $('#custSave').textContent = c ? `SAVE · ${c}` : 'SAVE';
  });
  $('#custCancel').addEventListener('click', () => {
    $('#custSave').textContent = 'SAVE';
    closeCustom();
  });
  $('#custSave').addEventListener('click', () => {
    const { c, items } = costOf(draft),
      w = store.get('wallet', 0);
    if (c > w) {
      $('#custTitle').textContent = `NEED ${c - w} MORE COINS`;
      Feedback.say('deny');
      return;
    }
    if (c) {
      store.set('wallet', w - c);
      store.set('owned', [...owned(), ...items]);
      Feedback.say('buy');
      $('#gWallet').textContent = (w - c).toLocaleString('en');
    }
    store.set('custom.' + game.vehicle, draft);
    game.race.setVehicle(game.vehicle, draft);
    if (game.TEX) {
      Object.assign(game.THUMBS, vehicleThumbs(game.TEX, [game.vehicle], custom));
      renderGarage();
    }
    $('#custSave').textContent = 'SAVE';
    closeCustom();
  });
  $('#tiles').addEventListener('click', e => {
    const b = e.target.closest('[data-veh]');
    if (b) pickVehicle(b.dataset.veh);
  });
  $('#gPrev').addEventListener('click', () =>
    pickVehicle(VKEYS[(VKEYS.indexOf(game.vehicle) + VKEYS.length - 1) % VKEYS.length]),
  );
  $('#gNext').addEventListener('click', () => pickVehicle(VKEYS[(VKEYS.indexOf(game.vehicle) + 1) % VKEYS.length]));
  // into the garage: the roller door lifts and the camera glides in; the controls show once you're inside
  $('#garageBtn').addEventListener('click', () => {
    Sound.init();
    $('#menu').hidden = true;
    openGarage();
  });
  $('#gLights').addEventListener('click', () => {
    const on = !game.garage.lightsOn;
    game.garage.setLights(on);
    store.set(LIGHTS_KEY(), on);
    $('#gLights').classList.toggle('on', on);
  });
  $('#gBack').addEventListener('click', () => {
    $('#garage').hidden = true;
    game.state = 'menu';
    renderChapter();
    show($('#menu'), -1);
  });
  // the garage's big button races (pick it, dress it, go); customising is the button above it
  $('#custOpen').addEventListener('click', openCustom);
  $('#gPlay').addEventListener('click', () => {
    if (!CHAPTERS[game.chIndex].playable) return Feedback.say('deny');
    if (travelTo(CHAPTERS[game.chIndex].id, 'modes')) return;
    Sound.init();
    screenOut($('#garage'));
    openModes('garage');
  });
}
