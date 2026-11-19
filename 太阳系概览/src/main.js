import * as THREE from 'three'
import './style.css'
import { BODIES, BODY_MAP } from './data/bodies.js'
import { createSolarSystem } from './scene/solarSystem.js'
import { CameraRig } from './scene/cameraRig.js'
import { initIntro } from './intro.js'
import { renderCatalog, buildLabels, updateLabels, renderPanel } from './ui/catalog.js'

const pad2 = (n) => String(n).padStart(2, '0')
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

const state = {
  selected: null,
  focused: false,
  paused: reduceQuery.matches,
  spin: true,
  orbit: true,
  orbits: true,
  labels: true,
  speed: 0.38,
  reduced: reduceQuery.matches,
  simDays: 0,
  speedFactor: 1,
}

const stage = document.getElementById('stage')
const canvas = document.getElementById('scene')
const labelLayer = document.getElementById('label-layer')
const catalogEl = document.getElementById('catalog')
const panel = document.getElementById('panel')
const settings = document.getElementById('settings')
const viewBar = document.getElementById('view-bar')
const toastEl = document.getElementById('toast')
const heroIndex = document.getElementById('hero-index')
const dockIndex = document.getElementById('dock-index')
const clockEl = document.getElementById('clock-sim')

let world = null
let camera = null
let renderer = null
let rig = null
let labels = null
let raycaster = new THREE.Raycaster()
let pointerNdc = new THREE.Vector2()
let started = false
let bootEl = null
let toastTimer = 0
let clockTimer = 0

// ---------- 视图机位 ----------

const VIEWS = [
  { id: 'lit', label: '受光面', en: 'DAY' },
  { id: 'terminator', label: '晨昏线', en: 'TERMINATOR' },
  { id: 'polar', label: '极区', en: 'POLAR' },
  { id: 'night', label: '夜侧', en: 'NIGHT' },
  { id: 'detail', label: '细节', en: 'DETAIL' },
]

const VIEW_HINTS = {
  lit: '受光面：正对太阳的一侧，表面细节最清楚',
  terminator: '晨昏线：昼夜交界，最适合看地形起伏与阴影',
  polar: '极区：俯视自转轴，观察轴倾角与极冠',
  night: '夜侧：背光面，只能靠环境光辨认轮廓',
  detail: '细节：贴近表面，看云层、环缝或撞击坑',
}

function fitDistance(base) {
  const aspect = camera?.aspect || 1
  if (aspect >= 1) return base
  return base * (1 + (1 - aspect) * 2.2)
}

function overviewRadius() {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight)
  return aspect < 1 ? 71 * (1 + (1 - aspect) * 1.15) : 71
}

function setCameraView(preset) {
  if (!world || !state.selected) return
  const data = BODY_MAP.get(state.selected)
  const worldPos = world.getWorldPosition(state.selected)
  const sunDir = worldPos.clone().setY(0)
  if (sunDir.lengthSq() < 1e-5) sunDir.set(0, 0, 1)
  sunDir.normalize()
  const sideDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize()
  const base = fitDistance(data.lookAt?.distance ?? Math.max(2.4, data.displayRadius * 4))

  let dir = sunDir.clone()
  let phi = 1.06
  let dist = base

  if (preset === 'terminator') {
    dir = sideDir.clone()
    phi = 1.0
  } else if (preset === 'night') {
    dir = sunDir.clone().negate()
    phi = 1.12
  } else if (preset === 'polar') {
    phi = 0.16
    dist = base * 1.5
  } else if (preset === 'detail') {
    dir = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(38))
    phi = 1.28
    dist = fitDistance(Math.max(1.4, data.displayRadius * 3.6))
  }

  const theta = Math.atan2(dir.x, dir.z)
  rig.setView(theta, phi, dist)
  state.view = preset
  showToast(VIEW_HINTS[preset] || '')
  syncUI()
}

// ---------- 选择与导航 ----------

function selectBody(id, { focus = true, silent = false } = {}) {
  const data = BODY_MAP.get(id)
  if (!data || !world) return
  state.selected = id
  state.focused = focus
  if (focus) {
    rig.follow(id)
    rig.goalTarget.copy(world.getWorldPosition(id))
    rig.setView(rig.goal.theta, rig.goal.phi, fitDistance(data.lookAt?.distance ?? 4))
    // 用当前天体方向计算受光面机位
    const pos = world.getWorldPosition(id).setY(0)
    const theta = pos.lengthSq() > 1e-5 ? Math.atan2(pos.x, pos.z) : rig.current.theta
    rig.setView(theta, data.lookAt?.phi ?? 1.08, fitDistance(data.lookAt?.distance ?? 4))
    state.view = 'lit'
  }
  renderPanel(panel, data)
  openPanel(true)
  settings.hidden = true
  if (!silent) showToast(`${data.name} · ${data.en}　—　拖动可随时接管镜头`)
  syncUI()
}

function overview({ silent = false } = {}) {
  if (!rig) return
  state.focused = false
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight)
  rig.overview(new THREE.Vector3(0, 0, 0), overviewRadius(), 0.86, aspect < 1 ? 0.8 : 0.94)
  openPanel(false)
  settings.hidden = true
  if (!silent) showToast('总览视角 · 点击任意天体开始观察')
  syncUI()
}

function stepBody(delta) {
  let i = state.selected ? BODIES.findIndex((b) => b.id === state.selected) : -1
  if (i === -1) {
    i = delta > 0 ? 0 : BODIES.length - 1
  } else {
    i = (i + delta + BODIES.length) % BODIES.length
  }
  selectBody(BODIES[i].id)
}

function openPanel(open) {
  panel.hidden = !open
  document.body.classList.toggle('has-panel', open)
}

// ---------- 状态同步 ----------

function syncUI() {
  document.querySelectorAll('.cat-item').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.id === state.selected))
  })
  const data = state.selected ? BODY_MAP.get(state.selected) : null
  heroIndex.textContent = data ? pad2(data.index) : '--'
  dockIndex.textContent = data ? pad2(data.index) : '--'

  const pauseBtn = document.getElementById('btn-pause')
  pauseBtn.setAttribute('aria-pressed', String(state.paused))
  pauseBtn.querySelector('.dock-ico').textContent = state.paused ? '▶' : '❚❚'
  document.getElementById('pause-label').textContent = state.paused ? '继续' : '暂停'

  setPressed('btn-spin', state.spin)
  setPressed('btn-orbit', state.orbit)
  setPressed('btn-orbits', state.orbits)

  document.getElementById('toggle-spin').checked = state.spin
  document.getElementById('toggle-orbit').checked = state.orbit
  document.getElementById('toggle-orbits').checked = state.orbits
  document.getElementById('toggle-labels').checked = state.labels
  document.getElementById('toggle-motion').checked = state.reduced

  viewBar.hidden = !(state.focused && state.selected)
  document.querySelectorAll('.view-chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.view === state.view))
  })
}

function setPressed(id, value) {
  document.getElementById(id).setAttribute('aria-pressed', String(value))
}

function showToast(text) {
  if (!text) return
  toastEl.textContent = text
  toastEl.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 2400)
}

// ---------- 控制 ----------

function setPaused(value) {
  state.paused = value
  syncUI()
}

function toggleSetting(key) {
  state[key] = !state[key]
  if (key === 'orbits' && world) world.setOrbitLines(state.orbits)
  if (key === 'labels' && labelLayer) labelLayer.classList.toggle('is-off', !state.labels)
  if (key === 'reduced') {
    document.documentElement.classList.toggle('reduce-motion', state.reduced)
    if (state.reduced) setPaused(true)
  }
  syncUI()
}

function bindUI() {
  document.getElementById('btn-pause').addEventListener('click', () => setPaused(!state.paused))
  document.getElementById('btn-spin').addEventListener('click', () => toggleSetting('spin'))
  document.getElementById('btn-orbit').addEventListener('click', () => toggleSetting('orbit'))
  document.getElementById('btn-orbits').addEventListener('click', () => toggleSetting('orbits'))
  document.getElementById('btn-reset').addEventListener('click', () => overview())
  document.getElementById('btn-prev').addEventListener('click', () => stepBody(-1))
  document.getElementById('btn-next').addEventListener('click', () => stepBody(1))
  document.getElementById('panel-close').addEventListener('click', () => openPanel(false))
  document.getElementById('settings-close').addEventListener('click', () => {
    settings.hidden = true
  })

  document.getElementById('speed').addEventListener('input', (e) => {
    state.speed = Number(e.target.value) / 100
  })

  for (const key of ['spin', 'orbit', 'orbits', 'labels', 'motion']) {
    const el = document.getElementById(`toggle-${key}`)
    el.addEventListener('change', () => {
      if (key === 'motion') toggleSetting('reduced')
      else toggleSetting(key)
    })
  }

  document.querySelector('.topnav [data-act="overview"]').addEventListener('click', () => overview())
  document.querySelector('.topnav [data-act="body"]').addEventListener('click', () => {
    if (state.selected) openPanel(true)
    else stepBody(1)
  })
  document.querySelector('.topnav [data-act="settings"]').addEventListener('click', () => {
    settings.hidden = !settings.hidden
    if (!settings.hidden) openPanel(false)
  })

  // 机位按钮
  const makeChip = (view, className) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = className
    btn.dataset.view = view.id
    btn.setAttribute('aria-pressed', 'false')
    btn.innerHTML = `${view.label}<em>${view.en}</em>`
    btn.addEventListener('click', () => setCameraView(view.id))
    return btn
  }
  for (const view of VIEWS) viewBar.appendChild(makeChip(view, 'view-chip'))
  const settingsViews = document.getElementById('settings-views')
  for (const view of VIEWS) settingsViews.appendChild(makeChip(view, 'chip'))

  canvas.addEventListener('pointerdown', (e) => {
    canvas.dataset.downX = String(e.clientX)
    canvas.dataset.downY = String(e.clientY)
  })
  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - Number(canvas.dataset.downX || e.clientX)
    const dy = e.clientY - Number(canvas.dataset.downY || e.clientY)
    if (Math.hypot(dx, dy) > 7) return
    pickAt(e.clientX, e.clientY)
  })

  // 键盘
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (!started) return
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        stepBody(1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        stepBody(-1)
        break
      case ' ':
        e.preventDefault()
        setPaused(!state.paused)
        break
      case 'Escape':
        if (!settings.hidden) settings.hidden = true
        else if (!panel.hidden) openPanel(false)
        else overview()
        break
      case 'l':
      case 'L':
        toggleSetting('labels')
        break
      case 'o':
      case 'O':
        toggleSetting('orbits')
        break
      case 'r':
      case 'R':
        overview()
        break
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        selectBody(BODIES[Number(e.key) - 1].id)
        break
      case '0':
        selectBody(BODIES[9].id)
        break
      default:
    }
  })

  // 尺寸
  window.addEventListener('resize', onResize)
  reduceQuery.addEventListener?.('change', (e) => {
    state.reduced = e.matches
    document.documentElement.classList.toggle('reduce-motion', state.reduced)
    if (state.reduced) setPaused(true)
    syncUI()
  })
}

function pickAt(clientX, clientY) {
  if (!renderer) return
  const rect = canvas.getBoundingClientRect()
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointerNdc, camera)
  const hits = raycaster.intersectObjects(world.pickables, false)
  if (hits.length > 0) {
    selectBody(hits[0].object.userData.bodyId)
  } else if (state.focused) {
    overview()
  }
}

function onResize() {
  if (!renderer || !camera) return
  const w = stage.clientWidth
  const h = stage.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  camera.userData.width = w
  camera.userData.height = h
  renderer.setSize(w, h, false)
  if (rig && !state.focused) rig.goal.radius = overviewRadius()
}

// ---------- 启动 ----------

function boot() {
  if (started) return
  started = true
  stage.hidden = false
  bootEl = document.createElement('div')
  bootEl.className = 'boot'
  bootEl.innerHTML = '<span class="boot-mark"></span>正在生成天体表面 · GENERATING SURFACES'
  stage.appendChild(bootEl)

  // 让开场淡出先绘制一帧，再做纹理生成
  requestAnimationFrame(() => {
    window.setTimeout(startScene, 40)
  })
}

function startScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000)
  world = createSolarSystem()
  rig = new CameraRig(camera, canvas)
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight)
  rig.overview(new THREE.Vector3(0, 0, 0), overviewRadius(), 0.86, aspect < 1 ? 0.8 : 0.94)
  rig.current.radius = 92
  rig.current.theta = 0.7
  rig.current.phi = 0.9

  onResize()
  labels = buildLabels(labelLayer, (id) => selectBody(id))
  renderCatalog(catalogEl, (id) => selectBody(id))
  bindUI()
  document.documentElement.classList.toggle('reduce-motion', state.reduced)
  syncUI()

  bootEl?.classList.add('is-done')
  window.setTimeout(() => bootEl?.remove(), 500)

  const followPos = new THREE.Vector3()
  let last = performance.now()
  let clockAcc = 0

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    state.speedFactor = state.paused ? 0 : 0.3 + state.speed * 2.7

    world.update(dt, state.speedFactor, { orbit: state.orbit, spin: state.spin })
    world.pulseSun(now / 1000)
    if (state.selected) world.getWorldPosition(state.selected, followPos)
    rig.update(dt, followPos)
    updateLabels(labels, camera, world, state.selected, state.labels)

    if (state.speedFactor > 0) {
      state.simDays += (dt * state.speedFactor) / 11
    }
    clockAcc += dt
    if (clockAcc > 0.25) {
      clockAcc = 0
      const whole = Math.floor(state.simDays)
      const frac = (state.simDays - whole).toFixed(1).slice(1)
      clockEl.textContent = `模拟 ${String(whole).padStart(3, '0')}${frac} 日`
    }

    renderer.render(world.scene, camera)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // 入场：从稍远处轻微推进（尊重减少动态设置）
  if (!state.reduced) {
    rig.goal.radius = overviewRadius() * 1.18
    window.setTimeout(() => {
      rig.goal.radius = overviewRadius()
    }, 600)
  }
}

initIntro(boot)
