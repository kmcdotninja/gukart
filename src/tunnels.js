// Tunnels through a hill: the road runs into a cutting, under a concrete horseshoe portal set in the hillside (the
// tunnel's name on it, wing walls running back along the cutting, a striped board at each edge), and through a lit vault:
// cream panels on the lower walls with a dark band, bare concrete curving overhead, two maintenance walkways with
// railings hung along the crown, rows of lights down both sides of the vault and small ones along the foot of the walls,
// green exit signs, blue SOS boxes, a lit message board over the way in. Then out of the far portal into the light.
// One per 'tunnel' feature [s, 'tunnel', { len, name }], laid on a straight; the same stretch is a 'hall' (track.js:
// walls at the road's edge, no kerbs, no lamp posts). Each city gives it its own hill and words (opts.look).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';
import { fbm } from './util.js';

const LOOK = {
  hill: ['#7d8a4a', '#6f7d43', '#9a8a6e', '#b3a493', '#8e7f74'], // scrub low down, then rock higher up
  rockFrom: 0.45, // how far up (0..1 of the hill's height) bare rock takes over
  hillH: 40,
  board: 'DRIVE SAFELY', // the message board over the way in
  exit: 'EXIT',
};

export function tunnel(k, f, opts = {}) {
  const { scene, tr, W, reserve } = k,
    look = { ...LOOK, ...opts.look },
    L = f.len,
    mid = f.s + L / 2,
    o = tr.point(mid, 0),
    t = tr.T[tr.idx(mid)],
    a = Math.atan2(t.x, t.z);
  const G = new THREE.Group();
  G.position.set(o.x, o.y, o.z);
  G.rotation.y = a;
  scene.add(G);
  // in this frame z runs along the road (the way you drive is +z), x across it
  const HW = W / 2 + 2.2, // half the bore's width at the walls
    WALL = 4.5, // the walls rise straight this far, then the vault curves over
    RISE = 8, // from there to the crown
    CROWN = WALL + RISE,
    Z0 = -L / 2,
    Z1 = L / 2;
  const prof = n =>
    Array.from({ length: n + 1 }, (_, i) => {
      const th = Math.PI * (1 - i / n);
      return [Math.cos(th) * HW, WALL + Math.sin(th) * RISE];
    });
  const bins = new Map(),
    put = (geo, mat) => (bins.get(mat) || bins.set(mat, []).get(mat)).push(geo.index ? geo.toNonIndexed() : geo);
  const lam = (c, x = {}) => new THREE.MeshLambertMaterial({ color: c, ...x });
  // a surface swept along the bore: the profile pts [x, y] at every `step` metres from za to zb, uv in metres
  const sweep = (pts, za, zb, step = 4, tile = [4, 4]) => {
    const pos = [],
      uv = [],
      idx = [],
      n = pts.length;
    let rows = 0,
      along = 0;
    for (let z = za; z <= zb + 1e-6; z += step, rows++) {
      let across = 0;
      pts.forEach(([x, y], i) => {
        if (i) across += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
        pos.push(x, y, z);
        uv.push(across / tile[0], along / tile[1]);
      });
      along += step;
    }
    for (let r = 0; r < rows - 1; r++)
      for (let i = 0; i < n - 1; i++) {
        const p = r * n + i;
        idx.push(p, p + n, p + 1, p + 1, p + n, p + n + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const tex = (w, h, draw) => {
    const t2 = canvasTex(w, h, draw, { repeat: true });
    return t2;
  };

  /* ---------- the bore ---------- */
  // the lower walls: cream panels, a dark band at hand height, joints every 3 m, lit a little from within
  const panelT = tex(128, 128, (x, w, h) => {
    x.fillStyle = '#e8ddc2';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(80,70,50,.25)';
    x.fillRect(0, 0, 2, h);
    x.fillStyle = '#3d3a34';
    x.fillRect(0, h * 0.62, w, h * 0.08);
    x.fillStyle = 'rgba(0,0,0,.18)';
    x.fillRect(0, h * 0.97, w, h * 0.03);
  });
  const panelM = lam('#ffffff', { map: panelT, emissive: '#4a4436', side: THREE.DoubleSide });
  for (const sd of [-1, 1])
    put(
      sweep(
        [
          [sd * HW, 0],
          [sd * HW, WALL],
        ],
        Z0,
        Z1,
        3,
        [WALL, 3],
      ),
      panelM,
    );
  // the vault: concrete, the rings between its segments every 6 m
  const vaultT = tex(128, 128, (x, w, h) => {
    x.fillStyle = '#bdb8ad';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)';
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    x.fillStyle = 'rgba(40,36,30,.35)';
    x.fillRect(0, 0, w, 3);
  });
  put(sweep(prof(16), Z0, Z1, 3, [6, 6]), lam('#ffffff', { map: vaultT, emissive: '#3a3630', side: THREE.DoubleSide }));
  // the kerbed walkways along the foot of each wall
  const walkM = lam('#cfc9bb', { emissive: '#2a2722' });
  for (const sd of [-1, 1])
    put(
      new THREE.BoxGeometry(HW - W / 2 - 0.3, 0.35, L).translate(sd * (W / 2 + 0.3 + (HW - W / 2 - 0.3) / 2), 0.17, 0),
      walkM,
    );

  // the maintenance walkways hung along the crown: a deck, railings both sides, hangers up to the vault
  const steelM = lam('#9a9890', { emissive: '#22211e' }),
    WX = 4.6,
    WY = CROWN - 2.6,
    vaultY = x => WALL + RISE * Math.sqrt(Math.max(0, 1 - (x / HW) ** 2));
  for (const sd of [-1, 1]) {
    const cx = sd * WX;
    put(new THREE.BoxGeometry(1.5, 0.16, L).translate(cx, WY, 0), steelM);
    for (const rx of [-0.72, 0.72]) {
      put(new THREE.BoxGeometry(0.06, 0.06, L).translate(cx + rx, WY + 1, 0), steelM);
      put(new THREE.BoxGeometry(0.04, 0.04, L).translate(cx + rx, WY + 0.5, 0), steelM);
    }
    for (let z = Z0 + 1; z < Z1; z += 2)
      for (const rx of [-0.72, 0.72]) put(new THREE.BoxGeometry(0.05, 1, 0.05).translate(cx + rx, WY + 0.5, z), steelM);
    for (let z = Z0 + 2; z < Z1; z += 4) {
      const top = vaultY(cx);
      put(new THREE.BoxGeometry(0.08, top - WY, 0.08).translate(cx, (WY + top) / 2, z), steelM);
    }
  }
  // the lights: a row each side of the vault, warm white, and small ones low on the walls; always lit
  const lampM = new THREE.MeshBasicMaterial({ color: '#fff2d2' }),
    lowM = new THREE.MeshBasicMaterial({ color: '#dfe9ff' });
  for (const sd of [-1, 1]) {
    const lx = sd * (HW - 3.6),
      ly = vaultY(lx) - 0.2;
    for (let z = Z0 + 2; z < Z1; z += 4)
      put(new THREE.BoxGeometry(0.5, 0.18, 1.6).rotateZ(-sd * 0.5).translate(lx, ly, z), lampM);
    for (let z = Z0 + 3; z < Z1; z += 6)
      put(new THREE.BoxGeometry(0.06, 0.25, 0.4).translate(sd * (HW - 0.03), 0.8, z), lowM);
  }
  // the signs on the walls: a green exit sign and a blue SOS box in turn every 40 m
  const exitT = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#0b8a4a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    // a running figure: head, body, limbs
    x.beginPath();
    x.arc(w * 0.22, h * 0.25, h * 0.09, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = h * 0.08;
    x.strokeStyle = '#ffffff';
    x.beginPath();
    x.moveTo(w * 0.21, h * 0.36);
    x.lineTo(w * 0.17, h * 0.6);
    x.lineTo(w * 0.1, h * 0.82);
    x.moveTo(w * 0.17, h * 0.6);
    x.lineTo(w * 0.26, h * 0.82);
    x.moveTo(w * 0.1, h * 0.45);
    x.lineTo(w * 0.28, h * 0.42);
    x.stroke();
    x.fillRect(w * 0.4, h * 0.2, w * 0.18, h * 0.62); // the door
    x.font = `800 ${h * 0.36}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    x.textBaseline = 'middle';
    x.fillText(look.exit, w * 0.62, h * 0.53);
  });
  const sosT = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#1d5fbf';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = `800 ${h * 0.42}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('SOS', w / 2, h / 2);
  });
  const exitM = new THREE.MeshBasicMaterial({ map: exitT }),
    sosM = new THREE.MeshBasicMaterial({ map: sosT });
  let n = 0;
  for (let z = Z0 + 20; z < Z1 - 10; z += 40, n++)
    for (const sd of [-1, 1]) {
      const pl = new THREE.Mesh(
        n % 2 ? new THREE.PlaneGeometry(1.2, 1.2) : new THREE.PlaneGeometry(1.8, 0.9),
        n % 2 ? sosM : exitM,
      );
      pl.position.set(sd * (HW - 0.04), 3, z);
      pl.rotation.y = -sd * (Math.PI / 2);
      G.add(pl);
    }
  // the message board over the way in, hung from the walkways, lit amber letters on black
  const boardT = canvasTex(1024, 160, (x, w, h) => {
    x.fillStyle = '#0c0c0e';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffb21e';
    x.font = `800 ${h * 0.6}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(look.board, w / 2, h * 0.54);
  });
  {
    const bz = Z0 + 16,
      bw = WX * 2 + 1.6;
    put(new THREE.BoxGeometry(bw, 1.6, 0.4).translate(0, WY - 1.1, bz), lam('#1a1a1c'));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.3, 1.4), new THREE.MeshBasicMaterial({ map: boardT }));
    face.position.set(0, WY - 1.1, bz - 0.21);
    face.rotation.y = Math.PI; // (it faces the cars coming in)
    G.add(face);
    for (const sx of [-WX, WX]) put(new THREE.BoxGeometry(0.1, 0.9, 0.1).translate(sx, WY - 0.3, bz), steelM); // hung from the walkways
  }

  /* ---------- the portals: a horseshoe ring standing proud of a headwall, the name on it, wing walls ---------- */
  const conc = lam('#d6d2c8', { emissive: '#2a2824' }),
    concDark = lam('#b8b3a8');
  const nameT = canvasTex(1024, 128, (x, w, h) => {
    x.fillStyle = 'rgba(0,0,0,0)';
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#4a4740';
    x.font = `700 ${h * 0.62}px "Barlow", "Arial", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(f.name || 'TUNNEL', w / 2, h * 0.55);
  });
  const nameM = new THREE.MeshLambertMaterial({ map: nameT, transparent: true, depthWrite: false });
  const ring = (rIn, rOut) => {
    // the horseshoe: the bore's profile, and the same grown outward by rOut
    const sh = new THREE.Shape(),
      outer = prof(24).map(([x, y]) => [x * (1 + rOut / HW), WALL + (y - WALL) * (1 + rOut / RISE)]),
      inner = prof(24);
    sh.moveTo(outer[0][0], 0);
    for (const [x, y] of outer) sh.lineTo(x, y);
    sh.lineTo(outer.at(-1)[0], 0);
    sh.lineTo(inner.at(-1)[0], 0);
    for (let i = inner.length - 1; i >= 0; i--) sh.lineTo(inner[i][0], inner[i][1]);
    sh.lineTo(outer[0][0], 0);
    void rIn;
    return sh;
  };
  for (const ez of [-1, 1]) {
    const zf = ez * (L / 2);
    // the headwall: a broad slab with the bore through it, standing back into the hill
    const hw = new THREE.Shape(),
      HWW = HW + 14,
      HH = CROWN + 6;
    hw.moveTo(-HWW, 0);
    hw.lineTo(HWW, 0);
    hw.lineTo(HWW, WALL + 1);
    hw.lineTo(HW + 6, HH);
    hw.lineTo(-HW - 6, HH);
    hw.lineTo(-HWW, WALL + 1);
    hw.lineTo(-HWW, 0);
    const hole = new THREE.Path();
    const inner = prof(24);
    hole.moveTo(inner[0][0], 0);
    for (const [x, y] of inner) hole.lineTo(x, y);
    hole.lineTo(inner.at(-1)[0], 0);
    hole.lineTo(inner[0][0], 0);
    hw.holes.push(hole);
    put(
      // (12 m deep, back into the hill past where the hill's surface over the road ends: no slot of sky behind it)
      new THREE.ExtrudeGeometry(hw, { depth: 13, bevelEnabled: false, curveSegments: 4 }).translate(
        0,
        0,
        ez > 0 ? zf - 12 : zf - 1,
      ),
      concDark,
    );
    // the ring standing proud of it, 1.6 m deep, out toward the road
    put(
      new THREE.ExtrudeGeometry(ring(0, 1.6), { depth: 2.2, bevelEnabled: false, curveSegments: 4 }).translate(
        0,
        0,
        ez > 0 ? zf + 1 : zf - 3.2,
      ),
      conc,
    );
    // the name round the top of the ring, facing out
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), nameM);
    pl.position.set(0, CROWN + 0.75, zf + ez * 3.25);
    if (ez < 0) pl.rotation.y = Math.PI;
    G.add(pl);
    // the wing walls running back along the cutting, stepping down
    for (const sx of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const h = HH - 3 - i * 4;
        if (h < 1) break;
        put(new THREE.BoxGeometry(1.2, h, 6).translate(sx * (HWW - 0.6), h / 2, zf + ez * (4 + i * 6)), concDark);
      }
    // the striped boards at the mouth's edges (black and yellow), on the wall's face
    const stripeT = canvasTex(64, 256, (x, w, h) => {
      for (let y = -w; y < h; y += 32) {
        x.fillStyle = '#1a1a1a';
        x.fillRect(0, y, w, 32);
        x.fillStyle = '#f2c230';
        x.beginPath();
        x.moveTo(0, y + 16);
        x.lineTo(w, y);
        x.lineTo(w, y + 16);
        x.lineTo(0, y + 32);
        x.fill();
      }
    });
    for (const sx of [-1, 1]) {
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), new THREE.MeshBasicMaterial({ map: stripeT }));
      s2.position.set(sx * (HW + 0.6), 1.9, zf + ez * 3.27);
      if (ez < 0) s2.rotation.y = Math.PI;
      G.add(s2);
    }
  }

  /* ---------- the hill the road goes through ---------- */
  // A dome of earth and rock over the bore, the road coming at it in a cutting. Built in the tunnel's frame: heights on a
  // grid, lifted well clear over the vault, and cut away down to the ground in a band either side of the road outside it
  // (the cutting's sides sloping up from the kerbs), so nothing of it stands on the road or across the mouths.
  {
    const XR = 120,
      ZR = L / 2 + 50,
      STEP = 4,
      BAND = HW + 1,
      nx = Math.round((2 * XR) / STEP),
      nz = Math.round((2 * ZR) / STEP),
      pos = [],
      cols = [],
      keep = [],
      c = new THREE.Color(),
      HC = look.hill.map(x => new THREE.Color(x));
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = -XR + i * STEP,
          z = -ZR + j * STEP,
          nn = fbm(x * 0.03 + 7, z * 0.03 + 3),
          // a ridge, not a dome: its full height all along the bore, falling away steeply past each mouth (so the
          // portal stands in a hillside face with rock rising over it, as real ones do: a dome peaking over the middle
          // sank below the portals and they stood in front of a dip, looking hollow)
          fx = Math.pow(Math.max(0, 1 - (x / XR) ** 2), 0.8),
          dz = Math.abs(z) - L / 2,
          fz = dz < 0 ? 1 : Math.pow(Math.max(0, 1 - dz / 38), 1.4);
        let h = look.hillH * fx * fz * (0.8 + nn * 0.4);
        const face = L / 2 + 1, // the headwalls' faces
          inside = Math.abs(z) <= face,
          TOPW = CROWN + 6; // their tops
        if (Math.abs(x) < HW + 16 && inside) {
          // over the bore and the headwalls: well clear of the vault, and coming down to sit on each headwall's top edge
          // over its last 14 m (rock rising straight up behind the portal, no gap of sky between them)
          h = Math.max(h, CROWN + 9);
          // (its front edge tucked just under the headwall's top, hidden behind it: you can't see in under the hill)
          const e = face - Math.abs(z);
          if (e < 6) h = TOPW - 0.6;
          else if (e < 20) h = TOPW - 0.6 + (h - TOPW + 0.6) * ((e - 6) / 14);
        }
        if (!inside) h = Math.min(h, Math.max(0, (Math.abs(x) - BAND) * 1.1)); // the cutting
        keep.push(!(Math.abs(x) < HW + 14 && Math.abs(z) > face)); // (none over the road in front of the mouths)
        pos.push(x, Math.max(0, h) - 0.2, z);
        const u = h / look.hillH;
        c.copy(HC[0])
          .lerp(HC[1], nn)
          .lerp(HC[2 + (((nn * 3) | 0) % 3)], Math.min(1, Math.max(0, (u - look.rockFrom) * 3)));
        cols.push(c.r, c.g, c.b);
      }
    const idx = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const p = j * (nx + 1) + i,
          q = p + nx + 1;
        if (keep[p] && keep[p + 1] && keep[q] && keep[q + 1]) idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    // (seen from both sides: where the hill rises behind a portal some of its faces turn away from the road, and drawn from
    // one side only you saw straight through them, the hill hollow)
    const hill = new THREE.Mesh(
      g,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    );
    hill.castShadow = hill.receiveShadow = true;
    G.add(hill);
    // nothing else is built on it
    G.updateMatrixWorld(true);
    for (let z = -ZR; z <= ZR; z += 24)
      for (const x of [-XR * 0.6, -XR * 0.25, XR * 0.25, XR * 0.6]) {
        const w = new THREE.Vector3(x, 0, z).applyMatrix4(G.matrixWorld);
        reserve(w.x, w.z, 22);
      }
  }

  for (const [mat, geos] of bins) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true;
    m.castShadow = false;
    G.add(m);
  }
  opts.place?.('THE TUNNEL', f.name || 'Through the hill', tr.point(f.s, 0), f.s, { back: 60, h: 4, lookH: 8 });
}
