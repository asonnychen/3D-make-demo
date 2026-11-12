import * as THREE from 'three'
import { ARENA, TURBINE } from './config.js'

/* ============================================================
   守卫类型
   ============================================================ */

export const ENEMY_TYPES = {
  drone: {
    name: '巡弋守卫',
    hp: 38,
    radius: 1.0,
    speed: 8.2,
    orbitR: 10,
    hover: 4.2,
    fireCd: 2.2,
    damage: 6,
    projSpeed: 14,
    scale: 1,
    drop: 1,
  },
  lancer: {
    name: '风帆枪手',
    hp: 110,
    radius: 1.45,
    speed: 5.6,
    orbitR: 14,
    hover: 5.4,
    fireCd: 2.9,
    damage: 9,
    projSpeed: 18,
    scale: 1.42,
    drop: 2,
    burst: 3,
  },
  warden: {
    name: '风帆守卫长',
    hp: 300,
    radius: 2.0,
    speed: 3.6,
    orbitR: 15,
    hover: 6.4,
    fireCd: 2.2,
    damage: 11,
    projSpeed: 14,
    scale: 1.9,
    drop: 3,
    radial: true,
  },
}

const glowTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()

function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x
  const oy = origin.y - center.y
  const oz = origin.z - center.z
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  const disc = b * b - c
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  if (t < 0) return null
  return t
}

/* ============================================================
   守卫模型
   ============================================================ */

function buildGuardian(type) {
  const cfg = ENEMY_TYPES[type]
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const shellMat = new THREE.MeshStandardMaterial({
    color: type === 'warden' ? 0x2b3438 : 0x3d5157,
    roughness: 0.45,
    metalness: 0.72,
    emissive: 0x0b2c2c,
    emissiveIntensity: 0.4,
    flatShading: true,
  })
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x6d8288,
    roughness: 0.35,
    metalness: 0.85,
  })
  const coreColor = type === 'warden' ? 0xffb066 : 0x5ff3e0
  const coreMat = new THREE.MeshStandardMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity: type === 'warden' ? 1.8 : 1.7,
    roughness: 0.25,
    metalness: 0.1,
  })
  const eyeMat = new THREE.MeshBasicMaterial({ color: type === 'warden' ? 0xffd7a8 : 0xc9fff7, toneMapped: false })

  // 外壳
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 0), shellMat)
  shell.castShadow = true
  body.add(shell)

  // 上下护板
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.5, 6), trimMat)
  capTop.position.y = 0.82
  body.add(capTop)
  const capBottom = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.55, 6), trimMat)
  capBottom.position.y = -0.8
  capBottom.rotation.x = Math.PI
  body.add(capBottom)

  // 核心
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), coreMat)
  core.position.z = 0.42
  body.add(core)

  // 眼睛
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), eyeMat)
  eye.position.z = 0.72
  body.add(eye)

  // 旋转环
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 6, 40), trimMat)
  ring.rotation.x = Math.PI / 2
  body.add(ring)
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.022, 4, 40), coreMat)
  ringGlow.rotation.x = Math.PI / 2
  ringGlow.position.y = 0.03
  body.add(ringGlow)

  // 侧翼
  const finGeo = new THREE.BoxGeometry(0.9, 0.1, 0.34)
  const finL = new THREE.Mesh(finGeo, trimMat)
  finL.position.set(-0.95, 0.05, -0.1)
  finL.rotation.z = 0.24
  body.add(finL)
  const finR = finL.clone()
  finR.position.x = 0.95
  finR.rotation.z = -0.24
  body.add(finR)

  let sailL = null
  let sailR = null
  if (type === 'lancer' || type === 'warden') {
    // 帆翼
    const sailGeo = new THREE.PlaneGeometry(2.2, 2.6, 6, 6)
    const sailMat = new THREE.MeshStandardMaterial({
      color: type === 'warden' ? 0x8a5a3a : 0x9fb5ac,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x1a3c38,
      emissiveIntensity: 0.5,
    })
    sailL = new THREE.Mesh(sailGeo, sailMat)
    sailL.position.set(-1.9, 0.1, -0.2)
    sailL.rotation.y = 0.5
    body.add(sailL)
    sailR = new THREE.Mesh(sailGeo, sailMat)
    sailR.position.set(1.9, 0.1, -0.2)
    sailR.rotation.y = -0.5
    body.add(sailR)
  }

  if (type === 'warden') {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 32, Math.PI * 1.5), coreMat)
    crown.position.y = 1.05
    crown.rotation.x = Math.PI / 2
    body.add(crown)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 5), trimMat)
    spike.position.y = 1.45
    body.add(spike)
  }

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: coreColor,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  glow.scale.setScalar(2.6)
  glow.position.z = 0.3
  body.add(glow)

  root.scale.setScalar(cfg.scale)
  return { root, body, ring, ringGlow, core, coreMat, shellMat, sailL, sailR, glow, eye }
}

/* ============================================================
   血条
   ============================================================ */

function makeHealthBar() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 14
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(3.1, 0.34, 1)
  sprite.renderOrder = 20
  const draw = (ratio) => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 128, 14)
    ctx.fillStyle = 'rgba(4,20,25,0.75)'
    ctx.fillRect(0, 0, 128, 14)
    ctx.strokeStyle = 'rgba(120,240,220,0.55)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, 127, 13)
    const w = Math.max(0, Math.min(1, ratio)) * 122
    ctx.fillStyle = ratio > 0.35 ? '#5eead4' : '#ff8a6b'
    ctx.fillRect(3, 3, w, 8)
    tex.needsUpdate = true
  }
  draw(1)
  return { sprite, draw }
}

/* ============================================================
   敌人管理
   ============================================================ */

export class EnemyManager {
  constructor({ scene, player, fx, audio }) {
    this.scene = scene
    this.player = player
    this.fx = fx
    this.audio = audio
    this.group = new THREE.Group()
    scene.add(this.group)
    this.enemies = []
    this.projectiles = []
    this.onKill = null
    this.time = 0
  }

  clear() {
    for (const e of this.enemies) this.group.remove(e.root)
    for (const p of this.projectiles) this.scene.remove(p.mesh)
    this.enemies.length = 0
    this.projectiles.length = 0
  }

  spawn(type, position) {
    const cfg = ENEMY_TYPES[type]
    const model = buildGuardian(type)
    model.root.position.copy(position)
    this.group.add(model.root)

    const bar = type === 'drone' ? null : makeHealthBar()
    if (bar) {
      bar.sprite.position.y = 2.0 / cfg.scale
      bar.sprite.scale.set(3.1 / cfg.scale, 0.34 / cfg.scale, 1)
      model.root.add(bar.sprite)
    }

    const angle = Math.random() * Math.PI * 2
    const enemy = {
      type,
      cfg,
      root: model.root,
      model,
      hp: cfg.hp,
      maxHp: cfg.hp,
      pos: model.root.position,
      vel: new THREE.Vector3(),
      radius: cfg.radius,
      fireCd: 1.2 + Math.random() * 1.4,
      radialCd: 5.5,
      orbitAngle: angle,
      orbitDir: Math.random() > 0.5 ? 1 : -1,
      strafe: Math.random() * 6,
      hitFlash: 0,
      spawnT: 0,
      alive: true,
      bar,
      telegraph: 0,
      burstLeft: 0,
      burstT: 0,
    }

    // 生成时的能量环
    this.fx.ring(position, type === 'warden' ? 0xffb066 : 0x5ff3e0, cfg.scale * 2.6, 0.55)
    this.fx.burst(position, type === 'warden' ? 0xffb066 : 0x5ff3e0, 22, 5, 0.5)
    this.enemies.push(enemy)
    return enemy
  }

  spawnWave(def, center) {
    const list = []
    for (const group of def.enemies) {
      for (let i = 0; i < group.count; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = 13 + Math.random() * 8
        const pos = new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          center.y + ENEMY_TYPES[group.type].hover + 1.5 + Math.random() * 2.5,
          center.z + Math.sin(angle) * radius
        )
        list.push(this.spawn(group.type, pos))
      }
    }
    return list
  }

  damage(enemy, amount, point, dir) {
    if (!enemy.alive) return false
    enemy.hp -= amount
    enemy.hitFlash = 1
    if (point) this.fx.sparks(point, 0x9dfff1, 7, 6, 0.5)
    if (enemy.bar) enemy.bar.draw(Math.max(0, enemy.hp / enemy.maxHp))
    this.audio.hit()
    if (enemy.hp <= 0) {
      this.kill(enemy)
      return true
    }
    return false
  }

  kill(enemy) {
    if (!enemy.alive) return
    enemy.alive = false
    const cfg = enemy.cfg
    this.fx.explosion(enemy.pos, enemy.type === 'warden' ? 0xffb066 : 0x5ff3e0, cfg.scale)
    this.fx.ring(enemy.pos, enemy.type === 'warden' ? 0xffd0a0 : 0x9dfff1, cfg.scale * 4.5, 0.7)
    this.audio.explode(enemy.type === 'warden')
    this.group.remove(enemy.root)
    const idx = this.enemies.indexOf(enemy)
    if (idx >= 0) this.enemies.splice(idx, 1)
    if (this.onKill) this.onKill(enemy)
  }

  /* ------------------------------------------------------------ 命中检测 */

  hitTest(origin, dir, maxDist = 160) {
    let best = null
    let bestT = maxDist
    for (const e of this.enemies) {
      if (!e.alive) continue
      const center = _v.copy(e.pos).add(new THREE.Vector3(0, 0.2, 0))
      const t = raySphere(origin, dir, center, e.radius)
      if (t !== null && t < bestT) {
        bestT = t
        best = e
      }
    }
    if (!best) return null
    return { enemy: best, distance: bestT, point: origin.clone().addScaledVector(dir, bestT) }
  }

  /* ------------------------------------------------------------ 投射物 */

  shootProjectile(from, dir, speed, damage, opts = {}) {
    const color = opts.color || 0xffb066
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    )
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    glow.scale.setScalar(0.85)
    core.add(glow)
    core.position.copy(from)
    this.scene.add(core)
    this.projectiles.push({
      mesh: core,
      vel: dir.clone().multiplyScalar(speed),
      life: 5,
      damage,
      radius: opts.radius || 0.2,
      trailT: 0,
      color,
    })
  }

  fireAtPlayer(enemy, spread = 0, speedOverride) {
    const cfg = enemy.cfg
    const player = this.player
    const from = enemy.pos.clone().add(new THREE.Vector3(0, 0.1, 0))
    const to = player.position.clone().add(new THREE.Vector3(0, 1.1, 0))
    const dist = from.distanceTo(to)
    const speed = speedOverride || cfg.projSpeed
    const lead = Math.min(0.55, dist / speed) * 0.55
    to.addScaledVector(player.velocity, lead)
    const dir = to.sub(from).normalize()
    if (spread) {
      dir.x += (Math.random() - 0.5) * spread
      dir.y += (Math.random() - 0.5) * spread
      dir.z += (Math.random() - 0.5) * spread
      dir.normalize()
    }
    this.shootProjectile(from, dir, speed, cfg.damage, {
      color: enemy.type === 'warden' ? 0xffc98a : 0x7df6e4,
    })
    this.audio.enemyShot(enemy.type)
  }

  fireRadial(enemy) {
    const count = 10
    const from = enemy.pos.clone()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const dir = new THREE.Vector3(Math.cos(a), -0.04, Math.sin(a)).normalize()
      this.shootProjectile(from, dir, 13, enemy.cfg.damage * 0.7, { color: 0xffb066 })
    }
    this.audio.enemyShot('warden')
    this.fx.ring(from, 0xffb066, 5, 0.4)
  }

  /* ------------------------------------------------------------ 每帧 */

  update(dt, time) {
    this.time = time
    const player = this.player

    for (const e of this.enemies) {
      const cfg = e.cfg
      e.spawnT += dt

      // 目标点：绕着玩家转圈，保持距离
      e.orbitAngle += dt * 0.42 * e.orbitDir
      e.strafe += dt
      const vertical = Math.sin(time * 0.8 + e.strafe) * 0.9
      const target = _v.set(
        player.position.x + Math.cos(e.orbitAngle) * cfg.orbitR,
        player.position.y + cfg.hover + vertical,
        player.position.z + Math.sin(e.orbitAngle) * cfg.orbitR
      )

      // 避开涡轮机
      const tx = target.x - TURBINE.x
      const tz = target.z - TURBINE.z
      const td = Math.hypot(tx, tz)
      if (td < 7.5) {
        target.x = TURBINE.x + (tx / (td || 1)) * 7.5
        target.z = TURBINE.z + (tz / (td || 1)) * 7.5
      }

      const speed = cfg.speed * (e.spawnT < 0.6 ? 0.3 : 1)
      _v2.copy(target).sub(e.pos)
      const distToTarget = _v2.length()
      if (distToTarget > 0.001) _v2.multiplyScalar(1 / distToTarget)
      e.vel.lerp(_v2.multiplyScalar(speed), 1 - Math.exp(-2.6 * dt))
      e.pos.addScaledVector(e.vel, dt)

      // 面向玩家
      const dx = player.position.x - e.pos.x
      const dz = player.position.z - e.pos.z
      e.root.rotation.y = Math.atan2(dx, dz)
      e.root.rotation.z = THREE.MathUtils.clamp(-e.vel.x * 0.02, -0.3, 0.3)

      // 环与核心动画
      const m = e.model
      m.ring.rotation.z += dt * (1.2 + (e.type === 'warden' ? 0.8 : 0))
      m.ringGlow.rotation.z -= dt * 1.8
      m.core.rotation.y += dt * 2.2
      m.core.rotation.x += dt * 1.1
      const pulse = 1 + Math.sin(time * 4 + e.strafe) * 0.08
      m.core.scale.setScalar(pulse * (1 + e.telegraph * 0.35))
      m.glow.scale.setScalar((2.4 + Math.sin(time * 3 + e.strafe) * 0.3) * (1 + e.telegraph * 0.8))
      if (m.sailL) {
        m.sailL.rotation.z = Math.sin(time * 2 + e.strafe) * 0.14
        m.sailR.rotation.z = -Math.sin(time * 2 + e.strafe) * 0.14
      }

      // 受击闪白
      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt * 5)
        m.shellMat.emissiveIntensity = 0.4 + e.hitFlash * 2.5
        m.shellMat.emissive.setHex(e.hitFlash > 0.4 ? 0x9dfff1 : 0x0b2c2c)
      }

      // 攻击
      const distToPlayer = e.pos.distanceTo(player.position)
      if (distToPlayer < 46 && player.alive) {
        e.fireCd -= dt
        if (e.fireCd < 0.6 && e.fireCd > 0) e.telegraph = 1 - e.fireCd / 0.6
        else e.telegraph = 0

        if (e.fireCd <= 0) {
          e.fireCd = cfg.fireCd * (0.85 + Math.random() * 0.3)
          e.telegraph = 0
          if (cfg.burst) {
            e.burstLeft = cfg.burst
            e.burstT = 0
          } else {
            this.fireAtPlayer(e, e.type === 'drone' ? 0.04 : 0.02)
          }
        }

        // 连发
        if (e.burstLeft > 0) {
          e.burstT -= dt
          if (e.burstT <= 0) {
            this.fireAtPlayer(e, 0.035)
            e.burstLeft--
            e.burstT = 0.14
          }
        }

        // 守卫长环形弹幕
        if (cfg.radial) {
          e.radialCd -= dt
          if (e.radialCd <= 0) {
            e.radialCd = 6.5
            this.fireRadial(e)
          }
        }
      }
    }

    // 投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.life -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.trailT -= dt
      if (p.trailT <= 0) {
        p.trailT = 0.04
        this.fx.sparks(p.mesh.position, p.color, 1, 0.5, 0.35)
      }
      let hit = false

      if (player.alive) {
        const center = _v.copy(player.position).add(new THREE.Vector3(0, 1.05, 0))
        if (p.mesh.position.distanceTo(center) < 0.78 + p.radius) {
          if (player.takeDamage(p.damage, p.mesh.position.clone())) {
            hit = true
            this.fx.burst(p.mesh.position, 0xff9b7a, 14, 4, 0.45)
          }
        }
      }

      const gy = sampleGroundSafe(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y + 1)
      if (p.mesh.position.y < gy + 0.15) {
        hit = true
        this.fx.sparks(p.mesh.position, p.color, 8, 4, 0.4)
      }
      // 塔身阻挡
      const tdx = p.mesh.position.x - TURBINE.x
      const tdz = p.mesh.position.z - TURBINE.z
      if (
        Math.hypot(tdx, tdz) < 3.9 &&
        p.mesh.position.y > TURBINE.baseY &&
        p.mesh.position.y < TURBINE.baseY + TURBINE.height
      ) {
        hit = true
        this.fx.sparks(p.mesh.position, 0x9dfff1, 6, 3, 0.35)
      }
      if (p.life <= 0) hit = true

      if (hit) {
        this.scene.remove(p.mesh)
        p.mesh.geometry.dispose()
        p.mesh.material.dispose()
        this.projectiles.splice(i, 1)
      }
    }
  }
}

// 避免循环依赖，内联一份地面高度查询
import { sampleGround as sampleGroundRaw } from './world.js'
function sampleGroundSafe(x, z, maxY) {
  const g = sampleGroundRaw(x, z, maxY)
  return g === -Infinity ? -60 : g
}
