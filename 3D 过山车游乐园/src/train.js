import * as THREE from 'three'
import { GRAVITY } from './constants.js'

const UP = new THREE.Vector3(0, 1, 0)

function makeMaterial(color, roughness = 0.55, metalness = 0.18) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function createRider(seatColor, index) {
  const rider = new THREE.Group()
  const skinColors = [0xf2b894, 0xc88962, 0x8f5f45, 0xf0c6a0]
  const shirtColors = [0xff6b35, 0x72e6d1, 0xffc857, 0xf15b75, 0x5b8def, 0xf4efe0]
  const skin = makeMaterial(skinColors[index % skinColors.length], 0.82, 0)
  const shirt = makeMaterial(shirtColors[index % shirtColors.length], 0.72, 0)
  const pants = makeMaterial(0x263746, 0.78, 0)

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.64, 6), shirt)
  torso.position.y = 0.35
  torso.castShadow = true
  rider.add(torso)

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), skin)
  head.position.y = 0.86
  head.castShadow = true
  rider.add(head)

  const legLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.58, 6), pants)
  legLeft.position.set(-0.13, -0.18, 0.1)
  legLeft.rotation.x = -0.72
  rider.add(legLeft)
  const legRight = legLeft.clone()
  legRight.position.x = 0.13
  rider.add(legRight)

  const arms = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.25, 0.58, 0)
    pivot.rotation.z = side * 0.14
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.58, 6), shirt)
    arm.position.y = -0.28
    arm.castShadow = true
    pivot.add(arm)
    rider.add(pivot)
    arms.push({ pivot, side })
  }

  rider.userData.arms = arms
  rider.userData.phase = index * 1.37
  rider.userData.excitement = 0
  return rider
}

function createPassengerCar(index) {
  const car = new THREE.Group()
  const bodyMaterial = makeMaterial(index % 2 === 0 ? 0xff6b35 : 0xffc857, 0.46, 0.24)
  const darkMaterial = makeMaterial(0x25343d, 0.42, 0.58)
  const seatMaterial = makeMaterial(0x20303b, 0.76, 0.08)

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.42, 3.25), bodyMaterial)
  chassis.position.y = -0.06
  chassis.castShadow = true
  car.add(chassis)

  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.5, 0.75), bodyMaterial)
  nose.position.set(0, 0.12, 1.55)
  nose.rotation.x = -0.18
  nose.castShadow = true
  car.add(nose)

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 0.62), seatMaterial)
  seat.position.set(0, 0.45, -0.82)
  seat.rotation.x = -0.12
  car.add(seat)

  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.22, 12), darkMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(side * 0.82, -0.28, 1.02)
    wheel.castShadow = true
    car.add(wheel)
    const rearWheel = wheel.clone()
    rearWheel.position.z = -1.12
    car.add(rearWheel)
  }

  const riders = []
  for (let riderIndex = 0; riderIndex < 2; riderIndex += 1) {
    const rider = createRider(bodyMaterial.color, index * 2 + riderIndex)
    rider.position.set(riderIndex === 0 ? -0.55 : 0.55, 0.22, 0.18)
    rider.rotation.y = riderIndex === 0 ? 0.04 : -0.04
    car.add(rider)
    riders.push(rider)
  }
  car.userData.riders = riders
  return car
}

function createHeadCar() {
  const car = new THREE.Group()
  const shellMaterial = makeMaterial(0xff6b35, 0.32, 0.42)
  const darkMaterial = makeMaterial(0x1d2a32, 0.3, 0.72)
  const accentMaterial = makeMaterial(0x72e6d1, 0.28, 0.48)

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.55, 3.5), shellMaterial)
  chassis.position.y = -0.08
  chassis.castShadow = true
  car.add(chassis)

  const hood = new THREE.Mesh(new THREE.ConeGeometry(1.22, 2.7, 8), shellMaterial)
  hood.rotation.x = Math.PI / 2
  hood.position.set(0, 0.05, 1.62)
  hood.scale.z = 0.7
  hood.castShadow = true
  car.add(hood)

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.82, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMaterial)
  canopy.position.set(0, 0.28, -0.72)
  canopy.scale.set(1, 0.72, 1.25)
  car.add(canopy)
  car.userData.canopy = canopy

  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), darkMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(side * 0.84, -0.3, 1.06)
    wheel.castShadow = true
    car.add(wheel)
    const rearWheel = wheel.clone()
    rearWheel.position.z = -1.14
    car.add(rearWheel)
  }

  const headlight = new THREE.SpotLight(0xdffbff, 0, 58, 0.38, 0.62, 1.35)
  headlight.position.set(0, 0.58, 1.65)
  headlight.target.position.set(0, 0.1, 20)
  headlight.castShadow = false
  car.add(headlight, headlight.target)
  car.userData.headlight = headlight
  return car
}

export class TrainSimulator {
  constructor(scene, track) {
    this.scene = scene
    this.track = track
    this.group = new THREE.Group()
    this.group.name = '四节铰接过山车列车'
    this.scene.add(this.group)

    this.head = createHeadCar()
    this.cars = [this.head]
    for (let index = 0; index < 3; index += 1) {
      const car = createPassengerCar(index)
      this.cars.push(car)
      this.group.add(car)
    }
    this.group.add(this.head)

    this.u = 0.012
    this.speed = 0
    this.running = false
    this.stopped = true
    this.gForce = 1
    this.verticalAcceleration = 0
    this.lastZone = 'cruise'
    this.updateVisuals(0, true)
  }

  get headFrame() {
    return this.track.sampleFrame(this.u)
  }

  start() {
    if (this.stopped) {
      if (this.u > 0.95) this.u = 0.012
      this.speed = 0
      this.stopped = false
    }
    this.running = true
  }

  pause() {
    this.running = false
  }

  toggle() {
    if (this.running) this.pause()
    else this.start()
  }

  /**
   * 物理参数（单位：米 / 秒）
   *
   * CHAIN_SPEED 链条提升速度。真实过山车链条段约 4~6 m/s，
   * 这里取 6.5 m/s，让列车爬到山顶时保留可观的动能。
   * ROLLING 滚阻加速度。过山车轮轨滚阻极小，取 0.025 m/s² 已足够明显。
   * DRAG 二次空气阻力系数。0.008 会让列车在 20 m/s 时承受
   * 3.2 m/s² 的阻力，整圈损耗超过链条储能，必须压到 0.0004 量级。
   */
  static CHAIN_SPEED = 6.5
  static CHAIN_ACCEL = 3
  static ROLLING = 0.025
  static DRAG = 0.0004
  static BRAKE_DECEL = 4.5

  zoneAt(u) {
    const ranges = this.track.ranges
    if (u >= ranges.chain[0] && u <= ranges.chain[1]) return 'chain'
    if (u >= ranges.brake[0] && u <= ranges.brake[1]) return 'brake'
    if (ranges.loops.some(([start, end]) => u >= start && u <= end)) return 'loop'
    const frame = this.track.sampleFrame(u)
    if (frame.tangent.y < -0.08 && this.speed > 12) return 'dive'
    return 'cruise'
  }

  /**
   * 物理速度积分：
   * 链条段使用恒速牵引；自由滑行段由切线方向的重力分量驱动，
   * 同时叠加滚动摩擦与二次空气阻力。速度允许变为负值，因此能量不足时会真实倒溜。
   */
  updatePhysics(delta) {
    if (!this.running) {
      this.updateGForce(delta)
      return
    }

    const frame = this.track.sampleFrame(this.u)
    const zone = this.zoneAt(this.u)
    this.lastZone = zone
    let acceleration = 0

    if (zone === 'chain') {
      const targetSpeed = TrainSimulator.CHAIN_SPEED
      acceleration = targetSpeed > this.speed ? TrainSimulator.CHAIN_ACCEL : -3
      this.speed += acceleration * delta
      this.speed = THREE.MathUtils.clamp(this.speed, 0, targetSpeed)
    } else if (zone === 'brake') {
      const stopU = this.track.ranges.brake[1]
      // 剩余距离必须换算成米，否则目标速度会被算成不足 1 m/s 而原地趴窝
      const remainingMeters = Math.max(0, stopU - this.u) * this.track.length
      // 目标速度按 v² = 2·a·s 收敛到零，列车会无限逼近停车点却永远差最后一步，
      // 因此距离不足一个车长时直接判定进站停车
      if (remainingMeters <= 4.5) {
        this.u = stopU
        this.speed = 0
        this.running = false
        this.stopped = true
        this.updateGForce(delta)
        return
      }
      const desiredSpeed = Math.sqrt(2 * TrainSimulator.BRAKE_DECEL * remainingMeters)
      if (this.speed > desiredSpeed) {
        acceleration = -TrainSimulator.BRAKE_DECEL
        this.speed = Math.max(desiredSpeed, this.speed + acceleration * delta)
      } else {
        this.speed = desiredSpeed
        acceleration = 0
      }
    } else {
      const gravityAcceleration = -GRAVITY * frame.tangent.y
      const rollingFriction = TrainSimulator.ROLLING * Math.sign(this.speed || 1)
      const airDrag = TrainSimulator.DRAG * this.speed * Math.abs(this.speed)
      acceleration = gravityAcceleration - rollingFriction - airDrag
      this.speed += acceleration * delta
      if (Math.abs(this.speed) < 0.025 && Math.abs(acceleration) < 0.35) this.speed = 0
    }

    this.u += (this.speed / this.track.length) * delta
    if (this.u >= 1) this.u -= 1

    const stopU = this.track.ranges.brake[1]
    if (zone === 'brake' && this.u >= stopU) {
      this.u = stopU
      this.speed = 0
      this.running = false
      this.stopped = true
    }
    this.updateGForce(delta)
  }

  /**
   * 过山车 G 值计算：
   *
   * 乘客承受的加速度 = 向心加速度 + 重力沿座椅法线方向的分量，
   * 沿轨道 up（座椅朝向）取投影后除以重力加速度即得 G 值。
   * 曲率由轨道系统预计算并做过中值滤波，可剔除回环接缝处的孤立尖峰，
   * 同时保留回环内部持续的高曲率。
   *
   * 竖直回环顶点处座椅倒扣，重力沿法线方向为 +1g（压向座椅），
   * 因此 G 值 = v²κ/g + 1；俯冲段则叠加负的抬升分量。
   *
   * 回环入口与直轨相接处存在真实的几何折角，会产生瞬时 G 值尖峰。
   * 这里再做一层时间平滑（真实过山车的 G 值记录仪同样带滤波），
   * 尖峰被压低，而回环内部持续数秒的高 G 值得以保留。
   */
  updateGForce(delta = 0) {
    const frame = this.track.sampleFrame(this.u)
    const curvature = this.track.sampleCurvature(this.u)
    // 向心加速度在轨道法线（座椅 up）方向上的分量
    const normalAcceleration = this.speed * this.speed * curvature.dot(frame.up)
    // 重力沿座椅法线方向的分量：seatUp.y 为 +1 时重力压在座椅上
    const gravityOnNormal = GRAVITY * frame.up.y
    this.verticalAcceleration = normalAcceleration
    const target = Math.max(0, (normalAcceleration + gravityOnNormal) / GRAVITY)
    if (delta > 0) {
      this.gForce = THREE.MathUtils.damp(this.gForce, target, 3.2, delta)
    } else {
      this.gForce = target
    }
  }

  updateVisuals(delta, immediate = false) {
    const spacing = 3.65 / this.track.length
    this.cars.forEach((car, index) => {
      const u = this.u - index * spacing
      const frame = this.track.sampleFrame(u)
      const targetPosition = frame.position.clone().addScaledVector(frame.up, 0.58)
      const matrix = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent)
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(matrix)

      if (immediate) {
        car.position.copy(targetPosition)
        car.quaternion.copy(targetQuaternion)
      } else {
        const positionAlpha = 1 - Math.exp(-delta * 18)
        const rotationAlpha = 1 - Math.exp(-delta * 11)
        car.position.lerp(targetPosition, positionAlpha)
        car.quaternion.slerp(targetQuaternion, rotationAlpha)
      }
    })

    const excitementTarget = this.gForce > 1.8 || (this.speed > 15 && this.lastZone === 'dive') ? 1 : 0
    this.cars.forEach((car) => {
      const riders = car.userData.riders ?? []
      riders.forEach((rider) => {
        rider.userData.excitement = THREE.MathUtils.damp(rider.userData.excitement, excitementTarget, 8, delta)
        const shake = Math.sin(this.track ? performance.now() * 0.012 + rider.userData.phase : 0) * 0.13 * rider.userData.excitement
        rider.userData.arms.forEach(({ pivot, side }) => {
          const raised = THREE.MathUtils.lerp(side * 0.14, side * 2.42, rider.userData.excitement)
          pivot.rotation.z = raised
          pivot.rotation.x = shake * side
        })
        rider.rotation.z = shake * 0.4
      })
    })
  }

  setNightMode(isNight) {
    const headlight = this.head.userData.headlight
    if (headlight) headlight.intensity = isNight ? 260 : 0
  }

  update(delta) {
    this.updatePhysics(delta)
    this.updateVisuals(delta)
  }
}
