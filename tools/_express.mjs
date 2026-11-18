// node tools/_express.mjs <outdir> [night 0/1] [circuit] [feature] [metres before]: a Quick Race on a Kano circuit, your
// kart (on autopilot) put that far before the feature (Kano City's railway: Kano Central and the Kano Express by
// default), then the game's own chase view every so often through it, with its distance and speed logged
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, night = '0', circ = 'metro', feat = 'railway', before = '250'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4199, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('page error:', e.message));
p.on(
  'console',
  m => ['error', 'warning'].includes(m.type()) && console.log('console', m.type(), m.text().slice(0, 300)),
);
await p.addInitScript(
  n => {
    localStorage.clear();
    localStorage.setItem('gukart.fsTip', 'true');
    localStorage.setItem('gukart.city', '"kano"');
    localStorage.setItem('gukart.circuit.kano', JSON.stringify(n.circ));
    localStorage.setItem('gukart.night', n.night === '1' ? 'true' : 'false');
    localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
  },
  { night, circ },
);
await p.goto('http://127.0.0.1:4199/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
await p.waitForTimeout(1000);
const tap = async s => {
  await p.locator(s).first().click({ force: true, timeout: 15000 });
  await p.waitForTimeout(500);
};
await tap('#quickBtn');
await tap('#mCards .mcard[data-mode="gp"]');
await tap('#mCards .mcard.on');
for (let k = 0; k < 4; k++) await tap('#qNext');
await p.waitForTimeout(1500);
await p.keyboard.press('KeyX');
await p.waitForFunction(() => document.body.dataset.state === 'race', null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.evaluate(
  ([feat, before]) => {
    for (const e of document.querySelectorAll('body > *:not(canvas)'))
      if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
    const g = window.gukart.game,
      tr = g.track,
      f = tr.feats.find(x => x.type === feat),
      P = g.race.player;
    window.__f = f;
    P.ai = true;
    P.s = f.s - before;
    P.prog = P.lap * tr.len + P.s;
    const q = tr.point(P.s, 0);
    P.Y = q.y;
    P.vy = 0;
    P.air = 0;
    P.airT = 0;
    for (const k of g.race.all)
      if (k !== P) {
        k.s = f.s - 600;
        k.prog = k.lap * tr.len + k.s;
        k.Y = tr.point(k.s, 0).y;
        k.vy = 0;
        k.air = 0;
      }
  },
  [feat, +before],
);
let shot = 0;
for (let n = 0; n < 400; n++) {
  await p.waitForTimeout(120);
  const info = await p.evaluate(() => {
    const P = window.gukart.game.race.player;
    const { cam } = window.gukart,
      r = P.m.root.position,
      q = window.gukart.game.track.point(P.s, 0);
    return {
      s: Math.round(P.s - window.__f.s),
      v: Math.round(P.speed),
      cam: cam.position.toArray().map(Math.round),
      kart: r.toArray().map(Math.round),
      road: [q.x, q.y, q.z].map(Math.round),
    };
  });
  if (info.s > 420) break;
  if (n % 2 === 0) console.log('log', info.s, info.v);
  if (info.s > -60 && n % 3 === 0) {
    await p.screenshot({ path: `${out}/ex-${String(shot).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 });
    console.log(shot++, JSON.stringify(info));
  }
}
await b.close();
await server.close();
