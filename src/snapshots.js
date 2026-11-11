// Pictures taken from the live 3D scene after a circuit is built: each landmark for its map card, and the pictures on
// the three race mode cards.
import * as THREE from 'three';
import { DEFAULT_CUSTOM, makeKart, RACERS } from './buddy.js';
import { store } from './util.js';
import { quality, canvas, renderer, scene } from './scene.js';
import { QUIET } from './hud.js';
import { chapter, CITY, game } from './game.js';
import { attract } from './race-flow.js';

// pictures from the live scene: the island from straight above for the map, a close look at each place for its card
export function snapshots() {
  for (const it of [...game.race.fx.items, ...game.race.fx.rings]) {
    it.life = 0;
    it.s.visible = false;
  } // no weapon blasts left over from the race behind the menu (they save as black blobs)
  const C = game.track.center,
    R = game.track.radius * 1.12,
    a = innerWidth / innerHeight,
    fog = scene.fog;
  scene.fog = null;
  const halfH = a < 1 ? (R / a) * 0.62 : R,
    halfW = halfH * a; // on a phone the map is taller than the screen: you pan it
  const top = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 4000);
  top.position.set(C.x, 1500, C.z);
  top.up.set(0, 0, -1);
  top.lookAt(C.x, 0, C.z);
  game.world.sky.visible = false;
  renderer.render(scene, top);
  const image = canvas.toDataURL('image/jpeg', 0.6);
  game.world.sky.visible = true; // (the home tile's picture)
  const uv = (x, z) => ({ x, z });
  const pc = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 8000); // the screen's own shape, so nothing is stretched; far enough to take in the whole sky dome (at 3000 its far side was cut off, a black hole in the sky)
  const shot = (x, y, z, d = 60, h = 26) => {
    pc.position.set(x + d * 0.7, y + h, z + d * 0.7);
    pc.lookAt(x, y + 2, z);
    renderer.render(scene, pc);
    return canvas.toDataURL('image/jpeg', 0.6);
  };
  // a postcard from the road: stand on the circuit a little way back, eye height, look at the place
  const Fq = game.track.newFrame();
  const fromRoad = (s0, back, lat, h, target, lookH = 4) => {
    const F0 = game.track.frame(s0 - back, Fq);
    pc.position.copy(F0.p).addScaledVector(F0.l, lat);
    pc.position.y += h;
    pc.lookAt(target.x, (target.y || 0) + lookH, target.z);
    renderer.render(scene, pc);
    return canvas.toDataURL('image/jpeg', 0.7);
  };
  scene.fog = fog;
  const at = s0 => game.track.point(s0, 0),
    places = [];
  const startP = at(0);
  game.kanoSnap = chapter.id === 'kano' ? shot(startP.x, 0, startP.z, 70, 30) : fromRoad(70, 0, 0, 9, at(0), 4); // (in Doha's tall streets a camera off to the side lands inside a tower: look back down the road at the start)
  places.push({
    kind: 'race',
    name: (game.circuit ? game.circuit.name.toUpperCase() : CITY) + ' GRAND PRIX',
    sub: `3 laps · win +${chapter.reward} coins`,
    action: 'RACE',
    isNew: !store.get('best.' + game.RID, null),
    img: game.kanoSnap,
    ...uv(startP.x + 30, startP.z),
  });
  const gp = game.track.beside(game.track.idx(40), game.track.out[game.track.idx(40)] * 60);
  places.push({ kind: 'garage', name: 'GARAGE', sub: 'Pick your ride', action: 'OPEN', ...uv(gp.x, gp.z) });
  const seen = new Set();
  for (const f of game.track.feats) {
    const name =
      f.type === 'gate'
        ? f.name
        : f.type === 'market'
          ? 'KURMI MARKET'
          : f.type === 'dye'
            ? 'KOFAR MATA DYE PITS'
            : null;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const q = at(f.s + (f.len || 0) / 2),
      off = f.type === 'gate' ? 0 : game.track.out[game.track.idx(f.s)] * 40,
      b = game.track.beside(game.track.idx(f.s + (f.len || 0) / 2), off);
    const sm = f.s + (f.len || 0) / 2;
    const img =
      f.type === 'gate'
        ? fromRoad(f.s, 46, -3, 3.2, at(f.s + 30), 5) // down the road, through the arch
        : f.type === 'palace'
          ? fromRoad(f.s, 10, -game.track.out[game.track.idx(f.s)] * 4, 4, b, 7) // the front of the palace
          : fromRoad(sm, 24, game.track.out[game.track.idx(sm)] * 8, 3.6, b, 2.5); // from the roadside, among the stalls or pits
    places.push({
      kind: 'place',
      name,
      sub: {
        gate: 'An old gate in the city wall',
        market: 'Stalls, umbrellas and bunting',
        dye: 'Indigo dye pits, centuries old',
        palace: 'Gidan Rumfa, home of the Emir',
      }[f.type],
      img,
      ...uv(b.x, b.z),
    });
    void q;
  }
  if (game.world.palace) {
    const pa = game.world.palace;
    places.push({
      kind: 'place',
      name: "EMIR'S PALACE",
      sub: 'Gidan Rumfa, home of the Emir',
      img: shot(pa.x, 14, pa.z, 110, 40),
      ...uv(pa.x, pa.z),
    });
  }
  // the city's own landmarks (Doha hands these over from doha.js): each pictured from the stretch of road it's seen from
  for (const pl of game.world.places || [])
    places.push({
      kind: 'place',
      name: pl.name,
      sub: pl.sub,
      img: fromRoad(pl.s, pl.back, pl.lat, pl.h, pl, pl.lookH),
      ...uv(pl.x, pl.z),
    });
  if (chapter.id === 'kano')
    places.push({
      kind: 'place',
      name: 'DALA HILL',
      sub: 'The hill old Kano grew around',
      img: shot(game.world.hill.x, 10, game.world.hill.z, 140, 60),
      ...uv(game.world.hill.x, game.world.hill.z),
    });
  {
    let i0 = 0;
    for (let i = 0; i < game.track.N; i++)
      if (game.track.covered[i]) {
        i0 = i;
        break;
      }
    const q = game.track.P[i0];
    places.push({
      kind: 'place',
      name: CITY + ' UNDERPASS',
      sub: 'Two lit bores, 10 m under the city',
      img: shot(q.x, 0, q.z, 50, 20),
      ...uv(q.x, q.z),
      bore: true,
    });
  }
  {
    let i0 = 0;
    for (let i = 0; i < game.track.N; i++) if (game.track.P[i].y > game.track.P[i0].y) i0 = i;
    const q = game.track.P[i0];
    // (only where the road really goes up and over: The Pearl goes under its marina mouth instead)
    if (q.y > 10)
      places.push({
        kind: 'place',
        name: 'THE FLYOVER',
        sub: chapter.id === 'kano' ? 'Over the start straight' : 'Up over the city',
        img: shot(q.x, q.y, q.z, 60, 24),
        ...uv(q.x, q.z),
      });
  }
  // the Time Trial card: a driver's-eye view down one of the underpass's lit bores
  let tunnelShot = null;
  {
    let i0 = -1;
    for (let i = 0; i < game.track.N; i++)
      if (game.track.covered[i]) {
        i0 = i;
        break;
      }
    if (i0 >= 0) {
      const s0 = (i0 * game.track.len) / game.track.N;
      const vis = [...game.race.all.map(k => k.m.root), ...game.race.boxes.map(b => b.m)].map(o => [o, o.visible]);
      vis.forEach(([o]) => {
        o.visible = false;
      }); // an empty road: no kart or crate in the lens
      tunnelShot = fromRoad(s0 + 52, 0, -5, 2.0, game.track.point(s0 + 110, -5), 1.5);
      vis.forEach(([o, v]) => {
        o.visible = v;
      });
    }
  }
  // the Free Drive card: Dodo's monster truck coming round the curve inside the Kano Subway (the tiled walls with the red bands)
  let cruiseShot = null;
  {
    const sub = game.track.forks.find(f => f.tunnel);
    if (sub) {
      const others = [
        ...game.race.all.map(k => k.m.root),
        ...game.race.boxes.map(b => b.m),
        ...game.race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean)),
        game.race.coinMesh,
      ].map(o => [o, o.visible]);
      others.forEach(([o]) => {
        o.visible = false;
      });
      const def = RACERS.find(r => r.veh === 'monster') || RACERS[0],
        truck = makeKart(def, game.TEX, quality.layers, 'monster', DEFAULT_CUSTOM.monster);
      scene.add(truck.root);
      const SF = () => ({
          p: new THREE.Vector3(),
          t: new THREE.Vector3(),
          u: new THREE.Vector3(),
          l: new THREE.Vector3(),
        }),
        basis = new THREE.Matrix4();
      const at = sub.frame(48 * sub.seg, SF()),
        cam2 = sub.frame(66 * sub.seg, SF());
      truck.root.position.copy(at.p);
      basis.makeBasis(new THREE.Vector3().crossVectors(at.u, at.t), at.u, at.t);
      truck.root.quaternion.setFromRotationMatrix(basis);
      truck.root.updateMatrixWorld(true);
      pc.position.copy(cam2.p).addScaledVector(cam2.l, 1.5);
      pc.position.y += 2.8;
      pc.lookAt(at.p.x, at.p.y + 2, at.p.z);
      renderer.render(scene, pc);
      cruiseShot = canvas.toDataURL('image/jpeg', 0.75);
      scene.remove(truck.root);
      others.forEach(([o, v]) => {
        o.visible = v;
      });
    }
  }
  // the Race card: the whole crew bunched up, coming at you down the road
  let packShot;
  {
    game.race.ev = QUIET;
    game.race.reset(); // a clean grid: no shields up, nothing mid-air
    const basis = new THREE.Matrix4(),
      boxes = [...game.race.boxes.map(b => b.m), ...game.race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean))].map(
        o => [o, o.visible],
      );
    boxes.forEach(([o]) => {
      o.visible = false;
    });
    const S0 = 1150,
      put = (o, ds, lat) => {
        const f = game.track.frame(S0 + ds, game.track.newFrame());
        o.position.copy(f.p).addScaledVector(f.l, lat);
        o.position.y = f.p.y;
        basis.makeBasis(new THREE.Vector3().crossVectors(f.u, f.t), f.u, f.t);
        o.quaternion.setFromRotationMatrix(basis);
        o.visible = true;
        o.updateMatrixWorld(true);
      };
    const spots = [
      [0, -1],
      [-4, 2.6],
      [-5.5, -3.2],
      [-10, 0.6],
      [-13, 3.4],
      [-14.5, -2.6],
    ];
    for (let n = 0; n < 30; n++) game.race.all.forEach(k => game.race.poseDriver(k, 0.1)); // everyone eyes front: no head still turned from a taunt in the race behind the menu
    game.race.all.forEach((k, i) => put(k.m.root, ...spots[i]));
    const F = game.track.frame(S0, game.track.newFrame()),
      at = F.p.clone().addScaledVector(F.t, -6);
    at.y += 0.8;
    pc.position.copy(F.p).addScaledVector(F.t, 17).addScaledVector(F.l, 1.6);
    pc.position.y += 2.6;
    pc.lookAt(at);
    renderer.render(scene, pc);
    packShot = canvas.toDataURL('image/jpeg', 0.75);
    boxes.forEach(([o, v]) => {
      o.visible = v;
    });
    attract();
  }
  // circuits without an underpass or a subway (Doha's): the Time Trial and Free Drive cards come from the city's own landmarks,
  // so the three cards never show the same picture
  {
    const L = game.world.places || [],
      find = names => names.map(n => L.find(p => p.name === n)).find(Boolean);
    const hideAll = () => {
      const v = [
        ...game.race.all.map(k => k.m.root),
        ...game.race.boxes.map(b => b.m),
        ...game.race.nitros.flatMap(n => [n.m, n.ring].filter(Boolean)),
        game.race.coinMesh,
      ]
        .filter(Boolean)
        .map(o => [o, o.visible]);
      v.forEach(([o]) => {
        o.visible = false;
      });
      return () =>
        v.forEach(([o, vis]) => {
          o.visible = vis;
        });
    };
    const tt =
      !tunnelShot && find(['SOUQ WAQIF', 'QANAT QUARTIER', 'MSHEIREB DOWNTOWN', 'MEDINA CENTRALE', 'LUSAIL BOULEVARD']);
    if (tt) {
      const back = hideAll();
      tunnelShot = fromRoad(tt.s, 34, 0, 1.9, game.track.point(tt.s + 40, 0), 1.6);
      back();
    } // an empty street from the driver's seat
    const cr = !cruiseShot && find(['WEST BAY', 'PORTO ARABIA', 'KATARA TOWERS', 'LUSAIL MARINA', 'THE CORNICHE']);
    if (cr) {
      // Dodo's monster truck cruising, the landmark standing behind it
      const back = hideAll(),
        def = RACERS.find(r => r.veh === 'monster') || RACERS[0],
        truck = makeKart(def, game.TEX, quality.layers, 'monster', DEFAULT_CUSTOM.monster);
      scene.add(truck.root);
      // find the stretch of road where the landmark lines up straight behind the truck, seen from 14 m off its nose (or tail)
      let best = null;
      for (let s0 = 0; s0 < game.track.len; s0 += 4) {
        const i = game.track.idx(s0);
        if (game.track.covered[i] || game.track.trench[i]) continue;
        const T = game.track.frame(s0, game.track.newFrame());
        for (const dir of [1, -1]) {
          const cx = T.p.x + T.t.x * 14 * dir,
            cz = T.p.z + T.t.z * 14 * dir,
            d = Math.hypot(cr.x - cx, cr.z - cz);
          if (d < 60 || d > 420) continue;
          const a = Math.abs(
            Math.atan2(
              (T.p.x - cx) * (cr.z - cz) - (T.p.z - cz) * (cr.x - cx),
              (T.p.x - cx) * (cr.x - cx) + (T.p.z - cz) * (cr.z - cz),
            ),
          );
          if (!best || a < best.a) best = { a, s0, dir };
        }
      }
      const F = game.track.frame(best.s0, game.track.newFrame()),
        basis = new THREE.Matrix4();
      truck.root.position.copy(F.p);
      basis.makeBasis(new THREE.Vector3().crossVectors(F.u, F.t), F.u, F.t);
      truck.root.quaternion.setFromRotationMatrix(basis);
      truck.root.updateMatrixWorld(true);
      pc.position.copy(F.p).addScaledVector(F.t, 14 * best.dir);
      pc.position.y += 3;
      pc.lookAt(F.p.x, F.p.y + 3.6, F.p.z);
      renderer.render(scene, pc);
      cruiseShot = canvas.toDataURL('image/jpeg', 0.75);
      scene.remove(truck.root);
      back();
    }
  }
  if (chapter.id !== 'kano' && tunnelShot) for (const pl of places) if (pl.bore) pl.img = tunnelShot; // Doha's underpass from the driver's seat (from above it's a slot in the sand)
  game.mapShot = {
    image,
    aspect: (halfW / halfH).toFixed(4),
    places,
    tunnel: tunnelShot,
    cruise: cruiseShot,
    pack: packShot,
  };
  void image; // (the home Map tile has one fixed picture: public/tile-map.jpg)
}
