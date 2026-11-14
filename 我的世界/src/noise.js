/* ============================================================
   随机数与噪声：世界生成的地形起伏都来自这里
   ============================================================ */

/** mulberry32：小巧的可复现伪随机数发生器 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 整数坐标散列，返回 0..1 */
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t) => t * t * (3 - 2 * t)

/** 二维值噪声，返回 0..1 */
export function valueNoise2(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = smooth(x - xi)
  const v = smooth(y - yi)

  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)

  const top = a + (b - a) * u
  const bottom = c + (d - c) * u
  return top + (bottom - top) * v
}

/** 分形叠加噪声（fBm），返回 0..1 */
export function fbm2(x, y, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq, seed + i * 131) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
