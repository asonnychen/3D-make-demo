import * as THREE from 'three'
import { clonePreset } from './presets.js'
import { terrainHeight, isInsideLake } from './constants.js'

const UP = new THREE.Vector3(0, 1, 0)
const TEMP_MATRIX = new THREE.Matrix4()
const TEMP_QUATERNION = new THREE.Quaternion()
const TEMP_SCALE = new THREE.Vector3()

function disposeObject(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else child.material?.dispose?.()
  })
}

function basisQuaternion(right, up, forward) {
  TEMP_MATRIX.makeBasis(right, up, forward)
  return new THREE.Quaternion().setFromRotationMatrix(TEMP_MATRIX)
}

function cylinderBetween(start, end, radius) {
  const direction = new THREE.Vector3().subVectors(end, start)
  const length = direction.length()
  if (length < 0.001) return null
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize())
  return {
    position: start.clone().add(end).multiplyScalar(0.5),
    quaternion,
    scale: new THREE.Vector3(radius, length, radius),
  }
}

export class TrackSystem {
  constructor(scene, preset) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = '过山车轨道系统'
    this.scene.add(this.group)

    this.preset = clonePreset(preset)
    this.points = this.preset.points.map((item) => new THREE.Vector3(item.x, item.y, item.z))
    this.banks = [...this.preset.banks]
    this.frameCount = 900
    this.frames = []
    this.controlUs = []
    this.controlGroup = new THREE.Group()
    this.controlGroup.name = '轨道编辑控制球'
    this.controlGroup.visible = false
    this.scene.add(this.controlGroup)
    this.controlMeshes = []
    this.selectedIndex = 0
    this.rebuildPending = false
    this.onRebuild = null

    this.buildCurve()
    this.buildFrames()
    this.buildControlMeshes()
    this.rebuildGeometry()
  }

  /**
   * 构建轨道曲线。
   *
   * 回环段按真实圆弧密集采样（曲率恒为 1/R），
   * 其余段使用 uniform CatmullRom（uniform 在控制点间距均匀时最稳定；
   * centripetal 虽能避免尖角，却会让圆弧内部的曲率变成锯齿状）。
   * 折角控制点之间插入平滑过渡点，进一步抑制曲率尖峰。
   */
  buildCurve() {
    const smoothed = this.smoothControlPoints()
    this.curve = new THREE.CatmullRomCurve3(smoothed, true, 'catmullrom', 0.5)
    this.length = this.curve.getLength()
  }

  /**
   * 在控制点之间插入过渡点。
   * 过渡点沿「相邻两控制点的中点方向」偏移，使曲线在控制点处切线连续。
   *
   * 注意：回环圆弧段由密集采样点构成，不参与平滑，
   * 否则会破坏圆弧恒定的曲率。
   */
  smoothControlPoints() {
    const source = this.points
    const result = []
    for (let index = 0; index < source.length; index += 1) {
      const current = source[index]
      const arc = (this.preset.loopArcs ?? []).find((item) => item.start === index)
      if (arc) {
        result.push(...this.applyLoopArc(arc, index))
        continue
      }
      const previous = source[(index - 1 + source.length) % source.length]
      const next = source[(index + 1) % source.length]
      result.push(current.clone())
      // 只在方向变化明显的折角处插入过渡点
      const incoming = current.clone().sub(previous)
      const outgoing = next.clone().sub(current)
      const lengthIn = incoming.length()
      const lengthOut = outgoing.length()
      if (lengthIn < 0.001 || lengthOut < 0.001) continue
      const cosine = incoming.normalize().dot(outgoing.normalize())
      if (cosine > 0.72) continue
      // 折角越尖锐，过渡点越靠近角平分线方向
      const sharpness = (1 - cosine) * 0.25
      const blend = current.clone().add(next).multiplyScalar(0.5)
      const offset = blend.sub(current).multiplyScalar(0.5)
      result.push(current.clone().add(offset.multiplyScalar(sharpness + 0.5)))
    }
    return result
  }

  /**
   * 按真实圆弧采样一个竖直回环。
   *
   * 回环位于 X-Y 平面内：圆心 (centerX, baseY + radius)，
   * 从底部出发逆时针绕行一周，经过右 → 顶 → 左回到底部。
   * 圆弧内外各补一个过渡点，让切线与相邻直轨段自然衔接。
   *
   * 同时记录解析曲率 1/R，供 G 值计算直接使用，
   * 避免数值微分在圆弧段引入误差。
   */
  applyLoopArc(arc, startIndex) {
    const { centerX, baseY, radius } = arc
    const z = this.points[startIndex].z
    const centerY = baseY + radius
    const samples = 24
    const arcPoints = []
    for (let step = 0; step <= samples; step += 1) {
      // 角度 -90° 位于底部，逆时针增加
      const angle = -Math.PI / 2 + (step / samples) * Math.PI * 2
      arcPoints.push(new THREE.Vector3(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        z,
      ))
    }
    const entryTangent = arcPoints[1].clone().sub(arcPoints[0]).normalize()
    const exitTangent = arcPoints[arcPoints.length - 1].clone().sub(arcPoints[arcPoints.length - 2]).normalize()
    const entry = arcPoints[0].clone().sub(entryTangent.multiplyScalar(radius * 0.3))
    const exit = arcPoints[arcPoints.length - 1].clone().add(exitTangent.multiplyScalar(radius * 0.3))

    // 记录解析曲率：圆弧内为 1/R，方向由圆心指向圆弧点
    this.analyticCurvature = this.analyticCurvature ?? []
    this.analyticCurvature.push({
      center: new THREE.Vector3(centerX, centerY, z),
      radius,
    })
    return [entry, ...arcPoints, exit]
  }

  /**
   * 用解析曲率覆盖圆弧段的数值微分结果。
   *
   * 回环是标准圆弧，曲率恒为 1/R，方向由圆心指向圆弧点。
   * 数值微分在圆弧段会因切线插值误差产生偏差，
   * 这里直接用解析值替换，保证 G 值准确。
   *
   * 覆盖范围限定在圆弧本体（与圆心距离接近 R），
   * 圆弧外的过渡点仍用数值微分，避免影响相邻直线段。
   */
  applyAnalyticCurvature(curvatureVectors, frames) {
    if (!this.analyticCurvature?.length) return
    for (const arc of this.analyticCurvature) {
      for (let index = 0; index < frames.length; index += 1) {
        const position = frames[index].position
        // 只处理落在圆弧平面附近、且在圆心半径附近的采样点
        const offset = position.clone().sub(arc.center)
        if (Math.abs(offset.z) > 1.5) continue
        const distance = offset.length()
        if (Math.abs(distance - arc.radius) > arc.radius * 0.25) continue
        const direction = offset.normalize()
        // 圆心指向圆弧点即为曲率方向
        curvatureVectors[index].copy(direction.divideScalar(arc.radius))
      }
    }
  }

  /**
   * 使用平行传输标架计算轨道方向，避免 Frenet 标架在大回环或螺旋处突然翻转。
   * 侧倾角随后绕轨道切线施加，因此枕木与双轨会严密贴合 banking 方向。
   */  buildFrames() {
    this.frameCount = THREE.MathUtils.clamp(Math.ceil(this.length * 2.1), 650, 1800)
    const rawFrames = []
    let transportedUp = new THREE.Vector3(0, 1, 0)

    for (let index = 0; index <= this.frameCount; index += 1) {
      const u = index / this.frameCount
      const position = this.curve.getPointAt(u % 1)
      const tangent = this.curve.getTangentAt(u % 1).normalize()

      if (index === 0) {
        transportedUp = Math.abs(tangent.y) > 0.92
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0)
      } else {
        const previousTangent = rawFrames[index - 1].tangent
        const rotation = new THREE.Quaternion().setFromUnitVectors(previousTangent, tangent)
        transportedUp.applyQuaternion(rotation).normalize()
      }

      transportedUp.addScaledVector(tangent, -transportedUp.dot(tangent)).normalize()
      const right = new THREE.Vector3().crossVectors(transportedUp, tangent).normalize()
      rawFrames.push({ position, tangent, up: transportedUp.clone(), right })
    }

    /**
     * 控制点 → 曲线 u 的稳健匹配：
     * 先为每个控制点收集所有足够近的采样点作为候选，再沿控制点顺序贪心分配，
     * 保证同坐标的重复点（竖直回环的底部出现两次）分别落在曲线
     * 第一次与第二次经过的位置，避免区间与侧倾角错配。
     */
    this.controlUs = this.resolveControlUs(rawFrames)
    this.ranges = this.resolveRanges()

    this.frames = rawFrames.map((frame, index) => {
      const u = index / this.frameCount
      const bank = this.bankAt(u)
      const rotation = new THREE.Quaternion().setFromAxisAngle(frame.tangent, bank)
      const up = frame.up.clone().applyQuaternion(rotation).normalize()
      const right = frame.right.clone().applyQuaternion(rotation).normalize()
      return { ...frame, up, right }
    })

    this.curvatureVectors = this.computeSmoothedCurvature(this.frames)
    this.applyAnalyticCurvature(this.curvatureVectors, this.frames)
  }

  /**
   * 预计算轨道曲率向量，用于计算乘客承受的 G 值。
   *
   * 直接对切线做中心差分时，控制点处的折角会被放大成曲率脉冲
   * （G 值飙到 30 G）；而用大窗口做平均又会把回环内部真实的高曲率抹平。
   *
   * 这里分两段处理：
   * 1. 回环圆弧段直接使用解析曲率 1/R，方向指向圆心，恒定且精确；
   * 2. 其余段用逐帧切线差分 + 3 点中值滤波，剔除孤立尖峰。
   */
  computeSmoothedCurvature(frames) {
    const count = this.frameCount
    const spacing = this.length / count
    const baseline = Math.max(1.2, spacing * 2.5)
    const steps = Math.max(1, Math.round(baseline / spacing))
    const raw = []
    for (let index = 0; index < count; index += 1) {
      const previous = frames[(index - steps + count) % count].tangent
      const next = frames[(index + steps) % count].tangent
      raw.push(next.clone().sub(previous).divideScalar(2 * steps * spacing))
    }

    const half = 1
    const smoothed = []
    for (let index = 0; index < count; index += 1) {
      const xs = []
      const ys = []
      const zs = []
      for (let offset = -half; offset <= half; offset += 1) {
        const vector = raw[(index + offset + count) % count]
        xs.push(vector.x)
        ys.push(vector.y)
        zs.push(vector.z)
      }
      xs.sort((a, b) => a - b)
      ys.sort((a, b) => a - b)
      zs.sort((a, b) => a - b)
      smoothed.push(new THREE.Vector3(xs[half], ys[half], zs[half]))
    }

    // 回环段改用解析曲率
    for (const arc of this.preset.loopArcs ?? []) {
      const startU = this.controlUs[arc.start]
      const endU = this.controlUs[arc.end]
      const center = new THREE.Vector3(arc.centerX, arc.baseY + arc.radius, this.points[arc.start].z)
      const curvatureMagnitude = 1 / arc.radius
      const startIndex = Math.floor(startU * count)
      const endIndex = Math.floor(endU * count)
      for (let index = startIndex; index <= endIndex; index += 1) {
        const position = frames[index % count].position
        const direction = center.clone().sub(position).normalize()
        smoothed[index % count] = direction.multiplyScalar(curvatureMagnitude)
      }
    }
    return smoothed
  }
  /**
   * 采样平滑后的曲率向量。
   */
  sampleCurvature(u) {
    const normalized = ((u % 1) + 1) % 1
    const exact = normalized * this.frameCount
    const index = Math.floor(exact)
    const amount = exact - index
    const first = this.curvatureVectors[index % this.frameCount]
    const second = this.curvatureVectors[(index + 1) % this.frameCount]
    return first.clone().lerp(second, amount)
  }

  /**
   * 沿控制点顺序贪心匹配曲线弧长参数 u。
   * 竖直回环的底部控制点坐标重复，若用「全局最近点」匹配，
   * 两点会落在同一个 u 上，导致回环区间塌缩、侧倾角插值错乱。
   */
  resolveControlUs(rawFrames) {
    const samples = rawFrames.map((frame) => frame.position)
    const candidates = this.points.map((point) => {
      const distances = samples.map((sample) => sample.distanceToSquared(point))
      const minDistance = Math.min(...distances)
      const threshold = Math.max(minDistance * 4, 0.5)
      const list = []
      for (let index = 0; index < samples.length; index += 1) {
        if (distances[index] <= threshold) list.push(index)
      }
      return list
    })

    const us = []
    let cursor = 0
    this.points.forEach((_, index) => {
      const list = candidates[index]
      let chosen = list.find((sampleIndex) => sampleIndex >= cursor)
      if (chosen === undefined) {
        chosen = list[0] ?? 0
        let bestDistance = Infinity
        for (const sampleIndex of list) {
          const distance = Math.abs(sampleIndex - cursor)
          if (distance < bestDistance) {
            bestDistance = distance
            chosen = sampleIndex
          }
        }
      }
      us.push(chosen / samples.length)
      cursor = chosen + 1
    })
    return us
  }

  /**
   * 由控制点索引推导归一化弧长区间：链条提升段、刹车段、各回环段。
   */
  resolveRanges() {
    const chainEnd = this.preset.chainEndIndex ?? 5
    const brakeStart = this.preset.brakeStartIndex ?? this.points.length - 3
    const loopRanges = (this.preset.loopIndexRanges ?? []).map(([start, end]) => [
      this.controlUs[start] ?? 0,
      this.controlUs[end] ?? 0,
    ])
    return {
      chain: [0.006, Math.min((this.controlUs[chainEnd] ?? 0.18) + 0.004, 0.3)],
      brake: [Math.max(0.7, (this.controlUs[brakeStart] ?? 0.94) - 0.02), 0.985],
      loops: loopRanges,
    }
  }

  bankAt(u) {
    const entries = this.controlUs.map((controlU, index) => ({ controlU, bank: this.banks[index] ?? 0 }))
    entries.sort((a, b) => a.controlU - b.controlU)
    if (u <= entries[0].controlU) {
      const previous = entries[entries.length - 1]
      const next = entries[0]
      const span = (next.controlU + 1 - previous.controlU) || 1
      const amount = (u + 1 - previous.controlU) / span
      return THREE.MathUtils.lerp(previous.bank, next.bank, amount)
    }
    for (let index = 0; index < entries.length; index += 1) {
      const previous = entries[index]
      const next = entries[(index + 1) % entries.length]
      const end = index === entries.length - 1 ? next.controlU + 1 : next.controlU
      if (u >= previous.controlU && u <= end) {
        const amount = (u - previous.controlU) / ((end - previous.controlU) || 1)
        return THREE.MathUtils.lerp(previous.bank, next.bank, amount)
      }
    }
    return 0
  }

  sampleFrame(u) {
    const normalized = ((u % 1) + 1) % 1
    const exact = normalized * this.frameCount
    const index = Math.floor(exact)
    const amount = exact - index
    const first = this.frames[index % this.frameCount]
    const second = this.frames[(index + 1) % this.frameCount]
    const position = first.position.clone().lerp(second.position, amount)
    const tangent = first.tangent.clone().lerp(second.tangent, amount).normalize()
    const up = first.up.clone().lerp(second.up, amount).normalize()
    const right = first.right.clone().lerp(second.right, amount).normalize()
    return { position, tangent, up, right }
  }

  buildControlMeshes() {
    for (const mesh of this.controlMeshes) {
      this.controlGroup.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    this.controlMeshes = []

    this.points.forEach((point, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xff7b45 : 0x72e6d1,
        emissive: index % 2 === 0 ? 0x7d1f08 : 0x0b5e55,
        emissiveIntensity: 0.8,
        roughness: 0.24,
        metalness: 0.12,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), material)
      mesh.position.copy(point)
      mesh.name = `轨道控制点 ${index + 1}`
      mesh.userData.controlIndex = index
      this.controlGroup.add(mesh)
      this.controlMeshes.push(mesh)
    })
    this.selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.08, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff4cf, transparent: true, opacity: 0.95 }),
    )
    this.selectionRing.rotation.x = Math.PI / 2
    this.controlGroup.add(this.selectionRing)
    this.updateSelectionRing()
  }

  updateSelectionRing() {
    const selected = this.controlMeshes[this.selectedIndex]
    if (selected) this.selectionRing.position.copy(selected.position)
  }

  setSelected(index) {
    this.selectedIndex = THREE.MathUtils.clamp(index, 0, this.controlMeshes.length - 1)
    this.controlMeshes.forEach((mesh, meshIndex) => {
      mesh.scale.setScalar(meshIndex === this.selectedIndex ? 1.28 : 1)
      mesh.material.emissiveIntensity = meshIndex === this.selectedIndex ? 1.8 : 0.65
    })
    this.updateSelectionRing()
  }

  setEditMode(enabled) {
    this.controlGroup.visible = enabled
  }

  setControlPosition(index, position) {
    this.points[index].copy(position)
    this.controlMeshes[index].position.copy(position)
    this.updateSelectionRing()
    this.scheduleRebuild()
  }

  setControlBank(index, bank) {
    this.banks[index] = THREE.MathUtils.clamp(bank, -Math.PI * 0.42, Math.PI * 0.42)
    this.scheduleRebuild()
  }

  setPreset(preset) {
    this.preset = clonePreset(preset)
    this.points = this.preset.points.map((item) => new THREE.Vector3(item.x, item.y, item.z))
    this.banks = [...this.preset.banks]
    this.selectedIndex = 0
    this.buildCurve()
    this.buildFrames()
    this.buildControlMeshes()
    this.rebuildGeometry()
  }

  scheduleRebuild() {
    this.rebuildPending = true
  }

  flushRebuild() {
    if (!this.rebuildPending) return
    this.rebuildPending = false
    this.buildCurve()
    this.buildFrames()
    this.rebuildGeometry()
    this.onRebuild?.()
  }

  rebuildGeometry() {
    disposeObject(this.group)
    this.group.clear()
    this.createRails()
    this.createSleepers()
    this.createSupports()
    this.createStation()
  }

  createRails() {
    const railOffset = 0.72
    const railSamples = 460
    const leftPoints = []
    const rightPoints = []
    const centerPoints = []
    const neonPoints = []

    for (let index = 0; index < railSamples; index += 1) {
      const frame = this.sampleFrame(index / railSamples)
      const left = frame.position.clone().addScaledVector(frame.right, -railOffset)
      const right = frame.position.clone().addScaledVector(frame.right, railOffset)
      const bottom = frame.position.clone().addScaledVector(frame.up, -0.98)
      leftPoints.push(left)
      rightPoints.push(right)
      centerPoints.push(bottom)
      neonPoints.push(left, right)
    }

    const leftCurve = new THREE.CatmullRomCurve3(leftPoints, true, 'catmullrom', 0.5)
    const rightCurve = new THREE.CatmullRomCurve3(rightPoints, true, 'catmullrom', 0.5)
    const centerCurve = new THREE.CatmullRomCurve3(centerPoints, true, 'catmullrom', 0.5)
    const segments = THREE.MathUtils.clamp(Math.floor(this.length * 1.65), 560, 1500)

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0x4b1004,
      emissiveIntensity: 0.18,
      metalness: 0.68,
      roughness: 0.24,
    })
    const secondRailMaterial = new THREE.MeshStandardMaterial({
      color: 0x29b9ad,
      emissive: 0x062f2b,
      emissiveIntensity: 0.18,
      metalness: 0.68,
      roughness: 0.24,
    })
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x34434b,
      emissive: 0x071014,
      emissiveIntensity: 0.1,
      metalness: 0.88,
      roughness: 0.32,
    })

    const leftRail = new THREE.Mesh(new THREE.TubeGeometry(leftCurve, segments, 0.16, 8, true), railMaterial)
    const rightRail = new THREE.Mesh(new THREE.TubeGeometry(rightCurve, segments, 0.16, 8, true), secondRailMaterial)
    const mainBeam = new THREE.Mesh(new THREE.TubeGeometry(centerCurve, segments, 0.31, 8, true), beamMaterial)
    leftRail.castShadow = true
    rightRail.castShadow = true
    mainBeam.castShadow = true
    this.group.add(leftRail, rightRail, mainBeam)

    this.neonMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ffff0,
      emissive: 0x36ffe0,
      emissiveIntensity: 0,
      metalness: 0.1,
      roughness: 0.25,
    })
    const neonLeftPoints = leftPoints.map((item) => item.clone().addScaledVector(UP, 0.12))
    const neonRightPoints = rightPoints.map((item) => item.clone().addScaledVector(UP, 0.12))
    const neonLeftCurve = new THREE.CatmullRomCurve3(neonLeftPoints, true, 'catmullrom', 0.5)
    const neonRightCurve = new THREE.CatmullRomCurve3(neonRightPoints, true, 'catmullrom', 0.5)
    this.neonBands = [
      new THREE.Mesh(new THREE.TubeGeometry(neonLeftCurve, segments, 0.055, 6, true), this.neonMaterial),
      new THREE.Mesh(new THREE.TubeGeometry(neonRightCurve, segments, 0.055, 6, true), this.neonMaterial),
    ]
    this.group.add(...this.neonBands)
  }

  createSleepers() {
    const spacing = 1.45
    const count = Math.max(80, Math.floor(this.length / spacing))
    const geometry = new THREE.BoxGeometry(3.15, 0.16, 0.24)
    const material = new THREE.MeshStandardMaterial({ color: 0x9ca8aa, metalness: 0.82, roughness: 0.36 })
    const sleepers = new THREE.InstancedMesh(geometry, material, count)
    sleepers.castShadow = true
    sleepers.receiveShadow = true
    sleepers.name = '实例化金属枕木'

    for (let index = 0; index < count; index += 1) {
      const frame = this.sampleFrame(index / count)
      const position = frame.position.clone().addScaledVector(frame.up, -0.5)
      const quaternion = basisQuaternion(frame.right, frame.up, frame.tangent)
      TEMP_MATRIX.compose(position, quaternion, TEMP_SCALE.set(1, 1, 1))
      sleepers.setMatrixAt(index, TEMP_MATRIX)
    }
    sleepers.instanceMatrix.needsUpdate = true
    this.group.add(sleepers)
  }

  createSupports() {
    const supportSpacing = 7.2
    const supportCount = Math.max(24, Math.floor(this.length / supportSpacing))
    const columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
    const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5d63, metalness: 0.76, roughness: 0.42 })
    const columns = new THREE.InstancedMesh(columnGeometry, columnMaterial, supportCount)
    columns.castShadow = true
    columns.receiveShadow = true
    columns.name = '实例化钢结构立柱'

    const braceGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
    const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x7b5a3a, metalness: 0.68, roughness: 0.46 })
    const braces = new THREE.InstancedMesh(braceGeometry, braceMaterial, supportCount * 2)
    braces.castShadow = true
    braces.name = '大回环 A 字加固架'

    let columnIndex = 0
    let braceIndex = 0
    for (let index = 0; index < supportCount; index += 1) {
      const u = index / supportCount
      const frame = this.sampleFrame(u)
      const top = frame.position.clone().addScaledVector(frame.up, -1.28)
      const groundY = isInsideLake(top.x, top.z) ? -3.7 : terrainHeight(top.x, top.z)
      const height = top.y - groundY
      if (height > 0.7) {
        const quaternion = new THREE.Quaternion()
        TEMP_MATRIX.compose(
          new THREE.Vector3(top.x, groundY + height * 0.5, top.z),
          quaternion,
          new THREE.Vector3(0.2, height, 0.2),
        )
        columns.setMatrixAt(columnIndex, TEMP_MATRIX)
        columnIndex += 1
      }

      const inLoop = this.ranges.loops.some(([start, end]) => u >= start && u <= end)
      if (inLoop && height > 2.2) {
        const leftBase = new THREE.Vector3(top.x, groundY, top.z).addScaledVector(frame.right, -2.7)
        const rightBase = new THREE.Vector3(top.x, groundY, top.z).addScaledVector(frame.right, 2.7)
        const leftBrace = cylinderBetween(leftBase, top, 0.15)
        const rightBrace = cylinderBetween(rightBase, top, 0.15)
        if (leftBrace) {
          TEMP_MATRIX.compose(leftBrace.position, leftBrace.quaternion, leftBrace.scale)
          braces.setMatrixAt(braceIndex, TEMP_MATRIX)
          braceIndex += 1
        }
        if (rightBrace) {
          TEMP_MATRIX.compose(rightBrace.position, rightBrace.quaternion, rightBrace.scale)
          braces.setMatrixAt(braceIndex, TEMP_MATRIX)
          braceIndex += 1
        }
      }
    }
    columns.count = columnIndex
    braces.count = braceIndex
    columns.instanceMatrix.needsUpdate = true
    braces.instanceMatrix.needsUpdate = true
    this.group.add(columns, braces)
  }

  createStation() {
    const frame = this.sampleFrame(0.008)
    const station = new THREE.Group()
    station.name = '带遮阳棚的上下客站台'
    const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.82, metalness: 0.05 })
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7f78, roughness: 0.58, metalness: 0.18 })
    const steelMaterial = new THREE.MeshStandardMaterial({ color: 0x43555a, metalness: 0.72, roughness: 0.38 })

    const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.55, 15), deckMaterial)
    deck.position.set(frame.position.x, frame.position.y - 1.45, frame.position.z)
    deck.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z)
    deck.receiveShadow = true
    deck.castShadow = true
    station.add(deck)

    const roof = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.42, 12.5), roofMaterial)
    roof.position.set(frame.position.x, frame.position.y + 4.2, frame.position.z)
    roof.rotation.y = deck.rotation.y
    roof.castShadow = true
    station.add(roof)

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(13, 0.18, 1.1), new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.6 }))
    stripe.position.set(frame.position.x, frame.position.y + 4.5, frame.position.z)
    stripe.rotation.y = deck.rotation.y
    station.add(stripe)

    for (const x of [-5.2, 5.2]) {
      for (const z of [-5.6, 5.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.3, 8), steelMaterial)
        post.position.set(frame.position.x + x, frame.position.y + 1.1, frame.position.z + z)
        post.castShadow = true
        station.add(post)
      }
    }

    const queueMaterial = new THREE.MeshStandardMaterial({ color: 0xffb23f, metalness: 0.55, roughness: 0.4 })
    const railOffset = new THREE.Vector3().crossVectors(UP, frame.tangent).normalize()
    for (let lane = 0; lane < 3; lane += 1) {
      const offset = 6.2 + lane * 0.9
      for (let postIndex = 0; postIndex < 5; postIndex += 1) {
        const along = -5 + postIndex * 2.5
        const postPosition = frame.position.clone()
          .addScaledVector(railOffset, offset)
          .addScaledVector(frame.tangent, along)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.25, 7), queueMaterial)
        post.position.set(postPosition.x, frame.position.y - 0.35, postPosition.z)
        station.add(post)
        if (postIndex < 4) {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.55, 7), queueMaterial)
          rail.position.copy(post.position).addScaledVector(frame.tangent, 1.25)
          rail.quaternion.setFromUnitVectors(UP, frame.tangent)
          station.add(rail)
        }
      }
    }
    this.group.add(station)
  }

  setNightMode(isNight) {
    if (!this.neonMaterial) return
    this.neonMaterial.emissiveIntensity = isNight ? 3.2 : 0
  }
}
