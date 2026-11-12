import * as THREE from 'three'
import { PLATFORMS, ARENA, TURBINE, STATIC_TOKENS } from './config.js'

/* ============================================================
   工具
   ============================================================ */

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeGlowTexture(size = 128, hardness = 0.28) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(hardness, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.65, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeCloudTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const rng = mulberry32(90210)
  for (let i = 0; i < 9; i++) {
    const x = size * (0.5 + (rng() - 0.5) * 0.55)
    const y = size * (0.5 + (rng() - 0.5) * 0.4)
    const r = size * (0.14 + rng() * 0.22)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.22)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeTextTexture(lines, opts = {}) {
  const w = opts.width || 512
  const h = opts.height || 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = opts.color || '#8bf7e4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.font = `${line.weight || 500} ${line.size || 42}px ${opts.font || 'Bahnschrift, Segoe UI, sans-serif'}`
    ctx.globalAlpha = line.alpha ?? 1
    ctx.fillText(line.text, w / 2, (h / (lines.length + 1)) * (i + 1))
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ============================================================
   材质
   ============================================================ */

const M = {
  rock: new THREE.MeshStandardMaterial({ color: 0x3a4a4e, roughness: 0.96, metalness: 0.04, flatShading: true }),
  rockLight: new THREE.MeshStandardMaterial({ color: 0x54666a, roughness: 0.92, metalness: 0.05, flatShading: true }),
  moss: new THREE.MeshStandardMaterial({ color: 0x6d8a72, roughness: 1, metalness: 0 }),
  mossDark: new THREE.MeshStandardMaterial({ color: 0x425a4f, roughness: 1, metalness: 0 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x76817c, roughness: 0.9, metalness: 0.05, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x5d7076, roughness: 0.62, metalness: 0.45 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x2b3a3f, roughness: 0.68, metalness: 0.5 }),
  hull: new THREE.MeshStandardMaterial({ color: 0x22343a, roughness: 0.6, metalness: 0.55 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.9, metalness: 0.05 }),
  cloth: new THREE.MeshStandardMaterial({
    color: 0x93aaa3,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0x164a45,
    emissiveIntensity: 0.55,
  }),
  clothWarm: new THREE.MeshStandardMaterial({
    color: 0xb99a78,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0x3a2414,
    emissiveIntensity: 0.4,
  }),
  deck: new THREE.MeshStandardMaterial({ color: 0x3a4d53, roughness: 0.72, metalness: 0.45 }),
  glowTeal: new THREE.MeshBasicMaterial({ color: 0x7ffff0, toneMapped: false }),
  glowTealDim: new THREE.MeshBasicMaterial({ color: 0x35d6c0, toneMapped: false, transparent: true, opacity: 0.5 }),
  glowAmber: new THREE.MeshBasicMaterial({ color: 0xffc58c, toneMapped: false }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x0d2b30,
    roughness: 0.15,
    metalness: 0.9,
    emissive: 0x1a8f84,
    emissiveIntensity: 0.55,
  }),
}

const glowTex = makeGlowTexture(128, 0.24)
const cloudTex = makeCloudTexture()

/* ============================================================
   地面查询
   ============================================================ */

export function sampleGround(x, z, maxY = Infinity) {
  let best = -Infinity
  for (const p of PLATFORMS) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d <= p.r && p.y <= maxY) best = Math.max(best, p.y)
  }
  return best
}

/* ============================================================
   天空 / 云海
   ============================================================ */

const SUN_DIR = new THREE.Vector3(0.46, 0.24, -0.86).normalize()

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(1400, 32, 20)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x0a3446) },
      uMid: { value: new THREE.Color(0x3f8493) },
      uBottom: { value: new THREE.Color(0xd9a97f) },
      uSun: { value: new THREE.Color(0xffdcae) },
      uSunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uBottom, uMid, smoothstep(-0.06, 0.2, h));
        col = mix(col, uTop, smoothstep(0.16, 0.8, h));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSun * pow(sd, 1600.0) * 2.0;
        col += uSun * pow(sd, 12.0) * 0.06;
        float haze = smoothstep(0.35, -0.02, h) * 0.07;
        col += vec3(0.9, 0.78, 0.66) * haze;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const sky = new THREE.Mesh(geo, mat)
  sky.renderOrder = -10
  scene.add(sky)
  return sky
}

function buildCloudSea(scene, updatables) {
  const geo = new THREE.PlaneGeometry(2800, 2800, 1, 1)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x5f878c) },
      uLit: { value: new THREE.Color(0xe9f2ec) },
      uWarm: { value: new THREE.Color(0xf0c49c) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uLit;
      uniform vec3 uWarm;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.03 + 7.1;
          a *= 0.5;
        }
        return v;
      }
      void main() {
        vec2 p = vUv * 30.0;
        float t = uTime * 0.02;
        float w = fbm(p * 0.35 + vec2(t, -t * 0.7));
        float f = fbm(p * 0.9 + vec2(w * 1.7, w * 1.2) + vec2(t * 1.6, t * 0.35));
        f = smoothstep(0.16, 0.94, f);
        vec3 col = mix(uDeep, uLit, f);
        col = mix(col, uWarm, smoothstep(0.55, 1.0, f) * 0.34);
        float edge = smoothstep(0.5, 0.13, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(col, (0.55 + 0.45 * f) * edge);
      }
    `,
  })
  const sea = new THREE.Mesh(geo, mat)
  sea.position.y = -36
  sea.renderOrder = -5
  scene.add(sea)
  updatables.push((t) => {
    mat.uniforms.uTime.value = t
  })

  // 云团：多层柔和面片，制造漂浮的体量
  const rng = mulberry32(4477)
  const puffGroup = new THREE.Group()
  scene.add(puffGroup)
  const puffs = []
  for (let i = 0; i < 84; i++) {
    const angle = rng() * Math.PI * 2
    const radius = 30 + Math.pow(rng(), 0.6) * 420
    const mat2 = new THREE.SpriteMaterial({
      map: cloudTex,
      color: i % 7 === 0 ? 0xffe2c4 : 0xe8f2ee,
      transparent: true,
      opacity: 0.3 + rng() * 0.4,
      depthWrite: false,
      fog: true,
    })
    const s = new THREE.Sprite(mat2)
    s.position.set(Math.cos(angle) * radius, -48 + rng() * 34, Math.sin(angle) * radius - 20)
    const sc = 26 + rng() * 74
    s.scale.set(sc * (1.2 + rng() * 0.8), sc * 0.55, 1)
    s.userData.speed = 0.4 + rng() * 1.2
    puffGroup.add(s)
    puffs.push(s)
  }
  updatables.push((t, dt) => {
    for (const s of puffs) {
      s.position.x += s.userData.speed * dt
      if (s.position.x > 480) s.position.x = -480
    }
  })

  // 高空薄云
  for (let i = 0; i < 16; i++) {
    const mat2 = new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0xf3e6d2,
      transparent: true,
      opacity: 0.1 + rng() * 0.12,
      depthWrite: false,
    })
    const s = new THREE.Sprite(mat2)
    const angle = rng() * Math.PI * 2
    const radius = 140 + rng() * 360
    s.position.set(Math.cos(angle) * radius, 60 + rng() * 90, Math.sin(angle) * radius)
    const sc = 90 + rng() * 150
    s.scale.set(sc, sc * 0.35, 1)
    puffGroup.add(s)
  }

  // 远处的云海堤岸：让地平线有层次
  for (let i = 0; i < 26; i++) {
    const mat2 = new THREE.SpriteMaterial({
      map: cloudTex,
      color: i % 6 === 0 ? 0xffe3c6 : 0xeaf3ee,
      transparent: true,
      opacity: 0.4 + rng() * 0.3,
      depthWrite: false,
    })
    const s = new THREE.Sprite(mat2)
    const angle = (i / 26) * Math.PI * 2 + rng() * 0.2
    const radius = 150 + rng() * 210
    s.position.set(Math.cos(angle) * radius, -34 + rng() * 12, Math.sin(angle) * radius - 20)
    const sc = 110 + rng() * 130
    s.scale.set(sc, sc * 0.42, 1)
    s.userData.speed = 0.2 + rng() * 0.5
    puffGroup.add(s)
    puffs.push(s)
  }
}

/* ============================================================
   帆：可鼓动的曲面
   ============================================================ */

function makeSailGeometry(w, h, segW = 10, segH = 12) {
  const geo = new THREE.PlaneGeometry(w, h, segW, segH)
  const pos = geo.attributes.position
  const base = []
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const u = (x + w / 2) / w
    const v = (y + h / 2) / h
    const taper = 1 - v * 0.22
    const bx = x * taper
    const billow = Math.sin(u * Math.PI * 0.92) * Math.sin(v * Math.PI * 0.94) * 1.5
    pos.setX(i, bx)
    pos.setZ(i, billow)
    base.push({ bx, y, billow, u, v })
  }
  geo.userData.base = base
  geo.computeVertexNormals()
  return geo
}

function updateSail(geo, time, phase, amount = 0.16) {
  const pos = geo.attributes.position
  const base = geo.userData.base
  if (!base) return
  for (let i = 0; i < pos.count; i++) {
    const b = base[i]
    const wobble = 1 + Math.sin(time * 1.7 + phase + b.v * 2.4 + b.u * 1.2) * amount
    pos.setZ(i, b.billow * wobble)
  }
  pos.needsUpdate = true
}

function addSail(parent, opts) {
  const { x = 0, y = 0, z = 0, rotY = 0, scale = 1, phase = 0, warm = false, height = 9 } = opts
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = rotY
  g.scale.setScalar(scale)
  parent.add(g)

  const mastH = height + 2
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, mastH, 6), M.metalDark)
  mast.position.y = mastH / 2
  mast.castShadow = true
  g.add(mast)

  const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), M.metalDark)
  spar.position.set(0, height - 0.4, 1.9)
  g.add(spar)

  const sailW = 4.4
  const sailH = height - 1.6
  const geo = makeSailGeometry(sailW, sailH)
  const sail = new THREE.Mesh(geo, warm ? M.clothWarm : M.cloth)
  sail.position.set(0, height - 0.6 - sailH / 2, 0.2)
  sail.rotation.y = Math.PI / 2
  sail.castShadow = true
  g.add(sail)

  // 帆缘能量线
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, sailH * 0.96, 0.05), warm ? M.glowAmber : M.glowTealDim)
  edge.position.set(0, height - 0.6 - sailH / 2, 2.25)
  g.add(edge)

  // 顶灯
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), warm ? M.glowAmber : M.glowTeal)
  lamp.position.y = mastH
  g.add(lamp)

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: warm ? 0xffb87a : 0x6ff5e4,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  sprite.position.y = mastH
  sprite.scale.setScalar(2.4)
  g.add(sprite)

  // 绳索
  const ropeGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, height - 0.3, 2.2),
    new THREE.Vector3(0, height * 0.35, 1.5),
    new THREE.Vector3(0, 0.6, 0.9),
  ])
  g.add(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x2a3f42, transparent: true, opacity: 0.8 })))

  return { group: g, geo, phase }
}

/* ============================================================
   岛屿 / 平台
   ============================================================ */

function makeIslandRock(r, depth, rng) {
  const geo = new THREE.ConeGeometry(r * 0.995, depth, 26, 10, false)
  geo.rotateX(Math.PI)
  geo.translate(0, -depth / 2, 0)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = THREE.MathUtils.clamp(-v.y / depth, 0, 1)
    const ang = Math.atan2(v.z, v.x)
    const n =
      Math.sin(ang * 2.3 + v.y * 0.31) * 0.6 +
      Math.sin(ang * 5.1 - v.y * 0.17) * 0.3 +
      Math.sin(ang * 9.7 + 1.3) * 0.12
    const k = 1 + n * 0.2 * t
    pos.setXYZ(i, v.x * k, v.y, v.z * k)
  }
  geo.computeVertexNormals()
  return geo
}

function addGrass(g, r, rng, count = 90) {
  const geo = new THREE.ConeGeometry(0.05, 0.55, 3)
  geo.translate(0, 0.275, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0x7f9a7d, roughness: 1, flatShading: true })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const rr = Math.sqrt(rng()) * r * 0.9
    dummy.position.set(Math.cos(a) * rr, 0.02, Math.sin(a) * rr)
    dummy.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.4)
    const s = 0.4 + rng() * 0.7
    dummy.scale.set(0.8 + rng() * 0.5, s, 0.8 + rng() * 0.5)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    color.setHSL(0.34 + rng() * 0.05, 0.16 + rng() * 0.12, 0.3 + rng() * 0.16)
    mesh.setColorAt(i, color)
  }
  mesh.instanceColor.needsUpdate = true
  mesh.receiveShadow = true
  g.add(mesh)
}

function addRuin(g, rng, radius) {
  const stone = M.stone
  const n = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2
    const rr = radius * (0.4 + rng() * 0.45)
    const h = 1.6 + rng() * 3.6
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + rng() * 0.14, 0.4, h, 7), stone)
    col.position.set(Math.cos(a) * rr, h / 2, Math.sin(a) * rr)
    col.rotation.z = (rng() - 0.5) * 0.12
    col.castShadow = true
    g.add(col)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95), stone)
    cap.position.set(col.position.x, h + 0.06, col.position.z)
    cap.rotation.y = rng() * Math.PI
    g.add(cap)
  }
  // 半截拱门
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8 + rng() * 0.6, 0.24, 6, 14, Math.PI), stone)
  const aa = rng() * Math.PI * 2
  arch.position.set(Math.cos(aa) * radius * 0.55, 0.1, Math.sin(aa) * radius * 0.55)
  arch.rotation.y = rng() * Math.PI
  arch.castShadow = true
  g.add(arch)
}

function addLantern(g, x, z, y, color = 0x6ff5e4) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 5), M.metalDark)
  pole.position.set(x, y + 0.75, z)
  g.add(pole)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), color === 0x6ff5e4 ? M.glowTeal : M.glowAmber)
  bulb.position.set(x, y + 1.55, z)
  g.add(bulb)
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  sp.position.copy(bulb.position)
  sp.scale.setScalar(1.9)
  g.add(sp)
}

function buildRockPlatform(p, rng, parent, updatables) {
  const g = new THREE.Group()
  g.position.set(p.x, p.y, p.z)
  parent.add(g)

  const depth = p.r * 1.15 + 12
  const rock = new THREE.Mesh(makeIslandRock(p.r, depth, rng), M.rock)
  rock.castShadow = true
  rock.receiveShadow = true
  g.add(rock)

  const topGeo = new THREE.CircleGeometry(p.r * 0.985, 40)
  topGeo.rotateX(-Math.PI / 2)
  const top = new THREE.Mesh(topGeo, M.moss)
  top.position.y = 0.02
  top.receiveShadow = true
  g.add(top)

  const crust = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.005, p.r * 0.95, 2.4, 40, 1, true), M.mossDark)
  crust.position.y = -1.2
  crust.receiveShadow = true
  g.add(crust)

  addGrass(g, p.r, rng, Math.round(p.r * 14))
  if (p.kind === 'islet') addRuin(g, rng, p.r)

  // 悬挂的绳索与碎屑
  for (let i = 0; i < 4; i++) {
    const a = rng() * Math.PI * 2
    const rr = p.r * (0.3 + rng() * 0.55)
    const len = 2 + rng() * 4
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 3), M.metalDark)
    rope.position.set(Math.cos(a) * rr, -1.4 - len / 2, Math.sin(a) * rr)
    g.add(rope)
    if (rng() > 0.5) addLantern(g, Math.cos(a) * rr, Math.sin(a) * rr, -1.4 - len + 0.4, 0x6ff5e4)
  }

  if (p.kind === 'islet') {
    // 岛屿边缘的系泊风帆，帆面朝外，不挡视线
    const a = rng() * Math.PI * 2
    const sail = addSail(g, {
      x: Math.cos(a) * p.r * 0.76,
      z: Math.sin(a) * p.r * 0.76,
      rotY: -a + Math.PI / 2,
      scale: 0.75 + rng() * 0.25,
      phase: rng() * 6,
      warm: rng() > 0.7,
      height: 8,
    })
    updatables.push((t) => updateSail(sail.geo, t, sail.phase, 0.12))
  } else {
    // 踏脚石：一根断桅 + 风灯，保持通行空间干净
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 5), M.metalDark)
    mast.position.set(p.r * 0.5, 1.7, -p.r * 0.35)
    mast.rotation.z = 0.22
    mast.castShadow = true
    g.add(mast)
    const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.1), M.clothWarm)
    pennant.position.set(p.r * 0.5 + 0.12, 3.2, -p.r * 0.35 + 0.4)
    pennant.rotation.z = 0.22
    g.add(pennant)
    addLantern(g, -p.r * 0.42, p.r * 0.32, 0, 0x6ff5e4)
  }

  // 平台边缘的低亮描边
  const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.985, 0.045, 4, 64), M.glowTealDim)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.08
  g.add(rim)

  return g
}

function buildDock(parent, rng, updatables) {
  const p = PLATFORMS.find((x) => x.id === 'dock')
  const g = new THREE.Group()
  g.position.set(p.x, p.y, p.z)
  parent.add(g)

  const depth = 22
  const rock = new THREE.Mesh(makeIslandRock(p.r * 0.99, depth, rng), M.rock)
  rock.castShadow = true
  rock.receiveShadow = true
  g.add(rock)

  // 甲板
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.98, 2.2, 44), M.hull)
  deck.position.y = -1.1
  deck.castShadow = true
  deck.receiveShadow = true
  g.add(deck)

  // 甲板铺板
  for (let i = 0; i < 11; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(p.r * 1.7, 0.1, 1.15), M.metalDark)
    plank.position.set(0, 0.06, -p.r * 0.78 + i * 1.75)
    plank.rotation.y = (rng() - 0.5) * 0.015
    plank.receiveShadow = true
    g.add(plank)
    if (i % 3 === 1) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(p.r * 1.7, 0.02, 0.045), M.glowTealDim)
      seam.position.set(0, 0.12, plank.position.z)
      g.add(seam)
    }
  }

  // 边缘描边
  const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.985, 0.06, 4, 64), M.glowTealDim)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.12
  g.add(rim)

  // 栏杆
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2
    if (a > 1.9 && a < 2.5) continue // 朝栈桥方向留开口
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), M.metalDark)
    post.position.set(Math.cos(a) * p.r * 0.94, 0.55, Math.sin(a) * p.r * 0.94)
    post.castShadow = true
    g.add(post)
  }

  // 拾荒者小屋
  const shack = new THREE.Group()
  shack.position.set(-5.4, 0, 4.6)
  shack.rotation.y = 0.5
  g.add(shack)
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.2), M.metalDark)
  walls.position.y = 1.3
  walls.castShadow = true
  shack.add(walls)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 3.8), M.metal)
  roof.position.y = 2.7
  roof.rotation.z = 0.06
  roof.castShadow = true
  shack.add(roof)
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), M.glass)
  windowGlow.position.set(0.1, 1.7, 1.62)
  shack.add(windowGlow)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), M.glowAmber)
  lamp.position.set(0, 2.5, 1.7)
  shack.add(lamp)

  // 箱子
  for (let i = 0; i < 6; i++) {
    const s = 0.7 + rng() * 0.5
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), i % 3 === 0 ? M.wood : M.metalDark)
    box.position.set(-2 + rng() * 4, s / 2, 8 + rng() * 2.4)
    box.rotation.y = rng() * Math.PI
    box.castShadow = true
    g.add(box)
    const strip = new THREE.Mesh(new THREE.BoxGeometry(s * 1.01, 0.05, 0.05), M.glowTealDim)
    strip.position.copy(box.position).setY(s * 0.7)
    strip.rotation.y = box.rotation.y
    g.add(strip)
  }

  // 起重机
  const crane = new THREE.Group()
  crane.position.set(-6.6, 0, -2.2)
  g.add(crane)
  const cmast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 7.5, 8), M.metal)
  cmast.position.y = 3.75
  cmast.castShadow = true
  crane.add(cmast)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 6.4), M.metal)
  arm.position.set(0, 7.4, 2.4)
  arm.rotation.x = -0.12
  arm.castShadow = true
  crane.add(arm)
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 3), M.metalDark)
  cable.position.set(0, 5.7, 5.2)
  crane.add(cable)
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 5, 10), M.glowAmber)
  hook.position.set(0, 4.1, 5.2)
  crane.add(hook)

  // 信标
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.6, 6), M.metalDark)
  beaconPole.position.set(-9.4, 2.8, -5)
  g.add(beaconPole)
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), M.glowAmber)
  beacon.position.set(-9.4, 5.8, -5)
  g.add(beacon)
  const beaconGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffb87a,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  beaconGlow.position.copy(beacon.position)
  beaconGlow.scale.setScalar(3.4)
  g.add(beaconGlow)
  updatables.push((t) => {
    beacon.rotation.y = t * 0.8
    beaconGlow.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.25
  })

  // 招牌
  const signTex = makeTextTexture(
    [
      { text: 'CIRRUS REACH', size: 46, weight: 600 },
      { text: 'SALVAGE DEPOT · 07', size: 22, alpha: 0.75 },
    ],
    { width: 512, height: 192 }
  )
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 2.4),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  )
  sign.position.set(8.2, 3.2, -4.5)
  sign.rotation.y = -0.55
  g.add(sign)

  // 停泊的拾荒小艇
  const skiff = new THREE.Group()
  skiff.position.set(1.6, -0.2, 10.6)
  skiff.rotation.y = 0.16
  g.add(skiff)
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 3.6, 6, 12), M.hull)
  hull.rotation.z = Math.PI / 2
  hull.scale.set(1, 0.72, 0.8)
  hull.position.y = 0.55
  hull.castShadow = true
  skiff.add(hull)
  const deckPlate = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 1.7), M.metal)
  deckPlate.position.y = 0.95
  skiff.add(deckPlate)
  const sail = addSail(skiff, { y: 1, scale: 0.72, phase: 2.2, height: 7 })
  updatables.push((t) => updateSail(sail.geo, t, sail.phase, 0.18))
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.8, 8), M.metalDark)
  engine.rotation.z = Math.PI / 2
  engine.position.set(-2.3, 0.7, 0)
  skiff.add(engine)
  const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), M.glowTeal)
  engineGlow.rotation.y = -Math.PI / 2
  engineGlow.position.set(-2.72, 0.7, 0)
  skiff.add(engineGlow)

  // 出生点圆环
  const spawnRing = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.35, 40),
    M.glowTealDim.clone()
  )
  spawnRing.rotation.x = -Math.PI / 2
  spawnRing.position.set(0, 0.08, -1.6)
  g.add(spawnRing)
  updatables.push((t) => {
    spawnRing.rotation.z = t * 0.4
    spawnRing.material.opacity = 0.3 + Math.sin(t * 2) * 0.12
  })

  return g
}

function buildArena(parent, rng, updatables) {
  const p = ARENA
  const g = new THREE.Group()
  g.position.set(p.x, p.y, p.z)
  parent.add(g)

  const rock = new THREE.Mesh(makeIslandRock(p.r, 58, rng), M.rock)
  rock.castShadow = true
  rock.receiveShadow = true
  g.add(rock)

  // 金属甲板
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.965, 3.4, 64), M.metalDark)
  deck.position.y = -1.7
  deck.castShadow = true
  deck.receiveShadow = true
  g.add(deck)

  const topPlate = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.995, 64), M.deck)
  topPlate.rotation.x = -Math.PI / 2
  topPlate.position.y = 0.01
  topPlate.receiveShadow = true
  g.add(topPlate)

  // 同心能量环
  for (const rr of [9, 15, 21, 25.2]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.1, rr + 0.1, 96), M.glowTealDim)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    g.add(ring)
  }

  // 放射状梁
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 17.4), M.metal)
    beam.position.set(Math.cos(a) * 17.6, 0.03, Math.sin(a) * 17.6)
    beam.rotation.y = -a + Math.PI / 2
    g.add(beam)
  }

  // 甲板边缘：只留发光描边与栏杆，保持视野通透
  const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.005, 0.07, 5, 96), M.glowTealDim)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.08
  g.add(rim)

  // 栏杆
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), M.metalDark)
    post.position.set(Math.cos(a) * p.r * 0.975, 1.15, Math.sin(a) * p.r * 0.975)
    g.add(post)
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.975, 0.05, 4, 96), M.metal)
  rail.rotation.x = Math.PI / 2
  rail.position.y = 1.6
  g.add(rail)

  // 四组系泊风帆
  const sailAngles = [0.7, 2.25, 3.85, 5.4]
  sailAngles.forEach((a, i) => {
    const rr = 22.6
    const sail = addSail(g, {
      x: Math.cos(a) * rr,
      z: Math.sin(a) * rr,
      rotY: -a + Math.PI / 2,
      scale: 1.05,
      phase: i * 1.7,
      warm: i === 2,
      height: 10,
    })
    updatables.push((t) => updateSail(sail.geo, t, sail.phase, 0.14))
    // 风帆底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 0.5, 10), M.hull)
    base.position.set(Math.cos(a) * rr, 0.25, Math.sin(a) * rr)
    g.add(base)
  })

  // 甲板上的残骸与补给
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2
    const rr = 12 + rng() * 10
    const s = 0.5 + rng() * 0.9
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s * 1.4, s, s), i % 2 ? M.wood : M.metalDark)
    crate.position.set(Math.cos(a) * rr, s / 2, Math.sin(a) * rr)
    crate.rotation.y = rng() * Math.PI
    crate.castShadow = true
    g.add(crate)
    const strip = new THREE.Mesh(new THREE.BoxGeometry(s * 1.42, 0.04, 0.04), M.glowTealDim)
    strip.position.copy(crate.position).setY(s * 0.72)
    strip.rotation.y = crate.rotation.y
    g.add(strip)
  }

  // 倾斜的破帆框架
  const wreck = new THREE.Group()
  wreck.position.set(-14, 0, 9)
  wreck.rotation.set(0.1, 0.6, -0.28)
  g.add(wreck)
  const wreckMast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9, 6), M.wood)
  wreckMast.position.y = 4.5
  wreckMast.castShadow = true
  wreck.add(wreckMast)
  const wreckSail = new THREE.Mesh(new THREE.PlaneGeometry(4, 5, 4, 4), M.clothWarm)
  wreckSail.position.set(1.9, 4.6, 0)
  wreckSail.rotation.y = 0.3
  wreck.add(wreckSail)

  // 通向涡轮机的能量导管
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 14, 6), M.metalDark)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(Math.cos(a) * 12.6, 0.22, Math.sin(a) * 12.6)
    pipe.rotation.y = -a
    g.add(pipe)
    const line = new THREE.Mesh(new THREE.BoxGeometry(14, 0.03, 0.03), M.glowTealDim)
    line.position.set(Math.cos(a) * 12.6, 0.38, Math.sin(a) * 12.6)
    line.rotation.y = -a
    g.add(line)
  }

  return g
}

/* ============================================================
   涡轮机
   ============================================================ */

function buildTurbine(parent, updatables) {
  const g = new THREE.Group()
  g.position.set(TURBINE.x, TURBINE.baseY, TURBINE.z)
  parent.add(g)

  // 三级基座
  const tiers = [
    { rTop: 7.2, rBot: 7.8, h: 1.2, y: 0.6 },
    { rTop: 6.2, rBot: 7.0, h: 1.8, y: 2.1 },
    { rTop: 5.0, rBot: 6.0, h: 1.6, y: 3.8 },
  ]
  tiers.forEach((t, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t.rTop, t.rBot, t.h, 32), i === 2 ? M.metal : M.metalDark)
    m.position.y = t.y
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    const band = new THREE.Mesh(new THREE.TorusGeometry(t.rTop + 0.02, 0.05, 4, 48), M.glowTealDim)
    band.rotation.x = Math.PI / 2
    band.position.y = t.y + t.h / 2 - 0.06
    g.add(band)
  })

  // 塔身：开放式桁架，让核心能量透出来
  const towerH = 25
  const towerBase = 5
  const radiusAt = (y) => 3.55 - ((y - towerBase) / towerH) * 0.95
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, towerH, 0.52), M.metal)
    rib.position.set(Math.cos(a) * 3.02, towerBase + towerH / 2, Math.sin(a) * 3.02)
    rib.rotation.y = -a
    rib.castShadow = true
    g.add(rib)
  }
  for (let i = 0; i < 7; i++) {
    const y = towerBase + (i / 6) * towerH
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(y), 0.1, 5, 36), M.metalDark)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    g.add(ring)
  }

  // 能量核心（透过塔身缝隙发光）
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x2fd6c2, toneMapped: false })
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.9, towerH * 0.9, 18, 1, false), coreMat)
  core.position.y = 6 + towerH * 0.45
  g.add(core)
  const coreRod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, towerH * 0.94, 10), M.glowTeal)
  coreRod.position.y = core.position.y
  g.add(coreRod)

  // 核心投在甲板上的冷光
  const coreLight = new THREE.PointLight(0x5ff3e0, 240, 70, 2)
  coreLight.position.y = 17
  g.add(coreLight)
  const coreLightLow = new THREE.PointLight(0x8ff9ea, 90, 34, 2)
  coreLightLow.position.y = 3.2
  g.add(coreLightLow)

  const coreGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 3.1, towerH * 0.86, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x3be8d2,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  )
  coreGlow.position.y = core.position.y
  g.add(coreGlow)

  // 能量环
  const rings = []
  ;[8.5, 14.5, 20.5, 26].forEach((y, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3 - i * 0.22, 0.09, 6, 40), M.glowTeal)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    g.add(ring)
    rings.push(ring)
  })

  // 机舱
  const nacelle = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), M.metal)
  nacelle.scale.set(1, 0.62, 1)
  nacelle.position.y = 31.4
  nacelle.castShadow = true
  g.add(nacelle)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.6, 2.2, 12), M.metalDark)
  cap.position.y = 33.6
  g.add(cap)
  const capLight = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), M.glowAmber)
  capLight.position.y = 34.9
  g.add(capLight)

  // 三片帆状叶片
  const blades = new THREE.Group()
  blades.position.y = 31.6
  g.add(blades)
  const bladeSails = []
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group()
    arm.rotation.y = (i / 3) * Math.PI * 2
    blades.add(arm)

    const spar = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.2, 0.2), M.metal)
    spar.position.x = 9.1
    spar.castShadow = true
    arm.add(spar)

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.1), M.metalDark)
    brace.position.set(3.2, -0.5, 0)
    brace.rotation.x = 0.7
    arm.add(brace)

    const sailW = 9.2
    const sailH = 8.2
    const geo = makeSailGeometry(sailW, sailH, 12, 10)
    const sail = new THREE.Mesh(geo, M.cloth)
    sail.position.set(8.8, -sailH / 2 - 0.15, 0)
    sail.rotation.y = 0
    sail.castShadow = true
    arm.add(sail)
    bladeSails.push({ geo, phase: i * 2.1 })

    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, sailH, 0.06), M.glowTeal)
    edge.position.set(8.8 + sailW * 0.38, -sailH / 2 - 0.15, 0.05)
    arm.add(edge)

    const rope = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(14.6, 0, 0),
        new THREE.Vector3(13.2, -sailH - 0.1, 0.2),
      ]),
      new THREE.LineBasicMaterial({ color: 0x27393d })
    )
    arm.add(rope)
  }

  // 顶部信号光柱（修复前作为路标）
  const signalMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x5ff3e0) },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uStrength;
      void main() {
        float fade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float band = 0.65 + 0.35 * sin(vUv.y * 34.0 - uTime * 4.0);
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        gl_FragColor = vec4(uColor, fade * band * edge * 0.32 * uStrength);
      }
    `,
  })
  const signal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.95, 120, 12, 1, true), signalMat)
  signal.position.y = 34 + 60
  g.add(signal)

  // 修复后的主光束
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9dfff1) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        float core = smoothstep(0.55, 0.0, abs(vUv.x - 0.5));
        float bands = 0.7 + 0.3 * sin(vUv.y * 60.0 - uTime * 9.0);
        gl_FragColor = vec4(uColor, fade * core * bands * uOpacity);
      }
    `,
  })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 6.5, 300, 20, 1, true), beamMat)
  beam.position.y = 34 + 150
  beam.visible = false
  g.add(beam)

  // 修复控制台
  const consoleGroup = new THREE.Group()
  consoleGroup.position.set(0, 0, 6.6)
  g.add(consoleGroup)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.15, 0.6), M.metalDark)
  panel.position.y = 1.2
  panel.rotation.x = -0.32
  panel.castShadow = true
  consoleGroup.add(panel)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), M.glass)
  screen.position.set(0, 1.34, 0.34)
  screen.rotation.x = -0.32
  consoleGroup.add(screen)
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 8), M.metal)
  stand.position.y = 0.6
  consoleGroup.add(stand)
  const screenGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x6ff5e4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  screenGlow.position.set(0, 1.4, 0.6)
  screenGlow.scale.setScalar(2.4)
  consoleGroup.add(screenGlow)

  // 底部周圈的修复锚点
  const anchors = []
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + (i / 3) * Math.PI * 2
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6), M.metal)
    pylon.position.set(Math.cos(a) * 8.2, 1.2, Math.sin(a) * 8.2)
    g.add(pylon)
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), M.glowAmber)
    tip.position.set(Math.cos(a) * 8.2, 2.5, Math.sin(a) * 8.2)
    g.add(tip)
    anchors.push(tip)
  }

  let repaired = false
  let repairGlow = 0

  const turbine = {
    group: g,
    consolePosition: new THREE.Vector3(TURBINE.x, TURBINE.baseY + 1.4, TURBINE.z + 7.2),
    get repaired() {
      return repaired
    },
    setRepaired() {
      if (repaired) return
      repaired = true
      beam.visible = true
      signal.visible = false
      signalMat.uniforms.uStrength.value = 0
      coreMat.color.setHex(0xbafff4)
      capLight.material = M.glowTeal
    },
    reset() {
      repaired = false
      repairGlow = 0
      beam.visible = false
      beamMat.uniforms.uOpacity.value = 0
      signal.visible = true
      signalMat.uniforms.uStrength.value = 1
      coreMat.color.setHex(0x64f7e2)
      capLight.material = M.glowAmber
    },
    update(t, dt) {
      const speed = repaired ? 2.1 : 0.22
      blades.rotation.y += dt * speed
      for (const s of bladeSails) updateSail(s.geo, t, s.phase, repaired ? 0.24 : 0.15)
      rings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.3 + i * 0.12) * (repaired ? 3 : 1)
        ring.position.y = [8.5, 14.5, 20.5, 26][i] + Math.sin(t * 1.2 + i) * 0.12
      })
      const pulse = 0.5 + Math.sin(t * 2.1) * 0.5
      coreGlow.material.opacity = (repaired ? 0.3 : 0.1) + pulse * (repaired ? 0.25 : 0.05)
      signalMat.uniforms.uTime.value = t
      beamMat.uniforms.uTime.value = t
      if (repaired) {
        repairGlow = Math.min(1, repairGlow + dt * 0.6)
        beamMat.uniforms.uOpacity.value = repairGlow * 0.75
        capLight.position.y = 34.9 + Math.sin(t * 3) * 0.1
      }
      anchors.forEach((tip, i) => {
        tip.rotation.y = t * (1 + i * 0.3)
        tip.position.y = 2.5 + Math.sin(t * 2 + i) * 0.1
      })
      screenGlow.material.opacity = repaired ? 0.7 : 0.35 + pulse * 0.2
    },
  }

  updatables.push(turbine.update)
  return turbine
}

/* ============================================================
   线圈代币
   ============================================================ */

function makeTokenMesh() {
  const g = new THREE.Group()
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.085, 8, 26), M.glowTeal)
  g.add(outer)
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 6, 20), M.glowAmber)
  inner.rotation.x = Math.PI / 2
  g.add(inner)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), M.glowAmber)
  g.add(core)
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x7ff8e6,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  sp.scale.setScalar(1.5)
  g.add(sp)
  return g
}

function buildTokens(parent, updatables) {
  const tokens = []
  STATIC_TOKENS.forEach((spot, i) => {
    const g = makeTokenMesh()
    g.position.set(spot.x, spot.y, spot.z)
    g.userData.baseY = spot.y
    g.userData.phase = i * 0.9
    parent.add(g)
    tokens.push({ group: g, baseY: spot.y, phase: i * 0.9, alive: true })
  })
  updatables.push((t) => {
    for (const token of tokens) {
      if (!token.alive) continue
      token.group.position.y = token.baseY + Math.sin(t * 1.6 + token.phase) * 0.22
      token.group.rotation.y = t * 1.4 + token.phase
      token.group.rotation.z = Math.sin(t * 0.9 + token.phase) * 0.18
    }
  })
  return tokens
}

/* ============================================================
   远处的浮岛剪影
   ============================================================ */

function buildDistantIslands(scene, rng) {
  const group = new THREE.Group()
  scene.add(group)
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2
    const dist = 220 + rng() * 420
    const r = 12 + rng() * 34
    const depth = r * 1.4 + 10
    const rock = new THREE.Mesh(makeIslandRock(r, depth, rng), M.rock)
    rock.position.set(Math.cos(a) * dist, -20 + rng() * 70, Math.sin(a) * dist)
    group.add(rock)
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 18), M.mossDark)
    cap.rotation.x = -Math.PI / 2
    cap.position.copy(rock.position).setY(rock.position.y + 0.2)
    group.add(cap)
    // 远处的小风帆
    if (rng() > 0.55) {
      const sail = addSail(group, {
        x: rock.position.x,
        y: rock.position.y,
        z: rock.position.z,
        scale: 1.6 + rng() * 1.6,
        rotY: rng() * Math.PI * 2,
        phase: rng() * 6,
        warm: rng() > 0.7,
        height: 10,
      })
      group.userData.sails = group.userData.sails || []
      group.userData.sails.push(sail)
    }
  }
  return group
}

/* ============================================================
   主入口
   ============================================================ */

export function createWorld(scene, renderer) {
  const updatables = []
  const rng = mulberry32(1337)

  buildSky(scene)
  buildCloudSea(scene, updatables)

  const group = new THREE.Group()
  scene.add(group)

  const dock = buildDock(group, rng, updatables)
  const arena = buildArena(group, rng, updatables)
  const steps = PLATFORMS.filter((p) => p.kind === 'step' || p.kind === 'islet').map((p) =>
    buildRockPlatform(p, rng, group, updatables)
  )
  const distant = buildDistantIslands(scene, rng)
  if (distant.userData.sails) {
    for (const s of distant.userData.sails) updatables.push((t) => updateSail(s.geo, t, s.phase, 0.1))
  }

  const turbine = buildTurbine(group, updatables)
  const tokens = buildTokens(group, updatables)

  // 远处的浮空碎石
  const debris = new THREE.Group()
  group.add(debris)
  const debrisList = []
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2
    const rr = 38 + rng() * 72
    const s = 0.3 + rng() * 1.4
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.rockLight)
    rock.position.set(Math.cos(a) * rr, -12 + rng() * 34, Math.sin(a) * rr)
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3)
    debris.add(rock)
    debrisList.push({ mesh: rock, baseY: rock.position.y, phase: rng() * 6, speed: 0.2 + rng() * 0.4 })
  }
  updatables.push((t) => {
    for (const d of debrisList) {
      d.mesh.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * 0.8
      d.mesh.rotation.y += 0.0015
    }
  })

  // 风力粒子（细小的风线，增强速度感）
  const windCount = 260
  const windGeo = new THREE.BufferGeometry()
  const windPos = new Float32Array(windCount * 3)
  const windSeed = []
  for (let i = 0; i < windCount; i++) {
    const a = rng() * Math.PI * 2
    const rr = 6 + rng() * 70
    windPos[i * 3] = Math.cos(a) * rr
    windPos[i * 3 + 1] = -8 + rng() * 46
    windPos[i * 3 + 2] = Math.sin(a) * rr - 10
    windSeed.push({ speed: 3 + rng() * 9, phase: rng() * 6 })
  }
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3))
  const windMat = new THREE.PointsMaterial({
    color: 0xd8fbf4,
    size: 0.14,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const wind = new THREE.Points(windGeo, windMat)
  group.add(wind)
  updatables.push((t, dt) => {
    const arr = windGeo.attributes.position.array
    for (let i = 0; i < windCount; i++) {
      arr[i * 3] += windSeed[i].speed * dt
      if (arr[i * 3] > 90) arr[i * 3] = -90
    }
    windGeo.attributes.position.needsUpdate = true
    windMat.opacity = 0.28 + Math.sin(t * 0.7) * 0.1
  })

  const world = {
    group,
    dock,
    arena,
    steps,
    turbine,
    tokens,
    updatables,
    sunDir: SUN_DIR,
    update(t, dt) {
      for (const fn of updatables) fn(t, dt)
    },
    collectToken(token) {
      if (!token.alive) return
      token.alive = false
      token.group.visible = false
    },
    addToken(position, parent = group) {
      const g = makeTokenMesh()
      g.position.copy(position)
      parent.add(g)
      const token = {
        group: g,
        baseY: position.y,
        phase: Math.random() * 6,
        alive: true,
        temporary: true,
        bornAt: performance.now(),
      }
      tokens.push(token)
      return token
    },
  }

  return world
}
