// The track pen: a turtle that draws a circuit as straights, banked arcs and vertical loops, dropping features (gates,
// jumps, pads...) along the way at distances from the start. closer() solves a circuit's last two straights so it
// closes on itself. Every city's circuits are drawn with it (src/chapters.js, src/kano2.js).
export const D = Math.PI / 180;

export function turtle() {
  let x = 0,
    y = 0,
    z = 0,
    h = 0,
    len = 0;
  const pts = [[0, 0, 0]],
    feats = [],
    loops = [];
  const push = () => pts.push([x, y, z]);
  const tag = (list = []) => {
    for (const [off, type, data] of list) feats.push({ s: len + off, type, ...data });
  };
  return {
    pts,
    feats,
    loops,
    get len() {
      return len;
    },
    straight(L, dy = 0, list) {
      tag(list);
      const n = Math.ceil(L / 6);
      for (let i = 1; i <= n; i++) {
        x += (Math.sin(h) * L) / n;
        z += (Math.cos(h) * L) / n;
        y += dy / n;
        len += L / n;
        push();
      }
    },
    arc(R, deg, dy = 0, list) {
      tag(list);
      const n = Math.ceil((R * Math.abs(deg) * D) / 6),
        s = Math.sign(deg);
      for (let i = 1; i <= n; i++) {
        const dh = (deg * D) / n,
          cx = x + Math.cos(h) * R * s,
          cz = z - Math.sin(h) * R * s;
        h += dh;
        x = cx - Math.cos(h) * R * s;
        z = cz + Math.sin(h) * R * s;
        y += dy / n;
        len += R * Math.abs(dh);
        push();
      }
    },
    // a vertical loop-the-loop; it drifts sideways by `shift` so the road clears itself
    loop(R, shift) {
      const bx = x,
        bz = z,
        by = y,
        dx = Math.sin(h),
        dz = Math.cos(h),
        sx = -Math.cos(h),
        sz = Math.sin(h),
        n = 44;
      const s0 = len;
      for (let i = 1; i <= n; i++) {
        const t = (i / n) * 2 * Math.PI,
          k = t / (2 * Math.PI);
        x = bx + dx * R * Math.sin(t) + sx * shift * k;
        z = bz + dz * R * Math.sin(t) + sz * shift * k;
        y = by + R * (1 - Math.cos(t));
        push();
      }
      len += Math.hypot(2 * Math.PI * R, shift);
      loops.push([s0, len]);
    },
  };
}

// close a circuit drawn by fn(La, Lb): its last two straights (heading 270° and 0°) are solved so the end meets the start
export const closer = fn => () => {
  const e = fn(1000, 1000).pts.at(-1),
    t = fn(1000 + e[0], 1000 - e[2]);
  t.pts.pop();
  return { pts: t.pts, feats: t.feats, loops: t.loops, len: t.len };
};
