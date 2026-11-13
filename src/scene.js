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
  // Singapore's is a Las Vegas night: the sky and the streets dark, so the city's lights (every window, the LED edges
  // of the towers, the floodlit landmarks, the Supertrees) blaze against it in colour. The contrast is the point
  // (Kaduna and Kano City, the metropolis, glow like Doha: a big city's night, the sky lit from below, the streets bright)
  const city =
      on &&
      (chapter.id === 'doha' ||
        chapter.id === 'singapore' ||
        chapter.id === 'kaduna' ||
        (chapter.id === 'kano' && game.circuit?.id === 'metro')),
    neon = on && chapter.id === 'singapore';
  sun.color.set(on ? (neon ? '#8f9cff' : city ? '#b4bfff' : '#8fa8ff') : '#ffe2b8');
  sun.intensity = on ? (neon ? 0.85 : city ? 1.5 : 1.0) : 3.6;
  hemi.color.set(on ? (neon ? '#6a64b0' : city ? '#9a90d8' : '#4a5f9e') : '#cfe2ff');
  hemi.groundColor.set(on ? (neon ? '#3a2a58' : city ? '#6a4a34' : '#3a2a1c') : '#8a6a48');
  hemi.intensity = on ? (neon ? 1.05 : city ? 1.75 : 1.05) : 1.35;
  scene.fog.color.set(on ? (neon ? '#140c30' : city ? '#2c2148' : '#0a0f22') : '#e9d9bf');
  scene.environmentIntensity = on ? (neon ? 0.5 : city ? 0.7 : 0.45) : 1;
  renderer.toneMappingExposure = on ? (neon ? 1.35 : city ? 1.4 : 1.3) : 1.0;
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
