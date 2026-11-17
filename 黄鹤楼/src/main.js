import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './materials.js';
import { buildEnvironment, terrainHeight } from './environment.js';
import { buildTower } from './tower.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';
import { disposeObject3D } from './utils.js';
import './style.css';

/**
 * 黄鹤楼 · 可漫游三维场景
 * 入口：渲染器、场景、昼夜、交互与主循环
 */

const app = document.getElementById('app');
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);

// ---------------- 渲染器 ----------------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'scene';
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  window.innerWidth / window.innerHeight < 0.9 ? 80 : 66,
  window.innerWidth / window.innerHeight,
  0.1,
  1400
);

// ---------------- 材质、环境、楼阁 ----------------
const mats = createMaterials();
const env = buildEnvironment(scene, mats.M);
const tower = buildTower(mats.M);
scene.add(tower.group);

// 地形高度 + 楼板 / 楼梯斜面
function getSupportY(x, z, refY) {
  let best = -Infinity;
  const th = terrainHeight(x, z);
  if (th <= refY) best = th;

  for (const s of tower.surfaces) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    let y;
    if (s.type === 'rect') {
      y = s.y;
    } else if (s.type === 'rampX') {
      y = s.y0 + ((s.y1 - s.y0) * (x - s.x0)) / (s.x1 - s.x0);
    } else {
      y = s.y0 + ((s.y1 - s.y0) * (z - s.z0)) / (s.z1 - s.z0);
    }
    if (y <= refY && y > best) best = y;
  }
  return best === -Infinity ? terrainHeight(x, z) : best;
}

const world = {
  colliders: tower.colliders,
  getSupportY,
};

// ---------------- 玩家与 NPC ----------------
const player = new Player(camera, renderer.domElement, world, scene);
const npcs = new NPCManager(scene, world);

// ---------------- 后期泛光 ----------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22,
  0.6,
  0.92
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------- 昼夜 ----------------
let night = 0;
let nightTarget = 0;

function applyNight(k) {
  env.setNight(k);
  tower.setNight(k);
  bloom.strength = 0.22 + 0.78 * k;
  renderer.toneMappingExposure = 1.02 + 0.1 * k;
}

const btnNight = document.getElementById('btnNight');
function updateNightLabel() {
  btnNight.textContent = nightTarget > 0.5 ? '切换白天' : '切换夜晚';
  btnNight.setAttribute('aria-pressed', String(nightTarget > 0.5));
}
function onToggleNight() {
  nightTarget = nightTarget > 0.5 ? 0 : 1;
  updateNightLabel();
}
btnNight.addEventListener('click', onToggleNight);
updateNightLabel();

// ---------------- 视角切换 ----------------
const btnView = document.getElementById('btnView');
function updateViewLabel() {
  btnView.textContent = player.mode === 'fp' ? '视角：第一人称' : '视角：第三人称';
  document.getElementById('crosshair').style.opacity = player.mode === 'fp' ? '1' : '0';
}
function onToggleView() {
  player.toggleMode();
  updateViewLabel();
}
btnView.addEventListener('click', onToggleView);
updateViewLabel();

// ---------------- 飞行模式 ----------------
const btnFly = document.getElementById('btnFly');
const btnJump = document.getElementById('btnJump');
const btnDown = document.getElementById('btnDown');

function updateFlyLabel() {
  btnFly.textContent = player.flying ? '飞行：开' : '飞行：关';
  btnFly.setAttribute('aria-pressed', String(player.flying));
  btnJump.textContent = player.flying ? '升' : '跳';
  document.body.classList.toggle('flying', player.flying);
}
function onToggleFly() {
  player.toggleFly();
  updateFlyLabel();
}
btnFly.addEventListener('click', onToggleFly);
updateFlyLabel();

// ---------------- 跳跃 / 升降 ----------------
function onJump() {
  player.jumpQueued = true;
}
function onJumpDown(e) {
  player.flyUp = true;
}
function onJumpUp() {
  player.flyUp = false;
}
btnJump.addEventListener('click', onJump);
btnJump.addEventListener('pointerdown', onJumpDown);
btnJump.addEventListener('pointerup', onJumpUp);
btnJump.addEventListener('pointercancel', onJumpUp);
btnJump.addEventListener('pointerleave', onJumpUp);

function onDownStart(e) {
  e.preventDefault();
  player.flyDown = true;
}
function onDownEnd() {
  player.flyDown = false;
}
btnDown.addEventListener('pointerdown', onDownStart);
btnDown.addEventListener('pointerup', onDownEnd);
btnDown.addEventListener('pointercancel', onDownEnd);
btnDown.addEventListener('pointerleave', onDownEnd);

// ---------------- 移动端摇杆 ----------------
const joyEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
let joyPointer = null;

function updateJoy(e) {
  const rect = joyEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width / 2 - 6;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  player.joy.x = dx / max;
  player.joy.y = -dy / max;
}

function onJoyDown(e) {
  e.preventDefault();
  joyPointer = e.pointerId;
  try {
    joyEl.setPointerCapture(e.pointerId);
  } catch {
    /* 合成事件可能没有活动指针 */
  }
  joyEl.classList.add('active');
  updateJoy(e);
}
function onJoyMove(e) {
  if (e.pointerId !== joyPointer) return;
  updateJoy(e);
}
function endJoy(e) {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null;
  stickEl.style.transform = 'translate(0px, 0px)';
  player.joy.x = 0;
  player.joy.y = 0;
  joyEl.classList.remove('active');
}

joyEl.addEventListener('pointerdown', onJoyDown);
joyEl.addEventListener('pointermove', onJoyMove);
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);

// ---------------- 展品点击 ----------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const card = document.getElementById('card');
const cardTitle = document.getElementById('cardTitle');
const cardTag = document.getElementById('cardTag');
const cardText = document.getElementById('cardText');

function showCard(info) {
  cardTag.textContent = info.tag || '介绍';
  cardTitle.textContent = info.title;
  cardText.textContent = info.text;
  card.classList.add('show');
}
function hideCard() {
  card.classList.remove('show');
}
const cardClose = document.getElementById('cardClose');
cardClose.addEventListener('click', hideCard);

function onCanvasPointerUp(e) {
  if (!player.consumeClick()) return;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(tower.clickables, false);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.info) obj = obj.parent;
  if (obj?.userData.info) showCard(obj.userData.info);
}
renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);

// ---------------- 键盘快捷键 ----------------
function onKeyDown(e) {
  if (e.code === 'KeyN') onToggleNight();
  if (e.code === 'KeyV') onToggleView();
  if (e.code === 'KeyF') onToggleFly();
}
window.addEventListener('keydown', onKeyDown);

// ---------------- 自适应 ----------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 80 : 66;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 2));
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------------- 主循环 ----------------
const loading = document.getElementById('loading');
let last = performance.now();
let elapsed = 0;
let firstFrame = true;

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  elapsed += dt;

  player.update(dt);
  npcs.update(dt, elapsed);
  env.update(dt);

  night += (nightTarget - night) * Math.min(1, dt * 2.2);
  if (Math.abs(nightTarget - night) < 0.001) night = nightTarget;
  applyNight(night);

  composer.render();

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => loading.classList.add('hide'));
  }
});

// ---------------- 资源释放 ----------------
let disposed = false;
function disposeAll() {
  if (disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('beforeunload', disposeAll);
  btnNight.removeEventListener('click', onToggleNight);
  btnView.removeEventListener('click', onToggleView);
  btnFly.removeEventListener('click', onToggleFly);
  btnJump.removeEventListener('click', onJump);
  btnJump.removeEventListener('pointerdown', onJumpDown);
  btnJump.removeEventListener('pointerup', onJumpUp);
  btnJump.removeEventListener('pointercancel', onJumpUp);
  btnJump.removeEventListener('pointerleave', onJumpUp);
  btnDown.removeEventListener('pointerdown', onDownStart);
  btnDown.removeEventListener('pointerup', onDownEnd);
  btnDown.removeEventListener('pointercancel', onDownEnd);
  btnDown.removeEventListener('pointerleave', onDownEnd);
  joyEl.removeEventListener('pointerdown', onJoyDown);
  joyEl.removeEventListener('pointermove', onJoyMove);
  joyEl.removeEventListener('pointerup', endJoy);
  joyEl.removeEventListener('pointercancel', endJoy);
  cardClose.removeEventListener('click', hideCard);
  renderer.domElement.removeEventListener('pointerup', onCanvasPointerUp);
  player.dispose();
  npcs.dispose();
  composer.dispose();
  disposeObject3D(scene);
  mats.dispose();
  renderer.dispose();
  renderer.domElement.remove();
  if (window.__yc) delete window.__yc;
}

window.addEventListener('beforeunload', disposeAll);
if (import.meta.hot) {
  import.meta.hot.dispose(disposeAll);
}

// 便于调试 / 自动化检查
window.__yc = { scene, camera, renderer, composer, bloom, player, npcs, env, tower, world, mats, THREE };
