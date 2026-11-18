// Kano Central, 2070: Kano City's railway station rebuilt for the future, and the train you drive through.
// The front is a mud-brick gatehouse in the old style: a tall pointed arch over the road, crenellations, wooden stakes
// out of the walls, two cone towers either side, the Kano knot over the arch and KANO CENTRAL lit across it. Behind
// it a long glass vault on white ribs spans the road, both platforms and the tracks beyond them, and at the platforms
// stand trains like the monorail's: white, a dark window band, a green stripe, a rounded nose.
// Down the middle runs the Kano Express, a hovering carrier train as wide as the road. As you come down off the
// interchange it pulls out of the station ahead of you along your road; you catch it, its back doors burst open, you
// race through its lit cabin (seats and passengers either side, the city going by in the windows), its nose bursts
// open and you're out. It runs on to the far end of the station and waits there until you're well away, then it's
// back at the start for the next lap. It's a moving room the karts drive through, not a thing to hit: it never
// touches the road (its floor is the road; its sides and seats stand outside the road's edges, over the platforms).
import * as THREE from 'three';
import { canvasTex } from './textures.js';
import { game } from './game.js';
import { Sound } from './audio.js';

const WHITE = '#f6f4ef',
  GREEN = '#1f8a4c',
  GLASS = '#1d3550',
  SAND = '#c98d55';

// the train's side as seen from outside: white, a dark band of windows, a green stripe, the knot and the name
function sideTex(len, name) {
  return canvasTex(2048, 256, (x, w, h) => {
    x.fillStyle = WHITE;
    x.fillRect(0, 0, w, h);
    x.fillStyle = GLASS;
    x.fillRect(0, h * 0.18, w, h * 0.34);
    x.fillStyle = 'rgba(255,255,255,.18)';
    x.fillRect(0, h * 0.2, w, h * 0.05);
    x.fillStyle = GREEN;
    x.fillRect(0, h * 0.6, w, h * 0.1);
    x.fillStyle = '#ffc65c';
    x.fillRect(0, h * 0.71, w, h * 0.025);
    // car joints
    const cars = Math.round(len / 28);
    x.fillStyle = '#c9c5bc';
    for (let c = 1; c < cars; c++) x.fillRect((c / cars) * w - 4, 0, 8, h);
    x.fillStyle = GREEN;
    x.font = `italic 800 ${h * 0.14}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    x.textBaseline = 'middle';
    for (let c = 0; c < cars; c++) x.fillText(name, (c / cars) * w + 30, h * 0.85);
  });
}
// the cabin's wall from inside: cream panels, big windows onto the city (sky and a skyline), a handrail
function cabinTex() {
  return canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = '#efe7d8';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const wx = 20 + i * 256,
        g = x.createLinearGradient(0, h * 0.15, 0, h * 0.55);
      g.addColorStop(0, '#7fb8ec');
      g.addColorStop(1, '#d8ecfa');
      x.fillStyle = g;
      x.fillRect(wx, h * 0.15, 216, h * 0.4);
      x.fillStyle = 'rgba(160,110,70,.55)';
      for (let k = 0; k < 6; k++) {
        const bh = 20 + ((k * 37 + i * 13) % 50);
        x.fillRect(wx + 10 + k * 34, h * 0.55 - bh, 22, bh);
      }
    }
    x.fillStyle = GREEN;
    x.fillRect(0, h * 0.62, w, h * 0.05);
    x.fillStyle = '#b9b2a4';
    x.fillRect(0, h * 0.85, w, h * 0.15);
  });
}
// the ceiling: pale, two long light strips
function ceilTex() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#d9d4ca';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.fillRect(w * 0.22, 0, w * 0.08, h);
    x.fillRect(w * 0.7, 0, w * 0.08, h);
  });
}
// the doors at each end, closed: the nose's dark windscreen over white, the green stripe, lights along the bottom
function doorTex(front) {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = WHITE;
    x.fillRect(0, 0, w, h);
    x.fillStyle = GLASS;
    x.beginPath();
    x.moveTo(w * 0.06, h * 0.12);
    x.lineTo(w * 0.94, h * 0.12);
    x.lineTo(w * 0.9, h * 0.5);
    x.lineTo(w * 0.1, h * 0.5);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.2)';
    x.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.04);
    x.fillStyle = GREEN;
    x.fillRect(0, h * 0.62, w, h * 0.08);
    x.fillStyle = front ? '#fffbe6' : '#ff3a3a';
    x.fillRect(w * 0.08, h * 0.78, w * 0.22, h * 0.05);
    x.fillRect(w * 0.7, h * 0.78, w * 0.22, h * 0.05);
    x.fillStyle = '#2a2a2a';
    x.fillRect(w / 2 - 3, 0, 6, h); // (where the two leaves meet)
  });
}

export function kanoCentral(k, h, f) {
  const { tr, W, rr } = k;
  const { lam, bx, cy, group, mesh, glow, head } = h;
  const L = f.len,
    mid = f.s + L / 2,
    o = tr.point(mid, 0),
    G = group(o.x, o.z, head(mid)),
    FRONT = -L / 2,
    PL0 = W / 2 + 1.5,
    PL1 = W / 2 + 9,
    TR = W / 2 + 12.5;
  const white = lam(WHITE),
    platM = lam('#d8d2c4'),
    edgeM = lam('#f2c230');

  /* ---------- the gatehouse at the way in ---------- */
  {
    const FW = W + 46,
      FH = 22,
      FD = 9;
    const sh = new THREE.Shape();
    sh.moveTo(-FW / 2, 0);
    sh.lineTo(FW / 2, 0);
    sh.lineTo(FW / 2, FH);
    sh.lineTo(-FW / 2, FH);
    sh.lineTo(-FW / 2, 0);
    const hw = W / 2 + 1,
      spring = 9,
      apex = 17;
    const hole = new THREE.Path();
    hole.moveTo(-hw, 0);
    hole.lineTo(-hw, spring);
    hole.quadraticCurveTo(-hw, apex - 2, 0, apex);
    hole.quadraticCurveTo(hw, apex - 2, hw, spring);
    hole.lineTo(hw, 0);
    hole.lineTo(-hw, 0);
    sh.holes.push(hole);
    const mudT = canvasTex(256, 256, (x, w, hh) => {
      x.fillStyle = SAND;
      x.fillRect(0, 0, w, hh);
      for (let i = 0; i < 900; i++) {
        x.fillStyle = `rgba(${Math.random() < 0.5 ? '120,70,30' : '255,230,190'},${0.05 + Math.random() * 0.08})`;
        x.fillRect(Math.random() * w, Math.random() * hh, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
    });
    mudT.wrapS = mudT.wrapT = THREE.RepeatWrapping;
    mudT.repeat.set(0.08, 0.08);
    const mudM = lam('#ffffff', { map: mudT });
    const front = mesh(
      new THREE.ExtrudeGeometry(sh, { depth: FD, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -FD / 2),
      mudM,
    );
    front.position.z = FRONT;
    G.add(front);
    // crenellations along the top, stakes out of the face
    for (let x = -FW / 2 + 1; x <= FW / 2 - 1; x += 2.6) {
      G.add(mesh(bx(1.6, 1.8, FD), mudM, x, FH, FRONT));
    }
    const woodM = lam('#6b4426');
    for (const y of [5, 12, 18])
      for (let x = -FW / 2 + 2; x <= FW / 2 - 2; x += 4.5) {
        if (Math.abs(x) < hw + 1.5 && y < apex + 1) continue;
        for (const ez of [-1, 1]) {
          const st = mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 2, 5).rotateX(Math.PI / 2),
            woodM,
            x,
            y,
            FRONT + ez * (FD / 2 + 0.6),
          );
          G.add(st);
        }
      }
    // the cone towers either side: tall tapering mud cones with stakes, a white tip
    for (const sx of [-1, 1]) {
      const tx = sx * (FW / 2 + 3);
      G.add(mesh(new THREE.CylinderGeometry(1.2, 6.5, 34, 12).translate(0, 17, 0), mudM, tx, 0, FRONT));
      G.add(mesh(new THREE.ConeGeometry(1.2, 4, 12).translate(0, 36, 0), white, tx, 0, FRONT));
      for (let y = 6; y < 30; y += 5.5)
        for (let q = 0; q < 6; q++) {
          const a = (q / 6) * Math.PI * 2 + y,
            r = 6.5 - (y / 34) * 5.3 + 0.7;
          const st = mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 1.8, 5).rotateZ(Math.PI / 2),
            woodM,
            tx + Math.cos(a) * r,
            y,
            FRONT + Math.sin(a) * r,
          );
          st.rotation.y = -a;
          G.add(st);
        }
    }
    // the knot over the arch, gold, and KANO CENTRAL lit across the front
    const knotT = canvasTex(256, 256, (x, w, hh) => {
      x.fillStyle = '#7a4a26';
      x.fillRect(0, 0, w, hh);
      x.strokeStyle = '#ffc65c';
      x.lineWidth = 14;
      x.lineJoin = 'round';
      const c = w / 2,
        s = 80;
      x.beginPath();
      x.moveTo(c, c - s);
      x.lineTo(c + s, c);
      x.lineTo(c, c + s);
      x.lineTo(c - s, c);
      x.closePath();
      x.moveTo(c - s / 2, c - s / 2);
      x.lineTo(c + s / 2, c + s / 2);
      x.moveTo(c + s / 2, c - s / 2);
      x.lineTo(c - s / 2, c + s / 2);
      x.stroke();
    });
    const nameT = canvasTex(1024, 128, (x, w, hh) => {
      x.fillStyle = '#5a3418';
      x.fillRect(0, 0, w, hh);
      x.fillStyle = '#ffe2a8';
      x.font = `800 ${hh * 0.7}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('KANO CENTRAL', w / 2, hh * 0.55);
    });
    const knotM = glow(lam('#ffffff', { map: knotT }), knotT, '#ffffff', 0.9),
      nameM = glow(lam('#ffffff', { map: nameT }), nameT, '#ffffff', 1);
    for (const ez of [-1, 1]) {
      const kp = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), knotM);
      kp.position.set(0, apex + 2.8, FRONT + ez * (FD / 2 + 0.05));
      if (ez < 0) kp.rotation.y = Math.PI;
      G.add(kp);
      const np = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.25), nameM);
      np.position.set(0, FH - 1.2, FRONT + ez * (FD / 2 + 0.05));
      if (ez < 0) np.rotation.y = Math.PI;
      G.add(np);
    }
  }

  /* ---------- the platforms, the side tracks, the glass vault ---------- */
  const V0 = FRONT + 6,
    V1 = L / 2,
    VL = V1 - V0,
    VR = TR + 6,
    VS = 10; // the vault: its springing height and radius
  for (const sd of [-1, 1]) {
    G.add(mesh(bx(PL1 - PL0, 1, L - 12), platM, sd * ((PL0 + PL1) / 2), 0, (V0 + V1) / 2));
    G.add(mesh(bx(0.5, 1.02, L - 12), edgeM, sd * (PL1 - 0.25), 0, (V0 + V1) / 2));
    G.add(mesh(bx(4.6, 0.3, L + 40), lam('#7a7468'), sd * TR, 0, 0));
    G.add(mesh(bx(1.8, 0.5, L + 40), lam('#d9d4ca'), sd * TR, 0.3, 0)); // (the maglev beam)
    // the outer walls the vault stands on: white, with glass between the piers
    G.add(mesh(bx(1, VS, VL), white, sd * (VR + 0.5), 0, (V0 + V1) / 2));
  }
  {
    const glassM = new THREE.MeshPhongMaterial({
      color: '#cfe8ff',
      specular: '#ffffff',
      shininess: 120,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(VR, VR, VL, 48, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(0),
      glassM,
    );
    // (a half cylinder lying along z, its open side down)
    vault.geometry.rotateZ(0);
    vault.position.set(0, VS, (V0 + V1) / 2);
    vault.scale.set(1, 0.55, 1);
    vault.renderOrder = 3;
    G.add(vault);
    for (let z = V0; z <= V1 + 0.1; z += 12) {
      const rib = mesh(new THREE.TorusGeometry(VR, 0.45, 6, 40, Math.PI), white, 0, VS, z);
      rib.scale.set(1, 0.55, 1);
      G.add(rib);
    }
    const spine = mesh(new THREE.BoxGeometry(1.4, 0.6, VL), white, 0, VS + VR * 0.55, (V0 + V1) / 2);
    G.add(spine);
    // green banners with the knot down the vault's walls
    const banT = canvasTex(64, 192, (x, w, hh) => {
      x.fillStyle = GREEN;
      x.fillRect(0, 0, w, hh);
      x.strokeStyle = '#f4f1ea';
      x.lineWidth = 4;
      const c = w / 2,
        cy2 = hh / 2,
        s = 18;
      x.beginPath();
      x.moveTo(c, cy2 - s);
      x.lineTo(c + s, cy2);
      x.lineTo(c, cy2 + s);
      x.lineTo(c - s, cy2);
      x.closePath();
      x.stroke();
    });
    const banM = lam('#ffffff', { map: banT, side: THREE.DoubleSide });
    for (let z = V0 + 18; z < V1 - 6; z += 24)
      for (const sd of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 7), banM);
        b.position.set(sd * (VR - 0.2), VS - 4, z);
        b.rotation.y = Math.PI / 2;
        G.add(b);
      }
  }
  // the trains standing at the platforms: white, a dark window band, a green stripe, a rounded nose each end
  {
    const T = sideTex(140, 'KANO METRO'),
      sideM = lam('#ffffff', { map: T });
    for (const sd of [-1, 1]) {
      const z0 = V0 + 30,
        len = Math.min(140, V1 - z0 - 10);
      const body = mesh(
        new THREE.BoxGeometry(3.4, 4, len).translate(0, 2.8, 0),
        [sideM, sideM, white, white, white, white],
        sd * TR,
        0,
        z0 + len / 2,
      );
      G.add(body);
      for (const e of [-1, 1]) {
        const nose = mesh(
          new THREE.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
            .rotateX((e * Math.PI) / 2)
            .scale(1, 1.15, 2.4),
          white,
          sd * TR,
          2.8,
          z0 + len / 2 + e * (len / 2),
        );
        G.add(nose);
        const wind = mesh(
          new THREE.BoxGeometry(2.6, 1.2, 0.2),
          lam(GLASS),
          sd * TR,
          3.6,
          z0 + len / 2 + e * (len / 2 + 2.4),
        );
        G.add(wind);
      }
    }
  }
  // people waiting on the platforms
  for (let n2 = 0; n2 < 22; n2++) {
    const pz = rr(V0 + 8, V1 - 6),
      px = (n2 % 2 ? 1 : -1) * rr(PL0 + 1.5, PL1 - 1.5),
      robe = lam(['#ffffff', '#1f3f9e', '#c8352e', '#1f8a4c', '#e0a42a', '#6a4a8a'][n2 % 6]);
    G.add(mesh(cy(0.28, 0.42, 1.5, 8), robe, px, 1, pz));
    G.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), lam('#5a3a26'), px, 2.72, pz));
  }

  /* ---------- the Kano Express: the train you drive through ---------- */
  const TL = 112, // four cars
    HW = W / 2 + 4.5, // half its width: the sides and seats stand outside the road, over the platforms
    TH = 10, // the roof
    FL = 1.4; // the floor of the seating strips either side (above the platforms)
  const train = new THREE.Group();
  G.add(train);
  {
    const sideOut = lam('#ffffff', { map: sideTex(TL, 'KANO EXPRESS') }),
      cabin = lam('#ffffff', { map: cabinTex() });
    cabin.map.repeat.set(TL / 28, 1);
    cabin.map.wrapS = THREE.RepeatWrapping;
    const ceil = new THREE.MeshBasicMaterial({ map: ceilTex() });
    ceil.map.wrapS = ceil.map.wrapT = THREE.RepeatWrapping;
    ceil.map.repeat.set(1, TL / 8);
    // the sides: box walls, white outside, the cabin inside (BoxGeometry faces: +x, -x, +y, -y, +z, -z)
    for (const sd of [-1, 1]) {
      const mats = sd < 0 ? [cabin, sideOut, white, white, white, white] : [sideOut, cabin, white, white, white, white];
      train.add(
        mesh(new THREE.BoxGeometry(0.6, TH - FL, TL).translate(0, (TH + FL) / 2, 0), mats, sd * (HW + 0.3), 0, 0),
      );
      // the seating strip: a floor, rows of seats facing the way it goes, people in some of them
      train.add(
        mesh(
          new THREE.BoxGeometry(HW - W / 2 - 0.4, 0.3, TL).translate(0, FL - 0.15, 0),
          lam('#9a9488'),
          sd * ((HW + W / 2 + 0.4) / 2),
          0,
          0,
        ),
      );
      const seatM = lam(GREEN);
      for (let z = -TL / 2 + 3; z < TL / 2 - 2; z += 2.4)
        for (const x of [W / 2 + 1.4, W / 2 + 3.2]) {
          train.add(mesh(new THREE.BoxGeometry(1.4, 0.5, 1).translate(0, FL + 0.6, 0), seatM, sd * x, 0, z));
          train.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 0.25).translate(0, FL + 1.3, -0.4), seatM, sd * x, 0, z));
          if (((z * 7 + x * 3) | 0) % 3 === 0) {
            const robe = lam(
              ['#ffffff', '#1f3f9e', '#c8352e', '#e0a42a', '#6a4a8a'][((z + x) | 0) % 5 >= 0 ? ((z + x) | 0) % 5 : 0],
            );
            train.add(mesh(cy(0.3, 0.4, 1.1, 8), robe, sd * x, FL + 0.85, z + 0.1));
            train.add(mesh(new THREE.SphereGeometry(0.24, 10, 8), lam('#5a3a26'), sd * x, FL + 2.2, z + 0.1));
          }
        }
      // the hover glow under each side
      const hov = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.25, TL - 4),
        new THREE.MeshBasicMaterial({ color: '#5fe6ff' }),
      );
      hov.position.set(sd * (HW + 0.3), FL - 0.2, 0);
      train.add(hov);
      // the green line along the floor inside, at the road's edge
      const ln = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.06, TL - 2),
        new THREE.MeshBasicMaterial({ color: '#2fe08a' }),
      );
      ln.position.set(sd * (W / 2 - 0.4), 0.06, 0);
      train.add(ln);
    }
    // the roof: white outside, the lit ceiling inside, rounded along both edges
    train.add(
      mesh(
        new THREE.BoxGeometry(HW * 2 + 1.2, 0.6, TL).translate(0, TH + 0.3, 0),
        [white, white, white, ceil, white, white],
        0,
        0,
        0,
      ),
    );
    for (const sd of [-1, 1]) {
      const edge = mesh(
        new THREE.CylinderGeometry(1.1, 1.1, TL, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2),
        white,
        sd * (HW + 0.2),
        TH - 0.1,
        0,
      );
      edge.rotation.z = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
      train.add(edge);
    }
    // a rounded fairing round each end, and two door leaves in it that burst open
    const frameSh = new THREE.Shape();
    frameSh.moveTo(-HW - 1.4, 0);
    frameSh.lineTo(HW + 1.4, 0);
    frameSh.lineTo(HW + 1.4, TH - 1);
    frameSh.quadraticCurveTo(HW + 1.4, TH + 2.2, HW - 2, TH + 2.2);
    frameSh.lineTo(-HW + 2, TH + 2.2);
    frameSh.quadraticCurveTo(-HW - 1.4, TH + 2.2, -HW - 1.4, TH - 1);
    frameSh.lineTo(-HW - 1.4, 0);
    const opening = new THREE.Path();
    opening.moveTo(-W / 2 - 0.5, 0);
    opening.lineTo(W / 2 + 0.5, 0);
    opening.lineTo(W / 2 + 0.5, TH - 1.2);
    opening.lineTo(-W / 2 - 0.5, TH - 1.2);
    opening.lineTo(-W / 2 - 0.5, 0);
    frameSh.holes.push(opening);
    const frameG = new THREE.ExtrudeGeometry(frameSh, {
      depth: 3,
      bevelEnabled: true,
      bevelSize: 0.5,
      bevelThickness: 0.5,
      bevelSegments: 3,
    });
    const doors = { front: [], back: [] };
    for (const e of [-1, 1]) {
      const fr = mesh(frameG, white, 0, 0, e * (TL / 2) + (e > 0 ? 0 : -3));
      train.add(fr);
      const dm = lam('#ffffff', { map: doorTex(e > 0) });
      for (const sx of [-1, 1]) {
        // each leaf hinged at the side of the opening, swinging outward
        const hinge = new THREE.Group();
        hinge.position.set(sx * (W / 2 + 0.5), 0, e * (TL / 2 + (e > 0 ? 3.2 : 3.2)));
        const leafW = W / 2 + 0.5;
        const geo = new THREE.BoxGeometry(leafW, TH - 1.2, 0.3).translate(-sx * (leafW / 2), (TH - 1.2) / 2, 0);
        const uv = geo.attributes.uv;
        // (each leaf shows its half of the door picture)
        for (let i = 0; i < uv.count; i++) uv.setX(i, sx < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
        const leaf = mesh(geo, dm);
        hinge.add(leaf);
        train.add(hinge);
        (e > 0 ? doors.front : doors.back).push({ hinge, sx, e });
      }
    }
    train.userData.doors = doors;
  }

  // the run: waits at the platform's start, pulls out as you come down off the interchange, runs on ahead of you and
  // stops at the far end, then waits until you're well away before it's back at the start
  const tailHome = FRONT + 22, // (local z of its back at rest)
    tailEnd = L / 2 + 40 - TL; // (its nose stops 40 m past the vault: the straight runs on 40 m and more)
  let tail = tailHome,
    v = 0,
    state = 'wait',
    lastT = null;
  const open = { front: 0, back: 0 },
    want = { front: 0, back: 0 },
    banged = { front: false, back: false };
  const sOf = z => mid + z; // (local z to distance along the lap)
  const lap = s => ((s % tr.len) + tr.len) % tr.len;
  const ahead = (s, from) => {
    // how far s is ahead of from along the lap (-len/2 .. len/2)
    let d = lap(s) - lap(from);
    if (d > tr.len / 2) d -= tr.len;
    if (d < -tr.len / 2) d += tr.len;
    return d;
  };
  h.animated?.push?.(t => {
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    const R = game.race,
      P = R?.player;
    if (!P) return;
    const ps = P.s,
      rel = ahead(ps, sOf(tail)); // the player relative to the train's back
    if (state === 'wait' && rel > -150 && rel < -50) {
      state = 'go';
      v = 0;
    }
    if (state === 'go') {
      const top = Math.max(10, Math.min(22, (P.speed || 30) * 0.45)),
        left = tailEnd - tail;
      v = Math.min(top, v + 7 * dt, Math.max(2, Math.sqrt(2 * 4 * Math.max(0, left))));
      tail += v * dt;
      if (left < 0.5) {
        tail = tailEnd;
        state = 'done';
      }
    }
    if (state === 'done' && Math.abs(ahead(ps, sOf(L / 2))) > 400) {
      state = 'wait';
      tail = tailHome;
      open.front = open.back = 0;
    }
    train.position.z = tail + TL / 2;
    // the doors: open when any kart is coming up to them, the player's arrival with a bang
    const near = (zEnd, back) => {
      for (const kk of R.all || [P]) {
        const d = ahead(kk.s, sOf(zEnd));
        if (back ? d > -28 && d < 8 : d > -24 && d < 10) return kk;
      }
      return null;
    };
    const kb = near(tail, true),
      kf = near(tail + TL, false);
    want.back = kb ? 1 : 0;
    want.front = kf ? 1 : 0;
    for (const e of ['front', 'back']) {
      const was = open[e];
      open[e] += (want[e] - open[e]) * Math.min(1, dt * (want[e] ? 14 : 3));
      if (want[e] && was < 0.05 && (e === 'back' ? kb : kf) === P && !banged[e]) {
        banged[e] = true;
        Sound.hit?.();
      }
      if (!want[e]) banged[e] = false;
      for (const d of train.userData.doors[e]) d.hinge.rotation.y = d.sx * d.e * open[e] * 1.75;
    }
  });
  return { train };
}
