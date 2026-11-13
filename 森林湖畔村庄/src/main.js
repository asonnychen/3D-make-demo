/* ============================================================
   Lac des Fleurs · 森林湖畔村庄
   入口：渲染器、场景搭建、俯瞰 / 步行两种模式与界面联动
   ============================================================ */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './style.css'

import { LOCATIONS } from './config.js'
import { createTerrain, createShoreRocks, groundHeight } from './terrain.js'
import { createWater } from './water.js'
import { createTrees, createBushes, createFlowers, createGrass, updateWind } from './vegetation.js'
import { createVillage } from './village.js'
import { createRuin } from './ruin.js'
import { createSky, SUN_DIR } from './sky.js'
import { Player } from './player.js'
import { Ambience } from './audio.js'

/* ------------------------------------------------------------ 渲染器 */

const canvas = document.querySelector('#scene')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.02
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc8d2c0, 0.0052)

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1200)
camera.position.set(0, 46, 84)
camera.rotation.order = 'YXZ'

/* ------------------------------------------------------------ 灯光 */

const hemi = new THREE.HemisphereLight(0xdbe8d9, 0x4a5a3b, 1.05)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xfff2d8, 2.35)
sun.position.copy(SUN_DIR).multiplyScalar(140)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -96
sun.shadow.camera.right = 96
sun.shadow.camera.top = 96
sun.shadow.camera.bottom = -96
sun.shadow.camera.near = 1
sun.shadow.camera.far = 340
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
scene.add(sun)
scene.add(sun.target)

const fill = new THREE.DirectionalLight(0xbfd6c6, 0.55)
fill.position.set(-70, 40, -80)
scene.add(fill)

/* ------------------------------------------------------------ 场景内容 */

const sky = createSky(scene)
createTerrain(scene)
createShoreRocks(scene)

const waterQuality = window.devicePixelRatio > 1.5 ? 0.85 : 1
const water = createWater(scene, waterQuality)

// 花朵、草叶与芦苇不参与湖面倒影，省下大量三角形
const reflectionCam = water.mesh.getReflectionCamera(camera)
reflectionCam.layers.disable(2)
camera.layers.enable(2)

createTrees(scene)
createBushes(scene)
const flowers = createFlowers(scene)
const grass = createGrass(scene)
flowers.layers.set(2)
grass.layers.set(2)
water.reeds.layers.set(2)
water.lilies.traverse((o) => o.layers.set(2))

const village = createVillage(scene)
const ruin = createRuin(scene)

const obstacles = [...village.obstacles, ruin.obstacle]

/* ------------------------------------------------------------ 相机控制 */

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 2, 0)
controls.enableDamping = true
controls.dampingFactor = 0.07
controls.enablePan = false
controls.minDistance = 22
controls.maxDistance = 180
controls.minPolarAngle = 0.18
controls.maxPolarAngle = 1.44
controls.autoRotate = true
controls.autoRotateSpeed = 0.22
controls.addEventListener('start', () => {
  controls.autoRotate = false
})

const player = new Player(camera, { obstacles, walkables: village.walkables })
player.attach(canvas)

/* ------------------------------------------------------------ UI 元素 */

const $ = (id) => document.getElementById(id)
const fade = $('fade')
const loader = $('loader')
const titlePanel = $('title-panel')
const infoCard = $('info-card')
const pauseEl = $('pause')
const markersEl = $('markers')
const walkPlace = $('walk-place')
const walkPlaceName = $('walk-place-name')

const soundButtons = [$('btn-sound'), $('btn-pause-sound')]
const ambience = new Ambience()
let soundOn = false
let soundTouched = false

function setSound(on) {
  soundOn = on
  ambience.setEnabled(on)
  const label = on ? '声音：开' : '声音：关'
  $('sound-label').textContent = label
  $('btn-sound').setAttribute('aria-pressed', String(on))
  $('btn-pause-sound').textContent = label
}

soundButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    soundTouched = true
    setSound(!soundOn)
  })
)

$('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen().catch(() => {})
})

$('btn-collapse').addEventListener('click', () => {
  titlePanel.classList.toggle('collapsed')
})

/* ------------------------------------------------------------ 地点标记 */

const markerEls = new Map()
const markerHeight = new Map()

for (const loc of LOCATIONS) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'marker'
  el.innerHTML = `<span class="pin"></span><span class="label"><b>${loc.name}</b><small>${loc.en}</small></span>`
  el.addEventListener('click', () => selectLocation(loc, true))
  markersEl.appendChild(el)
  markerEls.set(loc.id, el)
  const h =
    loc.id === 'ruin'
      ? ruin.top + 2.2
      : Math.max(groundHeight(loc.at[0], loc.at[1]), 0.9) + 2.6
  markerHeight.set(loc.id, h)
}

const projected = new THREE.Vector3()

function updateMarkers() {
  if (mode !== 'overview') return
  camera.updateMatrixWorld()
  const w = window.innerWidth
  const h = window.innerHeight
  for (const loc of LOCATIONS) {
    const el = markerEls.get(loc.id)
    projected.set(loc.at[0], markerHeight.get(loc.id), loc.at[1]).project(camera)
    const visible = projected.z < 1 && projected.z > -1
    const x = (projected.x * 0.5 + 0.5) * w
    const y = (-projected.y * 0.5 + 0.5) * h
    if (!visible || x < -80 || x > w + 80 || y < -40 || y > h + 40) {
      el.style.display = 'none'
      continue
    }
    el.style.display = 'flex'
    el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }
}

/* ------------------------------------------------------------ 信息卡与聚焦 */

let activeLocation = null

function selectLocation(loc, fly = false) {
  activeLocation = loc
  for (const [id, el] of markerEls) el.classList.toggle('is-active', id === loc.id)
  $('info-name').textContent = loc.name
  $('info-en').textContent = loc.en
  $('info-desc').textContent = loc.desc
  const goto = $('info-goto')
  if (loc.walk) {
    goto.disabled = false
    goto.textContent = '步行前往'
  } else {
    goto.disabled = true
    goto.textContent = '需划船前往'
  }
  infoCard.classList.remove('is-hidden')
  if (fly && mode === 'overview') flyTo(loc)
}

function closeInfo() {
  infoCard.classList.add('is-hidden')
  activeLocation = null
  for (const el of markerEls.values()) el.classList.remove('is-active')
}

$('info-close').addEventListener('click', closeInfo)
$('info-goto').addEventListener('click', () => {
  if (activeLocation && activeLocation.walk) enterWalk(activeLocation)
})
$('info-overview').addEventListener('click', () => {
  if (activeLocation) {
    if (mode === 'walk') enterOverview(activeLocation)
    else flyTo(activeLocation)
  }
})

/* ------------------------------------------------------------ 相机飞行动画 */

let camAnim = null
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function startCamAnim(toPos, toTarget) {
  camAnim = {
    t: 0,
    fromPos: camera.position.clone(),
    toPos: toPos.clone(),
    fromTarget: controls.target.clone(),
    toTarget: toTarget.clone(),
  }
  controls.enabled = false
  controls.autoRotate = false
}

function flyTo(loc) {
  const target = new THREE.Vector3(loc.at[0], 2.2, loc.at[1])
  const outward = new THREE.Vector3(loc.at[0], 0, loc.at[1])
  if (outward.length() < 3) outward.set(0, 0, 1)
  outward.normalize()
  const pos = target.clone().add(outward.multiplyScalar(38))
  pos.y = 30
  startCamAnim(pos, target)
}

/* ------------------------------------------------------------ 模式切换 */

let mode = 'overview'
let switching = false
let paused = false
let hadLock = false
const savedOverview = {
  pos: camera.position.clone(),
  target: controls.target.clone(),
}

function transition(fn) {
  if (switching) return
  switching = true
  fade.classList.add('on')
  setTimeout(() => {
    fn()
    requestAnimationFrame(() => {
      fade.classList.remove('on')
      setTimeout(() => {
        switching = false
      }, 420)
    })
  }, 360)
}

function enterWalk(loc = null) {
  if (mode === 'walk' && !paused) {
    if (loc && loc.walk) {
      player.teleport(loc.walk[0], loc.walk[1], Math.atan2(loc.walk[0], loc.walk[1]))
      player.lock()
    }
    return
  }
  // 保留俯瞰视角
  savedOverview.pos.copy(camera.position)
  savedOverview.target.copy(controls.target)

  // 必须在用户手势中请求指针锁定
  player.lock()
  if (!soundOn && !soundTouched) setSound(true)

  transition(() => {
    hidePause()
    closeInfo()
    mode = 'walk'
    document.body.dataset.mode = 'walk'
    camera.fov = 68
    camera.updateProjectionMatrix()
    controls.enabled = false
    controls.autoRotate = false
    camAnim = null

    let wx = 3.2
    let wz = 34.2
    if (loc && loc.walk) {
      wx = loc.walk[0]
      wz = loc.walk[1]
    }
    player.teleport(wx, wz, Math.atan2(wx, wz))
    player.enable()
    hadLock = player.locked
    showPlace(loc ? loc.name : '湖畔广场')
  })
}

function enterOverview(focus = null) {
  transition(() => {
    hidePause()
    player.disable()
    mode = 'overview'
    document.body.dataset.mode = 'overview'
    camera.fov = 46
    camera.updateProjectionMatrix()
    controls.enabled = true
    controls.autoRotate = !focus
    camera.position.copy(savedOverview.pos)
    controls.target.copy(savedOverview.target)
    controls.update()
    if (focus) {
      selectLocation(focus, false)
      flyTo(focus)
    }
  })
}

$('btn-walk').addEventListener('click', () => enterWalk(activeLocation && activeLocation.walk ? activeLocation : null))
$('btn-overview').addEventListener('click', () => {
  if (mode === 'walk') enterOverview()
  else {
    controls.autoRotate = true
    controls.enabled = true
  }
})
$('btn-exit').addEventListener('click', () => enterOverview())

/* ------------------------------------------------------------ 暂停 */

function showPause() {
  if (paused) return
  paused = true
  player.enabled = false
  player.keys.clear()
  player.velocity.set(0, 0, 0)
  pauseEl.classList.remove('is-hidden')
}

function hidePause() {
  paused = false
  pauseEl.classList.add('is-hidden')
}

$('btn-resume').addEventListener('click', () => {
  if (mode !== 'walk') return
  hidePause()
  player.enabled = true
  player.lock()
  hadLock = true
})

$('btn-pause-overview').addEventListener('click', () => enterOverview())

player.onLockChange = (locked) => {
  if (locked) {
    hadLock = true
    return
  }
  if (hadLock && mode === 'walk' && !switching) {
    hadLock = false
    showPause()
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && mode === 'walk' && !paused) {
    // 浏览器已处理指针解锁时，这里兜底
    if (!player.locked) showPause()
  }
})

/* ------------------------------------------------------------ 步行地点提示 */

let placeTimer = null
function showPlace(name) {
  walkPlaceName.textContent = name
  walkPlace.classList.add('on')
  clearTimeout(placeTimer)
  placeTimer = setTimeout(() => walkPlace.classList.remove('on'), 3200)
}

let lastPlaceId = null
function updateNearestPlace() {
  if (mode !== 'walk') {
    lastPlaceId = null
    return
  }
  let best = null
  let bestDist = 13
  for (const loc of LOCATIONS) {
    const d = Math.hypot(player.position.x - loc.at[0], player.position.z - loc.at[1])
    if (d < bestDist) {
      bestDist = d
      best = loc
    }
  }
  if (best && best.id !== lastPlaceId) {
    lastPlaceId = best.id
    showPlace(best.name)
  }
  if (!best) lastPlaceId = null
}

/* ------------------------------------------------------------ 自适应 */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
})

/* ------------------------------------------------------------ 主循环 */

const clockStart = performance.now()
let lastFrame = clockStart
let elapsedTime = 0

function animate(now = performance.now()) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now
  elapsedTime += dt
  const t = elapsedTime

  updateWind(t)
  water.update(t)
  sky.birds.update(t)

  if (mode === 'walk' && !paused) {
    player.update(dt)
  }

  if (mode === 'overview') {
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / 1.15)
      const k = easeInOut(camAnim.t)
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k)
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k)
      if (camAnim.t >= 1) {
        camAnim = null
        controls.enabled = true
      }
    }
    controls.update()
    updateMarkers()
  } else {
    updateNearestPlace()
  }

  renderer.render(scene, camera)
}

/* ------------------------------------------------------------ 启动 */

animate()

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    loader.classList.add('done')
    setTimeout(() => loader.remove(), 1200)
  })
})

/* 调试入口 */
window.__lac = {
  scene,
  camera,
  renderer,
  player,
  village,
  ruin,
  controls,
  get mode() {
    return mode
  },
  setMode: (m) => (m === 'walk' ? enterWalk() : enterOverview()),
  flyTo: (id) => {
    const loc = LOCATIONS.find((l) => l.id === id)
    if (loc) selectLocation(loc, true)
  },
}
