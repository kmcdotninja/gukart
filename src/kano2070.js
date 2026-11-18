// Kano in 2070, after the picture the user drew it from: the old city grown into the future rather than replaced by
// it, bright and warm under a blue sky. Round all three Kano circuits the heritage core stays (the wall, the gates, the
// palace, the mud houses), and around it rises the new Kano:
//  - towers of four kinds: round sandstone towers with a strip of blue glass up the front patterned in white and blue
//    triangles, a glass dome and a spire on top; blue glass towers ribbed in sandstone; tall mud-brick blocks,
//    crenellated, wooden stakes (toron) standing out of the walls, green banners with a white knot hung down them; and
//    a few needle towers, white, a saucer near the top ringed in glass
//  - the monorail: a white guideway on slim pylons round the edge of the city, a white train with a green stripe
//  - the Great Mosque: white, a big dome on a drum, green bands, one tall minaret with balconies
//  - airships drifting high over the city; the groundnut pyramids back as solar pyramids; a skyline across the water
// The colours are sand, mud and white with blue glass and Kano green, the light gold and warm at night.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from './textures.js';

const TILE = 40; // metres of tower one texture tile covers (ten storeys)

// a façade: four kinds, each a colour drawing and its glow (only the parts lit at night)
function facade(kind) {
  const W = 256,
    H = 512,
    draw = glow => (x, w, h) => {
      let r = kind.length * 977 + 3;
      const R = () => (r = (r * 16807) % 2147483647) / 2147483647;
      const fill = (c, ...a) => {
        x.fillStyle = c;
        x.fillRect(...a);
      };
      fill(glow ? '#000' : { sand: '#e3b57c', glass: '#3f86c9', mud: '#c98d55', needle: '#f4f1ea' }[kind], 0, 0, w, h);
      const win = (wx, wy, ww, wh) => {
        if (glow) {
          if (R() < 0.55) fill(R() < 0.75 ? '#ffd29a' : '#9fe6ff', wx, wy, ww, wh);
        } else fill('#2f5f94', wx, wy, ww, wh);
      };
      if (kind === 'sand') {
        // window slits either side, and up the middle a glass strip patterned in triangles
        for (let y = 10; y < h; y += 51) for (const wx of [18, 52, 186, 220]) win(wx, y, 16, 30);
        if (!glow) fill('#3f86c9', 86, 0, 84, h);
        for (let y = 0; y < h; y += 42)
          for (let k = 0; k < 2; k++) {
            x.fillStyle = glow ? (k ? '#7fe8ff' : '#ffffff') : k ? '#1f5a9a' : '#f4f1ea';
            if (glow && R() < 0.4) continue;
            x.beginPath();
            const cx = 128,
              cy = y + 21;
            if (k) {
              x.moveTo(cx, cy + 18);
              x.lineTo(cx + 18, cy - 4);
              x.lineTo(cx - 18, cy - 4);
            } else {
              x.moveTo(cx, cy - 20);
              x.lineTo(cx + 34, cy + 20);
              x.lineTo(cx - 34, cy + 20);
            }
            x.fill();
          }
      } else if (kind === 'glass') {
        // storeys of glass between pale mullions, sandstone ribs at the edges
        for (let y = 0; y < h; y += 51) {
          if (!glow) {
            fill('#5fa3df', 0, y, w, 4);
            fill('rgba(255,255,255,.25)', 0, y + 4, w, 3);
          } else
            for (let c = 0; c < 8; c++) if (R() < 0.45) fill(R() < 0.7 ? '#ffd29a' : '#9fe6ff', c * 32, y + 8, 32, 40);
        }
        if (!glow) for (const rx of [0, 124, 244]) fill('#e3b57c', rx, 0, 12, h);
      } else if (kind === 'mud') {
        // small deep windows in rows, a green banner hung down the middle with a white knot on it
        for (let y = 14; y < h; y += 51) for (const wx of [20, 62, 176, 218]) win(wx, y, 18, 24);
        if (!glow) {
          fill('#1f7a4a', 96, 40, 64, 300);
          x.strokeStyle = '#f4f1ea';
          x.lineWidth = 5;
          const cx = 128,
            cy = 190,
            s = 22;
          x.beginPath();
          x.moveTo(cx, cy - s);
          x.lineTo(cx + s, cy);
          x.lineTo(cx, cy + s);
          x.lineTo(cx - s, cy);
          x.closePath();
          x.moveTo(cx - s * 0.5, cy - s * 0.5);
          x.lineTo(cx + s * 0.5, cy + s * 0.5);
          x.moveTo(cx + s * 0.5, cy - s * 0.5);
          x.lineTo(cx - s * 0.5, cy + s * 0.5);
          x.stroke();
          fill('#f2b544', 96, 40, 64, 6);
          fill('#f2b544', 96, 334, 64, 6);
          // weathered render
          for (let i = 0; i < 400; i++)
            fill(`rgba(110,60,25,${0.05 + R() * 0.08})`, R() * w, R() * h, 2 + R() * 4, 2 + R() * 4);
        }
      } else {
        // the needle's shaft: white, a lattice of blue diamonds
        x.strokeStyle = glow ? '#7fe8ff' : '#3f86c9';
        x.lineWidth = 6;
        for (let y = -64; y < h + 64; y += 64) {
          x.beginPath();
          x.moveTo(0, y);
          x.lineTo(w / 2, y + 64);
          x.lineTo(w, y);
          x.moveTo(0, y + 64);
          x.lineTo(w / 2, y);
          x.lineTo(w, y + 64);
          x.stroke();
        }
      }
    };
  return { map: canvasTex(W, H, draw(false), { repeat: true }), glow: canvasTex(W, H, draw(true), { repeat: true }) };
}

// a tower body of height h, unit footprint, its texture tiled so a storey stays the same size
function bodyGeo(kind, h) {
  const g =
    kind === 'mud'
      ? new THREE.BoxGeometry(1, h, 1).translate(0, h / 2, 0)
      : new THREE.CylinderGeometry(0.5, 0.5, h, kind === 'glass' ? 8 : 24, 1, true).translate(0, h / 2, 0);
  const uv = g.attributes.uv,
    p = g.attributes.position,
    nr = g.attributes.normal;
  const around = kind === 'mud' ? 1 : 2;
  for (let i = 0; i < uv.count; i++) {
    const flat = Math.abs(nr.getY(i)) > 0.5; // (the roof and the floor: plain, from a blank corner)
    uv.setXY(i, flat ? 0.02 : uv.getX(i) * around, flat ? 0.02 : p.getY(i) / TILE);
  }
  if (kind === 'mud') return g.toNonIndexed();
  const lid = new THREE.CircleGeometry(0.5, kind === 'glass' ? 8 : 24).rotateX(-Math.PI / 2).translate(0, h, 0);
  const l = lid.attributes.uv;
  for (let i = 0; i < l.count; i++) l.setXY(i, 0.02, 0.02);
  return mergeGeometries([g.toNonIndexed(), lid.toNonIndexed()]);
}

// the Kano knot on a green banner (the lamp posts carry them too: world.js)
export function knotBanner() {
  return canvasTex(128, 320, (x, w, h) => {
    x.fillStyle = '#1f7a4a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#f2b544';
    x.fillRect(0, 0, w, 8);
    x.fillRect(0, h - 8, w, 8);
    x.strokeStyle = '#f4f1ea';
    x.lineWidth = 6;
    x.lineJoin = 'round';
    for (const cy of [110, 210]) {
      const cx = w / 2,
        s = 30;
      x.beginPath();
      x.moveTo(cx, cy - s);
      x.lineTo(cx + s, cy);
      x.lineTo(cx, cy + s);
      x.lineTo(cx - s, cy);
      x.closePath();
      x.moveTo(cx - s * 0.5, cy - s * 0.5);
      x.lineTo(cx + s * 0.5, cy + s * 0.5);
      x.moveTo(cx + s * 0.5, cy - s * 0.5);
      x.lineTo(cx - s * 0.5, cy + s * 0.5);
      x.stroke();
    }
  });
}

export function dressKano2070(dk) {
  const { scene, tr, rand, rr, pick, R0, C, W, roadGap } = dk;
  const KINDS = ['sand', 'glass', 'mud'];
  const mats = {},
    glowing = []; // [material, by day, at night]
  for (const k of [...KINDS, 'needle']) {
    const f = facade(k);
    mats[k] = new THREE.MeshPhongMaterial({
      map: f.map,
      emissive: '#ffffff',
      emissiveMap: f.glow,
      emissiveIntensity: 0,
      shininess: k === 'glass' ? 90 : 8,
      specular: k === 'glass' ? '#cfe8ff' : '#222222',
    });
    glowing.push([mats[k], 0, 1.2]);
  }
  const goldM = new THREE.MeshLambertMaterial({ color: '#ffc65c', emissive: '#ffb23c', emissiveIntensity: 0.25 });
  glowing.push([goldM, 0.25, 1.1]);
  const glassM = new THREE.MeshPhongMaterial({ color: '#ffffff', specular: '#cfe8ff', shininess: 110 });
  const domeM = new THREE.MeshPhongMaterial({ color: '#5fa8e6', specular: '#ffffff', shininess: 120 });
  const whiteM = new THREE.MeshLambertMaterial({ color: '#f4f1ea' });
  const mudM = new THREE.MeshLambertMaterial({ color: '#c98d55' });
  const woodM = new THREE.MeshLambertMaterial({ color: '#6b4426' });

  // height classes, one geometry each per kind (so windows stay storey-sized)
  const CLASSES = [40, 60, 84, 110];
  const items = Object.fromEntries(KINDS.map(k => [k, CLASSES.map(() => [])]));
  const domes = [],
    spires = [],
    bands = [],
    merlons = [],
    stakes = [];
  // a tower at (x, z), footprint w, height class c, kind k
  const tower = (x, z, w, c, kind, near) => {
    const h = CLASSES[c],
      ry = rand() * Math.PI * 2;
    items[kind][c].push({ x, z, w, ry, near });
    if (kind === 'sand') {
      domes.push([x, h, z, w * 0.84]);
      bands.push([x, h - 1.2, z, w * 1.06, 1.4]);
      spires.push([x, h + w * 0.42, z, w * 0.06, w * 0.9]);
    } else if (kind === 'glass') {
      bands.push([x, h - 2, z, w * 1.08, 2.4]);
      bands.push([x, h * 0.5, z, w * 1.05, 1.2]);
      spires.push([x, h, z, w * 0.08, h * 0.22]);
    } else {
      // crenellations round the roof, toron stakes out of the walls in rows
      const n = Math.max(3, Math.round(w / 3));
      for (let sd = 0; sd < 4; sd++)
        for (let q = 0; q < n; q++) {
          const a = ry + (sd * Math.PI) / 2,
            u = (q + 0.5) / n - 0.5,
            lx = u * w,
            lz = w / 2 - 0.4;
          merlons.push([x + Math.cos(a) * lx + Math.sin(a) * lz, h, z - Math.sin(a) * lx + Math.cos(a) * lz, a]);
        }
      for (let y = 8; y < h - 4; y += 14)
        for (let sd = 0; sd < 4; sd++)
          for (const u of [-0.32, 0.32]) {
            const a = ry + (sd * Math.PI) / 2,
              lx = u * w,
              lz = w / 2 + 0.6;
            stakes.push([x + Math.cos(a) * lx + Math.sin(a) * lz, y, z - Math.sin(a) * lx + Math.cos(a) * lz, a]);
          }
    }
  };
  const pickKind = near => (rand() < (near ? 0.36 : 0.4) ? 'sand' : rand() < 0.5 ? 'glass' : near ? 'mud' : 'glass');

  // on the island (or the city's land): in the open ring between the old city and the shore, never near the road
  const inner = tr.radius + 10,
    outer = R0 - 48;
  let placed = 0;
  const needleAt = [];
  for (let k = 0; k < 900 && placed < 22; k++) {
    const a = rand() * Math.PI * 2,
      r = rr(inner, outer),
      x = C.x + Math.cos(a) * r,
      z = C.z + Math.sin(a) * r,
      w = rr(15, 22);
    if (roadGap(x, z) < W / 2 + 22 + w) continue;
    if (!dk.free(x, z, w * 0.75, W / 2 + 20)) continue;
    dk.reserve(x, z, w * 0.8);
    if (needleAt.length < 2 && placed % 7 === 3) needleAt.push([x, z, rr(95, 120)]);
    else tower(x, z, w, rand() < 0.35 ? 3 : rand() < 0.6 ? 2 : 1, pickKind(true), true);
    placed++;
  }
  // and a few inside the loop wherever there's a big enough gap (so the old city still reads as old)
  for (let k = 0; k < 500 && placed < 28; k++) {
    const x = rr(tr.box.min.x, tr.box.max.x),
      z = rr(tr.box.min.z, tr.box.max.z),
      w = rr(13, 17);
    if (roadGap(x, z) < W / 2 + 30 + w) continue;
    if (!dk.free(x, z, w * 0.75, W / 2 + 28)) continue;
    dk.reserve(x, z, w * 0.8);
    tower(x, z, w, rand() < 0.5 ? 1 : 0, rand() < 0.5 ? 'mud' : 'sand', true);
    placed++;
  }
  // the skyline beyond: clusters of towers on islands across the water, the tallest in the middle of each
  const far = [],
    isles = [];
  for (let c = 0; c < 8; c++) {
    const a0 = (c / 8) * Math.PI * 2 + rr(-0.2, 0.2),
      rc = R0 + rr(230, 380),
      cx = C.x + Math.cos(a0) * rc,
      cz = C.z + Math.sin(a0) * rc,
      n = 5 + ((rand() * 4) | 0);
    if (roadGap(cx, cz) < 260) continue;
    isles.push([cx, cz]);
    if (c % 3 === 1) needleAt.push([cx, cz, rr(120, 150)]);
    for (let k = 0; k < n * 3 && far.filter(f => f[2] === c).length < n; k++) {
      const a = rand() * Math.PI * 2,
        r = 26 + Math.sqrt(rand()) * 50,
        x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r;
      if (far.some(f => Math.hypot(f[0] - x, f[1] - z) < 32)) continue;
      far.push([x, z, c]);
      tower(x, z, rr(20, 30), r < 45 ? 3 : pick([1, 2, 2, 3]), pickKind(false), false);
    }
  }
  if (isles.length) {
    const g = isles.map(([x, z]) => new THREE.CylinderGeometry(98, 110, 2.2, 40).translate(x, -0.9, z));
    const isle = new THREE.Mesh(mergeGeometries(g), new THREE.MeshLambertMaterial({ color: '#e7d3a8' }));
    isle.receiveShadow = true;
    scene.add(isle);
  }

  // build the towers: one instanced mesh per kind and height class (near ones cast shadows)
  const o = new THREE.Object3D(),
    col = new THREE.Color();
  for (const kind of KINDS)
    CLASSES.forEach((h, c) => {
      const list = items[kind][c];
      if (!list.length) return;
      const g = bodyGeo(kind, h);
      for (const near of [true, false]) {
        const its = list.filter(t => t.near === near);
        if (!its.length) continue;
        const m = new THREE.InstancedMesh(g, mats[kind], its.length);
        its.forEach((t, i) => {
          o.position.set(t.x, 0, t.z);
          o.rotation.set(0, t.ry, 0);
          o.scale.set(t.w, 1, t.w);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, col.setHSL(0.08, 0.1, 0.92 + rand() * 0.08));
        });
        m.castShadow = near;
        m.receiveShadow = true;
        scene.add(m);
      }
    });
  const inst = (geo, mat, list, set, shadow = true) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      set(it);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = shadow;
    scene.add(m);
  };
  // glass domes on the sandstone towers, a white ring under each; spires
  inst(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeM, domes, ([x, y, z, s]) => {
    o.position.set(x, y, z);
    o.scale.setScalar(s);
  });
  inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 24).translate(0, 0.5, 0), whiteM, bands, ([x, y, z, s, h]) => {
    o.position.set(x, y, z);
    o.scale.set(s, h, s);
  });
  inst(new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0), whiteM, spires, ([x, y, z, s, h]) => {
    o.position.set(x, y, z);
    o.scale.set(s * 2, h, s * 2);
  });
  inst(new THREE.BoxGeometry(1.6, 1.6, 0.9).translate(0, 0.8, 0), mudM, merlons, ([x, y, z, a]) => {
    o.position.set(x, y, z);
    o.rotation.y = a;
  });
  inst(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 5).rotateX(Math.PI / 2), woodM, stakes, ([x, y, z, a]) => {
    o.position.set(x, y, z);
    o.rotation.y = a;
  });
  // the needle towers: a white shaft latticed in blue, a saucer near the top ringed in glass, a dome and a mast
  for (const [x, z, h] of needleAt) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 4.2, h, 16, 1, true).translate(0, h / 2, 0),
      mats.needle,
    );
    const uv = shaft.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, (uv.getY(i) * h) / TILE);
    shaft.position.set(x, 0, z);
    shaft.castShadow = true;
    scene.add(shaft);
    const top = new THREE.Group();
    top.position.set(x, h * 0.84, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(14, 7, 3.2, 40), whiteM);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 13.6, 2, 40, 1, true), glassM);
    ring.position.y = 2.6;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(9, 12.6, 1.4, 40), whiteM);
    lid.position.y = 4.2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeM);
    dome.position.y = 4.9;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.6, h * 0.22, 6).translate(0, (h * 0.22) / 2, 0),
      whiteM,
    );
    mast.position.y = 9.5;
    for (const m of [disc, ring, lid, dome, mast]) {
      m.castShadow = true;
      top.add(m);
    }
    scene.add(top);
  }

  // the Great Mosque: white walls with arched windows and green bands, a big white dome on a drum, one tall minaret
  {
    const arches = canvasTex(256, 128, (x, w, h) => {
      x.fillStyle = '#efe8dc';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f7a4a';
      x.fillRect(0, 0, w, 12);
      x.fillRect(0, h - 10, w, 10);
      for (let k = 0; k < 4; k++) {
        const cx = 32 + k * 64;
        x.fillStyle = '#2f6f5a';
        x.beginPath();
        x.moveTo(cx - 16, h - 22);
        x.lineTo(cx - 16, 52);
        x.arc(cx, 52, 16, Math.PI, 0);
        x.lineTo(cx + 16, h - 22);
        x.fill();
      }
    });
    arches.wrapS = THREE.RepeatWrapping;
    let at = null;
    for (let k = 0; k < 1500 && !at; k++) {
      const s = rand() * tr.len,
        sd = rand() < 0.5 ? 1 : -1,
        p = tr.beside(tr.idx(s), sd * (W / 2 + rr(62, 110)));
      if (dk.free(p.x, p.z, 26, W / 2 + 20)) at = { p, a: Math.atan2(tr.L[tr.idx(s)].x * sd, tr.L[tr.idx(s)].z * sd) };
    }
    if (at) {
      dk.reserve(at.p.x, at.p.z, 32);
      const g = new THREE.Group();
      g.position.set(at.p.x, 0, at.p.z);
      g.rotation.y = at.a;
      const wallM = new THREE.MeshLambertMaterial({ map: arches });
      const hall = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 34).translate(0, 7, 0), [
        wallM,
        wallM,
        whiteM,
        whiteM,
        wallM,
        wallM,
      ]);
      arches.repeat.set(2, 1);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 4, 32).translate(0, 16, 0), whiteM);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(10.7, 10.7, 1, 32).translate(0, 18.2, 0),
        new THREE.MeshLambertMaterial({ color: '#1f7a4a' }),
      );
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(10.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.1, 1).translate(0, 18.5, 0),
        new THREE.MeshLambertMaterial({ color: '#f6f1e6' }),
      );
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 4, 8).translate(0, 32, 0), goldM);
      const min = new THREE.Group();
      min.position.set(17, 0, 13);
      const greenM = new THREE.MeshLambertMaterial({ color: '#1f7a4a' });
      min.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 52, 8).translate(0, 26, 0), whiteM));
      for (const y of [22, 36, 48]) {
        min.add(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.2, 1.2, 12).translate(0, y, 0), greenM));
        min.add(new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.5, 12).translate(0, y + 0.85, 0), whiteM));
      }
      min.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 52, 0),
          whiteM,
        ),
      );
      min.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 6, 6).translate(0, 57, 0), goldM));
      for (const m of [hall, drum, band, dome, fin, ...min.children]) m.castShadow = m.receiveShadow = true;
      g.name = 'great-mosque';
      g.add(hall, drum, band, dome, fin, min);
      scene.add(g);
    }
  }

  // airships, drifting slowly round high over the city: a white envelope with a green band, fins, a gondola under it
  const ships = [];
  {
    const envM = new THREE.MeshPhongMaterial({ color: '#f6f4ef', shininess: 40 }),
      bandM = new THREE.MeshLambertMaterial({ color: '#1f7a4a' }),
      gonM = new THREE.MeshLambertMaterial({ color: '#d9cdbd' });
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      const env = new THREE.Mesh(new THREE.CapsuleGeometry(6, 22, 8, 16).rotateZ(Math.PI / 2), envM);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(6.08, 6.08, 2.2, 24).rotateZ(Math.PI / 2), bandM);
      const gon = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 3).translate(0, -7, 0), gonM);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 1).translate(0, -5.6, 0), gonM); // (holds the gondola up to the envelope)
      g.name = 'airship';
      g.add(env, band, gon, strut);
      for (const [ry, rx] of [
        [0, 0],
        [0, Math.PI / 2],
      ]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.4).translate(-15.5, 0, 0), bandM);
        fin.rotation.set(rx, ry, 0);
        g.add(fin);
      }
      scene.add(g);
      ships.push({
        g,
        r: R0 * rr(0.45, 0.9),
        y: rr(105, 150),
        a0: rand() * Math.PI * 2,
        v: rr(0.008, 0.016) * (k % 2 ? 1 : -1),
      });
    }
  }

  // the solar pyramids: a few clusters on open ground, stepped, blue-black glass, a gold seam along every step
  {
    const steps = [],
      seams = [];
    let made = 0;
    for (let k = 0; k < 400 && made < 4; k++) {
      const a = rand() * Math.PI * 2,
        r = rr(inner, outer),
        x0 = C.x + Math.cos(a) * r,
        z0 = C.z + Math.sin(a) * r;
      if (roadGap(x0, z0) < W / 2 + 40) continue;
      if (!dk.free(x0, z0, 16, W / 2 + 30)) continue;
      dk.reserve(x0, z0, 18);
      made++;
      const n = 2 + ((rand() * 2) | 0);
      for (let p = 0; p < n; p++) {
        const x = x0 + (p ? rr(-12, 12) : 0),
          z = z0 + (p ? rr(-12, 12) : 0),
          b = p ? rr(9, 13) : rr(16, 20),
          ry = rand() * Math.PI,
          ns = 6,
          sh = b * 0.13;
        for (let s = 0; s < ns; s++) {
          const w = b * (1 - s / ns);
          steps.push([x, s * sh, z, w, sh, ry, s % 2 ? '#1b2a66' : '#22357a']);
          seams.push([x, s * sh + sh - 0.12, z, w + 0.12, 0.22, ry]);
        }
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    if (steps.length) {
      const m = new THREE.InstancedMesh(box, glassM, steps.length);
      steps.forEach(([x, y, z, w, h, ry, c], i) => {
        o.position.set(x, y, z);
        o.rotation.set(0, ry, 0);
        o.scale.set(w, h, w);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, col.set(c));
      });
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const s = new THREE.InstancedMesh(box, goldM, seams.length);
      seams.forEach(([x, y, z, w, h, ry], i) => {
        o.position.set(x, y, z);
        o.rotation.set(0, ry, 0);
        o.scale.set(w, h, w);
        o.updateMatrix();
        s.setMatrixAt(i, o.matrix);
      });
      scene.add(s);
    }
  }

  // the monorail: a ring round the city on pylons, high over everything (the road included: where it crosses the road
  // the span carries on over it, no pylon on the tarmac), and a white train with a green stripe going round
  const ring = [],
    RM = Math.min(R0 - 34, tr.radius + 120),
    NM = 160;
  for (let k = 0; k <= NM; k++) {
    const a = (k / NM) * Math.PI * 2,
      r = RM + Math.sin(a * 3) * 10,
      x = C.x + Math.cos(a) * r,
      z = C.z + Math.sin(a) * r;
    let roadY = 0;
    const n = tr.nearest(x, z);
    if (n.d < 40) roadY = Math.max(0, tr.P[n.i].y);
    ring.push(new THREE.Vector3(x, Math.max(17, roadY + 12), z));
  }
  // smooth the height so the guideway never steps
  for (let pass = 0; pass < 6; pass++)
    for (let k = 1; k < NM; k++) ring[k].y = Math.max(ring[k].y, (ring[k - 1].y + ring[k + 1].y) / 2);
  ring[NM].copy(ring[0]);
  const curve = new THREE.CatmullRomCurve3(ring.slice(0, NM), true);
  {
    const beamG = new THREE.TubeGeometry(curve, 480, 0.9, 6, true);
    const beam = new THREE.Mesh(beamG, new THREE.MeshLambertMaterial({ color: '#f4f2ec' }));
    beam.castShadow = true;
    scene.add(beam);
    // a green line along its side
    const railPts = curve.getSpacedPoints(480).map(p => p.clone().setY(p.y - 0.95));
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, true), 480, 0.22, 4, true),
      new THREE.MeshLambertMaterial({ color: '#1f8a4c' }),
    );
    scene.add(rail);
    // pylons every so often, on land and clear of the road (a pylon that would stand on the road is left out)
    const pyl = [],
      pg = new THREE.CylinderGeometry(0.7, 1.1, 1, 8).translate(0, 0.5, 0),
      L = curve.getLength(),
      step = 34;
    for (let s = 0; s < L; s += step) {
      const p = curve.getPointAt(s / L);
      if (roadGap(p.x, p.z) < W / 2 + 4) continue;
      pyl.push(pg.clone().scale(1, p.y, 1).translate(p.x, 0, p.z));
      // a Y head under the beam
      const head = new THREE.CylinderGeometry(1.6, 0.8, 1.4, 8).translate(p.x, p.y - 1.6, p.z);
      pyl.push(head);
    }
    const pm = new THREE.Mesh(mergeGeometries(pyl), new THREE.MeshLambertMaterial({ color: '#d9cdbd' }));
    pm.castShadow = true;
    scene.add(pm);
  }
  // the train: five cars, a rounded nose at each end, sat on top of the beam
  const train = new THREE.Group(),
    cars = [],
    CAR = 14;
  {
    const bodyM = new THREE.MeshPhongMaterial({ color: '#f6f2ea', specular: '#ffffff', shininess: 80 });
    const stripM = new THREE.MeshPhongMaterial({ color: '#2f5f94', specular: '#ffffff', shininess: 90 }); // (the windows)
    const bandM = new THREE.MeshLambertMaterial({ color: '#1f8a4c' });
    for (let c = 0; c < 5; c++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, CAR - 3, 4, 10).rotateZ(Math.PI / 2), bodyM);
      b.scale.set(1, 1, 1.1);
      b.position.y = 2.2;
      b.castShadow = true;
      const s = new THREE.Mesh(new THREE.BoxGeometry(CAR - 3.2, 0.5, 3.4), stripM);
      s.position.y = 2.7;
      const band = new THREE.Mesh(new THREE.BoxGeometry(CAR - 2.4, 0.3, 3.36), bandM);
      band.position.y = 1.55;
      g.add(b, s, band);
      train.add(g);
      cars.push(g);
    }
    scene.add(train);
  }
  const trainLen = curve.getLength(),
    up = new THREE.Vector3(0, 1, 0),
    _p = new THREE.Vector3(),
    _q = new THREE.Vector3();

  return {
    night(n) {
      for (const [m, d, k] of glowing) m.emissiveIntensity = d + (k - d) * n;
    },
    update(t) {
      for (const sh of ships) {
        const a = sh.a0 + t * sh.v;
        sh.g.position.set(C.x + Math.cos(a) * sh.r, sh.y + Math.sin(t * 0.3 + sh.a0) * 2, C.z + Math.sin(a) * sh.r);
        sh.g.rotation.y = -a - (sh.v > 0 ? 0 : Math.PI); // (nose along the way it drifts)
      }
      // the train goes round in about 70 s
      const u0 = ((t * 22) % trainLen) / trainLen;
      cars.forEach((g, i) => {
        const u = (u0 - (i * (CAR + 0.6)) / trainLen + 1) % 1;
        curve.getPointAt(u, _p);
        curve.getPointAt((u + 0.002) % 1, _q);
        g.position.copy(_p).addScaledVector(up, 0.7);
        g.lookAt(_q.x, _p.y + 0.7, _q.z);
        g.rotateY(Math.PI / 2);
      });
    },
  };
}
