// The game's music: two tracks, one for the menus and one for racing. The menus (the home screen, the garage, the map,
// the modes, the results) play public/music/track-1.mp3; the race itself plays the other, track-2.mp3. Each loops, and
// each picks up where it left off when you come back to it; going from one to the other cross-fades. The level follows what's on screen (Music.tick each frame): low under the engines in a race, down to nothing
// over the race card and the countdown, so the start lights have the room to themselves. It has its own volume
// (Settings: MUSIC, right down is off) and goes quiet with everything else on mute. Browsers only let sound start
// after a tap, so it comes in on the first one; the files aren't fetched until then, so they add nothing to loading.
// (Tracks: "Game Music" and "Gaming Trap Music" by vaitsez, from Pixabay.)
import { Sound } from './audio.js';
import { store } from './util.js';

const MENUS = '/music/track-1.mp3',
  RACING = '/music/track-2.mp3';
// the states that are the race itself (everything else is a menu)
const RACE = new Set(['intro', 'count', 'race', 'finish', 'paused']);
// how loud in each state of the game (of the MUSIC setting)
const LEVEL = { race: 0.32, finish: 0.32, paused: 0.25, intro: 0, count: 0 };

// the app minimised or the tab hidden: the tracks stop where they are (the music's tick plays them again when it's back)
const hush = () => {
  for (const d of Object.values(Music.decks || {})) d.el.pause();
};
document.addEventListener('visibilitychange', () => document.hidden && hush());
addEventListener('pagehide', hush);

export const Music = {
  vol: store.get('musicVolume', 0.7),
  setVolume(v) {
    this.vol = v;
    store.set('musicVolume', v);
  },
  // one track: its own player and its own fader
  deck(src) {
    const el = new Audio();
    el.preload = 'auto';
    el.loop = true;
    el.src = src;
    const g = Sound.ctx.createGain();
    g.gain.value = 0;
    Sound.ctx.createMediaElementSource(el).connect(g);
    g.connect(Sound.master); // (past the effects' compressor: the engines don't pump the music)
    el.addEventListener('error', () => (this.broken = true));
    return { el, g, to: -1, level: 0 };
  },
  tick(state) {
    if (!Sound.ctx || Sound.ctx.state !== 'running' || this.broken || document.hidden) return;
    const want = Sound.on && this.vol > 0.005;
    if (!this.decks) {
      if (!want) return;
      this.decks = { menus: this.deck(MENUS), racing: this.deck(RACING) };
    }
    const which = RACE.has(state) ? 'racing' : 'menus',
      lvl = want ? this.vol * 0.44 * (LEVEL[state] ?? 1) : 0;
    for (const [k, d] of Object.entries(this.decks)) {
      const to = k === which ? lvl : 0;
      if (to > 0 && d.el.paused) d.el.play().catch(() => {});
      if (to !== d.to) {
        d.to = to;
        d.g.gain.setTargetAtTime(to, Sound.ctx.currentTime, to > d.level ? 0.5 : 0.3); // every change is a fade
      }
      d.level += (to - d.level) * 0.06;
      if (to === 0 && d.level < 0.002 && !d.el.paused) d.el.pause(); // faded out: stopped, so it resumes from here
    }
  },
};
