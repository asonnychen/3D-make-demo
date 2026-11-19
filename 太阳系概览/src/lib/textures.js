import * as THREE from 'three'
import { TAU, fbm, ridge, clamp01, mix, mixColor } from './noise.js'

const CACHE = new Map()

function canvasOf(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// 逐像素绘制，fn 返回 [r,g,b] 或 [r,g,b,a]
function paint(w, h, fn) {
  const canvas = canvasOf(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let y = 0; y < h; y += 1) {
    const v = (y + 0.5) / h
    for (let x = 0; x < w; x += 1) {
      const u = (x + 0.5) / w
      const c = fn(u, v, x, y)
      const i = (y * w + x) * 4
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = c.length > 3 ? c[3] : 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, ctx }
}

function toTexture(canvas, { repeat = true, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas)
  if (repeat) tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function mulberry(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 在岩石表面叠加陨石坑；跨左右边界重复绘制保证接缝连续
function addCraters(ctx, w, h, count, seed, strength = 1) {
  const rnd = mulberry(seed)
  for (let i = 0; i < count; i += 1) {
    const cx = rnd() * w
    const lat = rnd()
    const cy = h * (0.06 + lat * 0.88)
    const r = (w / 1024) * (3 + Math.pow(rnd(), 2.6) * 30)
    const depth = 0.35 + rnd() * 0.65
    const offsets = [0, -w, w]
    for (const ox of offsets) {
      const x = cx + ox
      if (x + r < 0 || x - r > w) continue
      const g = ctx.createRadialGradient(x, cy, r * 0.1, x, cy, r)
      g.addColorStop(0, `rgba(0,0,0,${0.3 * depth * strength})`)
      g.addColorStop(0.62, `rgba(0,0,0,${0.12 * depth * strength})`)
      g.addColorStop(0.78, `rgba(255,255,255,${0.14 * depth * strength})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, cy, r, 0, TAU)
      ctx.fill()
    }
  }
}

function rockSurface(colorA, colorB, seed, { craters = 70, rough = 0.55, size = 1024 } = {}) {
  const w = size
  const h = Math.round(size / 2)
  const { canvas, ctx } = paint(w, h, (u, v) => {
    const n = fbm(u * 9, v * 9, { octaves: 5, basePeriod: 9, seed })
    const n2 = fbm(u * 26, v * 26, { octaves: 3, basePeriod: 26, seed: seed + 17 })
    const shade = clamp01(n * 0.72 + n2 * 0.28)
    const base = mixColor(colorA, colorB, Math.pow(shade, 1.3))
    // 大面积暗色玄武岩（月海 / 水星平原）
    const sea = fbm(u * 3.2, v * 3.2, { octaves: 3, basePeriod: 4, seed: seed + 51 })
    const seaMask = clamp01((sea - 0.42) * 2.2) * rough
    const c = mixColor(base, [base[0] * 0.72, base[1] * 0.73, base[2] * 0.76], seaMask)
    return c
  })
  if (craters > 0) addCraters(ctx, w, h, craters, seed + 7)
  return canvas
}

function gasSurface(palette, seed, { bands = 12, warp = 0.035, spot = null, size = 1024, contrast = 1 } = {}) {
  const w = size
  const h = Math.round(size / 2)
  const { canvas, ctx } = paint(w, h, (u, v) => {
    const drift = fbm(u * 5, v * 9, { octaves: 4, basePeriod: 5, seed })
    const flow = fbm(u * 11 + drift * 2.2, v * 22, { octaves: 3, basePeriod: 11, seed: seed + 9 })
    const bandPos = v * bands + (drift - 0.5) * warp * bands * 1.8 + (flow - 0.5) * 0.7
    const idx = bandPos - Math.floor(bandPos)
    const c1 = palette[Math.floor(bandPos + 0.5) % palette.length]
    const c2 = palette[Math.floor(bandPos + 0.5) % palette.length]
    const c3 = palette[(Math.floor(bandPos + 0.5) + 1) % palette.length]
    const base = mixColor(c2, c3, clamp01(idx))
    const turb = (flow - 0.5) * 0.5 * contrast
    const shaded = [
      clamp01(base[0] / 255 + turb) * 255,
      clamp01(base[1] / 255 + turb) * 255,
      clamp01(base[2] / 255 + turb) * 255,
    ]
    return mixColor(base, shaded, 0.55)
  })
  if (spot) {
    const { x, y, rx, ry, color } = spot
    ctx.save()
    ctx.translate(x * w, y * h)
    ctx.scale(rx * w, ry * h)
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1)
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0.92)`)
    g.addColorStop(0.55, `rgba(${color[0] * 0.8},${color[1] * 0.6},${color[2] * 0.5},0.55)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  return canvas
}

function earthSurface(seed) {
  const w = 1024
  const h = 512
  const { canvas, ctx } = paint(w, h, (u, v) => {
    const lat = Math.abs(v - 0.5) * 2 // 0 赤道 → 1 极点
    const continent = fbm(u * 9, v * 11, { octaves: 6, basePeriod: 9, seed })
    const warp = fbm(u * 16, v * 20, { octaves: 3, basePeriod: 16, seed: seed + 41 })
    const detail = fbm(u * 34, v * 42, { octaves: 5, basePeriod: 34, seed: seed + 13 })
    const elevation = continent * 0.72 + warp * 0.13 + detail * 0.15
    const ice = clamp01((lat - 0.78) * 3.6)
    let base
    if (elevation > 0.535) {
      const land = clamp01((elevation - 0.535) * 14)
      const desert = clamp01(1 - Math.abs(lat - 0.27) * 2.1) * 0.55
      let c = mixColor([40, 64, 44], [92, 90, 66], Math.pow(detail, 1.4) * 0.9)
      c = mixColor(c, [138, 118, 86], desert)
      c = mixColor(c, [78, 72, 60], clamp01((elevation - 0.73) * 4))
      base = mixColor([54, 82, 62], c, clamp01(land * 1.6))
    } else {
      const deep = clamp01((0.535 - elevation) * 8)
      base = mixColor([22, 54, 88], [7, 20, 42], Math.pow(deep, 0.75))
    }
    if (ice > 0) {
      base = mixColor(base, [226, 234, 242], clamp01(ice * 1.5))
    }
    return base
  })
  // 海岸线的一点柔光
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.05
  ctx.fillStyle = '#9fc4e0'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

function cloudSurface(seed) {
  const w = 1024
  const h = 512
  const { canvas } = paint(w, h, (u, v) => {
    const lat = Math.abs(v - 0.5) * 2
    const swirl = fbm(u * 7 + Math.sin(v * 9) * 0.05, v * 14, { octaves: 5, basePeriod: 7, seed })
    const fine = ridge(u * 21, v * 33, { octaves: 3, basePeriod: 21, seed: seed + 5 })
    const band = 0.66 + Math.sin(v * Math.PI * 7.5) * 0.09
    const density = clamp01((swirl * 0.66 + fine * 0.34 - band) * 4.2)
    const alpha = Math.round(Math.pow(density, 1.9) * 232)
    return [246, 248, 250, alpha]
  })
  return canvas
}

function sunSurface(seed) {
  const w = 1024
  const h = 512
  return paint(w, h, (u, v) => {
    const granule = fbm(u * 58, v * 58, { octaves: 5, basePeriod: 58, seed })
    const cell = ridge(u * 34, v * 34, { octaves: 4, basePeriod: 34, seed: seed + 4 })
    const spot = fbm(u * 4, v * 4, { octaves: 2, basePeriod: 4, seed: seed + 8 })
    const hot = clamp01(granule * 0.6 + cell * 0.5)
    let c = mixColor([255, 76, 8], [255, 188, 80], Math.pow(hot, 1.45))
    if (spot < 0.34) c = mixColor(c, [128, 30, 4], clamp01((0.34 - spot) * 5) * 0.78)
    return c
  }).canvas
}

function ringSurface(seed) {
  const w = 1024
  const h = 8
  const { canvas } = paint(w, h, (u) => {
    const broad = fbm(u * 6, 0.5, { octaves: 3, basePeriod: 6, seed })
    const mid = fbm(u * 9, 0.5, { octaves: 3, basePeriod: 9, seed: seed + 3 })
    const fine = fbm(u * 17, 0.5, { octaves: 2, basePeriod: 17, seed: seed + 9 })
    const gapA = Math.exp(-Math.pow((u - 0.43) / 0.02, 2))
    const gapB = Math.exp(-Math.pow((u - 0.69) / 0.028, 2))
    const gapC = Math.exp(-Math.pow((u - 0.14) / 0.016, 2))
    const gapD = Math.exp(-Math.pow((u - 0.85) / 0.012, 2))
    const edge = Math.min(1, u * 6) * Math.min(1, (1 - u) * 9)
    const density = clamp01(0.08 + broad * 0.82 + mid * 0.24 + fine * 0.1 - gapA * 0.9 - gapB * 0.58 - gapC * 0.5 - gapD * 0.45)
    const alpha = Math.round(clamp01(density * edge) * 186)
    const warm = mixColor([132, 118, 94], [248, 238, 214], clamp01(broad * 0.8 + fine * 0.35))
    return [warm[0], warm[1], warm[2], alpha]
  })
  return canvas
}

// 对外统一入口：每种天体一张缓存纹理
export function createSurfaceTexture(kind, seed = 1) {
  const key = `${kind}:${seed}`
  if (CACHE.has(key)) return CACHE.get(key)
  let canvas
  switch (kind) {
    case 'sun':
      canvas = sunSurface(seed)
      break
    case 'mercury':
      canvas = rockSurface([104, 98, 92], [176, 168, 158], seed, { craters: 130, rough: 0.75 })
      break
    case 'venus':
      canvas = gasSurface(
        [
          [204, 178, 128],
          [232, 206, 154],
          [214, 186, 134],
          [246, 226, 178],
          [198, 170, 120],
        ],
        seed,
        { bands: 9, warp: 0.05, contrast: 0.7 },
      )
      break
    case 'earth':
      canvas = earthSurface(seed)
      break
    case 'moon':
      canvas = rockSurface([86, 84, 82], [196, 193, 188], seed, { craters: 190, rough: 1.15, size: 1024 })
      break
    case 'mars':
      canvas = rockSurface([126, 68, 44], [206, 130, 86], seed, { craters: 90, rough: 0.6 })
      break
    case 'jupiter':
      canvas = gasSurface(
        [
          [176, 150, 120],
          [222, 204, 176],
          [146, 108, 84],
          [236, 224, 202],
          [186, 140, 110],
          [248, 238, 220],
          [158, 118, 92],
        ],
        seed,
        {
          bands: 14,
          warp: 0.045,
          contrast: 1.1,
          spot: { x: 0.72, y: 0.63, rx: 0.075, ry: 0.045, color: [186, 92, 60] },
        },
      )
      break
    case 'saturn':
      canvas = gasSurface(
        [
          [228, 212, 176],
          [250, 240, 212],
          [206, 188, 150],
          [252, 246, 224],
          [236, 220, 184],
        ],
        seed,
        { bands: 11, warp: 0.03, contrast: 0.7 },
      )
      break
    case 'uranus':
      canvas = gasSurface(
        [
          [150, 206, 208],
          [176, 224, 224],
          [142, 196, 200],
          [188, 232, 232],
        ],
        seed,
        { bands: 7, warp: 0.018, contrast: 0.35 },
      )
      break
    case 'neptune':
      canvas = gasSurface(
        [
          [36, 66, 146],
          [52, 88, 176],
          [30, 54, 122],
          [74, 116, 200],
        ],
        seed,
        { bands: 8, warp: 0.024, contrast: 0.6 },
      )
      break
    default:
      canvas = rockSurface([110, 110, 110], [190, 190, 190], seed, { craters: 40 })
  }
  const texture = toTexture(canvas)
  CACHE.set(key, texture)
  return texture
}

export function createCloudTexture(seed = 3) {
  const key = `clouds:${seed}`
  if (CACHE.has(key)) return CACHE.get(key)
  const texture = toTexture(cloudSurface(seed))
  CACHE.set(key, texture)
  return texture
}

export function createRingTexture(seed = 5) {
  const key = `ring:${seed}`
  if (CACHE.has(key)) return CACHE.get(key)
  const texture = toTexture(ringSurface(seed))
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  CACHE.set(key, texture)
  return texture
}

// 太阳外辉光：径向渐变贴图
export function createGlowTexture(inner = 'rgba(255,196,96,0.95)', outer = 'rgba(255,120,20,0)') {
  const size = 256
  const canvas = canvasOf(size, size)
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.28, 'rgba(255,166,64,0.42)')
  g.addColorStop(0.62, 'rgba(255,120,26,0.12)')
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 星点：一点柔光，避免屏幕上的小点过于生硬
export function createStarTexture() {
  const size = 32
  const canvas = canvasOf(size, size)
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(220,228,240,0.55)')
  g.addColorStop(1, 'rgba(180,196,220,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export { toTexture, paint, canvasOf, mix }
