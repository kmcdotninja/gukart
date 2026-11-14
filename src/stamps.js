// Passport stamps, one per city, for the photo's journal page (src/photo.js): each its own shape, its own landmark in
// silhouette and its own words, laid out like the stamps in a real passport (small words arched over the landmark, the
// city big between dotted rules, the country with little planes, the airport or ARRIVAL round the edge). Drawn in one
// ink at (0, 0), about 340 wide and 260 tall, then worn (wear) so it looks pressed by hand: the ink uneven, the edges
// ragged, specks and scratches missing. The caller presses it crooked and picks the ink (the city's own colour on a
// light photo, white on a dark one). The frame is always outlined, never filled. No dates (the day is on the Polaroid).
const SANS = (n, w = 800) => `${w} ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`,
  SERIF = n => `700 ${n}px Georgia, "Times New Roman", serif`,
  SCRIPT = n => `italic 400 ${n}px "Brush Script MT", "Segoe Script", cursive`;

// the city's colour
export const STAMP_INK = {
  kano: '#c4122f',
  kaduna: '#11823b',
  doha: '#8a1538',
  singapore: '#1f3fb0',
  abudhabi: '#0f8f86',
  lagos: '#7a4a2a',
};

/* ---------- pieces ---------- */
const stroke = (x, lw, path) => {
  x.lineWidth = lw;
  x.beginPath();
  path();
  x.stroke();
};
const fill = (x, path) => {
  x.beginPath();
  path();
  x.fill('evenodd');
};
// a line of words, brought down in size until it fits the width it has
function words(x, t, y, font, size, max = 240, track = 0) {
  let n = size;
  const set = () => {
    x.font = font(n);
    x.letterSpacing = `${track * n}px`;
  };
  set();
  while (x.measureText(t).width > max && n > 9) (n--, set());
  x.fillText(t, 0, y);
  x.letterSpacing = '0px';
}
// letters round an arc, centred on the top (or the bottom, reading the right way up)
function arc(x, t, rad, top, size, spread = 1) {
  x.font = SANS(size);
  const step = (size * 0.62 * spread) / rad;
  [...t].forEach((ch, i) => {
    const a = (i - (t.length - 1) / 2) * step;
    x.save();
    x.rotate(top ? a : -a);
    x.translate(0, top ? -rad : rad);
    x.fillText(ch, 0, 0);
    x.restore();
  });
}
const rule = (x, w, y) => {
  for (let i = -w; i <= w - 4; i += 8) x.fillRect(i, y - 1, 4, 2);
};
const star = (x, px, py, r) => {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.45 : r;
    x[i ? 'lineTo' : 'moveTo'](px + Math.cos(a) * rr, py + Math.sin(a) * rr);
  }
  x.fill();
};
// a little plane (in a solid square, as on the stamps, when boxed)
function plane(x, px, py, s = 1, boxed = false) {
  x.save();
  x.translate(px, py);
  x.scale(s, s);
  if (boxed) {
    x.fillRect(-12, -12, 24, 24);
    x.globalCompositeOperation = 'destination-out';
  }
  x.beginPath();
  x.moveTo(-10, -1.6);
  x.lineTo(10, -1.6);
  x.quadraticCurveTo(13, 0, 10, 1.6);
  x.lineTo(-10, 1.6);
  x.closePath();
  for (const sd of [-1, 1]) {
    x.moveTo(2, sd);
    x.lineTo(-3, sd * 10);
    x.lineTo(-6, sd * 10);
    x.lineTo(-3, sd);
    x.moveTo(-8, sd);
    x.lineTo(-11, sd * 6);
    x.lineTo(-13, sd * 6);
    x.lineTo(-11, sd);
  }
  x.fill();
  x.restore();
}

/* ---------- landmarks: solid silhouettes standing on y = 0, about 120 wide ---------- */
const at = (x, px, py, s, f) => {
  x.save();
  x.translate(px, py);
  x.scale(s, s);
  f(x);
  x.restore();
};
const LAND = {
  // a gate of old Kano: the mud wall with its horned merlons, a tall pointed arch through it, two windows
  gate: x =>
    fill(x, () => {
      x.moveTo(-62, 0);
      x.lineTo(-62, -40);
      for (let i = -62; i < 62; i += 15.5) {
        x.lineTo(i + 3, -40);
        x.lineTo(i + 5, -52);
        x.lineTo(i + 8, -44);
        x.lineTo(i + 11, -52);
        x.lineTo(i + 13, -40);
      }
      x.lineTo(62, -40);
      x.lineTo(62, 0);
      x.closePath();
      x.moveTo(-16, 0);
      x.lineTo(-16, -18);
      x.quadraticCurveTo(-16, -34, 0, -40);
      x.quadraticCurveTo(16, -34, 16, -18);
      x.lineTo(16, 0);
      x.closePath();
      for (const w of [-42, 34]) x.rect(w, -28, 8, 12);
    }),
  // a domed hall on a colonnade
  dome: x => {
    fill(x, () => {
      x.rect(-60, -6, 120, 6);
      x.rect(-54, -40, 108, 6);
      x.moveTo(-26, -42);
      x.quadraticCurveTo(-24, -76, 0, -78);
      x.quadraticCurveTo(24, -76, 26, -42);
      x.closePath();
      x.rect(-2, -90, 4, 13);
    });
    for (let i = -48; i <= 48; i += 12) x.fillRect(i - 2.5, -34, 5, 28);
  },
  // a dhow under its big lateen sail, on the sea
  dhow: x => {
    fill(x, () => {
      x.moveTo(-62, -14);
      x.quadraticCurveTo(-40, 4, 0, 4);
      x.quadraticCurveTo(44, 4, 64, -18);
      x.lineTo(-40, -14);
      x.closePath();
    });
    fill(x, () => {
      x.moveTo(-38, -20);
      x.lineTo(-2, -84);
      x.quadraticCurveTo(40, -48, 40, -20);
      x.closePath();
    });
    fill(x, () => x.rect(-3, -84, 4, 70));
    for (const [a, w] of [
      [-56, 30],
      [-12, 40],
      [36, 26],
    ])
      x.fillRect(a, 8, w, 3);
  },
  // Marina Bay Sands: three tall towers, each two legs leaning together (a slit up the middle), tapering as they rise;
  // the SkyPark across their tops like a ship, its bow reaching out past the last tower
  sands: x => {
    for (const t of [-42, 0, 42])
      for (const sd of [-1, 1])
        fill(x, () => {
          // one leg: wide apart at the foot, meeting its twin at the top
          x.moveTo(t + sd * 17, 0);
          x.lineTo(t + sd * 7, 0);
          x.lineTo(t + sd * 1, -80);
          x.lineTo(t + sd * 6, -80);
          x.closePath();
        });
    fill(x, () => {
      x.moveTo(-62, -82);
      x.lineTo(100, -88);
      x.quadraticCurveTo(92, -78, 70, -77);
      x.lineTo(-56, -77);
      x.quadraticCurveTo(-62, -78, -62, -82);
      x.closePath();
    });
    x.fillRect(-72, 0, 144, 4);
  },
  // a mosque: the great dome between two minarets
  mosque: x =>
    fill(x, () => {
      x.rect(-56, -10, 112, 10);
      x.moveTo(-30, -10);
      x.quadraticCurveTo(-32, -50, 0, -56);
      x.quadraticCurveTo(32, -50, 30, -10);
      x.closePath();
      x.rect(-1.5, -66, 3, 10);
      for (const m of [-48, 44]) {
        x.rect(m, -70, 6, 60);
        x.moveTo(m - 2, -70);
        x.lineTo(m + 3, -80);
        x.lineTo(m + 8, -70);
        x.closePath();
      }
    }),
  // the Lagos skyline over the lagoon
  skyline: x => {
    for (const [a, w, h] of [
      [-60, 16, 30],
      [-42, 18, 56],
      [-22, 14, 42],
      [-6, 20, 72],
      [16, 14, 48],
      [32, 18, 60],
      [52, 12, 34],
    ])
      x.fillRect(a, -h, w, h);
    x.fillRect(-66, 0, 132, 4);
    for (const [a, w] of [
      [-56, 34],
      [-8, 46],
      [44, 22],
    ])
      x.fillRect(a, 10, w, 3);
  },
};

/* ---------- frames: a heavy outer line and a fine inner one ---------- */
const FRAME = {
  circle: (x, r) => {
    stroke(x, 9, () => x.arc(0, 0, r, 0, Math.PI * 2));
    stroke(x, 3, () => x.arc(0, 0, r - 18, 0, Math.PI * 2));
  },
  ticket: (x, w, h, n) => {
    const path = (w2, h2, n2) => {
      x.moveTo(-w2 + n2, -h2);
      x.lineTo(w2 - n2, -h2);
      x.arc(w2, -h2, n2, Math.PI, Math.PI / 2, true);
      x.lineTo(w2, h2 - n2);
      x.arc(w2, h2, n2, -Math.PI / 2, Math.PI, true);
      x.lineTo(-w2 + n2, h2);
      x.arc(-w2, h2, n2, 0, -Math.PI / 2, true);
      x.lineTo(-w2, -h2 + n2);
      x.arc(-w2, -h2, n2, Math.PI / 2, 0, true);
      x.closePath();
    };
    stroke(x, 8, () => path(w, h, n));
    x.setLineDash([6, 6]);
    stroke(x, 2, () => path(w - 14, h - 14, n - 6));
    x.setLineDash([]);
  },
  poly: (x, n, w, h, rot = 0) => {
    const path = (w2, h2) => {
      for (let i = 0; i <= n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * w2, Math.sin(a) * h2);
      }
    };
    stroke(x, 8, () => path(w, h));
    stroke(x, 2.5, () => path(w - 16, h - 14));
  },
  scallop: (x, r, n = 15, d = 10) =>
    stroke(x, 7, () => {
      for (let i = 0; i <= 240; i++) {
        const a = (i / 240) * Math.PI * 2,
          rr = r + Math.sin(a * n) * d;
        x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }),
  house: (x, w, h, roof) =>
    stroke(x, 9, () => {
      x.moveTo(-w, h);
      x.lineTo(-w, -h + roof);
      x.lineTo(0, -h);
      x.lineTo(w, -h + roof);
      x.lineTo(w, h);
      x.closePath();
    }),
};
const side = (x, px, py, f) => {
  x.save();
  x.translate(px, py);
  f();
  x.restore();
};

/* ---------- each city's stamp ---------- */
const STAMPS = {
  // round, like Rome's: ARRIVAL arched over the gate, KANO between rules, NIGERIA between boxed planes, IMMIGRATION
  // round the bottom
  kano: x => {
    FRAME.circle(x, 150);
    arc(x, 'ARRIVAL', 112, true, 22, 1.2);
    at(x, 0, -38, 0.82, LAND.gate);
    rule(x, 96, -26);
    words(x, 'KANO', 20, SERIF, 72, 200);
    rule(x, 96, 56);
    words(x, 'NIGERIA', 80, SANS, 28, 120, 0.08);
    plane(x, -80, 80, 0.9, true);
    plane(x, 80, 80, 0.9, true);
    arc(x, 'IMMIGRATION', 118, false, 18, 1.15);
  },
  // a ticket with bitten corners, like London's: the domed hall, KADUNA between rules, the republic under it, planes in
  // the corners
  kaduna: x => {
    FRAME.ticket(x, 170, 116, 26);
    words(x, 'ARRIVAL', -84, SANS, 18, 100, 0.12);
    at(x, 0, -30, 0.62, LAND.dome);
    rule(x, 130, -18);
    words(x, 'KADUNA', 26, SERIF, 64, 270);
    rule(x, 130, 56);
    words(x, 'FEDERAL REPUBLIC OF NIGERIA', 80, SANS, 20, 240, 0.06);
    for (const [px, py] of [
      [-132, -86],
      [132, -86],
      [-132, 88],
      [132, 88],
    ])
      plane(x, px, py, 0.8);
  },
  // an octagon, like Paris's: ARRIVAL either side of the dhow over the top, DOHA under a rule, Qatar written below
  doha: x => {
    FRAME.poly(x, 8, 168, 140, Math.PI / 8);
    for (const r of [-0.55, 0.55]) {
      x.save();
      x.rotate(r);
      arc(x, 'ARRIVAL', 104, true, 17, 1.2);
      x.restore();
    }
    at(x, 0, -24, 0.78, LAND.dhow);
    rule(x, 110, -10);
    words(x, 'DOHA', 36, SERIF, 68, 200);
    words(x, 'Qatar', 78, SCRIPT, 46, 170);
  },
  // a long hexagon, like San Francisco's: SINGAPORE over the top, the Sands big in the middle, ARRIVAL and the airport
  // at the sides, the republic along the bottom
  singapore: x => {
    FRAME.poly(x, 6, 184, 132);
    words(x, 'SINGAPORE', -70, SERIF, 40, 176);
    at(x, 0, 52, 0.95, LAND.sands);
    // (the sides: inside the hexagon's slanted inner line, which closes in above and below the middle)
    side(x, -110, 6, () => words(x, 'ARRIVAL', 0, SANS, 16, 54, 0.06));
    side(x, 110, 6, () => {
      words(x, 'CHANGI', -9, SANS, 16, 54, 0.06);
      words(x, 'AIRPORT', 10, SANS, 16, 54, 0.06);
    });
    words(x, 'REPUBLIC OF SINGAPORE', 78, SANS, 19, 168, 0.04);
  },
  // scalloped, like Tokyo's: planes either side of the country, the mosque, ABU DHABI between rules, the airport
  abudhabi: x => {
    FRAME.scallop(x, 146);
    words(x, 'UAE', -92, SANS, 26, 80, 0.12);
    plane(x, -54, -92, 0.9);
    plane(x, 54, -92, 0.9);
    rule(x, 104, -72);
    at(x, 0, -12, 0.62, LAND.mosque);
    words(x, 'ABU DHABI', 30, SERIF, 46, 210);
    rule(x, 104, 58);
    words(x, 'INTERNATIONAL AIRPORT', 80, SANS, 18, 190, 0.06);
  },
  // house-shaped, like Rio's: WELCOME TO along both slopes of the roof, the skyline at its peak, NIGERIA either side,
  // LAGOS big, DEPARTURE and a boxed plane along the bottom
  lagos: x => {
    FRAME.house(x, 176, 116, 62);
    for (const sd of [-1, 1]) {
      side(x, sd * 92, -48, () => {
        x.rotate(sd * 0.34);
        words(x, 'WELCOME TO', 0, SANS, 16, 80, 0.08);
      });
      side(x, sd * 104, -20, () => words(x, 'NIGERIA', 0, SANS, 22, 96, 0.08));
    }
    at(x, 0, -22, 0.62, LAND.skyline);
    words(x, 'LAGOS', 36, SERIF, 72, 300);
    rule(x, 150, 68);
    words(x, 'DEPARTURE', 92, SANS, 22, 140, 0.1);
    plane(x, 104, 92, 0.85, true);
  },
};

// draws the city's stamp at (0, 0) in the ink already set; a city without one of its own gets a plain round stamp
export function drawStamp(x, city, name) {
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  if (STAMPS[city]) return STAMPS[city](x);
  FRAME.circle(x, 150);
  star(x, 0, -60, 12);
  words(x, name, 10, SERIF, 64, 220);
  words(x, 'ARRIVAL', 70, SANS, 22, 140, 0.1);
}

// the wear of a stamp pressed by hand, on the canvas it was drawn on (w by h): the ink uneven (soft patches printed
// lighter), the edges of every line and letter ragged (tiny bites all over), specks and a few fine scratches missing
export function wear(x, w, h) {
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  // uneven pressure: big soft patches where less ink took
  for (let i = 0; i < 7; i++) {
    const px = Math.random() * w,
      py = Math.random() * h,
      r = 40 + Math.random() * 90,
      g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(0,0,0,${0.25 + Math.random() * 0.3})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // ragged edges: thousands of tiny bites, so no line or letter has a clean edge
  for (let i = 0; i < (w * h) / 90; i++) {
    x.fillStyle = `rgba(0,0,0,${0.4 + Math.random() * 0.6})`;
    const s = 1 + Math.random() * 2.2;
    x.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  // specks: bigger missing spots, a few
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(0,0,0,${0.5 + Math.random() * 0.5})`;
    x.beginPath();
    x.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
    x.fill();
  }
  // fine scratches
  x.lineWidth = 1.5;
  x.strokeStyle = 'rgba(0,0,0,0.8)';
  for (let i = 0; i < 6; i++) {
    const px = Math.random() * w,
      py = Math.random() * h,
      a = Math.random() * Math.PI,
      l = 30 + Math.random() * 80;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    x.stroke();
  }
  x.restore();
}
