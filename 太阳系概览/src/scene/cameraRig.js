import * as THREE from 'three'

const MIN_PHI = 0.06
const MAX_PHI = Math.PI - 0.06

function normalizeAngle(a) {
  let v = a
  while (v > Math.PI) v -= Math.PI * 2
  while (v < -Math.PI) v += Math.PI * 2
  return v
}

function damp(current, goal, lambda, dt) {
  return current + (goal - current) * (1 - Math.exp(-lambda * dt))
}

// 自写的轨道相机：平滑跟随目标、可被指针/滚轮随时接管
export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera
    this.dom = domElement
    this.current = { theta: 0.92, phi: 1.02, radius: 34 }
    this.goal = { theta: 0.92, phi: 1.02, radius: 34 }
    this.target = new THREE.Vector3(0, 0, 0)
    this.goalTarget = new THREE.Vector3(0, 0, 0)
    this.followId = null
    this.minRadius = 0.5
    this.maxRadius = 180
    this.dragging = false
    this.enabled = true
    this.damp = 4.2
    this.pointers = new Map()
    this.lastPinch = 0
    this.moved = 0
    this.onInteract = null

    this._bind()
  }

  _bind() {
    const el = this.dom
    this._onPointerDown = (e) => {
      if (!this.enabled) return
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 1) {
        this.dragging = true
        this.moved = 0
        el.setPointerCapture?.(e.pointerId)
      } else if (this.pointers.size === 2) {
        this.lastPinch = this._pinchDistance()
      }
    }

    this._onPointerMove = (e) => {
      if (!this.pointers.has(e.pointerId)) return
      const prev = this.pointers.get(e.pointerId)
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (this.pointers.size >= 2) {
        const d = this._pinchDistance()
        if (this.lastPinch > 0) {
          const scale = this.lastPinch / Math.max(1, d)
          this._zoom(scale)
        }
        this.lastPinch = d
        return
      }
      if (!this.dragging) return
      this.moved += Math.abs(dx) + Math.abs(dy)
      // 直接接管，不做缓动，手感更跟手
      this.current.theta = this.goal.theta = this.current.theta - dx * 0.0052
      this.current.phi = this.goal.phi = THREE.MathUtils.clamp(this.current.phi - dy * 0.0048, MIN_PHI, MAX_PHI)
      this.onInteract?.()
    }

    this._onPointerUp = (e) => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.lastPinch = 0
      if (this.pointers.size === 0) this.dragging = false
    }

    this._onWheel = (e) => {
      if (!this.enabled) return
      e.preventDefault()
      this._zoom(Math.exp(e.deltaY * 0.0011))
      this.onInteract?.()
    }

    el.addEventListener('pointerdown', this._onPointerDown)
    el.addEventListener('pointermove', this._onPointerMove)
    el.addEventListener('pointerup', this._onPointerUp)
    el.addEventListener('pointercancel', this._onPointerUp)
    el.addEventListener('pointerleave', this._onPointerUp)
    el.addEventListener('wheel', this._onWheel, { passive: false })
  }

  _pinchDistance() {
    const values = [...this.pointers.values()]
    if (values.length < 2) return 0
    const dx = values[0].x - values[1].x
    const dy = values[0].y - values[1].y
    return Math.hypot(dx, dy)
  }

  _zoom(scale) {
    const next = THREE.MathUtils.clamp(this.goal.radius * scale, this.minRadius, this.maxRadius)
    this.current.radius = this.goal.radius = next
  }

  follow(id) {
    this.followId = id
  }

  // 立即查看某个位置（总览）
  overview(position = new THREE.Vector3(), radius = 40, theta = 0.92, phi = 1.0) {
    this.followId = null
    this.goalTarget.copy(position)
    this.goal.radius = radius
    this.goal.theta = theta
    this.goal.phi = phi
  }

  setView(theta, phi, radius) {
    this.goal.theta = theta
    this.goal.phi = THREE.MathUtils.clamp(phi, MIN_PHI, MAX_PHI)
    if (radius !== undefined) {
      this.goal.radius = THREE.MathUtils.clamp(radius, this.minRadius, this.maxRadius)
    }
  }

  update(dt, followPosition) {
    if (this.followId && followPosition) {
      this.goalTarget.copy(followPosition)
      // 远处平滑飞向目标，接近后收紧阻尼以消除公转造成的滞后
      const distance = this.target.distanceTo(followPosition)
      const lambda = distance > 4 ? 2.2 : 14
      this.target.lerp(followPosition, 1 - Math.exp(-lambda * dt))
    } else {
      this.target.lerp(this.goalTarget, 1 - Math.exp(-this.damp * 0.55 * dt))
    }

    const diffTheta = normalizeAngle(this.goal.theta - this.current.theta)
    this.current.theta += diffTheta * (1 - Math.exp(-this.damp * dt))
    this.current.phi = damp(this.current.phi, this.goal.phi, this.damp, dt)
    this.current.radius = damp(this.current.radius, this.goal.radius, this.damp * 0.8, dt)

    const { theta, phi, radius } = this.current
    const sinPhi = Math.sin(phi)
    this.camera.position.set(
      this.target.x + radius * sinPhi * Math.sin(theta),
      this.target.y + radius * Math.cos(phi),
      this.target.z + radius * sinPhi * Math.cos(theta),
    )
    this.camera.lookAt(this.target)
  }

  dispose() {
    const el = this.dom
    el.removeEventListener('pointerdown', this._onPointerDown)
    el.removeEventListener('pointermove', this._onPointerMove)
    el.removeEventListener('pointerup', this._onPointerUp)
    el.removeEventListener('pointercancel', this._onPointerUp)
    el.removeEventListener('pointerleave', this._onPointerUp)
    el.removeEventListener('wheel', this._onWheel)
  }
}
