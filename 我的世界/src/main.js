/* ============================================================
   我的世界 · 入口
   PlayCanvas 应用、区块渲染、背包 / 工具 / 武器、怪物与界面联动
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
  ADDRESS_CLAMP_TO_EDGE,
  ADDRESS_REPEAT,
  FILTER_NEAREST,
  FILTER_NEAREST_MIPMAP_LINEAR,
  BLEND_NORMAL,
  Vec2,
  Mesh,
  MeshInstance,
} from 'playcanvas'
import './style.css'

import { FOG_START, FOG_END, SEA_LEVEL, WORLD_X, WORLD_Z } from './config.js'
import { createAtlas, extractTile, TILE_PX } from './textures.js'
import { ITEMS, STARTER_KIT, attackDamage } from './items.js'
import { createIcons } from './icons.js'
import { Inventory, InventoryUI } from './inventory.js'
import { World } from './world.js'
import { ChunkRenderer } from './chunks.js'
import { createSky } from './sky.js'
import { Player } from './player.js'
import { Interaction, createSelectionBox } from './interaction.js'
import { MobManager } from './mobs.js'
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
const icons = createIcons(atlas)
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

/* ------------------------------------------------------------ 背包 */

const inventory = new Inventory()
const interaction = new Interaction(app, world, player, selection, inventory)

/* ------------------------------------------------------------ 界面元素 */

const el = {
  body: document.body,
  menu: document.querySelector('#menu'),
  pause: document.querySelector('#pause'),
  help: document.querySelector('#help'),
  death: document.querySelector('#death'),
  loading: document.querySelector('#loading'),
  loadingBar: document.querySelector('#loading-bar'),
  loadingPct: document.querySelector('#loading-pct'),
  loadingNote: document.querySelector('#loading-note'),
  seed: document.querySelector('#seed'),
  hotbar: document.querySelector('#hotbar'),
  hearts: document.querySelector('#hearts'),
  blockLabel: document.querySelector('#block-label'),
  statFps: document.querySelector('#stat-fps'),
  statPos: document.querySelector('#stat-pos'),
  statChunk: document.querySelector('#stat-chunk'),
  statMode: document.querySelector('#stat-mode'),
  statMobs: document.querySelector('#stat-mobs'),
  underwater: document.querySelector('#underwater'),
  damage: document.querySelector('#damage'),
  mineBar: document.querySelector('#mine-bar'),
  toast: document.querySelector('#toast'),
  btnFly: document.querySelector('#btn-fly'),
  btnHelp: document.querySelector('#btn-help'),
  inventory: document.querySelector('#inventory'),
  invStorage: document.querySelector('#inv-storage'),
  invHotbar: document.querySelector('#inv-hotbar'),
  recipeList: document.querySelector('#recipe-list'),
  invHint: document.querySelector('#inv-hint'),
  invDrag: document.querySelector('#inv-drag'),
  craftHint: document.querySelector('#craft-hint'),
}

/* ------------------------------------------------------------ 状态 */

let state = 'loading' // loading | menu | play | paused | help | inventory | dead
let orbitAngle = 0
let spawnPoint = { x: 64, y: 40, z: 64 }
let labelTimer = 0
let damageFlash = 0
let toastTimer = 0
let attackCooldown = 0
let swingT = 0
let lastHeldId
let startHintShown = false

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

function showScreen(name) {
  el.menu.classList.toggle('hidden', name !== 'menu')
  el.pause.classList.toggle('hidden', name !== 'paused')
  el.help.classList.toggle('hidden', name !== 'help')
  el.death.classList.toggle('hidden', name !== 'dead')
  el.loading.classList.toggle('hidden', name !== 'loading')
}

/* ------------------------------------------------------------ 背包界面 */

let ui = null

function announceItem() {
  const stack = inventory.get(ui?.activeSlot ?? 0)
  const item = stack ? ITEMS.get(stack.id) : null
  el.blockLabel.textContent = item ? item.cn : '空手'
  el.blockLabel.classList.add('show')
  labelTimer = 1.6
}

function handleSelect(index) {
  interaction.activeSlot = index
  interaction.progress = 0
  syncHeld()
  announceItem()
}

ui = new InventoryUI({
  inventory,
  icons,
  el,
  onSelect: handleSelect,
})

inventory.onChange(() => syncHeld())

/* ------------------------------------------------------------ 手持物品 */

const heldTextures = new Map()

const heldEntity = new Entity('held-item')
heldEntity.addComponent('render', { meshInstances: [] })
camera.addChild(heldEntity)
heldEntity.setLocalScale(0.19, 0.19, 0.19)
heldEntity.enabled = false

const heldMaterial = new StandardMaterial()
heldMaterial.useLighting = false
heldMaterial.useFog = false
heldMaterial.diffuse = new Color(1, 1, 1)
heldMaterial.ambient = new Color(1, 1, 1)
heldMaterial.blendType = BLEND_NORMAL
heldMaterial.depthWrite = false
heldMaterial.alphaTest = 0.25
heldMaterial.update()

function createHeldQuad() {
  const mesh = new Mesh(device)
  mesh.setPositions(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]))
  mesh.setNormals(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]))
  mesh.setUvs(0, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
  mesh.setIndices(new Uint32Array([0, 1, 2, 0, 2, 3]))
  mesh.update()
  return new MeshInstance(mesh, heldMaterial)
}

heldEntity.render.meshInstances = [createHeldQuad()]

function heldTexture(itemId) {
  if (heldTextures.has(itemId)) return heldTextures.get(itemId)
  const source = icons.itemCanvas(itemId)
  if (!source) return null
  const texture = new Texture(device, {
    width: source.width,
    height: source.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
  })
  texture.setSource(source)
  heldTextures.set(itemId, texture)
  return texture
}

function syncHeld() {
  const stack = inventory.get(ui.activeSlot)
  const id = stack?.id ?? null
  if (id === lastHeldId) return
  lastHeldId = id

  if (!id) {
    heldEntity.enabled = false
    return
  }
  const texture = heldTexture(id)
  if (!texture) {
    heldEntity.enabled = false
    return
  }
  heldMaterial.diffuseMap = texture
  heldMaterial.opacityMap = texture
  heldMaterial.opacityMapChannel = 'a'
  heldMaterial.update()
  heldEntity.enabled = true
}

function swing() {
  swingT = 1
}

function updateHeld(dt) {
  if (swingT > 0) swingT = Math.max(0, swingT - dt / 0.28)
  const k = swingT > 0 ? Math.sin((1 - swingT) * Math.PI) : 0
  heldEntity.setLocalPosition(0.3 - 0.1 * k, -0.23 - 0.1 * k, -0.62 + 0.06 * k)
  heldEntity.setLocalEulerAngles(-4 - 34 * k, -20 + 14 * k, 4 - 48 * k)
}

interaction.onSwing = swing

/* ------------------------------------------------------------ 怪物 */

const mobs = new MobManager(app, world, player)

mobs.onDeath = () => {
  const loot = [{ id: 'rotten_flesh', count: 1 + Math.floor(Math.random() * 2) }]
  if (Math.random() < 0.3) loot.push({ id: 'coal', count: 1 })
  if (Math.random() < 0.12) loot.push({ id: 'iron_ingot', count: 1 })

  for (const entry of loot) {
    const left = inventory.add(entry.id, entry.count)
    if (left === 0) {
      const item = ITEMS.get(entry.id)
      showToast(`获得 ${item?.cn ?? entry.id} ×${entry.count}`)
    }
  }
  player.heal(1)
}

/* ------------------------------------------------------------ 生命值界面 */

const HEART_PIXELS = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]

function heartURL(mode) {
  const cols = 7
  const rows = HEART_PIXELS.length
  const canvasEl = document.createElement('canvas')
  canvasEl.width = cols
  canvasEl.height = rows
  const ctx = canvasEl.getContext('2d')
  const full = '#d84a3f'
  const empty = '#2a2a2a'
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (HEART_PIXELS[y][x] !== '#') continue
      const isFull = mode === 'full' || (mode === 'half' && x < cols / 2)
      ctx.fillStyle = isFull ? full : empty
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return canvasEl.toDataURL()
}

const heartCache = { full: heartURL('full'), half: heartURL('half'), empty: heartURL('empty') }
let lastHealthShown = -1

function renderHearts() {
  if (player.health === lastHealthShown) return
  lastHealthShown = player.health
  const total = Math.ceil(player.maxHealth / 2)
  let html = ''
  for (let i = 0; i < total; i++) {
    const hp = player.health - i * 2
    const mode = hp >= 2 ? 'full' : hp >= 1 ? 'half' : 'empty'
    html += `<img class="heart" src="${heartCache[mode]}" alt="" />`
  }
  el.hearts.innerHTML = html
}

/* ------------------------------------------------------------ 提示 */

function showToast(text) {
  el.toast.textContent = text
  el.toast.classList.add('show')
  toastTimer = 1.8
}

interaction.onPickup = (itemId, count, ok) => {
  const item = ITEMS.get(itemId)
  if (!ok) {
    showToast('背包已满')
    return
  }
  showToast(`获得 ${item?.cn ?? itemId} ×${count}`)
}

interaction.onToolBreak = (item) => {
  showToast(`${item.cn} 用坏了`)
}

player.onHurt = () => {
  damageFlash = 0.4
  el.damage.classList.add('on')
}

player.onDeath = () => {
  state = 'dead'
  showScreen('dead')
  el.body.classList.remove('playing')
  mouse.disablePointerLock()
  clearInput()
  interaction.endMine()
  ui.closePanel()
}

/* ------------------------------------------------------------ 加载世界 */

async function loadWorld(seed) {
  state = 'loading'
  el.body.classList.remove('playing')
  showScreen('loading')
  el.loadingBar.style.width = '0%'
  el.loadingPct.textContent = '0%'
  el.loadingNote.textContent = '隆起丘陵 · 埋下矿脉 · 种下橡树'
  await nextFrame()

  chunks.detachEntities()
  mobs.reset()
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
  player.revive()
  lastHealthShown = -1
  renderHearts()
  interaction.update(0)
  mobs.spawn(3)
}

/* ------------------------------------------------------------ 开始 / 暂停 */

function startPlaying() {
  showScreen(null)
  state = 'play'
  el.body.classList.add('playing')
  mouse.enablePointerLock()
  if (!startHintShown) {
    startHintShown = true
    showToast('先徒手敲树取木板 · 按 E 打开背包合成工具')
  }
}

function pauseGame() {
  if (state !== 'play') return
  state = 'paused'
  showScreen('paused')
  el.body.classList.remove('playing')
  mouse.disablePointerLock()
  clearInput()
  interaction.endMine()
}

function resumeGame() {
  if (state === 'paused' || state === 'help' || state === 'inventory') {
    ui.closePanel()
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

function openInventory() {
  if (state !== 'play') return
  state = 'inventory'
  ui.openPanel()
  mouse.disablePointerLock()
  clearInput()
  interaction.endMine()
}

function closeInventory() {
  if (state !== 'inventory') return
  ui.closePanel()
  state = 'play'
  el.body.classList.add('playing')
  mouse.enablePointerLock()
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

/* ------------------------------------------------------------ 攻击 */

function tryAttack() {
  if (attackCooldown > 0) return false
  const origin = player.eyePosition
  const dir = player.getLookDirection()
  const hit = mobs.pick(origin, dir, 3.8)
  if (!hit) return false
  // 中间隔着方块就打不到
  if (interaction.target && interaction.target.distance < hit.distance) return false

  const mob = hit.mob
  const stack = inventory.get(ui.activeSlot)
  const item = stack ? ITEMS.get(stack.id) : null
  const damage = attackDamage(stack?.id ?? null)

  attackCooldown = 0.42
  swing()
  mob.hurt(damage, dir)
  if (item?.kind === 'weapon') interaction.useDurability(1)
  return true
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

  if (state === 'play' && key >= 49 && key <= 57) ui.select(key - 49)

  if (state === 'play') {
    if (code === 'KeyF') toggleFly()
    if (code === 'KeyH') toggleHelp()
    if (code === 'KeyE') openInventory()
  } else if (state === 'inventory') {
    if (code === 'KeyE' || code === 'Escape') closeInventory()
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
  if (event.button === 0) {
    // 先看准星前有没有怪物，有就打，没有就开始挖
    if (!tryAttack()) {
      interaction.beginMine()
      swing()
    }
  } else if (event.button === 2) {
    interaction.placeBlock()
  } else if (event.button === 1) {
    const slot = interaction.pickBlock()
    if (slot != null && slot >= 0) ui.select(slot)
  }
})

mouse.on('mouseup', (event) => {
  if (event.button === 0) interaction.endMine()
})

mouse.on('mousewheel', (event) => {
  if (state !== 'play') return
  ui.select(ui.activeSlot + (event.wheel > 0 ? 1 : -1))
})

mouse.disableContextMenu()

document.addEventListener('pointerlockchange', () => {
  if (state === 'play' && !Mouse.isPointerLocked()) pauseGame()
})

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape') return
  if (state === 'play') pauseGame()
  else if (state === 'help') resumeGame()
  else if (state === 'inventory') closeInventory()
})

/* ------------------------------------------------------------ 按钮 */

document.querySelector('#btn-start').addEventListener('click', () => startPlaying())
document.querySelector('#btn-resume').addEventListener('click', () => resumeGame())
document.querySelector('#btn-pause-fly').addEventListener('click', () => toggleFly())
document.querySelector('#btn-help-close').addEventListener('click', () => resumeGame())
document.querySelector('#btn-inv-close').addEventListener('click', () => closeInventory())
document.querySelector('#btn-bag').addEventListener('click', () => openInventory())
document.querySelector('#btn-respawn').addEventListener('click', () => {
  player.spawnAt(spawnPoint)
  player.revive()
  lastHealthShown = -1
  renderHearts()
  state = 'play'
  showScreen(null)
  el.body.classList.add('playing')
  mouse.enablePointerLock()
})
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
  ui.closePanel()
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
    interaction.update(dt)
    mobs.update(dt)
    attackCooldown = Math.max(0, attackCooldown - dt)
    updateHeld(dt)
  } else if (state === 'menu') {
    orbitCamera(dt)
    updateHeld(dt)
  } else {
    updateHeld(dt)
  }

  sky.update(dt, camera.getPosition())
  chunks.process(state === 'play' ? 1 : 0)
  ui.tick(dt)

  // 挖掘进度条
  const showMine = state === 'play' && interaction.progress > 0.001
  el.mineBar.classList.toggle('on', showMine)
  if (showMine) el.mineBar.firstElementChild.style.width = `${Math.min(100, interaction.progress * 100).toFixed(0)}%`

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

  // 受伤红屏淡出
  if (damageFlash > 0) {
    damageFlash -= dt
    if (damageFlash <= 0) el.damage.classList.remove('on')
  }

  // 提示文字淡出
  if (labelTimer > 0) {
    labelTimer -= dt
    if (labelTimer <= 0) el.blockLabel.classList.remove('show')
  }
  if (toastTimer > 0) {
    toastTimer -= dt
    if (toastTimer <= 0) el.toast.classList.remove('show')
  }

  // 生命值
  if (state === 'play' || state === 'dead') renderHearts()

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
    el.statMobs.textContent = String(mobs.aliveCount)
    fpsAccum = 0
    fpsFrames = 0
    hudTimer = 0
  }
})

/* ------------------------------------------------------------ 启动 */

// 初始物资（放在手持物品初始化之后，避免背包变更回调读到未初始化的变量）
for (const entry of STARTER_KIT) inventory.add(entry.id, entry.count)

syncHeld()
renderHearts()
const startStack = inventory.get(ui.activeSlot)
el.blockLabel.textContent = startStack ? (ITEMS.get(startStack.id)?.cn ?? '') : '空手'
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
window.__inventory = inventory
window.__ui = ui
window.__mobs = mobs
window.__items = ITEMS
