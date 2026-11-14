/* ============================================================
   怪物：程序化方块僵尸
   - 用顶点色拼出人形，一个网格 + 一盏方向光
   - 会游荡、发现玩家后追击、贴身攻击
   - 被剑砍会闪红、被击退，死亡掉落材料
   ============================================================ */

import { Color, Entity, Mesh, MeshInstance, StandardMaterial, Vec3 } from 'playcanvas'
import { BLOCK } from './blocks.js'

/* ------------------------------------------------------------ 几何 */

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.78 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.7 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.86 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.82 },
]

function buildZombieGeometry() {
  const positions = []
  const normals = []
  const uvs = []
  const colors = []
  const indices = []

  const addBox = (x0, y0, z0, x1, y1, z1, hex) => {
    const c = new Color().fromString(hex)
    const min = [x0, y0, z0]
    const max = [x1, y1, z1]
    for (const face of FACES) {
      const base = positions.length / 3
      for (const corner of face.corners) {
        positions.push(
          corner[0] ? max[0] : min[0],
          corner[1] ? max[1] : min[1],
          corner[2] ? max[2] : min[2],
        )
        normals.push(face.dir[0], face.dir[1], face.dir[2])
        uvs.push(0, 0)
        colors.push(c.r * face.shade, c.g * face.shade, c.b * face.shade, 1)
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  const SKIN = '#6f9e5a'
  const SKIN_DARK = '#5b8749'
  const SHIRT = '#3f6f8f'
  const SHIRT_DARK = '#355d78'
  const PANTS = '#3a4560'
  const EYE = '#1b2318'

  // 腿
  addBox(-0.26, 0, -0.11, -0.02, 0.78, 0.13, PANTS)
  addBox(0.02, 0, -0.11, 0.26, 0.78, 0.13, PANTS)
  // 身体
  addBox(-0.26, 0.78, -0.14, 0.26, 1.46, 0.14, SHIRT)
  addBox(-0.26, 0.78, -0.15, 0.26, 1.0, 0.15, SHIRT_DARK)
  // 手臂（前伸）
  addBox(-0.47, 0.86, -0.3, -0.28, 1.44, -0.1, SKIN_DARK)
  addBox(0.28, 0.86, -0.3, 0.47, 1.44, -0.1, SKIN_DARK)
  // 头
  addBox(-0.23, 1.46, -0.24, 0.23, 1.94, 0.2, SKIN)
  // 眼睛
  addBox(-0.16, 1.72, -0.255, -0.06, 1.8, -0.235, EYE)
  addBox(0.06, 1.72, -0.255, 0.16, 1.8, -0.235, EYE)
  // 嘴
  addBox(-0.09, 1.56, -0.255, 0.09, 1.6, -0.235, EYE)

  return { positions, normals, uvs, colors, indices }
}

/** 射线与轴对齐包围盒求交，返回最近距离 */
function rayBox(origin, dir, min, max) {
  let tmin = 0
  let tmax = Infinity
  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z
    const d = axis === 0 ? dir.x : axis === 1 ? dir.y : dir.z
    const lo = min[axis]
    const hi = max[axis]
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null
      continue
    }
    let t1 = (lo - o) / d
    let t2 = (hi - o) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    if (t1 > tmin) tmin = t1
    if (t2 < tmax) tmax = t2
    if (tmin > tmax) return null
  }
  return tmin
}

/** 从 fromY 往下找地面高度（脚底 y） */
function groundBelow(world, x, z, fromY) {
  const bx = Math.floor(x)
  const bz = Math.floor(z)
  for (let y = Math.floor(fromY); y >= 0; y--) {
    if (world.isSolid(bx, y, bz)) return y + 1
  }
  return 1
}

/* ------------------------------------------------------------ 怪物 */

const MOB_SPEED = 2.5
const MOB_DAMAGE = 2
const MOB_MAX_HP = 20

export class Mob {
  constructor(app, world, mesh, position) {
    this.app = app
    this.world = world
    this.position = new Vec3(position.x, position.y, position.z)
    this.velocity = new Vec3(0, 0, 0)
    this.hp = MOB_MAX_HP
    this.maxHp = MOB_MAX_HP
    this.attackTimer = 0.6
    this.hurtTimer = 0
    this.stagger = 0
    this.attackAnim = 0
    this.wanderTimer = 0
    this.wanderAngle = Math.random() * Math.PI * 2
    this.idle = false
    this.dead = false
    this.chasing = false

    const material = new StandardMaterial()
    material.diffuse = new Color(1, 1, 1)
    material.ambient = new Color(1, 1, 1)
    material.diffuseVertexColor = true
    material.diffuseVertexColorChannel = 'rgb'
    material.specular = new Color(0.03, 0.03, 0.03)
    material.gloss = 0.15
    material.useFog = true
    material.update()
    this.material = material

    this.entity = new Entity('zombie')
    this.entity.addComponent('render', { meshInstances: [new MeshInstance(mesh, material)] })
    this.entity.render.castShadows = false
    this.entity.setPosition(this.position)
    app.root.addChild(this.entity)
  }

  get alive() {
    return !this.dead
  }

  /** 受到伤害，返回是否死亡 */
  hurt(amount, fromDir) {
    if (this.dead) return false
    this.hp -= amount
    this.hurtTimer = 0.18
    this.material.diffuse = new Color(1, 0.32, 0.3)
    this.material.update()
    if (fromDir) {
      // 沿攻击方向击退，并在短时间内打断追击，让击退看得出来
      this.velocity.x = fromDir.x * 7.5
      this.velocity.z = fromDir.z * 7.5
      this.velocity.y = 3.2
      this.stagger = 0.5
    }
    if (this.hp <= 0) {
      this.dead = true
      return true
    }
    return false
  }

  /** 玩家看得见的包围盒 */
  bounds() {
    const p = this.position
    return {
      min: [p.x - 0.4, p.y, p.z - 0.4],
      max: [p.x + 0.4, p.y + 1.95, p.z + 0.4],
    }
  }

  update(dt, player) {
    if (this.dead) return

    // 受击闪红
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt
      if (this.hurtTimer <= 0) {
        this.material.diffuse = new Color(1, 1, 1)
        this.material.update()
      }
    }
    if (this.attackAnim > 0) this.attackAnim -= dt

    const p = player.position
    const dx = p.x - this.position.x
    const dz = p.z - this.position.z
    const dy = p.y - this.position.y
    const dist = Math.hypot(dx, dz)

    // 被击退后的硬直：这段时间只吃击退速度，不再主动追击
    const staggered = this.stagger > 0
    if (staggered) this.stagger -= dt

    let moveX = 0
    let moveZ = 0

    const canSee = !staggered && dist < 18 && Math.abs(dy) < 7 && !player.dead
    this.chasing = canSee && dist > 1.5

    if (canSee) {
      if (dist > 1.5) {
        moveX = dx / dist
        moveZ = dz / dist
      }
      this.attackTimer -= dt
      if (dist < 1.9 && Math.abs(dy) < 2.2 && this.attackTimer <= 0) {
        this.attackTimer = 1.7
        this.attackAnim = 0.28
        player.hurt(MOB_DAMAGE, this.position)
      }
    } else if (!staggered) {
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1.6 + Math.random() * 3.2
        this.idle = Math.random() < 0.35
        this.wanderAngle += (Math.random() - 0.5) * 2.6
      }
      if (!this.idle) {
        moveX = Math.cos(this.wanderAngle)
        moveZ = Math.sin(this.wanderAngle)
      }
    }

    // 击退惯性
    const vx = moveX * MOB_SPEED + this.velocity.x
    const vz = moveZ * MOB_SPEED + this.velocity.z
    this.velocity.x *= Math.max(0, 1 - 7 * dt)
    this.velocity.z *= Math.max(0, 1 - 7 * dt)
    this.velocity.y = Math.max(0, this.velocity.y - 18 * dt)

    const nx = this.position.x + vx * dt
    const nz = this.position.z + vz * dt
    const feetY = this.position.y

    // 逐轴碰撞：撞墙就沿另一轴滑，矮台阶自动迈上去
    const stepX = this.canStand(nx, feetY, this.position.z) || this.canStand(nx, feetY + 1.05, this.position.z)
    if (stepX) this.position.x = nx
    const stepZ =
      this.canStand(this.position.x, feetY, nz) || this.canStand(this.position.x, feetY + 1.05, nz)
    if (stepZ) this.position.z = nz

    // 贴地
    const ground = groundBelow(this.world, this.position.x, this.position.z, feetY + 1.2)
    const targetY = ground + this.velocity.y * dt
    this.position.y += (targetY - this.position.y) * Math.min(1, 16 * dt)

    // 追击 / 被打退时朝玩家，游荡时朝行进方向（模型正面朝 -Z）
    const face = canSee || staggered ? Math.atan2(-dx, -dz) : Math.atan2(-moveX, -moveZ)
    if (Math.abs(moveX) + Math.abs(moveZ) > 0.01 || canSee || staggered) {
      this.entity.setEulerAngles(0, (face * 180) / Math.PI, 0)
    }

    // 攻击时向前一顿
    const lunge = this.attackAnim > 0 ? Math.sin(((0.28 - this.attackAnim) / 0.28) * Math.PI) * 0.16 : 0
    const fx = -Math.sin(face)
    const fz = -Math.cos(face)
    this.entity.setPosition(
      this.position.x + fx * lunge,
      this.position.y,
      this.position.z + fz * lunge,
    )
  }

  canStand(x, y, z) {
    const bx = Math.floor(x)
    const bz = Math.floor(z)
    const feet = Math.floor(y + 0.1)
    const head = Math.floor(y + 1.7)
    // 不走进水里，也不踩进空岛外
    if (this.world.getBlock(bx, feet, bz) === BLOCK.WATER) return false
    for (let by = feet; by <= head; by++) {
      if (this.world.isSolid(bx, by, bz)) return false
    }
    return true
  }

  dispose() {
    this.entity.destroy()
    this.material.destroy()
  }
}

/* ------------------------------------------------------------ 管理器 */

export class MobManager {
  constructor(app, world, player) {
    this.app = app
    this.world = world
    this.player = player
    this.mobs = []
    this.spawnTimer = 0
    this.onDeath = null
    this.geo = null
    this.device = app.graphicsDevice
  }

  /** 顶点数据只算一次，每个怪物各自持有一个 Mesh */
  buildMesh() {
    if (!this.geo) this.geo = buildZombieGeometry()
    const geo = this.geo
    const mesh = new Mesh(this.device)
    mesh.setPositions(new Float32Array(geo.positions))
    mesh.setNormals(new Float32Array(geo.normals))
    mesh.setUvs(0, new Float32Array(geo.uvs))
    mesh.setColors(new Float32Array(geo.colors))
    mesh.setIndices(new Uint32Array(geo.indices))
    mesh.update()
    return mesh
  }

  /** 在玩家周围找一个能站人的地方 */
  findSpawnPoint(minDist = 18, maxDist = 40) {
    const p = this.player.position
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = minDist + Math.random() * (maxDist - minDist)
      const x = p.x + Math.cos(angle) * radius
      const z = p.z + Math.sin(angle) * radius
      if (x < 4 || z < 4 || x > 156 || z > 156) continue
      const ground = groundBelow(this.world, x, z, 60)
      const top = this.world.getBlock(Math.floor(x), ground - 1, Math.floor(z))
      if (top === BLOCK.WATER || top === BLOCK.LEAVES) continue // 水 / 树叶
      if (ground <= 23) continue // 不要生成在水里
      if (Math.abs(ground - p.y) > 18) continue
      return { x, y: ground, z }
    }
    return null
  }

  spawn(count = 1) {
    for (let i = 0; i < count; i++) {
      const point = this.findSpawnPoint()
      if (!point) continue
      this.mobs.push(new Mob(this.app, this.world, this.buildMesh(), point))
    }
  }

  reset() {
    for (const mob of this.mobs) mob.dispose()
    this.mobs = []
    this.spawnTimer = 0
  }

  get aliveCount() {
    return this.mobs.filter((m) => m.alive).length
  }

  update(dt) {
    for (const mob of this.mobs) mob.update(dt, this.player)

    // 清理死亡怪物
    const dead = this.mobs.filter((m) => m.dead)
    if (dead.length) {
      for (const mob of dead) {
        this.onDeath?.(mob)
        mob.dispose()
      }
      this.mobs = this.mobs.filter((m) => !m.dead)
    }

    // 数量太少时补一只
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.aliveCount < 4 && !this.player.dead) {
      this.spawnTimer = 7
      this.spawn(1)
    }
  }

  /** 用射线找最近的怪物，返回 { mob, distance } */
  pick(origin, dir, maxDistance = 4) {
    let best = null
    let bestDist = maxDistance
    for (const mob of this.mobs) {
      if (!mob.alive) continue
      const { min, max } = mob.bounds()
      const t = rayBox(origin, dir, min, max)
      if (t != null && t >= 0 && t < bestDist) {
        bestDist = t
        best = mob
      }
    }
    return best ? { mob: best, distance: bestDist } : null
  }
}
