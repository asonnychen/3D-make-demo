import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { buildCathedral, buildBase, makeMaterials, makeDesignMaterials } from './cathedral.js'
import './style.css'

/* ---------------------------------------------------------------- 渲染器 */
const canvas = document.querySelector('#scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 1, 5000)
camera.position.set(-425, 325, 325)

const controls = new OrbitControls(camera, canvas)
controls.target.set(15, 58, 0)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 180
controls.maxDistance = 1400
controls.maxPolarAngle = Math.PI * 0.495
controls.autoRotateSpeed = 6

/* ---------------------------------------------------------------- 环境与灯光 */
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.42

const hemi = new THREE.HemisphereLight(0xe9eef7, 0x6a6157, 0.6)
scene.add(hemi)

function makeShadowLight(color, intensity, mapSize) {
  const l = new THREE.DirectionalLight(color, intensity)
  l.castShadow = true
  l.shadow.mapSize.set(mapSize, mapSize)
  const c = l.shadow.camera
  c.left = -340
  c.right = 340
  c.top = 380
  c.bottom = -320
  c.near = 1
  c.far = 3000
  l.shadow.bias = -0.0004
  l.shadow.normalBias = 0.7
  l.target.position.set(15, 40, 0)
  scene.add(l, l.target)
  return l
}

const sun = makeShadowLight(0xfff2de, 2.9, 2048)
const moon = makeShadowLight(0x9fb8e8, 0, 1024)
moon.castShadow = false

const fill = new THREE.DirectionalLight(0xc7d8ff, 0.8)
fill.position.set(430, 300, -360)
scene.add(fill)

const rim = new THREE.DirectionalLight(0xffe3c4, 1.1)
rim.position.set(140, 280, -540)
scene.add(rim)

// 夜间从门廊透出的暖光
const portalLights = [
  new THREE.PointLight(0xffb066, 0, 80, 2),
  new THREE.PointLight(0xffb066, 0, 80, 2),
]
portalLights[0].position.set(-60, 9, 0)
portalLights[1].position.set(42.2, 9, 43)
portalLights.forEach(l => scene.add(l))

/* ---------------------------------------------------------------- 模型 */
const materials = makeMaterials()
const designMats = makeDesignMaterials()

const base = buildBase().build(materials)
scene.add(base)

const cathedral = buildCathedral().build(materials)
cathedral.position.y = 2
scene.add(cathedral)

const allMeshes = []
for (const g of [base, cathedral]) g.traverse(o => { if (o.isMesh) allMeshes.push(o) })

// 设计模式轮廓线（法线外扩的背面壳）
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.25 } },
  vertexShader: `
    uniform float thickness;
    void main() {
      vec3 p = position + normal * thickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `void main() { gl_FragColor = vec4(0.26, 0.24, 0.21, 1.0); }`,
  side: THREE.BackSide,
})
const OUTLINE_KEYS = new Set(['stone', 'roof', 'base', 'plinth'])
const outlines = allMeshes.filter(m => OUTLINE_KEYS.has(m.name)).map(m => {
  const o = new THREE.Mesh(m.geometry, outlineMat)
  o.visible = false
  o.castShadow = false
  o.receiveShadow = false
  m.parent.add(o)
  return o
})

// 底座铭文（Canvas 贴图，避免引入字体文件）
function makeTextTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')
  g.clearRect(0, 0, 1024, 256)
  g.fillStyle = 'rgba(46,43,38,0.82)'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '600 92px Georgia, "Times New Roman", serif'
  if ('letterSpacing' in g) g.letterSpacing = '10px'
  g.fillText('KÖLNER DOM', 512, 104)
  g.font = '400 30px Georgia, "Times New Roman", serif'
  if ('letterSpacing' in g) g.letterSpacing = '6px'
  g.fillText('MASSSTAB  1 : 200', 512, 188)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const textGroup = new THREE.Group()
textGroup.position.set(-36, 0.03, 62)
textGroup.rotation.y = 0
const textPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(74, 18.5),
  new THREE.MeshBasicMaterial({ map: makeTextTexture(), transparent: true, depthWrite: false, toneMapped: false }),
)
textPlane.rotation.x = -Math.PI / 2
textPlane.renderOrder = 2
textGroup.add(textPlane)
scene.add(textGroup)

// 只接收阴影的透明地面
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400),
  new THREE.ShadowMaterial({ opacity: 0.3, color: 0x2b2f35 }),
)
shadowPlane.rotation.x = -Math.PI / 2
shadowPlane.position.y = -8.02
shadowPlane.receiveShadow = true
scene.add(shadowPlane)

/* ---------------------------------------------------------------- 设计模式 */
const ANNOS = [
  { text: '尖塔 157 m', p: new THREE.Vector3(-49, 159.5, 20.5), dx: 52, dy: -26 },
  { text: '中殿屋脊 58 m', p: new THREE.Vector3(22, 58.5, 0), dx: 26, dy: -112 },
  { text: '耳堂宽 78 m', p: new THREE.Vector3(42.2, 56, 39), dx: 58, dy: 34 },
]

const SVG_NS = 'http://www.w3.org/2000/svg'
const svg = document.querySelector('#annotations')
const annos = ANNOS.map(a => {
  const g = document.createElementNS(SVG_NS, 'g')
  const line = document.createElementNS(SVG_NS, 'polyline')
  line.setAttribute('class', 'anno-line')
  const dot = document.createElementNS(SVG_NS, 'circle')
  dot.setAttribute('class', 'anno-dot')
  dot.setAttribute('r', '2.6')
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('class', 'anno-text')
  text.textContent = a.text
  g.append(line, dot, text)
  svg.append(g)
  return { ...a, g, line, dot, text }
})

const _v = new THREE.Vector3()
function updateAnnotations() {
  const w = window.innerWidth
  const h = window.innerHeight
  for (const a of annos) {
    _v.copy(a.p).project(camera)
    if (_v.z > 1) { a.g.style.display = 'none'; continue }
    a.g.style.display = ''
    const x = (_v.x * 0.5 + 0.5) * w
    const y = (-_v.y * 0.5 + 0.5) * h
    const lx = x + a.dx
    const ly = y + a.dy
    const mx = x + a.dx * 0.55
    a.line.setAttribute('points', `${x.toFixed(1)},${y.toFixed(1)} ${mx.toFixed(1)},${ly.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}`)
    a.dot.setAttribute('cx', x.toFixed(1))
    a.dot.setAttribute('cy', y.toFixed(1))
    a.text.setAttribute('x', (lx + (a.dx > 0 ? 7 : -7)).toFixed(1))
    a.text.setAttribute('y', (ly + 4).toFixed(1))
    a.text.setAttribute('text-anchor', a.dx > 0 ? 'start' : 'end')
  }
}

let designMode = false
const modeBtn = document.querySelector('[data-mode="design"]')
function setDesignMode(on) {
  designMode = on
  document.body.classList.toggle('design', on)
  svg.classList.toggle('hidden', !on)
  for (const m of allMeshes) m.material = on ? designMats[m.name] : materials[m.name]
  for (const o of outlines) o.visible = on
  shadowPlane.material.opacity = on ? 0.16 : 0.3
  modeBtn.setAttribute('aria-pressed', String(on))
  applyTime(currentHour)
  if (on) updateAnnotations()
}
modeBtn.addEventListener('click', () => setDesignMode(!designMode))

/* ---------------------------------------------------------------- 建筑配色 */
const PALETTE = [
  { key: 'stone', label: '石灰岩墙面', hex: '#d9d3c5' },
  { key: 'trim', label: '石雕线脚', hex: '#e7e1d3' },
  { key: 'roof', label: '深灰屋顶', hex: '#3c4654' },
  { key: 'warm', label: '暖砂岩门廊', hex: '#9a6a42' },
  { key: 'glass', label: '彩色玻璃', hex: '#1e2c47' },
  { key: 'base', label: '底座石材', hex: '#e2ddd3' },
]

function applyPaletteColor(key, hex) {
  const m = materials[key]
  if (!m) return
  m.color.set(hex)
  if (key === 'stone') materials.stoneDark.color.copy(m.color).multiplyScalar(0.84)
  if (key === 'roof') materials.roofDark.color.copy(m.color).multiplyScalar(0.76)
  if (key === 'warm') materials.bronze.color.copy(m.color).multiplyScalar(0.8)
  if (key === 'base') materials.plinth.color.copy(m.color).multiplyScalar(0.88)
}

const paletteList = document.querySelector('#palette-list')
const paletteRows = new Map()

for (const item of PALETTE) {
  const li = document.createElement('li')
  li.className = 'flex h-10 items-center gap-2.5'

  const input = document.createElement('input')
  input.type = 'color'
  input.value = item.hex
  input.className = 'swatch'
  input.setAttribute('aria-label', item.label)

  const name = document.createElement('span')
  name.className = 'flex-1 text-[12px] ui-muted'
  name.textContent = item.label

  const value = document.createElement('span')
  value.className = 'palette-hex w-[46px] text-right font-mono text-[10.5px] tracking-[0.04em] ui-soft'
  value.textContent = item.hex.slice(1).toUpperCase()

  li.append(input, name, value)
  paletteList.append(li)
  paletteRows.set(item.key, { input, value, item })

  input.addEventListener('input', () => {
    applyPaletteColor(item.key, input.value)
    value.textContent = input.value.slice(1).toUpperCase()
  })
}

for (const [key, row] of paletteRows) applyPaletteColor(key, row.item.hex)

document.querySelector('#palette-reset').addEventListener('click', () => {
  for (const [key, row] of paletteRows) {
    row.input.value = row.item.hex
    row.value.textContent = row.item.hex.slice(1).toUpperCase()
    applyPaletteColor(key, row.item.hex)
  }
})

const paletteEl = document.querySelector('#palette')
document.querySelector('[data-palette]').addEventListener('click', () => {
  paletteEl.classList.toggle('open')
})

/* ---------------------------------------------------------------- 昼夜时间 */
function makeGlowTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.12, 'rgba(255,255,255,0.96)')
  grd.addColorStop(0.22, 'rgba(255,246,224,0.55)')
  grd.addColorStop(0.46, 'rgba(255,224,176,0.14)')
  grd.addColorStop(1, 'rgba(255,224,176,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const glowTex = makeGlowTexture()
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffe8c4, transparent: true, opacity: 0,
  depthWrite: false, blending: THREE.AdditiveBlending,
}))
sunSprite.scale.set(170, 170, 1)
scene.add(sunSprite)

const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xdfe8ff, transparent: true, opacity: 0,
  depthWrite: false, blending: THREE.AdditiveBlending,
}))
moonSprite.scale.set(96, 96, 1)
scene.add(moonSprite)

const SKY_STOPS = [
  { h: 0, c: ['#0a101c', '#0f1826', '#16202f', '#0b111c'] },
  { h: 5, c: ['#101a2c', '#1e2b44', '#3a4a66', '#222c40'] },
  { h: 6.5, c: ['#3d4c68', '#8d7f85', '#d9a273', '#6b5a55'] },
  { h: 8, c: ['#93a5b8', '#a6b5c4', '#b3c0cb', '#9fabb7'] },
  { h: 12, c: ['#aebccb', '#b9c5d1', '#c3ccd5', '#b2bcc6'] },
  { h: 16, c: ['#a8b6c5', '#b4c0cc', '#bec8d1', '#aab5bf'] },
  { h: 18.5, c: ['#4a5a74', '#8f7a78', '#d99a68', '#6a5c58'] },
  { h: 20, c: ['#141d30', '#1d2a44', '#3a3f5a', '#1a2233'] },
  { h: 24, c: ['#0a101c', '#0f1826', '#16202f', '#0b111c'] },
]

const SUN_LOW = new THREE.Color(0xff9a55)
const SUN_HIGH = new THREE.Color(0xfff5e6)
const MOON_COL = new THREE.Color(0x9fb8e8)
const HEMI_SKY_DAY = new THREE.Color(0xdfe9f5)
const HEMI_SKY_NIGHT = new THREE.Color(0x24304a)
const HEMI_GND_DAY = new THREE.Color(0x6a6157)
const HEMI_GND_NIGHT = new THREE.Color(0x11161f)

const sunDir = new THREE.Vector3()
const moonDir = new THREE.Vector3()
const _c = new THREE.Color()

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function skyAt(hour) {
  let i = 0
  while (i < SKY_STOPS.length - 2 && hour >= SKY_STOPS[i + 1].h) i++
  const a = SKY_STOPS[i]
  const b = SKY_STOPS[i + 1]
  const t = THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1)
  return a.c.map((hex, k) => new THREE.Color(hex).lerp(_c.set(b.c[k]), t))
}

const timeSlider = document.querySelector('#time-slider')
const timeLabel = document.querySelector('#time-label')
const timePhase = document.querySelector('#time-phase')
const sunIcon = document.querySelector('#icon-sun')
const moonIcon = document.querySelector('#icon-moon')

let currentHour = 15.5

function applyTime(hour) {
  currentHour = hour

  const t = (hour - 6) / 12
  const az = t * Math.PI
  const elev = Math.sin(t * Math.PI) * (58 * Math.PI / 180)
  const ce = Math.cos(elev)
  sunDir.set(Math.cos(az) * ce, Math.sin(elev), Math.sin(az) * ce).normalize()
  moonDir.copy(sunDir).multiplyScalar(-1)

  const sy = sunDir.y
  const dayF = smoothstep(-0.06, 0.28, sy)
  const nightF = 1 - dayF
  const highF = smoothstep(0.02, 0.7, sy)

  sun.position.copy(sunDir).multiplyScalar(700).add(sun.target.position)
  sun.intensity = dayF * (2.6 + highF * 1.6) * (designMode ? 1.1 : 1)
  sun.color.copy(SUN_LOW).lerp(SUN_HIGH, highF)
  sun.castShadow = dayF > 0.02

  moon.position.copy(moonDir).multiplyScalar(700).add(moon.target.position)
  moon.intensity = nightF * 0.55 * (designMode ? 0.8 : 1)
  moon.castShadow = nightF > 0.55

  hemi.intensity = (0.16 + dayF * 0.5) * (designMode ? 0.62 : 1)
  hemi.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_NIGHT, nightF)
  hemi.groundColor.copy(HEMI_GND_DAY).lerp(HEMI_GND_NIGHT, nightF)

  scene.environmentIntensity = (0.12 + dayF * 0.34) * (designMode ? 0.5 : 1)
  fill.intensity = 0.16 + dayF * 0.6
  rim.intensity = 0.1 + dayF * 1.0
  renderer.toneMappingExposure = 0.92 + dayF * 0.18

  // 夜间窗光与反射
  materials.glass.emissive.set(0xffb066)
  materials.glass.emissiveIntensity = nightF * 1.8
  materials.glass.roughness = 0.24 - nightF * 0.12
  materials.glass.metalness = 0.3 + nightF * 0.35
  materials.glass.envMapIntensity = 0.6 + nightF * 1.2
  materials.base.roughness = 0.95 - nightF * 0.3
  materials.base.metalness = nightF * 0.08
  materials.base.envMapIntensity = 0.4 + nightF * 0.8

  portalLights.forEach(l => { l.intensity = nightF * 110 })

  const sky = skyAt(hour)
  const body = document.body
  sky.forEach((c, i) => body.style.setProperty(`--sky-${i + 1}`, `#${c.getHexString()}`))
  const lum = 0.2126 * sky[0].r + 0.7152 * sky[0].g + 0.0722 * sky[0].b
  body.classList.toggle('day', lum > 0.25)

  sunSprite.material.opacity = smoothstep(-0.02, 0.12, sy) * 0.85
  moonSprite.material.opacity = smoothstep(-0.02, 0.12, -sy) * 0.8

  const total = Math.round(hour * 60)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  timeLabel.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  timePhase.textContent = hour < 5 || hour >= 21 ? '夜间'
    : hour < 7 ? '清晨'
      : hour < 17 ? '日间'
        : hour < 19.5 ? '黄昏' : '夜间'
  timeSlider.value = String(hour)
  timeSlider.style.setProperty('--fill', `${(hour / 24) * 100}%`)
  sunIcon.classList.toggle('hidden', sy <= 0)
  moonIcon.classList.toggle('hidden', sy > 0)
}

timeSlider.addEventListener('input', () => applyTime(parseFloat(timeSlider.value)))
applyTime(15.5)

/* ---------------------------------------------------------------- 视角 */
const VIEWS = {
  hero: { pos: [-425, 325, 325], target: [15, 55, 0] },
  west: { pos: [-585, 218, 118], target: [5, 58, 0] },
  east: { pos: [440, 320, 405], target: [50, 42, 0] },
  top: { pos: [30, 770, 165], target: [12, 5, 0] },
}

let tween = null
function flyTo(view) {
  const v = VIEWS[view]
  if (!v) return
  tween = {
    start: performance.now(),
    dur: 900,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: new THREE.Vector3(...v.pos),
    toTarget: new THREE.Vector3(...v.target),
  }
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/* ---------------------------------------------------------------- 自适应 */
let fitK = 1
function applyAspect() {
  const aspect = window.innerWidth / window.innerHeight
  const k = aspect < 1.35 ? Math.min(2.0, Math.pow(1.35 / aspect, 0.62)) : 1
  if (Math.abs(k - fitK) > 0.005) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(k / fitK)
    camera.position.copy(controls.target).add(offset)
    fitK = k
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  applyAspect()
  if (designMode) updateAnnotations()
})

/* ---------------------------------------------------------------- UI */
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false'))
    btn.setAttribute('aria-pressed', 'true')
    flyTo(btn.dataset.view)
  })
})

const rotateBtn = document.querySelector('[data-rotate]')
rotateBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate
  rotateBtn.setAttribute('aria-pressed', String(controls.autoRotate))
})

/* ---------------------------------------------------------------- 循环 */
const AUTO_REV_SECONDS = 10 // 自转一圈 = 10 秒，同时走完 24 小时
let lastFrame = performance.now()

function animate(now) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - lastFrame) / 1000, 0.1)
  lastFrame = now

  if (tween) {
    const t = Math.min((now - tween.start) / tween.dur, 1)
    const e = ease(t)
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e)
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e)
    if (t >= 1) tween = null
  }

  if (controls.autoRotate) {
    // 按帧时间换算角速度，保证任何刷新率下都是 10 秒一圈
    const angle = (Math.PI * 2 / AUTO_REV_SECONDS) * dt
    controls.autoRotateSpeed = angle * (3600 / (Math.PI * 2))
    currentHour = (currentHour + dt * (24 / AUTO_REV_SECONDS)) % 24
    applyTime(currentHour)
  }

  controls.update()
  sunSprite.position.copy(camera.position).addScaledVector(sunDir, 1600)
  moonSprite.position.copy(camera.position).addScaledVector(moonDir, 1600)
  renderer.render(scene, camera)
  if (designMode) updateAnnotations()
}

applyAspect()
requestAnimationFrame(animate)

const loader = document.querySelector('#loader')
requestAnimationFrame(() => {
  loader.classList.add('opacity-0', 'pointer-events-none')
  setTimeout(() => loader.remove(), 600)
})
