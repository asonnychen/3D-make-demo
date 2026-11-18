import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './style.css'
import { TrackSystem } from './track.js'
import { ParkScene } from './park.js'
import { TrainSimulator } from './train.js'
import { ParkAudio } from './audio.js'
import { TRACK_PRESETS } from './presets.js'

const sceneHost = document.querySelector('#scene')
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xb9d9dd, 0.0032)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
sceneHost.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 520)
camera.position.set(58, 50, 68)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.075
controls.minDistance = 18
controls.maxDistance = 145
controls.maxPolarAngle = Math.PI * 0.48
controls.target.set(0, 9, 0)

const park = new ParkScene(scene)
const track = new TrackSystem(scene, TRACK_PRESETS.classic)
const train = new TrainSimulator(scene, track)
const audio = new ParkAudio()

let cameraMode = 'first'
let isNight = false
let isEditing = false
let isSoundEnabled = false
let selectedControlIndex = 0
let dragState = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const dragPlane = new THREE.Plane()
const dragOffset = new THREE.Vector3()
const cameraTarget = new THREE.Vector3()
const cameraDummy = new THREE.Object3D()
const cameraQuaternion = new THREE.Quaternion()
const frameMatrix = new THREE.Matrix4()

const ui = {
  presetButtons: [...document.querySelectorAll('.preset-button')],
  cameraButtons: [...document.querySelectorAll('.camera-button')],
  editButton: document.querySelector('#edit-button'),
  nightButton: document.querySelector('#night-button'),
  soundButton: document.querySelector('#sound-button'),
  resetButton: document.querySelector('#reset-button'),
  dispatchButton: document.querySelector('#dispatch-button'),
  dispatchLabel: document.querySelector('#dispatch-label'),
  dispatchIcon: document.querySelector('#dispatch-icon'),
  speed: document.querySelector('#speed-value'),
  height: document.querySelector('#height-value'),
  gForce: document.querySelector('#g-value'),
  gBar: document.querySelector('#g-bar'),
  gMessage: document.querySelector('#g-message'),
  runState: document.querySelector('#run-state'),
  statusText: document.querySelector('#status-text'),
  editorPanel: document.querySelector('#editor-panel'),
  editorClose: document.querySelector('#editor-close'),
  selectedIndex: document.querySelector('#selected-index'),
  selectedPosition: document.querySelector('#selected-position'),
  rollSlider: document.querySelector('#roll-slider'),
  rollValue: document.querySelector('#roll-value'),
  dock: document.querySelector('#control-dock'),
  dockToggle: document.querySelector('#dock-toggle'),
  loading: document.querySelector('#loading'),
}

function setCameraMode(mode) {
  cameraMode = mode
  ui.cameraButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.camera === mode))
  controls.enabled = mode === 'orbit'
  if (train.head.userData.canopy) train.head.userData.canopy.visible = mode !== 'first'
  if (mode === 'orbit') {
    controls.target.set(0, 8, 0)
    camera.position.set(58, 50, 68)
    controls.update()
  }
}

function setEditing(enabled) {
  isEditing = enabled
  track.setEditMode(enabled)
  ui.editButton.classList.toggle('is-active', enabled)
  ui.editButton.setAttribute('aria-pressed', String(enabled))
  ui.editorPanel.classList.toggle('is-open', enabled)
  if (enabled) {
    setCameraMode('orbit')
    selectControl(selectedControlIndex)
    ui.statusText.textContent = '轨道编辑模式'
  } else {
    ui.statusText.textContent = '轨道已就绪'
  }
}

function selectControl(index) {
  selectedControlIndex = index
  track.setSelected(index)
  const point = track.points[index]
  const bank = track.banks[index]
  ui.selectedIndex.textContent = `#${String(index + 1).padStart(2, '0')}`
  ui.selectedPosition.textContent = `X ${point.x.toFixed(1)} · Y ${point.y.toFixed(1)} · Z ${point.z.toFixed(1)}`
  ui.rollSlider.value = String(Math.round(THREE.MathUtils.radToDeg(bank)))
  ui.rollValue.textContent = `${ui.rollSlider.value}°`
}

function updateSelectedControlUI() {
  const point = track.points[selectedControlIndex]
  ui.selectedPosition.textContent = `X ${point.x.toFixed(1)} · Y ${point.y.toFixed(1)} · Z ${point.z.toFixed(1)}`
}

function setNight(enabled) {
  isNight = enabled
  document.body.classList.toggle('is-night', enabled)
  park.setNightMode(enabled)
  track.setNightMode(enabled)
  train.setNightMode(enabled)
  ui.nightButton.classList.toggle('is-active', enabled)
  ui.nightButton.setAttribute('aria-pressed', String(enabled))
  ui.nightButton.querySelector('span').textContent = enabled ? '☀' : '☾'
  ui.statusText.textContent = enabled ? '夜间霓虹巡游' : '白昼欢乐谷'
}

async function toggleSound() {
  isSoundEnabled = !isSoundEnabled
  await audio.setEnabled(isSoundEnabled)
  ui.soundButton.classList.toggle('is-active', isSoundEnabled)
  ui.soundButton.setAttribute('aria-pressed', String(isSoundEnabled))
  ui.soundButton.querySelector('span').textContent = isSoundEnabled ? '♫' : '♪'
  const label = ui.soundButton.childNodes[1]
  if (label) label.textContent = isSoundEnabled ? '音效开启' : '音效关闭'
}

function switchPreset(presetId) {
  const preset = TRACK_PRESETS[presetId]
  if (!preset) return
  track.setPreset(preset)
  train.track = track
  train.u = 0.012
  train.speed = 0
  train.running = false
  train.stopped = true
  train.updateVisuals(0, true)
  park.setPreset(presetId)
  ui.presetButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.preset === presetId))
  selectControl(0)
  ui.statusText.textContent = `已切换：${preset.name}`
}

function updateDispatchUI() {
  if (train.running) {
    ui.dispatchLabel.textContent = '暂停'
    ui.dispatchIcon.textContent = 'Ⅱ'
    ui.runState.textContent = '运行中'
    ui.runState.style.borderColor = 'rgba(255, 139, 95, .35)'
    ui.runState.style.background = 'rgba(255, 139, 95, .12)'
    ui.runState.style.color = '#ff9b78'
  } else {
    ui.dispatchLabel.textContent = '发车'
    ui.dispatchIcon.textContent = '▶'
    ui.runState.textContent = train.stopped ? '待发车' : '已暂停'
    ui.runState.style.borderColor = 'rgba(114, 230, 209, .3)'
    ui.runState.style.background = 'rgba(114, 230, 209, .1)'
    ui.runState.style.color = '#72e6d1'
  }
}

function updateHud() {
  const frame = train.headFrame
  ui.speed.textContent = Math.round(Math.abs(train.speed) * 3.6).toString()
  ui.height.textContent = Math.max(0, frame.position.y).toFixed(1)
  ui.gForce.textContent = train.gForce.toFixed(1)

  const normalized = THREE.MathUtils.clamp((train.gForce + 2) / 7, 0, 1)
  ui.gBar.style.width = `${normalized * 100}%`
  ui.gBar.style.left = '0'
  ui.gBar.style.transform = 'none'
  ui.gBar.style.backgroundColor = train.gForce > 3.2 ? '#f15b75' : train.gForce < 0.25 ? '#ffc857' : '#72e6d1'

  if (train.gForce > 3.2) ui.gMessage.textContent = '强过载 · 抓稳扶手'
  else if (train.gForce > 1.8) ui.gMessage.textContent = '高 G · 持续加速'
  else if (train.gForce < -0.25) ui.gMessage.textContent = '强失重 · 腾空警告'
  else if (train.gForce < 0.35) ui.gMessage.textContent = '负 G · 短暂失重'
  else ui.gMessage.textContent = '正常载荷'

  updateDispatchUI()
}

function updateCamera(delta) {
  if (cameraMode === 'orbit') {
    controls.update()
    return
  }

  if (cameraMode === 'first') {
    const frame = train.headFrame
    cameraTarget.copy(frame.position).addScaledVector(frame.up, 1.42).addScaledVector(frame.tangent, -0.82)
    frameMatrix.makeBasis(frame.right.clone().negate(), frame.up, frame.tangent.clone().negate())
    cameraQuaternion.setFromRotationMatrix(frameMatrix)
    const alpha = 1 - Math.exp(-delta * 22)
    camera.position.lerp(cameraTarget, alpha)
    camera.quaternion.slerp(cameraQuaternion, alpha)
    return
  }

  if (cameraMode === 'chase') {
    const tail = train.cars[3]
    const tailFrame = track.sampleFrame(train.u - 3 * (3.65 / track.length))
    cameraTarget.copy(tail.position).addScaledVector(tailFrame.up, 4.1).addScaledVector(tailFrame.tangent, -9.4)
    cameraDummy.position.copy(cameraTarget)
    cameraDummy.up.copy(tailFrame.up)
    cameraDummy.lookAt(train.head.position)
    cameraQuaternion.copy(cameraDummy.quaternion)
  } else {
    const stationFrame = track.sampleFrame(0.008)
    cameraTarget.copy(stationFrame.position).addScaledVector(stationFrame.right, 13.5).addScaledVector(stationFrame.up, 4.6)
    cameraDummy.position.copy(cameraTarget)
    cameraDummy.up.set(0, 1, 0)
    cameraDummy.lookAt(train.head.position)
    cameraQuaternion.copy(cameraDummy.quaternion)
  }

  const alpha = 1 - Math.exp(-delta * (cameraMode === 'chase' ? 7 : 5))
  camera.position.lerp(cameraTarget, alpha)
  camera.quaternion.slerp(cameraQuaternion, alpha)
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function beginControlDrag(event) {
  if (!isEditing) return
  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(track.controlMeshes, false)
  if (!hits.length) return
  event.preventDefault()
  event.stopPropagation()
  selectControl(hits[0].object.userData.controlIndex)
  const point = track.points[selectedControlIndex]
  dragState = {
    pointerId: event.pointerId,
    vertical: event.shiftKey,
    startY: event.clientY,
    lastY: event.clientY,
    offset: new THREE.Vector3(),
  }
  dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), point)
  const hit = new THREE.Vector3()
  if (raycaster.ray.intersectPlane(dragPlane, hit)) dragState.offset.copy(point).sub(hit)
  renderer.domElement.setPointerCapture?.(event.pointerId)
  renderer.domElement.style.cursor = 'grabbing'
}

function moveControlDrag(event) {
  if (!dragState) return
  event.preventDefault()
  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const point = track.points[selectedControlIndex]

  if (dragState.vertical || event.shiftKey) {
    const deltaY = (dragState.lastY - event.clientY) * 0.045
    point.y = THREE.MathUtils.clamp(point.y + deltaY, 1.4, 58)
    dragState.lastY = event.clientY
  } else {
    const hit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(dragPlane, hit)) {
      point.x = THREE.MathUtils.clamp(hit.x + dragState.offset.x, -82, 82)
      point.z = THREE.MathUtils.clamp(hit.z + dragState.offset.z, -82, 82)
    }
  }
  track.setControlPosition(selectedControlIndex, point)
  updateSelectedControlUI()
}

function endControlDrag(event) {
  if (!dragState) return
  renderer.domElement.releasePointerCapture?.(event.pointerId)
  dragState = null
  renderer.domElement.style.cursor = ''
}

function adjustSelectedBank(delta) {
  const bank = THREE.MathUtils.clamp(track.banks[selectedControlIndex] + delta, -Math.PI * 0.42, Math.PI * 0.42)
  track.setControlBank(selectedControlIndex, bank)
  selectControl(selectedControlIndex)
}

ui.presetButtons.forEach((button) => button.addEventListener('click', () => switchPreset(button.dataset.preset)))
ui.cameraButtons.forEach((button) => button.addEventListener('click', () => setCameraMode(button.dataset.camera)))
ui.editButton.addEventListener('click', () => setEditing(!isEditing))
ui.editorClose.addEventListener('click', () => setEditing(false))
ui.nightButton.addEventListener('click', () => setNight(!isNight))
ui.soundButton.addEventListener('click', () => toggleSound())
ui.resetButton.addEventListener('click', () => setCameraMode(cameraMode))
ui.dispatchButton.addEventListener('click', () => {
  train.toggle()
  updateHud()
})
ui.rollSlider.addEventListener('input', (event) => {
  track.setControlBank(selectedControlIndex, THREE.MathUtils.degToRad(Number(event.target.value)))
  ui.rollValue.textContent = `${event.target.value}°`
})
ui.dockToggle.addEventListener('click', () => {
  const collapsed = ui.dock.classList.toggle('is-collapsed')
  ui.dockToggle.textContent = collapsed ? '+' : '−'
  ui.dockToggle.setAttribute('aria-label', collapsed ? '展开控制台' : '折叠控制台')
})

renderer.domElement.addEventListener('pointerdown', beginControlDrag, { capture: true })
renderer.domElement.addEventListener('pointermove', moveControlDrag)
renderer.domElement.addEventListener('pointerup', endControlDrag)
renderer.domElement.addEventListener('pointercancel', endControlDrag)
renderer.domElement.addEventListener('wheel', (event) => {
  if (!isEditing) return
  event.preventDefault()
  adjustSelectedBank(-event.deltaY * 0.0022)
}, { passive: false })

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return
  if (event.code === 'Space') {
    event.preventDefault()
    train.toggle()
    updateHud()
  } else if (event.code === 'KeyE') {
    setEditing(!isEditing)
  } else if (event.code === 'KeyC') {
    const modes = ['first', 'chase', 'station', 'orbit']
    setCameraMode(modes[(modes.indexOf(cameraMode) + 1) % modes.length])
  } else if (event.code === 'KeyN') {
    setNight(!isNight)
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
})

track.onRebuild = () => {
  train.updateVisuals(0, true)
}

selectControl(0)
setCameraMode('first')
updateHud()

let lastFrameTime = performance.now()
let elapsedTime = 0

function animate(now = performance.now()) {
  requestAnimationFrame(animate)
  const delta = Math.min((now - lastFrameTime) / 1000, 0.04)
  lastFrameTime = now
  elapsedTime += delta
  const elapsed = elapsedTime
  track.flushRebuild()
  train.update(delta)
  park.update(delta, elapsed)
  updateCamera(delta)
  updateHud()
  audio.update(train.speed, train.lastZone, train.gForce, delta)
  renderer.render(scene, camera)
}

requestAnimationFrame(() => {
  ui.loading.style.opacity = '0'
  window.setTimeout(() => ui.loading.remove(), 520)
})

animate()
