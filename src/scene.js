// The 3D stage: the renderer, the scene, the camera, the sun and sky light, and day or night.
import * as THREE from 'three';
import { setAniso } from './textures.js';
import { ENV } from './buddy.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { isTouch, store } from './util.js';
import { $ } from './dom.js';
import { chapter, game } from './game.js';

export const low = isTouch || Math.min(screen.width, screen.height) < 700;
export const quality = {
  layers: low ? 10 : 14,
  aiLayers: low ? 6 : 9,
  shadow: low ? 1024 : 2048,
  dpr: Math.min(devicePixelRatio, low ? 1.75 : 2),
};

export const canvas = $('#gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.dpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0; // keeps the hues true and saturated (ACES bleached the reds to pink)
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
export const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e9d9bf', 140, 1700); // a warm harmattan haze: near enough to give the city depth
export const cam = new THREE.PerspectiveCamera(65, 1, 0.5, 7000);
scene.add(new THREE.HemisphereLight('#cfe2ff', '#8a6a48', 1.35));
export const sun = new THREE.DirectionalLight('#ffe2b8', 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(quality.shadow, quality.shadow);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 420 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
// day or night: the sun becomes moonlight, the light drops and cools, the city and the karts' headlights come on

const hemi = scene.children.find(o => o.isHemisphereLight);
// night on the player's own clock: from 7 in the evening to 6 in the morning
export const clockNight = (h = new Date().getHours()) => h >= 19 || h < 6;
export function setNight(on) {
  game.night = on ? 1 : 0;
  // Kano's night is dark: moonlight and lamplit windows. Doha's is a big city's: the sky glows, the streets are lit end to
  // end, the towers blaze, so the light is brighter and warmer and the haze is a lit purple rather than black
  // (Kaduna and Kano City, the metropolis, glow like Doha: a big city's night, the sky lit from below, the streets bright)
  // Singapore is a bright night too, the sky lit and the streets clear, but the ambient light a little lower than Doha's
  // so the city's own lights (every window, the towers' LED edges, the Supertrees) still stand out against it
  const city =
      on &&
      (chapter.id === 'doha' ||
        chapter.id === 'singapore' ||
        chapter.id === 'kaduna' ||
        (chapter.id === 'kano' && game.circuit?.id === 'metro')),
    sg = on && chapter.id === 'singapore',
    L = (d, n, c, g) => (on ? (sg ? g : city ? c : n) : d); // day, a dark night, a big city's night, Singapore's
  sun.color.set(L('#ffe2b8', '#8fa8ff', '#b4bfff', '#a8b4ff'));
  sun.intensity = L(3.6, 1.0, 1.5, 1.2);
  hemi.color.set(L('#cfe2ff', '#4a5f9e', '#9a90d8', '#8a84d0'));
  hemi.groundColor.set(L('#8a6a48', '#3a2a1c', '#6a4a34', '#4a3a50'));
  hemi.intensity = L(1.35, 1.05, 1.75, 1.4);
  scene.fog.color.set(L('#e9d9bf', '#0a0f22', '#2c2148', '#241a44'));
  scene.environmentIntensity = L(1, 0.45, 0.7, 0.6);
  renderer.toneMappingExposure = L(1.0, 1.3, 1.4, 1.38);
  game.world?.setNight(game.night);
  game.race?.setNight?.(game.night);
  $('#nightBtn')?.classList.toggle('on', on);
  store.set('night', on);
}
// studio reflections for the vehicles' paint and chrome
ENV.tex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  game.garage?.resize(cam.aspect);
  game.modesRoom?.resize(cam.aspect);
}
addEventListener('resize', resize);
resize();
