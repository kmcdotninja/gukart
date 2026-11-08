// Every texture in the game is drawn here on a canvas: no image files to load, so the game starts fast on a phone.
import * as THREE from 'three';
import { ARROW } from './icons.js';

let aniso = 4;
export const setAniso = a => { aniso = a; };

export function canvasTex(w, h, draw, { repeat = false } = {}){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
const R = Math.random;
function speckle(x, w, h, n, cols, a, b){
  for (let i = 0; i < n; i++) { x.fillStyle = cols[(R() * cols.length) | 0]; const s = a + R() * (b - a); x.fillRect(R() * w, R() * h, s, s); }
}
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

function hazard(x, x0, y0, w, h, step = 24){
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  x.fillStyle = '#ffc400'; x.fillRect(x0, y0, w, h); x.fillStyle = '#16181d';
  for (let i = -h; i < w + h; i += step * 2) { x.beginPath(); x.moveTo(x0 + i, y0 + h); x.lineTo(x0 + i + step, y0 + h); x.lineTo(x0 + i + step + h, y0); x.lineTo(x0 + i + h, y0); x.fill(); }
  x.restore();
}
function plaster(x, w, h){
  x.fillStyle = '#f4ede2'; x.fillRect(0, 0, w, h);
  speckle(x, w, h, w * h / 16, ['#ebe2d4', '#faf6ef', '#e2d7c6', '#efe7da'], 1, 3);
  for (let i = 0; i < w / 16; i++) { x.fillStyle = `rgba(120,95,70,${.03 + R() * .05})`; x.fillRect(R() * w, 0, 2 + R() * 5, h * (.12 + R() * .4)); }
  // weathering: a sun-bleached lip at the top, patches where the wash has worn thin, damp and red dust splashed up the foot
  const top = x.createLinearGradient(0, 0, 0, h * .06); top.addColorStop(0, 'rgba(255,255,255,.35)'); top.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = top; x.fillRect(0, 0, w, h * .06);
  for (let i = 0; i < 7; i++) { const px = R() * w, py = h * (.2 + R() * .55), rx = 8 + R() * 22, ry = 5 + R() * 14; x.fillStyle = 'rgba(190,150,105,.09)'; x.beginPath(); x.ellipse(px, py, rx, ry, R(), 0, 7); x.fill(); }
  const foot = x.createLinearGradient(0, h * .78, 0, h); foot.addColorStop(0, 'rgba(150,95,55,0)'); foot.addColorStop(.6, 'rgba(150,95,55,.16)'); foot.addColorStop(1, 'rgba(110,70,40,.32)'); x.fillStyle = foot; x.fillRect(0, h * .78, w, h * .22);
  for (let i = 0; i < w * 1.5; i++) { const py = h - Math.pow(R(), 2.2) * h * .2; x.fillStyle = `rgba(130,80,45,${.08 + R() * .12})`; x.fillRect(R() * w, py, 1 + R() * 1.6, 1 + R() * 1.6); }
}
// raised relief: a shadow cast down-right, a lit edge up-left, then the cream face
export const RELIEF = ['rgba(70,40,18,.55)', 'rgba(255,244,222,.6)', '#efdcb8'];
export function relief(x, draw, d = 4, pal = RELIEF){
  draw(pal[0], d, d * 1.2); draw(pal[1], -d * .4, -d * .4); draw(pal[2], 0, 0);
}
// the looped knot: four round loops interlaced around a diamond, knobs on the diagonals
export function loopKnot(x, cx, cy, s, pal = RELIEF){
  relief(x, (c, dx, dy) => {
    x.save(); x.translate(cx + dx, cy + dy); x.strokeStyle = x.fillStyle = c; x.lineWidth = s * .075; x.lineJoin = x.lineCap = 'round';
    for (const [px, py] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { x.beginPath(); x.arc(px * s * .3, py * s * .3, s * .2, 0, 7); x.stroke(); }
    x.beginPath(); x.moveTo(0, -s * .2); x.lineTo(s * .2, 0); x.lineTo(0, s * .2); x.lineTo(-s * .2, 0); x.closePath(); x.fill();
    for (const [px, py] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { x.beginPath(); x.arc(px * s * .37, py * s * .37, s * .045, 0, 7); x.fill(); }
    for (const [px, py] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { x.beginPath(); x.arc(px * s * .56, py * s * .56, s * .04, 0, 7); x.fill(); }
    x.restore();
  }, 4, pal);
  x.save(); x.translate(cx, cy); x.fillStyle = pal[0]; x.beginPath(); x.moveTo(0, -s * .1); x.lineTo(s * .1, 0); x.lineTo(0, s * .1); x.lineTo(-s * .1, 0); x.fill(); x.restore();
}
// the star knot over the door: interlaced bands round a chequered diamond, triangles pointing in from four sides
export function starKnot(x, cx, cy, s, pal = RELIEF){
  relief(x, (c, dx, dy) => {
    x.save(); x.translate(cx + dx, cy + dy); x.strokeStyle = x.fillStyle = c; x.lineWidth = s * .065; x.lineJoin = x.lineCap = 'round';
    for (const k of [0, 1, 2, 3]) { x.save(); x.rotate(Math.PI / 4 + k * Math.PI / 2); x.beginPath(); x.roundRect(s * .08, -s * .13, s * .34, s * .26, s * .13); x.stroke(); x.restore(); }
    x.beginPath(); x.moveTo(0, -s * .2); x.lineTo(s * .2, 0); x.lineTo(0, s * .2); x.lineTo(-s * .2, 0); x.closePath(); x.stroke();
    for (const k of [0, 1, 2, 3]) { x.save(); x.rotate(k * Math.PI / 2); x.beginPath(); x.moveTo(-s * .14, -s * .62); x.lineTo(s * .14, -s * .62); x.lineTo(0, -s * .4); x.closePath(); x.fill(); x.restore(); }
    x.restore();
  }, 4, pal);
  x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); const q = s * .055;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { x.fillStyle = (i + j) & 1 ? pal[0] : pal[2]; x.fillRect(i * q * 1.15 - q / 2, j * q * 1.15 - q / 2, q, q); }
  x.restore();
}
// the Kano horned emblem on top of Kofar Nassarawa: two horns curving up from a base, a disc between them
export function kanoHorns(x, cx, cy, s, col){
  const u = s / 5; x.save(); x.translate(cx, cy + u * 2.2); x.scale(u, -u); x.fillStyle = col;
  x.beginPath(); x.moveTo(-2.1, 4.4); x.quadraticCurveTo(-2.6, .2, 0, 0); x.quadraticCurveTo(2.6, .2, 2.1, 4.4); x.lineTo(1.2, 3.1);
  x.quadraticCurveTo(1.3, 1.1, 0, 1); x.quadraticCurveTo(-1.3, 1.1, -1.2, 3.1); x.closePath(); x.fill();
  x.beginPath(); x.arc(0, 2.4, .75, 0, 7); x.fill(); x.restore();
}
// a band of diamonds between triangles, with a row of arches over it
export function diamondBand(x, x0, x1, y, s, pal = RELIEF){
  const n = Math.max(1, Math.round((x1 - x0) / (s * 1.3))), step = (x1 - x0) / n;
  relief(x, (c, dx, dy) => {
    x.save(); x.translate(dx, dy); x.strokeStyle = x.fillStyle = c; x.lineWidth = s * .09; x.lineJoin = x.lineCap = 'round';
    for (let k = 0; k < n; k++) { const cx = x0 + step * (k + .5);
      x.beginPath(); x.moveTo(cx, y - s * .45); x.lineTo(cx + s * .45, y); x.lineTo(cx, y + s * .45); x.lineTo(cx - s * .45, y); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(cx, y - s * .18); x.lineTo(cx + s * .18, y); x.lineTo(cx, y + s * .18); x.lineTo(cx - s * .18, y); x.fill();
      x.beginPath(); x.arc(cx, y - s * .78, s * .28, Math.PI, 0); x.stroke();
      x.beginPath(); x.arc(cx, y - s * 1.12, s * .06, 0, 7); x.fill(); }
    for (let k = 0; k <= n; k++) { const tx = x0 + step * k;
      x.beginPath(); x.moveTo(tx - s * .16, y - s * .3); x.lineTo(tx + s * .16, y - s * .3); x.lineTo(tx, y); x.fill();
      x.beginPath(); x.moveTo(tx - s * .16, y + s * .3); x.lineTo(tx + s * .16, y + s * .3); x.lineTo(tx, y); x.fill(); }
    x.beginPath(); x.moveTo(x0, y + s * .62); x.lineTo(x1, y + s * .62); x.stroke();
    x.restore();
  }, 3, pal);
}
export function earth(x, w, h){
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c99360'); g.addColorStop(.7, '#c08653'); g.addColorStop(1, '#a8703f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  speckle(x, w, h, w * h / 14, ['rgba(150,95,50,.16)', 'rgba(215,165,115,.16)', 'rgba(120,75,40,.13)', 'rgba(230,185,135,.14)'], 1, 3);
  for (let i = 0; i < w / 5; i++) { x.fillStyle = `rgba(${R() < .5 ? '90,55,25' : '235,195,145'},${.04 + R() * .05})`; x.beginPath(); x.ellipse(R() * w, R() * h, 10 + R() * 30, 4 + R() * 10, R() * 3, 0, 7); x.fill(); }
  for (let i = 0; i < w / 18; i++) { x.fillStyle = `rgba(80,50,25,${.05 + R() * .07})`; x.fillRect(R() * w, 0, 2 + R() * 5, h * (.08 + R() * .3)); }
}

export function buildTextures(){
  const T = {};
  // asphalt, 26 m across by 24 m along: tileable aggregate, a polished line where tyres run, sealed cracks, a repair patch,
  // worn edge lines. Everything that crosses an edge is drawn again on the far side, so the repeat leaves no seam.
  T.road = canvasTex(512, 512, (x, w, h) => {
    const wrap = (px, py, r, f) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) if (px + dx + r > 0 && px + dx - r < w && py + dy + r > 0 && py + dy - r < h) f(px + dx, py + dy); };
    x.fillStyle = '#3c3f46'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {   // soft tonal blotches: the binder is never one flat grey
      const px = R() * w, py = R() * h, rx = 20 + R() * 70, ry = 30 + R() * 120, a = .025 + R() * .04, c = R() < .5 ? '20,22,28' : '120,118,112';
      wrap(px, py, Math.max(rx, ry), (X, Y) => { x.fillStyle = `rgba(${c},${a})`; x.beginPath(); x.ellipse(X, Y, rx, ry, 0, 0, 7); x.fill(); });
    }
    const agg = ['#373a40', '#42454c', '#393c43', '#484a50', '#4f5054', '#33363c'];
    for (let i = 0; i < 52000; i++) { x.fillStyle = agg[(R() * agg.length) | 0]; const s = R() < .94 ? 1 : 1.5 + R(); x.fillRect((R() * w) | 0, (R() * h) | 0, s, s); }
    // the racing line: two darker, smoother bands where the tyres polish the stone, dust drifting in at the edges
    const band = (u, half, rgba) => { const g = x.createLinearGradient((u - half) * w, 0, (u + half) * w, 0); g.addColorStop(0, rgba + '0)'); g.addColorStop(.5, rgba + '.14)'); g.addColorStop(1, rgba + '0)'); x.fillStyle = g; x.fillRect((u - half) * w, 0, half * 2 * w, h); };
    band(.33, .14, 'rgba(14,15,19,'); band(.67, .14, 'rgba(14,15,19,');
    band(.06, .07, 'rgba(150,128,96,'); band(.94, .07, 'rgba(150,128,96,');
    // tar snakes: sealed cracks, thin and glossy black, wandering mostly along the road
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      let px = R() * w, py = R() * h; const pts = [[px, py]], dir = (R() < .7 ? Math.PI / 2 : 0) + (R() - .5) * .8;
      for (let k = 0; k < 10 + R() * 14; k++) { const a = dir + (R() - .5) * 1.4; px += Math.cos(a) * 9; py += Math.sin(a) * 9; pts.push([px, py]); }
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        x.strokeStyle = 'rgba(12,12,14,.55)'; x.lineWidth = 2; x.beginPath(); pts.forEach(([a, b], j) => j ? x.lineTo(a + dx, b + dy) : x.moveTo(a + dx, b + dy)); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = .8; x.beginPath(); pts.forEach(([a, b], j) => j ? x.lineTo(a + dx - .7, b + dy - .7) : x.moveTo(a + dx - .7, b + dy - .7)); x.stroke();
      }
    }
    // one repair patch, a shade off from the road round it, with a crisp sawn edge
    { const px = w * (.18 + R() * .5), py = R() * h, pw = 60 + R() * 70, ph = 40 + R() * 90;
      wrap(px + pw / 2, py + ph / 2, Math.max(pw, ph), (X, Y) => { x.fillStyle = 'rgba(28,30,35,.2)'; x.fillRect(X - pw / 2, Y - ph / 2, pw, ph); x.strokeStyle = 'rgba(10,10,12,.3)'; x.lineWidth = 1.2; x.strokeRect(X - pw / 2, Y - ph / 2, pw, ph); }); }
    // skid marks: faint paired arcs, someone braked late
    for (let i = 0; i < 3; i++) {
      const u = w * (.25 + R() * .5), y0 = R() * h, len = 80 + R() * 140, bend = (R() - .5) * 40;
      for (const off of [0, 22]) wrap(u + off, y0 + len / 2, len, (X, Y) => { x.strokeStyle = 'rgba(8,8,10,.16)'; x.lineWidth = 5; x.beginPath(); x.moveTo(X, Y - len / 2); x.quadraticCurveTo(X + bend, Y, X + bend * .3, Y + len / 2); x.stroke(); });
    }
    // edge lines: thermoplastic white, chipped and dusted, not a clean vector stripe
    for (const u of [w * .035, w * .965 - 12]) {
      x.fillStyle = '#e9e8e2'; x.fillRect(u, 0, 12, h);
      for (let i = 0; i < 320; i++) { x.fillStyle = R() < .6 ? 'rgba(70,72,78,.4)' : 'rgba(200,185,160,.3)'; const s = 1 + R() * 1.4; x.fillRect(u + R() * 12 - 1, R() * h, s, s); }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(u + 12, 0, 1.5, h);
    }
  }, { repeat: true });
  // Ganuwa: rammed earth 10 m along by 8 m up (canvas foot = ground). Laid in courses, scoured by rain into gullies from
  // the crown down, pitted, damp and grimy at the foot with a fringe of dry grass
  T.ganuwa = canvasTex(512, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b384'); g.addColorStop(.35, '#cc9d6e'); g.addColorStop(.8, '#bb8a5d'); g.addColorStop(1, '#94673f');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 14000, ['rgba(120,75,40,.18)', 'rgba(240,205,160,.18)', 'rgba(90,55,30,.14)', 'rgba(220,180,130,.16)'], 1, 2.5);
    // courses: each lift of earth a slightly different tone, its seam a soft wobbling line
    for (let y = h, k = 0; y > 0; k++) {
      const ch = 34 + R() * 26; y -= ch;
      x.fillStyle = `rgba(${k % 2 ? '255,230,195' : '110,70,40'},${.04 + R() * .04})`; x.fillRect(0, y, w, ch);
      x.strokeStyle = 'rgba(90,55,30,.13)'; x.lineWidth = 1.2; x.beginPath();
      for (let u = 0; u <= w; u += 32) x.lineTo(u, y + Math.sin(u / w * Math.PI * 2) * 1.2 + (R() - .5)); x.stroke();
    }
    // rain gullies: from the crown down, narrowing as they go, shadowed on one side and catching light on the other
    for (let i = 0; i < 26; i++) {
      const u0 = R() * w, len = h * (.15 + R() * .6), wd = 3 + R() * 7;
      for (const dx of [-w, 0, w]) {
        let u = u0 + dx; x.beginPath(); x.moveTo(u, 0);
        const pts = []; for (let y = 0; y <= len; y += 10) { u += (R() - .5) * 4; pts.push([u, y]); }
        x.fillStyle = 'rgba(85,50,25,.28)'; x.beginPath(); pts.forEach(([a, b], j) => { const t = 1 - j / pts.length; j ? x.lineTo(a + wd * t, b) : x.moveTo(a + wd * t, b); }); for (let j = pts.length - 1; j >= 0; j--) x.lineTo(pts[j][0], pts[j][1]); x.fill();
        x.strokeStyle = 'rgba(255,232,200,.22)'; x.lineWidth = 1.2; x.beginPath(); pts.forEach(([a, b], j) => j ? x.lineTo(a - 1, b) : x.moveTo(a - 1, b)); x.stroke();
      }
    }
    // pits where clods fell out
    for (let i = 0; i < 35; i++) { const u = R() * w, y = h * (.1 + R() * .8), r = 1.5 + R() * 3; x.fillStyle = 'rgba(80,48,24,.2)'; x.beginPath(); x.ellipse(u, y, r, r * .7, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,235,205,.18)'; x.beginPath(); x.ellipse(u - 1, y - 1.5, r * .8, r * .4, 0, 0, 7); x.fill(); }
    // sun-bleached crust along the crown, damp and dust at the foot
    const top = x.createLinearGradient(0, 0, 0, h * .08); top.addColorStop(0, 'rgba(250,228,192,.45)'); top.addColorStop(1, 'rgba(250,228,192,0)'); x.fillStyle = top; x.fillRect(0, 0, w, h * .08);
    const foot = x.createLinearGradient(0, h * .82, 0, h); foot.addColorStop(0, 'rgba(60,38,20,0)'); foot.addColorStop(1, 'rgba(60,38,20,.35)'); x.fillStyle = foot; x.fillRect(0, h * .82, w, h * .18);
    x.lineCap = 'round';
    for (let i = 0; i < 260; i++) { const u = R() * w, l = 4 + R() * 12, a = (R() - .5) * .9; x.strokeStyle = R() < .5 ? 'rgba(170,150,70,.6)' : 'rgba(120,110,50,.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(u, h); x.lineTo(u + Math.sin(a) * l, h - Math.cos(a) * l); x.stroke(); }
  }, { repeat: true });
  // circuit kerb: red and white blocks with a painted shadow line at the joints; the mesh gives it a raised crown
  T.curb = canvasTex(64, 128, (x, w, h) => {
    x.fillStyle = '#cf2f2a'; x.fillRect(0, 0, w, h / 2); x.fillStyle = '#eeeeea'; x.fillRect(0, h / 2, w, h / 2);
    speckle(x, w, h, 900, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.08)', 'rgba(120,90,60,.1)'], 1, 2);
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, w, 2); x.fillRect(0, h / 2, w, 2);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, 3, h); x.fillRect(w - 3, 0, 3, h);   // the lips, where it meets asphalt and dirt
  }, { repeat: true });
  // a dust drift where the shoulder blows onto the road: opaque at the edge, gone two metres in
  T.dust = canvasTex(64, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(196,164,120,.6)'); g.addColorStop(.35, 'rgba(196,164,120,.22)'); g.addColorStop(1, 'rgba(196,164,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { const u = Math.pow(R(), 2) * w; x.fillStyle = `rgba(214,186,140,${.25 * (1 - u / w)})`; x.fillRect(u, R() * h, 1 + R() * 2, 1 + R() * 2); }
  }, { repeat: true });
  // deck barrier: concrete inner face with an orange band, hazard stripes on top, concrete outer face
  T.barrier = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#d6d9e1'; x.fillRect(0, 0, w, h); speckle(x, w, h, 2500, ['#cbced7', '#e1e4ea', '#c2c5ce'], 1, 2);
    x.fillStyle = '#ff6a00'; x.fillRect(w * .2, 0, w * .06, h);
    hazard(x, w * .34, 0, w * .32, h, 16);
    x.fillStyle = 'rgba(30,40,80,.12)'; x.fillRect(w * .7, 0, w * .3, h);
  }, { repeat: true });
  T.kicker = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#ff6a00'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { const y = 18 + i * 36; x.beginPath(); x.moveTo(20, y + 24); x.lineTo(w / 2, y); x.lineTo(w - 20, y + 24); x.lineTo(w - 20, y + 34); x.lineTo(w / 2, y + 10); x.lineTo(20, y + 34); x.fill(); }
    hazard(x, 0, h - 12, w, 12, 10);
  });
  T.checker = canvasTex(256, 32, (x) => {
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#15161b' : '#f8f9fc'; x.fillRect(i * 8, j * 8, 8, 8); }
  });
  T.mud = canvasTex(256, 256, plaster, { repeat: true });
  T.mudDeco = canvasTex(512, 512, (x, w, h) => {
    plaster(x, w, h);
    x.strokeStyle = 'rgba(60,40,25,.18)'; x.lineWidth = 9; x.beginPath();
    for (let i = 0; i <= w / 28; i++) x.lineTo(i * 28, 46 + (i % 2 ? 14 : -14)); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.beginPath();
    for (let i = 0; i <= w / 28; i++) x.lineTo(i * 28, 42 + (i % 2 ? 14 : -14)); x.stroke();
    x.fillStyle = '#ffffff'; x.fillRect(0, 76, w, 6); x.fillRect(0, 14, w, 5);
    starKnot(x, w * .27, h * .5, 120); loopKnot(x, w * .75, h * .52, 100);
  }, { repeat: true });
  T.ground = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 9000, ['#e4e4e4', '#ffffff', '#d6d6d6', '#ececec', '#cbcbcb'], 1, 3);
  }, { repeat: true });
  // the sand shoulder, from the kerb (left) out to the embankment (right), 10 m along: packed and darker by the kerb where
  // karts run wide, tyre tracks along it, loose stones, dry grass growing thicker the further from the road
  T.dirt = canvasTex(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#d9ccb2'); g.addColorStop(.3, '#ece2cd'); g.addColorStop(1, '#f2e9d8');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 16000, ['rgba(170,140,100,.14)', 'rgba(255,250,238,.2)', 'rgba(140,110,75,.12)', 'rgba(220,200,165,.18)'], 1, 2.5);
    for (let i = 0; i < 40; i++) { const px = R() * w, py = R() * h, rx = 15 + R() * 40, ry = 30 + R() * 90; x.fillStyle = `rgba(${R() < .5 ? '150,120,85' : '255,248,232'},.06)`; for (const dy of [-h, 0, h]) { x.beginPath(); x.ellipse(px, py + dy, rx, ry, 0, 0, 7); x.fill(); } }
    // tyre tracks: two pairs of faint ruts running the length of the tile
    for (const u0 of [w * .12, w * .3]) for (const off of [0, w * .07]) {
      const u = u0 + off; x.strokeStyle = 'rgba(120,95,65,.12)'; x.lineWidth = 5; x.beginPath();
      for (let y = 0; y <= h; y += 16) x.lineTo(u + Math.sin(y / h * Math.PI * 2) * 4, y); x.stroke();
      x.strokeStyle = 'rgba(255,250,240,.12)'; x.lineWidth = 1.5; x.beginPath(); for (let y = 0; y <= h; y += 16) x.lineTo(u + 3 + Math.sin(y / h * Math.PI * 2) * 4, y); x.stroke();
    }
    // loose stones, each with its shadow
    for (let i = 0; i < 160; i++) { const px = R() * w, py = R() * h, r = 1 + R() * 2.4; x.fillStyle = 'rgba(90,70,45,.35)'; x.beginPath(); x.ellipse(px + 1, py + 1.2, r, r * .8, 0, 0, 7); x.fill(); x.fillStyle = ['#b9a78a', '#cfc2aa', '#a8957a', '#ddd2bd'][(R() * 4) | 0]; x.beginPath(); x.ellipse(px, py, r, r * .8, 0, 0, 7); x.fill(); }
    // dry grass tufts, rare by the road, thick at the far edge
    x.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const u = w * Math.pow(R(), .45), py = R() * h, n = 3 + (R() * 4 | 0), col = ['rgba(176,160,90,.75)', 'rgba(150,140,75,.7)', 'rgba(196,178,110,.7)', 'rgba(130,128,70,.6)'][(R() * 4) | 0];
      if (u < w * .35 && R() < .8) continue;
      x.strokeStyle = col; x.lineWidth = 1.1;
      for (let k = 0; k < n; k++) { const a = (R() - .5) * 1.6, l = 4 + R() * 7; x.beginPath(); x.moveTo(u, py); x.lineTo(u + Math.sin(a) * l, py - Math.cos(a) * l * .7); x.stroke(); }
    }
  }, { repeat: true });
  // raw concrete: formwork panels, tie holes, grime at the foot, one reflective safety stripe
  T.tunnel = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8f939b'; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 6000, ['#868a92', '#999da5', '#7f838b', '#a2a6ad'], 1, 3);
    x.fillStyle = 'rgba(40,40,45,.35)'; for (let i = 0; i <= 4; i++) x.fillRect(i * 64 - 1, 0, 3, h);
    x.fillStyle = 'rgba(40,40,45,.18)'; for (let j = 1; j < 4; j++) x.fillRect(0, j * 64, w, 2);
    x.fillStyle = 'rgba(30,30,35,.5)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 64 + 16, j * 64 + 16, 2.5, 0, 7); x.arc(i * 64 + 48, j * 64 + 48, 2.5, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, h * .7, 0, h); g.addColorStop(0, 'rgba(40,35,30,0)'); g.addColorStop(1, 'rgba(40,35,30,.45)'); x.fillStyle = g; x.fillRect(0, h * .7, w, h * .3);
    x.fillStyle = '#ffc400'; x.fillRect(0, h * .78, w, 6);
  }, { repeat: true });
  T.water = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(200,235,255,.9)'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 10, py - 4, px + 22, py); x.stroke(); }
  }, { repeat: true });
  T.glow = canvasTex(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  T.dust = canvasTex(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  T.ring = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, w * .3, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.75, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  // weapon crate: a navy case with cyan edges and an orange mark
  T.box = canvasTex(128, 128, (x, w) => {
    x.fillStyle = 'rgba(20,32,80,.75)'; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#6fd3ff'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, w - 12);
    x.fillStyle = '#6fd3ff'; for (const [a, b] of [[6, 6], [w - 22, 6], [6, w - 22], [w - 22, w - 22]]) x.fillRect(a, b, 16, 16);
    x.fillStyle = '#ff6a00'; x.font = `800 italic 76px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', w / 2, w / 2 + 4);
  });
  T.pad = canvasTex(128, 192, (x, w, h) => {
    x.fillStyle = 'rgba(10,20,60,.85)'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const y = 20 + i * 58; x.fillStyle = ['#6fd3ff', '#9fe4ff', '#ffffff'][i];
      x.beginPath(); x.moveTo(14, y); x.lineTo(w / 2, y + 40); x.lineTo(w - 14, y); x.lineTo(w - 14, y + 18); x.lineTo(w / 2, y + 58); x.lineTo(14, y + 18); x.closePath(); x.fill();
    }
    x.strokeStyle = '#6fd3ff'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
  });
  T.flag = canvasTex(96, 64, (x, w, h) => { x.fillStyle = '#008751'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.fillRect(w / 3, 0, w / 3, h); });
  T.plate = canvasTex(128, 64, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f8a4c'; x.lineWidth = 5; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = '#1f8a4c'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText('KANO', w / 2, 18);
    x.fillStyle = '#1d2a6b'; x.font = 'bold 26px sans-serif'; x.fillText('GUK 001', w / 2, 46);
    x.fillStyle = '#1f8a4c'; x.font = 'bold 9px sans-serif'; x.fillText('CENTRE OF COMMERCE', w / 2, 58);
  });
  T.adire = [0, 1, 2].map(v => canvasTex(128, 192, (x, w, h) => {
    x.fillStyle = ['#1d2a6b', '#162058', '#26338a'][v]; x.fillRect(0, 0, w, h);
    x.strokeStyle = x.fillStyle = 'rgba(225,232,255,.85)'; x.lineWidth = 3;
    if (v === 0) for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 10, 0, 7); x.stroke(); x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 3, 0, 7); x.fill(); }
    if (v === 1) for (let j = 0; j < 12; j++) { x.beginPath(); for (let i = 0; i <= w / 10; i++) x.lineTo(i * 10, 8 + j * 16 + (i % 2 ? 5 : -5)); x.stroke(); }
    if (v === 2) for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { x.strokeRect(6 + i * 32, 6 + j * 32, 20, 20); x.beginPath(); x.moveTo(6 + i * 32, 6 + j * 32); x.lineTo(26 + i * 32, 26 + j * 32); x.stroke(); }
  }));
  return T;
}

// gate plaque: navy panel, white condensed letters, orange edge tag
// a gantry sign; arrow -1 or 1 puts our own arrow (never a text glyph) on that side of the words, pointing that way
// a road sign: Kano's are navy with orange ends; Doha's ('doha') are maroon with gold, in the gateway's colours
export function signTex(text, arrow = 0, style = 'kano'){
  const dq = style === 'doha';
  return canvasTex(1024, 160, (x, w, h) => {
    x.fillStyle = dq ? '#7a1430' : '#0f1a42'; x.fillRect(0, 0, w, h);
    x.fillStyle = dq ? '#d9b25a' : '#ff6a00'; x.fillRect(0, 0, 26, h); x.fillRect(w - 26, 0, 26, h);
    x.strokeStyle = dq ? '#d9b25a' : '#6fd3ff'; x.lineWidth = 4; x.strokeRect(36, 12, w - 72, h - 24);
    x.fillStyle = '#ffffff'; x.font = `800 italic 92px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const s = 3.6, aw = 24 * s, gap = 28, tw = x.measureText(text).width, full = tw + (arrow ? aw + gap : 0);
    const tx = w / 2 - full / 2 + (arrow < 0 ? aw + gap : 0) + tw / 2;
    x.fillText(text, tx, h / 2 + 4);
    if (arrow) {
      const ax = arrow < 0 ? w / 2 - full / 2 : w / 2 + full / 2 - aw;
      x.save(); x.translate(ax + (arrow < 0 ? aw : 0), h / 2 - 12 * s); x.scale(arrow < 0 ? -s : s, s); x.fill(new Path2D(ARROW)); x.restore();
    }
  });
}
