// node tools/_plan.mjs <out.png>: the Old City from above as a plan: the road (labels every 100 m, red where it's
// raised, blue where it's sunk), its features, the hill and the palace (to find room for a new piece of road)
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out] = process.argv.slice(2);
const server = await preview({ preview: { port: 4200, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
await p.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('gukart.city', '"kano"');
  localStorage.setItem('gukart.circuit.kano', '"old"');
});
await p.goto('http://127.0.0.1:4200/?gktest');
await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, {
  timeout: 240000,
});
const svg = await p.evaluate(() => {
  const g = window.gukart.game,
    tr = g.track,
    w = g.world;
  const pts = [];
  for (let s = 0; s < tr.len; s += 5) {
    const q = tr.point(s, 0);
    pts.push([q.x, q.z, q.y, s]);
  }
  const R0 = tr.radius + 150,
    C = tr.center;
  const minx = C.x - R0,
    minz = C.z - R0,
    sc = 860 / (2 * R0);
  const X = x => 20 + (x - minx) * sc,
    Z = z => 20 + (z - minz) * sc;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#20304a"/>`;
  s += `<circle cx="${X(C.x)}" cy="${Z(C.z)}" r="${R0 * sc}" fill="#e9d9b4"/>`;
  s += `<circle cx="${X(w.hill.x)}" cy="${Z(w.hill.z)}" r="${60 * sc}" fill="#998"/>`;
  if (w.palace)
    s += `<rect x="${X(w.palace.x) - 50 * sc}" y="${Z(w.palace.z) - 50 * sc}" width="${100 * sc}" height="${100 * sc}" fill="#b5524a"/>`;
  s += `<polyline fill="none" stroke-width="${26 * sc}" stroke-opacity=".8" points="${pts.map(p => X(p[0]) + ',' + Z(p[1])).join(' ')}" stroke="#333"/>`;
  for (const p of pts)
    if (p[3] % 100 === 0)
      s += `<text x="${X(p[0]) + 4}" y="${Z(p[1]) - 4}" font-size="11" fill="${p[2] > 3 ? '#c00' : p[2] < -3 ? '#06c' : '#000'}">${p[3]}</text>`;
  for (const f of tr.feats) {
    const q = tr.point(f.s, 0);
    s += `<text x="${X(q.x) + 6}" y="${Z(q.z) + 12}" font-size="10" fill="#7a2">${f.type}</text>`;
  }
  s += `<text x="20" y="890" fill="#fff" font-size="12">len ${Math.round(tr.len)} m; scale 100 m = ${Math.round(100 * sc)} px</text></svg>`;
  return s;
});
const q = await b.newPage({ viewport: { width: 900, height: 900 } });
await q.setContent(svg);
await q.screenshot({ path: out });
await b.close();
await server.close();
