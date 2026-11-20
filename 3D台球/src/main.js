import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import './style.css'
import { createStage, buildRoom, buildTable, createBallMesh, createCueStick, createAimVisuals } from './world.js'
import { BilliardsPhysics } from './physics.js'
import { BALL_R, HALF_L, HALF_W, HEAD_SPOT, FOOT_SPOT, RACK_ORDER, BALL_COLORS, POCKETS } from './constants.js'
import { audio } from './audio.js'
import { applyI18n, getLang, t, toggleLang } from './i18n.js'

// ---------- 基础场景 ----------
const canvas = document.getElementById('scene')
const stage = createStage(canvas)
const { renderer, scene, camera } = stage
buildRoom(scene)
buildTable(scene)
const cueStick = createCueStick(scene)
const aim = createAimVisuals(scene)

const ballMeshes = new Map()
for (let n = 0; n <= 15; n++) {
  const mesh = createBallMesh(n)
  mesh.visible = false
  scene.add(mesh)
  ballMeshes.set(n, mesh)
}

// ---------- 本地设置 ----------
const SETTINGS_KEY = 'club9.settings'
const defaultSettings = { sens: 1, volume: 0.7, quality: 'high', muted: false }
let settings = { ...defaultSettings }
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'))
} catch {
  // 忽略损坏的本地设置
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ---------- 游戏状态 ----------
let physics = null
let state = 'menu'
let aimYaw = 0
let charging = false
let charge = 0
let chargeStart = 0
let shotNumber = 0
let shotClock = 0
let settleTime = 0
let lastRecordAt = 0
let recording = null
let shotPotted = 0
let shots = []
let sinking = new Map()
let replayState = null
let replayReturn = 'aiming'
let overlayReturn = null
let lastTickPower = 0
let clockTime = 0

const powerWrap = document.getElementById('powerWrap')
const powerFill = document.getElementById('powerFill')
const powerValue = document.getElementById('powerValue')
const powerLabel = document.getElementById('powerLabel')
const menuEl = document.getElementById('menu')
const loadingEl = document.getElementById('loading')
const pauseEl = document.getElementById('pause')
const hudTop = document.getElementById('hudTop')
const hudBottom = document.getElementById('hudBottom')
const pottedStrip = document.getElementById('pottedStrip')
const toastEl = document.getElementById('toast')

// ---------- 相机 ----------
const camPos = new THREE.Vector3(2.2, 1.4, 1.8)
const camTarget = new THREE.Vector3(0, 0.05, 0)
const desiredPos = new THREE.Vector3()
const desiredTarget = new THREE.Vector3()
let cameraReady = false

// ---------- 工具 ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function show(el) { el?.classList.remove('hidden') }
function hide(el) { el?.classList.add('hidden') }

let toastTimer = 0
function toast(message, duration = 1900) {
  toastEl.textContent = message
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration)
}

function makeRackPositions() {
  const list = [{ number: 0, x: HEAD_SPOT.x, z: HEAD_SPOT.z }]
  const rowGap = Math.sqrt(3) * BALL_R * 1.004
  const ballGap = BALL_R * 2.004
  let index = 0
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      list.push({
        number: RACK_ORDER[index++],
        x: FOOT_SPOT.x + row * rowGap,
        z: (j - row / 2) * ballGap,
      })
    }
  }
  return list
}

function syncMeshes() {
  for (let n = 0; n <= 15; n++) {
    const mesh = ballMeshes.get(n)
    const ball = physics.get(n)
    if (!ball) continue
    if (sinking.has(n)) continue
    if (physics.isPotted(n)) {
      mesh.visible = false
      continue
    }
    const p = ball.body.translation()
    const r = ball.body.rotation()
    mesh.position.set(p.x, p.y, p.z)
    mesh.quaternion.set(r.x, r.y, r.z, r.w)
    mesh.scale.setScalar(1)
    mesh.visible = true
  }
}

function placeCueMesh() {
  const cue = physics.cuePosition()
  const mesh = ballMeshes.get(0)
  mesh.position.set(cue.x, cue.y, cue.z)
  mesh.quaternion.identity()
  mesh.scale.setScalar(1)
  mesh.visible = !physics.isPotted(0)
}

// ---------- HUD ----------
function updateHUD() {
  const pottedObjects = []
  for (let n = 1; n <= 15; n++) {
    if (physics?.isPotted(n)) pottedObjects.push(n)
  }
  document.getElementById('shotCount').textContent = String(shotNumber)
  document.getElementById('pottedCount').textContent = String(pottedObjects.length)
  document.getElementById('remainCount').textContent = String(15 - pottedObjects.length)

  if (pottedObjects.length) {
    pottedStrip.innerHTML = ''
    for (const n of pottedObjects) {
      const chip = document.createElement('span')
      chip.className = 'ball-chip'
      chip.style.background = `#${BALL_COLORS[n].toString(16).padStart(6, '0')}`
      chip.textContent = String(n)
      pottedStrip.appendChild(chip)
    }
    show(pottedStrip)
  } else {
    hide(pottedStrip)
    pottedStrip.innerHTML = ''
  }
}

function updatePowerUI() {
  const pct = Math.round(charge * 100)
  powerFill.style.width = `${pct}%`
  powerValue.textContent = `${pct}%`
  powerLabel.textContent = charge < 0.36 ? t('power.low') : charge < 0.74 ? t('power.mid') : t('power.high')
}

function refreshMuteUI() {
  const label = settings.muted ? 'menu.sound' : 'menu.mute'
  const menuLabel = document.getElementById('muteMenuLabel')
  if (menuLabel) menuLabel.textContent = t(label)
  const hudBtn = document.getElementById('muteBtnHud')
  if (hudBtn) {
    hudBtn.classList.toggle('is-muted', settings.muted)
    hudBtn.setAttribute('title', t(label))
  }
  const menuBtn = document.getElementById('muteBtnMenu')
  if (menuBtn) menuBtn.setAttribute('aria-pressed', String(settings.muted))
}

function refreshLanguageUI() {
  const lang = getLang()
  document.querySelectorAll('#langBtnMenu, #langBtnHud').forEach((el) => {
    el.textContent = lang === 'zh' ? 'EN' : '中文'
  })
  updateHUD()
  refreshMuteUI()
  if (charging) updatePowerUI()
  if (!document.getElementById('replayPanel').classList.contains('hidden')) {
    rebuildReplayList()
    if (replayState) updateReplayHeader()
  }
}

function setPlayingUI(playing) {
  if (playing) {
    show(hudTop)
    show(hudBottom)
  } else {
    hide(hudTop)
    hide(hudBottom)
    hide(powerWrap)
  }
}

// ---------- 音效 / 设置 ----------
function applySettings() {
  audio.setVolume(settings.volume)
  audio.setMuted(settings.muted)
  stage.setQuality(settings.quality !== 'low')
  const sens = document.getElementById('sensRange')
  const vol = document.getElementById('volumeRange')
  if (sens) sens.value = String(settings.sens)
  if (vol) vol.value = String(settings.volume)
  document.getElementById('sensValue').textContent = `${settings.sens.toFixed(1)}×`
  document.getElementById('volumeValue').textContent = `${Math.round(settings.volume * 100)}%`
  document.querySelectorAll('#qualitySeg button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.quality === settings.quality)
  })
  refreshMuteUI()
}

function toggleMute() {
  audio.init()
  settings.muted = !settings.muted
  saveSettings()
  applySettings()
}

// ---------- 指针锁定 ----------
function requestPointerLock() {
  try {
    const result = canvas.requestPointerLock?.()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // 浏览器拒绝锁定时继续用普通鼠标移动瞄准
  }
}

function isLocked() {
  return document.pointerLockElement === canvas
}

document.addEventListener('pointerlockchange', () => {
  if (state === 'aiming' && !isLocked()) pauseGame(true)
})

// ---------- 游戏流程 ----------
function startGame() {
  audio.init()
  audio.uiClick()
  hide(menuEl)
  hide(pauseEl)
  hide(document.getElementById('guideModal'))
  hide(document.getElementById('settingsModal'))
  hide(document.getElementById('replayPanel'))
  state = 'aiming'
  aimYaw = 0
  resetRack(true)
  setPlayingUI(true)
  updateHUD()
  hide(powerWrap)
  requestPointerLock()
}

function pauseGame(showOverlay = true) {
  if (state !== 'aiming') return
  if (charging) {
    charging = false
    hide(powerWrap)
  }
  state = 'paused'
  cueStick.visible = false
  aim.group.visible = false
  if (showOverlay) show(pauseEl)
  if (isLocked()) document.exitPointerLock()
}

function resumeGame() {
  hide(pauseEl)
  hide(document.getElementById('guideModal'))
  hide(document.getElementById('settingsModal'))
  hide(document.getElementById('replayPanel'))
  if (state !== 'paused') return
  state = 'aiming'
  setPlayingUI(true)
  requestPointerLock()
}

function returnToMenu() {
  state = 'menu'
  hide(pauseEl)
  hide(document.getElementById('guideModal'))
  hide(document.getElementById('settingsModal'))
  hide(document.getElementById('replayPanel'))
  setPlayingUI(false)
  show(menuEl)
  cueStick.visible = false
  aim.group.visible = false
  hide(powerWrap)
  hide(pottedStrip)
  resetRack(true)
  if (isLocked()) document.exitPointerLock()
}

function resetRack(silent = false) {
  if (state === 'rolling' || state === 'settling') return
  if (charging) {
    charging = false
    hide(powerWrap)
  }
  physics.createBalls(makeRackPositions())
  sinking.clear()
  shotNumber = 0
  shots = []
  shotPotted = 0
  replayState = null
  for (const mesh of ballMeshes.values()) {
    mesh.visible = true
    mesh.scale.setScalar(1)
  }
  syncMeshes()
  placeCueMesh()
  updateHUD()
  if (!silent) toast(t('toast.racked'))
}

function startCharge() {
  if (state !== 'aiming') return
  if (physics.isPotted(0)) return
  charging = true
  charge = 0
  chargeStart = performance.now()
  lastTickPower = 0
  show(powerWrap)
  updatePowerUI()
}

function cancelCharge() {
  charging = false
  hide(powerWrap)
}

function releaseShot() {
  if (!charging) return
  const power = Math.max(0.1, charge)
  charging = false
  const dir = new THREE.Vector3(Math.cos(aimYaw), 0, Math.sin(aimYaw))
  const speed = 1.25 + power * 6.65
  physics.shoot(0, dir.x, dir.z, speed)
  audio.cueStrike(power)
  hide(powerWrap)
  state = 'rolling'
  shotNumber += 1
  shotPotted = 0
  shotClock = 0
  lastRecordAt = 0
  settleTime = 0
  recording = [makeRecordFrame(0)]
  cueStick.visible = false
  aim.group.visible = false
  updateHUD()
}

function makeRecordFrame(time) {
  return {
    t: time,
    balls: physics.snapshot().map((b) => ({ ...b, v: !physics.isPotted(b.number) })),
  }
}

function handlePocket(number) {
  const ball = physics.get(number)
  const pos = ball ? ball.body.translation() : null
  let pocket = POCKETS[0]
  let best = Infinity
  if (pos) {
    for (const p of POCKETS) {
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2
      if (d < best) {
        best = d
        pocket = p
      }
    }
  }
  sinking.set(number, { t: 0, x: pocket.x, y: BALL_R, z: pocket.z })
  audio.pocket()
  if (number !== 0) {
    shotPotted += 1
    toast(`${t('toast.potted')}  ${number}`, 1100)
    updateHUD()
  }
}

function finishShot() {
  if (state !== 'rolling') return
  state = 'settling'
  if (recording) {
    recording.push(makeRecordFrame(shotClock))
  }
  const duration = Math.max(0.3, shotClock)
  shots.push({
    n: shotNumber,
    duration,
    potted: shotPotted,
    frames: recording,
    cuePotted: physics.isPotted(0),
  })
  if (shots.length > 8) shots.shift()
  recording = null
  updateHUD()

  const allPotted = [...Array(15)].every((_, i) => physics.isPotted(i + 1))
  const cuePotted = physics.isPotted(0)

  setTimeout(() => {
    if (cuePotted) {
      const spot = physics.findFreeSpot(HEAD_SPOT.x, HEAD_SPOT.z)
      physics.respawnCue(spot.x, spot.z)
      sinking.delete(0)
      placeCueMesh()
      toast(t('toast.cuePotted'), 2400)
    }
    if (sinking.size) {
      // 让还在下落的目标球完成动画
      setTimeout(() => {
        for (const n of sinking.keys()) ballMeshes.get(n).visible = false
        sinking.clear()
      }, 420)
    }
    state = 'aiming'
    syncMeshes()
    if (allPotted) toast(t('toast.cleared'), 3200)
  }, 620)
}

// ---------- 物理循环 ----------
let accum = 0

function stepSimulation(dt) {
  accum += dt
  let steps = 0
  while (accum >= 1 / 120 && steps < 8) {
    const impacts = physics.step()
    for (const impact of impacts) {
      const v = Math.min(1, impact.speed / 4.2)
      if (v > 0.03) audio.ballHit(v, impact.isRail)
    }
    const captured = physics.collectPockets()
    for (const n of captured) handlePocket(n)
    accum -= 1 / 120
    steps += 1
  }
  if (steps >= 8) accum = 0
}

// ---------- 瞄准 ----------
const aimInfo = { t: 0, target: null }
function computeAim() {
  const cue = physics.cuePosition()
  const dirX = Math.cos(aimYaw)
  const dirZ = Math.sin(aimYaw)
  let tBall = Infinity
  let target = null
  for (let n = 1; n <= 15; n++) {
    if (physics.isPotted(n)) continue
    const p = physics.get(n).body.translation()
    const ox = p.x - cue.x
    const oz = p.z - cue.z
    const tca = ox * dirX + oz * dirZ
    if (tca <= 0) continue
    const d2 = ox * ox + oz * oz - tca * tca
    const rr = (BALL_R * 2) ** 2
    if (d2 > rr) continue
    const t = tca - Math.sqrt(rr - d2)
    if (t > 0 && t < tBall) {
      tBall = t
      target = p
    }
  }

  let tRail = Infinity
  const lx = HALF_L - BALL_R - 0.002
  const lz = HALF_W - BALL_R - 0.002
  if (Math.abs(dirX) > 1e-6) {
    const tx = ((dirX > 0 ? lx : -lx) - cue.x) / dirX
    if (tx > 0) tRail = Math.min(tRail, tx)
  }
  if (Math.abs(dirZ) > 1e-6) {
    const tz = ((dirZ > 0 ? lz : -lz) - cue.z) / dirZ
    if (tz > 0) tRail = Math.min(tRail, tz)
  }

  const hitsBall = tBall < tRail
  aimInfo.t = hitsBall ? tBall : tRail
  aimInfo.target = hitsBall ? target : null
  return aimInfo
}

const zAxis = new THREE.Vector3(0, 0, 1)
const tmpQuat = new THREE.Quaternion()

function updateAimAndCue(dt) {
  const visible = state === 'aiming' && !replayState
  cueStick.visible = visible
  aim.group.visible = visible
  if (!visible) return

  const cue = physics.cuePosition()
  const dir = new THREE.Vector3(Math.cos(aimYaw), 0, Math.sin(aimYaw))
  const info = computeAim()

  const startX = cue.x + dir.x * (BALL_R + 0.002)
  const startZ = cue.z + dir.z * (BALL_R + 0.002)
  const endX = cue.x + dir.x * info.t
  const endZ = cue.z + dir.z * info.t

  const linePos = aim.lineGeo.attributes.position
  linePos.setXYZ(0, startX, 0.005, startZ)
  linePos.setXYZ(1, endX, 0.005, endZ)
  linePos.needsUpdate = true
  aim.line.computeLineDistances()

  if (info.target) {
    aim.ghost.visible = true
    aim.ghostBall.visible = true
    aim.ghost.position.set(endX, 0.005, endZ)
    aim.ghostBall.position.set(endX, BALL_R, endZ)
    const dx = info.target.x - endX
    const dz = info.target.z - endZ
    const len = Math.hypot(dx, dz) || 1
    const dPos = aim.deflectGeo.attributes.position
    dPos.setXYZ(0, endX, 0.006, endZ)
    dPos.setXYZ(1, endX + (dx / len) * 0.22, 0.006, endZ + (dz / len) * 0.22)
    dPos.needsUpdate = true
    aim.deflect.visible = true
  } else {
    aim.ghost.visible = false
    aim.ghostBall.visible = false
    aim.deflect.visible = false
  }

  const pull = 0.018 + (charging ? charge * 0.17 : 0)
  cueStick.position.set(
    cue.x - dir.x * (BALL_R + 0.008 + pull),
    BALL_R + 0.003 + (charging ? charge * 0.012 : 0),
    cue.z - dir.z * (BALL_R + 0.008 + pull),
  )
  tmpQuat.setFromUnitVectors(zAxis, dir)
  cueStick.quaternion.copy(tmpQuat)
}

// ---------- 相机 ----------
function updateCamera(dt) {
  let k = 6
  if (state === 'menu') {
    const a = 1.16 + Math.sin(clockTime * 0.07) * 0.16
    const radius = 4.4
    desiredPos.set(Math.sin(a) * radius, 1.85 + Math.sin(clockTime * 0.16) * 0.04, Math.cos(a) * radius)
    desiredTarget.set(0, 0.02, 0)
    k = 2.2
  } else if (state === 'aiming' || state === 'paused') {
    if (state === 'paused' && cameraReady) return
    // 球员站在球杆后方，镜头沿球杆/瞄准方向对齐
    const cue = physics.cuePosition()
    const dir = new THREE.Vector3(Math.cos(aimYaw), 0, Math.sin(aimYaw))
    const behind = 1.62
    desiredPos.set(
      cue.x - dir.x * behind,
      0.78,
      cue.z - dir.z * behind,
    )
    desiredTarget.set(cue.x + dir.x * 1.5, 0.02, cue.z + dir.z * 1.5)
    k = 12
  } else if (state === 'rolling' || state === 'settling') {
    const fit = Math.max(3.3, 2.15 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.min(1, camera.aspect))
    desiredPos.set(0.12, Math.min(2.55, fit * 0.62), fit * 0.72)
    desiredTarget.set(0, 0, 0.02)
    k = 3.6
  } else if (state === 'replay') {
    const fit = Math.max(3.3, 2.15 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.min(1, camera.aspect))
    desiredPos.set(0, Math.min(2.6, fit * 0.66), fit * 0.66)
    desiredTarget.set(0, 0, 0.03)
    k = 3
  } else {
    return
  }

  if (!cameraReady) {
    camPos.copy(desiredPos)
    camTarget.copy(desiredTarget)
    cameraReady = true
  } else {
    const alpha = 1 - Math.exp(-dt * k)
    camPos.lerp(desiredPos, alpha)
    camTarget.lerp(desiredTarget, alpha)
  }
  camera.position.copy(camPos)
  camera.lookAt(camTarget)
}

// ---------- 回放 ----------
const replayPanel = document.getElementById('replayPanel')
const replayListEl = document.getElementById('replayList')
const replayPlayerEl = document.getElementById('replayPlayer')
const replayRange = document.getElementById('replayRange')
const replayClock = document.getElementById('replayClock')
const replayShotLabel = document.getElementById('replayShotLabel')
const replayToggle = document.getElementById('replayToggle')

function rebuildReplayList() {
  replayListEl.innerHTML = ''
  if (!shots.length) {
    const p = document.createElement('p')
    p.className = 'replay-empty'
    p.textContent = t('replay.empty')
    replayListEl.appendChild(p)
    return
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i]
    const btn = document.createElement('button')
    btn.className = 'shot-item'
    btn.innerHTML = `<b>${t('replay.shot', { n: shot.n })}</b><span>${t('replay.potted', { n: shot.potted })} · ${t('replay.duration', { s: shot.duration.toFixed(1) })}</span>`
    btn.addEventListener('click', () => startReplay(shot))
    replayListEl.appendChild(btn)
  }
}

function openReplayPanel() {
  if (state === 'rolling' || state === 'settling' || state === 'menu') return
  replayReturn = state
  if (state === 'aiming') {
    pauseForOverlay()
  } else if (state === 'paused') {
    hide(pauseEl)
  }
  replayState = null
  replayPlayerEl.classList.add('hidden')
  replayPanel.classList.remove('replay-mode')
  show(replayListEl)
  rebuildReplayList()
  show(replayPanel)
}

function startReplay(shot) {
  replayState = { shot, time: 0, playing: true, duration: shot.duration + 0.3 }
  state = 'replay'
  replayPanel.classList.add('replay-mode')
  hide(replayListEl)
  show(replayPlayerEl)
  cueStick.visible = false
  aim.group.visible = false
  hide(powerWrap)
  hide(hudBottom)
  replayRange.value = '0'
  updateReplayHeader()
  updateReplayButton()
}

function updateReplayHeader() {
  if (!replayState) return
  replayShotLabel.textContent = t('replay.shot', { n: replayState.shot.n })
  replayClock.textContent = `${replayState.time.toFixed(1)}s`
  replayRange.value = String(Math.round((replayState.time / replayState.duration) * 1000))
}

function updateReplayButton() {
  replayToggle.textContent = replayState?.playing ? '⏸' : '▶'
  replayToggle.setAttribute('aria-label', replayState?.playing ? t('replay.pause') : t('replay.play'))
}

function applyReplayFrame(time) {
  if (!replayState) return
  const frames = replayState.shot.frames
  if (!frames.length) return
  let idx = 0
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t <= time) idx = i
    else break
  }
  const frame = frames[idx]
  for (const b of frame.balls) {
    const mesh = ballMeshes.get(b.number)
    mesh.position.set(b.x, b.y, b.z)
    mesh.quaternion.set(b.qx, b.qy, b.qz, b.qw)
    mesh.visible = b.v
  }
}

function exitReplayPanel() {
  const wasReplay = !!replayState
  replayState = null
  replayPanel.classList.remove('replay-mode')
  hide(replayPanel)
  hide(replayPlayerEl)
  show(replayListEl)
  show(hudBottom)
  const wasPaused = replayReturn === 'paused'
  replayReturn = null
  if (wasReplay) {
    state = 'paused'
    syncMeshes()
    placeCueMesh()
    cueStick.visible = false
    aim.group.visible = false
    if (wasPaused) show(pauseEl)
    else resumeGame()
  } else if (state === 'paused') {
    // 从瞄准进入面板时，关闭后直接继续
    resumeGame()
  }
}

function closeReplayPanel() {
  show(hudBottom)
  if (replayState) {
    replayState = null
    state = 'paused'
    replayPanel.classList.remove('replay-mode')
    show(hudBottom)
    syncMeshes()
    placeCueMesh()
    hide(replayPanel)
    if (replayReturn === 'paused') show(pauseEl)
    else resumeGame()
    return
  }
  hide(replayPanel)
  if (replayReturn === 'paused') {
    state = 'paused'
    show(pauseEl)
  } else if (replayReturn === 'aiming') {
    resumeGame()
  }
  replayReturn = null
}

function updateReplay(dt) {
  if (!replayState) return
  if (replayState.playing) {
    replayState.time = Math.min(replayState.duration, replayState.time + dt)
    if (replayState.time >= replayState.duration) {
      replayState.playing = false
      updateReplayButton()
    }
  }
  applyReplayFrame(replayState.time)
  updateReplayHeader()
}

// ---------- 覆盖层流程 ----------
function pauseForOverlay() {
  if (state === 'aiming') {
    pauseGame(false)
  }
}

function openGuide() {
  if (state === 'rolling' || state === 'settling') return
  overlayReturn = state === 'aiming' ? 'resume' : state === 'paused' ? 'paused' : 'menu'
  pauseForOverlay()
  hide(pauseEl)
  show(document.getElementById('guideModal'))
}

function closeGuide() {
  hide(document.getElementById('guideModal'))
  if (overlayReturn === 'resume') {
    overlayReturn = null
    resumeGame()
  } else if (overlayReturn === 'paused') {
    overlayReturn = null
    show(pauseEl)
  } else {
    overlayReturn = null
  }
}

function openSettings() {
  if (state === 'rolling' || state === 'settling') return
  overlayReturn = state === 'aiming' ? 'resume' : state === 'paused' ? 'paused' : 'menu'
  pauseForOverlay()
  hide(pauseEl)
  show(document.getElementById('settingsModal'))
  applySettings()
}

function closeSettings() {
  hide(document.getElementById('settingsModal'))
  saveSettings()
  if (overlayReturn === 'resume') {
    overlayReturn = null
    resumeGame()
  } else if (overlayReturn === 'paused') {
    overlayReturn = null
    show(pauseEl)
  } else {
    overlayReturn = null
  }
}

// ---------- 输入 ----------
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  if (state !== 'aiming') return
  if (!isLocked()) requestPointerLock()
  startCharge()
})

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

document.addEventListener('mousemove', (e) => {
  if (state !== 'aiming') return
  if (!isLocked() && e.target !== canvas) return
  aimYaw += e.movementX * 0.0021 * settings.sens
})

window.addEventListener('mouseup', (e) => {
  if (e.button === 0 && charging) releaseShot()
})

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  const key = e.key.toLowerCase()
  if (key === 'escape') {
    if (!replayPanel.classList.contains('hidden')) {
      closeReplayPanel()
      return
    }
    if (!document.getElementById('guideModal').classList.contains('hidden')) {
      closeGuide()
      return
    }
    if (!document.getElementById('settingsModal').classList.contains('hidden')) {
      closeSettings()
      return
    }
    if (state === 'replay') {
      exitReplayPanel()
      return
    }
    if (state === 'aiming') {
      pauseGame(true)
      return
    }
    if (state === 'paused') {
      resumeGame()
      return
    }
  }
  if (state === 'menu') return
  if (key === 'r') {
    if (state === 'aiming' || state === 'paused') resetRack()
  } else if (key === 'l') {
    if (state === 'aiming' || state === 'paused') {
      if (replayPanel.classList.contains('hidden')) openReplayPanel()
      else closeReplayPanel()
    }
  } else if (key === 'h') {
    if (state !== 'rolling' && state !== 'settling') {
      const modal = document.getElementById('guideModal')
      if (modal.classList.contains('hidden')) openGuide()
      else closeGuide()
    }
  } else if (key === 'm') {
    toggleMute()
  }
})

// ---------- 事件绑定 ----------
document.getElementById('startBtn').addEventListener('click', startGame)
document.getElementById('resumeBtn').addEventListener('click', resumeGame)
document.getElementById('rackBtnPause').addEventListener('click', () => {
  resetRack()
  resumeGame()
})
document.getElementById('menuBtnPause').addEventListener('click', returnToMenu)

for (const id of ['guideBtnMenu', 'guideBtnHud']) {
  document.getElementById(id).addEventListener('click', () => {
    audio.init()
    audio.uiClick()
    openGuide()
  })
}
document.getElementById('guideClose').addEventListener('click', closeGuide)
document.getElementById('guideDone').addEventListener('click', closeGuide)

for (const id of ['settingsBtnMenu', 'settingsBtnHud']) {
  document.getElementById(id).addEventListener('click', () => {
    audio.init()
    audio.uiClick()
    openSettings()
  })
}
document.getElementById('settingsClose').addEventListener('click', closeSettings)
document.getElementById('settingsDone').addEventListener('click', closeSettings)

document.getElementById('muteBtnMenu').addEventListener('click', toggleMute)
document.getElementById('muteBtnHud').addEventListener('click', toggleMute)

for (const id of ['langBtnMenu', 'langBtnHud']) {
  document.getElementById(id).addEventListener('click', () => {
    toggleLang()
    refreshLanguageUI()
    audio.uiClick()
  })
}

document.getElementById('pauseBtnHud').addEventListener('click', () => pauseGame(true))
document.getElementById('replayBtn').addEventListener('click', openReplayPanel)
document.getElementById('replayClose').addEventListener('click', closeReplayPanel)
document.getElementById('replayExitBtn').addEventListener('click', exitReplayPanel)
document.getElementById('replayRestartBtn').addEventListener('click', () => {
  if (!replayState) return
  replayState.time = 0
  replayState.playing = true
  updateReplayButton()
  applyReplayFrame(0)
})
replayToggle.addEventListener('click', () => {
  if (!replayState) return
  replayState.playing = !replayState.playing
  if (replayState.playing && replayState.time >= replayState.duration) replayState.time = 0
  updateReplayButton()
})
replayRange.addEventListener('input', () => {
  if (!replayState) return
  replayState.time = (Number(replayRange.value) / 1000) * replayState.duration
  replayState.playing = false
  updateReplayButton()
  applyReplayFrame(replayState.time)
  replayClock.textContent = `${replayState.time.toFixed(1)}s`
})

document.getElementById('sensRange').addEventListener('input', (e) => {
  settings.sens = Number(e.target.value)
  document.getElementById('sensValue').textContent = `${settings.sens.toFixed(1)}×`
  saveSettings()
})
document.getElementById('volumeRange').addEventListener('input', (e) => {
  settings.volume = Number(e.target.value)
  document.getElementById('volumeValue').textContent = `${Math.round(settings.volume * 100)}%`
  audio.setVolume(settings.volume)
  saveSettings()
})
document.getElementById('qualitySeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-quality]')
  if (!btn) return
  settings.quality = btn.dataset.quality
  applySettings()
  saveSettings()
})

window.addEventListener('club9:lang', refreshLanguageUI)
window.addEventListener('resize', onResize)

function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

// ---------- 主循环 ----------
let lastFrame = performance.now()

function updateSinking(dt) {
  for (const [n, s] of sinking) {
    s.t += dt * 3.2
    const k = Math.min(1, s.t)
    const mesh = ballMeshes.get(n)
    mesh.visible = true
    mesh.position.set(s.x, s.y - 0.13 * k * k, s.z)
    if (k >= 1) {
      mesh.visible = false
      sinking.delete(n)
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  clockTime += dt

  if (charging) {
    charge = Math.min(1, (now - chargeStart) / 1250)
    updatePowerUI()
    const tick = Math.floor(charge * 10)
    if (tick !== lastTickPower) {
      lastTickPower = tick
      audio.chargeTick(charge)
    }
  }

  if (state === 'rolling') {
    if (physics) {
      stepSimulation(dt)
      shotClock += dt
      if (shotClock - lastRecordAt >= 1 / 60) {
        recording?.push(makeRecordFrame(shotClock))
        lastRecordAt = shotClock
      }
      if (shotClock > 0.35 && !physics.moving()) settleTime += dt
      else settleTime = 0
      if (settleTime > 0.55 || shotClock > 24) finishShot()
    }
  } else {
    accum = 0
  }

  if (state === 'replay') updateReplay(dt)

  updateAimAndCue(dt)
  updateCamera(dt)

  if (sinking.size) updateSinking(dt)
  if (state !== 'replay') syncMeshes()

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

// ---------- 启动 ----------
async function boot() {
  onResize()
  await RAPIER.init()
  physics = new BilliardsPhysics(RAPIER)
  physics.createBalls(makeRackPositions())
  syncMeshes()
  placeCueMesh()

  applyI18n()
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en'
  applySettings()
  updateHUD()
  refreshLanguageUI()

  camera.position.set(2.2, 1.4, 1.8)
  camera.lookAt(0, 0.05, 0)
  requestAnimationFrame(frame)

  setTimeout(() => {
    loadingEl.classList.add('fade')
    setTimeout(() => {
      hide(loadingEl)
      show(menuEl)
    }, 620)
  }, 380)
}

boot().catch((err) => {
  console.error('CLUB No.9 启动失败', err)
  const loading = document.getElementById('loading')
  const p = loading?.querySelector('p')
  if (p) {
    p.textContent = getLang() === 'zh' ? '启动失败，请刷新页面重试。' : 'Failed to start. Please refresh.'
    p.style.color = '#e0a080'
  }
})


