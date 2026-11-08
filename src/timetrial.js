// Time Trial: records each lap, keeps the best one as a ghost, and replays the ghost in step with the lap clock.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { game } from './game.js';

export const TT = { last: -1, start: 0, laps: [], rec: [], recT: 0, ghost: null, newBest: false };
export const FREE = { top: 0 };

// Time trial: record this lap 15 times a second; replay the best one on the ghost, in step with the lap clock
const gq = new THREE.Quaternion(),
  gq2 = new THREE.Quaternion();
export function ghostStep(p) {
  const g = game.race.ghost;
  if (!g) return;
  const lapT = game.race.time - TT.start,
    timing = TT.last >= 0 && !p.finished;
  if (timing && game.state === 'race' && lapT >= TT.recT) {
    TT.recT += 1 / 15;
    const r = p.m.root,
      q = r.quaternion;
    TT.rec.push(
      +lapT.toFixed(3),
      +r.position.x.toFixed(2),
      +r.position.y.toFixed(2),
      +r.position.z.toFixed(2),
      +q.x.toFixed(4),
      +q.y.toFixed(4),
      +q.z.toFixed(4),
      +q.w.toFixed(4),
    );
  }
  const G = TT.ghost,
    S = G?.s;
  if (!timing || !S || S.length < 16 || lapT > G.d || lapT > S[S.length - 8]) {
    g.root.visible = false;
    return;
  }
  let lo = 0,
    hi = S.length / 8 - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (S[mid * 8] <= lapT) lo = mid;
    else hi = mid;
  }
  const a = lo * 8,
    b = hi * 8,
    u = clamp((lapT - S[a]) / Math.max(1e-4, S[b] - S[a]), 0, 1);
  g.root.position.set(lerp(S[a + 1], S[b + 1], u), lerp(S[a + 2], S[b + 2], u), lerp(S[a + 3], S[b + 3], u));
  gq.set(S[a + 4], S[a + 5], S[a + 6], S[a + 7]);
  gq2.set(S[b + 4], S[b + 5], S[b + 6], S[b + 7]);
  g.root.quaternion.slerpQuaternions(gq, gq2, u);
  g.root.visible = g.root.position.distanceTo(p.m.root.position) > 2.5; // it fades out of the way when you're on top of it
}
