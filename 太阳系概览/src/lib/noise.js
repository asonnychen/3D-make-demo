// 平铺值噪声 + 分形布朗运动，用于程序化生成天体表面
const TAU = Math.PI * 2

function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 1442695040
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const smooth = (t) => t * t * (3 - 2 * t)

// x 以格点周期 period 平铺，保证纹理左右无缝
export function tileNoise(x, y, period, seed = 1) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smooth(x - x0)
  const ty = smooth(y - y0)
  const wrap = (v) => ((v % period) + period) % period
  const xa = wrap(x0)
  const xb = wrap(x0 + 1)
  const ya = y0
  const yb = y0 + 1
  const n00 = hash2(xa, ya, seed)
  const n10 = hash2(xb, ya, seed)
  const n01 = hash2(xa, yb, seed)
  const n11 = hash2(xb, yb, seed)
  const a = n00 + (n10 - n00) * tx
  const b = n01 + (n11 - n01) * tx
  return a + (b - a) * ty
}

export function fbm(x, y, { octaves = 4, basePeriod = 4, seed = 1, gain = 0.5, lacunarity = 2 } = {}) {
  let amp = 1
  let sum = 0
  let norm = 0
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    const period = Math.max(2, Math.round(basePeriod * freq))
    sum += tileNoise(x * freq, y * freq, period, seed + i * 91) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

// 平滑的脊状噪声，用来做云带与气流
export function ridge(x, y, options = {}) {
  const n = fbm(x, y, options)
  return 1 - Math.abs(n * 2 - 1)
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function mix(a, b, t) {
  return a + (b - a) * t
}

export function mixColor(c1, c2, t) {
  return [
    Math.round(mix(c1[0], c2[0], t)),
    Math.round(mix(c1[1], c2[1], t)),
    Math.round(mix(c1[2], c2[2], t)),
  ]
}

export { TAU }
