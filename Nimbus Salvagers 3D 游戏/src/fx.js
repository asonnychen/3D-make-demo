import * as THREE from 'three'

const MAX_PARTICLES = 900
const MAX_TRACERS = 22
const MAX_RINGS = 14

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class FX {
  constructor(scene) {
    this.scene = scene

    /* ---------------- 粒子 ---------------- */
    this.particles = []
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.sizes = new Float32Array(MAX_PARTICLES)
    this.alphas = new Float32Array(MAX_PARTICLES)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))
    geo.setDrawRange(0, 0)
    this.geo = geo

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (330.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.06, r);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }
      `,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    scene.add(this.points)

    /* ---------------- 曳光弹 ---------------- */
    const tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1)
    this.tracers = []
    for (let i = 0; i < MAX_TRACERS; i++) {
      const m = new THREE.Mesh(
        tracerGeo,
        new THREE.MeshBasicMaterial({
          color: 0x9dfff1,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
      m.visible = false
      m.frustumCulled = false
      scene.add(m)
      this.tracers.push({ mesh: m, life: 0, maxLife: 0.08 })
    }
    this.tracerIndex = 0

    /* ---------------- 冲击环 ---------------- */
    this.rings = []
    for (let i = 0; i < MAX_RINGS; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 56),
        new THREE.MeshBasicMaterial({
          color: 0x9dfff1,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
      m.rotation.x = -Math.PI / 2
      m.visible = false
      m.frustumCulled = false
      scene.add(m)
      this.rings.push({ mesh: m, life: 0, maxLife: 1, maxR: 4 })
    }
    this.ringIndex = 0

    /* ---------------- 枪口闪光 ---------------- */
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xd6fff8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    this.flash.scale.setScalar(1.8)
    scene.add(this.flash)
    this.flashT = 0

    this.muzzleLight = new THREE.PointLight(0x9dfff1, 0, 18, 2)
    scene.add(this.muzzleLight)

    this.time = 0
  }

  /* ------------------------------------------------------------ 粒子生成 */

  addParticle(x, y, z, vx, vy, vz, color, size, life, gravity = 0, drag = 1.5) {
    if (this.particles.length >= MAX_PARTICLES) {
      // 复用最旧的粒子
      this.particles.shift()
    }
    this.particles.push({
      x,
      y,
      z,
      vx,
      vy,
      vz,
      color: new THREE.Color(color),
      size,
      life,
      maxLife: life,
      gravity,
      drag,
    })
  }

  sparks(pos, color = 0x9dfff1, count = 8, speed = 5, life = 0.5) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.2,
        Math.random() - 0.5
      ).normalize()
      const s = speed * (0.4 + Math.random() * 0.9)
      this.addParticle(
        pos.x,
        pos.y,
        pos.z,
        dir.x * s,
        dir.y * s + 1,
        dir.z * s,
        color,
        0.06 + Math.random() * 0.08,
        life * (0.6 + Math.random() * 0.7),
        9,
        1.6
      )
    }
  }

  burst(pos, color = 0x9dfff1, count = 24, speed = 6, life = 0.7, size = 0.16) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()
      const s = speed * (0.25 + Math.random())
      this.addParticle(
        pos.x,
        pos.y,
        pos.z,
        dir.x * s,
        dir.y * s,
        dir.z * s,
        color,
        size * (0.5 + Math.random()),
        life * (0.5 + Math.random()),
        2.5,
        1.2
      )
    }
  }

  explosion(pos, color = 0x5ff3e0, scale = 1) {
    this.burst(pos, color, Math.round(30 * scale), 8 * scale, 0.8, 0.2 * scale)
    this.burst(pos, 0xffd9a8, Math.round(12 * scale), 5 * scale, 0.5, 0.12 * scale)
    this.ring(pos, color, 5 * scale, 0.6)
    this.flashAt(pos, color, 6 * scale)
  }

  /* ------------------------------------------------------------ 特效元素 */

  tracer(from, to, color = 0x9dfff1) {
    const t = this.tracers[this.tracerIndex]
    this.tracerIndex = (this.tracerIndex + 1) % MAX_TRACERS
    const len = from.distanceTo(to)
    if (len < 0.01) return
    const mesh = t.mesh
    mesh.visible = true
    mesh.position.copy(from).lerp(to, 0.5)
    mesh.lookAt(to)
    mesh.scale.set(1, 1, len)
    mesh.material.color.setHex(color)
    mesh.material.opacity = 0.9
    t.life = 0.07
    t.maxLife = 0.07
  }

  ring(pos, color = 0x9dfff1, maxR = 4, life = 0.5) {
    const r = this.rings[this.ringIndex]
    this.ringIndex = (this.ringIndex + 1) % MAX_RINGS
    r.mesh.visible = true
    r.mesh.position.copy(pos)
    r.mesh.position.y += 0.06
    r.mesh.material.color.setHex(color)
    r.mesh.material.opacity = 0.85
    r.mesh.scale.setScalar(0.2)
    r.life = life
    r.maxLife = life
    r.maxR = maxR
  }

  flashAt(pos, color = 0xd6fff8, size = 3) {
    this.flash.position.copy(pos)
    this.flash.material.color.setHex(color)
    this.flash.material.opacity = 1
    this.flash.scale.setScalar(size)
    this.flashT = 0.07
    this.muzzleLight.position.copy(pos)
    this.muzzleLight.color.setHex(color)
    this.muzzleLight.intensity = 9
  }

  muzzle(pos, scale = 1.5) {
    this.flashAt(pos, 0xd6fff8, scale)
  }

  /* ------------------------------------------------------------ 更新 */

  update(dt, time) {
    this.time = time

    // 粒子
    const parts = this.particles
    let n = 0
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      p.life -= dt
      if (p.life <= 0) continue
      const d = Math.exp(-p.drag * dt)
      p.vx *= d
      p.vz *= d
      p.vy = p.vy * d - p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt

      const idx = n
      this.positions[idx * 3] = p.x
      this.positions[idx * 3 + 1] = p.y
      this.positions[idx * 3 + 2] = p.z
      this.colors[idx * 3] = p.color.r
      this.colors[idx * 3 + 1] = p.color.g
      this.colors[idx * 3 + 2] = p.color.b
      this.sizes[idx] = p.size
      const k = Math.max(0, p.life / p.maxLife)
      this.alphas[idx] = k * k
      n++
    }
    // 压缩数组
    if (n < parts.length) {
      let write = 0
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].life > 0) parts[write++] = parts[i]
      }
      parts.length = write
    }
    this.geo.setDrawRange(0, n)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.attributes.size.needsUpdate = true
    this.geo.attributes.alpha.needsUpdate = true

    // 曳光
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue
      t.life -= dt
      t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.9
      if (t.life <= 0) t.mesh.visible = false
    }

    // 冲击环
    for (const r of this.rings) {
      if (!r.mesh.visible) continue
      r.life -= dt
      const k = 1 - Math.max(0, r.life / r.maxLife)
      r.mesh.scale.setScalar(0.2 + k * r.maxR)
      r.mesh.material.opacity = (1 - k) * 0.85
      if (r.life <= 0) r.mesh.visible = false
    }

    // 闪光
    if (this.flashT > 0) {
      this.flashT -= dt
      this.flash.material.opacity = Math.max(0, this.flashT / 0.07)
      this.muzzleLight.intensity = Math.max(0, this.flashT / 0.07) * 9
    } else if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = 0
    }
  }

  clear() {
    this.particles.length = 0
    this.geo.setDrawRange(0, 0)
    for (const t of this.tracers) {
      t.mesh.visible = false
      t.life = 0
    }
    for (const r of this.rings) {
      r.mesh.visible = false
      r.life = 0
    }
    this.flash.material.opacity = 0
    this.muzzleLight.intensity = 0
  }
}
