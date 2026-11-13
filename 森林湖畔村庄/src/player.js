/* ============================================================
   步行漫游：指针锁定、WASD 移动、奔跑、跳跃、地形贴合与碰撞
   ============================================================ */

import * as THREE from 'three'
import { WORLD } from './config.js'
import { groundHeight } from './terrain.js'

const EYE = 1.68
const RADIUS = 0.38
const GRAVITY = 17
const JUMP_SPEED = 5.4

export class Player {
  constructor(camera, { obstacles = [], boxes = [], walkables = [] } = {}) {
    this.camera = camera
    this.obstacles = obstacles
    this.boxes = boxes
    this.walkables = walkables

    this.enabled = false
    this.locked = false
    this.position = new THREE.Vector3(3.2, 0, 34.2)
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = -0.03
    this.eyeY = 0
    this.bobTime = 0
    this.keys = new Set()
    this.wading = false
    this.grounded = true
    this.y = 0
    this.vy = 0
    this.jumpQueued = false
    this.onLockChange = null
    this.onStep = null

    this.canvas = null

    this._onKeyDown = (e) => {
      if (!this.enabled) return
      if (e.code === 'Space' && !e.repeat) this.jumpQueued = true
      this.keys.add(e.code)
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    this._onKeyUp = (e) => this.keys.delete(e.code)
    this._onMouseMove = (e) => {
      if (!this.locked) return
      this.yaw -= e.movementX * 0.0022
      this.pitch -= e.movementY * 0.0022
      this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch))
    }
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas
      if (this.onLockChange) this.onLockChange(this.locked)
    }
  }

  attach(canvas) {
    this.canvas = canvas
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('pointerlockchange', this._onLockChange)
    canvas.addEventListener('click', () => {
      if (this.enabled && !this.locked) this.lock()
    })
  }

  lock() {
    if (this.canvas && !this.locked) {
      const p = this.canvas.requestPointerLock()
      if (p && p.catch) p.catch(() => {})
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  enable() {
    this.enabled = true
    this.camera.rotation.order = 'YXZ'
    this.y = this.sampleGround(this.position.x, this.position.z)
    this.vy = 0
    this.grounded = true
    this.eyeY = this.y + EYE
  }

  disable() {
    this.enabled = false
    this.keys.clear()
    this.velocity.set(0, 0, 0)
    this.jumpQueued = false
    this.unlock()
  }

  teleport(x, z, yaw = 0) {
    this.position.set(x, 0, z)
    this.yaw = yaw
    this.pitch = -0.04
    this.velocity.set(0, 0, 0)
    this.y = this.sampleGround(x, z)
    this.vy = 0
    this.grounded = true
    this.eyeY = this.y + EYE
    this.camera.position.set(x, this.eyeY, z)
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }

  sampleGround(x, z) {
    let g = groundHeight(x, z)
    for (const w of this.walkables) {
      if (x > w.x1 && x < w.x2 && z > w.z1 && z < w.z2) {
        g = Math.max(g, w.y)
      }
    }
    return g
  }

  update(dt) {
    if (!this.enabled) return
    dt = Math.min(dt, 0.05)

    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')

    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    // 相机默认朝 -Z
    const dirX = -sin * forward + cos * strafe
    const dirZ = -cos * forward - sin * strafe
    const len = Math.hypot(dirX, dirZ)

    const groundNow = this.sampleGround(this.position.x, this.position.z)
    this.wading = groundNow < 0.02

    let speed = run ? 7.6 : 4.0
    if (this.wading) speed *= 0.55

    const target = new THREE.Vector3()
    if (len > 0) {
      target.set((dirX / len) * speed, 0, (dirZ / len) * speed)
    }
    const smooth = 1 - Math.exp(-dt * (len > 0 ? 12 : 16))
    this.velocity.lerp(target, smooth)

    const nx = this.position.x + this.velocity.x * dt
    const nz = this.position.z + this.velocity.z * dt

    if (this.canStand(nx, nz)) {
      this.position.x = nx
      this.position.z = nz
    } else if (this.canStand(nx, this.position.z)) {
      this.position.x = nx
      this.velocity.z *= 0.4
    } else if (this.canStand(this.position.x, nz)) {
      this.position.z = nz
      this.velocity.x *= 0.4
    } else {
      this.velocity.set(0, 0, 0)
    }

    const r = Math.hypot(this.position.x, this.position.z)
    if (r > WORLD.walkLimit) {
      this.position.multiplyScalar(WORLD.walkLimit / r)
    }

    // 圆形障碍（树、灌木、喷泉、摊位等）
    for (const o of this.obstacles) {
      const dx = this.position.x - o.x
      const dz = this.position.z - o.z
      const dist = Math.hypot(dx, dz)
      const min = o.r + RADIUS
      if (dist < min && dist > 0.0001) {
        this.position.x = o.x + (dx / dist) * min
        this.position.z = o.z + (dz / dist) * min
      }
    }

    // 旋转盒障碍（房屋、院墙、教堂、田埂矮墙）
    this.resolveBoxes()

    // 跳跃与重力
    const ground = this.sampleGround(this.position.x, this.position.z)
    if (this.jumpQueued && this.grounded) {
      this.vy = JUMP_SPEED
      this.grounded = false
    }
    this.jumpQueued = false

    if (!this.grounded) {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
      if (this.y <= ground) {
        this.y = ground
        this.vy = 0
        this.grounded = true
      }
    } else {
      this.y = ground
    }

    const moving = this.velocity.length() > 0.35
    const targetEye = Math.max(this.y + EYE, WORLD.waterLevel + 1.05)
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 16)

    if (moving && this.grounded) {
      this.bobTime += dt * (run ? 11 : 7.5)
      if (this.onStep && Math.sin(this.bobTime) > 0.985) this.onStep()
    }
    const bob = moving && this.grounded ? Math.sin(this.bobTime) * (run ? 0.055 : 0.035) : 0

    this.camera.position.set(this.position.x, this.eyeY + bob, this.position.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }

  resolveBoxes() {
    for (const b of this.boxes) {
      const c = Math.cos(b.ry)
      const s = Math.sin(b.ry)
      const dx = this.position.x - b.x
      const dz = this.position.z - b.z
      let lx = dx * c - dz * s
      let lz = dx * s + dz * c

      const cx = Math.max(-b.hw, Math.min(b.hw, lx))
      const cz = Math.max(-b.hd, Math.min(b.hd, lz))
      const px = lx - cx
      const pz = lz - cz
      const dist = Math.hypot(px, pz)
      if (dist > RADIUS) continue

      if (dist < 0.0001) {
        // 已经在盒子内部：沿穿透更浅的轴推出
        const penX = b.hw + RADIUS - Math.abs(lx)
        const penZ = b.hd + RADIUS - Math.abs(lz)
        if (penX < penZ) lx = Math.sign(lx || 1) * (b.hw + RADIUS)
        else lz = Math.sign(lz || 1) * (b.hd + RADIUS)
      } else {
        lx = cx + (px / dist) * RADIUS
        lz = cz + (pz / dist) * RADIUS
      }

      this.position.x = b.x + lx * c + lz * s
      this.position.z = b.z - lx * s + lz * c
    }
  }

  canStand(x, z) {
    const r = Math.hypot(x, z)
    if (r > WORLD.walkLimit) return false
    const g = this.sampleGround(x, z)
    if (g < -0.55) return false
    return true
  }
}
