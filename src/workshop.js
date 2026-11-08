// Doha's garage room: a big modern industrial workshop (garage design 5 in mockups/). Steel columns and trusses, a white
// corrugated roof with skylights, strip lights on wires, a wall of steel-framed factory windows behind the stand with
// the sky and the city through them, concrete walls over a painted dado with the orange stripe, a roller shutter
// under the GUKART sign, a tool wall, the exit, pipes and fuse boxes, a car on a lift, and a polished concrete floor
// that reflects it all. Kano keeps its own room (the navy one in garage.js).
// The stand, the kart, the camera moves and the swap machinery are garage.js's; this builds only the room round them,
// with a front wall and a roller door so the camera can come in from the street. Static pieces are merged per
// material at the end, so the room is a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { canvasTex } from './textures.js';

const R = Math.random;
const tex = (w, h, draw, rx = 1, ry = 1) => { const t = canvasTex(w, h, draw, { repeat: true }); t.repeat.set(rx, ry); return t; };
const rep = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
const speckle = (x, w, h, n, cols, s = 2) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[(R() * cols.length) | 0]; x.fillRect(R() * w, R() * h, s, s); } };
const std = o => new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// the room: 48 m wide (x -24..24), 34 m deep (z -18..16), 12 m to the roof. The stand sits at the origin.
const RX = 24, RZ = -18, FZ = 16, RH = 12, DOOR_W = 11, DOOR_H = 7;

export function buildWorkshop(S, { reflect = true } = {}){
  const room = new THREE.Group(); S.add(room);
  const put = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; room.add(m); return m; };

  /* ---------- floor: polished concrete, saw-cut joints every 4 m, tyre scuffs and oil spots ---------- */
  const floorT = tex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#a2a7ad'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const cx = R() * w, cy = R() * h, r = 40 + R() * 160, g = x.createRadialGradient(cx, cy, 0, cx, cy, r), d = R() < .5; g.addColorStop(0, d ? 'rgba(60,64,72,.18)' : 'rgba(200,205,212,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    speckle(x, w, h, 9000, ['rgba(255,255,255,.18)', 'rgba(40,44,52,.25)', 'rgba(120,126,136,.4)']);
    for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(30,30,34,.10)'; x.lineWidth = 14 + R() * 10; x.beginPath(); const y0 = R() * h; x.moveTo(-20, y0); x.bezierCurveTo(w * .3, y0 + (R() - .5) * 300, w * .6, y0 + (R() - .5) * 300, w + 20, y0 + (R() - .5) * 200); x.stroke(); }
    for (let i = 0; i < 5; i++) { const cx = R() * w, cy = R() * h, r = 20 + R() * 50, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(40,36,30,.3)'); g.addColorStop(1, 'rgba(40,36,30,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    x.fillStyle = 'rgba(30,33,40,.55)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h);
  }, 12, 34 / 4);
  const floorM = std({ map: floorT, roughness: .32, metalness: .05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, FZ - RZ).rotateX(-Math.PI / 2), floorM); floor.position.set(0, 0, (RZ + FZ) / 2); floor.receiveShadow = true; S.add(floor);
  if (reflect) {   // the glossy floor: the room reflected under a slightly see-through concrete
    const mirror = new Reflector(new THREE.PlaneGeometry(RX * 2, FZ - RZ), { textureWidth: 1024, textureHeight: 1024, color: '#8a8f99' });
    mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -.01, (RZ + FZ) / 2); S.add(mirror);
    Object.assign(floorM, { transparent: true, opacity: .8 }); floor.position.y = .005;
  }
  const lineM = std({ color: '#f2c230', roughness: .5 });
  for (const x0 of [-17, -12, 12, 17]) put(box(.16, .01, 16), lineM, x0, .012, -6);   // yellow bay lines

  /* ---------- walls: board-marked concrete above a painted dado with the orange stripe ---------- */
  const concT = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#c4c1ba'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) { x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '40,40,40'},${.03 + R() * .05})`; x.fillRect(0, y, w, 64); x.fillStyle = 'rgba(60,58,54,.25)'; x.fillRect(0, y, w, 2); }
    for (let xx = 0; xx < w; xx += 256) { x.fillStyle = 'rgba(60,58,54,.3)'; x.fillRect(xx, 0, 3, h); }
    speckle(x, w, h, 5000, ['rgba(255,255,255,.12)', 'rgba(50,48,44,.18)']);
    for (let i = 0; i < 14; i++) { const sx = R() * w, g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(70,64,56,.18)'); g.addColorStop(1, 'rgba(70,64,56,0)'); x.fillStyle = g; x.fillRect(sx, 0, 6 + R() * 14, h * (.3 + R() * .6)); }   // rain streaks
  });
  const dadoT = tex(512, 128, (x, w, h) => { x.fillStyle = '#4c5466'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff6a00'; x.fillRect(0, 0, w, 14); x.fillStyle = '#f4f7ff'; x.fillRect(0, 18, w, 4); speckle(x, w, h, 900, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.2)']); });
  const wallMs = new Map();   // one material per repeat, so merged walls keep their scale
  const wallM = (w, h) => { const k = `${w}x${h}`; if (!wallMs.has(k)) wallMs.set(k, std({ map: rep(concT, w / 4, h / 4), roughness: .92 })); return wallMs.get(k); };
  const wall = (w, h, x, y, z, ry) => put(new THREE.PlaneGeometry(w, h), wallM(w, h), x, y, z, ry);
  const dado = (w, x, z, ry) => put(new THREE.PlaneGeometry(w, 1.6), std({ map: rep(dadoT, w / 8, 1), roughness: .6 }), x, .8, z, ry);
  // back wall: solid on the left, the windows behind the stand (built round, so the sky shows through)
  wall(16.4, RH, -RX + 8.2, RH / 2, RZ, 0); wall(31.6, 2.4, 8.2, 1.2, RZ, 0); wall(31.6, 1.6, 8.2, RH - .8, RZ, 0); dado(RX * 2, 0, RZ + .02, 0);
  wall(FZ - RZ, RH, -RX, RH / 2, (RZ + FZ) / 2, Math.PI / 2); dado(FZ - RZ, -RX + .02, (RZ + FZ) / 2, Math.PI / 2);   // left
  wall(34, 2.4, RX, 1.2, -1, -Math.PI / 2); wall(34, 1.6, RX, RH - .8, -1, -Math.PI / 2); wall(2, RH, RX, RH / 2, -17, -Math.PI / 2); wall(2, RH, RX, RH / 2, 15, -Math.PI / 2); dado(34, RX - .02, -1, -Math.PI / 2);   // right: windows
  // the front wall, facing in, with the way in from the street
  const sideW = RX - DOOR_W / 2;
  for (const s of [-1, 1]) wall(sideW, RH, s * (DOOR_W / 2 + sideW / 2), RH / 2, FZ, Math.PI);
  wall(DOOR_W, RH - DOOR_H, 0, DOOR_H + (RH - DOOR_H) / 2, FZ, Math.PI);
  for (const s of [-1, 1]) dado(sideW, s * (DOOR_W / 2 + sideW / 2), FZ - .02, Math.PI);
  // and the same wall seen from the street: plain cladding
  for (const s of [-1, 1]) wall(sideW, RH, s * (DOOR_W / 2 + sideW / 2), RH / 2, FZ + .05, 0);
  wall(DOOR_W, RH - DOOR_H, 0, DOOR_H + (RH - DOOR_H) / 2, FZ + .05, 0);
  const steel = std({ color: '#7a828f', metalness: .6, roughness: .45 });
  for (let xx = -RX + .4; xx <= RX; xx += 8) put(box(.5, RH, .5), steel, xx, RH / 2, RZ + .3);
  for (let zz = RZ + 6; zz < FZ; zz += 8) { put(box(.5, RH, .5), steel, -RX + .3, RH / 2, zz); put(box(.5, RH, .5), steel, RX - .3, RH / 2, zz); }

  /* ---------- the windows: steel-framed factory glazing, the sky and the city behind ---------- */
  const skyT = canvasTex(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3f86d9'); g.addColorStop(.7, '#8cc4f0'); g.addColorStop(1, '#d7ecfa'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const cx = R() * w, cy = h * (.25 + R() * .5), r = 30 + R() * 70, c = x.createRadialGradient(cx, cy, 0, cx, cy, r); c.addColorStop(0, 'rgba(255,255,255,.75)'); c.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = c; x.fillRect(cx - r * 2, cy - r, r * 4, r * 2); }
    x.fillStyle = '#5b6b7e'; for (let i = 0; i < 40; i++) { const bw = 20 + R() * 50, bh = 20 + R() * 90; x.fillRect(R() * w, h - bh, bw, bh); }
  });
  const paneT = tex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.fillStyle = '#2a2e35'; x.fillRect(0, 0, w, 14); x.fillRect(0, 0, 14, h); x.fillRect(0, h - 14, w, 14); x.fillRect(w - 14, 0, 14, h);
    for (let k = 1; k < 4; k++) { x.fillRect(k * w / 4 - 3, 0, 6, h); x.fillRect(0, k * h / 4 - 3, w, 6); }
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) if (R() < .35) x.fillRect(k * w / 4 + 6, j * h / 4 + 6, w / 4 - 12, h / 4 - 12);
  });
  const skyMs = [];
  const windowBand = (len, x0, z0, ry, y0 = 2.4, hgt = 8) => {
    const g = new THREE.Group(); g.position.set(x0, y0 + hgt / 2, z0); g.rotation.y = ry; room.add(g);
    const skyM = new THREE.MeshBasicMaterial({ map: skyT, toneMapped: false }); skyMs.push(skyM);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(len, hgt), skyM); sky.position.z = -1.5; g.add(sky);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(len, hgt), new THREE.MeshStandardMaterial({ map: rep(paneT, len / 4, hgt / 4), transparent: true, metalness: .5, roughness: .5 })));
    const sill = new THREE.Mesh(box(len, .25, .5), steel); sill.position.y = -hgt / 2; g.add(sill);
  };
  windowBand(31.6, 8.2, RZ + .05, 0); windowBand(30, RX - .05, -1, -Math.PI / 2);

  /* ---------- the roof: corrugated sheet, steel trusses, skylights, strip lights on wires ---------- */
  const roofT = tex(256, 256, (x, w, h) => { for (let xx = 0; xx < w; xx += 32) { const g = x.createLinearGradient(xx, 0, xx + 32, 0); g.addColorStop(0, '#c9ced6'); g.addColorStop(.5, '#eef1f5'); g.addColorStop(1, '#aeb4bd'); x.fillStyle = g; x.fillRect(xx, 0, 32, h); } speckle(x, w, h, 500, ['rgba(80,70,60,.12)'], 3); }, 48, 1);
  put(new THREE.PlaneGeometry(RX * 2, FZ - RZ).rotateX(Math.PI / 2), std({ map: roofT, metalness: .35, roughness: .55 }), 0, RH, (RZ + FZ) / 2);
  const truss = std({ color: '#8a919c', metalness: .55, roughness: .5 });
  for (let zz = RZ + 3; zz < FZ; zz += 6) {
    put(box(RX * 2, .45, .3), truss, 0, RH - .4, zz); put(box(RX * 2, .35, .3), truss, 0, RH - 2.3, zz);
    for (let xx = -RX + 1.5; xx < RX; xx += 3) { const m = put(box(.14, 2.2, .14), truss, xx, RH - 1.35, zz); m.rotation.z = ((xx + RX) / 3 % 2 < 1 ? 1 : -1) * .6; }
  }
  for (let xx = -RX + 4; xx < RX; xx += 8) put(box(.3, .3, FZ - RZ), truss, xx, RH - .4, (RZ + FZ) / 2);
  const skyLightM = new THREE.MeshBasicMaterial({ color: '#cfe6ff', toneMapped: false });
  for (let zz = RZ + 6; zz < 14; zz += 6) for (const xx of [-14, -2, 10]) put(new THREE.PlaneGeometry(6, 2.6).rotateX(Math.PI / 2), skyLightM, xx, RH - .02, zz);
  const tubeM = new THREE.MeshBasicMaterial({ color: '#f6fbff', toneMapped: false }), housM = std({ color: '#c9ced6', metalness: .4, roughness: .4 }), wireM = new THREE.MeshBasicMaterial({ color: '#141824' });
  for (let zz = RZ + 4; zz < 12; zz += 6) for (const xx of [-15, -6, 3, 12]) {
    const y = 8.6; put(box(3.6, .14, .34), housM, xx, y + .1, zz); put(box(3.4, .07, .18), tubeM, xx, y, zz);
    for (const d of [-1.4, 1.4]) put(new THREE.CylinderGeometry(.012, .012, RH - y - .3), wireM, xx + d, (RH + y) / 2, zz);
  }

  /* ---------- the far end: a roller shutter under the GUKART sign, the exit, a tool wall, a car up on a lift ---------- */
  const shutT = tex(256, 256, (x, w, h) => { for (let y = 0; y < h; y += 8) { const g = x.createLinearGradient(0, y, 0, y + 8); g.addColorStop(0, '#8792a6'); g.addColorStop(.5, '#c4ccd8'); g.addColorStop(1, '#6b7589'); x.fillStyle = g; x.fillRect(0, y, w, 8); } speckle(x, w, h, 600, ['rgba(0,0,0,.15)']); }, 1, 6);
  put(new THREE.PlaneGeometry(6, 6), std({ map: shutT, metalness: .55, roughness: .45 }), -11.6, 3, RZ + .08);
  put(box(6.8, .7, .5), std({ color: '#16204a', metalness: .4, roughness: .5 }), -11.6, 6.35, RZ + .25);
  const hazT = tex(256, 32, (x, w, h) => { x.fillStyle = '#ffc400'; x.fillRect(0, 0, w, h); x.fillStyle = '#16181d'; for (let i = -h; i < w + h; i += 32) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 16, h); x.lineTo(i + 16 + h, 0); x.lineTo(i + h, 0); x.fill(); } });
  const hazM = std({ map: hazT });
  for (const xx of [-14.8, -8.4]) put(box(.4, 6, .3), hazM, xx, 3, RZ + .15);
  put(new THREE.PlaneGeometry(1.4, 2.4), std({ color: '#5c6a80', metalness: .4, roughness: .5 }), -22.4, 1.2, RZ + .06);
  const exitT = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#1aa04a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.font = 'italic 900 64px "Barlow Condensed", "Arial Narrow", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EXIT', w / 2, h / 2 + 4); });
  put(new THREE.PlaneGeometry(1.1, .42), new THREE.MeshBasicMaterial({ map: exitT, toneMapped: false }), -22.4, 2.75, RZ + .08);
  const pegT = canvasTex(512, 256, (x, w, h) => { x.fillStyle = '#d6dbe3'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(40,44,52,.35)'; for (let a = 8; a < w; a += 16) for (let b = 8; b < h; b += 16) x.fillRect(a, b, 3, 3);
    x.fillStyle = '#23262e'; for (let k = 0; k < 12; k++) { const tx = 24 + k * 40, ty = 30 + (k % 3) * 70; x.fillRect(tx, ty, 8 + (k % 4) * 4, 60 - (k % 3) * 12); x.fillRect(tx - 6, ty, 20, 10); } x.fillStyle = '#ff6a00'; x.fillRect(0, 0, w, 10); });
  put(new THREE.PlaneGeometry(4.4, 2.6), std({ map: pegT, roughness: .7 }), -18.6, 3.2, RZ + .06);
  put(box(4.6, 1, .9), std({ color: '#c8312a', metalness: .35, roughness: .4 }), -18.6, .5, RZ + .6);
  const handleM = std({ color: '#e6e6e6', metalness: .8, roughness: .2 });
  for (let k = 0; k < 4; k++) put(box(4.4, .03, .02), handleM, -18.6, .2 + k * .22, RZ + 1.06);
  const markT = canvasTex(1024, 192, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#ff6a00'; x.beginPath(); x.moveTo(40, 0); x.lineTo(w, 0); x.lineTo(w - 40, h); x.lineTo(0, h); x.fill();
    x.fillStyle = '#f4f7ff'; for (const o of [w - 150, w - 112, w - 74]) { x.beginPath(); x.moveTo(o + 30, 0); x.lineTo(o + 44, 0); x.lineTo(o + 14, h); x.lineTo(o, h); x.fill(); }
    x.font = 'italic 900 150px "Barlow Condensed", "Arial Narrow", Arial'; x.textBaseline = 'middle'; x.fillStyle = '#0b1330'; x.fillText('GUKART', 70, h / 2 + 8); });
  put(new THREE.PlaneGeometry(6.8, 1.3), std({ map: markT, transparent: true, roughness: .7 }), -11.6, 8.1, RZ + .06);
  const yellow = std({ color: '#f2c230', metalness: .3, roughness: .5 });
  for (const zz of [-8.2, -4]) { put(box(.5, 4.4, .5), yellow, -RX + 3.2, 2.2, zz); put(box(.5, 4.4, .5), yellow, -RX + 7.6, 2.2, zz); put(box(4.9, .3, .3), steel, -RX + 5.4, 2.0, zz); }
  const cover = std({ color: '#6f7685', roughness: .95 });
  put(new THREE.CapsuleGeometry(1.1, 3.2, 6, 16).rotateZ(Math.PI / 2).scale(1, .55, .9), cover, -RX + 5.4, 2.85, -6.1, Math.PI / 2);
  put(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, .55, .85), cover, -RX + 5.4, 3.2, -6.4);

  /* ---------- tyres, drums, cones, a workbench, and the services: pipes, a sprinkler main, fuse boxes, an extinguisher ---------- */
  const rubber = std({ color: '#1b1c20', roughness: .85 }), tyreG = new THREE.TorusGeometry(.42, .2, 10, 22).rotateX(Math.PI / 2);
  for (const [x0, z0, n] of [[-20.5, 2, 5], [-19.4, 3.2, 3], [-21.2, -11, 4], [17.5, -15.2, 4]]) for (let k = 0; k < n; k++) put(tyreG, rubber, x0, .2 + k * .4, z0);
  const drumMs = {}; const drumM = c => (drumMs[c] ||= std({ color: c, metalness: .35, roughness: .4 }));
  for (const [x0, z0, c] of [[-21.5, -14.5, '#2e5bd8'], [-20.4, -14.9, '#2e5bd8'], [-21, -13.6, '#ff6a00'], [19.4, -14.8, '#2e5bd8'], [20.4, -15, '#16204a']]) put(new THREE.CylinderGeometry(.45, .45, 1.3, 20), drumM(c), x0, .65, z0);
  const coneT = canvasTex(64, 128, (x, w, h) => { x.fillStyle = '#ff6a00'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f7ff'; x.fillRect(0, 44, w, 18); x.fillRect(0, 86, w, 14); });
  const coneM = std({ map: coneT }), baseM = std({ color: '#1b1c20' });
  for (const [x0, z0] of [[11, 8.6], [11.9, 7.9], [-11.2, 8.8]]) { put(new THREE.ConeGeometry(.3, .9, 16), coneM, x0, .5, z0); put(box(.75, .06, .75), baseM, x0, .03, z0); }
  put(box(1.2, 1, 7), std({ color: '#2b3550', metalness: .3, roughness: .6 }), -RX + .9, .5, 6);
  put(box(1.3, .08, 7.2), std({ color: '#8a6a48', roughness: .7 }), -RX + .9, 1.04, 6);
  const pipeM = std({ color: '#9aa1ab', metalness: .7, roughness: .35 });
  put(new THREE.CylinderGeometry(.16, .16, RX * 2).rotateZ(Math.PI / 2), pipeM, 0, 10.7, RZ + .5);
  put(new THREE.CylinderGeometry(.09, .09, RX * 2).rotateZ(Math.PI / 2), std({ color: '#c8312a', metalness: .3, roughness: .5 }), 0, 11.2, RZ + .7);
  put(new THREE.CylinderGeometry(.16, .16, FZ - RZ).rotateX(Math.PI / 2), pipeM, -RX + .5, 10.7, (RZ + FZ) / 2);
  const fuseM = std({ color: '#b9bec6', metalness: .5, roughness: .4 });
  for (const xx of [-21, -7.2]) { put(box(.9, 1.3, .3), fuseM, xx, 2.6, RZ + .2); put(new THREE.CylinderGeometry(.05, .05, 8), pipeM, xx + .25, 7.2, RZ + .2); }
  put(new THREE.CylinderGeometry(.16, .16, .7, 14), std({ color: '#d42a1e', roughness: .35 }), -21.4, 1.0, RZ + .3);
  const warnT = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffc400'; x.fillRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 14); x.lineTo(w - 14, h - 18); x.lineTo(14, h - 18); x.closePath(); x.lineWidth = 9; x.strokeStyle = '#16181d'; x.stroke(); x.fillStyle = '#16181d'; x.fillRect(w / 2 - 4, 44, 8, 34); x.fillRect(w / 2 - 4, 86, 8, 8); });
  put(new THREE.PlaneGeometry(.8, .8), std({ map: warnT }), -9.6, 2.8, RZ + .07);

  /* ---------- the way in: a roller door in the front wall, and the street outside ---------- */
  const slatT = tex(256, 256, (x, w) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#7e8899' : '#9aa4b5'; x.fillRect(0, i * 16, w, 14); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i * 16 + 14, w, 2); } });
  const door = new THREE.Mesh(box(DOOR_W - .4, DOOR_H - .2, .25), std({ map: slatT, roughness: .5, metalness: .4 })); door.position.set(0, 3.4, FZ - .1); door.castShadow = true; S.add(door);
  for (const s of [-1, 1]) put(box(.5, DOOR_H, .5), hazM, s * DOOR_W / 2, DOOR_H / 2, FZ);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(90, 40).rotateX(-Math.PI / 2), std({ color: '#5c6270', roughness: .9 })); street.position.set(0, -.02, FZ + 20); S.add(street);

  /* ---------- light: daylight through the windows and skylights, the strip lights, a warm key and a cool rim on the stand ---------- */
  const hemi = new THREE.HemisphereLight('#e6f0ff', '#6b6e75', 1.6); S.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(14, 20, -40); sun.target.position.set(0, 0, 0); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20, near: 1, far: 90 }); sun.shadow.bias = -.0004; S.add(sun, sun.target);
  const strips = [];
  for (const [x0, z0] of [[-6, -8], [6, -8], [-6, 4], [6, 4]]) { const p = new THREE.PointLight('#eef6ff', 45, 24, 1.5); p.position.set(x0, 8.3, z0); S.add(p); strips.push(p); }
  const key = new THREE.SpotLight('#ffe2bf', 220, 30, .42, .55, 1.4); key.position.set(3, 11, 5); key.target.position.set(0, 1.4, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; S.add(key, key.target);
  const rim = new THREE.SpotLight('#9fd8ff', 90, 26, .5, .6, 1.4); rim.position.set(-6, 6, -8); rim.target.position.set(0, 1.6, 0); S.add(rim, rim.target);

  /* ---------- bake: everything in the room merged into one mesh per material ---------- */
  room.updateMatrixWorld(true);
  const bins = new Map();
  room.traverse(o => { if (!o.isMesh) return; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); (bins.get(o.material) || bins.set(o.material, []).get(o.material)).push(g); });
  S.remove(room);
  for (const [mat, gs] of bins) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = !mat.transparent && !mat.isMeshBasicMaterial; m.receiveShadow = true; S.add(m); }

  S.background = new THREE.Color('#cfd8e3'); S.fog = new THREE.Fog('#cfd8e3', 70, 160);
  // the lights switch: on is full daylight; off is the evening, the sky gone dusky and the strip lights carrying the room
  // lights off: the strip lights go out and the windows and skylights turn to a dusky evening blue; only the stand's own
  // spot stays on, so the vehicle is lit in a dark workshop
  const setLights = on => {
    hemi.intensity = on ? 1.6 : .22; hemi.color.set(on ? '#e6f0ff' : '#7f90c0'); hemi.groundColor.set(on ? '#6b6e75' : '#1a1c24'); sun.intensity = on ? 2.2 : 0;
    for (const p of strips) p.intensity = on ? 45 : 0;
    tubeM.color.set(on ? '#f6fbff' : '#3a404c'); skyLightM.color.set(on ? '#cfe6ff' : '#1d2440');
    for (const m of skyMs) m.color.set(on ? '#ffffff' : '#2a3058');
    key.intensity = on ? 220 : 170; rim.intensity = on ? 90 : 55;
    S.background.set(on ? '#cfd8e3' : '#0c1020'); S.fog.color.set(S.background);
    S.environmentIntensity = on ? .45 : .14;
  };
  return { door, hemi, setLights };
}
