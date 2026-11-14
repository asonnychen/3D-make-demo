/* ============================================================
   第一人称玩家：指针锁定视角、重力、逐轴 AABB 碰撞
   ============================================================ */

import { Quat, Vec3 } from 'playcanvas'
import { PLAYER, WORLD_HEIGHT } from './config.js'
import { BLOCK } from './blocks.js'

const EPS = 1e-4

export class Player {
  constructor(world, cameraEntity) {
    this.world = world
    this.camera = cameraEntity

    this.position = new Vec3(0, 30, 0) // 脚底中心
    this.velocity = new Vec3(0, 0, 0)
    this.yaw = 0 // 水平朝向（度）
    this.pitch = 0 // 俯仰（度）
    this.onGround = false
    this.flying = false
    this.inWater = false
    this.eyeInWater = false

    /* 生命值 */
    this.maxHealth = 20
    this.health = 20
    this.dead = false
    this.invuln = 0
    this.sinceHurt = 0
    this.regenTimer = 0
    this.onHurt = null
    this.onDeath = null

    this._qy = new Quat()
    this._qx = new Quat()
    this._forward = new Vec3()
    this._right = new Vec3()
  }

  spawnAt(point) {
    this.position.set(point.x, point.y + 0.05, point.z)
    this.velocity.set(0, 0, 0)
    this.yaw = 35
    this.pitch = -12
    this.onGround = false
  }

  /** 受伤：扣血 + 击退 + 短暂无敌帧 */
  hurt(amount, sourcePos) {
    if (this.dead || this.invuln > 0) return false
    this.health = Math.max(0, this.health - amount)
    this.invuln = 0.5
    this.sinceHurt = 0
    this.regenTimer = 0

    if (sourcePos) {
      const dx = this.position.x - sourcePos.x
      const dz = this.position.z - sourcePos.z
      const len = Math.hypot(dx, dz) || 1
      this.velocity.x += (dx / len) * 4.6
      this.velocity.z += (dz / len) * 4.6
      if (!this.flying) this.velocity.y = Math.max(this.velocity.y, 4.2)
    }

    this.onHurt?.(amount)
    if (this.health <= 0) {
      this.dead = true
      this.onDeath?.()
    }
    return true
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  revive() {
    this.health = this.maxHealth
    this.dead = false
    this.invuln = 1.2
    this.sinceHurt = 0
    this.regenTimer = 0
    this.velocity.set(0, 0, 0)
  }

  get eyePosition() {
    return new Vec3(this.position.x, this.position.y + PLAYER.eye, this.position.z)
  }

  /** 相机朝向（含俯仰）的单位向量 */
  getLookDirection(out = new Vec3()) {
    const p = (this.pitch * Math.PI) / 180
    const y = (this.yaw * Math.PI) / 180
    const cp = Math.cos(p)
    out.set(-cp * Math.sin(y), Math.sin(p), -cp * Math.cos(y))
    return out
  }

  /** 鼠标移动 → 视角 */
  look(dx, dy, sensitivity = 0.18) {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    if (this.pitch > 89) this.pitch = 89
    if (this.pitch < -89) this.pitch = -89
    if (this.yaw > 360 || this.yaw < -360) this.yaw %= 360
  }

  syncCamera() {
    const eye = this.eyePosition
    this.camera.setPosition(eye)
    this._qy.setFromEulerAngles(0, this.yaw, 0)
    this._qx.setFromEulerAngles(this.pitch, 0, 0)
    this._qy.mul(this._qx)
    this.camera.setRotation(this._qy)
  }

  /* ---------------------------------------------------------- 物理 */

  update(dt, input) {
    // 无敌帧与缓慢回血
    if (this.invuln > 0) this.invuln -= dt
    if (!this.dead) {
      this.sinceHurt += dt
      if (this.sinceHurt > 6 && this.health < this.maxHealth) {
        this.regenTimer += dt
        if (this.regenTimer >= 2.2) {
          this.regenTimer = 0
          this.heal(1)
        }
      }
    }

    const world = this.world
    const speed = this.flying
      ? PLAYER.flySpeed * (input.sprint ? 1.8 : 1)
      : input.sprint
        ? PLAYER.sprintSpeed
        : PLAYER.walkSpeed

    // 水平方向：以相机朝向为基准
    const yawRad = (this.yaw * Math.PI) / 180
    const sin = Math.sin(yawRad)
    const cos = Math.cos(yawRad)
    let mx = 0
    let mz = 0
    if (input.forward) {
      mx -= sin
      mz -= cos
    }
    if (input.back) {
      mx += sin
      mz += cos
    }
    if (input.left) {
      mx -= cos
      mz += sin
    }
    if (input.right) {
      mx += cos
      mz -= sin
    }
    const len = Math.hypot(mx, mz)
    if (len > 0) {
      mx = (mx / len) * speed
      mz = (mz / len) * speed
    }

    // 地面上的加速更"跟手"，空中保留一点惯性
    const blend = this.flying ? 1 : this.onGround ? 1 : 0.14
    this.velocity.x += (mx - this.velocity.x) * Math.min(1, blend * 18 * dt)
    this.velocity.z += (mz - this.velocity.z) * Math.min(1, blend * 18 * dt)

    // 垂直
    if (this.flying) {
      let vy = 0
      if (input.jump) vy += PLAYER.flySpeed
      if (input.sprint) vy -= PLAYER.flySpeed
      this.velocity.y += (vy - this.velocity.y) * Math.min(1, 14 * dt)
    } else if (this.inWater) {
      // 游泳：浮力抵消大部分重力，按空格上浮
      this.velocity.y -= PLAYER.gravity * 0.22 * dt
      if (input.jump) this.velocity.y += 16 * dt
      this.velocity.y *= 1 - Math.min(1, 3.2 * dt)
      if (this.velocity.y > 3.2) this.velocity.y = 3.2
      if (this.velocity.y < -3.6) this.velocity.y = -3.6
    } else {
      this.velocity.y -= PLAYER.gravity * dt
      if (this.velocity.y < -PLAYER.maxFall) this.velocity.y = -PLAYER.maxFall
      if (input.jump && this.onGround) {
        this.velocity.y = PLAYER.jumpSpeed
        this.onGround = false
      }
    }

    this.moveWithCollisions(dt)

    // 掉出世界底部就拉回来
    if (this.position.y < -12) {
      const spawn = world.findSpawn()
      this.spawnAt(spawn)
    }
  }

  moveWithCollisions(dt) {
    const steps = Math.max(1, Math.ceil((Math.abs(this.velocity.x) + Math.abs(this.velocity.y) + Math.abs(this.velocity.z)) * dt / 0.25))
    const sdt = dt / steps
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, this.velocity.x * sdt)
      this.moveAxis(2, this.velocity.z * sdt)
      this.moveAxis(1, this.velocity.y * sdt)
    }

    // 触地检测：脚下 0.05 格内有实体方块
    const feetY = this.position.y
    this.onGround = this.flying
      ? false
      : this.collides(this.position.x, feetY - 0.06, this.position.z)

    // 水中判定
    const eye = this.eyePosition
    this.eyeInWater = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)) === BLOCK.WATER
    this.inWater = this.eyeInWater || this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.4),
      Math.floor(this.position.z),
    ) === BLOCK.WATER
  }

  moveAxis(axis, amount) {
    if (amount === 0) return
    const p = this.position
    if (axis === 0) p.x += amount
    else if (axis === 1) p.y += amount
    else p.z += amount

    if (this.collides(p.x, p.y, p.z)) {
      if (axis === 0) p.x -= amount
      else if (axis === 1) p.y -= amount
      else p.z -= amount
      if (axis === 1) this.velocity.y = 0
      else if (axis === 0) this.velocity.x = 0
      else this.velocity.z = 0
    }
  }

  /** 玩家包围盒是否与实体方块重叠 */
  collides(x, y, z) {
    const half = PLAYER.width / 2
    const minX = Math.floor(x - half + EPS)
    const maxX = Math.floor(x + half - EPS)
    const minY = Math.floor(y + EPS)
    const maxY = Math.floor(y + PLAYER.height - EPS)
    const minZ = Math.floor(z - half + EPS)
    const maxZ = Math.floor(z + half - EPS)

    for (let by = minY; by <= maxY; by++) {
      if (by < 0 || by >= WORLD_HEIGHT) continue
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (this.world.isSolid(bx, by, bz)) return true
        }
      }
    }
    return false
  }

  /** 放置方块时判断会不会把自己埋进去 */
  intersectsBlock(bx, by, bz) {
    const half = PLAYER.width / 2
    const x = this.position.x
    const y = this.position.y
    const z = this.position.z
    return (
      bx + 1 > x - half &&
      bx < x + half &&
      by + 1 > y &&
      by < y + PLAYER.height &&
      bz + 1 > z - half &&
      bz < z + half
    )
  }
}
