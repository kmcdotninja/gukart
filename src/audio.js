// All sound is synthesised. The engines are modelled on a Toyota Supra (2JZ inline-6) recording: a clean note whose
// fundamental is the firing frequency (rpm / 20 for six cylinders), the overtones measured from that recording, a
// half-order rumble underneath, rasp and turbo whistle that come in with load, a blow-off "pssh" and crackle when the
// throttle lifts, and a gearbox that climbs and drops the revs like the real thing. Each vehicle is the same engine
// family tuned differently. Short blips for coins, items and the countdown sit beside it.
import { store } from './util.js';

// the Supra's overtones, from its spectrum (fundamental = 1): 2nd -13 dB, 3rd -12 dB, then falling away
const SUPRA_HARM = [1, 0.23, 0.25, 0.08, 0.033, 0.058, 0.023, 0.02, 0.018, 0.0093, 0.0085, 0.0115];

// the engine family. Every number here is tunable live in /sound.html
export const ENGINE_BASE = {
  idle: 900,
  redline: 7200,
  cyl: 6, // rpm; cylinders set the firing frequency
  pitch: 1, // scales every frequency (bigger engine = lower)
  half: 0.07, // the half-order rumble under the note (Supra: -23 dB)
  tone: 1, // brightness of the filter
  load: 0.55, // how much the upper overtones open up on throttle
  rumble: 0.45, // low exhaust noise
  rasp: 0.22, // gritty band of noise at twice the note, under load
  turbo: 0.35, // whistle when the turbo spools
  bov: 0.5, // blow-off "pssh" on lift and shifts
  pops: 0.45, // crackles off throttle
  gears: [0.17, 0.31, 0.46, 0.62, 0.8, 1], // each gear's top speed, as a share of top speed
  vol: 1,
};
export const VEHICLE_SOUND = {
  kart: { pitch: 1.22, half: 0.05, rumble: 0.3, rasp: 0.3, turbo: 0.25, load: 0.7, vol: 0.9 }, // small and eager, brighter
  buggy: { pitch: 1.04, half: 0.08, rumble: 0.45, rasp: 0.35, turbo: 0.3 }, // closest to the Supra
  monster: { pitch: 0.68, half: 0.17, rumble: 0.95, rasp: 0.25, turbo: 0.45, tone: 0.8, vol: 1.15 }, // a big, deep, slow engine
  muscle: { pitch: 0.82, half: 0.13, rumble: 0.75, rasp: 0.3, turbo: 0.2, tone: 0.9, vol: 1.1 }, // a burbling V8 weight
};
export function engineParams(type) {
  const tune = store.get('engineTune.' + type, {}); // tweaks saved from the sound studio (sound.html)
  return { ...ENGINE_BASE, ...(VEHICLE_SOUND[type] || {}), ...tune };
}

// the Supra itself: three steady stretches of the recording cut into seamless loops (public/sounds), each at its own note.
// In 'supra' mode the engine plays these, pitched to the revs and crossfaded to whichever loop is nearest
export const SUPRA_LOOPS = [
  ['/sounds/supra-140.wav', 140],
  ['/sounds/supra-192.wav', 192],
  ['/sounds/supra-252.wav', 252],
];
let supraBufs = null,
  supraLoading = null;
export function loadSupra(c) {
  if (supraBufs || supraLoading) return supraLoading;
  supraLoading = Promise.all(
    SUPRA_LOOPS.map(([u, f]) =>
      fetch(u)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, no) => c.decodeAudioData(b, ok, no)))
        .then(buf => ({ buf, f })),
    ),
  )
    .then(list => {
      supraBufs = list;
      return list;
    })
    .catch(() => {
      supraLoading = null;
    });
  return supraLoading;
}
export const engineMode = () => store.get('engineMode', 'supra');

let noiseBuf = null;
const noise = c => {
  if (noiseBuf) return noiseBuf;
  const n = c.sampleRate * 2;
  noiseBuf = c.createBuffer(1, n, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};
const loopNoise = c => {
  const s = c.createBufferSource();
  s.buffer = noise(c);
  s.loop = true;
  s.loopStart = Math.random();
  s.start();
  return s;
};

// one engine. update() takes what the vehicle is doing; the voice runs its own gearbox and revs
export class EngineVoice {
  constructor(ctx, dest, params) {
    const c = (this.ctx = ctx);
    this.p = params;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (this.pan) {
      this.out.connect(this.pan);
      this.pan.connect(dest);
    } else this.out.connect(dest);
    // the note: two waves crossfaded by load (the measured overtones; the same, opened up)
    const wave = amps => {
      const re = new Float32Array(amps.length + 1),
        im = new Float32Array(amps.length + 1);
      amps.forEach((a, k) => {
        im[k + 1] = a;
      });
      return c.createPeriodicWave(re, im);
    };
    this.waveOff = wave(SUPRA_HARM);
    this.waveOn = wave(SUPRA_HARM.map((a, k) => a * (1 + k * k * 0.06)));
    this.oA = c.createOscillator();
    this.oA.setPeriodicWave(this.waveOff);
    this.oB = c.createOscillator();
    this.oB.setPeriodicWave(this.waveOn);
    this.gA = c.createGain();
    this.gB = c.createGain();
    this.oH = c.createOscillator();
    this.oH.setPeriodicWave(wave([1, 0, 0.5])); // half order, with a little of 1.5
    this.gH = c.createGain();
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.Q.value = 0.7;
    this.body = c.createGain();
    this.oA.connect(this.gA);
    this.oB.connect(this.gB);
    this.oH.connect(this.gH);
    for (const g of [this.gA, this.gB, this.gH]) g.connect(this.lp);
    this.lp.connect(this.body);
    this.body.connect(this.out);
    // exhaust rumble and rasp
    this.rum = loopNoise(c);
    this.rumF = c.createBiquadFilter();
    this.rumF.type = 'lowpass';
    this.rumF.frequency.value = 130;
    this.rumG = c.createGain();
    this.rum.connect(this.rumF);
    this.rumF.connect(this.rumG);
    this.rumG.connect(this.out);
    this.rsp = loopNoise(c);
    this.rspF = c.createBiquadFilter();
    this.rspF.type = 'bandpass';
    this.rspF.Q.value = 2.5;
    this.rspG = c.createGain();
    this.rsp.connect(this.rspF);
    this.rspF.connect(this.rspG);
    this.rspG.connect(this.out);
    // turbo whistle
    this.tb = c.createOscillator();
    this.tb.type = 'sine';
    this.tbG = c.createGain();
    this.tbG.gain.value = 0;
    this.tb.connect(this.tbG);
    this.tbG.connect(this.out);
    for (const o of [this.oA, this.oB, this.oH, this.tb]) o.start();
    // the Supra loops, all running, silent until chosen
    this.synthG = c.createGain();
    this.gA.disconnect();
    this.gB.disconnect();
    this.gA.connect(this.synthG);
    this.gB.connect(this.synthG);
    this.synthG.connect(this.lp);
    this.samples = [];
    this.sampBus = c.createGain();
    this.sampBus.gain.value = 0;
    this.sampBus.connect(this.out); // the recording goes straight out: it has its own tone
    if (supraBufs)
      for (const { buf, f } of supraBufs) {
        const src = c.createBufferSource(),
          g = c.createGain();
        src.buffer = buf;
        src.loop = true;
        g.gain.value = 0;
        src.connect(g);
        g.connect(this.sampBus);
        src.start(0, Math.random() * buf.duration);
        this.samples.push({ src, g, f });
      }
    this.rpm = params.idle;
    this.gear = 0;
    this.spool = 0;
    this.lift = 0;
    this.cut = 0;
    this.prevThr = 0;
    this.popT = 0;
    this.limT = 0;
  }
  set(params) {
    this.p = params;
    this.gear = Math.min(this.gear, params.gears.length - 1);
    this.rpm = Math.max(params.idle, Math.min(params.redline, this.rpm));
  } // (keep the gear and revs inside the new engine's range)
  // s: { speed 0..~1.2 (share of top speed), throttle 0..1, brake, air, boost, drift, doppler (pitch factor), gain, pan }
  update(s, dt) {
    const p = this.p,
      c = this.ctx,
      t = c.currentTime,
      thr = Math.max(0, s.throttle),
      G = p.gears;
    // the gearbox: pick the gear the speed belongs in; shift up near the redline, down when the revs sag
    const span = p.redline - p.idle,
      gTop = G[this.gear] * (s.boost ? 1.12 : 1);
    let want = p.idle + span * Math.min(1.04, s.speed / gTop);
    if (s.air) want = Math.min(p.redline * 1.02, this.rpm + span * (thr > 0.1 ? 1.6 : -0.4) * dt * 3); // wheels free: it flares
    if (!s.air && want > p.redline * 0.93 && this.gear < G.length - 1 && thr > 0.1) {
      this.gear++;
      this.shift();
    } else if (!s.air && this.gear > 0 && s.speed < G[this.gear - 1] * 0.78) this.gear--;
    want = s.air ? want : p.idle + span * Math.min(1.04, s.speed / (G[this.gear] * (s.boost ? 1.12 : 1)));
    if (s.speed < 0.02 && !s.air) want = p.idle * (1 + thr * 0.3);
    const up = want > this.rpm,
      rate = up ? (thr > 0.1 ? 9 : 4) : thr > 0.1 ? 6 : 3.2;
    this.rpm += (want - this.rpm) * Math.min(1, dt * rate);
    if (this.rpm > p.redline * 0.985) {
      this.limT += dt;
      if (this.limT > 0.07) {
        this.limT = 0;
        this.rpm *= 0.965;
      }
    } // the limiter bounce
    // lifting off: a blow-off pssh and crackles while the revs fall
    if (this.prevThr > 0.5 && thr < 0.2 && this.rpm > p.idle * 2.2) {
      this.bov();
      this.lift = 1.2;
    }
    this.prevThr = thr;
    this.lift = Math.max(0, this.lift - dt);
    if (this.lift > 0 && thr < 0.2 && (this.popT -= dt) < 0) {
      this.popT = 0.05 + Math.random() * 0.16;
      if (Math.random() < p.pops) this.pop();
    }
    this.cut = Math.max(0, this.cut - dt);
    // the turbo spools with load and revs
    this.spool +=
      ((thr > 0.3 ? Math.min(1, (this.rpm / p.redline) * 1.3) : 0) + (s.boost ? 0.4 : 0) - this.spool) *
      Math.min(1, dt * (thr > 0.3 ? 1.6 : 5));
    // the sound of it
    const f = (((this.rpm / 60) * p.cyl) / 2) * p.pitch * (s.doppler || 1),
      rn = (this.rpm - p.idle) / span,
      load = Math.min(1, thr * (this.cut > 0 ? 0.1 : 1) + (s.boost ? 0.3 : 0));
    const k = 0.05;
    this.oA.frequency.setTargetAtTime(f, t, k);
    this.oB.frequency.setTargetAtTime(f, t, k);
    this.oH.frequency.setTargetAtTime(f / 2, t, k);
    this.gA.gain.setTargetAtTime(1 - load * p.load, t, 0.06);
    this.gB.gain.setTargetAtTime(load * p.load * 0.8, t, 0.06);
    const supra = (s.mode || engineMode()) === 'supra' && this.samples.length;
    this.synthG.gain.setTargetAtTime(supra ? 0 : 1, t, 0.05);
    if (supra) {
      // the nearest loop carries the note, its neighbour fades in as the revs pass between them
      const fz = Math.max(60, f),
        ws = this.samples.map(sm => Math.exp(-Math.pow(Math.log(fz / sm.f) / 0.22, 2))),
        tot = ws.reduce((a, b) => a + b, 0) || 1;
      this.samples.forEach((sm, j) => {
        sm.src.playbackRate.setTargetAtTime(Math.max(0.45, Math.min(2.2, fz / sm.f)), t, 0.05);
        sm.g.gain.setTargetAtTime(ws[j] / tot, t, 0.06);
      });
      this.sampBus.gain.setTargetAtTime(3.9 * (0.6 + load * 0.55) * (this.cut > 0 ? 0.55 : 1), t, 0.04); // as loud as our engine: louder on throttle, a dip on each shift
    } else this.sampBus.gain.setTargetAtTime(0, t, 0.05);
    this.gH.gain.setTargetAtTime(p.half * 6 * (supra ? 0.4 : 1), t, 0.1);
    this.lp.frequency.setTargetAtTime((500 + rn * 2600 + load * 1800) * p.tone, t, 0.08);
    this.body.gain.setTargetAtTime((0.42 + load * 0.5 + rn * 0.12) * (this.cut > 0 ? 0.55 : 1), t, 0.03);
    this.rumG.gain.setTargetAtTime(p.rumble * (0.25 + load * 0.6) * (0.5 + rn * 0.5), t, 0.1);
    this.rspF.frequency.setTargetAtTime(Math.max(200, f * 2), t, 0.05);
    this.rspG.gain.setTargetAtTime(p.rasp * load * (0.2 + rn) * 0.5, t, 0.08);
    this.tb.frequency.setTargetAtTime(1800 + this.spool * 2600, t, 0.1);
    this.tbG.gain.setTargetAtTime(p.turbo * this.spool * this.spool * 0.035, t, 0.1);
    this.out.gain.setTargetAtTime((s.gain ?? 1) * p.vol * 0.22, t, 0.08);
    if (this.pan) this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, s.pan || 0)), t, 0.08);
    this.lastF = f;
  }
  shift() {
    this.onShift?.();
    this.cut = 0.09;
    this.rpm *= 0.74;
    if (Math.random() < 0.7) this.bov(0.6);
    if (Math.random() < this.p.pops) setTimeout(() => this.pop(), 60);
  }
  // a burst of air through a sweeping band-pass: the turbo's blow-off valve
  bov(level = 1) {
    this.onBov?.(level);
    const c = this.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = noise(c);
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(3800, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.35);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.p.bov * level * 0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    s.connect(f);
    f.connect(g);
    g.connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.45);
  }
  // a crackle from the exhaust: a very short knock of noise and a low thud
  pop() {
    this.onPop?.();
    const c = this.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = noise(c);
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.value = 700 + Math.random() * 1500;
    g.gain.setValueAtTime(0.05 + Math.random() * 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05 + Math.random() * 0.04);
    s.connect(f);
    f.connect(g);
    g.connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.1);
  }
  // done with this engine: fade it out, then really stop every layer and unplug it. (It used to only fade, so each
  // retired engine kept running silently; rivals swap engines all race long, and on a phone the pile-up of silent
  // engines starved the audio until the engine stuttered and then went quiet)
  stop() {
    if (this.dead) return;
    this.dead = true;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    for (const o of [this.oA, this.oB, this.oH, this.tb, this.rum, this.rsp, ...this.samples.map(sm => sm.src)]) {
      try {
        o.stop(t + 0.3);
      } catch {
        /* never started, or already stopped */
      }
    }
    setTimeout(() => {
      try {
        this.out.disconnect();
        this.pan?.disconnect();
      } catch {
        /* already disconnected */
      }
    }, 450);
  }
}

export const Sound = {
  ctx: null,
  on: store.get('sound', true),
  vol: store.get('volume', 0.8),
  engVol: store.get('engineVolume', 1),
  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    } // (iPhone also has 'interrupted': a call, a notification, the switch haptic)
    try {
      const C = window.AudioContext || window.webkitAudioContext,
        c = new C();
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = this.on ? 0.75 * this.vol : 0;
      this.master.connect(c.destination);
      // a gentle glue on the whole mix so engines, hits and blips sit together
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.ratio.value = 3;
      this.comp.connect(this.master);
      this.bus = this.comp;
      this.engBus = c.createGain();
      this.engBus.gain.value = this.engVol;
      this.engBus.connect(this.bus); // every engine, so their level has its own setting
      // tyre squeal, for drifts and hard braking
      this.sq = loopNoise(c);
      this.sqF = c.createBiquadFilter();
      this.sqF.type = 'bandpass';
      this.sqF.frequency.value = 1100;
      this.sqF.Q.value = 7;
      this.sqG = c.createGain();
      this.sqG.gain.value = 0;
      this.sq.connect(this.sqF);
      this.sqF.connect(this.sqG);
      this.sqG.connect(this.bus);
      // wind, rising with speed
      this.wd = loopNoise(c);
      this.wdF = c.createBiquadFilter();
      this.wdF.type = 'lowpass';
      this.wdF.frequency.value = 600;
      this.wdG = c.createGain();
      this.wdG.gain.value = 0;
      this.wd.connect(this.wdF);
      this.wdF.connect(this.wdG);
      this.wdG.connect(this.bus);
      this.rivalVoices = [];
      loadSupra(c).then(() => {
        this.voice?.stop();
        this.voice = null;
        this.rivalVoices.forEach(r => {
          r.v?.stop();
          r.v = null;
        });
      }); // rebuild the engines once the loops are in
    } catch {
      this.ctx = null;
    }
  },
  // the phone can stop the audio behind the game's back (another app, a call, the screen locking); this brings it back the
  // moment you return or touch the screen, so the sound never stays off while it says it's on
  keepAlive() {
    // (init() starts the sound on the first touch, click or key press, or wakes it if it already exists: a keyboard-only
    // player used to stay silent, since only a click started it)
    const wake = () => {
      if (this.ctx?.state === 'running') return;
      this.init();
    };
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) wake();
    });
    for (const ev of ['touchend', 'pointerup', 'keydown']) addEventListener(ev, wake, { passive: true, capture: true });
  },
  toggle() {
    this.on = !this.on;
    store.set('sound', this.on);
    if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.75 * this.vol : 0, this.ctx.currentTime, 0.05);
    return this.on;
  },
  setVolume(v) {
    this.vol = v;
    store.set('volume', v);
    if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.75 * v : 0, this.ctx.currentTime, 0.05);
  },
  setEngineVolume(v) {
    this.engVol = v;
    store.set('engineVolume', v);
    if (this.engBus) this.engBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  },
  setEngineMode(m) {
    store.set('engineMode', m);
    this.voice?.stop();
    this.voice = null;
    this.rivalVoices?.forEach(r => {
      r.v?.stop();
      r.v = null;
    });
  },
  // the player's vehicle: o = { type, speed (share of top speed), throttle, brake, air, drift, boost, running }
  drive(o, dt = 0.016) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime;
    if (!this.voice || this.voiceType !== o.type) {
      this.voice?.stop();
      this.voice = new EngineVoice(c, this.engBus, engineParams(o.type));
      this.voiceType = o.type;
    }
    this.voice.update({ ...o, gain: o.running ? 1 : 0 }, dt);
    this.sqG.gain.setTargetAtTime(
      o.running ? ((o.drift ? 0.045 : 0) + (o.brake && o.speed > 0.25 ? 0.03 : 0)) * Math.min(1, o.speed * 2) : 0,
      t,
      0.06,
    );
    this.sqF.frequency.setTargetAtTime(900 + Math.sin(t * 13) * 120 + o.speed * 400, t, 0.05);
    this.wdG.gain.setTargetAtTime(o.running ? Math.max(0, o.speed - 0.3) * 0.05 + (o.air ? 0.03 : 0) : 0, t, 0.2);
    this.wdF.frequency.setTargetAtTime(400 + o.speed * 1400, t, 0.2);
  },
  // the two nearest rivals: r = [{ type, speed, dist (metres, + ahead), side (-1..1), rel (their speed minus yours, m/s) }]
  rivals(list, dt = 0.016) {
    if (!this.ctx) return;
    while (this.rivalVoices.length < 2) this.rivalVoices.push({ v: null, type: null, d: 999 });
    this.rivalVoices.forEach((slot, i) => {
      const r = list[i];
      if (!r) {
        slot.v?.update({ speed: 0, throttle: 0, gain: 0 }, dt);
        return;
      }
      if (!slot.v) {
        slot.v = new EngineVoice(this.ctx, this.engBus, engineParams(r.type));
        slot.type = r.type;
      } else if (slot.type !== r.type) {
        slot.v.set(engineParams(r.type));
        slot.type = r.type;
      } // a different rival is nearest: retune the same engine, don't build another
      const near = Math.max(0, 1 - Math.abs(r.dist) / 60),
        dop = Math.max(0.8, Math.min(1.25, 1 - (((r.dist > 0 ? 1 : -1) * r.rel) / 340) * 6));
      slot.v.update({ speed: r.speed, throttle: 1, doppler: dop, gain: near * near * 0.8, pan: r.side * 0.8 }, dt);
      if (slot.d > 0 !== r.dist > 0 && Math.abs(r.dist) < 8 && Math.abs(r.rel) > 3) this.passBy(r.side); // they've just come past, or you've passed them
      slot.d = r.dist;
    });
  },
  // back-compat: the old one-line engine call
  engine(speed, running, boost) {
    this.drive({
      type: this.voiceType || 'kart',
      speed: Math.abs(speed) / 66,
      throttle: running ? 1 : 0,
      running,
      boost,
    });
  },
  passBy(side = 0) {
    if (!this.ctx || !this.on || this.quiet) return; // (quiet: the race behind the menu makes no sound)
    const c = this.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain(),
      pn = c.createStereoPanner ? c.createStereoPanner() : null;
    s.buffer = noise(c);
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
    s.connect(f);
    f.connect(g);
    if (pn) {
      pn.pan.setValueAtTime(side * 0.9, t);
      pn.pan.linearRampToValueAtTime(-side * 0.6, t + 0.5);
      g.connect(pn);
      pn.connect(this.bus);
    } else g.connect(this.bus);
    s.start(t, Math.random());
    s.stop(t + 0.65);
  },
  // touching down after a jump: a low thud, harder for a bigger drop
  land(hard = 0.5) {
    if (!this.ctx || !this.on || this.quiet) return; // (quiet: the race behind the menu makes no sound)
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    g.gain.setValueAtTime(0.12 + hard * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + 0.32);
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g2 = c.createGain();
    s.buffer = noise(c);
    f.type = 'lowpass';
    f.frequency.value = 500;
    g2.gain.setValueAtTime(0.08 + hard * 0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
    s.connect(f);
    f.connect(g2);
    g2.connect(this.bus);
    s.start(t, Math.random());
    s.stop(t + 0.2);
  },
  blip(freq, dur = 0.12, type = 'sine', vol = 0.18, slide = 1.5) {
    if (!this.ctx || !this.on || this.quiet) return;
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  coin() {
    this.blip(1320, 0.08, 'square', 0.07, 1.5);
    setTimeout(() => this.blip(1980, 0.12, 'square', 0.06, 1.1), 60);
  },
  item() {
    this.blip(500, 0.25, 'triangle', 0.15, 2.4);
  },
  // a boost: the turbo flares and air rushes
  boost() {
    this.blip(180, 0.45, 'sawtooth', 0.07, 3);
    if (!this.ctx || !this.on || this.quiet) return; // (quiet: the race behind the menu makes no sound)
    const c = this.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = noise(c);
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    g.gain.setValueAtTime(0.0005, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.7);
    s.connect(f);
    f.connect(g);
    g.connect(this.bus);
    s.start(t, Math.random());
    s.stop(t + 0.75);
  },
  laugh() {
    [0, 120, 240].forEach((d, i) => setTimeout(() => this.blip(620 - i * 60, 0.1, 'triangle', 0.12, 0.8), d));
  },
  // a swoosh: a burst of noise swept through a band-pass filter
  swoosh(up = true) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx,
      t = c.currentTime,
      n = c.sampleRate * 0.45,
      buf = c.createBuffer(1, n, c.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n);
    const src = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 400 : 2600, t);
    f.frequency.exponentialRampToValueAtTime(up ? 2600 : 400, t + 0.4);
    g.gain.value = 0.35;
    src.connect(f);
    f.connect(g);
    g.connect(this.bus);
    src.start(t);
  },
  hit() {
    this.blip(300, 0.4, 'square', 0.15, 0.3);
  },
  beep(hi) {
    this.blip(hi ? 880 : 440, hi ? 0.5 : 0.18, 'square', 0.1, 1);
  },
};
