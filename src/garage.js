// Each city has its own garage room round the same stand, camera and UI: Kano's is the navy room below; Doha's is the
// big industrial workshop in workshop.js (garage design 5). new Garage(tex, { room: 'workshop' }) picks Doha's.
// Buddy's garage (Kano): a room of its own, after the reference the game's look comes from. Navy walls, a tiled floor with
// bay markings, a hazard-striped roller door with graffiti, shelves of crates, tyre stacks, oil drums, a red tool
// chest, an arcade cabinet, traffic cones, a hanging work lamp over the turntable. You come in through the front door:
// it rolls up as the camera glides in, and rolls down behind you on the way out.
import * as THREE from 'three';
import { makeKart, RACERS, ENV } from './buddy.js';
import { canvasTex } from './textures.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { buildWorkshop } from './workshop.js';
const REFLECT_OFF =
  typeof matchMedia === 'function' &&
  matchMedia('(pointer: coarse)').matches &&
  Math.min(screen.width, screen.height) < 380; // very small phones skip the reflection

const R = Math.random;
const sstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const eio = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function hazardTex(w = 256, h = 64) {
  return canvasTex(
    w,
    h,
    x => {
      x.fillStyle = '#ffc400';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#16181d';
      for (let i = -h; i < w + h; i += 48) {
        x.beginPath();
        x.moveTo(i, h);
        x.lineTo(i + 24, h);
        x.lineTo(i + 24 + h, 0);
        x.lineTo(i + h, 0);
        x.fill();
      }
    },
    { repeat: true },
  );
}

export class Garage {
  constructor(tex, { room = 'navy' } = {}) {
    this.tex = tex;
    this.room = room;
    const navy = room === 'navy',
      studio = room === 'studio'; // Singapore's: a dark photo studio, the stand ringed in neon
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color('#070c22');
    S.fog = new THREE.Fog('#070c22', 34, 80);
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const L = (geo, color, opts = {}) =>
      new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts }));
    const put = (m, x, y, z, ry = 0) => {
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = m.receiveShadow = true;
      S.add(m);
      return m;
    };

    this.walls = [];
    if (!navy && !studio) {
      this.ws = buildWorkshop(S, { reflect: !REFLECT_OFF });
      this.door = this.ws.door;
      this.hemi = this.ws.hemi;
    }
    if (studio) {
      // ---------- Singapore's garage: a charcoal workshop, the city's skyline drawn in neon on its back wall, a pool of light on the car and coloured light off the rings ----------
      S.background.set('#131417');
      S.fog.color.set('#131417');
      this.hemi = new THREE.HemisphereLight('#aab4c8', '#1a1a20', 0.75);
      S.add(this.hemi);
      const key = new THREE.SpotLight('#ffffff', 90, 34, 0.6, 0.6, 1.3);
      key.position.set(2, 9.5, 4);
      key.target.position.set(0, 1, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0004;
      S.add(key, key.target);
      (this.studio ||= []).push(key);
      for (const [c, x, z] of [
        ['#22e6ff', -8, 5],
        ['#ff3fd0', 8, -5],
      ]) {
        const l = new THREE.PointLight(c, 30, 18, 1.6);
        l.position.set(x, 1.6, z);
        S.add(l);
        (this.neonLights ||= []).push(l);
      }
      // the floor: dark, a little glossy, a soft glow spilling out from under the stand
      const fl = new THREE.Mesh(
        new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.55, metalness: 0.3 }),
      );
      fl.receiveShadow = true;
      S.add(fl);
      const glowT = canvasTex(256, 256, (x, w) => {
        const g = x.createRadialGradient(w / 2, w / 2, w * 0.22, w / 2, w / 2, w / 2);
        g.addColorStop(0, 'rgba(34,230,255,.55)');
        g.addColorStop(0.5, 'rgba(255,63,208,.16)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, w);
      });
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          map: glowT,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      pool.position.y = 0.02;
      S.add(pool);
      this.pool = pool;
      // the room: a real garage round the stand. Dark concrete walls in panels with faint brush strokes, a ceiling of
      // lit panels, and along the walls what a garage has: a red tool chest, shelves of parts, stacks of tyres, an air
      // compressor, a workbench, a green EXIT sign over a side door. (Open at the front: you walk straight in.)
      const strokeT = canvasTex(1024, 512, (x, w, h) => {
        x.fillStyle = '#1b1c21';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 26; i++) {
          x.save();
          x.translate(Math.random() * w, Math.random() * h);
          x.rotate(-0.5 + Math.random() * 0.25);
          x.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.03})`;
          x.fillRect(-220, -18 - Math.random() * 40, 440 + Math.random() * 300, 30 + Math.random() * 70);
          x.restore();
        }
        x.fillStyle = 'rgba(0,0,0,.4)';
        for (let q = 0; q <= 6; q++) x.fillRect((q * w) / 6 - 2, 0, 4, h); // the joints between panels
        x.fillRect(0, h - 70, w, 4);
        x.fillStyle = '#101114';
        x.fillRect(0, h - 66, w, 66); // a dark skirting
      });
      const wallM = new THREE.MeshStandardMaterial({ map: strokeT, roughness: 0.85 });
      this.backdrop = { material: wallM };
      const RW = 15,
        RD = 13,
        RH = 10.5;
      const wall = (w, x, z, ry) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), wallM);
        m.position.set(x, RH / 2, z);
        m.rotation.y = ry;
        m.receiveShadow = true;
        S.add(m);
      };
      wall(RW * 2, 0, -RD, 0);
      wall(RD * 2 + 14, -RW, 7, Math.PI / 2);
      wall(RD * 2 + 14, RW, 7, -Math.PI / 2);
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(RW * 2, RD * 2 + 14).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.9 }),
      );
      ceil.position.set(0, RH, 7);
      S.add(ceil);
      const lit = c => new THREE.MeshBasicMaterial({ color: c });
      const panelM = lit('#f2f6ff');
      this.panels = panelM;
      for (const [px, pz] of [
        [-6, -6],
        [6, -6],
        [-6, 4],
        [6, 4],
      ]) {
        const pn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.5), panelM); // a ceiling light panel
        pn.position.set(px, RH - 0.1, pz);
        S.add(pn);
        S.add(
          new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.2, 1.8), new THREE.MeshStandardMaterial({ color: '#2a2c32' }))
            .translateX(px)
            .translateY(RH - 0.02)
            .translateZ(pz),
        );
      }
      // a strip light on each side wall, and a duct along the back wall under the ceiling
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 3.2), panelM);
        st.position.set(sx * (RW - 0.1), 6.6, -4);
        S.add(st);
      }
      put(
        L(new THREE.CylinderGeometry(0.45, 0.45, RW * 2 - 2, 14).rotateZ(Math.PI / 2), '#3a3d45', {
          metalness: 0.6,
          roughness: 0.45,
        }),
        0,
        RH - 1.1,
        -RD + 0.9,
      );
      // the red tool chest: a cabinet on castors, drawers with steel pulls, a top box
      {
        const g = new THREE.Group(),
          red = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.35, metalness: 0.3 }),
          pull = new THREE.MeshStandardMaterial({ color: '#d5d9e0', metalness: 0.9, roughness: 0.25 });
        const b = (w, h, d, m, x, y, z) => {
          const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
          q.position.set(x, y, z);
          q.castShadow = q.receiveShadow = true;
          g.add(q);
        };
        b(2.6, 1.7, 1.1, red, 0, 1.05, 0);
        b(2.3, 0.9, 0.95, red, 0, 2.35, 0);
        for (let q = 0; q < 5; q++) b(2.2, 0.05, 0.06, pull, 0, 0.45 + q * 0.3, 0.58);
        for (let q = 0; q < 3; q++) b(1.9, 0.05, 0.06, pull, 0, 2.1 + q * 0.25, 0.5);
        for (const [cx, cz] of [
          [-1.1, -0.4],
          [1.1, -0.4],
          [-1.1, 0.4],
          [1.1, 0.4],
        ])
          b(0.18, 0.2, 0.18, new THREE.MeshStandardMaterial({ color: '#111' }), cx, 0.1, cz);
        g.position.set(-RW + 1.2, 0, -5);
        g.rotation.y = Math.PI / 2;
        S.add(g);
      }
      // ---- the fittings, made the way the real things are ----
      const mt = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o }),
        steelM = mt('#3b3f48', { metalness: 0.7, roughness: 0.4 }),
        darkM = mt('#17181c'),
        concM = mt('#2a2c32', { roughness: 0.9 });
      const part = (geo, m, x, y, z, ry = 0) => {
        const q = new THREE.Mesh(geo, m);
        q.position.set(x, y, z);
        q.rotation.y = ry;
        q.castShadow = q.receiveShadow = true;
        S.add(q);
        return q;
      };
      // the structure: concrete piers up the back wall with a beam across their heads, beams across the ceiling
      for (const px of [-12.5, -6.2, 6.2, 12.5]) {
        part(new THREE.BoxGeometry(1.1, RH, 0.7), concM, px, RH / 2, -RD + 0.35);
        part(new THREE.BoxGeometry(1.5, 0.5, 0.9), concM, px, RH - 1.9, -RD + 0.45); // its capital
      }
      part(new THREE.BoxGeometry(RW * 2, 0.9, 0.8), concM, 0, RH - 1.45, -RD + 0.4);
      for (const bz of [-9, -1, 7]) part(new THREE.BoxGeometry(RW * 2, 0.6, 0.6), concM, 0, RH - 0.3, bz);
      // a hazard band round the foot of the walls
      {
        const hz = canvasTex(
          256,
          32,
          (x, w, h) => {
            x.fillStyle = '#ffc400';
            x.fillRect(0, 0, w, h);
            x.fillStyle = '#17181c';
            for (let q = -1; q < 9; q++) {
              x.beginPath();
              x.moveTo(q * 32, h);
              x.lineTo(q * 32 + 16, 0);
              x.lineTo(q * 32 + 32, 0);
              x.lineTo(q * 32 + 16, h);
              x.fill();
            }
          },
          { repeat: true },
        );
        hz.repeat.set(24, 1);
        const hzM = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.7 });
        part(new THREE.BoxGeometry(RW * 2, 0.32, 0.06), hzM, 0, 0.9, -RD + 0.04);
        for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.06, 0.32, RD * 2 + 14), hzM, sx * (RW - 0.04), 0.9, 7);
      }
      // frosted windows high on the left wall, daylight-white behind them, each in a steel frame with glazing bars
      for (const wz of [-7, -1.5]) {
        part(new THREE.BoxGeometry(0.1, 2.5, 4.4), steelM, -RW + 0.06, 6.6, wz);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.2), lit('#cfe6ff'));
        gl.position.set(-RW + 0.13, 6.6, wz);
        gl.rotation.y = Math.PI / 2;
        S.add(gl);
        for (const dz of [-1.37, 0, 1.37])
          part(new THREE.BoxGeometry(0.06, 2.2, 0.07), steelM, -RW + 0.16, 6.6, wz + dz);
        part(new THREE.BoxGeometry(0.06, 0.07, 4.1), steelM, -RW + 0.16, 6.6, wz);
      }
      // the tool wall: a pegboard over a steel bench, every tool drawn in its outline, a vice on the bench
      {
        const peg = canvasTex(1024, 420, (x, w, h) => {
          x.fillStyle = '#2f3138';
          x.fillRect(0, 0, w, h);
          x.fillStyle = 'rgba(0,0,0,.35)';
          for (let a = 12; a < w; a += 24) for (let b2 = 12; b2 < h; b2 += 24) x.fillRect(a, b2, 3, 3); // the holes
          x.lineCap = 'round';
          const tool = (c, f) => {
            x.strokeStyle = x.fillStyle = c;
            f();
          };
          for (let q = 0; q < 7; q++)
            tool('#c9ced6', () => {
              // spanners, longest first
              const u = 60 + q * 46,
                l = 250 - q * 22;
              x.lineWidth = 9;
              x.beginPath();
              x.moveTo(u, 60);
              x.lineTo(u, 60 + l);
              x.stroke();
              x.lineWidth = 6;
              x.beginPath();
              x.arc(u, 52, 13, 0.6, Math.PI * 2 - 0.6);
              x.stroke();
              x.beginPath();
              x.arc(u, 60 + l + 8, 11, 0, 7);
              x.stroke();
            });
          for (let q = 0; q < 5; q++)
            tool(['#ff3fd0', '#22e6ff', '#ffc400', '#ff3fd0', '#22e6ff'][q], () => {
              const u = 430 + q * 44; // screwdrivers: a coloured handle, a steel shaft
              x.fillRect(u - 9, 60, 18, 90);
              x.fillStyle = '#c9ced6';
              x.fillRect(u - 3, 150, 6, 130);
            });
          tool('#c9ced6', () => {
            x.lineWidth = 12; // a hammer
            x.beginPath();
            x.moveTo(700, 110);
            x.lineTo(700, 330);
            x.stroke();
            x.fillRect(660, 70, 90, 44);
          });
          tool('#d2341f', () => {
            x.lineWidth = 14; // a hacksaw
            x.beginPath();
            x.moveTo(800, 110);
            x.lineTo(990, 110);
            x.lineTo(990, 190);
            x.stroke();
            x.lineWidth = 5;
            x.strokeStyle = '#c9ced6';
            x.beginPath();
            x.moveTo(800, 190);
            x.lineTo(990, 190);
            x.stroke();
            x.fillRect(780, 96, 26, 110);
          });
          tool('#c9ced6', () => {
            for (let q = 0; q < 6; q++) {
              x.beginPath(); // sockets in a row
              x.arc(810 + q * 32, 300, 9 + q * 1.2, 0, 7);
              x.fill();
            }
          });
        });
        const pb = new THREE.Mesh(
          new THREE.PlaneGeometry(8.6, 3.5),
          new THREE.MeshStandardMaterial({ map: peg, roughness: 0.8 }),
        );
        pb.position.set(0, 3.55, -RD + 0.1);
        S.add(pb);
        part(new THREE.BoxGeometry(8.9, 0.1, 0.12), steelM, 0, 5.33, -RD + 0.12);
        part(
          new THREE.BoxGeometry(9, 0.14, 1.5),
          mt('#555a64', { metalness: 0.8, roughness: 0.35 }),
          0,
          1.55,
          -RD + 0.85,
        ); // the bench top
        part(new THREE.BoxGeometry(8.8, 1.3, 1.3), mt('#1f2127', { metalness: 0.4 }), 0, 0.82, -RD + 0.8); // its cabinets
        for (let q = -3; q <= 3; q++) {
          part(new THREE.BoxGeometry(1.1, 1.05, 0.04), mt('#2a2d35', { metalness: 0.5 }), q * 1.22, 0.84, -RD + 1.47); // a door
          part(
            new THREE.BoxGeometry(0.06, 0.4, 0.06),
            mt('#d5d9e0', { metalness: 0.9, roughness: 0.25 }),
            q * 1.22 + 0.42,
            0.9,
            -RD + 1.51,
          );
        }
        // the vice: a base, two jaws, the screw and its bar
        part(new THREE.BoxGeometry(0.5, 0.16, 0.6), mt('#22a6c0', { metalness: 0.5 }), -3.2, 1.7, -RD + 1.1);
        part(new THREE.BoxGeometry(0.4, 0.4, 0.16), mt('#22a6c0', { metalness: 0.5 }), -3.2, 1.96, -RD + 0.95);
        part(new THREE.BoxGeometry(0.4, 0.4, 0.16), mt('#22a6c0', { metalness: 0.5 }), -3.2, 1.96, -RD + 1.3);
        part(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8).rotateX(Math.PI / 2), steelM, -3.2, 1.9, -RD + 1.5);
        part(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8).rotateZ(Math.PI / 2), steelM, -3.2, 1.9, -RD + 1.85);
        // on the bench: a row of oil cans, a toolbox with its handle, a coiled lead
        for (let q = 0; q < 4; q++) {
          part(
            new THREE.CylinderGeometry(0.16, 0.16, 0.42, 14),
            mt(['#c8102e', '#f2f2ee', '#ffc400', '#22a6c0'][q], { metalness: 0.4, roughness: 0.4 }),
            1.4 + q * 0.42,
            1.83,
            -RD + 0.7,
          );
          part(new THREE.CylinderGeometry(0.05, 0.08, 0.1, 10), darkM, 1.4 + q * 0.42, 2.09, -RD + 0.7);
        }
        part(
          new THREE.BoxGeometry(1.0, 0.4, 0.46),
          mt('#c8102e', { metalness: 0.4, roughness: 0.4 }),
          -0.6,
          1.82,
          -RD + 0.9,
        );
        part(new THREE.TorusGeometry(0.16, 0.03, 6, 14, Math.PI), steelM, -0.6, 2.02, -RD + 0.9);
        part(new THREE.TorusGeometry(0.22, 0.04, 8, 18).rotateX(Math.PI / 2), mt('#ff3fd0'), 3.6, 1.66, -RD + 0.9);
      }
      // steel racking in the left corner: oil drums below, boxed parts and spare rims above
      {
        const x0 = -9.4,
          z0 = -RD + 0.75;
        for (const dx of [-1.9, 1.9])
          for (const dz of [-0.5, 0.5]) part(new THREE.BoxGeometry(0.1, 5.6, 0.1), steelM, x0 + dx, 2.8, z0 + dz);
        for (const y of [1.9, 3.3, 4.7]) part(new THREE.BoxGeometry(3.9, 0.08, 1.1), steelM, x0, y, z0);
        for (const [dx, c] of [
          [-1.1, '#1f6f9c'],
          [0, '#c8102e'],
          [1.1, '#1f6f9c'],
        ]) {
          part(
            new THREE.CylinderGeometry(0.5, 0.5, 1.5, 18),
            mt(c, { metalness: 0.5, roughness: 0.45 }),
            x0 + dx,
            0.75,
            z0,
          ); // a drum
          for (const y of [0.4, 1.1])
            part(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 18), mt('#11151c', { metalness: 0.6 }), x0 + dx, y, z0);
        }
        for (const [dx, w, h, c] of [
          [-1.3, 0.9, 0.7, '#8a6a44'],
          [-0.3, 0.8, 0.9, '#7a5c3a'],
          [0.65, 0.9, 0.6, '#8a6a44'],
          [1.45, 0.5, 0.8, '#2a2d35'],
        ]) {
          part(new THREE.BoxGeometry(w, h, 0.8), mt(c, { roughness: 0.85 }), x0 + dx, 1.94 + h / 2, z0); // a carton
          part(
            new THREE.BoxGeometry(w + 0.01, 0.07, 0.81),
            mt('#d9c9a8', { roughness: 0.8 }),
            x0 + dx,
            1.94 + h * 0.55,
            z0,
          ); // its tape
        }
        for (let q = 0; q < 3; q++) {
          // spare rims standing in a row
          const rim = part(
            new THREE.TorusGeometry(0.42, 0.11, 8, 22).rotateY(Math.PI / 2),
            mt('#c3c8cf', { metalness: 0.9, roughness: 0.25 }),
            x0 - 1.1 + q * 1.1,
            3.87,
            z0,
          );
          rim.rotation.y = 0.5;
          part(
            new THREE.CylinderGeometry(0.34, 0.34, 0.1, 16).rotateZ(Math.PI / 2),
            mt('#22e6ff', { metalness: 0.6 }),
            x0 - 1.1 + q * 1.1,
            3.87,
            z0,
          ).rotation.y = 0.5;
        }
        for (let q = 0; q < 5; q++)
          part(
            new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12),
            mt(['#f2f2ee', '#ffc400', '#c8102e', '#f2f2ee', '#22a6c0'][q], { metalness: 0.3 }),
            x0 - 1.3 + q * 0.62,
            4.99,
            z0,
          ); // paint tins
      }
      // a tyre rack on the right of the back wall: two rails, tyres standing upright along them
      {
        const x0 = 9.4,
          z0 = -RD + 0.9,
          rub = mt('#15161a', { roughness: 0.92 });
        for (const y of [0.5, 2.6]) {
          for (const dz of [-0.35, 0.35]) part(new THREE.BoxGeometry(4.2, 0.08, 0.08), steelM, x0, y, z0 + dz);
          for (let q = 0; q < 6; q++) {
            part(
              new THREE.TorusGeometry(0.62, 0.27, 10, 24).rotateY(Math.PI / 2),
              rub,
              x0 - 1.7 + q * 0.68,
              y + 0.86,
              z0,
            );
            part(
              new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16).rotateZ(Math.PI / 2),
              mt(q % 2 ? '#c3c8cf' : '#2a2d35', { metalness: 0.85, roughness: 0.3 }),
              x0 - 1.7 + q * 0.68,
              y + 0.86,
              z0,
            );
          }
        }
        for (const dx of [-2.1, 2.1]) part(new THREE.BoxGeometry(0.1, 4.4, 0.9), steelM, x0 + dx, 2.2, z0);
      }
      // on the floor by the stand: a trolley jack, two axle stands, a creeper, a pair of cones
      {
        const jx = -8.2,
          jz = 3.5,
          jr = mt('#c8102e', { metalness: 0.5, roughness: 0.4 });
        part(new THREE.BoxGeometry(0.7, 0.22, 2.0), jr, jx, 0.22, jz);
        part(new THREE.BoxGeometry(0.5, 0.14, 1.3), jr, jx, 0.48, jz - 0.2).rotation.x = -0.28; // the lifting arm
        part(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), steelM, jx, 0.7, jz - 0.78); // its saddle
        part(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8), steelM, jx, 0.95, jz + 1.35).rotation.x = 0.6; // the handle
        for (const [wx, wz] of [
          [-0.38, -0.85],
          [0.38, -0.85],
          [-0.38, 0.85],
          [0.38, 0.85],
        ])
          part(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12).rotateZ(Math.PI / 2), darkM, jx + wx, 0.12, jz + wz);
        for (const sz of [0.6, 1.8]) {
          part(new THREE.ConeGeometry(0.36, 0.7, 4), mt('#ffc400', { metalness: 0.4 }), 8.6, 0.35, sz).rotation.y =
            Math.PI / 4; // an axle stand
          part(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), steelM, 8.6, 0.85, sz);
          part(new THREE.BoxGeometry(0.3, 0.08, 0.14), steelM, 8.6, 1.12, sz);
        }
        part(new THREE.BoxGeometry(0.75, 0.08, 1.7), darkM, 7.2, 0.16, 5.6, 0.5); // the creeper
        part(
          new THREE.BoxGeometry(0.55, 0.12, 0.4),
          mt('#c8102e'),
          7.2 + Math.sin(0.5) * 0.6,
          0.24,
          5.6 + Math.cos(0.5) * 0.6,
          0.5,
        );
        for (const [cx, cz] of [
          [-9.5, 7.5],
          [-8.6, 8.4],
        ]) {
          part(new THREE.ConeGeometry(0.28, 0.75, 14), mt('#ff6a00'), cx, 0.42, cz);
          part(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 14), mt('#f2f2ee'), cx, 0.42, cz);
          part(new THREE.BoxGeometry(0.62, 0.05, 0.62), mt('#ff6a00'), cx, 0.03, cz);
        }
      }
      // tyres stacked by the wall, and one leaning
      {
        const tyreG = new THREE.TorusGeometry(0.62, 0.3, 10, 24).rotateX(Math.PI / 2),
          rubberM = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.9 });
        for (const [tx, tz, n] of [
          [RW - 1.4, -4, 4],
          [RW - 1.4, -1.7, 3],
          [-RW + 1.5, 4.2, 3],
        ])
          for (let q = 0; q < n; q++) put(new THREE.Mesh(tyreG, rubberM), tx, 0.3 + q * 0.6, tz);
        const lean = new THREE.Mesh(tyreG, rubberM);
        lean.rotation.z = 1.25;
        put(lean, RW - 1.0, 0.85, 0.3);
      }
      // the air compressor: a red tank on feet, a black motor on top, a coiled hose
      {
        const g = new THREE.Group(),
          red = new THREE.MeshStandardMaterial({ color: '#d2341f', roughness: 0.4, metalness: 0.4 }),
          blk = new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.6 });
        const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.5, 6, 16).rotateZ(Math.PI / 2), red);
        tank.position.y = 0.85;
        g.add(tank);
        const motor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), blk);
        motor.position.y = 1.65;
        g.add(motor);
        for (const fx of [-0.7, 0.7])
          g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.8), blk).translateX(fx).translateY(0.17));
        const hose = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.05, 8, 20),
          new THREE.MeshStandardMaterial({ color: '#ffc400', roughness: 0.6 }),
        );
        hose.position.set(1.25, 0.9, 0);
        g.add(hose);
        g.traverse(o => (o.castShadow = true));
        g.position.set(-RW + 1.4, 0, -9.5);
        g.rotation.y = Math.PI / 2;
        S.add(g);
      }
      // the side door, and the EXIT sign over it
      put(L(new THREE.BoxGeometry(0.12, 4.2, 2.4), '#2a2d36', { metalness: 0.5, roughness: 0.5 }), -RW + 0.08, 2.1, 7);
      {
        const exitM = new THREE.MeshBasicMaterial({
          map: canvasTex(128, 48, (x, w, h) => {
            x.fillStyle = '#0c3a1f';
            x.fillRect(0, 0, w, h);
            x.fillStyle = '#5cff9a';
            x.font = '900 34px Arial, sans-serif';
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillText('EXIT', w / 2, h / 2 + 2);
          }),
        });
        const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), exitM);
        ex.position.set(-RW + 0.16, 4.8, 7);
        ex.rotation.y = Math.PI / 2;
        S.add(ex);
        const eg = new THREE.PointLight('#5cff9a', 6, 7, 1.6);
        eg.position.set(-RW + 0.8, 4.6, 7);
        S.add(eg);
      }
      // Marina Bay in neon on the backdrop: the three towers and the deck across them, the wheel, the lotus museum
      const skyT = canvasTex(1024, 384, (x, w, h) => {
        x.lineCap = x.lineJoin = 'round';
        const glow = (col, draw) => {
          for (const [lw, a] of [
            [16, 0.12],
            [8, 0.3],
            [3, 1],
          ]) {
            x.strokeStyle = col;
            x.globalAlpha = a;
            x.lineWidth = lw;
            x.beginPath();
            draw();
            x.stroke();
          }
          x.globalAlpha = 1;
        };
        glow('#22e6ff', () => {
          for (const tx of [380, 500, 620]) {
            x.moveTo(tx - 34, h - 30);
            x.lineTo(tx - 22, 130);
            x.lineTo(tx + 22, 130);
            x.lineTo(tx + 34, h - 30);
          }
        });
        glow('#ff3fd0', () => {
          x.moveTo(310, 122);
          x.quadraticCurveTo(500, 86, 720, 112); // the deck across the top
          x.lineTo(690, 128);
          x.lineTo(320, 134);
          x.closePath();
        });
        glow('#ff3fd0', () => {
          x.arc(860, 230, 96, 0, 7); // the wheel
          for (let q = 0; q < 8; q++) {
            x.moveTo(860, 230);
            x.lineTo(860 + Math.cos(q * 0.785) * 96, 230 + Math.sin(q * 0.785) * 96);
          }
        });
        glow('#22e6ff', () => {
          for (let q = -3; q <= 3; q++) {
            x.moveTo(170, h - 30); // the lotus
            x.quadraticCurveTo(170 + q * 22, 250, 170 + q * 42, 200 + Math.abs(q) * 14);
          }
          x.moveTo(20, h - 30);
          x.lineTo(w - 20, h - 30);
        });
      });
      const sky = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 3.75),
        new THREE.MeshBasicMaterial({
          map: skyT,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      sky.position.set(0, 7.3, -RD + 0.86); // on the back wall's beam line, over the tool wall
      S.add(sky);
      this.neonSign = sky;
      for (const [wx, wz] of [
        [-7, -9],
        [7, -9],
      ]) {
        const wl = new THREE.PointLight('#ffe2b8', 26, 16, 1.5); // warm light on the back wall's fittings
        wl.position.set(wx, 6.5, wz);
        S.add(wl);
        (this.washLights ||= []).push(wl);
      }
      this.door = new THREE.Object3D(); // (no roller door: you walk straight into the garage)
    } // ---------- end of Singapore's studio ----------
    let floor = null;
    if (navy) {
      // ---------- Kano's room (everything down to the work lamp) ----------
      // light: a cool blue room, a warm work lamp over the car, orange glow off the arcade and neon
      this.hemi = new THREE.HemisphereLight('#7d93e6', '#1a1236', 1.0);
      S.add(this.hemi);
      const key = new THREE.SpotLight('#fff0dc', 70, 30, 0.62, 0.55, 1.4);
      key.position.set(0, 8.2, 0.5);
      key.target.position.set(0, 0, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0004;
      S.add(key, key.target);
      const rim = new THREE.DirectionalLight('#5d86ff', 1.4);
      rim.position.set(-8, 7, -9);
      S.add(rim);
      const glow = new THREE.PointLight('#ff7a2a', 25, 14, 1.5);
      glow.position.set(-9.5, 3, -9);
      S.add(glow);

      // floor: big grey-blue tiles, grout lines, oil stains, parking bay corners
      const floorT = canvasTex(
        512,
        512,
        (x, w) => {
          x.fillStyle = '#2b3557';
          x.fillRect(0, 0, w, w);
          for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++) {
              x.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.03})`;
              x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
            }
          x.strokeStyle = 'rgba(10,14,30,.6)';
          x.lineWidth = 4;
          for (let i = 0; i <= 4; i++) {
            x.beginPath();
            x.moveTo(i * 128, 0);
            x.lineTo(i * 128, w);
            x.moveTo(0, i * 128);
            x.lineTo(w, i * 128);
            x.stroke();
          }
          for (let i = 0; i < 5; i++) {
            const g = x.createRadialGradient(R() * w, R() * w, 0, 0, 0, 0);
            void g;
            x.fillStyle = 'rgba(8,10,20,.18)';
            x.beginPath();
            x.ellipse(R() * w, R() * w, 20 + R() * 40, 10 + R() * 25, R() * 3, 0, 7);
            x.fill();
          }
        },
        { repeat: true },
      );
      floorT.repeat.set(6, 6);
      floor = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 26).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.55, metalness: 0.1 }),
      );
      floor.receiveShadow = true;
      S.add(floor);
      const lineM = new THREE.MeshBasicMaterial({ color: '#e9eefc' });
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const a = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.8).rotateX(-Math.PI / 2), lineM),
          b = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.18).rotateX(-Math.PI / 2), lineM);
        a.position.set(sx * 3.6, 0.01, sz * (4.4 - 0.8));
        b.position.set(sx * (3.6 - 0.8), 0.01, sz * 4.4);
        S.add(a, b);
      }
      // walls: painted navy block, a hazard band at the foot
      const wallT = canvasTex(
        256,
        256,
        (x, w) => {
          // painted navy block
          x.fillStyle = '#18244f';
          x.fillRect(0, 0, w, w);
          x.strokeStyle = 'rgba(5,8,25,.55)';
          x.lineWidth = 3;
          for (let r = 0; r < 8; r++) {
            x.beginPath();
            x.moveTo(0, r * 32);
            x.lineTo(w, r * 32);
            x.stroke();
            for (let c = 0; c < 4; c++) {
              x.beginPath();
              x.moveTo(c * 64 + (r % 2) * 32, r * 32);
              x.lineTo(c * 64 + (r % 2) * 32, r * 32 + 32);
              x.stroke();
            }
          }
          for (let i = 0; i < 400; i++) {
            x.fillStyle = `rgba(255,255,255,${R() * 0.04})`;
            x.fillRect(R() * w, R() * w, 2, 2);
          }
        },
        { repeat: true },
      );
      const wallLightT = canvasTex(
        256,
        256,
        (x, w) => {
          // lights on: lime-washed plaster with a carved band
          x.fillStyle = '#e9dcc3';
          x.fillRect(0, 0, w, w);
          for (let i = 0; i < 2200; i++) {
            x.fillStyle = `rgba(120,90,60,${R() * 0.08})`;
            x.fillRect(R() * w, R() * w, 2, 2);
          }
          x.strokeStyle = 'rgba(120,85,55,.35)';
          x.lineWidth = 6;
          x.beginPath();
          for (let i = 0; i <= 8; i++) x.lineTo(i * 32, 150 + (i % 2 ? 12 : -12));
          x.stroke();
        },
        { repeat: true },
      );
      const wall = (w, h, x, y, z, ry) => {
        const dark = wallT.clone(),
          light = wallLightT.clone();
        for (const t of [dark, light]) {
          t.repeat.set(w / 4, h / 4);
          t.needsUpdate = true;
        }
        const mat = new THREE.MeshStandardMaterial({ map: dark, roughness: 0.9 });
        this.walls.push({ mat, dark, light });
        return put(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), mat), x, y, z, ry);
      };
      wall(30, 11, 0, 5.5, -11.25, 0);
      wall(23, 11, -14.75, 5.5, 0, Math.PI / 2);
      wall(23, 11, 14.75, 5.5, 0, Math.PI / 2);
      // the front wall with the way in: the opening, and the roller door that lifts out of it
      wall(9.5, 11, -10.25, 5.5, 11.25, 0);
      wall(9.5, 11, 10.25, 5.5, 11.25, 0);
      wall(11, 4.2, 0, 8.9, 11.25, 0);
      const hz = hazardTex();
      const band = (len, x, z, ry) => {
        const t = hz.clone();
        t.repeat.set(len / 3, 1);
        t.needsUpdate = true;
        return put(
          new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.1), new THREE.MeshBasicMaterial({ map: t })),
          x,
          0.3,
          z,
          ry,
        );
      };
      band(30, 0, -10.95, 0);
      band(23, -14.45, 0, Math.PI / 2);
      band(23, 14.45, 0, Math.PI / 2);
      for (const sx of [-1, 1]) {
        const t = hz.clone();
        t.rotation = Math.PI / 2;
        t.repeat.set(4, 1);
        t.needsUpdate = true;
        put(
          new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.8, 0.6), new THREE.MeshBasicMaterial({ map: t })),
          sx * 5.4,
          3.4,
          11,
        );
      }
      const slatT = canvasTex(
        256,
        256,
        (x, w) => {
          x.fillStyle = '#4a5a8c';
          x.fillRect(0, 0, w, w);
          for (let i = 0; i < 16; i++) {
            x.fillStyle = i % 2 ? '#3f4e7e' : '#56679b';
            x.fillRect(0, i * 16, w, 14);
            x.fillStyle = 'rgba(0,0,0,.25)';
            x.fillRect(0, i * 16 + 14, w, 2);
          }
        },
        { repeat: true },
      );
      this.door = put(
        new THREE.Mesh(
          new THREE.BoxGeometry(10.4, 6.8, 0.25),
          new THREE.MeshStandardMaterial({ map: slatT, roughness: 0.5, metalness: 0.4 }),
        ),
        0,
        3.4,
        11.2,
      );

      // the back roller door with graffiti, hazard posts and a floor stripe
      const gfT = canvasTex(1024, 640, (x, w, h) => {
        x.fillStyle = '#2a3a78';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 20; i++) {
          x.fillStyle = i % 2 ? '#25346d' : '#31438a';
          x.fillRect(0, i * 32, w, 29);
          x.fillStyle = 'rgba(0,0,0,.3)';
          x.fillRect(0, i * 32 + 29, w, 3);
        }
        x.save();
        x.translate(w / 2, h / 2);
        x.rotate(-0.12);
        x.font = '150px "Permanent Marker", "Marker Felt", cursive';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.lineWidth = 16;
        x.strokeStyle = '#0b1330';
        x.strokeText('GUKART', -20, -80);
        x.fillStyle = '#dfe8ff';
        x.fillText('GUKART', -20, -80);
        x.font = '120px "Permanent Marker", "Marker Felt", cursive';
        x.strokeText('CUSTOMS', 40, 70);
        x.fillStyle = '#9fd8ff';
        x.fillText('CUSTOMS', 40, 70);
        x.strokeStyle = '#ff6a00';
        x.lineWidth = 10;
        x.beginPath();
        x.moveTo(-300, 160);
        x.quadraticCurveTo(0, 210, 330, 150);
        x.stroke();
        x.restore();
      });
      put(
        new THREE.Mesh(
          new THREE.PlaneGeometry(10, 6.25),
          new THREE.MeshStandardMaterial({ map: gfT, roughness: 0.6, metalness: 0.2 }),
        ),
        6.5,
        3.4,
        -10.98,
      );
      for (const x of [1.2, 11.8]) {
        const t = hz.clone();
        t.rotation = Math.PI / 2;
        t.repeat.set(4, 1);
        t.needsUpdate = true;
        put(
          new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.8, 0.7), new THREE.MeshBasicMaterial({ map: t })),
          x,
          3.4,
          -10.7,
        );
      }
      {
        const t = hz.clone();
        t.repeat.set(4, 1);
        t.needsUpdate = true;
        const st = new THREE.Mesh(
          new THREE.PlaneGeometry(10.6, 0.7).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: t }),
        );
        st.position.set(6.5, 0.012, -10.2);
        S.add(st);
      }

      // props
      const crateCols = ['#c4532c', '#3a7bfd', '#b9915a', '#ff6a00', '#2a3a78'];
      {
        // shelving on the left back corner
        for (let lvl = 0; lvl < 4; lvl++) {
          put(
            L(new THREE.BoxGeometry(5, 0.12, 1.6), '#3a3f52', { metalness: 0.6, roughness: 0.4 }),
            -11.5,
            0.4 + lvl * 1.5,
            -9.8,
          );
          for (let i = 0; i < 3; i++)
            if (R() < 0.8) {
              const w = 0.7 + R() * 0.6;
              put(
                L(new THREE.BoxGeometry(w, 0.5 + R() * 0.5, 0.9), crateCols[(R() * 5) | 0]),
                -13.2 + i * 1.6 + R() * 0.3,
                0.7 + lvl * 1.5,
                -9.7,
              );
            }
        }
        for (const px of [-13.9, -9.1])
          put(L(new THREE.BoxGeometry(0.12, 6.2, 0.12), '#3a3f52', { metalness: 0.6 }), px, 3.1, -9.1);
        for (const px of [-13.9, -9.1])
          put(L(new THREE.BoxGeometry(0.12, 6.2, 0.12), '#3a3f52', { metalness: 0.6 }), px, 3.1, -10.5);
      }
      const tyreG = new THREE.TorusGeometry(0.62, 0.3, 10, 22).rotateX(Math.PI / 2);
      for (let i = 0; i < 4; i++) put(L(tyreG, '#18191d', { roughness: 0.9 }), -12.4, 0.3 + i * 0.6, -5.6);
      for (let i = 0; i < 2; i++) put(L(tyreG, '#18191d', { roughness: 0.9 }), -10.9, 0.3 + i * 0.6, -6.4);
      {
        const t = L(tyreG, '#18191d');
        t.rotation.set(Math.PI / 2 - 0.2, 0, 0);
        put(t, -9.6, 0.85, -4.6);
        t.rotation.set(1.2, 0.3, 0);
      }
      for (const [x, z, c] of [
        [-13, -2.5, '#2f6fd8'],
        [-12.2, -1.6, '#2f6fd8'],
        [-13.2, -1.2, '#c4532c'],
      ])
        put(L(new THREE.CylinderGeometry(0.6, 0.6, 1.7, 16), c, { roughness: 0.5, metalness: 0.3 }), x, 0.85, z);
      // the red tool chest
      const chestT = canvasTex(128, 128, (x, w) => {
        x.fillStyle = '#d0302a';
        x.fillRect(0, 0, w, w);
        x.fillStyle = 'rgba(0,0,0,.35)';
        for (let i = 1; i < 5; i++) x.fillRect(0, i * 25, w, 3);
        x.fillStyle = '#e8e8ee';
        for (let i = 0; i < 5; i++) x.fillRect(w / 2 - 20, i * 25 + 11, 40, 4);
      });
      put(
        new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 2.2, 1.2),
          new THREE.MeshStandardMaterial({ map: chestT, roughness: 0.35, metalness: 0.3 }),
        ),
        -0.8,
        1.1,
        -10.3,
      );
      put(L(new THREE.BoxGeometry(0.8, 0.5, 0.5), '#ff8a1f', { roughness: 0.4 }), -1.2, 2.45, -10.2);
      // the arcade cabinet, its screen glowing
      const scrT = canvasTex(128, 160, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#ff4fb0');
        g.addColorStop(1, '#4f6bff');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) x.fillRect(10 + R() * 100, 10 + R() * 140, 6, 6);
      });
      const arc = new THREE.Group();
      arc.add(L(new THREE.BoxGeometry(1.6, 4, 1.4), '#2f5fe0', { roughness: 0.4 }));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ map: scrT }));
      scr.position.set(0, 0.8, 0.71);
      arc.add(scr);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.68, 0.5, 0.26),
        new THREE.MeshBasicMaterial({ color: '#ff9a3c' }),
      );
      top.position.set(0, 1.72, 0.66);
      arc.add(top); // the marquee overhangs a touch, so none of its faces sit on the cabinet's (they flickered)
      arc.position.set(-6, 2, -10.3);
      S.add(arc);
      // cones, a fuel can, a jack
      const coneG = new THREE.ConeGeometry(0.35, 1, 14);
      for (const [x, z] of [
        [4.8, 6.5],
        [5.6, 7.1],
        [-5.2, 6.8],
      ]) {
        put(L(coneG, '#ff6a00', { roughness: 0.5 }), x, 0.5, z);
        put(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.27, 0.16, 14),
            new THREE.MeshBasicMaterial({ color: '#ffffff' }),
          ),
          x,
          0.55,
          z,
        );
      }
      put(L(new THREE.BoxGeometry(0.6, 0.8, 0.35), '#d0302a', { roughness: 0.4 }), -2.2, 0.4, -9.4);
      put(L(new THREE.BoxGeometry(1.4, 0.3, 0.5), '#ff6a00', { roughness: 0.4 }), 9.5, 0.15, 5.5);
      // the hanging work lamp
      const lampG = new THREE.Group();
      lampG.add(L(new THREE.CylinderGeometry(0.02, 0.02, 3, 6).translate(0, 1.5, 0), '#111'));
      const shade = L(new THREE.ConeGeometry(0.9, 0.7, 20, 1, true), '#ff6a00', {
        side: THREE.DoubleSide,
        roughness: 0.4,
      });
      lampG.add(shade);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#fff3d0' }),
      );
      bulb.position.y = -0.25;
      lampG.add(bulb);
      lampG.position.set(0, 8.1, 0.5);
      S.add(lampG);
    } // ---------- end of Kano's room ----------
    // the stand: a stepped showroom plinth. A wide dark skirt with orange-lit vents, a brushed ring with inset lamps,
    // and a turning top: an outer panelled ring round a recessed inner disc
    const SR = 5.2,
      steel = (c, r = 0.35, m = 0.85) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
    const ventT = canvasTex(
      512,
      64,
      (x, w, h) => {
        x.fillStyle = '#15171d';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 24; i++) {
          x.fillStyle = '#ff6a00';
          x.fillRect(i * 21.3 + 4, 18, 13, 28);
          x.fillStyle = 'rgba(0,0,0,.55)';
          for (let k = 0; k < 4; k++) x.fillRect(i * 21.3 + 4, 20 + k * 7, 13, 2);
        }
        x.fillStyle = '#3a3e48';
        x.fillRect(0, 0, w, 6);
        x.fillRect(0, h - 6, w, 6);
      },
      { repeat: true },
    );
    ventT.repeat.set(5, 1);
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(SR + 1.1, SR + 1.4, 0.55, 96, 1, true),
      new THREE.MeshStandardMaterial({
        map: ventT,
        metalness: 0.6,
        roughness: 0.4,
        emissive: '#ff6a00',
        emissiveMap: ventT,
        emissiveIntensity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    put(skirt, 0, 0.275, 0);
    put(new THREE.Mesh(new THREE.CylinderGeometry(SR + 1.15, SR + 1.15, 0.08, 96), steel('#2a2e38', 0.4)), 0, 0.56, 0); // skirt cap
    put(new THREE.Mesh(new THREE.CylinderGeometry(SR + 0.55, SR + 0.7, 0.3, 96), steel('#9aa1ad', 0.3)), 0, 0.74, 0); // brushed ring step
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(SR + 0.3, 0.07, 10, 96).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff8a2a' }),
    );
    this.ring.position.y = 0.9;
    S.add(this.ring); // LED line at the top edge
    const panelT = canvasTex(1024, 1024, (x, w) => {
      x.fillStyle = '#c3c8d1';
      x.fillRect(0, 0, w, w);
      x.translate(w / 2, w / 2);
      for (let r = 6; r < w / 2; r += 2) {
        x.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '30,34,42'},${0.04 + Math.random() * 0.06})`;
        x.lineWidth = 1;
        x.beginPath();
        x.arc(0, 0, r, 0, 7);
        x.stroke();
      }
      x.strokeStyle = 'rgba(30,34,42,.55)';
      x.lineWidth = 4;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        x.beginPath();
        x.moveTo(Math.cos(a) * w * 0.3, Math.sin(a) * w * 0.3);
        x.lineTo(Math.cos(a) * w * 0.495, Math.sin(a) * w * 0.495);
        x.stroke();
      }
      for (const r of [w * 0.3, w * 0.495]) {
        x.beginPath();
        x.arc(0, 0, r, 0, 7);
        x.stroke();
      }
      x.fillStyle = 'rgba(30,34,42,.6)';
      for (let k = 0; k < 16; k++) {
        const a = ((k + 0.5) / 16) * Math.PI * 2;
        for (const r of [w * 0.33, w * 0.47]) {
          x.beginPath();
          x.arc(Math.cos(a) * r, Math.sin(a) * r, 5, 0, 7);
          x.fill();
        }
      } // bolts
      const g = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.3);
      g.addColorStop(0, '#565c68');
      g.addColorStop(1, '#3a3f4a');
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, w * 0.3 - 2, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.08)';
      x.lineWidth = 1;
      for (let r = 4; r < w * 0.3; r += 6) {
        x.beginPath();
        x.arc(0, 0, r, 0, 7);
        x.stroke();
      }
    });
    const faceM = new THREE.MeshStandardMaterial({ map: panelT, metalness: 0.8, roughness: 0.35 });
    this.faceM = faceM;
    const rimT = canvasTex(
      1024,
      64,
      (x, w, h) => {
        x.fillStyle = '#9ca3ae';
        x.fillRect(0, 0, w, h);
        for (let k = 0; k < 64; k++) {
          x.fillStyle = '#2a2e36';
          x.beginPath();
          x.arc(k * 16 + 8, h / 2, 4.5, 0, 7);
          x.fill();
        }
        x.fillStyle = 'rgba(0,0,0,.25)';
        x.fillRect(0, 0, w, 3);
        x.fillRect(0, h - 3, w, 3);
      },
      { repeat: true },
    );
    rimT.repeat.set(3, 1);
    this.deck = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR, 0.32, 96), [
      new THREE.MeshStandardMaterial({ map: rimT, metalness: 0.85, roughness: 0.3 }),
      faceM,
      faceM,
    ]);
    this.deck.receiveShadow = true;
    this.deck.castShadow = true;
    S.environment = ENV.tex;
    if (studio) {
      // the stand in the studio: no orange. A dark skirt, and rings of neon: cyan round the turning deck with magenta
      // arcs outside it (they turn with the car), cyan and magenta round the base
      skirt.material.emissive.set('#22e6ff');
      skirt.material.emissiveIntensity = 0.35;
      faceM.color.set('#5d626c');
      const arc = (r, a0, len, col, y, parent, tube = 0.06) => {
        const m = new THREE.Mesh(
          new THREE.TorusGeometry(r, tube, 8, 96, len).rotateZ(a0).rotateX(Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        m.position.y = y;
        parent.add(m);
        (this.neon ||= []).push(m);
        return m;
      };
      arc(SR * 0.72, 0.5, Math.PI * 1.55, '#22e6ff', 0.175, this.deck);
      arc(SR * 0.72, 0.5 + Math.PI * 1.62, Math.PI * 0.3, '#22e6ff', 0.175, this.deck);
      arc(SR * 0.93, 2.2, Math.PI * 0.5, '#ff3fd0', 0.175, this.deck);
      arc(SR * 0.93, 2.2 + Math.PI, Math.PI * 0.5, '#ff3fd0', 0.175, this.deck);
      arc(SR + 0.95, 0.2, Math.PI * 0.9, '#ff3fd0', 0.62, S, 0.05);
      arc(SR + 0.95, 0.2 + Math.PI, Math.PI * 0.9, '#22e6ff', 0.62, S, 0.05);
      this.ringHue = 0.515; // (the LED line at the deck's edge: cyan here)
    }
    S.environmentIntensity = navy ? 0.28 : 0.45; // a faint studio reflection in the metal (Kano keeps its room dark)
    if (navy && !REFLECT_OFF) {
      // the glossy floor: the room reflected under a slightly see-through tiled surface
      const mirror = new Reflector(new THREE.PlaneGeometry(30, 26), {
        textureWidth: 1024,
        textureHeight: 1024,
        color: '#9aa0ad',
      });
      mirror.rotation.x = -Math.PI / 2;
      mirror.position.y = -0.01;
      S.add(mirror);
      floor.material.transparent = true;
      floor.material.opacity = 0.86;
      floor.material.roughness = 0.35;
      floor.position.y = 0.005;
    }
    const stand = (ang, h) => {
      // a studio light on a tripod, its head aimed at the car
      const g = new THREE.Group(),
        dark = new THREE.MeshStandardMaterial({ color: '#16181d', metalness: 0.6, roughness: 0.4 });
      for (let k = 0; k < 3; k++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), dark),
          a = (k * Math.PI * 2) / 3;
        leg.position.set(Math.cos(a) * 0.45, 0.7, Math.sin(a) * 0.45);
        leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        g.add(leg);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h), dark);
      pole.position.y = h / 2 + 0.6;
      g.add(pole);
      g.position.set(Math.cos(ang) * 10, 0, Math.sin(ang) * 10);
      S.add(g);
      const head = new THREE.Group();
      head.position.set(g.position.x, h + 0.6, g.position.z);
      S.add(head);
      head.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.5), dark));
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.65),
        new THREE.MeshBasicMaterial({ color: '#fff4e2' }),
      );
      face.position.z = 0.26;
      head.add(face);
      head.lookAt(0, 1.4, 0);
      const L2 = new THREE.SpotLight('#ffe6c8', 14, 22, 0.45, 0.7, 1.4);
      (this.studio ||= []).push(L2);
      L2.position.copy(head.position);
      L2.target.position.set(0, 1.2, 0);
      S.add(L2, L2.target);
    };
    if (navy) {
      stand(Math.PI * 0.25, 3.6);
      stand(Math.PI * 0.75, 3.6);
      stand(-Math.PI * 0.5, 4.2);
    } // (Doha's workshop lights the stand itself)
    if (navy) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.12, 8, 48).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#fff1d8' }),
      );
      halo.position.y = 9.4;
      S.add(halo);
    }
    // the swap machinery: a lit core that shows when the stand lifts, and a two-part dome that closes over it
    // the riser: a solid column that grows with the platform as it lifts. Dark panels framed by orange bars, brackets round it
    const coreT = canvasTex(
      1024,
      256,
      (x, w, h) => {
        x.fillStyle = '#121419';
        x.fillRect(0, 0, w, h);
        for (let k = 0; k < 8; k++) {
          const x0 = k * 128;
          x.fillStyle = '#1c1f26';
          x.fillRect(x0 + 10, 14, 108, h - 28);
          x.fillStyle = '#e8590c';
          x.fillRect(x0 + 10, 14, 108, 7);
          x.fillRect(x0 + 10, h - 21, 108, 7);
          x.fillRect(x0 + 10, h / 2 - 3, 108, 6);
          x.fillRect(x0 + 10, 14, 6, h - 28);
          x.fillRect(x0 + 112, 14, 6, h - 28);
          x.fillStyle = '#2b2f38';
          x.fillRect(x0, 0, 10, h);
        }
      },
      { repeat: true },
    );
    coreT.repeat.set(3, 1);
    this.core = new THREE.Group();
    this.core.position.y = 0.6;
    this.core.visible = false;
    S.add(this.core);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(SR - 0.45, SR - 0.45, 1, 64).translate(0, 0.5, 0), [
      new THREE.MeshStandardMaterial({
        map: coreT,
        metalness: 0.55,
        roughness: 0.45,
        emissive: '#e8590c',
        emissiveMap: coreT,
        emissiveIntensity: 0.25,
      }),
      new THREE.MeshStandardMaterial({ color: '#15171c' }),
      new THREE.MeshStandardMaterial({ color: '#15171c' }),
    ]);
    col.castShadow = true;
    this.core.add(col);
    this.col = col;
    const brkM = new THREE.MeshStandardMaterial({ color: '#2f333d', metalness: 0.8, roughness: 0.35 });
    this.brackets = [];
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) / 8) * Math.PI * 2,
        b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.7).translate(0, 0.5, 0), brkM);
      b.position.set(Math.cos(a) * (SR - 0.2), 0, Math.sin(a) * (SR - 0.2));
      b.rotation.y = -a;
      b.castShadow = true;
      this.core.add(b);
      this.brackets.push(b);
    }
    this.lift = new THREE.Group();
    S.add(this.lift);

    if (navy) {
      // outside the front door: the street at dusk
      const street = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 40).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#20253a', roughness: 0.9 }),
      );
      street.position.set(0, -0.01, 32);
      S.add(street);
      for (const sx of [-1, 1]) {
        const pole = L(new THREE.CylinderGeometry(0.1, 0.12, 6, 8), '#333');
        put(pole, sx * 9, 3, 22);
        const lb = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 10, 8),
          new THREE.MeshBasicMaterial({ color: '#ffd9a0' }),
        );
        lb.position.set(sx * 9, 6.1, 22);
        S.add(lb);
        const pl = new THREE.PointLight('#ffb870', 20, 16, 1.5);
        pl.position.set(sx * 9, 5.8, 22);
        S.add(pl);
      }
    }

    this.turn = new THREE.Group();
    this.turn.position.y = 1.03;
    S.add(this.turn);
    this.flip = new THREE.Group();
    this.flip.position.y = -0.16;
    this.turn.add(this.flip); // pivots on the deck's own centre
    this.deck.position.y = 0;
    this.flip.add(this.deck);
    this.topSlot = new THREE.Group();
    this.topSlot.position.y = 0.16;
    this.flip.add(this.topSlot);
    this.underSlot = new THREE.Group();
    this.underSlot.position.y = -0.16;
    this.underSlot.visible = false;
    this.underSlot.rotation.x = Math.PI;
    this.flip.add(this.underSlot);
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.0, 30),
      new THREE.Vector3(0, 3.4, 14),
      new THREE.Vector3(0.6, 5, 9.6),
      new THREE.Vector3(5, 7.6, 10.4),
    ]);
    this.mode = 'out';
    this.t = 0;
    this.clock = 0;
  }
  // switching: the old vehicle drives off one side while the new one rolls in from the other and settles on its springs
  // the garage lights: off is the dark, glowing room; on is the bright workshop
  setLights(on) {
    this.lightsOn = on;
    if (this.ws) {
      this.ws.setLights(on);
      this.faceM?.color.set(on ? '#ffffff' : '#9aa1ae');
      return;
    } // Doha's workshop: daylight or evening
    if (this.room === 'studio') {
      // Singapore's studio: lights off is the dark room glowing in neon; on is the studio lit for a photograph
      this.scene.background.set(on ? '#2b2d33' : '#131417');
      this.scene.fog.color.set(on ? '#2b2d33' : '#131417');
      this.backdrop.material.color.set(on ? '#ffffff' : '#8a8f9c');
      this.panels.color.set(on ? '#ffffff' : '#7f8aa0');
      this.hemi.intensity = on ? 1.5 : 0.75;
      this.scene.environmentIntensity = on ? 0.9 : 0.45;
      for (const l of this.studio || []) l.intensity = on ? 130 : 90;
      for (const l of this.neonLights || []) l.intensity = on ? 12 : 30;
      for (const l of this.washLights || []) l.intensity = on ? 46 : 26;
      this.pool.material.opacity = on ? 0.45 : 1;
      this.neonSign.material.opacity = on ? 0.55 : 1;
      this.faceM?.color.set(on ? '#8d93a0' : '#5d626c');
      return;
    }
    for (const w of this.walls) {
      w.mat.map = on ? w.light : w.dark;
      w.mat.needsUpdate = true;
    }
    this.scene.background.set(on ? '#2a2230' : '#070c22');
    this.scene.fog.color.set(on ? '#2a2230' : '#070c22');
    this.hemi.color.set(on ? '#ffe9cc' : '#7d93e6');
    this.hemi.groundColor.set(on ? '#3a2a22' : '#1a1236');
    this.hemi.intensity = on ? 1.3 : 1.0;
    this.scene.environmentIntensity = on ? 0.9 : 0.28;
    for (const l of this.studio || []) l.intensity = on ? 26 : 14;
    this.faceM?.color.set(on ? '#ffffff' : '#7a8190');
  }
  // put a vehicle on the stand straight away (no animation)
  place(type, custom) {
    const k = makeKart(RACERS[0], this.tex, 16, type, custom);
    k.robot.root.visible = false; // the garage shows the vehicle on its own
    k.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    for (const c of [...this.topSlot.children]) this.topSlot.remove(c);
    const holder = new THREE.Group();
    holder.add(k.root);
    this.topSlot.add(holder);
    this.kart = k;
    this.holder = holder;
    this.leaving = this.arriving = null;
  }
  // switching (after Rocket League's showroom): the stand lifts, a dome closes over it, the vehicle changes inside,
  // the dome opens and the stand settles. Tapping again mid-swap just changes what comes out
  setVehicle(type, dir = 0, custom = null) {
    if (!this.holder || !dir) {
      this.place(type, custom);
      return;
    }
    // slide: the current one goes off one side, the new one comes on from the other. Anything still sliding goes now
    for (const c of [...this.topSlot.children]) if (c !== this.holder) this.topSlot.remove(c);
    this.holder.position.set(0, 0, 0);
    this.holder.scale.setScalar(1);
    const k = makeKart(RACERS[0], this.tex, 16, type, custom);
    k.robot.root.visible = false;
    k.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const holder = new THREE.Group();
    holder.add(k.root);
    this.topSlot.add(holder);
    this.leaving = { g: this.holder, k: this.kart, t: 0, dir };
    holder.position.x = -dir * 9;
    this.arriving = { g: holder, t: 0, from: -dir * 9 };
    this.kart = k;
    this.holder = holder;
  }
  underCar(type, custom) {
    // the next vehicle, mounted upside down under the deck
    const k = makeKart(RACERS[0], this.tex, 16, type, custom);
    k.robot.root.visible = false;
    k.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    for (const c of [...this.underSlot.children]) this.underSlot.remove(c);
    const holder = new THREE.Group();
    holder.add(k.root);
    this.underSlot.add(holder);
    this.nextKart = k;
    this.nextHolder = holder;
  }
  // drag to turn the vehicle; it carries on a little and settles back to its slow sway
  spin(dx) {
    this.userVel = dx * 0.012;
    this.userT = 3;
  }
  jumpIn() {
    this.mode = 'in';
    this.t = 0;
    this.push = 1;
    this.drop = 0;
  }
  enter() {
    this.mode = 'enter';
    this.t = 0;
  }
  exit(done) {
    this.mode = 'exit';
    this.t = 0;
    this.done = done;
  }
  // Customise close-ups: the stand turns the part you are changing towards you and the camera moves in on it.
  // wheels and tyres get a front three-quarter on a front wheel; plates and nitro get the tail
  focus(tab) {
    this.focusOn = { rim: 'wheel', tyre: 'wheel', plate: 'plate', nitro: 'nitroKit' }[tab] || null;
  }
  focusTarget() {
    const k = this.kart;
    if (!k || !this.focusOn) return null;
    if (this.fk !== k || this.fkOn !== this.focusOn) {
      // find the part once per vehicle
      this.fk = k;
      this.fkOn = this.focusOn;
      this.turn.updateMatrixWorld(true);
      if (this.focusOn === 'wheel') {
        let best = null,
          bs = -1e9;
        const v = new THREE.Vector3();
        for (const w of k.wheels) {
          this.turn.worldToLocal(w.spin.getWorldPosition(v));
          const sc = v.x * 1 + v.z * 1.2;
          if (sc > bs) {
            bs = sc;
            best = w;
          }
        }
        this.fObj = best?.spin;
        this.fR = best?.r || 0.5;
      } else {
        this.fObj = k.root.getObjectByName(this.focusOn);
        this.fR = 0;
      }
    }
    return this.fObj;
  }
  resize(aspect) {
    this.cam.aspect = aspect;
    this.cam.fov = aspect < 1 ? 62 : 42;
    this.cam.updateProjectionMatrix();
  }
  update(dt) {
    this.t += dt;
    this.clock += dt;
    let u, open;
    if (this.mode === 'enter') {
      open = sstep(0, 0.9, this.t);
      u = eio(Math.min(1, Math.max(0, (this.t - 0.5) / 2.1)));
      if (this.t > 2.6) this.mode = 'in';
    } else if (this.mode === 'exit') {
      u = 1 - eio(Math.min(1, this.t / 1.7));
      open = 1 - sstep(1.4, 2.1, this.t);
      if (this.t > 2.25 && this.done) {
        const d = this.done;
        this.done = null;
        this.mode = 'out';
        d();
      }
    } else if (this.mode === 'in') {
      u = 1;
      open = 1;
    } else {
      u = 0;
      open = 0;
    }
    this.door.position.y = 3.4 + open * 6.6; // rolls up into the header
    const p = this.path.getPoint(u);
    {
      // (how far the vehicle reaches from its middle: half its width over the tyres, or half its length)
      const kv = this.kart?.V,
        reach = kv ? Math.max(kv.track + kv.ww / 2, kv.base + Math.max(kv.wf, kv.wr)) : 0,
        base = this.cam.aspect < 1 ? 62 : 42,
        pull = this.cam.aspect < 1 ? Math.min(1.42, Math.max(1, 1 + (reach - 2.3) * 0.385)) : 1,
        want = Math.min(88, base * pull);
      if (Math.abs(this.cam.fov - want) > 0.1) {
        this.cam.fov += (want - this.cam.fov) * Math.min(1, dt * 6);
        this.cam.updateProjectionMatrix();
      }
    } // on a phone the big vehicles get a wider view, by their size, so each fits between the readout and the buttons
    if (this.mode === 'in') {
      p.x += Math.sin(this.clock * 0.25) * 0.6;
      if (this.push)
        p.addScaledVector(
          p
            .clone()
            .sub(new THREE.Vector3(0, 1, 0))
            .normalize(),
          this.push * this.push * 6,
        );
    }
    this.cam.position.copy(p);
    // looking down past the car puts it in the open space above the garage panel
    const look = new THREE.Vector3(0, 2.8, 4).lerp(new THREE.Vector3(0, 0.9, -0.4), u);
    {
      const up = (this.turn ? this.turn.position.y - 1.03 : 0) * 0.75;
      look.y += up;
      this.cam.position.y += up * 0.6;
    } // follow the platform up when it lifts
    // the close-up: ease in and out of it; it waits while the car is flipping or sliding
    const fo = this.mode === 'in' && !this.swap && !this.arriving ? this.focusTarget() : null;
    this.fw = (this.fw || 0) + ((fo ? 1 : 0) - (this.fw || 0)) * Math.min(1, dt * 3.2);
    if (fo) this.fLast = this.focusOn;
    const fw = eio(this.fw),
      az = Math.atan2(5, 10.4); // the camera's bearing from the stand
    if (fw > 0.001 && (fo || this.fObj)) {
      const kind = fo ? this.focusOn : this.fLast,
        obj = fo || this.fObj,
        at =
          kind === 'nitroKit'
            ? new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())
            : obj.getWorldPosition(new THREE.Vector3()); // the bottles' own middle, not the seat's
      const sz = this.kart?.V.cam ? 1 + this.kart.V.cam * 0.25 : 1;
      const [dist, elev, side] = {
        wheel: [2.3 + this.fR * 3, 0.3, 0],
        plate: [2.7 * sz, 0.18, -0.15],
        nitroKit: [3.6 * sz, this.kart?.type === 'muscle' ? 1.25 : 0.9, 0.75],
      }[kind]; // the muscle's bottles sit low in the cockpit: look down on them
      const b = az + side,
        cp = at
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(b) * Math.cos(elev),
              Math.sin(elev),
              Math.cos(b) * Math.cos(elev),
            ).multiplyScalar(dist * (this.cam.aspect < 1 ? (kind === 'nitroKit' ? 0.8 : 1.35) : 1)),
          );
      this.cam.position.lerp(cp, fw);
      look.lerp(at, fw);
    }
    this.cam.lookAt(look);
    this.userT = (this.userT || 0) - dt;
    this.userVel = (this.userVel || 0) * Math.pow(0.04, dt);
    this.userRot = (this.userRot || 0) + (this.userVel || 0);
    if (this.userT <= 0) this.userRot *= Math.pow(0.3, dt); // let go: back to the sway
    {
      const sway = 0.55 + Math.sin(this.clock * 0.3) * 0.75 * (this.userT > 0 ? 0 : 1);
      // the stand presents the part: the wheel side or the tail turns to face the camera (a drag still turns it)
      const kind = this.focusOn || this.fLast,
        want = kind === 'wheel' ? az - Math.PI / 2 + 0.55 : kind ? az + Math.PI - 0.35 : sway;
      this.tw = (this.tw || 0) + ((this.focusOn ? 1 : 0) - (this.tw || 0)) * Math.min(1, dt * 3);
      let d = want - sway;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.turn.rotation.y = sway + d * eio(Math.min(1, this.tw)) + this.userRot + (this.cheerRot || 0);
    }
    const ease = x => 1 - Math.pow(1 - Math.min(1, x), 3);
    // switching: the old one slides off the stand and fades; the new one slides on from the other side (both stay over the stand)
    if (this.leaving) {
      const L = this.leaving;
      L.t += dt;
      const u = ease(L.t / 0.3);
      L.g.position.x = L.dir * 9 * u;
      L.g.scale.setScalar(1 - 0.5 * u);
      for (const w of L.k.wheels) w.spin.rotation.x += dt * 20;
      if (L.t >= 0.3) {
        L.g.removeFromParent();
        this.leaving = null;
      }
    }
    if (this.arriving) {
      const A = this.arriving;
      A.t += dt;
      const u = ease(A.t / 0.38);
      A.g.position.x = A.from * (1 - u);
      A.g.scale.setScalar(0.5 + 0.5 * u);
      A.g.position.y = A.t > 0.38 ? Math.sin((A.t - 0.38) * 16) * 0.1 * Math.exp(-(A.t - 0.38) * 7) : 0;
      for (const w of this.kart.wheels) w.spin.rotation.x += dt * 20 * (1 - u);
      if (A.t > 1) {
        A.g.position.set(0, 0, 0);
        A.g.scale.setScalar(1);
        this.arriving = null;
      }
    }
    if (this.push > 0) this.push = Math.max(0, this.push - dt * 2.2); // the push-in after the wipe
    if (this.swap) {
      // lift .35s, flip over .55s, settle .35s
      const W = this.swap;
      W.t += dt;
      const t = W.t,
        sm = x => {
          x = Math.min(1, Math.max(0, x));
          return x * x * (3 - 2 * x);
        };
      // a short rise (.25s), a fast snap over (.3s) so you never get a look underneath, then it drops back (.25s)
      const clear = 1.5 + (this.kart?.V.ride || 0) * 0.5; // just enough to clear the stand
      const lift = sm(t / 0.2) * (1 - sm((t - 0.46) / 0.22)) * clear,
        f = Math.min(1, Math.max(0, (t - 0.16) / 0.26)),
        c1 = 1.35,
        flip = 1 + (c1 + 1) * Math.pow(f - 1, 3) + c1 * Math.pow(f - 1, 2); // snaps over, a touch past, and settles back (ease-out-back)
      // the next car shows only once it starts swinging up
      this.flip.rotation.x = flip * Math.PI;
      this.underSlot.visible = f > 0;
      this.turn.position.y = 1.03 + lift;
      {
        const hgt = Math.max(0.01, lift + 0.3);
        this.core.visible = lift > 0.02;
        this.col.scale.y = hgt;
        for (const b of this.brackets) b.scale.y = Math.min(hgt, 0.9);
      }
      if (t > 0.7) {
        // the flip is done: the vehicle that came up becomes the top one (same pose as before, so nothing jumps)
        this.flip.rotation.x = 0;
        this.turn.position.y = 1.03;
        this.core.visible = false;
        this.underSlot.visible = false;
        for (const c of [...this.topSlot.children]) this.topSlot.remove(c);
        this.nextHolder.removeFromParent();
        this.topSlot.add(this.nextHolder);
        this.kart = this.nextKart;
        this.holder = this.nextHolder;
        const pend = W.pending;
        this.swap = null;
        if (pend) {
          this.underCar(pend.type, pend.custom);
          this.swap = { t: 0 };
        }
      }
    }
    if (this.drop !== undefined && this.drop < 1.4 && this.holder) {
      this.drop += dt;
      const t = this.drop,
        y = t < 0.35 ? 6 * (1 - t / 0.35) ** 2 : Math.abs(Math.sin((t - 0.35) * 9)) * 0.5 * Math.exp(-(t - 0.35) * 5);
      this.holder.position.y = y;
      if (this.drop >= 1.4) this.holder.position.y = 0;
    }
    this.ring.material.color.setHSL(this.ringHue ?? 0.07, 1, 0.55 + Math.sin(this.clock * 2) * 0.06);
    if (this.cheer) {
      // just unlocked: the car hops off the stand, spins once round with its wheels turning and its pipes alight, a
      // gold ring bursts out from under it and sparks fly up; then it settles
      const C = this.cheer,
        t = (C.t += dt),
        u = Math.min(1, t / 1.25),
        out = 1 - Math.pow(1 - u, 3);
      this.cheerRot = out * Math.PI * 2;
      if (this.holder && !(this.drop < 1.4))
        this.holder.position.y =
          t < 0.6
            ? Math.sin((t / 0.6) * Math.PI) * C.hop
            : Math.abs(Math.sin((t - 0.6) * 11)) * 0.22 * Math.exp(-(t - 0.6) * 6);
      if (this.kart) for (const w of this.kart.wheels) w.spin.rotation.x += dt * 26 * (1 - u);
      const b = Math.min(1, t / 0.7);
      C.ring.scale.setScalar(1 + b * 7);
      C.ring.material.opacity = 0.9 * (1 - b);
      const p = C.sparks.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = C.vel[i];
        v.y -= 9 * dt;
        p.setXYZ(i, p.getX(i) + v.x * dt, p.getY(i) + v.y * dt, p.getZ(i) + v.z * dt);
      }
      p.needsUpdate = true;
      C.sparks.material.opacity = Math.max(0, 1 - t / 1.5);
      if (t > 1.6) {
        C.ring.removeFromParent();
        C.sparks.removeFromParent();
        if (this.holder) this.holder.position.y = 0;
        this.cheerRot = 0;
        this.cheer = null;
      }
    }
    if (this.kart) {
      const k = this.kart;
      k.wheelRing.rotation.z = -Math.sin(this.clock * 0.9) * 0.3;
      for (const f of k.flames) f.visible = !!this.cheer && this.cheer.t < 1;
    }
  }
  // the car on the stand has just been unlocked (see update)
  // (light: a saved upgrade. The same spin with a smaller hop and fewer sparks)
  celebrate(light = false) {
    if (this.cheer) {
      this.cheer.ring.removeFromParent();
      this.cheer.sparks.removeFromParent();
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: '#ffc400',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.set(this.turn.position.x, 1.12, this.turn.position.z);
    const n = light ? 26 : 70,
      pos = new Float32Array(n * 3),
      vel = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        r = 1.5 + Math.random() * 3.5;
      pos.set([this.turn.position.x + Math.cos(a) * 1.2, 1.3, this.turn.position.z + Math.sin(a) * 1.2], i * 3);
      vel.push(new THREE.Vector3(Math.cos(a) * r, 5 + Math.random() * 6, Math.sin(a) * r));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: '#ffd84a',
        size: 0.16,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sparks.frustumCulled = false;
    this.scene.add(ring, sparks);
    this.cheer = { t: 0, ring, sparks, vel, hop: light ? 0.45 : 1.1 };
  }
  get inside() {
    return this.mode === 'in';
  }
}

// pictures of every vehicle for the garage cards, rendered from the real models (Buddy at the wheel) once at load
export function vehicleThumbs(tex, types, customOf = () => null) {
  // each card in the vehicle's own saved paint
  const W = 320,
    Hh = 200,
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, Hh, false);
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2440', 1.6));
  const key = new THREE.DirectionalLight('#fff1dd', 3);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6fa0ff', 2);
  rim.position.set(-6, 4, -6);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, W / Hh, 0.1, 100),
    out = {},
    box = new THREE.Box3(),
    c = new THREE.Vector3(),
    sz = new THREE.Vector3();
  for (const type of types) {
    const k = makeKart(RACERS[0], tex, 14, type, customOf(type));
    k.robot.root.visible = false;
    for (const f of k.flames) f.visible = false;
    k.root.rotation.y = -0.55;
    scene.add(k.root);
    k.root.updateMatrixWorld(true); // three-quarter: the side shows, so it reads long and big
    box.setFromObject(k.root);
    box.getCenter(c);
    box.getSize(sz);
    const d = Math.max(sz.x, sz.z) * 1.55; // framed by its length and width, not by a tall cage
    cam.position.set(c.x + d * 0.55, c.y + d * 0.2, c.z + d * 0.78);
    cam.lookAt(c.x, c.y - sz.y * 0.08, c.z); // a low three-quarter view
    r.render(scene, cam);
    // trim to the vehicle's own outline and place it dead centre, so every card frames its vehicle the same way
    const src = document.createElement('canvas');
    src.width = W;
    src.height = Hh;
    const sx = src.getContext('2d');
    sx.drawImage(r.domElement, 0, 0);
    const px = sx.getImageData(0, 0, W, Hh).data;
    let x0 = W,
      y0 = Hh,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++)
        if (px[(y * W + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    // cropped tight to the vehicle (a small margin), so it fills its card whatever the card's shape
    const pad = 6,
      bw = Math.max(1, x1 - x0 + 1),
      bh = Math.max(1, y1 - y0 + 1),
      dst = document.createElement('canvas');
    dst.width = bw + pad * 2;
    dst.height = bh + pad * 2;
    dst.getContext('2d').drawImage(src, x0, y0, bw, bh, pad, pad, bw, bh);
    out[type] = dst.toDataURL('image/png');
    scene.remove(k.root);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

// 3D pictures for the customise card: a glossy paint chip per colour, a real wheel per rim style and per tyre
import { buildWheel, wheelMats, PARTS, nitroBottle } from './buddy.js';
export function partThumbs() {
  const S = 128,
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(S, S, false);
  r.setClearColor(0, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#40384a', 1.8));
  const key = new THREE.DirectionalLight('#fff3e0', 3);
  key.position.set(2, 3, 4);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50),
    out = { paint: {}, rim: {}, tyre: {}, nitro: {} },
    snap = () => {
      r.render(scene, cam);
      return r.domElement.toDataURL('image/png');
    };
  // paint: a rounded body panel chip
  cam.position.set(0, 1.9, 4.1);
  cam.lookAt(0, 0, 0); // far enough that the whole chip fits with a margin
  const chipG = new THREE.SphereGeometry(1, 40, 24);
  chipG.scale(1, 0.55, 1);
  for (const [c] of PARTS.paint) {
    const m = new THREE.Mesh(
      chipG,
      new THREE.MeshPhysicalMaterial({
        color: c,
        metalness: c === '#c0c6d0' ? 0.9 : 0.25,
        roughness: c === '#c0c6d0' ? 0.12 : 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMap: ENV.tex,
      }),
    );
    scene.add(m);
    out.paint[c] = snap();
    scene.remove(m);
  }
  // wheels: three-quarter view of a whole wheel
  cam.position.set(3.3, 1.4, 3.5);
  cam.lookAt(0, 0, 0); // three-quarter: the face and the tread both show, whole
  const M = wheelMats('#ff6a00');
  for (const [rs] of PARTS.rim) {
    const w = buildWheel(1, 0.7, rs, 'road', M.trim, M.chrome, M.black);
    scene.add(w);
    out.rim[rs] = snap();
    scene.remove(w);
  }
  cam.position.set(2.7, 1.7, 4.0);
  cam.lookAt(0, 0, 0);
  for (const [tk] of PARTS.tyre) {
    const w = buildWheel(1, 0.8, 'classic', tk, M.trim, M.chrome, M.black);
    w.rotation.y = -0.5;
    scene.add(w);
    out.tyre[tk] = snap();
    scene.remove(w);
  }
  // nitro: each option's own bottle, standing, three-quarter
  out.nitro = {};
  cam.position.set(2.2, 2.0, 4.6);
  cam.lookAt(0, 0.95, 0);
  for (const [c] of PARTS.nitro) {
    const b = nitroBottle(c);
    b.rotation.y = -0.5;
    scene.add(b);
    out.nitro[c] = snap();
    scene.remove(b);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

// a portrait of each racer's head, smiling, for the standings
import { Robot } from './robot.js';
import { setFace } from './buddy.js';
export function racerPortraits() {
  const S = 160,
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(S, S, false);
  r.setClearColor(0, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#5a4a6a', 1.7));
  const key = new THREE.DirectionalLight('#fff3e0', 2.6);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50),
    out = {};
  for (const d of RACERS) {
    const rb = new Robot(d.fur, d.ear, 16);
    scene.add(rb.root);
    for (let i = 0; i < 20; i++) rb.update(0.05, { t: 1, steer: 0 });
    setFace({ fc: rb.fc, ftex: rb.ftex, expr: '' }, 'happy');
    // only the head: every mesh that isn't part of it is hidden (the body, arms and legs), so nothing shows under the face
    const inHead = o => {
      for (let q = o; q; q = q.parent) if (q === rb.head) return true;
      return false;
    };
    rb.root.traverse(o => {
      if (o.isMesh || o.isPoints || o.isLine) o.visible = inHead(o);
    });
    rb.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rb.head),
      c = box.getCenter(new THREE.Vector3()),
      sz = box.getSize(new THREE.Vector3());
    sz.multiplyScalar(0.9); // just the head, close and centred: the face fills the frame (it reads at a glance in a small slot)
    cam.fov = 14;
    cam.updateProjectionMatrix();
    cam.position.set(c.x + sz.x * 0.12, c.y + sz.y * 0.12, c.z + Math.max(sz.x, sz.y) * 4.6);
    cam.lookAt(c.x, c.y, c.z); // a long lens, almost straight on: true proportions
    r.render(scene, cam);
    out[d.id] = r.domElement.toDataURL('image/png');
    scene.remove(rb.root);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
