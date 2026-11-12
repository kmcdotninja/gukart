// Singapore's streets (track.js): swept tarmac, the racing kerb, then a clean pavement of pale grey slabs with a granite
// edge along the kerb, and a strip of mown verge beyond it where the trees stand. Nothing on the path: the trees,
// lamps and benches keep to the verge (singapore.js).
import * as THREE from 'three';

function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// across the strip (u): granite setts at the kerb, then 60% pavement slabs, then the green verge; along it (v) the
// slabs repeat
export function paverTex() {
  return tex(512, 512, (x, w, h) => {
    const pave = w * 0.58;
    x.fillStyle = '#c9c9c6';
    x.fillRect(0, 0, pave, h);
    const u = 32; // one slab, about 60 cm
    for (let y = 0; y < h; y += u)
      for (let xx = 36; xx < pave; xx += u) {
        const tone = 196 + ((((Math.sin(xx * 12.9 + y * 78.2) * 43758.5) % 1) + 1) % 1) * 18;
        x.fillStyle = `rgb(${tone},${tone},${tone - 4})`;
        x.fillRect(xx + 1, y + 1, u - 2, u - 2);
      }
    // the tactile strip near the kerb, yellow studs, as at every crossing in the city
    x.fillStyle = '#e8c547';
    x.fillRect(40, 0, 10, h);
    x.fillStyle = '#6f7378';
    x.fillRect(0, 0, 36, h); // granite setts along the kerb
    x.strokeStyle = 'rgba(0,0,0,.22)';
    x.lineWidth = 2;
    for (let y = 0; y < h; y += 18) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(36, y);
      x.stroke();
    }
    // the verge: mown grass, a darker edge where it meets the slabs
    const g = x.createLinearGradient(pave, 0, w, 0);
    g.addColorStop(0, '#4f8a3a');
    g.addColorStop(1, '#5e9a44');
    x.fillStyle = g;
    x.fillRect(pave, 0, w - pave, h);
    x.fillStyle = '#9a9a96';
    x.fillRect(pave, 0, 6, h);
    for (let j = 0; j < 900; j++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,30,.35)' : 'rgba(140,190,90,.25)';
      x.fillRect(pave + 6 + Math.random() * (w - pave - 6), Math.random() * h, 2, 4);
    }
  });
}
