// Photo mode, from the results: the moment frozen, a free camera round your kart (drag to turn it round and up or
// down, pinch or scroll to come nearer). The shutter prints it as a page from a travel journal: the Polaroid (the shot
// square in a white frame, the Gukart logo, the circuit and your place along the bottom) tilted on a kraft-paper card,
// the city's visa stamp inked over its corner, a Gukart boarding pass peeking out above, tape, a paper clip and a
// ticket stub, a silver sticker and a push pin. It drops in on screen; SAVE shares it on a phone or downloads it on a computer. BACK, or Escape, returns to the results. The camera is in src/camera.js ('photo').
import { $, show, hide } from './dom.js';
import { game, chapter } from './game.js';
import { scene, cam, renderer } from './scene.js';
import { Sound } from './audio.js';
import { clamp, fmtTime } from './util.js';
import { drawLogo } from './textures.js';
import { LAPS } from './race.js';
import { drawStamp, STAMP_INK, wear } from './stamps.js';

function enter() {
  if (game.state !== 'results') return;
  game.state = 'photo';
  game.photo = { yaw: 0.7, pitch: 0.22, dist: 6.5 };
  hide($('#results'));
  show($('#photo'));
}
function leave() {
  if (game.state !== 'photo') return;
  $('#phPrint').hidden = true;
  game.state = 'results';
  hide($('#photo'), null, -1);
  show($('#results'), -1);
}
// the Polaroid: a square crop of the shot in a white frame, the deep strip at the bottom with the logo, the circuit,
// your place and the day, a little warm grain over the picture like film
function polaroid(src) {
  const S = 1080,
    B = 56,
    PH = S - B * 2,
    FOOT = 250,
    c = document.createElement('canvas');
  c.width = S;
  c.height = B + PH + FOOT;
  const x = c.getContext('2d');
  x.fillStyle = '#fbf8f1';
  x.fillRect(0, 0, c.width, c.height);
  // the shot, the middle square of it
  const side = Math.min(src.width, src.height);
  x.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, B, B, PH, PH);
  // film: warmer, a soft vignette, a faint grain
  x.fillStyle = 'rgba(255, 196, 120, 0.07)';
  x.fillRect(B, B, PH, PH);
  const v = x.createRadialGradient(S / 2, B + PH / 2, PH * 0.35, S / 2, B + PH / 2, PH * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  x.fillStyle = v;
  x.fillRect(B, B, PH, PH);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
    x.fillRect(B + Math.random() * PH, B + Math.random() * PH, 2, 2);
  }
  x.strokeStyle = 'rgba(0,0,0,0.12)';
  x.lineWidth = 2;
  x.strokeRect(B, B, PH, PH);
  const y = B + PH + FOOT / 2;
  // the logo on the left; your place and the day on the right (the circuit is on the ticket, the city on the stamp,
  // the time on the receipt)
  drawLogo(x, B + 170, y, 128);
  const place = game.race?.player?.rank,
    day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  x.textAlign = 'right';
  if (game.mode === 'gp' && place) {
    x.fillStyle = '#1b2350';
    x.font = 'italic 800 76px "Barlow Condensed", "Arial Narrow", sans-serif';
    x.fillText(`${place}${['ST', 'ND', 'RD'][place - 1] || 'TH'} PLACE`, S - B - 6, y + 4);
  }
  x.fillStyle = '#ff6a00';
  x.font = 'italic 800 46px "Barlow Condensed", "Arial Narrow", sans-serif';
  x.fillText(day, S - B - 6, y + 60);
  return c;
}
// a little noise over a filled area, so paper looks like paper
function grain(x, X, Y, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,40,20'},${a})`;
    x.fillRect(X + Math.random() * w, Y + Math.random() * h, 2, 2);
  }
}
// a torn edge: a path round a rectangle whose chosen sides are ragged (t, r, b, l), as paper torn by hand
function torn(x, X, Y, w, h, sides = 'trbl', j = 7) {
  const pts = [],
    edge = (ax, ay, bx, by, rag) => {
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 9));
      for (let i = 0; i < n; i++) {
        const t = i / n,
          px = ax + (bx - ax) * t,
          py = ay + (by - ay) * t,
          o = rag ? (Math.random() - 0.5) * j * 2 : 0;
        pts.push([px + (ay === by ? 0 : o), py + (ay === by ? o : 0)]);
      }
    };
  edge(X, Y, X + w, Y, sides.includes('t'));
  edge(X + w, Y, X + w, Y + h, sides.includes('r'));
  edge(X + w, Y + h, X, Y + h, sides.includes('b'));
  edge(X, Y + h, X, Y, sides.includes('l'));
  x.beginPath();
  pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
}
// paper with a soft shadow under it, filled with its colour, then a grain
function paper(x, path, fill, shadow = 0.3) {
  x.save();
  x.shadowColor = `rgba(40,25,10,${shadow})`;
  x.shadowBlur = 16;
  x.shadowOffsetY = 6;
  path();
  x.fillStyle = fill;
  x.fill();
  x.restore();
}
// the city's passport stamp (src/stamps.js: each city its own shape, landmark and words), pressed crooked, specks of
// ink missing. The city's own colour on a light photo, white on a dark one, so it always reads
function visaStamp(dst, cx, cy, ink) {
  // (drawn on a layer of its own, so the worn specks take ink off the stamp, not holes out of the photo under it)
  const L = 460,
    oc = document.createElement('canvas');
  oc.width = oc.height = L;
  const x = oc.getContext('2d');
  x.translate(L / 2, L / 2);
  x.rotate(-0.2);
  x.strokeStyle = x.fillStyle = ink;
  x.globalAlpha = 0.92;
  drawStamp(x, chapter.id, chapter.name.toUpperCase());
  x.globalAlpha = 1;
  wear(x, L, L); // (pressed by hand: uneven ink, ragged edges, specks)
  dst.drawImage(oc, cx - L * 0.47, cy - L * 0.47, L * 0.94, L * 0.94);
}
function paperClip(x, X, Y, h, rot) {
  x.save();
  x.translate(X, Y);
  x.rotate(rot);
  x.lineCap = 'round';
  const w = h * 0.3,
    path = () => {
      x.beginPath();
      x.moveTo(w * 0.25, h * 0.75);
      x.lineTo(w * 0.25, h * 0.2);
      x.arc(0, h * 0.2, w * 0.25, 0, Math.PI, true);
      x.lineTo(-w * 0.25, h * 0.85);
      x.arc(w * 0.1, h * 0.85, w * 0.35, Math.PI, 0, true);
      x.lineTo(w * 0.45, h * 0.05);
      x.arc(0, h * 0.05, w * 0.45, 0, Math.PI, true);
      x.lineTo(-w * 0.45, h * 0.6);
    };
  x.shadowColor = 'rgba(0,0,0,0.35)';
  x.shadowBlur = 6;
  x.shadowOffsetY = 3;
  x.strokeStyle = '#8f98a3';
  x.lineWidth = 8;
  path();
  x.stroke();
  x.shadowColor = 'transparent';
  x.strokeStyle = 'rgba(255,255,255,0.7)';
  x.lineWidth = 2.5;
  path();
  x.stroke();
  x.restore();
}
// washi tape: a translucent strip with ragged torn ends
function tape(x, cx, cy, w, h, rot, col) {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  torn(x, -w / 2, -h / 2, w, h, 'lr', 5);
  x.fillStyle = col;
  x.fill();
  x.globalAlpha = 0.35;
  x.strokeStyle = '#fff';
  x.lineWidth = 2;
  for (let i = -w / 2; i < w / 2; i += 16) {
    x.beginPath();
    x.moveTo(i, -h / 2);
    x.lineTo(i + 10, h / 2);
    x.stroke();
  }
  x.restore();
}
// the page, after the reference: kraft folder, a boarding pass behind it, a torn map scrap, the Polaroid, a receipt, a
// pink ticket under a clip, tape, the stamp, a silver sticker and a push pin. Nothing said twice
function journal(pol) {
  const W = 1200,
    H = 1600,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d'),
    F = (w, n) => `italic ${w} ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`,
    MONO = n => `600 ${n}px "Courier New", monospace`,
    circ = (game.circuit?.name || chapter.name).toUpperCase(),
    P = game.race?.player;
  const at = (X, Y, r, f) => {
    x.save();
    x.translate(X, Y);
    x.rotate(r);
    f();
    x.restore();
  };
  // the boarding pass, behind the folder at the top
  at(150, 30, -0.03, () => {
    paper(x, () => (x.beginPath(), x.roundRect(0, 0, 820, 240, 16)), '#f4f1ea', 0.2);
    x.fillStyle = '#1b2350';
    x.fillRect(600, 0, 220, 240);
    x.fillStyle = '#fff';
    x.font = F(800, 38);
    x.fillText('GUKART AIR', 625, 66);
    x.fillStyle = '#222';
    for (let i = 0; i < 40; i++) x.fillRect(40 + i * 11, 22, Math.random() < 0.5 ? 3 : 7, 52);
    x.font = MONO(24);
    x.fillText('BOARDING PASS', 40, 104);
  });
  // the kraft folder
  paper(x, () => (x.beginPath(), x.roundRect(60, 150, W - 120, H - 200, 30)), '#c49a66', 0.35);
  grain(x, 60, 150, W - 120, H - 200, 30000, 0.07);
  // a torn map scrap on the left: pale sea, a coast, the tour's cities
  at(40, 640, -0.06, () => {
    paper(x, () => torn(x, 0, 0, 380, 470, 'trbl', 8), '#e8e1cc');
    x.save();
    torn(x, 0, 0, 380, 470, '', 0);
    x.clip();
    x.fillStyle = '#cfe0dc';
    x.fillRect(0, 0, 380, 470);
    x.fillStyle = '#e9d9b6';
    x.beginPath();
    x.moveTo(0, 60);
    x.bezierCurveTo(140, 40, 220, 160, 170, 260);
    x.bezierCurveTo(120, 360, 260, 420, 380, 400);
    x.lineTo(380, 470);
    x.lineTo(0, 470);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(80,90,90,0.35)';
    x.lineWidth = 1;
    for (let g = 0; g < 380; g += 46) (x.beginPath(), x.moveTo(g, 0), x.lineTo(g, 470), x.stroke());
    for (let g = 0; g < 470; g += 46) (x.beginPath(), x.moveTo(0, g), x.lineTo(380, g), x.stroke());
    x.fillStyle = '#5a4a3a';
    x.font = 'italic 600 22px Georgia, serif';
    [
      ['Kano', 60, 140],
      ['Kaduna', 90, 330],
      ['Doha', 250, 110],
      ['Singapore', 210, 440],
    ].forEach(([n, a, b]) => (x.beginPath(), x.arc(a - 10, b - 7, 4, 0, 7), x.fill(), x.fillText(n, a, b)));
    x.restore();
  });
  // the Polaroid, tilted
  const s = 0.84,
    pw = pol.width * s,
    ph = pol.height * s,
    PX = W / 2 + 40,
    PY = 200 + ph / 2 + 30;
  at(PX, PY, -0.05, () => {
    x.shadowColor = 'rgba(40,25,10,0.45)';
    x.shadowBlur = 30;
    x.shadowOffsetY = 12;
    x.drawImage(pol, -pw / 2, -ph / 2, pw, ph);
    x.shadowColor = 'transparent';
    // the stamp over the photo's bottom right corner, half on the white frame
    // how light the photo is under the stamp: the city's colour on a light one, white on a dark one
    const SX = pw / 2 - 180,
      SY = ph / 2 - 340,
      sx = pol.width / 2 + SX / s,
      sy = pol.height / 2 + SY / s,
      rr = Math.round(140 / s),
      px = pol.getContext('2d').getImageData(Math.round(sx - rr), Math.round(sy - rr), rr * 2, rr * 2).data;
    // the ink that stands out most: the city's own colour when it contrasts well with the photo there, otherwise
    // white or navy, whichever contrasts more (WCAG contrast of the photo's average colour under the stamp)
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < px.length; i += 16) ((r += px[i]), (g += px[i + 1]), (b += px[i + 2]), n++);
    const lumOf = (R, G, B) => {
        const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(B);
      },
      hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)),
      bgL = lumOf(r / n, g / n, b / n),
      con = h => {
        const L2 = lumOf(...hex(h));
        return (Math.max(L2, bgL) + 0.05) / (Math.min(L2, bgL) + 0.05);
      },
      own = STAMP_INK[chapter.id] || '#c4122f',
      ink = con(own) >= 3.2 ? own : con('#fcfaf4') >= con('#1b2350') ? '#fcfaf4' : '#1b2350';
    visaStamp(x, SX, SY, ink);
    tape(x, pw / 2 - 30, 40, 70, 150, 0.12, 'rgba(165,195,180,0.8)');
  });
  // the receipt at the bottom left, torn top and bottom, clipped
  at(60, 1300, 0.04, () => {
    paper(x, () => torn(x, 0, 0, 330, 250, 'tb', 6), '#fbfaf6');
    x.fillStyle = '#333';
    x.font = MONO(22);
    const rows = [
      ['GUKART RACEWAY', ''],
      ['LAPS', String(LAPS)],
      ['TIME', P && P.finishTime < Infinity ? fmtTime(P.finishTime) : ''],
      ['COINS', P ? String(P.coins) : ''],
      ['THANK YOU', ''],
    ];
    rows.forEach(([a, b], i) => {
      x.textAlign = 'left';
      x.fillText(a, 24, 46 + i * 40);
      x.textAlign = 'right';
      x.fillText(b, 306, 46 + i * 40);
    });
    x.textAlign = 'left';
  });
  paperClip(x, 120, 1268, 140, -0.1);
  // the pink ticket at the top right, under a clip
  at(860, 290, 0.32, () => {
    paper(x, () => torn(x, 0, 0, 280, 130, 'r', 5), '#f2c4c4');
    x.setLineDash([6, 6]);
    x.strokeStyle = '#b77c7c';
    x.lineWidth = 2;
    x.strokeRect(10, 10, 250, 110);
    x.setLineDash([]);
    x.fillStyle = '#5a2430';
    x.font = MONO(26);
    x.fillText('ADMIT ONE', 26, 52);
    x.font = F(800, 30);
    x.fillText(`${circ} GP`, 26, 96);
  });
  paperClip(x, 1105, 300, 160, 0.32);
  // a brushed-silver sticker over the Polaroid's bottom right corner, half on the kraft
  at(930, 1400, -0.06, () => {
    paper(x, () => (x.beginPath(), x.roundRect(-150, -80, 300, 160, 18)), '#b9bec4', 0.4);
    const m = x.createLinearGradient(-150, -80, 150, 80);
    m.addColorStop(0, 'rgba(255,255,255,0.55)');
    m.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    m.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    m.addColorStop(1, 'rgba(90,95,100,0.3)');
    x.fillStyle = m;
    x.beginPath();
    x.roundRect(-150, -80, 300, 160, 18);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let i = -80; i < 80; i += 3) (x.beginPath(), x.moveTo(-148, i), x.lineTo(148, i), x.stroke());
    x.fillStyle = '#26292e';
    x.font = F(800, 26);
    x.fillText('*WORLD TOUR', -126, -38);
    x.font = F(900, 92);
    x.fillText('S1', -126, 52);
    x.fillRect(46, -40, 12, 84);
    x.fillRect(72, -40, 12, 84);
    x.font = F(800, 18);
    x.fillText('PLAY NOW', 30, 64);
  });
  // a red push pin through the Polaroid's top left corner, seen from the side like a real one: the flange on the
  // paper, the body tapering up to a round head, leaning over, its shadow falling away to the side
  at(250, 300, 0, () => {
    // the shadow, long and soft, cast down and to the right
    x.save();
    x.filter = 'blur(6px)';
    x.fillStyle = 'rgba(30,15,5,0.45)';
    x.beginPath();
    x.moveTo(-6, 4);
    x.quadraticCurveTo(40, 30, 78, 52);
    x.arc(78, 40, 18, Math.PI / 2, -Math.PI / 2, true);
    x.quadraticCurveTo(40, 8, 6, -4);
    x.fill();
    x.restore();
    x.rotate(-0.38);
    const red = (y0, y1) => {
      const g = x.createLinearGradient(-26, y0, 26, y1);
      g.addColorStop(0, '#ff6f6f');
      g.addColorStop(0.45, '#c3172e');
      g.addColorStop(1, '#5c0614');
      return g;
    };
    // the flange where it meets the paper
    x.fillStyle = '#7d0a1d';
    x.beginPath();
    x.ellipse(0, 0, 20, 7, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = red(-8, 8);
    x.beginPath();
    x.ellipse(0, -3, 20, 7, 0, 0, Math.PI * 2);
    x.fill();
    // the body: a waisted column up to the head
    x.fillStyle = red(-50, 0);
    x.beginPath();
    x.moveTo(-15, -4);
    x.bezierCurveTo(-8, -18, -8, -30, -13, -44);
    x.lineTo(13, -44);
    x.bezierCurveTo(8, -30, 8, -18, 15, -4);
    x.closePath();
    x.fill();
    // the head: a fat rounded cap, lit from the top left
    x.fillStyle = red(-70, -40);
    x.beginPath();
    x.ellipse(0, -50, 26, 14, 0, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.ellipse(0, -58, 24, 12, 0, 0, Math.PI * 2);
    x.fillStyle = red(-72, -46);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.beginPath();
    x.ellipse(-9, -62, 9, 4, -0.3, 0, Math.PI * 2);
    x.fill();
  });
  return c;
}
let print = null; // the last Polaroid, ready to save
function snap() {
  renderer.render(scene, cam); // (read straight after drawing, so the picture is there to read)
  const card = journal(polaroid(renderer.domElement));
  const f = $('#photoFlash');
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
  Sound.blip?.(1800, 0.06, 'square', 0.06, 0.5);
  card.toBlob(blob => {
    if (!blob) return;
    print = blob;
    const img = $('#phPrintImg');
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    const pr = $('#phPrint');
    pr.hidden = false;
    pr.classList.remove('in');
    void pr.offsetWidth;
    pr.classList.add('in');
  }, 'image/png');
}
async function save() {
  if (!print) return;
  const file = new File([print], 'gukart.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: 'Gukart' });
  } catch {
    return; // (they closed the share sheet)
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(print);
  a.download = 'gukart.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function initPhoto() {
  $('#photoBtn').addEventListener('click', enter);
  $('#photoBack').addEventListener('click', leave);
  $('#photoSnap').addEventListener('click', snap);
  $('#phSave').addEventListener('click', save);
  $('#phClose').addEventListener('click', () => {
    $('#phPrint').hidden = true;
  });
  addEventListener('keydown', e => {
    if (game.state === 'photo' && e.code === 'Escape') leave();
  });
  // drag to turn the camera round (and up and down); two fingers apart or together, or the wheel, to come nearer
  const pad = $('#photo'),
    pts = new Map();
  let pinch = 0;
  pad.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.target.closest('#phPrint')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pad.setPointerCapture(e.pointerId);
  });
  pad.addEventListener('pointermove', e => {
    const q = pts.get(e.pointerId);
    if (!q || !game.photo) return;
    const ph = game.photo;
    if (pts.size === 1) {
      ph.yaw -= (e.clientX - q.x) * 0.008;
      ph.pitch = clamp(ph.pitch + (e.clientY - q.y) * 0.005, -0.05, 1.3);
    }
    q.x = e.clientX;
    q.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) ph.dist = clamp(ph.dist * (pinch / d), 3, 22);
      pinch = d;
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    pinch = 0;
  };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener(
    'wheel',
    e => {
      if (!game.photo) return;
      e.preventDefault();
      game.photo.dist = clamp(game.photo.dist * (1 + e.deltaY * 0.001), 3, 22);
    },
    { passive: false },
  );
}
