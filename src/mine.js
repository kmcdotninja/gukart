// The mine, after the user's picture of a real one: a squat round case of steel, painted warning red, with a rolled lip, its lid
// stepped up in rings to a raised middle; on top the fuze, a scalloped cap (six lobes) with its safety pin and ring
// pull; on the side a screw plug and a wire carrying handle; stencilled markings on the lid and round the side.
// Game-sized (1.6 m across) to read on the road at speed, with a red lens in the fuze that blinks when it's armed and
// a red glow spilling across the road round it. Built once, cloned for each one dropped (the race's, the Physics
// Studio's). Sits on y 0.
import * as THREE from 'three';

let proto = null;
export function makeMine() {
  if (!proto) proto = build();
  const root = proto.clone(),
    ring = root.getObjectByName('warn');
  ring.material = ring.material.clone(); // (each its own: one blinks off without the others)
  return { root, light: root.getObjectByName('lens'), ring };
}

function stencil(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  draw(x);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function build() {
  const g = new THREE.Group();
  const R = 0.8;
  // painted warning red (the user's call: it must be seen at speed), lit a little from within so it reads at night too
  const olive = new THREE.MeshStandardMaterial({ color: '#d0201a', emissive: '#ff1a0e', emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.3 }),
    oliveD = new THREE.MeshStandardMaterial({ color: '#7a0f0c', emissive: '#ff1a0e', emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.3 }),
    steel = new THREE.MeshStandardMaterial({ color: '#8c8a7a', roughness: 0.35, metalness: 0.8 });
  // the case: one turned profile, from the foot up the side, round the lip and up the lid's steps to the middle
  const prof = [
    [0, 0],
    [R - 0.06, 0],
    [R, 0.03], // (the foot's bevel)
    [R, 0.27],
    [R - 0.01, 0.3],
    [R - 0.05, 0.31], // (the lip)
    [R - 0.07, 0.33],
    [R * 0.84, 0.335],
    [R * 0.82, 0.355], // (the first step)
    [R * 0.66, 0.36],
    [R * 0.64, 0.385], // (the second)
    [R * 0.47, 0.39],
    [R * 0.45, 0.42], // (the raised middle)
    [0, 0.425],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), olive);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // the rolled bead round the lip
  const bead = new THREE.Mesh(new THREE.TorusGeometry(R - 0.035, 0.022, 8, 64).rotateX(Math.PI / 2), olive);
  bead.position.y = 0.305;
  g.add(bead);
  // the seam round the side
  const seam = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.012, 6, 64).rotateX(Math.PI / 2), oliveD);
  seam.position.y = 0.12;
  g.add(seam);
  // the fuze: a scalloped cap of six lobes on a collar, a dome with the pin through it and a ring pull
  {
    const s = new THREE.Shape(),
      n = 6;
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        r = 0.19 + 0.035 * Math.cos(a * n);
      s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    const cap = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 })
        .rotateX(-Math.PI / 2),
      oliveD,
    );
    cap.position.y = 0.43;
    cap.castShadow = true;
    g.add(cap);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 24), olive);
    collar.position.y = 0.5;
    g.add(collar);
    // the red lens in its middle: lit when armed
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff2b1f' }),
    );
    lens.name = 'lens';
    lens.position.y = 0.525;
    g.add(lens);
    // the safety pin across, and its ring pull lying on the lid
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8).rotateZ(Math.PI / 2), steel);
    pin.position.set(0.1, 0.5, 0);
    g.add(pin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 24).rotateX(Math.PI / 2 - 0.25), steel);
    ring.position.set(0.34, 0.47, 0.02);
    g.add(ring);
  }
  // on the side: the screw plug, and the wire carrying handle hinged either side of it
  {
    const a = -0.5,
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16).rotateZ(Math.PI / 2), oliveD);
    plug.position.copy(dir).multiplyScalar(R + 0.03).setY(0.17);
    plug.rotation.y = -a;
    g.add(plug);
    const plugCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6).rotateZ(Math.PI / 2), olive);
    plugCap.position.copy(dir).multiplyScalar(R + 0.08).setY(0.17);
    plugCap.rotation.y = -a;
    g.add(plugCap);
    // the handle: a loop of wire from a lug either side of the plug, hanging out and down
    const side = new THREE.Vector3(-dir.z, 0, dir.x),
      pts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20,
        along = (u - 0.5) * 0.5,
        out = Math.sin(u * Math.PI) * 0.22;
      pts.push(
        dir
          .clone()
          .multiplyScalar(R + 0.02 + out)
          .addScaledVector(side, along)
          .setY(0.2 - Math.sin(u * Math.PI) * 0.1),
      );
    }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.016, 6), oliveD);
    g.add(wire);
    for (const sg of [-1, 1]) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), oliveD);
      lug.position.copy(dir).multiplyScalar(R + 0.02).addScaledVector(side, sg * 0.25).setY(0.2);
      lug.rotation.y = -a;
      g.add(lug);
    }
  }
  // the stencils: on the lid, a mark and a lot number; round the side, the type and its year
  {
    const lid = stencil(512, 512, x => {
      x.fillStyle = 'rgba(20,18,12,.82)';
      x.font = 'bold 44px "Courier New", monospace';
      x.textAlign = 'center';
      x.save();
      x.translate(256, 256);
      x.rotate(-0.5);
      x.fillText('GK-26   LOT 5-77', 0, -150);
      x.restore();
      x.font = 'bold 36px "Courier New", monospace';
      x.fillText('GK', 120, 330);
    });
    const d = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.82, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: lid, transparent: true, roughness: 0.6, depthWrite: false }),
    );
    d.position.y = 0.338;
    d.renderOrder = 1;
    g.add(d);
    const band = stencil(1024, 64, x => {
      x.fillStyle = 'rgba(20,18,12,.8)';
      x.font = 'bold 40px "Courier New", monospace';
      x.fillText('GK-26   23-57', 520, 46);
    });
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.003, R + 0.003, 0.1, 64, 1, true),
      new THREE.MeshStandardMaterial({ map: band, transparent: true, roughness: 0.6, depthWrite: false }),
    );
    b.position.y = 0.2;
    g.add(b);
  }
  // the glow on the road round it: a bright red ring at its foot and a red light spilling out across the road to 2.6 m,
  // so you see it coming and steer round it (it pulses with the lens)
  const glowT = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d'),
      gr = x.createRadialGradient(128, 128, 0, 128, 128, 128),
      rr = (R + 0.2) / 2.6; // (the ring, as a share of the glow's radius)
    gr.addColorStop(0, 'rgba(255,40,30,0.9)');
    gr.addColorStop(rr * 0.9, 'rgba(255,40,30,0.9)');
    gr.addColorStop(rr, 'rgba(255,90,70,1)');
    gr.addColorStop(rr + 0.06, 'rgba(255,40,30,0.75)');
    gr.addColorStop(0.65, 'rgba(255,30,20,0.28)');
    gr.addColorStop(1, 'rgba(255,20,10,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const warn = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: glowT,
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  warn.name = 'warn';
  warn.position.y = 0.02;
  g.add(warn);
  g.traverse(o => (o.userData.noHit = true));
  return g;
}
