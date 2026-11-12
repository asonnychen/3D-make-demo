import * as THREE from 'three'
import { PLAYER, SPAWN, TURBINE, PLATFORMS } from './config.js'
import { sampleGround } from './world.js'

const UP = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()

const EYE_HEIGHT = 1.68
const FOV_HIP = 70
const FOV_AIM = 52

/* ============================================================
   工程师模型（第三人称残留：只用于投射阴影）
   ============================================================ */

function buildEngineerModel() {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const suit = new THREE.MeshStandardMaterial({ color: 0x33484e, roughness: 0.72, metalness: 0.22 })
  const plate = new THREE.MeshStandardMaterial({ color: 0x6d8489, roughness: 0.45, metalness: 0.55 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2a2f, roughness: 0.6, metalness: 0.4 })
  const accent = new THREE.MeshStandardMaterial({
    color: 0x2ee6c8,
    emissive: 0x2ee6c8,
    emissiveIntensity: 1.55,
    roughness: 0.3,
    metalness: 0.2,
  })
  const amber = new THREE.MeshStandardMaterial({
    color: 0xffb87a,
    emissive: 0xff9d4d,
    emissiveIntensity: 1.1,
    roughness: 0.4,
  })
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0b1b20,
    emissive: 0x5ff3e0,
    emissiveIntensity: 1.2,
    roughness: 0.15,
    metalness: 0.8,
  })

  const mk = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const legL = new THREE.Group()
  legL.position.set(-0.17, 0.94, 0)
  body.add(legL)
  legL.add(mk(new THREE.BoxGeometry(0.2, 0.72, 0.24), suit, 0, -0.36, 0))
  legL.add(mk(new THREE.BoxGeometry(0.22, 0.3, 0.28), plate, 0, -0.72, 0.02))
  legL.add(mk(new THREE.BoxGeometry(0.2, 0.14, 0.34), dark, 0, -0.9, 0.06))
  legL.add(mk(new THREE.BoxGeometry(0.03, 0.3, 0.02), accent, -0.11, -0.34, 0.12))

  const legR = legL.clone()
  legR.position.x = 0.17
  body.add(legR)

  body.add(mk(new THREE.BoxGeometry(0.44, 0.22, 0.32), dark, 0, 0.96, 0))
  body.add(mk(new THREE.BoxGeometry(0.46, 0.06, 0.34), plate, 0, 1.02, 0))

  const torso = new THREE.Group()
  torso.position.y = 1.28
  body.add(torso)
  torso.add(mk(new THREE.BoxGeometry(0.56, 0.56, 0.34), suit, 0, 0.2, 0))
  torso.add(mk(new THREE.BoxGeometry(0.5, 0.22, 0.38), plate, 0, 0.42, 0.01))
  torso.add(mk(new THREE.BoxGeometry(0.42, 0.2, 0.05), dark, 0, 0.16, 0.19))
  torso.add(mk(new THREE.BoxGeometry(0.26, 0.04, 0.04), accent, 0, 0.27, 0.2))
  torso.add(mk(new THREE.BoxGeometry(0.16, 0.14, 0.06), amber, -0.16, 0.02, 0.19))
  torso.add(mk(new THREE.BoxGeometry(0.2, 0.15, 0.42), plate, -0.36, 0.42, 0))
  torso.add(mk(new THREE.BoxGeometry(0.2, 0.15, 0.42), plate, 0.36, 0.42, 0))
  torso.add(mk(new THREE.BoxGeometry(0.03, 0.09, 0.3), accent, -0.46, 0.44, 0))
  torso.add(mk(new THREE.BoxGeometry(0.03, 0.09, 0.3), accent, 0.46, 0.44, 0))
  torso.add(mk(new THREE.BoxGeometry(0.055, 0.26, 0.02), accent, 0, 0.16, -0.19))

  body.add(mk(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 8), dark, 0, 1.82, 0))

  const pack = new THREE.Group()
  pack.position.set(0, 1.52, -0.27)
  body.add(pack)
  pack.add(mk(new THREE.BoxGeometry(0.34, 0.38, 0.18), dark, 0, 0, 0))
  pack.add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8), accent, -0.105, 0.02, -0.12))
  pack.add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8), amber, 0.105, 0.02, -0.12))
  pack.add(mk(new THREE.BoxGeometry(0.3, 0.06, 0.03), plate, 0, 0.14, -0.11))

  const head = new THREE.Group()
  head.position.y = 1.92
  body.add(head)
  head.add(mk(new THREE.SphereGeometry(0.2, 14, 12), suit, 0, 0, 0))
  head.add(mk(new THREE.BoxGeometry(0.36, 0.06, 0.34), plate, 0, -0.12, 0))
  head.add(mk(new THREE.BoxGeometry(0.34, 0.12, 0.1), visorMat, 0, 0.02, 0.15))
  head.add(mk(new THREE.BoxGeometry(0.3, 0.06, 0.06), plate, 0, 0.16, 0.06))
  head.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), dark, 0.14, 0.22, -0.06))
  head.add(mk(new THREE.SphereGeometry(0.03, 6, 6), amber, 0.14, 0.4, -0.06))

  const armL = new THREE.Group()
  armL.position.set(-0.33, 1.72, 0)
  body.add(armL)
  armL.add(mk(new THREE.BoxGeometry(0.15, 0.46, 0.16), suit, 0, -0.22, 0))
  armL.add(mk(new THREE.BoxGeometry(0.17, 0.16, 0.2), plate, 0, -0.46, 0.02))

  const armR = new THREE.Group()
  armR.position.set(0.33, 1.72, 0)
  body.add(armR)
  armR.add(mk(new THREE.BoxGeometry(0.15, 0.46, 0.16), suit, 0, -0.22, 0))
  armR.add(mk(new THREE.BoxGeometry(0.17, 0.16, 0.2), plate, 0, -0.46, 0.02))
  armR.add(mk(new THREE.BoxGeometry(0.04, 0.1, 0.03), accent, 0.09, -0.3, 0.02))

  const weapon = new THREE.Group()
  weapon.position.set(0.31, 1.46, 0.2)
  weapon.rotation.y = -0.09
  body.add(weapon)
  weapon.add(mk(new THREE.BoxGeometry(0.11, 0.13, 0.56), dark, 0, 0, 0.14))
  weapon.add(mk(new THREE.BoxGeometry(0.09, 0.05, 0.4), plate, 0, 0.08, 0.16))
  const barrel = mk(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 8), plate, 0, 0.01, 0.6)
  barrel.rotation.x = Math.PI / 2
  weapon.add(barrel)
  weapon.add(mk(new THREE.BoxGeometry(0.1, 0.08, 0.12), accent, 0, 0.02, 0.44))

  root.scale.setScalar(0.94)
  return { root, body, legL, legR, armL, armR, torso, head, weapon, pack }
}

/* ============================================================
   第一人称武器与手臂
   ============================================================ */

function makeLimb(material) {
  const geo = new THREE.CylinderGeometry(0.032, 0.05, 1, 8)
  geo.rotateX(Math.PI / 2)
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.05, 0.085), material)
  hand.castShadow = false
  hand.receiveShadow = false
  return {
    mesh,
    hand,
    set(from, to) {
      _v4.copy(to).sub(from)
      const len = _v4.length()
      mesh.position.copy(from).addScaledVector(_v4, 0.5)
      _v4.normalize()
      mesh.quaternion.setFromUnitVectors(Z_AXIS, _v4)
      mesh.scale.set(1, 1, len)
      hand.position.copy(to)
      hand.quaternion.copy(mesh.quaternion)
    },
  }
}

function buildViewModel() {
  const root = new THREE.Group()
  const rig = new THREE.Group()
  root.add(rig)

  const metal = new THREE.MeshStandardMaterial({ color: 0x4c6269, roughness: 0.62, metalness: 0.38 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a383d, roughness: 0.8, metalness: 0.2 })
  const light = new THREE.MeshStandardMaterial({ color: 0x80959a, roughness: 0.55, metalness: 0.4 })
  const accent = new THREE.MeshStandardMaterial({
    color: 0x2ee6c8,
    emissive: 0x2ee6c8,
    emissiveIntensity: 1.9,
    roughness: 0.3,
  })
  const amber = new THREE.MeshStandardMaterial({
    color: 0xffb87a,
    emissive: 0xff9d4d,
    emissiveIntensity: 1.3,
    roughness: 0.4,
  })
  const glove = new THREE.MeshStandardMaterial({ color: 0x2f3d43, roughness: 0.9, metalness: 0.1 })

  const mk = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = false
    m.receiveShadow = false
    return m
  }

  const rifle = new THREE.Group()
  rifle.position.set(0.26, -0.19, -0.6)
  rifle.rotation.set(0.08, 0.07, 0)
  rifle.scale.setScalar(0.8)
  rig.add(rifle)

  // 机匣与上导轨
  rifle.add(mk(new THREE.BoxGeometry(0.078, 0.09, 0.34), metal, 0, 0, 0.05))
  rifle.add(mk(new THREE.BoxGeometry(0.07, 0.028, 0.3), dark, 0, 0.058, 0.06))

  // 护木
  rifle.add(mk(new THREE.BoxGeometry(0.064, 0.07, 0.28), dark, 0, 0.002, -0.25))
  for (let i = 0; i < 3; i++) {
    rifle.add(mk(new THREE.BoxGeometry(0.07, 0.008, 0.02), light, 0, 0.025, -0.16 - i * 0.07))
  }

  // 枪管与消焰器
  const barrel = mk(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), light, 0, 0.01, -0.45)
  barrel.rotation.x = Math.PI / 2
  rifle.add(barrel)
  const brake = mk(new THREE.CylinderGeometry(0.026, 0.031, 0.07, 8), dark, 0, 0.01, -0.575)
  brake.rotation.x = Math.PI / 2
  rifle.add(brake)
  rifle.add(mk(new THREE.BoxGeometry(0.012, 0.02, 0.06), accent, 0.032, 0.01, -0.57))

  // 瞄具
  rifle.add(mk(new THREE.BoxGeometry(0.052, 0.045, 0.11), dark, 0, 0.088, 0.03))
  rifle.add(mk(new THREE.BoxGeometry(0.036, 0.036, 0.006), accent, 0, 0.088, -0.025))
  rifle.add(mk(new THREE.BoxGeometry(0.018, 0.018, 0.02), amber, 0, 0.088, 0.005))

  // 枪托与握把
  const stock = mk(new THREE.BoxGeometry(0.05, 0.07, 0.16), metal, 0, -0.008, 0.25)
  stock.rotation.x = 0.04
  rifle.add(stock)
  rifle.add(mk(new THREE.BoxGeometry(0.055, 0.018, 0.05), dark, 0, 0.028, 0.2))
  const grip = mk(new THREE.BoxGeometry(0.048, 0.13, 0.07), dark, 0, -0.105, 0.11)
  grip.rotation.x = -0.28
  rifle.add(grip)

  // 弹匣井与弹匣
  rifle.add(mk(new THREE.BoxGeometry(0.056, 0.05, 0.1), dark, 0, -0.062, 0.02))
  const mag = new THREE.Group()
  mag.position.set(0, -0.085, 0.02)
  rifle.add(mag)
  const magBody = mk(new THREE.BoxGeometry(0.045, 0.17, 0.085), dark, 0, -0.085, 0.01)
  magBody.rotation.x = 0.12
  mag.add(magBody)
  mag.add(mk(new THREE.BoxGeometry(0.047, 0.018, 0.087), accent, 0, -0.14, 0.012))

  // 拉机柄与侧能量条
  const bolt = mk(new THREE.BoxGeometry(0.028, 0.018, 0.05), light, 0.045, 0.05, 0.17)
  rifle.add(bolt)
  rifle.add(mk(new THREE.BoxGeometry(0.008, 0.012, 0.16), accent, 0.042, 0.0, 0.02))

  // 枪口锚点
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.01, -0.63)
  rifle.add(muzzle)

  // 手臂
  const rightArm = makeLimb(glove)
  const leftArm = makeLimb(glove)
  rig.add(rightArm.mesh, rightArm.hand, leftArm.mesh, leftArm.hand)

  return {
    root,
    rig,
    rifle,
    mag,
    bolt,
    muzzle,
    rightArm,
    leftArm,
    hip: new THREE.Vector3(0.26, -0.19, -0.6),
    ads: new THREE.Vector3(0, -0.1, -0.68),
    magBaseY: -0.085,
    boltBaseZ: 0.17,
    rightFrom: new THREE.Vector3(0.38, -0.55, -0.42),
    leftFrom: new THREE.Vector3(0.04, -0.58, -0.42),
    guardLocal: new THREE.Vector3(0, -0.005, -0.25),
    magLocal: new THREE.Vector3(0, -0.16, 0.02),
  }
}

/* ============================================================
   玩家
   ============================================================ */

export class Player {
  constructor({ scene, camera, audio, fx }) {
    this.scene = scene
    this.camera = camera
    this.audio = audio
    this.fx = fx

    this.model = buildEngineerModel()
    this.root = this.model.root
    scene.add(this.root)
    // 第三人称身体只保留投影，不进入第一人称相机
    this.root.traverse((o) => o.layers.set(1))

    this.viewModel = buildViewModel()
    this.viewModel.root.visible = false

    // 第一人称武器使用独立的场景与相机，避免被世界 FOV 拉伸
    this.vmScene = new THREE.Scene()
    this.vmCamera = new THREE.PerspectiveCamera(58, camera.aspect, 0.01, 10)
    this.vmScene.add(this.vmCamera)
    this.vmCamera.add(this.viewModel.root)

    const vmHemi = new THREE.HemisphereLight(0xd8f4f2, 0x3a4d4d, 1.35)
    this.vmScene.add(vmHemi)
    const vmKey = new THREE.DirectionalLight(0xfff0dc, 1.75)
    vmKey.position.set(-1.2, 2.0, 1.8)
    this.vmScene.add(vmKey)
    const vmFill = new THREE.DirectionalLight(0x6fe6d8, 0.85)
    vmFill.position.set(2, 0.8, -1.5)
    this.vmScene.add(vmFill)

    camera.rotation.order = 'YXZ'

    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.spawnPoint = new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z)
    this.lastSafe = this.spawnPoint.clone()

    this.maxHp = PLAYER.maxHp
    this.hp = PLAYER.maxHp
    this.alive = true
    this.ammo = PLAYER.magSize
    this.magSize = PLAYER.magSize
    this.reloading = false
    this.reloadT = 0
    this.reloadStage = 0
    this.fireT = 0
    this.dashT = 0
    this.dashCd = 0
    this.skillCd = 0
    this.invuln = 0
    this.noDamageT = 0
    this.grounded = false
    this.coyote = 0
    this.jumpBuf = 0
    this.walkPhase = 0
    this.bobPhase = 0
    this.modelYaw = Math.PI
    this.yaw = Math.PI
    this.pitch = 0.12
    this.aiming = false
    this.aimMix = 0
    this.shake = 0
    this.recoil = 0
    this.swayX = 0
    this.swayY = 0
    this.prevYaw = Math.PI
    this.prevPitch = 0.12
    this.strafeLean = 0
    this.deathTilt = 0
    this.fov = FOV_HIP
    this.dashDir = new THREE.Vector3()
    this.deadT = 0
    this.upgrades = { damage: 1, mag: 0, cooldown: 1, armor: 0 }
    this.shotsFired = 0
    this.shotsHit = 0
    this.droppedMags = []

    this.onShoot = null
    this.onSkill = null
    this.onDamage = null
    this.onDeath = null
    this.onFall = null
    this.onJump = null
    this.onDash = null
    this.onLand = null
    this.onReload = null

    this.reset(this.spawnPoint)
  }

  get damage() {
    return PLAYER.damage * this.upgrades.damage
  }

  get eyePosition() {
    return _v3.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0))
  }

  setViewModelVisible(v) {
    this.viewModel.root.visible = v
  }

  reset(pos = this.spawnPoint, keepUpgrades = true) {
    this.position.copy(pos)
    this.velocity.set(0, 0, 0)
    this.hp = this.maxHp
    this.alive = true
    this.ammo = this.magSize
    this.reloading = false
    this.reloadT = 0
    this.reloadStage = 0
    this.fireT = 0
    this.dashT = 0
    this.dashCd = 0
    this.skillCd = 0
    this.invuln = 1.2
    this.noDamageT = 0
    this.grounded = true
    this.lastSafe.copy(pos)
    this.yaw = Math.PI
    this.pitch = 0.12
    this.prevYaw = this.yaw
    this.prevPitch = this.pitch
    this.modelYaw = Math.PI
    this.aiming = false
    this.aimMix = 0
    this.recoil = 0
    this.shake = 0
    this.deathTilt = 0
    this.strafeLean = 0
    this.root.position.copy(pos)
    this.root.rotation.set(0, this.modelYaw, 0)
    this.root.visible = true
    if (!keepUpgrades) {
      this.maxHp = PLAYER.maxHp
      this.magSize = PLAYER.magSize
      this.upgrades = { damage: 1, mag: 0, cooldown: 1, armor: 0 }
    }
    this.viewModel.mag.visible = true
    this.viewModel.mag.position.y = this.viewModel.magBaseY
    this.syncCamera(true)
    this.animate(0.016, false)
  }

  applyUpgrade(id) {
    if (id === 'damage') this.upgrades.damage = 1.15
    if (id === 'mag') {
      this.magSize = PLAYER.magSize + 12
      this.ammo = this.magSize
    }
    if (id === 'cooldown') this.upgrades.cooldown = 0.7
    if (id === 'armor') {
      this.maxHp = PLAYER.maxHp + 25
      this.hp = Math.min(this.maxHp, this.hp + 25)
    }
  }

  takeDamage(amount, source) {
    if (!this.alive || this.invuln > 0) return false
    this.hp -= amount
    this.invuln = 0.4
    this.noDamageT = 0
    this.shake = Math.min(0.7, this.shake + 0.28)
    if (this.onDamage) this.onDamage(amount, source)
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
      this.deadT = 0
      if (this.onDeath) this.onDeath()
    }
    return true
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n)
  }

  findRespawn() {
    let best = null
    let bestDist = Infinity
    for (const p of PLATFORMS) {
      const d = Math.hypot(this.lastSafe.x - p.x, this.lastSafe.z - p.z)
      if (d <= p.r + 1 && d < bestDist) {
        best = p
        bestDist = d
      }
    }
    if (!best) return this.spawnPoint.clone().setY(this.spawnPoint.y + 0.4)
    return new THREE.Vector3(best.x, best.y + 0.5, best.z)
  }

  reload() {
    if (this.reloading || this.ammo >= this.magSize) return
    this.reloading = true
    this.reloadT = PLAYER.reloadTime
    this.reloadStage = 0
    if (this.onReload) this.onReload()
  }

  useSkill() {
    if (this.skillCd > 0 || !this.alive) return false
    this.skillCd = PLAYER.skillCd * this.upgrades.cooldown
    if (this.onSkill) this.onSkill(this.position.clone())
    return true
  }

  tryShoot() {
    if (!this.alive || this.reloading || this.fireT > 0) return
    if (this.ammo <= 0) {
      this.reload()
      return
    }
    this.ammo--
    this.fireT = PLAYER.fireRate
    this.recoil = Math.min(1, this.recoil + 0.3)
    this.shake = Math.min(0.5, this.shake + 0.05)
    this.shotsFired++

    const cp = Math.cos(this.pitch)
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp)
    const spread = this.aiming ? 0.0022 : 0.009
    dir.x += (Math.random() - 0.5) * spread
    dir.y += (Math.random() - 0.5) * spread
    dir.z += (Math.random() - 0.5) * spread
    dir.normalize()

    const origin = this.camera.position.clone()
    this.camera.updateMatrixWorld(true)
    const muzzleLocal = this.viewModel.muzzle.getWorldPosition(new THREE.Vector3())
    const muzzleWorld = muzzleLocal.applyMatrix4(this.camera.matrixWorld)
    if (this.onShoot) this.onShoot(origin, dir, muzzleWorld)
    if (this.ammo === 0) this.reload()
  }

  /* ------------------------------------------------------------ 弹匣掉落 */

  dropMagazine() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2529,
      roughness: 0.7,
      metalness: 0.35,
      transparent: true,
    })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.09), mat)
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    mesh.position.copy(this.position).add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(fwd, 0.35)
    mesh.rotation.set(Math.random(), Math.random(), Math.random())
    this.scene.add(mesh)
    this.droppedMags.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.7, (Math.random() - 0.5) * 0.8).addScaledVector(fwd, 1.1),
      spin: new THREE.Vector3(3 + Math.random() * 3, 2 + Math.random() * 2, 2 + Math.random() * 2),
      life: 5,
    })
  }

  updateDroppedMags(dt) {
    for (let i = this.droppedMags.length - 1; i >= 0; i--) {
      const m = this.droppedMags[i]
      m.life -= dt
      m.vel.y -= 20 * dt
      m.mesh.position.addScaledVector(m.vel, dt)
      m.mesh.rotation.x += m.spin.x * dt
      m.mesh.rotation.y += m.spin.y * dt
      m.mesh.rotation.z += m.spin.z * dt
      const g = sampleGround(m.mesh.position.x, m.mesh.position.z, m.mesh.position.y + 1)
      if (g > -100 && m.mesh.position.y < g + 0.06) {
        m.mesh.position.y = g + 0.06
        if (m.vel.y < -1) {
          m.vel.y *= -0.28
          m.vel.x *= 0.55
          m.vel.z *= 0.55
          m.spin.multiplyScalar(0.5)
        } else {
          m.vel.set(0, 0, 0)
          m.spin.set(0, 0, 0)
        }
      }
      if (m.life < 1.2) m.mesh.material.opacity = Math.max(0, m.life / 1.2)
      if (m.life <= 0) {
        this.scene.remove(m.mesh)
        m.mesh.geometry.dispose()
        m.mesh.material.dispose()
        this.droppedMags.splice(i, 1)
      }
    }
  }

  /* ------------------------------------------------------------ 每帧 */

  update(dt, input) {
    this.updateDroppedMags(dt)

    if (!this.alive) {
      this.deadT += dt
      this.deathTilt = Math.min(1, this.deathTilt + dt * 2.2)
      this.viewModel.root.visible = false
      this.syncCamera(false, dt)
      return
    }

    // 视角
    const sens = 0.0023
    this.yaw -= input.lookX * sens
    this.pitch += input.lookY * sens
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.15, 1.15)
    input.lookX = 0
    input.lookY = 0

    this.aiming = input.aim && !this.reloading

    // 冷却
    this.fireT = Math.max(0, this.fireT - dt)
    this.dashCd = Math.max(0, this.dashCd - dt)
    this.skillCd = Math.max(0, this.skillCd - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.noDamageT += dt
    this.recoil = Math.max(0, this.recoil - dt * 4.5)
    this.shake = Math.max(0, this.shake - dt * 2.4)

    if (this.reloading) {
      this.reloadT -= dt
      this.animateReload()
      if (this.reloadT <= 0) {
        this.reloading = false
        this.ammo = this.magSize
        this.reloadStage = 0
        this.viewModel.mag.visible = true
        this.viewModel.mag.position.y = this.viewModel.magBaseY
        this.viewModel.bolt.position.z = this.viewModel.boltBaseZ
        if (this.onReload) this.onReload(true)
      }
    }

    if (this.noDamageT > 6 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + dt * 5)
    }

    // 移动
    const fwd = _v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const right = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
    const wish = new THREE.Vector3()
    if (input.forward) wish.add(fwd)
    if (input.back) wish.sub(fwd)
    if (input.right) wish.add(right)
    if (input.left) wish.sub(right)
    const moving = wish.lengthSq() > 0.001
    if (moving) wish.normalize()

    const maxSpeed = this.aiming ? PLAYER.aimSpeed : PLAYER.walkSpeed
    const accel = this.grounded ? 16 : 4.5
    const target = wish.clone().multiplyScalar(maxSpeed)
    const k = 1 - Math.exp(-accel * dt)
    this.velocity.x += (target.x - this.velocity.x) * k
    this.velocity.z += (target.z - this.velocity.z) * k

    this.jumpBuf = Math.max(0, this.jumpBuf - dt)
    if (input.jumpPressed) {
      this.jumpBuf = 0.16
      input.jumpPressed = false
    }
    this.coyote = Math.max(0, this.coyote - dt)
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0) && this.dashT <= 0) {
      this.velocity.y = PLAYER.jump
      this.grounded = false
      this.coyote = 0
      this.jumpBuf = 0
      if (this.onJump) this.onJump()
    }

    if (input.dashPressed) {
      input.dashPressed = false
      if (this.dashCd <= 0) {
        this.dashT = PLAYER.dashTime
        this.dashCd = PLAYER.dashCd
        this.invuln = Math.max(this.invuln, 0.34)
        this.dashDir.copy(moving ? wish : fwd)
        this.velocity.y = Math.max(this.velocity.y, 1.2)
        if (this.onDash) this.onDash(this.dashDir.clone())
      }
    }

    if (this.dashT > 0) {
      this.dashT -= dt
      const s = PLAYER.dashSpeed * (0.6 + (this.dashT / PLAYER.dashTime) * 0.6)
      this.velocity.x = this.dashDir.x * s
      this.velocity.z = this.dashDir.z * s
      this.velocity.y = Math.max(this.velocity.y, -2)
    } else {
      this.velocity.y -= PLAYER.gravity * dt
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y += this.velocity.y * dt

    // 涡轮机底座碰撞
    const tx = this.position.x - TURBINE.x
    const tz = this.position.z - TURBINE.z
    const tdist = Math.hypot(tx, tz)
    const minDist = TURBINE.baseR + 0.5
    if (tdist < minDist && this.position.y < TURBINE.baseY + 4.2) {
      const nx = tx / (tdist || 1)
      const nz = tz / (tdist || 1)
      this.position.x = TURBINE.x + nx * minDist
      this.position.z = TURBINE.z + nz * minDist
      const dot = this.velocity.x * nx + this.velocity.z * nz
      if (dot < 0) {
        this.velocity.x -= nx * dot
        this.velocity.z -= nz * dot
      }
    }

    // 地面
    const ground = sampleGround(this.position.x, this.position.z, this.position.y + 0.4)
    const wasGrounded = this.grounded
    if (this.position.y <= ground + 0.02 && this.velocity.y <= 0.01) {
      if (!wasGrounded && this.velocity.y < -6) {
        this.shake = Math.min(0.6, this.shake + 0.2)
        if (this.onLand) this.onLand(this.position.clone())
      }
      this.position.y = ground
      this.velocity.y = 0
      this.grounded = true
      this.coyote = 0.14
      if (ground > -10) this.lastSafe.set(this.position.x, ground, this.position.z)
    } else {
      this.grounded = false
    }

    // 坠落
    if (this.position.y < -26) {
      const fallPos = this.position.clone()
      const respawn = this.findRespawn()
      this.position.copy(respawn)
      this.velocity.set(0, 0, 0)
      this.takeDamage(16, null)
      this.invuln = Math.max(this.invuln, 1.6)
      if (this.onFall) this.onFall(fallPos)
    }

    // 身体朝向（阴影用）
    let targetYaw = this.modelYaw
    if (this.aiming || this.fireT > 0.03) targetYaw = this.yaw
    else if (moving) targetYaw = Math.atan2(this.velocity.x, this.velocity.z)
    let diff = ((targetYaw - this.modelYaw + Math.PI) % (Math.PI * 2)) - Math.PI
    if (diff < -Math.PI) diff += Math.PI * 2
    this.modelYaw += diff * Math.min(1, dt * 14)

    if (input.shoot) this.tryShoot()
    if (input.skillPressed) {
      input.skillPressed = false
      this.useSkill()
    }
    if (input.reloadPressed) {
      input.reloadPressed = false
      this.reload()
    }

    // 横向倾斜
    const lateral = this.velocity.x * right.x + this.velocity.z * right.z
    this.strafeLean = THREE.MathUtils.lerp(
      this.strafeLean,
      THREE.MathUtils.clamp(lateral / PLAYER.walkSpeed, -1, 1),
      1 - Math.exp(-8 * dt)
    )

    this.root.position.copy(this.position)
    this.root.rotation.y = this.modelYaw
    this.animate(dt, moving)
    this.updateViewModel(dt)
    this.syncCamera(false, dt)
  }

  animateReload() {
    const p = THREE.MathUtils.clamp(1 - this.reloadT / PLAYER.reloadTime, 0, 1)
    if (p > 0.3 && this.reloadStage < 1) {
      this.reloadStage = 1
      this.audio.magOut()
      this.dropMagazine()
    }
    if (p > 0.56 && this.reloadStage < 2) {
      this.reloadStage = 2
      this.audio.magIn()
    }
    if (p > 0.76 && this.reloadStage < 3) {
      this.reloadStage = 3
      this.audio.bolt()
    }
  }

  animate(dt, moving) {
    const m = this.model
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    this.walkPhase += dt * (2.2 + speed * 0.9)
    const swing = this.grounded ? Math.min(1, speed / PLAYER.walkSpeed) : 0

    if (this.grounded) {
      m.legL.rotation.x = Math.sin(this.walkPhase) * 0.72 * swing
      m.legR.rotation.x = -Math.sin(this.walkPhase) * 0.72 * swing
    } else {
      m.legL.rotation.x = THREE.MathUtils.lerp(m.legL.rotation.x, -0.5, dt * 8)
      m.legR.rotation.x = THREE.MathUtils.lerp(m.legR.rotation.x, 0.35, dt * 8)
    }

    const armSwing = Math.sin(this.walkPhase) * 0.18 * swing
    m.armR.rotation.x = THREE.MathUtils.lerp(m.armR.rotation.x, -1.18 + armSwing * 0.3, dt * 10)
    m.armL.rotation.x = THREE.MathUtils.lerp(m.armL.rotation.x, -0.95 - armSwing, dt * 10)
    m.armL.rotation.z = 0.24
    m.armR.rotation.z = -0.08

    const lean = this.dashT > 0 ? -0.22 : this.aiming ? -0.04 : -0.02
    m.body.rotation.x = THREE.MathUtils.lerp(m.body.rotation.x, lean, dt * 8)
    m.body.position.y = this.grounded ? Math.abs(Math.sin(this.walkPhase)) * 0.035 * swing : 0.05
    m.body.rotation.z = Math.sin(this.walkPhase) * 0.02 * swing
    m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, -this.pitch * 0.25, dt * 8)
  }

  /* ------------------------------------------------------------ 第一人称武器 */

  updateViewModel(dt) {
    const vm = this.viewModel
    if (!vm.root.visible) return

    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const moving = this.grounded && speed > 0.6
    const bobAmt = Math.min(1, speed / PLAYER.walkSpeed)
    this.bobPhase += dt * (5 + speed * 1.2) * (moving ? 1 : 0)
    const bobX = moving ? Math.sin(this.bobPhase) * 0.014 * bobAmt : 0
    const bobY = moving ? -Math.abs(Math.sin(this.bobPhase * 2)) * 0.01 * bobAmt : 0

    // 视线拖拽
    const dyaw = this.yaw - this.prevYaw
    const dpitch = this.pitch - this.prevPitch
    this.prevYaw = this.yaw
    this.prevPitch = this.pitch
    const k = 1 - Math.exp(-12 * dt)
    this.swayX = THREE.MathUtils.lerp(this.swayX, THREE.MathUtils.clamp(dyaw * 0.55, -0.028, 0.028), k)
    this.swayY = THREE.MathUtils.lerp(this.swayY, THREE.MathUtils.clamp(-dpitch * 0.55, -0.028, 0.028), k)

    // 瞄准与后坐
    this.aimMix = THREE.MathUtils.lerp(this.aimMix, this.aiming ? 1 : 0, 1 - Math.exp(-14 * dt))
    vm.rifle.position.lerpVectors(vm.hip, vm.ads, this.aimMix)
    vm.rifle.position.z += this.recoil * 0.045
    vm.rifle.rotation.x = THREE.MathUtils.lerp(0.08, 0.02, this.aimMix) + this.recoil * 0.11
    vm.rifle.rotation.y = THREE.MathUtils.lerp(0.07, 0, this.aimMix)
    vm.rifle.rotation.z = this.recoil * 0.02

    vm.rig.position.set(
      this.swayX + bobX,
      this.swayY + bobY + Math.sin(this.bobPhase * 0.5) * 0.0015,
      this.recoil * 0.03
    )
    vm.rig.rotation.set(this.recoil * 0.02, 0, this.recoil * 0.025)

    // 换弹姿态
    vm.rifle.updateMatrix()
    let leftTarget = _v1.copy(vm.guardLocal).applyMatrix4(vm.rifle.matrix)
    if (this.reloading) {
      const p = THREE.MathUtils.clamp(1 - this.reloadT / PLAYER.reloadTime, 0, 1)
      const tilt = p < 0.12 ? p / 0.12 : p > 0.86 ? (1 - p) / 0.14 : 1
      vm.rig.rotation.z += tilt * 0.28
      vm.rig.rotation.x += tilt * 0.03
      vm.rig.position.y += tilt * 0.06
      vm.rig.position.x -= tilt * 0.03
      // 让弹匣井朝向镜头，换弹动作更清楚
      vm.rifle.rotation.x += tilt * 0.3
      vm.rifle.rotation.z += tilt * 0.1

      // 弹匣：拔出、掉出、重新插入
      const magBase = vm.magBaseY
      let magOffset = 0
      if (p < 0.12) {
        magOffset = 0
      } else if (p < 0.32) {
        magOffset = -((p - 0.12) / 0.2) * 0.5
      } else if (p < 0.5) {
        magOffset = -0.5
        vm.mag.visible = false
      } else if (p < 0.72) {
        vm.mag.visible = true
        magOffset = -0.5 + ((p - 0.5) / 0.22) * 0.5
      }
      vm.mag.position.y = magBase + magOffset
      vm.mag.rotation.x = Math.sin(p * Math.PI) * 0.25

      // 拉机柄
      if (p > 0.74 && p < 0.8) vm.bolt.position.z = vm.boltBaseZ + 0.055
      else if (p >= 0.8 && p < 0.86) vm.bolt.position.z = vm.boltBaseZ + 0.055 * (1 - (p - 0.8) / 0.06)
      else vm.bolt.position.z = vm.boltBaseZ

      // 左手路径
      const magTarget = _v2.copy(vm.magLocal).applyMatrix4(vm.rifle.matrix)
      const guardTarget = _v3.copy(vm.guardLocal).applyMatrix4(vm.rifle.matrix)
      const down = _v4.copy(magTarget).add(new THREE.Vector3(0, -0.1, 0))
      if (p < 0.1) {
        leftTarget = guardTarget
      } else if (p < 0.24) {
        leftTarget = guardTarget.clone().lerp(magTarget, (p - 0.1) / 0.14)
      } else if (p < 0.42) {
        leftTarget = magTarget.clone().lerp(down, (p - 0.24) / 0.18)
      } else if (p < 0.56) {
        leftTarget = down.clone()
      } else if (p < 0.76) {
        leftTarget = down.clone().lerp(magTarget, (p - 0.56) / 0.2)
      } else if (p < 0.88) {
        leftTarget = magTarget.clone().lerp(guardTarget, (p - 0.76) / 0.12)
      } else {
        leftTarget = guardTarget
      }
    } else {
      vm.mag.position.y = vm.magBaseY
      vm.mag.rotation.x = 0
      vm.mag.visible = true
      vm.bolt.position.z = vm.boltBaseZ
    }

    // 手跟随枪身
    const gripTarget = new THREE.Vector3(0, -0.115, 0.12).applyMatrix4(vm.rifle.matrix)
    vm.rightArm.set(vm.rightFrom, gripTarget)
    vm.leftArm.set(vm.leftFrom, leftTarget)
  }

  /* ------------------------------------------------------------ 第一人称相机 */

  syncCamera(instant = false, dt = 0.016) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const moving = this.grounded && speed > 0.6
    const bobAmt = Math.min(1, speed / PLAYER.walkSpeed)
    const bobPhase = this.bobPhase
    const bobY = moving ? Math.abs(Math.sin(bobPhase * 2)) * 0.026 * bobAmt : 0
    const bobX = moving ? Math.sin(bobPhase) * 0.016 * bobAmt : 0
    const rightX = -Math.cos(this.yaw)
    const rightZ = Math.sin(this.yaw)

    const eye = _v1.copy(this.position)
    eye.x += rightX * bobX
    eye.z += rightZ * bobX
    eye.y += EYE_HEIGHT - bobY + (this.aiming ? 0.012 : 0)
    if (this.deathTilt > 0) eye.y -= this.deathTilt * 1.15

    if (instant) {
      this.camera.position.copy(eye)
    } else {
      this.camera.position.lerp(eye, 1 - Math.exp(-28 * dt))
    }

    const kick = this.recoil * 0.05
    const roll =
      -this.strafeLean * 0.018 -
      (this.dashT > 0 ? 0.05 : 0) -
      this.deathTilt * 0.9 +
      (this.aiming ? 0 : Math.sin(this.bobPhase) * 0.006 * bobAmt)

    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(
      -this.pitch + kick,
      this.yaw + Math.PI + (Math.random() - 0.5) * this.recoil * 0.008,
      roll
    )

    if (this.shake > 0) {
      const s = this.shake
      this.camera.rotation.x += (Math.random() - 0.5) * s * 0.045
      this.camera.rotation.y += (Math.random() - 0.5) * s * 0.045
      this.camera.rotation.z += (Math.random() - 0.5) * s * 0.05
      this.camera.position.x += (Math.random() - 0.5) * s * 0.03
      this.camera.position.y += (Math.random() - 0.5) * s * 0.03
    }

    const targetFov =
      (this.aiming ? FOV_AIM : FOV_HIP) + (this.dashT > 0 ? 5 : 0) + this.recoil * 1.2
    this.fov = instant ? targetFov : THREE.MathUtils.lerp(this.fov, targetFov, 1 - Math.exp(-10 * dt))
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }

    // 武器相机跟随视口比例
    if (this.vmCamera.aspect !== this.camera.aspect) {
      this.vmCamera.aspect = this.camera.aspect
      this.vmCamera.updateProjectionMatrix()
    }
  }
}
