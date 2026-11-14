// The race HUD: position, lap, coins, the weapon slot, toasts and banners, the speed gauge, the minimap, and the events the
// race raises to drive them (src/race.js calls these).
import { Haptics } from './haptics.js';
import * as THREE from 'three';
import { LAPS, WEAPONS } from './race.js';
import { Sound } from './audio.js';
import { clamp, store, fmtTime, ordinal } from './util.js';
import { $, show, hide } from './dom.js';
import { cam } from './scene.js';
import { TT } from './timetrial.js';
import { showResults } from './results.js';
import { showPodium } from './podium.js';
import { game } from './game.js';

export const hud = {
  pos: $('#pos'),
  posSfx: $('#posSfx'),
  lap: $('#lap'),
  coins: $('#coins'),
  kos: $('#kos'),
  timer: $('#timer'),
  score: $('#score'),
  combo: $('#combo'),
  weapon: $('#weapon'),
  wicon: $('#wicon'),
  wname: $('#wname'),
  wammo: $('#wammo'),
  center: $('#center'),
  wrong: $('#wrong'),
  toasts: $('#toasts'),
  map: $('#minimap'),
  speed: $('#speed'),
  lines: $('#speedlines'),
  prog: $('#progFill'),
  racers: $('#progRacers'),
};
export const ICONS = {
  blaster:
    '<svg viewBox="0 0 48 48"><path d="M6 20h26l6-4h4v16h-4l-6-4H6z" fill="currentColor"/><path d="M12 28v8h8l2-8" fill="currentColor" opacity=".7"/></svg>',
  rocket:
    '<svg viewBox="0 0 48 48"><path d="M8 24l10-8h18c4 0 6 4 6 8s-2 8-6 8H18z" fill="currentColor"/><path d="M8 24l-4-6v12z" fill="#ffc400"/></svg>',
  shock:
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 10l-8 16h8l-4 12 10-18h-8z" fill="currentColor"/></svg>',
  mines:
    '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="30" rx="16" ry="6" fill="currentColor"/><path d="M8 30v-4c0-4 7-7 16-7s16 3 16 7v4" fill="currentColor" opacity=".8"/><circle cx="24" cy="17" r="3" fill="#ff2b2b"/></svg>',
  yaji: '<svg viewBox="0 0 48 48"><path d="M30 10c4-4 9-3 10 1" stroke="#7bd36a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M32 14c6 6 2 18-8 24S6 42 8 38s14-6 18-14 2-12 6-10z" fill="currentColor"/></svg>',
  shield:
    '<svg viewBox="0 0 48 48"><path d="M24 5l16 6v11c0 10-7 18-16 21C15 40 8 32 8 22V11z" fill="currentColor"/><path d="M24 12l9 3.5v6.8c0 6-4 10.8-9 12.7z" fill="#fff" opacity=".45"/></svg>',
};

export function setWeapon(w, ammo, rolling) {
  game.rollingIcon = rolling;
  hud.weapon.classList.toggle('empty', !w && !rolling);
  hud.weapon.classList.toggle('rolling', rolling);
  if (rolling) {
    hud.wname.textContent = 'LOADING';
    hud.wammo.textContent = '';
    return;
  }
  hud.wicon.innerHTML = w ? ICONS[w] : '';
  hud.wicon.style.color = w ? WEAPONS[w].color : '';
  hud.wname.textContent = w ? WEAPONS[w].name.toUpperCase() : 'NO WEAPON';
  hud.wammo.textContent = w ? `×${ammo}` : '';
}
function toast(label, pts) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = pts ? `<span>${label}</span><b>+${pts}</b>` : `<span>${label}</span>`;
  hud.toasts.prepend(el);
  setTimeout(() => el.remove(), 1700);
  while (hud.toasts.children.length > 3) hud.toasts.lastChild.remove();
}
let centerTimer = 0;
export function banner(text, kind = '', ms = 1200) {
  hud.center.className = 'center ' + kind;
  hud.center.innerHTML = `<span class="pop">${text}</span>`;
  clearTimeout(centerTimer);
  if (ms)
    centerTimer = setTimeout(() => {
      hud.center.innerHTML = '';
    }, ms);
}
export const events = {
  score(total, combo, label, got) {
    hud.score.textContent = total.toLocaleString('en');
    hud.combo.textContent = combo >= 2 ? `×${combo}` : '';
    if (label && label !== 'Coin' && label !== 'Crate' && label !== 'Hit') toast(label, got);
  },
  weapon: setWeapon,
  coins(n, at) {
    if (at) {
      flyCoin(at);
      Haptics.coin();
    } else hud.coins.textContent = n;
  },
  lap(n) {
    hud.lap.textContent = game.mode === 'free' ? n : `${n}/${LAPS}`;
    banner(game.mode !== 'free' && n === LAPS ? 'FINAL LAP' : `LAP ${n}`, 'small');
    Sound.beep(true);
    Haptics.big();
  },
  // Time trial: every time over the line closes a lap; a new best lap becomes the ghost you chase
  cross(lap, t) {
    if (game.mode !== 'tt' || lap <= TT.last) return;
    if (TT.last >= 0) {
      const lt = t - TT.start,
        best = store.get('bestlap.' + game.RID, null);
      TT.laps.push(lt);
      if (!best || lt < best) {
        TT.newBest = true;
        store.set('bestlap.' + game.RID, lt);
        TT.ghost = { d: lt, s: TT.rec };
        store.set('ghost.' + game.RID, TT.ghost);
        setTimeout(() => banner('BEST LAP', 'ko', 1100), 900);
        Haptics.big();
      }
      toast(`Lap ${TT.laps.length}  ${fmtTime(lt)}`);
    }
    TT.last = lap;
    TT.start = t;
    TT.rec = [];
    TT.recT = 0;
  },
  finish() {
    game.state = 'finish';
    game.finishAt = game.clock;
    Sound.beep(true);
    Haptics.big();
    hide($('#hud'));
    const p = game.race.player,
      el = $('#youCame');
    el.innerHTML =
      game.mode === 'tt'
        ? `<span>${TT.newBest ? 'NEW BEST LAP' : 'YOUR TIME'}</span><b class="tm">${fmtTime(TT.laps.reduce((a, b) => a + b, 0))}</b>`
        : `<span>YOU CAME</span><b>${p.rank}<em>${ordinal(p.rank)}</em></b>`;
    // first a moment of Buddy himself: the finish camera on him celebrating (or let down) in his seat, nothing on the
    // screen; then YOU CAME 1ST over it
    let shown = false;
    const showPlace = () => {
      if (shown || game.state !== 'finish') return;
      shown = true;
      show(el);
    };
    setTimeout(showPlace, 1500);
    // Buddy celebrates in his seat: pops up and spins, a backflip, then cheers
    const moves =
      p.rank === 1
        ? [
            ['flip', 1.15],
            ['pop', 0.9],
            ['flip', 1.15],
            ['cheer', 9],
          ]
        : p.rank <= 3
          ? [
              ['pop', 0.9],
              ['flip', 1.15],
              ['cheer', 9],
            ]
          : [['sad', 9]];
    el.classList.toggle('low', p.rank > 3);
    let t = 0;
    for (const [m, d] of moves) {
      setTimeout(() => {
        p.move = null;
        p.moveT = 0;
        game.race.act(p, m, d);
        if (m === 'flip') {
          p.move = 'flip';
        }
      }, t * 1000);
      t += Math.min(d, 1.2);
    }
    // then (on the Final) the podium, and the results card in over it about two and a half seconds later (the podium
    // keeps celebrating behind it); any other race, the results. A tap skips ahead at any step
    const toPodium = () => {
      if (game.state !== 'finish') return;
      if (shown) hide(el, null, -1);
      // the podium is for the World Tour's Final; any other race goes straight to the results, the camera following
      // your kart on as it drives away behind them (src/camera.js)
      if (game.mode === 'tt' || !game.final) return showResults();
      game.state = 'podium';
      // top three: the podium, you in it wearing YOU; further back: just you, let down
      const rk = game.race.rank(),
        me = game.race.player;
      showPodium(rk, me.rank <= 3 ? {} : { solo: me });
      setTimeout(() => {
        if (game.state === 'podium') showResults();
      }, 2600);
    };
    const tap = () => {
      if (game.state === 'finish' && !shown) showPlace();
      else if (game.state === 'finish') toPodium();
      else if (game.state === 'podium') showResults();
      if (game.state === 'finish' || game.state === 'podium') addEventListener('pointerdown', tap, { once: true });
    };
    setTimeout(() => addEventListener('pointerdown', tap, { once: true }), 300); // (not the tap that was still held)
    setTimeout(toPodium, 3100); // (1.5 s of Buddy, 1.6 s of YOU CAME 1ST)
  },
  takedown(name, n) {
    hud.kos.textContent = n;
    banner('TAKEDOWN', 'ko', 900);
  },
  flash(text) {
    banner(text.toUpperCase(), 'ko', 700);
  },
  toast,
  hurt() {
    Haptics.hit();
  },
  shield() {
    Haptics.boost();
  },
  // fire mode: the HEAT meter fills as you chain moves; full, you're ON FIRE
  heat(v) {
    $('#heatFill').style.transform = `scaleX(${Math.max(0, Math.min(1, v)).toFixed(3)})`;
    $('#heat').classList.toggle('warm', v > 0.6);
  },
  fire(on) {
    document.body.classList.toggle('onfire', on);
    if (on) {
      banner('ON FIRE', 'ko', 1500);
      Haptics.big();
    } else toast('Cooled off');
  },
  nitro(v) {
    $('#nLiq').style.transform = `translateY(${(46 * (1 - Math.max(0, Math.min(1, v)))).toFixed(1)}px)`;
    $('#nitroBtn').classList.toggle('ready', v >= 0.3);
  },
};

// the race running behind the home screen raises the same events; nobody needs to hear them
export const QUIET = {
  score() {},
  weapon() {},
  coins() {},
  lap() {},
  finish() {},
  takedown() {},
  flash() {},
  toast() {},
  hurt() {},
  shield() {},
  heat() {},
  fire() {},
  nitro() {},
};
// the round speed gauge: its arc fills with speed and glows orange on a boost
const gArc = $('#gArc'),
  speedoEl = document.querySelector('.speedo'),
  GLEN = 245;
export function gauge(kmh, boost) {
  gArc.style.strokeDashoffset = (GLEN * (1 - clamp(kmh / 320, 0, 1))).toFixed(1);
  speedoEl.classList.toggle('boost', boost);
}
// a picked-up coin flies from where it was on the road up into the counter
function flyCoin(world) {
  const v = new THREE.Vector3().copy(world).project(cam),
    x = (v.x * 0.5 + 0.5) * innerWidth,
    y = (-v.y * 0.5 + 0.5) * innerHeight;
  const to = $('#coinChip .coin-icon').getBoundingClientRect(),
    el = document.createElement('i');
  el.className = 'coin-icon flycoin';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.append(el);
  requestAnimationFrame(() => {
    el.style.transform = `translate(${to.left + to.width / 2 - x}px, ${to.top + to.height / 2 - y}px) scale(.8)`;
  });
  setTimeout(() => {
    el.remove();
    hud.coins.textContent = game.race.player.coins;
    const c = $('#coinChip');
    c.classList.remove('bump');
    void c.offsetWidth;
    c.classList.add('bump');
  }, 560);
}

// ---- the minimap
let mapTf = null;
export function drawMap() {
  const c = hud.map,
    x = c.getContext('2d'),
    w = c.width;
  if (!game.mapPts) {
    const b = game.track.box,
      s = (w - 40) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    mapTf = (px, pz) => [w / 2 - (px - (b.min.x + b.max.x) / 2) * s, w / 2 - (pz - (b.min.z + b.max.z) / 2) * s];
    game.mapPts = game.track.P.map((p, i) => [
      ...mapTf(p.x, p.z),
      game.track.closed && game.track.closed[i] ? 99 : p.y,
    ]);
  }
  x.clearRect(0, 0, w, w);
  x.lineJoin = x.lineCap = 'round';
  const path = filter => {
    x.beginPath();
    let on = false;
    game.mapPts.forEach(([a, b, y]) => {
      const ok = filter(y);
      if (ok && on) x.lineTo(a, b);
      else if (ok) x.moveTo(a, b);
      on = ok;
    });
  };
  // ground first, then the flyover over it
  path(y => (y < 3 || y === 99 ? y !== 99 && y < 3 : false));
  x.strokeStyle = 'rgba(8,14,40,.65)';
  x.lineWidth = 18;
  x.stroke();
  x.strokeStyle = 'rgba(244,247,255,.92)';
  x.lineWidth = 8;
  x.stroke();
  path(y => y >= 3);
  x.strokeStyle = 'rgba(8,14,40,.65)';
  x.lineWidth = 20;
  x.stroke();
  x.strokeStyle = '#6fd3ff';
  x.lineWidth = 8;
  x.stroke();
  path(y => y < -6);
  x.setLineDash([6, 6]);
  x.strokeStyle = '#ff6a00';
  x.lineWidth = 6;
  x.stroke();
  x.setLineDash([]); // the underpass
  for (const f of game.track.forks || []) {
    x.beginPath();
    f.P.forEach((q, i) => {
      const [a2, b2] = mapTf(q.x, q.z);
      i ? x.lineTo(a2, b2) : x.moveTo(a2, b2);
    });
    x.setLineDash(f.tunnel ? [5, 5] : []);
    x.strokeStyle = f.tunnel ? '#ff6a00' : 'rgba(244,247,255,.92)';
    x.lineWidth = 6;
    x.stroke();
    x.setLineDash([]);
  }
  const [sx, sy] = game.mapPts[0];
  x.fillStyle = '#ff6a00';
  x.fillRect(sx - 9, sy - 3, 18, 6);
  for (const k of [...game.race.karts].reverse()) {
    const p = k.m.root.position,
      [a, b] = mapTf(p.x, p.z),
      me = k === game.race.player;
    x.beginPath();
    x.arc(a, b, me ? 11 : 7.5, 0, Math.PI * 2);
    x.fillStyle = k.color;
    x.fill();
    x.lineWidth = me ? 4 : 2.5;
    x.strokeStyle = me ? '#ffffff' : '#0b1330';
    x.stroke();
  }
}
