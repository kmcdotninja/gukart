// The rear-view mirror (desktop): what's behind you, like the mirror hanging in a car. A camera on your car looking
// back renders into a small picture, flipped left to right as a real mirror is (a car coming up behind on your left
// shows on the mirror's left), then drawn into the glass of #mirror on the HUD. M moves it: hanging under the
// progress bar, down at the bottom of the screen, or off. Not on phones (no M key, and a second render costs too much).
import * as THREE from 'three';
import { store, isTouch } from './util.js';
import { $ } from './dom.js';

const PLACES = ['top', 'bottom', 'off'];
let place = store.get('mirror', 'top');
if (!PLACES.includes(place)) place = 'top';

const rear = new THREE.PerspectiveCamera(48, 4, 3, 700); // (near 3 m: your own car is never in it)
let rt = null;
const flat = new THREE.Scene(),
  flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
  // the picture, cut to the glass's rounded shape (the frame's corners) and toned like the frame it sits in
  quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { map: { value: null }, size: { value: new THREE.Vector2(1, 1) }, rad: { value: new THREE.Vector2(10, 10) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 size, rad; varying vec2 vUv;
        void main(){
          vec2 p = vUv * size, q = abs(p - size * .5) - (size * .5 - rad);
          if (q.x > 0. && q.y > 0. && dot(q / rad, q / rad) > 1.) discard;
          gl_FragColor = texture2D(map, vec2(1. - vUv.x, vUv.y)); // (flipped left to right, as a mirror is)
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
flat.add(quad);
const at = new THREE.Vector3(),
  look = new THREE.Vector3();

function apply() {
  const m = $('#mirror');
  if (!m) return;
  m.dataset.at = place;
  m.hidden = isTouch || place === 'off';
  // hanging: in the top-centre stack under the progress bar; at the bottom: on the HUD itself, down the middle
  if (place === 'top') $('#hud .progress')?.after(m);
  else $('#hud').append(m);
}
export function initMirror() {
  apply();
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat) return;
    place = PLACES[(PLACES.indexOf(place) + 1) % PLACES.length];
    store.set('mirror', place);
    apply();
  });
}

// after the frame: the view behind the car into the mirror's glass
export function renderMirror(renderer, scene, car) {
  if (isTouch || place === 'off' || !car) return;
  const glass = $('#mirrorGlass');
  // something locked on to you: the frame flashes red, quicker as it closes
  const inc = arguments[3] ?? Infinity;
  glass?.classList.toggle('warn', inc < 160 && Math.sin(performance.now() / (inc < 50 ? 50 : 110)) > 0);
  const b = glass?.getBoundingClientRect();
  if (!b || b.width < 10) return;
  // the glass inside its frame
  const r = { left: b.left + glass.clientLeft, top: b.top + glass.clientTop, width: glass.clientWidth, height: glass.clientHeight };
  r.bottom = r.top + r.height;
  const dpr = renderer.getPixelRatio(),
    w = Math.round(r.width * dpr),
    h = Math.round(r.height * dpr);
  if (!rt || rt.width !== w || rt.height !== h) {
    rt?.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
    quad.material.uniforms.map.value = rt.texture;
  }
  quad.material.uniforms.size.value.set(r.width, r.height);
  // the frame's corners (border-radius 14px / 40%), less its border
  quad.material.uniforms.rad.value.set(Math.max(1, 14 - glass.clientLeft), Math.max(1, b.height * 0.4 - glass.clientTop));
  // the camera: on the car's roof, looking back down the road behind it
  car.updateMatrixWorld();
  at.set(0, 2.1, 0).applyMatrix4(car.matrixWorld);
  look.set(0, 1.3, -40).applyMatrix4(car.matrixWorld);
  rear.position.copy(at);
  rear.up.set(0, 1, 0);
  rear.lookAt(look);
  rear.aspect = r.width / r.height;
  rear.updateProjectionMatrix();

  const shadows = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false; // (the frame's shadows are already drawn)
  renderer.setRenderTarget(rt);
  renderer.render(scene, rear);
  renderer.setRenderTarget(null);
  renderer.shadowMap.autoUpdate = shadows;

  const cv = renderer.domElement.getBoundingClientRect(),
    x = r.left - cv.left,
    y = cv.bottom - r.bottom;
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setScissor(x, y, r.width, r.height);
  renderer.setViewport(x, y, r.width, r.height);
  renderer.render(flat, flatCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, cv.width, cv.height);
  renderer.autoClear = auto;
}
