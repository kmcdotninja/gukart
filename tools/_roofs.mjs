// node tools/_roofs.mjs <city> <circuit>: where the rideable roofs are on a circuit (src/roofs.js), and a car dropped
// from above onto the first one: does it land on top and ride along it, then drop off the end?
import { chromium } from 'playwright';
import { preview } from 'vite';
const [city = 'singapore', circ = 'river'] = process.argv.slice(2);
const server = await preview({ preview: { port: 4196, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
p.on('pageerror', e => console.log('page error:', e.message));
await p.addInitScript(
  ([cy, c]) => {
    localStorage.clear();
    localStorage.setItem('gukart.city', JSON.stringify(cy));
    localStorage.setItem('gukart.circuit.' + cy, JSON.stringify(c));
    localStorage.setItem('gukart.coach', JSON.stringify({ steer: true, brake: true, drift: true, fire: true }));
    localStorage.setItem('gukart.school.offered', 'true');
  },
  [city, circ],
);
await p.goto('http://127.0.0.1:4196/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 300000,
});
await p.waitForTimeout(800);
await p.evaluate(() => window.gukart.game.race.reset());
await p.waitForTimeout(9000); // (the roofs are found a slice at a time)
console.log('filled:', await p.evaluate(() => window.gukart.game.race.roofH.filter(Boolean).length));
const r = await p.evaluate(() => {
  const g = window.gukart.game,
    R = g.race;
  const H = R.roofH,
    tr = g.track,
    runs = [];
  for (let i = 0; i < H.length; i++) {
    if (!H[i]) continue;
    let j = i;
    while (j < H.length && H[j]) j++;
    runs.push([Math.round(i * tr.seg), Math.round((j - i) * tr.seg), +H[i].toFixed(1)]);
    i = j;
  }
  return { len: Math.round(tr.len), runs };
});
console.log('roofs (start m, length m, height m):', JSON.stringify(r.runs));
if (r.runs.length) {
  // drop the player onto the middle of the first roof from 6 m above it, driving, and watch
  const [s0, L] = r.runs.find(x => x[2] > 3) || r.runs[0];
  const trace = await p.evaluate(
    async ([s0, L]) => {
      const g = window.gukart.game,
        R = g.race,
        P = R.player,
        tr = g.track;
      g.state = 'race';
      P.s = s0 + Math.max(4, L - 40); // (near its end, to see it drop off)
      P.lat = 0;
      P.speed = 30;
      const top = tr.point(P.s, 0).y + R.roofH[tr.idx(P.s)];
      P.Y = top + 6;
      P.fly = true;
      P.vy = 0;
      const out = [];
      for (let f = 0; f < 120; f++) {
        R.update(1 / 60, 'race');
        if (f % 15 === 0)
          out.push({
            s: Math.round(P.s - s0),
            aboveRoad: +(P.Y - tr.point(P.s, P.lat).y).toFixed(1),
            roof: +(R.roofH[tr.idx(P.s)] || 0).toFixed(1),
            onRoof: !!P.onRoof,
            fly: !!P.fly,
          });
      }
      return out;
    },
    [s0, L],
  );
  console.log(trace.map(t => JSON.stringify(t)).join('\n'));
}
await b.close();
await server.close();
