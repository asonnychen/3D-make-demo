import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import './style.css'
import { createWorld, sampleGround } from './world.js'
import { Player } from './player.js'
import { EnemyManager } from './enemies.js'
import { FX } from './fx.js'
import { AudioEngine } from './audio.js'
import { UI } from './ui.js'
import {
  ARENA,
  SPAWN,
  TURBINE,
  WAVES,
  UPGRADE_TIERS,
  CHAPTERS,
  PLAYER as PCFG,
} from './config.js'

/* ============================================================
   渲染器 / 场景 / 相机
   ============================================================ */

const canvas = document.querySelector('#scene')
const isCoarse = window.matchMedia('(pointer: coarse)').matches
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isCoarse,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.3 : 1.8))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x9fc0bd, 0.0022)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2200)
camera.position.set(0, 8, 80)
camera.rotation.order = 'YXZ'
scene.add(camera)

/* ============================================================
   灯光
   ============================================================ */

const hemi = new THREE.HemisphereLight(0xc9eef0, 0x2d4d49, 0.98)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xfff0dc, 2.15)
sun.position.set(50, 36, -94)
sun.target.position.set(0, 4, 4)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -78
sun.shadow.camera.right = 78
sun.shadow.camera.top = 78
sun.shadow.camera.bottom = -78
sun.shadow.camera.near = 1
sun.shadow.camera.far = 260
sun.shadow.bias = -0.0006
sun.shadow.normalBias = 0.035
// 第一人称身体在 layer 1，只参与阴影
sun.shadow.camera.layers.enable(1)
scene.add(sun)
scene.add(sun.target)

const fill = new THREE.DirectionalLight(0x6fe6d8, 0.85)
fill.position.set(-60, 26, 70)
scene.add(fill)

const rim = new THREE.DirectionalLight(0xffb98a, 0.35)
rim.position.set(10, 18, -110)
scene.add(rim)

/* ============================================================
   世界 / 角色 / 特效
   ============================================================ */

const world = createWorld(scene, renderer)
const fx = new FX(scene)
const audio = new AudioEngine()
const ui = new UI()

const player = new Player({ scene, camera, audio, fx })
player.setViewModelVisible(false)

const enemies = new EnemyManager({ scene, player, fx, audio })

/* ============================================================
   后期
   ============================================================ */

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
// 第一人称武器单独渲染，只清深度
const vmPass = new RenderPass(player.vmScene, player.vmCamera)
vmPass.clear = false
vmPass.clearDepth = true
composer.addPass(vmPass)
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isCoarse ? 0.4 : 0.52,
  0.68,
  0.88
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

/* ============================================================
   输入
   ============================================================ */

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jumpPressed: false,
  dashPressed: false,
  reloadPressed: false,
  skillPressed: false,
  shoot: false,
  aim: false,
  lookX: 0,
  lookY: 0,
}

const keys = Object.create(null)

const game = {
  mode: 'title',
  chapter: 0,
  phase: 'travel',
  waveIndex: 0,
  waveActive: false,
  waveClearing: false,
  tokens: 0,
  kills: 0,
  upgrades: 0,
  elapsed: 0,
  repairProgress: 0,
  repairing: false,
  repairTick: 0,
  pending: null,
  titleTime: 0,
  victoryTime: 0,
  lockWanted: false,
}

const _tmp = new THREE.Vector3()
const _tmp2 = new THREE.Vector3()

/* ============================================================
   工具
   ============================================================ */

function schedule(delay, fn) {
  game.pending = { t: delay, fn }
}

function processPending(dt) {
  if (!game.pending) return
  game.pending.t -= dt
  if (game.pending.t <= 0) {
    const fn = game.pending.fn
    game.pending = null
    fn()
  }
}

function requestLock() {
  game.lockWanted = true
  if (document.pointerLockElement === canvas) return
  try {
    const p = canvas.requestPointerLock()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch (e) {
    /* 忽略：部分环境不支持指针锁定 */
  }
}

function exitLock() {
  game.lockWanted = false
  if (document.pointerLockElement === canvas) {
    try {
      document.exitPointerLock()
    } catch (e) {
      /* noop */
    }
  }
}

function objectivePosition() {
  if (game.phase === 'repair' || game.phase === 'travel') {
    return new THREE.Vector3(TURBINE.x, TURBINE.baseY + 9, TURBINE.z + 6)
  }
  return null
}

/** 射线与涡轮机塔身（近似圆柱）的最近交点距离 */
function towerRayT(origin, dir) {
  const R = 3.9
  const ox = origin.x - TURBINE.x
  const oz = origin.z - TURBINE.z
  const a = dir.x * dir.x + dir.z * dir.z
  if (a < 1e-5) return null
  const b = 2 * (ox * dir.x + oz * dir.z)
  const c = ox * ox + oz * oz - R * R
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t <= 0) return null
  const y = origin.y + dir.y * t
  if (y < TURBINE.baseY || y > TURBINE.baseY + TURBINE.height) return null
  return t
}

/* ============================================================
   游戏流程
   ============================================================ */

function beginExpedition() {
  audio.init()
  audio.ui()
  ui.showScreen(null)
  ui.showHUD(true)
  ui.fade(false)
  resetRun()
  game.mode = 'play'
  requestLock()
}

function resetRun() {
  game.chapter = 0
  game.phase = 'travel'
  game.waveIndex = 0
  game.waveActive = false
  game.waveClearing = false
  game.tokens = 0
  game.kills = 0
  game.upgrades = 0
  game.elapsed = 0
  game.repairProgress = 0
  game.repairing = false
  game.pending = null
  game.victoryTime = 0

  player.reset(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), false)
  player.root.visible = true
  player.setViewModelVisible(true)
  enemies.clear()
  fx.clear()
  world.turbine.reset()
  game.tipShown = false

  ui.setTokens(0)
  ui.setChapter(0, CHAPTERS[0].name)
  ui.setWaveDots(3, -1, 0)
  ui.setWaveLine('第 1 章 · 启程')
  ui.setObjective(CHAPTERS[0].objective, 0)
  ui.setPrompt(false)
  ui.hideDialogue()
  ui.hideWaypoint()
  ui.setHealth(player.hp, player.maxHp)
  ui.setAmmo(player.ammo, player.magSize, false, 0)
  ui.setSkill(1, true)
  ui.setDashSkill(1, true)
  ui.setDash(1)
  ui.setAiming(false)

  setTimeout(() => {
    if (game.mode !== 'play') return
    ui.banner(CHAPTERS[0].kicker, CHAPTERS[0].name, CHAPTERS[0].sub, 3000)
    ui.dialogue('VELA', '信号就在前面。Cirrus Reach 的涡轮机停了三年 —— 今天它得重新转起来。', 6200)
    ui.toast('WASD 移动 · SPACE 跳跃 · SHIFT 冲刺 · 左键射击', 'teal', 5200)
  }, 700)
}

function arriveAtTurbine() {
  if (game.chapter !== 0) return
  game.chapter = 1
  game.phase = 'wave'
  ui.setChapter(1, CHAPTERS[1].name)
  ui.setWaveLine('第 2 章 · 失落的信号')
  ui.banner('CHAPTER II', CHAPTERS[1].name, CHAPTERS[1].sub, 3000)
  ui.dialogue('VELA', '风之守卫……它们还守着一座死掉的站点。准备迎接第一波。', 5200)
  player.heal(15)
  schedule(2.4, () => startWave(0))
}

function startWave(index) {
  game.waveIndex = index
  game.waveActive = true
  game.waveClearing = false
  game.phase = 'wave'
  const def = WAVES[index]
  enemies.spawnWave(def, new THREE.Vector3(ARENA.x, ARENA.y, ARENA.z))
  audio.waveStart()
  ui.setWaveDots(3, index, index)
  ui.setWaveLine(`第 ${index + 1} 波 / 3 · 交战中`)
  ui.banner(`WAVE ${index + 1} / 3`, def.name, def.sub, 2800)
  const lines = [
    '三波守卫。打穿它们，涡轮机才能重新咬合。',
    '增援来了。别站在同一个地方太久。',
    '那是风帆守卫长 —— 它护着核心。先解决它。',
  ]
  ui.dialogue('VELA', lines[index] || '', 4800)
}

function onWaveCleared() {
  game.waveActive = false
  game.waveClearing = true
  audio.waveClear()
  addTokens(2, true)
  if (game.waveIndex < 2) {
    ui.banner('WAVE CLEARED', `第 ${game.waveIndex + 1} 波清除`, '调整呼吸 · 收集代币', 2600)
    ui.toast('+2 线圈代币 · 波次奖励', 'teal')
    schedule(4, () => startWave(game.waveIndex + 1))
  } else {
    ui.banner('SIGNAL CLEAR', '守卫已清除', '核心暴露', 2800)
    schedule(3.2, beginRepair)
  }
}

function beginRepair() {
  game.chapter = 2
  game.phase = 'repair'
  game.repairProgress = 0
  ui.setChapter(2, CHAPTERS[2].name)
  ui.setWaveDots(3, -1, 3)
  ui.setWaveLine('第 3 章 · 风之核心')
  ui.banner('CHAPTER III', CHAPTERS[2].name, CHAPTERS[2].sub, 3000)
  ui.dialogue('VELA', '核心还在。把线圈接回去，剩下的交给风。靠近控制台，按住 E。', 6000)
}

function completeRepair() {
  if (game.phase === 'victory') return
  game.phase = 'victory'
  game.repairing = false
  game.victoryTime = 0
  player.heal(999)
  world.turbine.setRepaired()
  audio.setRepaired()
  audio.victory()
  ui.setPrompt(false)
  ui.hideWaypoint()
  ui.banner('TURBINE ONLINE', '风之核心重启', '信号正在扩散', 4200)
  ui.dialogue('VELA', '听见了吗？云海下面有回声。那不是我们的信号。', 6500)
  const c = new THREE.Vector3(TURBINE.x, TURBINE.baseY + 2, TURBINE.z + 6)
  fx.burst(c, 0x9dfff1, 60, 12, 1.2, 0.3)
  fx.ring(c, 0x9dfff1, 22, 1.4)
  for (let i = 0; i < 6; i++) {
    fx.ring(new THREE.Vector3(TURBINE.x, TURBINE.baseY + 6 + i * 4, TURBINE.z), 0x6ff5e4, 14 + i * 2, 1.6)
  }
  schedule(4.2, showVictory)
}

function showVictory() {
  game.mode = 'victory'
  game.victoryTime = 0
  player.setViewModelVisible(false)
  exitLock()
  ui.showHUD(false)
  const minutes = Math.floor(game.elapsed / 60)
  const seconds = Math.floor(game.elapsed % 60)
  ui.setVictoryStats({
    time: `${minutes}:${String(seconds).padStart(2, '0')}`,
    kills: game.kills,
    tokens: game.tokens,
    upgrades: `${game.upgrades} / ${UPGRADE_TIERS.length}`,
  })
  ui.showScreen('victory')
}

function onDeath() {
  input.shoot = false
  input.aim = false
  player.setViewModelVisible(false)
  audio.explode(true)
  fx.burst(player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff8a6b, 40, 9, 1, 0.22)
  fx.ring(player.position.clone(), 0xff8a6b, 8, 0.9)
  game.mode = 'dead'
  exitLock()
  setTimeout(() => {
    if (game.mode !== 'dead') return
    ui.setDeadStats({
      wave: game.chapter === 0 ? '尚未抵达' : `第 ${game.waveIndex + 1} 波`,
      kills: game.kills,
      tokens: game.tokens,
    })
    ui.showScreen('dead')
    ui.showHUD(false)
  }, 700)
}

function retry() {
  audio.ui()
  ui.showScreen(null)
  ui.showHUD(true)
  game.mode = 'play'
  game.pending = null
  input.shoot = false
  input.aim = false
  input.lookX = 0
  input.lookY = 0
  player.setViewModelVisible(true)
  enemies.clear()
  fx.clear()
  ui.hideDialogue()
  ui.setPrompt(false)
  game.repairProgress = 0

  if (game.chapter === 0) {
    game.phase = 'travel'
    player.reset(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), true)
    ui.setWaveLine('第 1 章 · 启程')
  } else if (game.chapter === 1) {
    game.phase = 'wave'
    player.reset(new THREE.Vector3(ARENA.x, ARENA.y + 0.5, ARENA.z + 15), true)
    game.waveClearing = false
    game.waveActive = false
    ui.setWaveLine(`第 ${game.waveIndex + 1} 波 / 3 · 重整`)
    schedule(1.4, () => startWave(game.waveIndex))
  } else {
    game.phase = 'repair'
    player.reset(new THREE.Vector3(ARENA.x, ARENA.y + 0.5, ARENA.z + 15), true)
    ui.setWaveLine('第 3 章 · 风之核心')
  }
  ui.setHealth(player.hp, player.maxHp)
  requestLock()
}

function pauseGame() {
  if (game.mode !== 'play') return
  game.mode = 'paused'
  input.shoot = false
  input.aim = false
  input.lookX = 0
  input.lookY = 0
  exitLock()
  ui.setPauseStats({
    chapter: `${['I', 'II', 'III'][game.chapter]} · ${CHAPTERS[game.chapter].name}`,
    wave: game.chapter === 1 ? `第 ${game.waveIndex + 1} 波 / 3` : game.chapter === 0 ? '行进中' : '修复阶段',
    tokens: game.tokens,
    kills: game.kills,
  })
  ui.showScreen('pause')
}

function resumeGame() {
  if (game.mode !== 'paused') return
  audio.ui()
  game.mode = 'play'
  ui.showScreen(null)
  requestLock()
}

function quitToTitle() {
  audio.ui()
  exitLock()
  game.mode = 'title'
  game.pending = null
  enemies.clear()
  fx.clear()
  player.setViewModelVisible(false)
  ui.showScreen('title')
  ui.showHUD(false)
  ui.setPrompt(false)
  ui.hideWaypoint()
  ui.hideDialogue()
}

/* ============================================================
   代币 / 升级
   ============================================================ */

function addTokens(n, silent = false) {
  game.tokens += n
  ui.setTokens(game.tokens)
  while (
    game.upgrades < UPGRADE_TIERS.length &&
    game.tokens >= UPGRADE_TIERS[game.upgrades].at
  ) {
    const tier = UPGRADE_TIERS[game.upgrades]
    game.upgrades++
    player.applyUpgrade(tier.id)
    audio.upgrade()
    ui.toast(`改装解锁 · ${tier.label}`, 'teal', 4200)
  }
  if (!silent && game.tokens % 5 === 0) {
    ui.toast(`线圈代币 × ${game.tokens}`, 'teal', 1800)
  }
}

function dropTokens(pos, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 1 + Math.random() * 2.6
    const x = pos.x + Math.cos(a) * r
    const z = pos.z + Math.sin(a) * r
    const g = sampleGround(x, z, ARENA.y + 2)
    const y = (g === -Infinity ? ARENA.y : g) + 1.45
    world.addToken(new THREE.Vector3(x, y, z))
  }
}

/* ============================================================
   战斗事件
   ============================================================ */

player.onShoot = (origin, dir, muzzleWorld) => {
  audio.shot()
  fx.muzzle(muzzleWorld, 0.4)

  // 涡轮机塔身会挡住子弹
  const towerT = towerRayT(origin, dir)
  const maxDist = towerT !== null ? Math.min(150, towerT) : 150
  const hit = enemies.hitTest(origin, dir, maxDist)
  let endPoint
  if (hit) {
    endPoint = hit.point
    fx.tracer(muzzleWorld, endPoint, 0xbafff6)
    const killed = enemies.damage(hit.enemy, player.damage, hit.point, dir)
    player.shotsHit++
    ui.hitmarker()
    if (killed) {
      game.kills++
      ui.toast(`击坠 · ${hit.enemy.cfg.name}`, 'amber', 1500)
      dropTokens(hit.enemy.pos, hit.enemy.cfg.drop)
    }
  } else if (towerT !== null && towerT < 90) {
    endPoint = origin.clone().addScaledVector(dir, towerT)
    fx.tracer(muzzleWorld, endPoint, 0xbafff6)
    fx.sparks(endPoint, 0x9dfff1, 6, 5, 0.4)
  } else {
    endPoint = origin.clone().addScaledVector(dir, 90)
    fx.tracer(muzzleWorld, endPoint, 0xbafff6)
  }
}

player.onSkill = (pos) => {
  audio.skill()
  fx.ring(pos, 0x9dfff1, PCFG.skillRadius + 1, 0.55)
  fx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x9dfff1, 40, 9, 0.7, 0.18)
  player.shake = Math.min(0.9, player.shake + 0.4)
  for (const e of [...enemies.enemies]) {
    const d = e.pos.distanceTo(pos)
    if (d < PCFG.skillRadius) {
      const dir = e.pos.clone().sub(pos).normalize()
      const killed = enemies.damage(e, PCFG.skillDamage, e.pos.clone(), dir)
      e.vel.addScaledVector(dir, 9)
      if (killed) {
        game.kills++
        ui.toast(`击坠 · ${e.cfg.name}`, 'amber', 1500)
        dropTokens(e.pos, e.cfg.drop)
      }
    }
  }
  ui.hitmarker()
}

player.onDamage = () => {
  ui.damage()
  audio.hurt()
}

player.onDeath = () => {
  onDeath()
}

player.onFall = () => {
  ui.toast('风把你托回了安全处 · -16 HP', 'amber', 2600)
  audio.land()
}

player.onJump = () => audio.jump()
player.onDash = (dir) => {
  audio.dash()
  const p = player.position.clone().add(new THREE.Vector3(0, 0.8, 0))
  fx.burst(p, 0x9dfff1, 14, 3, 0.4, 0.12)
  fx.ring(p, 0x9dfff1, 2.6, 0.35)
}
player.onLand = (pos) => {
  audio.land()
  fx.burst(pos, 0xd8fbf4, 8, 2, 0.35, 0.1)
}
player.onReload = (done) => {
  if (done) audio.reloadEnd()
  else audio.reloadStart()
}

enemies.onKill = () => {
  // 击坠统计与掉落由主流程在命中时处理
}

/* ============================================================
   每帧逻辑
   ============================================================ */

function updateTitleCamera(dt) {
  game.titleTime += dt
  const t = game.titleTime
  const radius = 76 + Math.sin(t * 0.16) * 7
  const angle = t * 0.1 + 1.15
  camera.position.set(
    Math.sin(angle) * radius,
    29 + Math.sin(t * 0.2) * 3.5,
    Math.cos(angle) * radius - 4
  )
  camera.lookAt(0, 14, -4)
  camera.fov = 52
  camera.updateProjectionMatrix()
}

function updateVictoryCamera(dt) {
  game.victoryTime += dt
  const t = game.victoryTime
  const radius = 34 - Math.min(10, t * 0.6)
  const angle = 0.7 + t * 0.1
  camera.position.set(Math.sin(angle) * radius, 16 + Math.sin(t * 0.3) * 2, Math.cos(angle) * radius - 4)
  camera.lookAt(0, 22, -4)
  camera.fov = 56
  camera.updateProjectionMatrix()
}

function updateHUD(dt) {
  ui.setHealth(player.hp, player.maxHp)
  ui.setAmmo(player.ammo, player.magSize, player.reloading, 1 - player.reloadT / PCFG.reloadTime)
  const skillRatio = 1 - player.skillCd / (PCFG.skillCd * player.upgrades.cooldown)
  ui.setSkill(skillRatio, player.skillCd <= 0)
  ui.setDashSkill(1 - player.dashCd / PCFG.dashCd, player.dashCd <= 0)
  ui.setDash(1 - player.dashCd / PCFG.dashCd)
  ui.setAiming(player.aiming)

  const target = objectivePosition()
  if (target) {
    const dist = player.position.distanceTo(target)
    ui.updateWaypoint(camera, target, player.position)
    if (game.phase === 'travel') ui.setObjective(CHAPTERS[0].objective, dist)
    else if (game.phase === 'repair') ui.setObjective(CHAPTERS[2].objective, dist)
  } else {
    ui.hideWaypoint()
    if (game.phase === 'wave') {
      const remain = enemies.enemies.length
      ui.setObjective(
        game.waveActive ? `抵御第 ${game.waveIndex + 1} 波守卫` : '准备迎接下一波守卫',
        null
      )
      ui.setWaveLine(
        game.waveActive ? `第 ${game.waveIndex + 1} 波 / 3 · 剩余 ${remain}` : `第 ${game.waveIndex + 1} 波 / 3 · 已清除`
      )
    }
  }

  if (game.phase === 'repair') {
    const consolePos = world.turbine.consolePosition
    const d = player.position.distanceTo(consolePos)
    const near = d < 8.5
    ui.setPrompt(near, game.repairProgress, game.repairProgress > 0 ? '正在接入线圈…' : '按住 E 修复涡轮机')
    if (near) {
      if (keys.KeyE && player.alive) {
        game.repairing = true
        game.repairProgress = Math.min(1, game.repairProgress + dt / 3.2)
        game.repairTick -= dt
        if (game.repairTick <= 0) {
          game.repairTick = 0.42
          audio.repairTick()
          fx.sparks(consolePos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x9dfff1, 4, 2, 0.5)
        }
        if (game.repairProgress >= 1) completeRepair()
      } else {
        game.repairing = false
        game.repairProgress = Math.max(0, game.repairProgress - dt * 0.35)
      }
    } else {
      ui.setPrompt(false)
      game.repairProgress = Math.max(0, game.repairProgress - dt * 0.5)
    }
  } else {
    ui.setPrompt(false)
  }
}

function updateGame(dt) {
  syncMoveKeys()
  game.elapsed += dt
  processPending(dt)

  player.update(dt, input)
  enemies.update(dt, game.elapsed)

  // 代币拾取
  const center = _tmp.copy(player.position).add(new THREE.Vector3(0, 1, 0))
  for (const token of world.tokens) {
    if (!token.alive) continue
    if (token.group.position.distanceTo(center) < 2.3) {
      world.collectToken(token)
      audio.pickup()
      fx.burst(token.group.position, 0x9dfff1, 14, 3.5, 0.5, 0.1)
      addTokens(1)
    }
  }

  // 章节推进
  if (game.phase === 'travel') {
    const d = Math.hypot(player.position.x - ARENA.x, player.position.z - ARENA.z)
    if (d < 20 && player.position.y > ARENA.y - 1.5) arriveAtTurbine()
  }

  // 波次状态
  if (game.phase === 'wave' && game.waveActive && !game.waveClearing) {
    if (enemies.enemies.length === 0) onWaveCleared()
  }

  // 低血量提示
  updateHUD(dt)

  // 首次拾取代币的提示
  if (game.tokens === 1 && !game.tipShown) {
    game.tipShown = true
    ui.toast('线圈代币可用于自动改装武器', 'teal', 4200)
  }
}

/* ============================================================
   主循环
   ============================================================ */

let last = performance.now()
let elapsed = 0

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  elapsed += dt

  world.update(elapsed, dt)
  fx.update(dt, elapsed)

  if (game.mode === 'play') {
    updateGame(dt)
  } else if (game.mode === 'title') {
    updateTitleCamera(dt)
    updateHUDIdle()
  } else if (game.mode === 'victory') {
    updateVictoryCamera(dt)
  }

  composer.render()
  requestAnimationFrame(frame)
}

function updateHUDIdle() {
  // 标题界面下保持 HUD 隐藏
}

/* ============================================================
   事件绑定
   ============================================================ */

const btnStart = document.getElementById('btn-start')
const btnSound = document.getElementById('btn-sound')
const btnResume = document.getElementById('btn-resume')
const btnPauseSound = document.getElementById('btn-pause-sound')
const btnQuit = document.getElementById('btn-quit')
const btnRetry = document.getElementById('btn-retry')
const btnDeadQuit = document.getElementById('btn-dead-quit')
const btnAgain = document.getElementById('btn-again')
const btnVictoryQuit = document.getElementById('btn-victory-quit')

btnStart.addEventListener('click', beginExpedition)
btnResume.addEventListener('click', resumeGame)
btnRetry.addEventListener('click', retry)
btnAgain.addEventListener('click', beginExpedition)
btnQuit.addEventListener('click', quitToTitle)
btnDeadQuit.addEventListener('click', quitToTitle)
btnVictoryQuit.addEventListener('click', quitToTitle)

function toggleSound() {
  audio.init()
  const muted = audio.toggleMuted()
  ui.setSoundLabel(muted)
  if (!muted) audio.ui()
}
btnSound.addEventListener('click', toggleSound)
btnPauseSound.addEventListener('click', toggleSound)

window.addEventListener('keydown', (e) => {
  keys[e.code] = true

  if (game.mode === 'title' && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault()
    beginExpedition()
    return
  }

  if (game.mode === 'play') {
    if (e.code === 'Space') {
      e.preventDefault()
      input.jumpPressed = true
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashPressed = true
    if (e.code === 'KeyR') input.reloadPressed = true
    if (e.code === 'KeyQ') input.skillPressed = true
    if (e.code === 'Escape') pauseGame()
  } else if (game.mode === 'paused' && e.code === 'Escape') {
    resumeGame()
  }
})

window.addEventListener('keyup', (e) => {
  keys[e.code] = false
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = false
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false
})

window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false
  input.forward = input.back = input.left = input.right = false
  input.shoot = false
  input.aim = false
})

function syncMoveKeys() {
  input.forward = !!(keys.KeyW || keys.ArrowUp)
  input.back = !!(keys.KeyS || keys.ArrowDown)
  input.left = !!(keys.KeyA || keys.ArrowLeft)
  input.right = !!(keys.KeyD || keys.ArrowRight)
}

canvas.addEventListener('mousedown', (e) => {
  if (game.mode === 'title') {
    return
  }
  if (game.mode === 'play') {
    if (document.pointerLockElement !== canvas) {
      requestLock()
      return
    }
    if (e.button === 0) input.shoot = true
    if (e.button === 2) input.aim = true
  }
})

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.shoot = false
  if (e.button === 2) input.aim = false
})

window.addEventListener('contextmenu', (e) => e.preventDefault())

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return
  input.lookX += e.movementX || 0
  input.lookY += e.movementY || 0
})

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas
  if (!locked && game.mode === 'play') {
    // 用户按 ESC 或切走窗口
    pauseGame()
  }
})

/* ============================================================
   自适应
   ============================================================ */

window.addEventListener('resize', () => {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.3 : 1.8))
  renderer.setSize(w, h)
  composer.setSize(w, h)
  bloom.setSize(w, h)
  if (player.vmCamera) {
    player.vmCamera.aspect = w / h
    player.vmCamera.updateProjectionMatrix()
  }
})

/* ============================================================
   启动
   ============================================================ */

ui.showScreen('title')
ui.showHUD(false)
ui.setSoundLabel(false)
player.setViewModelVisible(false)

requestAnimationFrame(frame)

// 方便调试
window.__nimbus = { game, player, enemies, world, camera, renderer, scene, audio, ui, input, fx, composer, bloom, THREE }
