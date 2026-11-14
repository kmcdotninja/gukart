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
import { UPGRADES, MILESTONES, earned, nextMilestone } from './chest.js';

const VKEYS = Object.keys(VEHICLES);
// Six of the vehicles are bought with coins (VEHICLES[id].price). You can put a locked one on the stand to look at it
// and read its stats (`preview`): PLAY becomes UNLOCK with its price, and it isn't yours to race until you've paid.
let preview = null;
// The card of the car you'll race wears a ribbon (an orange strip down its side and a YOUR CAR tag), the way games mark
// what's equipped. When that changes (you pick another, unlock one, or save its new look) the ribbon plays in: `marked`
// is the car it was last drawn on, `cheer` asks for the animation even when the car is the same (a saved look).
let marked = null,
  cheer = false;
const hasVeh = id => !VEHICLES[id].price || store.get('owned', []).includes('veh:' + id);
export function paintBadge() {
  const n = newCars().length,
    b = $('#garageBadge');
  b.textContent = n;
  b.hidden = !n;
}
// cars you can afford now but haven't been to see: a red number on the GARAGE tile at home (src/home.js), gone once
// you've opened the garage
export const newCars = () =>
  VKEYS.filter(
    id => !hasVeh(id) && VEHICLES[id].price <= store.get('wallet', 0) && !store.get('seenAfford', []).includes(id),
  );
const shown = () => preview || game.vehicle;
// a line across the garage when something can't be done (not enough coins): big enough to read, gone in a moment
let toastT = 0;
// (later: after the car on the stand has had its moment, so the words never cover it)
const toastLater = (msg, sub, ms = 1250) => {
  clearTimeout(toastT);
  toastT = setTimeout(() => toast(msg, sub), ms);
};
function toast(msg, sub = '') {
  let el = $('#gToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gToast';
    el.setAttribute('role', 'status');
    $('#garage').append(el);
  }
  el.innerHTML = `<b>${msg}</b>${sub ? `<span>${sub}</span>` : ''}`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2400);
}
const short = (need, have) =>
  toast('NOT ENOUGH COINS', `<i class="coin-icon"></i>${(need - have).toLocaleString('en')} more to go`);
export function renderGarage() {
  const v = VEHICLES[shown()],
    st = VSTATS[shown()];
  $('#tiles').innerHTML = VKEYS.map(
    id =>
      `<button class="tile${id === shown() ? ' on' : ''}${hasVeh(id) ? '' : ' locked'}${id === game.vehicle ? ' mine' : ''}${id === game.vehicle && (cheer || (marked && marked !== id)) ? ' just' : ''}" data-veh="${id}"${id === game.vehicle ? ' aria-current="true"' : ''}><span class="n">${VEHICLES[id].name.toUpperCase()}</span><img src="${game.THUMBS[id] || ''}" alt="">${hasVeh(id) ? '' : `<span class="tp"><i class="coin-icon"></i>${VEHICLES[id].price.toLocaleString('en')}</span>`}${id === game.vehicle ? '<i class="rb"></i><span class="yc">YOUR CAR</span>' : ''}</button>`,
  ).join('');
  marked = game.vehicle;
  cheer = false;
  {
    // the big button: PLAY your own vehicle, or UNLOCK the one on the stand for its price
    const gp = $('#gPlay'),
      sub = gp.querySelector('small');
    if (preview) {
      gp.disabled = false;
      gp.querySelector('span').textContent = 'UNLOCK';
      sub.innerHTML = `<i class="coin-icon"></i>${v.price.toLocaleString('en')}`;
      sub.hidden = false;
    } else if (gp.querySelector('span').textContent === 'UNLOCK') {
      gp.querySelector('span').textContent = 'PLAY';
      sub.hidden = true;
    }
    gp.classList.toggle('unlock', !!preview);
    $('#custOpen').disabled = !!preview;
  }
  {
    // the row scrolls sideways: keep the chosen vehicle's card in view (without moving the page)
    const row = $('#tiles'),
      on = row.querySelector('.tile.on');
    if (on) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
  }
  // each stat, and the part your upgrades add to it (gold, at the end of the bar): the Turbo Kit's speed, Grip's grip
  const up = new Set(store.get('upgrades', [])),
    turbo = up.has('turbo') ? 1.05 : 1,
    grip = up.has('grip') ? 1.08 : 1;
  const rows = [
    ['SPEED', (st.top - 0.6) * 2, (st.top * turbo - 0.6) * 2],
    ['ACCEL', (st.acc - 0.8) * 3],
    ['GRIP', (st.turn - 0.6) * 2, (st.turn * grip - 0.6) * 2],
    ['OFF-ROAD', st.off],
    ['WEIGHT', st.mass / 2],
  ];
  $('#gStats').innerHTML = rows
    .map(([a, x, withUp = x]) => {
      const pc = Math.round(clamp(x, 0.05, 1) * 100),
        all = Math.round(clamp(withUp, 0.05, 1) * 100);
      return `<dt>${a}</dt><dd><div class="stripebar thin"><i style="width:${pc}%"></i><u style="left:${pc}%;width:${all - pc}%"></u></div></dd><span class="pc">${all}%</span>`;
    })
    .join('');
  $('#gUpLegend').hidden = !(up.has('turbo') || up.has('grip'));
  renderCollection();
  $('#gName').textContent = v.name.toUpperCase();
  {
    // the home screen's GARAGE tile shows the car you race (not one on the stand you're only looking at), in its own
    // saved paint, so you can see at a glance which car you're using (public/tile-garage.png until the pictures are made)
    const mine = VEHICLES[game.vehicle];
    $('#garageBtn').setAttribute('aria-label', `Open the garage, ${mine.name}`);
    $('#garageCar').textContent = mine.name.toUpperCase(); // (its name on a ribbon across the corner)
    if (game.THUMBS?.[game.vehicle]) $('#garageThumb').src = game.THUMBS[game.vehicle];
  }
  renderCustom();
  $('#gWallet').textContent = store.get('wallet', 0).toLocaleString('en');
}
// the collection: the five upgrades, the ones you've won with their pictures and what they do, the rest still to come
// in a chest; how many you have, and how near the next chest is
function renderCollection() {
  const up = store.get('upgrades', []),
    next = nextMilestone(),
    got = earned(),
    prev = [0, ...MILESTONES].filter(m => m <= got).at(-1) ?? 0;
  $('#gCollN').textContent = `${up.length}/${UPGRADES.length}`;
  $('#gColl').innerHTML =
    `<div class="gc-head"><div class="tag"><span>COLLECTION</span><i></i><i></i></div><b class="gc-n"><em>${up.length}</em> / ${UPGRADES.length}</b></div>` +
    `<div class="gc-grid">${UPGRADES.map(
      u =>
        up.includes(u.id)
          ? `<div class="gc-up got"><img src="/upgrades/${u.id}.jpg" alt=""><b>${u.name}</b><span>${u.short}</span></div>`
          : `<div class="gc-up"><img src="/upgrades/${u.id}.jpg" alt=""><i class="gc-lock"></i><b>${u.name}</b></div>`, // (what you're missing: its picture, locked)
    ).join('')}</div>` +
    (next
      ? `<div class="gc-next"><span>NEXT CHEST</span><div class="gc-bar"><i style="width:${Math.round(((got - prev) / (next - prev)) * 100)}%"></i></div><b>${got.toLocaleString('en')} / ${next.toLocaleString('en')}</b></div>`
      : `<div class="gc-next"><span>EVERY UPGRADE WON</span></div>`) +
    `<button class="btn gc-close">CLOSE</button>`; // (a phone: the pause menu's kind of button, full width)
}
// your vehicle's paint, wheels and tyres, bought with coins
// (a vehicle wears the plate of the city it's in until you fit another)
export const custom = id => ({
  ...DEFAULT_CUSTOM[id],
  plate: chapter.id === 'doha' ? 'doha' : 'kano',
  ...store.get('custom.' + id, {}),
});
const owned = () => store.get('owned', []);
// a part bought is bought for one car: its paint, decals, wheels, tyres and nitro are that car's alone ('paint:#d4a12a@kart').
// Number plates are a collection: one bought is yours for every car ('plate:gold')
const partKey = (tab, v, id = game.vehicle) => (tab === 'plate' ? `plate:${v}` : `${tab}:${v}@${id}`);
// a vehicle's factory part is always its own, even when that part costs coins in the shop (the Muscle's Midnight paint)
const isFactory = (id, tab, v) => DEFAULT_CUSTOM[id]?.[tab] === v;
let custTab = 'paint', // (the vehicle itself is chosen in the garage's own row of cards, not here)
  draft = null;
const TABS = [
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
  game.PTH ||= partThumbs();
  const saved = custom(game.vehicle),
    own = owned();
  document.querySelectorAll('#custTabs [data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === custTab));
  $('#custTitle').textContent = TABS.find(t => t[0] === custTab)[1];
  $('#custList').innerHTML = PARTS[custTab]
    .map(([v, name, price]) => {
      const has = !price || own.includes(partKey(custTab, v)) || isFactory(game.vehicle, custTab, v),
        pic = tilePic(custTab, v);
      const face =
        custTab === 'plate'
          ? `<i class="pv plate" style="background-image:url(${pic})"></i>`
          : custTab === 'decal'
            ? `<i class="pv" style="background-image:url(${pic})"></i>`
            : `<img src="${pic}" alt="">`;
      return `<button class="tile2 ${saved[custTab] === v ? 'worn' : ''} ${draft[custTab] === v ? 'sel' : ''} ${has ? '' : 'locked'}" data-part="${v}" aria-label="${name}">${face}${has ? '' : `<span class="tp"><i class="coin-icon"></i>${price.toLocaleString('en')}</span>`}<span class="tl">${name}</span></button>`;
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
    if (it && it[2] && !own.includes(partKey(tab, it[0])) && !isFactory(game.vehicle, tab, it[0])) {
      c += it[2];
      items.push(partKey(tab, it[0]));
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
  if (id === shown()) return;
  const dir = VKEYS.indexOf(id) > VKEYS.indexOf(shown()) ? -1 : 1;
  if (hasVeh(id)) {
    preview = null;
    game.vehicle = id;
    store.set('veh', game.vehicle);
    game.race.setVehicle(game.vehicle, custom(game.vehicle));
  } else preview = id; // a locked one: on the stand to look at, not yours yet
  game.garage.setVehicle(id, dir, custom(id));
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
const roomOf = id => (id === 'doha' ? 'workshop' : id === 'singapore' ? 'studio' : 'navy');
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
  // parts became each car's own (2026-11-14): a part bought under the old rule (for every car) stays bought on every
  // car that's wearing it; plates stay everyone's. Once
  if (!store.get('perCarParts', false)) {
    const own = owned(),
      next = own.filter(o => o.startsWith('veh:') || o.startsWith('plate:') || o.includes('@'));
    for (const o of own) {
      if (next.includes(o)) continue;
      const [tab, v] = o.split(':');
      for (const id of Object.keys(DEFAULT_CUSTOM))
        if (store.get('custom.' + id, {})[tab] === v) next.push(`${tab}:${v}@${id}`);
    }
    // and whatever each car is wearing now is its own (a paint that was free when it was fitted is never charged for)
    for (const id of Object.keys(DEFAULT_CUSTOM)) {
      const saved = store.get('custom.' + id, null);
      if (saved) for (const [tab, v] of Object.entries(saved)) if (PARTS[tab]) next.push(partKey(tab, v, id));
    }
    store.set('owned', [...new Set(next)]);
    store.set('perCarParts', true);
  }
  // six vehicles are bought with coins, for everyone: a saved choice that's now locked goes back to the Kart
  if (!hasVeh(game.vehicle)) {
    game.vehicle = 'kart';
    store.set('veh', 'kart');
  }
  // decals that left the shop (Arewa Knot, Star): take them off every vehicle and refund anyone who bought them, once
  for (const [key, part, price, kind = 'decal'] of [
    ['knotRetired', 'knot', 400],
    ['starRetired', 'star', 350],
    // (the decals became side graphics, and the plates one for each city)
    ['tigerRetired', 'tiger', 300],
    ['starknotRetired', 'starknot', 350],
    ['loopknotRetired', 'loopknot', 350],
    ['bandRetired', 'band', 300],
    ['hornsRetired', 'horns', 400],
    ['silverPlateRetired', 'silver', 150, 'plate'],
    ['midnightPlateRetired', 'midnight', 200, 'plate'],
    ['naijaPlateRetired', 'naija', 250, 'plate'],
    ['buddyPlateRetired', 'buddy', 250, 'plate'],
  ])
    if (!store.get(key, false)) {
      for (const id of Object.keys(DEFAULT_CUSTOM)) {
        const c = store.get('custom.' + id, null);
        if (c?.[kind] === part) {
          delete c[kind];
          store.set('custom.' + id, c);
        }
      }
      const own = owned();
      if (own.includes(kind + ':' + part)) {
        store.set(
          'owned',
          own.filter(o => o !== kind + ':' + part),
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
    const b = e.target.closest('[data-part]');
    if (!b) return;
    draft[custTab] = b.dataset.part;
    game.garage.setVehicle(game.vehicle, 0, draft);
    game.garage.focus(custTab);
    renderCustom(); // picking a part closes in on it
    const { c } = costOf(draft);
    $('#custSave').textContent = c ? `SAVE ${c.toLocaleString('en')}` : 'SAVE';
  });
  $('#custCancel').addEventListener('click', () => {
    $('#custSave').textContent = 'SAVE';
    closeCustom();
  });
  $('#custSave').addEventListener('click', () => {
    const { c, items } = costOf(draft),
      w = store.get('wallet', 0);
    if (c > w) {
      $('#custTitle').textContent = `NEED ${(c - w).toLocaleString('en')} MORE COINS`;
      short(c, w);
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
      cheer = true; // its card plays the ribbon in again: saved, and this is the car you race
      renderGarage();
    }
    $('#custSave').textContent = 'SAVE';
    closeCustom();
    game.garage.celebrate(true); // the car shows off its new look: a spin and a few sparks
    toastLater(`${VEHICLES[game.vehicle].name.toUpperCase()} SAVED`, 'Ready to race');
  });
  $('#tiles').addEventListener('click', e => {
    const b = e.target.closest('[data-veh]');
    if (b) pickVehicle(b.dataset.veh);
  });
  $('#gPrev').addEventListener('click', () =>
    pickVehicle(VKEYS[(VKEYS.indexOf(shown()) + VKEYS.length - 1) % VKEYS.length]),
  );
  $('#gNext').addEventListener('click', () => pickVehicle(VKEYS[(VKEYS.indexOf(shown()) + 1) % VKEYS.length]));
  // the message goes the moment you do anything else (pick another car, a part, a tab): any tap in the garage clears
  // it first, before that tap's own handler runs (which may put up a new one)
  $('#garage').addEventListener(
    'click',
    () => {
      clearTimeout(toastT);
      $('#gToast')?.classList.remove('on');
    },
    true,
  );
  // into the garage: the roller door lifts and the camera glides in; the controls show once you're inside
  $('#garageBtn').addEventListener('click', () => {
    Sound.init();
    store.set('seenAfford', [...store.get('seenAfford', []), ...newCars()]);
    paintBadge();
    $('#menu').hidden = true;
    openGarage();
  });
  // (a phone: the collection opens over the garage from its button, and closes from its CLOSE button or a tap outside)
  $('#gCollBtn').addEventListener('click', () => $('#garage').classList.toggle('coll-open'));
  $('#gColl').addEventListener('click', e => {
    if (e.target.closest('.gc-close')) $('#garage').classList.remove('coll-open');
  });
  // a tap anywhere outside it closes it (the garage behind is dimmed and out of reach while it's open)
  $('#garage').addEventListener(
    'click',
    e => {
      if (!$('#garage').classList.contains('coll-open') || e.target.closest('#gColl, #gCollBtn')) return;
      $('#garage').classList.remove('coll-open');
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  $('#gLights').addEventListener('click', () => {
    const on = !game.garage.lightsOn;
    game.garage.setLights(on);
    store.set(LIGHTS_KEY(), on);
    $('#gLights').classList.toggle('on', on);
  });
  $('#gBack').addEventListener('click', () => {
    if (preview) {
      preview = null; // (a locked vehicle you were looking at goes back; yours is on the stand next time)
      game.garage.setVehicle(game.vehicle, 0, custom(game.vehicle));
      renderGarage();
    }
    $('#garage').hidden = true;
    game.state = 'menu';
    renderChapter();
    show($('#menu'), -1);
  });
  // the garage's big button races (pick it, dress it, go); customising is the button above it
  $('#custOpen').addEventListener('click', openCustom);
  $('#gPlay').addEventListener('click', () => {
    if (preview) {
      // UNLOCK: pay for the vehicle on the stand, and it's yours and chosen
      const price = VEHICLES[preview].price,
        w = store.get('wallet', 0);
      if (price > w) {
        short(price, w);
        return Feedback.say('deny');
      }
      store.set('wallet', w - price);
      store.set('owned', [...owned(), 'veh:' + preview]);
      Feedback.say('buy');
      const id = preview;
      preview = null;
      game.vehicle = id;
      store.set('veh', id);
      game.race.setVehicle(id, custom(id));
      renderChapter();
      cheer = true;
      renderGarage();
      game.garage.celebrate(); // it hops, spins once and throws sparks
      Sound.unlock(); // and a fanfare
      toastLater(`${VEHICLES[id].name.toUpperCase()} UNLOCKED`, 'This is your car now');
      return;
    }
    if (!CHAPTERS[game.chIndex].playable) return Feedback.say('deny');
    if (travelTo(CHAPTERS[game.chIndex].id, 'modes')) return;
    Sound.init();
    screenOut($('#garage'));
    openModes('garage');
  });
}
