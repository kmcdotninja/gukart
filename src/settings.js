// The settings card (volume, engine sound, steering, vibration) and the controls card.
import { Music } from './music.js';
import { Haptics } from './haptics.js';
import { Tilt } from './tilt.js';
import { Sound, engineMode } from './audio.js';
import { isTouch, store } from './util.js';
import { $, show, swap, hide } from './dom.js';
import { paintSound } from './home.js';
import { game } from './game.js';

// wire up this screen's buttons and listeners (called once, from main.js)
export function initSettings() {
  // the controls card: a picture of your own controls. On a phone, the race screen with its buttons where they really
  // are, each named (or the phone tilting, with tilt steering on); on a keyboard, the keys you use, lit and named.
  // Under it, how to drift, the thing people ask about most
  paintControls();
  $('#ctrlBtn')?.addEventListener('click', paintControls);
  $('#setCtrl')?.addEventListener('click', () => {
    paintControls();
    $('#settings').hidden = true;
    $('#controls').hidden = false;
    $('#controls').dataset.from = 'settings';
  });
  // settings: master volume, engine volume, which engine sound, vibration. From home it returns home; from pause, to pause
  {
    let from = null;
    const pct = v => Math.round(v * 100) + '%',
      fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    const paint = () => {
      const v = $('#setVol'),
        e = $('#setEng'),
        mu = $('#setMus');
      mu.value = Music.vol;
      fill(mu);
      $('#setMusO').textContent = pct(Music.vol);
      v.value = Sound.vol;
      e.value = Sound.engVol;
      fill(v);
      fill(e);
      $('#setVolO').textContent = pct(Sound.vol);
      $('#setEngO').textContent = pct(Sound.engVol);
      const m = engineMode();
      document.querySelectorAll('#setMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      document
        .querySelectorAll('#setHap button')
        .forEach(b => b.classList.toggle('on', (b.dataset.h === '1') === Haptics.on));
      document.querySelectorAll('#setSteer button').forEach(b => b.classList.toggle('on', b.dataset.s === Tilt.mode));
      $('#setSteerRow').hidden = !isTouch;
      document.querySelectorAll('#setView button').forEach(b => b.classList.toggle('on', b.dataset.v === game.view));
    };
    const open = src => {
      Sound.init();
      from = src;
      paint();
      $('#setSchool').hidden = src.id !== 'menu'; // (the Driving School is started from home, not mid-race)
      if (src.id === 'pause') swap(src, $('#settings'), 1);
      else {
        hide(src);
        show($('#settings'), 1);
      }
    };
    $('#setBtn').addEventListener('click', () => open($('#menu')));
    $('#setBtn2').addEventListener('click', () => open($('#pause')));
    $('#setBack').addEventListener('click', () => {
      const to = from || $('#menu');
      if (to.id === 'pause') swap($('#settings'), to, -1);
      else {
        hide($('#settings'));
        show(to, -1);
      }
    });
    $('#setVol').addEventListener('input', e => {
      Sound.setVolume(+e.target.value);
      if (!Sound.on && +e.target.value > 0) {
        Sound.toggle();
        paintSound();
      }
      paint();
    });
    $('#setMus').addEventListener('input', e => {
      Music.setVolume(+e.target.value);
      paint();
    });
    $('#setEng').addEventListener('input', e => {
      Sound.setEngineVolume(+e.target.value);
      paint();
    });
    $('#setMode').addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      Sound.setEngineMode(b.dataset.m);
      paint();
      Sound.drive({ type: game.vehicle, speed: 0.35, throttle: 1, running: true }, 0.016);
      setTimeout(() => {
        if (game.state !== 'race') Sound.drive({ type: game.vehicle, speed: 0, throttle: 0, running: false });
      }, 700);
    }); // a short rev to hear it
    // steering: the arrows, or tilting the phone. If tilt can't work here it says why and stays on the arrows
    $('#setSteer').addEventListener('click', async e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const why = await Tilt.set(b.dataset.s),
        note = $('#setSteerNote');
      note.textContent = why;
      note.hidden = !why;
      if (why) await Tilt.set('buttons');
      paint();
    });
    // the race camera: behind the kart, or first person from the driver's seat
    $('#setView').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      game.view = b.dataset.v;
      store.set('view', game.view);
      paint();
    });
    $('#setHap').addEventListener('click', e => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      Haptics.on = b.dataset.h === '1';
      store.set('haptics', Haptics.on);
      paint();
    });
  }
}

// the picture on the controls card (see initSettings)
export function paintControls() {
  const O = '#ff6a00',
    INK = '#f4f7ff',
    DIM = 'rgba(244,247,255,.35)',
    F = `font-family="Barlow Condensed, Arial Narrow, sans-serif" font-style="italic" font-weight="800"`;
  const label = (x, y, t, anchor = 'middle', size = 22) =>
    `<text x="${x}" y="${y}" ${F} font-size="${size}" fill="${INK}" text-anchor="${anchor}">${t}</text>`;
  const arrow = (cx, cy, dir) =>
    `<path d="M${cx - dir * 6} ${cy - 12}l${dir * 12} 12l${-dir * 12} 12" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  let pic;
  if (isTouch && Tilt.on) {
    // the phone tilting left and right, the road turning with it
    pic = `<svg viewBox="0 0 360 300" class="ctrl-svg" role="img" aria-label="Tilt the phone to steer">
      <g transform="translate(180 150) rotate(-14)"><rect x="-56" y="-100" width="112" height="200" rx="18" fill="none" stroke="${INK}" stroke-width="4"/>
      <path d="M-30 80 L-8 -60 L8 -60 L30 80 Z" fill="${DIM}"/></g>
      <path d="M70 70 a120 120 0 0 0 0 160" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M290 70 a120 120 0 0 1 0 160" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${label(180, 290, 'TILT TO STEER', 'middle', 26)}</svg>`;
  } else if (isTouch) {
    // the race screen: the arrows low in each corner, FIRE over the left one, nitro over the right (phones have no brake)
    const btn = (x, y, w, h, inner, name, lx, ly, anchor) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="rgba(11,19,48,.75)" stroke="${O}" stroke-width="3"/>${inner}${label(lx, ly, name, anchor)}`;
    pic = `<svg viewBox="0 0 360 560" class="ctrl-svg" role="img" aria-label="The race screen's buttons">
      <rect x="6" y="6" width="348" height="548" rx="34" fill="rgba(255,255,255,.04)" stroke="${DIM}" stroke-width="3"/>
      <path d="M120 540 L168 150 L192 150 L240 540 Z" fill="rgba(255,255,255,.07)"/>
      ${btn(22, 456, 80, 80, arrow(62, 496, -1), '', 0, 0)}
      ${btn(258, 456, 80, 80, arrow(298, 496, 1), '', 0, 0)}
      ${label(180, 504, 'STEER', 'middle', 26)}
      <path d="M108 496 L132 496 M252 496 L228 496" stroke="${INK}" stroke-width="2"/>
      ${btn(22, 360, 76, 76, `<text x="60" y="406" ${F} font-size="20" fill="${INK}" text-anchor="middle">FIRE</text>`, '', 108, 404, 'start')}
      ${btn(262, 360, 76, 76, `<rect x="291" y="374" width="18" height="48" rx="7" fill="${INK}" opacity=".85"/>`, 'NITRO', 252, 404, 'end')}
    </svg>`;
  } else {
    // the keys: the arrows (nitro, brake, steer), Space (drift, and tricks in the air), F (fire), P (pause)
    const key = (x, y, w, t, on = true) =>
      `<rect x="${x}" y="${y}" width="${w}" height="54" rx="9" fill="${on ? O : 'rgba(255,255,255,.08)'}" stroke="${on ? O : DIM}" stroke-width="2"/>${t}`;
    const cap = (x, y, w, s) =>
      `<text x="${x + w / 2}" y="${y + 36}" ${F} font-size="24" fill="${INK}" text-anchor="middle">${s}</text>`;
    pic = `<svg viewBox="0 0 520 300" class="ctrl-svg" role="img" aria-label="The keys">
      ${key(20, 30, 58, cap(20, 30, 58, 'F'))}${label(49, 112, 'FIRE')}
      ${key(98, 30, 58, cap(98, 30, 58, 'P'))}${label(127, 112, 'PAUSE')}
      ${key(20, 150, 236, cap(20, 150, 236, 'SPACE'))}${label(138, 232, 'DRIFT')}${label(138, 258, 'TRICK IN THE AIR', 'middle', 16)}
      ${key(380, 30, 58, `<path d="M397 70 l12 -14 l12 14" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}${label(409, 112, 'NITRO')}
      ${key(314, 150, 58, arrow(343, 177, -1))}${key(380, 150, 58, `<path d="M397 170 l12 14 l12 -14" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}${key(446, 150, 58, arrow(475, 177, 1))}
      ${label(343, 232, 'STEER')}${label(409, 232, 'BRAKE')}${label(475, 232, 'STEER')}
    </svg>`;
  }
  // how to drift: two steps, big and plain
  const d1 = isTouch ? 'HOLD A TURN AT SPEED' : 'HOLD SPACE IN A TURN';
  $('#ctrlList').innerHTML = `<li class="ctrl-pic">${pic}</li>
    <li class="ctrl-drift"><b class="cd-tag">DRIFT</b><span class="cd-steps"><span class="cd-step">${d1}</span><span class="cd-step">LET GO TO BOOST</span></span></li>`;
}
