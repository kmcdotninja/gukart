// Doha's own road kit, so its underground and its roadside are Doha's and not Kano's carried over:
//  - road signs as Qatar has them: blue, a white border, Arabic over English
//  - the underpass: walls in pale limestone panels over a dark granite skirting, an eight-point star band (the
//    geometry on Qatari screens and doors) at eye level with gold rules, warm white light lines, a pale ceiling
//  - the portals: golden sandstone with a mashrabiya lattice over the opening
//  - the subway is a Doha Metro station: golden sandstone outside; inside, glass platform screen doors along both
//    sides with the platform lit behind them, the station's name on the glass, and a vaulted ceiling of triangular
//    facets with a mother-of-pearl sheen
import * as THREE from 'three';
import { ARROW } from './icons.js';

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const ARABIC = '"Geeza Pro", "Noto Kufi Arabic", "Noto Naskh Arabic", "Arial", sans-serif';
export const SAND = '#d9b886',
  SAND_DARK = '#b8935e',
  STONE = '#efe5d2',
  GRANITE = '#4b3f3b',
  GOLD = '#c9a24a',
  QA_BLUE = '#1c4a96';
// (Qatar's signs are colour coded: blue for districts, brown for tourist places, sports grounds and public buildings)
export const QA_BROWN = '#6b3d1c';

function tex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// an eight-point star (two squares, one turned 45 degrees), the unit of the lattice
function star(x, cx, cy, r) {
  x.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8 - Math.PI / 2,
      rr = k % 2 ? r * 0.62 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

// names in Arabic, for the signs
export const AR = {
  MSHEIREB: 'مشيرب',
  'THE PEARL': 'اللؤلؤة',
  LUSAIL: 'لوسيل',
  DOHA: 'الدوحة',
  UNDERPASS: 'نفق',
  'UNDERPASS AHEAD': 'نفق أمامك',
  STATION: 'محطة',
  'SKY BRIDGE': 'الجسر',
  SUBWAY: 'محطة المترو',
  'AQUARIUM TUNNEL': 'نفق الأكواريوم',
};
export function arabicFor(en) {
  if (AR[en]) return AR[en];
  for (const [k, v] of [
    [' UNDERPASS', 'UNDERPASS'],
    [' STATION', 'STATION'],
  ])
    if (en.endsWith(k)) {
      const n = en.slice(0, -k.length);
      return `${AR[v]} ${AR[n] || ''}`.trim();
    }
  return '';
}

// a Qatar road sign: blue, white border, Arabic on top, English under it, an arrow if it points a way
export function qaSign(en, arrow = 0, ar = arabicFor(en), bg = QA_BLUE) {
  return tex(
    1024,
    260,
    (x, w, h) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffffff';
      x.lineWidth = 8;
      x.strokeRect(14, 14, w - 28, h - 28);
      x.fillStyle = '#ffffff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      const aw = arrow ? 110 : 0,
        cx = w / 2 + (arrow < 0 ? aw / 2 : arrow > 0 ? -aw / 2 : 0);
      if (ar) {
        x.font = `700 74px ${ARABIC}`;
        x.direction = 'rtl';
        x.fillText(ar, cx, 82);
        x.direction = 'ltr';
      }
      x.font = `700 84px ${FONT}`;
      x.fillText(en, cx, ar ? 182 : h / 2 + 4);
      if (arrow) {
        const s = 4,
          ax = arrow < 0 ? 60 : w - 60 - 24 * s;
        x.save();
        x.translate(ax + (arrow < 0 ? 24 * s : 0), h / 2 - 12 * s);
        x.scale(arrow < 0 ? -s : s, s);
        x.fill(new Path2D(ARROW));
        x.restore();
      }
    },
    false,
  );
}

// the underpass wall. The strip maps u up the wall (0 at the road, 1 at the top) and v along the road (6 m a tile), so
// the canvas is drawn with x going UP the wall (8 m over 512 px) and y along the road (6 m over 384 px)
export function underpassWall() {
  return tex(512, 384, (x, w, h) => {
    const m = w / 8; // px per metre up the wall
    x.fillStyle = STONE;
    x.fillRect(0, 0, w, h);
    // limestone panels: joints every 1.6 m up, every 3 m along, a faint grain in each
    for (let py = 0; py < h; py += h / 2)
      for (let px = 0; px < w; px += 1.6 * m) {
        const g = x.createLinearGradient(px, py, px + 1.6 * m, py + h / 2);
        g.addColorStop(0, 'rgba(255,255,255,.18)');
        g.addColorStop(1, 'rgba(120,90,50,.08)');
        x.fillStyle = g;
        x.fillRect(px, py, 1.6 * m, h / 2);
      }
    x.strokeStyle = 'rgba(120,95,60,.35)';
    x.lineWidth = 2;
    for (let px = 0; px <= w; px += 1.6 * m) {
      x.beginPath();
      x.moveTo(px, 0);
      x.lineTo(px, h);
      x.stroke();
    }
    for (let py = 0; py <= h; py += h / 2) {
      x.beginPath();
      x.moveTo(0, py);
      x.lineTo(w, py);
      x.stroke();
    }
    // granite skirting at the foot, 0.9 m
    x.fillStyle = GRANITE;
    x.fillRect(0, 0, 0.9 * m, h);
    x.fillStyle = 'rgba(255,255,255,.08)';
    for (let k = 0; k < 140; k++) x.fillRect(Math.random() * 0.9 * m, Math.random() * h, 2, 2);
    // the star band, 2.4 to 3.6 m up, gold rules either side
    const b0 = 2.4 * m,
      b1 = 3.6 * m;
    x.fillStyle = '#e4d3b2';
    x.fillRect(b0, 0, b1 - b0, h);
    x.fillStyle = GOLD;
    x.fillRect(b0 - 6, 0, 5, h);
    x.fillRect(b1 + 1, 0, 5, h);
    const r = (b1 - b0) * 0.38,
      step = h / 6;
    x.strokeStyle = SAND_DARK;
    x.lineWidth = 4;
    x.fillStyle = STONE;
    for (let k = 0; k < 6; k++) {
      star(x, (b0 + b1) / 2, k * step + step / 2, r);
      x.fill();
      x.stroke();
    }
    x.strokeStyle = 'rgba(184,147,94,.6)';
    x.lineWidth = 2;
    for (let k = 0; k <= 6; k++) {
      const cy = k * step;
      x.beginPath();
      x.moveTo(b0, cy);
      x.lineTo((b0 + b1) / 2, cy + step / 2);
      x.lineTo(b1, cy);
      x.stroke();
    }
  });
}

// the lattice over a portal: eight-point stars joined in a grid, cut out (transparent between), in sandstone
export function lattice(color = '#f3e6cc') {
  return tex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = color;
    x.strokeStyle = color;
    x.lineWidth = 10;
    const s = w / 2;
    for (const [cx, cy] of [
      [0, 0],
      [s, 0],
      [w, 0],
      [0, s],
      [s, s],
      [w, s],
      [0, h],
      [s, h],
      [w, h],
    ]) {
      star(x, cx, cy, s * 0.42);
      x.stroke();
    }
    for (const [cx, cy] of [
      [s / 2, s / 2],
      [s * 1.5, s / 2],
      [s / 2, s * 1.5],
      [s * 1.5, s * 1.5],
    ]) {
      x.beginPath();
      x.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
      x.fill();
    }
    x.lineWidth = 8;
    for (let k = 0; k <= 2; k++) {
      x.beginPath();
      x.moveTo(0, k * s);
      x.lineTo(w, k * s);
      x.stroke();
      x.beginPath();
      x.moveTo(k * s, 0);
      x.lineTo(k * s, h);
      x.stroke();
    }
  });
}

// the divider down the middle of the underpass: white concrete, a gold reflector line
export function dividerTex() {
  return tex(256, 64, (x, w, h) => {
    x.fillStyle = '#e9e6e0';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.08)';
    x.fillRect(0, h - 10, w, 10);
    x.fillStyle = GOLD;
    x.fillRect(0, 20, w, 5);
    for (let k = 0; k < w; k += 64) {
      x.fillStyle = '#ffcf5a';
      x.fillRect(k + 28, 18, 8, 9);
    }
  });
}

// the metro station wall. u runs up the wall (9 m over 576 px), v along it (24 m a tile over 768 px).
// Granite plinth, then the platform: glass screen doors in steel frames with the lit platform and its people behind,
// the station's name on a panel over every other door, then the pearl wall above
export function metroWall(name) {
  return tex(576, 768, (x, w, h) => {
    const m = w / 9;
    // pearl above, a slow iridescent wash
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f6eee6');
    g.addColorStop(0.3, '#e9eef6');
    g.addColorStop(0.55, '#f4e8ee');
    g.addColorStop(0.8, '#eaf3ef');
    g.addColorStop(1, '#f6eee6');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(160,150,170,.25)';
    x.lineWidth = 2; // triangular facets
    for (let py = 0; py < h; py += 96)
      for (let px = 4.6 * m; px < w; px += 1.4 * m) {
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + 1.4 * m, py + 48);
        x.lineTo(px, py + 96);
        x.stroke();
      }
    // the plinth and the platform edge
    x.fillStyle = GRANITE;
    x.fillRect(0, 0, 1 * m, h);
    x.fillStyle = '#ffd34a';
    x.fillRect(1 * m - 6, 0, 6, h); // the yellow tactile line
    // the glass screen doors, 1 m to 3.4 m, a bay every 4 m along
    const g0 = 1 * m,
      g1 = 3.4 * m,
      bay = h / 6;
    for (let k = 0; k < 6; k++) {
      const y0 = k * bay;
      const lg = x.createLinearGradient(g0, 0, g1, 0);
      lg.addColorStop(0, '#6d7f8f');
      lg.addColorStop(0.25, '#c9e2ee');
      lg.addColorStop(1, '#f2f6f8');
      x.fillStyle = lg;
      x.fillRect(g0, y0 + 8, g1 - g0, bay - 16);
      // the platform behind the glass: its floor, a warm light band along its back wall
      x.fillStyle = 'rgba(214,200,176,.55)';
      x.fillRect(g0, y0 + 8, 0.35 * m, bay - 16);
      x.fillStyle = 'rgba(255,236,196,.6)';
      x.fillRect(g0 + 1.7 * m, y0 + 8, 0.12 * m, bay - 16);
      x.fillStyle = '#9aa3ad';
      x.fillRect(g0, y0, g1 - g0, 8);
      x.fillRect(g0, y0 + bay / 2 - 2, g1 - g0, 4); // frames, the door split
      // the name panel over the doors on every other bay: dark, red line rule, the name
      if (k % 2 === 0) {
        x.save();
        x.translate(g1 + 0.2 * m, y0 + bay / 2);
        x.rotate(Math.PI / 2); // text reads along the wall
        x.fillStyle = '#1d2230';
        x.fillRect(-bay * 0.45, -0.75 * m, bay * 0.9, 0.75 * m);
        x.fillStyle = '#d4232f';
        x.fillRect(-bay * 0.45, -0.12 * m, bay * 0.9, 0.12 * m); // the line's colour
        x.fillStyle = '#ffffff';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.font = `700 ${Math.round(0.42 * m)}px ${FONT}`;
        x.fillText(name, 0, -0.42 * m);
        x.restore();
      }
    }
    // a warm light line along the top of the doors
    x.fillStyle = '#fff3d8';
    x.fillRect(g1 + 1.3 * m, 0, 8, h);
  });
}

// the vault's surface: mother-of-pearl over triangular facets
export function pearlTex() {
  return tex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f7efe8');
    g.addColorStop(0.35, '#e6eef8');
    g.addColorStop(0.6, '#f5e7ef');
    g.addColorStop(1, '#e8f4ee');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(150,140,165,.35)';
    x.lineWidth = 3;
    for (let k = -1; k <= 4; k++) {
      x.beginPath();
      x.moveTo(k * 64, 0);
      x.lineTo(k * 64 + 128, h);
      x.stroke();
      x.beginPath();
      x.moveTo(k * 64 + 128, 0);
      x.lineTo(k * 64, h);
      x.stroke();
    }
  });
}

// the pavement: interlocking pavers in two sands, laid in herringbone, a darker band of granite setts at the kerb.
// The shoulder strip maps u across (kerb to the pavement's far edge, 9 m) and v along the road (10 m a tile)
export function paverTex() {
  return tex(512, 512, (x, w, h) => {
    x.fillStyle = '#d8ccb6';
    x.fillRect(0, 0, w, h);
    const u = 16; // one paver is 2u x u
    for (let y = -u * 2; y < h + u * 2; y += u)
      for (let xx = -u * 2; xx < w + u * 2; xx += u * 2) {
        const k = (y / u) | 0,
          off = (k % 2) * u,
          tone = 205 + ((((Math.sin(xx * 12.9 + y * 78.2) * 43758.5) % 1) + 1) % 1) * 22;
        x.fillStyle = `rgb(${tone},${tone - 12},${tone - 32})`;
        if (k % 4 < 2) x.fillRect(xx + off, y, u * 2 - 2, u - 2);
        else x.fillRect(xx + off, y, u - 2, u * 2 - 2);
      }
    x.fillStyle = '#8f8a84';
    x.fillRect(0, 0, 40, h); // granite setts along the kerb
    x.strokeStyle = 'rgba(0,0,0,.18)';
    x.lineWidth = 2;
    for (let y = 0; y < h; y += 20) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(40, y);
      x.stroke();
    }
  });
}
// a plain concrete kerb, its face a shade darker, joints every metre
export function kerbTex() {
  return tex(128, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#bfbcb5');
    g.addColorStop(0.5, '#dedbd4');
    g.addColorStop(1, '#c9c6bf');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.2)';
    for (let y = 0; y < h; y += 32) x.fillRect(0, y, w, 2);
  });
}
