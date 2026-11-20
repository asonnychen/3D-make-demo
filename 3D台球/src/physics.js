import { BALL_R, HALF_L, HALF_W, POCKETS, CUE_NUMBER, RAIL_GAP_CORNER, RAIL_GAP_SIDE } from './constants.js'

function segDistSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  let t = 0
  if (len2 > 1e-12) {
    t = ((px - ax) * dx + (pz - az) * dz) / len2
    t = Math.max(0, Math.min(1, t))
  }
  const qx = ax + t * dx
  const qz = az + t * dz
  const ex = px - qx
  const ez = pz - qz
  return ex * ex + ez * ez
}

// Rapier 物理世界封装：球、库边、地面、落袋判定
export class BilliardsPhysics {
  constructor(RAPIER) {
    this.RAPIER = RAPIER
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = 1 / 120
    this.events = new RAPIER.EventQueue(true)
    this.balls = new Map()
    this.byCollider = new Map()
    this.potted = new Set()
    this.buildStatic()
  }

  buildStatic() {
    const { RAPIER, world } = this

    // 台面地面（袋口由落袋判定处理）
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0))
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF_L + 0.32, 0.05, HALF_W + 0.32)
        .setFriction(0.36)
        .setRestitution(0.18),
      groundBody,
    )

    const railY = 0.028
    const railH = 0.032
    const railT = 0.034
    const addRail = (hx, hz, x, z) => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, railY, z))
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, railH, hz)
          .setRestitution(0.72)
          .setFriction(0.2),
        body,
      )
    }

    // 长边库（避开中袋与角袋）
    const longSegs = [
      [-HALF_L + RAIL_GAP_CORNER, -RAIL_GAP_SIDE],
      [RAIL_GAP_SIDE, HALF_L - RAIL_GAP_CORNER],
    ]
    for (const zSign of [-1, 1]) {
      for (const [x1, x2] of longSegs) {
        addRail((x2 - x1) / 2, railT, (x1 + x2) / 2, zSign * (HALF_W + railT))
      }
    }

    // 短边库（避开角袋）
    for (const xSign of [-1, 1]) {
      addRail(railT, HALF_W - RAIL_GAP_CORNER, xSign * (HALF_L + railT), 0)
    }

    // 袋口导向颚：把库边缺口收窄到袋口大小，球不会从缝隙滚出桌面
    const addJaw = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.004) return
      const theta = Math.atan2(-(z2 - z1), x2 - x1)
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation((x1 + x2) / 2, 0.02, (z1 + z2) / 2)
          .setRotation({ x: 0, y: Math.sin(theta / 2), z: 0, w: Math.cos(theta / 2) }),
      )
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(len / 2, 0.04, 0.006)
          .setRestitution(0.4)
          .setFriction(0.2),
        body,
      )
    }

    for (const p of POCKETS) {
      const sx = Math.sign(p.x)
      const sz = Math.sign(p.z)
      if (Math.abs(p.x) < 0.001) {
        const zRail = sz * HALF_W
        addJaw(-RAIL_GAP_SIDE, zRail, -p.mouth, p.z)
        addJaw(RAIL_GAP_SIDE, zRail, p.mouth, p.z)
      } else {
        const gaps = [
          { x: sx * (HALF_L - RAIL_GAP_CORNER), z: sz * HALF_W },
          { x: sx * HALF_L, z: sz * (HALF_W - RAIL_GAP_CORNER) },
        ]
        for (const g of gaps) {
          const dx = g.x - p.x
          const dz = g.z - p.z
          const len = Math.hypot(dx, dz)
          if (len <= p.mouth) continue
          addJaw(g.x, g.z, p.x + (dx / len) * p.mouth, p.z + (dz / len) * p.mouth)
        }
      }
    }
  }

  createBalls(positions) {
    for (const ball of this.balls.values()) {
      this.world.removeRigidBody(ball.body)
    }
    this.balls.clear()
    this.byCollider.clear()
    this.potted.clear()
    for (const pos of positions) {
      this.addBall(pos.number, pos.x, pos.z)
    }
  }

  addBall(number, x, z, y = BALL_R) {
    const { RAPIER, world } = this
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.19)
        .setAngularDamping(0.72)
        .setCcdEnabled(true),
    )
    const collider = world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_R)
        .setMass(0.17)
        .setRestitution(0.94)
        .setFriction(0.11)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    const ball = { number, body, collider, lastX: x, lastZ: z }
    this.balls.set(number, ball)
    this.byCollider.set(collider.handle, number)
    return ball
  }

  get(number) {
    return this.balls.get(number)
  }

  shoot(number, dirX, dirZ, speed) {
    const ball = this.balls.get(number)
    if (!ball) return
    const vx = dirX * speed
    const vz = dirZ * speed
    ball.body.setLinvel({ x: vx, y: 0, z: vz }, true)
    // 轻微前旋，模拟杆法
    ball.body.setAngvel({ x: -vz / BALL_R * 0.45, y: 0, z: vx / BALL_R * 0.45 }, true)
  }

  step() {
    this.world.step(this.events)
    const impacts = []
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return
      const a = this.byCollider.get(h1)
      const b = this.byCollider.get(h2)
      if (a === undefined && b === undefined) return
      let speed = 0
      let isRail = false
      if (a !== undefined && b !== undefined) {
        const ba = this.balls.get(a).body
        const bb = this.balls.get(b).body
        const va = ba.linvel()
        const vb = bb.linvel()
        speed = Math.hypot(va.x - vb.x, va.z - vb.z)
      } else {
        const n = a !== undefined ? a : b
        const v = this.balls.get(n).body.linvel()
        speed = Math.hypot(v.x, v.z)
        isRail = true
      }
      impacts.push({ a, b, speed, isRail })
    })
    return impacts
  }

  // 检测落袋，返回本帧新落袋的球号
  collectPockets() {
    const captured = []
    const maxX = HALF_L + 0.025
    const maxZ = HALF_W + 0.025
    for (const ball of this.balls.values()) {
      if (this.potted.has(ball.number)) continue
      const p = ball.body.translation()
      const ax = ball.lastX ?? p.x
      const az = ball.lastZ ?? p.z
      ball.lastX = p.x
      ball.lastZ = p.z

      if (p.y < -0.25) {
        this.potted.add(ball.number)
        ball.body.setEnabled(false)
        captured.push(ball.number)
        continue
      }

      let hit = false
      for (const pocket of POCKETS) {
        const d2 = segDistSq(pocket.x, pocket.z, ax, az, p.x, p.z)
        if (d2 < pocket.r * pocket.r && p.y < 0.12) {
          ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
          ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
          ball.body.setEnabled(false)
          this.potted.add(ball.number)
          captured.push(ball.number)
          hit = true
          break
        }
      }
      if (hit) continue

      // 兜底：任何从袋口缝隙飞出的球都拉回台面，绝不留在桌外
      if (Math.abs(p.x) > maxX || Math.abs(p.z) > maxZ) {
        const nx = Math.max(-HALF_L + BALL_R, Math.min(HALF_L - BALL_R, p.x))
        const nz = Math.max(-HALF_W + BALL_R, Math.min(HALF_W - BALL_R, p.z))
        ball.body.setTranslation({ x: nx, y: BALL_R, z: nz }, true)
        ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        ball.lastX = nx
        ball.lastZ = nz
      }
    }
    return captured
  }

  isPotted(number) {
    return this.potted.has(number)
  }

  respawnCue(x, z) {
    const ball = this.balls.get(CUE_NUMBER)
    if (!ball) return
    this.potted.delete(CUE_NUMBER)
    ball.body.setEnabled(true)
    ball.body.setTranslation({ x, y: BALL_R, z }, true)
    ball.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    ball.lastX = x
    ball.lastZ = z
  }

  setBall(number, x, z, y = BALL_R) {
    const ball = this.balls.get(number)
    if (!ball) return
    this.potted.delete(number)
    ball.body.setEnabled(true)
    ball.body.setTranslation({ x, y, z }, true)
    ball.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    ball.lastX = x
    ball.lastZ = z
  }

  snapshot() {
    const out = []
    for (const ball of this.balls.values()) {
      const t = ball.body.translation()
      const r = ball.body.rotation()
      out.push({ number: ball.number, x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w })
    }
    return out
  }

  moving() {
    let moving = false
    for (const ball of this.balls.values()) {
      if (this.potted.has(ball.number)) continue
      const v = ball.body.linvel()
      const a = ball.body.angvel()
      if (v.x * v.x + v.y * v.y + v.z * v.z > 0.0006) moving = true
      else if (a.x * a.x + a.y * a.y + a.z * a.z > 0.04) moving = true
      if (moving) break
    }
    return moving
  }

  maxSpeed() {
    let max = 0
    for (const ball of this.balls.values()) {
      if (this.potted.has(ball.number)) continue
      const v = ball.body.linvel()
      max = Math.max(max, Math.hypot(v.x, v.z))
    }
    return max
  }

  cuePosition() {
    const ball = this.balls.get(CUE_NUMBER)
    if (!ball) return { x: 0, y: BALL_R, z: 0 }
    const t = ball.body.translation()
    return { x: t.x, y: t.y, z: t.z }
  }

  findFreeSpot(preferredX, preferredZ) {
    const occupied = []
    for (const ball of this.balls.values()) {
      if (ball.number === CUE_NUMBER) continue
      if (this.potted.has(ball.number)) continue
      const t = ball.body.translation()
      occupied.push({ x: t.x, z: t.z })
    }
    const minDist = BALL_R * 2.15
    const candidates = [{ x: preferredX, z: preferredZ }]
    for (let ring = 1; ring <= 6; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        candidates.push({
          x: preferredX + Math.cos(a) * ring * BALL_R * 2.4,
          z: preferredZ + Math.sin(a) * ring * BALL_R * 2.4,
        })
      }
    }
    for (const c of candidates) {
      const inside = Math.abs(c.x) < HALF_L - BALL_R * 1.4 && Math.abs(c.z) < HALF_W - BALL_R * 1.4
      if (!inside) continue
      let ok = true
      for (const o of occupied) {
        if (Math.hypot(c.x - o.x, c.z - o.z) < minDist) {
          ok = false
          break
        }
      }
      if (ok) return c
    }
    return { x: preferredX, z: preferredZ }
  }
}
