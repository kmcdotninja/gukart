// The Shockwave item going off: a dome of violet energy bursting out from the car to the reach that knocks the cars
// round it (the race's 24 m), bright at its rim and see-through at its middle, with bands of light running up it; a
// ring racing out flat across the ground with it; and a crackle of light at the car. One look (the race's, the Physics
// Studio's), through FX.shock.
import * as THREE from 'three';

const DOME = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
const domeMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color('#b18cff') } },
    vertexShader:
      'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 w = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }',
    fragmentShader: `uniform float uK; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float rim = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.4);
        float bands = smoothstep(.7, 1., sin(vP.y * 18. - uK * 30.)) * .35;
        float base = smoothstep(.25, 0., vP.y) * .5;
        float a = (rim * 1.1 + bands + base + .05) * (1. - uK) * (1. - uK);
        gl_FragColor = vec4(mix(uCol, vec3(1.), rim * .4) * a, a);
      }`,
  });

export class Shockwaves {
  constructor(scene) {
    this.list = Array.from({ length: 3 }, () => {
      const dome = new THREE.Mesh(DOME, domeMat());
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: '#d9c8ff',
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      for (const m of [dome, ring]) {
        m.visible = false;
        m.userData.noHit = true;
        m.renderOrder = 3;
        scene.add(m);
      }
      return { dome, ring, life: 0 };
    });
    this.i = 0;
  }
  // from pos (on the ground under the car), out to radius
  fire(pos, radius) {
    const s = this.list[this.i++ % this.list.length];
    s.dome.position.copy(pos);
    s.ring.position.copy(pos).y += 0.1;
    s.life = s.max = 0.6;
    s.r = radius;
    s.dome.visible = s.ring.visible = true;
  }
  update(dt) {
    for (const s of this.list) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = Math.min(1, 1 - s.life / s.max),
        e = 1 - (1 - k) ** 3; // (fast out, slowing)
      s.dome.scale.set(s.r * e + 0.5, s.r * e * 0.55 + 0.3, s.r * e + 0.5);
      s.dome.material.uniforms.uK.value = k;
      s.ring.scale.setScalar(s.r * Math.min(1, e * 1.08) + 0.5);
      s.ring.material.opacity = (1 - k) * 0.95;
      if (s.life <= 0) s.dome.visible = s.ring.visible = false;
    }
  }
}
