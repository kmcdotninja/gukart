// The settings card (volume, engine sound, steering, vibration) and the controls card.
import { Music } from './music.js';
import { ICON } from './icons.js';
import { Haptics } from './haptics.js';
import { Tilt } from './tilt.js';
import { Sound, engineMode } from './audio.js';
import { isTouch, store } from './util.js';
import { $, show, swap, hide } from './dom.js';
import { paintSound } from './home.js';
import { game } from './game.js';

// wire up this screen's buttons and listeners (called once, from main.js)
export function initSettings() {
  // the controls card: each action with its keys drawn as key caps in the race type, our own arrows on them
  {
    const cap = (k, wide) => `<kbd class="kc${wide ? ' wide' : ''}">${k}</kbd>`;
    const rows = isTouch
      ? [
          [cap(ICON.left) + cap(ICON.right), 'STEER', 'Hold the arrows, or tilt (Settings)'],
          [cap('BRAKE', 1), 'BRAKE', 'Hold to slow down, keep holding to reverse'],
          [cap('HOLD', 1), 'DRIFT', 'Hold a turn, let go to boost'],
          [cap('FIRE', 1), 'FIRE', 'Shoot what you picked up'],
          [cap('NITRO', 1), 'NITRO', 'When the bottle is full'],
          [cap(ICON.pause), 'PAUSE', ''],
        ]
      : [
          [cap(ICON.left) + cap(ICON.right), 'STEER', ''],
          [cap(ICON.up), 'NITRO', 'When the bottle is full'],
          [cap(ICON.down), 'BRAKE', ''],
          [cap('SPACE', 1), 'DRIFT', 'Hold in a turn, let go to boost'],
          [cap('SPACE', 1), 'TRICK', 'In the air'],
          [cap('F'), 'FIRE', ''],
          [cap('P'), 'PAUSE', ''],
        ];
    $('#ctrlList').innerHTML = rows
      .map(([k, a, sub]) => `<li><span class="kcs">${k}</span><b>${a}</b>${sub ? `<small>${sub}</small>` : ''}</li>`)
      .join('');
  }
  // settings: master volume, engine volume, which engine sound, vibration. From home it returns home; from pause, to pause
  {
    let from = null;
    const pct = v => Math.round(v * 100) + '%',
      fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    const paint = () => {
      const v = $('#setVol'),
        e = $('#setEng'),
        mu = $('#setMus'),
        se = $('#setSens');
      se.value = game.race.sens;
      fill(se);
      $('#setSensO').textContent = pct(game.race.sens);
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
    $('#setSens').addEventListener('input', e => {
      game.race.setSens(+e.target.value);
      store.set('steerSens', +e.target.value);
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
