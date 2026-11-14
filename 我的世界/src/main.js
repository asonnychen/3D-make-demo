/* ============================================================
   我的世界 · 入口
   PlayCanvas 应用、区块渲染、第一人称玩法与界面联动
   ============================================================ */

import {
  Application,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO,
  FOG_LINEAR,
  GAMMA_SRGB,
  TONEMAP_NONE,
  Mouse,
  Keyboard,
  StandardMaterial,
  Texture,
  PIXELFORMAT_SRGBA8,
  ADDRESS_REPEAT,
  FILTER_NEAREST,
  FILTER_NEAREST_MIPMAP_LINEAR,
  Vec2,
  Mesh,
  MeshInstance,
} from 'playcanvas'
import './style.css'

import { FOG_START, FOG_END, SEA_LEVEL, WORLD_X, WORLD_Z } from './config.js'
import { BLOCK, BLOCK_INFO, HOTBAR, iconTile } from './blocks.js'
import { createAtlas, extractTile, TILE_INDEX, ATLAS_COLS, TILE_PX } from './textures.js'
import { World } from './world.js'
import { ChunkRenderer } from './chunks.js'
import { createSky } from './sky.js'
import { Player } from './player.js'
import { Interaction, createSelectionBox } from './interaction.js'
import { buildQuadGeometry } from './mesher.js'

/* ------------------------------------------------------------ 应用 */

const canvas = document.querySelector('#scene')
const mouse = new Mouse(canvas)
const keyboard = new Keyboard(window)
const app = new Application(canvas, { mouse, keyboard })
app.setCanvasFillMode(FILLMODE_FILL_WINDOW)
app.setCanvasResolution(RESOLUTION_AUTO)
window.addEventListener('resize', () => app.resizeCanvas())

const device = app.graphicsDevice

/* 场景氛围 */
app.scene.ambientLight = new Color(0.45, 0.47, 0.5)
const fog = app.scene.fog
fog.type = FOG_LINEAR
fog.color = new Color(0.86, 0.93, 0.97)
fog.start = FOG_START
fog.end = FOG_END

/* 相机 */
const camera = new Entity('camera')
camera.addComponent('camera', {
  clearColor: new Color(0.62, 0.76, 0.9),
  fov: 72,
  nearClip: 0.08,
  farClip: 1600,
})
camera.camera.gammaCorrection = GAMMA_SRGB
camera.camera.toneMapping = TONEMAP_NONE
app.root.addChild(camera)

/* 阳光 */
const sun = new Entity('sun')
sun.addComponent('light', {
  type: 'directional',
  color: new Color(1, 0.97, 0.88),
  intensity: 0.62,
  castShadows: false,
})
sun.setEulerAngles(52, 38, 0)
app.root.addChild(sun)

/* ------------------------------------------------------------ 世界 */

const atlas = createAtlas()
const world = new World(2026)
const chunks = new ChunkRenderer(app, world, atlas)
const sky = createSky(app)

/* 远海平面：把世界边界藏进海平线 */
function createOcean() {
  const tile = extractTile(atlas.canvas, 'water')
  const texture = new Texture(device, {
    width: TILE_PX,
    height: TILE_PX,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: FILTER_NEAREST_MIPMAP_LINEAR,
    magFilter: FILTER_NEAREST,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT,
  })
  texture.setSource(tile)

  const material = new StandardMaterial()
  material.diffuse = new Color(1, 1, 1)
  material.ambient = new Color(1, 1, 1)
  material.diffuseMap = texture
  material.diffuseMapTiling = new Vec2(90, 90)
  material.specular = new Color(0.1, 0.14, 0.2)
  material.gloss = 0.5
  material.useFog = true
  material.update()

  const ocean = new Entity('ocean')
  const quad = buildQuadGeometry()
  const mesh = new Mesh(device)
  mesh.setPositions(quad.positions)
  mesh.setNormals(quad.normals)
  mesh.setUvs(0, quad.uvs)
  mesh.setColors(quad.colors)
  mesh.setIndices(new Uint32Array(quad.indices))
  mesh.update()
  const instance = new MeshInstance(mesh, material)
  instance.castShadows = false
  ocean.addComponent('render', { meshInstances: [instance] })
  ocean.setLocalScale(2400, 1, 2400)
  ocean.setPosition(WORLD_X / 2, SEA_LEVEL + 0.94, WORLD_Z / 2)
  app.root.addChild(ocean)
  return ocean
}

createOcean()

const player = new Player(world, camera)
const selection = createSelectionBox(app, device)
const interaction = new Interaction(app, world, player, selection)
interaction.selectedBlock = BLOCK.GRASS

/* ------------------------------------------------------------ 状态 */

let state = 'loading' // loading | menu | play | paused | help
let orbitAngle = 0
let spawnPoint = { x: 64, y: 40, z: 64 }

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
}

/* ------------------------------------------------------------ 界面元素 */

const el = {
  body: document.body,
  menu: document.querySelector('#menu'),
  pause: document.querySelector('#pause'),
  help: document.querySelector('#help'),
  loading: document.querySelector('#loading'),
  loadingBar: document.querySelector('#loading-bar'),
  loadingPct: document.querySelector('#loading-pct'),
  loadingNote: document.querySelector('#loading-note'),
  seed: document.querySelector('#seed'),
  hotbar: document.querySelector('#hotbar'),
  blockLabel: document.querySelector('#block-label'),
  statFps: document.querySelector('#stat-fps'),
  statPos: document.querySelector('#stat-pos'),
  statChunk: document.querySelector('#stat-chunk'),
  statMode: document.querySelector('#stat-mode'),
  underwater: document.querySelector('#underwater'),
  btnFly: document.querySelector('#btn-fly'),
  btnHelp: document.querySelector('#btn-help'),
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

function showScreen(name) {
  el.menu.classList.toggle('hidden', name !== 'menu')
  el.pause.classList.toggle('hidden', name !== 'paused')
  el.help.classList.toggle('hidden', name !== 'help')
  el.loading.classList.toggle('hidden', name !== 'loading')
}

/* ------------------------------------------------------------ 快捷栏 */

function tileIcon(tileName) {
  const index = TILE_INDEX[tileName] ?? 0
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const c = document.createElement('canvas')
  c.width = 48
  c.height = 48
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    atlas.canvas,
    col * TILE_PX,
    row * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    48,
    48,
  )
  return c.toDataURL()
}

const slotButtons = []

function buildHotbar() {
  el.hotbar.innerHTML = ''
  slotButtons.length = 0
  HOTBAR.forEach((blockId, i) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'slot'
    button.title = BLOCK_INFO[blockId].cn
    button.innerHTML = `<span class="num">${i + 1}</span><img alt="" src="${tileIcon(iconTile(blockId))}" />`
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      selectSlot(i, true)
    })
    el.hotbar.appendChild(button)
    slotButtons.push(button)
  })
  selectSlot(0, false)
}

let activeSlot = 0
let labelTimer = 0

function selectSlot(index, announce = true) {
  activeSlot = ((index % HOTBAR.length) + HOTBAR.length) % HOTBAR.length
  const blockId = HOTBAR[activeSlot]
  interaction.selectedBlock = blockId
  slotButtons.forEach((btn, i) => btn.classList.toggle('active', i === activeSlot))
  if (announce) {
    el.blockLabel.textContent = BLOCK_INFO[blockId].cn
    el.blockLabel.classList.add('show')
    labelTimer = 1.6
  }
}

/* ------------------------------------------------------------ 加载世界 */

async function loadWorld(seed) {
  state = 'loading'
  el.body.classList.remove('playing')
  showScreen('loading')
  el.loadingBar.style.width = '0%'
  el.loadingPct.textContent = '0%'
  el.loadingNote.textContent = '隆起丘陵 · 灌满湖泊 · 种下橡树'
  await nextFrame()

  chunks.detachEntities()
  world.seed = Number(seed) || 2026
  world.chunks.fill(null)
  world.generate()

  chunks.attachEntities()

  const total = world.chunks.length
  for (let i = 0; i < total; i++) {
    chunks.rebuild(world.chunks[i])
    const pct = Math.round(((i + 1) / total) * 100)
    el.loadingBar.style.width = `${pct}%`
    el.loadingPct.textContent = `${pct}%`
    if (i === Math.floor(total * 0.5)) el.loadingNote.textContent = '铺设草皮 · 点亮阳光'
    if (i % 2 === 0) await nextFrame()
  }

  spawnPoint = world.findSpawn()
  player.spawnAt(spawnPoint)
  interaction.update()
}

/* ------------------------------------------------------------ 开始 / 暂停 */

function startPlaying() {
  showScreen(null)
  state = 'play'
  el.body.classList.add('playing')
  mouse.enablePointerLock()
}

function pauseGame() {
  if (state !== 'play') return
  state = 'paused'
  showScreen('paused')
  el.body.classList.remove('playing')
  mouse.disablePointerLock()
  clearInput()
}

function resumeGame() {
  if (state === 'paused' || state === 'help') {
    showScreen(null)
    state = 'play'
    el.body.classList.add('playing')
    mouse.enablePointerLock()
  }
}

function toggleHelp() {
  if (state === 'play' || state === 'paused') {
    state = 'help'
    showScreen('help')
    mouse.disablePointerLock()
    clearInput()
  } else if (state === 'help') {
    resumeGame()
  }
}

function clearInput() {
  input.forward = false
  input.back = false
  input.left = false
  input.right = false
  input.jump = false
  input.sprint = false
}

function toggleFly() {
  player.flying = !player.flying
  player.velocity.y = 0
  el.btnFly.classList.toggle('is-on', player.flying)
  el.statMode.textContent = player.flying ? '飞行' : '步行'
  if (state === 'play') {
    el.blockLabel.textContent = player.flying ? '飞行模式：Space 上升 / Shift 下降' : '步行模式'
    el.blockLabel.classList.add('show')
    labelTimer = 2
  }
}

/* ------------------------------------------------------------ 输入 */

keyboard.on('keydown', (event) => {
  const key = event.key
  const code = event.event?.code

  if (code === 'KeyW' || key === 87) input.forward = true
  if (code === 'KeyS' || key === 83) input.back = true
  if (code === 'KeyA' || key === 65) input.left = true
  if (code === 'KeyD' || key === 68) input.right = true
  if (code === 'Space' || key === 32) input.jump = true
  if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 16) input.sprint = true

  if (key >= 49 && key <= 57) selectSlot(key - 49, true)

  if (state === 'play') {
    if (code === 'KeyF') toggleFly()
    if (code === 'KeyH') toggleHelp()
  } else if (state === 'help' && (code === 'KeyH' || key === 27)) {
    resumeGame()
  }
})

keyboard.on('keyup', (event) => {
  const key = event.key
  const code = event.event?.code

  if (code === 'KeyW' || key === 87) input.forward = false
  if (code === 'KeyS' || key === 83) input.back = false
  if (code === 'KeyA' || key === 65) input.left = false
  if (code === 'KeyD' || key === 68) input.right = false
  if (code === 'Space' || key === 32) input.jump = false
  if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 16) input.sprint = false
})

mouse.on('mousemove', (event) => {
  if (state !== 'play') return
  if (!Mouse.isPointerLocked()) return
  player.look(event.dx || 0, event.dy || 0, 0.16)
})

mouse.on('mousedown', (event) => {
  if (state !== 'play' || !Mouse.isPointerLocked()) return
  if (event.button === 0) interaction.breakBlock()
  else if (event.button === 2) interaction.placeBlock()
  else if (event.button === 1) {
    const picked = interaction.pickBlock()
    if (picked != null) {
      const slot = HOTBAR.indexOf(picked)
      if (slot >= 0) selectSlot(slot, true)
    }
  }
})

mouse.on('mousewheel', (event) => {
  if (state !== 'play') return
  selectSlot(activeSlot + (event.wheel > 0 ? 1 : -1), true)
})

mouse.disableContextMenu()

document.addEventListener('pointerlockchange', () => {
  if (state === 'play' && !Mouse.isPointerLocked()) pauseGame()
})

document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (state === 'play') pauseGame()
    else if (state === 'help') resumeGame()
  }
})

/* ------------------------------------------------------------ 按钮 */

document.querySelector('#btn-start').addEventListener('click', () => startPlaying())
document.querySelector('#btn-resume').addEventListener('click', () => resumeGame())
document.querySelector('#btn-pause-fly').addEventListener('click', () => toggleFly())
document.querySelector('#btn-help-close').addEventListener('click', () => resumeGame())
el.btnHelp.addEventListener('click', () => toggleHelp())
el.btnFly.addEventListener('click', () => toggleFly())
document.querySelector('#btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
})

async function regenerate() {
  const wasPlaying = state === 'play' || state === 'paused'
  const seed = String(Math.floor(Math.random() * 900000) + 100000)
  el.seed.value = seed
  await loadWorld(seed)
  if (wasPlaying) {
    state = 'paused'
    showScreen('paused')
  } else {
    state = 'menu'
    showScreen('menu')
  }
}

document.querySelector('#btn-reset').addEventListener('click', () => regenerate())
document.querySelector('#btn-pause-reset').addEventListener('click', () => regenerate())

/* ------------------------------------------------------------ 相机预览 */

function orbitCamera(dt) {
  orbitAngle += dt * 0.1
  const radius = 62
  const target = spawnPoint
  camera.setPosition(
    target.x + Math.cos(orbitAngle) * radius,
    target.y + 34,
    target.z + Math.sin(orbitAngle) * radius,
  )
  camera.lookAt(target.x, target.y + 6, target.z)
}

/* ------------------------------------------------------------ 主循环 */

let fpsAccum = 0
let fpsFrames = 0
let hudTimer = 0
let wasUnderwater = false

app.on('update', (rawDt) => {
  const dt = Math.min(rawDt, 0.05)

  if (state === 'play') {
    player.update(dt, input)
    player.syncCamera()
    interaction.update()
  } else if (state === 'menu') {
    orbitCamera(dt)
  }

  sky.update(dt, camera.getPosition())
  chunks.process(state === 'play' ? 1 : 0)

  // 水下滤镜与雾
  if (player.eyeInWater !== wasUnderwater) {
    wasUnderwater = player.eyeInWater
    el.underwater.classList.toggle('on', wasUnderwater)
    if (wasUnderwater) {
      fog.color = new Color(0.12, 0.32, 0.55)
      fog.start = 2
      fog.end = 26
    } else {
      fog.color = new Color(0.86, 0.93, 0.97)
      fog.start = FOG_START
      fog.end = FOG_END
    }
  }

  // 提示文字淡出
  if (labelTimer > 0) {
    labelTimer -= dt
    if (labelTimer <= 0) el.blockLabel.classList.remove('show')
  }

  // HUD
  fpsAccum += dt
  fpsFrames++
  hudTimer += dt
  if (hudTimer > 0.25) {
    const fps = Math.round(fpsFrames / Math.max(fpsAccum, 0.0001))
    el.statFps.textContent = String(fps)
    const p = player.position
    el.statPos.textContent = `${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`
    el.statChunk.textContent = `${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}`
    el.statMode.textContent = player.flying ? '飞行' : player.onGround ? '步行' : '下落'
    fpsAccum = 0
    fpsFrames = 0
    hudTimer = 0
  }
})

/* ------------------------------------------------------------ 启动 */

buildHotbar()
app.start()
loadWorld(2026).then(() => {
  state = 'menu'
  showScreen('menu')
})

// 方便在控制台里调试
window.__world = world
window.__app = app
window.__player = player
window.__atlas = atlas
window.__chunks = chunks
window.__interaction = interaction
